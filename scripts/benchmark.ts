// INFO-5: score bots on the position benchmark (docs/BOT_TOOLKIT.md §10). Rebuilds every position of the suite, asks
// the bot for its move, and reports its regret: the oracle's win rate of the best option minus that of the option
// picked (win-rate points; the oracle is full play-outs by Medium bots, scripts/benchmark-build.ts), by decision type
// and game stage, with a 95% interval over positions, and the share of positions where the pick was among the oracle's
// best (not distinguishable from the best at 2 paired SE). Indifferent positions (no option distinguishable from the
// best) are counted but left out of the means. With two bots, also the paired difference in regret, position by position.
//   npx tsx scripts/benchmark.ts <bot> [<bot 2>] [--suite data/benchmark/suite.json] [--reps 1] [--threads N] [--out DIR] [--force]
// A bot is a tier name (easy, medium, hard, deep, ...), 'coach' (src/ai/coach.ts), an AgentSpec as JSON (as botcheck
// takes), or a tier plus overrides: 'hard+{"mulligan":"plain"}' (the tier's settings as an AgentSpec, then the JSON).
// --reps: ask each bot this many times per position with different seeds (its noise), averaging the regret per position.
// --out: also write the per-position picks and the summary as JSON to DIR/benchmark-<time>.json (refuses an existing file
//   without --force). Nothing else is written.
import fs from 'node:fs';
import path from 'node:path';
import { cli, int, str, bool, threadsOpt, workerPool, runMain, Refusal, ArgError } from './lib-node';
import { BENCH_KINDS, BENCH_STAGES, positionOutcomes, suiteRef, type BenchSuite, type SuitePosition } from '../src/ai/benchmark';
import { positionStats, regretDifference, summarizeRegret, type PickRow, type PositionStat } from '../src/lib/benchmarkStats';
import type { AgentSpec } from './agent-spec';
import type { BenchBot, BenchJob, BenchResult } from './benchmark-worker';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    suite: str('data/benchmark/suite.json'),
    reps: int(1, { min: 1, max: 20 }),
    threads: threadsOpt(),
    out: str(),
    force: bool(),
  },
  { minPositionals: 1, maxPositionals: 2 },
);

/** Each tier's settings as an AgentSpec (src/ai/tiers.ts), for 'tier+{...}' overrides. */
const TIER_SPECS: Record<string, AgentSpec> = {
  easy: { lookahead: false, noise: 0 },
  medium: { profiles: 'best' },
  hard: { deep: 3, deepReactions: 3, mulligan: 'plain', profiles: 'best' },
};

function parseBot(s: string): BenchBot {
  const t = s.trim();
  const plus = t.match(/^(\w+)\s*\+\s*(\{.*\})$/s);
  try {
    if (plus) {
      const base = TIER_SPECS[plus[1]!.toLowerCase()];
      if (!base) throw new ArgError(`"${plus[1]}+..." needs one of ${Object.keys(TIER_SPECS).join(', ')} before the +`);
      const extra = JSON.parse(plus[2]!) as AgentSpec;
      return { ...base, ...extra };
    }
    if (t.startsWith('{')) {
      const v = JSON.parse(t);
      if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ArgError('a bot spec must be a JSON object');
      return v as AgentSpec;
    }
  } catch (e) {
    if (e instanceof ArgError) throw e;
    throw new ArgError(`bot "${s}" is not valid JSON (${(e as Error).message})`);
  }
  if (!/^(easy|medium|hard|hard-v1|deep|fast|lookahead|coach)$/i.test(t)) throw new ArgError(`unknown bot "${s}": a tier name, coach, a JSON AgentSpec or tier+{json}`);
  return t.toLowerCase();
}

let bots: BenchBot[];
try {
  bots = positionals.map(parseBot);
} catch (e) {
  console.error(`error: ${(e as Error).message}\nRun with --help for usage.`);
  process.exit(2);
}

const BOOT = new URL('./benchmark-boot.mjs', import.meta.url);
const pp = (x: number) => (Number.isFinite(x) ? (100 * x).toFixed(1) : '–');

/** A bot's regret at one position: the picked option's group, its regret and whether it is among the best. */
function pickRow(pos: SuitePosition, st: PositionStat, pick: number): PickRow {
  const g = pos.groups[pick] ?? pick;
  const o = st.options.find((x) => x.opt === g);
  if (!o) throw new Error(`position ${pos.id}: option ${pick} (group ${g}) has no label`);
  return { kind: pos.kind, stage: pos.stage, regret: o.regret, best: o.best, indifferent: st.indifferent };
}

/** The mean over reps of each position's rows (regret averaged, best as a share). */
function meanRows(rows: PickRow[][]): PickRow[] {
  return rows.map((rs) => ({ ...rs[0]!, regret: rs.reduce((s, r) => s + r.regret, 0) / rs.length, best: rs.filter((r) => r.best).length * 2 >= rs.length }));
}

runMain(async () => {
  if (!fs.existsSync(V.suite)) throw new Refusal(`no suite at ${V.suite}; build one with scripts/benchmark-build.ts`);
  const suite = JSON.parse(fs.readFileSync(V.suite, 'utf8')) as BenchSuite;
  if (suite.kind !== 'nct-benchmark' || suite.schema !== 1) throw new Refusal(`${V.suite} is not a benchmark suite (schema 1)`);
  let outFile: string | null = null;
  if (V.out) {
    outFile = path.join(V.out, `benchmark-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    if (fs.existsSync(outFile) && !V.force) throw new Refusal(`${outFile} exists; pass --force to overwrite it`);
  }
  const stats = suite.positions.map((p) => positionStats(positionOutcomes(p), suite.oracle.bestZ));
  const refs = suite.positions.map((p) => suiteRef(suite, p));
  const pool = workerPool<BenchJob, BenchResult>(BOOT, V.threads);
  const results: { bot: BenchBot; rows: PickRow[]; picks: number[][]; ms: number[] }[] = [];
  try {
    for (const bot of bots) {
      const t0 = Date.now();
      const BATCH = 4;
      const picks: number[][] = suite.positions.map(() => []);
      const ms: number[] = [];
      const jobs: Promise<void>[] = [];
      for (let rep = 0; rep < V.reps; rep++)
        for (let i = 0; i < suite.positions.length; i += BATCH) {
          const idx = suite.positions.slice(i, i + BATCH).map((_, j) => i + j);
          const job: BenchJob = {
            type: 'ask',
            bot,
            refs: idx.map((x) => refs[x]!),
            at: idx.map((x) => ({ k: suite.positions[x]!.k, labels: suite.positions[x]!.labels, seed: (suite.positions[x]!.worldSeed + 1009 * rep) >>> 0 })),
          };
          jobs.push(
            pool.run(job).then((r) => {
              if (r.type === 'error') throw new Error(r.error);
              if (r.type !== 'ask') throw new Error('unexpected worker reply');
              r.picks.forEach((p, j) => picks[idx[j]!]!.push(p));
              ms.push(...r.ms);
            }),
          );
        }
      await Promise.all(jobs);
      const rows = meanRows(suite.positions.map((pos, i) => picks[i]!.map((p) => pickRow(pos, stats[i]!, p))));
      results.push({ bot, rows, picks, ms });
      const sorted = [...ms].sort((a, b) => a - b);
      console.error(`  ${JSON.stringify(bot)}: ${((Date.now() - t0) / 1000).toFixed(0)} s, ${(sorted.reduce((s, x) => s + x, 0) / Math.max(1, sorted.length)).toFixed(0)} ms per decision (p90 ${sorted[Math.floor(0.9 * sorted.length)] ?? 0})`);
    }
  } finally {
    await pool.close();
  }

  const indiff = stats.filter((s) => s.indifferent).length;
  console.log(`suite ${V.suite}: ${suite.positions.length} positions (${indiff} indifferent), oracle ${suite.oracle.bot} play-outs, ${suite.oracle.worlds}–${suite.oracle.maxWorlds} worlds per option; regret in win-rate points, 95% interval over positions`);
  const line = (label: string, rows: PickRow[]) => {
    const s = summarizeRegret(rows);
    return `  ${label.padEnd(10)} ${String(s.counted).padStart(4)} pos  regret ${pp(s.mean).padStart(5)} [${pp(s.lower)}, ${pp(s.upper)}]  best pick ${pp(s.bestShare)}%`;
  };
  const summaries = results.map(({ bot, rows }) => {
    console.log(`\n${typeof bot === 'string' ? bot : JSON.stringify(bot)}`);
    console.log(line('all', rows));
    for (const k of BENCH_KINDS) console.log(line(k, rows.filter((r) => r.kind === k)));
    for (const st of BENCH_STAGES) console.log(line(st, rows.filter((r) => r.stage === st)));
    return { bot, all: summarizeRegret(rows), byKind: Object.fromEntries(BENCH_KINDS.map((k) => [k, summarizeRegret(rows.filter((r) => r.kind === k))])), byStage: Object.fromEntries(BENCH_STAGES.map((s) => [s, summarizeRegret(rows.filter((r) => r.stage === s))])) };
  });
  let diff: ReturnType<typeof regretDifference> | null = null;
  if (results.length === 2) {
    diff = regretDifference(results[0]!.rows, results[1]!.rows);
    const same = results[0]!.picks.filter((p, i) => p.join() === results[1]!.picks[i]!.join()).length;
    console.log(`\npaired difference in regret, first minus second: ${pp(diff.mean)} [${pp(diff.lower)}, ${pp(diff.upper)}] over ${diff.positions} positions; same pick at ${same} of ${suite.positions.length} positions`);
  }
  if (outFile) {
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.writeFileSync(
      outFile,
      JSON.stringify({ suite: V.suite, reps: V.reps, summaries, diff, picks: results.map((r) => ({ bot: r.bot, picks: Object.fromEntries(suite.positions.map((p, i) => [p.id, r.picks[i]])) })) }, null, 1),
    );
    console.log(`wrote ${outFile}`);
  }
});
