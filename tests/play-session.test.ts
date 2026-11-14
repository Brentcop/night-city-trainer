// The Play page's game loop without React: undo, cancellation, errors, recording, stale answers, hand order, replays.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { ReplayDiverged, reviewGame, ScriptedAgent } from '../src/ai/reviewer';
import { checkReplayed, practiceAgents, replayedEnd } from '../src/sim/practiceReview';
import type { Agent, Decision, DeckList, GameState } from '../src/engine/types';
import { canConcede, canUndo, CONCEDED_REASON, outcome, PracticeSession, rematchOf, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { HumanAgent } from '../src/ui/HumanAgent';
import { loadPractice, parsePractice, recordPractice } from '../src/lib/practiceLog';
import { loadReplays, parseReplays, practiceSpec, type PracticeReplay } from '../src/lib/practiceReplays';
import { buildSave, type SavedGame } from '../src/lib/savedGames';
import { stateHash } from '../src/lib/stateHash';
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
  const st = await Game.create(r.decks, [new ScriptedAgent('you', r.choices, fallback, !!r.payChoice, !!r.orderChoice), makeTierBot(r.botLevel, r.botSeed, 'Bot')], { seed: r.seed, first: r.first }).run();
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
    expect(run.replay.payChoice).toBe(true); // recorded with payment choices, replayed with them
    expect(run.replay.orderChoice).toBe(true); // likewise the order of the human's pending effects
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

describe('practice session: conceding', () => {
  /** Concede at your Nth main-phase decision (after a few turns), from inside the prompt. */
  function concedeAtPrompt(session: PracticeSession, nth = 6) {
    let seen = 0;
    const at: { turn: number; choices: number; log: number } = { turn: -1, choices: -1, log: -1 };
    drive(session, (run, d) => {
      if (at.turn >= 0 || d.kind !== 'action' || ++seen < nth) return false;
      at.turn = run.g.s.turn;
      at.choices = run.replay.choices.length;
      at.log = run.g.s.log.length;
      expect(canConcede(run)).toBe(true);
      expect(session.concede()).toBe(true);
      return true;
    });
    return at;
  }

  it('ends the game at a prompt as a loss, recorded once and marked conceded', async () => {
    const session = new PracticeSession();
    const at = concedeAtPrompt(session);
    session.start(setup(12, 0));
    const run = await finish(session);
    expect(at.turn).toBeGreaterThan(0);
    expect(run.conceded).toBe(true);
    expect(run.error).toBeNull();
    expect(run.human.pending).toBeNull();
    expect(run.g.s.winner).toBe(1);
    expect(run.g.s.winReason).toBe(CONCEDED_REASON);
    expect(run.g.s.turn).toBe(at.turn); // nothing was played after the concession
    expect(run.g.s.log.length).toBe(at.log + 1);
    expect(run.g.s.log.at(-1)?.text).toMatch(/You conceded/);
    expect(canConcede(run)).toBe(false);
    expect(session.concede()).toBe(false); // a second concede records nothing
    const log = loadPractice();
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ id: run.replay.id, result: 'loss', conceded: true, reason: CONCEDED_REASON, turns: at.turn });
    const reps = loadReplays();
    expect(reps).toHaveLength(1);
    expect(reps[0]).toMatchObject({ id: run.replay.id, result: 'loss', conceded: true });
    expect(reps[0].choices).toHaveLength(at.choices);
  }, 60_000);

  it('works during the bot turn: the bot stops at once and nothing more is recorded', async () => {
    const session = new PracticeSession({ pace: () => 5 });
    let conceded: { turn: number; log: number } | null = null;
    let armed = false;
    drive(session, (run, d) => {
      if (armed || d.kind !== 'action' || run.snaps.length < 3) return false;
      const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
      if (pass < 0) return false;
      armed = true;
      run.human.answer(d, pass); // end your turn, then concede once the bot is moving
      const wait = () => {
        if (run.g.s.active !== 1 || run.human.pending || run.g.s.winner !== null) return void setTimeout(wait, 1);
        expect(canUndo(run)).toBe(false); // the bot's turn: nothing to undo to right now
        expect(session.concede()).toBe(true);
        conceded = { turn: run.g.s.turn, log: run.g.s.log.length };
      };
      setTimeout(wait, 1);
      return true;
    });
    session.start(setup(4, 0));
    const run = await finish(session);
    expect(conceded).not.toBeNull();
    await new Promise((r) => setTimeout(r, 40)); // a bot that kept playing would add log lines now
    expect(run.g.s.winner).toBe(1);
    expect(run.g.s.turn).toBe(conceded!.turn);
    expect(run.g.s.log.length).toBe(conceded!.log);
    expect(loadPractice()).toHaveLength(1);
    expect(loadPractice()[0].conceded).toBe(true);
    expect(loadReplays()).toHaveLength(1);
    // Undo works as after any game over: back to before your last main-phase decision
    expect(canUndo(run)).toBe(true);
  }, 60_000);

  it('Undo after a concession returns to the position it was made from; finishing again replaces the record', async () => {
    const session = new PracticeSession();
    const at = concedeAtPrompt(session);
    session.start(setup(12, 0));
    const conceded = await finish(session);
    expect(conceded.conceded).toBe(true);
    expect(canUndo(conceded)).toBe(true);
    expect(session.undo()).toBe(true);
    const back = session.current!;
    expect(back).not.toBe(conceded);
    expect(back.match).toBe(conceded.match);
    expect(back.conceded).toBe(false);
    expect(back.replay.conceded).toBeUndefined();
    expect(back.g.s.winner).toBeNull();
    expect(back.g.s.turn).toBe(at.turn);
    expect(back.replay.choices).toHaveLength(at.choices);
    expect(back.human.pending?.d.kind).toBe('action'); // the very decision you conceded from
    const done = await finish(session);
    const log = loadPractice();
    expect(log).toHaveLength(1);
    expect(log[0].id).toBe(conceded.replay.id);
    expect(log[0].conceded).toBeUndefined();
    expect(log[0].result).toBe(outcome(done.g.s));
    expect(loadReplays()[0].conceded).toBeUndefined();
    const { st, fallbacks } = await replayOf(done);
    expect(fallbacks).toBe(0);
    expect(st.log).toEqual(done.g.s.log);
  }, 90_000);

  it('a conceded game’s replay loads and re-simulates up to the concession', async () => {
    const session = new PracticeSession();
    concedeAtPrompt(session, 4);
    session.start(setup(21, 0));
    const run = await finish(session);
    const [r] = parseReplays(store.get('nct.practiceReplays.v1') ?? null);
    expect(r).toMatchObject({ id: run.replay.id, conceded: true, result: 'loss' });
    // replaying the recorded choices reaches exactly the position you conceded from: the script runs out there
    class End extends Error {}
    const out: Agent = {
      name: 'out',
      decide: async () => {
        throw new End();
      },
    };
    const g = Game.create(r.decks, [new ScriptedAgent('you', r.choices, out, !!r.payChoice, !!r.orderChoice), makeTierBot(r.botLevel, r.botSeed, 'Bot')], { seed: r.seed, first: r.first });
    await expect(g.run()).rejects.toBeInstanceOf(End);
    expect(g.s.log).toEqual(run.g.s.log.slice(0, -1)); // everything but the concession line
  }, 60_000);

  it('the match review of a conceded game ends at the concession and reproduces the result', async () => {
    const session = new PracticeSession();
    concedeAtPrompt(session, 4);
    session.start(setup(21, 0));
    const run = await finish(session);
    const r = loadReplays()[0];
    const spec = { decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, payChoice: r.payChoice, orderChoice: r.orderChoice };
    // the re-simulation: the same game up to the concession, then a loss "You conceded"
    const st = await Game.create(r.decks, practiceAgents({ ...spec, conceded: true }), { seed: r.seed, first: r.first }).run();
    expect(st.winner).toBe(1);
    expect(st.winReason).toBe(CONCEDED_REASON);
    expect(st.turn).toBe(run.g.s.turn);
    expect(st.log.slice(0, -1)).toEqual(run.g.s.log.slice(0, -1)); // the last lines word the concession differently
    // without the concession the record runs out before the game ends: the strict replay refuses it, never a stand-in bot
    await expect(Game.create(r.decks, practiceAgents(spec), { seed: r.seed, first: r.first }).run()).rejects.toBeInstanceOf(ReplayDiverged);
    // the reviewer itself: same result as recorded, and only your decisions up to the concession are graded
    const review = await reviewGame(
      { decks: r.decks, seed: r.seed, first: r.first, agents: practiceAgents({ ...spec, conceded: true }), agentNames: ['you', r.botLevel] },
      { rollouts: 1, withCoach: false, seats: [0] },
    );
    expect(review.winner).toBe(1);
    expect(review.reason).toBe(CONCEDED_REASON);
    expect(review.turns).toBe(run.g.s.turn);
    expect(review.decisions.length).toBeGreaterThan(0);
    for (const d of review.decisions) expect(d.turn).toBeLessThanOrEqual(run.g.s.turn);
  }, 120_000);
});

describe('practice session: the recorded position', () => {
  /** The Game review's strict replay of a stored record (practiceSpec → practiceAgents → checkReplayed). */
  async function strict(r: PracticeReplay): Promise<GameState> {
    const q = practiceSpec(r);
    const agents = practiceAgents(q);
    const st = await Game.create(q.decks, agents, { seed: q.seed, first: q.first, log: false }).run();
    checkReplayed(q, agents, replayedEnd(st));
    return st;
  }
  const flip = (h: string) => (h[0] === '0' ? '1' : '0') + h.slice(1);
  const AT_WORDS = /\(at turn \d+ it reaches a different position from the one recorded\)\.$/;
  const END_WORDS = /\(it ends in a different position from the game that was played\)\.$/;
  const stored = () => {
    const reps = loadReplays();
    expect(reps).toHaveLength(1);
    return reps[0]!;
  };

  it('a finished game records its final position, End turn clicked or not, and its strict replay reaches it', async () => {
    for (const endTurnClick of [false, true]) {
      store.clear();
      const session = new PracticeSession();
      drive(session);
      session.start({ ...setup(11, 0), ...(endTurnClick ? { endTurnClick } : {}) });
      const run = await finish(session);
      const r = stored();
      expect(!!r.endTurnClick).toBe(endTurnClick);
      expect(r.position).toEqual({ hash: stateHash(run.g.s) });
      expect((await strict(r)).winner).toBe(run.g.s.winner);
      await expect(strict({ ...r, position: { hash: flip(r.position!.hash) } })).rejects.toThrow(END_WORDS);
      // the final position named as one of your decisions' is refused there
      await expect(strict({ ...r, position: { hash: r.position!.hash, at: 3 } })).rejects.toThrow(AT_WORDS);
    }
  }, 120_000);

  it('a game with several Undos records the final line’s position, and its strict replay reaches it', async () => {
    const session = new PracticeSession();
    let n = 0;
    drive(session, (_run, d) => d.kind === 'action' && [4, 10, 16].includes(++n) && session.undo());
    session.start(setup(13, 0));
    const run = await finish(session);
    expect(run.replay.undos).toBe(3);
    const r = stored();
    expect(r.position).toEqual({ hash: stateHash(run.g.s) });
    expect((await strict(r)).turn).toBe(run.g.s.turn);
  }, 120_000);

  it('a game conceded at a prompt records the position you conceded from; Undo takes it back and finishing records the end', async () => {
    const session = new PracticeSession();
    let seen = 0;
    let at: { hash: string; at: number } | null = null;
    drive(session, (run, d) => {
      if (at || d.kind !== 'action' || ++seen < 6) return false;
      at = { hash: stateHash(run.g.s), at: run.replay.choices.length };
      expect(session.concede()).toBe(true);
      return true;
    });
    session.start(setup(12, 0));
    const conceded = await finish(session);
    const r = stored();
    expect(r.conceded).toBe(true);
    expect(r.position).toEqual(at);
    expect(r.position!.at).toBe(r.choices.length);
    expect((await strict(r)).winReason).toBe(CONCEDED_REASON);
    await expect(strict({ ...r, position: { ...r.position!, hash: flip(r.position!.hash) } })).rejects.toThrow(AT_WORDS);
    await expect(strict({ ...r, position: { ...r.position!, at: r.position!.at! - 1 } })).rejects.toThrow(AT_WORDS);
    // Undo takes the concession back, and its position with it; the game finished on records its final one
    expect(session.undo()).toBe(true);
    expect(session.current!.replay.position).toBeUndefined();
    const done = await finish(session);
    expect(done).not.toBe(conceded);
    const again = stored();
    expect(again.conceded).toBeUndefined();
    expect(again.position).toEqual({ hash: stateHash(done.g.s) });
    await strict(again);
    // a rematch is a new game: no position until it ends
    session.start(rematchOf(again, { endTurnClick: false, seed: 77, botSeed: 78 }));
    expect(session.current!.replay.id).not.toBe(again.id);
    expect(session.current!.replay.position).toBeUndefined();
    session.quit();
  }, 120_000);

  it('a game conceded while the bot was moving records your last decision before it', async () => {
    const session = new PracticeSession({ pace: () => 5 });
    let stable: { hash: string; at: number } | null = null;
    let armed = false;
    drive(session, (run, d) => {
      if (armed || d.kind !== 'action' || run.snaps.length < 3) return false;
      const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
      if (pass < 0) return false;
      armed = true;
      stable = { hash: stateHash(run.g.s), at: run.replay.choices.length };
      run.human.answer(d, pass);
      const wait = () => {
        if (run.g.s.active !== 1 || run.human.pending || run.g.s.winner !== null) return void setTimeout(wait, 1);
        expect(session.concede()).toBe(true);
      };
      setTimeout(wait, 1);
      return true;
    });
    session.start(setup(4, 0));
    await finish(session);
    const r = stored();
    expect(r.position).toEqual(stable);
    expect(r.choices.length).toBe(stable!.at + 1); // the End turn answered before the concession
    expect((await strict(r)).winReason).toBe(CONCEDED_REASON);
    await expect(strict({ ...r, position: { ...r.position!, hash: flip(r.position!.hash) } })).rejects.toThrow(AT_WORDS);
  }, 60_000);

  it('a game conceded at once is checked at your first decision', async () => {
    const session = new PracticeSession();
    session.start(setup(5, 0));
    // the first decision (the opening hand) is asked as the game starts
    expect(session.current!.stable?.at).toBe(0);
    expect(session.concede()).toBe(true);
    const r = stored();
    expect(r.conceded).toBe(true);
    expect(r.choices).toEqual([]);
    expect(r.position).toEqual({ hash: session.current!.stable!.hash, at: 0 });
    expect((await strict(r)).winReason).toBe(CONCEDED_REASON);
    await expect(strict({ ...r, position: { hash: flip(r.position!.hash), at: 0 } })).rejects.toThrow(AT_WORDS);
  });

  it('a game saved, restored and finished records its final position, End turn clicked or not', async () => {
    for (const endTurnClick of [false, true]) {
      store.clear();
      const a = new PracticeSession();
      const save = await new Promise<SavedGame>((resolve) => {
        drive(a, (run, d) => {
          if (run.replay.choices.length < 14 || d.kind !== 'action') return false;
          resolve(buildSave({ replay: run.replay, grades: [], stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: '2026-11-14T10:00:00Z', coach: false })!);
          return true;
        });
        a.start({ ...setup(17, 0), ...(endTurnClick ? { endTurnClick } : {}) });
      });
      a.quit();
      expect(loadReplays()).toEqual([]);
      const b = new PracticeSession();
      drive(b);
      expect((await b.restore(save)).ok).toBe(true);
      const run = await finish(b);
      const r = stored();
      expect(!!r.endTurnClick).toBe(endTurnClick);
      expect(r.position).toEqual({ hash: stateHash(run.g.s) });
      expect((await strict(r)).turn).toBe(run.g.s.turn);
    }
  }, 120_000);
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
