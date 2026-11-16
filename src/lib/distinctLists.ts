// One entry per list: the rule every tournament and season field follows by default (scripts/tournament.ts,
// scripts/season.ts, the runner at #/run). Two decks whose Legends and main deck are the same (listFingerprint in
// src/engine/deck.ts: whatever the name, the card order or the sideboard) are one deck for this purpose, so entering
// both would enter the same deck twice. Entering a list more than once stays possible, but only on purpose (the CLI's
// --allow-same-lists, the runner's "One entry per list" switched off, or a copy named "X #2"). Pure and small.
import type { DeckList } from '../engine/types';
import { isSavedHere, listOf } from './listTwin';

/** What the rule needs of a deck: its file (a deck saved in this browser is `custom:<name>`) and its list. */
export type Listed = { file: string; deck: Pick<DeckList, 'name' | 'legends' | 'main'> };

/** A deck left out, and the kept deck whose list it has. */
export interface SameList<T> {
  deck: T;
  sameAs: T;
}
export interface DistinctLists<T> {
  /** the decks kept, in the order given */
  kept: T[];
  /** the decks left out, in the order given, each with the kept deck it duplicates */
  left: SameList<T>[];
}

/**
 * Which of these decks a field keeps: one per list. The preference, stated once: a deck bundled with the site before a
 * deck saved in this browser, and among equals the one that comes first in the order given (the library's order).
 * Every deck either is kept or names the kept deck it duplicates; the kept decks keep their places.
 */
export function distinctLists<T extends Listed>(decks: readonly T[]): DistinctLists<T> {
  const order = decks.map((d, i) => ({ d, i, rank: isSavedHere(d) ? 1 : 0 })).sort((a, b) => a.rank - b.rank || a.i - b.i);
  const owner = new Map<string, T>();
  const sameAs = new Map<number, T>();
  for (const { d, i } of order) {
    const fp = listOf(d.deck);
    const first = owner.get(fp);
    if (first === undefined) owner.set(fp, d);
    else sameAs.set(i, first);
  }
  const kept: T[] = [];
  const left: SameList<T>[] = [];
  decks.forEach((d, i) => {
    const s = sameAs.get(i);
    if (s === undefined) kept.push(d);
    else left.push({ deck: d, sameAs: s });
  });
  return { kept, left };
}

/** Whether any two of these decks have the same list. */
export const hasSameLists = (decks: readonly Listed[]): boolean => new Set(decks.map((d) => listOf(d.deck))).size < decks.length;

const name = (d: Listed) => d.deck.name;

/** "A (same list as B)": one left-out deck in words. */
export const sameListWords = (s: SameList<Listed>): string => (name(s.deck) === name(s.sameAs) ? `${name(s.deck)} (entered already)` : `${name(s.deck)} (same list as ${name(s.sameAs)})`);

/**
 * The one line a caller prints or shows when the rule left decks out, or '' when it left none:
 * "Left out 2 decks whose list is already in the field: A (same list as B), C (same list as D)."
 */
export function leftOutLine(left: readonly SameList<Listed>[]): string {
  if (!left.length) return '';
  const n = left.length;
  return `Left out ${n === 1 ? 'one deck' : `${n} decks`} whose list is already in the field: ${left.map(sameListWords).join(', ')}.`;
}
