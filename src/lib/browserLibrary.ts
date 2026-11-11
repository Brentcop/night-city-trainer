// Deck library for the browser: built-in decks (bundled from data/decks) + custom decks in localStorage.
import { deckFromText, type LibraryDeck } from './library';
import type { DeckList } from '../engine/types';
import type { RunManifest } from './runManifest';

// data/decks/**/history/ holds superseded lists; they are not bundled.
const files = import.meta.glob(['../../data/decks/**/*.txt', '!**/history/**'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const KIND_ORDER = ['meta', 'ladder', 'original', 'guide', 'custom'];
export const BUILTIN: LibraryDeck[] = Object.entries(files)
  .map(([path, text]) => {
    const file = path.split('/').pop()!;
    return deckFromText(file, text, path.includes('/custom/') ? 'custom' : undefined);
  })
  .sort((a, b) => (a.kind === b.kind ? a.deck.name.localeCompare(b.deck.name) : KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)));

export const CUSTOM_KEY = 'nct.customDecks.v1';
/** The raw stored string, kept the first time a load finds entries it has to drop (so a later save can't lose them for good). */
export const CUSTOM_BACKUP_KEY = 'nct.customDecks.v1.backup';

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isManifest = (v: unknown): v is RunManifest => !!v && typeof v === 'object' && typeof (v as RunManifest).schema === 'number' && typeof (v as RunManifest).runId === 'string';

/** A saved custom deck; Deck Lab results also keep the manifest of the run that produced or tested them. */
export type StoredDeck = DeckList & { manifest?: RunManifest };

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
  return readStored().map(({ manifest, ...deck }) => ({
    file: `custom:${deck.name}`,
    deck,
    kind: 'custom' as const,
    prov: { origin: 'My deck (saved in this browser)', source: deck.source },
    ...(manifest ? { manifest } : {}),
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

export function allDecks(): LibraryDeck[] {
  return [...BUILTIN, ...loadCustom()];
}
