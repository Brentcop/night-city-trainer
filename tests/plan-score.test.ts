// planScore (src/ai/eval.ts) counts Gig values in a reused array when every value is a whole number from 0 to 63, and by
// the general rule otherwise. Either way it must give exactly what the formula gave before (kept below), for any Gigs:
// repeated values, many of one value, values the engine never makes (0, 63, 64, negative, fractional, NaN).
import { describe, expect, it } from 'vitest';
import { planScore } from '../src/ai/eval';
import type { GigPlan } from '../src/ai/knowledge';
import type { Gig } from '../src/engine/types';

/** planScore as it was written before. */
function oldPlanScore(gigs: Gig[], plan: GigPlan): number {
  let s = 0;
  const counts: Record<number, number> = {};
  for (const x of gigs) counts[x.value] = (counts[x.value] ?? 0) + 1;
  const pairs = Object.values(counts).reduce((a, n) => a + Math.floor(n / 2), 0);
  const distinct = Object.keys(counts).length;
  const hasEven = gigs.some((x) => x.value % 2 === 0);
  const hasOdd = gigs.some((x) => x.value % 2 === 1);
  for (const x of gigs) {
    if (x.value >= 8) s += 3 * plan.high;
    if (x.value === 1) s += 3 * plan.low;
    if (x.value === x.sides) s += 0.5 * plan.high;
    if (x.sides === 20) s += (x.value / 20) * 2 * plan.d20;
  }
  s += pairs * 3 * plan.pairs;
  s += distinct * 0.8 * plan.diverse;
  if (hasEven && hasOdd) s += 2 * plan.parity;
  s += gigs.reduce((a, x) => a + x.value, 0) * 0.05;
  return s;
}

let r = 12345;
const rand = () => ((r = (Math.imul(r, 1664525) + 1013904223) >>> 0) / 4294967296);
const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
const SIDES = [4, 6, 8, 10, 12, 20];
const EDGE = [0, -0, 1, 2, 20, 21, 62, 63, 64, 65, 100, 1000, -1, -2, -63, -64, 0.5, 1.5, 2.5, -1.5, NaN, Infinity, -Infinity, 2 ** 31, 2 ** 53];
const plan = (): GigPlan => ({ high: rand() * 1.5, low: rand() * 1.5, pairs: rand() * 1.5, diverse: rand() * 1.5, parity: rand() * 1.5, d20: rand() * 1.5 });
const gig = (id: number, value: number): Gig => ({ id, sides: pick(SIDES), value, owner: 0, controller: 0 });

function check(gigs: Gig[], p: GigPlan) {
  const want = oldPlanScore(gigs, p);
  const got = planScore(gigs, p);
  if (!Object.is(got, want)) throw new Error(`planScore ${got}, was ${want}, for values ${gigs.map((g) => g.value).join(', ')}`);
}

describe('planScore counts Gig values exactly as before', () => {
  it('on the values the engine makes (1 to 20), with repeats', () => {
    for (let k = 0; k < 20_000; k++) {
      const n = Math.floor(rand() * 15);
      const gigs = Array.from({ length: n }, (_, i) => gig(i + 1, 1 + Math.floor(rand() * (rand() < 0.5 ? 4 : 20))));
      check(gigs, plan());
    }
  });

  it('on edge values, alone and mixed with ordinary ones', () => {
    check([], plan());
    for (const v of EDGE) {
      check([gig(1, v)], plan());
      check([gig(1, v), gig(2, v)], plan());
      check([gig(1, v), gig(2, v), gig(3, v)], plan());
    }
    for (let k = 0; k < 20_000; k++) {
      const n = 1 + Math.floor(rand() * 14);
      const gigs = Array.from({ length: n }, (_, i) => gig(i + 1, rand() < 0.3 ? pick(EDGE) : Math.floor(rand() * 70)));
      check(gigs, plan());
    }
  });

  it('many Gigs of one value, and every value of the quick range at once', () => {
    for (const v of [0, 1, 7, 63, 64]) for (let n = 1; n <= 40; n++) check(Array.from({ length: n }, (_, i) => gig(i + 1, v)), plan());
    check(Array.from({ length: 64 }, (_, i) => gig(i + 1, i)), plan());
    check(Array.from({ length: 128 }, (_, i) => gig(i + 1, i % 64)), plan());
  });

  it('leaves nothing behind between calls', () => {
    const p = plan();
    const a = [gig(1, 5), gig(2, 5), gig(3, 9)];
    const first = planScore(a, p);
    planScore([gig(4, 5), gig(5, 9), gig(6, 9), gig(7, 9)], p);
    planScore([gig(8, 5), gig(9, 70)], p); // leaves by the general rule after counting nothing
    expect(planScore(a, p)).toBe(first);
  });
});
