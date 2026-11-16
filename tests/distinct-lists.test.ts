// One entry per list (src/lib/distinctLists.ts): the rule every tournament and season field follows by default, and the
// season's use of it (scripts/season-field.ts).
import { describe, expect, it } from 'vitest';
import { distinctLists, hasSameLists, leftOutLine, type Listed } from '../src/lib/distinctLists';
import { sameListBred, seasonField } from '../scripts/season-field';
import type { LibraryDeck } from '../src/lib/library';

const deck = (file: string, name: string, legends: string[], main: string[], sideboard: string[] = []) => ({ file, deck: { name, legends, main, sideboard } });
const A = deck('a.txt', 'Alpha', ['l1', 'l2', 'l3'], ['c1', 'c1', 'c2']);
const B = deck('b.txt', 'Bravo', ['l4', 'l5', 'l6'], ['c3', 'c4']);
// Alpha's list under another name, cards in another order, another sideboard
const A2 = deck('a2.txt', 'Alpha Again', ['l3', 'l1', 'l2'], ['c2', 'c1', 'c1'], ['s1', 's1', 's1', 's1', 's1', 's1', 's1']);
const SAVED_A = deck('custom:My Alpha', 'My Alpha', ['l1', 'l2', 'l3'], ['c1', 'c2', 'c1']);
const names = (xs: readonly Listed[]) => xs.map((d) => d.deck.name);

describe('one entry per list', () => {
  it('keeps the first of each list in the order given, and names the deck each left-out one duplicates', () => {
    const r = distinctLists([B, A, A2]);
    expect(names(r.kept)).toEqual(['Bravo', 'Alpha']);
    expect(r.left).toEqual([{ deck: A2, sameAs: A }]);
    expect(names(distinctLists([A2, B, A]).kept)).toEqual(['Alpha Again', 'Bravo']);
  });
  it('a deck bundled with the site wins over a deck saved in this browser, wherever the saved one stands', () => {
    const r = distinctLists([SAVED_A, B, A]);
    expect(names(r.kept)).toEqual(['Bravo', 'Alpha']);
    expect(r.left).toEqual([{ deck: SAVED_A, sameAs: A }]);
    // two saved copies: the first saved one stays
    const SAVED_B = deck('custom:Other', 'Other', ['l1', 'l2', 'l3'], ['c1', 'c1', 'c2']);
    expect(names(distinctLists([SAVED_B, SAVED_A]).kept)).toEqual(['Other']);
  });
  it('three decks of one list: one kept, two left out, each naming the kept one', () => {
    const r = distinctLists([A2, SAVED_A, A, B]);
    expect(names(r.kept)).toEqual(['Alpha Again', 'Bravo']);
    expect(r.left.map((x) => [x.deck.deck.name, x.sameAs.deck.name])).toEqual([
      ['My Alpha', 'Alpha Again'],
      ['Alpha', 'Alpha Again'],
    ]);
  });
  it('a different sideboard is the same list; one different card is a different list', () => {
    expect(hasSameLists([A, A2])).toBe(true);
    const oneOff = deck('a3.txt', 'Alpha Variant', ['l1', 'l2', 'l3'], ['c1', 'c1', 'c5']);
    expect(hasSameLists([A, oneOff])).toBe(false);
    expect(distinctLists([A, oneOff]).left).toEqual([]);
    // another Legend is another list too
    expect(hasSameLists([A, deck('a4.txt', 'Alpha Legend', ['l1', 'l2', 'l9'], ['c1', 'c1', 'c2'])])).toBe(false);
  });
  it('empty input, and the line a caller prints', () => {
    expect(distinctLists([])).toEqual({ kept: [], left: [] });
    expect(leftOutLine([])).toBe('');
    expect(leftOutLine(distinctLists([A, A2]).left)).toBe('Left out one deck whose list is already in the field: Alpha Again (same list as Alpha).');
    expect(leftOutLine(distinctLists([A, A2, SAVED_A, A]).left)).toBe(
      'Left out 3 decks whose list is already in the field: Alpha Again (same list as Alpha), My Alpha (same list as Alpha), Alpha (entered already).',
    );
  });
});

describe('the season under one entry per list', () => {
  const lib = (d: ReturnType<typeof deck>, kind: LibraryDeck['kind'] = 'guide'): LibraryDeck => ({ ...d, kind, prov: {} });
  const M1 = lib(deck('meta-1.txt', 'Meta One', ['m1', 'm2', 'm3'], ['x1']), 'meta');
  const M2 = lib(deck('meta-2.txt', 'Meta Two', ['m4', 'm5', 'm6'], ['x2']), 'meta');
  const inc = (i: number) => lib(deck(`g${i}.txt`, `Guide ${i}`, [`g${i}a`, `g${i}b`, `g${i}c`], ['y']));
  const NEW = lib(deck('s9-01.txt', 'S9-01 Mutant', ['n1', 'n2', 'n3'], ['z']));
  it('with distinct lists the field is exactly as before the rule', () => {
    const ranked = [inc(1), undefined, inc(2), inc(3), inc(4)];
    const r = seasonField({ meta: [M1, M2], ranked, newcomers: [NEW], slots: 3 });
    expect(r.left).toEqual([]);
    expect(names(r.incumbents)).toEqual(['Guide 1', 'Guide 2']); // the missing one used a slot, as it always did
    expect(seasonField({ meta: [M1, M2], ranked, newcomers: [NEW], slots: 3, allowSameLists: true })).toEqual(r);
  });
  it('an incumbent with a list already in the field is passed over for the next one, and named', () => {
    const twin = lib(deck('g-twin.txt', 'Meta One Copy', ['m3', 'm2', 'm1'], ['x1']));
    const r = seasonField({ meta: [M1, M2], ranked: [inc(1), twin, inc(2), inc(3)], newcomers: [NEW], slots: 3 });
    expect(names(r.incumbents)).toEqual(['Guide 1', 'Guide 2', 'Guide 3']);
    expect(names(r.field)).toEqual(['Meta One', 'Meta Two', 'Guide 1', 'Guide 2', 'Guide 3', 'S9-01 Mutant']);
    expect(leftOutLine(r.left)).toBe('Left out one deck whose list is already in the field: Meta One Copy (same list as Meta One).');
    // --allow-same-lists: the field as before the rule
    expect(names(seasonField({ meta: [M1, M2], ranked: [inc(1), twin, inc(2), inc(3)], newcomers: [NEW], slots: 3, allowSameLists: true }).incumbents)).toEqual(['Guide 1', 'Meta One Copy', 'Guide 2']);
  });
  it('a newcomer with a list already in the field takes no slot', () => {
    const copy = lib(deck('s9-02.txt', 'S9-02 Cross', ['g1c', 'g1a', 'g1b'], ['y']));
    const r = seasonField({ meta: [M1], ranked: [inc(1)], newcomers: [NEW, copy], slots: 1 });
    expect(names(r.field)).toEqual(['Meta One', 'Guide 1', 'S9-01 Mutant']);
    expect(r.left.map((x) => x.deck.deck.name)).toEqual(['S9-02 Cross']);
  });
  it('a bred deck with a library list, or an earlier bred deck’s, is kept out', () => {
    const bred = [{ deck: NEW.deck, method: 'mutant' }, { deck: { ...M2.deck, name: 'S9-02 Cross' }, method: 'crossover' }, { deck: { ...NEW.deck, name: 'S9-03 Explorer' }, method: 'explorer' }];
    const r = sameListBred(bred, [M1, M2], (d) => `${d.name}.txt`);
    expect(r.kept.map((b) => b.method)).toEqual(['mutant']);
    expect(leftOutLine(r.left)).toBe('Left out 2 decks whose list is already in the field: S9-02 Cross (same list as Meta Two), S9-03 Explorer (same list as S9-01 Mutant).');
  });
});
