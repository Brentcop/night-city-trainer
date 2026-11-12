// INFO-5: the statistics of the position benchmark (src/ai/benchmark.ts, scripts/benchmark-build.ts, scripts/benchmark.ts).
// Plain data and plain functions. A position's label is, for each distinct option, the decider's score (win 1, tie ½,
// loss 0) of a full play-out in each of a list of shared worlds; option i was played in the first n_i worlds, the best
// option in all of them. Everything compares options world by world (common random numbers) with the paired interval
// of src/lib/evidence.ts.
import { pairedInterval } from './evidence';

// ---------------------------------------------------------------- packed outcomes

/** 27 symbols: three outcomes (0, 1 or ½) per character. */
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZa';
const code = (x: number): number => (x === 0 ? 0 : x === 1 ? 1 : x === 0.5 ? 2 : -1);

/** Pack scores (each 0, ½ or 1) three to a character. */
export function packOutcomes(xs: readonly number[]): string {
  let s = '';
  for (let i = 0; i < xs.length; i += 3) {
    let v = 0;
    for (let j = 2; j >= 0; j--) {
      const x = i + j < xs.length ? code(xs[i + j] ?? 0) : 0;
      if (x < 0) throw new Error(`an outcome must be 0, 0.5 or 1 (got ${xs[i + j]})`);
      v = v * 3 + x;
    }
    s += ALPHABET[v];
  }
  return s;
}

/** The first n scores of a packed string. */
export function unpackOutcomes(s: string, n: number): number[] {
  if (n > s.length * 3) throw new Error(`packed outcomes hold at most ${s.length * 3} scores (asked for ${n})`);
  const out: number[] = [];
  for (const ch of s) {
    let v = ALPHABET.indexOf(ch);
    if (v < 0) throw new Error(`not a packed outcome: "${ch}"`);
    for (let j = 0; j < 3 && out.length < n; j++) {
      const x = v % 3;
      out.push(x === 2 ? 0.5 : x);
      v = (v - x) / 3;
    }
  }
  return out;
}

// ---------------------------------------------------------------- one position

/** z for "distinguishable from the best": an option is among the best unless it is below the best by more than this many paired SE. */
export const BEST_Z = 2;

export interface OptionStat {
  /** option index (a group's first option) */
  opt: number;
  /** worlds played */
  n: number;
  /** win rate over those worlds */
  wr: number;
  /** the best option's win rate minus this one's, over this option's worlds (0 for the best itself) */
  regret: number;
  /** paired standard error of `regret` (0 for the best) */
  se: number;
  /** not distinguishable from the best: regret ≤ BEST_Z × se */
  best: boolean;
}

export interface PositionStat {
  options: OptionStat[];
  /** the best option (highest win rate among the options played in the most worlds; the lowest index on ties) */
  best: number;
  /** the second-best option by win rate, and the paired SE of its gap to the best */
  second: number | null;
  seBestSecond: number | null;
  /** every option is among the best: nothing here tells options apart */
  indifferent: boolean;
}

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

/** The paired regret of `xs` against `best` over xs's worlds, with its standard error. */
export function pairedRegret(best: readonly number[], xs: readonly number[]): { regret: number; se: number } {
  if (best.length < xs.length) throw new Error(`the best option has ${best.length} worlds, fewer than the ${xs.length} compared`);
  const d = xs.map((x, i) => (best[i] ?? NaN) - x);
  const n = d.length;
  const m = mean(d);
  if (n < 2) return { regret: m, se: Infinity };
  return { regret: m, se: Math.sqrt(d.reduce((s, x) => s + (x - m) ** 2, 0) / (n - 1) / n) };
}

/**
 * Statistics of one labelled position. `outcomes` maps each option (a group's first option index) to its scores in the
 * shared worlds, in world order; options with fewer worlds were played in the first worlds only.
 */
export function positionStats(outcomes: ReadonlyMap<number, readonly number[]>, z = BEST_Z): PositionStat {
  const entries = [...outcomes.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) throw new Error('a position needs at least two options');
  const maxN = Math.max(...entries.map(([, xs]) => xs.length));
  let best = -1;
  let bestWr = -Infinity;
  for (const [opt, xs] of entries) {
    if (xs.length !== maxN) continue;
    const wr = mean(xs);
    if (wr > bestWr) {
      bestWr = wr;
      best = opt;
    }
  }
  const bestXs = outcomes.get(best) ?? [];
  const options: OptionStat[] = entries.map(([opt, xs]) => {
    if (opt === best) return { opt, n: xs.length, wr: mean(xs), regret: 0, se: 0, best: true };
    const { regret, se } = pairedRegret(bestXs, xs);
    return { opt, n: xs.length, wr: mean(xs), regret, se, best: regret <= z * se };
  });
  const others = options.filter((o) => o.opt !== best).sort((a, b) => b.wr - a.wr || a.opt - b.opt);
  const second = others[0] ?? null;
  return { options, best, second: second?.opt ?? null, seBestSecond: second?.se ?? null, indifferent: options.every((o) => o.best) };
}

/** Options worth more worlds: within `z` paired SE of the best (the best first), at most `max` in all. */
export function contenders(st: PositionStat, z = 3, max = 4): number[] {
  const close = st.options.filter((o) => o.opt !== st.best && o.regret <= z * o.se).sort((a, b) => a.regret - b.regret || a.opt - b.opt);
  return [st.best, ...close.map((o) => o.opt)].slice(0, max);
}

// ---------------------------------------------------------------- a bot over the suite

/** A bot's pick at one position. */
export interface PickRow {
  kind: string;
  stage: string;
  /** the picked option's regret (win-rate fraction) and whether it is among the best */
  regret: number;
  best: boolean;
  indifferent: boolean;
}

export interface RegretSummary {
  /** positions in the group, indifferent ones included */
  positions: number;
  indifferent: number;
  /** positions counted: the others */
  counted: number;
  /** mean regret over the counted positions (a fraction: 0.01 = 1 win-rate point) and its 95% interval */
  mean: number;
  lower: number;
  upper: number;
  /** share of counted positions where the pick was among the best */
  bestShare: number;
}

/** Mean regret with a 95% interval over the positions that are not indifferent, and the share of oracle-best picks. */
export function summarizeRegret(rows: readonly PickRow[]): RegretSummary {
  const counted = rows.filter((r) => !r.indifferent);
  const rs = counted.map((r) => r.regret);
  const iv = pairedInterval(rs, rs.map(() => 0));
  return {
    positions: rows.length,
    indifferent: rows.length - counted.length,
    counted: counted.length,
    mean: iv.mean,
    lower: counted.length >= 2 ? iv.lower : NaN,
    upper: counted.length >= 2 ? iv.upper : NaN,
    bestShare: counted.length ? counted.filter((r) => r.best).length / counted.length : NaN,
  };
}

/** Paired difference in regret, A minus B, over the positions both were asked at (same order), indifferent ones left out. */
export function regretDifference(a: readonly PickRow[], b: readonly PickRow[]): { positions: number; mean: number; lower: number; upper: number } {
  if (a.length !== b.length) throw new Error(`the two bots must be asked at the same positions (got ${a.length} and ${b.length})`);
  const keep = a.map((r, i) => !r.indifferent && !b[i]!.indifferent);
  const ra = a.filter((_, i) => keep[i]).map((r) => r.regret);
  const rb = b.filter((_, i) => keep[i]).map((r) => r.regret);
  const iv = pairedInterval(ra, rb);
  return { positions: ra.length, mean: iv.mean, lower: ra.length >= 2 ? iv.lower : NaN, upper: ra.length >= 2 ? iv.upper : NaN };
}
