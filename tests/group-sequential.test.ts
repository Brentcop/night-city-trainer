// SIM-5: O'Brien–Fleming-type alpha spending for the staged adoption rule (src/lib/groupSequential.ts, used by
// confirmStaged in src/lib/evidence.ts), against the Bonferroni split it replaced, on synthetic paired games.
import { describe, expect, it } from 'vitest';
import { crossingProbability, equalFractions, normalCdf, obfBoundaries, obfSpent } from '../src/lib/groupSequential';
import { ADOPTION_DEFAULTS, adoptionProvenance, confirmStaged, describeRule, lookZ, lookZs, normalQuantile, type AdoptionRule, type PlayStage } from '../src/lib/evidence';

/** Deterministic random numbers (mulberry32). */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The same synthetic paired games as tests/evidence.test.ts: the candidate repeats the list's result with probability rho. */
function synthStage(r: () => number, o: { p: number; rho: number; gain: number }): PlayStage {
  const q = o.p + o.gain / (1 - o.rho);
  return async ({ games, active }) => {
    const base: number[] = [];
    const nominees: number[][] = active.map(() => []);
    for (let k = 0; k < games; k++) {
      const b = r() < o.p ? 1 : 0;
      base.push(b);
      for (const s of nominees) s.push(r() < o.rho ? b : r() < q ? 1 : 0);
    }
    return { base, nominees };
  };
}

describe('O\'Brien–Fleming-type boundaries', () => {
  it('Φ is accurate in the tails', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 7);
    expect(normalCdf(1.959964)).toBeCloseTo(0.975, 6);
    expect(1 - normalCdf(4.333)).toBeCloseTo(7.36e-6, 7);
    expect(normalCdf(-3)).toBeCloseTo(0.0013499, 6);
  });

  it('match the published Lan–DeMets values and spend exactly α', () => {
    const b4 = obfBoundaries(0.025, equalFractions(4));
    [4.333, 2.963, 2.359, 2.014].forEach((x, i) => expect(b4[i]).toBeCloseTo(x, 2));
    expect(obfBoundaries(0.025, [1])[0]).toBeCloseTo(1.96, 3);
    for (const k of [2, 3, 4, 8]) expect(crossingProbability(obfBoundaries(0.025, equalFractions(k)), equalFractions(k))).toBeCloseTo(0.025, 4);
    expect(obfSpent(0.025, 1)).toBe(0.025);
    expect(obfSpent(0.025, 0.25)).toBeLessThan(0.0001);
    // the Bonferroni z of 2.50 at every look spends less than α (it is conservative)
    expect(crossingProbability([2.4977, 2.4977, 2.4977, 2.4977], equalFractions(4))).toBeLessThan(0.02);
  });

  it('the rule reads them per look; Bonferroni keeps one z', () => {
    expect(ADOPTION_DEFAULTS.boundary).toBe('obrien-fleming');
    expect(lookZs(ADOPTION_DEFAULTS).map((z) => +z.toFixed(2))).toEqual([4.33, 2.96, 2.36, 2.01]);
    expect(lookZ(ADOPTION_DEFAULTS, 1, 1)).toBeCloseTo(4.333, 2);
    const bonf = { ...ADOPTION_DEFAULTS, boundary: 'bonferroni' as const };
    expect(lookZs(bonf)).toEqual(Array(4).fill(normalQuantile(1 - 0.05 / 8)));
    // three nominees: each gets α/6 one-sided, spent over the looks
    expect(lookZs(ADOPTION_DEFAULTS, 3)).toEqual(obfBoundaries(0.05 / 6, equalFractions(4)));
    expect(describeRule(ADOPTION_DEFAULTS, { firstStage: 224 })).toContain("O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01");
    expect(describeRule(bonf, { firstStage: 224 })).toContain('Bonferroni, z = 2.50');
    const prov = adoptionProvenance(ADOPTION_DEFAULTS, { firstStage: 224, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 });
    expect(prov.correction).toBe('obrien-fleming');
    expect(prov.lookZ).toEqual([4.3326, 2.9631, 2.3590, 2.0141].map((x) => expect.closeTo(x, 2)));
    expect(adoptionProvenance(bonf, { firstStage: 224, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 }).correction).toBe('bonferroni');
  });
});

describe('false adoptions and power on synthetic paired games: Bonferroni vs O\'Brien–Fleming', () => {
  it('keeps the false-adopt rate at the bar and gains power at the cap', async () => {
    const reps = 2000;
    const BONF: AdoptionRule = { ...ADOPTION_DEFAULTS, boundary: 'bonferroni' };
    const sim = async (rule: AdoptionRule, o: { gain: number; rho: number; first: number }, seed: number) => {
      let adopted = 0;
      let games = 0;
      for (let i = 0; i < reps; i++) {
        const { results, games: g } = await confirmStaged(rule, [{ minGainPp: 1 }], o.first, synthStage(rng(seed * 1_000_003 + i), { p: 0.5, rho: o.rho, gain: o.gain }));
        games += g;
        if (results[0]!.outcome === 'adopt') adopted++;
      }
      return { adopt: adopted / reps, meanGames: games / reps };
    };
    const rows: string[] = [];
    const out: Record<string, { bonf: { adopt: number; meanGames: number }; obf: { adopt: number; meanGames: number } }> = {};
    for (const [name, setting] of [
      ['forge', { rho: 0.9, first: 224 }],
      ['loose', { rho: 0.6, first: 140 }],
    ] as const)
      for (const gain of [0, 0.01, 0.02, 0.03, 0.04, 0.05, 0.08]) {
        const seed = 100 + Math.round(gain * 1000) + (name === 'loose' ? 50 : 0);
        const bonf = await sim(BONF, { ...setting, gain }, seed);
        const obf = await sim(ADOPTION_DEFAULTS, { ...setting, gain }, seed);
        out[`${name}:${gain}`] = { bonf, obf };
        rows.push(
          `${name} (rho ${setting.rho}, stages of ${setting.first}, cap ${4 * setting.first}) gain ${(gain * 100).toFixed(0)} pts: adopted ${(bonf.adopt * 100).toFixed(1)}% → ${(obf.adopt * 100).toFixed(1)}%, mean games ${bonf.meanGames.toFixed(0)} → ${obf.meanGames.toFixed(0)}`,
        );
      }
    console.log(`adoption, Bonferroni → O'Brien–Fleming (futility stop on, one nominee), ${reps} reps:\n  ${rows.join('\n  ')}`);
    // no true gain, or a gain exactly at the 1-point bar: at most α/2 = 2.5% (plus simulation noise)
    for (const k of ['forge:0', 'loose:0']) expect(out[k]!.obf.adopt).toBeLessThan(0.01);
    for (const k of ['forge:0.01', 'loose:0.01']) expect(out[k]!.obf.adopt).toBeLessThan(0.035);
    // power: never clearly worse, better for gains the Bonferroni rule could not confirm reliably
    for (const [k, v] of Object.entries(out)) if (!k.endsWith(':0') && !k.endsWith(':0.01')) expect(v.obf.adopt).toBeGreaterThan(v.bonf.adopt - 0.03);
    expect(out['forge:0.03']!.obf.adopt).toBeGreaterThan(out['forge:0.03']!.bonf.adopt);
  }, 120_000);
});
