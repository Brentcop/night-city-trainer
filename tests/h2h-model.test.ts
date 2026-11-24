// SIM-4: head-to-head estimates shrunk toward the rating model (src/lib/h2hModel.ts) and their readers.
import { describe, expect, it } from 'vitest';
import { fitShrinkage, h2hEstimator, h2hFileLookup, h2hModelFields, leaveOneEventOut, pairSpreadVar, shrunkEstimate } from '../src/lib/h2hModel';
import { fitRatings, predictPair, seededRandom, type RatedGame } from '../src/lib/ratingModel';
import { extremes, h2hFor } from '../src/lib/deckRecord';

const σ = (x: number) => 1 / (1 + Math.exp(-x));
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

/** Every pair of `n` decks plays `per` games; the true logit is rating difference plus a pair effect of sd `pairSd`. */
function synth(n: number, per: number, pairSd: number, seed: number): RatedGame[] {
  const r = seededRandom(seed);
  const truth = Array.from({ length: n }, () => gauss(r) * 0.5);
  const out: RatedGame[] = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const u = gauss(r) * pairSd;
      for (let g = 0; g < per; g++) {
        const first = (g % 2) as 0 | 1;
        out.push({ a: `d${i}`, b: `d${j}`, first, s: r() < σ(truth[i]! - truth[j]! + u + (first === 0 ? 0.07 : -0.07)) ? 1 : 0 });
      }
    }
  return out;
}

describe('pair shrinkage', () => {
  it('finds pair effects where there are some and almost none where there are none', () => {
    const none = fitShrinkage(fitRatings(synth(16, 12, 0, 1)), synth(16, 12, 0, 1));
    const some = fitShrinkage(fitRatings(synth(16, 12, 0.8, 2)), synth(16, 12, 0.8, 2));
    expect(some.rho).toBeGreaterThan(0.05);
    expect(some.priorGames).toBeLessThan(20);
    expect(none.priorGames).toBeGreaterThan(some.priorGames * 3);
    expect(some.pairs).toBe(120);
  });

  // REVIEW_2026-11-24 L1 / B.3: the moment estimate is taken on residuals from a fit to the same games, which pulls each
  // pair toward its prediction; without the fit's share added back it read below zero with no pair effect at all. Games
  // simulated from one known fit, thin pairs as recorded (a 30-deck round robin of 6 games a pair), 40 simulations each:
  // with no pair effect the median estimate is about 0 (the uncorrected one is clearly below); with pair effects of logit
  // sd 0.2 it recovers their spread (the oracle: the effects drawn, measured the same way against the true ratings).
  // Measured when written: medians −0.0004 corrected, −0.0133 uncorrected with none; 0.0090 against an oracle of 0.0091
  // (uncorrected −0.0039) at sd 0.2. The tolerances (±0.002; within 30% of the oracle) leave room for the medians' noise.
  describe('the estimate is unbiased on games simulated from a known fit', () => {
    const N = 30;
    const PER = 6;
    const REPS = 40;
    const truthR = seededRandom(77);
    const truth = Array.from({ length: N }, () => gauss(truthR) * 0.5);
    const H = 0.3;
    const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]!;
    function simulate(tau: number) {
      const est: number[] = [];
      const uncorrected: number[] = [];
      const oracle: number[] = [];
      for (let rep = 0; rep < REPS; rep++) {
        const r = seededRandom(1_000 + rep + (tau > 0 ? 500 : 0));
        const games: RatedGame[] = [];
        let on = 0;
        let od = 0;
        for (let i = 0; i < N; i++)
          for (let j = i + 1; j < N; j++) {
            const u = gauss(r) * tau;
            const pb = σ(truth[i]! - truth[j]!);
            on += PER * (PER - 1) * (σ(truth[i]! - truth[j]! + u) - pb) ** 2;
            od += PER * (PER - 1) * pb * (1 - pb);
            for (let g = 0; g < PER; g++) {
              const first = (g % 2) as 0 | 1;
              games.push({ a: `d${i}`, b: `d${j}`, first, s: r() < σ(truth[i]! - truth[j]! + u + (first === 0 ? H : -H)) ? 1 : 0 });
            }
          }
        const fit = fitRatings(games);
        est.push(fitShrinkage(fit, games).rhoRaw);
        // a zero covariance turns the correction off: the estimate as computed until 2026-11-24
        uncorrected.push(fitShrinkage({ ...fit, cov: fit.cov.map((row) => row.map(() => 0)) }, games).rhoRaw);
        oracle.push(on / od);
      }
      return { est: median(est), uncorrected: median(uncorrected), oracle: median(oracle) };
    }

    it('no pair effect: the median estimate is about 0, the uncorrected one below it', () => {
      const s = simulate(0);
      expect(Math.abs(s.est)).toBeLessThan(0.002);
      expect(s.uncorrected).toBeLessThan(-0.004);
    });

    it('pair effects of logit sd 0.2: the median estimate recovers their spread', () => {
      const s = simulate(0.2);
      expect(s.oracle).toBeGreaterThan(0.007);
      expect(s.est / s.oracle).toBeGreaterThan(0.7);
      expect(s.est / s.oracle).toBeLessThan(1.3);
      expect(s.uncorrected).toBeLessThan(s.est - 0.004);
    });
  });

  it('pairSpreadVar is the beta-binomial prior worth m games: ρ·p(1−p) with ρ = 1/(m + 1)', () => {
    expect(pairSpreadVar(0.5, 99)).toBeCloseTo(0.25 / 100, 15);
    expect(pairSpreadVar(0.7, 127)).toBeCloseTo((0.7 * 0.3) / 128, 15);
  });

  it('the estimate is the prediction plus the residual over games + m, in [0, 1]', () => {
    expect(shrunkEstimate(0.6, 3, 3, 1.8, 3)).toBeCloseTo(0.6 + 1.2 / 6, 12);
    expect(shrunkEstimate(0.6, 0, 0, 0, 3)).toBe(0.6);
    expect(shrunkEstimate(0.95, 10, 10, 1, 0)).toBe(1);
  });

  it('the lookup is symmetric and gives unmet pairs the prediction', () => {
    const games = synth(6, 4, 0.5, 3).filter((g) => !(g.a === 'd0' && g.b === 'd1'));
    const est = h2hEstimator(games);
    const ab = est.lookup('d2', 'd3');
    const ba = est.lookup('d3', 'd2');
    expect(ab.g).toBe(4);
    expect(ab.w + ba.w).toBe(4);
    expect(ab.p! + ba.p!).toBeCloseTo(1, 12);
    const unmet = est.lookup('d0', 'd1');
    expect(unmet.g).toBe(0);
    expect(unmet.p).toBeCloseTo(predictPair(est.fit, est.fit.names.indexOf('d0'), est.fit.names.indexOf('d1')), 12);
    expect(est.lookup('d0', 'nobody')).toEqual({ w: 0, g: 0 });
  });

  it('h2h.json fields read back through the file lookup, unmet pairs included', () => {
    const games = synth(5, 3, 0.4, 4).filter((g) => !(g.a === 'd0' && g.b === 'd4'));
    const decks = ['d0', 'd1', 'd2', 'd3', 'd4'];
    const acc = new Map<string, [number, number, number, number]>();
    for (const g of games) {
      const i = decks.indexOf(g.a);
      const j = decks.indexOf(g.b);
      const row = acc.get(`${i}|${j}`) ?? [i, j, 0, 0];
      row[2] += g.s;
      row[3]++;
      acc.set(`${i}|${j}`, row);
    }
    const pairs = [...acc.values()];
    const { model, shrunk } = h2hModelFields(decks, pairs, games);
    expect(shrunk).toHaveLength(pairs.length);
    const look = h2hFileLookup({ decks, pairs, model, shrunk });
    const est = h2hEstimator(games);
    expect(look('d1', 'd2').p).toBeCloseTo(est.lookup('d1', 'd2').p!, 3);
    expect(look('d2', 'd1').w).toBe(est.lookup('d2', 'd1').w);
    expect(look('d0', 'd4')).toMatchObject({ w: 0, g: 0 });
    expect(look('d0', 'd4').p).toBeCloseTo(est.lookup('d0', 'd4').p!, 3);
    // an old file without a model: raw records only
    expect(h2hFileLookup({ decks, pairs })('d1', 'd2').p).toBeUndefined();
    expect(h2hFileLookup({ decks, pairs })('d0', 'd4')).toEqual({ w: 0, g: 0 });
  });
});

describe('leave one event out', () => {
  it('on thin synthetic pairs the shrunk estimate predicts better than the raw rate and the 50% shrink', () => {
    // 6 "events" of one game per pair between the same 12 decks (the same true ratings and pair effects throughout)
    const r = seededRandom(100);
    const n = 12;
    const truth = Array.from({ length: n }, () => gauss(r) * 0.5);
    const pairU = Array.from({ length: n * n }, () => gauss(r) * 0.3);
    const events = Array.from({ length: 6 }, (_, e) => {
      const ev: RatedGame[] = [];
      for (let i = 0; i < n; i++)
        for (let j = i + 1; j < n; j++) {
          const first = ((e + i + j) % 2) as 0 | 1;
          ev.push({ a: `d${i}`, b: `d${j}`, first, s: r() < σ(truth[i]! - truth[j]! + pairU[i * n + j]! + (first === 0 ? 0.07 : -0.07)) ? 1 : 0 });
        }
      return ev;
    });
    const out = leaveOneEventOut(events);
    expect(out.all.games).toBe(6 * 66);
    expect(out.all.brier.shrunk).toBeLessThan(out.all.brier.raw);
    expect(out.all.brier.shrunk).toBeLessThan(out.all.brier.breeder);
    expect(out.all.brier.shrunk).toBeLessThan(out.all.brier.coin);
  });
});

describe('deck profiles read the estimate', () => {
  it('h2hFor carries it and extremes ranks by it', () => {
    const file = { events: 1, decks: ['A', 'B', 'C'], pairs: [[0, 1, 6, 7], [0, 2, 5, 7]] as [number, number, number, number][], shrunk: [0.55, 0.62] };
    const rows = h2hFor('A', file);
    expect(rows.find((x) => x.opp === 'B')).toMatchObject({ w: 6 / 7, est: 0.55 });
    expect(h2hFor('B', file)[0]).toMatchObject({ opp: 'A', est: expect.closeTo(0.45, 9) });
    // by raw rate B is the best matchup; by the estimate C is
    expect(extremes(rows)!.best.opp).toBe('C');
    expect(extremes(rows.map(({ est: _e, ...x }) => x))!.best.opp).toBe('B');
  });
});
