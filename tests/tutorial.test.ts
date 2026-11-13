// The tutorial (src/lib/tutorial.ts, src/content/tutorial/): every lesson is played headlessly on the real engine with
// its expected moves, step by step, so an engine or card change that breaks a lesson fails here instead of stranding a
// learner. Also: a wrong move is refused with the step's hint, nothing outside the progress key is written, and the
// progress store reads defensively.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LESSONS, lessonById } from '../src/content/tutorial/lessons';
import { LessonRun, buildPosition, type Lesson } from '../src/lib/tutorial';
import { copyState } from '../src/engine/copyState';
import { clearTutorial, hideNudge, LESSON_IDS, loadTutorial, markDone, parseTutorial, TUTORIAL_KEY } from '../src/lib/tutorialProgress';

const tick = () => new Promise((r) => setTimeout(r, 0));

/** Wait until the lesson asks you something, or stops. */
async function settle(run: LessonRun) {
  for (let i = 0; i < 2000; i++) {
    if (run.seat.pending || run.status !== 'running') return;
    await tick();
  }
  throw new Error(`lesson ${run.lesson.id} hung at step ${run.stepIndex + 1}`);
}

/** Play a lesson with its expected moves; returns the run and the step numbers each decision was answered at. */
async function playThrough(lesson: Lesson, onDecision?: (run: LessonRun) => void) {
  const run = new LessonRun(lesson);
  const done = run.start();
  const trail: string[] = [];
  for (let guard = 0; guard < 100; guard++) {
    await settle(run);
    if (run.status !== 'running') break;
    // read the explanation pages, as a learner would
    while (run.canNext && run.step?.do === undefined) run.next();
    while (run.canNext) run.next();
    const d = run.seat.pending!.d;
    onDecision?.(run);
    const ok = run.expected();
    expect(ok.length, `${lesson.id} step ${run.stepIndex + 1}: no expected option for "${d.prompt}"`).toBeGreaterThan(0);
    trail.push(`${run.stepIndex + 1}:${d.kind}`);
    expect(run.seat.answer(d, ok[0])).toBe(true);
  }
  await done;
  return { run, trail };
}

function memoryStorage() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, String(v)),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
    key: (i: number) => [...m.keys()][i] ?? null,
    get length() {
      return m.size;
    },
  };
}
let store: ReturnType<typeof memoryStorage>;
beforeEach(() => {
  store = memoryStorage();
  vi.stubGlobal('localStorage', store);
  vi.stubGlobal('sessionStorage', memoryStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe('every lesson plays to its goal on the engine', () => {
  for (const lesson of LESSONS) {
    it(`${lesson.id}: ${lesson.title}`, async () => {
      const { run } = await playThrough(lesson);
      expect(run.error).toBeNull();
      expect(run.status).toBe('complete');
      expect(run.stepIndex).toBe(lesson.steps.length);
      expect(run.offPlan).toBe(0);
      expect(lesson.goalMet(run.g)).toBe(true);
      expect(run.view().end).toBeTruthy();
      // the game behind a lesson is ordinary plain state
      expect(() => copyState(run.g.s)).not.toThrow();
    });
  }

  it('what the words say is what happens', async () => {
    const atStep = new Map<string, number>();
    const money = (r: LessonRun) => atStep.set(`${r.lesson.id}:${r.stepIndex + 1}`, r.g.available(0));
    const card = (r: LessonRun, p: 0 | 1, id: string) => Object.values(r.g.s.cards).filter((c) => c.owner === p && c.defId === id);
    // 1: 6/7 Gigs, then the win at the start of your turn
    let r = (await playThrough(lessonById('table')!)).run;
    expect(r.g.s.winner).toBe(0);
    expect(r.g.s.winReason).toContain('start of turn');
    // 2: "5 of 5" €$, "from 5 to 6", "2 €$ left", Emergency Atlus costs 3
    r = (await playThrough(lessonById('turn')!, money)).run;
    expect([atStep.get('turn:1'), atStep.get('turn:2'), atStep.get('turn:4')]).toEqual([5, 6, 2]);
    expect(r.g.def(card(r, 0, 'emergency_atlus')[0]).cost).toBe(3);
    // 3: 6 vs 4, Animals Wrecker steals 2, then the rival's Rockn' Rockerboy beats the spent Psycho Squad 8 to 6
    r = (await playThrough(lessonById('attack')!)).run;
    expect(card(r, 0, 'psycho_squad').filter((c) => c.zone === 'trash')).toHaveLength(1);
    expect(r.g.gigsOf(1)).toHaveLength(2); // 1 left after the steal, then the rival rolled one in
    // 4: the block wins 5 to 4; Take Control makes the 8-power attack steal nothing
    r = (await playThrough(lessonById('defend')!)).run;
    expect(card(r, 0, 'meredith_stout_stone_cold_corpo')[0].zone).toBe('field');
    expect(r.g.s.log.some((l) => l.text.includes('steals nothing'))).toBe(true);
    // 5: V and Rockn' Rockerboy both lose at 8 against 8; V is removed, the Unit goes to the trash
    r = (await playThrough(lessonById('legends')!)).run;
    expect(card(r, 1, 'rockn_rockerboy')[0].zone).toBe('trash');
    // 6: 6 + 2 = 8 power
    r = (await playThrough(lessonById('gear')!)).run;
    expect(r.g.power(card(r, 0, 'psycho_squad').find((c) => c.zone === 'field')!)).toBe(8);
    // 8: the Easy bot can't take a Gig back, and you win
    r = (await playThrough(lessonById('together')!)).run;
    expect(r.g.s.winner).toBe(0);
  });

  it('lesson ids are unique and every lesson has words for each step', () => {
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(LESSONS.length);
    expect([...LESSON_IDS]).toEqual(LESSONS.map((l) => l.id));
    for (const l of LESSONS) {
      expect(lessonById(l.id)).toBe(l);
      for (const s of l.steps) {
        expect(s.do !== undefined || (s.read?.length ?? 0) > 0).toBe(true);
        if (s.do !== undefined) {
          expect(s.expect, `${l.id}: a step with an instruction names its move`).toBeTypeOf('function');
          expect(s.hint, `${l.id}: a step with an instruction has a hint`).toBeTruthy();
        }
      }
    }
  });

  it('the positions are built the same every time (a lesson is the same lesson for everyone)', () => {
    for (const l of LESSONS) {
      const agent = { name: 'x', decide: async () => [0] };
      const a = buildPosition(l.position, [agent, agent]).s;
      const b = buildPosition(l.position, [agent, agent]).s;
      expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    }
  });
});

describe('a wrong move', () => {
  it('is refused with the step’s hint, and the right move still works after it', async () => {
    let refused = 0;
    const { run } = await playThrough(lessonById('table')!, (r) => {
      const d = r.seat.pending!.d;
      const ok = r.expected();
      const wrong = d.options.findIndex((_o, i) => !ok.includes(i));
      if (wrong < 0) return;
      expect(r.seat.answer(d, wrong)).toBe(false);
      expect(r.hint).toBe(r.step!.hint);
      expect(r.view().hint).toBe(r.step!.hint);
      expect(r.seat.pending?.d).toBe(d); // still waiting for the same decision
      refused++;
    });
    expect(refused).toBeGreaterThan(0);
    expect(run.status).toBe('complete');
    expect(run.hint).toBeNull();
  });

  it('a stale or out-of-range answer is ignored, not a crash', async () => {
    const run = new LessonRun(lessonById('turn')!);
    const done = run.start();
    await settle(run);
    const d = run.seat.pending!.d;
    expect(run.seat.answer(d, -1)).toBe(false);
    expect(run.seat.answer(d, d.options.length)).toBe(false);
    expect(run.seat.answer({ ...d }, 0)).toBe(false);
    run.stop();
    await done;
    expect(run.status).toBe('running');
    expect(run.stopped).toBe(true);
  });

  it('acting on the instruction before reading every page is accepted', async () => {
    const run = new LessonRun(lessonById('turn')!);
    const done = run.start();
    await settle(run);
    expect(run.canNext).toBe(true); // still on the first explanation page
    const d = run.seat.pending!.d;
    expect(run.seat.answer(d, run.expected()[0])).toBe(true);
    await settle(run);
    expect(run.stepIndex).toBe(1);
    run.stop();
    await done;
  });
});

describe('tutorial games are not real games', () => {
  it('a completed lesson writes nothing to storage (practice log, replays, autosave, saves, reviews)', async () => {
    for (const l of LESSONS) await playThrough(l);
    expect([...store.m.keys()]).toEqual([]);
    markDone('table');
    expect([...store.m.keys()]).toEqual([TUTORIAL_KEY]);
  });
});

describe('progress store (nct.tutorial.v1)', () => {
  it('marks lessons done once, hides the Play nudge, and Start over clears it', () => {
    expect(loadTutorial()).toEqual({ done: [], nudgeHidden: false });
    markDone('table');
    markDone('table');
    markDone('turn');
    expect(loadTutorial().done).toEqual(['table', 'turn']);
    hideNudge();
    expect(loadTutorial().nudgeHidden).toBe(true);
    clearTutorial();
    expect(store.m.has(TUTORIAL_KEY)).toBe(false);
    expect(loadTutorial()).toEqual({ done: [], nudgeHidden: false });
  });

  it('reads anything defensively: junk, another version, unknown or repeated ids', () => {
    const empty = { done: [], nudgeHidden: false };
    expect(parseTutorial(null)).toEqual(empty);
    expect(parseTutorial('not json')).toEqual(empty);
    expect(parseTutorial('[]')).toEqual(empty);
    expect(parseTutorial(JSON.stringify({ kind: 'nct-tutorial', schema: 2, done: ['table'] }))).toEqual(empty);
    expect(parseTutorial(JSON.stringify({ kind: 'other', schema: 1, done: ['table'] }))).toEqual(empty);
    expect(parseTutorial(JSON.stringify({ kind: 'nct-tutorial', schema: 1, done: ['table', 'table', 'nope', 3, 'gigs'], nudgeHidden: 'yes' }))).toEqual({ done: ['table', 'gigs'], nudgeHidden: false });
  });

  it('works with storage blocked', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
      removeItem: () => {
        throw new Error('blocked');
      },
    });
    expect(loadTutorial()).toEqual({ done: [], nudgeHidden: false });
    expect(() => markDone('table')).not.toThrow();
    expect(() => clearTutorial()).not.toThrow();
  });
});
