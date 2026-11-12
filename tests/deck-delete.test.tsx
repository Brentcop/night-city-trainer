// Deleting decks saved in this browser (with a confirm dialog and Undo) and hiding built-in ones, and what refers to
// them afterwards: the cached library, the deck pickers, the practice defaults and an open profile.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { allDecks, BUILTIN, deleteCustomDecks, loadStored, restoreCustom, upsertCustom, CUSTOM_KEY } from '../src/lib/browserLibrary';
import { HIDDEN_KEY, loadHidden, setHidden } from '../src/lib/hiddenDecks';
import { DeckPicker, findDeck, firstVisibleDeck } from '../src/ui/components/DeckPicker';
import { DeleteDialog, deleteWords, UndoToast } from '../src/ui/components/DeckActions';
import { DeckProfilePage, DeckMissing } from '../src/ui/pages/DeckProfile';
import { setArtEnabled } from '../src/ui/art';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const src = BUILTIN[0]!.deck;
const save = (name: string) => expect(upsertCustom({ ...src, name, sideboard: [] })).toBe(true);

describe('deleting saved decks', () => {
  it('deletes several in one write and puts them back where they were on Undo', () => {
    ['A', 'B', 'C', 'D'].forEach(save);
    const removed = deleteCustomDecks(['B', 'D', 'not saved']);
    expect(removed?.map((r) => [r.deck.name, r.index])).toEqual([
      ['B', 1],
      ['D', 3],
    ]);
    expect(loadStored().map((d) => d.name)).toEqual(['A', 'C']);
    // the cached library follows the store
    expect(allDecks().some((d) => d.file === 'custom:B')).toBe(false);
    expect(findDeck('custom:B')).toBeUndefined();
    expect(restoreCustom(removed!)).toBe(true);
    expect(loadStored().map((d) => d.name)).toEqual(['A', 'B', 'C', 'D']);
    expect(findDeck('custom:B')?.deck.name).toBe('B');
  });
  it('Undo keeps a deck saved again under the same name since the delete', () => {
    save('A');
    const removed = deleteCustomDecks(['A'])!;
    expect(upsertCustom({ ...src, name: 'A', main: src.main.slice(1), sideboard: [] })).toBe(true);
    expect(restoreCustom(removed)).toBe(true);
    expect(loadStored().filter((d) => d.name === 'A')).toHaveLength(1);
    expect(loadStored()[0]!.main).toHaveLength(src.main.length - 1);
  });
  it('a blocked store deletes nothing and says so (null)', () => {
    save('A');
    const ls = localStorage as unknown as { setItem: (k: string, v: string) => void };
    ls.setItem = () => {
      throw new Error('quota');
    };
    expect(deleteCustomDecks(['A'])).toBeNull();
    expect(loadStored().map((d) => d.name)).toEqual(['A']);
  });
  it('the confirm dialog names the deck, says it cannot be undone after the Undo window, and focuses Cancel', () => {
    expect(deleteWords(['My deck'])).toEqual({
      title: 'Delete “My deck”?',
      body: 'It is removed from this browser’s storage, with any Deck Lab record saved with it. You get 8 seconds to undo; after that it cannot be undone.',
    });
    expect(deleteWords(['a', 'b']).title).toBe('Delete 2 decks?');
    const html = renderToStaticMarkup(<DeleteDialog names={['a', 'b']} onConfirm={() => undefined} onCancel={() => undefined} />);
    expect(html).toMatch(/role="dialog"/);
    expect(html).toMatch(/aria-modal="true"/);
    const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
    expect(html).toContain(`id="${id}"`);
    expect(html).toMatch(/<button[^>]*data-autofocus[^>]*>Cancel/);
    expect(html).toContain('<li>a</li>');
    const toast = renderToStaticMarkup(<UndoToast toast={{ text: 'Deleted “a”.' }} onUndo={() => undefined} onClose={() => undefined} />);
    expect(toast).toMatch(/role="status"/);
    expect(toast).toContain('>Undo<');
  });
});

describe('hiding built-in decks', () => {
  const [a, b] = [BUILTIN[0]!.file, BUILTIN[1]!.file];
  it('per browser, by file; saved decks are never hidden (they are deleted)', () => {
    expect(setHidden([a, 'custom:X'], true)).toBe(true);
    expect([...loadHidden()]).toEqual([a]);
    expect(setHidden([a], false)).toBe(true);
    expect(localStorage.getItem(HIDDEN_KEY)).toBeNull();
    localStorage.setItem(HIDDEN_KEY, '{oops');
    expect(loadHidden().size).toBe(0);
  });
  it('hidden decks leave the pickers (unless picked) and the practice defaults, but stay reachable by link', () => {
    setHidden([a], true);
    const html = renderToStaticMarkup(<DeckPicker value={b} onChange={() => undefined} />);
    expect(html).not.toContain(`value="${a}"`);
    const picked = renderToStaticMarkup(<DeckPicker value={a} onChange={() => undefined} />);
    expect(picked).toContain(`value="${a}"`);
    expect(picked).toContain('(hidden)');
    expect(firstVisibleDeck()?.file).toBe(b);
    expect(firstVisibleDeck(b)?.file).not.toBe(a);
    expect(findDeck(a)?.file).toBe(a);
    expect(renderToStaticMarkup(<DeckProfilePage file={a} />)).toContain('hidden in this browser');
  });
  it('a picker whose deck was deleted says so instead of showing another deck', () => {
    const html = renderToStaticMarkup(<DeckPicker value="custom:Gone" onChange={() => undefined} />);
    expect(html).toMatch(/<option value="custom:Gone"[^>]*disabled=""[^>]*>“Gone” \(deleted from this browser\)<\/option>/);
  });
});

describe('profile of a deleted deck', () => {
  it('says the deck is not saved in this browser, with links back', () => {
    save('Temp');
    expect(renderToStaticMarkup(<DeckProfilePage file="custom:Temp" />)).toContain('🗑 Delete');
    localStorage.setItem(CUSTOM_KEY, '[]');
    const html = renderToStaticMarkup(<DeckProfilePage file="custom:Temp" />);
    expect(html).toContain('This deck is not saved in this browser');
    expect(html).toContain('href="#/decks"');
    expect(renderToStaticMarkup(<DeckMissing file="custom:Temp" deletedHere />)).toContain('This deck was deleted');
    expect(renderToStaticMarkup(<DeckProfilePage file="nope.txt" />)).toContain('Deck not found');
  });
  it('built-in decks offer Hide, not Delete', () => {
    const html = renderToStaticMarkup(<DeckProfilePage file={BUILTIN[0]!.file} />);
    expect(html).toContain('Hide from gallery');
    expect(html).not.toContain('🗑 Delete');
  });
});
