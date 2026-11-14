// The agents that re-simulate a recorded practice game for the match reviewer (used by review.worker.ts; kept apart
// from the worker so it can be tested without one). Your seat replays your recorded choices; in an online game both
// seats do. The replay is strict: every recorded answer must be one of the options of the decision asked, and the record
// must last exactly as long as the game. When the session ended the game off the board (you conceded, a clock ran out,
// an online game was abandoned) the game ends that way exactly where the record runs out; otherwise a record that runs
// out, an answer that doesn't fit, answers left over, or another winner or length is a ReplayDiverged ("this game can't
// be reviewed"), never a review of a different game. A record that carries its `position` must also reach it: the final
// position of a game played to its end, or, for a game the session ended, the position of your last decision. A replay
// recorded by another simulator version is refused up front.
import { divergedText, ReplayDiverged, ScriptedAgent } from '../ai/reviewer';
import { makeTierBot } from '../ai/tiers';
import type { Agent, DeckList, GameState, PlayerId } from '../engine/types';
import { stateHash } from '../lib/stateHash';
import { CONCEDED_REASON, replayVersionProblem, sessionEnding, type SessionEnding } from '../lib/practiceVerdict';
import type { GameReviewJob } from './gameReviewRun';

/** An online game against a person (src/net/): your engine seat, the rival's name and answers, how it ended. */
export interface PvpReplay {
  rival: string;
  seat: PlayerId;
  rivalChoices: number[][];
  rivalConceded?: boolean;
  abandoned?: boolean;
  /** the engine seat whose clock ran out in a multi-day game (the other claimed the win); absent in older records */
  timedOut?: PlayerId;
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
  /** with `conceded`: a multi-day bot game closed as a timed-out loss (worded "You ran out of time") */
  outOfTime?: boolean;
  /** an online game against a person: both seats replay their recorded answers (src/net/) */
  pvp?: PvpReplay;
  /** the result the replay must reproduce (absent: not checked) */
  expect?: PlayerId | 'tie';
  /** how many turns the game lasted, when recorded (checked for a game played to its end) */
  turns?: number;
  /** the simulator version (SIM_VERSION) the game was recorded with; absent in older records (replayed strictly) */
  simVersion?: number;
  /** the position the replay must reach (absent: not checked; see ReplayPosition) */
  position?: ReplayPosition;
}

/**
 * A position recorded with a game, as a stateHash (src/lib/stateHash.ts). Without `at`: the state when the game was
 * over, for a game played to its end on the board. With `at`: the session ended the game off the board (you conceded,
 * a multi-day bot game closed on time), and `hash` is the state at your decision after `at` of your answers (the last
 * decision you were asked, as a save's check holds it).
 */
export interface ReplayPosition {
  hash: string;
  at?: number;
}

/** What the review worker (review.worker.ts) is asked: a bot game, or a recorded practice game. Here so Node code can name it. */
export { replayVersionProblem };

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

/** An agent whose first decision ends the game the way the session ended it. */
const ending = (e: SessionEnding): Agent => ({ name: 'ended', decide: async (g) => g.endGame(e.winner, e.reason) });

/** Refuse a record from another simulator version up front (a ReplayDiverged with the plain sentence). */
export function refuseOtherVersion(q: PracticeReviewSpec): void {
  const why = replayVersionProblem(q);
  if (why) throw new ReplayDiverged(why);
}

/**
 * [your recorded seat, the bot] for re-simulating a practice game; for an online game, both seats' recorded answers.
 * Strict (see the top of this file): use checkReplayed() on the result.
 */
export function practiceAgents(q: PracticeReviewSpec): [Agent, Agent] {
  const end = sessionEnding(q);
  const stop = end ? ending(end) : null;
  // your last decision's position, for a game the session ended (checked by your seat's agent as the replay passes it)
  const at = q.position?.at !== undefined ? { hash: q.position.hash, at: q.position.at } : null;
  const v = q.pvp;
  if (v) {
    const mine = new ScriptedAgent('You', q.choices, stop, true, true, !!q.endTurnClick, 'your', at);
    const theirs = new ScriptedAgent('Rival', v.rivalChoices, stop, true, true, !!v.rivalEndTurnClick, "the rival's");
    return v.seat === 0 ? [mine, theirs] : [theirs, mine];
  }
  return [new ScriptedAgent('You', q.choices, stop, !!q.payChoice, !!q.orderChoice, !!q.endTurnClick, 'your', at), makeTierBot(q.botLevel, q.botSeed, 'Bot')];
}

const resultWords = (w: PlayerId | 'tie' | null, me: PlayerId) => (w === 'tie' || w === null ? 'a draw' : w === me ? 'a win for you' : 'a win for the rival');

/** How the replay ended: the winner, the turn, and the final state's stateHash (needed when the record has a final position). */
export interface ReplayedEnd {
  winner: PlayerId | 'tie' | null;
  turns: number;
  hash?: string;
}

/** The ReplayedEnd of a replay's final state. */
export const replayedEnd = (s: GameState): Required<ReplayedEnd> => ({ winner: s.winner, turns: s.turn, hash: stateHash(s) });

/**
 * After the replay: every recorded answer was used, and the game ended as recorded (the winner, and the number of turns
 * when the record has it and the game was played to its end), in the recorded position when the record has one (the
 * final position of a game played to its end; for a game the session ended, the replay must have reached your last
 * decision's position, which the agents checked on the way). Throws a ReplayDiverged otherwise.
 */
export function checkReplayed(q: PracticeReviewSpec, agents: readonly Agent[], st: ReplayedEnd): void {
  const left = agents.reduce((n, a) => n + (a instanceof ScriptedAgent ? a.left : 0), 0);
  if (left > 0) throw new ReplayDiverged(divergedText(`the game ended at turn ${st.turns} with ${left} recorded move${left === 1 ? '' : 's'} still to play`));
  const me = q.pvp?.seat ?? 0;
  const w = st.winner ?? 'tie';
  if (q.expect !== undefined && w !== q.expect) throw new ReplayDiverged(divergedText(`it ends in ${resultWords(w, me)}, not ${resultWords(q.expect, me)}`));
  const ended = !!sessionEnding(q);
  if (q.turns !== undefined && !ended && st.turns !== q.turns) throw new ReplayDiverged(divergedText(`it lasts ${st.turns} turns, not ${q.turns}`));
  const pos = q.position;
  if (!pos) return;
  if (pos.at !== undefined) {
    // the seat that carried the check (practiceAgents): it must have got there
    const mine = agents.find((a): a is ScriptedAgent => a instanceof ScriptedAgent && a.position !== null);
    if (!mine) throw new Error('checkReplayed: the agents were not made by practiceAgents() for this record');
    if (!mine.positionChecked) throw new ReplayDiverged(divergedText(`it ends at turn ${st.turns}, before reaching the position recorded`));
    return;
  }
  // a final position means nothing for a game the session ended off the board
  if (ended) return;
  if (st.hash === undefined) throw new Error('checkReplayed: this record has a final position; pass the replay’s final state hash');
  if (st.hash !== pos.hash) throw new ReplayDiverged(divergedText('it ends in a different position from the game that was played'));
}
