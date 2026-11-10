// The bots and the Deck Lab read src/data/impact.json, a slim copy of src/data/analysis.json. These tests pin that
// the slim file matches the full one and that every public impact number is exactly what analysis.json gives.
import { describe, expect, it } from 'vitest';
import analysis from '../src/data/analysis.json';
import impact from '../src/data/impact.json';
import type { DeckReport } from '../src/analysis/analyze';
import { toImpactData } from '../src/analysis/impactData';
import { cardImpact, topImpactCards } from '../src/ai/impact';
import { DECK_IMPACT, GLOBAL_IMPACT } from '../src/lib/deckLab';

const decks = (analysis as unknown as { decks: DeckReport[] }).decks;

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

describe('impact.json', () => {
  it('is in sync with analysis.json (regenerate both with `npm run sim -- analyze`)', () => {
    expect(impact).toEqual(JSON.parse(JSON.stringify(toImpactData(decks))));
  });

  it('gives the bots exactly the impact numbers analysis.json gives', () => {
    const ref = reference();
    const ids = new Set(decks.flatMap((r) => r.cards.map((c) => c.id)));
    expect(decks.length).toBeGreaterThan(0);
    for (const r of decks) {
      for (const id of ids) expect(Object.is(cardImpact(r.deck, id), ref.cardImpactRef(r.deck, id)), `${r.deck} / ${id}`).toBe(true);
      expect(topImpactCards(r.deck)).toEqual(ref.topRef(r.deck));
      expect(topImpactCards(r.deck, 100)).toEqual(ref.topRef(r.deck, 100));
    }
    for (const id of ids) expect(Object.is(cardImpact('no such deck', id), ref.cardImpactRef('no such deck', id))).toBe(true);
    expect(topImpactCards('no such deck')).toEqual([]);
  });

  it('gives the Deck Lab exactly the impact numbers analysis.json gives', () => {
    const ref = reference();
    expect(GLOBAL_IMPACT).toStrictEqual(ref.labGlobal);
    expect(DECK_IMPACT).toStrictEqual(ref.labDeck);
  });
});
