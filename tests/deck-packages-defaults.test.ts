// ROADMAP2 §1 step 3: synergy packages are opt-in for the deck builders. With no package plan and no package moves,
// the breeder (season.ts, breed-preview.ts), the forge's and the optimizer's candidate lists and the Deck Lab tuner
// must produce exactly what they produced before packages existed: same candidates, same order, same random numbers,
// so a season re-run with the same seed breeds the same decks.
//
// The hashes below were taken from the code before packages were added (commit 2546b64; the forge's and optimizer's
// candidate functions were then inside scripts/forge.ts and scripts/optimize.ts), on the synthetic inputs of
// tests/builder-fixtures.ts, which read only the card data. If src/data/cards.json changes, re-take them from the
// commit before the change, never from new code. The one exception is `tuneEvidence` (ROADMAP2 §1 step 5): the
// default adoption rule changed on purpose, so its game sequence is pinned from the new code, and the old sequence is
// still checked under the legacy rule (`rule: { kind: 'any-gain' }`).
import { describe, expect, it } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { ramLimits } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { breedSeason } from '../src/ai/breeder';
import { candidateSwaps, tuneDeck, type TuneOptions } from '../src/lib/deckLab';
import { forgeSwaps, optimizeCandidates } from '../scripts/builder-moves';
import { listKey, pin, synthBreedInput, synthDecks, synthReport, SYNTH_IMPACT } from './builder-fixtures';

const PINNED = {
  decks: 'a0f0088bdb8876e4',
  breedNoH2H: 'b96b4ff77120e8bb',
  breedH2H: '6fd1450b99bc7b5f',
  forge: 'ecd7078f19459f62',
  optimize: '18b7a931bc44040a',
  optimizeSb: '7f8c37968f57e36c',
  lab: '88e5174eb4a34a27',
  tune: '7095ce0b3f7b7f99',
  // taken from the evidence-rule code (ROADMAP2 §1 step 5), not from 2546b64: the default rule's own sequence
  tuneEvidence: 'f401608b7786746d',
};

const decks = synthDecks();
const withSideboard = (d: DeckList): DeckList => ({ ...d, sideboard: CARDS.filter((c) => c.type !== 'Legend' && ramLimits(d)[c.color] >= c.ram && !d.main.includes(c.id)).slice(0, 7).map((c) => c.id) });

describe('deck builders without package flags are unchanged', () => {
  it('the synthetic inputs are the ones the hashes were taken on', () => {
    expect(decks).toHaveLength(8);
    expect(pin(decks.map(listKey))).toBe(PINNED.decks);
  });

  it('the breeder breeds the same decks, with and without head-to-heads (and with an empty package option)', () => {
    const bred = (h2h: boolean, packages?: object) => pin(breedSeason(1, { ...synthBreedInput(h2h), ...packages }, 8).map((b) => [b.method, b.parents, b.idea, listKey(b.deck)]));
    expect(bred(false)).toBe(PINNED.breedNoH2H);
    expect(bred(true)).toBe(PINNED.breedH2H);
    // an empty plan and no seeds is the same as no package option at all
    expect(bred(true, { packages: { plan: {}, seeds: [] } })).toBe(PINNED.breedH2H);
    expect(breedSeason(1, synthBreedInput(true), 8).every((b) => b.packages === undefined)).toBe(true);
  });

  it("the forge's candidate swaps are the same", () => {
    expect(pin(decks.map((d) => forgeSwaps(d, synthReport(d), SYNTH_IMPACT, 6).map((m) => [m.label, m.prior, listKey(m.deck)])))).toBe(PINNED.forge);
    expect(pin(decks.map((d) => forgeSwaps(d, synthReport(d), SYNTH_IMPACT, 6, {}).map((m) => [m.label, m.prior, listKey(m.deck)])))).toBe(PINNED.forge);
  });

  it("the optimizer's candidates are the same (main deck and sideboard plans)", () => {
    expect(pin(decks.map((d) => optimizeCandidates(d, false, 40).map((m) => [m.label, listKey(m.deck)])))).toBe(PINNED.optimize);
    expect(pin(decks.map((d) => optimizeCandidates(withSideboard(d), true, 40).map((m) => [m.label, listKey(m.deck)])))).toBe(PINNED.optimizeSb);
  });

  // ROADMAP2 §1 step 5 changed the adoption rule, and only that: the legacy rule (`any-gain`) plays exactly the pinned
  // games; the evidence rule plays the same games up to the end of the first confirmation stage (the old confirmation),
  // then further stages on the next fresh seeds, so its sequence has its own pin.
  const tuneSeq = async (rule?: TuneOptions['rule']) => {
    const seq: string[] = [];
    const start = decks[0]!;
    await tuneDeck(
      start,
      [decks[1]!],
      { games: 4, gens: 2, cands: 3, bot: 'easy', minGain: 0.02, seedBase: 500_000, ...(rule ? { rule } : {}) },
      async (j) => {
        seq.push(`${j.seed}:${j.first}:${listKey(j.a)}`);
        return { seed: j.seed, first: j.first, turns: 5, reason: 't', winner: listKey(j.a) === listKey(start) ? 1 : 0 };
      },
      () => undefined,
      () => false,
    );
    return seq;
  };

  it("the Deck Lab's swaps and the games its tuner plays under the legacy rule are the same", async () => {
    expect(pin(decks.map((d) => candidateSwaps(d, synthReport(d), 6).map((m) => [m.label, m.prior, listKey(m.deck)])))).toBe(PINNED.lab);
    expect(pin(await tuneSeq({ kind: 'any-gain' }))).toBe(PINNED.tune);
  });

  it('the evidence rule plays the same games up to the first adoption decision, then more stages on fresh seeds', async () => {
    const legacy = await tuneSeq({ kind: 'any-gain' });
    const now = await tuneSeq();
    // baseline 4 + 3 swaps × 4 on the shared seeds, then the first confirmation stage: current list and nominee × 8
    const firstDecision = 4 + 3 * 4 + 2 * 8;
    expect(now.slice(0, firstDecision)).toEqual(legacy.slice(0, firstDecision));
    // 8 games of perfect wins are below the 200-game floor: stages 2–4 follow on the next seeds, then "could not tell"
    const stage2 = now.slice(firstDecision, firstDecision + 16).map((s) => +s.split(':')[0]!);
    expect(Math.min(...stage2)).toBe(500_000 + 10_000 + 5_000 + 8);
    expect(now.length).toBeGreaterThan(legacy.length);
    expect(pin(now)).toBe(PINNED.tuneEvidence);
  });
});
