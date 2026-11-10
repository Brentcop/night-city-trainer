import { describe, expect, it } from 'vitest';
import { makeTierBot, tierLabel, tierOf } from '../src/ai/tiers';

describe('bot tiers', () => {
  it('maps older names to tiers', () => {
    expect(tierOf('fast')).toBe('easy');
    expect(tierOf('lookahead')).toBe('medium');
    expect(tierOf('deep')).toBe('hard');
    expect(tierLabel('deep')).toBe('Hard');
    expect(tierLabel('mixed')).toBe('Hard + Medium');
  });
  it('mixed picks the same bot for the same seat seed, and uses both tiers', () => {
    const names = new Set<string>();
    for (let s = 1; s < 60; s++) {
      expect(makeTierBot('mixed', s).name).toBe(makeTierBot('mixed', s).name);
      names.add(makeTierBot('mixed', s).name);
    }
    expect(names.size).toBe(2);
  });
});
