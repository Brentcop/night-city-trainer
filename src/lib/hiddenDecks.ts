// Built-in decks hidden in this browser. Built-in decks ship with the site and cannot be deleted from a browser, so
// they can be hidden instead: a hidden deck leaves the gallery and the deck pickers (unless "Show hidden" is on, or it
// is the one already picked) but stays reachable by link and still appears in events and ratings where it played.
// Per browser (localStorage), keyed by library file; storage that is blocked just means nothing is hidden.
// The site owner can hide decks for everyone by default (decks.hidden in the site config, src/lib/siteConfig.ts): those
// count as hidden here too, and a visitor who unhides one is remembered under SHOWN_KEY, so their choice wins.
import { notifyLibraryChanged } from './browserLibrary';

export const HIDDEN_KEY = 'nct.hiddenDecks.v1';
/** Decks the site config hides that this browser chose to show. */
export const SHOWN_KEY = 'nct.shownDecks.v1';

let siteHidden: ReadonlySet<string> = new Set();
/** The decks the site config hides by default (set by src/ui/useSiteConfig.ts). */
export function setSiteHiddenDecks(files: readonly string[]): void {
  siteHidden = new Set(files);
}

function readList(key: string): Set<string> {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    return new Set(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}
function writeList(key: string, s: Set<string>): void {
  if (s.size) localStorage.setItem(key, JSON.stringify([...s].sort()));
  else localStorage.removeItem(key);
}

/** The library files hidden in this browser: the visitor's own, plus the site's default ones they have not unhidden. */
export function loadHidden(): Set<string> {
  const own = readList(HIDDEN_KEY);
  if (!siteHidden.size) return own;
  const shown = readList(SHOWN_KEY);
  for (const f of siteHidden) if (!shown.has(f)) own.add(f);
  return own;
}

/** Hide (or unhide) built-in decks by file. Returns false if the change could not be saved. */
export function setHidden(files: readonly string[], hidden: boolean): boolean {
  const cur = readList(HIDDEN_KEY);
  const shown = readList(SHOWN_KEY);
  for (const f of files) {
    if (f.startsWith('custom:')) continue; // decks saved in this browser are deleted, not hidden
    if (hidden) {
      cur.add(f);
      shown.delete(f);
    } else {
      cur.delete(f);
      if (siteHidden.has(f)) shown.add(f);
    }
  }
  try {
    writeList(HIDDEN_KEY, cur);
    writeList(SHOWN_KEY, shown);
  } catch {
    return false;
  }
  notifyLibraryChanged();
  return true;
}

export const isHidden = (file: string, hidden: ReadonlySet<string> = loadHidden()) => hidden.has(file);
