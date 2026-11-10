// Web Worker: plays one tournament game per message (same engine + bots as the CLI, so results replay identically).
// Protocol (see WorkerRequest/WorkerResponse in pool.ts): { id, job } → { id, rec, replay? } or { id, error, stack? }.
// A game that throws is reported as an error with the engine's message — never turned into a tie.
import { Game } from '../engine/engine';
import type { Agent, GameState } from '../engine/types';
import { makeBot, type GameRec } from '../lib/tournament';
import { summarize } from '../analysis/summarize';
import type { WorkerRequest, WorkerResponse } from './pool';

const post = (m: WorkerResponse) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { id, job } = e.data;
  try {
    const agents = (): [Agent, Agent] => [makeBot(job.bot, job.seed), makeBot(job.bot, job.seedB ?? job.seed + 7777)];
    if (job.replay) {
      // same capture as recordReplay() in ReplayBoard.tsx, off the main thread
      const g = Game.create([job.a, job.b], agents(), { seed: job.seed, first: job.first });
      const frames: GameState[] = [];
      g.onLog = () => {
        const { log: _log, trace: _trace, ...rest } = g.s;
        frames.push(structuredClone({ ...rest, log: [] }) as GameState);
      };
      const s = await g.run();
      post({ id, rec: record(job.seed, job.first, s), replay: { final: s, frames } });
      return;
    }
    const g = Game.create([job.a, job.b], agents(), { seed: job.seed, first: job.first, log: false, trace: !!job.trace });
    const s = await g.run();
    post({ id, rec: { ...record(job.seed, job.first, s), summary: job.trace ? summarize(s)[0] : undefined } });
  } catch (err) {
    const x = err as Error;
    post({ id, error: String(x?.message ?? err) || 'game failed', stack: x?.stack });
  }
};

function record(seed: number, first: 0 | 1, s: GameState): GameRec {
  return { seed, first, winner: s.winner === null ? 'tie' : s.winner, turns: s.turn, reason: s.winReason ?? '' };
}
