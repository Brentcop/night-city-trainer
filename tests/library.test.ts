import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import cards from '../src/data/cards.json';
import { parseDeck, validateDeck } from '../src/engine/deck';
import { SCRIPTS } from '../src/engine/scripts';
import { CUSTOM_BACKUP_KEY, CUSTOM_KEY, deleteCustom, loadCustom, saveCustom, upsertCustom } from '../src/lib/browserLibrary';
import type { DeckList } from '../src/engine/types';

const CARD_IDS = new Set((cards as { id: string }[]).map((c) => c.id));

function deckFiles(dir = 'data/decks'): string[] {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? deckFiles(path.join(dir, e.name)) : e.name.endsWith('.txt') ? [path.join(dir, e.name)] : []))
    .sort();
}

/**
 * Decks allowed to fail validateDeck, with the reason. Keep this short: a new entry needs a reason a reviewer accepts.
 * BBB-running-and-dancing.txt: the source list (choom.gg guide) has a 3-card sideboard; tournament sideboards are exactly 7.
 */
const LEGALITY_EXCEPTIONS: Record<string, RegExp> = {
  'BBB-running-and-dancing.txt': /^Tournament sideboard must be exactly 7 \(has 3\)\.$/,
};

describe('deck library (data/decks/**)', () => {
  const files = deckFiles();

  it('finds the library', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it.each(files)('%s parses with no errors and only known card ids', (f) => {
    const { deck, errors } = parseDeck(fs.readFileSync(f, 'utf8'), path.basename(f, '.txt'));
    expect(errors).toEqual([]);
    for (const id of [...deck.legends, ...deck.main, ...deck.sideboard]) expect(CARD_IDS.has(id), id).toBe(true);
  });

  it.each(files)('%s is tournament legal', (f) => {
    const { deck } = parseDeck(fs.readFileSync(f, 'utf8'), path.basename(f, '.txt'));
    const allowed = LEGALITY_EXCEPTIONS[path.basename(f)];
    const errs = validateDeck(deck).filter((e) => !allowed?.test(e));
    expect(errs).toEqual([]);
  });

  it('every legality exception still applies (remove stale entries)', () => {
    for (const [name, re] of Object.entries(LEGALITY_EXCEPTIONS)) {
      const f = files.find((x) => path.basename(x) === name);
      expect(f, name).toBeDefined();
      const errs = validateDeck(parseDeck(fs.readFileSync(f!, 'utf8')).deck);
      expect(errs.some((e) => re.test(e)), name).toBe(true);
    }
  });
});

describe('card scripts', () => {
  it('every script key is a real card id', () => {
    expect(Object.keys(SCRIPTS).filter((id) => !CARD_IDS.has(id))).toEqual([]);
  });

  it('every card in a library deck has a script, unless it only has keywords, reminder text and flavour', () => {
    // Keyword-only cards ({Blocker}, {Go Solo}, …) are handled by the engine from card data.
    const abilityText = (t = '') =>
      t
        .replace(/\[Flavou?r\][^\n]*/gi, '')
        .replace(/\{[^}]+\}/g, '')
        .replace(/\([^)]*\)/g, '')
        .trim();
    const byId = new Map((cards as { id: string; text?: string }[]).map((c) => [c.id, c]));
    const missing = new Set<string>();
    for (const f of deckFiles()) {
      const { deck } = parseDeck(fs.readFileSync(f, 'utf8'));
      for (const id of [...deck.legends, ...deck.main, ...deck.sideboard]) if (!SCRIPTS[id] && abilityText(byId.get(id)?.text)) missing.add(id);
    }
    expect([...missing]).toEqual([]);
  });
});

describe('custom decks in localStorage', () => {
  let store: Map<string, string>;
  let quotaExceeded: boolean;
  const good = (name: string): DeckList => ({ name, legends: ['a', 'b', 'c'], main: ['x', 'y'], sideboard: [] });

  beforeEach(() => {
    store = new Map();
    quotaExceeded = false;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (quotaExceeded) throw new DOMException('quota', 'QuotaExceededError');
        store.set(k, String(v));
      },
      removeItem: (k: string) => store.delete(k),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('round-trips saved decks', () => {
    expect(upsertCustom(good('One'))).toBe(true);
    expect(upsertCustom(good('Two'))).toBe(true);
    expect(upsertCustom({ ...good('One'), main: ['z'] })).toBe(true);
    expect(loadCustom().map((d) => [d.deck.name, d.deck.main])).toEqual([
      ['Two', ['x', 'y']],
      ['One', ['z']],
    ]);
    expect(deleteCustom('Two')).toBe(true);
    expect(loadCustom().map((d) => d.deck.name)).toEqual(['One']);
    expect(store.has(CUSTOM_BACKUP_KEY)).toBe(false);
  });

  it('drops malformed entries, keeps the good ones, and backs up the raw string before rewriting', () => {
    const raw = JSON.stringify([
      good('Keep me'),
      { ...good('x'), name: 42 },
      { name: 'No main', legends: [] },
      { ...good('Bad ids'), main: [1, 2] },
      null,
      'a string',
      { name: 'Old save without sideboard', legends: ['a'], main: ['b'] },
    ]);
    store.set(CUSTOM_KEY, raw);
    expect(loadCustom().map((d) => d.deck.name)).toEqual(['Keep me', 'Old save without sideboard']);
    expect(loadCustom()[1].deck.sideboard).toEqual([]);
    expect(store.get(CUSTOM_BACKUP_KEY)).toBe(raw);
    expect(upsertCustom(good('New'))).toBe(true);
    expect(loadCustom().map((d) => d.deck.name)).toEqual(['Keep me', 'Old save without sideboard', 'New']);
    expect(store.get(CUSTOM_BACKUP_KEY)).toBe(raw); // the first backup is never overwritten
  });

  it('backs up an unparseable or non-array store before it is overwritten', () => {
    store.set(CUSTOM_KEY, '{not json');
    expect(loadCustom()).toEqual([]);
    expect(saveCustom([good('A')])).toBe(true);
    expect(store.get(CUSTOM_BACKUP_KEY)).toBe('{not json');

    store.clear();
    store.set(CUSTOM_KEY, '{"name":"not an array"}');
    expect(saveCustom([good('A')])).toBe(true);
    expect(store.get(CUSTOM_BACKUP_KEY)).toBe('{"name":"not an array"}');
  });

  it('reports a failed save instead of swallowing it', () => {
    upsertCustom(good('Before'));
    quotaExceeded = true;
    expect(upsertCustom(good('After'))).toBe(false);
    expect(saveCustom([])).toBe(false);
    expect(deleteCustom('Before')).toBe(false);
    expect(loadCustom().map((d) => d.deck.name)).toEqual(['Before']);
  });

  it('survives storage that throws on read', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    });
    expect(loadCustom()).toEqual([]);
    expect(upsertCustom(good('x'))).toBe(false);
  });
});
