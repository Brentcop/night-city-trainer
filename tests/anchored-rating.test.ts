// The provisional rating (src/lib/anchoredRating.ts, src/lib/yourStats.ts): the recorded decks' ratings and h held
// fixed, the unrated decks fitted jointly by MAP with the recorded prior, the expected win rate against the recorded field
// with a 90% range by the delta method, connected or not, and only Hard-bot games on the current simulator. Small cases
// worked by hand. Also the copy-of-a-library-list match (src/lib/listTwin.ts). The honesty of the range was measured on
// the recorded events (numbers in the module header).
import { describe, expect, it } from 'vitest';
import { fitAnchored, hFromEdge } from '../src/lib/anchoredRating';
import { provisionalRatings, ratedGamesByList } from '../src/lib/yourStats';
import { addRun, emptyLedger, type LedgerRun } from '../src/lib/runLedger';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { libraryTwin, listOf } from '../src/lib/listTwin';
import { BUILTIN } from '../src/lib/browserLibrary';
import { RATINGS } from '../src/data/index';
import type { RatedGame } from '../src/lib/ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));
/** Solve f(u) = 0 for an increasing-to-decreasing score function by bisection (f decreasing in u). */
function root(f: (u: number) => number): number {
  let lo = -10;
  let hi = 10;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(mid) > 0) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}
const g = (a: string, b: string, first: 0 | 1, s: number): RatedGame => ({ a, b, first, s });

describe('anchored fit: one unrated deck against fixed ratings', () => {
  it('even record against an average anchor: rating 0, sd from the information plus the prior', () => {
    const [x] = fitAnchored({ anchors: [{ key: 'A', rating: 0 }], h: 0, games: [g('X', 'A', 0, 1), g('X', 'A', 1, 0)] });
    expect(x!.rating).toBeCloseTo(0, 9);
    // information 2 · ¼ plus the prior's 1
    expect(x!.sd).toBeCloseTo(1 / Math.sqrt(1.5), 9);
    expect(x!.wr).toBeCloseTo(0.5, 9);
    expect(x!.lo).toBeCloseTo(σ(-1.645 / Math.sqrt(1.5)), 9);
    expect(x!.hi).toBeCloseTo(σ(1.645 / Math.sqrt(1.5)), 9);
    expect(x!.sdWr).toBeCloseTo(0.25 / Math.sqrt(1.5), 9);
    expect(x!.games).toBe(2);
    expect(x!.connected).toBe(true);
  });

  it('three wins against an anchor rated 0.5, with the going-first term: the MAP equation by hand', () => {
    const h = 0.3;
    // X first in two games, second in one; d log posterior / du = Σ (s − p) − u
    const games = [g('X', 'A', 0, 1), g('A', 'X', 1, 0), g('X', 'A', 1, 1)];
    const [x] = fitAnchored({ anchors: [{ key: 'A', rating: 0.5 }], h, games });
    const u = root((u) => 1 - σ(u - 0.5 + h) + (1 - σ(u - 0.5 + h)) + (1 - σ(u - 0.5 - h)) - u);
    expect(x!.rating).toBeCloseTo(u, 8);
    const w = (p: number) => p * (1 - p);
    expect(x!.sd).toBeCloseTo(1 / Math.sqrt(1 + 2 * w(σ(u - 0.5 + h)) + w(σ(u - 0.5 - h))), 8);
    // against a field of one anchor, the expected win rate is σ(u − 0.5), with h left out
    expect(x!.wr).toBeCloseTo(σ(u - 0.5), 9);
  });

  it('games between two recorded decks change nothing; a tie is half a win', () => {
    const base = { anchors: [{ key: 'A', rating: 0.2 }, { key: 'B', rating: -0.4 }], h: 0.1 };
    const own = [g('X', 'A', 0, 0.5), g('B', 'X', 0, 0)];
    const [a] = fitAnchored({ ...base, games: own });
    const [b] = fitAnchored({ ...base, games: [...own, g('A', 'B', 0, 1), g('A', 'B', 1, 0)] });
    expect(b).toEqual(a);
    // the field is both anchors
    expect(a!.wr).toBeCloseTo((σ(a!.rating - 0.2) + σ(a!.rating + 0.4)) / 2, 12);
  });
});

describe('anchored fit: lists with no games, lists that met only unrated lists, several together', () => {
  it('a list with no games gets the prior and is not connected', () => {
    const [x] = fitAnchored({ anchors: [{ key: 'A', rating: 1 }, { key: 'B', rating: -1 }], h: 0, games: [], unrated: ['X'] });
    expect(x).toMatchObject({ key: 'X', rating: 0, games: 0, connected: false });
    expect(x!.sd).toBeCloseTo(1, 12);
    expect(x!.wr).toBeCloseTo((σ(-1) + σ(1)) / 2, 12);
  });

  it('a list that met only another unrated list is connected exactly when that one met a recorded deck', () => {
    const anchors = [{ key: 'A', rating: 0 }];
    const lone = fitAnchored({ anchors, h: 0, games: [g('X', 'Y', 0, 1), g('Y', 'X', 0, 1)] });
    expect(lone.map((r) => r.connected)).toEqual([false, false]);
    const chain = fitAnchored({ anchors, h: 0, games: [g('X', 'Y', 0, 1), g('Y', 'A', 0, 1)] });
    expect(Object.fromEntries(chain.map((r) => [r.key, r.connected]))).toEqual({ X: true, Y: true });
  });

  it('several unrated lists are fitted jointly: the gradient is zero and the covariance is the inverse Hessian', () => {
    const anchors = [{ key: 'A', rating: 0.4 }, { key: 'B', rating: -0.3 }];
    const h = 0.2;
    const games = [g('X', 'A', 0, 1), g('X', 'B', 1, 1), g('Y', 'A', 0, 0), g('Y', 'B', 1, 0.5), g('X', 'Y', 0, 1), g('Y', 'X', 0, 1), g('X', 'Y', 1, 0)];
    const rows = fitAnchored({ anchors, h, games });
    const r = Object.fromEntries(rows.map((x) => [x.key, x.rating])) as Record<string, number>;
    const R = (k: string) => r[k] ?? anchors.find((a) => a.key === k)!.rating;
    const grad = { X: -r.X!, Y: -r.Y! } as Record<string, number>;
    let hXX = 1;
    let hYY = 1;
    let hXY = 0;
    for (const x of games) {
      const p = σ(R(x.a) - R(x.b) + (x.first === 0 ? h : -h));
      if (x.a in grad) grad[x.a]! += x.s - p;
      if (x.b in grad) grad[x.b]! -= x.s - p;
      const w = p * (1 - p);
      if (x.a === 'X' || x.b === 'X') hXX += w;
      if (x.a === 'Y' || x.b === 'Y') hYY += w;
      if ((x.a === 'X' && x.b === 'Y') || (x.a === 'Y' && x.b === 'X')) hXY -= w;
    }
    expect(Math.abs(grad.X!)).toBeLessThan(1e-9);
    expect(Math.abs(grad.Y!)).toBeLessThan(1e-9);
    const det = hXX * hYY - hXY * hXY;
    expect(rows.find((x) => x.key === 'X')!.sd).toBeCloseTo(Math.sqrt(hYY / det), 9);
    expect(rows.find((x) => x.key === 'Y')!.sd).toBeCloseTo(Math.sqrt(hXX / det), 9);
    // fitting them one at a time (each with the other held at its joint value) gives the same ratings
    const [xAlone] = fitAnchored({ anchors: [...anchors, { key: 'Y', rating: r.Y! }], h, games });
    expect(xAlone!.rating).toBeCloseTo(r.X!, 8);
  });

  it('a lopsided record stays finite (the prior holds it)', () => {
    const [x] = fitAnchored({ anchors: [{ key: 'A', rating: 0 }], h: 0, games: Array.from({ length: 30 }, (_, i) => g('X', 'A', (i % 2) as 0 | 1, 1)) });
    expect(Number.isFinite(x!.rating)).toBe(true);
    expect(x!.rating).toBeGreaterThan(2);
    expect(x!.hi).toBeLessThan(1);
  });

  it('h from the recorded first-player edge', () => {
    expect(σ(hFromEdge(RATINGS.firstPlayerEdge)) - 0.5).toBeCloseTo(RATINGS.firstPlayerEdge, 12);
    expect(hFromEdge(0)).toBe(0);
  });
});

describe('provisional ratings from your tournaments', () => {
  const recorded = [
    { name: 'R1', list: 'r1', rating: 0.5, wrField: 0.62 },
    { name: 'R2', list: 'r2', rating: 0, wrField: 0.5 },
    { name: 'R3', list: 'r3', rating: -0.5, wrField: 0.38 },
  ];
  const run = (id: string, o: Partial<LedgerRun>): LedgerRun => ({
    id,
    date: '2026-11-14T00:00:00Z',
    simVersion: CURRENT_SIM_VERSION,
    bot: 'hard',
    format: 'Swiss',
    decks: [
      { name: 'Mine', list: 'mine' },
      { name: 'R1', list: 'r1' },
      { name: 'R2', list: 'r2' },
      { name: 'Island', list: 'island' },
      { name: 'Island 2', list: 'island2' },
    ],
    games: [],
    champion: null,
    ...o,
  });
  const wins = (a: number, b: number, n: number, s: 0 | 1 = 1) => Array.from({ length: n }, (_, i) => [a, b, (i % 2) as 0 | 1, s] as LedgerRun['games'][number]);

  it('reads only Hard-bot games on the current simulator, between different lists', () => {
    let l = addRun(emptyLedger(), run('hard', { games: [...wins(0, 1, 12), ...wins(0, 2, 12, 0), ...wins(1, 2, 5)] }));
    l = addRun(l, run('medium', { bot: 'medium', games: wins(0, 1, 40, 0) }));
    l = addRun(l, run('old', { simVersion: CURRENT_SIM_VERSION - 1, games: wins(0, 1, 40, 0) }));
    l = addRun(l, run('mixed', { bot: 'mixed', games: wins(0, 1, 40, 0) }));
    const games = ratedGamesByList(l);
    expect(games).toHaveLength(29);
    const p = provisionalRatings(l, { recorded, firstPlayerEdge: 0.07 });
    // the recorded lists are anchors, never rated here
    expect([...p.keys()]).toEqual(['mine']);
    const mine = p.get('mine')!;
    expect(mine.games).toBe(24);
    expect(mine.connected).toBe(true);
    // it beat R1 (0.5) and lost to R2 (0): somewhere in between, and its tier comes from the Sim tier rule
    expect(mine.rating).toBeGreaterThan(0);
    expect(mine.rating).toBeLessThan(0.5);
    expect(mine.tier?.letter).toBeTruthy();
    expect(mine.tier?.games).toBe(24);
    expect(mine.of).toBe(4);
    expect(mine.place).toBe(1 + recorded.filter((r) => r.wrField > mine.wr).length);
  });

  it('a list that met only another unrated list has no tier; under 20 games the tier is unrated', () => {
    const l = addRun(emptyLedger(), run('x', { games: [...wins(3, 4, 30), ...wins(0, 1, 6)] }));
    const p = provisionalRatings(l, { recorded, firstPlayerEdge: 0.07 });
    expect(p.get('island')).toMatchObject({ connected: false, tier: null, games: 30 });
    expect(p.get('island2')).toMatchObject({ connected: false, tier: null });
    expect(p.get('mine')!.tier).toMatchObject({ letter: null, unrated: 'few-games', games: 6 });
  });
});

describe('a copy of a library list', () => {
  const lib = BUILTIN;
  const src = lib[0]!;
  const saved = (name: string, main = src.deck.main) => ({ file: `custom:${name}`, deck: { ...src.deck, name, main } });

  it('a deck saved here with a library list finds that library deck, whatever its name', () => {
    expect(libraryTwin(saved('Totally different name'), lib)?.file).toBe(src.file);
    expect(listOf(saved('x').deck)).toBe(listOf(src.deck));
  });
  it('a library deck resolves as itself; an edited list or an unknown one finds nothing', () => {
    expect(libraryTwin(src, lib)).toBeNull();
    const other = lib.find((d) => d.deck.main.some((id) => !src.deck.main.includes(id)))!;
    expect(libraryTwin(saved('Edited', [...src.deck.main.slice(1), other.deck.main.find((id) => !src.deck.main.includes(id))!]), lib)).toBeNull();
  });
  it('among library decks with the same list, the one preferred first', () => {
    const twinA = { ...src, file: 'a.txt', deck: { ...src.deck, name: 'A' } };
    const twinB = { ...src, file: 'b.txt', deck: { ...src.deck, name: 'B' } };
    const two = [twinA, twinB];
    expect(libraryTwin(saved('x'), two)?.file).toBe('a.txt');
    expect(libraryTwin(saved('x'), two, (t) => t.deck.name === 'B')?.file).toBe('b.txt');
  });
});
