// How the Play board grades your move against the coach (src/ui/pages/Play.tsx `commit`), kept apart so the order can be
// tested without a board. A move made while the advice for its decision is showing is graded at once; a move made
// before that advice arrived (ROADMAP2 §11 item 15) gets a placeholder at its place among the grades now, and the grade
// takes that place when the advice for THAT decision lands (the coach client keeps that request even when the next
// decision's advice is asked: src/ui/useCoach.ts `adviceFor`). Either way a move the coach did not value is then scored
// in the advice's worlds and its grade finished in place.
//
// Grading never reads or changes the game: only `grades`, the session's list (src/lib/practiceSession.ts), which Undo
// truncates by count. That is why the placeholder goes in at answer time: the grades stay in answer order and every
// snapshot's count stays right, and a grade that lands for a move Undo took back finds its placeholder gone and is
// dropped, never given to a later move. Advice that never comes (the coach declined, or closed) leaves the placeholder
// as a move not measured.
import { gradeMove, type Advice, type GradedOption } from '../ai/coach';
import type { Decision } from '../engine/types';
import { coachedGrade, type CoachedGrade } from './coachedReplay';
import { optionName } from './coachWords';

/** What the board says, once a game, when a move is made before the coach's advice for it arrived. */
export const EARLY_MOVE_NOTE = 'That move was made before the coach had finished thinking: it is graded when the coach’s advice for it arrives.';

export interface GradeContext {
  /** the session's grades (Undo truncates them) */
  grades: CoachedGrade[];
  /** score a move the coach did not value, in the worlds of its advice (CoachApi.score) */
  score: (d: Decision, chosen: number, a: Advice) => Promise<GradedOption[]>;
  /**
   * A grade was given (`replaced` null), finished in place of a pending one, or landed in place of an early move's
   * placeholder (`replaced` is the grade or placeholder it took the place of).
   */
  onGrade: (gr: CoachedGrade, replaced: CoachedGrade | null) => void;
}

/**
 * Grade answer `chosen` at decision `d` (answer `at` of the game, made on turn `turn`) against `advice`: pushed, or put
 * in place of `slot` (an early move's placeholder; nothing when Undo took it away). Returns the grade, or null.
 */
export function gradeWithAdvice(ctx: GradeContext, d: Decision, chosen: number, advice: Advice, at: number, turn: number, slot?: CoachedGrade): CoachedGrade | null {
  const gr = coachedGrade(d, chosen, advice, gradeMove(d, chosen, advice, turn), at);
  if (slot) {
    const k = ctx.grades.indexOf(slot);
    if (k < 0) return null;
    ctx.grades[k] = gr;
  } else ctx.grades.push(gr);
  ctx.onGrade(gr, slot ?? null);
  if (gr.verdict === 'pending') {
    // a move the coach did not value: scored in its worlds off the board's thread; play goes on meanwhile. Undo truncates
    // `grades`, so a score that arrives for an undone move finds its grade gone and is dropped.
    const settle = (extra: GradedOption[]) => {
      const k = ctx.grades.indexOf(gr);
      if (k < 0) return;
      const done = coachedGrade(d, chosen, advice, gradeMove(d, chosen, advice, gr.turn, extra), at, extra);
      ctx.grades[k] = done;
      ctx.onGrade(done, gr);
    };
    ctx.score(d, chosen, advice).then(settle, () => settle([]));
  }
  return gr;
}

/**
 * Answer `chosen` at decision `d` was given before the coach's advice for `d` arrived: a placeholder now, at this
 * answer's place, and the grade when `advice` (the advice asked for `d` itself) lands. Returns the placeholder.
 */
export function gradeWhenAdvised(ctx: GradeContext, d: Decision, chosen: number, advice: Promise<Advice>, at: number, turn: number): CoachedGrade {
  const slot: CoachedGrade = { turn, chose: optionName(d, chosen), coach: '', gap: null, verdict: 'pending' };
  ctx.grades.push(slot);
  advice.then(
    (a) => void gradeWithAdvice(ctx, d, chosen, a, at, turn, slot),
    () => {
      // no advice will come: the move stays not measured (the placeholder keeps its place, so Undo's counts hold)
      const k = ctx.grades.indexOf(slot);
      if (k >= 0) ctx.grades[k] = { ...slot, verdict: 'unscored' };
    },
  );
  return slot;
}
