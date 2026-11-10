// Deck library for the browser: built-in decks (bundled from data/decks) + custom decks in localStorage.
import { deckFromText, type LibraryDeck } from './library';
import { exportChoom } from '../engine/deck';
import type { DeckList } from '../engine/types';

const files = import.meta.glob('../../data/decks/**/*.txt', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const KIND_ORDER = ['meta', 'original', 'guide', 'custom'];
export const BUILTIN: LibraryDeck[] = Object.entries(files)
  .filter(([path]) => !path.includes('/history/'))
  .map(([path, text]) => {
    const file = path.split('/').pop()!;
    return deckFromText(file, text, path.includes('/custom/') ? 'custom' : undefined);
  })
  .sort((a, b) => (a.kind === b.kind ? a.deck.name.localeCompare(b.deck.name) : KIND_ORDER.indexOf(a.kind) - KIND_ORDER.indexOf(b.kind)));

const KEY = 'nct.customDecks.v1';

export function loadCustom(): LibraryDeck[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return (JSON.parse(raw) as DeckList[]).map((deck) => ({
      file: `custom:${deck.name}`,
      deck,
      kind: 'custom' as const,
      prov: { origin: 'My deck (saved in this browser)', source: deck.source },
    }));
  } catch {
    return [];
  }
}

export function saveCustom(decks: DeckList[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(decks));
  } catch {
    /* storage unavailable */
  }
}

export function upsertCustom(deck: DeckList) {
  const all = loadCustom().map((d) => d.deck).filter((d) => d.name !== deck.name);
  all.push(deck);
  saveCustom(all);
}

export function deleteCustom(name: string) {
  saveCustom(loadCustom().map((d) => d.deck).filter((d) => d.name !== name));
}

export function allDecks(): LibraryDeck[] {
  return [...BUILTIN, ...loadCustom()];
}

export function deckKey(d: LibraryDeck) {
  return d.kind === 'custom' && d.file.startsWith('custom:') ? d.file : d.file;
}

export { exportChoom };
