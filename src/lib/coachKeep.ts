// What a finished practice game keeps of the coach (src/ui/pages/Play.tsx, the board's game-over effect). The coach can be
// turned off and on during a game (board setting `coach`, src/lib/boardSettings.ts), and a move is graded only while its
// advice shows, so a game's grades are exactly the moves graded while the coach was on. They are kept whatever the
// switch says when the game ends: the scorecard in the practice log (the Profile's coach averages) and the coach's
// ratings for a Game review run later. The exported coached replay (src/lib/coachedReplay.ts) and the end-of-game
// scorecard read the same grades and never the switch.
import type { CoachedGrade } from './coachedReplay';
import { coachRatingsFrom } from './gameReview';
import { saveCoachRatings } from './gameReviewStore';
import { annotatePractice, coachSummary } from './practiceLog';

/**
 * Whether a finished game writes what it keeps of the coach: when the coach was on at some point of it (as a game with
 * the coach on always did, so a game finished again after Undo replaces what its first finish kept), or when it has a
 * graded move (a resumed save's grades with the coach off now). A game the coach never saw writes nothing, as before.
 */
export function keepsCoachGrades(coachUsed: boolean, graded: number): boolean {
  return coachUsed || graded > 0;
}

/** Keep a finished game's coach grades: the scorecard in the practice log (when a move was measured) and the review's ratings. */
export function keepFinishedGrades(id: string, grades: readonly CoachedGrade[], choices: readonly (readonly number[])[], gigSwing: number): void {
  const sum = coachSummary(grades);
  if (sum && sum.measured > 0) annotatePractice(id, sum);
  // the coach's grades go with the game, so a Game review run later (from the Profile) keeps them
  saveCoachRatings(id, coachRatingsFrom(grades.map((x) => x.record), choices.length, gigSwing), choices);
}
