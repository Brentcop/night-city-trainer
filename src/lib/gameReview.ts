// The Game review's ratings: one word for every decision of a finished game, on a seven-step scale, from what the
// match reviewer's oracle (src/ai/reviewer.ts) or the coach during play (src/ai/coach.ts gradeMove) measured. Pure: the
// review worker, the CLI (scripts/review.ts) and the review screen all rate through here, so they never disagree.
//
// Every number is in Gigs (one Gig = GIG evaluation points, GIG_SWING in src/ai/eval.ts) with the paired standard error
// of the measurement, so that noise is never called a mistake. docs/BOT_TOOLKIT.md §8 has the definitions in words.
import type { DecisionReview, GameReview, SeatAnswers, SkippedDecision } from '../ai/reviewer';
import type { PlayerId } from '../engine/types';

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
 * measured, Sharp needs every option clearly worse, passing at most Sharp (2026-11-13).
 */
export const REVIEW_RULES = 2;

/** The seven ratings, best first. */
export const RATINGS = ['inspired', 'sharp', 'best', 'close', 'slip', 'mistake', 'blunder'] as const;
export type RatingKey = (typeof RATINGS)[number];
/** A rating, or a decision that does not count: one option (forced), or no measurable difference between the options. */
export type Rating = RatingKey | 'forced' | 'unclear';

export interface RatingInfo {
  label: string;
  /** a text mark that reads without colour */
  mark: string;
  /** the colour class (never the only cue) */
  tone: 'top' | 'good' | 'fine' | 'warn' | 'bad' | 'none';
  /** one line for the legend */
  means: string;
}
export const RATING_INFO: Record<Rating, RatingInfo> = {
  inspired: { label: 'Inspired', mark: '◆◆', tone: 'top', means: 'A Sharp move that a quick read ranks third or lower, where its first choice would have been a blunder: hard to find. Never for ending the turn.' },
  sharp: { label: 'Sharp', mark: '◆', tone: 'top', means: 'The only good move (every other option measured is clearly worse by a mistake or more), and not the one a quick read picks first.' },
  best: { label: 'Best', mark: '●', tone: 'good', means: 'The best move found, or within 0.1 Gigs of it.' },
  close: { label: 'Close call', mark: '○', tone: 'fine', means: 'Behind the best move found, but too little or too uncertain to call: under 0.15 Gigs, or within 2 standard errors.' },
  slip: { label: 'Slip', mark: '▽', tone: 'warn', means: 'Clearly behind the best move, by less than 0.375 Gigs.' },
  mistake: { label: 'Mistake', mark: '▼', tone: 'bad', means: 'Clearly behind the best move by 0.375 Gigs or more.' },
  blunder: { label: 'Blunder', mark: '▼▼', tone: 'bad', means: 'Clearly behind by a whole Gig or more, or a mistake that also loses the game in at least 1 in 4 more of the play-outs.' },
  forced: { label: 'Forced', mark: '–', tone: 'none', means: 'Only one option. Not counted.' },
  unclear: { label: 'No clear difference', mark: '=', tone: 'none', means: 'Every option measured comes out about the same, or the game was already decided. Not counted.' },
};

/** A rating's place on the scale (0 = Inspired … 6 = Blunder); No clear difference sits between Best and Close call. */
export function ratingStep(r: Rating): number | null {
  if (r === 'forced') return null;
  if (r === 'unclear') return 2.5;
  return RATINGS.indexOf(r);
}

/** Ratings that count toward accuracy. */
export const counts = (r: Rating): r is RatingKey => r !== 'forced' && r !== 'unclear';
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

/** A clear gap of at least `line` Gigs (outside the noise). */
const clearOf = (gap: number, se: number | null | undefined, line: number) => gap >= line && !withinNoise(gap, se);

/** Every graded option, the move made included, is within the noise of the best: the decision made no measurable difference. */
function noDifference(m: Measured): boolean {
  if (!m.others?.length) return false;
  return withinNoise(m.raw ?? m.gap, m.se) && m.others.every(([g, se]) => withinNoise(Math.max(0, g), se));
}

/**
 * Sharp and Inspired, for a move that is the best (`top`). Both need the quick 1-ply read (the reviewer's screen) to
 * have preferred another move, so an obvious move (the one any quick read finds) is never more than Best; decisions with
 * no screen (reactions, sells chosen by rule) are never more than Best either.
 *   Sharp     the only good move: every other option measured is clearly worse by a mistake-sized gap (each one
 *             outside its own noise), and the quick read's first choice was another move
 *   Inspired  Sharp, the quick read ranked the move third or lower (or left it off its shortlist), and its first choice
 *             would have been a blunder (clearly a whole Gig worse)
 * Ending the turn is never more than Sharp: holding back when every play is clearly worse is a real find (the quick read
 * acts whenever any play scores above passing), but the quick read never ranks passing at all, so its place there says
 * nothing about how hard it was to see.
 */
function upgrade(m: Measured): RatingKey | null {
  if (!m.top || !m.screen || m.screen.chosenRank === 0) return null;
  if (!m.others?.length || !m.others.every(([g, se]) => clearOf(g, se, MISTAKE_GIGS))) return null;
  const hidden = m.screen.chosenRank === -1 || m.screen.chosenRank >= 2;
  return hidden && !m.pass && clearOf(m.screen.gap, m.screen.se, BLUNDER_GIGS) ? 'inspired' : 'sharp';
}

/** The rating from the size of a gap (no upgrade, no "no clear difference"); the noise test reads the raw gap. */
function band(m: Measured): RatingKey {
  if (m.gap <= BEST_GIGS) return 'best';
  if (withinNoise(m.raw ?? m.gap, m.se)) return 'close';
  if (m.gap >= BLUNDER_GIGS || (m.gap >= MISTAKE_GIGS && m.gameLosing)) return 'blunder';
  return m.gap >= MISTAKE_GIGS ? 'mistake' : 'slip';
}

/**
 * The rating of one measured decision:
 *   No clear difference  the game was already decided, or every option measured is within the noise of the best
 *   Inspired / Sharp     see upgrade(); otherwise
 *   Best                 within BEST_GIGS (0.1) of the best
 *   Close call           within the noise: under CLOSE_GIGS (0.15), or within 2 paired SE
 *   Slip                 outside the noise, under MISTAKE_GIGS (0.375)
 *   Mistake              outside the noise, MISTAKE_GIGS to BLUNDER_GIGS (1)
 *   Blunder              outside the noise and BLUNDER_GIGS or more, or a mistake that loses the game in the play-outs
 */
export function rateMeasured(m: Measured): Rating {
  if (m.decided || noDifference(m)) return 'unclear';
  const b = band(m);
  return b === 'best' ? (upgrade(m) ?? 'best') : b;
}

const gigs = (pts: number) => pts / GIG;

/** What the oracle measured about a decision (src/ai/reviewer.ts DecisionReview), in Gigs. */
export function oracleMeasured(d: DecisionReview): Measured {
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
 * The rating of a move the coach graded during play. It keeps the coach's verdict in the names the coach shows it in
 * during play (src/lib/coachWords.ts verdictRating: agree / as good → Best, close call, inaccuracy → Slip, mistake →
 * Mistake, or Blunder from a whole Gig), so the review never grades a move differently from the game; on top, the same
 * "no clear difference" check over the options the coach scored (a move where every option was within the noise is not
 * counted), and for the coach's own pick the same Inspired / Sharp checks, with the quick screen's first choice from the
 * review pass.
 */
export function rateCoach(c: CoachRating, screen?: { screenTop?: number; chosenRank?: number }): Rating {
  const vsMine = c.alts.filter(([i]) => i !== c.chose);
  const all: [number, number | null][] = [...vsMine.map(([, g, se]): [number, number | null] => [g, se]), ...(c.chose !== c.coach ? [[c.gap, c.se ?? null] as [number, number | null]] : [])];
  if (all.length && all.every(([g, se]) => withinNoise(Math.max(0, g), se))) return 'unclear';
  switch (c.verdict) {
    case 'close':
      return 'close';
    case 'inaccuracy':
      return 'slip';
    case 'mistake':
      return c.gap >= BLUNDER_GIGS ? 'blunder' : 'mistake';
    case 'best':
      return 'best';
    case 'agree': {
      // the coach's own pick: compare with every other option it scored (in its worlds, paired with the pick)
      const top = vsMine.every(([, g]) => g >= 0);
      const others = [...vsMine].sort((a, b) => a[1] - b[1]).map(([, g, se]) => [g, se] as const);
      const sc = screen?.screenTop !== undefined && screen.screenTop !== c.chose ? vsMine.find(([i]) => i === screen.screenTop) : undefined;
      const pass = c.chosen === 'Pass turn' || c.chosen === 'End turn';
      const m: Measured = { gap: 0, top, others, ...(pass ? { pass } : {}), ...(sc ? { screen: { gap: sc[1], se: sc[2], chosenRank: screen?.chosenRank ?? -1 } } : {}) };
      return upgrade(m) ?? 'best';
    }
  }
}

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
  /** who measured it: the coach during play, or the review's oracle afterwards */
  src: 'coach' | 'oracle';
  /** the coach's reason (coach grades only) */
  why?: string;
  /** the move made loses the game in clearly more play-outs than the best */
  lost?: true;
}

export const REVIEW_KIND = 'nct-game-review';
export const REVIEW_SCHEMA = 1;

export interface GameReviewRecord {
  kind: typeof REVIEW_KIND;
  schema: typeof REVIEW_SCHEMA;
  /** the rating rules it was made with (REVIEW_RULES; absent: before rules were versioned, i.e. 1) */
  rules?: number;
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
  /** every answer of both seats: the board at each move is rebuilt from these with no bot thinking */
  answers?: [SeatAnswers, SeatAnswers];
  ms: number;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * The stored review of a game: the oracle's grades of both seats, merged with the coach's grades from play for the
 * moves the coach measured (`coach`; the review skipped those, GameReview.skipped carries what the screen made of them).
 */
export function buildReviewRecord(review: GameReview, coach: readonly CoachRating[], meta: { id: string; made: string; me?: PlayerId }, keep?: readonly ReviewMove[]): GameReviewRecord {
  const me = meta.me ?? 0;
  const moves: ReviewMove[] = [];
  for (const d of review.decisions) {
    const r = rateOracle(d);
    const gap = r2(gigs(d.regret));
    const raw = d.raw !== undefined ? r2(gigs(d.raw)) : gap;
    moves.push({
      seq: d.seq ?? moves.length,
      p: d.player,
      at: d.at ?? -1,
      turn: d.turn,
      cat: d.category,
      chosen: d.chosen,
      ...(d.best !== d.chosen ? { best: d.best } : {}),
      r,
      gap,
      ...(raw !== gap ? { raw } : {}),
      ...(d.se !== undefined ? { se: r2(gigs(d.se)) } : {}),
      src: 'oracle',
      ...(d.gameLosing ? { lost: true as const } : {}),
    });
  }
  const byAt = new Map(coach.map((c) => [c.at, c]));
  const kept = new Map((keep ?? []).filter((m) => m.p === me && m.src === 'coach').map((m) => [m.at, m]));
  for (const s of review.skipped ?? []) {
    const c = s.player === me ? byAt.get(s.at) : undefined;
    const k = s.player === me && !c ? kept.get(s.at) : undefined;
    // a coach grade from an earlier review whose coach record is gone: kept as it was rated
    if (k) moves.push({ ...k, seq: s.seq, turn: s.turn });
    if (!c) continue;
    moves.push({
      seq: s.seq,
      p: s.player,
      at: s.at,
      turn: s.turn,
      cat: 'coach',
      chosen: c.chosen,
      ...(c.best !== c.chosen ? { best: c.best } : {}),
      r: rateCoach(c, s),
      gap: r2(Math.max(0, c.gap)),
      ...(c.se !== undefined ? { se: r2(c.se) } : {}),
      src: 'coach',
      why: c.why,
    });
  }
  moves.sort((a, b) => a.seq - b.seq);
  return {
    kind: REVIEW_KIND,
    schema: REVIEW_SCHEMA,
    rules: REVIEW_RULES,
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
    ...(review.answers ? { answers: review.answers } : {}),
    ms: review.ms,
  };
}

/** Which already-graded decisions the review skips: your moves the coach measured during play. */
export const coachSkip = (coach: readonly CoachRating[], me: PlayerId = 0) => {
  const at = new Set(coach.map((c) => c.at));
  return (seat: PlayerId, a: number) => seat === me && at.has(a);
};

/** Skipped decisions keep the SkippedDecision shape (re-exported for callers that only import this module). */
export type { SkippedDecision };

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
  const n = Object.fromEntries([...RATINGS, 'forced', 'unclear'].map((k) => [k, 0])) as Record<Rating, number>;
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
