// Named weight sets for the evaluation (src/ai/eval.ts), kept for comparisons: a set is merged over DEFAULT_WEIGHTS when a
// bot config names it (scripts/agent-spec.ts: `"weightSet": "<name>"`, or `"weights": "<name>"`). Since SIM_VERSION 6
// DEFAULT_WEIGHTS is `calibrated-2026-11` + rivalLethal 400, so every tier that reads the evaluation uses it; the
// weights before that are `hand-2026-10`. Changing the defaults changes results (a SIM_VERSION bump and re-recorded
// events); see docs/BOT_TOOLKIT.md §3.
import type { EvalWeights } from './eval';

/** The hand-tuned DEFAULT_WEIGHTS used until SIM_VERSION 5 (self-play tuning, last changed 2026-11-10), every key. */
export const HAND_2026_10: EvalWeights = {
  gig: 20,
  gigNear: 45,
  unitPower: 1.2,
  unitCost: 1.2,
  hand: 3.6,
  eddie: 2.6,
  faceUpLegend: 4.8,
  plan: 1.5,
  spentRisk: 0.087,
  unitBase: 2,
  blocker: 2,
  unitGear: 1.5,
  stealsTwo: 6,
  goSolo: 2,
  legendGear: 2,
  lowDeck: 8,
  lowDeckAt: 4,
  handCap: 10,
  eddieCap: 10,
  win: 10000,
  playOutClamp: 600,
  pkgHold: 0,
  pkgAssembly: 0,
  pkgSteer: 0,
  pkgProtect: 0,
  exposed: 0,
  threat: 0,
  rivalLethal: 0,
  readyTrick: 0,
  readyCall: 0,
  spentRiskMainOnly: 0,
  subChoiceEval: 0,
};

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

/**
 * refit-v12b (REVIEW_2026-11-24 C.3; reports/eval-refit-2026-11-25.md): scripts/eval-refit.ts on 4,970 Hard games over
 * the 71 library decks (--decks all --per 1 --seed 80001 --mid 0.25), SIM_VERSION 12, fitted 2026-11-25 with spentRisk
 * measured only in the main phase. Rows mid + next + ender, deck strengths + going first as controls, λ 1e-4 by 5 folds;
 * held-out log-loss (with the deck controls) 0.5066 for the fitted candidate against the current weights' 0.5138 on
 * 1,242 games. Kept at the current value: unitCost, unitGear, legendGear, lowDeck (not identified); goSolo, rivalLethal
 * (by argument); and plan, by argument (declared before any fresh game): it correlates 0.72 / 0.67 with the gig /
 * gigNear features, so its fitted −2.18 is a trade between overlapping terms, and its job is to steer Gig choices toward
 * the list's payoffs, which a negative value would invert (against SIM_VERSION 10's Street Cred parity fix). This
 * variant's comparison on the fit's held-out games is information only (−0.0045 [−0.0096, +0.0005]). Not the default.
 */
export const REFIT_V12B: Partial<EvalWeights> = {
  spentRiskMainOnly: 1,
  subChoiceEval: 1,
  gig: 20,
  gigNear: 67.9,
  unitPower: 13.5,
  unitCost: -4.81,
  unitBase: 23.7,
  blocker: -16.7,
  unitGear: 1.5,
  stealsTwo: 34,
  goSolo: 0,
  spentRisk: 0.198,
  hand: 35.2,
  eddie: 10.4,
  faceUpLegend: 5.44,
  legendGear: 2,
  lowDeck: 8,
  plan: 0.915,
  exposed: 0.372,
  threat: 1.15,
  rivalLethal: 400,
  readyTrick: 2.65,
};

/**
 * hb-v12 (REVIEW_2026-11-24 C.3, the coordinator's candidate of 2026-11-25, declared before any of its games;
 * reports/eval-refit-2026-11-25.md): SIM_VERSION 12's DEFAULT_WEIGHTS with only the two terms both refits agree on
 * (hand 35.2 / 30.7, blocker −16.7 / −23.3 on seeds 80001 and 90001), rounded toward the current weights; every other
 * weight and both switches as the default. Not the default.
 */
export const HB_V12: Partial<EvalWeights> = { hand: 30, blocker: -20 };

export const WEIGHT_SETS: Record<string, Partial<EvalWeights>> = {
  'hand-2026-10': HAND_2026_10,
  'next-turn': NEXT_TURN_SET,
  'calibrated-2026-11': CALIBRATED_2026_11,
  'calibrated-decks-2026-11': CALIBRATED_DECKS_2026_11,
  'refit-v12b': REFIT_V12B,
  'hb-v12': HB_V12,
};

/** DEFAULT_WEIGHTS-relative overrides of a named set; throws on an unknown name. */
export function weightSet(name: string): Partial<EvalWeights> {
  const s = WEIGHT_SETS[name];
  if (!s) throw new Error(`unknown weight set "${name}" (known: ${Object.keys(WEIGHT_SETS).join(', ')})`);
  return s;
}
