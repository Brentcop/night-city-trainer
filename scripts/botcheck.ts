// Compare two bot configurations head-to-head in the duplicate format: every ordered pairing of the chosen decks, --per
// deals each, and every deal played twice with the same decks, seed and first player: A piloting the first deck against
// B, then B piloting it against A. What the deal favours cancels out of the difference.
//   npx tsx scripts/botcheck.ts '{"deep":3}' '{}' [--per 4] [--decks meta|all|<file prefix>] [--seed 31337] [--threads N]
// --decks: the meta lists (default), the whole library (data/decks and data/decks/custom), or the library files whose
//   name starts with the prefix (e.g. ladder-, s2-).
// --seed: the first deal's seed; each deal after it takes the next seed.
// Prints A's win rate with the paired 95% interval (duplicateSummary, src/lib/evidence.ts), the pairs split (each config
// won one game) and swept, the per-pair SD of the difference, and the plain binomial interval on the same games for
// comparison. A pair with a game that throws is reported (first stack printed) and left out; the exit code is then 1.
import { cli, int, loadLibrary, runJobsDetailed, str, threadsOpt } from './lib-node';
import { duplicateSummary, scoreOf } from '../src/lib/evidence';
import type { AgentSpec, MatchJob, MatchResult } from './worker';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    per: int(4, { min: 1 }),
    decks: str('meta', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
    seed: int(31337),
    threads: threadsOpt(),
  },
  { maxPositionals: 2 },
);
const parseSpec = (s: string | undefined, which: string): AgentSpec => {
  try {
    const v = JSON.parse(s ?? '{}');
    if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('not an object');
    return v;
  } catch (e) {
    console.error(`error: bot config ${which} must be a JSON object, e.g. '{"deep":3}' (${(e as Error).message})`);
    process.exit(2);
  }
};
const [A, B] = [parseSpec(positionals[0], 'A'), parseSpec(positionals[1], 'B')];
const lib = loadLibrary();
const baseName = (file: string) => file.slice(file.lastIndexOf('/') + 1);
const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => baseName(d.file).startsWith(V.decks));
if (field.length < 2) {
  console.error(`error: --decks ${V.decks} matches ${field.length} deck${field.length === 1 ? '' : 's'}; at least 2 are needed.\nRun with --help for usage.`);
  process.exit(2);
}

// One deal per (deck x, deck y, k): its seed is unique, so it keys the pair. In the worker, agentA pilots seat 0 (deck
// a, bot seeded with the game seed) and agentB seat 1 (deck b, seed + 7777); the swap changes only which config is which.
const deal: Omit<MatchJob, 'agentA' | 'agentB'>[] = [];
let seed = V.seed;
for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < V.per; k++) deal.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: 'lookahead' });
// The two halves run side by side in two pools, so each result is known to belong to its half.
const half = Math.max(1, Math.ceil(V.threads / 2));
const [ab, ba] = await Promise.all([
  runJobsDetailed(deal.map((j) => ({ ...j, agentA: A, agentB: B })), { threads: half, allowErrors: true }),
  runJobsDetailed(deal.map((j) => ({ ...j, agentA: B, agentB: A })), { threads: Math.max(1, V.threads - half), allowErrors: true, quiet: true }),
]);
const bySeed = (rs: MatchResult[]) => new Map(rs.map((r) => [r.seed, r]));
const [withA, withB] = [bySeed(ab.results), bySeed(ba.results)];
const aSeat0: number[] = [];
const bSeat0: number[] = [];
for (const j of deal) {
  const ra = withA.get(j.seed);
  const rb = withB.get(j.seed);
  if (!ra || !rb) continue;
  aSeat0.push(scoreOf(ra.winner));
  bSeat0.push(scoreOf(rb.winner));
}
const errs = [...ab.errors, ...ba.errors];
const s = duplicateSummary(aSeat0, bSeat0);
const pc = (x: number) => (100 * x).toFixed(1);
const pairedHalf = (s.upper95 - s.lower95) / 2;
console.log(
  `A ${JSON.stringify(A)} vs B ${JSON.stringify(B)}: A wins ${pc(s.winRate)}% [${pc(s.lower95)}, ${pc(s.upper95)}] (95%, paired) over ${s.pairs} pairs (${2 * s.pairs} games, ${field.length} decks)` +
    (errs.length ? `, ${errs.length} game errors (their pairs excluded): ${errs[0].error?.slice(0, 300)}` : ''),
);
console.log(`  pairs split ${s.split} (each config won one), swept ${s.swept} (A ${s.sweptByA}, B ${s.swept - s.sweptByA}), with a tie ${s.tied}`);
console.log(
  `  per-pair SD of the difference ${s.sdDiff.toFixed(2)} (about 0.71 if the two games were unrelated); half-width paired ±${pc(pairedHalf)}, unpaired binomial on the same games ±${pc(s.unpairedHalf95)}`,
);
