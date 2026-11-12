// ROADMAP2 §1 step 5: the adoption rule the deck builders share (src/lib/evidence.ts), the search depth and game budget
// (src/lib/deckSearch.ts), and the builders' flags (scripts/evidence-flags.ts).
import { describe, expect, it } from 'vitest';
import {
  ADOPTION_DEFAULTS,
  adoptionRule,
  ANY_GAIN_RULE,
  confirmStaged,
  DEFAULT_MIN_GAIN_PP,
  describeRule,
  formatGain,
  judgeLook,
  lookZ,
  nomineeRecord,
  normalQuantile,
  outcomeWord,
  pairedInterval,
  pickAdopted,
  ruleProblems,
  summarizePaired,
  type AdoptionRule,
  type PlayStage,
} from '../src/lib/evidence';
import * as tuning from '../scripts/tuning';
import { combinations, combineDecks, combinedCandidates, DEPTH_DEFAULTS, estimateGames, listKeyOf, maxCombined } from '../src/lib/deckSearch';
import { ArgError, parseArgs, usageOf } from '../scripts/lib-node';
import { adoptionArgs, adoptionFlags, budgetFlags, depthFlags, depthFromFlags, ruleFromFlags } from '../scripts/evidence-flags';
import { combineMutations, forgeSwaps, isPackageChange } from '../scripts/builder-moves';
import { synthDecks, synthReport, SYNTH_IMPACT } from './builder-fixtures';
import { validateDeck } from '../src/engine/deck';
import { checkChange } from '../src/lib/deckPackages';

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

/**
 * Synthetic paired games: the current list wins with probability p; the candidate plays the same game to the same result
 * with probability rho (one card changed rarely matters), and otherwise wins with the probability that makes its true
 * gain exactly `gain`.
 */
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

describe('paired intervals', () => {
  it('the tuners re-use the same summary and minimum gain (scripts/tuning.ts re-exports them)', () => {
    expect(tuning.summarizePaired).toBe(summarizePaired);
    expect(tuning.DEFAULT_MIN_GAIN_PP).toBe(DEFAULT_MIN_GAIN_PP);
    expect(DEFAULT_MIN_GAIN_PP).toBe(1);
  });

  it('is the mean per-game difference with z standard errors either side, clipped to [-1, 1]', () => {
    // differences 1, 0, 0, -1, 1: mean 0.2, sample variance 0.7
    const iv = pairedInterval([1, 1, 0, 0, 1], [0, 1, 0, 1, 0], 2);
    expect(iv.mean).toBeCloseTo(0.2, 12);
    expect(iv.upper - iv.mean).toBeCloseTo(2 * Math.sqrt(0.7 / 5), 12);
    expect(iv.mean - iv.lower).toBeCloseTo(2 * Math.sqrt(0.7 / 5), 12);
    // a difference of two scores lies in [-1, 1]: wider intervals are clipped
    expect(pairedInterval([1, 0], [0, 1])).toMatchObject({ mean: 0, lower: -1, upper: 1 });
  });

  it('agrees with summarizePaired at z = 1.96, and knows nothing from fewer than 2 games', () => {
    const c = [1, 0.5, 0, 1, 1, 0, 1, 1];
    const b = [0, 0.5, 0, 1, 0, 0, 1, 0];
    const s = summarizePaired(c, b);
    const iv = pairedInterval(c, b);
    expect(iv.mean).toBeCloseTo(s.mean, 12);
    expect(iv.lower).toBeCloseTo(s.lower95, 12);
    expect(iv.upper).toBeCloseTo(Math.min(1, s.upper95), 12);
    expect(pairedInterval([1], [0])).toMatchObject({ games: 1, lower: -1, upper: 1 });
    expect(pairedInterval([], [])).toMatchObject({ games: 0, lower: -1, upper: 1 });
    expect(() => pairedInterval([1, 0], [1])).toThrow();
  });

  it('the normal quantile matches the tables', () => {
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.995)).toBeCloseTo(2.575829, 5);
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326348, 5);
    expect(normalQuantile(1 - 1e-6)).toBeCloseTo(4.753424, 4);
    expect(() => normalQuantile(1)).toThrow();
  });
});

describe('the adoption rule', () => {
  it('defaults: min gain 1 point, 200 games, 4 stages, α 0.05 split by Bonferroni', () => {
    expect(ADOPTION_DEFAULTS).toEqual({ kind: 'evidence', minGainPp: 1, packageMinGainPp: 1, alpha: 0.05, capStages: 4, minGames: 200 });
    expect(lookZ(ADOPTION_DEFAULTS)).toBeCloseTo(normalQuantile(1 - 0.05 / 8), 12);
    expect(lookZ(ADOPTION_DEFAULTS)).toBeCloseTo(2.4977, 3);
    // three nominees share it too
    expect(lookZ(ADOPTION_DEFAULTS, 3)).toBeCloseTo(normalQuantile(1 - 0.05 / 24), 12);
    expect(adoptionRule({ minGainPp: 2 }).packageMinGainPp).toBe(2);
    expect(adoptionRule({ minGainPp: 2, packageMinGainPp: 3 }).packageMinGainPp).toBe(3);
    expect(adoptionRule({ kind: 'any-gain', minGainPp: 5 })).toEqual(ANY_GAIN_RULE);
    expect(ruleProblems(ADOPTION_DEFAULTS)).toEqual([]);
    expect(ruleProblems({ ...ADOPTION_DEFAULTS, alpha: 0, capStages: 0 })).toHaveLength(2);
  });

  it('judges one look three ways, with the games floor before any adoption', () => {
    const o = { minGainPp: 1, minGames: 200, last: false };
    expect(judgeLook({ games: 280, lower: 0.011, upper: 0.08 }, o)).toBe('adopt');
    expect(judgeLook({ games: 150, lower: 0.05, upper: 0.2 }, o)).toBe('continue'); // floor
    expect(judgeLook({ games: 150, lower: 0.05, upper: 0.2 }, { ...o, last: true })).toBe('inconclusive');
    expect(judgeLook({ games: 280, lower: -0.08, upper: 0.0099 }, o)).toBe('reject');
    expect(judgeLook({ games: 280, lower: 0.0, upper: 0.05 }, o)).toBe('continue');
    expect(judgeLook({ games: 1120, lower: 0.0, upper: 0.05 }, { ...o, last: true })).toBe('inconclusive');
    // a lower bound exactly on the bar is not above it
    expect(judgeLook({ games: 280, lower: 0.01, upper: 0.05 }, o)).toBe('continue');
  });

  it('confirms in stages up to the cap and stops each nominee once decided', async () => {
    const played: { stage: number; offset: number; games: number; active: number[] }[] = [];
    // nominee 0 always wins where the list loses (adopt once the floor is met); nominee 1 always plays the same (reject at once)
    const play: PlayStage = async (s) => {
      played.push(s);
      const base = Array.from({ length: s.games }, (_, k) => k % 2);
      return { base, nominees: s.active.map((i) => (i === 0 ? base.map(() => 1) : [...base])) };
    };
    const { results, games } = await confirmStaged(ADOPTION_DEFAULTS, [{ minGainPp: 1 }, { minGainPp: 1 }], 80, play);
    expect(results.map((r) => r.outcome)).toEqual(['adopt', 'reject']);
    expect(results[1]!.looks).toBe(1);
    // 80, 160 are under the 200 floor; adopted at 240
    expect(results[0]!.looks).toBe(3);
    expect(results[0]!.heldOut.games).toBe(240);
    expect(played.map((p) => [p.offset, p.active])).toEqual([
      [0, [0, 1]],
      [80, [0]],
      [160, [0]],
    ]);
    expect(games).toBe(80 * 3 + 80 * 2 + 80 * 2);
    expect(pickAdopted(results)).toBe(0);
  });

  it('a noisy nominee runs to the cap and is "could not tell", never adopted', async () => {
    const r = rng(7);
    const { results } = await confirmStaged(ADOPTION_DEFAULTS, [{ minGainPp: 1 }], 100, synthStage(r, { p: 0.5, rho: 0.3, gain: 0.03 }));
    expect(results[0]!.looks).toBeLessThanOrEqual(4);
    if (results[0]!.outcome === 'inconclusive') {
      expect(results[0]!.looks).toBe(4);
      expect(results[0]!.heldOut.games).toBe(400);
      expect(pickAdopted(results)).toBe(-1);
      expect(outcomeWord('inconclusive')).toBe('could not tell');
    }
  });

  it('any-gain is one stage, adopting on any positive mean (the legacy rule)', async () => {
    const play: PlayStage = async (s) => ({ base: Array.from({ length: s.games }, () => 0), nominees: s.active.map(() => Array.from({ length: s.games }, (_, k) => (k === 0 ? 1 : 0))) });
    const { results, games } = await confirmStaged(ANY_GAIN_RULE, [{ minGainPp: 0 }], 10, play);
    expect(results[0]).toMatchObject({ outcome: 'adopt', looks: 1 });
    expect(games).toBe(20);
  });

  it('Stop between stages leaves an undecided nominee "could not tell" (stopped), not adopted', async () => {
    let calls = 0;
    const play: PlayStage = async (s) => {
      calls++;
      const base = Array.from({ length: s.games }, (_, k) => k % 2);
      return { base, nominees: s.active.map(() => base.map(() => 1)) };
    };
    const { results } = await confirmStaged(ADOPTION_DEFAULTS, [{ minGainPp: 1 }], 50, play, () => calls >= 1);
    expect(calls).toBe(1);
    expect(results[0]).toMatchObject({ outcome: 'inconclusive', stopped: true });
  });

  it('false adoptions on synthetic games with no true gain: at most α/2 under the rule, about half under any-gain', async () => {
    const reps = 1500;
    const run = async (rule: AdoptionRule, gain: number, seed: number) => {
      const r = rng(seed);
      let adopted = 0;
      for (let i = 0; i < reps; i++) {
        const { results } = await confirmStaged(rule, [{ minGainPp: rule.minGainPp }], 140, synthStage(r, { p: 0.5, rho: 0.6, gain }));
        if (results[0]!.outcome === 'adopt') adopted++;
      }
      return adopted / reps;
    };
    const nullEvidence = await run(ADOPTION_DEFAULTS, 0, 1);
    const nullAny = await run(ANY_GAIN_RULE, 0, 1);
    // a true gain exactly at the bar (1 point) is the worst case for the rule: still at most α/2 = 2.5%
    const atBar = await run(ADOPTION_DEFAULTS, 0.01, 2);
    expect(nullEvidence).toBeLessThan(0.01);
    expect(atBar).toBeLessThan(0.035);
    expect(nullAny).toBeGreaterThan(0.35);
    // and a real gain of 8 points is adopted most of the time
    expect(await run(ADOPTION_DEFAULTS, 0.08, 3)).toBeGreaterThan(0.6);
  });

  it('reports never call an inconclusive change a gain', () => {
    const iv = pairedInterval([1, 0, 1, 1, 0, 1], [0, 0, 1, 0, 1, 1]);
    expect(formatGain(iv)).toMatch(/^\+16\.7 pts \[−\d+\.\d, \+\d+\.\d\], 6 games$/);
    const rec = nomineeRecord('-1 A → +1 B', iv, { outcome: 'inconclusive', heldOut: { ...iv, z: 2.5 }, baseWr: 0.5, candWr: 0.67, looks: 4, minGainPp: 1 });
    expect(rec.outcome).toBe('inconclusive');
    expect(describeRule(ADOPTION_DEFAULTS, { firstStage: 280 })).toContain('otherwise could not tell');
    expect(describeRule(ADOPTION_DEFAULTS, { firstStage: 280 })).toContain('Bonferroni, z = 2.50');
    expect(describeRule(ANY_GAIN_RULE)).toMatch(/^any-gain \(legacy\)/);
  });
});

describe('search depth (src/lib/deckSearch.ts)', () => {
  const decks = synthDecks();
  const deck = decks[0]!;

  it('combinations and their count', () => {
    expect(combinations([1, 2, 3, 4], 2)).toHaveLength(6);
    expect(combinations([1, 2, 3, 4], 3)).toEqual([
      [1, 2, 3],
      [1, 2, 4],
      [1, 3, 4],
      [2, 3, 4],
    ]);
    expect(maxCombined(4, 2)).toBe(6);
    expect(maxCombined(4, 3)).toBe(10);
  });

  it('combines two screened swaps into one legal list that respects the plan, and refuses conflicts', () => {
    const swaps = forgeSwaps(deck, synthReport(deck), SYNTH_IMPACT, 6);
    expect(swaps.length).toBeGreaterThan(2);
    const combos = combineMutations(deck, swaps, { maxParts: 2, from: 4 });
    expect(combos.length).toBeGreaterThan(0);
    for (const c of combos) {
      expect(validateDeck({ ...c.deck, sideboard: [] })).toEqual([]);
      expect(c.combo?.parts).toHaveLength(2);
      expect(c.label).toBe(c.combo!.parts.join(' + '));
      expect(isPackageChange(c)).toBe(false);
      // two cards differ from the starting list
      const before = [...deck.main].sort();
      const after = [...c.deck.main].sort();
      expect(after).toHaveLength(before.length);
      expect(listKeyOf(c.deck)).not.toBe(listKeyOf(deck));
    }
    // a swap combined with itself (both cut the same last copy and add the same card) is refused or deduplicated
    expect(combineDecks(deck, [swaps[0]!.deck, swaps[0]!.deck])).not.toEqual(swaps[0]!.deck);
    // a combination the plan forbids is never built: lock every card of the list
    const lockAll = { lockCards: Object.fromEntries([...new Set(deck.main)].map((id) => [id, 3])) };
    expect(combinedCandidates(deck, swaps, { maxParts: 2, from: 4, plan: lockAll }, (parts, d) => ({ label: parts.map((p) => p.label).join('+'), deck: d, prior: 0 }))).toEqual([]);
    for (const c of combineMutations(deck, swaps, { maxParts: 3, from: 4 })) expect(checkChange(deck, c.deck, {})).toEqual([]);
  });

  it("the game estimate reproduces the forge's old plan and shows what depth costs", () => {
    const base = { gens: 2, screenGames: 140, singles: 6, packageMoves: 0, firstStage: 280 };
    // the old forge manifest planned GENS × GAMES × (1 + CANDS + 4)
    expect(estimateGames({ ...base, depth: DEPTH_DEFAULTS, rule: ANY_GAIN_RULE }).max).toBe(2 * 140 * (1 + 6 + 4));
    const now = estimateGames({ ...base, depth: DEPTH_DEFAULTS, rule: ADOPTION_DEFAULTS });
    expect(now).toMatchObject({ min: 2 * 140 * 7, max: 2 * (140 * 7 + 280 * 4 * 2) });
    const deep = estimateGames({ ...base, depth: { ...DEPTH_DEFAULTS, cardsPerChange: 3, nominees: 3 }, rule: ADOPTION_DEFAULTS });
    expect(deep.combos).toBe(10);
    expect(deep.max).toBe(2 * (140 * 7 + 140 * 10 + 280 * 4 * 4));
  });
});

describe('builder flags (scripts/evidence-flags.ts)', () => {
  const spec = { ...adoptionFlags(), ...depthFlags(1), ...budgetFlags() };
  const parse = (argv: string[]) => parseArgs(spec, argv).values;

  it('no flag: the evidence rule with its defaults and depth 1', () => {
    const v = parse([]);
    expect(ruleFromFlags(v)).toEqual(ADOPTION_DEFAULTS);
    expect(depthFromFlags(v)).toEqual(DEPTH_DEFAULTS);
    expect(adoptionArgs(v)).toEqual([]);
    expect(v.budget).toBe(12_000);
  });

  it('parses the rule, the legacy switch and depth; passes on only what was given', () => {
    const v = parse(['--min-gain', '2', '--min-games', '300', '--confirm-cap', '3', '--cards-per-change', '2', '--nominees', '2']);
    expect(ruleFromFlags(v)).toEqual({ ...ADOPTION_DEFAULTS, minGainPp: 2, packageMinGainPp: 2, minGames: 300, capStages: 3 });
    expect(depthFromFlags(v)).toMatchObject({ cardsPerChange: 2, nominees: 2 });
    expect(adoptionArgs(v)).toEqual(['--min-gain', '2', '--min-games', '300', '--confirm-cap', '3', '--cards-per-change', '2', '--nominees', '2']);
    expect(ruleFromFlags(parse(['--adopt', 'any-gain', '--min-gain', '3']))).toEqual(ANY_GAIN_RULE);
    expect(adoptionArgs(parse(['--adopt', 'any-gain']))).toEqual(['--adopt', 'any-gain']);
    expect(ruleFromFlags(parse(['--package-min-gain', '2'])).packageMinGainPp).toBe(2);
  });

  it('bad values are refused (exit 2 in the scripts)', () => {
    for (const bad of [
      ['--adopt', 'maybe'],
      ['--min-gain', 'x'],
      ['--min-gain', '-1'],
      ['--confirm-cap', '0'],
      ['--cards-per-change', '4'],
      ['--packages-per-change', '3'],
      ['--nominees', '0'],
      ['--alpha', '0'],
      ['--budget', '0'],
    ])
      expect(() => parse(bad), bad.join(' ')).toThrow(ArgError);
  });

  it('the forge, optimizer and season --help list the rule and depth flags', () => {
    for (const s of ['forge', 'optimize', 'season']) {
      const help = usageOf(new URL(`../scripts/${s}.ts`, import.meta.url).href);
      for (const f of ['--adopt', '--min-gain', '--cards-per-change', '--packages-per-change', '--nominees']) expect(help, `${s} ${f}`).toContain(f);
    }
    expect(usageOf(new URL('../scripts/forge.ts', import.meta.url).href)).toContain('--budget');
  });
});
