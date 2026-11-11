// The bots and the Deck Lab read src/data/impact.json, a slim copy of src/data/analysis.json. These tests pin that
// the slim file matches the full one, that every public impact number is exactly what analysis.json gives, and that
// impact is matched by list fingerprint, never by deck name alone (backlog AI-11).
import { describe, expect, it } from 'vitest';
import analysis from '../src/data/analysis.json';
import impact from '../src/data/impact.json';
import type { DeckReport } from '../src/analysis/analyze';
import { findImpactDeck, toImpactData, type ImpactDeck } from '../src/analysis/impactData';
import { LEGACY_IMPACT_LISTS } from '../src/analysis/legacyImpactLists';
import { cardImpact, impactDeckName, topImpactCards } from '../src/ai/impact';
import { deckImpactOf, GLOBAL_IMPACT } from '../src/lib/deckLab';
import { deckFingerprint, listFingerprint } from '../src/engine/deck';
import { Game } from '../src/engine/engine';
import type { DeckList } from '../src/engine/types';
import { loadLibrary } from '../scripts/lib-node';
import { Scripted } from './engine-helpers';

const decks = (analysis as unknown as { decks: DeckReport[] }).decks;
const lib = loadLibrary();
const builtin = (name: string) => lib.find((d) => d.deck.name === name);
const ref = (d: Pick<DeckList, 'name' | 'legends' | 'main'>) => ({ name: d.name, listId: listFingerprint(d) });

// Straightforward recomputation from analysis.json: the code src/ai/impact.ts and src/lib/deckLab.ts ran before the slim file.
function reference() {
  const perDeck = new Map<string, Map<string, number>>();
  const pooled: Record<string, { s: number; n: number }> = {};
  for (const r of decks) {
    const m = new Map<string, number>();
    for (const c of r.cards) {
      if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd)) continue;
      if (c.seenGames >= 30) m.set(c.id, c.iwd);
      pooled[c.id] ??= { s: 0, n: 0 };
      pooled[c.id].s += c.iwd * c.seenGames;
      pooled[c.id].n += c.seenGames;
    }
    perDeck.set(r.deck, m);
  }
  const global = new Map(Object.entries(pooled).filter(([, v]) => v.n >= 60).map(([k, v]) => [k, v.s / v.n]));
  const cardImpactRef = (deck: string, id: string) => perDeck.get(deck)?.get(id) ?? 0.5 * (global.get(id) ?? 0);
  const topRef = (deck: string, n = 3) => {
    const m = perDeck.get(deck);
    if (!m) return [];
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([id, iwd]) => ({ id, iwd }));
  };
  const labGlobal = Object.fromEntries(Object.entries(pooled).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
  const labDeck = Object.fromEntries(
    decks.map((r) => [r.deck, Object.fromEntries(r.cards.filter((c) => c.seenGames >= 25 && Number.isFinite(c.iwd)).map((c) => [c.id, c.iwd]))]),
  );
  return { cardImpactRef, topRef, labGlobal, labDeck };
}

/** Analysed decks whose built-in list is still the one the legacy table pins (all of them when this was written). */
const pinned = decks.filter((r) => builtin(r.deck) && listFingerprint(builtin(r.deck)!.deck) === LEGACY_IMPACT_LISTS[r.deck]);

describe('impact.json', () => {
  it('is in sync with analysis.json (regenerate both with `npm run sim -- analyze`)', () => {
    expect(impact).toEqual(JSON.parse(JSON.stringify(toImpactData(decks))));
  });

  it('pins every legacy (name-only) entry to a list, and nothing else', () => {
    const legacy = (impact as unknown as { decks: ImpactDeck[] }).decks.filter((d) => !d.id).map((d) => d.deck);
    expect(Object.keys(LEGACY_IMPACT_LISTS).sort()).toEqual([...legacy].sort());
    expect(pinned.length).toBeGreaterThan(0);
  });

  it('gives the bots exactly the impact numbers analysis.json gives, for the built-in list it was measured on', () => {
    const ref0 = reference();
    const ids = new Set(decks.flatMap((r) => r.cards.map((c) => c.id)));
    for (const r of pinned) {
      const me = ref(builtin(r.deck)!.deck);
      for (const id of ids) expect(Object.is(cardImpact(me, id), ref0.cardImpactRef(r.deck, id)), `${r.deck} / ${id}`).toBe(true);
      expect(topImpactCards(me)).toEqual(ref0.topRef(r.deck));
      expect(topImpactCards(me, 100)).toEqual(ref0.topRef(r.deck, 100));
      expect(impactDeckName(me)).toBe(r.deck);
    }
    const nobody = { name: 'no such deck', listId: '0000000000000000' };
    for (const id of ids) expect(Object.is(cardImpact(nobody, id), ref0.cardImpactRef('no such deck', id))).toBe(true);
    expect(topImpactCards(nobody)).toEqual([]);
  });

  it('gives a custom deck that reuses a built-in name only the format-wide estimate', () => {
    const ref0 = reference();
    const r = pinned[0];
    const real = builtin(r.deck)!.deck;
    // same name, one card different: another list
    const custom = { ...real, main: [...real.main.slice(1), real.main[0] === 'psycho_squad' ? 'v_streetkid' : 'psycho_squad'] };
    expect(topImpactCards(ref(custom))).toEqual([]);
    expect(impactDeckName(ref(custom))).toBeNull();
    for (const c of r.cards) expect(Object.is(cardImpact(ref(custom), c.id), ref0.cardImpactRef('no such deck', c.id))).toBe(true);
    expect(deckImpactOf(custom)).toBeUndefined();
  });

  it('gives the Deck Lab exactly the impact numbers analysis.json gives', () => {
    const ref0 = reference();
    expect(GLOBAL_IMPACT).toStrictEqual(ref0.labGlobal);
    for (const r of pinned) expect(deckImpactOf(builtin(r.deck)!.deck)).toStrictEqual(ref0.labDeck[r.deck]);
    expect(deckImpactOf({ name: 'no such deck', legends: [], main: [] })).toBeUndefined();
  });

  it('gives every player in a game the fingerprint of the list it plays (sideboard left out)', () => {
    const d = { ...builtin(pinned[0].deck)!.deck, sideboard: ['psycho_squad'] };
    const g = Game.create([d, { ...d, name: 'Renamed copy' }], [new Scripted(), new Scripted()], { seed: 1 });
    expect(g.P(0).listId).toBe(listFingerprint(d));
    expect(g.P(0).listId).toBe(deckFingerprint({ ...d, sideboard: [] }));
    expect(g.P(1).listId).toBe(g.P(0).listId);
    // the built-in deck under its own name gets its numbers; the same list under another name does not (legacy data
    // has no fingerprint, so only the pinned name can claim it)
    expect(topImpactCards(g.P(0))).toEqual(reference().topRef(pinned[0].deck));
    expect(topImpactCards(g.P(1))).toEqual([]);
  });
});

describe('findImpactDeck (lookup rules)', () => {
  const L1 = 'aaaaaaaaaaaaaaaa';
  const L2 = 'bbbbbbbbbbbbbbbb';
  const measured: ImpactDeck[] = [
    { deck: 'Meta A', id: L1, cards: [] },
    { deck: 'Meta B', id: L2, cards: [] },
  ];
  const legacy: ImpactDeck[] = [{ deck: 'Meta A', cards: [] }];
  const pins = { 'Meta A': L1 };

  it('matches by fingerprint, whatever either side is called', () => {
    expect(findImpactDeck(measured, { name: 'Meta A', listId: L1 }, {})).toBe(measured[0]);
    expect(findImpactDeck(measured, { name: 'Meta A (renamed)', listId: L1 }, {})).toBe(measured[0]);
  });

  it('never falls back to the name when the stored entry has a fingerprint', () => {
    expect(findImpactDeck(measured, { name: 'Meta A', listId: 'cccccccccccccccc' }, { 'Meta A': 'cccccccccccccccc' })).toBeUndefined();
  });

  it('accepts a legacy name-only entry for the built-in deck of that name', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L1 }, pins)).toBe(legacy[0]);
  });

  it('gives a custom deck that reuses a built-in name nothing', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L2 }, pins)).toBeUndefined();
    expect(findImpactDeck(legacy, { name: 'Meta A', listId: L2 }, {})).toBeUndefined();
  });

  it('does not let a renamed built-in list claim a legacy entry by name, but finds it once the data has fingerprints', () => {
    expect(findImpactDeck(legacy, { name: 'Renamed', listId: L1 }, pins)).toBeUndefined();
    expect(findImpactDeck(measured, { name: 'Renamed', listId: L1 }, pins)).toBe(measured[0]);
  });

  it('matches nothing without a list id, and ignores inherited object keys', () => {
    expect(findImpactDeck(legacy, { name: 'Meta A' }, pins)).toBeUndefined();
    expect(findImpactDeck([{ deck: 'constructor', cards: [] }], { name: 'constructor', listId: L1 }, {})).toBeUndefined();
  });

  it('carries the analysed list id into impact.json', () => {
    expect(toImpactData([{ deck: 'X', id: L1, cards: [{ id: 'c', iwd: 0.1, seenGames: 30 }] }, { deck: 'Y', cards: [] }])).toEqual({
      decks: [
        { deck: 'X', id: L1, cards: [['c', 0.1, 30]] },
        { deck: 'Y', cards: [] },
      ],
    });
  });
});
