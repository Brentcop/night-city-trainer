// src/lib/logistic.ts (INFO-4): the ridge logistic fit recovers known coefficients on synthetic data, shrinks them
// under a penalty, and picks λ on a validation split.
import { describe, expect, it } from 'vitest';
import { brier, chooseRidge, fitLogistic, logLoss, predict, solveSpd } from '../src/lib/logistic';

/** A small deterministic PRNG and normal draws. */
function rng(seed: number) {
  let s = seed >>> 0;
  const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
  const normal = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
  return { u, normal };
}

function synth(n: number, beta: number[], b0: number, seed: number, scales = beta.map(() => 1)) {
  const r = rng(seed);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < n; i++) {
    const x = beta.map((_, j) => r.normal() * scales[j]!);
    const z = b0 + x.reduce((s, v, j) => s + v * beta[j]!, 0);
    X.push(x);
    y.push(r.u() < 1 / (1 + Math.exp(-z)) ? 1 : 0);
  }
  return { X, y };
}

describe('logistic regression', () => {
  it('solveSpd solves a small system', () => {
    const x = solveSpd(
      [
        [4, 2],
        [2, 3],
      ],
      [10, 8],
    );
    expect(x[0]).toBeCloseTo(1.75, 10);
    expect(x[1]).toBeCloseTo(1.5, 10);
  });

  it('recovers the coefficients (on the original scale, whatever the column units) with honest standard errors', () => {
    const beta = [1.0, -0.5, 0.02, 0];
    const { X, y } = synth(20000, beta, 0.3, 1, [1, 2, 50, 1]);
    const fit = fitLogistic(X, y);
    expect(fit.converged).toBe(true);
    for (let j = 0; j < beta.length; j++) expect(Math.abs(fit.beta[j]! - beta[j]!)).toBeLessThan(4 * fit.se[j]! + 1e-9);
    expect(fit.intercept).toBeCloseTo(0.3, 1);
    expect(fit.se[2]).toBeLessThan(fit.se[0]!); // the wide column's coefficient is pinned more tightly
  });

  it('a ridge penalty shrinks the coefficients; a constant column gets 0', () => {
    const { X, y } = synth(3000, [1.5, -1], 0, 2);
    const Xc = X.map((x) => [...x, 7]);
    const plain = fitLogistic(Xc, y);
    const ridge = fitLogistic(Xc, y, { lambda: 0.5 });
    expect(plain.beta[2]).toBe(0);
    expect(Math.abs(ridge.beta[0]!)).toBeLessThan(Math.abs(plain.beta[0]!));
    expect(Math.abs(ridge.beta[1]!)).toBeLessThan(Math.abs(plain.beta[1]!));
  });

  it('without an intercept, one column: the slope of σ(a·x)', () => {
    const { X, y } = synth(20000, [0.8], 0, 3);
    const fit = fitLogistic(X, y, { intercept: false });
    expect(fit.intercept).toBe(0);
    expect(fit.beta[0]).toBeCloseTo(0.8, 1);
  });

  it('chooses a larger λ when many columns are noise and the sample is small', () => {
    const beta = [1, ...new Array(30).fill(0)];
    const train = synth(150, beta, 0, 4);
    const valid = synth(3000, beta, 0, 5);
    const { lambda, path } = chooseRidge(train, valid, [0, 0.01, 0.1, 1]);
    expect(lambda).toBeGreaterThan(0);
    expect(path).toHaveLength(4);
  });

  it('log-loss and Brier score of a coin are ln 2 and ¼', () => {
    expect(logLoss([0.5, 0.5], [1, 0])).toBeCloseTo(Math.LN2, 12);
    expect(brier([0.5, 0.5], [1, 0])).toBeCloseTo(0.25, 12);
    expect(predict({ beta: [2], intercept: 0 }, [[0]])[0]).toBe(0.5);
  });
});
