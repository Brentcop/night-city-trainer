// The Game review's ratings: one word for every decision of a finished game, on a seven-step scale, from what the
// match reviewer's oracle (src/ai/reviewer.ts) measured. Both seats are rated by the same oracle (since 2026-11-25); the
// coach's grade from play (src/ai/coach.ts gradeMove) is kept beside your move for reference only. Pure: the review
// worker, the CLI (scripts/review.ts) and the review screen all rate through here, so they never disagree.
//
// Every number is in Gigs (one Gig = GIG evaluation points, GIG_SWING in src/ai/eval.ts) with the paired standard error
// of the measurement, so that noise is never called a mistake. docs/BOT_TOOLKIT.md §8 has the definitions in words.
import type { DecisionReview, GameReview, SeatAnswers } from '../ai/reviewer';
import type { PlayerId } from '../engine/types';
import { CURRENT_SIM_VERSION } from './playedRecord';
import { costSentence } from './ratingCost';

/** Evaluation points per Gig (= GIG_SWING; tests/game-review.test.ts checks they agree). */
export const GIG = 40;
/** Within this many Gigs of the best move is the best move (the reviewer's noise floor, NOISE = 4 points). */
export const BEST_GIGS = 0.1;
/** A gap under this many Gigs, or within SE_FACTOR paired standard errors, is a close call (the coach's CLOSE_GIGS). */
export const CLOSE_GIGS = 0.15;
export const SE_FACTOR = 2;
/** A clear gap of this many Gigs or more is a mistake (the coach's MISTAKE_GIGS, the reviewer's BLUNDER line). */
export const MISTAKE_GIGS = 0.375;
/** A clear gap of a whole Gig or more is a blunder (or a mistake-sized gap that loses the game in the play-outs). */
export const BLUNDER_GIGS = 1;
/** Gaps are capped here when averaged (the reviewer's CAP, 120 points). */
export const CAP_GIGS = 3;
/** Accuracy = 100 × exp(−average loss / ACCURACY_SCALE_GIGS): with 1 Gig, 100 × e^(−Gigs lost per counted move). */
export const ACCURACY_SCALE_GIGS = 1;
/**
 * A paired standard error under this many Gigs (one evaluation point) means the play-outs all but agree on the
 * difference: it comes from fixed terms of the evaluation (a face-up Legend, the 1-ply offset, a card kept in hand), not
 * from anything the play-outs showed, so so small an SE says nothing about how sure the gap is (COACH-14: the coach's
 * "Call a Legend" grades had 0.19–0.49 Gigs at an SE of 0 to 0.024).
 */
export const FIXED_SE_GIGS = 0.025;
/**
 * The standard error such a fixed-term gap is given instead: about the median paired SE the review measures (0.29 Gigs
 * over 12 Medium-vs-Hard games, 2026-11-13). So a fixed difference counts only when it is as clear as a typically
 * measured one would have to be: over 2 × 0.25 = 0.5 Gigs (a key card sold, a game lost in every world); the 0.2–0.5 Gig
 * face-up-Legend and 1-ply-offset gaps of COACH-14 are close calls.
 */
export const FIXED_GAP_SE_GIGS = 0.25;
/**
 * The rules the stored ratings were made with. Bump it whenever a rating rule changes, so stored reviews are re-rated
 * instead of showing the old ratings (src/lib/gameReviewStore.ts). 2: noise tested on the raw gap, fixed-term gaps not
 * measured, Sharp needs every option clearly worse, passing at most Sharp (2026-11-13). 3: wide close calls (gap ≥
 * MISTAKE_GIGS within noise) confirmed on fresh worlds, costly coach grades oracle-graded (2026-11-22). 4 (2026-11-25,
 * docs/REVIEW_2026-11-25.md): mulligans not rated ('unrated'); no Sharp or Inspired (confirmed on 16 fresh worlds they
 * still came more often in Easy's won games than its lost ones: reports/review-validity-2026-11-25.md); your moves rated
 * by the oracle like the rival's, the coach's grade from play kept beside them; a seat's rare Mistakes and Blunders rated
 * from their Hard check (hardFlag, HARD_CHECK_MAX_FLAGS).
 */
export const REVIEW_RULES = 4;
/**
 * How a review is measured, kept apart from how it is rated (REVIEW_RULES): the oracle (src/ai/reviewer.ts: its
 * play-outs, worlds, quick screen, candidates and confirmation stream), the play-outs per option (GAME_REVIEW_ROLLOUTS),
 * the confirmation worlds (GAME_REVIEW_CONFIRM) and the Hard check's (GAME_REVIEW_HARD). Bump it whenever the measurement changes: a stored review measured
 * another way is never re-rated from its kept measurements (that would pass old numbers off as new ones), it is run again
 * (src/lib/gameReviewStore.ts). Records stored before it count as this version. 1: 2026-11-14. 2: costly coach grades
 * and wide close calls go to the oracle (2026-11-22). 3: a Gig choice's play-outs resolve what the Gig change triggers
 * (Meredith Stout's trigger stayed pending and failed the review) and change the Gig as the engine does ('set' for "set a
 * Gig to another Gig's value"); a decision whose grading throws is listed apart, not counted (2026-11-25). 4: no
 * mulligan play-outs; your moves measured by the oracle like the rival's, never skipped for a coach grade; a seat's 1 to
 * HARD_CHECK_MAX_FLAGS Mistakes and Blunders checked with Hard play-outs (GAME_REVIEW_HARD) (2026-11-25).
 */
export const REVIEW_MEASURE = 4;
/**
 * The simulator version (SIM_VERSION) a stored review without `simVersion` was measured with: every review stored before
 * the field was kept (2026-11-25) ran on version 9, or on 8 under an older REVIEW_MEASURE (stale anyway).
 */
export const REVIEW_SIM_BEFORE_KEPT = 9;
/**
 * Play-outs per candidate in the Game review: 8, as the match reviewer. Chosen 2026-11-12 by re-running 20 Medium-vs-Hard
 * reviews with another oracle seed: see docs/BOT_TOOLKIT.md §8 (ratings within one step of each other on re-run). Part
 * of the measurement: a stored review with other play-outs is run again, not re-rated.
 */
export const GAME_REVIEW_ROLLOUTS = 8;
/**
 * Fresh worlds a move rated Slip or worse is confirmed on before it is shown (REV-4: the move made against the best one
 * found, docs/BOT_TOOLKIT.md §8), and a Sharp or Inspired one (every candidate again, 2026-11-25). 0 turns the
 * confirmation off. Part of the measurement, like the play-outs.
 */
export const GAME_REVIEW_CONFIRM = 16;
/**
 * Fresh worlds a Mistake or Blunder is checked on with the Hard bot playing on both seats, in a seat with at most
 * HARD_CHECK_MAX_FLAGS of them (ReviewOptions.hardCheck, 2026-11-25; docs/REVIEW_2026-11-25.md R2). Measured with the
 * rule written first (reports/review-validity-2026-11-25.md): the ratings it keeps gain clearly more when played on to
 * the end with Hard than the ones it drops, it keeps 95% of those whose gain is clearly positive, and capped at 2 a seat
 * it adds about half to a review's time. 0 turns it off. Part of the measurement, like the play-outs.
 */
export const GAME_REVIEW_HARD = 16;
export const HARD_CHECK_MAX_FLAGS = 2;

/** The seven ratings, best first. */
export const RATINGS = ['inspired', 'sharp', 'best', 'close', 'slip', 'mistake', 'blunder'] as const;
export type RatingKey = (typeof RATINGS)[number];
/**
 * A rating, or a decision that does not count: one option (forced), no measurable difference between the options, or a
 * kind of decision the review does not rate (`unrated`: the mulligan, since 2026-11-25).
 */
export type Rating = RatingKey | 'forced' | 'unclear' | 'unrated';

export interface RatingInfo {
  label: string;
  /** a text mark that reads without colour */
  mark: string;
  /** the colour class (never the only cue) */
  tone: 'top' | 'good' | 'fine' | 'warn' | 'bad' | 'none';
  /**
   * one line for the legend, in words a player reads: no thresholds in Gigs (the screen's "What the ratings mean" gives
   * them apart); a costly rating says what moves of its band cost in win chance (src/lib/ratingCost.ts, row 6)
   */
  means: string;
}
export const RATING_INFO: Record<Rating, RatingInfo> = {
  // never given since 2026-11-25 (REVIEW_RULES 4); kept for reviews stored before, shown as they were
  inspired: { label: 'Inspired', mark: '◆◆', tone: 'top', means: 'Older reviews only. A Sharp move that a quick read ranks third or lower, where its first choice would have been a blunder: hard to find. Never for ending the turn.' },
  sharp: { label: 'Sharp', mark: '◆', tone: 'top', means: 'Older reviews only. The only good move (every other option measured is clearly worse by a mistake or more), and not the one a quick read picks first.' },
  best: { label: 'Best', mark: '●', tone: 'good', means: 'The best move found, or as good: no measurable difference.' },
  close: { label: 'Close call', mark: '○', tone: 'fine', means: 'Behind the best move found, but by too little, or too uncertainly, to call. Not counted as a loss.' },
  slip: { label: 'Slip', mark: '▽', tone: 'warn', means: `Clearly behind the best move found, by a small margin. ${costSentence('review', 'slip')}` },
  mistake: { label: 'Mistake', mark: '▼', tone: 'bad', means: `Clearly behind the best move found. ${costSentence('review', 'mistake')}` },
  blunder: { label: 'Blunder', mark: '▼▼', tone: 'bad', means: `Clearly behind by a large margin, or a mistake that also loses the game in at least 1 in 4 more of the play-outs. ${costSentence('review', 'blunder')}` },
  forced: { label: 'Forced', mark: '–', tone: 'none', means: 'Only one option. Not counted.' },
  unclear: { label: 'No clear difference', mark: '=', tone: 'none', means: 'Every option measured comes out about the same, or the game was already decided. Not counted.' },
  unrated: { label: 'Not rated', mark: '·', tone: 'none', means: 'A kind of move the review does not rate: the mulligan, whose difference stays inside the noise even over whole games. Not counted.' },
};

/** A rating's place on the scale (0 = Inspired … 6 = Blunder); No clear difference sits between Best and Close call. */
export function ratingStep(r: Rating): number | null {
  if (r === 'forced' || r === 'unrated') return null;
  if (r === 'unclear') return 2.5;
  return RATINGS.indexOf(r);
}

/** Ratings that count toward accuracy. */
export const counts = (r: Rating): r is RatingKey => r !== 'forced' && r !== 'unclear' && r !== 'unrated';
/** Ratings inside the noise (no loss counted). */
const FINE: ReadonlySet<Rating> = new Set(['inspired', 'sharp', 'best', 'close']);

/**
 * A gap is within the noise when under CLOSE_GIGS, or within SE_FACTOR paired standard errors (src/ai/coach.ts isClose
 * calls this, so the coach and the review share it). A gap with no spread at all (paired SE under FIXED_SE_GIGS) is
 * fixed evaluation terms, not a measurement: it is given FIXED_GAP_SE_GIGS instead, so it is within the noise up to 0.5
 * Gigs. Pass the raw (uncapped) gap: a capped gap would hide a large error inside a wide SE.
 */
export function withinNoise(gap: number, se?: number | null): boolean {
  if (gap < CLOSE_GIGS) return true;
  if (se == null) return false;
  return gap <= SE_FACTOR * (se < FIXED_SE_GIGS ? FIXED_GAP_SE_GIGS : se);
}

/** A gap with (almost) no spread across the play-outs (fixed evaluation terms): the words say so, not "the play-outs disagree". */
export const fixedTerms = (se?: number | null) => se != null && se < FIXED_SE_GIGS;

/** What the oracle measured about one decision, in Gigs. */
export interface Measured {
  /** the best move's value minus the move made's (≥ 0), capped at CAP_GIGS (what is counted) */
  gap: number;
  /** the same gap before the cap: the noise test reads it (absent: the gap) */
  raw?: number;
  /** its paired standard error */
  se?: number;
  /** the move made is ending the turn (passing): never more than Sharp */
  pass?: boolean;
  /** the move made is the best (not just within the noise) */
  top?: boolean;
  /** every other graded option: [gap below the best, paired SE] */
  others?: readonly (readonly [number, number | null])[];
  /** the quick 1-ply screen's first choice: its gap below the best, SE, and the move made's place in the screen's order */
  screen?: { gap: number; se: number | null; chosenRank: number };
  /** the game was already decided in every play-out */
  decided?: boolean;
  /** the move made loses the game in clearly more play-outs than the best (1 in 4 more) */
  gameLosing?: boolean;
}

/** Every graded option, the move made included, is within the noise of the best: the decision made no measurable difference. */
function noDifference(m: Measured): boolean {
  if (!m.others?.length) return false;
  return withinNoise(m.raw ?? m.gap, m.se) && m.others.every(([g, se]) => withinNoise(Math.max(0, g), se));
}

/** The rating from the size of a gap (no "no clear difference"); the noise test reads the raw gap. */
function band(m: Measured): RatingKey {
  if (m.gap <= BEST_GIGS) return 'best';
  if (withinNoise(m.raw ?? m.gap, m.se)) return 'close';
  if (m.gap >= BLUNDER_GIGS || (m.gap >= MISTAKE_GIGS && m.gameLosing)) return 'blunder';
  return m.gap >= MISTAKE_GIGS ? 'mistake' : 'slip';
}

/**
 * The rating of one measured decision:
 *   No clear difference  the game was already decided, or every option measured is within the noise of the best
 *   Best                 within BEST_GIGS (0.1) of the best
 *   Close call           within the noise: under CLOSE_GIGS (0.15), or within 2 paired SE
 *   Slip                 outside the noise, under MISTAKE_GIGS (0.375)
 *   Mistake              outside the noise, MISTAKE_GIGS to BLUNDER_GIGS (1)
 *   Blunder              outside the noise and BLUNDER_GIGS or more, or a mistake that loses the game in the play-outs
 *
 * Sharp and Inspired (the only good move, which a quick 1-ply read did not pick first; Inspired: ranked third or lower,
 * its pick a blunder) were given until 2026-11-25 from the screening pass. Confirmed on 16 fresh worlds they did follow
 * skill (Hard 0.73 a game, Easy 0.25), but Easy still earned them 1.9 times as often in its won games as in its lost ones,
 * against the rule's 1.5 written before the games: they say as much about the position as about the play, so they were
 * dropped and such a move is Best (reports/review-validity-2026-11-25.md, docs/REVIEW_2026-11-25.md R4).
 */
export function rateMeasured(m: Measured): Rating {
  if (m.decided || noDifference(m)) return 'unclear';
  return band(m);
}

const gigs = (pts: number) => pts / GIG;

/**
 * What the oracle measured about a decision (src/ai/reviewer.ts DecisionReview), in Gigs: the gap, its SE and the
 * game-losing flag from the Hard check when there is one (DecisionReview.hard), else from the confirmation or screening.
 */
export function oracleMeasured(dd: DecisionReview): Measured {
  const d = dd.hard ? { ...dd, regret: dd.hard.regret, raw: dd.hard.raw, se: dd.hard.se, gameLosing: dd.hard.gameLosing } : dd;
  return {
    gap: gigs(d.regret),
    ...(d.raw !== undefined ? { raw: gigs(d.raw) } : {}),
    ...(d.se !== undefined ? { se: gigs(d.se) } : {}),
    ...(d.category === 'end turn' ? { pass: true } : {}),
    ...(d.top !== undefined ? { top: d.top } : {}),
    ...(d.others ? { others: d.others.map(([g, se]) => [gigs(g), gigs(se)] as const) } : {}),
    ...(d.screen ? { screen: { gap: gigs(d.screen.gap), se: gigs(d.screen.se), chosenRank: d.screen.chosenRank } } : {}),
    ...(d.decided ? { decided: true } : {}),
    gameLosing: d.gameLosing,
  };
}

/** The rating of a decision the oracle graded. */
export const rateOracle = (d: DecisionReview): Rating => rateMeasured(oracleMeasured(d));

/** Ratings a move is confirmed on fresh worlds for (REV-4). */
const COSTLY: ReadonlySet<Rating> = new Set(['slip', 'mistake', 'blunder']);
/**
 * The decisions the Game review confirms on fresh worlds (ReviewOptions.confirm.flag): those its screening play-outs rate
 * Slip or worse, or close calls with a gap at least as wide as a Mistake.
 */
export const confirmFlag = (d: DecisionReview): boolean => {
  const r = rateOracle(d);
  if (COSTLY.has(r)) return true;
  return r === 'close' && gigs(d.raw ?? d.regret) >= MISTAKE_GIGS;
};

/**
 * The decisions the Hard check counts and checks (ReviewOptions.hardCheck.flag): those rated Mistake or Blunder after the
 * confirmation, before any Hard check (a seat with 1 to HARD_CHECK_MAX_FLAGS of them has its main-phase ones and its
 * reactions checked).
 */
export const hardFlag = (d: DecisionReview): boolean => {
  const r = rateOracle({ ...d, hard: undefined });
  return r === 'mistake' || r === 'blunder';
};

// ---------------------------------------------------------------------------------------------------- coach grades

/** The coach verdicts that measured the move (the rest, pending or unscored, are left to the oracle). */
const MEASURED = ['agree', 'best', 'close', 'inaccuracy', 'mistake'] as const;
type MeasuredVerdict = (typeof MEASURED)[number];

/**
 * A coach grade from play, kept small (stored with the game at its end, and read from an exported game file): the
 * verdict, its gap in Gigs below the coach's pick with the paired SE, and every other option the coach scored as
 * [option index, Gigs below the coach's pick (below 0: valued higher), paired SE or null].
 */
export interface CoachRating {
  at: number;
  turn: number;
  chose: number;
  coach: number;
  chosen: string;
  best: string;
  why: string;
  verdict: MeasuredVerdict;
  gap: number;
  se?: number;
  alts: [number, number, number | null][];
  /**
   * the coach showed "No clear difference" (since 2026-11-25 the coach's own verdict 'unclear': every option it scored was
   * within the noise, or the game was decided); `verdict` is then its grade by the gap alone (MoveGrade.band)
   */
  unclear?: true;
  /** the grade was confirmed on this many fresh worlds before the coach showed it (since 2026-11-25): gap and SE are the confirmation's */
  confirmed?: number;
}

/**
 * The parts of a coach record (src/lib/coachedReplay.ts CoachedDecision) a rating reads; named here, not imported, so
 * the review worker's build does not pull in the browser-storage modules that file reaches.
 */
export interface CoachRecordLike {
  at: number;
  turn: number;
  options: string[];
  chose: number;
  coach: number;
  why: string;
  verdict: string;
  gap: number | null;
  se?: number;
  scores: { i: number; v: number; w?: number[] }[];
  /** the decision kind and what the coach scored (absent: a rule decided); older records without them read as before */
  kind?: string;
  scoreKind?: string;
  /** the coach showed "No clear difference" (src/lib/coachedReplay.ts CoachedDecision.unclear) */
  unclear?: boolean;
  /** the fresh worlds the grade was confirmed on (CoachedDecision.confirmed) */
  confirmed?: number;
}

const WHY_MAX = 220;
/** Plain-data standard error of a mean (heuristic.ts standardError, kept here so this module stays light). */
function stdErr(xs: readonly number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const m = xs.reduce((a, x) => a + x, 0) / n;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (n - 1) / n);
}
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** The compact coach grade of a recorded decision, or null when the coach did not measure the move (pending, unscored). */
export function coachRatingOf(rec: CoachRecordLike, gigSwing = GIG): CoachRating | null {
  if (!(MEASURED as readonly string[]).includes(rec.verdict) || rec.gap === null) return null;
  // an older record that agreed with a choice the coach made by rule (a target, a Gig pick, the mulligan) measured nothing
  // (since 2026-11-13 the coach grades those 'unscored'): leave it to the oracle like any unmeasured move
  if (rec.verdict === 'agree' && rec.kind !== undefined && rec.kind !== 'action' && rec.kind !== 'reaction' && rec.scoreKind === undefined) return null;
  const pick = rec.scores.find((o) => o.i === rec.coach);
  const alts: CoachRating['alts'] = [];
  if (pick)
    for (const o of rec.scores) {
      if (o.i === rec.coach) continue;
      const paired = pick.w && o.w && pick.w.length === o.w.length && pick.w.length >= 2 ? stdErr(o.w.map((x, k) => x - pick.w![k]!)) / gigSwing : null;
      alts.push([o.i, r3((pick.v - o.v) / gigSwing), paired === null ? null : r3(paired)]);
    }
  // agreeing with the coach's pick when it scored nothing else measured nothing: the oracle grades the move instead
  if (rec.verdict === 'agree' && !alts.length) return null;
  const why = rec.why.length > WHY_MAX ? `${rec.why.slice(0, WHY_MAX - 1).trimEnd()}…` : rec.why;
  return {
    at: rec.at,
    turn: rec.turn,
    chose: rec.chose,
    coach: rec.coach,
    chosen: rec.options[rec.chose] ?? '?',
    best: rec.options[rec.coach] ?? '?',
    why,
    verdict: rec.verdict as MeasuredVerdict,
    gap: r3(rec.gap),
    ...(rec.se !== undefined ? { se: r3(rec.se) } : {}),
    alts,
    ...(rec.unclear ? { unclear: true as const } : {}),
    ...(rec.confirmed ? { confirmed: rec.confirmed } : {}),
  };
}

/** The compact coach grades of a game's records, leaving out answers past `answers` (undone moves) and moves not measured. */
export function coachRatingsFrom(records: readonly (CoachRecordLike | undefined)[], answers: number, gigSwing = GIG): CoachRating[] {
  const out: CoachRating[] = [];
  for (const r of records) {
    if (!r || r.at >= answers) continue;
    const c = coachRatingOf(r, gigSwing);
    if (c) out.push(c);
  }
  return out;
}

/**
 * What the coach said about one of your moves during play, kept beside the review's rating of it for reference
 * (ReviewMove.said, 2026-11-25). The review never rates by it: until then a coach grade that was not costly stood in for
 * the review's own rating of your move, so "you vs the rival" compared two instruments (docs/REVIEW_2026-11-25.md R8).
 * `v` the coach's verdict, `gap` its Gigs below the coach's pick with the paired SE, `best` the coach's pick when it is
 * not the move made, `why` its reason.
 */
export interface CoachSaid {
  v: MeasuredVerdict;
  gap: number;
  se?: number;
  best?: string;
  why: string;
  /** the coach showed "No clear difference" (CoachRating.unclear) */
  unclear?: true;
  /** the coach's grade was confirmed on this many fresh worlds (CoachRating.confirmed) */
  confirmed?: number;
}

/** The coach's grade of a move, as kept beside the review's rating (ReviewMove.said). */
export const saidOf = (c: CoachRating): CoachSaid => ({
  v: c.verdict,
  gap: r3(Math.max(0, c.gap)),
  ...(c.se !== undefined ? { se: c.se } : {}),
  ...(c.best !== c.chosen ? { best: c.best } : {}),
  why: c.why,
  ...(c.unclear ? { unclear: true as const } : {}),
  ...(c.confirmed ? { confirmed: c.confirmed } : {}),
});

// ---------------------------------------------------------------------------------------------------- the record

/** One rated decision of either seat, as stored. Gaps in Gigs (2 decimals), null when not measured. */
export interface ReviewMove {
  /** order among every decision of both seats */
  seq: number;
  p: PlayerId;
  /** the seat's answer number (links to the replay's choices and the coach's record) */
  at: number;
  turn: number;
  /** what kind of move (the reviewer's category: sell, unit, attack gigs, block, …) */
  cat: string;
  chosen: string;
  /** the move the measurement preferred (the coach's pick for a coach grade); absent when it is the move made */
  best?: string;
  r: Rating;
  /** Gigs below the best move, capped at CAP_GIGS for an oracle grade (what accuracy counts) */
  gap: number | null;
  /** the oracle's gap before the cap (absent: the gap; reviews stored before it, and coach grades, which are not capped) */
  raw?: number;
  se?: number;
  /**
   * who measured it: the review's oracle; 'coach' only in reviews stored before 2026-11-25 (REVIEW_MEASURE 3 or older),
   * where a coach grade from play that was not costly stood in for the review's rating
   */
  src: 'coach' | 'oracle';
  /** the coach's reason (the old coach-graded moves only) */
  why?: string;
  /** the move made loses the game in clearly more play-outs than the best */
  lost?: true;
  /** your move's grade by the coach during play, for reference only (since 2026-11-25; the rating is the oracle's) */
  said?: CoachSaid;
  /** what its rating was computed from (absent in reviews stored before 2026-11-14): see KeptMeasure */
  ms?: KeptMeasure;
}

/**
 * What a move's rating reads, kept with it so that when the rating rules change the stored review is rated again from
 * storage (rerateRecord) instead of being played out again. Compact: arrays, gaps and SEs in evaluation points × 100 as
 * whole numbers (the reviewer rounds every measurement to 0.01 points, so they are exact), except the first number of a
 * pass (below). Absent fields read as absent measurements (no screen, no other option, no SE).
 *
 * An oracle-graded move:
 *   f  the screening pass: [gap, SE ×100 or null]. The gap is the exact gap in points while under the cap (CAP_GIGS ×
 *      GIG = 120; its rounded raw gap is that rounded to 0.01 points), else the raw gap to 0.01 points (the gap counted is
 *      the cap): so one number gives both the capped gap a band reads and the raw gap the noise test reads, exactly
 *   c  the confirmation on fresh worlds, as `f` (absent: not confirmed). Both are kept: which moves are confirmed is a
 *      rating rule (confirmFlag), so a later rule can need the screening figures of a confirmed move
 *   h  the Hard check (DecisionReview.hard, since 2026-11-25), as `f` (absent: not checked). Which moves are checked is
 *      a rating rule too (hardFlag and HARD_CHECK_MAX_FLAGS)
 *   b  bits: 1 the move made is the top, 2 the game was decided, 4 the screening pass's game-losing flag, 8 the
 *      confirmation's, 16 the Hard check's
 *   o  every other graded option, flat [gap, SE, gap, SE, …] ×100, smallest gap first
 *   s  the quick screen's first choice: [gap ×100, SE ×100, the move made's rank in its order]
 * A coach-graded move of a review stored before 2026-11-25 (the CoachRating itself is in the store entry's `coach` list):
 *   s  the review's quick screen: [its first choice's option index, the move made's rank] (absent: no screen)
 */
export interface KeptMeasure {
  f?: (number | null)[];
  c?: (number | null)[];
  h?: (number | null)[];
  b?: number;
  o?: number[];
  s?: number[];
}

export const REVIEW_KIND = 'nct-game-review';
export const REVIEW_SCHEMA = 1;

export interface GameReviewRecord {
  kind: typeof REVIEW_KIND;
  schema: typeof REVIEW_SCHEMA;
  /** the rating rules it was made with (REVIEW_RULES; absent: before rules were versioned, i.e. 1) */
  rules?: number;
  /** how it was measured (REVIEW_MEASURE; absent: before it was versioned, which counts as the current one) */
  measure?: number;
  /** fresh worlds a flagged move was confirmed on (GAME_REVIEW_CONFIRM; 0: none; absent: before it was kept) */
  confirm?: number;
  /** fresh worlds a Mistake or Blunder was checked on with Hard play-outs (GAME_REVIEW_HARD; 0 or absent: none) */
  hard?: number;
  /** rated again from its kept measurements (rerateRecord) under newer rules: the rules it was first rated with */
  rerated?: number;
  /**
   * the simulator version (SIM_VERSION) whose bots measured it: a review measured with other bots is stale
   * (measuredAsNow). Absent: stored before 2026-11-25, REVIEW_SIM_BEFORE_KEPT.
   */
  simVersion?: number;
  /** the simulator version the game itself was played with, when not `simVersion` (an older game rated with newer bots) */
  gameSimVersion?: number;
  /** the practice replay's id */
  id: string;
  /** when the review was made (ISO) */
  made: string;
  rollouts: number;
  oracleSeed: number;
  names: [string, string];
  winner: PlayerId | 'tie' | null;
  reason: string;
  turns: number;
  first: PlayerId;
  /** the seat reviewed as "you" */
  me: PlayerId;
  /** [turn, evaluation from seat 0's side at the start of that turn] (points, rounded) */
  timeline: [number, number][];
  moves: ReviewMove[];
  /** forced decisions per seat (one option; not counted, not listed) */
  forced: [number, number];
  /** decisions the review could not measure (its grading threw): not counted, listed apart with the error (absent: none) */
  failed?: FailedMove[];
  /** every answer of both seats: the board at each move is rebuilt from these with no bot thinking */
  answers?: [SeatAnswers, SeatAnswers];
  ms: number;
}

/** A decision the review could not measure (the reviewer's FailedDecision, as stored): not counted, with the error's message. */
export interface FailedMove {
  seq: number;
  p: PlayerId;
  at: number;
  turn: number;
  cat: string;
  chosen: string;
  /** the error's message */
  why: string;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/** The parts of an oracle grade a rating reads (DecisionReview), in the reviewer's points. */
type OraclePass = Pick<DecisionReview, 'category' | 'regret' | 'raw' | 'se' | 'gameLosing' | 'top' | 'others' | 'screen' | 'decided'>;

/** An oracle-graded move's rating and its figures in Gigs, from one pass of measurements (shared by the build and the re-rating). */
function oracleRated(d: OraclePass): Pick<ReviewMove, 'r' | 'gap' | 'raw' | 'se' | 'lost'> {
  const gap = r2(gigs(d.regret));
  const raw = d.raw !== undefined ? r2(gigs(d.raw)) : gap;
  return {
    r: rateMeasured(oracleMeasured(d as DecisionReview)),
    gap,
    ...(raw !== gap ? { raw } : {}),
    ...(d.se !== undefined ? { se: r2(gigs(d.se)) } : {}),
    ...(d.gameLosing ? { lost: true as const } : {}),
  };
}

/** An oracle-graded move, its fields in one order (a re-rated record re-saved under the same rules is the same text). */
function oracleMove(head: Pick<ReviewMove, 'seq' | 'p' | 'at' | 'turn' | 'cat' | 'chosen' | 'best' | 'said'>, d: OraclePass, ms: KeptMeasure | undefined): ReviewMove {
  const { r, gap, raw, se, lost } = oracleRated(d);
  return {
    seq: head.seq,
    p: head.p,
    at: head.at,
    turn: head.turn,
    cat: head.cat,
    chosen: head.chosen,
    ...(head.best !== undefined ? { best: head.best } : {}),
    r,
    gap,
    ...(raw !== undefined ? { raw } : {}),
    ...(se !== undefined ? { se } : {}),
    src: 'oracle',
    ...(lost ? { lost } : {}),
    ...(head.said ? { said: head.said } : {}),
    ...(ms ? { ms } : {}),
  };
}

/** A move the review leaves unrated on purpose (the mulligan): listed, not counted, nothing measured. */
function unratedMove(head: Pick<ReviewMove, 'seq' | 'p' | 'at' | 'turn' | 'cat' | 'chosen' | 'said'>): ReviewMove {
  return { seq: head.seq, p: head.p, at: head.at, turn: head.turn, cat: head.cat, chosen: head.chosen, r: 'unrated', gap: null, src: 'oracle', ...(head.said ? { said: head.said } : {}) };
}

const CAP_POINTS = CAP_GIGS * GIG;
const cp = (x: number) => Math.round(x * 100);
/** A pass's [gap, SE]: the exact gap under the cap, else the raw gap (KeptMeasure.f). */
const passOf = (d: OraclePass): (number | null)[] => [d.regret < CAP_POINTS ? d.regret : (d.raw ?? d.regret), d.se === undefined ? null : cp(d.se)];
/** Which pass of a move's kept measurements: the screening (f), the confirmation (c) or the Hard check (h), and its game-losing bit. */
type PassKey = 'f' | 'c' | 'h';
const LOSING_BIT: Record<PassKey, number> = { f: 4, c: 8, h: 16 };

/** The measurements of one pass read back, or null when it is not kept. */
function passFrom(ms: KeptMeasure, cat: string, which: PassKey): OraclePass | null {
  const p = ms[which];
  if (!p) return null;
  const [v, se] = p as [number, number | null];
  const b = ms.b ?? 0;
  const o = ms.o ?? [];
  const others: [number, number][] = [];
  for (let k = 0; k + 1 < o.length; k += 2) others.push([o[k]! / 100, o[k + 1]! / 100]);
  return {
    category: cat as DecisionReview['category'],
    // under the cap the gap is kept exactly and the raw gap is it rounded, as the reviewer rounds it; past the cap, the cap
    regret: v < CAP_POINTS ? v : CAP_POINTS,
    raw: v < CAP_POINTS ? r2(v) : v,
    ...(se !== null ? { se: se / 100 } : {}),
    gameLosing: !!(b & LOSING_BIT[which]),
    top: !!(b & 1),
    others,
    ...(ms.s ? { screen: { gap: ms.s[0]! / 100, se: ms.s[1]! / 100, chosenRank: ms.s[2]! } } : {}),
    ...(b & 2 ? { decided: true } : {}),
  };
}

/** Every number a rating reads from a pass, as text (JSON keeps a double exactly): two passes rate alike when these agree. */
const passKey = (d: OraclePass) => JSON.stringify([d.category === 'end turn', d.regret, d.raw ?? null, d.se ?? null, d.gameLosing, d.top ?? null, !!d.decided, d.others ?? null, d.screen ?? null]);

/** A decision's Hard check as a pass (its gap, SE and game-losing flag in place of the confirmation's). */
const hardPass = (d: DecisionReview): OraclePass => (d.hard ? { ...d, regret: d.hard.regret, raw: d.hard.raw, se: d.hard.se, gameLosing: d.hard.gameLosing } : d);

/**
 * The kept measurements of an oracle-graded decision (KeptMeasure), or undefined when they would not read back exactly
 * (a decision recorded without the reviewer's full measurements, or a confirmed one without its screening figures):
 * such a move is never re-rated, so its review is played out again when the rules change, as before.
 */
function keepOracle(d: DecisionReview): KeptMeasure | undefined {
  const first: OraclePass | null = d.confirmed !== undefined ? (d.first ? { ...d, ...d.first } : null) : d;
  if (!first) return undefined;
  const b = (first.top ? 1 : 0) | (first.decided ? 2 : 0) | (first.gameLosing ? 4 : 0) | (d.confirmed !== undefined && d.gameLosing ? 8 : 0) | (d.hard?.gameLosing ? 16 : 0);
  const ms: KeptMeasure = {
    f: passOf(first),
    ...(d.confirmed !== undefined ? { c: passOf(d) } : {}),
    ...(d.hard ? { h: passOf(hardPass(d)) } : {}),
    ...(b ? { b } : {}),
    ...(first.others?.length ? { o: first.others.flatMap(([g, se]) => [cp(g), cp(se)]) } : {}),
    ...(first.screen ? { s: [cp(first.screen.gap), cp(first.screen.se), first.screen.chosenRank] } : {}),
  };
  const same = (x: OraclePass | null, y: OraclePass) => !!x && passKey(x) === passKey({ ...y, others: y.others ?? [] });
  if (!same(passFrom(ms, d.category, 'f'), first)) return undefined;
  if (d.confirmed !== undefined && !same(passFrom(ms, d.category, 'c'), d)) return undefined;
  if (d.hard && !same(passFrom(ms, d.category, 'h'), hardPass(d))) return undefined;
  return ms;
}

/**
 * The stored review of a game: the oracle's grades of both seats, measured the same way (since 2026-11-25), each of your
 * moves with the coach's grade from play beside it when the coach graded it (`coach`, ReviewMove.said: for reference
 * only). Mulligans are listed unrated. A move checked with Hard play-outs is rated from that check. Every rated move keeps
 * what its rating was computed from (ReviewMove.ms), so rerateRecord can rate it again under newer rules. `confirm` and
 * `hard`: the fresh worlds the review confirmed flagged moves on and checked costly ones with Hard on (defaults
 * GAME_REVIEW_CONFIRM and GAME_REVIEW_HARD, as runGameReview).
 */
export function buildReviewRecord(
  review: GameReview,
  coach: readonly CoachRating[],
  meta: { id: string; made: string; me?: PlayerId; confirm?: number; hard?: number; gameSimVersion?: number },
): GameReviewRecord {
  const me = meta.me ?? 0;
  const byAt = new Map(coach.map((c) => [c.at, c]));
  const said = (p: PlayerId, at: number) => {
    const c = p === me ? byAt.get(at) : undefined;
    return c ? { said: saidOf(c) } : {};
  };
  const moves: ReviewMove[] = [];
  for (const d of review.decisions)
    moves.push(oracleMove({ seq: d.seq ?? moves.length, p: d.player, at: d.at ?? -1, turn: d.turn, cat: d.category, chosen: d.chosen, ...(d.best !== d.chosen ? { best: d.best } : {}), ...said(d.player, d.at ?? -1) }, hardPass(d), keepOracle(d)));
  for (const u of review.unrated ?? []) moves.push(unratedMove({ seq: u.seq, p: u.player, at: u.at, turn: u.turn, cat: u.category, chosen: u.chosen, ...said(u.player, u.at) }));
  moves.sort((a, b) => a.seq - b.seq);
  return {
    kind: REVIEW_KIND,
    schema: REVIEW_SCHEMA,
    rules: REVIEW_RULES,
    measure: REVIEW_MEASURE,
    confirm: meta.confirm ?? GAME_REVIEW_CONFIRM,
    hard: meta.hard ?? GAME_REVIEW_HARD,
    simVersion: CURRENT_SIM_VERSION,
    ...(meta.gameSimVersion !== undefined && meta.gameSimVersion !== CURRENT_SIM_VERSION ? { gameSimVersion: meta.gameSimVersion } : {}),
    id: meta.id,
    made: meta.made,
    rollouts: review.rollouts,
    oracleSeed: review.oracleSeed ?? review.seed,
    names: review.names,
    winner: review.winner,
    reason: review.reason,
    turns: review.turns,
    first: review.first,
    me,
    timeline: review.timeline.map((t) => [t.turn, Math.round(t.v)]),
    moves,
    forced: review.forced ?? [0, 0],
    ...(review.failed?.length ? { failed: review.failed.map((f): FailedMove => ({ seq: f.seq, p: f.player, at: f.at, turn: f.turn, cat: f.category, chosen: f.chosen, why: f.reason })) } : {}),
    ...(review.answers ? { answers: review.answers } : {}),
    ms: review.ms,
  };
}

// ---------------------------------------------------------------------------------------------------- rated again

/**
 * The stored review was measured the way a review is measured now (REVIEW_MEASURE, GAME_REVIEW_ROLLOUTS,
 * GAME_REVIEW_CONFIRM, GAME_REVIEW_HARD): only then may it be rated again from its kept measurements. A review stored
 * before these were kept (no `measure`) counts as measured now, so nothing changes for it: it has no measurements to
 * re-rate anyway. The bots that measured it are part of the measurement too: a review whose simulator version
 * (`simVersion`, absent: REVIEW_SIM_BEFORE_KEPT) is not the current one was measured with other bots, and is run again
 * (2026-11-25).
 */
export function measuredAsNow(rec: Pick<GameReviewRecord, 'measure' | 'rollouts' | 'confirm' | 'hard' | 'simVersion'>, now = CURRENT_SIM_VERSION): boolean {
  if ((rec.simVersion ?? REVIEW_SIM_BEFORE_KEPT) !== now) return false;
  if (rec.measure === undefined) return true;
  return rec.measure === REVIEW_MEASURE && rec.rollouts === GAME_REVIEW_ROLLOUTS && rec.confirm === GAME_REVIEW_CONFIRM && (rec.hard ?? 0) === GAME_REVIEW_HARD;
}

/** Why a stored review cannot be rated again from storage, and which moves (by seq). */
export type RerateRefusal = {
  ok: false;
  /**
   * not-kept: a move has no kept measurements (a review stored before they were kept, or one the reviewer did not
   * measure in full); unconfirmed: the current rules confirm a move on fresh worlds (or check it with Hard play-outs)
   * that was not so measured (a measurement is never made up); coach: a move rated by the coach's grade from play
   * (reviews stored before 2026-11-25), which the review no longer does
   */
  why: 'not-kept' | 'unconfirmed' | 'coach';
  moves: number[];
};

/**
 * A stored review rated under the current rules from the measurements kept with it (ReviewMove.ms), with no play-outs:
 * the same measurements judged by the new rules. Pure. For each oracle-graded move the current confirmFlag is applied to
 * its screening pass, as runGameReview would: a flagged move is rated from its confirmation, any other from its
 * screening pass (a move confirmed under older rules that the current ones would not flag goes back to its screening
 * figures). Then, as the Hard check does (ReviewOptions.hardCheck), in a seat whose Mistakes and Blunders so rated number
 * 1 to HARD_CHECK_MAX_FLAGS, each of them but a Gig choice is rated from its Hard check. The coach's grade kept beside a
 * move (`said`) stays as it is. An unrated move stays unrated.
 *
 * The result equals a review run afresh (same game, oracle seed and measurement) whenever the same moves are flagged for
 * confirmation (and the Hard check) as when it was measured: always under the rules it was made with, and under new
 * rules unless they flag other moves. Otherwise it can differ, even where every flagged move was confirmed: the reviewer
 * draws confirmation worlds from one sequential stream per seat (src/ai/reviewer.ts confirmRnd), so a fresh run that
 * flags another set of moves draws other worlds for the later confirmations. A move the current rules flag that was not
 * so measured has nothing to read, so the review cannot be rated again (`unconfirmed`): it is run again, as before.
 *
 * Under the same rules nothing changes. Under other rules the record gets REVIEW_RULES and `rerated` (the rules it was
 * first rated with). The kept measurements stay as they were, so it can be rated again after the next change too.
 */
export function rerateRecord(rec: GameReviewRecord): { ok: true; rec: GameReviewRecord } | RerateRefusal {
  const confirming = (rec.confirm ?? GAME_REVIEW_CONFIRM) > 0;
  const missing: number[] = [];
  const unconfirmed: number[] = [];
  const coachOff: number[] = [];
  // each move's pass after the confirmation rule (null: refused, with the move listed)
  const passes = rec.moves.map((m): OraclePass | null => {
    // a move rated by the coach's grade (a review stored before 2026-11-25): the review rates every move by the oracle now
    if (m.src === 'coach') return (coachOff.push(m.seq), null);
    if (m.r === 'unrated') return null;
    const first = m.ms ? passFrom(m.ms, m.cat, 'f') : null;
    if (!first) return (missing.push(m.seq), null);
    const flagged = confirming && !first.decided && !first.top && confirmFlag(first as DecisionReview);
    const used = flagged ? passFrom(m.ms!, m.cat, 'c') : first;
    if (!used) unconfirmed.push(m.seq);
    return used;
  });
  // the Hard check: in a seat with 1 to HARD_CHECK_MAX_FLAGS Mistakes or Blunders, each one but a Gig choice
  if ((rec.hard ?? 0) > 0)
    for (const p of [0, 1] as const) {
      const costly = rec.moves.map((_m, i) => i).filter((i) => rec.moves[i]!.p === p && passes[i] && hardFlag(passes[i] as DecisionReview));
      if (!costly.length || costly.length > HARD_CHECK_MAX_FLAGS) continue;
      for (const i of costly) {
        const m = rec.moves[i]!;
        if (m.cat === 'gig dice' || passes[i]!.decided) continue;
        const h = passFrom(m.ms!, m.cat, 'h');
        if (!h) unconfirmed.push(m.seq);
        passes[i] = h;
      }
    }
  const moves = rec.moves.map((m, i): ReviewMove => (passes[i] ? oracleMove(m, passes[i]!, m.ms) : m));
  // a decision the review could not measure has nothing to rate again: run the review again
  for (const f of rec.failed ?? []) missing.push(f.seq);
  if (missing.length) return { ok: false, why: 'not-kept', moves: missing };
  if (coachOff.length) return { ok: false, why: 'coach', moves: coachOff };
  if (unconfirmed.length) return { ok: false, why: 'unconfirmed', moves: unconfirmed };
  const was = rec.rules ?? 1;
  return { ok: true, rec: { ...rec, ...(was !== REVIEW_RULES ? { rules: REVIEW_RULES, rerated: rec.rerated ?? was } : {}), moves } };
}

// ---------------------------------------------------------------------------------------------------- the summary

/** A seat's numbers: accuracy (0–100, null when nothing counted), how many of each rating, and the counted moves. */
export interface SeatSummary {
  accuracy: number | null;
  /** average Gigs lost per counted move (0 inside the noise, capped at CAP_GIGS) */
  avgLoss: number;
  n: Record<Rating, number>;
  counted: number;
}

/** The Gigs a rated move counts as lost: 0 inside the noise (Inspired, Sharp, Best, Close call), else its gap, capped. */
export function lossOf(m: Pick<ReviewMove, 'r' | 'gap'>): number {
  if (!counts(m.r) || FINE.has(m.r)) return 0;
  return Math.min(CAP_GIGS, Math.max(0, m.gap ?? 0));
}

/** Accuracy from an average loss (Gigs): 100 × exp(−loss / ACCURACY_SCALE_GIGS), rounded. 0.1 → 90, 0.25 → 78, 0.5 → 61, 1 → 37. */
export const accuracyOf = (avgLoss: number) => Math.round(100 * Math.exp(-avgLoss / ACCURACY_SCALE_GIGS));

export function seatSummary(moves: readonly ReviewMove[], p: PlayerId, forced = 0): SeatSummary {
  const n = Object.fromEntries([...RATINGS, 'forced', 'unclear', 'unrated'].map((k) => [k, 0])) as Record<Rating, number>;
  const mine = moves.filter((m) => m.p === p);
  for (const m of mine) n[m.r]++;
  n.forced += forced;
  const counted = mine.filter((m) => counts(m.r));
  const avgLoss = counted.length ? counted.reduce((a, m) => a + lossOf(m), 0) / counted.length : 0;
  return { accuracy: counted.length ? accuracyOf(avgLoss) : null, avgLoss, n, counted: counted.length };
}

/** A move's gap before the cap (Gigs): what breaks a tie between two losses at the cap. */
const rawOf = (m: Pick<ReviewMove, 'gap' | 'raw'>) => m.raw ?? m.gap ?? 0;

/**
 * The turning point: the losing side's costliest move outside the noise (a Slip or worse), so it is where the loser's
 * game turned, never a mistake the winner got away with. Ties (two losses at the cap) go to the larger raw gap, then
 * to the earlier move. With no winner (a draw, an abandoned game, or `winner` not given) either side's costliest move
 * counts: the biggest error. Null when the losing side made no move outside the noise.
 */
export function turningPoint(moves: readonly ReviewMove[], winner?: PlayerId | 'tie' | null): ReviewMove | null {
  const loser = winner === 0 || winner === 1 ? ((1 - winner) as PlayerId) : null;
  let best: ReviewMove | null = null;
  for (const m of moves) {
    if (!counts(m.r) || FINE.has(m.r) || (loser !== null && m.p !== loser)) continue;
    if (!best || lossOf(m) > lossOf(best) || (lossOf(m) === lossOf(best) && rawOf(m) > rawOf(best))) best = m;
  }
  return best;
}

/** What the turning point is called: "Turning point" when the game had a winner, else "Biggest error". */
export const turningName = (winner: PlayerId | 'tie' | null | undefined) => (winner === 0 || winner === 1 ? 'Turning point' : 'Biggest error');

/** What you did after a rival Mistake or Blunder: on your next turn you made a Mistake or Blunder (missed), or nothing worse than a Close call (followed up). */
export type RivalFollow = 'missed' | 'followed';

/** Rival moves worth showing: a Mistake or Blunder, or an Inspired or Sharp move. */
export const rivalRelevant = (m: ReviewMove) => m.r === 'mistake' || m.r === 'blunder' || m.r === 'inspired' || m.r === 'sharp';

/**
 * For each rival Mistake or Blunder (by seq): what you did with it. Your answer is your counted moves after it in your
 * next turn (the rest of the same turn, when the rival erred with a reaction on your turn). Missed: one of them is a
 * Mistake or Blunder. Followed up: all of them are Close call or better. Neither when you only slipped, or had no
 * counted move.
 */
export function rivalFollowUps(moves: readonly ReviewMove[], me: PlayerId): Map<number, RivalFollow> {
  const out = new Map<number, RivalFollow>();
  const mine = moves.filter((m) => m.p === me && counts(m.r));
  for (const e of moves) {
    if (e.p === me || (e.r !== 'mistake' && e.r !== 'blunder')) continue;
    const after = mine.filter((m) => m.seq > e.seq);
    if (!after.length) continue;
    const turn = after[0]!.turn;
    const reply = after.filter((m) => m.turn === turn);
    if (reply.some((m) => m.r === 'mistake' || m.r === 'blunder')) out.set(e.seq, 'missed');
    else if (reply.every((m) => FINE.has(m.r))) out.set(e.seq, 'followed');
  }
  return out;
}

/** Key moments: the turning point, your Slips or worse and your Inspired / Sharp moves, and the rival's relevant moves. */
export function isKeyMoment(m: ReviewMove, me: PlayerId, turning: ReviewMove | null): boolean {
  if (turning && m.seq === turning.seq) return true;
  if (m.p !== me) return rivalRelevant(m);
  return m.r === 'inspired' || m.r === 'sharp' || m.r === 'mistake' || m.r === 'blunder';
}

/** The moves listed in the review: all of yours, the rival's relevant ones, and always the turning point. */
export const listed = (m: ReviewMove, me: PlayerId, turning?: ReviewMove | null) => m.p === me || rivalRelevant(m) || (!!turning && m.seq === turning.seq);

/** Your counts per rating, small enough for the practice log (the Profile's history shows them). */
export interface ReviewCounts {
  acc: number | null;
  /** counts in RATINGS order */
  n: number[];
}
export function reviewCounts(rec: GameReviewRecord): ReviewCounts {
  const s = seatSummary(rec.moves, rec.me);
  return { acc: s.accuracy, n: RATINGS.map((k) => s.n[k]) };
}

/** "1 Blunder, 2 Mistakes, 3 Slips": the costly counts in words, or "" when there are none. */
export function costlyText(n: readonly number[]): string {
  const parts: string[] = [];
  const word = (k: RatingKey, c: number) => (k === 'blunder' ? (c === 1 ? 'blunder' : 'blunders') : k === 'mistake' ? (c === 1 ? 'mistake' : 'mistakes') : c === 1 ? 'slip' : 'slips');
  for (const k of ['blunder', 'mistake', 'slip'] as const) {
    const c = n[RATINGS.indexOf(k)] ?? 0;
    if (c) parts.push(`${c} ${word(k, c)}`);
  }
  return parts.join(', ');
}

// The words for a rated move (explain, the turning point's figure) are in src/lib/reviewWords.ts, beside the coach's
// (src/lib/coachWords.ts), so no review text prints a gap past CAP_GIGS.
