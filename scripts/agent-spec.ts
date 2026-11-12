// A bot configuration as plain data (botcheck, package-scoring, the benchmark): HeuristicOptions without functions, so it
// can cross to a worker thread. Shared by scripts/worker.ts and scripts/benchmark-worker.ts.
import { HeuristicAgent } from '../src/ai/heuristic';
import { DEFAULT_WEIGHTS } from '../src/ai/eval';
import { BEST_PROFILES, DEFAULT_PROFILES } from '../src/ai/archetype';
import type { MulliganRule } from '../src/ai/mulligan';

export interface AgentSpec {
  lookahead?: boolean;
  weights?: Record<string, number>;
  noise?: number;
  deep?: number;
  impact?: number;
  deepAttacks?: number;
  sellLookahead?: number;
  deepReactions?: number;
  /** BOT-1 (HeuristicOptions.rolloutWins): play-outs score the next start-of-turn win; main-phase rollouts clamped */
  rolloutWins?: boolean;
  /** BOT-2 (HeuristicOptions.deepWorlds): main-phase rollouts averaged over N shared worlds */
  deepWorlds?: number;
  /** BOT-4 (HeuristicOptions.sellSearch): "don't sell" and the two most sellable cards compared by the deep rollout */
  sellSearch?: boolean;
  /** BOT-5 (HeuristicOptions.turnPlan / turnPlanNodes / turnPlanBeam): candidates valued by the best line of the turn */
  turnPlan?: number;
  turnPlanNodes?: number;
  turnPlanBeam?: number;
  /** BOT-6 (HeuristicOptions.mulligan): which opening-hand rule */
  mulligan?: MulliganRule;
  /** 'default' = DEFAULT_PROFILES, 'best' = BEST_PROFILES (tuned), or an explicit profile table */
  profiles?: 'default' | 'best' | Record<string, Record<string, number>>;
}
export function fromSpec(spec: AgentSpec, seed: number): HeuristicAgent {
  return new HeuristicAgent({ lookahead: spec.lookahead ?? true, weights: spec.weights ? ({ ...DEFAULT_WEIGHTS, ...spec.weights } as any) : undefined, noise: spec.noise ?? 0.15, seed, deep: spec.deep ?? 0, impact: spec.impact ?? 0, deepAttacks: spec.deepAttacks ?? 0, sellLookahead: spec.sellLookahead ?? 0, deepReactions: spec.deepReactions ?? 0, rolloutWins: spec.rolloutWins ?? false, deepWorlds: spec.deepWorlds ?? 0, sellSearch: spec.sellSearch ?? false, turnPlan: spec.turnPlan ?? 0, turnPlanNodes: spec.turnPlanNodes, turnPlanBeam: spec.turnPlanBeam, mulligan: spec.mulligan, profiles: spec.profiles === 'default' ? DEFAULT_PROFILES : spec.profiles === 'best' ? BEST_PROFILES : (spec.profiles as any) ?? null });
}

