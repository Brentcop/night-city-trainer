// The agents that re-simulate a recorded practice game for the match reviewer (used by review.worker.ts; kept apart
// from the worker so it can be tested without one). Your seat replays your recorded choices. If the record runs out
// before the game ends, a finished game falls back to a stand-in bot (an old record that no longer lines up); a
// conceded game ends right there, as a loss, exactly where you conceded.
import { ScriptedAgent } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import type { Agent, DeckList, PlayerId } from '../engine/types';
import { CONCEDED_REASON } from '../lib/practiceVerdict';
import type { GameReviewJob } from './gameReviewRun';

export interface PracticeReviewSpec {
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  botLevel: string;
  botSeed: number;
  choices: number[][];
  payChoice?: boolean;
  orderChoice?: boolean;
  /** you conceded: the re-simulation ends where your recorded choices end */
  conceded?: boolean;
}

/** What the review worker (review.worker.ts) is asked: a bot game, or a recorded practice game. Here so Node code can name it. */
export type ReviewRequest =
  | { kind: 'bots'; decks: [DeckList, DeckList]; seed: number; first: PlayerId; bot: string; rollouts: number; withCoach: boolean }
  | ({ kind: 'practice'; rollouts: number; withCoach: boolean } & PracticeReviewSpec)
  /** the Game review of a practice game (src/sim/gameReviewRun.ts): both seats rated, your coach grades kept */
  | { kind: 'game'; job: GameReviewJob };

/** An agent whose first decision ends the game: you (seat 0) concede, the bot wins. */
export const conceding: Agent = {
  name: 'conceded',
  decide: async (g) => g.endGame(1, CONCEDED_REASON),
};

/** [your recorded seat, the bot] for re-simulating a practice game. */
export function practiceAgents(q: PracticeReviewSpec): [Agent, Agent] {
  const fallback = q.conceded ? conceding : makeTierBot('medium', 1);
  return [new ScriptedAgent('You', q.choices, fallback, !!q.payChoice, !!q.orderChoice), makeTierBot(q.botLevel, q.botSeed, 'Bot')];
}
