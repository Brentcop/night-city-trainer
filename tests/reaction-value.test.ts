// Reactions are valued by playing the attack out (docs/DECISION_TELEMETRY.md, "Findings from the first telemetry run"):
// the lookahead bot resumes the attack in a clone after each candidate reaction, so effects that only act during the
// fight or the steal — a delayed trigger such as Safety Override — count. The static projection it replaced saw only
// the card leaving the hand.
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { eddies, gig, setup, spawn } from './engine-helpers';

/** Player 0 attacks; player 1 (the bot) holds Safety Override and 2 Eddies. */
function scene() {
  const { g } = setup();
  const bot = new HeuristicAgent({ seed: 3 });
  g.agents[1] = bot;
  const att = spawn(g, 0, 'psycho_squad', 'field'); // 6
  g.addMod({ kind: 'power', target: att.uid, amount: 2, until: 'endOfTurn' }); // 8
  const def = spawn(g, 1, 'royce_don_t_call_me_simon', 'field', { spent: true }); // 4: loses the fight
  const so = spawn(g, 1, 'safety_override', 'hand');
  eddies(g, 1, 2);
  return { g, att, def, so };
}

describe('reactions valued by playing the attack out', () => {
  it('Safety Override: played when the attacked Unit would lose its fight, and the attacker is defeated', async () => {
    const { g, att, def, so } = scene();
    await g.attack(0, att.uid, { unit: def.uid, gigs: null });
    await g.resolvePending();
    expect(so.zone).toBe('trash');
    expect(def.zone).toBe('trash');
    expect(att.zone).toBe('trash');
  });

  it('Safety Override: kept when the attack is on the Gig area (no fight, it would do nothing)', async () => {
    const { g, att, so } = scene();
    gig(g, 1, 6, 3);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(so.zone).toBe('hand');
  });

  it('Safety Override: kept when the attacked Unit wins its fight anyway', async () => {
    const { g, so } = scene();
    const small = spawn(g, 0, 'royce_don_t_call_me_simon', 'field'); // 4
    const big = spawn(g, 1, 'psycho_squad', 'field', { spent: true }); // 6
    await g.attack(0, small.uid, { unit: big.uid, gigs: null });
    await g.resolvePending();
    expect(so.zone).toBe('hand');
    expect(small.zone).toBe('trash');
    expect(big.zone).toBe('field');
  });
});
