// A paired comparison split by opponent and by seat (docs/TUNING_STUDY_2026-11-13.md P6; docs/SYNERGIES.md "By
// opponent, and re-measuring a change"): the per-opponent and per-seat paired differences, the χ² test of whether the
// per-opponent figures differ by more than chance, and a stratified interval that takes the builders' layout (opponent ×
// seat cells) into account. For reporting only: the adoption rules (confirmStaged, judgePooled in src/lib/evidence.ts)
// never read any of it.
//
// It sits beside src/lib/evidence.ts rather than in it because evidence.ts is in the game worker's import graph
// (src/lib/runManifest.ts imports a type from it): an edit there changes the game cache's code hash (scripts/game-cache.ts).
// Plain data and plain functions only, so it runs in Node and in the browser.
import type { NomineeRecord, PairedInterval } from './evidence';
import { normalCdf } from './groupSequential';

/** Where a paired game sat: the opponent (a list fingerprint or a name) and who went first (0 = the list under test). */
export interface PairSlot {
  opp: string;
  first: 0 | 1;
}

/** A group's paired difference: games, mean and its standard error (plain sample SD / √n; 0 below 2 games). */
export interface GroupSummary {
  games: number;
  mean: number;
  se: number;
}

/** The paired difference per opponent (most games first) and per seat (going first, then second). */
export interface PairedSplit {
  byOpp: (GroupSummary & { opp: string })[];
  bySeat: (GroupSummary & { first: 0 | 1 })[];
}

/** χ² of the group means around their precision-weighted mean, its degrees of freedom and p-value. */
export interface Heterogeneity {
  chi2: number;
  df: number;
  p: number;
}

/** A group of per-game differences: count, mean, plain sample SD and the SE of the mean. */
export function pairedGroup(ds: readonly number[]): GroupSummary & { sd: number } {
  const n = ds.length;
  const mean = n ? ds.reduce((s, x) => s + x, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(ds.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1)) : 0;
  return { games: n, mean, sd, se: n > 1 ? sd / Math.sqrt(n) : 0 };
}

function check(candidate: readonly number[], baseline: readonly number[], slots: readonly PairSlot[]): void {
  if (candidate.length !== baseline.length || candidate.length !== slots.length) throw new Error(`paired results need one slot per game (got ${candidate.length} candidate scores, ${baseline.length} baseline scores and ${slots.length} slots)`);
}

/**
 * The paired difference (candidate minus baseline) per opponent and per seat, from per-game scores and each game's slot.
 * The opponents come most games first (then by name); the seats are always both, going first (0) then second (1).
 * The change ledger's summary (summarize, src/lib/changeLedger.ts) is this over its games.
 */
export function splitPaired(candidate: readonly number[], baseline: readonly number[], slots: readonly PairSlot[]): PairedSplit {
  check(candidate, baseline, slots);
  const opps = new Map<string, number[]>();
  const seats: [number[], number[]] = [[], []];
  slots.forEach((s, i) => {
    const d = (candidate[i] ?? NaN) - (baseline[i] ?? NaN);
    const o = opps.get(s.opp) ?? [];
    o.push(d);
    opps.set(s.opp, o);
    seats[s.first].push(d);
  });
  const strip = ({ games, mean, se }: GroupSummary) => ({ games, mean, se });
  return {
    byOpp: [...opps.entries()].map(([opp, ds]) => ({ opp, ...strip(pairedGroup(ds)) })).sort((a, b) => b.games - a.games || (a.opp < b.opp ? -1 : 1)),
    bySeat: ([0, 1] as const).map((first) => ({ first, ...strip(pairedGroup(seats[first])) })),
  };
}

/** Groups the χ² test reads: 20 or more games, with a spread. */
const testable = <G extends GroupSummary>(groups: readonly G[]): G[] => groups.filter((g) => g.games >= 20 && g.se > 0);

/**
 * χ² heterogeneity of group means around their precision-weighted mean, with a Wilson–Hilferty p-value. Only groups of
 * 20 or more games with a spread take part; null with fewer than two of them.
 */
export function heterogeneity(groups: readonly GroupSummary[]): Heterogeneity | null {
  const gs = testable(groups);
  if (gs.length < 2) return null;
  const w = gs.map((g) => 1 / g.se ** 2);
  const sw = w.reduce((a, b) => a + b, 0);
  const m = gs.reduce((a, g, i) => a + w[i]! * g.mean, 0) / sw;
  const chi2 = gs.reduce((a, g) => a + ((g.mean - m) / g.se) ** 2, 0);
  const df = gs.length - 1;
  const z = (Math.cbrt(chi2 / df) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));
  return { chi2, df, p: 1 - normalCdf(z) };
}

/** A stratified interval: the paired mean with a standard error from the opponent × seat cells. */
export interface StratifiedInterval extends PairedInterval {
  /** the standard error of the mean, from the cells */
  se: number;
  /** opponent × seat cells with games */
  cells: number;
}

/**
 * The paired mean with a standard error that takes the design into account. The cells are opponent × seat; each cell's
 * weight is its share of the games, so the estimate is exactly the pooled paired mean; the variance is Σ w²·s²/n over
 * the cells (s² the cell's sample variance; a cell with one game borrows the pooled variance). It leaves out what the
 * spread between cells adds to the plain interval, so where the opponents or seats differ it is narrower; where they do
 * not, it is about as wide (a little wider, by the cells' own degrees of freedom). For reporting beside the plain
 * interval only: no adoption rule uses it. Clipped to [−1, 1]; with fewer than 2 games the whole range.
 */
export function stratifiedInterval(candidate: readonly number[], baseline: readonly number[], slots: readonly PairSlot[], z = 1.96): StratifiedInterval {
  check(candidate, baseline, slots);
  const n = candidate.length;
  const d = candidate.map((c, i) => c - (baseline[i] ?? NaN));
  const cells = new Map<string, number[]>();
  slots.forEach((s, i) => {
    const k = `${s.first}\u0000${s.opp}`;
    const c = cells.get(k) ?? [];
    c.push(d[i] ?? NaN);
    cells.set(k, c);
  });
  if (n === 0) return { games: 0, mean: 0, lower: -1, upper: 1, z, se: Infinity, cells: 0 };
  const mean = d.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { games: n, mean, lower: -1, upper: 1, z, se: Infinity, cells: cells.size };
  const pooledVar = d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  let v = 0;
  for (const ds of cells.values()) {
    const k = ds.length;
    const s2 = k > 1 ? pairedGroup(ds).sd ** 2 : pooledVar;
    const w = k / n;
    v += (w * w * s2) / k;
  }
  const se = Math.sqrt(v);
  return { games: n, mean, lower: Math.max(-1, mean - z * se), upper: Math.min(1, mean + z * se), z, se, cells: cells.size };
}

// ---------------------------------------------------------------- the builders' nominees

/** A nominee's held-out games: per-game scores and where each game sat, in the order its figure took them. */
export interface HeldOutGames {
  cand: readonly number[];
  base: readonly number[];
  slots: readonly PairSlot[];
}

/** What a nominee record gains from its held-out games (opponents by list fingerprint). */
export interface NomineeSplit {
  byOpp?: (GroupSummary & { opp: string })[];
  bySeat?: (GroupSummary & { first: 0 | 1 })[];
  /** across opponents; absent with fewer than two opponents of 20+ games */
  heterogeneity?: Heterogeneity;
}

/** A nominee record with its per-opponent and per-seat figures (the forge's and optimizer's JSON). */
export type SplitNomineeRecord = NomineeRecord & NomineeSplit;

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
const p4 = (x: number) => (x > 0 ? Number(x.toPrecision(4)) : 0);

/** The per-opponent and per-seat figures of some held-out games, and the heterogeneity test across opponents. */
export function nomineeSplit(h: HeldOutGames): NomineeSplit {
  const s = splitPaired(h.cand, h.base, h.slots);
  const het = heterogeneity(s.byOpp);
  const round = <G extends GroupSummary>(g: G): G => ({ ...g, mean: r4(g.mean), se: r4(g.se) });
  return { byOpp: s.byOpp.map(round), bySeat: s.bySeat.map(round), ...(het ? { heterogeneity: { chi2: r4(het.chi2), df: het.df, p: p4(het.p) } } : {}) };
}

/**
 * A nominee record with the figures of its held-out games added, when it has a held-out figure and the games are the
 * ones it covers (as many as `heldOut.games`); otherwise the record as it was.
 */
export function withSplit<T extends NomineeRecord>(rec: T, h: HeldOutGames | undefined): T & NomineeSplit {
  if (!rec.heldOut || !h || !h.cand.length || h.cand.length !== rec.heldOut.games) return rec as T & NomineeSplit;
  return { ...rec, ...nomineeSplit(h) };
}

/**
 * Each nominee's held-out games as a staged confirmation plays them (confirmStaged): the earlier runs' games it was
 * handed as a prior first, then every stage it took part in, in order, so they are exactly the games its held-out figure
 * covers. A prior must be the one confirmStaged gets (none under any-gain).
 */
export class HeldOutTracker {
  private held: { cand: number[]; base: number[]; slots: PairSlot[] }[];

  constructor(nominees: number, priors?: readonly (readonly (PairSlot & { base: number; cand: number })[] | undefined)[]) {
    this.held = Array.from({ length: nominees }, (_, i) => {
      const p = priors?.[i] ?? [];
      return { cand: p.map((g) => g.cand), base: p.map((g) => g.base), slots: p.map((g) => ({ opp: g.opp, first: g.first })) };
    });
  }

  /** One stage: its slots, the current list's scores and each active nominee's (in the order of `active`). */
  stage(active: readonly number[], slots: readonly PairSlot[], base: readonly number[], nominees: readonly (readonly number[])[]): void {
    active.forEach((i, k) => {
      const h = this.held[i];
      const c = nominees[k];
      if (!h || !c) return;
      h.cand.push(...c);
      h.base.push(...base);
      h.slots.push(...slots.map((s) => ({ opp: s.opp, first: s.first })));
    });
  }

  games(i: number): HeldOutGames {
    return this.held[i] ?? { cand: [], base: [], slots: [] };
  }
}

// ---------------------------------------------------------------- words

const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;

/** The p-value under which the per-opponent figures are said to differ (the evidence page's depends-on-opponent flag). */
export const DEPENDS_P = 0.05;

/**
 * "depends on the opponent: +9.1 against X, −3.0 against Y (χ² 18.3 on 6 df, p 0.006)": the two extremes of the
 * opponents the test read, in points, when the per-opponent figures differ by more than chance; null otherwise.
 */
export function dependsOnOpponentWords(s: NomineeSplit, name: (opp: string) => string): string | null {
  const het = s.heterogeneity;
  if (!het || !(het.p < DEPENDS_P)) return null;
  const gs = testable(s.byOpp ?? []);
  if (gs.length < 2) return null;
  const hi = gs.reduce((a, g) => (g.mean > a.mean ? g : a));
  const lo = gs.reduce((a, g) => (g.mean < a.mean ? g : a));
  const p = het.p < 0.001 ? 'p < 0.001' : `p ${het.p.toFixed(3)}`;
  return `depends on the opponent: ${pts(hi.mean)} against ${name(hi.opp)}, ${pts(lo.mean)} against ${name(lo.opp)} (χ² ${het.chi2.toFixed(1)} on ${het.df} df, ${p})`;
}
