// INFO-3: each use of card impact can be switched on its own (HeuristicOptions.impactSell / impactCards; the mulligan
// use is `mulligan: 'plain'`). The defaults follow `impact`, so every existing bot is unchanged.
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { makeTierBot } from '../src/ai/tiers';
import { fromSpec } from '../scripts/agent-spec';

describe('card impact uses', () => {
  it('default to the impact weight', () => {
    expect(new HeuristicAgent().opts).toMatchObject({ impact: 0, impactSell: 0, impactCards: 0 });
    // Hard reads no card impact and uses the plain mulligan since SIM_VERSION 6; the coach still uses impact 40
    expect(makeTierBot('hard', 1).opts).toMatchObject({ impact: 0, impactSell: 0, impactCards: 0, mulligan: 'plain' });
    expect(makeTierBot('hard-v1', 1).opts).toMatchObject({ impact: 40, impactSell: 40, impactCards: 40, mulligan: 'rule' });
    expect(fromSpec({ impact: 40 }, 1).opts).toMatchObject({ impactSell: 40, impactCards: 40 });
  });
  it('can be set one by one', () => {
    expect(new HeuristicAgent({ impact: 40, impactSell: 0 }).opts).toMatchObject({ impact: 40, impactSell: 0, impactCards: 40 });
    expect(fromSpec({ impact: 40, impactCards: 0 }, 1).opts).toMatchObject({ impact: 40, impactSell: 40, impactCards: 0 });
  });
});
