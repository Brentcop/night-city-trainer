// Compare two bot configurations head-to-head across all meta pairings.
//   npx tsx scripts/botcheck.ts '{"deep":3}' '{}' [--per 4] [--threads N]
// Games that throw are reported (first stack printed) and left out of the win rate; the exit code is then 1.
import { cli, int, loadLibrary, runJobsDetailed, threadsOpt } from './lib-node';
import type { AgentSpec, MatchJob } from './worker';

const { values: V, positionals } = cli(import.meta.url, { per: int(4, { min: 1 }), threads: threadsOpt() }, { maxPositionals: 2 });
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
const PER = V.per;
const field = loadLibrary().filter((d) => d.kind === 'meta');
const jobs: MatchJob[] = [];
let seed = 31337;
for (const x of field) for (const y of field) if (x !== y) for (let k = 0; k < PER; k++)
  jobs.push({ a: x.deck, b: y.deck, seed: seed++, first: (k % 2) as 0 | 1, bot: 'lookahead', agentA: A, agentB: B });
const { results: res, errors: errs } = await runJobsDetailed(jobs, { threads: Math.min(V.threads, 16), allowErrors: true });
const w = res.reduce((a, r) => a + (r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0), 0);
console.log(`A ${JSON.stringify(A)} vs B ${JSON.stringify(B)}: A wins ${(100 * w / Math.max(1, res.length)).toFixed(1)}% of ${res.length}${errs.length ? `, errors ${errs.length} (excluded): ${errs[0].error?.slice(0, 300)}` : ''}`);
