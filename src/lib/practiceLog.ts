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
}
const KEY = 'nct.practice.v1';
const RESULTS = new Set(['win', 'loss', 'draw']);

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
export function clearPractice() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
