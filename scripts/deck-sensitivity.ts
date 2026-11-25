// The per-deck sensitivity report (docs/REVIEW_2026-11-24.md row 15, §10 D.3; docs/BOT_TOOLKIT.md §12): which decks a bot
// or evaluation change favours. Plays the same round robin (every ordered pairing of the chosen decks, --per deals each,
// the same seeds and first players) once under the base configuration and once under the change, both seats piloted by
// the configuration under test, and reports per deck its win rate against the field under each, the paired change (a
// pair is one deal under both) with its SE, and its rank under each; then the decks beyond 2 and 3 SE against the
// chance expectation, Spearman of the two orders with a paired bootstrap interval (src/lib/rankStability.ts), the share
// of deals with the same winner, the mean absolute change, and the change against list features (Units, Blockers,
// Programs, Quick Programs, Gear, cards that act on the rival's turn, red Legends, aggroScore, archetype) and deck
// families (BBG control, V / Smasher, two or more red Legends, bred, imported). Maths in src/lib/deckSensitivity.ts.
//   npx tsx scripts/deck-sensitivity.ts <base> <change> [--decks all|meta|<file prefix>] [--per 2] [--seed 61001]
//     [--threads N] [--cache] [--boot 2000] [--perms 2000] [--out DIR] [--label NAME] [--force]
// <base>, <change>: a bot name (easy, medium, hard, hard-main: the tier's own bot, so its games are rank-stability's), a
//   JSON AgentSpec as botcheck takes it ('{"deep":3}'; `{}` has Medium's settings since SIM_VERSION 12, which dropped
//   Medium's matchup profiles), or a name plus overrides: 'medium+{"weights":{"blocker":-3.7}}' (the name's settings, then the JSON's keys).
// Every evaluation or bot change ships this report beside its strength figure (botcheck). Cost: 2 × decks × (decks − 1)
//   × per games: all 71 decks at --per 2 is 9,940 games a configuration (Medium: about 105 s each on 3 threads, 3 min 40 s
//   for the report); Hard at --per 1 is 4,970 a configuration, 9,940 for the pair, each about 25 to 30 Medium games (about
//   45 minutes on 3 threads, 20 on 7).
// --out: also write the per-deck table and the summary, with a run manifest, to
//   DIR/deck-sensitivity-<decks>-<label>.json (label: --label, else a hash of the two configurations, the deals and the
//   seed); refuses to overwrite it without --force. Nothing else is written.
// --cache: read games already played with the same code from .cache/games and store new ones (scripts/game-cache.ts).
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { bool, cli, int, loadLibrary, runJobsDetailed, runMain, str, threadsOpt, Refusal } from './lib-node';
import { cliGameCache } from './game-cache';
import { scoreOf } from '../src/lib/evidence';
import { deckSensitivity, type SensitivityDeck } from '../src/lib/deckSensitivity';
import { deckSource } from '../src/lib/deckSource';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { MatchResult } from './worker';
import { jobsFor, parseConfig, reportLines, roundRobinDeals, type Config } from './deck-sensitivity-run';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    decks: str('all', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: all, meta, or a file-name prefix')),
    per: int(2, { min: 1 }),
    seed: int(61001),
    threads: threadsOpt(),
    cache: bool(),
    boot: int(2000, { min: 100 }),
    perms: int(2000, { min: 100 }),
    out: str(),
    label: str(undefined, (v) => (/^[\w.-]+$/.test(v) ? undefined : 'letters, digits, ".", "_" and "-" only')),
    force: bool(),
  },
  { minPositionals: 2, maxPositionals: 2 },
);
let base: Config;
let change: Config;
try {
  base = parseConfig(positionals[0]!);
  change = parseConfig(positionals[1]!);
} catch (e) {
  console.error(`error: ${(e as Error).message}\nRun with --help for usage.`);
  process.exit(2);
}
const cache = cliGameCache(V.cache);
const configOf = (c: Config) => ('bot' in c ? { bot: c.bot } : { spec: c.spec });

runMain(async () => {
  const lib = loadLibrary();
  const file = (f: string) => f.slice(f.lastIndexOf('/') + 1);
  const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => file(d.file).startsWith(V.decks));
  if (field.length < 3) throw new Refusal(`--decks ${V.decks} matches ${field.length} decks; at least 3 are needed to rank`);
  if (V.per < 2) console.log('note: at --per 1 the bootstrap resamples one deal per pairing, so the Spearman interval has no width');
  const id = createHash('sha256').update(JSON.stringify([configOf(base), configOf(change), V.decks, V.per, V.seed])).digest('hex').slice(0, 10);
  const outFile = V.out ? path.join(V.out, `deck-sensitivity-${V.decks}-${V.label ?? id}.json`) : null;
  if (outFile && fs.existsSync(outFile) && !V.force) throw new Refusal(`${outFile} exists; pass --force to overwrite it`);

  const deals = roundRobinDeals(field.length, V.per, V.seed);
  const lists = field.map((d) => d.deck);
  console.log(`${field.length} decks, ${deals.length.toLocaleString('en-US')} deals per configuration (${V.per} per ordered pairing), seed ${V.seed}, ${V.threads} threads`);
  const results: Map<number, MatchResult>[] = [];
  const seconds: number[] = [];
  for (const [which, c] of [['base', base] as const, ['change', change] as const]) {
    const t0 = Date.now();
    const { results: rs } = await runJobsDetailed(jobsFor(c, deals, lists), { threads: V.threads, allowErrors: true, cache });
    results.push(new Map(rs.map((r) => [r.seed, r])));
    seconds.push((Date.now() - t0) / 1000);
    console.log(`  ${which} (${c.label}): ${rs.length.toLocaleString('en-US')} games in ${seconds[seconds.length - 1]!.toFixed(0)} s`);
  }
  // a deal counts only when both configurations finished it (a game that threw is never a tie)
  const kept = deals.filter((d) => results.every((m) => m.has(d.seed)));
  if (kept.length < deals.length) console.log(`  ${deals.length - kept.length} deals left out: a game threw under at least one configuration`);
  const [sb, sc] = results.map((m) => kept.map((d) => scoreOf(m.get(d.seed)!.winner)));
  const decks: SensitivityDeck[] = field.map((d) => ({ file: file(d.file), name: d.deck.name, source: deckSource(d), legends: d.deck.legends, main: d.deck.main }));
  const rep = deckSensitivity(kept, sb!, sc!, decks, { boot: V.boot, perms: V.perms, seed: V.seed });
  console.log('');
  for (const l of reportLines(rep, { base: base.label, change: change.label })) console.log(l);

  if (outFile) {
    const manifest = gameRunManifest({
      purpose: 'analysis',
      decks: field,
      fieldMode: V.decks,
      bot: `deck-sensitivity: ${base.label} vs ${change.label}`,
      botConfigHash: id,
      seedBase: V.seed,
      seatPolicy: 'alternate',
      plannedGames: 2 * deals.length,
      completedGames: 2 * kept.length,
      gamesPerPair: V.per,
      simVersion: SIM_VERSION,
    });
    const doc = {
      kind: 'nct-deck-sensitivity',
      schema: 1,
      manifest,
      base: { label: base.label, ...configOf(base) },
      change: { label: change.label, ...configOf(change) },
      per: V.per,
      seed: V.seed,
      seconds: { base: seconds[0], change: seconds[1] },
      summary: rep.summary,
      decks: rep.rows,
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify(doc, null, 1));
    console.log(`\nwrote ${outFile}`);
  }
});
