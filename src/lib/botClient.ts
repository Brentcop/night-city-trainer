// Runs the practice bot's decisions in a web worker (src/sim/bot.worker.ts) so the UI stays responsive.
// Falls back to the main thread when the worker can't start or crashes (the game stays playable).
import type { Game } from '../engine/engine';
import type { Decision, GameState } from '../engine/types';
import type { HeuristicAgent } from '../ai/heuristic';
import type { BotReply, BotRequest } from '../sim/bot.worker';

const startWorker = () => new Worker(new URL('../sim/bot.worker.ts', import.meta.url), { type: 'module' });

/** Snapshot the game state for the worker (log and trace stripped to keep the message small). */
function stateForWorker(s: GameState): GameState {
  const { log, trace, ...rest } = s;
  return { ...rest, log: [], trace: undefined };
}

export class BotClient {
  private w: Worker | null = null;
  broken = false;
  private disposed = false;
  private seq = 0;

  constructor(private make: () => Worker = startWorker) {}

  /**
   * Ask the bot to decide. When the worker is healthy, the decision runs off-thread and the bot's rng is synced back.
   * Falls back to the main thread (blocking the UI, as before) when the worker is broken.
   */
  async decide(game: Game, bot: HeuristicAgent, decision: Decision, level: string, botSeed: number): Promise<number[]> {
    if (this.broken || this.disposed) return bot.decide(game, decision);
    const rng = bot.botRng;
    const state = stateForWorker(structuredClone(game.s));
    try {
      const result = await this.post({ state, decision: structuredClone(decision), level, botSeed, rng });
      bot.botRng = result.rng;
      return result.chosen;
    } catch {
      this.broken = true;
      return bot.decide(game, decision);
    }
  }

  private post(job: BotRequest['job']): Promise<{ chosen: number[]; rng: number }> {
    return new Promise((resolve, reject) => {
      const w = this.worker();
      if (!w) {
        reject(new Error('no worker'));
        return;
      }
      const id = ++this.seq;
      const onMsg = (e: MessageEvent<BotReply>) => {
        const msg = e.data;
        if (msg.id !== id) return;
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
        if ('error' in msg) reject(new Error(msg.error));
        else resolve({ chosen: msg.chosen, rng: msg.rng });
      };
      const onErr = () => {
        w.removeEventListener('message', onMsg);
        w.removeEventListener('error', onErr);
        this.broken = true;
        this.w = null;
        reject(new Error('worker crashed'));
      };
      w.addEventListener('message', onMsg);
      w.addEventListener('error', onErr);
      w.postMessage({ id, job } satisfies BotRequest);
    });
  }

  private worker(): Worker | null {
    if (this.broken || this.disposed) return null;
    if (this.w) return this.w;
    try {
      const w = this.make();
      this.w = w;
      return w;
    } catch {
      this.broken = true;
      return null;
    }
  }

  dispose() {
    this.disposed = true;
    this.w?.terminate();
    this.w = null;
  }
}
