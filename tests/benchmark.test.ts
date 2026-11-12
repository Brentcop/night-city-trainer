// INFO-5: the position benchmark (src/ai/benchmark.ts, src/lib/benchmarkStats.ts, data/benchmark/suite.json). The suite
// loads, positions rebuild by replay to their recorded options, the oracle reproduces a recorded label, and the report
// maths is right on small fixtures. The benchmark itself (scripts/benchmark.ts) is not run here.
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { makeTierBot } from '../src/ai/tiers';
import { benchKind, decodeAnswers, encodeAnswers, GameRecorder, groupReps, optionGroups, oracleOutcome, pauseAt, positionOutcomes, suiteRef, worldRandom, type BenchSuite } from '../src/ai/benchmark';
import { makeWorlds } from '../src/ai/playOut';
import { contenders, packOutcomes, pairedRegret, positionStats, regretDifference, summarizeRegret, unpackOutcomes, type PickRow } from '../src/lib/benchmarkStats';
import { loadLibrary } from '../scripts/lib-node';

const SUITE = 'data/benchmark/suite.json';
const suite = JSON.parse(fs.readFileSync(SUITE, 'utf8')) as BenchSuite;

describe('the suite file', () => {
  it('loads, is small, and every position is labelled for every distinct option', () => {
    expect(suite.kind).toBe('nct-benchmark');
    expect(suite.schema).toBe(1);
    expect(fs.statSync(SUITE).size).toBeLessThan(1024 * 1024);
    expect(suite.positions.length).toBeGreaterThanOrEqual(100);
    const ids = new Set(suite.positions.map((p) => p.id));
    expect(ids.size).toBe(suite.positions.length);
    for (const p of suite.positions) {
      expect(Object.keys(p.out).map(Number).sort((a, b) => a - b)).toEqual(groupReps(p.groups));
      const st = positionStats(positionOutcomes(p), suite.oracle.bestZ);
      expect(st.best).toBe(p.best);
      expect(st.indifferent).toBe(p.indifferent);
    }
  });
});

describe('rebuilding positions', () => {
  // spread over the file: different games, kinds and stages
  const sample = [0, 1, 2, 3, 4, 5].map((k) => suite.positions[Math.floor((k * (suite.positions.length - 1)) / 5)]!);

  it('a replay reaches each position with the recorded options, the same way twice', async () => {
    for (const pos of sample) {
      for (let rep = 0; rep < 2; rep++) {
        const at = await pauseAt(suiteRef(suite, pos), pos.k);
        expect(at.d.player).toBe(pos.p);
        expect(at.g.s.turn).toBe(pos.turn);
        expect(at.d.options.map((o) => o.label)).toEqual(pos.labels);
        expect(optionGroups(at.g, at.d)).toEqual(pos.groups);
        expect(benchKind(at.d)).toBe(pos.kind);
      }
    }
  });

  it('the oracle reproduces a recorded play-out', async () => {
    const pos = sample[1]!;
    const ref = suiteRef(suite, pos);
    const worlds = makeWorlds(2, worldRandom(pos.worldSeed));
    const out = positionOutcomes(pos);
    for (const opt of groupReps(pos.groups).slice(0, 2))
      for (const [w, world] of worlds.entries()) expect(await oracleOutcome(ref, pos.k, opt, world, suite.oracle.bot)).toBe(out.get(opt)![w]);
  }, 60_000);

  it('recording a game does not change it, and its answers replay it', async () => {
    const meta = loadLibrary().filter((d) => d.kind === 'meta');
    const decks = [meta[0]!.deck, meta[1]!.deck] as [typeof meta[0]['deck'], typeof meta[0]['deck']];
    const plain = await Game.create(decks, [makeTierBot('medium', 11), makeTierBot('medium', 11 + 7777)], { seed: 11, first: 1, log: false }).run();
    const rec = new GameRecorder([makeTierBot('medium', 11), makeTierBot('medium', 11 + 7777)]);
    const s = await Game.create(decks, rec.agents, { seed: 11, first: 1, log: false }).run();
    expect([s.winner, s.turn]).toEqual([plain.winner, plain.turn]);
    expect(decodeAnswers(encodeAnswers(rec.answers))).toEqual(rec.answers);
    const k = rec.answers.length - 1;
    const at = await pauseAt({ decks, seed: 11, first: 1, answers: rec.answers }, k);
    expect(at.d.options.map((o) => o.label)).toEqual(rec.metas[k]!.labels);
  }, 60_000);
});

describe('report maths', () => {
  it('packs scores three to a character', () => {
    const xs = [1, 0, 0.5, 1, 1, 0, 0.5];
    const s = packOutcomes(xs);
    expect(s.length).toBe(3);
    expect(unpackOutcomes(s, xs.length)).toEqual(xs);
    expect(() => packOutcomes([0.3])).toThrow();
  });

  it('regret is paired, world by world', () => {
    // best wins 3 of 4, the other 1 of 4, in the same worlds: regret 0.5; diffs (1, 0, 1, 0): SE = sd/√n = 0.57735/2
    const r = pairedRegret([1, 1, 1, 0], [0, 1, 0, 0]);
    expect(r.regret).toBeCloseTo(0.5, 12);
    expect(r.se).toBeCloseTo(Math.sqrt(1 / 3) / 2, 12);
    // an option played in fewer worlds is compared over those only
    expect(pairedRegret([1, 0, 0, 0], [0, 0]).regret).toBeCloseTo(0.5, 12);
  });

  it('position stats: the best, the best set, indifference, contenders', () => {
    const clear = positionStats(
      new Map([
        [0, [1, 1, 1, 1, 1, 1, 1, 1]],
        [2, [0, 0, 0, 0, 0, 0, 0, 0]],
        [3, [1, 1, 1, 1, 1, 1, 1, 0]],
      ]),
    );
    expect(clear.best).toBe(0);
    expect(clear.indifferent).toBe(false);
    expect(clear.options.find((o) => o.opt === 2)).toMatchObject({ regret: 1, se: 0, best: false });
    expect(clear.options.find((o) => o.opt === 3)!.best).toBe(true); // 1/8 behind, SE 0.125: within 2 SE
    expect(clear.second).toBe(3);
    expect(contenders(clear)).toEqual([0, 3]);
    // the best is chosen among the options played in the most worlds
    const partial = positionStats(
      new Map([
        [0, [0, 0, 0, 0]],
        [1, [1, 1]],
      ]),
    );
    expect(partial.best).toBe(0);
    const same = positionStats(
      new Map([
        [0, [1, 0, 1]],
        [1, [1, 0, 1]],
      ]),
    );
    expect(same.indifferent).toBe(true);
  });

  it('summaries leave indifferent positions out of the mean and pair two bots', () => {
    const row = (regret: number, best: boolean, indifferent = false): PickRow => ({ kind: 'main', stage: 'mid', regret, best, indifferent });
    const a = [row(0.1, false), row(0, true), row(0.2, false), row(0.3, false, true)];
    const b = [row(0, true), row(0, true), row(0.1, false), row(0, true, true)];
    const s = summarizeRegret(a);
    expect(s).toMatchObject({ positions: 4, indifferent: 1, counted: 3 });
    expect(s.mean).toBeCloseTo(0.1, 12);
    expect(s.bestShare).toBeCloseTo(1 / 3, 12);
    // mean 0.1, sample SD 0.1, SE 0.1/√3
    expect(s.upper - s.mean).toBeCloseTo((1.96 * 0.1) / Math.sqrt(3), 12);
    const d = regretDifference(a, b);
    expect(d.positions).toBe(3);
    expect(d.mean).toBeCloseTo(0.2 / 3, 12);
  });
});
