// Parent strength for the breeders (docs/TUNING_STUDY_2026-11-13.md P7; docs/SYNERGIES.md "A bred deck's test against
// its parent"): one rule for the season breeder (scripts/breed-data.ts strengthOf, scripts/season.ts,
// scripts/breed-preview.ts) and the Deck Lab's (src/lib/deckLab.ts rankedParents).
//
// - A rated deck (src/data/ratings.json, 20 or more games) counts at its conservative rating: the expected win rate
//   against the field, halfway down to the lower bound of its 90% range.
// - A season leaderboard entry counts only when it is current: every season that added to it ran under the current
//   simulator version. The seed data ("season 0") and seasons recorded without a manifest are old. A current entry is
//   blended in at 35% (a rated deck) or used alone (an unrated one); a stale entry is not used at all, so a deck with
//   only a stale entry has no strength and is no parent candidate.
//
// Plain data in, plain data out: no file reads, so Node and the browser call the same functions. Light on purpose (it
// imports only playedRecord.ts for the current simulator version), so the Seasons page (src/ui/pages/Seasons.tsx, through
// src/lib/bredDecks.ts) uses `staleLeaderRow`, `rankLibraryParents` and `bestParent` without the gate's statistics.
// `rankLibraryParents` is the Deck Lab's ranking (deckLab.ts rankedParents hands its bundled data to it); `bestParent` is
// the first choice of the gate's reference (breedGate.ts chooseReference).
import type { DeckList } from '../engine/types';
import { CURRENT_SIM_VERSION } from './playedRecord';

/** A rated deck has at least this many games in the ratings (else its rating is not used). */
export const RATED_MIN_GAMES = 20;
/** A current leaderboard entry's share in a rated deck's strength. */
export const LEADERBOARD_SHARE = 0.35;

/** What parent strength reads of a ratings row (src/data/ratings.json decks[]). */
export interface RatedDeck {
  name: string;
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
}

/** A season leaderboard entry as parent strength reads it: its shrunk rating vs the meta, and whether it is stale. */
export interface LeaderStrength {
  name: string;
  rating: number;
  stale: boolean;
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

/** A rated deck's conservative strength: its expected win rate vs the field, halfway down to its lower bound. */
export const conservativeRating = (d: RatedDeck): number => d.wrField - 0.5 * Math.max(0, (d.wrFieldHi - d.wrFieldLo) / 2);

/**
 * Deck name → strength. Current leaderboard entries first (in the order given), then the ratings: a rated deck is its
 * conservative rating, blended 65/35 with its current leaderboard entry when it has one. Stale entries are left out.
 */
export function parentStrength(ratings: readonly RatedDeck[], leaderboard: readonly LeaderStrength[]): Record<string, number> {
  const current = new Map<string, number>();
  for (const e of leaderboard) if (!e.stale && Number.isFinite(e.rating)) current.set(e.name, e.rating);
  const out: Record<string, number> = Object.fromEntries(current);
  for (const d of ratings) {
    if (!(d.games >= RATED_MIN_GAMES) || !Number.isFinite(d.wrField)) continue;
    const rated = conservativeRating(d);
    const lb = current.get(d.name);
    out[d.name] = lb !== undefined ? (1 - LEADERBOARD_SHARE) * rated + LEADERBOARD_SHARE * lb : rated;
  }
  return out;
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

/** The season data the library ranking reads: the leaderboard (matched to library decks by file) and each season's version. */
export interface LeaderboardInput {
  leaderboard: readonly { file: string; rating: number; seasons?: Readonly<Record<string, unknown>> | null }[];
  seasons: readonly SeasonVersionInput[];
}

/**
 * The library's decks ranked by parent strength, strongest first: the ratings with each leaderboard row's entry (matched
 * to a library deck by file), stale rows marked so `parentStrength` leaves them out. The Deck Lab's rankedParents.
 */
export function rankLibraryParents<L extends { file: string; deck: DeckList }>(lib: readonly L[], ratings: readonly RatedDeck[], seasons: LeaderboardInput, current: number = CURRENT_SIM_VERSION): { deck: DeckList; wr: number }[] {
  const versions = seasonVersions(seasons.seasons);
  const leaderboard = seasons.leaderboard.flatMap((r) => {
    const d = lib.find((x) => x.file === r.file);
    return d ? [{ name: d.deck.name, rating: r.rating, stale: staleLeaderRow(r, versions, current) }] : [];
  });
  return rankParents(parentStrength(ratings, leaderboard), lib);
}

/** A bred deck's best parent: of the parents it names, the one ranked highest (undefined when none is ranked, or for an explorer). */
export function bestParent<R extends { deck: { name: string } }>(parents: readonly string[], ranked: readonly R[]): R | undefined {
  return ranked.find((r) => parents.includes(r.deck.name));
}
