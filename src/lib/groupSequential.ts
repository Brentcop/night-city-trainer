// Group-sequential boundaries for the staged adoption rule (src/lib/evidence.ts, SIM-5): Lan–DeMets alpha spending with
// an O'Brien–Fleming-type spending function. Plain functions, Node and browser.
//
// A one-sided test that looks K times at a statistic Z_k (information fraction t_k, Z a standardised mean of the games so
// far) spends α(t) = 2 − 2·Φ(Φ⁻¹(1 − α/2) / √t) of its error rate by information t: almost nothing at the early looks,
// all of α at t = 1. Each look's boundary c_k is set so that the chance, with no true effect, of first crossing at look k
// is α(t_k) − α(t_{k−1}). The crossing probabilities are computed exactly (to the grid) with the B-value recursion
// (Armitage, McPherson and Rowe): B(t) = Z(t)·√t is Brownian motion, so its density on the not-yet-crossed region is
// carried from look to look by a Gaussian convolution.
//
// With K = 4 equal looks and one-sided α = 0.025 the boundaries are 4.33, 2.96, 2.36, 2.01 (the published values);
// a Bonferroni split of the same α would use 2.50 at every look.
import { normalQuantile } from './evidence';

const SQRT2PI = Math.sqrt(2 * Math.PI);
const phi = (x: number) => Math.exp(-0.5 * x * x) / SQRT2PI;

/** Φ(x), the standard normal distribution function (Numerical Recipes' erfc, relative error below 1.2e-7 in both tails). */
export function normalCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.5 * z);
  const erfc =
    t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - 0.5 * erfc : 0.5 * erfc;
}

/** The O'Brien–Fleming-type spending function: the share of a one-sided α spent by information fraction t (0 < t ≤ 1). */
export function obfSpent(alpha: number, t: number): number {
  if (t <= 0) return 0;
  if (t >= 1) return alpha;
  return 2 - 2 * normalCdf(normalQuantile(1 - alpha / 2) / Math.sqrt(t));
}

/** Grid points per look (odd, for Simpson's rule). */
const GRID = 801;
/** The B-value grid starts this many standard deviations of B(t) below 0 (the mass below is negligible). */
const LOW_SD = 9;

function simpsonWeights(n: number, h: number): Float64Array {
  const w = new Float64Array(n);
  for (let i = 0; i < n; i++) w[i] = (i === 0 || i === n - 1 ? 1 : i % 2 ? 4 : 2) * (h / 3);
  return w;
}

const cache = new Map<string, number[]>();

/**
 * One-sided O'Brien–Fleming-type (Lan–DeMets) boundaries on the Z scale at information fractions `t` (increasing,
 * last one 1 for a planned maximum), spending a one-sided `alpha` in all. A look whose increment of spending is too
 * small to compute gets a boundary of 8 (it can never be crossed in practice).
 */
export function obfBoundaries(alpha: number, t: readonly number[]): number[] {
  if (!(alpha > 0 && alpha < 0.5)) throw new Error(`one-sided alpha must be in (0, 0.5) (got ${alpha})`);
  if (!t.length || t.some((x, i) => !(x > 0 && x <= 1) || (i > 0 && x <= (t[i - 1] ?? 0)))) throw new Error(`information fractions must increase within (0, 1] (got ${t.join(', ')})`);
  const key = `${alpha}|${t.join(',')}`;
  const hit = cache.get(key);
  if (hit) return [...hit];
  const out: number[] = [];
  // density of B on the continuation region at the previous look, on its grid
  let xs: Float64Array | null = null;
  let f: Float64Array | null = null;
  let w: Float64Array | null = null;
  let spentBefore = 0;
  let tPrev = 0;
  for (let k = 0; k < t.length; k++) {
    const tk = t[k]!;
    const inc = obfSpent(alpha, tk) - spentBefore;
    const dt = tk - tPrev;
    const sd = Math.sqrt(dt);
    // P(first crossing at look k | boundary b on the B scale)
    const crossAt = (b: number): number => {
      if (!xs || !f || !w) return 1 - normalCdf(b / Math.sqrt(tk));
      let s = 0;
      for (let i = 0; i < xs.length; i++) s += w[i]! * f[i]! * (1 - normalCdf((b - xs[i]!) / sd));
      return s;
    };
    let bB: number;
    if (inc < 1e-12) bB = 8 * Math.sqrt(tk);
    else if (!xs) bB = normalQuantile(1 - inc) * Math.sqrt(tk);
    else {
      let lo = -10;
      let hi = 10;
      for (let it = 0; it < 80; it++) {
        const mid = (lo + hi) / 2;
        if (crossAt(mid) > inc) lo = mid;
        else hi = mid;
      }
      bB = (lo + hi) / 2;
    }
    out.push(bB / Math.sqrt(tk));
    // carry the density below the boundary to this look
    if (k < t.length - 1) {
      const low = -LOW_SD * Math.sqrt(tk);
      const top = Math.max(bB, low + 1e-6);
      const h = (top - low) / (GRID - 1);
      const nx = new Float64Array(GRID);
      for (let i = 0; i < GRID; i++) nx[i] = low + i * h;
      const nf = new Float64Array(GRID);
      if (!xs || !f || !w) for (let i = 0; i < GRID; i++) nf[i] = phi(nx[i]! / Math.sqrt(tk)) / Math.sqrt(tk);
      else
        for (let i = 0; i < GRID; i++) {
          let s = 0;
          for (let j = 0; j < xs.length; j++) s += w[j]! * f[j]! * phi((nx[i]! - xs[j]!) / sd);
          nf[i] = s / sd;
        }
      xs = nx;
      f = nf;
      w = simpsonWeights(GRID, h);
    }
    spentBefore = obfSpent(alpha, tk);
    tPrev = tk;
  }
  cache.set(key, out);
  return [...out];
}

/** The chance that a statistic with no true effect crosses any of `bounds` (Z scale) at fractions `t`: the error spent. */
export function crossingProbability(bounds: readonly number[], t: readonly number[]): number {
  let xs: Float64Array | null = null;
  let f: Float64Array | null = null;
  let w: Float64Array | null = null;
  let total = 0;
  let tPrev = 0;
  for (let k = 0; k < t.length; k++) {
    const tk = t[k]!;
    const sd = Math.sqrt(tk - tPrev);
    const bB = bounds[k]! * Math.sqrt(tk);
    if (!xs || !f || !w) total += 1 - normalCdf(bB / Math.sqrt(tk));
    else for (let i = 0; i < xs.length; i++) total += w[i]! * f[i]! * (1 - normalCdf((bB - xs[i]!) / sd));
    const low = -LOW_SD * Math.sqrt(tk);
    const h = (Math.max(bB, low + 1e-6) - low) / (GRID - 1);
    const nx = new Float64Array(GRID);
    const nf = new Float64Array(GRID);
    for (let i = 0; i < GRID; i++) nx[i] = low + i * h;
    if (!xs || !f || !w) for (let i = 0; i < GRID; i++) nf[i] = phi(nx[i]! / Math.sqrt(tk)) / Math.sqrt(tk);
    else
      for (let i = 0; i < GRID; i++) {
        let s = 0;
        for (let j = 0; j < xs.length; j++) s += w[j]! * f[j]! * phi((nx[i]! - xs[j]!) / sd);
        nf[i] = s / sd;
      }
    xs = nx;
    f = nf;
    w = simpsonWeights(GRID, h);
    tPrev = tk;
  }
  return total;
}

/** Equal information fractions for K looks: 1/K, 2/K, …, 1. */
export const equalFractions = (k: number): number[] => Array.from({ length: k }, (_, i) => (i + 1) / k);
