// SIM-3: the maths of scripts/rank-stability.ts (src/lib/rankStability.ts).
import { describe, expect, it } from 'vitest';
import { averageRanks, deckWinRates, lcg, pairedDeckDiff, pearson, quantile, rankStability, spearman, stratifiedWeights, type Deal } from '../src/lib/rankStability';

describe('ranks and correlation', () => {
  it('ranks the largest first and averages ties', () => {
    expect(averageRanks([0.6, 0.4, 0.5])).toEqual([1, 3, 2]);
    expect(averageRanks([0.5, 0.7, 0.5, 0.2])).toEqual([2.5, 1, 2.5, 4]);
  });

  it('Spearman is 1 for the same order, -1 for the reverse, and matches the textbook value', () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1, 12);
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 12);
    // no ties: rho = 1 - 6 Σd² / (n(n² - 1)); ranks (1,2,3,4,5) vs (2,1,4,3,5): Σd² = 4 -> 1 - 24/120 = 0.8
    expect(spearman([5, 4, 3, 2, 1], [4, 5, 2, 3, 1])).toBeCloseTo(0.8, 12);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNaN();
  });

  it('quantile interpolates', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    expect(quantile([0, 10], 0.25)).toBe(2.5);
  });
});

// three decks, each ordered pairing twice: deck 0 wins everything, deck 2 loses everything
const deals: Deal[] = [];
for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) if (a !== b) deals.push({ a, b }, { a, b });
const strong = deals.map((d) => (d.a < d.b ? 1 : 0));

describe('win rates vs the field', () => {
  it('counts both seats and ties as half', () => {
    const { wr, n } = deckWinRates(deals, strong, 3);
    expect(n).toEqual([8, 8, 8]);
    expect(wr).toEqual([1, 0.5, 0]);
    const tie = deckWinRates([{ a: 0, b: 1 }], [0.5], 2);
    expect(tie.wr).toEqual([0.5, 0.5]);
  });

  it('weights count a deal that many times', () => {
    const { wr, n } = deckWinRates([{ a: 0, b: 1 }, { a: 0, b: 1 }], [1, 0], 2, [3, 1]);
    expect(n).toEqual([4, 4]);
    expect(wr[0]).toBeCloseTo(0.75, 12);
  });

  it('paired deck differences are per game, with the right sign for the seat-1 deck', () => {
    const flipped = strong.map((s) => 1 - s);
    const d = pairedDeckDiff(deals, strong, flipped, 3);
    expect(d[0]!.diff).toBe(1);
    expect(d[2]!.diff).toBe(-1);
    expect(d[1]!.diff).toBe(0);
    expect(d[0]!.se).toBe(0);
  });

  it('the stratified bootstrap keeps every pairing at its count', () => {
    const w = stratifiedWeights(deals, lcg(5));
    expect(w.reduce((s, x) => s + x, 0)).toBe(deals.length);
    for (let i = 0; i < deals.length; i += 2) expect(w[i]! + w[i + 1]!).toBe(2);
  });
});

describe('rankStability', () => {
  it('the same results under two bots: rho 1, nothing moved', () => {
    const r = rankStability(deals, [strong, strong], 3, { boot: 200, seed: 3 });
    expect(r.bots[0]!.rank).toEqual([1, 2, 3]);
    expect(r.bots[0]!.band).toEqual(['S', 'B', 'D']);
    const p = r.pairs[0]!;
    expect(p.rho).toBeCloseTo(1, 12);
    expect(p.lower).toBeCloseTo(1, 12);
    expect(p.decks.every((d) => !d.rankMoved && !d.bandMoved && d.rankDelta === 0)).toBe(true);
  });

  it('a reversed ranking: rho -1, the ends move beyond the noise', () => {
    const r = rankStability(deals, [strong, strong.map((s) => 1 - s)], 3, { boot: 200, seed: 3 });
    const p = r.pairs[0]!;
    expect(p.rho).toBeCloseTo(-1, 12);
    expect(p.decks[0]).toMatchObject({ rankDelta: -2, rankMoved: true, bandMoved: true, bandX: 'S', bandY: 'D' });
    expect(p.decks[1]).toMatchObject({ rankDelta: 0, rankMoved: false, bandMoved: false });
  });

  it('three bots give three comparisons', () => {
    expect(rankStability(deals, [strong, strong, strong], 3, { boot: 100 }).pairs.map((p) => [p.x, p.y])).toEqual([
      [0, 1],
      [0, 2],
      [1, 2],
    ]);
  });
});
