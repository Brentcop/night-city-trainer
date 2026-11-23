// Web Worker: runs the practice bot's decision off the main thread so the UI stays responsive.
// Protocol: { id, job } → { id, chosen, rng } or { id, error }.
// The worker recreates the bot and game for each decision (no persistent state).
import { Game } from '../engine/engine';
import type { Agent, Decision, GameState } from '../engine/types';
import { makeTierBot } from '../ai/tiers';
import type { HeuristicAgent } from '../ai/heuristic';

export interface BotJob {
  state: GameState;
  decision: Decision;
  level: string;
  botSeed: number;
  /** the bot's rng state before this decision (advanced by the main-thread bot since its creation) */
  rng: number;
}

export interface BotRequest {
  id: number;
  job: BotJob;
}

export type BotReply = { id: number; chosen: number[]; rng: number } | { id: number; error: string };

const noAgent: Agent = { name: 'none', decide: () => Promise.reject(new Error('no agent')) };

const post = (m: BotReply) => (self as unknown as Worker).postMessage(m);

self.onmessage = async (e: MessageEvent<BotRequest>) => {
  const { id, job } = e.data;
  try {
    const g = new Game(job.state, [noAgent, noAgent]);
    const bot = makeTierBot(job.level, job.botSeed, 'Bot') as HeuristicAgent;
    bot.botRng = job.rng;
    const chosen = await bot.decide(g, job.decision);
    post({ id, chosen, rng: bot.botRng });
  } catch (err) {
    post({ id, error: String((err as Error)?.message ?? err) || 'bot decision failed' });
  }
};
