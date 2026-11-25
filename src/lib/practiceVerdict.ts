// Kept apart from practiceSession.ts so the review worker can name a concession without pulling in the browser-storage
// modules the session records to. Also the rule for a record from another simulator version (pure, light): it is
// replayed when both seats' answers and the position the game reached are in it, never when the bot must play itself.
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

// ------------------------------------------------------------------ a record from another simulator version

/** At most this many answers in one seat's recorded list (a long game has a few hundred; an import past it is refused). */
export const MAX_RECORDED_ANSWERS = 20_000;
/** At most this many picks in one recorded answer, each a whole option index under MAX_OPTION_INDEX. */
export const MAX_ANSWER_PICKS = 64;
export const MAX_OPTION_INDEX = 1_000;

/**
 * A seat's recorded answers as read from storage or an imported file (untrusted): a list of answers, each a list of
 * whole option indices (0 ≤ i < MAX_OPTION_INDEX, at most MAX_ANSWER_PICKS of them), at most MAX_RECORDED_ANSWERS in all.
 * Whether each answer fits the decision it answers is the strict replay's check (src/ai/reviewer.ts legalAnswer).
 */
export function isAnswerList(x: unknown): x is number[][] {
  return (
    Array.isArray(x) &&
    x.length <= MAX_RECORDED_ANSWERS &&
    x.every((c) => Array.isArray(c) && c.length <= MAX_ANSWER_PICKS && c.every((i) => Number.isInteger(i) && (i as number) >= 0 && (i as number) < MAX_OPTION_INDEX))
  );
}

/** What decides whether a record can be replayed on another simulator version (src/sim/practiceReview.ts PracticeReviewSpec). */
export interface VersionFacts {
  /** the simulator version the game was recorded with (absent: older records, replayed strictly as today's) */
  simVersion?: number;
  /** the bot seat's answers (recorded since 2026-11-25) */
  botChoices?: readonly (readonly number[])[];
  /** an online game: both seats' answers are recorded */
  pvp?: unknown;
  /** the position the game reached (src/sim/practiceReview.ts ReplayPosition) */
  position?: unknown;
}

/**
 * Both seats' answers are in the record (an online game, or a bot game whose bot answers were recorded): the replay
 * needs no bot, only the rules engine and the card scripts, and the recorded position still guards it.
 */
export const bothSeatsRecorded = (r: VersionFacts): boolean => r.pvp !== undefined || Array.isArray(r.botChoices);

/**
 * The simulator version a record was played with, when it is not this one and the record can still be replayed (both
 * seats' answers and a recorded position), else null. The Game review then rates it with the current bots and says once
 * that the game was played on another version (otherVersionText).
 */
export function replayedFromOtherVersion(r: VersionFacts, now = CURRENT_SIM_VERSION): number | null {
  const v = r.simVersion;
  if (v === undefined || v === now) return null;
  return bothSeatsRecorded(r) && r.position !== undefined ? v : null;
}

/**
 * Why the Game review can't replay a record before even trying, or null. A record from another simulator version is
 * replayed only when both seats' answers are in it and it carries the position the game reached (what catches an engine
 * change that alters the game); otherwise replaying it would need that version's bot, or could not be checked.
 */
export function replayVersionProblem(r: VersionFacts, now = CURRENT_SIM_VERSION): string | null {
  const v = r.simVersion;
  if (v === undefined || v === now || replayedFromOtherVersion(r, now) !== null) return null;
  const head = `This game can't be reviewed: it was recorded with version ${v} of the bots and rules engine, and this is version ${now}`;
  if (!bothSeatsRecorded(r)) return `${head}. Its record does not hold the bot's moves (games played before they were kept with the game), so replaying it would not give the same game.`;
  return `${head}. Its record does not hold the position the game reached (it ended off the board), so a replay on this version could not be checked against the game that was played.`;
}

/** The one line the review of a game from another simulator version says (replayedFromOtherVersion). */
export function otherVersionText(v: number, o: { pvp: boolean }, now = CURRENT_SIM_VERSION): string {
  const older = v < now ? 'an older' : 'a newer';
  const which = `version ${v} of the bots and rules engine; this is version ${now}`;
  return o.pvp
    ? `This game was recorded with ${older} version of the rules engine (${which}). Both sides' recorded moves replay it to the same position, and every move is rated with the current bots.`
    : `This game was played against ${older} bot (${which}). The bot's moves were kept with the game, so it replays to the same position, and every move is rated with the current bots.`;
}
