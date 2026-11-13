// Worker thread for scripts/review.ts: reviews one game per message.
import { parentPort } from 'node:worker_threads';
import { reviewGame, type ReviewOptions } from '../src/ai/reviewer';
import { makeTierBot } from '../src/ai/tiers';
import { COACH_CONFIG_V1, makeCoach } from '../src/ai/coach';
import { HeuristicAgent } from '../src/ai/heuristic';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';
import type { Game } from '../src/engine/engine';
import { practiceAgents, type PracticeReviewSpec } from '../src/sim/practiceReview';
import { runGameReview, type GameReviewJob } from '../src/sim/gameReviewRun';

export interface ReviewJob {
  id: string;
  decks: [DeckList, DeckList];
  seed: number;
  /** absent: the engine picks from the seed (an exported practice game that left it to chance) */
  first?: PlayerId;
  bots: [string, string];
  rollouts: number;
  withCoach: boolean;
  /** use the coach as it was before the review-driven refinement */
  coachV1?: boolean;
  seats?: PlayerId[];
  meta?: Record<string, unknown>;
  /** validation: each seat plays a random move with this probability (on main-phase decisions with 3+ options) */
  chaos?: number;
  /** a recorded practice game (an export from Play, src/lib/coachedReplay.ts): seat 0 replays the recorded answers, seat 1 is its bot */
  practice?: PracticeReviewSpec;
  /** the Game review of a practice game (src/sim/gameReviewRun.ts, as the browser runs it): replies `game` instead of `review` */
  game?: GameReviewJob;
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
    if (job.game) {
      const t0 = Date.now();
      const game = await runGameReview(job.game);
      parentPort!.postMessage({ id: job.id, game, ms: Date.now() - t0, meta: job.meta });
      return;
    }
    const opts: ReviewOptions = { rollouts: job.rollouts, withCoach: job.withCoach, coach: job.coachV1 ? () => new HeuristicAgent({ name: 'Coach v1', ...COACH_CONFIG_V1 }) : makeCoach, seats: job.seats };
    const base: [Agent, Agent] = job.practice ? practiceAgents(job.practice) : [makeTierBot(job.bots[0], job.seed), makeTierBot(job.bots[1], job.seed + 7777)];
    const chaos = job.chaos ? [new ChaosAgent(base[0], job.chaos, job.seed * 3 + 1), new ChaosAgent(base[1], job.chaos, job.seed * 3 + 2)] : null;
    const r = await reviewGame({ decks: job.decks, seed: job.seed, first: job.first, agents: chaos ? [chaos[0], chaos[1]] : base, agentNames: job.bots }, opts);
    parentPort!.postMessage({ id: job.id, review: r, meta: chaos ? { ...job.meta, chaos: [chaos[0].flags, chaos[1].flags] } : job.meta });
  } catch (e) {
    parentPort!.postMessage({ id: job.id, error: String((e as Error)?.stack ?? e), meta: job.meta });
  }
});
