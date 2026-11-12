// SIM-6: the power-rating model with its full covariance (src/lib/ratingModel.ts), the coverage of its intervals on
// simulated ratings, and the extra-games planner.
import { describe, expect, it } from 'vitest';
import { expectedVs, fieldInterval, fitRatings, invertSpd, planExtraGames, seededRandom, simulateCoverage, type RatedGame } from '../src/lib/ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));

/** Random games between `n` decks with true ratings `truth`, seats alternating. */
function synthGames(truth: number[], games: number, seed: number): RatedGame[] {
  const r = seededRandom(seed);
  const out: RatedGame[] = [];
  for (let q = 0; q < games; q++) {
    const i = Math.floor(r() * truth.length);
    let j = Math.floor(r() * (truth.length - 1));
    if (j >= i) j++;
    const first = (q % 2) as 0 | 1;
    const p = σ(truth[i]! - truth[j]! + (first === 0 ? 0.1 : -0.1));
    out.push({ a: `d${i}`, b: `d${j}`, first, s: r() < p ? 1 : 0 });
  }
  return out;
}

describe('the rating fit', () => {
  it('inverts a positive-definite matrix', () => {
    const m = [
      [4, 1, 0.5],
      [1, 3, 0.2],
      [0.5, 0.2, 2],
    ];
    const inv = invertSpd(m);
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++) {
        const x = m[i]!.reduce((s, v, k) => s + v * inv[k]![j]!, 0);
        expect(x).toBeCloseTo(i === j ? 1 : 0, 12);
      }
    expect(() => invertSpd([[0]])).toThrow();
  });

  it('recovers the ratings, centred, with the going-first term', () => {
    const truth = [0.8, 0.3, 0, -0.4, -0.7];
    const fit = fitRatings(synthGames(truth, 6000, 1), { names: truth.map((_, k) => `d${k}`) });
    expect(fit.r.reduce((a, x) => a + x, 0)).toBeCloseTo(0, 6);
    const mean = truth.reduce((a, x) => a + x, 0) / truth.length;
    fit.r.forEach((x, k) => expect(Math.abs(x - (truth[k]! - mean))).toBeLessThan(0.12));
    expect(fit.h).toBeGreaterThan(0.03);
    expect(fit.h).toBeLessThan(0.17);
    expect(fit.played.reduce((a, x) => a + x, 0)).toBe(12000);
  });

  it('the full interval is never narrower than the diagonal one here, and both contain the estimate', () => {
    const truth = Array.from({ length: 12 }, (_, k) => (k - 6) / 6);
    const fit = fitRatings(synthGames(truth, 500, 2));
    const all = fit.names.map((_, k) => k);
    for (const k of all) {
      const f = fieldInterval(fit, k, all);
      const d = fieldInterval(fit, k, all, { mode: 'diagonal' });
      expect(f.wr).toBe(d.wr);
      expect(f.lo).toBeLessThan(f.wr);
      expect(f.hi).toBeGreaterThan(f.wr);
      expect(f.hi - f.lo).toBeGreaterThanOrEqual(d.hi - d.lo - 1e-9);
      expect(f.wr).toBeCloseTo(expectedVs(fit.r, k, fit.r[k]!, all), 12);
    }
  });

  it('coverage on simulated ratings: the full interval is near 90% and no worse than the diagonal one', () => {
    const c = simulateCoverage({ decks: 20, rounds: 12, reps: 40, seed: 5 });
    expect(c.full).toBeGreaterThan(0.85);
    expect(c.full).toBeGreaterThanOrEqual(c.diagonal);
    expect(c.fullWidth).toBeGreaterThan(c.diagonalWidth);
  });
});

describe('the extra-games planner', () => {
  const truth = Array.from({ length: 10 }, (_, k) => (k - 5) / 4);
  const fit = fitRatings(synthGames(truth, 300, 3));

  it('spends the budget in batches and lowers the weighted variance more than an even spread', () => {
    for (const target of ['tiers', 'width'] as const) {
      const plan = planExtraGames(fit, { budget: 100, batch: 10, target });
      expect(plan.picks.reduce((a, p) => a + p.games, 0)).toBe(100);
      expect(plan.after).toBeLessThan(plan.before);
      expect(plan.after).toBeLessThanOrEqual(plan.evenAfter + 1e-12);
      expect(plan.evenGamesForSame).toBeGreaterThanOrEqual(100);
      for (const d of plan.decks) expect(d.sdPlan).toBeLessThanOrEqual(d.sdNow + 1e-12);
    }
  });

  it('pairs only eligible decks', () => {
    const plan = planExtraGames(fit, { budget: 60, batch: 20, eligible: [0, 1, 2] });
    for (const p of plan.picks) {
      expect([0, 1, 2]).toContain(p.a);
      expect([0, 1, 2]).toContain(p.b);
    }
  });

  it('its expected variance matches a refit with the planned information added', () => {
    // adding games exactly at the predicted rate changes the Hessian by the planned amount: compare the predicted spread
    // with the spread of a refit on the old games plus expected-score games (s = p, a fractional score)
    const plan = planExtraGames(fit, { budget: 40, batch: 40, target: 'width' });
    const p = plan.picks[0]!;
    const extra: RatedGame[] = Array.from({ length: 40 }, (_, g) => {
      const first = (g % 2) as 0 | 1;
      return { a: fit.names[p.a]!, b: fit.names[p.b]!, first, s: σ(fit.r[p.a]! - fit.r[p.b]! + (first === 0 ? fit.h : -fit.h)) };
    });
    const refit = fitRatings([...synthGames(truth, 300, 3), ...extra], { names: fit.names });
    const all = fit.names.map((_, k) => k);
    for (const k of [p.a, p.b]) expect(fieldInterval(refit, k, all).sdWr).toBeCloseTo(plan.decks[k]!.sdPlan, 2);
  });
});
