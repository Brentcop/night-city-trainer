// What a shortlist carried across runs adds under the change ledger's strict rule (src/lib/shortlist.ts; docs/SYNERGIES.md
// "A shortlist carried across runs"). Read-only: it plays no game and writes nothing; synthetic paired games only, seeded,
// so the same command prints the same numbers. The owner's design simulations (policy-sim.cjs, policy-sim2.cjs, outside
// the repository) ported, with every rule the library has taken from the library.
//
//   npx tsx scripts/shortlist-sim.ts [--lives 4000] [--runs 10] [--pool 60] [--seed 11] [--sd 0.24]
//
// One list has a finite pool of candidate one-card swaps (60), each with a true effect drawn once like the tuning study's
// E3 (mean about +1.0, SD 1.3 points; one in seven a real find near +3). A paired game differs by −1, 0 or +1 with SD
// 0.24 (stageDraw from scripts/ledger-sim.ts). A run screens K = 5 candidates on 112 games each, may nominate one and
// confirms it on stages of 224 held-out games, at most 4 (runOnce from scripts/ledger-sim.ts: the staged O'Brien–Fleming
// looks for a first confirmation, the strict always-valid pooled rule once a change has held-out games, the futility
// stop). After an adoption the list is a new list: a new pool. Ten runs per list.
//
// Policies:
//   today        5 candidates drawn at random from the pool each run (the generator's picks are mostly noise); this run's
//                best is nominated if it screened ≥ +2; every confirmation is a first confirmation; nothing remembered.
//   ledger       P1 as built: the same picks; a change with held-out games is judged on them pooled (strict rule), and one
//                its held-out games alone reject is not nominated.
//   shortlist    P5 as built (the status of a change is src/lib/shortlist.ts statusOfSums, the checks at nomination its
//                heldoutVerdict and outOfReach): the `carry` live changes with the best pooled gain (screening + held-out
//                games) are screened again, the rest of the 5 are random picks that are not dropped; a change is dropped
//                when pooled gain + dropSe standard errors < +2, when its held-out games are rejected, or when it would
//                need more than `reach` held-out games to be adopted (gamesToSettleSums); nominee = the best pooled gain
//                ≥ +2 that is neither rejected nor out of reach.
//   until settled  P4 as built (confirmStaged's `settle`, docs/SYNERGIES.md "Until settled"): a confirmation still
//                undecided at the cap (not stopped for no gain) goes on in further stages of 224 in the same run; before
//                each one it stops when out of reach (src/lib/shortlist.ts outOfReach: gamesToSettle over the reach), after
//                each one when the strict pooled look (heldoutVerdict) adopts or rejects or the futility rule fires on the
//                pooled mean, and at this run's limit: the forge's 50,000 confirmation seeds a generation and the reach
//                (src/lib/evidence.ts settleStages). tests/until-settled.test.ts checks that it decides as confirmStaged does.
//                The rows of 2026-11-14 ("P4, not built") also resumed the open confirmation closest to settling at the
//                start of each run; the built shortlist does not (it carries the change, screens it again and nominates it
//                by pooled gain).
import { ADOPTION_DEFAULTS, settleStages, type AdoptionRule, type Outcome } from '../src/lib/evidence';
import { heldoutVerdict, outOfReach, SHORTLIST_DEFAULTS, statusOfSums, type ShortlistRule } from '../src/lib/shortlist';
import { rng, runOnce, stageDraw, type Sums } from './ledger-sim';

const K = 5;
const SCREEN = 112;
const STAGE = 224;
/** per-game SD of the paired difference: 0.24 is the typical one-card swap; the study also measured 0.33 to 0.46 (--sd) */
let SD = 0.24;
/** the nomination bar: 2 points */
const NOMINATE = 0.02;
/** the forge's confirmation seeds a generation (scripts/forge.ts CONFIRM_GAP): "until settled" stays within them */
const CONFIRM_SEEDS = 50_000;

const ZERO: Sums = { n: 0, sum: 0, sq: 0 };
const plus = (a: Sums, b: Sums): Sums => ({ n: a.n + b.n, sum: a.sum + b.sum, sq: a.sq + b.sq });

/** A true effect like the study's E3 single-card swaps (the design simulation's draw). */
function trueEffect(r: () => number): number {
  const gauss = () => {
    let u = 0;
    while (u === 0) u = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
  };
  const x = r() < 0.15 ? 0.03 + 0.008 * gauss() : 0.0065 + 0.0105 * gauss();
  return Math.max(-0.04, Math.min(0.05, x));
}

interface Cand {
  mu: number;
  screen: Sums;
  held: Sums;
}

export interface Policy {
  /** keep games between runs (the ledger) */
  ledger: boolean;
  /** the shortlist (null = none): carry, dropSe, reach */
  shortlist: { carry: number; dropSe: number; reach: number } | null;
  /** "until settled" with this reach (0 = off) */
  settle: number;
}

const RULE: AdoptionRule = ADOPTION_DEFAULTS;
/** one nominee, the card bar, the nomination bar */
const JUDGE = { rule: RULE, nominees: 1, minGainPp: RULE.minGainPp };
const ruleOf = (sl: NonNullable<Policy['shortlist']>): ShortlistRule => ({ ...JUDGE, nominateBar: NOMINATE, shortlist: sl });

/** The strict rule's look at held-out games alone (src/lib/shortlist.ts heldoutVerdict: judgePooled's look on sums). */
const heldVerdict = (h: Sums) => heldoutVerdict(h, JUDGE);
/** screening and held-out games never share a game here (fresh seeds), so the pooled games are their sum */
const pooled = (c: Cand) => plus(c.screen, c.held);
const meanOf = (s: Sums) => (s.n ? s.sum / s.n : 0);

/** The library's status of a change (src/lib/shortlist.ts statusOfSums): untested, live, or dropped. */
const status = (c: Cand, sl: NonNullable<Policy['shortlist']>) => statusOfSums(pooled(c), c.held, ruleOf(sl)).kind;

interface Stats {
  games: number;
  adopted: number;
  gain: number;
  wrong: number;
}

/** Why "until settled" ended (src/lib/evidence.ts SettleEnd). */
export type SimSettleEnd = 'adopt' | 'reject' | 'out-of-reach' | 'futility' | 'limit';

/**
 * "Until settled" after an undecided cap, on held-out games kept as sums: the further stages confirmStaged plays, with its
 * checks in its order: out of reach before each stage (outOfReach), then this run's limit, then a stage, the strict pooled
 * look (heldoutVerdict) and the futility rule on the pooled mean. `held` is every held-out game so far; returns it with the
 * new stages, and how many there were.
 */
export function settleOn(rule: AdoptionRule, firstStage: number, held: Sums, draw: () => Sums, o: { reach: number; maxStages: number }): { ended: SimSettleEnd; held: Sums; stages: number } {
  const judge = { rule, nominees: 1, minGainPp: rule.minGainPp };
  for (let k = 0; ; k++) {
    if (outOfReach(held, { ...judge, reach: o.reach }).out) return { ended: 'out-of-reach', held, stages: k };
    if (k >= o.maxStages) return { ended: 'limit', held, stages: k };
    held = plus(held, draw());
    const v = heldoutVerdict(held, judge);
    if (v === 'adopt' || v === 'reject') return { ended: v, held, stages: k + 1 };
    if (rule.futilityAfterStages > 0 && held.n >= rule.futilityAfterStages * firstStage && meanOf(held) <= rule.futilityMaxGainPp / 100) return { ended: 'futility', held, stages: k + 1 };
  }
}

/**
 * One confirmation as the builders run it with the ledger: runOnce (the staged rule, or the strict pooled rule when
 * `prior` holds held-out games), then, with `settle`, "until settled" when it ended undecided at the cap. `played`: the
 * new games.
 */
export function confirmOnce(rule: AdoptionRule, firstStage: number, prior: Sums, draw: () => Sums, settle?: { reach: number; maxStages: number }): { outcome: Outcome; played: Sums; settle?: { ended: SimSettleEnd; stages: number } } {
  const o = runOnce(rule, firstStage, prior, draw, 'strict');
  // undecided at the cap, not stopped for no gain: runOnce played every capped stage (the futility stop never ends the last)
  if (!settle || o.outcome !== 'inconclusive' || o.looks < rule.capStages) return { outcome: o.outcome, played: o.played };
  const s = settleOn(rule, firstStage, plus(prior, o.played), draw, settle);
  const outcome: Outcome = s.ended === 'adopt' || s.ended === 'reject' ? s.ended : 'inconclusive';
  return { outcome, played: { n: s.held.n - prior.n, sum: s.held.sum - prior.sum, sq: s.held.sq - prior.sq }, settle: { ended: s.ended, stages: s.stages } };
}

/** "Until settled"'s limit in one run: the forge's confirmation seeds a generation and the reach (settleStages). */
const settleLimit = (reach: number) => ({ reach, maxStages: settleStages({ seedStages: Math.floor(CONFIRM_SEEDS / STAGE) - RULE.capStages, reach, firstStage: STAGE, capStages: RULE.capStages }) });

/** Confirm a nominee as the builders do (confirmOnce); without the ledger every run starts from nothing. */
function confirm(r: () => number, c: Cand, p: Policy, stats: Stats): Outcome {
  const draw = stageDraw(r, STAGE, c.mu, SD);
  if (!p.ledger) {
    const o = runOnce(RULE, STAGE, ZERO, draw, 'no-ledger');
    stats.games += 2 * o.played.n;
    return o.outcome;
  }
  const o = confirmOnce(RULE, STAGE, c.held, draw, p.settle ? settleLimit(p.settle) : undefined);
  stats.games += 2 * o.played.n;
  c.held = plus(c.held, o.played);
  return o.outcome;
}

function life(r: () => number, p: Policy, o: { runs: number; pool: number }): Stats {
  const stats: Stats = { games: 0, adopted: 0, gain: 0, wrong: 0 };
  const fresh = () => Array.from({ length: o.pool }, (): Cand => ({ mu: trueEffect(r), screen: ZERO, held: ZERO }));
  let pool = fresh();
  const adopt = (c: Cand) => {
    stats.adopted++;
    stats.gain += c.mu;
    if (c.mu < RULE.minGainPp / 100) stats.wrong++;
    pool = fresh();
  };
  const sl = p.shortlist;
  for (let run = 1; run <= o.runs; run++) {
    // this run's candidates: the carried ones, then random picks (the generator) skipping carried and dropped ones
    let cands: Cand[] = [];
    const rest = sl ? pool.filter((c) => status(c, sl) !== 'dropped') : [...pool];
    if (sl) {
      cands = rest
        .filter((c) => status(c, sl) === 'live')
        .sort((a, b) => meanOf(pooled(b)) - meanOf(pooled(a)))
        .slice(0, sl.carry);
      for (const c of cands) rest.splice(rest.indexOf(c), 1);
    }
    while (cands.length < K && rest.length) cands.push(rest.splice(Math.floor(r() * rest.length), 1)[0]!);
    stats.games += SCREEN;
    const own = new Map<Cand, number>();
    for (const c of cands) {
      const s = stageDraw(r, SCREEN, c.mu, SD)();
      stats.games += SCREEN;
      own.set(c, s.sum / SCREEN);
      if (p.ledger) c.screen = plus(c.screen, s);
    }
    // nominate: by pooled gain with the shortlist, else by this run's own screening; P1's check (and the reach) under the ledger
    const gainOf = (c: Cand) => (sl ? meanOf(pooled(c)) : own.get(c)!);
    const ok = [...cands]
      .sort((a, b) => gainOf(b) - gainOf(a))
      .filter((c) => gainOf(c) >= NOMINATE)
      .filter((c) => !(p.ledger && c.held.n && heldVerdict(c.held) === 'reject'))
      .filter((c) => !(sl && outOfReach(c.held, { ...JUDGE, reach: sl.reach }).out));
    const nom = ok[0];
    if (!nom) continue;
    if (confirm(r, nom, p, stats) === 'adopt') adopt(nom);
  }
  return stats;
}

export function simulate(p: Policy, o: { lives: number; runs: number; pool: number; seed: number }): Stats & { lives: number } {
  const r = rng(o.seed);
  const t: Stats = { games: 0, adopted: 0, gain: 0, wrong: 0 };
  for (let i = 0; i < o.lives; i++) {
    const s = life(r, p, o);
    t.games += s.games;
    t.adopted += s.adopted;
    t.gain += s.gain;
    t.wrong += s.wrong;
  }
  return { ...t, lives: o.lives };
}

const D = SHORTLIST_DEFAULTS;
const reachWords = (n: number) => n.toLocaleString('en-US');
/** The rows the docs quote, in order (the "as built" rows follow SHORTLIST_DEFAULTS). */
export const ROWS: { name: string; p: Policy }[] = [
  { name: 'today (new picks every run, nothing remembered)', p: { ledger: false, shortlist: null, settle: 0 } },
  { name: 'the ledger alone (P1)', p: { ledger: true, shortlist: null, settle: 0 } },
  { name: `carried shortlist as built (carry ${D.carry}, drop at ${D.dropSe} SE, reach ${reachWords(D.reach)})`, p: { ledger: true, shortlist: { ...D }, settle: 0 } },
  { name: 'the same with a reach of 4,500', p: { ledger: true, shortlist: { ...D, reach: 4_500 }, settle: 0 } },
  { name: 'fixed shortlist (carry 5, drop at 1.64 SE, reach 16,000)', p: { ledger: true, shortlist: { carry: 5, dropSe: 1.64, reach: 16_000 }, settle: 0 } },
  { name: `the ledger + until settled (P4 as built, reach ${reachWords(D.reach)})`, p: { ledger: true, shortlist: null, settle: D.reach } },
  { name: 'carried shortlist + until settled (P4 and P5 as built)', p: { ledger: true, shortlist: { ...D }, settle: D.reach } },
  { name: 'the same with a reach of 4,500 for both', p: { ledger: true, shortlist: { ...D, reach: 4_500 }, settle: 4_500 } },
];

async function main() {
  const { cli, int, num } = await import('./lib-node');
  const { values: V } = cli(import.meta.url, { lives: int(4_000, { min: 10 }), runs: int(10, { min: 1 }), pool: int(60, { min: K }), seed: int(11, { min: 0 }), sd: num(0.24, { min: 0.05, max: 0.7 }) });
  SD = V.sd;
  const o = { lives: V.lives, runs: V.runs, pool: V.pool, seed: V.seed };
  console.log(`Shortlist simulation: ${o.lives.toLocaleString('en-US')} lists a row, ${o.runs} runs each, a pool of ${o.pool} candidate swaps per list, ${K} candidates a run, seed ${o.seed}, per-game SD ${SD} (npx tsx scripts/shortlist-sim.ts --lives ${o.lives} --runs ${o.runs} --pool ${o.pool} --seed ${o.seed} --sd ${SD})`);
  console.log('');
  const head = `${'policy'.padEnd(66)} ${'adoptions'.padStart(9)} ${'true gain'.padStart(10)} ${'wrong'.padStart(6)} ${'games'.padStart(7)} ${'gain/10k games'.padStart(14)} ${'vs today'.padStart(8)}`;
  console.log(head);
  let today = 0;
  for (const [i, row] of ROWS.entries()) {
    const s = simulate(row.p, o);
    const gain = (100 * s.gain) / s.lives;
    const per = ((100 * s.gain) / s.games) * 10_000;
    if (i === 0) today = per;
    const rel = Math.round((100 * (per - today)) / today);
    const vs = i === 0 ? '' : `${rel > 0 ? '+' : rel < 0 ? '−' : '±'}${Math.abs(rel)}%`;
    console.log(
      `${row.name.padEnd(66)} ${(s.adopted / s.lives).toFixed(2).padStart(9)} ${`${gain.toFixed(2)} pts`.padStart(10)} ${`${((100 * s.wrong) / Math.max(1, s.adopted)).toFixed(1)}%`.padStart(6)} ${Math.round(s.games / s.lives).toLocaleString('en-US').padStart(7)} ${`${per.toFixed(2)} pts`.padStart(14)} ${vs.padStart(8)}`,
    );
  }
  console.log('');
  console.log('adoptions: per list over the runs; true gain: the true effects adopted, summed, per list; wrong: adoptions whose true effect is under the +1-point bar; games: both lists, per list; gain/10k games: true gain per 10,000 games; vs today: that, against today.');
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('scripts/shortlist-sim.ts')) {
  void main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
