// Decks by list, not by name: a deck saved in this browser whose list (Legends and main deck, listFingerprint in
// src/engine/deck.ts) is a library deck's list shares that deck's recorded results, whatever it is called. Library
// decks themselves keep resolving by their own name, exactly as before. Small and pure (deck tiles use it).
import { listFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';

type Listed = { file: string; deck: Pick<DeckList, 'name' | 'legends' | 'main'> };

const fpMemo = new WeakMap<object, string>();
/** A deck's list fingerprint, remembered per deck object (deck lists are read-only once loaded). */
export function listOf(deck: Pick<DeckList, 'legends' | 'main'>): string {
  let fp = fpMemo.get(deck);
  if (fp === undefined) fpMemo.set(deck, (fp = listFingerprint(deck)));
  return fp;
}

/** Decks saved in this browser are keyed `custom:<name>`; everything else ships with the site. */
export const isSavedHere = (d: Pick<Listed, 'file'>) => d.file.startsWith('custom:');

const indexMemo = new WeakMap<readonly Listed[], Map<string, Listed[]>>();
function byList<T extends Listed>(library: readonly T[]): Map<string, T[]> {
  let m = indexMemo.get(library) as Map<string, T[]> | undefined;
  if (!m) {
    m = new Map();
    for (const d of library) {
      if (isSavedHere(d)) continue;
      const fp = listOf(d.deck);
      const at = m.get(fp);
      if (at) at.push(d);
      else m.set(fp, [d]);
    }
    indexMemo.set(library, m as Map<string, Listed[]>);
  }
  return m;
}

/**
 * The library deck a deck saved in this browser is a copy of (same list), or null: always null for a library deck
 * (it resolves by its own name) and for a list no library deck has. Among several library decks with that list, the first
 * one `prefer` accepts (e.g. one with a recorded rating), else the first.
 */
export function libraryTwin<T extends Listed>(d: Listed, library: readonly T[], prefer?: (t: T) => boolean): T | null {
  if (!isSavedHere(d)) return null;
  const same = byList(library).get(listOf(d.deck));
  if (!same?.length) return null;
  return (prefer && same.find(prefer)) || same[0]!;
}
