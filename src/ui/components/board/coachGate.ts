// When the Play board asks the coach and when it grades a move (src/ui/pages/Play.tsx `Board`). `coach` is whether the
// coach is on now: the board has one (a game against the bot, the site's coach feature on) and the board setting `coach`
// (Settings' Coach switch, src/lib/boardSettings.ts) is on. It can change at any decision: turned on, the decision
// waiting is asked about as any new decision is; turned off, nothing is asked and nothing more is graded. Neither gate
// reads or changes the game: the coach works on its own snapshot (coachRequest), so the record is the same either way.
import { coachWorthAsking } from '../../../ai/coach';
import type { Decision } from '../../../engine/types';
import type { PayMode } from '../../../lib/boardSettings';
import { autoPayAnswer } from '../../../lib/eddiePayment';
import { onlyEndTurn } from './interaction';

/**
 * Ask the coach about decision `d`: the coach is on, and `d` is worth asking (two or more options that matter; not a
 * lone End turn, not a cost the automatic payment answers before it shows).
 */
export function adviceWanted(d: Decision | null, coach: boolean, payMode: PayMode): d is Decision {
  return !!d && coach && coachWorthAsking(d) && !onlyEndTurn(d) && autoPayAnswer(d, payMode) === null;
}

/**
 * Grade your answer to decision `d`: the coach is on and its advice for this exact decision is showing (`advisedFor`,
 * the decision the advice on screen was made for). A move made before the advice arrived, or with the coach off, is not.
 */
export function gradeWanted(d: Decision, coach: boolean, advisedFor: Decision | null): boolean {
  return coach && advisedFor === d && coachWorthAsking(d);
}
