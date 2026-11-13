// The agents that re-simulate a recorded practice game for the match reviewer (used by review.worker.ts; kept apart
// from the worker so it can be tested without one). Your seat replays your recorded choices. If the record runs out
// before the game ends, a finished game falls back to a stand-in bot (an old record that no longer lines up); a
// conceded game ends right there, as a loss, exactly where you conceded.
import { ScriptedAgent } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import type { Agent, DeckList, PlayerId } from '../engine/types';
import { CONCEDED_REASON } from '../lib/practiceVerdict';
import type { GameReviewJob } from './gameReviewRun';

/** An online game against a person (src/net/): your engine seat, the rival's name and answers, how it ended. */
export interface PvpReplay {
  rival: string;
  seat: PlayerId;
  rivalChoices: number[][];
  rivalConceded?: boolean;
  abandoned?: boolean;
  /** the rival ended their turns with End turn even when nothing else was left (their own setting; absent: automatic) */
  rivalEndTurnClick?: boolean;
}

export interface PracticeReviewSpec {
  decks: [DeckList, DeckList];
  seed: number;
  first?: PlayerId;
  botLevel: string;
  botSeed: number;
  choices: number[][];
  payChoice?: boolean;
  orderChoice?: boolean;
  /** you ended your turns with End turn even when nothing else was left (absent: automatic, as every older record) */
  endTurnClick?: boolean;
  /** you conceded: the re-simulation ends where your recorded choices end */
  conceded?: boolean;
  /** an online game against a person: both seats replay their recorded answers (src/net/) */
  pvp?: PvpReplay;
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

/** An agent whose first decision ends the game: this seat concedes, the other wins. */
const concedingSeat = (p: PlayerId): Agent => ({ name: 'conceded', decide: async (g) => g.endGame((1 - p) as PlayerId, CONCEDED_REASON) });
/** An agent whose first decision ends the game as a draw (an online game that was abandoned). */
const abandoning: Agent = { name: 'abandoned', decide: async (g) => g.endGame('tie', 'abandoned') };

/** [your recorded seat, the bot] for re-simulating a practice game; for an online game, both seats' recorded answers. */
export function practiceAgents(q: PracticeReviewSpec): [Agent, Agent] {
  const v = q.pvp;
  if (v) {
    const me = v.seat;
    const rival = (1 - me) as PlayerId;
    // a record that runs out: where the player conceded, the game was abandoned, or (an old record) a stand-in bot
    const end = (p: PlayerId, conceded: boolean): Agent => (conceded ? concedingSeat(p) : v.abandoned ? abandoning : makeTierBot('medium', 1));
    const mine = new ScriptedAgent('You', q.choices, end(me, !!q.conceded), true, true, !!q.endTurnClick);
    const theirs = new ScriptedAgent('Rival', v.rivalChoices, end(rival, !!v.rivalConceded), true, true, !!v.rivalEndTurnClick);
    return me === 0 ? [mine, theirs] : [theirs, mine];
  }
  const fallback = q.conceded ? conceding : makeTierBot('medium', 1);
  return [new ScriptedAgent('You', q.choices, fallback, !!q.payChoice, !!q.orderChoice, !!q.endTurnClick), makeTierBot(q.botLevel, q.botSeed, 'Bot')];
}
