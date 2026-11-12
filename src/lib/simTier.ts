// The Sim tier: a letter (S / A / B / C / D) from this trainer's own recorded tournaments, shown beside choom.gg's
// editorial tier and never in place of it. It is read from the power ratings (src/data/ratings.json, fitted by
// scripts/ratings.ts: a Bradley–Terry model over every recorded tournament game, giving each deck an expected win rate
// against the whole field with a 90% range), at read time, so it follows ratings.json whenever that is rebuilt.
//
// Fixed bands, not rank quantiles: a letter means the same expected win rate however the field changes. The numbers
// below are the whole rule; change them here.
import { SMALL_SAMPLE } from './playedRecord';

export type SimTierLetter = 'S' | 'A' | 'B' | 'C' | 'D';

/**
 * Lower bound (inclusive) of each band on the expected win rate vs the field, best first; D is everything below C.
 * B is the coin-flip band, the same 45–55% the site colours as "even" (src/ui/components/Num.tsx), with two bands of
 * about nine points on either side. Chosen against the ratings of 2026-11-11 (39 decks, 4 events, 949 games): the
 * expected win rates ran from 20% to 76%, and the 90% ranges were 15–24 points wide.
 */
export const SIM_TIER_BANDS: readonly { letter: SimTierLetter; min: number }[] = [
  { letter: 'S', min: 0.64 },
  { letter: 'A', min: 0.55 },
  { letter: 'B', min: 0.45 },
  { letter: 'C', min: 0.36 },
  { letter: 'D', min: -Infinity },
];

/** Fewer recorded games than this and the deck is unrated ("–", too few games): the site's small-sample threshold. */
export const SIM_TIER_MIN_GAMES = SMALL_SAMPLE;

/**
 * How many bands away from the letter's own band the 90% range must reach before the letter is marked uncertain (±).
 * With one band ("the range spans more than one band") every deck in the current data would be marked, since each
 * range is wider than any band, and the marker would say nothing; at two it marks the letters that could be off by
 * two tiers or more.
 */
export const SIM_TIER_STRADDLE_BANDS = 2;

export const SIM_TIER_LETTERS: readonly SimTierLetter[] = SIM_TIER_BANDS.map((b) => b.letter);

/** The fields of a ratings row the tier reads (RatingRow in src/lib/playedRecord.ts). */
export interface SimTierInput {
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
  games: number;
}

export interface SimTier {
  /** null: unrated (no recorded games, or fewer than SIM_TIER_MIN_GAMES) */
  letter: SimTierLetter | null;
  /** why it is unrated */
  unrated?: 'no-games' | 'few-games';
  /** the 90% range reaches SIM_TIER_STRADDLE_BANDS or more bands away from the letter's band */
  straddle: boolean;
  /** expected win rate vs the field, its 90% range and the games behind it (absent with no recorded games) */
  wr?: number;
  lo?: number;
  hi?: number;
  games: number;
  /** the bands the range's ends fall in */
  loLetter?: SimTierLetter;
  hiLetter?: SimTierLetter;
}

const finite = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** Index of the band an expected win rate falls in (0 = S). */
export function bandIndex(wr: number): number {
  const i = SIM_TIER_BANDS.findIndex((b) => wr >= b.min);
  return i < 0 ? SIM_TIER_BANDS.length - 1 : i;
}

/** The letter of the band an expected win rate falls in. */
export const bandOf = (wr: number): SimTierLetter => SIM_TIER_LETTERS[bandIndex(wr)] ?? 'D';

/** A band's range of expected win rates: [min, max) with max null for S and min null for D. */
export function bandRange(letter: SimTierLetter): { min: number | null; max: number | null } {
  const i = SIM_TIER_LETTERS.indexOf(letter);
  const own = SIM_TIER_BANDS[i];
  const above = i > 0 ? SIM_TIER_BANDS[i - 1] : undefined;
  return { min: own && Number.isFinite(own.min) ? own.min : null, max: above ? above.min : null };
}

/** The Sim tier of a deck from its ratings row (undefined: the deck has no recorded tournament games). */
export function simTier(row: SimTierInput | undefined | null): SimTier {
  if (!row || !finite(row.wrField) || !(row.games > 0)) return { letter: null, unrated: 'no-games', straddle: false, games: 0 };
  const base = { wr: row.wrField, games: row.games, ...(finite(row.wrFieldLo) ? { lo: row.wrFieldLo } : {}), ...(finite(row.wrFieldHi) ? { hi: row.wrFieldHi } : {}) };
  if (row.games < SIM_TIER_MIN_GAMES) return { letter: null, unrated: 'few-games', straddle: false, ...base };
  const i = bandIndex(row.wrField);
  const lo = finite(row.wrFieldLo) ? bandIndex(row.wrFieldLo) : i;
  const hi = finite(row.wrFieldHi) ? bandIndex(row.wrFieldHi) : i;
  // a lower win rate has a higher band index
  const straddle = lo - i >= SIM_TIER_STRADDLE_BANDS || i - hi >= SIM_TIER_STRADDLE_BANDS;
  return { letter: SIM_TIER_LETTERS[i] ?? 'D', straddle, ...base, loLetter: SIM_TIER_LETTERS[lo] ?? 'D', hiLetter: SIM_TIER_LETTERS[hi] ?? 'D' };
}

const pc = (x: number) => `${Math.round(x * 100)}%`;
const pc1 = (x: number) => `${(x * 100).toFixed(1)}%`;

/** A band in words: "64% or more", "55–64%", "under 36%". */
export function bandWords(letter: SimTierLetter): string {
  const { min, max } = bandRange(letter);
  if (min === null && max !== null) return `under ${pc(max)}`;
  if (max === null && min !== null) return `${pc(min)} or more`;
  return min !== null && max !== null ? `${pc(min)}–${pc(max)}` : 'any';
}

/** The letter as shown: "B", "B±" (uncertain), or "–" (unrated). */
export const simTierShort = (t: SimTier): string => (t.letter ? `${t.letter}${t.straddle ? '±' : ''}` : '–');

/** The tooltip / screen-reader text: where the letter comes from, the number, its range and games. */
export function simTierText(t: SimTier): string {
  const src = "Sim tier, from this trainer's recorded tournaments (power rating)";
  if (t.unrated === 'no-games') return `${src}: unrated, no recorded tournament games.`;
  if (t.unrated === 'few-games') return `${src}: unrated, too few games (${t.games} of the ${SIM_TIER_MIN_GAMES} needed).`;
  const range = t.lo !== undefined && t.hi !== undefined ? ` (90% range ${pc1(t.lo)}–${pc1(t.hi)})` : '';
  const head = `${src}: ${t.letter}${t.straddle ? '±' : ''}. Expected ${pc1(t.wr ?? 0)} vs the field${range} over ${t.games} games; tier ${t.letter} is ${bandWords(t.letter ?? 'D')}.`;
  return t.straddle && t.loLetter && t.hiLetter ? `${head} Uncertain: the range reaches from tier ${t.loLetter} to tier ${t.hiLetter}.` : head;
}

/** Every band in one line, for the explanations: "S 64% or more · A 55–64% · …". */
export const bandsLine = (): string => SIM_TIER_LETTERS.map((l) => `${l} ${bandWords(l)}`).join(' · ');

/** Sort key: S first, unrated last. */
export const simTierRank = (t: SimTier): number => (t.letter ? SIM_TIER_LETTERS.indexOf(t.letter) : SIM_TIER_LETTERS.length);
