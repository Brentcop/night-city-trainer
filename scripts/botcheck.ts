// Compare two bot configurations head-to-head across all meta pairings.
//   npx tsx scripts/botcheck.ts '{"deep":3}' '{}' --per 4
import { loadLibrary } from './lib-node';
import { runJobs } from './simulate';
import type { MatchJob } from './worker';
const [A, B] = [JSON.parse(process.argv[2] ?? '{}'), JSON.parse(process.argv[3] ?? '{}')];
const i = process.argv.indexOf('--per');
const PER = i > 0 ? +process.argv[i + 1] : 4;
const field = loadLibrary().filter((d) => d.kind === 'meta');
const jobs: MatchJob[] = [];
let seed = 31337;
for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < PER; k++)
  jobs.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: 'lookahead', agentA: A, agentB: B });
const res = await runJobs(jobs);
const w = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0);
const errs = res.filter((r) => r.error);
console.log(`A ${JSON.stringify(A)} vs B ${JSON.stringify(B)}: A wins ${(100 * w / res.length).toFixed(1)}% of ${res.length}${errs.length ? `, errors ${errs.length}: ${errs[0].error?.slice(0, 300)}` : ''}`);
