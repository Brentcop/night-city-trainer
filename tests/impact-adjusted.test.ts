import { describe, expect, it } from 'vitest';
import { adjustedDeck, combineLandmarks, globalTurnOf, keptVsSold, landmarkDiff, plainIwd, priorSpread, sellChoicesOf, shrink, stratifiedDiff } from '../src/analysis/impactAdjusted';
import { summarize, type PlayerSummary } from '../src/analysis/summarize';
import { lcg } from '../src/lib/rankStability';
import type { GameState, TraceEvent } from '../src/engine/types';

// Real card ids are not needed: the estimate works on any id (names fall back to the id).
const FILLER = 'test-dead-filler';
const REAL = 'test-real-card';
const OTHER = 'test-other';

/**
 * Simulated games of one deck. Game length (own turns) depends on the opponent, and the deck wins long games more often.
 * The filler card is drawn turn by turn, so it is seen more in long games, but it never changes the result. The real card
 * is either in the opening hand or never seen, and adds `effect` to the win probability when seen.
 */
function synthetic(n: number, effect: number, seed = 11): PlayerSummary[] {
  const rnd = lcg(seed);
  const opps = [
    { name: 'Fast', base: 0.45, len: [3, 6] },
    { name: 'Mid', base: 0.5, len: [4, 8] },
    { name: 'Slow', base: 0.4, len: [6, 11] },
  ] as const;
  const out: PlayerSummary[] = [];
  for (let i = 0; i < n; i++) {
    const o = opps[Math.floor(rnd() * opps.length)]!;
    const first = rnd() < 0.5;
    const L = o.len[0] + Math.floor(rnd() * (o.len[1] - o.len[0] + 1));
    const seenAt: Record<string, number> = {};
    if (rnd() < 0.1) seenAt[FILLER] = 0;
    for (let t = 1; t <= L && seenAt[FILLER] === undefined; t++) if (rnd() < 0.12) seenAt[FILLER] = globalTurnOf(t, first);
    if (rnd() < 0.4) seenAt[REAL] = 0;
    seenAt[OTHER] = 0;
    const p = o.base + (first ? 0.05 : -0.05) + (L >= 7 ? 0.2 : -0.1) + (seenAt[REAL] !== undefined ? effect : 0);
    const result = rnd() < p ? 1 : 0;
    out.push({ deck: 'D', opp: o.name, first, result, turns: globalTurnOf(L, first), seen: Object.keys(seenAt), seenAt } as unknown as PlayerSummary);
  }
  return out;
}

describe('adjusted card impact (INFO-2)', () => {
  const games = synthetic(8000, 0.15);

  it('plain IWD gives a dead filler drawn in long games a spurious effect; the landmark estimate is about 0', () => {
    const plain = plainIwd(games, FILLER).iwd;
    expect(plain).toBeGreaterThan(0.05);
    const d = adjustedDeck('D', games);
    const f = d.cards.find((c) => c.id === FILLER)!;
    expect(Math.abs(f.adj)).toBeLessThan(Math.max(0.03, 2.5 * f.se));
    expect(f.lo).toBeLessThan(0);
    expect(f.hi).toBeGreaterThan(0);
  });

  it('recovers a planted effect', () => {
    const d = adjustedDeck('D', games);
    const r = d.cards.find((c) => c.id === REAL)!;
    expect(r.adj).toBeGreaterThan(0.11);
    expect(r.adj).toBeLessThan(0.19);
    expect(r.lo).toBeGreaterThan(0.05);
    // shrinkage pulls toward 0, never past it
    expect(r.shrunk).toBeLessThanOrEqual(r.adj);
    expect(r.shrunk).toBeGreaterThan(0.1);
  });

  it('no effect at all reads as about 0 for the planted card too', () => {
    const r = adjustedDeck('D', synthetic(8000, 0, 5)).cards.find((c) => c.id === REAL)!;
    expect(Math.abs(r.adj)).toBeLessThan(Math.max(0.03, 2.5 * r.se));
  });

  it('a card seen in every game has no comparison', () => {
    expect(Number.isNaN(landmarkDiff(games, OTHER, 2).est)).toBe(true);
  });

  it('compares within strata: a stratum mix difference alone gives 0', () => {
    // exposed games all in stratum A (wins 80%), unexposed all in B (wins 20%), plus a balanced copy in each
    const rows = [
      ...Array.from({ length: 50 }, (_, i) => ({ stratum: 'A', exposed: true, result: i < 40 ? 1 : 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ stratum: 'A', exposed: false, result: i < 8 ? 1 : 0 })),
      ...Array.from({ length: 50 }, (_, i) => ({ stratum: 'B', exposed: false, result: i < 10 ? 1 : 0 })),
      ...Array.from({ length: 10 }, (_, i) => ({ stratum: 'B', exposed: true, result: i < 2 ? 1 : 0 })),
    ];
    const e = stratifiedDiff(rows);
    expect(e.est).toBeCloseTo(0, 10);
    expect(e.se).toBeGreaterThan(0);
    expect(e.n1).toBe(60);
    // the pooled difference would be far from 0
    const p1 = rows.filter((r) => r.exposed);
    const p0 = rows.filter((r) => !r.exposed);
    expect(p1.reduce((s, r) => s + r.result, 0) / p1.length - p0.reduce((s, r) => s + r.result, 0) / p0.length).toBeGreaterThan(0.35);
  });

  it('needs games on both sides', () => {
    expect(Number.isNaN(stratifiedDiff([{ stratum: 'A', exposed: true, result: 1 }, { stratum: 'A', exposed: false, result: 0 }]).est)).toBe(true);
  });

  it('combines landmarks by inverse variance and shrinks by sample size', () => {
    const c = combineLandmarks([
      { est: 0.1, se: 0.1, n1: 10, n0: 10 },
      { est: 0, se: 0.05, n1: 20, n0: 20 },
      { est: NaN, se: NaN, n1: 0, n0: 0 },
    ]);
    expect(c.est).toBeCloseTo(0.02, 10);
    expect(c.se).toBeCloseTo(0.06, 10);
    expect(shrink({ est: 0.1, se: 0.1, n1: 0, n0: 0 }, 0.1)).toBeCloseTo(0.05, 10);
    expect(shrink({ est: 0.1, se: 0.001, n1: 0, n0: 0 }, 0.1)).toBeCloseTo(0.1, 3);
    expect(priorSpread([{ est: 0, se: 0.1, n1: 0, n0: 0 }])).toBe(0.02);
  });

  it('kept vs sold: from the sell decisions of the decision records', () => {
    const rec = (p: 0 | 1, o: string[], ch: string) => ({ p, w: 'main' as const, o, ch: [ch] });
    const s = sellChoicesOf(
      [
        rec(0, ['pass', 'sell:a', 'sell:b', 'sell:c', 'play:a'], 'sell:a'),
        rec(0, ['pass', 'sell:b', 'sell:c'], 'pass'), // not a sell decision
        rec(0, ['sell:b', 'sell:c', 'sell:?'], 'sell:c'),
        rec(1, ['sell:z'], 'sell:z'),
      ],
      0,
    );
    expect(s).toEqual({ a: 1, b: 0, c: 1 });
    const g = (sellChoice: Record<string, 0 | 1>, result: 0 | 1) => ({ deck: 'D', opp: 'X', first: true, result, sellChoice }) as unknown as PlayerSummary;
    const k = keptVsSold([...Array.from({ length: 10 }, () => g({ b: 0 }, 1)), ...Array.from({ length: 10 }, () => g({ b: 1 }, 0))], 'b');
    expect(k.kept).toBe(10);
    expect(k.sold).toBe(10);
    expect(k.est).toBe(1);
  });
});

describe('summarize: when each card was first seen', () => {
  it('records the global turn of the first sighting, 0 for the kept opening hand, and forgets a mulliganed hand', () => {
    const ev = (t: number, p: 0 | 1, k: TraceEvent['k'], id?: string, x?: string): TraceEvent => ({ t, p, k, id, x });
    const s = { players: [{ name: 'A' }, { name: 'B' }], first: 0, winner: 0, turn: 3, overtime: false, winReason: 'x' } as unknown as GameState;
    const [a, b] = summarize({
      ...s,
      trace: [ev(0, 0, 'open', 'x1'), ev(0, 1, 'open', 'y1'), ev(0, 0, 'mulligan'), ev(0, 0, 'open', 'x2'), ev(2, 1, 'draw', 'y2'), ev(3, 0, 'draw', 'x1'), ev(3, 0, 'draw', 'x2')],
    } as GameState);
    expect(a.seenAt).toEqual({ x2: 0, x1: 3 });
    expect(b.seenAt).toEqual({ y1: 0, y2: 2 });
  });
});

describe('sim analyze --impact-adjusted', () => {
  it('needs --out (so the run never rewrites src/data/impact.json) and writes beside the other outputs there', async () => {
    const { analyzeFlagProblem, analyzeOutputs, protectedOutputs } = await import('../scripts/sim-flags');
    expect(analyzeFlagProblem({ 'impact-adjusted': true })).toMatch(/needs --out/);
    expect(analyzeFlagProblem({ 'impact-adjusted': true, out: 'x' })).toBeUndefined();
    const o = analyzeOutputs({ 'impact-adjusted': true, out: 'x' }, null);
    expect(o.impactAdjustedJson).toMatch(/impact-adjusted-latest\.json$/);
    expect(protectedOutputs(o, { out: 'x' })).toContain(o.impactAdjustedMd);
    expect(analyzeOutputs({}, null).impactAdjustedJson).toBeUndefined();
  });
});
