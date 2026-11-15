// Evidence for changing a list (or a bot): paired comparisons on matched games and the adoption rule the deck builders
// share (scripts/forge.ts, scripts/optimize.ts, the season's forge step and the Deck Lab tuner; ROADMAP2 §1 step 5).
// The bot-weight tuners (scripts/tuning.ts) take their paired summary and minimum practical gain from here too.
//
// Plain data and plain functions only, so it runs in Node and in the browser.
//
// A comparison is paired: the candidate list and the current list play the same games (same opponents, same seeds,
// same seats), and the evidence is the per-game difference in score (win 1, tie ½, loss 0), never two win rates
// measured apart.
//
// With the change ledger (src/lib/changeLedger.ts) a nominee may bring held-out games from earlier runs: confirmStaged
// then judges it by the strict pooling rule (judgePooled: an always-valid boundary over the pooled games). Without
// earlier games every result, line and record is the one before the ledger existed.
//
// "Until settled" (docs/TUNING_STUDY_2026-11-13.md P4): confirmStaged's optional `settle` lets a nominee still undecided at
// the cap go on, judged by the same strict pooled rule, until settled, out of reach (DEFAULT_REACH) or out of seeds.
// Without it nothing changes.
import { equalFractions, obfBoundaries } from './groupSequential';

// ---------------------------------------------------------------- paired summaries

export interface PairedSummary {
  games: number;
  mean: number;
  lower95: number;
  upper95: number;
}

/** A paired difference with an interval of `z` standard errors either side (z = 1.96 is the plain 95% interval). */
export interface PairedInterval {
  games: number;
  /** mean per-game difference, candidate minus current (a fraction: 0.01 = 1 percentage point) */
  mean: number;
  lower: number;
  upper: number;
  z: number;
}

function differences(candidate: readonly number[], baseline: readonly number[]): number[] {
  return candidate.map((score, i) => score - (baseline[i] ?? NaN));
}

/** The paired 95% interval (tuners: scripts/tune.ts, scripts/tune-profiles.ts). Needs at least 2 pairs. */
export function summarizePaired(candidate: number[], baseline: number[]): PairedSummary {
  if (candidate.length !== baseline.length || candidate.length === 0) {
    throw new Error(`paired results must have the same non-zero length (got ${candidate.length} and ${baseline.length})`);
  }
  if (candidate.length < 2) throw new Error(`paired results need at least 2 pairs to estimate variance (got ${candidate.length})`);
  const d = differences(candidate, baseline);
  const mean = d.reduce((sum, x) => sum + x, 0) / d.length;
  const variance = d.reduce((sum, x) => sum + (x - mean) ** 2, 0) / (d.length - 1);
  const margin = 1.96 * Math.sqrt(variance / d.length);
  return { games: d.length, mean, lower95: mean - margin, upper95: mean + margin };
}

/**
 * The paired interval at `z` standard errors. A difference of two game scores lies in [-1, 1], so the interval is
 * clipped to that range; with fewer than 2 pairs nothing is known and the interval is the whole range.
 */
export function pairedInterval(candidate: readonly number[], baseline: readonly number[], z = 1.96): PairedInterval {
  if (candidate.length !== baseline.length) throw new Error(`paired results must have the same length (got ${candidate.length} and ${baseline.length})`);
  const n = candidate.length;
  if (n === 0) return { games: 0, mean: 0, lower: -1, upper: 1, z };
  const d = differences(candidate, baseline);
  const mean = d.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { games: n, mean, lower: -1, upper: 1, z };
  const variance = d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1);
  const margin = z * Math.sqrt(variance / n);
  return { games: n, mean, lower: Math.max(-1, mean - margin), upper: Math.min(1, mean + margin), z };
}

/** A bot comparison played in the duplicate format (scripts/botcheck.ts): config A's win rate with its paired interval. */
export interface DuplicateSummary {
  pairs: number;
  /** A's share of the points over both games of every pair */
  winRate: number;
  lower95: number;
  upper95: number;
  /** SD of the per-pair difference in seat-0 score (A in seat 0 minus B in seat 0); about 0.71 if the two games were unrelated */
  sdDiff: number;
  /** pairs where each config won one game (the same deck won both: the pilots made no difference) */
  split: number;
  /** pairs where one config won both games */
  swept: number;
  /** of those, the pairs A won both games of */
  sweptByA: number;
  /** pairs with a tie in either game */
  tied: number;
  /** half-width of the plain binomial 95% interval on the same 2 × pairs games, as if each were an independent game */
  unpairedHalf95: number;
}

/**
 * The duplicate format: every deal is played twice, A piloting the seat-0 deck against B, then B piloting it against A,
 * with decks, seed and first player the same. `aSeat0[i]` and `bSeat0[i]` are the seat-0 deck's scores (win 1, tie ½,
 * loss 0) in the two games of pair i. A's win rate over the pair is ½ + (aSeat0 − bSeat0)/2, so its interval is the
 * paired interval of that difference (pairedInterval), halved and moved to ½: what the deal favours cancels out.
 */
export function duplicateSummary(aSeat0: readonly number[], bSeat0: readonly number[]): DuplicateSummary {
  const iv = pairedInterval(aSeat0, bSeat0);
  const n = iv.games;
  const d = differences(aSeat0, bSeat0);
  const sdDiff = n >= 2 ? Math.sqrt(d.reduce((s, x) => s + (x - iv.mean) ** 2, 0) / (n - 1)) : 0;
  let split = 0;
  let swept = 0;
  let sweptByA = 0;
  let tied = 0;
  d.forEach((diff, i) => {
    if (aSeat0[i] === 0.5 || bSeat0[i] === 0.5) tied++;
    else if (diff === 0) split++;
    else {
      swept++;
      if (diff > 0) sweptByA++;
    }
  });
  const winRate = 0.5 + iv.mean / 2;
  const games = 2 * n;
  return {
    pairs: n,
    winRate,
    lower95: 0.5 + iv.lower / 2,
    upper95: 0.5 + iv.upper / 2,
    sdDiff,
    split,
    swept,
    sweptByA,
    tied,
    unpairedHalf95: games ? 1.96 * Math.sqrt((winRate * (1 - winRate)) / games) : 0.5,
  };
}

/** Score of one game for the list under test (seat a): win 1, tie ½, loss 0. */
export const scoreOf = (winner: 0 | 1 | 'tie' | null | undefined): number => (winner === 0 ? 1 : winner === 'tie' ? 0.5 : 0);

const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

// ---------------------------------------------------------------- the normal quantile

/** Φ⁻¹(p), the standard normal quantile (Acklam's rational approximation; relative error below 1.2e-9). */
export function normalQuantile(p: number): number {
  if (!(p > 0 && p < 1)) throw new Error(`normalQuantile needs 0 < p < 1 (got ${p})`);
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const [a0, a1, a2, a3, a4, a5] = a as [number, number, number, number, number, number];
  const [b0, b1, b2, b3, b4] = b as [number, number, number, number, number];
  const [c0, c1, c2, c3, c4, c5] = c as [number, number, number, number, number, number];
  const [d0, d1, d2, d3] = d as [number, number, number, number];
  const lo = 0.02425;
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c0 * q + c1) * q + c2) * q + c3) * q + c4) * q + c5) / ((((d0 * q + d1) * q + d2) * q + d3) * q + 1);
  }
  if (p > 1 - lo) return -normalQuantile(1 - p);
  const q = p - 0.5;
  const r = q * q;
  return ((((((a0 * r + a1) * r + a2) * r + a3) * r + a4) * r + a5) * q) / (((((b0 * r + b1) * r + b2) * r + b3) * r + b4) * r + 1);
}

// ---------------------------------------------------------------- the adoption rule

/** Default minimum practical gain, in percentage points, that a held-out lower bound must clear (tuners and builders). */
export const DEFAULT_MIN_GAIN_PP = 1;

export type AdoptionKind = 'evidence' | 'any-gain';
export type Outcome = 'adopt' | 'reject' | 'inconclusive';
/**
 * How the staged looks share α (the nominees always split it by Bonferroni):
 * - 'obrien-fleming' (default since 2026-11-12, SIM-5): Lan–DeMets alpha spending with an O'Brien–Fleming-type function
 *   (src/lib/groupSequential.ts): strict early looks, close to the unsplit z at the last one;
 * - 'bonferroni': the same z at every look, α split evenly over them (the rule of 2026-11-11, kept to reproduce old runs).
 */
export type AdoptionBoundary = 'obrien-fleming' | 'bonferroni';
export const ADOPTION_BOUNDARIES: readonly AdoptionBoundary[] = ['obrien-fleming', 'bonferroni'];

export interface AdoptionRule {
  /** 'evidence' (default) or 'any-gain' (the rule before 2026-11-11, kept to reproduce old runs) */
  kind: AdoptionKind;
  /** adopt only when the corrected lower bound of the held-out paired gain is above this (percentage points) */
  minGainPp: number;
  /** the same bar for whole-package moves (default: the same as for card swaps) */
  packageMinGainPp: number;
  /** two-sided error rate shared by every look and every nominee of one decision */
  alpha: number;
  /** how the looks share it (the nominees split it by Bonferroni either way) */
  boundary: AdoptionBoundary;
  /** confirmation runs in equal stages of the builder's first confirmation size, at most this many (cap = capStages × first stage) */
  capStages: number;
  /** no adoption on fewer held-out paired games than this */
  minGames: number;
  /**
   * Futility stop: from this many stages on, a nominee still undecided whose held-out paired mean gain is at most
   * `futilityMaxGainPp` stops there as "could not tell" (stopped early). 0 = off. It only ever stops without adopting,
   * so it cannot raise the false-adopt rate, and the boundaries over `capStages` looks are left as they are.
   */
  futilityAfterStages: number;
  /** the futility stop's threshold on the held-out paired mean gain, in percentage points (0: no gain at all) */
  futilityMaxGainPp: number;
}

/**
 * The deck builders' adoption rule (owner-delegated decision of 2026-11-11, ROADMAP §7; overridable by flags):
 * - screening (cheap, noisy, on shared seeds) only nominates; it never adopts;
 * - each nominee is confirmed on fresh seeds the screening never used, paired against the current list, in stages of the
 *   builder's confirmation size, while the interval still straddles the bar, up to 4 stages;
 * - the nominees share α = 0.05 by a Bonferroni split, and each nominee's one-sided α / (2 · nominees) is spent over the
 *   staged looks by an O'Brien–Fleming-type spending function (src/lib/groupSequential.ts; SIM-5, 2026-11-12): for one
 *   nominee and 4 looks the z's are 4.33, 2.96, 2.36, 2.01, so the chance of adopting a change that is not worth the
 *   minimum gain is at most α / 2 = 2.5% per decision, and the last looks keep most of the power the plain z of 1.96
 *   would have (the Bonferroni split used 2.50 at every look; `boundary: 'bonferroni'` keeps it);
 * - adopt when the corrected lower bound is above 1 point (the tuners' DEFAULT_MIN_GAIN_PP) with at least 200 games;
 *   reject when the corrected upper bound is below 1 point; otherwise "could not tell" at the cap, which is not adopted;
 * - futility stop: after 2 stages, a nominee whose held-out paired mean gain is 0 points or less stops there as "could
 *   not tell (stopped early)" instead of playing to the cap (a change with no real gain can almost never be formally
 *   rejected at these sample sizes). It never adopts, so the α split above is kept as it is.
 */
export const ADOPTION_DEFAULTS: Readonly<AdoptionRule> = Object.freeze({
  kind: 'evidence',
  minGainPp: DEFAULT_MIN_GAIN_PP,
  packageMinGainPp: DEFAULT_MIN_GAIN_PP,
  alpha: 0.05,
  boundary: 'obrien-fleming',
  capStages: 4,
  minGames: 200,
  futilityAfterStages: 2,
  futilityMaxGainPp: 0,
});

/** The rule before 2026-11-11: one confirmation stage, adopt when the candidate scored more than the list at all. */
export const ANY_GAIN_RULE: Readonly<AdoptionRule> = Object.freeze({ kind: 'any-gain', minGainPp: 0, packageMinGainPp: 0, alpha: 0.05, boundary: 'bonferroni', capStages: 1, minGames: 0, futilityAfterStages: 0, futilityMaxGainPp: 0 });

/** A rule from partial settings: `{ kind: 'any-gain' }` is the legacy rule whatever else is set. */
export function adoptionRule(o: Partial<AdoptionRule> = {}): AdoptionRule {
  if (o.kind === 'any-gain') return { ...ANY_GAIN_RULE };
  const r = { ...ADOPTION_DEFAULTS, ...o, kind: 'evidence' as const };
  if (o.packageMinGainPp === undefined) r.packageMinGainPp = r.minGainPp;
  return r;
}

/** Problems with a rule's numbers (the flags and the Lab refuse these). */
export function ruleProblems(r: AdoptionRule): string[] {
  const out: string[] = [];
  if (!(r.alpha > 0 && r.alpha < 1)) out.push(`alpha must be between 0 and 1 (got ${r.alpha})`);
  if (!ADOPTION_BOUNDARIES.includes(r.boundary)) out.push(`the boundary must be one of ${ADOPTION_BOUNDARIES.join(', ')} (got ${String(r.boundary)})`);
  if (!Number.isInteger(r.capStages) || r.capStages < 1 || r.capStages > 16) out.push(`the confirmation cap must be 1 to 16 stages (got ${r.capStages})`);
  if (!(r.minGames >= 0)) out.push(`the minimum games must be 0 or more (got ${r.minGames})`);
  if (!(r.minGainPp >= 0 && r.minGainPp < 100)) out.push(`the minimum gain must be 0 to 100 points (got ${r.minGainPp})`);
  if (!(r.packageMinGainPp >= 0 && r.packageMinGainPp < 100)) out.push(`the package minimum gain must be 0 to 100 points (got ${r.packageMinGainPp})`);
  if (!Number.isInteger(r.futilityAfterStages) || r.futilityAfterStages < 0 || r.futilityAfterStages > 16) out.push(`the futility stop must come after 0 (off) to 16 stages (got ${r.futilityAfterStages})`);
  if (!(r.futilityMaxGainPp > -100 && r.futilityMaxGainPp < 100)) out.push(`the futility threshold must be between -100 and 100 points (got ${r.futilityMaxGainPp})`);
  return out;
}

/**
 * z at each of the `capStages` looks (index 0 = the first) of a decision with `nominees` nominees. Each nominee gets a
 * one-sided α / (2 · nominees); 'bonferroni' splits that evenly over the looks (the same z at every look),
 * 'obrien-fleming' spends it with the O'Brien–Fleming-type function at equal information fractions k / capStages.
 */
export function lookZs(rule: Pick<AdoptionRule, 'alpha' | 'capStages'> & { boundary?: AdoptionBoundary }, nominees = 1): number[] {
  const oneSided = rule.alpha / (2 * Math.max(1, nominees));
  if ((rule.boundary ?? 'bonferroni') === 'bonferroni') return Array.from({ length: rule.capStages }, () => normalQuantile(1 - oneSided / rule.capStages));
  return obfBoundaries(oneSided, equalFractions(rule.capStages));
}

/** z at look `look` (1-based; default the last) of a decision with `nominees` nominees (see lookZs). */
export function lookZ(rule: Pick<AdoptionRule, 'alpha' | 'capStages'> & { boundary?: AdoptionBoundary }, nominees = 1, look = rule.capStages): number {
  const zs = lookZs(rule, nominees);
  return zs[Math.min(zs.length, Math.max(1, look)) - 1] ?? 1.96;
}

/**
 * One look at a nominee's held-out paired interval (already at the corrected z): adopt, reject, or keep going
 * (`continue`); at the last look an undecided nominee is `inconclusive`. `minGainPp` in percentage points.
 */
export function judgeLook(iv: Pick<PairedInterval, 'games' | 'lower' | 'upper'>, o: { minGainPp: number; minGames: number; last: boolean }): Outcome | 'continue' {
  const bar = o.minGainPp / 100;
  if (iv.lower > bar && iv.games >= o.minGames) return 'adopt';
  if (iv.upper < bar) return 'reject';
  return o.last ? 'inconclusive' : 'continue';
}

// ---------------------------------------------------------------- pooling across runs (the change ledger)

/**
 * ρ of the always-valid boundary, in games: the sample size at which the boundary is tightest relative to its long-run
 * growth (src/lib/changeLedger.ts; docs/SYNERGIES.md "Pooling held-out games across runs"). Chosen by simulation
 * (scripts/ledger-sim.ts): 250 to 1,000 games give the same error rate and almost the same power.
 */
export const POOL_RHO = 250;

/**
 * The one-sided normal-mixture boundary of Howard, Ramdas, McAuliffe and Sekhon (2021), "Time-uniform, nonparametric,
 * nonasymptotic confidence sequences", in standard errors at `n` pooled games, for a one-sided error share `a`:
 *   z(n) = sqrt( 2 · (1 + ρ/n) · ln( sqrt(1 + n/ρ) / (2a) + 1 ) )
 * It holds at every n at once, so the pooled games may be looked at after every stage of every run. For a = 0.025:
 * 3.77 at 224 games, 3.32 at 448, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584, 3.12 at 7,168.
 */
export function alwaysValidZ(n: number, a: number, rho: number = POOL_RHO): number {
  if (!(n > 0)) return Infinity;
  return Math.sqrt(2 * (1 + rho / n) * Math.log(Math.sqrt(1 + n / rho) / (2 * a) + 1));
}

/** Each nominee's one-sided share of α in a decision with `nominees` nominees: α / (2 · nominees), as the staged rule gives. */
export const pooledShare = (alpha: number, nominees: number): number => alpha / (2 * Math.max(1, nominees));

/**
 * The pooled interval: the plain mean ± z standard errors, the spread estimated with two pseudo-games added (one +1, one
 * −1), so a change that rarely alters a game never reads as having no spread at all. With n′ = n + 2 and m′ = Σd / n′:
 * v = (Σd² + 2 − n′·m′²) / (n′ − 1), and the interval is Σd/n ± z·sqrt(v/n), clipped to [−1, 1] as pairedInterval is.
 * Only pooled looks use it; the staged rule's interval (pairedInterval) is unchanged.
 */
export function guardedInterval(candidate: readonly number[], baseline: readonly number[], z: number): PairedInterval {
  if (candidate.length !== baseline.length) throw new Error(`paired results must have the same length (got ${candidate.length} and ${baseline.length})`);
  const n = candidate.length;
  if (n === 0) return { games: 0, mean: 0, lower: -1, upper: 1, z };
  let sum = 0;
  let sq = 0;
  for (let i = 0; i < n; i++) {
    const d = (candidate[i] ?? NaN) - (baseline[i] ?? NaN);
    sum += d;
    sq += d * d;
  }
  return guardedFromSums(n, sum, sq, z);
}

/** The guarded per-game variance of n paired differences with sum Σd and Σd²: two pseudo-games, +1 and −1, added. */
export function guardedVariance(n: number, sum: number, sq: number): number {
  const n2 = n + 2;
  const m2 = sum / n2;
  return Math.max(0, (sq + 2 - n2 * m2 * m2) / (n2 - 1));
}

/** guardedInterval from the count, Σd and Σd² (the change ledger and the simulation keep sums). */
export function guardedFromSums(n: number, sum: number, sq: number, z: number): PairedInterval {
  if (n <= 0) return { games: 0, mean: 0, lower: -1, upper: 1, z };
  const mean = sum / n;
  const margin = z * Math.sqrt(guardedVariance(n, sum, sq) / n);
  return { games: n, mean, lower: Math.max(-1, mean - margin), upper: Math.min(1, mean + margin), z };
}

/**
 * One look at pooled held-out games under the strict pooling rule: the guarded interval at the always-valid z for this
 * many games and this decision's nominees, judged as every look is (judgeLook). confirmStaged and the change ledger's
 * verdicts both use it.
 */
export function judgePooled(
  candidate: readonly number[],
  baseline: readonly number[],
  o: { alpha: number; nominees: number; minGainPp: number; minGames: number; last?: boolean },
): { iv: PairedInterval; verdict: Outcome | 'continue' } {
  const iv = guardedInterval(candidate, baseline, alwaysValidZ(candidate.length, pooledShare(o.alpha, o.nominees)));
  return { iv, verdict: judgeLook(iv, { minGainPp: o.minGainPp, minGames: o.minGames, last: !!o.last }) };
}

/** Paired scores from earlier runs (the change ledger's held-out games for one nominee): `base[i]` and `cand[i]` are one game. */
export interface PairedScores {
  base: readonly number[];
  cand: readonly number[];
}

/**
 * How many pooled held-out games the lower bound would need to clear the bar if the mean and the (guarded) spread of n
 * paired differences with sum Σd and Σd² stayed as they are now: the total, not the games still to play (at least
 * `minGames`). Infinity when the mean is not above the bar or there are no games. The change ledger's gamesToSettle
 * (src/lib/changeLedger.ts) and "until settled" (confirmStaged) both use it.
 */
export function settleGamesFromSums(n: number, sum: number, sq: number, o: { alpha: number; nominees: number; minGainPp: number; minGames: number }): number {
  if (!n) return Infinity;
  const bar = o.minGainPp / 100;
  const a = pooledShare(o.alpha, o.nominees);
  const mean = sum / n;
  if (!(mean > bar)) return Infinity;
  // the guarded SD at the current games, held fixed
  const sd = Math.sqrt(guardedVariance(n, sum, sq));
  const clears = (k: number) => k >= o.minGames && mean - alwaysValidZ(k, a) * (sd / Math.sqrt(k)) > bar;
  if (clears(n)) return n;
  // z(k)/√k falls as k grows, so the first k that clears is found by doubling, then halving
  let lo = n;
  let hi = Math.max(n, 1) * 2;
  while (!clears(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e12) return Infinity;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (clears(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/**
 * The reach (docs/SYNERGIES.md "A shortlist carried across runs" and "Until settled"): a change is worth confirming only
 * while it would need at most this many held-out games in all to be adopted at its present mean and spread. One default
 * for the shortlist (SHORTLIST_DEFAULTS.reach) and for "until settled".
 */
export const DEFAULT_REACH = 10_000;

/**
 * "Until settled" (docs/TUNING_STUDY_2026-11-13.md P4): a nominee still undecided when its confirmation reaches the cap
 * goes on in further stages of the same size, each judged by the strict pooled rule on all its held-out games.
 */
export interface UntilSettled {
  /** held-out games in all within which a change is still worth confirming (DEFAULT_REACH) */
  reach: number;
  /** further stages this run may play for one nominee, at most (the seeds the builder has left before its next generation) */
  maxStages: number;
}

/** Why "until settled" ended: adopted, rejected, out of reach, stopped for no gain, this run's limit, or Stop. */
export type SettleEnd = 'adopt' | 'reject' | 'out-of-reach' | 'futility' | 'limit' | 'stop';

/** What "until settled" did for one nominee (absent when the option was off or the confirmation was decided by the cap). */
export interface SettleRecord {
  /** further stages played after the cap */
  stages: number;
  ended: SettleEnd;
  /** out of reach or this run's limit: the held-out games it would need in all at its present mean and spread (absent: its gain is not above the bar) */
  toSettle?: number;
  /** the reach it was given */
  reach: number;
}

/** The further stages "until settled" may play for one nominee: the seeds left (`seedStages`) and the reach, whichever is fewer. */
export function settleStages(o: { seedStages: number; reach: number; firstStage: number; capStages: number }): number {
  // a nominee goes on only while its held-out games are within the reach, so before further stage j it holds at least
  // capStages·firstStage + j·firstStage games: j ≤ (reach − cap) / firstStage
  const byReach = Math.floor((o.reach - o.capStages * o.firstStage) / o.firstStage) + 1;
  return Math.max(0, Math.min(o.seedStages, byReach));
}

// ---------------------------------------------------------------- staged confirmation

/** One stage's games: the current list's scores and each still-undecided nominee's, game by game on the same seeds. */
export interface StageScores {
  base: number[];
  /** in the order of `active` */
  nominees: number[][];
}
/** Play stage `stage` (0-based): `games` games from seed offset `offset`, for the current list and the `active` nominees. */
export type PlayStage = (o: { stage: number; offset: number; games: number; active: number[] }) => Promise<StageScores>;

export interface Confirmation {
  outcome: Outcome;
  /** the held-out paired gain at the corrected z (any-gain: the plain 95% interval, for the record) */
  heldOut: PairedInterval;
  /** win rates over the same held-out games */
  baseWr: number;
  candWr: number;
  /** stages played for this nominee */
  looks: number;
  /** the bar it was judged against, in points */
  minGainPp: number;
  /**
   * stopped before it was decided, never adopted: `true` by the Deck Lab's Stop; 'futility' by the futility stop (no
   * gain after `rule.futilityAfterStages` stages; its games and interval are the ones at that point)
   */
  stopped?: StopReason;
  /**
   * pooled with earlier runs (the change ledger): how many of `heldOut.games` came from earlier runs. Present only for a
   * pooled nominee; then `heldOut` is the pooled always-valid interval, its `z` the boundary at the final look, `looks`
   * the new stages played (0 = decided by the earlier games alone) and the win rates are over the pooled games.
   */
  priorGames?: number;
  /**
   * "until settled" was on and the confirmation was still undecided at the cap: how many further stages it played and
   * why it ended. With one or more further stages, `heldOut` is the pooled always-valid interval over all its held-out
   * games (earlier runs, the stages to the cap and the further ones) and `looks` counts the further stages too.
   */
  settle?: SettleRecord;
}

/** Why a confirmation ended before it was decided: `true` = Stop (Deck Lab), 'futility' = the futility stop. */
export type StopReason = true | 'futility';

/** Whether `rule` may stop a nominee for futility after `stage` stages (1-based) of `stages`. */
export function futilityApplies(rule: Pick<AdoptionRule, 'kind' | 'futilityAfterStages'>, looks: number, stages: number): boolean {
  return rule.kind === 'evidence' && rule.futilityAfterStages > 0 && looks >= rule.futilityAfterStages && looks < stages;
}

/**
 * Confirm nominees on fresh, paired, staged games under `rule`. Each nominee stops when it is decided; the current list
 * plays each stage once and every nominee still in the race is compared with the same games. Stage k plays seed offsets
 * [k·firstStage, (k+1)·firstStage), so the first stage is the builders' old confirmation and the stages never overlap.
 * Under 'any-gain' there is one stage and a nominee is adopted when its mean difference is above zero (the old rule).
 * The futility stop (rule.futilityAfterStages) ends each nominee on its own: once it applies, a nominee that is neither
 * adopted nor rejected and whose held-out mean gain is at most rule.futilityMaxGainPp is "could not tell" with
 * `stopped: 'futility'`. Later stages are played only while a nominee is still live, so every game played is the same
 * game it was without the stop.
 *
 * `priors` (the change ledger, optional): per nominee, its held-out paired games from earlier runs, none of which this
 * confirmation will play. A nominee without one (absent, undefined or empty) is confirmed exactly as above. A nominee
 * with one is judged by the strict pooling rule: its earlier games alone are looked at first (adopt or reject with 0 new
 * games), then after every new stage the earlier and new games pooled, each by the guarded interval at the always-valid
 * z (judgePooled), up to `rule.capStages` new stages; the futility stop applies after a new stage other than the last once
 * the pooled games reach `futilityAfterStages × firstStage`. Under 'any-gain' priors are ignored.
 *
 * `settle` ("until settled", optional; never under 'any-gain'): a nominee that is still undecided after its last capped
 * stage (not stopped by the futility stop or by Stop) goes on in further stages of the same size, from seed offset
 * capStages·firstStage on. Its staged test is over at the cap; from then on only the pooled rule looks: after each
 * further stage all its held-out games (earlier runs, the capped stages and the further ones) are judged by judgePooled,
 * as a later run would judge them. Before each further stage it ends as out of reach when the games it would need in all
 * (settleGamesFromSums) are more than `settle.reach`; after one it ends on adopt or reject, or for no gain when the
 * futility rule fires on the pooled mean (as on the pooled path); and it ends at `settle.maxStages` further stages, or on
 * Stop. Each nominee goes on by itself: a further stage plays the current list once with the nominees still going.
 * Without `settle` every game and result is the one before it existed.
 */
export async function confirmStaged(
  rule: AdoptionRule,
  nominees: readonly { minGainPp: number }[],
  firstStage: number,
  playStage: PlayStage,
  stop: () => boolean = () => false,
  priors?: readonly (PairedScores | undefined)[],
  settle?: UntilSettled,
): Promise<{ results: Confirmation[]; games: number }> {
  const n = nominees.length;
  const scores: number[][] = nominees.map(() => []);
  /** for each nominee, the base scores of the stages it played */
  const baseFor: number[][] = nominees.map(() => []);
  const done: (Confirmation | null)[] = nominees.map(() => null);
  const legacy = rule.kind === 'any-gain';
  const stages = legacy ? 1 : rule.capStages;
  const zs = legacy ? [1.96] : lookZs(rule, n);
  /** z of look `looks` (1-based); a nominee concluded before any look reads the first */
  const zAt = (looks: number) => zs[Math.max(1, Math.min(zs.length, looks)) - 1] ?? 1.96;
  /** each nominee's earlier games, or undefined (today's path); never under any-gain */
  const prior: (PairedScores | undefined)[] = nominees.map((_, i) => {
    const p = legacy ? undefined : priors?.[i];
    if (!p || !p.base.length) return undefined;
    if (p.base.length !== p.cand.length) throw new Error(`a prior needs as many base as candidate scores (got ${p.base.length} and ${p.cand.length})`);
    return p;
  });
  prior.forEach((p, i) => {
    if (!p) return;
    scores[i] = [...p.cand];
    baseFor[i] = [...p.base];
  });
  const pooledLook = (i: number, last: boolean) =>
    judgePooled(scores[i] ?? [], baseFor[i] ?? [], { alpha: rule.alpha, nominees: n, minGainPp: nominees[i]?.minGainPp ?? rule.minGainPp, minGames: rule.minGames, last });
  let games = 0;
  const conclude = (i: number, outcome: Outcome, looks: number, stopped?: StopReason): Confirmation => {
    const p = prior[i];
    const iv = p ? pooledLook(i, false).iv : pairedInterval(scores[i] ?? [], baseFor[i] ?? [], zAt(looks));
    return { outcome, heldOut: iv, baseWr: mean(baseFor[i] ?? []), candWr: mean(scores[i] ?? []), looks, minGainPp: nominees[i]?.minGainPp ?? 0, ...(stopped ? { stopped } : {}), ...(p ? { priorGames: p.base.length } : {}) };
  };
  // the earlier games alone are looked at first: a nominee they already decide plays no new game
  prior.forEach((p, i) => {
    if (!p) return;
    const v = pooledLook(i, false).verdict;
    if (v === 'adopt' || v === 'reject') done[i] = conclude(i, v, 0);
  });
  for (let stage = 0; stage < stages; stage++) {
    const active = done.flatMap((d, i) => (d ? [] : [i]));
    if (!active.length) break;
    if (stage > 0 && stop()) {
      for (const i of active) done[i] = conclude(i, 'inconclusive', stage, true);
      break;
    }
    const r = await playStage({ stage, offset: stage * firstStage, games: firstStage, active });
    games += r.base.length * (1 + active.length);
    active.forEach((i, k) => {
      (scores[i] ??= []).push(...(r.nominees[k] ?? []));
      (baseFor[i] ??= []).push(...r.base);
    });
    for (const i of active) {
      if (prior[i]) {
        const last = stage === stages - 1;
        const { iv, verdict } = pooledLook(i, last);
        if (verdict !== 'continue') done[i] = conclude(i, verdict, stage + 1);
        else if (rule.futilityAfterStages > 0 && iv.games >= rule.futilityAfterStages * firstStage && iv.mean <= rule.futilityMaxGainPp / 100) done[i] = conclude(i, 'inconclusive', stage + 1, 'futility');
        continue;
      }
      if (legacy) {
        const m = mean(scores[i] ?? []) - mean(baseFor[i] ?? []);
        done[i] = conclude(i, m > 0 ? 'adopt' : 'reject', 1);
        continue;
      }
      const iv = pairedInterval(scores[i] ?? [], baseFor[i] ?? [], zAt(stage + 1));
      const v = judgeLook(iv, { minGainPp: nominees[i]?.minGainPp ?? rule.minGainPp, minGames: rule.minGames, last: stage === stages - 1 });
      if (v !== 'continue') done[i] = conclude(i, v, stage + 1);
      else if (futilityApplies(rule, stage + 1, stages) && iv.mean <= rule.futilityMaxGainPp / 100) done[i] = conclude(i, 'inconclusive', stage + 1, 'futility');
    }
  }
  if (settle && !legacy) games += await settleOn(settle);
  return { results: done.map((d, i) => d ?? conclude(i, 'inconclusive', 0, true)), games };

  /** "until settled": the nominees still undecided at the cap go on, each judged by the pooled rule alone (see above) */
  async function settleOn(s: UntilSettled): Promise<number> {
    let played = 0;
    const further = nominees.map(() => 0);
    const toSettleOf = (i: number) => {
      const c = scores[i] ?? [];
      const b = baseFor[i] ?? [];
      let sum = 0;
      let sq = 0;
      for (let g = 0; g < c.length; g++) {
        const d = (c[g] ?? 0) - (b[g] ?? 0);
        sum += d;
        sq += d * d;
      }
      return settleGamesFromSums(c.length, sum, sq, { alpha: rule.alpha, nominees: n, minGainPp: nominees[i]?.minGainPp ?? rule.minGainPp, minGames: rule.minGames });
    };
    const end = (i: number, ended: SettleEnd, outcome: Outcome = 'inconclusive', toSettle?: number) => {
      const before = done[i]!;
      const k = further[i] ?? 0;
      const stopped: StopReason | undefined = ended === 'futility' ? 'futility' : ended === 'stop' ? true : undefined;
      const record: SettleRecord = { stages: k, ended, ...(toSettle !== undefined && Number.isFinite(toSettle) ? { toSettle } : {}), reach: s.reach };
      if (!k) {
        done[i] = { ...before, settle: record };
        return;
      }
      // the staged test is over: the figure is the pooled one over every held-out game, as the next look of a later run
      // (`before` was not stopped: only undecided, unstopped nominees go on)
      done[i] = { ...before, outcome, heldOut: pooledLook(i, false).iv, baseWr: mean(baseFor[i] ?? []), candWr: mean(scores[i] ?? []), looks: stages + k, ...(stopped ? { stopped } : {}), settle: record };
    };
    // undecided at the cap, not stopped there (by the futility stop or by Stop)
    let live = done.flatMap((d, i) => (d && d.outcome === 'inconclusive' && !d.stopped && d.looks === stages ? [i] : []));
    for (let k = 0; live.length; k++) {
      // out of reach is checked before each further stage: a change already out of reach at the cap plays nothing more
      live = live.filter((i) => {
        const t = toSettleOf(i);
        if (t > s.reach && t > (scores[i]?.length ?? 0)) {
          end(i, 'out-of-reach', 'inconclusive', t);
          return false;
        }
        return true;
      });
      if (!live.length) break;
      if (k >= s.maxStages) {
        for (const i of live) end(i, 'limit', 'inconclusive', toSettleOf(i));
        break;
      }
      if (stop()) {
        for (const i of live) end(i, 'stop');
        break;
      }
      const stage = stages + k;
      const r = await playStage({ stage, offset: stage * firstStage, games: firstStage, active: live });
      played += r.base.length * (1 + live.length);
      live.forEach((i, j) => {
        (scores[i] ??= []).push(...(r.nominees[j] ?? []));
        (baseFor[i] ??= []).push(...r.base);
        further[i] = k + 1;
      });
      live = live.filter((i) => {
        const { iv, verdict } = pooledLook(i, false);
        if (verdict === 'adopt' || verdict === 'reject') {
          end(i, verdict, verdict);
          return false;
        }
        if (rule.futilityAfterStages > 0 && iv.games >= rule.futilityAfterStages * firstStage && iv.mean <= rule.futilityMaxGainPp / 100) {
          end(i, 'futility');
          return false;
        }
        return true;
      });
    }
    return played;
  }
}

/** The adopted nominee to take (highest corrected lower bound; under any-gain, the highest mean), or -1. */
export function pickAdopted(results: readonly Confirmation[]): number {
  let best = -1;
  results.forEach((r, i) => {
    if (r.outcome !== 'adopt') return;
    const b = results[best];
    if (!b || r.heldOut.lower > b.heldOut.lower || (r.heldOut.lower === b.heldOut.lower && r.heldOut.mean > b.heldOut.mean)) best = i;
  });
  return best;
}

// ---------------------------------------------------------------- wording and provenance

/** The outcome as reports say it: adopted, rejected, could not tell. */
export const outcomeWord = (o: Outcome): string => (o === 'adopt' ? 'adopted' : o === 'reject' ? 'rejected' : 'could not tell');

const pts = (x: number, digits = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(digits)}`;

/**
 * Why a nominee stopped early, in plain words: "stopped early: no gain after 448 games" (futility; with a threshold
 * other than 0, "gain at most +0.5 pts after …"), or "stopped" (Stop). Empty when it was not stopped.
 */
export function stoppedWords(stopped: StopReason | boolean | undefined, games: number, futilityMaxGainPp = 0): string {
  if (stopped === 'futility') return `stopped early: ${futilityMaxGainPp === 0 ? 'no gain' : `gain at most ${pts(futilityMaxGainPp / 100)} pts`} after ${games} games`;
  return stopped ? 'stopped' : '';
}

/**
 * The outcome as reports say it, with why it stopped early: "could not tell (stopped early: no gain after 448 games)";
 * a confirmation that went on until settled says that instead: "adopted (confirmed until settled: 6 more stages)".
 */
export function confirmationWord(c: { outcome: Outcome; stopped?: StopReason | boolean; heldOut?: { games: number }; settle?: Pick<SettleRecord, 'stages' | 'ended' | 'toSettle' | 'reach'> }, futilityMaxGainPp = 0): string {
  if (c.settle) return `${outcomeWord(c.outcome)} (${settleWords(c.settle, c.heldOut?.games ?? 0)})`;
  const why = stoppedWords(c.stopped, c.heldOut?.games ?? 0, futilityMaxGainPp);
  return `${outcomeWord(c.outcome)}${why ? ` (${why})` : ''}`;
}

/**
 * What "until settled" did, in plain words (`games`: the held-out games it ended on): "confirmed until settled: 6 more
 * stages"; "kept confirming for 2 more stages, then stopped: out of reach, it would need about 14,200 held-out games in all
 * (the reach is 10,000)"; "kept confirming for 18 more stages, up to this run's limit: about 2,300 more held-out games may
 * settle it"; "not continued: out of reach, its held-out gain is not above the bar". A need past ten times the reach is
 * said as "more than 100,000" (a mean barely above the bar asks for hundreds of millions of games).
 */
export function settleWords(s: Pick<SettleRecord, 'stages' | 'ended' | 'toSettle' | 'reach'>, games: number): string {
  const k = (x: number) => Math.round(x).toLocaleString('en-US');
  const more = `${s.stages} more stage${s.stages === 1 ? '' : 's'}`;
  const went = s.stages ? `kept confirming for ${more}` : 'not continued';
  // a mean barely above the bar asks for millions of games: past ten times the reach the figure says nothing more
  const far = 10 * s.reach;
  const need = s.toSettle === undefined ? 'its held-out gain is not above the bar' : s.toSettle > far ? `it would need more than ${k(far)} held-out games in all` : `it would need about ${k(s.toSettle)} held-out games in all`;
  switch (s.ended) {
    case 'adopt':
    case 'reject':
      return `confirmed until settled: ${more}`;
    case 'out-of-reach':
      return `${went}${s.stages ? ', then stopped' : ''}: out of reach, ${need} (the reach is ${k(s.reach)})`;
    case 'futility':
      return `${went}, then stopped: no gain after ${k(games)} games`;
    case 'limit':
      return `${went}${s.stages ? ', up to' : ':'} this run's limit${s.toSettle !== undefined ? `; about ${k(Math.max(0, s.toSettle - games))} more held-out games may settle it` : `; ${need} yet`}`;
    case 'stop':
      return s.stages ? `${went}, then stopped` : 'not continued: the run was stopped';
  }
}

/** "+4.8 pts [+0.2, +9.4], 560 games" — a paired gain with its interval and games. */
export function formatGain(iv: Pick<PairedInterval, 'mean' | 'lower' | 'upper' | 'games'>): string {
  return `${pts(iv.mean)} pts [${pts(iv.lower)}, ${pts(iv.upper)}], ${iv.games} games`;
}

/**
 * A pooled nominee's held-out gain (the change ledger): "+2.1 pts [+1.1, +3.1], 2,016 games (1,120 from earlier runs;
 * always-valid z 3.05, 2 new stages)"; "… decided by the earlier games alone" when it played no new game.
 */
export function pooledGainWords(c: Pick<Confirmation, 'heldOut' | 'looks' | 'priorGames'>): string {
  const iv = c.heldOut;
  return `${pts(iv.mean)} pts [${pts(iv.lower)}, ${pts(iv.upper)}], ${iv.games.toLocaleString('en-US')} games (${pooledNoteWords(c)})`;
}

/**
 * The note of a pooled gain on its own, for a page that shows the figure itself in its usual place: "1,120 from earlier
 * runs; always-valid z 3.05, 2 new stages" ("… decided by the earlier games alone" when it played no new game).
 */
export function pooledNoteWords(c: Pick<Confirmation, 'heldOut' | 'looks' | 'priorGames'>): string {
  const k = (x: number) => x.toLocaleString('en-US');
  const how = c.looks === 0 ? 'decided by the earlier games alone' : `${c.looks} new stage${c.looks === 1 ? '' : 's'}`;
  return `${k(c.priorGames ?? 0)} from earlier runs; always-valid z ${c.heldOut.z.toFixed(2)}, ${how}`;
}

/**
 * One line for reports: what the rule is, with its numbers. `ledger`: the change ledger is on, so the line also says how
 * a nominee with earlier held-out games is judged (without it the line is exactly the one before the ledger existed).
 */
export function describeRule(rule: AdoptionRule, o: { firstStage?: number; nominees?: number; ledger?: boolean; untilSettled?: { reach: number }; confirmedWith?: ConfirmedWith } = {}): string {
  const bots = o.confirmedWith ? confirmClause(o.confirmedWith) : '';
  if (rule.kind === 'any-gain') return `any-gain (legacy): one confirmation${o.firstStage ? ` of ${o.firstStage} fresh games` : ''}; a change is adopted when it scores higher at all${o.ledger ? '; the change ledger records the games but never pools them under this rule' : ''}${bots}`;
  const base = describeStagedRule(rule, o);
  const pooled = o.ledger ? `${base}${poolingClause(rule, o.nominees ?? 1)}` : base;
  return `${o.untilSettled ? `${pooled}${settleClause(rule, o.nominees ?? 1, o.untilSettled.reach)}` : pooled}${bots}`;
}

/**
 * The confirmation played by another bot than the screening (the forge's --confirm-bot, the Deck Lab's "Confirm with the
 * Hard bot"): each generation's baseline and screening with `screen`, its confirmation stages with `confirm`. Absent when
 * both are the same bot, and then nothing says so.
 */
export interface ConfirmedWith {
  screen: string;
  confirm: string;
}

/** A bot as the reports name it: "Medium" (lookahead and best build Medium's agent, fast Easy's). */
export function botWord(bot: string): string {
  const words: Readonly<Record<string, string>> = { easy: 'Easy', fast: 'Easy', medium: 'Medium', lookahead: 'Medium', best: 'Medium', hard: 'Hard', 'hard-v1': 'Hard (v1)', deep: 'Deep', mixed: 'Mixed', plain: 'Plain', random: 'Random' };
  return words[bot] ?? bot;
}

/** "; screened with the Medium bot, confirmed with the Hard bot" */
function confirmClause(c: ConfirmedWith): string {
  return `; screened with the ${botWord(c.screen)} bot, confirmed with the ${botWord(c.confirm)} bot`;
}

/** "; until settled: …" (the option in words, with the pooled boundary it is judged by). */
function settleClause(rule: AdoptionRule, nominees: number, reach: number): string {
  const a = pooledShare(rule.alpha, nominees);
  return `; until settled: a nominee still undecided at the cap goes on in stages of the same size, each followed by a look at all its held-out games pooled by the always-valid boundary (z = ${alwaysValidZ(2240, a).toFixed(2)} at 2,240 games, ${alwaysValidZ(4480, a).toFixed(2)} at 4,480), until adopted or rejected, until it would need more than ${reach.toLocaleString('en-US')} held-out games in all${rule.futilityAfterStages > 0 ? `, until its pooled mean gain is at most ${rule.futilityMaxGainPp} point${rule.futilityMaxGainPp === 1 ? '' : 's'}` : ''}, or until the run's seeds for it run out`;
}

/** "; with the change ledger, a nominee with held-out games from earlier runs …" (the strict pooling rule in words). */
function poolingClause(rule: AdoptionRule, nominees: number): string {
  const a = pooledShare(rule.alpha, nominees);
  const z = (k: number) => alwaysValidZ(k, a).toFixed(2);
  return `; change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = ${POOL_RHO} games, one-sided ${+a.toFixed(5)} each: z = ${z(448)} at 448 games, ${z(896)} at 896, ${z(1792)} at 1,792, ${z(3584)} at 3,584)`;
}

function describeStagedRule(rule: AdoptionRule, o: { firstStage?: number; nominees?: number }): string {
  const zs = lookZs(rule, o.nominees ?? 1);
  const stages = o.firstStage ? `stages of ${o.firstStage} fresh paired games up to ${rule.capStages * o.firstStage}` : `up to ${rule.capStages} stages of fresh paired games`;
  const pkg = rule.packageMinGainPp !== rule.minGainPp ? ` (package moves ${rule.packageMinGainPp} points)` : '';
  const many = (o.nominees ?? 1) > 1;
  const split =
    rule.boundary === 'bonferroni'
      ? `α = ${rule.alpha} split over ${rule.capStages} looks${many ? ` × ${o.nominees} nominees` : ''} (Bonferroni, z = ${(zs[0] ?? 0).toFixed(2)})`
      : `α = ${rule.alpha}${many ? ` split over ${o.nominees} nominees (Bonferroni) and` : ''} spent over ${rule.capStages} look${rule.capStages === 1 ? '' : 's'} (O'Brien–Fleming-type, z = ${zs.map((z) => z.toFixed(2)).join(' / ')})`;
  return `evidence: ${stages}; adopt when the lower bound of the paired gain is above ${rule.minGainPp} point${rule.minGainPp === 1 ? '' : 's'}${pkg} with at least ${rule.minGames} games, reject when the upper bound is below it, otherwise could not tell${futilityClause(rule, o.firstStage)}; ${split}`;
}

/** "; a nominee with no gain after 2 stages (560 games) stops early as could not tell", or '' when the stop is off or never reached. */
function futilityClause(rule: AdoptionRule, firstStage?: number): string {
  if (!futilityApplies(rule, rule.futilityAfterStages, rule.capStages)) return '';
  const k = rule.futilityAfterStages;
  const gain = rule.futilityMaxGainPp === 0 ? 'no gain' : `a gain of at most ${rule.futilityMaxGainPp} point${rule.futilityMaxGainPp === 1 ? '' : 's'}`;
  return `; a nominee with ${gain} after ${k} stage${k === 1 ? '' : 's'}${firstStage ? ` (${k * firstStage} games)` : ''} stops early as could not tell`;
}

/** What a run manifest records about the rule (optional `adoption` field; schema stays 1). */
export interface AdoptionProvenance {
  rule: AdoptionKind;
  minGainPp: number;
  packageMinGainPp: number;
  alpha: number;
  /**
   * how the staged looks and nominees share α: 'bonferroni' (an even split over looks × nominees, the rule of 2026-11-11),
   * 'obrien-fleming' (nominees by Bonferroni, looks by O'Brien–Fleming-type spending, from 2026-11-12), 'none' (any-gain)
   */
  correction: 'bonferroni' | 'obrien-fleming' | 'none';
  /** the z of each look for `nominees` nominees (absent in runs recorded before 2026-11-12) */
  lookZ?: number[];
  capStages: number;
  minGames: number;
  /** games in the first confirmation stage */
  firstStage: number;
  /** nominees confirmed per decision, at most */
  nominees: number;
  /** search depth */
  cardsPerChange: number;
  packagesPerChange: number;
  /** the futility stop: after this many stages (0 = off; absent = recorded before the stop existed, so off) */
  futilityAfterStages?: number;
  /** its threshold on the held-out paired mean gain, points */
  futilityMaxGainPp?: number;
  /**
   * the change ledger was on (absent = off): held-out games from earlier runs were pooled by the strict rule, the
   * normal-mixture boundary with this ρ in games (src/lib/changeLedger.ts); never under any-gain
   */
  ledger?: { boundary: 'normal-mixture'; rho: number };
  /**
   * "until settled" was on (absent = off): a nominee undecided at the cap went on, judged by the pooled always-valid
   * boundary, while within `reach` held-out games in all; never under any-gain
   */
  untilSettled?: { reach: number };
  /**
   * the confirmation stages were played by this bot, not the run's own (the forge's --confirm-bot, the Deck Lab's "Confirm
   * with the Hard bot"); absent = the screening bot confirmed (the bot the manifest names)
   */
  confirmBot?: string;
}

export function adoptionProvenance(
  rule: AdoptionRule,
  o: { firstStage: number; nominees: number; cardsPerChange: number; packagesPerChange: number },
  ledger = false,
  untilSettled?: { reach: number },
  confirmBot?: string,
): AdoptionProvenance {
  const p = plainProvenance(rule, o);
  const l = ledger && rule.kind === 'evidence' ? { ...p, ledger: { boundary: 'normal-mixture' as const, rho: POOL_RHO } } : p;
  const u = untilSettled && rule.kind === 'evidence' ? { ...l, untilSettled: { reach: untilSettled.reach } } : l;
  return confirmBot ? { ...u, confirmBot } : u;
}

function plainProvenance(rule: AdoptionRule, o: { firstStage: number; nominees: number; cardsPerChange: number; packagesPerChange: number }): AdoptionProvenance {
  return {
    rule: rule.kind,
    minGainPp: rule.minGainPp,
    packageMinGainPp: rule.packageMinGainPp,
    alpha: rule.alpha,
    correction: rule.kind === 'evidence' ? rule.boundary : 'none',
    ...(rule.kind === 'evidence' ? { lookZ: lookZs(rule, o.nominees).map(r4) } : {}),
    capStages: rule.capStages,
    minGames: rule.minGames,
    ...o,
    ...(rule.kind === 'evidence' ? { futilityAfterStages: rule.futilityAfterStages, futilityMaxGainPp: rule.futilityMaxGainPp } : {}),
  };
}

/** A nominee as reports and run files record it: its screening result, and its held-out confirmation if it got one. */
export interface NomineeRecord {
  label: string;
  /** package move kind, or 'combo' parts for combined changes */
  package?: string;
  /** screening: the shared-seed paired gain, plain 95% interval (it only nominates) */
  screen: { games: number; mean: number; lower: number; upper: number };
  /** `priorGames`: pooled with earlier runs (the change ledger), this many of `games` came from them (absent otherwise) */
  heldOut?: { games: number; mean: number; lower: number; upper: number; z: number; looks: number; baseWr: number; candWr: number; priorGames?: number };
  outcome?: Outcome;
  /** the confirmation was cut short: `true` by Stop, 'futility' by the futility stop (heldOut is at that point) */
  stopped?: StopReason;
  /** "until settled": further stages after the cap and why it ended (heldOut is then the pooled interval over all its games) */
  settle?: SettleRecord;
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
export function nomineeRecord(label: string, screen: PairedInterval, c?: Confirmation, pkg?: string): NomineeRecord {
  return {
    label,
    ...(pkg ? { package: pkg } : {}),
    screen: { games: screen.games, mean: r4(screen.mean), lower: r4(screen.lower), upper: r4(screen.upper) },
    ...(c
      ? {
          heldOut: { games: c.heldOut.games, mean: r4(c.heldOut.mean), lower: r4(c.heldOut.lower), upper: r4(c.heldOut.upper), z: r4(c.heldOut.z), looks: c.looks, baseWr: r4(c.baseWr), candWr: r4(c.candWr), ...(c.priorGames ? { priorGames: c.priorGames } : {}) },
          outcome: c.outcome,
          ...(c.stopped ? { stopped: c.stopped } : {}),
          ...(c.settle ? { settle: { ...c.settle } } : {}),
        }
      : {}),
  };
}
