// INFO-4: the calibration analysis (src/analysis/evalCalibration.ts) and the named weight sets (src/ai/weightSets.ts).
import { describe, expect, it } from 'vitest';
import { analyzeLeaves, calibrationTable, splitOf, stageOf, type LeafGame } from '../src/analysis/evalCalibration';
import { DEFAULT_WEIGHTS, EVAL_TERMS } from '../src/ai/eval';
import { WEIGHT_SETS, weightSet } from '../src/ai/weightSets';
import { specWeights } from '../scripts/agent-spec';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
}

/**
 * Synthetic games whose result follows a known logistic in two features (gig and hand), the others noise: the fit must
 * find hand worth 2× its hand weight on the gig scale.
 */
function synthGames(n: number): LeafGame[] {
  const u = rng(9);
  const gi = EVAL_TERMS.indexOf('gig');
  const hi = EVAL_TERMS.indexOf('hand');
  const games: LeafGame[] = [];
  for (let s = 0; s < n; s++) {
    const f = EVAL_TERMS.map(() => 0);
    f[gi] = Math.round((u() - 0.5) * 6);
    f[hi] = Math.round((u() - 0.5) * 8);
    f[EVAL_TERMS.indexOf('eddie')] = Math.round((u() - 0.5) * 6); // noise
    // true value on the gig scale: gig 20, hand 2 × 3.6; slope 0.02 per point
    const z = 0.02 * (20 * f[gi]! + 7.2 * f[hi]!);
    const enderWins = u() < 1 / (1 + Math.exp(-z));
    const v = 20 * f[gi]! + 3.6 * f[hi]!;
    games.push({ seed: s, a: 'A', b: 'B', first: 0, winner: enderWins ? 0 : 1, leaves: [{ turn: 3 + (s % 9), seat: 0, overtime: false, v: [v, -v], vp: [v, -v], f: [f, f.map((x) => -x)] }] });
  }
  return games;
}

describe('evaluation calibration (INFO-4)', () => {
  it('stages, the split by game, and the calibration bins', () => {
    expect([1, 4, 5, 9, 10, 30].map(stageOf)).toEqual(['early', 'early', 'mid', 'mid', 'late', 'late']);
    const parts = { train: 0, valid: 0, test: 0 };
    for (let s = 0; s < 4000; s++) parts[splitOf(s)]++;
    expect(parts.train / 4000).toBeGreaterThan(0.55);
    expect(parts.test / 4000).toBeGreaterThan(0.2);
    expect(splitOf(1234)).toBe(splitOf(1234));
    const t = calibrationTable(
      [
        { v: -300, y: 0 },
        { v: 0, y: 1 },
        { v: 5, y: 0 },
        { v: 400, y: 1 },
      ],
      [-10, 10],
    );
    expect(t.map((b) => b.n)).toEqual([1, 2, 1]);
    expect(t[1]!.winRate).toBe(0.5);
  });

  it('recovers a planted weight on the gig scale and keeps unidentified terms at their hand values', () => {
    const r = analyzeLeaves(synthGames(30000), 'ender');
    const term = (k: string) => r.terms.find((t) => t.term === k)!;
    expect(term('gig').gigScale).toBeCloseTo(20, 6);
    expect(Math.abs(term('hand').gigScale - 7.2)).toBeLessThan(1.5);
    expect(term('hand').identified).toBe(true);
    expect(Math.abs(term('eddie').gigScale)).toBeLessThan(1.5);
    // never varies: not identified, keeps the hand value
    expect(term('goSolo').identified).toBe(false);
    expect(r.candidate.goSolo).toBe(DEFAULT_WEIGHTS.goSolo);
    // the feature model beats σ(a·value) on held-out games, since the value under-weights hand
    const ll = (m: string) => r.scores.find((s) => s.model.startsWith(m))!.logLoss;
    expect(ll('ridge logistic')).toBeLessThan(ll('σ(a·value), DEFAULT'));
  });

  it('named weight sets: merged over DEFAULT_WEIGHTS by name, overridable, unknown names refused', () => {
    expect(weightSet('next-turn')).toEqual({ exposed: 0.5, threat: 0.5, rivalLethal: 400 });
    expect(specWeights({})).toBeUndefined();
    expect(specWeights({ weights: 'next-turn' })).toEqual({ ...DEFAULT_WEIGHTS, exposed: 0.5, threat: 0.5, rivalLethal: 400 });
    expect(specWeights({ weightSet: 'next-turn', weights: { threat: 0.25 } })).toEqual({ ...DEFAULT_WEIGHTS, exposed: 0.5, threat: 0.25, rivalLethal: 400 });
    expect(() => specWeights({ weights: 'no-such-set' })).toThrow(/unknown weight set/);
    // every set keeps the fixed scale: gig, win, playOutClamp and the thresholds are the defaults
    for (const s of Object.values(WEIGHT_SETS)) for (const k of ['gig', 'win', 'playOutClamp', 'lowDeckAt', 'handCap', 'eddieCap'] as const) expect(s[k] ?? DEFAULT_WEIGHTS[k]).toBe(DEFAULT_WEIGHTS[k]);
  });
});
