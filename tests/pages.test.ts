// Pure helpers behind the pages: deck lookups (APP-3, APP-4) and tournament input checks (APP-6, APP-9).
import { describe, expect, it } from 'vitest';
import type { LibraryDeck } from '../src/lib/library';
import { byName, customSaveName, deckByFile, isBuiltin, searchDeck } from '../src/ui/deckLookup';
import { isEvent, parseEventId, parseRunParams, parseRuns, toEvent } from '../src/ui/runParams';

const deck = (file: string, name: string, kind: LibraryDeck['kind'] = 'meta'): LibraryDeck => ({ file, kind, deck: { name, legends: [], main: [], sideboard: [] }, prov: {} });
// allDecks() order: built-ins first, then saved decks
const lib = [deck('meta-rrg-dexter.txt', 'RRG Dexter Midrange'), deck('nc-custom.txt', 'NC Build', 'custom'), deck('custom:RRG Dexter Midrange', 'RRG Dexter Midrange', 'custom'), deck('custom:Mine', 'Mine', 'custom')];

describe('deck lookups', () => {
  it('knows built-ins from saved decks (bundled custom/ decks are built-in)', () => {
    expect(lib.map(isBuiltin)).toEqual([true, true, false, false]);
  });
  it('name maps prefer the built-in deck, whatever the order', () => {
    expect(byName(lib).get('RRG Dexter Midrange')!.file).toBe('meta-rrg-dexter.txt');
    expect(byName([...lib].reverse()).get('RRG Dexter Midrange')!.file).toBe('meta-rrg-dexter.txt');
    expect(byName(lib).get('Mine')!.file).toBe('custom:Mine');
  });
  it('URL params match files exactly — no fuzzy fallback', () => {
    expect(deckByFile(lib, 'meta-rrg-dexter.txt')?.deck.name).toBe('RRG Dexter Midrange');
    expect(deckByFile(lib, 'dexter')).toBeUndefined();
    expect(deckByFile(lib, 'custom:Deleted deck')).toBeUndefined();
    expect(deckByFile(lib, '')).toBeUndefined();
    expect(deckByFile(lib, null)).toBeUndefined();
    // explicit search may still be loose
    expect(searchDeck(lib, 'dexter')?.file).toBe('meta-rrg-dexter.txt');
  });
  it('a saved deck cannot take a built-in name', () => {
    expect(customSaveName('My list', lib)).toBe('My list');
    expect(customSaveName('  Mine  ', lib)).toBe('Mine'); // overwriting your own saved deck is fine
    expect(customSaveName('RRG Dexter Midrange', lib)).toBe('RRG Dexter Midrange (my copy)');
    expect(customSaveName('NC Build', lib)).toBe('NC Build (my copy)');
    expect(customSaveName('X', [...lib, deck('x.txt', 'X'), deck('x2.txt', 'X (my copy)')])).toBe('X (my copy 2)');
    expect(customSaveName('   ', lib)).toBeNull();
  });
});

describe('tournament inputs', () => {
  const bots = ['easy', 'medium', 'hard'];
  it('setup-link params fall back on junk', () => {
    const p = parseRunParams(new URLSearchParams('f=nope&r=abc&t=7&bo=2&bot=godlike&s=-5&d='), bots);
    expect(p).toEqual({ field: 'meta', decks: null, rounds: 'auto', top: 8, bestOf: 3, format: 'swiss', bot: null, seed: null });
    const q = parseRunParams(new URLSearchParams('f=custom&r=4&t=16&bo=1&bot=hard&s=1234&d=a.txt,,b.txt'), bots);
    expect(q).toEqual({ field: 'custom', decks: ['a.txt', 'b.txt'], rounds: 4, top: 16, bestOf: 1, format: 'swiss', bot: 'hard', seed: 1234 });
    expect(parseRunParams(new URLSearchParams('fmt=round-robin&bo=5'), bots)).toMatchObject({ format: 'round-robin', bestOf: 5 });
    expect(parseRunParams(new URLSearchParams('fmt=knockout'), bots)).toMatchObject({ format: 'swiss' });
    expect(parseRunParams(new URLSearchParams('r=99&t=0'), bots)).toMatchObject({ rounds: 'auto', top: 0 });
  });
  it('event ids must be recorded events', () => {
    expect(parseEventId('3', [1, 2, 3])).toBe(3);
    expect(parseEventId('abc', [1, 2, 3])).toBeUndefined();
    expect(parseEventId('9', [1, 2, 3])).toBeUndefined();
    expect(parseEventId('2.5', [1, 2, 3])).toBeUndefined();
    expect(parseEventId(undefined, [1])).toBeUndefined();
  });
  const ev = {
    id: 'run-1',
    date: '2026-11-10',
    bot: 'medium',
    format: 'Swiss',
    decks: { A: { legends: [], main: [] } },
    rounds: [{ round: 1, matches: [{ a: 'A', b: null, games: [], score: [0, 0], winner: 'A' }] }],
    bracket: [],
    standings: [{ deck: 'A', mp: 3 }],
    champion: 'A',
  };
  it('event files and stored runs are checked before use', () => {
    expect(isEvent(ev)).toBe(true);
    expect(isEvent({ ...ev, bracket: undefined })).toBe(false);
    expect(toEvent({ ...ev, bracket: undefined })?.bracket).toEqual([]); // Swiss-only files are fine
    expect(toEvent({ ...ev, rounds: 'x' })).toBeNull();
    expect(toEvent({ ...ev, standings: undefined })).toBeNull();
    expect(toEvent([ev])).toBeNull();
    expect(toEvent(null)).toBeNull();
    expect(parseRuns(JSON.stringify([ev, { junk: 1 }, 5]))).toHaveLength(1);
    expect(parseRuns('{"not":"an array"}')).toEqual([]);
    expect(parseRuns('not json')).toEqual([]);
    expect(parseRuns(null)).toEqual([]);
  });
});
