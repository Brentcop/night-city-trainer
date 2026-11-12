// SIM-3: are deck rankings stable across bots? (scripts/rank-stability.ts). Plain data and plain functions.
// The same round robin (same deals: decks, seed, first player) is played once per bot. Each deck's win rate against the
// field is its mean score over its games in either seat; rankings are compared with Spearman's rank correlation, and
// the noise is measured by a paired bootstrap: deals are resampled within each ordered pairing, the same deals for every
// bot, so what a deal favours stays matched across bots.
import { bandIndex, bandOf, type SimTierLetter } from './simTier';

/** One deal of the round robin: the seat-0 and seat-1 decks (indices into the deck list). */
export interface Deal {
  a: number;
  b: number;
}

/** Ranks with 1 for the largest value; tied values share their average rank. */
export function averageRanks(xs: readonly number[]): number[] {
  const order = xs.map((x, i) => ({ x, i })).sort((p, q) => q.x - p.x || p.i - q.i);
  const r = new Array<number>(xs.length).fill(0);
  for (let s = 0; s < order.length; ) {
    let e = s;
    while (e + 1 < order.length && order[e + 1]!.x === order[s]!.x) e++;
    const avg = (s + e) / 2 + 1;
    for (let k = s; k <= e; k++) r[order[k]!.i] = avg;
    s = e + 1;
  }
  return r;
}

/** Pearson correlation (NaN when either side is constant). */
export function pearson(x: readonly number[], y: readonly number[]): number {
  if (x.length !== y.length) throw new Error(`pearson needs equal lengths (got ${x.length} and ${y.length})`);
  const n = x.length;
  const mx = x.reduce((s, v) => s + v, 0) / n;
  const my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i]! - mx;
    const dy = y[i]! - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : NaN;
}

/** Spearman's rank correlation: Pearson on average ranks. */
export const spearman = (x: readonly number[], y: readonly number[]): number => pearson(averageRanks(x), averageRanks(y));

/**
 * Each deck's win rate against the field: mean score over its games in either seat. `scores[i]` is the seat-0 deck's
 * score in deal i (1 win, ½ tie, 0 loss); `weight[i]` (default 1) is how many times deal i counts (the bootstrap).
 */
export function deckWinRates(deals: readonly Deal[], scores: readonly number[], decks: number, weight?: readonly number[]): { wr: number[]; n: number[] } {
  const pts = new Array<number>(decks).fill(0);
  const n = new Array<number>(decks).fill(0);
  deals.forEach((d, i) => {
    const w = weight ? (weight[i] ?? 0) : 1;
    if (!w) return;
    const s = scores[i]!;
    pts[d.a]! += w * s;
    n[d.a]! += w;
    pts[d.b]! += w * (1 - s);
    n[d.b]! += w;
  });
  return { wr: pts.map((p, k) => (n[k] ? p / n[k]! : NaN)), n };
}

/** A deck's win rate under bot X minus under bot Y on the same deals, with the paired standard error. */
export function pairedDeckDiff(deals: readonly Deal[], x: readonly number[], y: readonly number[], decks: number): { diff: number; se: number; n: number }[] {
  const per: number[][] = Array.from({ length: decks }, () => []);
  deals.forEach((d, i) => {
    const dx = x[i]! - y[i]!;
    per[d.a]!.push(dx);
    per[d.b]!.push(-dx);
  });
  return per.map((ds) => {
    const n = ds.length;
    const m = n ? ds.reduce((s, v) => s + v, 0) / n : NaN;
    const se = n >= 2 ? Math.sqrt(ds.reduce((s, v) => s + (v - m) ** 2, 0) / (n - 1) / n) : Infinity;
    return { diff: m, se, n };
  });
}

/** A seeded uniform [0, 1) stream (LCG). */
export function lcg(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Bootstrap weights: deals resampled with replacement within each ordered pairing (a, b), so every pairing keeps its count. */
export function stratifiedWeights(deals: readonly Deal[], rnd: () => number): number[] {
  const groups = new Map<string, number[]>();
  deals.forEach((d, i) => {
    const k = `${d.a},${d.b}`;
    const g = groups.get(k);
    if (g) g.push(i);
    else groups.set(k, [i]);
  });
  const w = new Array<number>(deals.length).fill(0);
  for (const idx of groups.values()) for (let j = 0; j < idx.length; j++) w[idx[Math.floor(rnd() * idx.length)]!]! += 1;
  return w;
}

/** The q-quantile of a sample (linear interpolation; NaNs ignored). */
export function quantile(xs: readonly number[], q: number): number {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const p = (s.length - 1) * q;
  const lo = Math.floor(p);
  const hi = Math.ceil(p);
  return s[lo]! + (s[hi]! - s[lo]!) * (p - lo);
}

export interface BotRanking {
  wr: number[];
  n: number[];
  /** 1 = best */
  rank: number[];
  band: SimTierLetter[];
}

export interface DeckMove {
  deck: number;
  /** rank under bot X minus rank under bot Y (> 0: lower under X), and its bootstrap 95% interval */
  rankDelta: number;
  rankLo: number;
  rankHi: number;
  /** win rate under X minus under Y, with its paired standard error */
  wrDiff: number;
  se: number;
  bandX: SimTierLetter;
  bandY: SimTierLetter;
  /** the rank moved by more than the noise allows (its bootstrap interval excludes 0) */
  rankMoved: boolean;
  /** the band letter differs and the win-rate change is beyond 1.96 paired SE */
  bandMoved: boolean;
}

export interface BotComparison {
  x: number;
  y: number;
  rho: number;
  lower: number;
  upper: number;
  decks: DeckMove[];
}

export interface RankStability {
  bots: BotRanking[];
  pairs: BotComparison[];
}

/**
 * Rankings per bot and, for every pair of bots, Spearman's rho with a bootstrap 95% interval and each deck's rank and
 * band movement. `scores[b][i]` is bot b's seat-0 score in deal i (the same deals for every bot).
 */
export function rankStability(deals: readonly Deal[], scores: readonly (readonly number[])[], decks: number, o: { boot?: number; seed?: number } = {}): RankStability {
  if (scores.some((s) => s.length !== deals.length)) throw new Error('every bot needs a score for every deal');
  const boot = o.boot ?? 2000;
  const bots: BotRanking[] = scores.map((s) => {
    const { wr, n } = deckWinRates(deals, s, decks);
    return { wr, n, rank: averageRanks(wr), band: wr.map(bandOf) };
  });
  const rnd = lcg(o.seed ?? 1);
  const pairs: { x: number; y: number; rhos: number[]; deltas: number[][] }[] = [];
  for (let x = 0; x < scores.length; x++) for (let y = x + 1; y < scores.length; y++) pairs.push({ x, y, rhos: [], deltas: Array.from({ length: decks }, () => []) });
  for (let r = 0; r < boot; r++) {
    const w = stratifiedWeights(deals, rnd);
    const ranks = scores.map((s) => averageRanks(deckWinRates(deals, s, decks, w).wr));
    for (const p of pairs) {
      p.rhos.push(pearson(ranks[p.x]!, ranks[p.y]!));
      for (let d = 0; d < decks; d++) p.deltas[d]!.push(ranks[p.x]![d]! - ranks[p.y]![d]!);
    }
  }
  return {
    bots,
    pairs: pairs.map((p) => {
      const X = bots[p.x]!;
      const Y = bots[p.y]!;
      const diffs = pairedDeckDiff(deals, scores[p.x]!, scores[p.y]!, decks);
      return {
        x: p.x,
        y: p.y,
        rho: pearson(X.rank, Y.rank),
        lower: quantile(p.rhos, 0.025),
        upper: quantile(p.rhos, 0.975),
        decks: diffs.map((df, d) => {
          const rankLo = quantile(p.deltas[d]!, 0.025);
          const rankHi = quantile(p.deltas[d]!, 0.975);
          const bandX = X.band[d]!;
          const bandY = Y.band[d]!;
          return {
            deck: d,
            rankDelta: X.rank[d]! - Y.rank[d]!,
            rankLo,
            rankHi,
            wrDiff: df.diff,
            se: df.se,
            bandX,
            bandY,
            rankMoved: rankLo > 0 || rankHi < 0,
            bandMoved: bandIndex(X.wr[d]!) !== bandIndex(Y.wr[d]!) && Math.abs(df.diff) > 1.96 * df.se,
          };
        }),
      };
    }),
  };
}
