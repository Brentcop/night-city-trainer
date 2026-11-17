// How the Deck Lab keeps a tuned or bred list (ROADMAP2 §13 goal 1): "Overwrite" (the saved deck takes the new list and
// keeps its place; the list it replaces is kept in its history so it can be put back, browserLibrary.ts overwriteCustom /
// putBackCustom) or "Save as a copy" (a new saved deck beside the original). Only a deck saved in this browser can be
// overwritten: a deck that ships with the site cannot, so for it, and for a pasted list, only the copy is offered and
// the screen says why (overwriteWhy). Pure: the page is src/ui/pages/DeckLab.tsx.
import type { LibraryDeck } from './library';

/** What a run started from, for the save choice. */
export type SaveSource =
  /** a deck saved in this browser: it can be overwritten */
  | { kind: 'saved'; name: string }
  /** a deck that ships with the site */
  | { kind: 'builtin'; name: string }
  /** a pasted list, or a bred deck none of whose parents is saved here */
  | { kind: 'none' };

const SAVED = 'custom:';

/** The source of a tuning run: the picked deck's file (undefined for a pasted list). */
export function tuneSource(file: string | undefined, lib: readonly Pick<LibraryDeck, 'file' | 'deck'>[]): SaveSource {
  if (!file) return { kind: 'none' };
  const d = lib.find((x) => x.file === file);
  if (!d) return { kind: 'none' };
  return file.startsWith(SAVED) ? { kind: 'saved', name: d.deck.name } : { kind: 'builtin', name: d.deck.name };
}

/**
 * The decks a bred deck can overwrite: its parents that are saved in this browser (normally none or one; a crossover
 * may have two). A parent that ships with the site is never one.
 */
export function bredTargets(parents: readonly string[], lib: readonly Pick<LibraryDeck, 'file' | 'deck'>[]): string[] {
  return parents.filter((p, i) => parents.indexOf(p) === i && lib.some((d) => d.file === `${SAVED}${p}`));
}

/** Why only "Save as a copy" is offered, in one sentence; null when Overwrite is offered too. */
export function overwriteWhy(s: SaveSource, what: 'tuned' | 'bred' = 'tuned'): string | null {
  if (s.kind === 'saved') return null;
  if (s.kind === 'builtin') return `“${s.name}” ships with the site, so it cannot be overwritten in this browser: the ${what} list is saved as a copy beside it.`;
  return what === 'bred'
    ? 'None of this deck’s parents is saved in this browser, so there is no deck to overwrite: it is saved as a new deck.'
    : 'This list was pasted in, not picked from your saved decks, so there is no deck to overwrite: it is saved as a new deck.';
}

/**
 * The name a copy is saved under: `want` when no deck has it, else `want (2)`, `want (3)`… A copy never replaces a deck,
 * built-in or saved here (a plain save under a saved deck's name would overwrite it).
 */
export function copyName(want: string, lib: readonly Pick<LibraryDeck, 'deck'>[]): string {
  const base = want.trim().slice(0, 80) || 'My deck';
  const taken = new Set(lib.map((d) => d.deck.name));
  if (!taken.has(base)) return base;
  for (let k = 2; ; k++) {
    const cand = `${base} (${k})`;
    if (!taken.has(cand)) return cand;
  }
}

/** The Overwrite confirm dialog's title and body. */
export function overwriteWords(name: string, what: 'tuned' | 'bred'): { title: string; body: string } {
  return {
    title: `Overwrite “${name}”?`,
    body: `“${name}” takes the ${what} list${what === 'tuned' ? ' and its tuning record' : ''} and keeps its name and its place in My decks. The list it has now is kept with the deck, and “Put back” restores it.`,
  };
}
