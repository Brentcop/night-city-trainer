// INFO-6: decision telemetry keeps the bot's own option scores (recorder option `scores`), observe-only, and the decisions
// report checks them against outcomes (src/engine/telemetry.ts ScoreRecord, src/analysis/decisions.ts calibration).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { compactScores, HeuristicAgent, type DecisionScores } from '../src/ai/heuristic';
import { DecisionRecorder, MAX_SCORED_OPTIONS, type DecisionRecord } from '../src/engine/telemetry';
import { aggregateGame, decisionMarkdown, decisionReport, marginBand, mergeAggregates } from '../src/analysis/decisions';
import type { Decision, PlayerId } from '../src/engine/types';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const A = deck('meta-rrb-wakako-midrange.txt');
const B = deck('meta-gry-trauma-team.txt');

async function play(level: string, seed: number, first: PlayerId, scores: boolean | null) {
  const bots = [makeTierBot(level, seed), makeTierBot(level, seed + 7777)] as const;
  const g = Game.create([A, B], [bots[0], bots[1]], { seed, first });
  const rec = scores === null ? null : new DecisionRecorder({ scores });
  g.telemetry = rec;
  const s = await g.run();
  return { out: { winner: s.winner, turns: s.turn, log: s.log.length, rng: s.rng, stats: s.stats }, records: rec?.finish(g) ?? [], rec, bots };
}

describe('the bot’s own scores in telemetry', () => {
  for (const [level, seed, first] of [
    ['medium', 211, 0],
    ['hard', 312, 1],
  ] as const) {
    it(`${level}: recording scores changes nothing in the game or the bots`, async () => {
      const off = await play(level, seed, first, null);
      const on = await play(level, seed, first, true);
      expect(on.out).toEqual(off.out);
      // the bots end in the same state (random stream included)
      expect(JSON.parse(JSON.stringify(on.bots))).toEqual(JSON.parse(JSON.stringify(off.bots)));
      expect(on.rec!.bots).toEqual([level, level]);
      const scored = on.records.filter((r) => r.sc);
      expect(scored.length).toBeGreaterThan(10);
      for (const r of scored) {
        const sc = r.sc!;
        expect(r.w === 'main' || r.w === 'react').toBe(true);
        expect(sc.o.length).toBeGreaterThanOrEqual(2);
        expect(sc.o.length).toBeLessThanOrEqual(MAX_SCORED_OPTIONS);
        // best first, relative to the chosen option
        for (let k = 1; k < sc.o.length; k++) expect(sc.o[k][1]).toBeLessThanOrEqual(sc.o[k - 1][1]);
        const mine = sc.o.find(([i]) => i === r.c[0]);
        if (mine) expect(mine[1]).toBe(0);
        if (sc.o[0][0] === r.c[0]) expect(Math.abs(sc.m + sc.o[1][1])).toBeLessThanOrEqual(0.1 + 1e-9);
      }
      if (level === 'hard') {
        const deep = scored.filter((r) => r.w === 'main' && r.sc!.by === 'deep' && !r.sc!.sell);
        expect(deep.length).toBeGreaterThan(5);
        expect(deep.every((r) => Number.isInteger(r.sc!.r1) && Number.isInteger(r.sc!.rd))).toBe(true);
        expect(deep.every((r) => (r.sc!.r1 === 0) === (r.sc!.rd === 0))).toBe(true);
        expect(scored.some((r) => r.w === 'react' && r.sc!.by === 'deep' && r.sc!.nw === 3)).toBe(true);
      } else expect(scored.every((r) => r.sc!.by === '1ply' && r.sc!.r1 === undefined)).toBe(true);
      // effect choices and the mulligan are decided by rules: no scores
      expect(on.records.filter((r) => r.w === 'effect' || r.w === 'mulligan').every((r) => !r.sc)).toBe(true);
    }, 120_000);
  }

  it('the plain recorder keeps no scores and no labels', async () => {
    const plain = await play('hard', 312, 1, false);
    expect(plain.records.some((r) => r.sc)).toBe(false);
    expect(plain.rec!.bots).toEqual([null, null]);
  }, 60_000);

  it('compactScores: margin, ranks and the cap; nothing for another decision', () => {
    const d = { player: 0, kind: 'action', prompt: '', options: [], min: 1, max: 1 } as unknown as Decision;
    const s: DecisionScores = {
      kind: 'main',
      scale: 'deep',
      opts: [{ i: 3, v: 10 }, { i: 1, v: 14 }, { i: 0, v: 12.04 }],
      chosen: 1,
      screen: [{ i: 0, v: 5 }, { i: 1, v: 4 }, { i: 3, v: 2 }, { i: 7, v: 1 }],
      worlds: [{ rng: 1, a: 1, b: 1 }, { rng: 2, a: 2, b: 2 }],
      d,
    };
    expect(compactScores(s, d)).toEqual({ by: 'deep', o: [[1, 0], [0, -2], [3, -4]], m: 2, r1: 1, rd: 1, nw: 2 });
    expect(compactScores(s, { ...d })).toBeNull();
    expect(compactScores({ ...s, opts: s.opts.slice(0, 1) }, d)).toBeNull();
    const many = { ...s, screen: undefined, worlds: undefined, opts: Array.from({ length: 12 }, (_, i) => ({ i, v: i })), chosen: 11 };
    expect(compactScores(many, d)!.o).toHaveLength(MAX_SCORED_OPTIONS);
    expect(new HeuristicAgent({ deep: 3, deepWorlds: 4, impact: 40 }).configLabel()).toBe('deep3 w4 imp40');
  });
});

describe('calibration section of the decisions report', () => {
  const rec = (p: PlayerId, m: number, r1?: number, w: 'main' | 'react' = 'main'): DecisionRecord =>
    ({
      i: 0,
      t: 3,
      p,
      kind: w === 'main' ? 'action' : 'reaction',
      w,
      o: [],
      n: 2,
      c: [0],
      ch: ['pass'],
      f: { me: {}, op: {}, lead: 0, active: true },
      sc: { by: 'deep', o: [[0, 0], [1, -m]], m, ...(r1 !== undefined ? { r1, rd: r1 ? 1 : 0 } : {}) },
    }) as unknown as DecisionRecord;
  const players = [{ listId: 'a', name: 'A' }, { listId: 'b', name: 'B' }] as const;

  it('outcome by claimed margin band and 1-ply against deep, by bot and decision type', () => {
    // game 1: seat 0 wins; seat 0 claimed big margins, seat 1 small ones and overturned its 1-ply pick once
    const g1 = aggregateGame({ records: [rec(0, 50, 0), rec(0, 50, 0), rec(1, 1, 2), rec(1, -3), rec(1, 8, 0, 'react')], players, winner: 0, bots: ['hard', 'hard'] });
    const g2 = aggregateGame({ records: [rec(0, 1, 1), rec(1, 50, 0)], players, winner: 1, bots: ['hard', 'hard'] });
    const agg = mergeAggregates(g1, g2);
    const main = agg.calibration!.hard['main deep'];
    expect(main.scored).toBe(6);
    expect(main.bands['1+']).toEqual({ n: 3, won: 3, games: 2 });
    expect(main.bands['0–0.05']).toEqual({ n: 2, won: 0, games: 2 });
    expect(main.bands['<0']).toEqual({ n: 1, won: 0, games: 1 });
    expect(main.kept).toEqual({ n: 3, won: 3, games: 2 });
    expect(main.overturned).toEqual({ n: 2, won: 0, games: 2 });
    expect(agg.calibration!.hard['react deep'].bands['0.15–0.5']).toEqual({ n: 1, won: 0, games: 1 });

    const r = decisionReport(agg, { minGames: 1 });
    const row = r.calibration!.find((x) => x.type === 'main deep')!;
    expect(row.bands['1+'].winRate).toBe(1);
    expect(row.bands['0–0.05'].winRate).toBe(0);
    expect(row.overturnRate).toBeCloseTo(2 / 5, 9);
    expect(row.overturned!.winRate).toBe(0);
    const md = decisionMarkdown(r);
    expect(md).toContain('## The bot’s own scores against outcomes (calibration check)');
    expect(md).toContain('Association only');
    expect(md).toContain('| hard | main deep | 6 |');
    // at the default threshold these cells are thin: counts only
    expect(decisionMarkdown(decisionReport(agg))).toContain('3 in 2 games (thin)');
  });

  it('marginBand in Gigs; a run without scores has no section', () => {
    expect(marginBand(-0.1)).toBe('<0');
    expect(marginBand(1.9)).toBe('0–0.05');
    expect(marginBand(2)).toBe('0.05–0.15');
    expect(marginBand(40)).toBe('1+');
    const plain = aggregateGame({ records: [{ ...rec(0, 5), sc: undefined }], players, winner: 0 });
    expect(plain.calibration).toBeUndefined();
    expect(decisionReport(plain).calibration).toBeUndefined();
    expect(decisionMarkdown(decisionReport(plain))).not.toContain('calibration check');
  });
});
