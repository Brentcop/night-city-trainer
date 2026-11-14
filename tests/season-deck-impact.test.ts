// data/seasons/deck-impact.json keyed by list fingerprint (src/lib/seasonDeckImpact.ts): the old name-keyed file is
// refused, never misread; migration re-keys only names that match exactly one list; the breeder reads by fingerprint.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { addCards, breederDeckImpact, emptyDeckImpact, isLegacyDeckImpact, LEGACY_DECK_IMPACT, migrateDeckImpact, parseDeckImpact } from '../src/lib/seasonDeckImpact';
import { seedsOf } from '../src/ai/breeder';
import { listFingerprint } from '../src/engine/deck';
import { checkData } from '../scripts/check-data';
import { synthDecks } from './builder-fixtures';

const OLD = {
  'Deck A': { c1: { s: 3, n: 30 }, c2: { s: -1.5, n: 10 } },
  'Deck B': { c1: { s: 0.25, n: 50 } },
  'Gone deck': { c3: { s: 1, n: 40 } },
};

describe('season deck impact file', () => {
  it('refuses the old name-keyed file instead of reading its names as fingerprints', () => {
    expect(isLegacyDeckImpact(OLD)).toBe(true);
    expect(parseDeckImpact(OLD)).toEqual({ problem: LEGACY_DECK_IMPACT });
    // a name-keyed object dressed with the right header but name keys is refused too
    expect(parseDeckImpact({ ...emptyDeckImpact(), lists: { 'Deck A': { name: 'Deck A', cards: {} } } }).problem).toMatch(/not a list fingerprint/);
    expect(parseDeckImpact({ ...emptyDeckImpact(), schema: 2 }).problem).toMatch(/schema 2/);
    expect(parseDeckImpact(null).problem).toMatch(/not a deck-impact file/);
    expect(parseDeckImpact({ ...emptyDeckImpact(), lists: { '0123456789abcdef': { name: 'X', cards: { c: { s: 'a', n: 1 } } } } }).problem).toMatch(/cards of/);
    const ok = parseDeckImpact(JSON.parse(JSON.stringify({ ...emptyDeckImpact(), lists: { '0123456789abcdef': { name: 'X', cards: { c: { s: 1, n: 2 } }, keyedFrom: 'name' } } })));
    expect(ok.file?.lists['0123456789abcdef']?.cards.c).toEqual({ s: 1, n: 2 });
  });

  it('migrates by name only when exactly one list has it, keeping numbers and order, and never guesses the rest', () => {
    const lists = [
      { name: 'Deck A', fingerprint: 'aaaaaaaaaaaaaaaa', file: 'a.txt' },
      { name: 'Deck B', fingerprint: 'bbbbbbbbbbbbbbbb' },
      { name: 'Deck B', fingerprint: 'cccccccccccccccc' },
    ];
    const m = migrateDeckImpact(OLD, lists);
    expect(m.matched).toEqual([{ name: 'Deck A', fingerprint: 'aaaaaaaaaaaaaaaa', file: 'a.txt' }]);
    expect(m.unmatched.map((u) => u.name)).toEqual(['Deck B', 'Gone deck']);
    expect(m.file.lists).toEqual({ aaaaaaaaaaaaaaaa: { name: 'Deck A', cards: OLD['Deck A'], keyedFrom: 'name' } });
    expect(Object.keys(m.file.lists.aaaaaaaaaaaaaaaa!.cards)).toEqual(['c1', 'c2']);
    expect(m.file.unmatched?.['Gone deck']).toEqual({ cards: OLD['Gone deck'], why: 'no current library list has this name' });
    expect(m.file.unmatched?.['Deck B']?.why).toMatch(/2 different library lists/);
    expect(parseDeckImpact(JSON.parse(JSON.stringify(m.file))).file).toBeTruthy();
    // two old names for one list: the second is kept apart rather than merged
    const twin = migrateDeckImpact({ 'Deck A': OLD['Deck A'], 'Deck A again': OLD['Deck B'] }, [
      { name: 'Deck A', fingerprint: 'aaaaaaaaaaaaaaaa' },
      { name: 'Deck A again', fingerprint: 'aaaaaaaaaaaaaaaa' },
    ]);
    expect(twin.unmatched).toEqual([{ name: 'Deck A again', why: 'its list is the same as "Deck A", already keyed' }]);
  });

  it('pools reports by fingerprint and gives the breeder means over cards drawn in enough games', () => {
    const f = emptyDeckImpact();
    addCards(f, 'aaaaaaaaaaaaaaaa', 'Deck A', [
      { id: 'c1', iwd: 0.1, seenGames: 30 },
      { id: 'c2', iwd: Number.NaN, seenGames: 30 },
      { id: 'c3', iwd: 0.2, seenGames: 0 },
    ]);
    addCards(f, 'aaaaaaaaaaaaaaaa', 'Renamed A', [{ id: 'c1', iwd: -0.1, seenGames: 10 }]);
    expect(f.lists.aaaaaaaaaaaaaaaa).toEqual({ name: 'Deck A', cards: { c1: { s: 0.1 * 30 - 0.1 * 10, n: 40 } } });
    expect(breederDeckImpact(f, 40)).toEqual({ aaaaaaaaaaaaaaaa: { c1: (0.1 * 30 - 0.1 * 10) / 40 } });
    expect(breederDeckImpact(f, 41)).toEqual({ aaaaaaaaaaaaaaaa: {} });
  });

  it('the breeder reads a parent’s impact by its list, never by its name', () => {
    const [d] = synthDecks();
    const id = d!.main[0]!;
    const byList = { [listFingerprint(d!)]: { [id]: -0.2 } };
    // a card that loses games in this list is not carried over (weight 0); without numbers it gets the plain weight
    expect(seedsOf([d!], byList).get(id)).toBe(0);
    expect(seedsOf([{ ...d!, name: 'Renamed' }], byList).get(id)).toBe(0);
    expect(seedsOf([d!], { [d!.name]: { [id]: -0.2 } }).get(id)).toBeGreaterThan(0);
    // the same name with one more copy is another list: it does not inherit the numbers
    const changed = { ...d!, main: [...d!.main, id] };
    expect(listFingerprint(changed)).not.toBe(listFingerprint(d!));
    expect(seedsOf([changed], byList).get(id)).toBeGreaterThan(0);
  });

  it('check:data fails on the old name-keyed file and passes the committed one', () => {
    const base = { index: { events: [] }, events: [], h2h: null };
    expect(checkData({ ...base, deckImpact: OLD }).failures).toContain(`data/seasons/deck-impact.json ${LEGACY_DECK_IMPACT}`);
    const real = JSON.parse(fs.readFileSync('data/seasons/deck-impact.json', 'utf8'));
    const r = checkData({ ...base, deckImpact: real });
    expect(r.failures.filter((x) => x.includes('deck-impact'))).toEqual([]);
    expect(r.passed.some((x) => x.startsWith('data/seasons/deck-impact.json is keyed by list fingerprint'))).toBe(true);
  });
});
