// How the coach and the Game review put a value gap into words, and the names a player reads for options and grades.
// Pure and light (no engine, no bots): the coach (src/ai/coach.ts), the board's coach UI (board/CoachPanel.tsx,
// PromptPanel.tsx, PhoneParts.tsx) and the review screens can all use it, so one move is never described two ways.
//
// Gaps are in "Gigs": the coach's estimate in Gig-equivalents (GIG = 40 points of the bots' evaluation per Gig), not
// Gigs on the board. A play-out that ends the game scores ±10,000 points (250 "Gigs"), so a raw gap can run far past the
// 7 Gigs a game is won with: every figure a player reads goes through gapFigure / behindText, which never print more than
// CAP_GIGS.
import { BLUNDER_GIGS, CAP_GIGS, CLOSE_GIGS, GIG, RATING_INFO, type Rating } from './gameReview';
import type { MoveVerdict } from '../ai/coach';

/**
 * A gap of this many Gigs or more means the game ended differently in the play-outs (the evaluation's decided line,
 * DECIDED_EVAL = win / 2 = 5,000 points; tests/coach-words.test.ts checks they agree).
 */
export const DECIDED_GIGS = 5000 / GIG;

/** One line for a learner: what a coach figure in Gigs is. */
export const GIG_NOTE = `Coach figures in Gigs are its estimate of value in Gig-equivalents (one Gig = ${GIG} points of the bots' evaluation, from play-outs of a few turns), not Gigs on the board.`;

/** How big a gap (Gigs, ≥ 0) is for printing: one that decides the game in the play-outs, one past the cap, or a figure. */
export function gapSize(gap: number): 'decided' | 'over-cap' | 'figure' {
  if (gap >= DECIDED_GIGS) return 'decided';
  return gap > CAP_GIGS ? 'over-cap' : 'figure';
}

const one = (x: number) => x.toFixed(1);
/** The ± part of a figure (left out when it rounds to 0.0), never more than the cap either. */
const spread = (se?: number | null) => (se && se >= 0.05 ? (se > CAP_GIGS ? ` ± more than ${CAP_GIGS}` : ` ± ${one(se)}`) : '');

/**
 * A gap as a size, for "worth …" / "about …": "0.4 Gigs" (with "± 0.1" when it has a spread), "more than 3 Gigs" past
 * the cap, and "a game-deciding amount" past the decided line (callers that know which side won say so instead).
 */
export function gapFigure(gap: number, se?: number | null): string {
  const g = Math.max(0, gap);
  const size = gapSize(g);
  if (size === 'decided') return 'a game-deciding amount';
  if (size === 'over-cap') return `more than ${CAP_GIGS} Gigs`;
  return `${one(g)}${spread(se)} Gigs`;
}

/** A gap below the pick, as a short tag: "−0.4 ± 0.1 Gigs", "more than 3 Gigs behind", "decides the game in the play-outs". */
export function behindText(gap: number, se?: number | null): string {
  const g = Math.max(0, gap);
  const size = gapSize(g);
  if (size === 'decided') return 'decides the game in the play-outs';
  if (size === 'over-cap') return `more than ${CAP_GIGS} Gigs behind`;
  return `−${one(g)}${spread(se)} Gigs`;
}

/** A close call that is wide (the gap is CLOSE_GIGS or more, inside the noise only because the play-outs disagree). */
export const isWideClose = (gap: number | null | undefined) => (gap ?? 0) >= CLOSE_GIGS;

/**
 * The name a player reads for an option. The engine's labels stay as they are (bots, tests and recorded replays match
 * on them); the board calls passing "End turn" and declining a reaction "No reaction", so the coach does too.
 */
export function shownLabel(label: string): string {
  if (label === 'Pass turn') return 'End turn';
  if (label === 'No (more) reactions') return 'No reaction';
  return label;
}

/** The name of option `i` of a decision as the board shows it (the opening hand's yes/no reads Mulligan / Keep hand). */
export function optionName(d: { kind: string; tag?: string; options: readonly { label: string; key?: string }[] }, i: number): string {
  const o = d.options[i];
  if (!o) return '?';
  if (d.kind === 'yesno' && d.tag === 'mulligan') return o.key === 'yes' ? 'Mulligan' : o.key === 'no' ? 'Keep hand' : o.label;
  return shownLabel(o.label);
}

/**
 * The review's rating (src/lib/gameReview.ts RATINGS) a coach verdict reads as, so the toast, the scorecard and the
 * review use one set of names: the coach's pick or as good → Best, close → Close call, inaccuracy → Slip, mistake →
 * Mistake (Blunder from BLUNDER_GIGS). Null when the move was not measured (pending, unscored).
 */
export function verdictRating(verdict: MoveVerdict | string, gap: number | null | undefined): Rating | null {
  switch (verdict) {
    case 'agree':
    case 'best':
      return 'best';
    case 'close':
      return 'close';
    case 'inaccuracy':
      return 'slip';
    case 'mistake':
      return (gap ?? 0) >= BLUNDER_GIGS ? 'blunder' : 'mistake';
    default:
      return null;
  }
}

/** The display name of a verdict's rating ("Best", "Close call", "Slip", "Mistake", "Blunder"), or null when not measured. */
export function verdictName(verdict: MoveVerdict | string, gap: number | null | undefined): string | null {
  const r = verdictRating(verdict, gap);
  return r ? RATING_INFO[r].label : null;
}
