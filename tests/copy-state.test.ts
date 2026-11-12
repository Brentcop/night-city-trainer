// copyState (src/engine/copyState.ts) replaced structuredClone in Game.clone() and Game.probeCopy() (SIM-1): on real
// states taken all through seeded games it must give exactly what structuredClone gave, and share nothing with the
// original.
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { copyState } from '../src/engine/copyState';
import { parseDeck } from '../src/engine/deck';
import { RandomAgent } from '../src/ai/random';
import type { Agent, Decision, DeckList, GameState } from '../src/engine/types';

const META: DeckList[] = readdirSync('data/decks')
  .filter((f) => f.startsWith('meta-'))
  .sort()
  .map((f) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck);

/** The state as clone() and probeCopy() copy it: without the log and the trace. */
const bare = (s: GameState): GameState => ({ ...s, log: [], trace: undefined });

/** Deep-equal to structuredClone, keys in the same order, and no object shared with the original. */
function expectFaithful(s: GameState) {
  const src = bare(s);
  const mine = copyState(src);
  expect(mine).toStrictEqual(structuredClone(src));
  expect(JSON.stringify(mine)).toBe(JSON.stringify(src));
  const before = JSON.stringify(src);
  mutateEverything(mine);
  expect(JSON.stringify(src)).toBe(before);
}

/** Changes every primitive and empties every array reachable in `v` (so any object shared with the source would show). */
function mutateEverything(v: unknown) {
  if (typeof v !== 'object' || v === null) return;
  const o = v as Record<string, unknown>;
  for (const k of Object.keys(o)) {
    const x = o[k];
    if (typeof x === 'object' && x !== null) mutateEverything(x);
    else o[k] = typeof x === 'number' ? x + 1 : typeof x === 'string' ? `${x}!` : typeof x === 'boolean' ? !x : 'changed';
  }
  if (Array.isArray(v)) v.push('extra');
}

describe('copyState', () => {
  afterEach(() => vi.restoreAllMocks());

  it('matches structuredClone at every decision of seeded games (mid-attack clones and pending-effect probes included)', async () => {
    const seen = { decisions: 0, midAttack: 0, probes: 0, probesWithPending: 0 };
    const probe = Game.prototype.probeCopy;
    vi.spyOn(Game.prototype, 'probeCopy').mockImplementation(function (this: Game) {
      seen.probes++;
      if (this.pending.length) seen.probesWithPending++;
      expectFaithful(this.s);
      const cg = probe.call(this);
      expect(cg.s).toStrictEqual(structuredClone(bare(this.s)));
      return cg;
    });
    const watch = (a: Agent): Agent => ({
      name: a.name,
      choosesOrder: true, // asked to order its own pending effects, so the engine probes them (probeCopy)
      decide: async (g: Game, d: Decision) => {
        seen.decisions++;
        expectFaithful(g.s);
        if (!g.pending.length) {
          if (g.s.attack) seen.midAttack++;
          const c = g.clone([a, a], { keepLog: seen.decisions % 7 === 0 });
          const want = structuredClone(bare(g.s));
          if (seen.decisions % 7 === 0) want.log = g.s.log.map((e) => ({ ...e }));
          expect(c.s).toStrictEqual(want);
        }
        return a.decide(g, d);
      },
    });
    for (let i = 0; i < META.length; i++) {
      const seed = 4100 + i;
      const g = Game.create([META[i], META[(i + 3) % META.length]], [watch(new RandomAgent(seed)), watch(new RandomAgent(seed + 1))], { seed, first: (i % 2) as 0 | 1, trace: i % 2 === 0 });
      const end = await g.run();
      expectFaithful(end);
    }
    expect(seen.decisions).toBeGreaterThan(500);
    expect(seen.midAttack).toBeGreaterThan(20);
    expect(seen.probesWithPending).toBeGreaterThan(0);
  });

  it('copies undefined fields, nested arrays and integer keys as structuredClone does', () => {
    const v = { b: 1, a: undefined, 2: { x: [[1, 2], [], [{ y: null }]] }, 1: 'one', s: [undefined, false, -0, NaN] };
    expect(copyState(v)).toStrictEqual(structuredClone(v));
    expect(Object.keys(copyState(v))).toEqual(Object.keys(v));
    expect('a' in copyState(v)).toBe(true);
  });

  it('gives an object reached by two paths two separate copies (the state never relies on sharing)', () => {
    const data = { uid: 5 };
    const c = copyState({ m: [{ data }, { data }] });
    expect(c.m[0].data).toEqual(data);
    expect(c.m[0].data).not.toBe(c.m[1].data);
  });

  it('refuses anything that is not plain data', () => {
    expect(() => copyState({ a: new Map() })).toThrow(/not plain data \(Map\)/);
    expect(() => copyState([new Date(0)])).toThrow(/Date/);
    expect(() => copyState({ f: () => true })).toThrow(/function/);
  });
});
