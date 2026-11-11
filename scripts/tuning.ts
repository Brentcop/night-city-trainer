export interface PairedSummary {
  games: number;
  mean: number;
  lower95: number;
  upper95: number;
}

export function summarizePaired(candidate: number[], baseline: number[]): PairedSummary {
  if (candidate.length !== baseline.length || candidate.length === 0) {
    throw new Error(`paired results must have the same non-zero length (got ${candidate.length} and ${baseline.length})`);
  }
  if (candidate.length < 2) throw new Error(`paired results need at least 2 pairs to estimate variance (got ${candidate.length})`);
  const differences = candidate.map((score, i) => score - baseline[i]);
  const mean = differences.reduce((sum, d) => sum + d, 0) / differences.length;
  const variance = differences.reduce((sum, d) => sum + (d - mean) ** 2, 0) / (differences.length - 1);
  const margin = 1.96 * Math.sqrt(variance / differences.length);
  return { games: differences.length, mean, lower95: mean - margin, upper95: mean + margin };
}

// ---------------------------------------------------------------- adoption rules (owner decision, ROADMAP §7)

/**
 * Training search: a candidate is adopted only when the lower bound of its paired 95% interval against the current
 * baseline is above zero (a positive mean alone is not enough). Shared by scripts/tune.ts and scripts/tune-profiles.ts.
 */
export function adoptInTraining(summary: PairedSummary): boolean {
  return summary.lower95 > 0;
}

/** Default minimum practical gain, in percentage points, that the held-out lower bound must exceed before applying. */
export const DEFAULT_MIN_GAIN_PP = 1;

/** Applying: the held-out lower 95% bound must exceed the minimum practical gain (percentage points). */
export function passesHeldOut(summary: PairedSummary, minGainPp: number = DEFAULT_MIN_GAIN_PP): boolean {
  return summary.lower95 > minGainPp / 100;
}

// ---------------------------------------------------------------- seed ranges

/** A half-open range of game seeds [start, end). */
export interface SeedRange {
  start: number;
  end: number;
}

export interface SeedPlanOptions {
  /** the script's --seed; seeds alias modulo `slots` */
  seed: number;
  /** number of distinct --seed slots (400) */
  slots: number;
  trainBase: number;
  trainWindow: number;
  heldOutBase: number;
  heldOutWindow: number;
}

/**
 * Training and held-out seed windows for one --seed. Each --seed gets its own training window and its own held-out
 * window; the training block ([trainBase, trainBase + slots * trainWindow)) must end before the held-out block starts,
 * so training and held-out seeds never meet for any --seed (checked by tests/tuning.test.ts).
 */
export function seedPlan(o: SeedPlanOptions): { train: SeedRange; heldOut: SeedRange } {
  if (o.trainBase + o.slots * o.trainWindow > o.heldOutBase) {
    throw new Error(`training seeds [${o.trainBase}, ${o.trainBase + o.slots * o.trainWindow}) overlap the held-out block starting at ${o.heldOutBase}`);
  }
  const slot = o.seed % o.slots;
  const trainStart = o.trainBase + slot * o.trainWindow;
  const heldStart = o.heldOutBase + slot * o.heldOutWindow;
  return {
    train: { start: trainStart, end: trainStart + o.trainWindow },
    heldOut: { start: heldStart, end: heldStart + o.heldOutWindow },
  };
}

/** scripts/tune.ts: training windows [90_000, 490_000), held-out windows [590_000, 990_000), 1,000 seeds each. */
export const WEIGHT_SEEDS: Omit<SeedPlanOptions, 'seed'> = { slots: 400, trainBase: 90_000, trainWindow: 1_000, heldOutBase: 590_000, heldOutWindow: 1_000 };
/** scripts/tune-profiles.ts: training windows of 2,000 from 5_000, held-out windows of 5,000 from 1_005_000. */
export const PROFILE_SEEDS: Omit<SeedPlanOptions, 'seed'> = { slots: 400, trainBase: 5_000, trainWindow: 2_000, heldOutBase: 1_005_000, heldOutWindow: 5_000 };

/** Throws when a run would need more seeds than its window holds (it would reuse the next --seed's seeds). */
export function assertFitsWindow(what: string, needed: number, window: number, hint: string) {
  if (needed > window) throw new Error(`${what} may need ${needed} seeds but each --seed has a ${window}-seed window; ${hint}`);
}
