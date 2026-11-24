// Parent strength for the breeders (docs/TUNING_STUDY_2026-11-13.md P7; docs/SYNERGIES.md "A bred deck's test against
// its parent"): one rule for the season breeder (scripts/breed-data.ts strengthOf, scripts/season.ts,
// scripts/breed-preview.ts) and the Deck Lab's (src/lib/deckLab.ts rankedParents).
//
// Since 2026-11-24 (docs/REVIEW_2026-11-24.md B.5, findings L4 and R8):
// - A deck's strength is its power rating's point estimate (src/data/ratings.json `wrField`, the expected win rate
//   against the library; the fit's posterior mode under its Gaussian prior, which is the posterior mean to the normal
//   approximation the ranges use), not the conservative lower half of its range. The lower bound ranked a deck on 60
//   games 3 to 6 points below an equal deck on 400, and among ranks 2 to 10 the order it gave was largely a coin flip.
// - A deck needs PARENT_MIN_GAMES (100) games on its current list to be a parent. Below that it is left out (and the
//   season prints which). Why not a lineage prior for a forged list: since 2026-11-24 a season records its round robin as
//   a rating run (scripts/season-run.ts), so a newly bred and forged list has 240 or more games on its own list as soon
//   as the ratings are rebuilt, and the rating series plays every unrated list first (arrivals); a list stays under 100
//   games only between an edit and the next series run. A prior from the parent list would carry over a rating the
//   forge's change was measured against with Medium (Hard shows about 0.75 of a Medium gain), so it would mix two
//   kinds of evidence in one number for a short window. Leaving the deck out for that window is plainer.
// - The season leaderboard is no longer blended in (it was 35% for rows of the current simulator): its figure is a win
//   rate against the 7 meta decks shrunk toward 50%, another field than the ratings' library, and the blend moved
//   Ladder: V / Smasher / Padre from 2nd to 5th parent. `staleLeaderRow` stays for the Seasons page and the deck page.
//
// Plain data in, plain data out: no file reads, so Node and the browser call the same functions. Light on purpose (it
// imports only playedRecord.ts for the current simulator version), so the Seasons page (src/ui/pages/Seasons.tsx, through
// src/lib/bredDecks.ts) uses `staleLeaderRow`, `rankLibraryParents` and `bestParent` without the gate's statistics.
// `rankLibraryParents` is the Deck Lab's ranking (deckLab.ts rankedParents hands its bundled ratings to it); `bestParent` is
// the first choice of the gate's reference (breedGate.ts chooseReference).
import type { DeckList } from '../engine/types';
import { CURRENT_SIM_VERSION } from './playedRecord';

/** A parent has at least this many games on its current list in the ratings (else it is no parent candidate). */
export const PARENT_MIN_GAMES = 100;

/** What parent strength reads of a ratings row (src/data/ratings.json decks[]). */
export interface RatedDeck {
  name: string;
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
}

/** A recorded season as staleness reads it (data/seasons/season-N.json, or src/data/seasons.json seasons[]). */
export interface SeasonVersionInput {
  season: number;
  manifest?: { simVersion?: unknown } | null;
}

/** Each recorded season's simulator version (null: recorded without one). */
export function seasonVersions(seasons: readonly SeasonVersionInput[]): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const s of seasons) {
    const v = s.manifest?.simVersion;
    out[String(s.season)] = typeof v === 'number' && Number.isFinite(v) ? v : null;
  }
  return out;
}

/**
 * Whether a leaderboard row is stale: some season that added to it (a key of `row.seasons`: its round robins, and the
 * season whose finals it played, which is one of them) did not run under `current`. Season 0 (the seed data) and a
 * season with no recorded version are old; a row with no season at all is stale too (nothing says when it was played).
 */
export function staleLeaderRow(row: { seasons?: Readonly<Record<string, unknown>> | null }, versions: Readonly<Record<string, number | null>>, current: number = CURRENT_SIM_VERSION): boolean {
  const keys = Object.keys(row.seasons ?? {});
  if (!keys.length) return true;
  return keys.some((k) => k === '0' || versions[k] !== current);
}

/**
 * The warning line for parent strength read from a ratings file fitted on another simulator version (null when the
 * manifest names `current`, so nothing is printed and no number changes). A file without a manifest version counts as
 * another version. The ratings are still used (a stale rating beats none for choosing parents), but a run says so.
 */
export function ratingsVersionWarning(ratings: { manifest?: { simVersion?: unknown } | null } | null | undefined, file = 'src/data/ratings.json', current: number = CURRENT_SIM_VERSION): string | null {
  const v = ratings?.manifest?.simVersion;
  if (typeof v === 'number' && v === current) return null;
  return `Warning: parent strength reads ${file}, fitted on ${typeof v === 'number' ? `simulator v${v}` : 'an unversioned simulator'}, not the current v${current}; the parents are ranked on old ratings until the series re-rates the library.`;
}

/** Whether a ratings row can rank a parent: PARENT_MIN_GAMES or more games and a finite estimate. */
export const parentRated = (d: Pick<RatedDeck, 'games' | 'wrField'>): boolean => d.games >= PARENT_MIN_GAMES && Number.isFinite(d.wrField);

/**
 * Deck name → strength: each ratings row with PARENT_MIN_GAMES or more games at its point estimate (wrField, the expected
 * win rate against the library), in the order of `ratings`. Rows with fewer games are left out (`tooFewGames` names them).
 */
export function parentStrength(ratings: readonly RatedDeck[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of ratings) if (parentRated(d)) out[d.name] = d.wrField;
  return out;
}

/** The rated decks left out of parent strength for having fewer than PARENT_MIN_GAMES games (name and games). */
export const tooFewGames = (ratings: readonly RatedDeck[]): { name: string; games: number }[] =>
  ratings.filter((d) => Number.isFinite(d.wrField) && !(d.games >= PARENT_MIN_GAMES)).map((d) => ({ name: d.name, games: d.games }));

/** "Not parents (fewer than 100 games on their current list): A (40), B (12)." Null when none. */
export function tooFewGamesWords(left: readonly { name: string; games: number }[]): string | null {
  if (!left.length) return null;
  return `Not parents (fewer than ${PARENT_MIN_GAMES} games on their current list): ${left.map((d) => `${d.name} (${d.games})`).join(', ')}.`;
}

/** The library decks with a strength, strongest first (ties keep the order of `strength`); `wr` is the strength. */
export function rankParents<L extends { deck: DeckList }>(strength: Readonly<Record<string, number>>, lib: readonly L[]): { deck: DeckList; wr: number }[] {
  const byName = new Map<string, L>();
  for (const d of lib) if (!byName.has(d.deck.name)) byName.set(d.deck.name, d);
  return Object.entries(strength)
    .filter(([name]) => byName.has(name))
    .sort((a, b) => b[1] - a[1])
    .map(([name, wr]) => ({ deck: byName.get(name)!.deck, wr }));
}

/** The library's decks ranked by parent strength, strongest first (parentStrength, then rankParents). The Deck Lab's rankedParents. */
export function rankLibraryParents<L extends { file: string; deck: DeckList }>(lib: readonly L[], ratings: readonly RatedDeck[]): { deck: DeckList; wr: number }[] {
  return rankParents(parentStrength(ratings), lib);
}

/** A bred deck's best parent: of the parents it names, the one ranked highest (undefined when none is ranked, or for an explorer). */
export function bestParent<R extends { deck: { name: string } }>(parents: readonly string[], ranked: readonly R[]): R | undefined {
  return ranked.find((r) => parents.includes(r.deck.name));
}
