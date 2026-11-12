// Self-play tuning of the bot's evaluation weights.
//   npx tsx scripts/tune.ts [--per 8] [--rounds 1] [--seed 1] [--threads N] [--min-gain 1]
//     [--bot plain|hard] [--format unpaired|paired] [--keys k1,k2,…] [--next-turn] [--start '<weights json>']
//     [--mults 0.5,1.6] [--out DIR] [--dry-run] [--force]
// For each weight, a variant (x0.5 and x1.6) plays the baseline across every pairing of meta decks.
// The default invocation is the tuner as it was (2026-11-11): --bot plain (the 1-ply lookahead bot with noise 0.15 and
// no matchup profiles or card impact, i.e. Medium without its profiles; events are played by Hard), --format unpaired:
// ceil(per/2) games per ordered pairing, first player alternating, the variant always seat 0 against the baseline,
// and a variant is adopted when the lower bound of its paired 95% interval against the baseline-vs-baseline games on
// the same seeds is above zero (scripts/tuning.ts).
// --bot hard: both seats are Hard (src/ai/tiers.ts: deep 3, card impact 40, reaction rollouts 3, the tuned profiles),
//   only the weights differ.
// --format paired (BOT-7): the duplicate format of scripts/botcheck.ts: --per deals per ordered pairing, each played
//   twice with the configs swapped; a variant is adopted when the lower bound of its paired interval (duplicateSummary,
//   src/lib/evidence.ts) is above 50%.
// --keys: the weights searched (default: TUNED_WEIGHTS in src/ai/eval.ts); --next-turn adds exposed, threat and
//   rivalLethal (not in TUNED_WEIGHTS). A weight at 0 has no multiple to try and is skipped (start it with --start).
// --start: the starting weights over DEFAULT_WEIGHTS (e.g. '{"exposed":0.5,"threat":0.5,"rivalLethal":400}'); the
//   held-out check compares the final weights with these.
// The final configuration is compared with the starting one on a separate held-out seed range, and the report says
// whether its held-out lower bound clears the minimum practical gain (--min-gain, percentage points, default 1; for
// paired, over 50%). This script reports candidates, it never applies them.
// The report goes to --out (default reports/) as tune-weights-<seed>-<time>.json; it never overwrites a file unless
// --force; --dry-run writes nothing.
// --cache: read games already played with the same code from .cache/games and store new ones (scripts/game-cache.ts;
//   the baseline's games repeat in every test); prints how many games were hits.
import fs from 'node:fs';
import path from 'node:path';
import { deckFingerprint, fingerprintText } from '../src/engine/deck';
import { DEFAULT_WEIGHTS, NEXT_TURN_WEIGHTS, TUNED_WEIGHTS, type EvalWeights } from '../src/ai/eval';
import { SIM_VERSION } from '../src/lib/tournament';
import { createRunManifest } from '../src/lib/runManifest';
import { RULES_VERSIONS } from '../src/lib/rulesVersions';
import { duplicateSummary, scoreOf, type DuplicateSummary } from '../src/lib/evidence';
import { bool, cli, int, oneOf, loadLibrary, runJobs, runMain, str, threadsOpt } from './lib-node';
import { HARD_SPEC, type AgentSpec } from './agent-spec';
import type { MatchJob } from './worker';
import { cliGameCache } from './game-cache';
import { adoptInTraining, assertFitsWindow, DEFAULT_MIN_GAIN_PP, passesHeldOut, seedPlan, summarizePaired, WEIGHT_SEEDS, type PairedSummary } from './tuning';

const KNOWN = Object.keys(DEFAULT_WEIGHTS);
const { values: V } = cli(import.meta.url, {
  per: int(8, { min: 1 }),
  rounds: int(1, { min: 1 }),
  seed: int(1, { min: 0 }),
  threads: threadsOpt(),
  'min-gain': int(DEFAULT_MIN_GAIN_PP, { min: 0, max: 100 }),
  bot: oneOf(['plain', 'hard'] as const, 'plain'),
  format: oneOf(['unpaired', 'paired'] as const, 'unpaired'),
  keys: str(undefined, (v) => {
    const bad = v.split(',').filter((k) => !KNOWN.includes(k));
    return bad.length ? `unknown weight(s) ${bad.join(', ')}` : undefined;
  }),
  'next-turn': bool(),
  start: str(undefined, (v) => {
    try {
      const o = JSON.parse(v);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return 'a JSON object of weights';
      const bad = Object.entries(o).filter(([k, x]) => !KNOWN.includes(k) || typeof x !== 'number');
      return bad.length ? `unknown weight or non-number: ${bad.map(([k]) => k).join(', ')}` : undefined;
    } catch {
      return 'a JSON object of weights';
    }
  }),
  mults: str('0.5,1.6', (v) => (v.split(',').every((x) => Number(x) > 0 && Number(x) !== 1) ? undefined : 'comma-separated positive multipliers other than 1')),
  out: str('reports'),
  'dry-run': bool(),
  force: bool(),
  cache: bool(),
});
const cache = cliGameCache(V.cache);
const PAIRED = V.format === 'paired';
if (!PAIRED && V.per < 2) {
  console.error('error: --per must be at least 2 with --format unpaired\nRun with --help for usage.');
  process.exit(2);
}
const PER = V.per;
const ROUNDS = V.rounds;
const THREADS = Math.min(V.threads, 16);
const MIN_GAIN = V['min-gain'];
const MULTS = V.mults.split(',').map(Number);
const KEYS: (keyof EvalWeights)[] = [...((V.keys?.split(',') as (keyof EvalWeights)[] | undefined) ?? [...TUNED_WEIGHTS]), ...(V['next-turn'] ? NEXT_TURN_WEIGHTS : [])].filter((k, i, a) => a.indexOf(k) === i);
const START: Record<string, number> = V.start ? JSON.parse(V.start) : {};
const field = loadLibrary().filter((d) => d.kind === 'meta');
// unpaired: ceil(PER/2) games per ordered pairing (k < PER / 2), so an odd --per rounds up; paired: PER deals each
const effectivePer = PAIRED ? PER : 2 * Math.ceil(PER / 2);
const evaluationSeeds = field.length * (field.length - 1) * (PAIRED ? PER : Math.ceil(PER / 2));
// One training window and one held-out window per --seed (modulo 400), disjoint for every --seed (WEIGHT_SEEDS).
const plan = seedPlan({ ...WEIGHT_SEEDS, seed: V.seed });
const SEED_WINDOW = WEIGHT_SEEDS.trainWindow;
const trainSeed = plan.train.start;
const validationSeed = plan.heldOut.start;
assertFitsWindow(`one evaluation (${field.length} meta decks, --per ${PER})`, evaluationSeeds, SEED_WINDOW, 'lower --per');

/** The bot of one seat with these weights (only the weights the run touches; the worker fills in DEFAULT_WEIGHTS). */
const spec = (weights: Record<string, number>, extra: AgentSpec = {}): AgentSpec => (V.bot === 'hard' ? { ...HARD_SPEC, weights, ...extra } : { weights, ...extra });

function jobsFor(seedBase: number, variant: Record<string, number>, base: Record<string, number>, special?: { lookaheadA?: boolean }) {
  const jobs: MatchJob[] = [];
  let seed = seedBase;
  for (let i = 0; i < field.length; i++)
    for (let j = 0; j < field.length; j++) {
      if (i === j) continue;
      for (let k = 0; k < PER / 2; k++) {
        jobs.push({
          a: field[i].deck,
          b: field[j].deck,
          seed: seed++,
          first: (k % 2) as 0 | 1,
          bot: 'lookahead',
          agentA: spec(variant, V.bot === 'plain' ? { lookahead: special?.lookaheadA ?? true } : {}),
          agentB: spec(base),
        });
      }
    }
  return jobs;
}

/** Unpaired: the variant's score in seat 0 against the baseline, game by game. */
async function score(seedBase: number, variant: Record<string, number>, base: Record<string, number>, special?: { lookaheadA?: boolean }) {
  const res = await runJobs(jobsFor(seedBase, variant, base, special), { threads: THREADS, cache });
  if (res.some((r) => r.winner === null)) throw new Error('a tuning game failed; refusing to score an incomplete sample');
  return res.map((r) => scoreOf(r.winner));
}

/** Paired (duplicate format): every deal twice, A = variant then A = baseline in seat 0; A's win rate with its paired interval. */
async function duel(seedBase: number, variant: Record<string, number>, base: Record<string, number>): Promise<DuplicateSummary> {
  const deals: Omit<MatchJob, 'agentA' | 'agentB'>[] = [];
  let seed = seedBase;
  for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < PER; k++) deals.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: 'lookahead' });
  const A = spec(variant);
  const B = spec(base);
  const res = await runJobs([...deals.map((d) => ({ ...d, agentA: A, agentB: B })), ...deals.map((d) => ({ ...d, agentA: B, agentB: A }))], { threads: THREADS, cache });
  if (res.length !== 2 * deals.length) throw new Error('a tuning game failed; refusing to score an incomplete sample');
  return duplicateSummary(
    res.slice(0, deals.length).map((r) => scoreOf(r.winner)),
    res.slice(deals.length).map((r) => scoreOf(r.winner)),
  );
}

const pp = (x: number) => (x * 100).toFixed(1);
const fmtPaired = (s: DuplicateSummary) => `${pp(s.winRate)}% [${pp(s.lower95)}, ${pp(s.upper95)}] over ${s.pairs} pairs (split ${s.split}, swept ${s.sweptByA}/${s.swept - s.sweptByA})`;

async function main() {
  const reportPath = path.join(V.out, `tune-weights-${V.seed}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
  if (!V['dry-run'] && fs.existsSync(reportPath) && !V.force) throw new Error(`${reportPath} exists; pass --force to overwrite it`);
  // only the searched weights and the starting overrides; the worker fills in the rest from DEFAULT_WEIGHTS
  const original: Record<string, number> = { ...Object.fromEntries(KEYS.map((k) => [k, DEFAULT_WEIGHTS[k]])), ...START };
  let base: Record<string, number> = { ...original };
  const log: { key: string; mult: number; value: number; summary: PairedSummary | DuplicateSummary; adopted: boolean }[] = [];
  console.log(`Bot ${V.bot}, format ${V.format}: ${PAIRED ? `${evaluationSeeds} deals (${2 * evaluationSeeds} games)` : `${evaluationSeeds} games`} per evaluation; searching ${KEYS.join(', ')}; held-out seed base ${validationSeed}.`);
  if (Object.keys(START).length) console.log(`Starting from DEFAULT_WEIGHTS + ${JSON.stringify(START)}.`);
  let baseline: number[] = [];
  if (!PAIRED) {
    const normal = await score(trainSeed, base, base);
    // Games are deterministic per seed and config, so the base-vs-base training baseline only changes on adoption.
    baseline = normal;
    if (V.bot === 'plain') {
      const fast = await score(trainSeed, base, base, { lookaheadA: false });
      const fastSummary = summarizePaired(fast, normal);
      console.log(`Sanity fast vs lookahead (training): ${pp(fastSummary.mean)}pp [${pp(fastSummary.lower95)}, ${pp(fastSummary.upper95)}]`);
    }
  }
  for (let r = 0; r < ROUNDS; r++) {
    for (const key of KEYS) {
      if (!base[key]) {
        console.log(`  ${key} is 0: no multiple to try (set a start value with --start); skipped`);
        continue;
      }
      for (const mult of MULTS) {
        const v = { ...base, [key]: +(base[key] * mult).toFixed(3) };
        let adopted: boolean;
        let summary: PairedSummary | DuplicateSummary;
        if (PAIRED) {
          const s = await duel(trainSeed, v, base);
          summary = s;
          adopted = s.lower95 > 0.5;
          console.log(`  ${key} x${mult} (${v[key]}): ${fmtPaired(s)}`);
        } else {
          const candidate = await score(trainSeed, v, base);
          const s = summarizePaired(candidate, baseline);
          summary = s;
          adopted = adoptInTraining(s);
          console.log(`  ${key} x${mult}: Δ ${pp(s.mean)}pp [${pp(s.lower95)}, ${pp(s.upper95)}]`);
        }
        log.push({ key, mult, value: v[key], summary, adopted });
        if (adopted) {
          console.log(`  -> adopt ${key}=${v[key]}`);
          base = v;
          if (!PAIRED) baseline = await score(trainSeed, base, base);
          break;
        }
      }
    }
  }
  let validation: PairedSummary | DuplicateSummary;
  let wouldApply: boolean;
  const changed = JSON.stringify(base) !== JSON.stringify(original);
  if (PAIRED) {
    const s = await duel(validationSeed, base, original);
    validation = s;
    wouldApply = changed && s.lower95 > 0.5 + MIN_GAIN / 100;
    console.log(`\nHeld-out paired, final vs start: ${fmtPaired(s)}${changed ? '' : ' (nothing adopted: the same config, so 50% by construction)'}`);
  } else {
    const heldOutBaseline = await score(validationSeed, original, original);
    const candidate = await score(validationSeed, base, original);
    const s = summarizePaired(candidate, heldOutBaseline);
    validation = s;
    wouldApply = passesHeldOut(s, MIN_GAIN);
    console.log(`\nHeld-out paired gain: ${(s.mean * 100).toFixed(2)}pp [${(s.lower95 * 100).toFixed(2)}, ${(s.upper95 * 100).toFixed(2)}] (${s.games} games)`);
  }
  const plannedGames = PAIRED ? 2 * evaluationSeeds : evaluationSeeds;
  const manifest = createRunManifest({
    runId: `tune-weights:${V.seed}:${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    purpose: 'tuning',
    simVersion: SIM_VERSION,
    ...RULES_VERSIONS,
    bot: { level: V.bot === 'hard' ? 'hard' : 'lookahead', configHash: fingerprintText(JSON.stringify(spec(base))) },
    decks: field.map((d) => ({ id: d.deckId ?? deckFingerprint(d.deck), name: d.deck.name, file: d.file })),
    field: { mode: 'meta-round-robin', deckIds: field.map((d) => d.deckId ?? deckFingerprint(d.deck)) },
    sample: { plannedGames, completedGames: plannedGames, gamesPerPair: effectivePer },
    seedBase: validationSeed,
    // paired: first player alternating by deal, every deal played twice with the configs swapped
    seatPolicy: 'alternate',
    trace: false,
  });
  console.log(
    wouldApply
      ? `The held-out lower bound exceeds the ${MIN_GAIN}pp minimum practical gain.`
      : `The held-out lower bound does not exceed the ${MIN_GAIN}pp minimum practical gain: keep the current weights.`,
  );
  console.log('Candidate weights (not applied):\n' + JSON.stringify(base, null, 2));
  console.log('Run manifest:\n' + JSON.stringify(manifest, null, 2));
  if (V['dry-run']) {
    console.log('--dry-run: no report written.');
    return;
  }
  fs.mkdirSync(V.out, { recursive: true });
  const options = { bot: V.bot, format: V.format, keys: KEYS, start: START, mults: MULTS, per: PER, rounds: ROUNDS };
  fs.writeFileSync(reportPath, JSON.stringify({ manifest, options, original, candidate: base, trials: log, validation, minGainPp: MIN_GAIN, passesHeldOut: wouldApply }, null, 2), { flag: V.force ? 'w' : 'wx' });
  console.log(`Saved ${reportPath}`);
}
runMain(main);
