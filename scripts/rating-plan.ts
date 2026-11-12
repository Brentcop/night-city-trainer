// SIM-6: where would extra games narrow the power ratings most? Fits the ratings on the pooled recorded events (the
// same pool and model as scripts/ratings.ts), then plans --budget extra games in pairings of --batch games: each step
// takes the pairing whose result would most reduce the weighted variance of the decks' expected win rates vs the field
// (--target tiers: decks near a Sim-tier boundary, in their own standard deviations, weigh most; width: every deck the
// same). Prints the plan, the expected spread of each affected deck now / after the plan / after the same games spread
// evenly over every pairing, and how many evenly spread games would match the plan. Maths in src/lib/ratingModel.ts.
//
//   npx tsx scripts/rating-plan.ts [--budget 300] [--batch 10] [--target tiers|width] [--sim-version latest|all|N]
//     [--bot latest|all|NAME] [--play [--threads N] [--seed 81001] [--out DIR] [--force]] [--coverage REPS]
//
// --play: also play the planned games (seats alternating, the pool's bot), refit with them added and print how the
//   intervals and Sim-tier letters moved. The games are never recorded as an event; with --out the plan, the games and
//   the refitted table go to DIR/rating-plan-<seed>.json with a run manifest (refuses to overwrite it without --force).
// --coverage REPS: instead, check the 90% interval's coverage on simulated ratings (47 decks, 25 rounds of Bo3, Swiss and random, the
//   full covariance against the old diagonal one) and exit. Writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, oneOf, readEvents, Refusal, runJobsDetailed, runMain, str, threadsOpt, TIER_BOTS } from './lib-node';
import { checkSimVersionFlag, parsePoolFilter, poolEvents, selectEvents } from './event-pool';
import { fieldInterval, fitRatings, planExtraGames, simulateCoverage, type RatedGame } from '../src/lib/ratingModel';
import { bandOf } from '../src/lib/simTier';
import { scoreOf } from '../src/lib/evidence';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob } from './worker';

const { values: V } = cli(import.meta.url, {
  budget: int(300, { min: 1, max: 100_000 }),
  batch: int(10, { min: 1, max: 1000 }),
  target: oneOf(['tiers', 'width'] as const, 'tiers'),
  'sim-version': str('latest', checkSimVersionFlag),
  bot: str('latest'),
  play: bool(),
  threads: threadsOpt(),
  seed: int(81001),
  out: str(),
  force: bool(),
  coverage: int(undefined, { min: 1, max: 100_000 }),
});

const pc = (x: number) => (100 * x).toFixed(1);

runMain(async () => {
  if (V.coverage) {
    for (const swiss of [true, false]) {
      const c = simulateCoverage({ decks: 47, rounds: 25, reps: V.coverage, seed: V.seed, swiss });
      console.log(`${swiss ? 'Swiss' : 'random'} pairings, 47 decks × 25 rounds Bo3, ${c.reps} reps: 90% interval coverage full ${pc(c.full)}% (mean width ${c.fullWidth.toFixed(1)} pts), diagonal ${pc(c.diagonal)}% (${c.diagonalWidth.toFixed(1)} pts)`);
    }
    return;
  }
  const sel = selectEvents(readEvents(), parsePoolFilter(V));
  for (const w of sel.warnings) console.log(w);
  const games = poolEvents(sel.kept).games;
  if (!games.length) throw new Refusal('no pooled tournament games to plan from');
  const lib = loadLibrary();
  const fit = fitRatings(games);
  const all = fit.names.map((_, k) => k);
  const eligible = all.filter((k) => lib.some((d) => d.deck.name === fit.names[k]));
  const left = fit.names.length - eligible.length;
  const plan = planExtraGames(fit, { budget: V.budget, batch: V.batch, target: V.target, eligible });
  const playedGames = plan.picks.reduce((a, p) => a + p.games, 0);
  console.log(`${fit.names.length} decks rated from ${games.length} games (sim v${sel.simVersion} ${sel.bot}); ${eligible.length} have a list in the library${left ? ` (${left} not: never paired)` : ''}.`);
  console.log(`Plan (${V.target}): ${playedGames} games in ${plan.picks.length} pairing(s):`);
  for (const p of plan.picks) console.log(`  ${String(p.games).padStart(4)} × ${fit.names[p.a]} vs ${fit.names[p.b]}   (expected drop ${(p.drop * 1e4).toFixed(2)})`);
  console.log(`Weighted variance sum (×10⁴): now ${(plan.before * 1e4).toFixed(2)}, after the plan ${(plan.after * 1e4).toFixed(2)}, after the same ${playedGames} games spread evenly ${(plan.evenAfter * 1e4).toFixed(2)}.`);
  console.log(
    Number.isFinite(plan.evenGamesForSame)
      ? `An even spread needs ${plan.evenGamesForSame} games to match the plan (${((100 * (1 - playedGames / plan.evenGamesForSame)) | 0)}% fewer with the plan).`
      : `An even spread does not match the plan within ${20 * playedGames} games.`,
  );
  const shown = all
    .filter((k) => plan.decks[k]!.sdNow - plan.decks[k]!.sdPlan > 0.0005 || plan.decks[k]!.weight > 0.5)
    .sort((x, y) => plan.decks[y]!.weight - plan.decks[x]!.weight)
    .slice(0, 20);
  console.log(`\nExpected SD of the win rate vs the field (points): now → plan → even spread, weight (closeness to a tier boundary)`);
  for (const k of shown) {
    const d = plan.decks[k]!;
    const iv = fieldInterval(fit, k, all);
    console.log(`  ${fit.names[k]!.slice(0, 40).padEnd(40)} ${pc(iv.wr).padStart(5)}% ${bandOf(iv.wr)}  ${pc(d.sdNow).padStart(4)} → ${pc(d.sdPlan).padStart(4)} → ${pc(d.sdEven).padStart(4)}  w ${d.weight.toFixed(2)}`);
  }
  if (!V.play) return;

  const outFile = V.out ? path.join(V.out, `rating-plan-${V.seed}.json`) : null;
  if (outFile && fs.existsSync(outFile) && !V.force) throw new Refusal(`${outFile} exists; pass --force to overwrite it`);
  const bot = sel.bot === 'all' ? 'hard' : sel.bot;
  if (!(TIER_BOTS as readonly string[]).includes(bot)) throw new Refusal(`the pool's bot "${bot}" is not one the game worker plays (${TIER_BOTS.join(', ')})`);
  const deckOf = (k: number) => lib.find((d) => d.deck.name === fit.names[k])!;
  const jobs: MatchJob[] = [];
  let seed = V.seed;
  for (const p of plan.picks) for (let g = 0; g < p.games; g++) jobs.push({ a: deckOf(p.a).deck, b: deckOf(p.b).deck, seed: seed++, first: (g % 2) as 0 | 1, bot });
  console.log(`\nPlaying ${jobs.length} games with the ${bot} bot (not recorded as an event)…`);
  const { results, errors } = await runJobsDetailed(jobs, { threads: V.threads, allowErrors: true });
  if (errors.length) console.log(`  ${errors.length} game(s) threw and are left out`);
  const extra: RatedGame[] = results.map((r) => ({ a: r.a, b: r.b, first: r.first, s: scoreOf(r.winner) }));
  const refit = fitRatings([...games, ...extra], { names: fit.names });
  const rows = all.map((k) => {
    const before = fieldInterval(fit, k, all);
    const after = fieldInterval(refit, k, all);
    return { name: fit.names[k]!, before: { wr: before.wr, lo: before.lo, hi: before.hi, band: bandOf(before.wr) }, after: { wr: after.wr, lo: after.lo, hi: after.hi, band: bandOf(after.wr) } };
  });
  const width = (x: { lo: number; hi: number }) => x.hi - x.lo;
  const moved = rows.filter((r) => r.before.band !== r.after.band);
  console.log(`Mean 90% width ${pc(rows.reduce((a, r) => a + width(r.before), 0) / rows.length)} → ${pc(rows.reduce((a, r) => a + width(r.after), 0) / rows.length)} points; letters changed: ${moved.length ? moved.map((r) => `${r.name} ${r.before.band}→${r.after.band}`).join(', ') : 'none'}`);
  for (const r of rows.filter((x) => width(x.before) - width(x.after) > 0.002).sort((x, y) => width(y.before) - width(y.after) - (width(x.before) - width(x.after))))
    console.log(`  ${r.name.slice(0, 40).padEnd(40)} ${pc(r.before.wr)}% [${pc(r.before.lo)}, ${pc(r.before.hi)}] → ${pc(r.after.wr)}% [${pc(r.after.lo)}, ${pc(r.after.hi)}]`);
  if (outFile) {
    const decks = [...new Set(plan.picks.flatMap((p) => [p.a, p.b]))].map((k) => deckOf(k).deck);
    const manifest = gameRunManifest({ purpose: 'analysis', decks, fieldMode: `rating-plan:${V.target}`, bot, seedBase: V.seed, seatPolicy: 'alternate', plannedGames: jobs.length, completedGames: results.length, gamesPerPair: V.batch, simVersion: SIM_VERSION });
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ plan: plan.picks.map((p) => ({ a: fit.names[p.a], b: fit.names[p.b], games: p.games })), games: extra, decks: rows, manifest }, null, 1));
    console.log(`wrote ${outFile}`);
  }
});
