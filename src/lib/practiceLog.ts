// Per-browser practice history (localStorage). Never required for the app to work.
export interface PracticeGame {
  /** the practice replay's id; the same game recorded again (e.g. finished again after Undo) replaces its entry */
  id?: string;
  date: string;
  deck: string;
  opp: string;
  level: string;
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
}

/** The scorecard in numbers: moves the coach measured, how many were fine, and the letter grade. */
export interface CoachSummary {
  fine: number;
  measured: number;
  grade: 'A' | 'B' | 'C' | 'D';
}

export const PRACTICE_KEY = 'nct.practice.v1';
const KEY = PRACTICE_KEY;
const RESULTS = new Set(['win', 'loss', 'draw']);
const GRADES = new Set(['A', 'B', 'C', 'D']);

/** The letter for a share of fine moves (the end-of-game scorecard's bands). */
export const gradeFor = (pct: number): CoachSummary['grade'] => (pct >= 85 ? 'A' : pct >= 70 ? 'B' : pct >= 55 ? 'C' : 'D');

/**
 * The scorecard of a game's graded moves: fine = the coach's pick, as good, or a close call; costly = an inaccuracy or a
 * mistake; anything else (choices the coach can't value) is not measured. Null when nothing was graded.
 */
export function coachSummary(grades: readonly { verdict: string }[]): (CoachSummary & { pct: number }) | null {
  if (!grades.length) return null;
  const fineV = new Set(['agree', 'best', 'close']);
  const costlyV = new Set(['inaccuracy', 'mistake']);
  const measured = grades.filter((g) => fineV.has(g.verdict) || costlyV.has(g.verdict));
  const fine = measured.filter((g) => fineV.has(g.verdict)).length;
  const pct = measured.length ? Math.round((100 * fine) / measured.length) : 100;
  return { fine, measured: measured.length, grade: gradeFor(pct), pct };
}

const count = (x: unknown): x is number => typeof x === 'number' && Number.isInteger(x) && x >= 0;
function toCoach(x: unknown): CoachSummary | null {
  if (!x || typeof x !== 'object') return null;
  const o = x as Record<string, unknown>;
  if (!count(o.fine) || !count(o.measured) || o.fine > o.measured || typeof o.grade !== 'string' || !GRADES.has(o.grade)) return null;
  return { fine: o.fine, measured: o.measured, grade: o.grade as CoachSummary['grade'] };
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
    result: o.result as PracticeGame['result'],
    first: o.first === true,
    turns: typeof o.turns === 'number' ? o.turns : 0,
    reason: typeof o.reason === 'string' ? o.reason : '',
    ...(o.conceded === true ? { conceded: true } : {}),
    ...(Array.isArray(o.gigs) && o.gigs.length === 2 && o.gigs.every(count) ? { gigs: [o.gigs[0], o.gigs[1]] as [number, number] } : {}),
    ...(toCoach(o.coach) ? { coach: toCoach(o.coach)! } : {}),
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
/** Add a finished game, or replace the entry with the same id (a game finished again after Undo counts once). */
export function recordPractice(g: PracticeGame) {
  try {
    const all = loadPractice().filter((x) => !g.id || x.id !== g.id);
    all.push(g);
    localStorage.setItem(KEY, JSON.stringify(all.slice(-500)));
  } catch {
    /* ignore */
  }
}
/** Add the coach's scorecard to a recorded game (by its id). Does nothing when that game isn't in the log. */
export function annotatePractice(id: string, coach: CoachSummary) {
  try {
    const all = loadPractice();
    const at = all.findIndex((x) => x.id === id);
    if (at < 0) return;
    all[at] = { ...all[at]!, coach: { fine: coach.fine, measured: coach.measured, grade: coach.grade } };
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
