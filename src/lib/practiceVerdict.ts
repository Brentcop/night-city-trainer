// Kept apart from practiceSession.ts so the review worker can name a concession without pulling in the browser-storage
// modules the session records to.
import type { PlayerId } from '../engine/types';
import { CURRENT_SIM_VERSION } from './playedRecord';

/** What the result screen, the log and the practice history call a conceded game. */
export const CONCEDED_REASON = 'You conceded';

/** A game ended off the board by the session (a concession, a clock that ran out, an abandoned online game). */
export interface SessionEnding {
  winner: PlayerId | 'tie';
  reason: string;
}

/** The parts of a recorded game (src/sim/practiceReview.ts PracticeReviewSpec) that say how the session ended it. */
export interface EndingFlags {
  /** you conceded (or, with `outOfTime`, a multi-day bot game was closed as a timed-out loss) */
  conceded?: boolean;
  outOfTime?: boolean;
  pvp?: { seat: PlayerId; rival: string; rivalConceded?: boolean; abandoned?: boolean; timedOut?: PlayerId };
}

/**
 * How the session ended a recorded game, or null when it was played to its end on the board. Replaying the record (the
 * Game review, the review's board frames) ends the game this way at the point where the record runs out, which is where
 * the session stopped it; a game with no session ending must instead end on the board when the record does.
 */
export function sessionEnding(q: EndingFlags): SessionEnding | null {
  const v = q.pvp;
  const me: PlayerId = v?.seat ?? 0;
  const rival = (1 - me) as PlayerId;
  if (v?.timedOut !== undefined) return v.timedOut === me ? { winner: rival, reason: 'You ran out of time' } : { winner: me, reason: `${v.rival || 'The rival'} ran out of time` };
  if (q.conceded) return { winner: rival, reason: q.outOfTime ? 'You ran out of time' : CONCEDED_REASON };
  if (v?.rivalConceded) return { winner: me, reason: `${v.rival || 'The rival'} conceded` };
  if (v?.abandoned) return { winner: 'tie', reason: 'abandoned' };
  return null;
}

/** Why the Game review can't replay a record before even trying (another simulator version), or null. */
export function replayVersionProblem(r: { simVersion?: number }): string | null {
  if (r.simVersion === undefined || r.simVersion === CURRENT_SIM_VERSION) return null;
  return `This game can't be reviewed: it was recorded with version ${r.simVersion} of the bots and rules engine, and this is version ${CURRENT_SIM_VERSION}, so replaying it would not give the same game.`;
}
