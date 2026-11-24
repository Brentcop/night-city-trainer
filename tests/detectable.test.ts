// What a run can detect (src/lib/deckSearch.ts adoptChance / detectable / gamesFor; docs/TUNING_STUDY_2026-11-13.md P4):
// the computed gain a first confirmation adopts 8 times in 10 agrees with a seeded Monte-Carlo of confirmStaged itself,
// for the Deck Lab's three efforts and the forge's default, and so does the "until settled" figure within the reach.
import { describe, expect, it } from 'vitest';
import { ADOPTION_DEFAULTS, adoptionRule, confirmStaged, type PlayStage } from '../src/lib/evidence';
import { adoptChance, DEFAULT_SD, detect, detectable, detectWords, gamesFor, heldoutSdSamples, perGameSd, SD_MIN_CHANGES } from '../src/lib/deckSearch';
import type { LedgerEntry, LedgerGame } from '../src/lib/changeLedger';

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

/** Paired games whose difference is +1, 0 or −1 with mean `mu` and SD `sd` (most games end the same, as for a card swap). */
function stage(r: () => number, mu: number, sd: number): PlayStage {
  const pNZ = sd * sd + mu * mu;
  const pPlus = (pNZ + mu) / 2 / pNZ;
  return async ({ games, active }) => {
    const base: number[] = [];
    const nominees = active.map(() => [] as number[]);
    for (let k = 0; k < games; k++) {
      base.push(0);
      for (const s of nominees) s.push(r() < pNZ ? (r() < pPlus ? 1 : -1) : 0);
    }
    return { base, nominees };
  };
}

/** The share of `runs` seeded confirmations (confirmStaged, the default rule) that adopt a change of real gain `mu`. */
async function simulated(mu: number, o: { firstStage: number; sd: number; runs: number; seed: number; reach?: number }): Promise<number> {
  const r = rng(o.seed);
  let adopted = 0;
  for (let i = 0; i < o.runs; i++) {
    const c = await confirmStaged(ADOPTION_DEFAULTS, [{ minGainPp: 1 }], o.firstStage, stage(r, mu, o.sd), undefined, undefined, o.reach ? { reach: o.reach, maxStages: 10_000 } : undefined);
    if (c.results[0]!.outcome === 'adopt') adopted++;
  }
  return adopted / o.runs;
}

describe('detectable: the gain a first confirmation adopts 8 times in 10', () => {
  // the Deck Lab's Quick, Standard and Thorough (first stage 2 × games per test) and the forge's default (2 × 140)
  const CASES: [string, number][] = [
    ['Lab Quick', 112],
    ['Lab Standard', 224],
    ['Lab Thorough', 336],
    ['forge default', 280],
  ];
  for (const [name, firstStage] of CASES)
    it(`${name} (stages of ${firstStage}): the Monte-Carlo of confirmStaged agrees within 0.25 points`, async () => {
      const sd = 0.3;
      const d = detectable({ firstStage, rule: ADOPTION_DEFAULTS, sd });
      // the simulated 80% point lies between d − 0.25 and d + 0.25 points: below it fewer than 8 in 10 adopt, above it more
      const below = await simulated(d - 0.0025, { firstStage, sd, runs: 2000, seed: 1 });
      const above = await simulated(d + 0.0025, { firstStage, sd, runs: 2000, seed: 2 });
      expect(below).toBeLessThan(0.8);
      expect(above).toBeGreaterThan(0.8);
    }, 30_000);

  it('a package move (SD 0.55) at the Lab Standard: agrees too', async () => {
    const d = detectable({ firstStage: 224, rule: ADOPTION_DEFAULTS, sd: 0.55 });
    expect(await simulated(d - 0.0025, { firstStage: 224, sd: 0.55, runs: 2000, seed: 3 })).toBeLessThan(0.8);
    expect(await simulated(d + 0.0025, { firstStage: 224, sd: 0.55, runs: 2000, seed: 4 })).toBeGreaterThan(0.8);
  }, 30_000);

  it('the numbers: larger stages detect smaller gains; a wider spread, more nominees or a higher bar need larger ones', () => {
    const at = (o: Partial<Parameters<typeof detectable>[0]>) => detectable({ firstStage: 224, rule: ADOPTION_DEFAULTS, sd: 0.3, ...o });
    const quick = at({ firstStage: 112 });
    const standard = at({});
    const thorough = at({ firstStage: 336 });
    expect(quick).toBeGreaterThan(standard);
    expect(standard).toBeGreaterThan(thorough);
    expect(at({ sd: 0.55 })).toBeGreaterThan(standard);
    expect(at({ nominees: 6 })).toBeGreaterThan(standard);
    expect(at({ minGainPp: 2 })).toBeGreaterThan(standard);
    // the values the docs quote (SD 0.30): about +5.0, +3.8 and +3.3 points for the Lab's efforts
    expect(quick * 100).toBeCloseTo(5.0, 1);
    expect(standard * 100).toBeCloseTo(3.8, 1);
    expect(thorough * 100).toBeCloseTo(3.3, 1);
    // P(adopt) is a chance, rising with the gain, at the bar only the error rate
    expect(adoptChance(0.01, { firstStage: 224, rule: ADOPTION_DEFAULTS, sd: 0.3 })).toBeLessThan(0.025);
    expect(adoptChance(standard, { firstStage: 224, rule: ADOPTION_DEFAULTS, sd: 0.3 })).toBeCloseTo(0.8, 2);
    // the legacy any-gain rule adopts any positive mean: a small gain is "detected", which says nothing about its worth
    expect(detectable({ firstStage: 224, rule: adoptionRule({ kind: 'any-gain' }), sd: 0.3 })).toBeLessThan(0.02);
  });

  it('gamesFor: the held-out games (to the cap) a real gain needs to be adopted 8 times in 10', () => {
    const g = gamesFor({ gain: 0.03, sd: 0.3, rule: ADOPTION_DEFAULTS });
    expect(g % 4).toBe(0);
    // at that cap the gain is detectable; one stage size smaller, it is not
    expect(detectable({ firstStage: g / 4, rule: ADOPTION_DEFAULTS, sd: 0.3 })).toBeLessThanOrEqual(0.03);
    expect(detectable({ firstStage: g / 4 - 1, rule: ADOPTION_DEFAULTS, sd: 0.3 })).toBeGreaterThan(0.03);
    expect(gamesFor({ gain: 0.02, sd: 0.3, rule: ADOPTION_DEFAULTS })).toBeGreaterThan(g);
    expect(gamesFor({ gain: 0.01, sd: 0.3, rule: ADOPTION_DEFAULTS })).toBe(Infinity);
  });
});

describe('detectable with "until settled": the gain adopted 8 times in 10 within the reach', () => {
  // the approximation (adoptChance's comment): the true spread instead of the guarded estimate, out of reach as a bound on
  // the mean, and no limit of one run's seeds (here maxStages is effectively unlimited, as if later runs carried it on)
  for (const [firstStage, sd] of [
    [224, 0.3],
    [280, 0.3],
    [224, 0.55],
  ] as const)
    it(`stages of ${firstStage}, SD ${sd}: the Monte-Carlo agrees within 0.25 points, and it is below the first confirmation's`, async () => {
      const d = detectable({ firstStage, rule: ADOPTION_DEFAULTS, sd, reach: 10_000 });
      expect(d).toBeLessThan(detectable({ firstStage, rule: ADOPTION_DEFAULTS, sd }));
      expect(await simulated(d - 0.0025, { firstStage, sd, runs: 1000, seed: 11, reach: 10_000 })).toBeLessThan(0.8);
      expect(await simulated(d + 0.0025, { firstStage, sd, runs: 1000, seed: 12, reach: 10_000 })).toBeGreaterThan(0.8);
    }, 60_000);
});

describe('the per-game SD a run assumes, and the line it prints', () => {
  const games = (n: number, plus: number): LedgerGame[] => Array.from({ length: n }, (_, i) => ({ seed: i, opp: '0123456789abcdef', first: 0, base: 0, cand: i < plus ? 1 : 0 }));
  const entry = (change: string, n: number, plus: number): Pick<LedgerEntry, 'id' | 'heldout'> => ({ id: { change, simVersion: 9, bot: 'medium', field: 'ffffffffffffffff' }, heldout: games(n, plus) });
  const swap = (i: number) => `0123456789abcdef -main:a${i} +main:b${i}`;
  const pkg = (i: number) => `0123456789abcdef -main:a${i},c${i} +main:b${i},d${i}`;

  it('the study’s defaults until the ledger holds enough changes with 200 or more held-out games, then their median, kinds apart', () => {
    expect(perGameSd()).toEqual({ card: DEFAULT_SD.card, package: DEFAULT_SD.package, cardFrom: 0, packageFrom: 0 });
    const few = heldoutSdSamples([entry(swap(1), 400, 20), entry(swap(2), 150, 30), entry(pkg(1), 300, 60)]);
    // under 200 held-out games a change does not count
    expect(few.swaps).toHaveLength(1);
    expect(few.larger).toHaveLength(1);
    expect(perGameSd(few)).toMatchObject({ card: DEFAULT_SD.card, cardFrom: 0 });
    const many = heldoutSdSamples([entry(swap(1), 400, 4), entry(swap(2), 400, 16), entry(swap(3), 400, 36), entry(pkg(1), 300, 60)]);
    expect(many.swaps).toHaveLength(SD_MIN_CHANGES);
    const s = perGameSd(many);
    // the median of the three swaps' SDs: the one with 16 of 400 games changed, SD √(0.04 · 0.96 · 400/399)
    expect(s.card).toBeCloseTo(Math.sqrt((0.04 * 0.96 * 400) / 399), 6);
    expect(s.cardFrom).toBe(3);
    expect(s.package).toBe(DEFAULT_SD.package);
  });

  it('says the gain in plain words, the package move beside it, "until settled" when on, and which SD it used', () => {
    const plain = detectWords(detect({ rule: ADOPTION_DEFAULTS, firstStage: 224, nominees: 1, sd: perGameSd() }));
    // DEFAULT_SD: 0.256 for a one-card swap (the ledger's Medium swaps, 2026-11-24; 0.30, +3.8, before), 0.55 for a package move
    expect(plain).toMatch(/^A first confirmation here adopts a real gain of \+3\.4 points 8 times in 10 \(\+6\.2 for a package move\)\. /);
    expect(plain).toMatch(
      /0\.256 for a one-card swap and 0\.55 for a package move \(one-card swap: the median of 9 Medium one-card swaps with 200 or more held-out games, measured 2026-11-24; package move: the tuning study's typical value\)\.$/,
    );
    expect(plain).not.toMatch(/until settled/);
    const settled = detectWords(detect({ rule: ADOPTION_DEFAULTS, firstStage: 224, nominees: 1, sd: perGameSd(), untilSettled: { reach: 10_000 } }));
    expect(settled).toMatch(/; with until settled, about \+2\.7 \(\+4\.8 for a package move\) within 10,000 held-out games\./);
    const fromLedger = detectWords(detect({ rule: ADOPTION_DEFAULTS, firstStage: 224, nominees: 1, sd: { card: 0.22, package: 0.55, cardFrom: 4, packageFrom: 0 } }));
    expect(fromLedger).toMatch(/0\.22 for a one-card swap \(the median of 4 changes of this list with 200 or more held-out games\) and 0\.55 for a package move; the other is the tuning study's typical value\.$/);
    // the other way round: the package move from the list's own changes, the one-card swap the measured default
    const pkgFromLedger = detectWords(detect({ rule: ADOPTION_DEFAULTS, firstStage: 224, nominees: 1, sd: { card: DEFAULT_SD.card, package: 0.41, cardFrom: 0, packageFrom: 3 } }));
    expect(pkgFromLedger).toMatch(/0\.256 for a one-card swap and 0\.41 for a package move \(the median of 3 changes of this list with 200 or more held-out games\); the other is the median of 9 Medium one-card swaps with 200 or more held-out games, measured 2026-11-24\.$/);
    // a ledger SD is still written to two decimals, a measured default as written (0.256)
    expect(DEFAULT_SD).toMatchObject({ card: 0.256, package: 0.55, date: '2026-11-24', swaps: 9 });
    // no jargon in the Lab's line
    expect(settled).not.toMatch(/power|alpha|α|ledger/i);
    // a run too small to adopt anything (its cap is under the rule's minimum games) still reads as a sentence
    const tiny = detectWords(detect({ rule: ADOPTION_DEFAULTS, firstStage: 8, nominees: 1, sd: perGameSd() }));
    expect(tiny).toMatch(/^A first confirmation here does not adopt even a real gain of \+60 points 8 times in 10 \(not even \+60 for a package move\)\. It assumes /);
    // the legacy rule adopts a small gain easily, and a change with no gain half the time: the line says both
    const legacy = detectWords(detect({ rule: adoptionRule({ kind: 'any-gain' }), firstStage: 224, nominees: 1, sd: perGameSd() }));
    expect(legacy).toMatch(/8 times in 10 \(\+[\d.]+ for a package move\)\. Under the any-gain rule a change with no real gain at all is adopted about half the time too\. It assumes /);
    expect(adoptChance(0, { firstStage: 224, rule: adoptionRule({ kind: 'any-gain' }), sd: 0.3 })).toBeCloseTo(0.5, 6);
    expect(plain).not.toMatch(/any-gain/);
  });
});
