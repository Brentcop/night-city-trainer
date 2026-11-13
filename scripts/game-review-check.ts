// Measures the Game review's ratings (src/lib/gameReview.ts) on fresh games: a Medium bot plays the "player" seat
// against Hard, as a recorded practice game, and each game is reviewed twice, with the default oracle seed and another
// one. Reports the ratings per side, Inspired / Sharp per game, review time, and how often a rating moves by more
// than one step on the re-run (docs/BOT_TOOLKIT.md §8).
//
//   npx tsx scripts/game-review-check.ts [--games 20] [--rollouts 8] [--seed 1] [--threads N] [--out DIR]
//
// --out writes the reviews as JSON into DIR (nothing is written otherwise).
import fs from 'node:fs';
import path from 'node:path';
import { cli, int, loadLibrary, runMain, str, threadsOpt, workerPool } from './lib-node';
import { gameDeck } from '../src/lib/tournament';
import { Game } from '../src/engine/engine';
import { makeTierBot } from '../src/ai/tiers';
import type { Agent, Decision } from '../src/engine/types';
import type { ReviewJob } from './review-worker';
import { counts, RATING_INFO, RATINGS, ratingStep, seatSummary, type GameReviewRecord, type Rating } from '../src/lib/gameReview';
import type { PracticeReviewSpec } from '../src/sim/practiceReview';

const { values: V } = cli(import.meta.url, {
  games: int(20, { min: 1 }),
  rollouts: int(8, { min: 1 }),
  seed: int(1, { min: 0 }),
  threads: threadsOpt(),
  out: str(),
});

class Recorder implements Agent {
  name: string;
  choices: number[][] = [];
  choosesPayment?: boolean;
  choosesOrder?: boolean;
  constructor(private inner: Agent) {
    this.name = inner.name;
    this.choosesPayment = inner.choosesPayment;
    this.choosesOrder = inner.choosesOrder;
  }
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

let st = V.seed * 2654435761;
const rnd = () => ((st = (st * 1664525 + 1013904223) >>> 0) / 4294967296);

/** A Medium player's game against Hard, recorded as a practice game. */
async function playOne(k: number): Promise<{ id: string; spec: PracticeReviewSpec }> {
  const meta = loadLibrary().filter((d) => d.kind === 'meta');
  const a = meta[Math.floor(rnd() * meta.length)]!;
  const b = meta[Math.floor(rnd() * meta.length)]!;
  const seed = 810_000 + V.seed * 1000 + k;
  const botSeed = seed + 5;
  const first = (k % 2) as 0 | 1;
  const me = new Recorder(makeTierBot('medium', seed + 3));
  const decks = [gameDeck(a.deck), gameDeck(b.deck)] as [ReturnType<typeof gameDeck>, ReturnType<typeof gameDeck>];
  await Game.create(decks, [me, makeTierBot('hard', botSeed, 'Bot')], { seed, first, log: false }).run();
  return { id: `g${seed}`, spec: { decks, seed, first, botLevel: 'hard', botSeed, choices: me.choices, payChoice: !!me.choosesPayment, orderChoice: !!me.choosesOrder } };
}

async function main() {
  const games: { id: string; spec: PracticeReviewSpec }[] = [];
  for (let k = 0; k < V.games; k++) games.push(await playOne(k));
  console.log(`${games.length} Medium-vs-Hard games played; reviewing each twice (${V.rollouts} play-outs per candidate, ${V.threads} threads)`);
  const pool = workerPool<ReviewJob, { id: string; game?: GameReviewRecord; ms?: number; error?: string }>(new URL('./review-boot.mjs', import.meta.url), Math.min(V.threads, games.length * 2));
  const made = new Date().toISOString();
  const job = (g: (typeof games)[number], oracleSeed: number | undefined, tag: string): ReviewJob => ({
    id: `${g.id}-${tag}`,
    decks: g.spec.decks,
    seed: g.spec.seed,
    bots: ['you', 'hard'],
    rollouts: V.rollouts,
    withCoach: false,
    game: { id: g.id, spec: g.spec, coach: [], rollouts: V.rollouts, made, ...(oracleSeed !== undefined ? { oracleSeed } : {}) },
  });
  let done = 0;
  const t0 = Date.now();
  const run = (j: ReviewJob) =>
    pool.run(j).then((r) => {
      done++;
      process.stderr.write(`\r  ${done}/${games.length * 2} reviews  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
      if (r.error || !r.game) throw new Error(`${j.id}: ${r.error}`);
      return r.game;
    });
  let pairs: [GameReviewRecord, GameReviewRecord][];
  try {
    pairs = await Promise.all(games.map(async (g) => [await run(job(g, undefined, 'a')), await run(job(g, g.spec.seed + 99_991, 'b'))] as [GameReviewRecord, GameReviewRecord]));
  } finally {
    await pool.close();
  }
  process.stderr.write('\n');
  if (V.out) {
    fs.mkdirSync(V.out, { recursive: true });
    fs.writeFileSync(path.join(V.out, 'game-reviews.json'), JSON.stringify(pairs));
  }
  const first = pairs.map((p) => p[0]);
  // distribution per side (first run)
  const tally = (p: 0 | 1) => {
    const n = Object.fromEntries([...RATINGS, 'forced', 'unclear'].map((k) => [k, 0])) as Record<Rating, number>;
    const acc: number[] = [];
    for (const r of first) {
      const s = seatSummary(r.moves, p, r.forced[p]);
      for (const k of Object.keys(n) as Rating[]) n[k] += s.n[k];
      if (s.accuracy !== null) acc.push(s.accuracy);
    }
    return { n, acc };
  };
  const lines = [`| | ${[...RATINGS, 'unclear', 'forced'].map((k) => RATING_INFO[k as Rating].label).join(' | ')} | accuracy (mean) |`, `|---|${'---|'.repeat(RATINGS.length + 3)}`];
  for (const p of [0, 1] as const) {
    const { n, acc } = tally(p);
    const total = RATINGS.reduce((a, k) => a + n[k], 0) + n.unclear;
    lines.push(`| ${p === 0 ? 'Player (Medium)' : 'Rival (Hard)'} | ${[...RATINGS, 'unclear', 'forced'].map((k) => `${n[k as Rating]}${k !== 'forced' ? ` (${((100 * n[k as Rating]) / Math.max(1, total)).toFixed(1)}%)` : ''}`).join(' | ')} | ${(acc.reduce((a, x) => a + x, 0) / Math.max(1, acc.length)).toFixed(1)} |`);
  }
  console.log(lines.join('\n'));
  const per = (p: 0 | 1, ks: Rating[]) => first.reduce((a, r) => a + r.moves.filter((m) => m.p === p && ks.includes(m.r)).length, 0) / first.length;
  console.log(`\nPer game: player Inspired ${per(0, ['inspired']).toFixed(2)}, Sharp ${per(0, ['sharp']).toFixed(2)}; rival Inspired ${per(1, ['inspired']).toFixed(2)}, Sharp ${per(1, ['sharp']).toFixed(2)}`);
  const ms = first.map((r) => r.ms).sort((a, b) => a - b);
  console.log(`Review time (one thread each): median ${(ms[Math.floor(ms.length / 2)]! / 1000).toFixed(1)} s, max ${(ms[ms.length - 1]! / 1000).toFixed(1)} s; decisions rated per game ${(first.reduce((a, r) => a + r.moves.length, 0) / first.length).toFixed(1)}`);
  // stability: same decision (seat, answer number), both runs
  let both = 0;
  let within = 0;
  let same = 0;
  let countedBoth = 0;
  let withinCounted = 0;
  const moved: string[] = [];
  for (const [a, b] of pairs) {
    const bm = new Map(b.moves.map((m) => [`${m.p}:${m.at}`, m]));
    for (const m of a.moves) {
      const o = bm.get(`${m.p}:${m.at}`);
      if (!o) continue;
      const x = ratingStep(m.r);
      const y = ratingStep(o.r);
      if (x === null || y === null) continue;
      both++;
      if (m.r === o.r) same++;
      if (Math.abs(x - y) <= 1) within++;
      else if (moved.length < 12) moved.push(`${m.chosen}: ${m.r} (${m.gap}±${m.se}) vs ${o.r} (${o.gap}±${o.se})`);
      if (counts(m.r) && counts(o.r)) {
        countedBoth++;
        if (Math.abs(x - y) <= 1) withinCounted++;
      }
    }
  }
  console.log(`\nRe-run with another oracle seed: ${both} decisions rated both times; same rating ${((100 * same) / both).toFixed(1)}%, within one step ${((100 * within) / both).toFixed(1)}% (counted by both runs: ${((100 * withinCounted) / Math.max(1, countedBoth)).toFixed(1)}% of ${countedBoth})`);
  if (moved.length) console.log(`Examples that moved more than one step:\n  ${moved.join('\n  ')}`);
}
runMain(main);
