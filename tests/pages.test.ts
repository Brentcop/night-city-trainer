// Pure helpers behind the pages: deck lookups (APP-3, APP-4) and tournament input checks (APP-6, APP-9).
import { describe, expect, it } from 'vitest';
import type { LibraryDeck } from '../src/lib/library';
import { byName, customSaveName, deckByFile, isBuiltin, searchDeck } from '../src/ui/deckLookup';
import { draftLinkQuery, isEvent, parseEventId, parseRunParams, parseRuns, runParamsQuery, toEvent, type RunParams } from '../src/ui/runParams';
import { DEFAULT_DRAFT, entrantsFromList, entrantsToList, type EventDraft } from '../src/lib/eventDraft';

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
  it('the setup link builder is the inverse of the parser', () => {
    const all = ['hard', 'mixed', 'medium', 'easy'];
    const deckLists = [['a.txt'], ['a.txt', 'a.txt*2', 'b.txt'], ['meta-x.txt', 'custom:y', 'z.txt*16']];
    let checked = 0;
    for (const decks of deckLists)
      for (const rounds of ['auto', 1, 4, 12] as const)
        for (const top of [0, 4, 8, 16])
          for (const bestOf of [1, 3, 5] as const)
            for (const bot of [...all, null])
              for (const seed of [1, 77, 123456, 2 ** 31 - 1, null])
                for (const format of ['swiss', 'round-robin'] as const) {
                  const p: RunParams = { field: 'custom', decks, rounds, top, bestOf, format, bot, seed };
                  expect(parseRunParams(runParamsQuery(p), all)).toEqual(p);
                  checked++;
                }
    expect(checked).toBe(3 * 4 * 4 * 3 * 5 * 5 * 2);
    // the other fields, and no deck list at all
    for (const field of ['meta', 'ladder', 'top16', 'original', 'guide', 'all'] as const) {
      const p: RunParams = { field, decks: null, rounds: 'auto', top: 8, bestOf: 3, format: 'swiss', bot: null, seed: null };
      expect(parseRunParams(runParamsQuery(p), all)).toEqual(p);
      expect(runParamsQuery(p).toString()).toBe(`f=${field}&fmt=swiss&t=8&bo=3`);
    }
  });
  it('the runner\'s "Copy setup link" query is unchanged', () => {
    const draft: EventDraft = { ...DEFAULT_DRAFT, entrants: entrantsFromList(['meta-a.txt', 'meta-a.txt*2', 'b c.txt']), format: 'swiss', top: 4, bestOf: 1 };
    // the inline code the runner used before the builder
    const before = (d: EventDraft, bot: string, seed: number) => {
      const p = new URLSearchParams({ f: 'custom', d: entrantsToList(d.entrants).join(','), fmt: d.format, t: String(d.top), bo: String(d.bestOf), bot, s: String(seed) });
      if (d.rounds !== 'auto') p.set('r', String(d.rounds));
      return p.toString();
    };
    const drafts: EventDraft[] = [draft, { ...draft, rounds: 6 }, { ...draft, entrants: [] }, { ...draft, format: 'matches', bestOf: 5 }];
    for (const d of drafts)
      for (const [bot, seed] of [['hard', 1], ['easy', 2 ** 31 - 1]] as const) expect(draftLinkQuery(d, bot, seed).toString()).toBe(before(d, bot, seed));
    expect(draftLinkQuery(draft, 'hard', 42).toString()).toBe('f=custom&d=meta-a.txt%2Cmeta-a.txt*2%2Cb+c.txt&fmt=swiss&t=4&bo=1&bot=hard&s=42');
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
