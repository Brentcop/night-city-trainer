// Head-to-head estimates shrunk toward the rating model (SIM-4). Pure, Node and browser.
//
// A pairing's raw record is thin (a median of 3 games per pair), so a 2–1 is not a 67% matchup. The estimate starts from
// what the power ratings predict for the pairing (src/lib/ratingModel.ts, both seats averaged) and adds the pair's own
// residual, shrunk by a beta-binomial weight:
//
//   estimate = prediction + (wins − expected wins) / (games + m)
//
// where expected wins are the model's prediction game by game (seat included) and m, the prior's weight in games, comes
// from how much the pairs' records spread around the predictions beyond binomial noise: the intra-pair correlation
// ρ = Σ[(W − E)² − Σp(1−p) + q] / Σ[g(g−1)·p̄(1−p̄)] (method of moments over the met pairs), m = 1/ρ − 1. A pairing that
// never met gets the prediction alone. The raw counts stay in h2h.json; the estimates are optional fields beside them.
//
// q, the fit's share of each pair's residual (2026-11-24, REVIEW_2026-11-24 L1 / B.3): E is computed from ratings fitted
// to the same games, which pulls every pair's record toward its prediction, so without a correction the moment estimate
// reads below zero when there is no pair effect at all (a median of about −0.005 on the pool of 2026-11-22, where the
// observed value was +0.003): "no matchups" was an artefact. Linearising the fit around the truth, the expected squared
// residual of a pair is its binomial variance less q = aᵀCa + aᵀCΛCa, with a the gradient of the pair's expected wins
// with respect to the ratings and the going-first term, C the fit's covariance (the inverse Hessian, prior included) and
// Λ the prior's precision; so q is added back, pair by pair. It generalises the P/(P − K) degrees-of-freedom factor (it
// is that factor when every pair weighs the same) and is deterministic and cheap (one pass over the pairs). Checked on
// games simulated from a known fit (tests/h2h-model.test.ts): with no pair effect the median estimate is about 0, with
// pair effects of logit sd 0.2 it recovers their spread.
//
// This is the one estimate of the pair spread: h2h.json stores it (`model.rho`, `model.priorGames`), the evidence
// builder's matchup intervals read their spread from it (`pairSpreadVar`: the beta-binomial prior's variance
// p(1−p)/(m + 1)), and the forecast reads it from h2h.json or fits it here (`modelFromGames`).
import { fitRatings, predictPair, type PriorChoice, type RatedGame, type RatingFit } from './ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));

/** The prior's weight never goes past this many games (ρ near zero), nor below zero (ρ = 1). */
export const MAX_PRIOR_GAMES = 1000;

export interface PairShrinkage {
  /** intra-pair correlation of results beyond what the ratings explain (clamped to [1/(MAX_PRIOR_GAMES + 1), 1]) */
  rho: number;
  /** the bias-corrected moment estimate before clamping (≤ 0: the pairs spread no more than chance around the predictions) */
  rhoRaw: number;
  /** the prior's weight in games, 1/ρ − 1 */
  priorGames: number;
  /** pairs that met (the moments' sample) */
  pairs: number;
  /** Pearson's χ² of the pairs' records around the fit (Σ (W − E)² / Σp(1−p) per pair) and its degrees of freedom (pairs less the fit's share, Σ q / Σp(1−p)) */
  chi2: number;
  df: number;
}

/** The variance of a pairing's true win rate around its prediction that the shrinkage assumes (the beta-binomial prior worth `priorGames` games): p(1−p)/(m + 1) = ρ·p(1−p). */
export const pairSpreadVar = (p: number, priorGames: number): number => (p * (1 - p)) / (priorGames + 1);

/** The pair spread as a standard deviation in points of win rate at an even pairing (p = ½), for the words. */
export const pairSpreadSd = (priorGames: number): number => Math.sqrt(pairSpreadVar(0.5, priorGames));

interface Cell {
  i: number;
  j: number;
  w: number;
  g: number;
  /** expected wins of i, game by game */
  e: number;
  /** Σ p(1−p) */
  v: number;
  /** Σ ±p(1−p), + when i went first: the derivative of e with respect to the going-first term */
  vh: number;
}

/** Per-pair sums (i < j in the fit's order) of wins, games, expected wins and binomial variance. */
function cells(fit: RatingFit, games: readonly RatedGame[]): Map<string, Cell> {
  const idx = new Map(fit.names.map((n, k) => [n, k]));
  const out = new Map<string, Cell>();
  for (const g of games) {
    const a = idx.get(g.a);
    const b = idx.get(g.b);
    if (a === undefined || b === undefined || a === b) continue;
    const p = σ(fit.r[a]! - fit.r[b]! + (g.first === 0 ? fit.h : -fit.h));
    const [i, j, s, pi] = a < b ? [a, b, g.s, p] : [b, a, 1 - g.s, 1 - p];
    // i went first when it is a and a went first, or it is b and b went first
    const iFirst = (a < b) === (g.first === 0);
    const k = `${i}|${j}`;
    const c = out.get(k) ?? { i, j, w: 0, g: 0, e: 0, v: 0, vh: 0 };
    c.w += s;
    c.g++;
    c.e += pi;
    c.v += pi * (1 - pi);
    c.vh += (iFirst ? 1 : -1) * pi * (1 - pi);
    out.set(k, c);
  }
  return out;
}

/**
 * The fit's share of a pair's squared residual, q = aᵀCa + aᵀCΛCa (the header): a = v·(e_i − e_j) + vh·e_h, C the fit's
 * covariance over (r, h), Λ = 1/prior² on the ratings and 0 on h.
 */
function fitShare(fit: Pick<RatingFit, 'cov' | 'prior'>, c: Cell, n: number): number {
  const C = fit.cov;
  const lam = 1 / fit.prior ** 2;
  let aCa = 0;
  let aCLCa = 0;
  for (let k = 0; k <= n; k++) {
    const row = C[k]!;
    const y = c.v * (row[c.i]! - row[c.j]!) + c.vh * row[n]!;
    if (k === c.i) aCa += c.v * y;
    else if (k === c.j) aCa -= c.v * y;
    if (k === n) aCa += c.vh * y;
    else aCLCa += lam * y * y;
  }
  return aCa + aCLCa;
}

/** Fit the shrinkage weight from the pairs' spread around the model's predictions, with the fit's own share added back. */
export function fitShrinkage(fit: RatingFit, games: readonly RatedGame[]): PairShrinkage {
  const n = fit.names.length;
  let num = 0;
  let den = 0;
  let pairs = 0;
  let chi2 = 0;
  let share = 0;
  for (const c of cells(fit, games).values()) {
    pairs++;
    const pbar = c.e / c.g;
    const q = fitShare(fit, c, n);
    num += (c.w - c.e) ** 2 - c.v + q;
    den += c.g * (c.g - 1) * pbar * (1 - pbar);
    if (c.v > 0) {
      chi2 += (c.w - c.e) ** 2 / c.v;
      share += q / c.v;
    }
  }
  const rhoRaw = den > 0 ? num / den : 0;
  const rho = Math.min(1, Math.max(1 / (MAX_PRIOR_GAMES + 1), rhoRaw));
  return { rho, rhoRaw, priorGames: 1 / rho - 1, pairs, chi2, df: pairs - share };
}

/** The shrunk estimate from a pair's record (wins w of g, expected wins e) and its seat-averaged prediction. */
export const shrunkEstimate = (prediction: number, w: number, g: number, e: number, priorGames: number): number => Math.min(1, Math.max(0, prediction + (g > 0 ? (w - e) / (g + priorGames) : 0)));

/** What a head-to-head lookup returns: the raw record of a against b, and the shrunk estimate when there is a model. */
export interface H2HRecord {
  /** a's wins (ties half) and the games played */
  w: number;
  g: number;
  /** a's estimated win probability against b (absent without a model) */
  p?: number;
}

export interface H2HEstimator {
  fit: RatingFit;
  shrinkage: PairShrinkage;
  lookup: (a: string, b: string) => H2HRecord;
}

/** Fit ratings and the shrinkage on `games` and return a lookup (scripts/breed-data.ts; the leave-one-event-out check). */
export function h2hEstimator(games: readonly RatedGame[], o: { names?: readonly string[]; prior?: PriorChoice } = {}): H2HEstimator {
  const fit = fitRatings(games, o);
  const shrinkage = fitShrinkage(fit, games);
  const idx = new Map(fit.names.map((n, k) => [n, k]));
  const cs = cells(fit, games);
  const lookup = (a: string, b: string): H2HRecord => {
    const x = idx.get(a);
    const y = idx.get(b);
    if (x === undefined || y === undefined || x === y) return { w: 0, g: 0 };
    const [i, j] = x < y ? [x, y] : [y, x];
    const c = cs.get(`${i}|${j}`);
    const pred = predictPair(fit, i, j);
    const est = c ? shrunkEstimate(pred, c.w, c.g, c.e, shrinkage.priorGames) : pred;
    const flip = x > y;
    if (!c) return { w: 0, g: 0, p: flip ? 1 - est : est };
    return flip ? { w: c.g - c.w, g: c.g, p: 1 - est } : { w: c.w, g: c.g, p: est };
  };
  return { fit, shrinkage, lookup };
}

// ---------------------------------------------------------------- the h2h.json fields

/** The model block of public/data/h2h.json (optional; files built before 2026-11-12 have none). */
export interface H2HModelBlock {
  kind: 'bradley-terry-shrunk';
  /** rating per deck, in the file's `decks` order (4 decimals) */
  ratings: number[];
  /** going-first term (logit) */
  firstPlayer: number;
  /** the fitted intra-pair correlation and the prior's weight in games */
  rho: number;
  priorGames: number;
  /** the bias-corrected moment estimate of ρ before clamping (absent before 2026-11-24; ≤ 0: no pair spread beyond chance, priorGames at its cap) */
  rhoRaw?: number;
  /** Pearson's χ² of the pairs' records around the fit and its degrees of freedom (absent before 2026-11-24) */
  chi2?: number;
  df?: number;
  /** the rating prior's sd the fit used, fitted to the same games (absent before 2026-11-24: 1) */
  priorSd?: number;
}

/** The parts of h2h.json the estimate reads. */
export interface H2HFileLike {
  decks: string[];
  pairs: [number, number, number, number][];
  model?: H2HModelBlock;
  /** the shrunk estimate of each pair in `pairs` (i's side), same order */
  shrunk?: number[];
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const r1 = (x: number) => Math.round(x * 10) / 10;

/** The optional model fields for h2h.json, in the file's deck and pair order. */
export function h2hModelFields(decks: readonly string[], pairs: readonly [number, number, number, number][], games: readonly RatedGame[]): { model: H2HModelBlock; shrunk: number[] } {
  const est = h2hEstimator(games);
  const idx = new Map(est.fit.names.map((n, k) => [n, k]));
  return {
    model: {
      kind: 'bradley-terry-shrunk',
      ratings: decks.map((d) => r4(est.fit.r[idx.get(d) ?? -1] ?? 0)),
      firstPlayer: r4(est.fit.h),
      rho: r4(est.shrinkage.rho),
      priorGames: r4(est.shrinkage.priorGames),
      rhoRaw: r6(est.shrinkage.rhoRaw),
      chi2: r1(est.shrinkage.chi2),
      df: r1(est.shrinkage.df),
      priorSd: r4(est.fit.prior),
    },
    shrunk: pairs.map(([i, j]) => r4(est.lookup(decks[i] ?? '', decks[j] ?? '').p ?? 0.5)),
  };
}

/**
 * A lookup over a loaded h2h.json: the raw record, and the shrunk estimate when the file has a model (a pair that never
 * met gets the model's prediction, with g = 0).
 */
export function h2hFileLookup(file: H2HFileLike): (a: string, b: string) => H2HRecord {
  const m = new Map<string, H2HRecord>();
  file.pairs.forEach(([i, j, w, g], q) => {
    const p = file.shrunk?.[q];
    m.set(`${file.decks[i]}|${file.decks[j]}`, { w, g, ...(p !== undefined ? { p } : {}) });
    m.set(`${file.decks[j]}|${file.decks[i]}`, { w: g - w, g, ...(p !== undefined ? { p: 1 - p } : {}) });
  });
  const model = file.model;
  const idx = new Map(file.decks.map((d, k) => [d, k]));
  return (a, b) => {
    const hit = m.get(`${a}|${b}`);
    if (hit) return hit;
    const x = idx.get(a);
    const y = idx.get(b);
    if (!model || x === undefined || y === undefined || x === y) return { w: 0, g: 0 };
    return { w: 0, g: 0, p: predictPair({ r: model.ratings, h: model.firstPlayer }, x, y) };
  };
}

// ---------------------------------------------------------------- leave one event out

export interface LoeoRow {
  /** games scored (held-out games whose two decks had a training record or a prediction) */
  games: number;
  /** mean Brier score and log loss of each predictor on the held-out games */
  brier: Record<LoeoPredictor, number>;
  logLoss: Record<LoeoPredictor, number>;
}
export type LoeoPredictor = 'coin' | 'raw' | 'breeder' | 'model' | 'shrunk';
export const LOEO_PREDICTORS: readonly LoeoPredictor[] = ['coin', 'raw', 'breeder', 'model', 'shrunk'];

/**
 * Leave-one-event-out check of the pair predictors: for each event, fit on the others and predict every game of the held-out
 * event between two different decks, from a's side (seats averaged, as h2h.json stores pairs):
 *   coin 0.5; raw w/g (0.5 when they never met); breeder (w + 3)/(g + 6), the Deck Lab's old shrink toward 50%;
 *   model the ratings' prediction; shrunk the estimate above.
 * `thinMax` also scores the subset of games whose pair had at most that many training games (met at least once).
 */
export function leaveOneEventOut(events: readonly (readonly RatedGame[])[], o: { thinMax?: number } = {}): { all: LoeoRow; thin: LoeoRow; unmet: LoeoRow; priorGames: number[] } {
  const names = [...new Set(events.flatMap((e) => e.flatMap((g) => [g.a, g.b])))];
  const acc = () => ({ games: 0, brier: Object.fromEntries(LOEO_PREDICTORS.map((p) => [p, 0])) as Record<LoeoPredictor, number>, logLoss: Object.fromEntries(LOEO_PREDICTORS.map((p) => [p, 0])) as Record<LoeoPredictor, number> });
  const all = acc();
  const thin = acc();
  const unmet = acc();
  const priorGames: number[] = [];
  const clamp = (p: number) => Math.min(1 - 1e-3, Math.max(1e-3, p));
  events.forEach((held, e) => {
    const train = events.flatMap((x, k) => (k === e ? [] : x));
    if (!train.length) return;
    const est = h2hEstimator(train, { names });
    priorGames.push(est.shrinkage.priorGames);
    for (const g of held) {
      if (g.a === g.b) continue;
      const rec = est.lookup(g.a, g.b);
      const x = names.indexOf(g.a);
      const y = names.indexOf(g.b);
      const preds: Record<LoeoPredictor, number> = {
        coin: 0.5,
        raw: rec.g ? rec.w / rec.g : 0.5,
        breeder: (rec.w + 3) / (rec.g + 6),
        model: predictPair(est.fit, x, y),
        shrunk: rec.p ?? 0.5,
      };
      const rows = [all, ...(rec.g > 0 && rec.g <= (o.thinMax ?? 3) ? [thin] : []), ...(rec.g === 0 ? [unmet] : [])];
      for (const row of rows) {
        row.games++;
        for (const p of LOEO_PREDICTORS) {
          row.brier[p] += (preds[p] - g.s) ** 2;
          const q = clamp(preds[p]);
          row.logLoss[p] += -(g.s * Math.log(q) + (1 - g.s) * Math.log(1 - q));
        }
      }
    }
  });
  const done = (row: ReturnType<typeof acc>): LoeoRow => ({
    games: row.games,
    brier: Object.fromEntries(LOEO_PREDICTORS.map((p) => [p, row.games ? row.brier[p] / row.games : NaN])) as Record<LoeoPredictor, number>,
    logLoss: Object.fromEntries(LOEO_PREDICTORS.map((p) => [p, row.games ? row.logLoss[p] / row.games : NaN])) as Record<LoeoPredictor, number>,
  });
  return { all: done(all), thin: done(thin), unmet: done(unmet), priorGames };
}
