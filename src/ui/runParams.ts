// Input checks for the tournament pages: setup-link params (#/run?f=…&r=…), event files opened from disk,
// runs stored in localStorage, and the ?e= event id. Anything malformed falls back instead of crashing a page.
import { isEventFormat, type EventFormat, type TourneyEvent } from '../lib/tournament';

const RUN_FIELDS = ['meta', 'ladder', 'top16', 'original', 'guide', 'all', 'custom'] as const;
export type RunField = (typeof RUN_FIELDS)[number];

export interface RunParams {
  field: RunField;
  /** null = no explicit deck list in the link */
  decks: string[] | null;
  rounds: number | 'auto';
  top: number;
  bestOf: 1 | 3 | 5;
  /** the event format (default swiss) */
  format: EventFormat;
  /** null = not given or not one of `bots` */
  bot: string | null;
  /** null = not given (pick a random seed) */
  seed: number | null;
}

const int = (s: string | null, min: number, max: number): number | null => {
  if (s === null || !/^\s*\d+\s*$/.test(s)) return null;
  const n = Number(s);
  return n >= min && n <= max ? n : null;
};

/** Parse the setup link. `bots` lists the valid bot keys. */
export function parseRunParams(q: URLSearchParams, bots: readonly string[]): RunParams {
  const f = q.get('f');
  const field: RunField = (RUN_FIELDS as readonly string[]).includes(f ?? '') ? (f as RunField) : 'meta';
  const d = q.get('d');
  const decks = d ? d.split(',').map((x) => x.trim()).filter(Boolean) : null;
  const top = int(q.get('t'), 0, 16);
  const bot = q.get('bot');
  return {
    field,
    decks: decks && decks.length ? decks : null,
    rounds: int(q.get('r'), 1, 12) ?? 'auto',
    top: top !== null && [0, 4, 8, 16].includes(top) ? top : 8,
    bestOf: q.get('bo') === '1' ? 1 : q.get('bo') === '5' ? 5 : 3,
    format: isEventFormat(q.get('fmt') ?? '') ? (q.get('fmt') as EventFormat) : 'swiss',
    bot: bot && bots.includes(bot) ? bot : null,
    seed: int(q.get('s'), 1, 2 ** 31 - 1),
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const isMatch = (m: unknown) =>
  isObj(m) && typeof m.a === 'string' && (m.b === null || typeof m.b === 'string') && Array.isArray(m.games) && Array.isArray(m.score) && typeof m.winner === 'string';
const isRounds = (x: unknown, key: 'round' | 'name') => Array.isArray(x) && x.every((r) => isObj(r) && (key === 'round' ? typeof r.round === 'number' : typeof r.name === 'string') && Array.isArray(r.matches) && r.matches.every(isMatch));

/** Enough of a TourneyEvent for the runner page to render it (rounds, bracket, standings, decks). */
export function isEvent(x: unknown): x is TourneyEvent {
  if (!isObj(x)) return false;
  return (
    (typeof x.id === 'number' || typeof x.id === 'string') &&
    isObj(x.decks) &&
    isRounds(x.rounds, 'round') &&
    isRounds(x.bracket, 'name') &&
    Array.isArray(x.standings) &&
    x.standings.every((s) => isObj(s) && typeof s.deck === 'string') &&
    (x.champion === null || x.champion === undefined || typeof x.champion === 'string')
  );
}

/** An event read from a file: older or hand-made files may lack `bracket` (Swiss only) — that is filled in. */
export function toEvent(x: unknown): TourneyEvent | null {
  if (isObj(x) && x.bracket === undefined) x = { ...x, bracket: [] };
  return isEvent(x) ? x : null;
}

/** Stored runs: keep only entries that look like events. */
export function parseRuns(raw: string | null): TourneyEvent[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter(isEvent) : [];
  } catch {
    return [];
  }
}

/** ?e= on the events page: a recorded event id, or undefined when missing or unknown. */
export function parseEventId(s: string | undefined | null, ids: number[]): number | undefined {
  const n = int(s ?? null, 0, Number.MAX_SAFE_INTEGER);
  return n !== null && ids.includes(n) ? n : undefined;
}
