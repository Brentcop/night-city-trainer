// BOT-5 (turnPlan: planning across the actions of a turn, src/ai/turnPlan.ts), off by default
// (docs/BOT_TOOLKIT.md §5, docs/IMPROVEMENT_BACKLOG.md WP-D1).
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { planTurn, positionKey } from '../src/ai/turnPlan';
import { evaluate } from '../src/ai/eval';
import type { Game } from '../src/engine/engine';
import type { Action } from '../src/engine/types';
import { eddies, setup, spawn } from './engine-helpers';

/**
 * Seat 0 has a ready 6-power Unit, 3 Eddies and Safety Override ("the next time a friendly Unit loses a fight this turn,
 * defeat the opposing rival Unit") in hand; the rival has a spent 10-power Unit and nothing else. Alone, Safety Override
 * is a card and two Eddies for nothing visible, and attacking the 10-power Unit loses ours: both score below passing.
 * Together they trade our 6-power Unit for the rival's 10-power one.
 */
function trickState() {
  const { g } = setup();
  eddies(g, 0, 3);
  const mine = spawn(g, 0, 'psycho_squad', 'field');
  const trick = spawn(g, 0, 'safety_override', 'hand');
  const big = spawn(g, 1, 'animals_wrecker', 'field', { spent: true });
  g.s.once['sell:0'] = g.s.turn; // already sold and called this turn
  g.s.once['call:0'] = g.s.turn;
  return { g, mine, trick, big };
}

const pick = async (g: Game, bot: HeuristicAgent) => {
  g.agents[0] = bot;
  return g.chooseAction(0, g.legalActions(0));
};

describe('BOT-5: turnPlan', () => {
  it('off by default', () => {
    expect(new HeuristicAgent().opts.turnPlan).toBe(0);
  });

  it('finds a two-step line whose first step alone scores below passing; the 1-ply bot does not', async () => {
    const { g, mine, trick, big } = trickState();
    const oneply = new HeuristicAgent({ seed: 3 });
    // the first step alone is worse than passing at 1-ply, and so is the attack alone
    const base = evaluate(g, 0);
    const playTrick: Action = { type: 'play', uid: trick.uid };
    const attack = g.legalActions(0).find((a) => a.type === 'attack' && a.targetUnit === big.uid)!;
    expect(attack).toBeTruthy();
    expect(await oneply.simulate(g, 0, playTrick)).toBeLessThan(base);
    expect(await oneply.simulate(g, 0, attack)).toBeLessThan(base);
    const a1 = await pick(g, oneply);
    expect(a1.type).toBe('pass');

    const planner = new HeuristicAgent({ seed: 3, turnPlan: 3 });
    const a2 = await pick(g, planner);
    expect(a2).toEqual(playTrick);
    expect(planner.lastPlan!.line.length).toBeGreaterThanOrEqual(2);
    expect(planner.lastPlan!.line[1]).toContain('Attack with');
    // the real game is untouched by the search
    expect(g.P(0).hand).toContain(trick.uid);
    expect(g.P(0).field).toContain(mine.uid);
    expect(g.P(1).field).toContain(big.uid);
  });

  it('respects the node budget and merges positions reached in another order', async () => {
    const { g } = setup();
    eddies(g, 0, 8);
    for (const id of ['psycho_squad', 'psycho_squad', 'meredith_stout_stone_cold_corpo']) spawn(g, 0, id, 'hand');
    const bot = new HeuristicAgent({ seed: 1 });
    const cands = g.legalActions(0).filter((a) => a.type === 'play');
    const hooks = {
      root: () => g.clone([new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })]),
      child: (cg: Game) => cg.clone([new HeuristicAgent({ lookahead: false }), new HeuristicAgent({ lookahead: false })]),
      value: (cg: Game) => evaluate(cg, 0),
      expand: (cg: Game) => cg.legalActions(0).filter((a) => a.type === 'play'),
    };
    for (const nodes of [1, 4, 7, 50]) {
      const r = await planTurn(0, cands, hooks, { depth: 3, nodes, beam: 3 });
      expect(r.nodes).toBeLessThanOrEqual(Math.max(nodes, cands.length));
    }
    const r = await planTurn(0, cands, hooks, { depth: 3, nodes: 1000, beam: 10 });
    // 3 cards (2 alike) played in any order: playing both Psycho Squads in either order reaches one position
    expect(r.merged).toBeGreaterThan(0);
    expect(r.depth).toBe(3);
    expect(bot.opts.turnPlanNodes).toBe(120);
  });

  it('positionKey ignores the order things happened in, not what is on the board', () => {
    const { g, mine } = trickState();
    const k = positionKey(g);
    mine.spent = true;
    expect(positionKey(g)).not.toBe(k);
    mine.spent = false;
    g.s.nextUid += 5;
    g.s.rng += 1;
    expect(positionKey(g)).toBe(k);
  });
});
