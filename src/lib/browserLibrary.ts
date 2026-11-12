// Deck library for the browser: built-in decks (bundled from data/decks) + custom decks in localStorage.
import { libraryDeck, type LibraryDeck } from './library';
import type { DeckList } from '../engine/types';
import type { RunManifest } from './runManifest';
import { isTunedRecord, type TunedDeckRecord } from './tuneRecord';

// The library's folders (LIBRARY_DIRS in src/lib/library.ts, which libraryDeck() enforces): the glob has to be a literal,
// so it names the same two folders and leaves out custom/history/ and archive/ (see its README).
const DECKS_DIR = '../../data/decks/';
const files = import.meta.glob(['../../data/decks/*.txt', '../../data/decks/custom/*.txt'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const KIND_ORDER = ['meta', 'ladder', 'original', 'guide', 'custom'];
export const BUILTIN: LibraryDeck[] = Object.entries(files)
  .flatMap(([path, text]) => libraryDeck(path.slice(DECKS_DIR.length), text) ?? [])
  .sort((a, b) => (a.kind === b.kind ? a.deck.name.localeCompare(b.deck.name) : KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)));

export const CUSTOM_KEY = 'nct.customDecks.v1';
/** The raw stored string, kept the first time a load finds entries it has to drop (so a later save can't lose them for good). */
export const CUSTOM_BACKUP_KEY = 'nct.customDecks.v1.backup';

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isManifest = (v: unknown): v is RunManifest => !!v && typeof v === 'object' && typeof (v as RunManifest).schema === 'number' && typeof (v as RunManifest).runId === 'string';

/**
 * A saved custom deck; Deck Lab results also keep the manifest of the run that produced or tested them, and a tuned list
 * its tuning record (src/lib/tuneRecord.ts: original and final list ids, each adopted change, the final list against
 * the original, the rule, field, bot and date).
 */
export type StoredDeck = DeckList & { manifest?: RunManifest; tuned?: TunedDeckRecord };

/** A stored entry as a DeckList, or null if its shape is wrong. A missing sideboard (older saves) counts as empty. */
function toDeck(v: unknown): StoredDeck | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const sideboard = o.sideboard === undefined ? [] : o.sideboard;
  if (typeof o.name !== 'string' ||!isStringArray(o.legends) || !isStringArray(o.main) || !isStringArray(sideboard)) return null;
  const deck: StoredDeck = { name: o.name, legends: o.legends, main: o.main, sideboard };
  if (typeof o.source === 'string') deck.source = o.source;
  if (typeof o.notes === 'string') deck.notes = o.notes;
  if (isManifest(o.manifest)) deck.manifest = o.manifest;
  if (isTunedRecord(o.tuned)) deck.tuned = o.tuned;
  return deck;
}

/** Read the stored custom decks, dropping malformed entries; backs up the raw string the first time anything is dropped. */
function readStored(): StoredDeck[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(CUSTOM_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  const entries = Array.isArray(parsed) ? parsed : [];
  const decks = entries.map(toDeck).filter((d): d is StoredDeck => d !== null);
  if (!Array.isArray(parsed) || decks.length !== entries.length) {
    try {
      if (localStorage.getItem(CUSTOM_BACKUP_KEY) === null) localStorage.setItem(CUSTOM_BACKUP_KEY, raw);
    } catch {
      /* storage unavailable or full: nothing more we can do */
    }
  }
  return decks;
}

export function loadCustom(): LibraryDeck[] {
  return readStored().map(({ manifest, tuned, ...deck }) => ({
    file: `custom:${deck.name}`,
    deck,
    kind: 'custom' as const,
    prov: { origin: 'My deck (saved in this browser)', source: deck.source },
    ...(manifest ? { manifest } : {}),
    ...(tuned ? { tuned } : {}),
  }));
}

/** Replace the stored custom decks. Returns false if the browser refused (storage unavailable or quota exceeded). */
export function saveCustom(decks: StoredDeck[]): boolean {
  readStored(); // backs up a corrupt store before it is overwritten
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(decks));
    return true;
  } catch {
    return false;
  }
}

/** Save a custom deck, replacing any with the same name (and that deck's manifest). Returns false if it could not be saved. */
export function upsertCustom(deck: StoredDeck): boolean {
  const all = readStored().filter((d) => d.name !== deck.name);
  all.push(deck);
  return saveCustom(all);
}

/** Delete a custom deck by name. Returns false if the change could not be saved. */
export function deleteCustom(name: string): boolean {
  return saveCustom(readStored().filter((d) => d.name !== name));
}

let cache: { raw: string | null; decks: readonly LibraryDeck[] } | null = null;

/**
 * Built-in decks, then the custom decks saved in this browser. Pages call this freely during render, so the parsed
 * list is cached against the stored string: while localStorage holds the same text, every call returns the same
 * (read-only) array, and any change (a save here, in another tab, or by hand) is picked up on the next call.
 */
export function allDecks(): readonly LibraryDeck[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(CUSTOM_KEY);
  } catch {
    raw = null;
  }
  if (!cache || cache.raw !== raw) cache = { raw, decks: [...BUILTIN, ...loadCustom()] };
  return cache.decks;
}
