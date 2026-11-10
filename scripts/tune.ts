// Self-play tuning of the bot's evaluation weights.
//   npx tsx scripts/tune.ts [--per 8] [--rounds 1]
// For each weight, a variant (x0.5 and x1.6) plays the baseline across every pairing of meta decks,
// swapping seats and play/draw. A variant that beats the baseline by a clear margin becomes the new baseline.
// Prints the final weights; paste them into DEFAULT_WEIGHTS (src/ai/eval.ts).
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { loadLibrary } from './lib-node';
import { runJobs } from './simulate';
import type { MatchJob } from './worker';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const PER = +flag('per', '8');
const ROUNDS = +flag('rounds', '1');
const field = loadLibrary().filter((d) => d.kind === 'meta');

async function score(variant: Record<string, number>, base: Record<string, number>, special?: { lookaheadA?: boolean }) {
  const jobs: MatchJob[] = [];
  let seed = 90_000 + Math.floor(Math.random() * 100_000);
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
  const res = await runJobs(jobs);
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
main();
