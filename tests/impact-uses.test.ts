// INFO-3: each use of card impact can be switched on its own (HeuristicOptions.impactSell / impactCards; the mulligan
// use is `mulligan: 'plain'`). The defaults follow `impact`, so every existing bot is unchanged.
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { makeTierBot, tierLabel, TIERS } from '../src/ai/tiers';
import { ledgerBot } from '../src/lib/changeLedger';
import { fromSpec, HARD_MAIN_SPEC, HARD_SPEC, TIER_SPECS, VARIANT_SPECS } from '../scripts/agent-spec';

describe('card impact uses', () => {
  it('default to the impact weight', () => {
    expect(new HeuristicAgent().opts).toMatchObject({ impact: 0, impactSell: 0, impactCards: 0 });
    // Hard reads no card impact and uses the plain mulligan since SIM_VERSION 6; the coach still uses impact 40
    expect(makeTierBot('hard', 1).opts).toMatchObject({ impact: 0, impactSell: 0, impactCards: 0, mulligan: 'plain' });
    // Hard picks the card it sells by rollout among its 3 most sellable since SIM_VERSION 7; Medium and Easy do not
    expect(makeTierBot('hard', 1).opts.sellLookahead).toBe(3);
    expect(makeTierBot('medium', 1).opts.sellLookahead).toBe(0);
    expect(makeTierBot('easy', 1).opts.sellLookahead).toBe(0);
    expect(fromSpec(HARD_SPEC, 1).opts).toMatchObject({ sellLookahead: 3, mulligan: 'plain', deep: 3, deepReactions: 3, impact: 0 });
    expect(makeTierBot('hard-v1', 1).opts).toMatchObject({ impact: 40, impactSell: 40, impactCards: 40, mulligan: 'rule' });
    expect(fromSpec({ impact: 40 }, 1).opts).toMatchObject({ impactSell: 40, impactCards: 40 });
  });
  it("a tier's spec builds exactly the tier's bot (one source: TIER_SETTINGS)", () => {
    for (const t of ['easy', 'medium', 'hard'] as const) {
      const { name: _a, seed: _b, ...spec } = fromSpec(TIER_SPECS[t], 1).opts;
      const { name: _c, seed: _d, ...tier } = makeTierBot(t, 1).opts;
      expect(spec, t).toEqual(tier);
    }
    expect(HARD_SPEC).toBe(TIER_SPECS.hard);
  });
  it('"Hard (main-phase rollouts only)" is Hard less its reaction rollouts and sell lookahead, and not a tier', () => {
    const { name: _a, seed: _b, ...spec } = fromSpec(HARD_MAIN_SPEC, 1).opts;
    const { name: _c, seed: _d, ...bot } = makeTierBot('hard-main', 1).opts;
    expect(spec).toEqual(bot);
    const { name: _e, seed: _f, ...hard } = makeTierBot('hard', 1).opts;
    expect(bot).toEqual({ ...hard, deepReactions: 0, sellLookahead: 0 });
    expect(bot).toMatchObject({ deep: 3, deepAttacks: 0, mulligan: 'plain', impact: 0, noise: 0.15 });
    expect(HARD_MAIN_SPEC).toBe(VARIANT_SPECS['hard-main']);
    // Hard itself is untouched, and the variant is never offered as a tier
    expect(TIER_SPECS.hard).toMatchObject({ deepReactions: 3, sellLookahead: 3 });
    expect(Object.keys(TIER_SPECS)).toEqual(['easy', 'medium', 'hard']);
    expect(TIERS).not.toHaveProperty('hard-main');
    expect(tierLabel('hard-main')).toBe('Hard (main-phase rollouts only)');
    expect(makeTierBot('hard-main', 1).tier).toBe('hard-main');
    expect(ledgerBot('hard-main')).toEqual({ bot: 'hard-main' });
  });
  it('can be set one by one', () => {
    expect(new HeuristicAgent({ impact: 40, impactSell: 0 }).opts).toMatchObject({ impact: 40, impactSell: 0, impactCards: 40 });
    expect(fromSpec({ impact: 40, impactCards: 0 }, 1).opts).toMatchObject({ impact: 40, impactSell: 40, impactCards: 0 });
  });
});
