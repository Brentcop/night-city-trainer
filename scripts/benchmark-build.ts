// INFO-5: build the position benchmark (docs/BOT_TOOLKIT.md §10). Plays seeded Hard-vs-Hard games across the library,
// samples decision positions stratified by decision type (mulligan, main, sell, react, effect) and game stage, and labels
// every distinct option of each by the oracle: the option is played and the game is finished by two Medium bots, in
// shared worlds (the hidden information re-dealt from the decider's view, the bots' seeds), and the decider's win rate
// is the label. Every option is played in --worlds worlds; then the best option and those within 3 paired SE of it
// (at most 4 in all) are played in more worlds up to --max-worlds. A position where no option is distinguishable from the
// best (2 paired SE) is marked indifferent.
//   npx tsx scripts/benchmark-build.ts [--positions 300] [--games 200] [--decks all|meta|<file prefix>] [--seed 52001]
//     [--worlds 200] [--max-worlds 600] [--max-options 12] [--oracle medium] [--threads N] [--out data/benchmark/suite.json] [--force]
// Writes the suite file (data/benchmark/suite.json by default; refuses to overwrite it without --force). A position is
// stored as the game's seed, decks and the answers given before it, so the file stays small and is rebuilt by replay.
import fs from 'node:fs';
import path from 'node:path';
import { cli, int, oneOf, str, bool, threadsOpt, loadLibrary, workerPool, runMain, Refusal } from './lib-node';
import { BENCH_KINDS, BENCH_STAGES, encodeAnswers, groupReps, worldRandom, type BenchKind, type BenchSuite, type GameRef, type PositionMeta, type SuiteGame, type SuitePosition } from '../src/ai/benchmark';
import { makeWorlds } from '../src/ai/playOut';
import { contenders, packOutcomes, positionStats, BEST_Z } from '../src/lib/benchmarkStats';
import { SIM_VERSION } from '../src/lib/tournament';
import { deckFingerprint } from '../src/engine/deck';
import type { BenchJob, BenchResult } from './benchmark-worker';
import type { DeckList, PlayerId } from '../src/engine/types';

const { values: V } = cli(import.meta.url, {
  positions: int(300, { min: 5 }),
  games: int(200, { min: 2 }),
  decks: str('all', (v) => (/^[\w.-]+$/.test(v) ? undefined : 'a deck set: meta, all, or a file-name prefix')),
  seed: int(52001),
  worlds: int(200, { min: 10 }),
  'max-worlds': int(600, { min: 10 }),
  'max-options': int(12, { min: 2 }),
  oracle: oneOf(['easy', 'medium', 'hard'], 'medium'),
  threads: threadsOpt(),
  out: str('data/benchmark/suite.json'),
  force: bool(),
});

/** Share of the positions per decision type. */
const QUOTA: Record<BenchKind, number> = { mulligan: 0.12, main: 0.26, sell: 0.18, react: 0.16, effect: 0.28 };
/** At most this many positions from one game. */
const PER_GAME = 3;
const CHUNK = 25;
const CONTENDER_Z = 3;
const CONTENDERS = 4;

const BOOT = new URL('./benchmark-boot.mjs', import.meta.url);

runMain(async () => {
  if (fs.existsSync(V.out) && !V.force) throw new Refusal(`${V.out} exists; pass --force to rebuild it (positions and labels change).`);
  if (V['max-worlds'] < V.worlds) throw new Refusal('--max-worlds must be at least --worlds');
  const lib = loadLibrary();
  const base = (f: string) => f.slice(f.lastIndexOf('/') + 1);
  const field = V.decks === 'meta' ? lib.filter((d) => d.kind === 'meta') : V.decks === 'all' ? lib : lib.filter((d) => base(d.file).startsWith(V.decks));
  if (field.length < 2) throw new Refusal(`--decks ${V.decks} matches ${field.length} decks; at least 2 are needed`);

  const pool = workerPool<BenchJob, BenchResult>(BOOT, V.threads);
  const t0 = Date.now();
  const fail = (r: BenchResult) => {
    if (r.type === 'error') throw new Error(r.error);
    return r;
  };
  try {
    // 1. sample games
    const rnd = worldRandom(V.seed);
    const games: { a: DeckList; b: DeckList; seed: number; first: PlayerId }[] = [];
    for (let i = 0; i < V.games; i++) {
      const x = Math.floor(rnd() * field.length);
      let y = Math.floor(rnd() * (field.length - 1));
      if (y >= x) y++;
      games.push({ a: field[x]!.deck, b: field[y]!.deck, seed: V.seed + i, first: (i % 2) as PlayerId });
    }
    let done = 0;
    const sampled = await Promise.all(
      games.map((g) =>
        pool.run({ type: 'sample', ...g, bot: 'hard' }).then((r) => {
          if (++done % 10 === 0) process.stderr.write(`\r  sampled ${done}/${games.length} games`);
          return fail(r) as Extract<BenchResult, { type: 'sample' }>;
        }),
      ),
    );
    process.stderr.write('\n');
    const sampleSeconds = (Date.now() - t0) / 1000;

    // 2. choose positions: per type a quota, filled round-robin over stages from shuffled candidates, PER_GAME per game
    const cands: { gi: number; m: PositionMeta }[] = [];
    let tooMany = 0;
    sampled.forEach((s, gi) =>
      s.metas.forEach((m) => {
        if (groupReps(m.groups).length > V['max-options']) tooMany++;
        else cands.push({ gi, m });
      }),
    );
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cands[i], cands[j]] = [cands[j]!, cands[i]!];
    }
    const perGame = new Map<number, number>();
    const chosen: { gi: number; m: PositionMeta }[] = [];
    for (const kind of BENCH_KINDS) {
      const want = Math.round(V.positions * QUOTA[kind]);
      const byStage = BENCH_STAGES.map((st) => cands.filter((c) => c.m.kind === kind && c.m.stage === st));
      let got = 0;
      for (let progress = true; got < want && progress; ) {
        progress = false;
        for (const list of byStage) {
          if (got >= want) break;
          const at = list.findIndex((c) => (perGame.get(c.gi) ?? 0) < PER_GAME);
          if (at < 0) continue;
          const [c] = list.splice(at, 1);
          chosen.push(c!);
          perGame.set(c!.gi, (perGame.get(c!.gi) ?? 0) + 1);
          got++;
          progress = true;
        }
      }
    }
    chosen.sort((x, y) => x.gi - y.gi || x.m.k - y.m.k);
    console.log(`${sampled.length} Hard games (${(sampleSeconds).toFixed(0)} s), ${cands.length + tooMany} candidate positions (${tooMany} with more than ${V['max-options']} distinct options left out); chose ${chosen.length}`);

    // 3. the suite's games and positions
    const decks: Record<string, DeckList> = {};
    const gameIndex = new Map<number, number>();
    const suiteGames: SuiteGame[] = [];
    const refs: GameRef[] = [];
    for (const c of chosen) {
      if (gameIndex.has(c.gi)) continue;
      const g = games[c.gi]!;
      const s = sampled[c.gi]!;
      const last = Math.max(...chosen.filter((x) => x.gi === c.gi).map((x) => x.m.k));
      const ka = deckFingerprint(g.a);
      const kb = deckFingerprint(g.b);
      decks[ka] = g.a;
      decks[kb] = g.b;
      gameIndex.set(c.gi, suiteGames.length);
      const answers = s.answers.slice(0, last);
      suiteGames.push({ id: `s${g.seed}`, a: ka, b: kb, seed: g.seed, first: g.first, answers: encodeAnswers(answers) });
      refs.push({ decks: [g.a, g.b], seed: g.seed, first: g.first, answers });
    }

    // 4. label: every option in the first --worlds worlds, then the contenders up to --max-worlds
    const t1 = Date.now();
    const positions = chosen.map((c, i) => ({ c, gi: gameIndex.get(c.gi)!, worldSeed: (V.seed * 7919 + i * 104729) >>> 0, out: new Map<number, number[]>(groupReps(c.m.groups).map((o) => [o, []])) }));
    const label = async (todo: { pi: number; opts: number[]; from: number; to: number }[]) => {
      let n = 0;
      const total = todo.length;
      await Promise.all(
        todo.map(async (t) => {
          const P = positions[t.pi]!;
          const worlds = makeWorlds(t.to, worldRandom(P.worldSeed)).slice(t.from, t.to);
          const r = fail(await pool.run({ type: 'label', ref: refs[P.gi]!, k: P.c.m.k, labels: P.c.m.labels, opts: t.opts, worlds, oracle: V.oracle })) as Extract<BenchResult, { type: 'label' }>;
          // chunks of one position arrive in any order: place each at its world index
          t.opts.forEach((o, j) => {
            const xs = P.out.get(o)!;
            r.out[j]!.forEach((v, w) => (xs[t.from + w] = v));
          });
          if (++n % 20 === 0 || n === total) process.stderr.write(`\r  labelled ${n}/${total} chunks  ${((Date.now() - t1) / 1000).toFixed(0)} s`);
        }),
      );
      process.stderr.write('\n');
    };
    const chunks = (pi: number, opts: number[], from: number, to: number) => {
      const out: { pi: number; opts: number[]; from: number; to: number }[] = [];
      for (let w = from; w < to; w += CHUNK) out.push({ pi, opts, from: w, to: Math.min(to, w + CHUNK) });
      return out;
    };
    await label(positions.flatMap((P, pi) => chunks(pi, [...P.out.keys()], 0, V.worlds)));
    if (V['max-worlds'] > V.worlds) {
      const more = positions.flatMap((P, pi) => chunks(pi, contenders(positionStats(P.out), CONTENDER_Z, CONTENDERS), V.worlds, V['max-worlds']));
      await label(more);
    }
    const labelSeconds = Math.round((Date.now() - t1) / 1000);

    const suitePositions: SuitePosition[] = positions.map((P) => {
      const st = positionStats(P.out);
      const m = P.c.m;
      const g = suiteGames[P.gi]!;
      return {
        id: `${g.id}-d${m.k}`,
        game: P.gi,
        k: m.k,
        p: m.p,
        turn: m.turn,
        kind: m.kind,
        stage: m.stage,
        dk: m.dk,
        ...(m.tag ? { tag: m.tag } : {}),
        labels: m.labels,
        groups: m.groups,
        worldSeed: P.worldSeed,
        out: Object.fromEntries([...P.out].map(([o, xs]) => [String(o), packOutcomes(xs)])),
        n: Object.fromEntries([...P.out].map(([o, xs]) => [String(o), xs.length])),
        wr: Object.fromEntries(st.options.map((o) => [String(o.opt), Math.round(o.wr * 1000) / 1000])),
        best: st.best,
        seBestSecond: st.seBestSecond === null ? null : Math.round(st.seBestSecond * 10000) / 10000,
        indifferent: st.indifferent,
      };
    });
    const suite: BenchSuite = {
      schema: 1,
      kind: 'nct-benchmark',
      built: new Date().toISOString().slice(0, 10),
      simVersion: SIM_VERSION,
      source: { bot: 'hard', decks: V.decks, games: V.games, seed: V.seed },
      oracle: { bot: V.oracle, worlds: V.worlds, maxWorlds: V['max-worlds'], contenders: CONTENDERS, contenderZ: CONTENDER_Z, bestZ: BEST_Z, maxOptions: V['max-options'], labelSeconds },
      decks,
      games: suiteGames,
      positions: suitePositions,
    };
    fs.mkdirSync(path.dirname(V.out), { recursive: true });
    const text = JSON.stringify(suite) + '\n';
    fs.writeFileSync(V.out, text);

    // report
    const ses = suitePositions.map((p) => p.seBestSecond ?? 0).sort((a, b) => a - b);
    const q = (f: number) => ses[Math.min(ses.length - 1, Math.floor(f * ses.length))] ?? 0;
    const indiff = suitePositions.filter((p) => p.indifferent).length;
    const playOuts = positions.reduce((s, P) => s + [...P.out.values()].reduce((t, xs) => t + xs.length, 0), 0);
    console.log(`wrote ${V.out} (${(text.length / 1024).toFixed(0)} KB): ${suitePositions.length} positions from ${suiteGames.length} games`);
    console.log(`labelling: ${playOuts} play-outs in ${labelSeconds} s (${V.threads} threads); total ${((Date.now() - t0) / 1000).toFixed(0)} s`);
    console.log(`best-vs-second paired SE (win-rate points): median ${(100 * q(0.5)).toFixed(1)}, p90 ${(100 * q(0.9)).toFixed(1)}; indifferent ${indiff} of ${suitePositions.length} (${((100 * indiff) / suitePositions.length).toFixed(0)}%)`);
    for (const kind of BENCH_KINDS) {
      const ps = suitePositions.filter((p) => p.kind === kind);
      console.log(`  ${kind.padEnd(8)} ${String(ps.length).padStart(4)} positions, ${ps.filter((p) => p.indifferent).length} indifferent; by stage ${BENCH_STAGES.map((s) => `${s} ${ps.filter((p) => p.stage === s).length}`).join(', ')}`);
    }
  } finally {
    await pool.close();
  }
});
