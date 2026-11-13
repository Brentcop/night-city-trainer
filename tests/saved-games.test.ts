// Saved practice games (src/lib/savedGames.ts, PracticeSession.restore): a save replays to the identical position and
// plays on identically; prompts restore; other code is refused; files are validated; slots are capped.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../src/engine/cards';
import type { Decision, DeckList } from '../src/engine/types';
import { canUndo, PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import {
  addSlot,
  buildSave,
  clearAutosave,
  deleteSlot,
  loadAutosave,
  loadSlots,
  MAX_SLOTS,
  MISMATCH_WHY,
  parseSavedGame,
  renameSlot,
  restoredGrades,
  SAVED_GAME_SCHEMA,
  saveFileText,
  storageWorks,
  writeAutosave,
  type SavedGame,
} from '../src/lib/savedGames';
import { SIM_VERSION } from '../src/lib/tournament';
import type { CoachedGrade } from '../src/lib/coachedReplay';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number, level = 'medium'): MatchSetup => ({ decks, seed, first: 0, level, botSeed: 4242 });

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

/** A deterministic "player": the answer depends only on the decision and how many answers came before. */
function choose(run: Running, d: Decision): number {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 1;
  const k = run.replay.choices.length;
  return (k * 7 + run.g.s.turn * 3) % d.options.length;
}

/**
 * Drive the session's games: `hook` sees each new decision of yours first (with the state then) and returns true to
 * stop answering. Answers come on a timer, like a person.
 */
function drive(session: PracticeSession, hook: (run: Running, d: Decision) => boolean | void) {
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(() => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      if (hook(run, d)) return;
      run.human.answer(d, choose(run, d));
    }, 0);
  });
}

const saveOf = (run: Running, coach = true, grades = run.grades) =>
  buildSave({ replay: run.replay, grades, stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: '2026-11-12T10:00:00Z', coach })!;

/** Start a game and play until `stopAt(run, d)` says so; resolves with the run and the decision it stopped at. */
function playUntil(session: PracticeSession, m: MatchSetup, stopAt: (run: Running, d: Decision) => boolean): Promise<{ run: Running; d: Decision }> {
  return new Promise((resolve, reject) => {
    drive(session, (run, d) => {
      if (!stopAt(run, d)) return false;
      resolve({ run, d });
      return true;
    });
    void session.start(m).done.then(() => reject(new Error('the game ended first')));
  });
}

describe('saved games: restore', () => {
  it('a save mid-game restores the identical state, and the next 20 decisions play out identically', async () => {
    // the uninterrupted game: states at each of your decisions from the 15th on
    const a = new PracticeSession();
    const statesA: string[] = [];
    let save: SavedGame | null = null;
    const doneA = new Promise<void>((resolve) => {
      drive(a, (run) => {
        const k = run.replay.choices.length;
        if (k === 15) save = saveOf(run);
        if (k >= 15) statesA.push(JSON.stringify(run.g.s));
        if (statesA.length > 20 || run.g.s.winner !== null) {
          resolve();
          return true;
        }
        return false;
      });
    });
    a.start(setup(21));
    await doneA;
    a.quit();
    expect(save).not.toBeNull();
    expect(statesA.length).toBe(21);

    const b = new PracticeSession();
    const statesB: string[] = [];
    const doneB = new Promise<void>((resolve) => {
      drive(b, (run) => {
        statesB.push(JSON.stringify(run.g.s));
        if (statesB.length > 20) {
          resolve();
          return true;
        }
        return false;
      });
    });
    const r = await b.restore(save!);
    expect(r.ok).toBe(true);
    const run = b.current!;
    expect(run.restoring).toBe(false);
    expect(run.replay.choices).toEqual(save!.choices);
    expect(run.replay.id).toBe(save!.replayId);
    expect(JSON.stringify(run.g.s)).toBe(statesA[0]);
    // Undo works before the resume point: the replay rebuilt a snapshot before each of your main-phase decisions
    expect(run.snaps.length).toBeGreaterThan(0);
    await doneB;
    expect(statesB).toEqual(statesA);
    b.quit();
  }, 60_000);

  it('a save taken while you answer a prompt brings the same prompt back', async () => {
    let checked = 0;
    for (const seed of [3, 4, 5, 6, 7, 8, 9, 10]) {
      const a = new PracticeSession();
      const p = playUntil(a, setup(seed), (run, d) => run.replay.choices.length > 3 && d.kind !== 'action' && d.kind !== 'reaction');
      const got = await p.catch(() => null);
      if (!got) continue;
      const save = saveOf(got.run);
      const state = JSON.stringify(got.run.g.s);
      a.quit();
      const b = new PracticeSession();
      const r = await b.restore(save);
      expect(r.ok).toBe(true);
      const d = b.current!.human.pending!.d;
      expect([d.kind, d.prompt, d.options.map((o) => o.label)]).toEqual([got.d.kind, got.d.prompt, got.d.options.map((o) => o.label)]);
      expect(JSON.stringify(b.current!.g.s)).toBe(state);
      // answering it plays on
      expect(b.current!.human.answer(d, 0)).toBe(true);
      b.quit();
      if (++checked >= 2) break;
    }
    expect(checked).toBeGreaterThan(0);
  }, 120_000);

  it('a save taken at a payment choice (paying sources by hand) restores to that payment choice', async () => {
    let found = false;
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
      const a = new PracticeSession();
      const p = playUntil(a, setup(seed), (_run, d) => d.kind === 'pay');
      const got = await p.catch(() => null);
      a.quit();
      if (!got) continue;
      const b = new PracticeSession();
      expect((await b.restore(saveOf(got.run))).ok).toBe(true);
      const d = b.current!.human.pending!.d;
      expect(d.kind).toBe('pay');
      expect(d.options.map((o) => o.label)).toEqual(got.d.options.map((o) => o.label));
      b.quit();
      found = true;
      break;
    }
    expect(found).toBe(true);
  }, 120_000);

  it('a save taken while the bot was moving replays your last answer and its moves, then waits for you', async () => {
    // a slow bot, so the save is taken while it is still moving
    const a = new PracticeSession({ pace: () => 20 });
    let save: SavedGame | null = null;
    let next = '';
    const done = new Promise<void>((resolve) => {
      drive(a, (run, d) => {
        if (save) {
          next = JSON.stringify(run.g.s);
          resolve();
          return true;
        }
        if (d.kind === 'action' && run.replay.choices.length > 10) {
          const pass = d.options.findIndex((o) => (o.action as { type?: string } | undefined)?.type === 'pass');
          if (pass < 0) return false;
          run.human.answer(d, pass);
          // your turn is over and the bot is up: the save has one answer past its check
          void (async () => {
            for (let i = 0; i < 5; i++) await Promise.resolve();
            expect(run.human.pending).toBeNull();
            save = saveOf(run);
          })();
          return true;
        }
        return false;
      });
    });
    a.start(setup(31));
    await done;
    a.quit();
    expect(save!.choices.length).toBe(save!.check.at + 1);
    const b = new PracticeSession();
    expect((await b.restore(save!)).ok).toBe(true);
    expect(JSON.stringify(b.current!.g.s)).toBe(next);
    b.quit();
  }, 60_000);

  it('coach grades come back with the answers they graded (a grade still being scored comes back unscored)', async () => {
    const a = new PracticeSession();
    const p = playUntil(a, setup(41), (run) => run.replay.choices.length >= 8);
    const { run } = await p;
    const grade = (at: number, verdict: CoachedGrade['verdict']): CoachedGrade => ({ turn: 1, chose: 'x', coach: 'y', gap: null, verdict, record: { at, verdict } as CoachedGrade['record'] });
    const grades = [grade(2, 'agree'), grade(5, 'pending')];
    const save = saveOf(run, true, grades);
    a.quit();
    const b = new PracticeSession();
    expect((await b.restore(save)).ok).toBe(true);
    const back = b.current!;
    expect(back.grades.map((g) => [g.record?.at, g.verdict, g.record?.verdict])).toEqual([
      [2, 'agree', 'agree'],
      [5, 'unscored', 'unscored'],
    ]);
    expect(restoredGrades(save)[1].verdict).toBe('unscored');
    // each snapshot knows how many grades came before it, so Undo truncates them as in a game never saved
    expect(back.snaps.every((s) => s.grades === grades.filter((g) => g.record!.at < s.choices).length)).toBe(true);
    expect(canUndo(back)).toBe(true);
    b.quit();
  }, 60_000);

  it('another version, a different position or impossible moves are refused, never resumed', async () => {
    const a = new PracticeSession();
    const p = playUntil(a, setup(51), (run) => run.replay.choices.length >= 6);
    const { run } = await p;
    const save = saveOf(run);
    a.quit();

    const b = new PracticeSession();
    const older = await b.restore({ ...save, simVersion: SIM_VERSION - 1 });
    expect(older).toMatchObject({ ok: false, mismatch: true });
    expect(older.ok ? '' : older.why).toContain(`version ${SIM_VERSION - 1}`);
    expect(b.current).toBeNull();

    const moved = await b.restore({ ...save, check: { ...save.check, hash: '0000000000000000' } });
    expect(moved).toEqual({ ok: false, why: MISMATCH_WHY, mismatch: true });
    expect(b.current).toBeNull();

    const impossible = await b.restore({ ...save, choices: save.choices.map((c, i) => (i === 2 ? [99] : c)) });
    expect(impossible).toMatchObject({ ok: false, mismatch: true });
    expect(b.current).toBeNull();
    // nothing was recorded by the failed restores
    expect(store.get('nct.practiceLog.v1') ?? null).toBeNull();
  }, 60_000);

  it('the autosave is written at each decision and cleared when the game is exited, but kept when the page is left', async () => {
    const writes: number[] = [];
    let closed = '';
    const session = new PracticeSession({ onStable: (run) => void writes.push(run.replay.choices.length), onClosed: (_r, why) => void (closed = why) });
    const p = playUntil(session, setup(61), (run) => run.replay.choices.length >= 4);
    await p;
    expect(writes).toEqual([0, 1, 2, 3, 4]);
    session.quit({ keepSave: true });
    expect(closed).toBe('');
    await playUntil(session, setup(62), (run) => run.replay.choices.length >= 1);
    session.quit();
    expect(closed).toBe('quit');
  }, 60_000);
});

describe('saved games: files and storage', () => {
  const sample = (): SavedGame => ({
    kind: 'nct-saved-game',
    schema: 1,
    id: 'auto',
    name: 'A vs B, turn 3',
    saved: '2026-11-12T10:00:00Z',
    simVersion: SIM_VERSION,
    replayId: 'p1',
    started: '2026-11-12T09:00:00Z',
    decks,
    seed: 1,
    first: 0,
    botLevel: 'hard',
    botSeed: 2,
    choices: [[1], [0]],
    coach: true,
    grades: [],
    check: { at: 2, turn: 3, hash: 'abcd', decision: { kind: 'action', prompt: 'Choose an action', options: ['End turn'] } },
    turn: 3,
    gigs: [1, 2],
    log: [{ turn: 1, player: 0, text: 'hello' }],
  });

  it('a file round-trips; bad, other and newer files are refused with a reason', () => {
    const s = sample();
    expect(parseSavedGame(saveFileText(s))).toEqual({ ok: true, value: s });
    expect(parseSavedGame('{')).toMatchObject({ ok: false, why: expect.stringContaining('not JSON') });
    expect(parseSavedGame(JSON.stringify({ kind: 'nct-coached-replay', schema: 1 }))).toMatchObject({ ok: false, why: 'This file is not a saved game.' });
    const newer = parseSavedGame(JSON.stringify({ ...s, schema: SAVED_GAME_SCHEMA + 1 }));
    expect(newer).toMatchObject({ ok: false, why: expect.stringContaining('newer version') });
    expect(parseSavedGame({ ...s, choices: [['x']] })).toMatchObject({ ok: false, why: expect.stringContaining('damaged') });
    expect(parseSavedGame({ ...s, check: { ...s.check, at: 5 } })).toMatchObject({ ok: false });
    expect(parseSavedGame({ ...s, decks: [{ ...decks[0], main: ['no_such_card'] }, decks[1]] })).toMatchObject({ ok: false, why: expect.stringContaining('no_such_card') });
  });

  it('slots are capped and never overwritten; rename and delete work; the autosave is separate', () => {
    for (let i = 0; i < MAX_SLOTS; i++) expect(addSlot({ ...sample(), name: `g${i}` }).ok).toBe(true);
    const full = addSlot(sample());
    expect(full).toMatchObject({ ok: false, why: expect.stringContaining(`All ${MAX_SLOTS}`) });
    const list = loadSlots();
    expect(list.map((x) => x.name)).toEqual(['g0', 'g1', 'g2', 'g3', 'g4']); // oldest first
    expect(new Set(list.map((x) => x.id)).size).toBe(MAX_SLOTS);
    expect(renameSlot(list[1].id, '  mine ')[1].name).toBe('mine');
    expect(deleteSlot(list[0].id).map((x) => x.name)).toEqual(['mine', 'g2', 'g3', 'g4']);
    expect(loadAutosave()).toBeNull();
    expect(writeAutosave(sample())).toBe(true);
    expect(loadAutosave()?.name).toBe('A vs B, turn 3');
    clearAutosave();
    expect(loadAutosave()).toBeNull();
  });

  it('blocked storage reads as empty and says it does not work', () => {
    const boom = () => {
      throw new Error('blocked');
    };
    vi.stubGlobal('localStorage', { getItem: boom, setItem: boom, removeItem: boom });
    expect(storageWorks()).toBe(false);
    expect(loadSlots()).toEqual([]);
    expect(loadAutosave()).toBeNull();
    expect(writeAutosave(sample())).toBe(false);
    expect(addSlot(sample()).ok).toBe(false);
    expect(() => clearAutosave()).not.toThrow();
  });

  it('a save is small enough for localStorage, even late in a game with a coach grade on every move', async () => {
    // a coach grade as the board keeps it: the decision's options, the advice and the scores (about the real size)
    const grade = (d: Decision, at: number, turn: number): CoachedGrade => ({
      turn,
      chose: d.options[0].label,
      coach: d.options[0].label,
      gap: 0.12,
      se: 0.05,
      verdict: 'close',
      record: {
        at,
        turn,
        kind: d.kind,
        prompt: d.prompt,
        options: d.options.map((o) => o.label),
        chose: 0,
        coach: 0,
        why: 'Keeps your strongest Unit ready for the steal next turn while the rival is low on Eddies.',
        alternatives: d.options.slice(0, 3).map((o) => ({ label: o.label, gap: '0.12', noise: false, se: 0.05 })) as never,
        verdict: 'close',
        gap: 0.12,
        se: 0.05,
        scoreKind: 'main',
        scores: d.options.map((_, i) => ({ i, v: 1234.5, w: [1200, 1250, 1260, 1230] })),
      },
    });
    let biggest = 0;
    const session = new PracticeSession();
    const grades: CoachedGrade[] = [];
    await new Promise<void>((resolve) => {
      drive(session, (run, d) => {
        if (d.options.length > 1) grades.push(grade(d, run.replay.choices.length, run.g.s.turn));
        biggest = Math.max(biggest, JSON.stringify(saveOf(run, true, grades)).length);
      });
      void session.start(setup(71, 'hard')).done.then(() => resolve());
    });
    console.info(`largest save: ${biggest} bytes`);
    expect(biggest).toBeLessThan(200_000);
  }, 60_000);
});
