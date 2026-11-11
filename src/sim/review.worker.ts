// Web Worker: reviews one game (bot game from a tournament, or a recorded practice game) off the main thread.
import { reviewGame, type GameReview } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import { makeCoach } from '../ai/coach';
import type { DeckList, PlayerId } from '../engine/types';
import { practiceAgents, type PracticeReviewSpec } from './practiceReview';

export type ReviewRequest =
  | { kind: 'bots'; decks: [DeckList, DeckList]; seed: number; first: PlayerId; bot: string; rollouts: number; withCoach: boolean }
  | ({ kind: 'practice'; rollouts: number; withCoach: boolean } & PracticeReviewSpec);
export type ReviewReply = { progress: number } | { review: GameReview } | { error: string };

self.onmessage = async (e: MessageEvent<ReviewRequest>) => {
  const q = e.data;
  const post = (m: ReviewReply) => (self as unknown as Worker).postMessage(m);
  try {
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
