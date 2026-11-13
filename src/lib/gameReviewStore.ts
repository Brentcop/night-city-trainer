// Stored Game reviews (src/lib/gameReview.ts), per browser, beside the practice replays they review: the finished
// review, so reopening it is instant, and before that the coach's grades from play (kept at game over, so a review run
// later from the Profile rates your moves exactly as the coach did; kept with the review too, so a review made under
// older rating rules can be re-rated). Keyed by the replay's id, newest last, capped like the replays. Versioned
// (`nct.gameReviews.v1`, records carry `schema`, and `rules`: a review made under other rating rules than REVIEW_RULES is
// handed back as `stale`, to be run again); an unreadable entry is dropped, never thrown.
import { REVIEW_KIND, REVIEW_RULES, REVIEW_SCHEMA, RATINGS, type CoachRating, type GameReviewRecord, type Rating } from './gameReview';

export const GAME_REVIEWS_KEY = 'nct.gameReviews.v1';
const MAX = 25;

export interface StoredReviewEntry {
  id: string;
  /** your moves the coach graded during play */
  coach?: CoachRating[];
  review?: GameReviewRecord;
}

const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const RATING_SET = new Set<string>([...RATINGS, 'forced', 'unclear']);
const VERDICTS = new Set(['agree', 'best', 'close', 'inaccuracy', 'mistake']);

function isCoachRating(x: unknown): x is CoachRating {
  const c = x as CoachRating | null;
  return (
    !!c &&
    typeof c === 'object' &&
    isNum(c.at) &&
    isNum(c.turn) &&
    isNum(c.chose) &&
    isNum(c.coach) &&
    typeof c.chosen === 'string' &&
    typeof c.best === 'string' &&
    typeof c.why === 'string' &&
    VERDICTS.has(c.verdict) &&
    isNum(c.gap) &&
    (c.se === undefined || isNum(c.se)) &&
    Array.isArray(c.alts) &&
    c.alts.every((a) => Array.isArray(a) && isNum(a[0]) && isNum(a[1]) && (a[2] === null || isNum(a[2])))
  );
}

function isMove(x: unknown): boolean {
  const m = x as Record<string, unknown> | null;
  return (
    !!m &&
    typeof m === 'object' &&
    isNum(m.seq) &&
    (m.p === 0 || m.p === 1) &&
    isNum(m.at) &&
    isNum(m.turn) &&
    typeof m.cat === 'string' &&
    typeof m.chosen === 'string' &&
    (m.best === undefined || typeof m.best === 'string') &&
    RATING_SET.has(m.r as Rating) &&
    (m.gap === null || isNum(m.gap)) &&
    (m.raw === undefined || isNum(m.raw)) &&
    (m.se === undefined || isNum(m.se)) &&
    (m.src === 'coach' || m.src === 'oracle') &&
    (m.why === undefined || typeof m.why === 'string')
  );
}

const isAnswers = (x: unknown) => {
  const a = x as { choices?: unknown; pay?: unknown; order?: unknown; endTurn?: unknown } | null;
  return !!a && Array.isArray(a.choices) && a.choices.every((c) => Array.isArray(c) && c.every(isNum)) && typeof a.pay === 'boolean' && typeof a.order === 'boolean' && (a.endTurn === undefined || typeof a.endTurn === 'boolean');
};

/** A stored review read back, or null when it is not one this version reads (another kind, a newer schema, incomplete). */
export function asReviewRecord(x: unknown): GameReviewRecord | null {
  const r = x as GameReviewRecord | null;
  if (!r || typeof r !== 'object' || r.kind !== REVIEW_KIND || r.schema !== REVIEW_SCHEMA) return null;
  const ok =
    (r.rules === undefined || isNum(r.rules)) &&
    typeof r.id === 'string' &&
    typeof r.made === 'string' &&
    isNum(r.rollouts) &&
    isNum(r.oracleSeed) &&
    Array.isArray(r.names) &&
    r.names.length === 2 &&
    r.names.every((n) => typeof n === 'string') &&
    (r.winner === null || r.winner === 'tie' || r.winner === 0 || r.winner === 1) &&
    typeof r.reason === 'string' &&
    isNum(r.turns) &&
    (r.first === 0 || r.first === 1) &&
    (r.me === 0 || r.me === 1) &&
    Array.isArray(r.timeline) &&
    r.timeline.every((t) => Array.isArray(t) && t.length === 2 && isNum(t[0]) && isNum(t[1])) &&
    Array.isArray(r.moves) &&
    r.moves.every(isMove) &&
    Array.isArray(r.forced) &&
    r.forced.length === 2 &&
    r.forced.every(isNum) &&
    (r.answers === undefined || (Array.isArray(r.answers) && r.answers.length === 2 && r.answers.every(isAnswers))) &&
    isNum(r.ms);
  return ok ? r : null;
}

/** Parse the stored list, keeping the readable parts of each entry (never throws). */
export function parseGameReviews(raw: string | null): StoredReviewEntry[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    const out: StoredReviewEntry[] = [];
    for (const x of v) {
      const e = x as { id?: unknown; coach?: unknown; review?: unknown } | null;
      if (!e || typeof e !== 'object' || typeof e.id !== 'string') continue;
      const coach = Array.isArray(e.coach) && e.coach.every(isCoachRating) ? (e.coach as CoachRating[]) : undefined;
      const review = asReviewRecord(e.review) ?? undefined;
      if (!coach && !review) continue;
      out.push({ id: e.id, ...(coach ? { coach } : {}), ...(review ? { review } : {}) });
    }
    return out;
  } catch {
    return [];
  }
}

function loadAll(): StoredReviewEntry[] {
  try {
    return parseGameReviews(localStorage.getItem(GAME_REVIEWS_KEY));
  } catch {
    return [];
  }
}

function update(id: string, f: (e: StoredReviewEntry) => StoredReviewEntry) {
  try {
    const all = loadAll();
    const at = all.findIndex((e) => e.id === id);
    const next = f(at >= 0 ? all[at]! : { id });
    if (at >= 0) all.splice(at, 1);
    all.push(next);
    localStorage.setItem(GAME_REVIEWS_KEY, JSON.stringify(all.slice(-MAX)));
  } catch {
    /* storage full or blocked: the review still shows, it is just not kept */
  }
}

/**
 * A stored review still describes the game when your recorded answers are the ones it replayed (a game finished again
 * after Undo keeps its id but not its answers). A review with no answers kept cannot be checked and is not trusted.
 */
export function reviewMatches(rec: GameReviewRecord, choices: readonly (readonly number[])[]): boolean {
  const mine = rec.answers?.[rec.me]?.choices;
  return !!mine && mine.length === choices.length && mine.every((c, i) => c.length === choices[i]!.length && c.every((x, k) => x === choices[i]![k]));
}

/** The review was made under the current rating rules (an older one shows old ratings: run it again). */
export const currentRules = (rec: GameReviewRecord) => (rec.rules ?? 1) === REVIEW_RULES;

/**
 * The stored entry of a game, if any; a review of other answers than `choices` (the game was replayed after Undo) is left
 * out. A review of the same answers made under other rating rules comes back as `stale`, not `review`: run the review
 * again (its coach-graded moves can be kept from it when the coach's grades are no longer stored).
 */
export function loadGameReview(id: string, choices?: readonly (readonly number[])[]): (StoredReviewEntry & { stale?: GameReviewRecord }) | null {
  const e = loadAll().find((x) => x.id === id) ?? null;
  if (!e || !e.review) return e;
  const { review, ...rest } = e;
  if (choices && !reviewMatches(review, choices)) return rest.coach ? rest : null;
  return currentRules(review) ? e : { ...rest, stale: review };
}

/** Keep the coach's grades of a finished game. A finished review of the same answers is kept; one of other answers is dropped. */
export function saveCoachRatings(id: string, coach: CoachRating[], choices: readonly (readonly number[])[]) {
  update(id, (e) => (e.review && reviewMatches(e.review, choices) ? e : { id, ...(coach.length ? { coach } : {}) }));
}

/** Keep a finished review, with the coach's grades it was built from (a later rules change re-rates it from them). */
export function saveGameReview(rec: GameReviewRecord, coach?: readonly CoachRating[]) {
  update(rec.id, (e) => {
    const keep = coach?.length ? [...coach] : e.coach;
    return { id: rec.id, ...(keep?.length ? { coach: keep } : {}), review: rec };
  });
}

export function clearGameReviews() {
  try {
    localStorage.removeItem(GAME_REVIEWS_KEY);
  } catch {
    /* ignore */
  }
}
