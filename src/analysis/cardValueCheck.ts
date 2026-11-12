// INFO-7: does the hand-written card value (cardValue, src/ai/knowledge.ts), which decides which card the bots sell, agree
// with what the bot games measure? Per deck: Spearman rank correlation of cardValue against a measured value (plain IWD
// from impact.json, or the adjusted estimate of `sim analyze --impact-adjusted`), and the cards where the two disagree
// most, by rank position (percentile within the deck). Pure; scripts/card-value-check.ts reads the files and prints.
import { spearman } from '../lib/rankStability';

export interface MeasuredCard {
  id: string;
  name: string;
  /** the formula's value */
  value: number;
  /** the measured value (win-rate points as a fraction) */
  measured: number;
  /** games behind the measurement */
  n: number;
}
export interface Disagreement extends MeasuredCard {
  /** percentile rank (0 = lowest, 1 = highest) by the formula and by the measurement */
  pValue: number;
  pMeasured: number;
}
export interface ValueCheck {
  cards: number;
  rho: number;
  /** the formula rates high, the games measure low */
  overrated: Disagreement[];
  /** the formula rates low, the games measure high */
  underrated: Disagreement[];
}

/** Percentile ranks in [0, 1] (ties share their mean rank). */
export function percentiles(xs: readonly number[]): number[] {
  if (xs.length < 2) return xs.map(() => 0.5);
  const order = xs.map((x, i) => ({ x, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  const r = new Array<number>(xs.length).fill(0);
  for (let s = 0; s < order.length; ) {
    let e = s;
    while (e + 1 < order.length && order[e + 1]!.x === order[s]!.x) e++;
    for (let k = s; k <= e; k++) r[order[k]!.i] = (s + e) / 2 / (xs.length - 1);
    s = e + 1;
  }
  return r;
}

/** Rank-correlate the formula against the measurement over one deck's cards and list the `top` biggest disagreements each way. */
export function checkValues(cards: readonly MeasuredCard[], top = 5): ValueCheck {
  const ok = cards.filter((c) => Number.isFinite(c.value) && Number.isFinite(c.measured));
  const pv = percentiles(ok.map((c) => c.value));
  const pm = percentiles(ok.map((c) => c.measured));
  const all: Disagreement[] = ok.map((c, i) => ({ ...c, pValue: pv[i]!, pMeasured: pm[i]! }));
  const gap = (d: Disagreement) => d.pValue - d.pMeasured;
  return {
    cards: ok.length,
    rho: ok.length >= 3 ? spearman(ok.map((c) => c.value), ok.map((c) => c.measured)) : NaN,
    overrated: all.filter((d) => gap(d) > 0).sort((a, b) => gap(b) - gap(a)).slice(0, top),
    underrated: all.filter((d) => gap(d) < 0).sort((a, b) => gap(a) - gap(b)).slice(0, top),
  };
}
