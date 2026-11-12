// Built-in decks hidden in this browser. Built-in decks ship with the site and cannot be deleted from a browser, so
// they can be hidden instead: a hidden deck leaves the gallery and the deck pickers (unless "Show hidden" is on, or it
// is the one already picked) but stays reachable by link and still appears in events and ratings where it played.
// Per browser (localStorage), keyed by library file; storage that is blocked just means nothing is hidden.
import { notifyLibraryChanged } from './browserLibrary';

export const HIDDEN_KEY = 'nct.hiddenDecks.v1';

/** The library files hidden in this browser. */
export function loadHidden(): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

/** Hide (or unhide) built-in decks by file. Returns false if the change could not be saved. */
export function setHidden(files: readonly string[], hidden: boolean): boolean {
  const cur = loadHidden();
  for (const f of files) {
    if (f.startsWith('custom:')) continue; // decks saved in this browser are deleted, not hidden
    if (hidden) cur.add(f);
    else cur.delete(f);
  }
  try {
    if (cur.size) localStorage.setItem(HIDDEN_KEY, JSON.stringify([...cur].sort()));
    else localStorage.removeItem(HIDDEN_KEY);
  } catch {
    return false;
  }
  notifyLibraryChanged();
  return true;
}

export const isHidden = (file: string, hidden: ReadonlySet<string> = loadHidden()) => hidden.has(file);
