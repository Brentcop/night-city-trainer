// Per-browser practice history (localStorage). Never required for the app to work.
export interface PracticeGame {
  /** the practice replay's id; the same game recorded again (e.g. finished again after Undo) replaces its entry */
  id?: string;
  date: string;
  deck: string;
  opp: string;
  /** the bot tier, or 'pvp' for a game against another player online (src/net/) */
  level: string;
  /** an online game: the other player's name as they gave it (capped) */
  rival?: string;
  result: 'win' | 'loss' | 'draw';
  first: boolean;
  turns: number;
  reason: string;
  /** you conceded this game (always a 'loss') */
  conceded?: boolean;
  /** Gigs held at the end, [yours, the bot's] (games recorded before this was kept lack it) */
  gigs?: [number, number];
  /** the coach's end-of-game scorecard, when the coach was on and measured at least one move */
  coach?: CoachSummary;
  /** your counts per rating from the Game review, once it has been run (src/lib/gameReview.ts reviewCounts) */
  review?: ReviewSummary;
  /** a multi-day game (src/lib/multiDay.ts, src/net/corr.ts) */
  multiDay?: MultiDayMark;
  /** a game you played in a tournament (src/lib/playedEvent.ts): which event, match and game */
  tourney?: TourneyMark;
}

/**
 * A game you played in a tournament run in this browser (#/run, src/lib/playedEvent.ts): the run's id and name, the
 * round, the match (its decks in seat order) and the game's number in it. The event keeps the game's replay id too.
 */
export interface TourneyMark {
  /** the run's id (the runner's saved runs, nct.runs.v1) */
  event: string;
  /** the event's name when the game was played */
  name?: string;
  /** "Round 2", "Final" */
  round: string;
  /** the match's decks in seat order (one of them is yours) */
  a: string;
  b: string;
  /** 1 for the match's first game */
  game: number;
}

const short = (x: unknown, n: number) => (typeof x === 'string' ? x.slice(0, n) : null);
/** A stored tournament mark, or null when it is not one (its strings capped). */
export function toTourneyMark(x: unknown): TourneyMark | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  const event = short(o.event, 80);
  const round = short(o.round, 60);
  const a = short(o.a, 120);
  const b = short(o.b, 120);
  if (!event || round === null || a === null || b === null || typeof o.game !== 'number' || !Number.isInteger(o.game) || o.game < 1 || o.game > 9) return null;
  const name = short(o.name, 120);
  return { event, ...(name ? { name } : {}), round, a, b, game: o.game };
}

/** How a multi-day game was played: its length, and whether it was finished after its deadline or closed on time. */
export interface MultiDayMark {
  days: number;
  /** finished after the deadline had passed */
  late?: boolean;
  /** ended on time (a timed-out loss, or a win claimed on time) */
  timedOut?: boolean;
}

/** A stored multi-day mark, or null when it is not one. */
export function toMultiDay(x: unknown): MultiDayMark | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.days !== 'number' || !Number.isInteger(o.days) || o.days < 1 || o.days > 366) return null;
  return { days: o.days, ...(o.late === true ? { late: true } : {}), ...(o.timedOut === true ? { timedOut: true } : {}) };
}

/** The Game review in numbers: your accuracy (0–100, null when nothing counted) and counts in RATINGS order (seven). */
export interface ReviewSummary {
  acc: number | null;
  n: number[];
}

/**
 * The scorecard in numbers. Since 2026-11-25 (`v: 2`, REVIEW_2026-11-25 C1–C3): `measured` counts the decisions that
 * mattered (the coach measured the move and some option differed: `unclear` ones are left out), `fine` how many of them
 * were handled well (the coach's pick, as good, or a close call), `costly` the Slips or worse (every one confirmed on
 * fresh worlds), `unclear` the decisions with no clear difference, and the letter comes from SCORECARD_CUTS. An entry
 * without `v` was scored the old way (every measured move counted, unconfirmed six-world verdicts, letters at 85/70/55):
 * it is kept and shown as it was, marked as such, and never averaged with these (src/lib/profileStats.ts).
 */
export interface CoachSummary {
  v?: typeof COACH_SCORING;
  fine: number;
  measured: number;
  costly?: number;
  unclear?: number;
  grade: 'A' | 'B' | 'C' | 'D';
}

/** The scorecard's way of counting (CoachSummary.v); entries without it were scored before 2026-11-25. */
export const COACH_SCORING = 2;
/** A summary scored the current way (CoachSummary.v), so it may be averaged with others. */
export const scoredNow = (c: Pick<CoachSummary, 'v'> | null | undefined): boolean => c?.v === COACH_SCORING;

export const PRACTICE_KEY = 'nct.practice.v1';
const KEY = PRACTICE_KEY;
const RESULTS = new Set(['win', 'loss', 'draw']);
const GRADES = new Set(['A', 'B', 'C', 'D']);

/**
 * The letter's cut-offs on the share of decisions that mattered handled well (CoachSummary v2), set from bot players of
 * known strength against Medium (2026-11-25, SIM_VERSION 9: a player seat against Medium on the 7 meta decks, 60 games
 * each for a uniformly random player, Easy and Medium, 80 for Hard; docs/BOT_TOOLKIT.md §7): SCORECARD_TIERS are their
 * per-game averages, and each cut sits halfway between two tiers' averages, rounded, so a letter reads "handled the
 * decisions that mattered about as well as" a bot tier on average (A: Hard, B: Medium, C: Easy, D: a random player).
 * One game has 5 to 15 such decisions, so a single game's letter is rough (Hard's games: 67 A, 10 B, 3 C of 80; Medium's:
 * 25 A, 17 B, 15 C, 3 D of 60); the Profile's average over games is the steadier read. Under the old scorecard the same
 * random player averaged a B (77% "fine") and Hard 95%.
 */
export const SCORECARD_CUTS = { A: 84, B: 70, C: 46 } as const;
/** The averages the cut-offs come from (share handled well among the decisions that mattered, %, per game, per tier). */
export const SCORECARD_TIERS = { random: 30, easy: 63, medium: 77, hard: 90 } as const;

/** The letter for a share of decisions that mattered handled well (the end-of-game scorecard's bands, SCORECARD_CUTS). */
export const gradeFor = (pct: number): CoachSummary['grade'] => (pct >= SCORECARD_CUTS.A ? 'A' : pct >= SCORECARD_CUTS.B ? 'B' : pct >= SCORECARD_CUTS.C ? 'C' : 'D');

const FINE_V = new Set(['agree', 'best', 'close']);
const COSTLY_V = new Set(['inaccuracy', 'mistake']);

/**
 * The scorecard of a game's graded moves (v2): of the decisions that mattered (the coach measured the move and some option
 * differed), fine = the coach's pick, as good, or a close call; costly = a Slip or worse (confirmed on fresh worlds);
 * `unclear` = no clear difference, left out; anything else (choices the coach can't value, or a check that did not
 * finish) is not measured. Null when nothing was graded.
 */
export function coachSummary(grades: readonly { verdict: string }[]): (CoachSummary & { pct: number }) | null {
  if (!grades.length) return null;
  const measured = grades.filter((g) => FINE_V.has(g.verdict) || COSTLY_V.has(g.verdict));
  const fine = measured.filter((g) => FINE_V.has(g.verdict)).length;
  const pct = measured.length ? Math.round((100 * fine) / measured.length) : 100;
  const unclear = grades.filter((g) => g.verdict === 'unclear').length;
  return { v: COACH_SCORING, fine, measured: measured.length, costly: measured.length - fine, unclear, grade: gradeFor(pct), pct };
}

const count = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;
function toReview(x: unknown): ReviewSummary | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!(o.acc === null || (typeof o.acc === 'number' && o.acc >= 0 && o.acc <= 100))) return null;
  if (!Array.isArray(o.n) || o.n.length !== 7 || !o.n.every(count)) return null;
  return { acc: o.acc as number | null, n: [...(o.n as number[])] };
}
function toCoach(x: unknown): CoachSummary | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!count(o.fine) || !count(o.measured) || o.fine > o.measured || typeof o.grade !== 'string' || !GRADES.has(o.grade)) return null;
  const base = { fine: o.fine, measured: o.measured, grade: o.grade as CoachSummary['grade'] };
  // an entry scored the old way (no v, or a v this version does not know) reads as the old way: never averaged as new
  if (o.v !== COACH_SCORING) return base;
  return { v: COACH_SCORING, ...base, ...(count(o.costly) && o.costly <= o.measured ? { costly: o.costly } : {}), ...(count(o.unclear) ? { unclear: o.unclear } : {}) };
}

/** A stored entry is usable if it has a deck pair and a result; missing optional fields get defaults. */
function toEntry(x: unknown): PracticeGame | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (typeof o.deck !== 'string' || typeof o.opp !== 'string' || typeof o.result !== 'string' || !RESULTS.has(o.result)) return null;
  return {
    ...(typeof o.id === 'string' ? { id: o.id } : {}),
    date: typeof o.date === 'string' ? o.date : '',
    deck: o.deck,
    opp: o.opp,
    level: typeof o.level === 'string' ? o.level : '',
    ...(typeof o.rival === 'string' ? { rival: o.rival.slice(0, 30) } : {}),
    result: o.result as PracticeGame['result'],
    first: o.first === true,
    turns: typeof o.turns === 'number' ? o.turns : 0,
    reason: typeof o.reason === 'string' ? o.reason : '',
    ...(o.conceded === true ? { conceded: true } : {}),
    ...(Array.isArray(o.gigs) && o.gigs.length === 2 && o.gigs.every(count) ? { gigs: [o.gigs[0], o.gigs[1]] as [number, number] } : {}),
    ...(toCoach(o.coach) ? { coach: toCoach(o.coach)! } : {}),
    ...(toReview(o.review) ? { review: toReview(o.review)! } : {}),
    ...(toMultiDay(o.multiDay) ? { multiDay: toMultiDay(o.multiDay)! } : {}),
    ...(toTourneyMark(o.tourney) ? { tourney: toTourneyMark(o.tourney)! } : {}),
  };
}

/** Parse stored practice history, dropping anything that isn't a usable entry (never throws). */
export function parsePractice(raw: string | null): PracticeGame[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.map(toEntry).filter((x): x is PracticeGame => x !== null);
  } catch {
    return [];
  }
}

export function loadPractice(): PracticeGame[] {
  try {
    return parsePractice(localStorage.getItem(KEY));
  } catch {
    return [];
  }
}
/**
 * Add a finished game, or replace the entry with the same id (a game finished again after Undo counts once). False when
 * this browser refused to store it (storage full or blocked): callers that would otherwise lose the game check it.
 */
export function recordPractice(g: PracticeGame): boolean {
  try {
    const all = loadPractice().filter((x) => !g.id || x.id !== g.id);
    all.push(g);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-500)));
    return true;
  } catch {
    return false;
  }
}
/** Add the coach's scorecard to a recorded game (by its id). Does nothing when that game isn't in the log. */
export function annotatePractice(id: string, coach: CoachSummary) {
  try {
    const all = loadPractice();
    const at = all.findIndex((x) => x.id === id);
    if (at < 0) return;
    const extra = coach.v === COACH_SCORING ? { v: coach.v, ...(coach.costly !== undefined ? { costly: coach.costly } : {}), ...(coach.unclear !== undefined ? { unclear: coach.unclear } : {}) } : {};
    all[at] = { ...all[at]!, coach: { ...extra, fine: coach.fine, measured: coach.measured, grade: coach.grade } };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
/** Add the Game review's counts to a recorded game (by its id). Does nothing when that game isn't in the log. */
export function annotateReview(id: string, review: ReviewSummary) {
  try {
    const all = loadPractice();
    const at = all.findIndex((x) => x.id === id);
    if (at < 0) return;
    all[at] = { ...all[at]!, review: { acc: review.acc, n: [...review.n] } };
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}
export function clearPractice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
