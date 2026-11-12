import { describe, expect, it } from 'vitest';
import { checkValues, percentiles } from '../src/analysis/cardValueCheck';

const card = (id: string, value: number, measured: number) => ({ id, name: id, value, measured, n: 50 });

describe('card value check (INFO-7)', () => {
  it('percentile ranks share ties', () => {
    expect(percentiles([3, 1, 2])).toEqual([1, 0, 0.5]);
    expect(percentiles([1, 1, 2])).toEqual([0.25, 0.25, 1]);
  });

  it('agreeing orders give rho 1 and no disagreement', () => {
    const c = checkValues([card('a', 1, 0.01), card('b', 2, 0.02), card('c', 3, 0.05)]);
    expect(c.rho).toBeCloseTo(1, 10);
    expect(c.overrated).toEqual([]);
    expect(c.underrated).toEqual([]);
  });

  it('lists the card the formula rates highest but the games rate lowest, and the reverse', () => {
    const c = checkValues([card('star', 10, -0.05), card('mid', 5, 0.0), card('low', 1, 0.06), card('x', 4, 0.01)], 1);
    expect(c.overrated[0]!.id).toBe('star');
    expect(c.underrated[0]!.id).toBe('low');
    expect(c.rho).toBeLessThan(0);
  });

  it('skips cards without a number', () => {
    expect(checkValues([card('a', 1, NaN), card('b', 2, 0.1)]).cards).toBe(1);
  });
});
