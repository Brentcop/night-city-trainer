// How the Play board grades your move against the coach (src/ui/pages/Play.tsx `commit`), kept apart so the order can be
// tested without a board. A move made while the advice for its decision is showing is graded at once; a move made
// before that advice arrived (ROADMAP2 §11 item 15) gets a placeholder at its place among the grades now, and the grade
// takes that place when the advice for THAT decision lands (the coach client keeps that request even when the next
// decision's advice is asked: src/ui/useCoach.ts `adviceFor`). Either way a move the coach did not value is then scored
// in the advice's worlds and its grade finished in place, and a grade that would show a Slip or worse, or a close call as
// wide as a Mistake, is first checked on fresh worlds (REVIEW_2026-11-25 C1: src/ai/coach.ts needsConfirm,
// confirmMoveRequest, gradeConfirmed): the toast says "Checking your move…" meanwhile, and only the confirmed verdict
// ever settles, in the toast, the scorecard, the practice log and the export.
//
// Grading never reads or changes the game: only `grades`, the session's list (src/lib/practiceSession.ts), which Undo
// truncates by count. That is why the placeholder goes in at answer time: the grades stay in answer order and every
// snapshot's count stays right, and a grade (or a confirmation) that lands for a move Undo took back finds its
// placeholder gone and is dropped, never given to a later move. Advice that never comes (the coach declined, or closed)
// leaves the placeholder as a move not measured; so does a confirmation that never comes (the screened verdict is
// never shown unconfirmed: it was 10–20% likely to call an equal move a Slip).
import { gradeConfirmed, gradeMove, needsConfirm, type Advice, type GradedOption, type MoveGrade } from '../ai/coach';
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
  /** the coach's pick and the move made on fresh worlds, for a flagged grade (CoachApi.confirm) */
  confirm: (d: Decision, chosen: number, a: Advice) => Promise<GradedOption[]>;
  /**
   * A grade was given (`replaced` null), finished in place of a pending one, or landed in place of an early move's
   * placeholder (`replaced` is the grade or placeholder it took the place of).
   */
  onGrade: (gr: CoachedGrade, replaced: CoachedGrade | null) => void;
}

/**
 * Grade answer `chosen` at decision `d` (answer `at` of the game, made on turn `turn`) against `advice`: pushed, or put
 * in place of `slot` (an early move's placeholder; nothing when Undo took it away). Returns the grade first shown (a
 * pending one while the move is scored or checked), or null.
 */
export function gradeWithAdvice(ctx: GradeContext, d: Decision, chosen: number, advice: Advice, at: number, turn: number, slot?: CoachedGrade): CoachedGrade | null {
  /** Put `gr` in place of `old` (or at the end when `old` is null); false when Undo took `old` away. */
  const put = (gr: CoachedGrade, old: CoachedGrade | null): boolean => {
    if (old) {
      const k = ctx.grades.indexOf(old);
      if (k < 0) return false;
      ctx.grades[k] = gr;
    } else ctx.grades.push(gr);
    ctx.onGrade(gr, old);
    return true;
  };
  /** Show `screen` (a finished screen), or check it on fresh worlds first when it is flagged. */
  const settle = (screen: MoveGrade, old: CoachedGrade | null, extra?: GradedOption[]): CoachedGrade | null => {
    if (!needsConfirm(screen)) {
      const gr = coachedGrade(d, chosen, advice, screen, at, extra);
      return put(gr, old) ? gr : null;
    }
    // "Checking your move…" until the fresh worlds are in: the screened verdict is never shown
    const checking = coachedGrade(d, chosen, advice, { turn: screen.turn, chose: screen.chose, coach: screen.coach, gap: null, verdict: 'pending' }, at, extra);
    if (!put(checking, old)) return null;
    const done = (fresh: GradedOption[]) => void put(coachedGrade(d, chosen, advice, gradeConfirmed(chosen, advice, screen, fresh, extra), at, extra, fresh), checking);
    ctx.confirm(d, chosen, advice).then(done, () => done([]));
    return checking;
  };
  const first = gradeMove(d, chosen, advice, turn);
  if (first.verdict !== 'pending') return settle(first, slot ?? null);
  // a move the coach did not value: scored in its worlds off the board's thread; play goes on meanwhile. Undo truncates
  // `grades`, so a score that arrives for an undone move finds its grade gone and is dropped.
  const gr = coachedGrade(d, chosen, advice, first, at);
  if (!put(gr, slot ?? null)) return null;
  const scored = (extra: GradedOption[]) => {
    if (ctx.grades.indexOf(gr) < 0) return;
    settle(gradeMove(d, chosen, advice, gr.turn, extra), gr, extra);
  };
  ctx.score(d, chosen, advice).then(scored, () => scored([]));
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
