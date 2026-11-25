// Measures whether the Game review's ratings follow skill and cost (docs/REVIEW_2026-11-25.md R2 and R6), on fresh
// bot games: each deal is played twice, by an Easy and by a Hard player (seat 0) against Medium (seat 1), recorded as a
// practice game and reviewed as the browser reviews it. Every rule was written down before the
// games were played (reports/review-validity-2026-11-25.md); the steps print the figures each rule reads. R4 (Sharp and
// Inspired confirmed on fresh worlds, by tier and result) was measured on the same games by a step of this script while
// the review still confirmed them; the step went with the ratings, which that measurement dropped.
//
//   npx tsx scripts/review-validity.ts games --deals 120 --out DIR [--seed 1] [--threads 4] [--confirm 16]
//   npx tsx scripts/review-validity.ts flags --out DIR [--hard-flags 120] [--easy-flags 150] [--medium-flags 100] [--truth 24] [--hard-worlds 16]
//                                                              costly ratings played on to the end with Hard; design (a) and (b) of R2
//   npx tsx scripts/review-validity.ts late --out DIR [--positions 150] [--pool 64] [--truth 24]
//                                                              late-game detection (R6): more worlds, rolloutWins, both
//   npx tsx scripts/review-validity.ts coach --out DIR           the coach's grade of every move of both seats (as the Play page grades)
//   npx tsx scripts/review-validity.ts costs --out DIR [--truth 16] [--per-stratum 60] [--reuse DIR2]
//                                                              row 6: what each rating band (coach and review) costs in win
//                                                              chance, played to the end with Hard; --reuse reads the truth an
//                                                              earlier `flags` run measured on the same games (same --seed)
//
// Each step writes its JSON into DIR and reads the earlier ones from it (nothing is written outside DIR).
import fs from 'node:fs';
import path from 'node:path';
import { cli, int, loadLibrary, runMain, str, threadsOpt, workerPool } from './lib-node';
import { gameDeck } from '../src/lib/tournament';
import { clampPlayOut, DECIDED_EVAL, DEFAULT_WEIGHTS } from '../src/ai/eval';
import { CAP } from '../src/ai/reviewer';
import type { DecisionReview } from '../src/ai/reviewer';
import { BLUNDER_GIGS, confirmFlag, GIG, MISTAKE_GIGS, rateOracle, seatSummary, withinNoise, type GameReviewRecord, type ReviewMove } from '../src/lib/gameReview';
import type { CoachGradeRow, Replay, ValidityJob, ValidityResult } from './review-validity-worker';
import type { PlayerId } from '../src/engine/types';

const { values: V, positionals } = cli(
  import.meta.url,
  {
    deals: int(120, { min: 1 }),
    seed: int(1, { min: 0 }),
    threads: threadsOpt(),
    confirm: int(16, { min: 0 }),
    out: str(),
    'hard-flags': int(120, { min: 0 }),
    'easy-flags': int(150, { min: 0 }),
    'medium-flags': int(100, { min: 0 }),
    truth: int(24, { min: 2 }),
    'hard-worlds': int(16, { min: 2 }),
    positions: int(150, { min: 1 }),
    pool: int(64, { min: 48 }),
    reuse: str(),
    'per-stratum': int(60, { min: 1 }),
  },
  { minPositionals: 1, maxPositionals: 1 },
);

interface Played {
  deal: number;
  tier: string;
  rec: GameReviewRecord;
  playMs: number;
  reviewMs: number;
}

const out = V.out ?? '';
const file = (n: string) => path.join(out, n);
const readJson = <T>(n: string): T => JSON.parse(fs.readFileSync(file(n), 'utf8')) as T;
const writeJson = (n: string, x: unknown) => fs.writeFileSync(file(n), JSON.stringify(x));

function lcg(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const mean = (xs: readonly number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const sd = (xs: readonly number[]) => {
  const m = mean(xs);
  return xs.length > 1 ? Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / (xs.length - 1)) : 0;
};
const seOf = (xs: readonly number[]) => (xs.length > 1 ? sd(xs) / Math.sqrt(xs.length) : 0);
/** 90% bootstrap interval of f over resampled indices 0..n-1. */
function boot(n: number, f: (idx: number[]) => number, reps = 2000, seed = 7): [number, number] {
  const r = lcg(seed);
  const xs: number[] = [];
  for (let k = 0; k < reps; k++) {
    const idx = Array.from({ length: n }, () => Math.floor(r() * n));
    const v = f(idx);
    if (Number.isFinite(v)) xs.push(v);
  }
  xs.sort((a, b) => a - b);
  return [xs[Math.floor(0.05 * xs.length)]!, xs[Math.floor(0.95 * xs.length)]!];
}
const f2 = (x: number) => (Number.isFinite(x) ? x.toFixed(2) : '—');
const f1 = (x: number) => (Number.isFinite(x) ? x.toFixed(1) : '—');

function pool<J extends ValidityJob>(jobs: J[], label: string): Promise<ValidityResult[]> {
  const wp = workerPool<J, ValidityResult>(new URL('./review-validity-boot.mjs', import.meta.url), Math.min(V.threads, jobs.length));
  let done = 0;
  const t0 = Date.now();
  return Promise.all(
    jobs.map((j) =>
      wp.run(j).then((r) => {
        done++;
        process.stderr.write(`\r  ${label}: ${done}/${jobs.length}  ${((Date.now() - t0) / 1000).toFixed(0)} s`);
        return r;
      }),
    ),
  ).finally(() => {
    process.stderr.write('\n');
    return wp.close();
  });
}

// ------------------------------------------------------------------------------------------------ games

interface Deal {
  deal: number;
  decks: [ReturnType<typeof gameDeck>, ReturnType<typeof gameDeck>];
  seed: number;
  first: PlayerId;
}
function deals(): Deal[] {
  const meta = loadLibrary().filter((d) => d.kind === 'meta');
  const r = lcg(V.seed * 2654435761);
  return Array.from({ length: V.deals }, (_, k) => {
    const a = meta[Math.floor(r() * meta.length)]!;
    const b = meta[Math.floor(r() * meta.length)]!;
    return { deal: k, decks: [gameDeck(a.deck), gameDeck(b.deck)], seed: 920_000 + V.seed * 10_000 + k, first: (k % 2) as PlayerId };
  });
}

async function games() {
  const ds = deals();
  const jobs: Extract<ValidityJob, { kind: 'game' }>[] = [];
  for (const d of ds) for (const tier of ['easy', 'hard']) jobs.push({ kind: 'game', id: `${d.deal}:${tier}`, decks: d.decks, seed: d.seed, first: d.first, tier, confirm: V.confirm });
  const res = await pool(jobs, 'games');
  const played: (Played & { decks: Deal['decks']; seed: number; first: PlayerId })[] = [];
  for (const r of res) {
    if (r.kind !== 'game') {
      console.error(`${r.id}: ${(r as { skip?: string }).skip}`);
      continue;
    }
    const [deal, tier] = r.id.split(':');
    const d = ds[Number(deal)]!;
    played.push({ deal: d.deal, tier: tier!, rec: r.rec, playMs: r.playMs, reviewMs: r.reviewMs, decks: d.decks, seed: d.seed, first: d.first });
  }
  writeJson('games.json', played);
  const ms = played.map((p) => p.reviewMs).sort((a, b) => a - b);
  console.log(`${played.length} games reviewed; review time median ${(ms[Math.floor(ms.length / 2)]! / 1000).toFixed(1)} s (${V.threads} in parallel)`);
  for (const t of ['easy', 'hard']) {
    const xs = played.filter((p) => p.tier === t);
    console.log(`  ${t}: win rate ${f1((100 * xs.filter((p) => p.rec.winner === 0).length) / xs.length)}%, review median ${f1(median(xs.map((p) => p.reviewMs)) / 1000)} s, failed decisions ${xs.reduce((a, p) => a + (p.rec.failed?.length ?? 0), 0)}`);
  }
}
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)]! : NaN;
};

type Game = Played & { decks: Deal['decks']; seed: number; first: PlayerId };
const loadGames = () => readJson<Game[]>('games.json');
const replay = (g: Game): Replay => ({ decks: g.decks, seed: g.seed, first: g.first, answers: g.rec.answers! });

// ------------------------------------------------------------------------------------------------ R2: Hard's flags

const COSTLY = new Set(['mistake', 'blunder']);
const ACTIONS = new Set(['sell', 'unit', 'program', 'gear', 'call', 'attack gigs', 'attack unit', 'activate', 'go solo', 'end turn', 'block', 'no reaction', 'react: call', 'react: program', 'react: ability']);

interface FlagRow {
  id: string;
  who: string;
  lone: boolean;
  /** Mistakes or worse of this seat in this game */
  seatFlags: number;
  gap: number;
  gain: number;
  gainSe: number;
  hardGap: number;
  hardSe: number;
  hardMs: number;
}

async function flags() {
  const gs = loadGames();
  const r = lcg(V.seed * 7 + 3);
  const cands: { who: string; g: Game; m: ReviewMove; lone: boolean; seatFlags: number }[] = [];
  for (const g of gs) {
    for (const p of [0, 1] as const) {
      const who = p === 1 ? 'medium' : g.tier;
      const mine = g.rec.moves.filter((m) => m.p === p);
      const costly = mine.filter((m) => COSTLY.has(m.r));
      for (const m of costly) {
        if (!ACTIONS.has(m.cat) || !m.best) continue;
        // lone: the seat's only Mistake or worse, in an otherwise accurate game (accuracy 90 or more over its other counted moves)
        const rest = seatSummary(mine.filter((x) => x.seq !== m.seq), p);
        cands.push({ who, g, m, lone: costly.length === 1 && (rest.accuracy ?? 0) >= 90, seatFlags: costly.length });
      }
    }
  }
  const take = (who: string, n: number) => {
    const xs = cands.filter((c) => c.who === who);
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    }
    return xs.slice(0, n);
  };
  const chosen = [...take('hard', V['hard-flags']), ...take('easy', V['easy-flags']), ...take('medium', V['medium-flags'])];
  console.log(`Flags (Mistake or worse) available: hard ${cands.filter((c) => c.who === 'hard').length}, easy ${cands.filter((c) => c.who === 'easy').length}, medium ${cands.filter((c) => c.who === 'medium').length}; measuring ${chosen.length}`);
  const jobs = chosen.map((c, k): Extract<ValidityJob, { kind: 'flag' }> => ({ kind: 'flag', id: String(k), replay: replay(c.g), p: c.m.p, at: c.m.at, best: c.m.best!, truthWorlds: V.truth, hardWorlds: V['hard-worlds'], seed: 4_000_000 + k * 101 }));
  const res = await pool(jobs, 'flags');
  const rows: FlagRow[] = [];
  let skipped = 0;
  for (const x of res) {
    if (x.kind !== 'flag' || !x.truthBest) {
      skipped++;
      continue;
    }
    const c = chosen[Number(x.id)]!;
    const d = x.truthBest.map((v, i) => v - x.truthMade![i]!);
    const hb = x.hardBest!.map((v) => clampPlayOut(v));
    const hm = x.hardMade!.map((v) => clampPlayOut(v));
    const hd = hb.map((v, i) => v - hm[i]!);
    rows.push({ id: x.id, who: c.who, lone: c.lone, seatFlags: c.seatFlags, gap: c.m.raw ?? c.m.gap ?? 0, gain: 100 * mean(d), gainSe: 100 * seOf(d), hardGap: mean(hd) / GIG, hardSe: seOf(hd) / GIG, hardMs: x.hardMs! });
  }
  writeJson('flags.json', rows);
  console.log(`${rows.length} measured, ${skipped} skipped`);
  flagReport(rows);
}

function flagReport(rows: FlagRow[]) {
  const gs = loadGames();
  console.log('\n| Flags of | n | gain played on with Hard (points) | lone flags: n, gain | other flags: gain |');
  console.log('|---|---|---|---|---|');
  for (const who of ['hard', 'medium', 'easy']) {
    const xs = rows.filter((x) => x.who === who);
    const lone = xs.filter((x) => x.lone);
    const other = xs.filter((x) => !x.lone);
    console.log(`| ${who} | ${xs.length} | ${f1(mean(xs.map((x) => x.gain)))} ± ${f1(seOf(xs.map((x) => x.gain)))} | ${lone.length}, ${f1(mean(lone.map((x) => x.gain)))} ± ${f1(seOf(lone.map((x) => x.gain)))} | ${f1(mean(other.map((x) => x.gain)))} ± ${f1(seOf(other.map((x) => x.gain)))} |`);
  }
  const all = rows;
  const lone = all.filter((x) => x.lone);
  const notLone = all.filter((x) => !x.lone);
  const ciL = boot(all.length, (idx) => {
    const s = idx.map((i) => all[i]!);
    return mean(s.filter((x) => !x.lone).map((x) => x.gain)) - mean(s.filter((x) => x.lone).map((x) => x.gain));
  });
  console.log(`\nAll flags: lone ${lone.length}, gain ${f1(mean(lone.map((x) => x.gain)))}; others ${notLone.length}, gain ${f1(mean(notLone.map((x) => x.gain)))}; others − lone ${f1(mean(notLone.map((x) => x.gain)) - mean(lone.map((x) => x.gain)))} [90% ${f1(ciL[0])}, ${f1(ciL[1])}]`);
  // design (a): kept when the Hard-continuation gap is still a Mistake or worse (MISTAKE_GIGS, outside 2 SE)
  const keptA = (x: FlagRow) => x.hardGap >= MISTAKE_GIGS && !withinNoise(x.hardGap, x.hardSe);
  // (a'): only seats with at most 2 such flags are confirmed with Hard (a cost cap); the others are kept as they are
  const keptA2 = (x: FlagRow) => (x.seatFlags <= 2 ? keptA(x) : true);
  const clear = all.filter((x) => x.gain - 1.645 * x.gainSe > 0);
  // review time: every Mistake or worse of both seats would be confirmed with Hard, at the measured time per flag
  const msPerFlag = mean(all.map((x) => x.hardMs));
  for (const [name, kept] of [
    ['(a) every costly flag confirmed with Hard play-outs', keptA],
    ["(a') only in seats with at most 2 costly flags", keptA2],
  ] as const) {
    const k = all.filter(kept);
    const d = all.filter((x) => !kept(x));
    const ci = boot(all.length, (idx) => {
      const s = idx.map((i) => all[i]!);
      return mean(s.filter(kept).map((x) => x.gain)) - mean(s.filter((x) => !kept(x)).map((x) => x.gain));
    });
    const clearKept = clear.filter(kept).length / Math.max(1, clear.length);
    const extra = gs.map((g) => {
      let n = 0;
      for (const p of [0, 1] as const) {
        const c = g.rec.moves.filter((m) => m.p === p && COSTLY.has(m.r) && ACTIONS.has(m.cat)).length;
        n += name.startsWith("(a')") ? (c <= 2 ? c : 0) : c;
      }
      return (n * msPerFlag) / g.reviewMs;
    });
    const pass1 = ci[0] > 0;
    const pass2 = clearKept > 0.5;
    const pass3 = median(extra) <= 0.5;
    console.log(`\n${name}:`);
    console.log(`  kept ${k.length} (gain ${f1(mean(k.map((x) => x.gain)))}), dropped ${d.length} (gain ${f1(mean(d.map((x) => x.gain)))}); kept − dropped ${f1(mean(k.map((x) => x.gain)) - mean(d.map((x) => x.gain)))} [90% ${f1(ci[0])}, ${f1(ci[1])}] → ${pass1 ? 'pass' : 'FAIL'}`);
    console.log(`  flags whose own gain is clearly positive: ${clear.length}, kept ${f1(100 * clearKept)}% → ${pass2 ? 'pass' : 'FAIL'}`);
    console.log(`  review time: +${f1(100 * median(extra))}% median a game (Hard confirmation ${f2(msPerFlag / 1000)} s a flag) → ${pass3 ? 'pass' : 'FAIL'}`);
    for (const who of ['hard', 'medium', 'easy']) {
      const xs = all.filter((x) => x.who === who);
      console.log(`    ${who}: kept ${xs.filter(kept).length} of ${xs.length}, kept gain ${f1(mean(xs.filter(kept).map((x) => x.gain)))}, dropped gain ${f1(mean(xs.filter((x) => !kept(x)).map((x) => x.gain)))}`);
    }
    console.log(`  → ${pass1 && pass2 && pass3 ? 'ADOPT' : 'not adopted'}`);
  }
  // the size: does the rated gap predict the gain?
  const big = all.filter((x) => x.gap >= 1);
  const small = all.filter((x) => x.gap < 1);
  console.log(`\nRated gap under 1 Gig: ${small.length} flags, gain ${f1(mean(small.map((x) => x.gain)))}; 1 Gig or more: ${big.length}, gain ${f1(mean(big.map((x) => x.gain)))}`);
}

// ------------------------------------------------------------------------------------------------ R6: late-game misses

interface LateRow {
  id: string;
  turn: number;
  cand: number[];
  chosen: number;
  screen?: { top: number; order: number[] };
  plain: number[][];
  wins: number[][];
  ended: boolean[][];
  truth: number[][];
}

async function late() {
  const gs = loadGames();
  const r = lcg(V.seed * 13 + 5);
  const cands: { g: Game; m: ReviewMove }[] = [];
  for (const g of gs) for (const m of g.rec.moves) if (m.turn >= 10 && m.src === 'oracle' && m.r !== 'unrated' && !['block', 'no reaction', 'react: call', 'react: program', 'react: ability', 'gig dice'].includes(m.cat) && m.ms?.o?.length) cands.push({ g, m });
  for (let i = cands.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [cands[i], cands[j]] = [cands[j]!, cands[i]!];
  }
  const chosen = cands.slice(0, V.positions);
  console.log(`${cands.length} late main-phase decisions (turn 10 or later); measuring ${chosen.length}`);
  const jobs = chosen.map((c, k): Extract<ValidityJob, { kind: 'late' }> => ({ kind: 'late', id: String(k), replay: replay(c.g), p: c.m.p, at: c.m.at, pool: V.pool, truthWorlds: V.truth, seed: 6_000_000 + k * 97 }));
  const res = await pool(jobs, 'late positions');
  const rows: LateRow[] = [];
  for (const x of res) if (x.kind === 'late' && x.plain) rows.push(x as LateRow);
  writeJson('late.json', rows);
  console.log(`${rows.length} measured`);
  lateReport(rows);
}

const TERMINAL = DEFAULT_WEIGHTS.playOutClamp;
const DECIDED = 0.75 * TERMINAL;
const LOST = -DECIDED_EVAL;
const r2 = (x: number) => Math.round(x * 100) / 100;

interface Method {
  name: string;
  screen: number;
  confirm: number;
  wins: boolean;
}
const METHODS: Method[] = [
  { name: 'today (8 + 16 worlds)', screen: 8, confirm: 16, wins: false },
  { name: 'more worlds (16 + 32)', screen: 16, confirm: 32, wins: false },
  { name: 'rolloutWins (8 + 16)', screen: 8, confirm: 16, wins: true },
  { name: 'both (16 + 32, rolloutWins)', screen: 16, confirm: 32, wins: true },
];

/** The review's rating of candidate `a` in one simulated review: screening on `sw` worlds, confirmation on `cw` (as the reviewer does). */
function simulate(row: LateRow, a: number, vals: number[][], raw: number[][], sw: number[], cw: number[]): string {
  const k = row.cand.length;
  const meanOn = (c: number, ws: number[]) => mean(ws.map((w) => vals[c]![w]!));
  const lossOn = (c: number, ws: number[]) => ws.filter((w) => raw[c]![w]! < LOST).length / ws.length;
  const pse = (x: number, y: number, ws: number[]) => seOf(ws.map((w) => vals[x]![w]! - vals[y]![w]!));
  const ms = Array.from({ length: k }, (_, c) => meanOn(c, sw));
  const bestV = Math.max(...ms);
  const best = ms.indexOf(bestV);
  const decided = bestV <= -DECIDED || Math.min(...ms) >= DECIDED;
  const rawGap = decided ? 0 : bestV - ms[a]!;
  const screenTop = row.screen ? row.cand.indexOf(row.screen.top) : -1;
  const d: DecisionReview = {
    i: 0,
    turn: row.turn,
    player: 0,
    category: 'unit',
    options: k,
    chosen: '',
    best: '',
    regret: Math.min(CAP, Math.max(0, rawGap)),
    raw: r2(Math.max(0, rawGap)),
    gameLosing: !decided && lossOn(a, sw) - lossOn(best, sw) >= 0.25,
    top: a === best,
    se: a === best ? 0 : r2(pse(best, a, sw)),
    others: Array.from({ length: k }, (_, c) => c)
      .filter((c) => c !== best)
      .map((c): [number, number] => [r2(bestV - ms[c]!), r2(pse(best, c, sw))])
      .sort((x, y) => x[0] - y[0]),
    ...(screenTop >= 0 ? { screen: { gap: r2(bestV - ms[screenTop]!), se: screenTop === best ? 0 : r2(pse(best, screenTop, sw)), chosenRank: row.screen!.order.indexOf(row.cand[a]!) } } : {}),
    ...(decided ? { decided: true } : {}),
  };
  if (!decided && a !== best && confirmFlag(d)) {
    const g2 = meanOn(best, cw) - meanOn(a, cw);
    d.regret = Math.min(CAP, Math.max(0, g2));
    d.raw = r2(Math.max(0, g2));
    d.se = r2(pse(best, a, cw));
    d.gameLosing = lossOn(a, cw) - lossOn(best, cw) >= 0.25;
  }
  return rateOracle(d);
}

function lateReport(rows: LateRow[]) {
  const gs = loadGames();
  const ended = rows.flatMap((x) => x.ended.flat());
  console.log(`Play-outs from turn 10 that end the game (or reach a decided start of turn): ${f1((100 * ended.filter(Boolean).length) / ended.length)}%`);
  const r = lcg(99);
  const TRIALS = 200;
  type Pair = { pos: number; a: number; g: number; gSe: number; out: number; p: number[] };
  const pairs: Pair[] = [];
  rows.forEach((row, pos) => {
    const plain = row.plain.map((ws) => ws.map((v) => clampPlayOut(v)));
    const wins = row.wins.map((ws) => ws.map((v) => clampPlayOut(v)));
    const W = plain[0]!.length;
    const pooled = plain.map((ws) => mean(ws));
    const b = pooled.indexOf(Math.max(...pooled));
    for (let a = 0; a < row.cand.length; a++) {
      if (a === b) continue;
      const diff = plain[b]!.map((v, w) => v - plain[a]![w]!);
      const p = METHODS.map((m) => {
        let costly = 0;
        for (let t = 0; t < TRIALS; t++) {
          const idx = Array.from({ length: W }, (_, i) => i);
          for (let i = W - 1; i > 0; i--) {
            const j = Math.floor(r() * (i + 1));
            [idx[i], idx[j]] = [idx[j]!, idx[i]!];
          }
          const sw = idx.slice(0, m.screen);
          const cw = idx.slice(m.screen, m.screen + m.confirm);
          const rating = simulate(row, a, m.wins ? wins : plain, m.wins ? row.wins : row.plain, sw, cw);
          if (rating === 'slip' || rating === 'mistake' || rating === 'blunder') costly++;
        }
        return costly / TRIALS;
      });
      pairs.push({ pos, a, g: mean(diff) / GIG, gSe: seOf(diff) / GIG, out: 100 * (mean(row.truth[b]!) - mean(row.truth[a]!)), p });
    }
  });
  const truthSet = pairs.filter((x) => x.g >= MISTAKE_GIGS && x.g <= 1.5 && x.g > 2 * x.gSe);
  const equal = pairs.filter((x) => x.g < 0.15);
  const big = pairs.filter((x) => x.g > 1.5 && x.g > 2 * x.gSe);
  console.log(`${pairs.length} pairs (the pooled best against each other candidate): true errors 0.375 to 1.5 Gigs ${truthSet.length}, over 1.5 Gigs ${big.length}, about equal (under 0.15) ${equal.length}`);
  console.log('\n| Method | detects true 0.375–1.5 Gig errors | over 1.5 Gigs | false alarms (about equal) | outcome gain of pairs it flags more than today (points) |');
  console.log('|---|---|---|---|---|');
  // review play-outs that are late (turn 10 or later), to price "more worlds" there
  let all = 0;
  let lateN = 0;
  for (const g of gs)
    for (const m of g.rec.moves) {
      if (!m.ms?.f) continue;
      const c = (m.ms.o?.length ?? 0) / 2 + 1;
      const n = c * g.rec.rollouts + (m.ms.c ? 2 * (g.rec.confirm ?? 16) : 0);
      all += n;
      if (m.turn >= 10) lateN += n;
    }
  const lateShare = lateN / Math.max(1, all);
  const verdicts: string[] = [];
  METHODS.forEach((m, k) => {
    const det = mean(truthSet.map((x) => x.p[k]!));
    const detBig = mean(big.map((x) => x.p[k]!));
    const fa = mean(equal.map((x) => x.p[k]!));
    const w = pairs.map((x) => Math.max(0, x.p[k]! - x.p[0]!));
    const sw = w.reduce((a, x) => a + x, 0);
    const newGain = sw > 0 ? pairs.reduce((a, x, i) => a + w[i]! * x.out, 0) / sw : NaN;
    const ci = sw > 0 ? boot(pairs.length, (idx) => {
      const ww = idx.map((i) => w[i]!);
      const s = ww.reduce((a, x) => a + x, 0);
      return s > 0 ? idx.reduce((a, i, j) => a + ww[j]! * pairs[i]!.out, 0) / s : NaN;
    }) : ([NaN, NaN] as [number, number]);
    const cost = m.screen > 8 ? lateShare : 0;
    console.log(`| ${m.name} | ${f1(100 * det)}% | ${f1(100 * detBig)}% | ${f1(100 * fa)}% | ${k ? `${f1(newGain)} [90% ${f1(ci[0])}, ${f1(ci[1])}]` : '—'} |`);
    if (k) {
      const base = METHODS[0]!;
      void base;
      const det0 = mean(truthSet.map((x) => x.p[0]!));
      const fa0 = mean(equal.map((x) => x.p[0]!));
      const ok = det - det0 >= 0.15 && fa <= Math.max(fa0 + 0.02, 0.05) && cost <= 0.5 && newGain > 0;
      verdicts.push(`${m.name}: detection +${f1(100 * (det - det0))} points, false alarms ${f1(100 * fa)}% (today ${f1(100 * fa0)}%), extra play-outs +${f1(100 * cost)}% of a review → ${ok ? 'ADOPT' : 'not adopted'}`);
    }
  });
  console.log(`\nPlay-outs of a review at turn 10 or later: ${f1(100 * lateShare)}% (doubling their worlds costs about that much more)`);
  for (const v of verdicts) console.log(v);
}

// ------------------------------------------------------------------------------------------------ row 6: what a rating costs

/** The coach's grade of every move both seats made that it would advise on (the Play page's grading, confirmation included). */
async function coach() {
  const gs = loadGames();
  const jobs = gs.map((g): Extract<ValidityJob, { kind: 'coach' }> => ({ kind: 'coach', id: `${g.deal}:${g.tier}`, replay: replay(g) }));
  const res = await pool(jobs, 'coach');
  const out: Record<string, CoachGradeRow[]> = {};
  let ms = 0;
  for (const r of res) {
    if (r.kind !== 'coach' || !r.grades) {
      console.error(`${r.id}: ${(r as { skip?: string }).skip}`);
      continue;
    }
    out[r.id] = r.grades;
    ms += r.ms ?? 0;
  }
  writeJson('coach.json', out);
  const all = Object.values(out).flat();
  const by = (v: string) => all.filter((x) => x.verdict === v).length;
  console.log(`${Object.keys(out).length} games, ${all.length} moves graded (${f1(ms / Math.max(1, all.length))} ms each): agree ${by('agree')}, best ${by('best')}, close ${by('close')}, unclear ${by('unclear')}, slip ${by('inaccuracy')}, mistake ${by('mistake')} (blunder ${all.filter((x) => x.verdict === 'mistake' && (x.gap ?? 0) >= BLUNDER_GIGS).length}), unscored ${by('unscored')}`);
}

const BANDS = ['slip', 'mistake', 'blunder'] as const;
type Band = (typeof BANDS)[number];
type Who = 'easy' | 'hard' | 'medium';
const WHO: readonly Who[] = ['easy', 'medium', 'hard'];
/** early: turns 1–4, middle: 5–9, late: 10 and after */
const stageOf = (turn: number) => (turn <= 4 ? 'early' : turn <= 9 ? 'middle' : 'late');

interface CostFlag {
  /** deal:tier:p:at:best, the position and the recommended move: one measurement serves every rating that names it */
  key: string;
  inst: 'review' | 'coach';
  band: Band;
  who: Who;
  turn: number;
  gap: number;
  g: Game;
  p: PlayerId;
  at: number;
  best: string;
}

/** Every costly rating of a main-phase action or reaction with a named better move, by the review and by the coach. */
function costPopulation(gs: Game[], cg: Record<string, CoachGradeRow[]>): CostFlag[] {
  const out: CostFlag[] = [];
  for (const g of gs) {
    const id = `${g.deal}:${g.tier}`;
    for (const m of g.rec.moves) {
      if (!(BANDS as readonly string[]).includes(m.r) || !ACTIONS.has(m.cat) || !m.best) continue;
      out.push({ key: `${id}:${m.p}:${m.at}:${m.best}`, inst: 'review', band: m.r as Band, who: (m.p === 1 ? 'medium' : g.tier) as Who, turn: m.turn, gap: m.raw ?? m.gap ?? 0, g, p: m.p, at: m.at, best: m.best });
    }
    for (const c of cg[id] ?? []) {
      if (c.same || (c.verdict !== 'inaccuracy' && c.verdict !== 'mistake')) continue;
      const band: Band = c.verdict === 'inaccuracy' ? 'slip' : (c.gap ?? 0) >= BLUNDER_GIGS ? 'blunder' : 'mistake';
      out.push({ key: `${id}:${c.p}:${c.at}:${c.best}`, inst: 'coach', band, who: (c.p === 1 ? 'medium' : g.tier) as Who, turn: c.turn, gap: c.gap ?? 0, g, p: c.p, at: c.at, best: c.best });
    }
  }
  return out;
}

/**
 * The ratings each band's figure is read from: in each (instrument, band, player) stratum a random sample of up to
 * `--per-stratum` (the stratum's order shuffled from a fixed seed, so `cost-report` reads the same sample). Only the
 * sample counts: a measurement reused from `--reuse` saves its play-outs when its rating is in the sample, and is not
 * used otherwise (the coach's ratings that the earlier run measured are the ones the review flagged too, not a random part
 * of the coach's).
 */
function costSample(pop: CostFlag[]): Set<CostFlag> {
  const r = lcg(V.seed * 31 + 11);
  const out = new Set<CostFlag>();
  for (const inst of ['review', 'coach'] as const)
    for (const band of BANDS)
      for (const who of WHO) {
        const xs = pop.filter((x) => x.inst === inst && x.band === band && x.who === who);
        for (let i = xs.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [xs[i], xs[j]] = [xs[j]!, xs[i]!];
        }
        for (const x of xs.slice(0, V['per-stratum'])) out.add(x);
      }
  return out;
}

/**
 * Truth already measured by the `flags` step in another output directory on the same games (`--reuse DIR`): its
 * selection is re-made from that directory's games.json exactly as `flags` made it, so each row's position is known.
 */
function reusedTruth(dir: string): Map<string, { gain: number; worlds: number }> {
  const m = new Map<string, { gain: number; worlds: number }>();
  if (!dir) return m;
  const gs = JSON.parse(fs.readFileSync(path.join(dir, 'games.json'), 'utf8')) as Game[];
  const rows = JSON.parse(fs.readFileSync(path.join(dir, 'flags.json'), 'utf8')) as FlagRow[];
  const r = lcg(V.seed * 7 + 3);
  const cands: { who: string; g: Game; m: ReviewMove }[] = [];
  for (const g of gs)
    for (const p of [0, 1] as const)
      for (const m of g.rec.moves.filter((x) => x.p === p && COSTLY.has(x.r))) if (ACTIONS.has(m.cat) && m.best) cands.push({ who: p === 1 ? 'medium' : g.tier, g, m });
  const take = (who: string, n: number) => {
    const xs = cands.filter((c) => c.who === who);
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [xs[i], xs[j]] = [xs[j]!, xs[i]!];
    }
    return xs.slice(0, n);
  };
  // the `flags` step's defaults (120 / 150 / 100), as the run being reused was made
  const chosen = [...take('hard', 120), ...take('easy', 150), ...take('medium', 100)];
  let bad = 0;
  for (const row of rows) {
    const c = chosen[Number(row.id)];
    if (!c || Math.abs((c.m.raw ?? c.m.gap ?? 0) - row.gap) > 1e-9) {
      bad++;
      continue;
    }
    m.set(`${c.g.deal}:${c.g.tier}:${c.m.p}:${c.m.at}:${c.m.best}`, { gain: row.gain, worlds: 24 });
  }
  if (bad) throw new Error(`--reuse: ${bad} of ${rows.length} rows did not match their position (another seed or flag counts?)`);
  return m;
}

interface CostRow {
  key: string;
  gain: number;
  worlds: number;
}

/**
 * The cost of each rating band, played to the end with Hard on both seats: for each (instrument, band, player) stratum a
 * random sample of up to `--per-stratum` flags, each measured once by its position and recommended move (reused from
 * `--reuse DIR` when that run measured it), on `--truth` paired worlds.
 */
async function costs() {
  const gs = loadGames();
  const cg = readJson<Record<string, CoachGradeRow[]>>('coach.json');
  const pop = costPopulation(gs, cg);
  const reuse = reusedTruth(V.reuse ?? '');
  const done = new Map<string, CostRow>();
  if (fs.existsSync(file('costs.json'))) for (const x of readJson<CostRow[]>('costs.json')) done.set(x.key, x);
  for (const [k, v] of reuse) if (!done.has(k)) done.set(k, { key: k, ...v });
  const want = new Map<string, CostFlag>();
  for (const x of costSample(pop)) if (!done.has(x.key)) want.set(x.key, x);
  console.log(`Costly ratings: ${pop.length} (${new Set(pop.map((x) => x.key)).size} positions); ${done.size} already measured; measuring ${want.size} on ${V.truth} worlds`);
  const list = [...want.values()];
  const jobs = list.map((c, k): Extract<ValidityJob, { kind: 'flag' }> => ({ kind: 'flag', id: String(k), replay: replay(c.g), p: c.p, at: c.at, best: c.best, truthWorlds: V.truth, hardWorlds: 0, seed: 8_000_000 + k * 101 }));
  const res = jobs.length ? await pool(jobs, 'costs') : [];
  for (const x of res) {
    if (x.kind !== 'flag' || !x.truthBest) {
      done.set(list[Number(x.id)]!.key, { key: list[Number(x.id)]!.key, gain: NaN, worlds: 0 });
      continue;
    }
    const d = x.truthBest.map((v, i) => v - x.truthMade![i]!);
    done.set(list[Number(x.id)]!.key, { key: list[Number(x.id)]!.key, gain: 100 * mean(d), worlds: d.length });
  }
  writeJson('costs.json', [...done.values()]);
  costReport(pop, done);
}

/**
 * A band's figure: the mean gain over every costly rating of the band in these games, estimated by strata (player type,
 * weighted by its share of the band's ratings), with the stratified standard error; 90% interval ±1.645 SE.
 */
function stratified(pop: CostFlag[], done: Map<string, CostRow>, sel: (x: CostFlag) => boolean, sample: Set<CostFlag>) {
  const xs = pop.filter(sel);
  let est = 0;
  let v = 0;
  let n = 0;
  const per: string[] = [];
  for (const who of WHO) {
    const s = xs.filter((x) => x.who === who);
    if (!s.length) continue;
    const meas = s.filter((x) => sample.has(x)).map((x) => done.get(x.key)?.gain).filter((g): g is number => g !== undefined && Number.isFinite(g));
    const w = s.length / xs.length;
    per.push(`${who} ${meas.length}/${s.length} ${f1(mean(meas))}`);
    if (!meas.length) return { est: NaN, se: NaN, n: 0, pop: xs.length, per: per.join(', ') };
    est += w * mean(meas);
    // a stratum of one: its spread taken as the band's pooled spread
    v += w * w * (meas.length > 1 ? sd(meas) ** 2 : 400) / meas.length * (1 - meas.length / s.length);
    n += meas.length;
  }
  return { est, se: Math.sqrt(v), n, pop: xs.length, per: per.join(', '), gap: mean(xs.map((x) => x.gap)) };
}

function costReport(pop: CostFlag[], done: Map<string, CostRow>) {
  const r0 = (x: number) => Math.round(x);
  console.log('\n| Rated by | Band | ratings in the games | measured | mean rated gap (Gigs) | gain with Hard to the end (points) | 90% interval | by player: measured/all mean | shown as |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  const summary: Record<string, unknown> = {};
  const sample = costSample(pop);
  for (const inst of ['coach', 'review'] as const)
    for (const band of BANDS) {
      const s = stratified(pop, done, (x) => x.inst === inst && x.band === band, sample);
      const lo = s.est - 1.645 * s.se;
      const hi = s.est + 1.645 * s.se;
      const shown = !Number.isFinite(s.est) ? '—' : lo > 0 ? `about ${r0(s.est)} points` : 'often costs nothing measurable';
      summary[`${inst}:${band}`] = { mean: s.est, se: s.se, lo, hi, n: s.n, pop: s.pop };
      console.log(`| ${inst} | ${band} | ${s.pop} | ${s.n} | ${f2(s.gap ?? NaN)} | ${f1(s.est)} ± ${f1(s.se)} | [${f1(lo)}, ${f1(hi)}] | ${s.per} | ${shown} |`);
    }
  console.log('\nBy stage (Mistake or worse; the same estimate, within each stage):');
  console.log('| Rated by | stage | ratings | measured | gain (points) | 90% interval |');
  console.log('|---|---|---|---|---|---|');
  for (const inst of ['coach', 'review'] as const)
    for (const stage of ['early', 'middle', 'late']) {
      const s = stratified(pop, done, (x) => x.inst === inst && x.band !== 'slip' && stageOf(x.turn) === stage, sample);
      console.log(`| ${inst} | ${stage} | ${s.pop} | ${s.n} | ${f1(s.est)} ± ${f1(s.se)} | [${f1(s.est - 1.645 * s.se)}, ${f1(s.est + 1.645 * s.se)}] |`);
    }
  writeJson('costs-summary.json', summary);
}

async function main() {
  if (!V.out) throw new Error('--out DIR is required');
  fs.mkdirSync(out, { recursive: true });
  const step = positionals[0];
  if (step === 'games') await games();
  else if (step === 'flags') await flags();
  else if (step === 'flag-report') flagReport(readJson<FlagRow[]>('flags.json'));
  else if (step === 'late') await late();
  else if (step === 'late-report') lateReport(readJson<LateRow[]>('late.json'));
  else if (step === 'coach') await coach();
  else if (step === 'costs') await costs();
  else if (step === 'cost-report') {
    const done = new Map(readJson<CostRow[]>('costs.json').map((x) => [x.key, x] as const));
    costReport(costPopulation(loadGames(), readJson<Record<string, CoachGradeRow[]>>('coach.json')), done);
  } else throw new Error(`unknown step "${step ?? ''}" (games, flags, flag-report, late, late-report, coach, costs, cost-report)`);
}
runMain(main);
