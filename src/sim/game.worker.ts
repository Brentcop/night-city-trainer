// Web Worker: plays one tournament game per message (same engine + bots as the CLI, so results replay identically).
import { Game } from '../engine/engine';
import { makeBot, type GameJob, type GameRec } from '../lib/tournament';

self.onmessage = async (e: MessageEvent<{ id: number; job: GameJob }>) => {
  const { id, job } = e.data;
  try {
    const g = Game.create([job.a, job.b], [makeBot(job.bot, job.seed), makeBot(job.bot, job.seed + 7777)], { seed: job.seed, first: job.first, log: false });
    const s = await g.run();
    const rec: GameRec = { seed: job.seed, first: job.first, winner: s.winner === null ? 'tie' : s.winner, turns: s.turn, reason: s.winReason ?? '' };
    (self as unknown as Worker).postMessage({ id, rec });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String((err as Error)?.stack ?? err) });
  }
};
