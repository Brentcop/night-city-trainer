// Deck lookups shared by the pages. Pure functions over a library list (allDecks() order: built-ins first, then the
// decks saved in this browser, whose file is `custom:<name>`), so they can be unit-tested without localStorage.
import type { LibraryDeck } from '../lib/library';
import { copyWords, entrantDeckName, type EntrantName } from '../lib/entrants';

/** Decks saved in this browser are keyed `custom:<name>`; everything else is bundled with the site. */
export const isBuiltin = (d: Pick<LibraryDeck, 'file'>) => !d.file.startsWith('custom:');

/** Name → deck, preferring the built-in deck when a saved deck has the same name. */
export function byName(lib: readonly LibraryDeck[]): Map<string, LibraryDeck> {
  const m = new Map<string, LibraryDeck>();
  for (const d of lib) {
    const cur = m.get(d.deck.name);
    if (!cur || (!isBuiltin(cur) && isBuiltin(d))) m.set(d.deck.name, d);
  }
  return m;
}

/**
 * An event's decks, for its views: every entrant name (a copy "X #2" too) is turned into the deck it plays here, so a
 * copy links to X's page and shows X's colours, tier and facts while keeping its own label.
 */
export interface EventLib {
  /** the library deck an entrant plays (a copy plays its deck), or undefined */
  deck(name: string): LibraryDeck | undefined;
  /** the deck name an entrant plays (the entrant's own name for an original entry, or when nothing better is known) */
  base(name: string): string;
  /** for a copy, what it is in words ("second entry of X"); null for an original entry */
  copyText(name: string): string | null;
  /** some entrant of the event is a copy of another (by the setup; false when the event has none) */
  readonly hasCopies: boolean;
}

/**
 * The one resolver every event view uses. `names` is the library by name (`byName`), `setup` the event's recorded
 * setup when there is one (its `copyOf` decides), else the narrow name fallback of `entrantDeckName`.
 */
export function eventLib(names: ReadonlyMap<string, LibraryDeck>, setup?: { entrants?: readonly EntrantName[] } | null): EventLib {
  const isDeck = (n: string) => names.has(n);
  const base = (name: string) => entrantDeckName(setup, name, isDeck);
  return {
    deck: (name) => names.get(base(name)),
    base,
    copyText: (name) => {
      const b = base(name);
      return b === name ? null : copyWords(name, b);
    },
    hasCopies: !!setup?.entrants?.some((e) => e.copyOf),
  };
}

/** Exact lookup by library file (what every `?d=` link carries). No fuzzy fallback: a stale link finds nothing. */
export function deckByFile(lib: readonly LibraryDeck[], file: string | undefined | null): LibraryDeck | undefined {
  return file ? lib.find((d) => d.file === file) : undefined;
}

/** Loose search for typed queries: exact file, then file or name containing the text. Not for URL params. */
export function searchDeck(lib: readonly LibraryDeck[], q: string | undefined): LibraryDeck | undefined {
  if (!q) return undefined;
  const t = q.toLowerCase();
  return deckByFile(lib, q) ?? lib.find((d) => d.file.toLowerCase().includes(t) || d.deck.name.toLowerCase().includes(t));
}

/**
 * The name a deck will be saved under in "My decks". A built-in deck's name is reserved (saving under it would
 * shadow the built-in in every name-keyed view), so it gets a " (my copy)" suffix, numbered if that is taken by
 * another built-in. Returns null for a blank name.
 */
export function customSaveName(name: string, lib: readonly LibraryDeck[]): string | null {
  const base = name.trim().slice(0, 80);
  if (!base) return null;
  const reserved = new Set(lib.filter(isBuiltin).map((d) => d.deck.name));
  if (!reserved.has(base)) return base;
  for (let k = 1; ; k++) {
    const cand = `${base} (my copy${k > 1 ? ` ${k}` : ''})`;
    if (!reserved.has(cand)) return cand;
  }
}
