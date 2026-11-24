// A provisional power rating for decks that have no recorded rating, anchored on the recorded ones: the visitor's own
// lists, rated from the tournaments they ran in this browser (src/lib/runLedger.ts, src/lib/yourStats.ts; shown as
// "provisional" on deck tiles, deck pages and the Power ratings page). Pure.
//
// The model is the recorded one (src/lib/ratingModel.ts): P(A beats B | A on the play) = σ(rA − rB + h), ties half a win,
// a Gaussian prior with sd `prior` on every rating: the recorded fit's own, fitted to its games (ratings.json `priorSd`,
// since 2026-11-24; 1 before, and the default here when none is given). The coverage measured below was measured with
// the prior at 1; with the fitted sd (about 0.5) a deck with ~20 games is pulled further toward average and its range is
// narrower, which was not re-measured. Here the recorded decks' ratings and h are held fixed at their
// recorded values, and only the unrated decks' ratings are fitted, jointly, by maximum a posteriori (Newton steps on the
// full Hessian over the unrated decks, so unrated decks that met each other are fitted together). A game counts when at
// least one side is unrated; a game between two recorded decks says nothing about the unrated ones and is left out.
//
// Each unrated deck's expected win rate against the recorded field is the mean over the recorded decks of its chance per
// game with the going-first term left out (expectedVs in ratingModel.ts: the number ratings.json shows as wrField), with a
// 90% range by the delta method from the inverse Hessian over the unrated decks, drawn on the rating scale at r ∓ z·sd and
// mapped through the same mean, as fieldInterval does.
//
// The recorded decks' own uncertainty is ignored: their ratings and h are treated as known. Measured on the recorded
// events (2026-11-14, sim v9, 14 events): each of the 47 library decks held out of one of events 8–14 in turn (329 cases)
// and rated from only its games of that event (median 22), anchored on a fit of every other game; the reference is the
// deck's own expected win rate in that fit. Error against the reference: mean 7.0 points, median 6.2. The 90% range held
// the reference in 90.3% of the cases, and in 91.5% once the reference's own uncertainty is added to the comparison. From
// three events' games (median 68): mean error 5.0, median 4.4, coverage 86.0%, and 91.8% with the reference's
// uncertainty (the reference is noisy, and a narrower range shows it more). The anchors' share of the error, by the
// delta method, is small beside the deck's own (a median sd of 0.06 against 0.40 on the rating scale at ~20 games, 0.04
// against 0.25 at ~60) and moved the coverage by under one point, so the range is not widened for it.
//
// A deck whose games never reach a recorded deck (it met only other unrated decks, or played no game) is
// `connected: false`: its place against the recorded field is the prior's alone, and its range is that wide.
import { expectedVs, invertSpd, type RatedGame } from './ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));

/** The going-first term h from ratings.json's `firstPlayerEdge` (= σ(h) − 0.5). */
export function hFromEdge(edge: number): number {
  const p = Math.min(0.999, Math.max(0.001, 0.5 + edge));
  return Math.log(p / (1 - p));
}

export interface AnchoredInput {
  /** the recorded decks and their ratings (logit scale), held fixed; also the field the win rate is measured against */
  anchors: readonly { key: string; rating: number }[];
  /** the going-first term (logit scale), held fixed */
  h: number;
  /** games: `a` and `b` are anchor keys or unrated keys (any key that is not an anchor is unrated) */
  games: readonly RatedGame[];
  /** unrated keys to rate even when they have no game (they get the prior) */
  unrated?: readonly string[];
  /** prior sd on every rating (the recorded fit's, ratings.json `priorSd`; default 1, the value before 2026-11-24) */
  prior?: number;
  /** a two-sided range of this many standard errors (default 1.645: 90%) */
  z?: number;
}

export interface AnchoredRow {
  key: string;
  /** the fitted rating (logit scale, the recorded scale) */
  rating: number;
  /** its standard deviation, from the inverse Hessian over the unrated decks */
  sd: number;
  /** games of this deck in the fit */
  games: number;
  /** expected win rate against the recorded field, its range, and the standard deviation of the win rate */
  wr: number;
  lo: number;
  hi: number;
  sdWr: number;
  /** its games reach a recorded deck, directly or through other unrated decks */
  connected: boolean;
}

/** Fit the unrated decks' ratings with the recorded ones held fixed. Rows in the order the unrated keys first appear. */
export function fitAnchored(o: AnchoredInput): AnchoredRow[] {
  const PRIOR = o.prior ?? 1;
  const z = o.z ?? 1.645;
  const anchorR = new Map(o.anchors.map((a) => [a.key, a.rating]));
  const keys: string[] = [];
  const idx = new Map<string, number>();
  const add = (k: string) => {
    if (anchorR.has(k) || idx.has(k)) return;
    idx.set(k, keys.length);
    keys.push(k);
  };
  for (const k of o.unrated ?? []) add(k);
  const games = o.games.filter((g) => g.a !== g.b && (!anchorR.has(g.a) || !anchorR.has(g.b)));
  for (const g of games) {
    add(g.a);
    add(g.b);
  }
  const m = keys.length;
  if (!m) return [];
  // each game as unrated indices (−1 for an anchor, whose rating is ra / rb), the going-first term from a's side, a's score
  const G = games.map((g) => ({ i: idx.get(g.a) ?? -1, j: idx.get(g.b) ?? -1, ra: anchorR.get(g.a) ?? 0, rb: anchorR.get(g.b) ?? 0, adv: g.first === 0 ? o.h : -o.h, s: g.s }));
  const u = new Array<number>(m).fill(0);
  const rOf = (k: number, fixed: number) => (k >= 0 ? u[k]! : fixed);
  /** the Hessian of the negative log posterior and the gradient of the log posterior at u */
  const at = () => {
    const H = Array.from({ length: m }, (_, a) => Array.from({ length: m }, (_, b) => (a === b ? 1 / PRIOR ** 2 : 0)));
    const grad = u.map((x) => -x / PRIOR ** 2);
    for (const g of G) {
      const p = σ(rOf(g.i, g.ra) - rOf(g.j, g.rb) + g.adv);
      const d = g.s - p;
      const w = p * (1 - p);
      if (g.i >= 0) {
        grad[g.i]! += d;
        H[g.i]![g.i]! += w;
      }
      if (g.j >= 0) {
        grad[g.j]! -= d;
        H[g.j]![g.j]! += w;
      }
      if (g.i >= 0 && g.j >= 0) {
        H[g.i]![g.j]! -= w;
        H[g.j]![g.i]! -= w;
      }
    }
    return { H, grad };
  };
  for (let it = 0; it < 200; it++) {
    const { H, grad } = at();
    const inv = invertSpd(H);
    let maxStep = 0;
    for (let k = 0; k < m; k++) {
      // the posterior is strictly concave; capping a step keeps the first ones from overshooting on a lopsided record
      const step = Math.max(-2, Math.min(2, inv[k]!.reduce((s, v, b) => s + v * grad[b]!, 0)));
      u[k]! += step;
      maxStep = Math.max(maxStep, Math.abs(step));
    }
    if (maxStep < 1e-10) break;
  }
  const cov = invertSpd(at().H);

  // which unrated decks reach a recorded deck through their games
  const parent = keys.map((_, k) => k);
  const find = (k: number): number => (parent[k] === k ? k : (parent[k] = find(parent[k]!)));
  const played = new Array<number>(m).fill(0);
  for (const g of G) {
    if (g.i >= 0) played[g.i]!++;
    if (g.j >= 0) played[g.j]!++;
    if (g.i >= 0 && g.j >= 0) parent[find(g.i)] = find(g.j);
  }
  const reached = new Set<number>();
  for (const g of G) {
    if (g.i >= 0 && g.j < 0) reached.add(find(g.i));
    if (g.j >= 0 && g.i < 0) reached.add(find(g.j));
  }

  const field = o.anchors.map((a) => a.rating);
  const pool = field.map((_, k) => k);
  const vs = (rk: number) => expectedVs(field, -1, rk, pool);
  return keys.map((key, k) => {
    const rating = u[k]!;
    const sd = Math.sqrt(Math.max(0, cov[k]![k]!));
    const slope = field.length ? field.reduce((s, r) => s + σ(rating - r) * (1 - σ(rating - r)), 0) / field.length : 0;
    return { key, rating, sd, games: played[k]!, wr: vs(rating), lo: vs(rating - z * sd), hi: vs(rating + z * sd), sdWr: slope * sd, connected: reached.has(find(k)) };
  });
}
