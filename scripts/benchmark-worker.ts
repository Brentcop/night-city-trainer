// Worker thread for the position benchmark (scripts/benchmark-build.ts, scripts/benchmark.ts; src/ai/benchmark.ts).
// One job per message:
//   sample  play one seeded game with two tier bots, recording every answer and describing every decision
//   label   play each listed option of one position out to the end of the game in each listed world (the oracle)
//   ask     rebuild positions and ask a bot for its move at each
import { parentPort } from 'node:worker_threads';
import { Game } from '../src/engine/engine';
import { makeTierBot } from '../src/ai/tiers';
import { makeCoach } from '../src/ai/coach';
import { GameRecorder, oracleOutcome, pauseAt, type GameRef, type PositionMeta } from '../src/ai/benchmark';
import type { World } from '../src/ai/playOut';
import type { Agent, DeckList, PlayerId } from '../src/engine/types';
import { fromSpec, type AgentSpec } from './agent-spec';

/** A bot for the benchmark: a tier name ('easy', 'medium', 'hard', ...), 'coach', or an AgentSpec. */
export type BenchBot = string | AgentSpec;

export type BenchJob =
  | { type: 'sample'; a: DeckList; b: DeckList; seed: number; first: PlayerId; bot: string }
  | { type: 'label'; ref: GameRef; k: number; labels: string[]; opts: number[]; worlds: World[]; oracle: string }
  | { type: 'ask'; refs: GameRef[]; at: { k: number; labels: string[]; seed: number }[]; bot: BenchBot };

export type BenchResult =
  | { type: 'sample'; answers: number[][]; metas: PositionMeta[]; turns: number; winner: PlayerId | 'tie' | null; ms: number }
  | { type: 'label'; out: number[][]; ms: number }
  | { type: 'ask'; picks: number[]; ms: number[] }
  | { type: 'error'; error: string };

export function benchAgent(bot: BenchBot, seed: number): Agent {
  if (typeof bot !== 'string') return fromSpec(bot, seed);
  if (bot === 'coach') return makeCoach();
  return makeTierBot(bot, seed);
}

const sameLabels = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

async function run(job: BenchJob): Promise<BenchResult> {
  const t0 = Date.now();
  if (job.type === 'sample') {
    const rec = new GameRecorder([makeTierBot(job.bot, job.seed), makeTierBot(job.bot, job.seed + 7777)]);
    const g = Game.create([job.a, job.b], rec.agents, { seed: job.seed, first: job.first, log: false });
    const s = await g.run();
    return { type: 'sample', answers: rec.answers, metas: rec.metas.filter((m) => !m.skip), turns: s.turn, winner: s.winner, ms: Date.now() - t0 };
  }
  if (job.type === 'label') {
    // the replay must reach the same decision with the same options, or the labels would belong to another position
    const at = await pauseAt(job.ref, job.k);
    if (!sameLabels(at.d.options.map((o) => o.label), job.labels)) throw new Error(`position ${job.k} did not rebuild to its recorded options`);
    const out: number[][] = job.opts.map(() => []);
    for (const w of job.worlds) for (const [j, opt] of job.opts.entries()) out[j]!.push(await oracleOutcome(job.ref, job.k, opt, w, job.oracle));
    return { type: 'label', out, ms: Date.now() - t0 };
  }
  const picks: number[] = [];
  const ms: number[] = [];
  for (const [i, x] of job.at.entries()) {
    const ref = job.refs[i]!;
    const at = await pauseAt(ref, x.k);
    if (!sameLabels(at.d.options.map((o) => o.label), x.labels)) throw new Error(`position ${x.k} did not rebuild to its recorded options`);
    const t = Date.now();
    const r = await benchAgent(job.bot, x.seed).decide(at.g, at.d);
    ms.push(Date.now() - t);
    picks.push(r[0] ?? 0);
  }
  return { type: 'ask', picks, ms };
}

parentPort?.on('message', async (job: BenchJob) => {
  let r: BenchResult;
  try {
    r = await run(job);
  } catch (e) {
    r = { type: 'error', error: String((e as Error)?.stack ?? e) };
  }
  parentPort!.postMessage(r);
});
