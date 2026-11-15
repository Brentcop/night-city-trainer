// Per-opponent and per-seat reporting of a paired comparison (src/lib/pairedSplit.ts; docs/SYNERGIES.md "By opponent,
// and re-measuring a change"): the stratified interval keeps the pooled paired mean and is no wider where the cells
// differ; the heterogeneity test flags an effect planted against one opponent and flags a null effect about 5% of the
// time; splitPaired is the one definition the change ledger's summarize uses; the builders' tracker hands each nominee
// exactly the held-out games its figure covers.
import { describe, expect, it } from 'vitest';
import { confirmStaged, adoptionRule, nomineeRecord, pairedInterval, type PairedScores } from '../src/lib/evidence';
import { summarize, type LedgerGame } from '../src/lib/changeLedger';
import { blockSlots } from '../src/lib/changeLedgerRun';
import { dependsOnOpponentWords, heterogeneity, HeldOutTracker, nomineeSplit, splitPaired, stratifiedInterval, withSplit, type PairSlot } from '../src/lib/pairedSplit';
import { heterogeneity as builderHeterogeneity } from '../scripts/evidence-build';

const rng = (seed: number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const OPPS = ['o0', 'o1', 'o2', 'o3', 'o4', 'o5', 'o6'];

/**
 * Paired games in the builders' layout (game k: opponent k mod 7, seat alternating every 7 games). The per-game
 * difference is drawn first, the same way in every cell but for the effect: +1 with chance 0.15 + effect/2, −1 with
 * chance 0.15 − effect/2, else 0; the scores follow (a tie of the two lists is a win or a loss for both, with a chance
 * that depends on the opponent and the seat).
 */
function games(n: number, seed: number, effect: (opp: number) => number) {
  const r = rng(seed);
  const slots: PairSlot[] = blockSlots(0, n, OPPS).map((s) => ({ opp: s.opp, first: s.first }));
  const base: number[] = [];
  const cand: number[] = [];
  slots.forEach((s, k) => {
    const o = k % OPPS.length;
    const e = effect(o);
    const u = r();
    const both = r() < 0.3 + 0.06 * o + (s.first === 0 ? 0.05 : -0.05) ? 1 : 0;
    const [b, c] = u < 0.15 + e / 2 ? [0, 1] : u < 0.3 ? [1, 0] : [both, both];
    base.push(b);
    cand.push(c);
  });
  return { slots, base, cand };
}

describe('the stratified interval', () => {
  it('in a balanced design its estimate is exactly the pooled paired mean, and it is no wider where the cells differ', () => {
    for (let seed = 1; seed <= 20; seed++) {
      // an effect that differs by opponent, so the cells differ
      const g = games(1120, seed, (o) => (o - 3) * 0.08);
      const s = stratifiedInterval(g.cand, g.base, g.slots);
      const plain = pairedInterval(g.cand, g.base);
      expect(s.mean).toBe(plain.mean);
      expect(s.games).toBe(1120);
      expect(s.cells).toBe(14);
      // the plain standard error from the plain interval
      const plainSe = (plain.upper - plain.mean) / 1.96;
      expect(s.se).toBeLessThanOrEqual(plainSe);
      expect(s.upper - s.lower).toBeLessThanOrEqual(plain.upper - plain.lower + 1e-12);
    }
  });

  it('is Σ w²·s²/n over the cells, and a cell with one game borrows the pooled variance', () => {
    const slots: PairSlot[] = [
      { opp: 'a', first: 0 },
      { opp: 'a', first: 0 },
      { opp: 'a', first: 0 },
      { opp: 'b', first: 1 },
    ];
    const cand = [1, 0, 1, 1];
    const base = [0, 0, 0, 0];
    const s = stratifiedInterval(cand, base, slots);
    const d = [1, 0, 1, 1];
    const m = 0.75;
    const pooled = d.reduce((a, x) => a + (x - m) ** 2, 0) / 3;
    const cellA = ((1 - 2 / 3) ** 2 * 2 + (2 / 3) ** 2) / 2;
    const v = (3 / 4) ** 2 * (cellA / 3) + (1 / 4) ** 2 * (pooled / 1);
    expect(s.mean).toBe(m);
    expect(s.se).toBeCloseTo(Math.sqrt(v), 12);
    expect(s.cells).toBe(2);
    // fewer than 2 games: nothing is known
    expect(stratifiedInterval([1], [0], [{ opp: 'a', first: 0 }])).toMatchObject({ games: 1, lower: -1, upper: 1 });
    expect(() => stratifiedInterval([1, 0], [0, 0], [{ opp: 'a', first: 0 }])).toThrow(/one slot per game/);
  });
});

describe('heterogeneity and the per-opponent split', () => {
  it('flags an effect planted against one opponent, and the split shows it', () => {
    const g = games(2800, 7, (o) => (o === 2 ? -0.2 : 0.06));
    const split = splitPaired(g.cand, g.base, g.slots);
    expect(split.byOpp.map((o) => o.games)).toEqual(Array(7).fill(400));
    const o2 = split.byOpp.find((o) => o.opp === 'o2')!;
    const others = split.byOpp.filter((o) => o.opp !== 'o2');
    expect(Math.max(...others.map((o) => o.mean))).toBeGreaterThan(o2.mean);
    expect(o2.mean + 1.96 * o2.se).toBeLessThan(0);
    const het = heterogeneity(split.byOpp)!;
    expect(het.df).toBe(6);
    expect(het.p).toBeLessThan(0.05);
    // the seats: both, going first then second, 1,400 games each
    expect(split.bySeat.map((s) => [s.first, s.games])).toEqual([
      [0, 1400],
      [1, 1400],
    ]);
    // the nominee line names the two extremes
    const w = dependsOnOpponentWords(nomineeSplit({ cand: g.cand, base: g.base, slots: g.slots }), (o) => `Deck ${o}`)!;
    expect(w).toMatch(/^depends on the opponent: \+\d+\.\d against Deck o\d, −\d+\.\d against Deck o2 \(χ² \d+\.\d on 6 df, p (< 0\.001|0\.\d{3})\)$/);
  });

  it('with no effect it flags about 5% of samples', () => {
    let flagged = 0;
    const N = 1000;
    for (let seed = 1; seed <= N; seed++) {
      const g = games(560, 1000 + seed, () => 0.05);
      const het = heterogeneity(splitPaired(g.cand, g.base, g.slots).byOpp);
      if (het && het.p < 0.05) flagged++;
      // and the words say nothing then
      if (het && het.p >= 0.05) expect(dependsOnOpponentWords(nomineeSplit({ cand: g.cand, base: g.base, slots: g.slots }), (o) => o)).toBeNull();
    }
    // 5% of 1,000 is 50; a binomial 99.9% range is about 27 to 73 (these seeds flag 53)
    expect(flagged).toBeGreaterThanOrEqual(27);
    expect(flagged).toBeLessThanOrEqual(73);
  });

  it('needs two opponents with 20+ games and a spread', () => {
    expect(heterogeneity([{ games: 19, mean: 0.5, se: 0.1 }, { games: 400, mean: 0, se: 0.02 }])).toBeNull();
    expect(heterogeneity([{ games: 400, mean: 0.5, se: 0 }, { games: 400, mean: 0, se: 0.02 }])).toBeNull();
    // the builder's heterogeneity is this one
    expect(builderHeterogeneity).toBe(heterogeneity);
  });

  it('is the one definition the change ledger summarises with', () => {
    const g = games(700, 3, (o) => o * 0.02);
    const ledger: LedgerGame[] = g.slots.map((s, i) => ({ seed: 100 + i, opp: s.opp, first: s.first, base: g.base[i]!, cand: g.cand[i]! }));
    const sum = summarize(ledger);
    const split = splitPaired(g.cand, g.base, g.slots);
    expect(sum.byOpp).toEqual(split.byOpp);
    expect(sum.bySeat).toEqual(split.bySeat);
    const plain = pairedInterval(g.cand, g.base);
    expect(sum.mean).toBe(plain.mean);
    expect(sum.games).toBe(700);
  });
});

describe('the builders’ nominees', () => {
  it('the tracker hands each nominee exactly the held-out games its figure covers, earlier ones first', async () => {
    const rule = adoptionRule({ minGainPp: 1 });
    const prior: LedgerGame[] = Array.from({ length: 140 }, (_, i) => ({ seed: 9_000 + i, opp: OPPS[i % 7]!, first: (Math.floor(i / 7) % 2) as 0 | 1, base: i % 3 === 0 ? 1 : 0, cand: i % 2 === 0 ? 1 : 0 }));
    const priors: (PairedScores | undefined)[] = [{ base: prior.map((g) => g.base), cand: prior.map((g) => g.cand) }, undefined];
    const held = new HeldOutTracker(2, [prior, undefined]);
    const r = rng(5);
    const conf = await confirmStaged(
      rule,
      [{ minGainPp: 1 }, { minGainPp: 1 }],
      112,
      async ({ offset, games, active }) => {
        const slots = blockSlots(offset, games, OPPS);
        const base = slots.map(() => (r() < 0.5 ? 1 : 0));
        const nominees = active.map(() => base.map((b) => (r() < 0.2 ? 1 - b : b)));
        held.stage(active, slots, base, nominees);
        return { base, nominees };
      },
      undefined,
      priors,
    );
    conf.results.forEach((c, i) => {
      const h = held.games(i);
      expect(h.cand.length).toBe(c.heldOut.games);
      expect(h.slots.length).toBe(c.heldOut.games);
      const rec = withSplit(nomineeRecord(`n${i}`, pairedInterval([1, 0], [0, 0]), c), h);
      expect(rec.byOpp!.reduce((a, o) => a + o.games, 0)).toBe(c.heldOut.games);
      expect(rec.bySeat!.reduce((a, o) => a + o.games, 0)).toBe(c.heldOut.games);
    });
    // the pooled nominee's games start with the prior's
    expect(held.games(0).slots.slice(0, 3)).toEqual(prior.slice(0, 3).map((g) => ({ opp: g.opp, first: g.first })));
    // a record without a held-out figure, or games that are not its, stays as it was
    const bare = nomineeRecord('x', pairedInterval([1, 0], [0, 0]));
    expect(withSplit(bare, held.games(1))).toEqual(bare);
    const c0 = nomineeRecord('y', pairedInterval([1, 0], [0, 0]), conf.results[1]);
    expect(withSplit(c0, held.games(0)).byOpp).toBeUndefined();
  });
});
