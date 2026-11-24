// The Sim tier: a letter (S / A / B / C / D) from this trainer's own recorded tournaments, shown beside choom.gg's
// editorial tier and never in place of it. It is read from the power ratings (src/data/ratings.json, fitted by
// scripts/ratings.ts: a Bradley–Terry model over every recorded tournament game, giving each deck an expected win rate
// against the whole field with a 90% range), at read time, so it follows ratings.json whenever that is rebuilt.
//
// Fixed bands on the expected win rate, not rank quantiles. The win rate is against the field the ratings were fitted on
// (every deck with a game on its current list: the library), whose average is 50% by construction, so a letter is
// relative to the library as it stands: adding strong decks lowers the other decks' letters and pruning weak ones raises
// them, while the order barely moves (docs/REVIEW_2026-11-24.md L3). Name the field beside a letter
// (`simTierFieldWords`). The numbers below are the whole rule; change them here (src/lib/ratingModel.ts
// TIER_BOUNDARIES is a second copy of the edges, held equal by tests/sim-tier.test.tsx).
import { CURRENT_SIM_VERSION, SMALL_SAMPLE } from './playedRecord';

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
 * How many bands away from the letter's own band the 90% range must reach before the letter is marked uncertain (±):
 * one, so a letter is marked whenever its range crosses a band edge. Two, the rule until 2026-11-24, was set when the
 * ranges were 15–24 points wide; at the rating series' ±4 points no range can reach two bands of 9–10 points, so no
 * letter was marked while 54 of 71 ranges crossed an edge (docs/REVIEW_2026-11-24.md L2). A ± letter is the band of
 * the point estimate; the range's ends are `loLetter` and `hiLetter`. (src/lib/rankStability.ts reads the bands only,
 * never this mark.)
 */
export const SIM_TIER_STRADDLE_BANDS = 1;

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
  /** the 90% range reaches SIM_TIER_STRADDLE_BANDS or more bands away from the letter's band (it crosses a band edge) */
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

/**
 * The field a letter is measured against, in words: "against the library, 71 decks" (`decks`: the rated decks in
 * ratings.json, every deck with a game on its current list). Shown beside every letter, since the letter moves with it.
 */
export const simTierFieldWords = (decks: number): string => `against the library, ${decks} deck${decks === 1 ? '' : 's'}`;

/** What the tier texts may add: the size of the rated field, and a note (the ratings' simulator version). */
export interface SimTierTextOptions {
  /** rated decks in the field (`simTierFieldWords`); absent: "vs the field" */
  field?: number;
  /** a sentence appended to the text (`simTierVersionNote`) */
  note?: string | null;
}

/** The tooltip / screen-reader text: where the letter comes from, the number, its range and games. */
export function simTierText(t: SimTier, o: SimTierTextOptions = {}): string {
  const src = "Sim tier, from this trainer's recorded tournaments (power rating)";
  const tail = o.note ? ` ${o.note}` : '';
  if (t.unrated === 'no-games') return `${src}: unrated, no recorded tournament games.${tail}`;
  if (t.unrated === 'few-games') return `${src}: unrated, too few games (${t.games} of the ${SIM_TIER_MIN_GAMES} needed).${tail}`;
  const range = t.lo !== undefined && t.hi !== undefined ? ` (90% range ${pc1(t.lo)}–${pc1(t.hi)})` : '';
  const field = o.field !== undefined ? simTierFieldWords(o.field) : 'vs the field';
  const head = `${src}: ${t.letter}${t.straddle ? '±' : ''}. Expected ${pc1(t.wr ?? 0)} ${field}${range} over ${t.games} games; tier ${t.letter} is ${bandWords(t.letter ?? 'D')}.`;
  return `${t.straddle && t.loLetter && t.hiLetter ? `${head} Uncertain: the range reaches from tier ${t.loLetter} to tier ${t.hiLetter}.` : head}${tail}`;
}

/**
 * The note for letters read from ratings fitted on another simulator version: null when the file's manifest names the
 * current one (so nothing changes then); a file without a manifest version counts as another version.
 */
export function simTierVersionNote(manifest: { simVersion?: unknown } | null | undefined, current: number = CURRENT_SIM_VERSION): string | null {
  const v = manifest?.simVersion;
  if (typeof v === 'number' && v === current) return null;
  return `These letters come from ratings fitted on ${typeof v === 'number' ? `simulator v${v}` : 'an unversioned simulator'}, not the current v${current}.`;
}

/**
 * The tooltip of a provisional tier (src/lib/yourStats.ts): the same rule on a provisional rating from the visitor's own
 * tournaments in this browser, named as such, never as a recorded result.
 */
export function provisionalTierText(t: SimTier, o: SimTierTextOptions = {}): string {
  const src = 'Provisional tier from your tournaments in this browser (All Hard bots), not a recorded result';
  const tail = o.note ? ` ${o.note}` : '';
  if (!t.letter) return `${src}: none yet, too few games (${t.games} of the ${SIM_TIER_MIN_GAMES} needed).${tail}`;
  const range = t.lo !== undefined && t.hi !== undefined ? ` (90% range ${pc1(t.lo)}–${pc1(t.hi)})` : '';
  const field = o.field !== undefined ? `vs the recorded field, the library of ${o.field} deck${o.field === 1 ? '' : 's'},` : 'vs the recorded field';
  const head = `${src}: ${t.letter}${t.straddle ? '±' : ''}. Expected ${pc1(t.wr ?? 0)} ${field}${range} over ${t.games} games; tier ${t.letter} is ${bandWords(t.letter)}.`;
  return `${t.straddle && t.loLetter && t.hiLetter ? `${head} Uncertain: the range reaches from tier ${t.loLetter} to tier ${t.hiLetter}.` : head}${tail}`;
}

/** Every band in one line, for the explanations: "S 64% or more · A 55–64% · …". */
export const bandsLine = (): string => SIM_TIER_LETTERS.map((l) => `${l} ${bandWords(l)}`).join(' · ');

/** Sort key: S first, unrated last. */
export const simTierRank = (t: SimTier): number => (t.letter ? SIM_TIER_LETTERS.indexOf(t.letter) : SIM_TIER_LETTERS.length);
