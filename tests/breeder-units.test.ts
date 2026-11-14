// The breeder's Unit floor (MIN_BRED_UNITS, src/ai/breeder.ts): no bred list comes out with fewer Units than any
// hand-built library list. ROADMAP2 §4: "the breeder can produce a deck with 12 Units" (the 'control' template aims at 12).
import { describe, expect, it } from 'vitest';
import { CARD_BY_ID } from '../src/engine/cards';
import { validateDeck } from '../src/engine/deck';
import { breedSeason, fill, MIN_BRED_UNITS, topUpUnits, unitCount } from '../src/ai/breeder';
import { cardValue } from '../src/ai/knowledge';
import { checkChange } from '../src/lib/deckPackages';
import { loadLibrary } from '../scripts/lib-node';
import { synthBreedInput, synthDecks, SYNTH_IMPACT } from './builder-fixtures';

const score = (id: string) => cardValue(id) + 100 * (SYNTH_IMPACT[id] ?? 0);

describe('bred lists keep a workable number of Units', () => {
  it('the floor is the fewest Units of any hand-built library list (meta, guides, sim ladder, Trainer originals)', () => {
    const hand = loadLibrary().filter((d) => d.kind === 'meta' || d.kind === 'guide' || d.kind === 'ladder' || (d.kind === 'original' && /^nc-/.test(d.file)));
    expect(hand.length).toBeGreaterThanOrEqual(30);
    // if a hand-built list with fewer Units joins the library, revisit MIN_BRED_UNITS (the reasoning is at the constant)
    expect(Math.min(...hand.map((d) => unitCount(d.deck)))).toBe(MIN_BRED_UNITS);
  });

  it("the 'control' template alone gives 12 Units, and topping up makes it 13 by one legal, repeatable swap", () => {
    const legends = synthDecks()[2]!.legends;
    const d = fill(legends, new Map(), SYNTH_IMPACT, 'control', 'Control fill');
    expect(unitCount(d)).toBe(12);
    const a = topUpUnits(d, MIN_BRED_UNITS, score)!;
    expect(unitCount(a.deck)).toBe(MIN_BRED_UNITS);
    expect(a.swaps).toHaveLength(1);
    expect(a.deck.main).toHaveLength(40);
    expect(validateDeck({ ...a.deck, sideboard: [] })).toEqual([]);
    expect(topUpUnits(d, MIN_BRED_UNITS, score)).toEqual(a);
    // a list already at the floor is left alone
    expect(topUpUnits(a.deck, MIN_BRED_UNITS, score)).toEqual({ deck: a.deck, swaps: [] });
  });

  it('respects the package plan, and gives up (the candidate is dropped) when the plan allows no swap', () => {
    const d = fill(synthDecks()[2]!.legends, new Map(), SYNTH_IMPACT, 'control', 'Control fill');
    const nonUnits = [...new Set(d.main.filter((id) => CARD_BY_ID[id]!.type !== 'Unit'))];
    const lock = (ids: string[]) => ({ lockCards: Object.fromEntries(ids.map((id) => [id, d.main.filter((x) => x === id).length])) });
    // lock every non-Unit card at the copies it has: nothing can be cut
    expect(topUpUnits(d, MIN_BRED_UNITS, score, lock(nonUnits))).toBeNull();
    // lock all but one: that one is the cut, and the swap passes the plan's own check
    const free = nonUnits[nonUnits.length - 1]!;
    const plan = lock(nonUnits.filter((id) => id !== free));
    const r = topUpUnits(d, MIN_BRED_UNITS, score, plan)!;
    expect(r.deck.main.filter((id) => id === free).length).toBe(d.main.filter((id) => id === free).length - 1);
    expect(checkChange(d, r.deck, plan)).toEqual([]);
  });

  it('no seed of the breeder gives a list under the floor (with and without head-to-heads and package seeds)', () => {
    let repaired = 0;
    for (let seed = 1; seed <= 12; seed++)
      for (const h2h of [false, true])
        for (const packages of [undefined, { seeds: [['rocker'], ['value-pair']] }]) {
          const out = breedSeason(seed, { ...synthBreedInput(h2h), seed: 1000 + seed * 77, ...(packages ? { packages } : {}) }, 8);
          expect(out.length).toBeGreaterThan(0);
          for (const b of out) {
            expect(unitCount(b.deck)).toBeGreaterThanOrEqual(MIN_BRED_UNITS);
            expect(validateDeck({ ...b.deck, sideboard: [] })).toEqual([]);
            if (b.idea.includes('Topped up')) repaired++;
          }
        }
    // the guard did work here (the synthetic parents include 'control' lists)
    expect(repaired).toBeGreaterThan(0);
  });
});
