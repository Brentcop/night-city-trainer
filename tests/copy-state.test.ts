// copyState (src/engine/copyState.ts) replaced structuredClone in Game.clone() and Game.probeCopy() (SIM-1): on real
// states taken all through seeded games it must give exactly what structuredClone gave, and share nothing with the
// original. Since 2026-11-16 clone() and probeCopy() use copyGameState, which copies each card by a spread: for every
// state it must be indistinguishable from copyState's copy (the same keys in the same order, so JSON.stringify and
// stateHash agree; the same values; nothing shared with the source).
import { readdirSync, readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARD_OBJECT_FIELDS, copyGameState, copyState } from '../src/engine/copyState';
import { parseDeck } from '../src/engine/deck';
import { RandomAgent } from '../src/ai/random';
import { makeTierBot } from '../src/ai/tiers';
import { buildPosition } from '../src/lib/tutorial';
import { LESSONS } from '../src/content/tutorial/lessons';
import { viewFor } from '../src/net/view';
import { readViewState } from '../src/net/protocol';
import { PracticeSession } from '../src/lib/practiceSession';
import { buildSave } from '../src/lib/savedGames';
import { loadLibrary } from '../scripts/lib-node';
import type { Agent, CardInst, Decision, DeckList, GameState, PlayerId } from '../src/engine/types';

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

/** Every object and array reachable from v. */
function objectsIn(v: unknown, out = new Set<object>()): Set<object> {
  if (typeof v !== 'object' || v === null || out.has(v)) return out;
  out.add(v);
  for (const x of Object.values(v)) objectsIn(x, out);
  return out;
}

/** copyGameState(s) is copyState(s): the same JSON (keys in the same order), deep-equal to structuredClone, nothing shared. */
function expectFastCopy(s: GameState, deep = true) {
  const fast = copyGameState(s);
  expect(JSON.stringify(fast)).toBe(JSON.stringify(copyState(s)));
  if (deep) expect(fast).toStrictEqual(structuredClone(s));
  const src = objectsIn(s);
  for (const o of objectsIn(fast)) if (src.has(o)) throw new Error('the copy shares an object with the source');
  for (const [u, c] of Object.entries(s.cards)) {
    expect(Object.keys(fast.cards[Number(u)]!)).toEqual(Object.keys(c));
    // only the fields copyCard copies hold objects
    for (const [k, x] of Object.entries(c)) if (typeof x === 'object' && x !== null) expect(k in CARD_OBJECT_FIELDS, `card field ${k}`).toBe(true);
  }
  const before = JSON.stringify(s);
  mutateEverything(fast);
  expect(JSON.stringify(s)).toBe(before);
}

/** A card with every field CardInst declares (Required: adding a field to CardInst fails the typecheck here until it is added). */
const fullCard = (uid: number, defId: string): Required<CardInst> => ({ uid, defId, owner: 0, controller: 1, zone: 'legends', spent: true, faceUp: false, lag: true, gear: [uid + 1000, uid + 1001], host: null, enteredTurn: 3, goSolo: false, known: true });

describe('copyGameState (Game.clone and Game.probeCopy)', () => {
  const lib = loadLibrary();

  it('is copyState at decisions of games over the whole library, and clone() hashes as the original', async () => {
    const half = Math.ceil(lib.length / 2);
    let decisions = 0;
    for (let k = 0; k < half; k++) {
      let g: Game | null = null;
      const watch = (a: Agent): Agent => ({
        name: a.name,
        decide: async (gg: Game, d: Decision) => {
          if (gg === g && decisions++ % 3 === 0) {
            expectFastCopy(gg.s, decisions % 30 === 1);
            expectFastCopy(bare(gg.s), false);
            // what Undo keeps (clone with the log, no trace) is the game's own state as JSON, so it hashes as the game does
            if (!gg.pending.length) expect(JSON.stringify(gg.clone([a, a], { keepLog: true }).s)).toBe(JSON.stringify({ ...gg.s, trace: undefined }));
          }
          return a.decide(gg, d);
        },
      });
      const seed = 6100 + k;
      g = Game.create([lib[k]!.deck, lib[(k + half) % lib.length]!.deck], [watch(makeTierBot('medium', seed)), watch(makeTierBot('medium', seed + 7777))], { seed, first: (k % 2) as PlayerId, log: true, trace: k % 4 === 0 });
      expectFastCopy(await g.run());
    }
    expect(decisions).toBeGreaterThan(1000);
  }, 60_000);

  it('keeps each card’s keys and their order, with optional fields present, absent or added in another order', async () => {
    const g = Game.create([lib[0]!.deck, lib[1]!.deck], [makeTierBot('easy', 1), makeTierBot('easy', 2)], { seed: 77, first: 0, log: true });
    const s = g.s;
    const legends = [...s.players[0].legends, ...s.players[1].legends].map((u) => s.cards[u]!);
    legends[0]!.known = true; // set by an effect after setup: the key comes last
    legends[1]!.known = false;
    expectFastCopy(s);
    // hand-built cards: keys in another order, an optional field first, an extra key, a card with every field
    const uid = s.nextUid;
    (s.cards as Record<number, unknown>)[uid] = { known: true, goSolo: false, enteredTurn: 0, host: null, gear: [], lag: false, faceUp: false, spent: false, zone: 'hand', controller: 1, owner: 1, defId: lib[0]!.deck.main[0], uid };
    (s.cards as Record<number, unknown>)[uid + 1] = { uid: uid + 1, defId: lib[0]!.deck.main[1], known: false, owner: 0, controller: 0, zone: 'trash', spent: false, faceUp: true, lag: false, gear: [], host: null, enteredTurn: 2, goSolo: false, note: 'extra', undef: undefined };
    s.cards[uid + 2] = fullCard(uid + 2, lib[0]!.deck.legends[0]!);
    expectFastCopy(s);
    // the fast path stands aside for anything that is not a plain card with a gear array, and refuses what copyState refuses
    (s.cards as Record<number, unknown>)[uid + 3] = { uid: uid + 3, defId: 'x', zone: 'deck' }; // no gear
    expectFastCopy(s);
    (s.cards as Record<number, unknown>)[uid + 4] = { uid: uid + 4, gear: [new Date(0)] };
    expect(() => copyGameState(s)).toThrow(/Date/);
    class Card {
      uid = 1;
      gear: number[] = [];
    }
    (s.cards as Record<number, unknown>)[uid + 4] = new Card();
    expect(() => copyGameState(s)).toThrow(/not plain data \(Card\)/);
    expect(() => copyGameState({ ...s, cards: new Map() } as unknown as GameState)).toThrow(/Map/);
    expect(() => copyGameState(new Map() as unknown as GameState)).toThrow(/Map/);
  });

  it('a copy of a card with every field shares none of them, and a mutation of the copy leaves the source as it was', () => {
    const s = { cards: { 5: fullCard(5, 'a') }, players: [] } as unknown as GameState;
    const c = copyGameState(s);
    expect(c.cards[5]).toEqual(s.cards[5]);
    for (const k of Object.keys(CARD_OBJECT_FIELDS) as (keyof CardInst)[]) expect(c.cards[5]![k]).not.toBe(s.cards[5]![k]);
    c.cards[5]!.gear.push(9);
    c.cards[5]!.known = false;
    expect(s.cards[5]!.gear).toEqual([1005, 1006]);
    expect(s.cards[5]!.known).toBe(true);
  });

  it('is copyState on tutorial positions, views of a game for online play, and a restored save with its Undo snapshots', async () => {
    const noAgent: Agent = { name: 'none', decide: async () => [0] };
    for (const l of LESSONS) expectFastCopy(buildPosition(l.position, [noAgent, noAgent]).s);
    const g = Game.create([lib[2]!.deck, lib[3]!.deck], [makeTierBot('medium', 5), makeTierBot('medium', 6)], { seed: 99, first: 1, log: true });
    const end = await g.run();
    for (const seat of [0, 1] as PlayerId[]) {
      expectFastCopy(viewFor(end, seat));
      expectFastCopy(readViewState(JSON.parse(JSON.stringify(viewFor(end, seat)))));
    }
    expectFastCopy(JSON.parse(JSON.stringify(end)) as GameState);

    // a save restored by replay (PracticeSession.restore), and the Undo snapshots the replay rebuilt
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k) });
    try {
      const setup = { decks: [lib[4]!.deck, lib[5]!.deck] as [DeckList, DeckList], seed: 31, first: 0 as PlayerId, level: 'medium', botSeed: 4242 };
      const a = new PracticeSession();
      const saved = await new Promise<ReturnType<typeof buildSave>>((resolve) => {
        let last: Decision | null = null;
        a.subscribe(() => {
          const run = a.current;
          const d = run?.human.pending?.d;
          if (!run || !d || d === last) return;
          last = d;
          setTimeout(() => {
            if (run.replay.choices.length >= 12) return resolve(buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: '2026-11-16T10:00:00Z', coach: false }));
            run.human.answer(d, (run.replay.choices.length * 7 + run.g.s.turn) % d.options.length);
          }, 0);
        });
        a.start(setup);
      });
      a.quit();
      expect(saved).not.toBeNull();
      const b = new PracticeSession();
      expect((await b.restore(saved!)).ok).toBe(true);
      const run = b.current!;
      expectFastCopy(run.g.s);
      expect(run.snaps.length).toBeGreaterThan(0);
      for (const snap of run.snaps) expectFastCopy(snap.state);
      b.quit();
    } finally {
      vi.unstubAllGlobals();
    }
  }, 60_000);
});
