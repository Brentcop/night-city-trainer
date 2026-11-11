import { describe, expect, it } from 'vitest';
import { summarizePaired } from '../scripts/tuning';

describe('paired tuning summaries', () => {
  it('reports the mean paired change and its confidence interval', () => {
    const result = summarizePaired([1, 0.5, 1, 0], [0.5, 0.5, 0, 0]);
    expect(result.games).toBe(4);
    expect(result.mean).toBe(0.375);
    expect(result.lower95).toBeCloseTo(-0.094, 2);
    expect(result.upper95).toBeCloseTo(0.844, 2);
  });

  it('rejects samples that cannot be paired', () => {
    expect(() => summarizePaired([], [])).toThrow('same non-zero length');
    expect(() => summarizePaired([1], [1, 0])).toThrow('same non-zero length');
  });

  it('rejects a single pair, whose confidence interval would have zero width', () => {
    expect(() => summarizePaired([1], [0])).toThrow('at least 2 pairs');
  });
});
