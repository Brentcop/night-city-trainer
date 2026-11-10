// Self-play tuning of the bot's evaluation weights.
//   npx tsx scripts/tune.ts [--per 8] [--rounds 1] [--seed 1] [--threads N]
// For each weight, a variant (x0.5 and x1.6) plays the baseline across every pairing of meta decks,
// swapping seats and play/draw. A variant that beats the baseline by a clear margin becomes the new baseline.
// Prints the final weights; paste them into DEFAULT_WEIGHTS (src/ai/eval.ts).
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { cli, int, loadLibrary, runJobs, runMain, threadsOpt } from './lib-node';
import type { MatchJob } from './worker';

const { values: V } = cli(import.meta.url, { per: int(8, { min: 2 }), rounds: int(1, { min: 1 }), seed: int(1, { min: 0 }), threads: threadsOpt() });
const PER = V.per;
const ROUNDS = V.rounds;
const THREADS = Math.min(V.threads, 16);
const field = loadLibrary().filter((d) => d.kind === 'meta');
/** Deterministic seed stream from --seed (was Math.random, so a tuning run could not be repeated). */
let seedState = (V.seed * 2654435761) >>> 0 || 1;
const nextSeed = () => 90_000 + ((seedState = (seedState * 1664525 + 1013904223) >>> 0) % 100_000);

async function score(variant: Record<string, number>, base: Record<string, number>, special?: { lookaheadA?: boolean }) {
  const jobs: MatchJob[] = [];
  let seed = nextSeed();
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
  const res = await runJobs(jobs, { threads: THREADS });
  const w = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0);
  return w / res.length;
}

async function main() {
  let base: Record<string, number> = { ...(DEFAULT_WEIGHTS as any) };
  console.log('Sanity: fast (no lookahead) vs lookahead baseline');
  console.log('  fast bot win rate:', (await score(base, base, { lookaheadA: false })).toFixed(3));
  for (let r = 0; r < ROUNDS; r++) {
    for (const key of Object.keys(base)) {
      for (const mult of [0.5, 1.6]) {
        const v = { ...base, [key]: +(base[key] * mult).toFixed(3) };
        const wr = await score(v, base);
        console.log(`  ${key} x${mult}: ${(wr * 100).toFixed(1)}%`);
        if (wr >= 0.54) {
          console.log(`  -> adopt ${key}=${v[key]}`);
          base = v;
          break;
        }
      }
    }
  }
  console.log('\nFinal weights:\n' + JSON.stringify(base, null, 2));
}
runMain(main);
