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
// ρ = Σ[(W − E)² − Σp(1−p)] / Σ[g(g−1)·p̄(1−p̄)] (method of moments over the met pairs), m = 1/ρ − 1. A pairing that never
// met gets the prediction alone. The raw counts stay in h2h.json; the estimates are optional fields beside them.
import { fitRatings, predictPair, type RatedGame, type RatingFit } from './ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));

/** The prior's weight never goes past this many games (ρ near zero), nor below zero (ρ = 1). */
const MAX_PRIOR_GAMES = 1000;

export interface PairShrinkage {
  /** intra-pair correlation of results beyond what the ratings explain (clamped to [0.001, 1]) */
  rho: number;
  /** the moment estimate before clamping (≤ 0: the pairs spread no more than binomial noise around the predictions) */
  rhoRaw: number;
  /** the prior's weight in games, 1/ρ − 1 */
  priorGames: number;
  /** pairs that met (the moments' sample) */
  pairs: number;
}

interface Cell {
  i: number;
  j: number;
  w: number;
  g: number;
  /** expected wins of i, game by game */
  e: number;
  /** Σ p(1−p) */
  v: number;
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
    const k = `${i}|${j}`;
    const c = out.get(k) ?? { i, j, w: 0, g: 0, e: 0, v: 0 };
    c.w += s;
    c.g++;
    c.e += pi;
    c.v += pi * (1 - pi);
    out.set(k, c);
  }
  return out;
}

/** Fit the shrinkage weight from the pairs' spread around the model's predictions. */
export function fitShrinkage(fit: RatingFit, games: readonly RatedGame[]): PairShrinkage {
  let num = 0;
  let den = 0;
  let pairs = 0;
  for (const c of cells(fit, games).values()) {
    pairs++;
    const pbar = c.e / c.g;
    num += (c.w - c.e) ** 2 - c.v;
    den += c.g * (c.g - 1) * pbar * (1 - pbar);
  }
  const rhoRaw = den > 0 ? num / den : 0;
  const rho = Math.min(1, Math.max(1 / (MAX_PRIOR_GAMES + 1), rhoRaw));
  return { rho, rhoRaw, priorGames: 1 / rho - 1, pairs };
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
export function h2hEstimator(games: readonly RatedGame[], o: { names?: readonly string[]; prior?: number } = {}): H2HEstimator {
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
