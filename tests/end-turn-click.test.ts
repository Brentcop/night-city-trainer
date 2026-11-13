// Ending your turn by hand (`confirmsEndTurn`, the board's "End of turn" setting): the engine asks the one-option End
// turn decision only of a seat that opts in, once in each turn that used to end by itself, and nothing else changes;
// bot games are untouched. Practice games record the mode they were played in (`endTurnClick`), so the replay, the
// save, Undo and the review line up; records without it play as before. Online games carry each seat's own setting.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { reviewGame, ScriptedAgent } from '../src/ai/reviewer';
import type { Action, Agent, Decision, DeckList, GameState, PlayerId } from '../src/engine/types';
import { canUndo, PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { asReplay, practiceSpec, type PracticeReplay } from '../src/lib/practiceReplays';
import { buildSave, parseSavedGame, replayOf as replayOfSave, stateHash, type SavedGame } from '../src/lib/savedGames';
import { coachedReviewSpec } from '../src/lib/coachedReplay';
import { practiceAgents } from '../src/sim/practiceReview';
import { reviewFrames } from '../src/lib/reviewFrames';
import { onlyEndTurn } from '../src/ui/components/board/interaction';
import { defaultAnswer, HostGame, parseHostSave, type OnlineSetup } from '../src/net/hostGame';
import { parseGuestMessage, parseHostMessage, encode, readRecord } from '../src/net/protocol';
import { replayOf as replayOfRecord, type OnlineOutcome, type OnlineRecorder } from '../src/net/record';
import { OnlineGuest, OnlineHost, type OnlineSessionAny } from '../src/net/session';
import { loopbackPair } from '../src/net/transport';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const isForced = (d: Decision) => d.kind === 'action' && d.options.length === 1;

/** A bot game, with the main phases that ended by themselves (a lone "pass") noted per seat and turn. */
async function botGame(seed: number, flag: [boolean, boolean]) {
  const bots = [makeTierBot('easy', seed + 1, 'A'), makeTierBot('easy', seed + 2, 'B')];
  const asked: [PlayerId, number][] = [];
  const silent: [PlayerId, number][] = [];
  const decisions: string[] = [];
  const agents = bots.map((b, p): Agent => {
    if (!flag[p]) return b;
    // the seat answers the new forced End turn itself, without asking its bot (whose random state stays as it was)
    return {
      name: b.name,
      confirmsEndTurn: true,
      decide: async (g, d) => {
        if (isForced(d)) {
          expect((d.options[0]!.action as Action).type).toBe('pass');
          asked.push([p as PlayerId, g.s.turn]);
          return [0];
        }
        return b.decide(g, d);
      },
    };
  }) as [Agent, Agent];
  // every agent's decisions, forced End turns left out: the rest of the game must be the same question for question
  const watched = agents.map(
    (a): Agent => ({
      ...a,
      name: a.name,
      decide: async (g, d) => {
        if (!isForced(d)) decisions.push(`${d.player} ${d.kind} ${d.prompt} ${d.options.map((o) => o.label).join('|')}`);
        return a.decide(g, d);
      },
    }),
  ) as [Agent, Agent];
  const g = Game.create(decks, watched, { seed, first: (seed % 2) as PlayerId });
  const plain = g.chooseAction.bind(g);
  g.chooseAction = (p, acts) => {
    if (acts.length === 1 && acts[0]!.type === 'pass' && !g.agents[p].confirmsEndTurn) silent.push([p, g.s.turn]);
    return plain(p, acts);
  };
  const st = await g.run();
  return { st, asked, silent, decisions };
}

describe('the engine asks End turn only of a seat that opts in', () => {
  it('bot games are identical: nobody sets the flag, and a seat that does is asked once in each turn that used to end by itself', async () => {
    for (const seed of [5, 6, 7]) {
      const base = await botGame(seed, [false, false]);
      expect(base.asked).toEqual([]);
      // the flag set to false is the same as not set
      const off = await botGame(seed, [false, false]);
      expect(stateHash(off.st)).toBe(stateHash(base.st));
      // seat 0 ends its turns by hand: the same game, with one question more in each turn seat 0's main phase ended alone
      const on = await botGame(seed, [true, false]);
      expect(stateHash(on.st)).toBe(stateHash(base.st));
      expect(on.st.log).toEqual(base.st.log);
      expect(on.decisions).toEqual(base.decisions);
      expect(on.asked).toEqual(base.silent.filter(([p]) => p === 0));
      expect(new Set(on.asked.map(([, t]) => t)).size).toBe(on.asked.length); // at most once per turn
      expect(on.silent.filter(([p]) => p === 1)).toEqual(base.silent.filter(([p]) => p === 1));
      // both seats
      const both = await botGame(seed, [true, true]);
      expect(stateHash(both.st)).toBe(stateHash(base.st));
      expect(both.asked).toEqual(base.silent);
    }
    // the deals above do run out of things to do (the test would prove nothing otherwise)
    expect((await botGame(5, [true, true])).asked.length).toBeGreaterThan(0);
  }, 120_000);

  it('onlyEndTurn knows the forced End turn and nothing else', () => {
    const d = (kind: Decision['kind'], options: Decision['options']): Decision => ({ player: 0, kind, prompt: '', options, min: 1, max: 1 });
    expect(onlyEndTurn(d('action', [{ label: 'End turn', action: { type: 'pass' } }]))).toBe(true);
    expect(onlyEndTurn(d('action', [{ label: 'Sell', action: { type: 'sell', uid: 1 } }, { label: 'End turn', action: { type: 'pass' } }]))).toBe(false);
    expect(onlyEndTurn(d('reaction', [{ label: 'No reaction', action: { type: 'endReact' } }]))).toBe(false);
    expect(onlyEndTurn(null)).toBe(false);
  });
});

// ---------------------------------------------------------------- practice games

const setup = (seed: number, endTurnClick?: boolean): MatchSetup => ({ decks, seed, first: 0, level: 'medium', botSeed: 4242, ...(endTurnClick ? { endTurnClick } : {}) });

/** Plays your seat with an easy bot "brain"; `hook` sees each new decision first and returns true to handle it itself. */
function drive(session: PracticeSession, hook?: (run: Running, d: Decision) => boolean) {
  const brain = makeTierBot('easy', 9);
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(async () => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      if (hook?.(run, d)) return;
      const r = isForced(d) ? [0] : await brain.decide(run.g, d);
      run.human.answer(d, r[0]!);
    }, 0);
  });
}
async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}
/** Re-simulate a record the way the reviewers do (practiceAgents); the stand-in bot must never be needed. */
async function resim(r: PracticeReplay): Promise<GameState> {
  const [mine, bot] = practiceAgents(practiceSpec(r));
  const fb = vi.spyOn(mine as ScriptedAgent, 'decide');
  const st = await Game.create(r.decks, [mine, bot], { seed: r.seed, first: r.first }).run();
  expect(fb.mock.calls.length).toBe(r.choices.length); // every call answered from the record
  return st;
}

describe('practice games record the mode they were played in', () => {
  it('a game played with End turn clicked replays, reviews and frames identically; the forced End turns are not graded', async () => {
    const session = new PracticeSession();
    let forced = 0;
    drive(session, (_run, d) => {
      if (isForced(d)) forced++;
      return false;
    });
    session.start(setup(11, true));
    const run = await finish(session);
    expect(run.replay.endTurnClick).toBe(true);
    expect(forced).toBeGreaterThan(0);
    const st = await resim(run.replay);
    expect(st.log).toEqual(run.g.s.log);
    // the record keeps the flag through storage and the export's review spec
    const back = asReplay(JSON.parse(JSON.stringify(run.replay)))!;
    expect(back.endTurnClick).toBe(true);
    expect(practiceSpec(back).endTurnClick).toBe(true);
    expect(coachedReviewSpec({ kind: 'nct-coached-replay', schema: 1, exported: '', gigSwing: 0, replay: back, decisions: [] } as never).endTurnClick).toBe(true);
    // without the flag the recorded answers no longer line up (why it must be recorded)
    const wrong = await Game.create(back.decks, [new ScriptedAgent('you', back.choices, makeTierBot('easy', 1), true, true, false), makeTierBot(back.botLevel, back.botSeed, 'Bot')], { seed: back.seed, first: back.first })
      .run()
      .then((x) => x.log, (e: unknown) => String(e)); // an answer can even fall outside the options it meets
    expect(wrong).not.toEqual(run.g.s.log);
    // the review: forced End turns are counted as forced, never graded
    const review = await reviewGame(
      { decks: back.decks, seed: back.seed, first: back.first, agents: practiceAgents(practiceSpec(back)) },
      { seats: [0], rollouts: 1, screen: 0, keepAnswers: true },
    );
    expect(review.forced![0]).toBeGreaterThanOrEqual(forced);
    expect(review.decisions.every((x) => x.options >= 2)).toBe(true);
    expect(review.answers![0].endTurn).toBe(true);
    expect(review.answers![1].endTurn).toBeUndefined();
    const frames = await reviewFrames({ decks: back.decks, seed: back.seed, first: back.first }, review.answers!);
    expect(frames.data.final.log).toEqual(run.g.s.log);
  }, 180_000);

  it('a record without the field (every older one) still plays automatically and lines up', async () => {
    const session = new PracticeSession();
    let forced = 0;
    drive(session, (_run, d) => {
      if (isForced(d)) forced++;
      return false;
    });
    session.start(setup(11));
    const run = await finish(session);
    expect(forced).toBe(0);
    expect('endTurnClick' in run.replay).toBe(false);
    expect('endTurnClick' in practiceSpec(run.replay)).toBe(false);
    const st = await resim(JSON.parse(JSON.stringify(run.replay)) as PracticeReplay);
    expect(st.log).toEqual(run.g.s.log);
  }, 60_000);

  it('Undo after a forced End turn goes back to before that click', async () => {
    const session = new PracticeSession();
    let after: { turn: number; choices: number } | null = null;
    let checked = false;
    drive(session, (run, d) => {
      if (checked) return false;
      if (isForced(d) && !after) {
        after = { turn: run.g.s.turn, choices: run.replay.choices.length };
        return false;
      }
      // your next main-phase decision: Undo returns to the forced End turn, before it was clicked
      if (after && d.kind === 'action' && run.g.s.active === 0) {
        expect(canUndo(run)).toBe(true);
        expect(session.undo()).toBe(true);
        const next = session.current!;
        expect(onlyEndTurn(next.human.pending?.d)).toBe(true);
        expect(next.g.s.turn).toBe(after.turn);
        expect(next.replay.choices.length).toBe(after.choices);
        checked = true;
        return true;
      }
      return false;
    });
    session.start(setup(11, true));
    const run = await finish(session);
    expect(checked).toBe(true);
    expect(run.replay.undos).toBe(1);
    expect((await resim(run.replay)).log).toEqual(run.g.s.log);
  }, 60_000);

  it('saves carry the mode: a save at a forced End turn resumes there; an old save without the field resumes as before', async () => {
    for (const click of [true, false]) {
      const a = new PracticeSession();
      const got = await new Promise<{ run: Running; d: Decision }>((resolve) => {
        drive(a, (run, d) => {
          const stop = click ? isForced(d) : run.replay.choices.length >= 12 && d.kind === 'action';
          if (stop) resolve({ run, d });
          return stop;
        });
        a.start(setup(11, click));
      });
      const save = buildSave({ replay: got.run.replay, grades: [], stable: got.run.stable, log: got.run.g.s.log }, { id: 'auto', saved: '2026-11-13T10:00:00Z', coach: false })!;
      const state = JSON.stringify(got.run.g.s);
      a.quit();
      expect(save.endTurnClick).toBe(click ? true : undefined);
      const parsed = parseSavedGame(JSON.stringify(save));
      expect(parsed.ok).toBe(true);
      const s = (parsed as { ok: true; value: SavedGame }).value;
      expect(replayOfSave(s).endTurnClick).toBe(click ? true : undefined);
      const b = new PracticeSession();
      const r = await b.restore(s);
      expect(r.ok).toBe(true);
      const d = b.current!.human.pending!.d;
      expect(JSON.stringify(b.current!.g.s)).toBe(state);
      expect(onlyEndTurn(d)).toBe(click);
      expect(b.current!.human.confirmsEndTurn).toBe(click);
      b.quit();
    }
  }, 60_000);

  it('a save whose End turn field is not true or false is refused as damaged', () => {
    const r = parseSavedGame({ kind: 'nct-saved-game', schema: 1, endTurnClick: 'yes' });
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------- online

const onlineSetup = (seed: number, endTurnClick?: [boolean, boolean], timer = 0): OnlineSetup => ({
  game: `g${seed}`,
  token: 't'.repeat(32),
  names: ['Ana', 'Bo'],
  decks,
  seed,
  first: 0,
  timer,
  started: '2026-11-13T00:00:00.000Z',
  ...(endTurnClick ? { endTurnClick } : {}),
});

describe('online games: each seat its own setting', () => {
  it('the host game asks only the seat that clicks End turn, keeps it in the save, and the timer answers it with End turn', async () => {
    const h = new HostGame(onlineSetup(3, [true, false]));
    const brains = [makeTierBot('easy', 1), makeTierBot('easy', 2)];
    const forced: PlayerId[] = [];
    for (let k = 0; k < 20_000 && !h.ended && !h.error; k++) {
      await new Promise((r) => setTimeout(r, 0));
      const w = h.waitingSeat();
      if (w === null) continue;
      const pv = h.seats[w].pending!;
      if (isForced(pv.d)) {
        forced.push(w);
        expect(defaultAnswer(pv.d)).toBe(0);
        // the save at the forced End turn carries both seats' settings and replays to it
        if (forced.length === 1) {
          const save = parseHostSave(JSON.stringify(h.save()))!;
          expect(save.setup.endTurnClick).toEqual([true, false]);
          const back = await HostGame.restore(save);
          expect(isForced(back.seats[w].pending!.d)).toBe(true);
          back.quit();
        }
      }
      const i = isForced(pv.d) ? 0 : (await brains[w]!.decide(h.g, pv.d))[0]!;
      expect(h.answer(w, pv.seq, i)).toBeNull();
    }
    expect(h.error).toBeNull();
    expect(forced.length).toBeGreaterThan(0);
    expect(new Set(forced)).toEqual(new Set([0]));
    h.quit();
  }, 60_000);

  it('the hello carries the guest setting; the record carries both, and the replays line up for each side', () => {
    const hello = { v: 1 as const, t: 'hello' as const, name: 'Bo', deck: { name: 'X', legends: ['a'], main: ['b'], sideboard: [] }, endTurnClick: true };
    expect(parseGuestMessage(encode(hello))).toEqual({ ok: true, msg: hello });
    const old = { v: 1 as const, t: 'hello' as const, name: 'Bo', deck: hello.deck };
    expect(parseGuestMessage(encode(old))).toEqual({ ok: true, msg: old });
    expect(parseGuestMessage(JSON.stringify({ ...hello, endTurnClick: 'yes' })).ok).toBe(false);
    const rec = { game: 'g1', seed: 4, first: 0 as PlayerId, decks: [hello.deck, hello.deck] as [typeof hello.deck, typeof hello.deck], answers: [[[0]], [[1]]] as [number[][], number[][]], endTurnClick: [false, true] as [boolean, boolean] };
    expect(readRecord(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    const { endTurnClick: _e, ...oldRec } = rec;
    expect(readRecord(JSON.parse(JSON.stringify(oldRec)))).toEqual(oldRec);
    expect(parseHostMessage(encode({ v: 1, t: 'record', record: rec })).ok).toBe(true);
    const o = { id: 'x', date: '', result: 'win' as const, reason: '', myDeck: 'X', rivalDeck: 'X', rival: 'Bo', first: true, turns: 1, gigs: [0, 0] as [number, number], conceded: false, rivalConceded: false, abandoned: false };
    const host = replayOfRecord(o, rec, 0);
    expect(host.endTurnClick).toBeUndefined();
    expect(host.pvp!.rivalEndTurnClick).toBe(true);
    const guest = replayOfRecord(o, rec, 1);
    expect(guest.endTurnClick).toBe(true);
    expect(guest.pvp!.rivalEndTurnClick).toBeUndefined();
    const [a0, a1] = practiceAgents(practiceSpec(guest));
    expect([a0.confirmsEndTurn, a1.confirmsEndTurn]).toEqual([false, true]);
  });

  it('over the link: the guest sends its setting with its hello, both records carry both settings and replay to the same game', async () => {
    const flush = () => new Promise((r) => setTimeout(r, 0));
    const until = async (f: () => boolean, what: string) => {
      for (let i = 0; i < 400; i++) {
        if (f()) return;
        await flush();
      }
      throw new Error(`timed out waiting for ${what}`);
    };
    const mem = () => {
      const m = new Map<string, string>();
      return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
    };
    const rec = () => {
      const replays: PracticeReplay[] = [];
      const r: OnlineRecorder = { entry: (_o: OnlineOutcome) => undefined, replay: (x) => replays.push(x) };
      return { r, replays };
    };
    const hr = rec();
    const gr = rec();
    const host = new OnlineHost({ name: 'Ana', deck: decks[0], heartbeat: false, store: mem(), recorder: hr.r });
    const guest = new OnlineGuest({ name: 'Bo', deck: decks[1], heartbeat: false, store: mem(), recorder: gr.r, resume: null, endTurnClick: true });
    const [a, b] = loopbackPair();
    host.attach(a);
    guest.attach(b);
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
    const chooser: OnlineSessionAny = host.chooser === 'me' ? host : guest;
    chooser.chooseFirst(true);
    await until(() => !!host.board && !!guest.board, 'the first view');
    expect(host.game!.setup.endTurnClick).toEqual([false, true]);
    const brains = [makeTierBot('easy', 3), makeTierBot('easy', 4)];
    const forced = [0, 0];
    for (let k = 0; k < 20_000 && !(host.over && guest.over); k++) {
      await flush();
      for (const [p, s] of [[0, host], [1, guest]] as const) {
        const pd = s.seat.pending;
        if (!pd) continue;
        if (onlyEndTurn(pd.d)) forced[p]++;
        const real = host.game!.seats[p].pending;
        if (!real) continue;
        s.seat.answer(pd.d, isForced(real.d) ? 0 : (await brains[p]!.decide(host.game!.g, real.d))[0]!);
      }
    }
    await until(() => !!host.over && !!guest.over && gr.replays.length > 0, 'the end and the record');
    expect(forced[0]).toBe(0);
    expect(forced[1]).toBeGreaterThan(0);
    const [h, g] = [hr.replays[0]!, gr.replays[0]!];
    expect([h.endTurnClick, h.pvp!.rivalEndTurnClick]).toEqual([undefined, true]);
    expect([g.endTurnClick, g.pvp!.rivalEndTurnClick]).toEqual([true, undefined]);
    for (const r of [h, g]) {
      const st = await Game.create(r.decks, practiceAgents(practiceSpec(r)), { seed: r.seed, first: r.first }).run();
      expect(st.log.map((l) => l.text)).toEqual(host.game!.g.s.log.map((l) => l.text));
    }
    host.close();
    guest.close();
  }, 120_000);
});
