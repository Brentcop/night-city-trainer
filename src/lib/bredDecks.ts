// Bred decks in words and side by side (docs/SYNERGIES.md "A bred deck's test against its parent"): the plain sentences
// the Deck Lab's Breed tab and the Seasons page show for a bred deck's test against its reference, and the Seasons page's
// "Bred decks, then and now" rows (src/ui/pages/Seasons.tsx).
//
// - The verdict phrase has one definition here (`verdictAgainst`); src/lib/breedGate.ts builds the Lab's sentences on
//   it. An entered or untold deck is never said to be as good as its reference, only "not shown worse".
// - "Then and now" puts two different measures side by side and computes nothing from them: a bred deck's win rate in
//   its own season's round robin (that season's field, bot and simulator version) and its power rating now
//   (src/data/ratings.json: today's events, bot and simulator version), with its best parent's rating now (the parent
//   ranked highest by today's parent strength, src/lib/parentStrength.ts) and the test's figure when the season recorded
//   one. No difference between them is computed: they measure different things.
//
// Light on purpose (the Seasons page loads it): it imports parentStrength.ts, the bot names from evidence.ts and types
// only, never the gate's statistics (breedGate.ts), a bot, the engine or a simulator worker.
import type { DeckList } from '../engine/types';
import type { GateFigure, GateOutcome, GateStep, GateVerdict, ReferenceWhy } from './breedGate';
import { botWord } from './evidence';
import { bestParent } from './parentStrength';

// ---------------------------------------------------------------- shared words

/** A fraction as signed points: 0.021 → "+2.1", −0.062 → "−6.2". */
export const signedPoints = (x: number): string => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
/** A fraction as a percentage: 0.543 → "54.3%". */
export const percent = (x: number): string => `${(x * 100).toFixed(1)}%`;
/** 1120 → "1,120". */
export const count = (n: number): string => n.toLocaleString('en-US');

/** "shown worse than X", "shown better than X", "could not tell: not shown worse than X" (never "as good as"). */
export function verdictAgainst(v: GateVerdict, reference: string): string {
  if (v === 'shown-worse') return `shown worse than ${reference}`;
  if (v === 'shown-better') return `shown better than ${reference}`;
  return `could not tell: not shown worse than ${reference}`;
}

/** "+2.1 points (range −3.0 to +7.2)": the paired difference, deck minus reference, with the range it was judged on. */
export function differenceWords(f: Pick<GateFigure, 'mean' | 'lower' | 'upper'>): string {
  return `${signedPoints(f.mean)} points (range ${signedPoints(f.lower)} to ${signedPoints(f.upper)})`;
}

/** The first letter in capitals. */
export const capital = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- a season's recorded test

/** "Medium bot: +1.2 points (range −3.0 to +5.4), 560 games each" (or "stopped before it was decided"). */
export function stepFigureWords(s: GateStep): string {
  if (s.stopped) return `${botWord(s.bot)} bot: stopped before it was decided`;
  return `${botWord(s.bot)} bot: ${differenceWords(s.judged)}, ${count(s.judged.games)} games each`;
}

/** The steps of a recorded test that count: the first bot's, and the confirming bot's unless the rule skipped it. */
export function countedSteps(d: Pick<GateOutcome, 'first' | 'confirm' | 'confirmSkipped'>): GateStep[] {
  return [d.first, ...(d.confirm && !d.confirmSkipped ? [d.confirm] : [])];
}

const SEASON_REF: Record<ReferenceWhy, string> = {
  'best-parent': 'its best parent then',
  explorer: 'the middle meta deck, as an explorer',
  'no-parent-available': 'the middle meta deck, as none of its parents was ranked',
  'fixed-bar': 'the middle meta deck, that season’s fixed bar for every bred deck',
  named: '',
};

/**
 * A season's test of one bred deck in words: "Entered: not shown worse than X (its best parent then)", "Entered: shown
 * better than X … with the Medium bot", "Kept out: shown worse than X … with the Hard bot", or stopped.
 */
export function seasonTestWords(d: Pick<GateOutcome, 'reference' | 'first' | 'confirm' | 'confirmSkipped' | 'entered' | 'stopped'>): string {
  const note = SEASON_REF[d.reference.why];
  const ref = note ? `${d.reference.name} (${note})` : d.reference.name;
  if (d.stopped) return `Not entered: stopped before the test against ${ref} was decided`;
  const steps = countedSteps(d);
  if (!d.entered) {
    const worse = steps.find((s) => s.verdict === 'shown-worse') ?? d.first;
    return `Kept out: ${verdictAgainst('shown-worse', ref)} with the ${botWord(worse.bot)} bot`;
  }
  const better = steps.filter((s) => s.verdict === 'shown-better');
  if (better.length) return `Entered: ${verdictAgainst('shown-better', ref)} with ${better.map((s) => `the ${botWord(s.bot)} bot`).join(' and ')}`;
  return `Entered: not shown worse than ${ref}`;
}

// ---------------------------------------------------------------- then and now

/** A deck's power rating now: its expected win rate against the field, the 90% range, and the games behind it. */
export interface RatingNow {
  wr: number;
  lo: number;
  hi: number;
  games: number;
}
/** What the rows read of a ratings row (src/data/ratings.json decks[]). */
export interface RatingInput {
  name: string;
  file?: string;
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
}
/** What the rows read of a recorded season (src/data/index.ts SeasonRecord). */
export interface SeasonInput {
  bred: readonly { name: string; method: string; parents: readonly string[] }[];
  standings: readonly { name: string; wr: number }[];
  gate?: { decks: readonly (GateOutcome & { method?: string })[] } | null;
}

export interface BredThenNow {
  name: string;
  /** the library file, when the deck is in the library (else null: named without a link) */
  file: string | null;
  method: string;
  /** its parents; empty for an explorer */
  parents: string[];
  explorer: boolean;
  /** its win rate in its own season's round robin (null when the standings do not have it) */
  season: number | null;
  /** its power rating now (null: not rated) */
  now: RatingNow | null;
  /** its best parent by today's parent strength (null for an explorer, or when none of its parents is ranked) */
  parent: { name: string; file: string | null; now: RatingNow | null } | null;
  /** the season's test of it (null: the season recorded none) */
  test: (GateOutcome & { method?: string }) | null;
}

function ratingOf(ratings: readonly RatingInput[], name: string, file: string | null): RatingNow | null {
  const r = ratings.find((x) => x.name === name) ?? (file ? ratings.find((x) => x.file === file) : undefined);
  if (!r || !(r.games > 0) || !Number.isFinite(r.wrField)) return null;
  return { wr: r.wrField, lo: r.wrFieldLo, hi: r.wrFieldHi, games: r.games };
}

/**
 * One row per bred deck of a season (the decks that took a slot: `bred`), in the season's order. `ranked` is today's
 * parent ranking (rankLibraryParents); `lib` resolves names to library files.
 */
export function bredThenAndNow(season: SeasonInput, lib: readonly { file: string; deck: Pick<DeckList, 'name'> }[], ratings: readonly RatingInput[], ranked: readonly { deck: Pick<DeckList, 'name'> }[]): BredThenNow[] {
  const fileOf = (name: string) => lib.find((d) => d.deck.name === name)?.file ?? null;
  return season.bred.map((b) => {
    const file = fileOf(b.name);
    const best = b.parents.length ? bestParent(b.parents, ranked) : undefined;
    const parentFile = best ? fileOf(best.deck.name) : null;
    const standing = season.standings.find((s) => s.name === b.name);
    return {
      name: b.name,
      file,
      method: b.method,
      parents: [...b.parents],
      explorer: b.parents.length === 0,
      season: standing && Number.isFinite(standing.wr) ? standing.wr : null,
      now: ratingOf(ratings, b.name, file),
      parent: best ? { name: best.deck.name, file: parentFile, now: ratingOf(ratings, best.deck.name, parentFile) } : null,
      test: season.gate?.decks.find((d) => d.name === b.name) ?? null,
    };
  });
}

/** The decks a season's test kept out (or that were stopped before it decided), in the season's order. */
export function notEntered<D extends Pick<GateOutcome, 'entered'>>(gate: { decks: readonly D[] } | null | undefined): D[] {
  return gate ? gate.decks.filter((d) => !d.entered) : [];
}

/** "62.3% (90% range 58.1%–66.0%), 238 games", or "not rated". */
export function ratingNowWords(r: RatingNow | null): string {
  return r ? `${percent(r.wr)} (90% range ${percent(r.lo)}–${percent(r.hi)}), ${count(r.games)} games` : 'not rated';
}

/** The sentence above the table: the two numbers are different measures, side by side. */
export function thenAndNowIntro(o: { season: number; seasonBot: string; seasonSim: number | null; ratingsBot: string | null; ratingsSim: number | null }): string {
  const then = `${botWord(o.seasonBot)} bot${o.seasonSim !== null ? `, simulator v${o.seasonSim}` : ''}`;
  const now = [o.ratingsBot ? `${botWord(o.ratingsBot)} bot` : null, o.ratingsSim !== null ? `simulator v${o.ratingsSim}` : null].filter(Boolean).join(', ');
  return (
    `The Season ${o.season} number is each deck’s win rate in that season’s round robin (${then}); the rating now is its power rating from the recorded tournaments${now ? ` (${now})` : ''}. ` +
    `They are different measures, with another field, bot and simulator, shown side by side to see how a deck that looked strong in its season rates today.`
  );
}

/** "made from X + Y", or "a new Legend trio" for an explorer. */
export const madeFromWords = (r: Pick<BredThenNow, 'parents' | 'explorer'>): string => (r.explorer ? 'a new Legend trio' : r.parents.join(' + '));

/** The not-tested note for a season that recorded no test. */
export const NOT_TESTED = 'not tested before entering';

// ---------------------------------------------------------------- the leaderboard

/**
 * The leaderboard's sentence about older numbers (it follows the page's "historical" sentence and says only what that
 * one does not: what the breeder does with them). Null when no row is from an older simulator.
 */
export function leaderboardStaleWords(staleRows: number): string | null {
  if (!staleRows) return null;
  return 'The breeder no longer uses numbers from an older simulator (rows marked “older simulator”) to choose parents; it uses today’s power ratings.';
}

/** The "older simulator" mark and its tooltip. */
export const STALE_ROW_MARK = 'older simulator';
export const STALE_ROW_TITLE = 'Some of this row’s games were played under an older simulator, so the breeder does not use this row to choose parents.';
