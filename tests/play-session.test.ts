// The Play page's game loop without React: undo, cancellation, errors, recording, stale answers, hand order, replays.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { ScriptedAgent } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList, GameState } from '../src/engine/types';
import { canUndo, outcome, PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { HumanAgent } from '../src/ui/HumanAgent';
import { loadPractice, parsePractice, recordPractice } from '../src/lib/practiceLog';
import { loadReplays, parseReplays } from '../src/lib/practiceReplays';
import { reorderHand, sortHand } from '../src/ui/components/board/handSort';
import { captureFrames, lineInFinalLog, recordReplay } from '../src/ui/components/ReplayBoard';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number, first?: 0 | 1): MatchSetup => ({ decks, seed, first, level: 'medium', botSeed: 4242 });

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

/**
 * Plays the human seat with a bot "brain". `hook` sees each new pending decision first and returns true if it
 * handled it (e.g. by undoing) instead of answering.
 */
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
      const r = await brain.decide(run.g, d);
      run.human.answer(d, r[0]);
    }, 0);
  });
}

/** Wait until the session's game (following undos) has ended. */
async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}

/** Re-simulate the recorded line the way the match reviewer does; the fallback must never be needed. */
async function replayOf(run: Running): Promise<{ st: GameState; fallbacks: number }> {
  let fallbacks = 0;
  const easy = makeTierBot('easy', 1);
  const fallback: Agent = { name: 'fb', decide: (g, d) => (fallbacks++, easy.decide(g, d)) };
  const r = run.replay;
  const st = await Game.create(r.decks, [new ScriptedAgent('you', r.choices, fallback), makeTierBot(r.botLevel, r.botSeed, 'Bot')], { seed: r.seed, first: r.first }).run();
  return { st, fallbacks };
}

describe('practice session: undo', () => {
  it('undo-truncated choices replay to the identical game', async () => {
    const session = new PracticeSession();
    let n = 0;
    drive(session, (_run, d) => d.kind === 'action' && ++n === 7 && session.undo());
    session.start(setup(11));
    const run = await finish(session);
    expect(run.replay.undos).toBe(1);
    expect(run.g.s.winner).not.toBeNull();
    const { st, fallbacks } = await replayOf(run);
    expect(fallbacks).toBe(0);
    expect(st.winner).toBe(run.g.s.winner);
    expect(st.log).toEqual(run.g.s.log);
  }, 60_000);

  it('undo during a sub-decision goes back to the main-phase choice that led to it', async () => {
    let checked = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const session = new PracticeSession();
      let seen: { choices: number; turn: number } | null = null;
      drive(session, (run, d) => {
        if (checked || seen || d.kind === 'action' || d.kind === 'reaction' || d.kind === 'yesno' || !run.snaps.length || run.g.s.active !== 0) return false;
        const target = run.snaps[run.snaps.length - 1];
        seen = { choices: target.choices, turn: target.state.turn };
        expect(canUndo(run)).toBe(true);
        const before = run.snaps.length;
        expect(session.undo()).toBe(true);
        const next = session.current!;
        expect(next.match).toBe(run.match);
        expect(next.replay.choices.length).toBe(target.choices);
        expect(next.snaps.length).toBe(before); // dropped the target, then the restored decision re-snapshotted itself
        expect(next.human.pending?.d.kind).toBe('action');
        expect(next.g.s.turn).toBe(target.state.turn);
        checked = true;
        return true;
      });
      session.start(setup(seed, 0));
      const run = await finish(session);
      if (!seen) continue;
      const { st, fallbacks } = await replayOf(run);
      expect(fallbacks).toBe(0);
      expect(st.log).toEqual(run.g.s.log);
      break;
    }
    expect(checked).toBe(true);
  }, 120_000);

  it('undo after game over records the practice result once', async () => {
    const session = new PracticeSession();
    drive(session);
    session.start(setup(5));
    const first = await finish(session);
    expect(loadPractice()).toHaveLength(1);
    expect(loadReplays()).toHaveLength(1);
    expect(canUndo(first)).toBe(true);
    expect(session.undo()).toBe(true);
    const again = await finish(session);
    expect(again).not.toBe(first);
    const log = loadPractice();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(first.replay.id);
    expect(log[0].result).toBe(outcome(again.g.s));
    const reps = loadReplays();
    expect(reps).toHaveLength(1);
    expect(reps[0].undos).toBe(1);
    expect(reps[0].choices).toEqual(again.replay.choices);
  }, 60_000);

  it('undo is refused while the bot is moving', async () => {
    const session = new PracticeSession({ pace: () => 5 });
    let tried = false;
    drive(session, (run, d) => {
      if (tried || d.kind !== 'action' || run.snaps.length < 2) return false;
      const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
      if (pass < 0) return false;
      tried = true;
      run.human.answer(d, pass);
      // the human has nothing pending now and the game is still on
      expect(run.human.pending).toBeNull();
      expect(canUndo(run)).toBe(false);
      expect(session.undo()).toBe(false);
      expect(session.current).toBe(run);
      return true;
    });
    session.start(setup(3, 0));
    await finish(session);
    expect(tried).toBe(true);
  }, 60_000);
});

describe('practice session: quitting and errors', () => {
  it('a quit game stops and never records a result', async () => {
    const session = new PracticeSession({ pace: () => 5 });
    let quitAt = -1;
    let stale: { run: Running; d: Decision } | null = null;
    drive(session, (run, d) => {
      if (d.kind !== 'action' || run.snaps.length < 2) return false;
      const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
      if (pass < 0) return false;
      run.human.answer(d, pass); // end the turn, then quit while the bot is up
      quitAt = run.replay.choices.length;
      session.quit();
      stale = { run, d };
      return true;
    });
    const run = session.start(setup(4, 0));
    await run.done;
    expect(stale).not.toBeNull();
    expect(run.cancelled).toBe(true);
    expect(run.error).toBeNull();
    expect(run.g.onUpdate).toBeNull();
    expect(run.g.s.winner).toBeNull();
    expect(run.replay.choices.length).toBe(quitAt);
    expect(session.current).toBeNull();
    expect(loadPractice()).toEqual([]);
    expect(loadReplays()).toEqual([]);
    expect(stale!.run.human.answer(stale!.d, 0)).toBe(false);
  }, 60_000);

  it('a new game cancels the running one', async () => {
    const session = new PracticeSession();
    const a = session.start(setup(8, 0));
    const b = session.start(setup(9, 0));
    await a.done;
    expect(a.cancelled).toBe(true);
    expect(b.cancelled).toBe(false);
    expect(b.match).not.toBe(a.match);
    expect(session.current).toBe(b);
    session.quit();
    await b.done;
    expect(loadPractice()).toEqual([]);
  });

  it('an engine error stops the game with a message, and Undo recovers', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const session = new PracticeSession();
    let broken = false;
    drive(session, (run, d) => {
      if (broken || d.kind !== 'action' || run.snaps.length < 2) return false;
      const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
      if (pass < 0) return false;
      broken = true;
      run.g.endPhase = async () => {
        throw new Error('boom');
      };
      run.human.answer(d, pass);
      return true;
    });
    const run = session.start(setup(6, 0));
    while (!broken || !session.current!.error) {
      const r = session.current!;
      await r.done;
      if (r.error) break;
    }
    const failed = session.current!;
    expect(failed.error).toMatch(/boom/);
    expect(failed.g.s.winner).toBeNull();
    expect(canUndo(failed)).toBe(true);
    expect(session.undo()).toBe(true);
    const done = await finish(session);
    expect(done.error).toBeNull();
    expect(done.g.s.winner).not.toBeNull();
    expect(done.match).toBe(run.match);
    expect(loadPractice()).toHaveLength(1);
    err.mockRestore();
  }, 60_000);
});

describe('human answers', () => {
  const dec = (n: number): Decision => ({ player: 0, kind: 'unit', prompt: 'pick', options: Array.from({ length: n }, (_, i) => ({ label: `o${i}` })), min: 1, max: 1 });
  it('ignores stale and out-of-range answers', async () => {
    const h = new HumanAgent();
    const g = null as unknown as Game;
    const d1 = dec(2);
    const p1 = h.decide(g, d1);
    expect(h.answer(dec(2), 0)).toBe(false); // a different decision
    expect(h.answer(d1, 2)).toBe(false);
    expect(h.answer(d1, -1)).toBe(false);
    expect(h.answer(d1, 0.5)).toBe(false);
    expect(h.answer(null, 0)).toBe(false);
    expect(h.pending?.d).toBe(d1);
    expect(h.answer(d1, 1)).toBe(true);
    await expect(p1).resolves.toEqual([1]);
    // a late second click on the old prompt can't answer the next one
    const d2 = dec(3);
    const p2 = h.decide(g, d2);
    expect(h.answer(d1, 0)).toBe(false);
    expect(h.pending?.d).toBe(d2);
    h.cancel();
    await expect(p2).rejects.toThrow();
    expect(h.pending).toBeNull();
  });
});

describe('hand order', () => {
  const defs: Record<number, { cost: number; color: string; displayName: string }> = {
    1: { cost: 3, color: 'Blue', displayName: 'Zed' },
    2: { cost: 1, color: 'Yellow', displayName: 'Amp' },
    3: { cost: 1, color: 'Red', displayName: 'Bolt' },
    4: { cost: 2, color: 'Red', displayName: 'Arc' },
  };
  const info = (u: number) => defs[u];
  it('sorts by cost, by colour, as drawn, or in a manual order', () => {
    const hand = [1, 2, 3, 4];
    expect(sortHand(info, hand, 'drawn', [])).toEqual([1, 2, 3, 4]);
    expect(sortHand(info, hand, 'cost', [])).toEqual([3, 2, 4, 1]);
    expect(sortHand(info, hand, 'color', [])).toEqual([3, 4, 1, 2]);
    // manual: cards no longer in hand drop out, new draws go to the end
    expect(sortHand(info, [2, 3, 4, 9], 'manual', [4, 1, 2])).toEqual([4, 2, 3, 9]);
  });
  it('reorders onto any slot, including the last', () => {
    const o = [1, 2, 3, 4];
    expect(reorderHand(o, 1, 4)).toEqual([2, 3, 4, 1]);
    expect(reorderHand(o, 4, 1)).toEqual([4, 1, 2, 3]);
    expect(reorderHand(o, 2, 3)).toEqual([1, 3, 2, 4]);
    expect(reorderHand(o, 3, 2)).toEqual([1, 3, 2, 4]);
    expect(reorderHand(o, 2, 2)).toEqual(o);
    expect(reorderHand(o, 7, 2)).toEqual(o);
  });
});

describe('stored practice data', () => {
  it('tolerates any stored JSON', () => {
    expect(parsePractice('{"a":1}')).toEqual([]);
    expect(parsePractice('not json')).toEqual([]);
    expect(parsePractice(null)).toEqual([]);
    const old = parsePractice(JSON.stringify([1, null, 'x', { deck: 'A', opp: 'B', result: 'win' }, { deck: 2, opp: 'B', result: 'win' }, { deck: 'A', opp: 'B', result: 'meh' }]));
    expect(old).toHaveLength(1);
    expect(old[0]).toMatchObject({ deck: 'A', opp: 'B', result: 'win', turns: 0 });
    expect(old[0].id).toBeUndefined();
    expect(parseReplays('{}')).toEqual([]);
    expect(parseReplays('[{"id":"p1"}, 3]')).toEqual([]);
    const ok = { id: 'p1', date: 'd', decks: [decks[0], { name: 'B', legends: [], main: [] }], seed: 1, botLevel: 'easy', botSeed: 2, choices: [[0]], result: 'win' };
    const got = parseReplays(JSON.stringify([ok, { ...ok, choices: 'x' }]));
    expect(got).toHaveLength(1);
    expect(got[0].decks[1].sideboard).toEqual([]);
  });
  it('old entries without an id still load, and an id upserts', () => {
    store.set('nct.practice.v1', JSON.stringify([{ date: 'd', deck: 'A', opp: 'B', level: 'easy', result: 'loss', first: true, turns: 9, reason: 'r' }]));
    const e = { id: 'p9', date: 'd', deck: 'A', opp: 'B', level: 'easy', result: 'win' as const, first: true, turns: 9, reason: 'r' };
    recordPractice(e);
    recordPractice({ ...e, result: 'loss' });
    const all = loadPractice();
    expect(all).toHaveLength(2);
    expect(all[1]).toMatchObject({ id: 'p9', result: 'loss' });
  });
});

describe('replay frames', () => {
  it('each frame carries its own log line, matching the final log', async () => {
    const data = await recordReplay(decks, [makeTierBot('easy', 1), makeTierBot('easy', 2)], 17, 0);
    expect(data.frames.length).toBe(data.final.log.length);
    data.frames.forEach((f, i) => {
      expect(f.at).toBe(i);
      expect(lineInFinalLog(data, f)).toBe(i);
      expect(f.line).toEqual(data.final.log[i]);
    });
  }, 30_000);
  it('stays aligned when the engine trims old log lines', async () => {
    const g = Game.create(decks, [makeTierBot('easy', 1), makeTierBot('easy', 2)], { seed: 17, first: 0 });
    // a long game: the log is near its cap, so the engine drops its oldest 500 lines mid-game
    const filler = Array.from({ length: 1995 - g.s.log.length }, (_, i) => ({ turn: 0, player: null, text: `filler ${i}` }));
    g.s.log.unshift(...filler);
    const frames = captureFrames(g);
    const final = await g.run();
    expect(final.log.length).toBeLessThan(2001);
    expect(frames.length).toBeGreaterThan(5);
    const data = { final, frames };
    let matched = 0;
    for (const f of frames) {
      const i = lineInFinalLog(data, f);
      if (i < 0) continue;
      expect(final.log[i]).toEqual(f.line);
      matched++;
    }
    expect(matched).toBe(frames.length);
    expect(frames[frames.length - 1].line).toEqual(final.log[final.log.length - 1]);
  }, 30_000);
});
