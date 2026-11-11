import { describe, expect, it } from 'vitest';
import { adoptInTraining, assertFitsWindow, DEFAULT_MIN_GAIN_PP, passesHeldOut, PROFILE_SEEDS, seedPlan, summarizePaired, WEIGHT_SEEDS, type SeedPlanOptions } from '../scripts/tuning';

const summary = (mean: number, lower95: number) => ({ games: 100, mean, lower95, upper95: 2 * mean - lower95 });

describe('tuner adoption rules', () => {
  it('training adopts a candidate only when the lower bound of its paired 95% interval is above zero', () => {
    expect(adoptInTraining(summary(0.08, 0.01))).toBe(true);
    expect(adoptInTraining(summary(0.08, 0))).toBe(false);
    expect(adoptInTraining(summary(0.06, -0.02))).toBe(false); // a positive mean alone is not enough
    // the paired example below: mean +37.5pp but the interval reaches below zero
    expect(adoptInTraining(summarizePaired([1, 0.5, 1, 0], [0.5, 0.5, 0, 0]))).toBe(false);
    expect(adoptInTraining(summarizePaired([1, 1, 1, 1, 0.5], [0, 0, 0.5, 0, 0]))).toBe(true);
  });

  it('applying needs the held-out lower bound above the minimum practical gain, 1pp by default', () => {
    expect(DEFAULT_MIN_GAIN_PP).toBe(1);
    expect(passesHeldOut(summary(0.03, 0.011))).toBe(true);
    expect(passesHeldOut(summary(0.03, 0.01))).toBe(false); // must exceed, not equal
    expect(passesHeldOut(summary(0.03, 0.005))).toBe(false);
    expect(passesHeldOut(summary(0.03, 0.005), 0)).toBe(true);
    expect(passesHeldOut(summary(0.05, 0.025), 3)).toBe(false);
  });
});

describe('tuner seed ranges', () => {
  const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;
  // the plans scripts/tune.ts and scripts/tune-profiles.ts use
  const plans: [string, Omit<SeedPlanOptions, 'seed'>][] = [
    ['tune.ts', WEIGHT_SEEDS],
    ['tune-profiles.ts', PROFILE_SEEDS],
  ];
  for (const [name, o] of plans)
    it(`${name}: every --seed has its own training and held-out windows, and no training seed is ever a held-out seed`, () => {
      const all = Array.from({ length: o.slots }, (_, seed) => seedPlan({ ...o, seed }));
      for (let i = 0; i < all.length; i++) {
        expect(overlap(all[i].train, all[i].heldOut)).toBe(false);
        if (i + 1 < all.length) {
          expect(all[i].train.end).toBe(all[i + 1].train.start);
          expect(all[i].heldOut.end).toBe(all[i + 1].heldOut.start);
        }
      }
      expect(all[all.length - 1].train.end).toBeLessThanOrEqual(all[0].heldOut.start);
      expect(seedPlan({ ...o, seed: o.slots + 7 })).toEqual(all[7]); // --seed aliases modulo the slot count
    });

  it('rejects a plan whose training block runs into the held-out block, and a run larger than its window', () => {
    expect(() => seedPlan({ seed: 0, slots: 400, trainBase: 0, trainWindow: 1_000, heldOutBase: 399_999, heldOutWindow: 1_000 })).toThrow('overlap');
    expect(() => assertFitsWindow('held-out', 5_001, 5_000, 'lower --games')).toThrow('5001 seeds');
    expect(() => assertFitsWindow('held-out', 5_000, 5_000, 'lower --games')).not.toThrow();
  });
});

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
