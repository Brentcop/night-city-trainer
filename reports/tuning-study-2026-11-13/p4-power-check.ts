// What a run can detect (P4), checked independently: adoptChance / detectable in src/lib/deckSearch.ts are a grid
// computation under the normal model with the true spread. This is a Monte-Carlo of a separately written, plain
// implementation of the whole rule (the staged looks, then "until settled" with the strict pooled looks, the guarded
// spread, the futility stop and the out-of-reach stop) on win/loss paired games, whose differences are −1, 0 or +1,
// which is what the games really are. It uses the library only for the staged z's (lookZs) and for the figures it checks.
//
//   npx tsx reports/tuning-study-2026-11-13/p4-power-check.ts [confirmations per point, default 20000]     (from the repository root)
//
// The recorded output is p4-power-check.txt.
import { ADOPTION_DEFAULTS, lookZs, type AdoptionRule } from '../../src/lib/evidence';
import { adoptChance, detectable, gamesFor } from '../../src/lib/deckSearch';

const RHO = 250;
/** the always-valid normal-mixture boundary (Howard et al. 2021), one-sided error a */
const zStrict = (n: number, a: number) => Math.sqrt(2 * (1 + RHO / n) * Math.log(Math.sqrt(1 + n / RHO) / (2 * a) + 1));
/** the SD with two pseudo-games (+1 and −1) added */
const guardedSd = (n: number, sum: number, sq: number) => {
  const nn = n + 2;
  return Math.sqrt(Math.max(0, (sq + 2 - nn * (sum / nn) ** 2) / (nn - 1)));
};
/** the held-out games in all at which the pooled lower bound would clear the bar, the mean and spread held as now */
function toSettle(n: number, sum: number, sq: number, a: number, bar: number, minGames: number): number {
  const mean = sum / n;
  if (!(mean > bar)) return Infinity;
  const sd = guardedSd(n, sum, sq);
  const ok = (k: number) => k >= minGames && mean - zStrict(k, a) * (sd / Math.sqrt(k)) > bar;
  if (ok(n)) return n;
  let lo = n;
  let hi = n * 2;
  while (!ok(hi)) {
    lo = hi;
    hi *= 2;
    if (hi > 1e12) return Infinity;
  }
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (ok(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Cfg {
  name: string;
  firstStage: number;
  sd: number;
  nominees: number;
  /** the bar in points */
  bar: number;
  /** "until settled" to this reach (absent: a first confirmation alone) */
  reach?: number;
  /** one run's limit on a confirmation's held-out games (the Deck Lab's 5,000 seeds; the library's figure ignores it) */
  limit?: number;
}

/** one confirmation; returns [adopted, held-out games] */
function once(r: () => number, rule: AdoptionRule, c: Cfg, gain: number): [boolean, number] {
  const K = rule.capStages;
  const zs = lookZs(rule, c.nominees);
  const a = rule.alpha / (2 * c.nominees);
  const bar = c.bar / 100;
  // differences −1, 0, +1 with mean `gain` and SD `sd`: P(nonzero) = sd² + gain², P(+1 | nonzero) = ½ + gain / (2·P(nonzero))
  const pNZ = c.sd * c.sd + gain * gain;
  const pUp = 0.5 + gain / (2 * pNZ);
  let n = 0;
  let sum = 0;
  let sq = 0;
  const stage = () => {
    for (let i = 0; i < c.firstStage; i++) {
      if (r() < pNZ) {
        sum += r() < pUp ? 1 : -1;
        sq += 1;
      }
    }
    n += c.firstStage;
  };
  for (let k = 1; k <= K; k++) {
    stage();
    const mean = sum / n;
    const sd = Math.sqrt(Math.max(0, (sq - n * mean * mean) / (n - 1)));
    const half = zs[k - 1]! * (sd / Math.sqrt(n));
    if (mean - half > bar && n >= rule.minGames) return [true, n];
    if (mean + half < bar) return [false, n];
    if (k < K && rule.futilityAfterStages > 0 && k >= rule.futilityAfterStages && mean <= rule.futilityMaxGainPp / 100) return [false, n];
  }
  if (!c.reach) return [false, n];
  for (;;) {
    const t = toSettle(n, sum, sq, a, bar, rule.minGames);
    if (t > c.reach && t > n) return [false, n];
    if (c.limit && n + c.firstStage > c.limit) return [false, n];
    stage();
    const mean = sum / n;
    const half = zStrict(n, a) * (guardedSd(n, sum, sq) / Math.sqrt(n));
    if (mean - half > bar && n >= rule.minGames) return [true, n];
    if (mean + half < bar) return [false, n];
    if (rule.futilityAfterStages > 0 && n >= rule.futilityAfterStages * c.firstStage && mean <= rule.futilityMaxGainPp / 100) return [false, n];
  }
}

const TRIALS = Number(process.argv[2] ?? 20000);
const rule = ADOPTION_DEFAULTS as AdoptionRule;
const cfgs: Cfg[] = [
  { name: 'First confirmation, stages of 224 (Lab Standard, the season), one-card swap, SD 0.30', firstStage: 224, sd: 0.3, nominees: 1, bar: 1 },
  { name: 'First confirmation, stages of 224, one-card swap, SD 0.24', firstStage: 224, sd: 0.24, nominees: 1, bar: 1 },
  { name: 'First confirmation, stages of 112 (Lab Quick), one-card swap, SD 0.30', firstStage: 112, sd: 0.3, nominees: 1, bar: 1 },
  { name: 'First confirmation, stages of 280 (forge default), one-card swap, SD 0.30', firstStage: 280, sd: 0.3, nominees: 1, bar: 1 },
  { name: 'First confirmation, stages of 224, package move, SD 0.55', firstStage: 224, sd: 0.55, nominees: 1, bar: 1 },
  { name: 'First confirmation, stages of 224, 2 nominees, SD 0.30', firstStage: 224, sd: 0.3, nominees: 2, bar: 1 },
  { name: 'Until settled to 10,000, stages of 224, SD 0.30', firstStage: 224, sd: 0.3, nominees: 1, bar: 1, reach: 10_000 },
  { name: 'Until settled to 10,000, stages of 224, SD 0.24', firstStage: 224, sd: 0.24, nominees: 1, bar: 1, reach: 10_000 },
  { name: 'Until settled to 10,000, stages of 280 (forge default), SD 0.30', firstStage: 280, sd: 0.3, nominees: 1, bar: 1, reach: 10_000 },
  { name: 'Until settled to 10,000, stages of 224, package move, SD 0.55', firstStage: 224, sd: 0.55, nominees: 1, bar: 1, reach: 10_000 },
  { name: 'Until settled, Lab Quick (stages of 112), one run stops at 4,928 held-out games', firstStage: 112, sd: 0.3, nominees: 1, bar: 1, reach: 10_000, limit: 4928 },
  { name: 'Until settled, Lab Standard (stages of 224), one run stops at 4,928 held-out games', firstStage: 224, sd: 0.3, nominees: 1, bar: 1, reach: 10_000, limit: 4928 },
  { name: 'Until settled, Lab Thorough (stages of 336), one run stops at 4,704 held-out games', firstStage: 336, sd: 0.3, nominees: 1, bar: 1, reach: 10_000, limit: 4704 },
];
const r = rng(4242);
console.log(`What a run can detect: the library's computation against a Monte-Carlo of a separate implementation of the rule (${TRIALS.toLocaleString('en-US')} confirmations a point, win/loss games, the default rule).`);
let worst = 0;
for (const c of cfgs) {
  const o = { firstStage: c.firstStage, rule, sd: c.sd, nominees: c.nominees, minGainPp: c.bar, ...(c.reach ? { reach: c.reach } : {}) };
  const d = detectable(o);
  console.log(`\n${c.name}\n  the gain adopted 8 times in 10, computed: +${(d * 100).toFixed(2)} points`);
  for (const gain of [c.bar / 100, d * 0.75 + (c.bar / 100) * 0.25, d, d * 1.25]) {
    let ad = 0;
    let games = 0;
    for (let t = 0; t < TRIALS; t++) {
      const [yes, n] = once(r, rule, c, gain);
      if (yes) ad++;
      games += n;
    }
    const p = ad / TRIALS;
    const se = Math.sqrt((p * (1 - p)) / TRIALS);
    const computed = adoptChance(gain, o);
    worst = Math.max(worst, Math.abs(p - computed));
    console.log(`  real gain +${(gain * 100).toFixed(2)}: computed ${(computed * 100).toFixed(1)}%   Monte-Carlo ${(p * 100).toFixed(1)}% ± ${(1.96 * se * 100).toFixed(1)}   (${Math.round(games / TRIALS).toLocaleString('en-US')} held-out games on average)`);
  }
}
console.log(`\nLargest difference between the two: ${(worst * 100).toFixed(1)} percentage points of chance.`);
console.log(`gamesFor (held-out games to the cap for 8 in 10, one-card swap, SD 0.30): +5.0 points ${gamesFor({ rule, sd: 0.3, gain: 0.05 }).toLocaleString('en-US')}; +3.0 ${gamesFor({ rule, sd: 0.3, gain: 0.03 }).toLocaleString('en-US')}; +2.0 ${gamesFor({ rule, sd: 0.3, gain: 0.02 }).toLocaleString('en-US')}`);
