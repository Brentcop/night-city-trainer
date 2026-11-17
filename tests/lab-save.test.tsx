// The Deck Lab's two ways to keep a tuned or bred list (ROADMAP2 §13 goal 1; src/lib/labSave.ts,
// browserLibrary.ts overwriteCustom / putBackCustom, components/LabSaveChoice.tsx): Overwrite a deck saved here (it keeps
// its name and place, the replaced list is kept and can be put back) or Save as a copy (a new deck, the source left
// alone); a built-in or pasted source gets only the copy, with the reason. Server-rendered: there is no DOM here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { listFingerprint } from '../src/engine/deck';
import { allDecks, BUILTIN, CUSTOM_KEY, HISTORY_KEEP, LIBRARY_CHANGED, loadCustom, loadStored, overwriteCustom, putBackCustom, upsertCustom, type StoredDeck } from '../src/lib/browserLibrary';
import { adoptionProvenance, adoptionRule } from '../src/lib/evidence';
import { tunedRecord } from '../src/lib/tuneRecord';
import { tunedEntries } from '../src/lib/tunedDecks';
import { bredTargets, copyName, overwriteWhy, overwriteWords, tuneSource } from '../src/lib/labSave';
import { LabSaveChoice, LabSavedLine } from '../src/ui/components/LabSaveChoice';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
let changed = 0;
const onChanged = () => changed++;
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  changed = 0;
  vi.stubGlobal('window', { dispatchEvent: (e: Event) => (e.type === LIBRARY_CHANGED ? onChanged() : undefined), addEventListener: () => {}, removeEventListener: () => {} });
});
afterEach(() => vi.unstubAllGlobals());

const base = BUILTIN.find((d) => d.kind === 'meta')!;
const orig = base.deck;
// the tuned list: one main-deck card swapped for another card of the list
const swapped = { ...orig, main: [orig.main[1]!, ...orig.main.slice(1)] };
const rule = adoptionProvenance(adoptionRule(), { firstStage: 112, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 });
const recordFor = (original: { name: string; file?: string; legends: string[]; main: string[] }, date: string) =>
  tunedRecord({ original, final: swapped, logs: [{ gen: 1, adopted: '−1 A → +1 B', swaps: [{ label: '−1 A → +1 B' }] }], partial: false, gens: 2, rule, manifest: null, bot: 'medium', fieldMode: 'deck-lab-tune:meta', fieldDeckIds: [], partnerAware: true, date });
const tunedStored = (original: { name: string; file?: string; legends: string[]; main: string[] }, date = '2026-11-17T10:00:00.000Z'): StoredDeck => ({
  ...swapped,
  sideboard: [],
  notes: 'Deck Lab adopted: −1 A → +1 B.',
  tuned: recordFor(original, date),
});

describe('what can be overwritten', () => {
  it('a deck saved here can; a built-in deck or a pasted list cannot, and the screen says why', () => {
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [] })).toBe(true);
    const lib = allDecks();
    expect(tuneSource('custom:Mine', lib)).toEqual({ kind: 'saved', name: 'Mine' });
    expect(tuneSource(base.file, lib)).toEqual({ kind: 'builtin', name: orig.name });
    expect(tuneSource(undefined, lib)).toEqual({ kind: 'none' });
    expect(overwriteWhy({ kind: 'saved', name: 'Mine' })).toBeNull();
    expect(overwriteWhy({ kind: 'builtin', name: orig.name })).toBe(`“${orig.name}” ships with the site, so it cannot be overwritten in this browser: the tuned list is saved as a copy beside it.`);
    expect(overwriteWhy({ kind: 'none' })).toMatch(/^This list was pasted in/);
    expect(overwriteWhy({ kind: 'none' }, 'bred')).toMatch(/^None of this deck’s parents is saved/);
  });
  it('a bred deck can overwrite only its parents saved here', () => {
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [] })).toBe(true);
    expect(bredTargets([orig.name, 'Mine', 'Mine', 'Gone'], allDecks())).toEqual(['Mine']);
    expect(bredTargets([orig.name], allDecks())).toEqual([]);
  });
});

describe('Save as a copy', () => {
  it('adds a new deck under a name no deck has, keeps the record, and leaves the source alone', () => {
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [], notes: 'my notes' })).toBe(true);
    expect(upsertCustom({ ...orig, name: 'Mine (tuned)', sideboard: [] })).toBe(true);
    const before = loadStored().find((d) => d.name === 'Mine')!;
    const name = copyName('Mine (tuned)', allDecks());
    expect(name).toBe('Mine (tuned) (2)');
    expect(copyName(orig.name, allDecks())).toBe(`${orig.name} (2)`); // never a built-in deck's name
    expect(upsertCustom({ ...tunedStored({ ...orig, name: 'Mine', file: 'custom:Mine' }), name })).toBe(true);
    const stored = loadStored();
    expect(stored.map((d) => d.name)).toEqual(['Mine', 'Mine (tuned)', 'Mine (tuned) (2)']);
    expect(stored[0]).toEqual(before);
    const copy = stored[2]!;
    expect(copy.tuned?.original).toEqual({ name: 'Mine', file: 'custom:Mine', listId: listFingerprint(orig) });
    expect(copy.tuned?.final.listId).toBe(listFingerprint(swapped));
    expect(copy.history).toBeUndefined();
    expect(tunedEntries(allDecks()).map((e) => e.deck.deck.name)).toEqual(['Mine (tuned) (2)']);
  });
  it('the copy of a built-in deck names its file in the record', () => {
    const name = copyName(`${orig.name} (tuned)`, allDecks());
    expect(upsertCustom({ ...tunedStored({ ...orig, file: base.file }), name })).toBe(true);
    expect(loadStored()[0]?.tuned?.original.file).toBe(base.file);
  });
});

describe('Overwrite', () => {
  it('the saved deck takes the tuned list and record, keeps its name, place, date and origin, and keeps the list it replaces', () => {
    expect(upsertCustom({ ...orig, name: 'First', sideboard: [] })).toBe(true);
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [], notes: 'my notes', origin: 'created', added: '2026-11-01T00:00:00.000Z' })).toBe(true);
    expect(upsertCustom({ ...orig, name: 'Last', sideboard: [] })).toBe(true);
    changed = 0;
    const next = tunedStored({ ...orig, name: 'Mine', file: 'custom:Mine' });
    expect(overwriteCustom('Mine', { ...next, name: 'ignored' }, 'tune', new Date('2026-11-17T11:00:00.000Z'))).toBe('ok');
    expect(changed).toBe(1); // LIBRARY_CHANGED
    const stored = loadStored();
    expect(stored.map((d) => d.name)).toEqual(['First', 'Mine', 'Last']);
    const mine = stored[1]!;
    expect(listFingerprint(mine)).toBe(listFingerprint(swapped));
    expect(mine.tuned).toEqual(next.tuned);
    expect(mine.notes).toBe(next.notes);
    expect(mine.added).toBe('2026-11-01T00:00:00.000Z');
    expect(mine.origin).toBe('created');
    expect(mine.history).toHaveLength(1);
    expect(mine.history![0]).toMatchObject({ name: 'Mine', notes: 'my notes', replaced: '2026-11-17T11:00:00.000Z', by: 'tune' });
    expect(listFingerprint(mine.history![0]!)).toBe(listFingerprint(orig));
    // the library view carries the list, not the history; the tuned decks page lists it under its own name
    expect(loadCustom().find((d) => d.deck.name === 'Mine')!.deck).not.toHaveProperty('history');
    expect(tunedEntries(allDecks()).map((e) => e.deck.deck.name)).toEqual(['Mine']);
    // a later plain save (the deck editor) keeps the history
    expect(upsertCustom({ ...mine, history: undefined })).toBe(true);
    expect(loadStored().find((d) => d.name === 'Mine')!.history).toHaveLength(1);
  });
  it('Put back restores the replaced list with its own notes and record, and the deck keeps its place', () => {
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [], notes: 'my notes' })).toBe(true);
    expect(upsertCustom({ ...orig, name: 'Other', sideboard: [] })).toBe(true);
    const first = tunedStored({ ...orig, name: 'Mine', file: 'custom:Mine' }, '2026-11-17T10:00:00.000Z');
    expect(overwriteCustom('Mine', first, 'tune')).toBe('ok');
    const second: StoredDeck = { ...orig, name: 'x', sideboard: [], notes: 'bred' };
    expect(overwriteCustom('Mine', second, 'breed')).toBe('ok');
    let mine = loadStored()[0]!;
    expect(mine.tuned).toBeUndefined(); // a bred list carries no tuning record; the replaced one is kept in the history
    expect(mine.history!.map((v) => v.by)).toEqual(['breed', 'tune']);
    expect(mine.history![0]!.tuned).toEqual(first.tuned);
    expect(putBackCustom('Mine')).toBe('ok');
    mine = loadStored()[0]!;
    expect(loadStored().map((d) => d.name)).toEqual(['Mine', 'Other']);
    expect(mine.tuned).toEqual(first.tuned);
    expect(mine.notes).toBe(first.notes);
    expect(mine).not.toHaveProperty('replaced');
    expect(putBackCustom('Mine')).toBe('ok');
    mine = loadStored()[0]!;
    expect(mine.notes).toBe('my notes');
    expect(mine.tuned).toBeUndefined();
    expect(mine.history).toBeUndefined();
    expect(putBackCustom('Mine')).toBe('missing');
  });
  it('keeps at most HISTORY_KEEP lists, and refuses a deck that is not saved here (nothing written)', () => {
    expect(upsertCustom({ ...orig, name: 'Mine', sideboard: [] })).toBe(true);
    for (let i = 0; i < HISTORY_KEEP + 2; i++) expect(overwriteCustom('Mine', { ...orig, name: 'Mine', sideboard: [], notes: `v${i}` }, 'tune')).toBe('ok');
    expect(loadStored()[0]!.history).toHaveLength(HISTORY_KEEP);
    const raw = localStorage.getItem(CUSTOM_KEY);
    expect(overwriteCustom(orig.name, { ...orig, name: orig.name, sideboard: [] }, 'tune')).toBe('missing');
    expect(localStorage.getItem(CUSTOM_KEY)).toBe(raw);
  });
  it('a malformed history entry is dropped on read, the deck kept', () => {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([{ ...orig, name: 'Mine', history: [{ name: 'Mine', legends: [], main: [], replaced: 'never', by: 'tune' }, { ...orig, name: 'Mine', replaced: '2026-11-17T00:00:00.000Z', by: 'tune', history: [{}] }] }]));
    const h = loadStored()[0]!.history!;
    expect(h).toHaveLength(1);
    expect(h[0]).not.toHaveProperty('history');
  });
});

describe('the choice on screen', () => {
  const props = { what: 'tuned' as const, overwriteLabel: (n: string) => `💾 Overwrite “${n}”`, copyLabel: '💾 Save as a copy', primary: 'copy' as const, onOverwrite: () => {}, onCopy: () => {} };
  it('a saved source: Overwrite and Save as a copy, no reason line', () => {
    const html = renderToStaticMarkup(<LabSaveChoice {...props} targets={['Mine']} why={null} />);
    expect(html).toContain('Overwrite “Mine”');
    expect(html).toContain('Save as a copy');
    expect(html).not.toContain('ships with the site');
  });
  it('a built-in source: only Save as a copy, and why', () => {
    const why = overwriteWhy({ kind: 'builtin', name: orig.name });
    const html = renderToStaticMarkup(<LabSaveChoice {...props} targets={[]} why={why} />);
    expect(html).not.toContain('Overwrite');
    expect(html).toContain('Save as a copy');
    expect(html).toContain('ships with the site, so it cannot be overwritten in this browser');
  });
  it('the confirm words and the saved line', () => {
    expect(overwriteWords('Mine', 'tuned')).toEqual({
      title: 'Overwrite “Mine”?',
      body: '“Mine” takes the tuned list and its tuning record and keeps its name and its place in My decks. The list it has now is kept with the deck, and “Put back” restores it.',
    });
    expect(renderToStaticMarkup(<LabSavedLine saved={{ name: 'Mine', how: 'overwrite' }} onPutBack={() => {}} />)).toContain('Put back the earlier list');
    expect(renderToStaticMarkup(<LabSavedLine saved={{ name: 'Mine (tuned)', how: 'copy' }} onPutBack={() => {}} />)).not.toContain('Put back');
  });
});
