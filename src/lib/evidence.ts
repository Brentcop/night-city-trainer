// Evidence for changing a list (or a bot): paired comparisons on matched games and the adoption rule the deck builders
// share (scripts/forge.ts, scripts/optimize.ts, the season's forge step and the Deck Lab tuner; ROADMAP2 §1 step 5).
// The bot-weight tuners (scripts/tuning.ts) take their paired summary and minimum practical gain from here too.
//
// Plain data and plain functions only, so it runs in Node and in the browser.
//
// A comparison is paired: the candidate list and the current list play the same games (same opponents, same seeds,
// same seats), and the evidence is the per-game difference in score (win 1, tie ½, loss 0), never two win rates
// measured apart.

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

export interface AdoptionRule {
  /** 'evidence' (default) or 'any-gain' (the rule before 2026-11-11, kept to reproduce old runs) */
  kind: AdoptionKind;
  /** adopt only when the corrected lower bound of the held-out paired gain is above this (percentage points) */
  minGainPp: number;
  /** the same bar for whole-package moves (default: the same as for card swaps) */
  packageMinGainPp: number;
  /** two-sided error rate shared by every look and every nominee of one decision (Bonferroni split) */
  alpha: number;
  /** confirmation runs in equal stages of the builder's first confirmation size, at most this many (cap = capStages × first stage) */
  capStages: number;
  /** no adoption on fewer held-out paired games than this */
  minGames: number;
}

/**
 * The deck builders' adoption rule (owner-delegated decision of 2026-11-11, ROADMAP §7; overridable by flags):
 * - screening (cheap, noisy, on shared seeds) only nominates; it never adopts;
 * - each nominee is confirmed on fresh seeds the screening never used, paired against the current list, in stages of the
 *   builder's confirmation size, while the interval still straddles the bar, up to 4 stages;
 * - the staged looks and the nominees share α = 0.05 by a Bonferroni split: every look uses z = Φ⁻¹(1 − α / (2 · looks ·
 *   nominees)), 2.50 for one nominee and 4 looks, so the chance of adopting a change that is not worth the minimum gain
 *   is at most α / 2 = 2.5% per decision, however the stages fall;
 * - adopt when the corrected lower bound is above 1 point (the tuners' DEFAULT_MIN_GAIN_PP) with at least 200 games;
 *   reject when the corrected upper bound is below 1 point; otherwise "could not tell" at the cap, which is not adopted.
 */
export const ADOPTION_DEFAULTS: Readonly<AdoptionRule> = Object.freeze({
  kind: 'evidence',
  minGainPp: DEFAULT_MIN_GAIN_PP,
  packageMinGainPp: DEFAULT_MIN_GAIN_PP,
  alpha: 0.05,
  capStages: 4,
  minGames: 200,
});

/** The rule before 2026-11-11: one confirmation stage, adopt when the candidate scored more than the list at all. */
export const ANY_GAIN_RULE: Readonly<AdoptionRule> = Object.freeze({ kind: 'any-gain', minGainPp: 0, packageMinGainPp: 0, alpha: 0.05, capStages: 1, minGames: 0 });

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
  if (!Number.isInteger(r.capStages) || r.capStages < 1 || r.capStages > 16) out.push(`the confirmation cap must be 1 to 16 stages (got ${r.capStages})`);
  if (!(r.minGames >= 0)) out.push(`the minimum games must be 0 or more (got ${r.minGames})`);
  if (!(r.minGainPp >= 0 && r.minGainPp < 100)) out.push(`the minimum gain must be 0 to 100 points (got ${r.minGainPp})`);
  if (!(r.packageMinGainPp >= 0 && r.packageMinGainPp < 100)) out.push(`the package minimum gain must be 0 to 100 points (got ${r.packageMinGainPp})`);
  return out;
}

/** z for every look of a decision with `nominees` nominees: the Bonferroni split of α over looks × nominees. */
export function lookZ(rule: Pick<AdoptionRule, 'alpha' | 'capStages'>, nominees = 1): number {
  return normalQuantile(1 - rule.alpha / (2 * rule.capStages * Math.max(1, nominees)));
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
  /** stopped before it was decided (Deck Lab's Stop); never adopted */
  stopped?: boolean;
}

/**
 * Confirm nominees on fresh, paired, staged games under `rule`. Each nominee stops when it is decided; the current list
 * plays each stage once and every nominee still in the race is compared with the same games. Stage k plays seed offsets
 * [k·firstStage, (k+1)·firstStage), so the first stage is the builders' old confirmation and the stages never overlap.
 * Under 'any-gain' there is one stage and a nominee is adopted when its mean difference is above zero (the old rule).
 */
export async function confirmStaged(
  rule: AdoptionRule,
  nominees: readonly { minGainPp: number }[],
  firstStage: number,
  playStage: PlayStage,
  stop: () => boolean = () => false,
): Promise<{ results: Confirmation[]; games: number }> {
  const n = nominees.length;
  const scores: number[][] = nominees.map(() => []);
  /** for each nominee, the base scores of the stages it played */
  const baseFor: number[][] = nominees.map(() => []);
  const done: (Confirmation | null)[] = nominees.map(() => null);
  const legacy = rule.kind === 'any-gain';
  const stages = legacy ? 1 : rule.capStages;
  const z = legacy ? 1.96 : lookZ(rule, n);
  let games = 0;
  const conclude = (i: number, outcome: Outcome, looks: number, stopped = false): Confirmation => {
    const iv = pairedInterval(scores[i] ?? [], baseFor[i] ?? [], z);
    return { outcome, heldOut: iv, baseWr: mean(baseFor[i] ?? []), candWr: mean(scores[i] ?? []), looks, minGainPp: nominees[i]?.minGainPp ?? 0, ...(stopped ? { stopped } : {}) };
  };
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
      if (legacy) {
        const m = mean(scores[i] ?? []) - mean(baseFor[i] ?? []);
        done[i] = conclude(i, m > 0 ? 'adopt' : 'reject', 1);
        continue;
      }
      const iv = pairedInterval(scores[i] ?? [], baseFor[i] ?? [], z);
      const v = judgeLook(iv, { minGainPp: nominees[i]?.minGainPp ?? rule.minGainPp, minGames: rule.minGames, last: stage === stages - 1 });
      if (v !== 'continue') done[i] = conclude(i, v, stage + 1);
    }
  }
  return { results: done.map((d, i) => d ?? conclude(i, 'inconclusive', 0, true)), games };
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

/** "+4.8 pts [+0.2, +9.4], 560 games" — a paired gain with its interval and games. */
export function formatGain(iv: Pick<PairedInterval, 'mean' | 'lower' | 'upper' | 'games'>): string {
  return `${pts(iv.mean)} pts [${pts(iv.lower)}, ${pts(iv.upper)}], ${iv.games} games`;
}

/** One line for reports: what the rule is, with its numbers. */
export function describeRule(rule: AdoptionRule, o: { firstStage?: number; nominees?: number } = {}): string {
  if (rule.kind === 'any-gain') return `any-gain (legacy): one confirmation${o.firstStage ? ` of ${o.firstStage} fresh games` : ''}; a change is adopted when it scores higher at all`;
  const z = lookZ(rule, o.nominees ?? 1);
  const stages = o.firstStage ? `stages of ${o.firstStage} fresh paired games up to ${rule.capStages * o.firstStage}` : `up to ${rule.capStages} stages of fresh paired games`;
  const pkg = rule.packageMinGainPp !== rule.minGainPp ? ` (package moves ${rule.packageMinGainPp} points)` : '';
  return `evidence: ${stages}; adopt when the lower bound of the paired gain is above ${rule.minGainPp} point${rule.minGainPp === 1 ? '' : 's'}${pkg} with at least ${rule.minGames} games, reject when the upper bound is below it, otherwise could not tell; α = ${rule.alpha} split over ${rule.capStages} looks${(o.nominees ?? 1) > 1 ? ` × ${o.nominees} nominees` : ''} (Bonferroni, z = ${z.toFixed(2)})`;
}

/** What a run manifest records about the rule (optional `adoption` field; schema stays 1). */
export interface AdoptionProvenance {
  rule: AdoptionKind;
  minGainPp: number;
  packageMinGainPp: number;
  alpha: number;
  /** how the staged looks and nominees share α */
  correction: 'bonferroni' | 'none';
  capStages: number;
  minGames: number;
  /** games in the first confirmation stage */
  firstStage: number;
  /** nominees confirmed per decision, at most */
  nominees: number;
  /** search depth */
  cardsPerChange: number;
  packagesPerChange: number;
}

export function adoptionProvenance(rule: AdoptionRule, o: { firstStage: number; nominees: number; cardsPerChange: number; packagesPerChange: number }): AdoptionProvenance {
  return {
    rule: rule.kind,
    minGainPp: rule.minGainPp,
    packageMinGainPp: rule.packageMinGainPp,
    alpha: rule.alpha,
    correction: rule.kind === 'evidence' ? 'bonferroni' : 'none',
    capStages: rule.capStages,
    minGames: rule.minGames,
    ...o,
  };
}

/** A nominee as reports and run files record it: its screening result, and its held-out confirmation if it got one. */
export interface NomineeRecord {
  label: string;
  /** package move kind, or 'combo' parts for combined changes */
  package?: string;
  /** screening: the shared-seed paired gain, plain 95% interval (it only nominates) */
  screen: { games: number; mean: number; lower: number; upper: number };
  heldOut?: { games: number; mean: number; lower: number; upper: number; z: number; looks: number; baseWr: number; candWr: number };
  outcome?: Outcome;
  /** the confirmation was cut short by Stop */
  stopped?: boolean;
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
export function nomineeRecord(label: string, screen: PairedInterval, c?: Confirmation, pkg?: string): NomineeRecord {
  return {
    label,
    ...(pkg ? { package: pkg } : {}),
    screen: { games: screen.games, mean: r4(screen.mean), lower: r4(screen.lower), upper: r4(screen.upper) },
    ...(c
      ? {
          heldOut: { games: c.heldOut.games, mean: r4(c.heldOut.mean), lower: r4(c.heldOut.lower), upper: r4(c.heldOut.upper), z: r4(c.heldOut.z), looks: c.looks, baseWr: r4(c.baseWr), candWr: r4(c.candWr) },
          outcome: c.outcome,
          ...(c.stopped ? { stopped: true } : {}),
        }
      : {}),
  };
}
