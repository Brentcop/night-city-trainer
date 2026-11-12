// The power-rating model (scripts/ratings.ts, scripts/build-h2h.ts, scripts/rating-plan.ts): a Bradley–Terry fit with a
// going-first term, its covariance from the full Hessian, the expected win rate against a field with an interval, and a
// planner that picks extra pairings by how much they would narrow the intervals that matter (SIM-6). Pure and seeded.
//
// P(A beats B | A on the play) = σ(rA − rB + h·[A first] − h·[B first]); ties count half a win for each side. A Gaussian
// prior (sd `prior`, default 1) on every rating keeps decks with few games near average and fixes the scale's origin
// (the likelihood ignores a common shift, so the fitted ratings sum to zero). h has no prior.
//
// Intervals (2026-11-12, SIM-6): the expected win rate of deck k against a field is a function of every rating, so its
// variance is gᵀΣg with g its gradient and Σ the inverse of the full Hessian of the log posterior at the optimum (ratings
// and h). The diagonal approximation it replaced (1 / (prior precision + Σ p(1−p) over k's games), with every other
// rating held fixed) ignores the opponents' own uncertainty and is kept as `mode: 'diagonal'` for comparison.

/** One game for the fit: deck a against deck b, who went first (0 = a), a's score (1, ½, 0). */
export interface RatedGame {
  a: string;
  b: string;
  first: 0 | 1;
  s: number;
}

export interface RatingFit {
  names: string[];
  /** fitted ratings (logit scale), in `names` order; they sum to zero */
  r: number[];
  /** going-first term (logit scale) */
  h: number;
  prior: number;
  /** games played per deck */
  played: number[];
  /** inverse of the full Hessian of the negative log posterior: (n + 1) × (n + 1), the last row and column are h */
  cov: number[][];
  /** the old standard errors: 1 / √(the diagonal of the information), every other parameter held fixed */
  diagSe: number[];
}

const σ = (x: number) => 1 / (1 + Math.exp(-x));

/**
 * Fit the model. The iteration is the one scripts/ratings.ts always used (a diagonal Newton step per rating, a Newton
 * step for h, re-centred, up to 400 rounds), so the ratings are the same numbers as before; the covariance is computed
 * once at the optimum. `names` fixes the order (default: first appearance in `games`).
 */
export function fitRatings(games: readonly RatedGame[], o: { prior?: number; names?: readonly string[] } = {}): RatingFit {
  const PRIOR = o.prior ?? 1;
  const names = o.names ? [...o.names] : [...new Set(games.flatMap((g) => [g.a, g.b]))];
  const idx = new Map(names.map((n, i) => [n, i]));
  const n = names.length;
  const r = new Float64Array(n);
  let h = 0;
  const pairs = games.map((g) => [idx.get(g.a)!, idx.get(g.b)!] as const);
  for (let it = 0; it < 400; it++) {
    const grad = new Float64Array(n);
    const hess = new Float64Array(n);
    let gh = 0;
    let hh = 0;
    games.forEach((g, q) => {
      const [i, j] = pairs[q]!;
      const adv = g.first === 0 ? h : -h;
      const p = σ(r[i]! - r[j]! + adv);
      const d = g.s - p;
      const w = p * (1 - p);
      grad[i]! += d;
      grad[j]! -= d;
      hess[i]! += w;
      hess[j]! += w;
      gh += g.first === 0 ? d : -d;
      hh += w;
    });
    let maxStep = 0;
    for (let k = 0; k < n; k++) {
      const step = (grad[k]! - r[k]! / PRIOR ** 2) / (hess[k]! + 1 / PRIOR ** 2);
      r[k]! += step;
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    h += gh / Math.max(1e-9, hh);
    const mean = r.reduce((a, x) => a + x, 0) / Math.max(1, n);
    for (let k = 0; k < n; k++) r[k]! -= mean;
    if (maxStep < 1e-7) break;
  }
  // the full Hessian at the optimum, and the old diagonal information
  const H: number[][] = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === j && i < n ? 1 / PRIOR ** 2 : 0)));
  const info = new Float64Array(n).fill(1 / PRIOR ** 2);
  const played = new Array<number>(n).fill(0);
  games.forEach((g, q) => {
    const [i, j] = pairs[q]!;
    const sgn = g.first === 0 ? 1 : -1;
    const p = σ(r[i]! - r[j]! + sgn * h);
    const w = p * (1 - p);
    // x = e_i − e_j + sgn·e_h; H += w·x·xᵀ
    H[i]![i]! += w;
    H[j]![j]! += w;
    H[i]![j]! -= w;
    H[j]![i]! -= w;
    H[n]![n]! += w;
    H[i]![n]! += sgn * w;
    H[n]![i]! += sgn * w;
    H[j]![n]! -= sgn * w;
    H[n]![j]! -= sgn * w;
    info[i]! += w;
    info[j]! += w;
    played[i]!++;
    played[j]!++;
  });
  if (H[n]![n]! <= 0) H[n]![n]! = 1; // no games: h is unidentified, give it unit variance
  return { names, r: [...r], h, prior: PRIOR, played, cov: invertSpd(H), diagSe: [...info].map((x) => Math.sqrt(1 / x)) };
}

/** Inverse of a symmetric positive-definite matrix (Cholesky). */
export function invertSpd(m: readonly (readonly number[])[]): number[][] {
  const n = m.length;
  const L: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = m[i]![j]!;
      for (let k = 0; k < j; k++) s -= L[i]![k]! * L[j]![k]!;
      if (i === j) {
        if (!(s > 0)) throw new Error('matrix is not positive definite');
        L[i]![i] = Math.sqrt(s);
      } else L[i]![j] = s / L[j]![j]!;
    }
  // inverse of L, then (L⁻¹)ᵀ L⁻¹
  const Li: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++) {
    Li[i]![i] = 1 / L[i]![i]!;
    for (let j = 0; j < i; j++) {
      let s = 0;
      for (let k = j; k < i; k++) s -= L[i]![k]! * Li[k]![j]!;
      Li[i]![j] = s / L[i]![i]!;
    }
  }
  const out: number[][] = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = 0;
      for (let k = i; k < n; k++) s += Li[k]![i]! * Li[k]![j]!;
      out[i]![j] = s;
      out[j]![i] = s;
    }
  return out;
}

/** Expected win rate of a deck rated `rk` against the decks `pool` (indices into `r`), leaving out `k` itself. */
export function expectedVs(r: readonly number[], k: number, rk: number, pool: readonly number[]): number {
  let s = 0;
  let c = 0;
  for (const j of pool) {
    if (j === k) continue;
    s += σ(rk - r[j]!);
    c++;
  }
  return s / Math.max(1, c);
}

/** Gradient of expectedVs(r, k, r[k], pool) with respect to every parameter (n + 1 long; h's entry is 0). */
export function fieldGradient(r: readonly number[], k: number, pool: readonly number[]): number[] {
  const g = new Array<number>(r.length + 1).fill(0);
  const others = pool.filter((j) => j !== k);
  const c = Math.max(1, others.length);
  for (const j of others) {
    const p = σ(r[k]! - r[j]!);
    const d = (p * (1 - p)) / c;
    g[k]! += d;
    g[j]! -= d;
  }
  return g;
}

const quad = (cov: readonly (readonly number[])[], a: readonly number[], b: readonly number[] = a) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i]!;
    if (!ai) continue;
    const row = cov[i]!;
    for (let j = 0; j < b.length; j++) if (b[j]) s += ai * row[j]! * b[j]!;
  }
  return s;
};

export interface FieldInterval {
  wr: number;
  lo: number;
  hi: number;
  /** standard deviation of the expected win rate (delta method; diagonal mode: the deck's own rating only) */
  sdWr: number;
  /** the rating-scale spread the interval is drawn with: lo/hi are expectedVs at r_k ∓ z·sdRating */
  sdRating: number;
}

/**
 * The expected win rate of deck k against `pool` with a two-sided interval of `z` standard errors. The interval is
 * drawn on the rating scale and mapped through expectedVs, so it stays inside (0, 1) and keeps its old shape:
 * - 'full': the effective rating spread is sd(wr) / (∂wr/∂r_k), with sd(wr)² = gᵀΣg over every rating;
 * - 'diagonal': the deck's own diagonal standard error, every other rating fixed (the rule before 2026-11-12).
 */
export function fieldInterval(fit: RatingFit, k: number, pool: readonly number[], o: { z?: number; mode?: 'full' | 'diagonal' } = {}): FieldInterval {
  const z = o.z ?? 1.645;
  const g = fieldGradient(fit.r, k, pool);
  const dk = g[k]!;
  const wr = expectedVs(fit.r, k, fit.r[k]!, pool);
  let sdRating: number;
  let sdWr: number;
  if (o.mode === 'diagonal') {
    sdRating = fit.diagSe[k]!;
    sdWr = dk * sdRating;
  } else {
    sdWr = Math.sqrt(Math.max(0, quad(fit.cov, g)));
    sdRating = dk > 0 ? sdWr / dk : Math.sqrt(fit.cov[k]![k]!);
  }
  return { wr, lo: expectedVs(fit.r, k, fit.r[k]! - z * sdRating, pool), hi: expectedVs(fit.r, k, fit.r[k]! + z * sdRating, pool), sdWr, sdRating };
}

/** Predicted score of a against b averaged over both seats (the going-first term cancels). */
export function predictPair(fit: Pick<RatingFit, 'r' | 'h'>, i: number, j: number): number {
  const d = fit.r[i]! - fit.r[j]!;
  return (σ(d + fit.h) + σ(d - fit.h)) / 2;
}

// ---------------------------------------------------------------- the extra-games planner

export interface PlanOptions {
  /** games to add in all */
  budget: number;
  /** games per pick (one pairing played this many times, seats alternating) */
  batch: number;
  /**
   * 'tiers' (default): weight each deck by how close its expected win rate is to a tier boundary, in its own standard
   * deviations (exp(−d²/2)), so games go where a letter or ± could change; 'width': every deck's variance counts the same
   */
  target?: 'tiers' | 'width';
  /** tier boundaries on the expected win rate (default: the Sim tier's, src/lib/simTier.ts) */
  boundaries?: readonly number[];
  /** decks that may be paired (indices; default every deck) */
  eligible?: readonly number[];
  /** the field the expected win rate is measured against (indices; default every deck) */
  pool?: readonly number[];
}

export interface PlanPick {
  a: number;
  b: number;
  games: number;
  /** the drop in the weighted variance sum this pick was expected to give, when it was picked */
  drop: number;
}

export interface Plan {
  picks: PlanPick[];
  /** the weighted sum of variances of the expected win rates (Σ ω_k · Var(wr_k)) before and after the plan */
  before: number;
  after: number;
  /** after the same budget spread evenly over every eligible pairing */
  evenAfter: number;
  /** games the even spread needs to reach the plan's `after` (Infinity when it cannot within 20 × the budget) */
  evenGamesForSame: number;
  /** per deck: the weight, and the standard deviation of its expected win rate now, after the plan, after the even spread */
  decks: { weight: number; sdNow: number; sdPlan: number; sdEven: number }[];
}

/** The Sim tier boundaries (src/lib/simTier.ts SIM_TIER_BANDS, without −∞). */
export const TIER_BOUNDARIES = [0.36, 0.45, 0.55, 0.64] as const;

function addInfo(cov: number[][], x: readonly number[], amount: number): void {
  // Sherman–Morrison: (H + a·x·xᵀ)⁻¹ = Σ − a·(Σx)(Σx)ᵀ / (1 + a·xᵀΣx)
  const n = cov.length;
  const sx = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let j = 0; j < n; j++) if (x[j]) s += cov[i]![j]! * x[j]!;
    sx[i] = s;
  }
  let xsx = 0;
  for (let i = 0; i < n; i++) xsx += (x[i] ?? 0) * sx[i]!;
  const c = amount / (1 + amount * xsx);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cov[i]![j]! -= c * sx[i]! * sx[j]!;
}

const pairX = (n: number, i: number, j: number) => {
  const x = new Array<number>(n + 1).fill(0);
  x[i] = 1;
  x[j] = -1;
  return x;
};

/**
 * Greedy plan of extra games: each step adds `batch` games of the eligible pairing whose result would most reduce the
 * weighted sum of variances of the expected win rates (the information a game adds is p(1−p) along e_i − e_j at the
 * current ratings; seats alternate, so the going-first term cancels), until the budget is spent. Expected values only:
 * nothing is played. Also returns what the same budget spread evenly would give, for comparison.
 */
export function planExtraGames(fit: RatingFit, o: PlanOptions): Plan {
  const n = fit.names.length;
  const pool = o.pool ?? fit.names.map((_, k) => k);
  const eligible = o.eligible ?? fit.names.map((_, k) => k);
  const grads = fit.names.map((_, k) => fieldGradient(fit.r, k, pool));
  const varOf = (cov: number[][], k: number) => Math.max(0, quad(cov, grads[k]!));
  const bounds = o.boundaries ?? TIER_BOUNDARIES;
  const weight = fit.names.map((_, k) => {
    if ((o.target ?? 'tiers') === 'width') return 1;
    const sd = Math.sqrt(varOf(fit.cov, k)) || 1e-9;
    const wr = expectedVs(fit.r, k, fit.r[k]!, pool);
    const d = Math.min(...bounds.map((b) => Math.abs(wr - b)));
    return Math.exp(-0.5 * (d / sd) ** 2);
  });
  const objective = (cov: number[][]) => weight.reduce((s, w, k) => s + w * varOf(cov, k), 0);
  const copy = (m: number[][]) => m.map((row) => [...row]);
  const pairs: [number, number][] = [];
  for (let x = 0; x < eligible.length; x++) for (let y = x + 1; y < eligible.length; y++) pairs.push([eligible[x]!, eligible[y]!]);
  const wOf = (i: number, j: number) => {
    const p = σ(fit.r[i]! - fit.r[j]!);
    return p * (1 - p);
  };

  const cov = copy(fit.cov);
  const picks: PlanPick[] = [];
  const steps = Math.floor(o.budget / Math.max(1, o.batch));
  for (let s = 0; s < steps && pairs.length; s++) {
    // B = Σ Gᵀ Ω G Σ, so the drop for x is a·xᵀBx / (1 + a·xᵀΣx)
    const SG = grads.map((g) => {
      const v = new Array<number>(n + 1).fill(0);
      for (let i = 0; i <= n; i++) {
        let t = 0;
        const row = cov[i]!;
        for (let j = 0; j <= n; j++) if (g[j]) t += row[j]! * g[j]!;
        v[i] = t;
      }
      return v;
    });
    let best = -1;
    let bestDrop = -Infinity;
    pairs.forEach(([i, j], q) => {
      const a = o.batch * wOf(i, j);
      const xSx = cov[i]![i]! + cov[j]![j]! - 2 * cov[i]![j]!;
      let xBx = 0;
      for (let k = 0; k < n; k++) {
        const v = SG[k]![i]! - SG[k]![j]!;
        xBx += weight[k]! * v * v;
      }
      const drop = (a * xBx) / (1 + a * xSx);
      if (drop > bestDrop) {
        bestDrop = drop;
        best = q;
      }
    });
    const [i, j] = pairs[best]!;
    addInfo(cov, pairX(n, i, j), o.batch * wOf(i, j));
    const last = picks[picks.length - 1];
    if (last && last.a === i && last.b === j) {
      last.games += o.batch;
      last.drop += bestDrop;
    } else picks.push({ a: i, b: j, games: o.batch, drop: bestDrop });
  }
  const even = (games: number) => {
    const c = copy(fit.cov);
    // an even spread is a sum of rank-one terms; add them one pairing at a time
    for (const [i, j] of pairs) addInfo(c, pairX(n, i, j), (games / pairs.length) * wOf(i, j));
    return c;
  };
  const evenCov = even(steps * o.batch);
  const after = objective(cov);
  let evenGamesForSame = Infinity;
  if (objective(evenCov) <= after) evenGamesForSame = steps * o.batch;
  else {
    let lo = steps * o.batch;
    let hi = lo * 20;
    if (objective(even(hi)) <= after) {
      for (let it = 0; it < 30; it++) {
        const mid = (lo + hi) / 2;
        if (objective(even(mid)) <= after) hi = mid;
        else lo = mid;
      }
      evenGamesForSame = Math.round(hi);
    }
  }
  return {
    picks,
    before: objective(fit.cov),
    after,
    evenAfter: objective(evenCov),
    evenGamesForSame,
    decks: fit.names.map((_, k) => ({ weight: weight[k]!, sdNow: Math.sqrt(varOf(fit.cov, k)), sdPlan: Math.sqrt(varOf(cov, k)), sdEven: Math.sqrt(varOf(evenCov, k)) })),
  };
}

// ---------------------------------------------------------------- coverage on simulated ratings

/** Deterministic random numbers (mulberry32). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());

export interface CoverageResult {
  reps: number;
  /** share of (deck, rep) where the 90% interval held the true expected win rate */
  full: number;
  diagonal: number;
  /** mean interval width (points of win rate) */
  fullWidth: number;
  diagonalWidth: number;
}

/**
 * Coverage of the 90% field interval on simulated ratings: true ratings ~ N(0, sdTrue²), a going-first edge `h`,
 * `rounds` rounds of random pairings (every deck once per round, Bo`gamesPerMatch`), the model fitted, and each deck's
 * interval checked against its true expected win rate vs the field, with the full and the diagonal error.
 */
export function simulateCoverage(o: { decks: number; rounds: number; gamesPerMatch?: number; reps: number; sdTrue?: number; h?: number; seed?: number; z?: number; swiss?: boolean }): CoverageResult {
  const r = seededRandom(o.seed ?? 1);
  const per = o.gamesPerMatch ?? 3;
  let hitF = 0;
  let hitD = 0;
  let wF = 0;
  let wD = 0;
  let cells = 0;
  for (let rep = 0; rep < o.reps; rep++) {
    const truth = Array.from({ length: o.decks }, () => gauss(r) * (o.sdTrue ?? 0.6));
    const names = truth.map((_, k) => `d${k}`);
    const games: RatedGame[] = [];
    const points = new Array<number>(o.decks).fill(0);
    for (let round = 0; round < o.rounds; round++) {
      // Swiss: pair by points with random tie-breaks; otherwise a random order
      const order = names.map((_, k) => k).sort((x, y) => (o.swiss ? points[y]! - points[x]! : 0) || r() - 0.5);
      for (let q = 0; q + 1 < order.length; q += 2) {
        const i = order[q]!;
        const j = order[q + 1]!;
        let wi = 0;
        for (let g = 0; g < per; g++) {
          const first = (g % 2) as 0 | 1;
          const p = σ(truth[i]! - truth[j]! + (first === 0 ? 1 : -1) * (o.h ?? 0.07));
          const s = r() < p ? 1 : 0;
          wi += s;
          games.push({ a: names[i]!, b: names[j]!, first, s });
        }
        points[wi * 2 > per ? i : j]!++;
      }
    }
    const fit = fitRatings(games, { names });
    const pool = names.map((_, k) => k);
    const mean = truth.reduce((a, x) => a + x, 0) / truth.length;
    const centred = truth.map((x) => x - mean);
    for (let k = 0; k < o.decks; k++) {
      if (!fit.played[k]) continue;
      const tw = expectedVs(centred, k, centred[k]!, pool);
      const f = fieldInterval(fit, k, pool, { z: o.z ?? 1.645 });
      const d = fieldInterval(fit, k, pool, { z: o.z ?? 1.645, mode: 'diagonal' });
      if (tw >= f.lo && tw <= f.hi) hitF++;
      if (tw >= d.lo && tw <= d.hi) hitD++;
      wF += f.hi - f.lo;
      wD += d.hi - d.lo;
      cells++;
    }
  }
  return { reps: o.reps, full: hitF / cells, diagonal: hitD / cells, fullWidth: (100 * wF) / cells, diagonalWidth: (100 * wD) / cells };
}
