// Worker thread for scripts/review.ts: reviews one game per message.
import { parentPort } from 'node:worker_threads';
import { reviewGame, type ReviewOptions } from '../src/ai/reviewer';
import { makeTierBot } from '../src/ai/tiers';
import { makeCoach } from '../src/ai/coach';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import type { Game } from '../src/engine/engine';

export interface ReviewJob {
  id: string;
  decks: [DeckList, DeckList];
  seed: number;
  first: PlayerId;
  bots: [string, string];
  rollouts: number;
  withCoach: boolean;
  seats?: PlayerId[];
  meta?: Record<string, unknown>;
  /** validation: each seat plays a random move with this probability (on main-phase decisions with 3+ options) */
  chaos?: number;
}

/** Plays like its inner bot, except that sometimes it makes a random move. Logs which reviewed decisions were random. */
class ChaosAgent implements Agent {
  name: string;
  flags: boolean[] = [];
  private s: number;
  constructor(
    public inner: Agent,
    private p: number,
    seed: number,
  ) {
    this.name = inner.name;
    this.s = seed >>> 0 || 1;
  }
  private r() {
    return (this.s = (this.s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    const pick = await this.inner.decide(g, d); // always ask the bot, so its own state stays the same either way
    if (d.kind !== 'action' || d.options.length < 2) return pick;
    if (d.options.length >= 3 && this.r() < this.p) {
      const others = d.options.map((_, i) => i).filter((i) => i !== pick[0]);
      this.flags.push(true);
      return [others[Math.floor(this.r() * others.length)]];
    }
    this.flags.push(false);
    return pick;
  }
}

parentPort?.on('message', async (job: ReviewJob) => {
  try {
    const opts: ReviewOptions = { rollouts: job.rollouts, withCoach: job.withCoach, coach: makeCoach, seats: job.seats };
    const base: [Agent, Agent] = [makeTierBot(job.bots[0], job.seed), makeTierBot(job.bots[1], job.seed + 7777)];
    const chaos = job.chaos ? [new ChaosAgent(base[0], job.chaos, job.seed * 3 + 1), new ChaosAgent(base[1], job.chaos, job.seed * 3 + 2)] : null;
    const r = await reviewGame({ decks: job.decks, seed: job.seed, first: job.first, agents: chaos ? [chaos[0], chaos[1]] : base, agentNames: job.bots }, opts);
    parentPort!.postMessage({ id: job.id, review: r, meta: chaos ? { ...job.meta, chaos: [chaos[0].flags, chaos[1].flags] } : job.meta });
  } catch (e) {
    parentPort!.postMessage({ id: job.id, error: String((e as Error)?.stack ?? e), meta: job.meta });
  }
});
