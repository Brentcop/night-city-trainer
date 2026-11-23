// Web Worker: runs batched rollout tasks for the coach's parallel play-outs (Gain 9).
// Each message is a PlayoutBatch; each reply is a PlayoutResult with one value per task.
import { Game } from '../engine/engine';
import { HeuristicAgent, hideInfo } from '../ai/heuristic';
import { playOut, playOutValue } from '../ai/playOut';
import { withoutPackages } from '../ai/eval';
import type { Agent, PlayerId } from '../engine/types';
import type { PlayoutBatch, PlayoutResult, PlayoutConfig } from '../ai/playoutPool';
import type { World } from '../ai/playOut';
import type { EvalWeights } from '../ai/eval';
import type { Profiles } from '../ai/archetype';

const noAgent: Agent = { name: 'none', decide: async () => [0] };

function makeCloneAgent(seat: PlayerId, viewer: PlayerId, world: World, rawWeights: EvalWeights, profiles: Profiles | null, noSellTurn?: number): Agent {
  const own = rawWeights;
  const rival = withoutPackages(own);
  const weights = seat === viewer ? own : rival;
  return new HeuristicAgent({
    lookahead: true,
    deep: 0,
    maxCandidates: 14,
    quiet: true,
    weights,
    profiles,
    seed: seat === 0 ? world.a : world.b,
    noSellTurn,
  });
}

function cloneAgents(viewer: PlayerId, world: World, config: PlayoutConfig, noSellTurn?: number): [Agent, Agent] {
  return [
    makeCloneAgent(0, viewer, world, config.rawWeights, config.profiles, viewer === 0 ? noSellTurn : undefined),
    makeCloneAgent(1, viewer, world, config.rawWeights, config.profiles, viewer === 1 ? noSellTurn : undefined),
  ];
}

self.onmessage = async (e: MessageEvent<PlayoutBatch>) => {
  const { id, state, pending, player, tasks, config } = e.data;
  const base = new Game(state, [noAgent, noAgent]);
  base.pending = pending.map((x) => ({ ...x, run: async () => undefined }));

  const values: number[] = [];
  const wins = config.rolloutWins;

  for (const task of tasks) {
    if (task.kind === 'main') {
      const noSell = task.action === null ? base.s.turn : undefined;
      const agents = cloneAgents(player, task.world, config, noSell);
      const cg = base.clone(agents);
      cg.s.rng = task.world.rng;
      hideInfo(cg, player);
      await playOut(cg, player, task.action === null ? { rest: true } : { action: task.action });
      values.push(playOutValue(cg, player, config.evalWeights, { wins, clamp: wins }));
    } else {
      const agents = cloneAgents(player, task.world, config);
      const cg = base.clone(agents);
      cg.s.rng = task.world.rng;
      hideInfo(cg, player);
      await playOut(cg, player, { reaction: task.reaction, attacker: task.attacker });
      values.push(playOutValue(cg, player, config.evalWeights, { wins: wins, clamp: true }));
    }
  }

  (self as unknown as Worker).postMessage({ id, values } satisfies PlayoutResult);
};
