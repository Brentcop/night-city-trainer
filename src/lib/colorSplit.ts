// Colour breakdowns (ROADMAP2 §13 goal 2): the one function for how a deck splits by colour, and for how a set of decks
// does. Pure; card colours come from the card data (CARD_BY_ID), as `typeSplit` reads card types.
//
// The words, defined once here:
//   - A deck's colour combination is its colour pill: one letter per Legend, Red, Blue, Green, Yellow order ("RRG"),
//     exactly `deckColors` (src/engine/deck.ts), which it calls.
//   - A deck plays a colour when at least one of its Legends is that colour (a deck of "RRG" plays Red and Green).
//   - A deck's card split counts the main deck's cards by colour, copies included; a card the data does not know is
//     counted as `unknown`, never under a colour.
// Results by colour in a recorded event are `eventColors` in src/lib/eventFacts.ts, which uses these definitions.
import { CARD_BY_ID } from '../engine/cards';
import { deckColors } from '../engine/deck';
import type { DeckList } from '../engine/types';

export type ColorKey = 'R' | 'B' | 'G' | 'Y';
/** The pill's order. */
export const COLOR_KEYS: readonly ColorKey[] = ['R', 'B', 'G', 'Y'];
/** The word for each letter, also the card data's colour and the `.dot` class. */
export const COLOR_NAMES: Record<ColorKey, string> = { R: 'Red', B: 'Blue', G: 'Green', Y: 'Yellow' };

const keyOf = (color: string | undefined): ColorKey | null => {
  const k = color?.[0];
  return k === 'R' || k === 'B' || k === 'G' || k === 'Y' ? k : null;
};

/** The colour pill of a Legend trio ("RRG"): `deckColors`, one definition. */
export function comboOf(legends: readonly string[]): string {
  return deckColors({ legends: [...legends] } as Pick<DeckList, 'legends'> as DeckList);
}

/** The colours a deck plays (at least one Legend of it), in pill order. */
export function colorsPlayed(legends: readonly string[]): ColorKey[] {
  const has = new Set(legends.map((id) => keyOf(CARD_BY_ID[id]?.color)));
  return COLOR_KEYS.filter((k) => has.has(k));
}

export interface DeckColorSplit {
  /** the colour pill, e.g. "RRG" */
  combo: string;
  /** colours played, in pill order */
  colors: ColorKey[];
  /** Legends per colour, in COLOR_KEYS order */
  legends: [ColorKey, number][];
  /** main-deck cards per colour (copies counted), in COLOR_KEYS order */
  cards: [ColorKey, number][];
  /** main-deck cards with a known colour */
  cardTotal: number;
  /** main-deck cards the data does not know */
  unknown: number;
}

function tally(ids: readonly string[]): { n: Record<ColorKey, number>; total: number; unknown: number } {
  const n: Record<ColorKey, number> = { R: 0, B: 0, G: 0, Y: 0 };
  let total = 0;
  let unknown = 0;
  for (const id of ids) {
    const k = keyOf(CARD_BY_ID[id]?.color);
    if (!k) unknown++;
    else (n[k]++, total++);
  }
  return { n, total, unknown };
}

/** One deck: its pill, the colours it plays, and its Legends and main-deck cards by colour. */
export function deckColorSplit(deck: { legends: readonly string[]; main: readonly string[] }): DeckColorSplit {
  const l = tally(deck.legends);
  const c = tally(deck.main);
  return {
    combo: comboOf(deck.legends),
    colors: colorsPlayed(deck.legends),
    legends: COLOR_KEYS.map((k) => [k, l.n[k]]),
    cards: COLOR_KEYS.map((k) => [k, c.n[k]]),
    cardTotal: c.total,
    unknown: c.unknown,
  };
}

export interface FieldColorSplit {
  /** decks counted */
  decks: number;
  /** decks playing each colour, all four in COLOR_KEYS order (a two-colour deck counts under both) */
  byColor: { color: ColorKey; decks: number }[];
  /** decks per colour pill, most first, then by pill */
  byCombo: { combo: string; decks: number }[];
}

const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** A set of decks (a field, a top cut): how many play each colour and each colour combination. */
export function fieldColorSplit(decks: readonly { legends: readonly string[] }[]): FieldColorSplit {
  const color: Record<ColorKey, number> = { R: 0, B: 0, G: 0, Y: 0 };
  const combo = new Map<string, number>();
  for (const d of decks) {
    for (const k of colorsPlayed(d.legends)) color[k]++;
    const c = comboOf(d.legends);
    combo.set(c, (combo.get(c) ?? 0) + 1);
  }
  return {
    decks: decks.length,
    byColor: COLOR_KEYS.map((k) => ({ color: k, decks: color[k] })),
    byCombo: [...combo].map(([c, n]) => ({ combo: c, decks: n })).sort((a, b) => b.decks - a.decks || byStr(a.combo, b.combo)),
  };
}

/** "Red 30, Green 10" (colours with no cards left out); "no cards" for an empty list. */
export function colorCountText(counts: readonly [ColorKey, number][]): string {
  const parts = counts.filter(([, n]) => n > 0).map(([k, n]) => `${COLOR_NAMES[k]} ${n}`);
  return parts.length ? parts.join(', ') : 'none';
}
