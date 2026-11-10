// Deck lookups shared by the pages. Pure functions over a library list (allDecks() order: built-ins first, then the
// decks saved in this browser, whose file is `custom:<name>`), so they can be unit-tested without localStorage.
import type { LibraryDeck } from '../lib/library';

/** Decks saved in this browser are keyed `custom:<name>`; everything else is bundled with the site. */
export const isBuiltin = (d: Pick<LibraryDeck, 'file'>) => !d.file.startsWith('custom:');

/** Name → deck, preferring the built-in deck when a saved deck has the same name. */
export function byName(lib: LibraryDeck[]): Map<string, LibraryDeck> {
  const m = new Map<string, LibraryDeck>();
  for (const d of lib) {
    const cur = m.get(d.deck.name);
    if (!cur || (!isBuiltin(cur) && isBuiltin(d))) m.set(d.deck.name, d);
  }
  return m;
}

/** Exact lookup by library file (what every `?d=` link carries). No fuzzy fallback: a stale link finds nothing. */
export function deckByFile(lib: LibraryDeck[], file: string | undefined | null): LibraryDeck | undefined {
  return file ? lib.find((d) => d.file === file) : undefined;
}

/** Loose search for typed queries: exact file, then file or name containing the text. Not for URL params. */
export function searchDeck(lib: LibraryDeck[], q: string | undefined): LibraryDeck | undefined {
  if (!q) return undefined;
  const t = q.toLowerCase();
  return deckByFile(lib, q) ?? lib.find((d) => d.file.toLowerCase().includes(t) || d.deck.name.toLowerCase().includes(t));
}

/**
 * The name a deck will be saved under in "My decks". A built-in deck's name is reserved (saving under it would
 * shadow the built-in in every name-keyed view), so it gets a " (my copy)" suffix, numbered if that is taken by
 * another built-in. Returns null for a blank name.
 */
export function customSaveName(name: string, lib: LibraryDeck[]): string | null {
  const base = name.trim().slice(0, 80);
  if (!base) return null;
  const reserved = new Set(lib.filter(isBuiltin).map((d) => d.deck.name));
  if (!reserved.has(base)) return base;
  for (let k = 1; ; k++) {
    const cand = `${base} (my copy${k > 1 ? ` ${k}` : ''})`;
    if (!reserved.has(cand)) return cand;
  }
}
