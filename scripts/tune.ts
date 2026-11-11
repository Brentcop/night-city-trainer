// Self-play tuning of the bot's evaluation weights.
//   npx tsx scripts/tune.ts [--per 8] [--rounds 1] [--seed 1] [--threads N]
// For each weight, a variant (x0.5 and x1.6) plays the baseline across every pairing of meta decks,
// swapping seats and play/draw. Candidate selection uses matched training seeds; the final configuration is
// compared with the original on a separate held-out seed range. This script reports candidates, it never applies them.
import fs from 'node:fs';
import { deckFingerprint, fingerprintText } from '../src/engine/deck';
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { SIM_VERSION } from '../src/lib/tournament';
import { createRunManifest } from '../src/lib/runManifest';
import { cli, int, loadLibrary, runJobs, runMain, threadsOpt } from './lib-node';
import type { MatchJob } from './worker';
import { summarizePaired } from './tuning';

const { values: V } = cli(import.meta.url, {
  per: int(8, { min: 2 }),
  rounds: int(1, { min: 1 }),
  seed: int(1, { min: 0 }),
  threads: threadsOpt(),
});
const PER = V.per;
const ROUNDS = V.rounds;
const THREADS = Math.min(V.threads, 16);
const field = loadLibrary().filter((d) => d.kind === 'meta');
// jobsFor plays ceil(PER/2) games per ordered pairing (k < PER / 2), so an odd --per rounds up.
const effectivePer = 2 * Math.ceil(PER / 2);
const evaluationGames = field.length * (field.length - 1) * Math.ceil(PER / 2);
const SEED_WINDOW = 1_000;
const trainSeed = 90_000 + (V.seed % 400) * SEED_WINDOW;
const validationSeed = trainSeed + 500_000;
// Each evaluation uses evaluationGames consecutive seeds from its base; past the window it would reuse the next
// --seed's training seeds (and the held-out range would overlap the next --seed's held-out range).
if (evaluationGames > SEED_WINDOW) {
  throw new Error(
    `one evaluation needs ${evaluationGames} seeds (${field.length} meta decks, --per ${PER}) but each --seed has a ${SEED_WINDOW}-seed window; lower --per`,
  );
}

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
          agentA: { weights: variant, lookahead: special?.lookaheadA ?? true },
          agentB: { weights: base },
        });
      }
    }
  return jobs;
}

async function score(seedBase: number, variant: Record<string, number>, base: Record<string, number>, special?: { lookaheadA?: boolean }) {
  const res = await runJobs(jobsFor(seedBase, variant, base, special), { threads: THREADS });
  if (res.some((r) => r.winner === null)) throw new Error('a tuning game failed; refusing to score an incomplete sample');
  return res.map((r) => (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0));
}

async function main() {
  const original: Record<string, number> = { ...DEFAULT_WEIGHTS };
  let base: Record<string, number> = { ...original };
  console.log(`Matched training: ${evaluationGames} games per evaluation; held-out seed base ${validationSeed}.`);
  const fast = await score(trainSeed, base, base, { lookaheadA: false });
  const normal = await score(trainSeed, base, base);
  // Games are deterministic per seed and config, so the base-vs-base training baseline only changes on adoption.
  let baseline = normal;
  const fastSummary = summarizePaired(fast, normal);
  console.log(`Sanity fast vs lookahead (training): ${(100 * fastSummary.mean).toFixed(1)}pp [${(100 * fastSummary.lower95).toFixed(1)}, ${(100 * fastSummary.upper95).toFixed(1)}]`);
  for (let r = 0; r < ROUNDS; r++) {
    for (const key of Object.keys(base)) {
      for (const mult of [0.5, 1.6]) {
        const v = { ...base, [key]: +(base[key] * mult).toFixed(3) };
        const candidate = await score(trainSeed, v, base);
        const summary = summarizePaired(candidate, baseline);
        console.log(
          `  ${key} x${mult}: Δ ${(summary.mean * 100).toFixed(1)}pp [${(summary.lower95 * 100).toFixed(1)}, ${(summary.upper95 * 100).toFixed(1)}]`,
        );
        if (summary.mean > 0) {
          console.log(`  -> adopt ${key}=${v[key]}`);
          base = v;
          baseline = await score(trainSeed, base, base);
          break;
        }
      }
    }
  }
  const heldOutBaseline = await score(validationSeed, original, original);
  const candidate = await score(validationSeed, base, original);
  const validation = summarizePaired(candidate, heldOutBaseline);
  const manifest = createRunManifest({
    runId: `tune-weights:${V.seed}:${new Date().toISOString()}`,
    createdAt: new Date().toISOString(),
    purpose: 'tuning',
    simVersion: SIM_VERSION,
    rulesVersion: null,
    faqVersion: null,
    bot: { level: 'lookahead', configHash: fingerprintText(JSON.stringify(base)) },
    decks: field.map((d) => ({ id: d.deckId ?? deckFingerprint(d.deck), name: d.deck.name, file: d.file })),
    field: { mode: 'meta-round-robin', deckIds: field.map((d) => d.deckId ?? deckFingerprint(d.deck)) },
    sample: { plannedGames: candidate.length, completedGames: candidate.length, gamesPerPair: effectivePer },
    seedBase: validationSeed,
    seatPolicy: 'alternate',
    trace: false,
  });
  console.log(
    `\nHeld-out paired gain: ${(validation.mean * 100).toFixed(2)}pp [${(validation.lower95 * 100).toFixed(2)}, ${(validation.upper95 * 100).toFixed(2)}] (${validation.games} games)`,
  );
  console.log('Candidate weights (not applied):\n' + JSON.stringify(base, null, 2));
  console.log('Run manifest:\n' + JSON.stringify(manifest, null, 2));
  fs.mkdirSync('reports', { recursive: true });
  const reportPath = `reports/tune-weights-${V.seed}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(reportPath, JSON.stringify({ manifest, original, candidate: base, validation }, null, 2), { flag: 'wx' });
  console.log(`Saved ${reportPath}`);
}
runMain(main);
