// What pooling held-out games across runs does to the false-adopt rate and the power (the change ledger,
// src/lib/changeLedger.ts; docs/SYNERGIES.md "Pooling held-out games across runs"). Read-only: it plays no game and
// writes nothing; synthetic paired games only, seeded, so the same command prints the same numbers.
//
//   npx tsx scripts/ledger-sim.ts [--lives 20000] [--seed 1] [--part all|z|boundary|guard|lives]
//
// One change, confirmed again in every run (stages of 224 games, at most 4 a run, futility after 2 stages at a mean of 0
// or less, bar +1 point, at least 200 games, one nominee: ADOPTION_DEFAULTS). A paired difference is −1, 0 or +1 (most
// games of a one-card swap end the same), with the SD the tuning study measured (0.24 for a card, 0.35 and 0.50 wider).
//   no ledger   every run starts from nothing (today's staged rule each time)
//   last look   the plan's line: later runs pool and judge every pooled look at the last look's z (2.01)
//   strict      the rule as built: the first confirmation is today's staged rule; once there are earlier games, the
//               earlier games alone are looked at first, then each new stage pooled, by the always-valid boundary
//               (alwaysValidZ, ρ = 250) with the guarded spread (two pseudo-games), exactly as confirmStaged judges it
// Every decision goes through the library's own functions (lookZs, judgeLook, alwaysValidZ, guardedFromSums,
// futilityApplies); tests/change-ledger.test.ts checks that runOnce decides as confirmStaged does on the same games.
//
// --part: z (the boundary's values), boundary (the boundary alone, true gain at the bar, a look after every stage up to
// 200,000 games), guard (plain against guarded spread for rare differences), lives (the tables by run). Default all.
import { ADOPTION_DEFAULTS, alwaysValidZ, futilityApplies, guardedFromSums, judgeLook, lookZs, pooledShare, POOL_RHO, type AdoptionRule, type Outcome } from '../src/lib/evidence';

// ---------------------------------------------------------------- synthetic games

/** mulberry32 */
export function rng(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Count, Σd and Σd² of some paired differences. */
export interface Sums {
  n: number;
  sum: number;
  sq: number;
}
const ZERO: Sums = { n: 0, sum: 0, sq: 0 };
const plus = (a: Sums, b: Sums): Sums => ({ n: a.n + b.n, sum: a.sum + b.sum, sq: a.sq + b.sq });

/**
 * A stage of `m` paired games whose difference is +1, 0 or −1 with mean `mu` and SD `sd`: P(d ≠ 0) = sd² + mu², drawn by
 * geometric skipping (exact, and cheap when most games end the same).
 */
export function stageDraw(r: () => number, m: number, mu: number, sd: number): () => Sums {
  const pNZ = sd * sd + mu * mu;
  const pPlus = (pNZ + mu) / 2 / pNZ;
  const lg = Math.log(1 - pNZ);
  return () => {
    let sum = 0;
    let nz = 0;
    let i = Math.floor(Math.log(1 - r()) / lg);
    while (i < m) {
      nz++;
      sum += r() < pPlus ? 1 : -1;
      i += 1 + Math.floor(Math.log(1 - r()) / lg);
    }
    return { n: m, sum, sq: nz };
  };
}

// ---------------------------------------------------------------- one run, one life

export type Mode = 'strict' | 'last-look' | 'no-ledger';

/** The plain interval's bounds from sums (pairedInterval's), clipped to [−1, 1]. */
function plainBounds(s: Sums, z: number) {
  const mean = s.n ? s.sum / s.n : 0;
  if (s.n < 2) return { games: s.n, mean, lower: -1, upper: 1 };
  const v = Math.max(0, (s.sq - s.n * mean * mean) / (s.n - 1));
  const margin = z * Math.sqrt(v / s.n);
  return { games: s.n, mean, lower: Math.max(-1, mean - margin), upper: Math.min(1, mean + margin) };
}

/**
 * One run's confirmation of one nominee with `prior` earlier held-out games, as confirmStaged decides it (strict; with no
 * prior, today's staged rule), or as the plan's last-look line would ('last-look': every pooled look at the last staged
 * z, plain spread, no look at the prior alone, as the owner's design simulation had it). `played` is the new games.
 */
export function runOnce(rule: AdoptionRule, firstStage: number, prior: Sums, draw: () => Sums, mode: Mode): { outcome: Outcome; looks: number; played: Sums; pooled: boolean } {
  const stages = rule.capStages;
  const zs = lookZs(rule, 1);
  const pooled = mode !== 'no-ledger' && prior.n > 0;
  const bar = rule.minGainPp;
  let acc = pooled ? prior : ZERO;
  let played = ZERO;
  const a = pooledShare(rule.alpha, 1);
  if (pooled && mode === 'strict') {
    const v = judgeLook(guardedFromSums(acc.n, acc.sum, acc.sq, alwaysValidZ(acc.n, a)), { minGainPp: bar, minGames: rule.minGames, last: false });
    if (v === 'adopt' || v === 'reject') return { outcome: v, looks: 0, played, pooled };
  }
  for (let k = 0; k < stages; k++) {
    const s = draw();
    acc = plus(acc, s);
    played = plus(played, s);
    const last = k === stages - 1;
    if (!pooled) {
      const iv = plainBounds(acc, zs[k] ?? 1.96);
      const v = judgeLook(iv, { minGainPp: bar, minGames: rule.minGames, last });
      if (v !== 'continue') return { outcome: v, looks: k + 1, played, pooled };
      if (futilityApplies(rule, k + 1, stages) && iv.mean <= rule.futilityMaxGainPp / 100) return { outcome: 'inconclusive', looks: k + 1, played, pooled };
      continue;
    }
    const iv = mode === 'strict' ? guardedFromSums(acc.n, acc.sum, acc.sq, alwaysValidZ(acc.n, a)) : plainBounds(acc, zs[stages - 1] ?? 1.96);
    const v = judgeLook(iv, { minGainPp: bar, minGames: rule.minGames, last });
    if (v !== 'continue') return { outcome: v, looks: k + 1, played, pooled };
    const enough = mode === 'strict' ? acc.n >= rule.futilityAfterStages * firstStage : acc.n / firstStage >= rule.futilityAfterStages;
    if (rule.futilityAfterStages > 0 && enough && iv.mean <= rule.futilityMaxGainPp / 100) return { outcome: 'inconclusive', looks: k + 1, played, pooled };
  }
  return { outcome: 'inconclusive', looks: stages, played, pooled };
}

/**
 * One change's life over `runs` runs: the run in which it was adopted (1-based, 0 = never) and the held-out games played.
 * A pooled rejection is final (the ledger would not nominate it again); a rejection by the first, unpooled confirmation
 * is not under 'strict' (the next run looks at the pooled games first), and is under 'last-look' (as the design
 * simulation had it); without a ledger every run starts again, and a rejected change is screened again like any other.
 */
export function life(rule: AdoptionRule, firstStage: number, runs: number, mode: Mode, draw: () => Sums): { run: number; games: number } {
  let prior = ZERO;
  let games = 0;
  for (let run = 1; run <= runs; run++) {
    const r = runOnce(rule, firstStage, prior, draw, mode);
    games += r.played.n;
    if (mode !== 'no-ledger') prior = plus(prior, r.played);
    if (r.outcome === 'adopt') return { run, games };
    if (r.outcome === 'reject' && (mode === 'last-look' || r.pooled)) return { run: 0, games };
  }
  return { run: 0, games };
}

// ---------------------------------------------------------------- the boundary alone

/** The boundary alone at the bar (true gain = bar), a look after every stage from `firstLook` to `horizon` games. */
export function boundaryCheck(o: { sd: number; m: number; horizon: number; firstLook: number; guard: boolean; lives: number; seed: number; a?: number; rho?: number }): { above: number; below: number } {
  const r = rng(o.seed);
  const bar = ADOPTION_DEFAULTS.minGainPp / 100;
  const draw = stageDraw(r, o.m, bar, o.sd);
  const a = o.a ?? 0.025;
  let above = 0;
  let below = 0;
  for (let t = 0; t < o.lives; t++) {
    let acc = ZERO;
    let hitA = false;
    let hitB = false;
    while (acc.n < o.horizon && !(hitA && hitB)) {
      acc = plus(acc, draw());
      if (acc.n < o.firstLook) continue;
      const z = alwaysValidZ(acc.n, a, o.rho ?? POOL_RHO);
      const iv = o.guard ? guardedFromSums(acc.n, acc.sum, acc.sq, z) : plainBounds(acc, z);
      if (!hitA && iv.lower > bar) hitA = true;
      if (!hitB && iv.upper < bar) hitB = true;
    }
    if (hitA) above++;
    if (hitB) below++;
  }
  return { above: above / o.lives, below: below / o.lives };
}

/** P(adopted by the end of run r) for r = 1..runs, and the mean games, over `lives` lives. */
export function lifeTable(o: { mu: number; sd: number; m: number; runs: number; mode: Mode; lives: number; seed: number; rule?: AdoptionRule }): { byRun: number[]; games: number; gamesToAdopt: number } {
  const rule = o.rule ?? ADOPTION_DEFAULTS;
  const draw = stageDraw(rng(o.seed), o.m, o.mu, o.sd);
  const by = new Array<number>(o.runs + 1).fill(0);
  let games = 0;
  let adoptedGames = 0;
  let adopted = 0;
  for (let t = 0; t < o.lives; t++) {
    const l = life(rule, o.m, o.runs, o.mode, draw);
    games += l.games;
    if (l.run) {
      adopted++;
      adoptedGames += l.games;
      for (let q = l.run; q <= o.runs; q++) by[q] = (by[q] ?? 0) + 1;
    }
  }
  return { byRun: by.map((x) => x / o.lives), games: games / o.lives, gamesToAdopt: adopted ? adoptedGames / adopted : NaN };
}

// ---------------------------------------------------------------- the command

async function main() {
  const { cli, int, oneOf } = await import('./lib-node');
  const { values: V } = cli(import.meta.url, { lives: int(20_000, { min: 100 }), seed: int(1, { min: 0 }), part: oneOf(['all', 'z', 'boundary', 'guard', 'lives'], 'all') });
  const LIVES = V.lives;
  const on = (p: string) => V.part === 'all' || V.part === p;
  const pc = (x: number) => `${(x * 100).toFixed(1)}%`;
  const seedOf = (...xs: number[]) => xs.reduce((h, x) => Math.imul(h ^ Math.round(x * 1e4), 2654435761) >>> 0, V.seed * 7919 + 1);
  console.log(`Change ledger simulation: ${LIVES.toLocaleString('en-US')} lives per cell, seed ${V.seed} (npx tsx scripts/ledger-sim.ts --lives ${LIVES} --seed ${V.seed}${V.part !== 'all' ? ` --part ${V.part}` : ''})`);
  if (on('z')) {
    console.log('\nThe always-valid z at one-sided a = 0.025 (one nominee):');
    for (const rho of [POOL_RHO, 1000]) console.log(`  ρ ${String(rho).padStart(4)}: ${[224, 448, 896, 1792, 3584, 7168, 14336, 50000].map((n) => `${n.toLocaleString('en-US')}: ${alwaysValidZ(n, 0.025, rho).toFixed(2)}`).join('  ')}`);
    console.log(`  the staged rule's looks (O'Brien–Fleming-type, 4 looks): ${lookZs(ADOPTION_DEFAULTS, 1).map((z) => z.toFixed(2)).join(' / ')}`);
  }
  if (on('boundary')) {
    console.log(`\nThe boundary alone (guarded spread, ρ ${POOL_RHO}), true gain exactly at the bar (+1 point), a look after every stage from 224 to 200,000 games (bound 2.5% a side):`);
    for (const [sd, m] of [[0.12, 224], [0.24, 224], [0.24, 112], [0.35, 224], [0.5, 224]] as const) {
      const c = boundaryCheck({ sd, m, horizon: 200_000, firstLook: 224, guard: true, lives: LIVES, seed: seedOf(1, sd, m) });
      console.log(`  SD ${sd.toFixed(2)}, stages of ${m}: wrongly above the bar ${pc(c.above)}, wrongly below ${pc(c.below)}`);
    }
  }
  if (on('guard')) {
    console.log('\nPlain against guarded spread, true gain at the bar, a look after every stage from 224 to 60,000 games (bound 2.5% a side):');
    for (const [sd, m] of [[0.12, 224], [0.16, 224], [0.24, 224]] as const) {
      const p = boundaryCheck({ sd, m, horizon: 60_000, firstLook: 224, guard: false, lives: LIVES, seed: seedOf(2, sd, m) });
      const g = boundaryCheck({ sd, m, horizon: 60_000, firstLook: 224, guard: true, lives: LIVES, seed: seedOf(2, sd, m) });
      console.log(`  SD ${sd.toFixed(2)}: plain above ${pc(p.above)} below ${pc(p.below)}; guarded above ${pc(g.above)} below ${pc(g.below)}`);
    }
  }
  if (on('lives')) {
    const marks = [1, 2, 3, 5, 8, 12, 20];
    const modes: [Mode, string][] = [['no-ledger', 'no ledger'], ['last-look', 'last look z 2.01'], ['strict', 'strict (built)']];
    for (const sd of [0.24, 0.35, 0.5]) {
      console.log(`\nSD ${sd}, stages of 224 games, up to 4 a run, 20 runs: P(adopted by the end of run r); mean held-out games a life (until adopted or run 20); mean games when adopted`);
      for (const mu of [0, 0.005, 0.01, 0.015, 0.02, 0.03]) {
        console.log(`true gain ${mu >= 0 ? '+' : ''}${(mu * 100).toFixed(1)} pts`);
        for (const [mode, name] of modes) {
          const t = lifeTable({ mu, sd, m: 224, runs: 20, mode, lives: LIVES, seed: seedOf(3, sd, mu) });
          console.log(`  ${name.padEnd(17)} ${marks.map((q) => `r${q}: ${pc(t.byRun[q] ?? 0).padStart(6)}`).join(' ')}   games ${Math.round(t.games).toLocaleString('en-US')}   when adopted ${Number.isFinite(t.gamesToAdopt) ? Math.round(t.gamesToAdopt).toLocaleString('en-US') : '—'}`);
        }
      }
    }
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/ledger-sim.ts')) {
  void main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
