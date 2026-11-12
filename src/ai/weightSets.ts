// Named alternative weight sets for the evaluation (src/ai/eval.ts), measured but NOT used by any tier: a set is merged
// over DEFAULT_WEIGHTS when a bot config names it (scripts/agent-spec.ts: `"weightSet": "<name>"`, or `"weights": "<name>"`).
// Switching one on for a tier changes results (a SIM_VERSION bump and re-recorded events); see docs/BOT_TOOLKIT.md §3.
import type { EvalWeights } from './eval';

/** BOT-3: the next-turn terms at the setting measured +1.5 points for Hard (docs/IMPROVEMENT_BACKLOG.md WP-D1). */
export const NEXT_TURN_SET: Partial<EvalWeights> = { exposed: 0.5, threat: 0.5, rivalLethal: 400 };

/**
 * INFO-4: a ridge logistic of the game result on evaluate()'s features at the end of every turn of 4,324 Hard games over
 * all 47 library decks (scripts/eval-calibrate.ts --decks all --per 2 --seed 70001), rescaled so gig stays 20. Terms
 * the fit could not identify (unitGear, spentRisk, legendGear, lowDeck, rivalLethal) keep their hand values; exposed is
 * from the ender's view, threat from the next seat's view (each view sees only one of them). An association with who
 * won, not a measured value: see docs/IMPROVEMENT_BACKLOG.md WP-D2 (status 2026-11-12, INFO-4) for how it played.
 */
export const CALIBRATED_2026_11: Partial<EvalWeights> = {
  gigNear: 50.8,
  unitPower: 13.2,
  unitCost: -4.81,
  unitBase: 50.3,
  blocker: -44.1,
  stealsTwo: 42.8,
  goSolo: -50.6,
  hand: 4.54,
  eddie: 26.9,
  faceUpLegend: 8.99,
  plan: 0.915,
  exposed: 0.886,
  threat: 0.971,
};

/**
 * INFO-4, refinement: the same fit on the same leaves with a strength per deck (+1 own list, −1 the rival's) and the
 * first player as controls (`--deck-effects`), so a term is not credited with what the stronger list wins. Unidentified
 * (hand values kept): unitCost, spentRisk, legendGear, lowDeck, rivalLethal. plan's fit is about 0 (±0.4).
 */
export const CALIBRATED_DECKS_2026_11: Partial<EvalWeights> = {
  gigNear: 39.5,
  unitPower: 9.82,
  unitBase: 32.1,
  blocker: -18.9,
  unitGear: 10.5,
  stealsTwo: 21.7,
  goSolo: -52.8,
  hand: 8.26,
  eddie: 49.9,
  faceUpLegend: 16.7,
  plan: -0.0667,
  exposed: 0.704,
  threat: 0.797,
};

export const WEIGHT_SETS: Record<string, Partial<EvalWeights>> = {
  'next-turn': NEXT_TURN_SET,
  'calibrated-2026-11': CALIBRATED_2026_11,
  'calibrated-decks-2026-11': CALIBRATED_DECKS_2026_11,
};

/** DEFAULT_WEIGHTS-relative overrides of a named set; throws on an unknown name. */
export function weightSet(name: string): Partial<EvalWeights> {
  const s = WEIGHT_SETS[name];
  if (!s) throw new Error(`unknown weight set "${name}" (known: ${Object.keys(WEIGHT_SETS).join(', ')})`);
  return s;
}
