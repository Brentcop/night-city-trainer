// Web Worker: reviews one game (bot game from a tournament, or a recorded practice game) off the main thread.
import { reviewGame, type GameReview } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import { makeCoach } from '../ai/coach';
import { practiceAgents, type ReviewRequest } from './practiceReview';
import { runGameReview } from './gameReviewRun';
import type { GameReviewRecord } from '../lib/gameReview';

export type { ReviewRequest };
export type ReviewReply = { progress: number; turn?: number } | { review: GameReview } | { game: GameReviewRecord } | { error: string };

self.onmessage = async (e: MessageEvent<ReviewRequest>) => {
  const q = e.data;
  const post = (m: ReviewReply) => (self as unknown as Worker).postMessage(m);
  try {
    if (q.kind === 'game') {
      post({ game: await runGameReview(q.job, (n, turn) => post({ progress: n, turn })) });
      return;
    }
    const agents =
      q.kind === 'bots'
        ? ([makeTierBot(q.bot, q.seed), makeTierBot(q.bot, q.seed + 7777)] as const)
        : practiceAgents(q);
    const review = await reviewGame(
      { decks: q.decks, seed: q.seed, first: q.first, agents: [agents[0], agents[1]], agentNames: q.kind === 'bots' ? [q.bot, q.bot] : ['you', q.botLevel] },
      { rollouts: q.rollouts, withCoach: q.withCoach, coach: makeCoach, seats: q.kind === 'practice' ? [0] : [0, 1], onProgress: (n) => post({ progress: n }) },
    );
    post({ review });
  } catch (err) {
    post({ error: String((err as Error)?.stack ?? err) });
  }
};
