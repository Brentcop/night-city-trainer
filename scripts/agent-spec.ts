// A bot configuration as plain data (botcheck, package-scoring, the benchmark): HeuristicOptions without functions, so it
// can cross to a worker thread. Shared by scripts/worker.ts and scripts/benchmark-worker.ts.
import { HeuristicAgent } from '../src/ai/heuristic';
import { DEFAULT_WEIGHTS, type EvalWeights } from '../src/ai/eval';
import { weightSet } from '../src/ai/weightSets';
import { BEST_PROFILES, DEFAULT_PROFILES } from '../src/ai/archetype';
import type { MulliganRule } from '../src/ai/mulligan';
import { TIER_SETTINGS, type Tier } from '../src/ai/tiers';

export interface AgentSpec {
  lookahead?: boolean;
  /** evaluation weights over DEFAULT_WEIGHTS (after `weightSet`), or the name of a set in src/ai/weightSets.ts */
  weights?: Record<string, number> | string;
  /** a named weight set (src/ai/weightSets.ts) merged over DEFAULT_WEIGHTS; `weights` then overrides single values */
  weightSet?: string;
  noise?: number;
  deep?: number;
  impact?: number;
  /** INFO-3 (HeuristicOptions.impactSell / impactCards): the impact weight in the sell ranking / card choices only; default `impact` */
  impactSell?: number;
  impactCards?: number;
  deepAttacks?: number;
  sellLookahead?: number;
  deepReactions?: number;
  /** BOT-1 (HeuristicOptions.rolloutWins): play-outs score the next start-of-turn win; main-phase rollouts clamped */
  rolloutWins?: boolean;
  /** BOT-2 (HeuristicOptions.deepWorlds): main-phase rollouts averaged over N shared worlds */
  deepWorlds?: number;
  /** BOT-4 (HeuristicOptions.sellSearch): "don't sell" and the two most sellable cards compared by the deep rollout */
  sellSearch?: boolean;
  /** HeuristicOptions.sellEddieByStage (sellSearch only): the sold Eddie's value early / mid / late, in evaluation points */
  sellEddieByStage?: [number, number, number];
  /** BOT-5 (HeuristicOptions.turnPlan / turnPlanNodes / turnPlanBeam): candidates valued by the best line of the turn */
  turnPlan?: number;
  turnPlanNodes?: number;
  turnPlanBeam?: number;
  /** BOT-6 (HeuristicOptions.mulligan): which opening-hand rule */
  mulligan?: MulliganRule;
  /** BOT-F (HeuristicOptions.easyGuard): the fast main phase skips Programs that would do nothing (Easy) */
  easyGuard?: boolean;
  /** 'default' = DEFAULT_PROFILES, 'best' = BEST_PROFILES (tuned), or an explicit profile table */
  profiles?: 'default' | 'best' | Record<string, Record<string, number>>;
}
/** Each tier's settings as a spec: TIER_SETTINGS (src/ai/tiers.ts), the one source makeTierBot builds from too. */
export const TIER_SPECS: Readonly<Record<Tier, AgentSpec>> = TIER_SETTINGS;
/** Hard's settings as a spec (deep 3, reaction rollouts 3, sell lookahead 3, the plain mulligan, the tuned profiles, no card impact). */
export const HARD_SPEC: AgentSpec = TIER_SPECS.hard;

/** The weights a spec names (undefined = the bot's default, DEFAULT_WEIGHTS). */
export function specWeights(spec: AgentSpec): EvalWeights | undefined {
  const named = typeof spec.weights === 'string' ? spec.weights : spec.weightSet;
  const over = typeof spec.weights === 'object' ? spec.weights : undefined;
  if (!named && !over) return undefined;
  return { ...DEFAULT_WEIGHTS, ...(named ? weightSet(named) : {}), ...(over ?? {}) } as EvalWeights;
}

export function fromSpec(spec: AgentSpec, seed: number): HeuristicAgent {
  return new HeuristicAgent({ lookahead: spec.lookahead ?? true, weights: specWeights(spec), noise: spec.noise ?? 0.15, seed, deep: spec.deep ?? 0, impact: spec.impact ?? 0, impactSell: spec.impactSell, impactCards: spec.impactCards, deepAttacks: spec.deepAttacks ?? 0, sellLookahead: spec.sellLookahead ?? 0, deepReactions: spec.deepReactions ?? 0, rolloutWins: spec.rolloutWins ?? false, deepWorlds: spec.deepWorlds ?? 0, sellSearch: spec.sellSearch ?? false, sellEddieByStage: spec.sellEddieByStage ?? null, turnPlan: spec.turnPlan ?? 0, turnPlanNodes: spec.turnPlanNodes, turnPlanBeam: spec.turnPlanBeam, mulligan: spec.mulligan, easyGuard: spec.easyGuard, profiles: spec.profiles === 'default' ? DEFAULT_PROFILES : spec.profiles === 'best' ? BEST_PROFILES : (spec.profiles as any) ?? null });
}

