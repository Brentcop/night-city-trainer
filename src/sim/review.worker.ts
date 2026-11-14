// Web Worker: reviews one game (bot game from a tournament, or a recorded practice game) off the main thread.
import { ReplayDiverged, reviewGame, type GameReview } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import { makeCoach } from '../ai/coach';
import { checkReplayed, practiceAgents, refuseOtherVersion, replayedEnd, type ReplayedEnd, type ReviewRequest } from './practiceReview';
import { runGameReview } from './gameReviewRun';
import type { GameReviewRecord } from '../lib/gameReview';

export type { ReviewRequest };
/** `refused`: the recorded game can't be replayed as it was played (a plain sentence to show as it is) */
export type ReviewReply = { progress: number; turn?: number } | { review: GameReview } | { game: GameReviewRecord } | { refused: string } | { error: string };

self.onmessage = async (e: MessageEvent<ReviewRequest>) => {
  const q = e.data;
  const post = (m: ReviewReply) => (self as unknown as Worker).postMessage(m);
  try {
    if (q.kind === 'game') {
      post({ game: await runGameReview(q.job, (n, turn) => post({ progress: n, turn })) });
      return;
    }
    if (q.kind === 'practice') refuseOtherVersion(q);
    const agents = q.kind === 'bots' ? ([makeTierBot(q.bot, q.seed), makeTierBot(q.bot, q.seed + 7777)] as const) : practiceAgents(q);
    // a practice game: only the seat you played (the guest of an online game is seat 1)
    const me = q.kind === 'practice' ? (q.pvp?.seat ?? 0) : 0;
    const names: [string, string] = q.kind === 'bots' ? [q.bot, q.bot] : q.pvp ? (me === 0 ? ['you', 'rival'] : ['rival', 'you']) : ['you', q.botLevel];
    let end = null as ReplayedEnd | null;
    const review = await reviewGame(
      { decks: q.decks, seed: q.seed, first: q.first, agents: [agents[0], agents[1]], agentNames: names },
      { rollouts: q.rollouts, withCoach: q.withCoach, coach: makeCoach, seats: q.kind === 'practice' ? [me] : [0, 1], onProgress: (n) => post({ progress: n }), onEnd: (s) => (end = replayedEnd(s)) },
    );
    if (q.kind === 'practice') checkReplayed(q, agents, end!);
    post({ review });
  } catch (err) {
    if (err instanceof ReplayDiverged) post({ refused: err.message });
    else {
      // a bug, not a refusal: the screen shows the message, the console keeps the stack
      console.error(err);
      post({ error: err instanceof Error ? `${err.name}: ${err.message}` : String(err) });
    }
  }
};
