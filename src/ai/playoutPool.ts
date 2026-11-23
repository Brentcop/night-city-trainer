// Parallel playout pool: distributes rollout tasks across 2-4 Web Workers so the coach's
// deep play-outs run in parallel (Gain 9). The Node path never creates one (sequential as before).
import type { Action, GameState, PlayerId, Reaction } from '../engine/types';
import type { EvalWeights } from './eval';
import type { World } from './playOut';
import type { Profiles } from './archetype';

export interface MainTask {
  kind: 'main';
  action: Action | null;
  world: World;
  noSellTurn?: number;
}

export interface ReactionTask {
  kind: 'reaction';
  reaction: Reaction;
  attacker: number;
  world: World;
}

export type RolloutTask = MainTask | ReactionTask;

export interface PlayoutConfig {
  rawWeights: EvalWeights;
  profiles: Profiles | null;
  evalWeights: EvalWeights;
  rolloutWins: boolean;
}

export interface PlayoutBatch {
  id: number;
  state: GameState;
  pending: { player: PlayerId; label: string }[];
  player: PlayerId;
  tasks: RolloutTask[];
  config: PlayoutConfig;
}

export interface PlayoutResult {
  id: number;
  values: number[];
}

export interface RolloutPool {
  runBatch(
    state: GameState,
    pending: { player: PlayerId; label: string }[],
    player: PlayerId,
    tasks: RolloutTask[],
    config: PlayoutConfig,
  ): Promise<number[]>;
  dispose(): void;
}
