// The small part of a deck's record that deck tiles and pickers need (the Home page's entry chunk includes it), and
// the simulator-version checks. The full summary for the deck profile is src/lib/deckRecord.ts.

/**
 * Mirror of SIM_VERSION in src/lib/tournament.ts (tests/deck-record.test.ts checks they match). Kept here because
 * importing tournament.ts would pull the bots and the engine into every page that only wants to label old data.
 */
export const CURRENT_SIM_VERSION = 8;

/** Below this many games a number is shown as a small sample (the `.num.thin` convention in Num.tsx). */
export const SMALL_SAMPLE = 20;

export interface RatingRow {
  name: string;
  file: string;
  rating: number;
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
  wrMeta: number | null;
  events: number;
  titles: number;
  top8: number;
  avgFinish: number | null;
  matches: string;
  gamesRecord?: string;
}

export interface RatingsFile {
  decks: RatingRow[];
  /** absent in files built before manifests; for an aggregate, the lowest input version (0 if any input has none) */
  manifest?: { simVersion?: number };
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** "329-156" → [329, 156]; anything else → null. */
export function parseWL(s: string | undefined): [number, number] | null {
  const [, w, l] = s?.match(/^(\d+)-(\d+)$/) ?? [];
  return w !== undefined && l !== undefined ? [+w, +l] : null;
}

/** True when a version is missing or older than the current simulator. */
export const isHistorical = (v: number | null | undefined, current = CURRENT_SIM_VERSION) => !ok(v) || v < current;

/** Tournament ratings are historical when their manifest (or, without one, any recorded event) predates the current simulator. */
export function ratingsHistorical(r: RatingsFile | undefined, events?: { simVersion?: number }[], current = CURRENT_SIM_VERSION): boolean {
  if (r?.manifest && ok(r.manifest.simVersion)) return isHistorical(r.manifest.simVersion, current);
  if (events?.length) return events.some((e) => isHistorical(e.simVersion, current));
  return true;
}

/** The one-line tournament summary for a deck tile or picker: Swiss game win rate and its sample. */
export function tileRecord(row: RatingRow | undefined): { wr: number; n: number; games: number; titles: number; top8: number; events: number } | null {
  if (!row || !(row.games > 0)) return null;
  const wl = parseWL(row.gamesRecord);
  if (!wl || wl[0] + wl[1] === 0) return null;
  return { wr: wl[0] / (wl[0] + wl[1]), n: wl[0] + wl[1], games: row.games, titles: row.titles, top8: row.top8, events: row.events };
}
