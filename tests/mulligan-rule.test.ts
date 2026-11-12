// BOT-6 (HeuristicOptions.mulligan, src/ai/mulligan.ts), 'rule' by default (docs/IMPROVEMENT_BACKLOG.md WP-D1).
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { handFeatures, plainRuleMulligan } from '../src/ai/mulligan';
import type { PlayerId } from '../src/engine/types';
import { setup, spawn } from './engine-helpers';

describe('BOT-6: mulligan rule option', () => {
  it("defaults to 'rule'", () => {
    expect(new HeuristicAgent().opts.mulligan).toBe('rule');
  });

  it('the plain rule is the rule of a bot without card impact; both options agree without impact', () => {
    const ids = ['psycho_squad', 'safety_override', 'animals_wrecker', 'meredith_stout_stone_cold_corpo', 'adam_smasher_metal_over_meat'];
    for (let k = 0; k < 40; k++) {
      const { g } = setup([null, null], k + 1);
      const p: PlayerId = 0;
      for (let i = 0; i < 6; i++) spawn(g, p, ids[(k * 7 + i * (k % 4 + 1)) % ids.length], 'hand');
      const plain = plainRuleMulligan(g, p);
      expect(new HeuristicAgent().wantsMulligan(g, p)).toBe(plain);
      expect(new HeuristicAgent({ mulligan: 'plain' }).wantsMulligan(g, p)).toBe(plain);
      expect(new HeuristicAgent({ mulligan: 'plain', impact: 40 }).wantsMulligan(g, p)).toBe(plain);
      const f = handFeatures(g, p);
      expect(plain).toBe(!(f.cheapUnits >= 1 && f.cheap >= 3 && f.sellable >= 1));
    }
  });
});
