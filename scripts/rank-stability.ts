// SIM-3: are deck rankings stable across bots? Plays the same round robin once per bot on the SAME deals (every ordered
// pairing of the chosen decks, --per deals each, first player alternating; both seats piloted by the bot under test),
// then reports each deck's win rate against the field, rank and Sim-tier band (src/lib/simTier.ts) under each bot,
// Spearman's rank correlation between every two bots with a paired bootstrap 95% interval (deals resampled within each
// pairing, the same deals for every bot), and the decks whose rank or band moved by more than the noise allows (rank:
// the bootstrap interval of its rank change excludes 0; band: the letter differs and the win-rate change is beyond 1.96
// paired SE). Maths in src/lib/rankStability.ts.
//   npx tsx scripts/rank-stability.ts [--bots medium,hard] [--decks meta|all|<file prefix>] [--per 50] [--seed 61001]
//     [--boot 2000] [--threads N] [--out DIR] [--force]
// --bots: two or more tier names (easy, medium, hard, deep, ...), comma-separated.
// --out: also write the per-deck table and the comparisons, with a run manifest, to DIR/rank-stability-<decks>-<bots>.json
//   (refuses to overwrite it without --force). Nothing else is written.
import fs from 'node:fs';
import path from 'node:path';
import { bool, cli, int, loadLibrary, runJobsDetailed, runMain, str, threadsOpt, Refusal, TIER_BOTS } from './lib-node';
import { scoreOf } from '../src/lib/evidence';
import { rankStability, type Deal } from '../src/lib/rankStability';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchJob, MatchResult } from './worker';

const { values: V } = cli(import.meta.url, {
  bots: str('medium,hard', (v) => {
    const bs = v.split(',').map((x) => x.trim());
    if (bs.length < 2) return 'at least two bots, comma-separated';
    const bad = bs.find((b) => !(TIER_BOTS as readonly string[]).includes(b));
    if (bad) return `unknown bot "${bad}" (one of ${TIER_BOTS.join(', ')})`;
    if (new Set(bs).size !== bs.length) return 'a bot is listed twice';
    return undefined;
  }),
  decks: str('meta', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  per: int(50, { min: 1 }),
  seed: int(61001),
  boot: int(2000, { min: 100 }),
  threads: threadsOpt(),
  out: str(),
  force: bool(),
});

runMain(async () => {
  const bots = V.bots.split(',').map((x) => x.trim());
  const lib = loadLibrary();
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1);
  const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => base(d.file).startsWith(V.decks));
  if (field.length < 3) throw new Refusal(`--decks ${V.decks} matches ${field.length} decks; at least 3 are needed to rank`);
  const outFile = V.out ? path.join(V.out, `rank-stability-${V.decks}-${bots.join('-')}.json`) : null;
  if (outFile && fs.existsSync(outFile) && !V.force) throw new Refusal(`${outFile} exists; pass --force to overwrite it`);

  const deals: (Deal & { seed: number; first: 0 | 1 })[] = [];
  let seed = V.seed;
  for (let x = 0; x < field.length; x++) for (let y = 0; y < field.length; y++) if (x !== y) for (let k = 0; k < V.per; k++) deals.push({ a: x, b: y, seed: seed++, first: (k % 2) as 0 | 1 });
  console.log(`${field.length} decks, ${deals.length} deals per bot (${V.per} per ordered pairing), bots ${bots.join(', ')}`);

  const byBot: Map<number, MatchResult>[] = [];
  const seconds: number[] = [];
  for (const bot of bots) {
    const t0 = Date.now();
    const jobs: MatchJob[] = deals.map((d) => ({ a: field[d.a]!.deck, b: field[d.b]!.deck, seed: d.seed, first: d.first, bot }));
    const { results } = await runJobsDetailed(jobs, { threads: V.threads, allowErrors: true });
    byBot.push(new Map(results.map((r) => [r.seed, r])));
    seconds.push((Date.now() - t0) / 1000);
    console.log(`  ${bot}: ${results.length} games in ${seconds[seconds.length - 1]!.toFixed(0)} s`);
  }
  // a deal counts only when every bot finished it (a game that threw is never a tie)
  const kept = deals.filter((d) => byBot.every((m) => m.has(d.seed)));
  if (kept.length < deals.length) console.log(`  ${deals.length - kept.length} deals left out: a game threw under at least one bot`);
  const scores = byBot.map((m) => kept.map((d) => scoreOf(m.get(d.seed)!.winner)));
  const rs = rankStability(kept, scores, field.length, { boot: V.boot, seed: V.seed });

  const pc = (x: number) => (100 * x).toFixed(1);
  const half = (wr: number, n: number) => 196 * Math.sqrt((wr * (1 - wr)) / Math.max(1, n));
  console.log(`\nWin rate vs the field (± 95% half-width), rank and Sim-tier band per bot:`);
  const name = (i: number) => field[i]!.deck.name.slice(0, 34).padEnd(34);
  const order = field.map((_, i) => i).sort((p, q) => rs.bots[rs.bots.length - 1]!.rank[p]! - rs.bots[rs.bots.length - 1]!.rank[q]!);
  console.log(`  ${'deck'.padEnd(34)} ${bots.map((b) => b.padStart(22)).join('')}`);
  for (const i of order) console.log(`  ${name(i)} ${rs.bots.map((b) => `${pc(b.wr[i]!).padStart(5)}±${half(b.wr[i]!, b.n[i]!).toFixed(1).padStart(4)} #${String(b.rank[i]).padEnd(4)} ${b.band[i]}`.padStart(22)).join('')}`);
  for (const p of rs.pairs) {
    console.log(`\n${bots[p.x]} vs ${bots[p.y]}: Spearman rho ${p.rho.toFixed(3)} [${p.lower.toFixed(3)}, ${p.upper.toFixed(3)}] (bootstrap 95%, ${V.boot} resamples)`);
    const moved = p.decks.filter((d) => d.rankMoved || d.bandMoved);
    const bandDiffers = p.decks.filter((d) => d.bandX !== d.bandY).length;
    const maxShift = Math.max(...p.decks.map((d) => Math.abs(d.rankDelta)));
    console.log(`  band letter differs for ${bandDiffers} of ${p.decks.length} decks (${p.decks.filter((d) => d.bandMoved).length} beyond noise); largest rank change ${maxShift}`);
    const meanAbs = p.decks.reduce((s, d) => s + Math.abs(d.wrDiff), 0) / p.decks.length;
    console.log(`  mean |win-rate change| ${pc(meanAbs)} points; decks whose win rate changed beyond 1.96 paired SE: ${p.decks.filter((d) => Math.abs(d.wrDiff) > 1.96 * d.se).length}`);
    if (!moved.length) console.log('  no deck moved rank or band by more than the noise allows');
    for (const d of moved)
      console.log(
        `  ${name(d.deck)} rank ${rs.bots[p.x]!.rank[d.deck]} → ${rs.bots[p.y]!.rank[d.deck]} (change [${+d.rankLo.toFixed(1)}, ${+d.rankHi.toFixed(1)}]), ` +
          `${pc(rs.bots[p.x]!.wr[d.deck]!)}% → ${pc(rs.bots[p.y]!.wr[d.deck]!)}% (diff ${pc(-d.wrDiff)} ± ${(196 * d.se).toFixed(1)}), band ${d.bandX} → ${d.bandY}` +
          `${d.rankMoved ? ' [rank moved]' : ''}${d.bandMoved ? ' [band moved]' : ''}`,
      );
  }
  if (outFile) {
    const manifest = gameRunManifest({
      purpose: 'analysis',
      decks: field,
      fieldMode: V.decks,
      bot: bots.join(','),
      seedBase: V.seed,
      seatPolicy: 'alternate',
      plannedGames: deals.length * bots.length,
      completedGames: kept.length * bots.length,
      gamesPerPair: V.per,
      simVersion: SIM_VERSION,
    });
    const decks = field.map((d, i) => ({ file: d.file, name: d.deck.name, perBot: Object.fromEntries(bots.map((b, k) => [b, { wr: rs.bots[k]!.wr[i], games: rs.bots[k]!.n[i], rank: rs.bots[k]!.rank[i], band: rs.bots[k]!.band[i] }])) }));
    const pairs = rs.pairs.map((p) => ({ x: bots[p.x], y: bots[p.y], rho: p.rho, lower: p.lower, upper: p.upper, decks: p.decks.map((d) => ({ ...d, deck: field[d.deck]!.file })) }));
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ manifest, bots, per: V.per, seconds, decks, pairs }, null, 1));
    console.log(`\nwrote ${outFile}`);
  }
});
