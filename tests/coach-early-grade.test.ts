// A move made before the coach's advice arrived is graded when the advice for THAT decision lands (src/lib/coachGrading.ts,
// the coach client's `adviceFor` in src/ui/useCoach.ts; ROADMAP2 §11 item 15). The order: answer first, then the advice
// arrives, and the grade takes the move's own place among the grades, never a later move's; Undo before it lands drops
// it; advice that never comes leaves the move not measured. The game and its record are those of a game with the coach
// off, and the grades those of a game where every piece of advice was in before the answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARDS } from '../src/engine/cards';
import { Game } from '../src/engine/engine';
import { makeTierBot } from '../src/ai/tiers';
import type { Decision, DeckList } from '../src/engine/types';
import { adviseRequest, coachWorthAsking, confirmMoveRequest, scoreMoveRequest, type Advice, type GradedOption } from '../src/ai/coach';
import { EARLY_MOVE_NOTE, gradeWhenAdvised, gradeWithAdvice, type GradeContext } from '../src/lib/coachGrading';
import type { CoachedGrade } from '../src/lib/coachedReplay';
import { PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { clearCoachAnswers, CoachClient } from '../src/ui/useCoach';
import type { CoachJob, CoachReply } from '../src/sim/coach.worker';

const store = new Map<string, string>();
beforeEach(() => {
  clearCoachAnswers();
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/** A promise answered by hand, as advice arriving later. */
function later<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: Error) => void;
  const p = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { p, resolve, reject };
}

const action = (n: number, prompt = 'Your move'): Decision =>
  ({ player: 0, kind: 'action', prompt, options: Array.from({ length: n }, (_, i) => ({ label: i ? `Play ${i}` : 'End turn', action: i ? { type: 'play', uid: i } : { type: 'pass' } })), min: 1, max: 1 }) as unknown as Decision;
const yesno = (prompt = '?'): Decision => ({ player: 0, kind: 'yesno', prompt, options: [{ label: 'Yes' }, { label: 'No' }], min: 1, max: 1 }) as Decision;
/** Advice valuing every option: option `i` is worth `v[i]` in each of two worlds. */
const valued = (index: number, v: number[]): Advice => ({ index, why: 'because', alternatives: [], grade: { kind: 'action', opts: v.map((x, i) => ({ i, v: x, w: [x, x] })), worlds: 2 } }) as unknown as Advice;

/** A confirmation that finds what the advice found: the pick's and the move's own values (the verdict stands). */
const sameAsAdvice: GradeContext['confirm'] = async (_d, i, a) => (a.grade?.opts ?? []).filter((o) => o.i === a.index || o.i === i);

function context(score: GradeContext['score'] = async () => [], confirm: GradeContext['confirm'] = sameAsAdvice) {
  const grades: CoachedGrade[] = [];
  const seen: [string, string | null][] = [];
  const ctx: GradeContext = { grades, score, confirm, onGrade: (gr, replaced) => void seen.push([gr.verdict, replaced ? replaced.verdict : null]) };
  return { ctx, grades, seen };
}

describe('a move made before its advice arrived', () => {
  it('answer first, then the advice: the grade lands in the move’s own place, keyed to its decision', async () => {
    const { ctx, grades, seen } = context();
    const d1 = action(3, 'first');
    const d2 = action(3, 'second');
    const early = later<Advice>();
    // answer 0 at d1, before its advice: a placeholder at its place
    const slot = gradeWhenAdvised(ctx, d1, 1, early.p, 0, 2);
    expect(grades).toEqual([slot]);
    expect(slot).toMatchObject({ verdict: 'pending', coach: '', gap: null, chose: 'Play 1' });
    expect(slot.record).toBeUndefined();
    // answer 1 at d2, with its advice showing: graded at once, after it
    gradeWithAdvice(ctx, d2, 2, valued(2, [0, 0, 100]), 1, 3);
    expect(grades.map((g) => g.record?.at)).toEqual([undefined, 1]);
    // now d1's advice lands: its grade takes the placeholder's place (answer 0, turn 2, d1's prompt), not d2's
    early.resolve(valued(2, [0, 100, 200]));
    await tick();
    expect(grades.map((g) => g.record?.at)).toEqual([0, 1]);
    expect(grades[0]!.record).toMatchObject({ at: 0, turn: 2, prompt: 'first', chose: 1, coach: 2 });
    expect(grades[0]!.verdict).toBe('mistake');
    expect(grades[0]!.confirmed).toBe(2);
    expect(grades[1]!.record).toMatchObject({ at: 1, prompt: 'second', verdict: 'agree' });
    // told once as given; d1's: landed in the placeholder's place as "checking" (a Mistake is confirmed before it
    // shows, REVIEW_2026-11-25 C1), then the confirmed grade in the checking one's place
    expect(seen).toEqual([
      ['agree', null],
      ['pending', 'pending'],
      ['mistake', 'pending'],
    ]);
  });

  it('a costly grade shows only once confirmed; a confirmation that never comes leaves the move not measured', async () => {
    const check = later<GradedOption[]>();
    const { ctx, grades, seen } = context(undefined, () => check.p);
    const first = gradeWithAdvice(ctx, action(3), 1, valued(2, [0, 0, 100]), 0, 2);
    // never the six-world verdict: "Checking your move…" until the fresh worlds are in
    expect(first).toMatchObject({ verdict: 'pending', gap: null });
    expect(grades).toEqual([first]);
    // the fresh worlds say the move is as good: Best, judged on them alone, with the screen kept beside
    check.resolve([
      { i: 2, v: 50, w: [50, 52, 48] },
      { i: 1, v: 50, w: [50, 51, 49] },
    ]);
    await tick();
    expect(grades[0]).toMatchObject({ verdict: 'best', gap: 0, confirmed: 3, screen: { verdict: 'mistake', gap: 2.5 } });
    expect(grades[0]!.record).toMatchObject({ verdict: 'best', confirmed: 3, screen: { verdict: 'mistake' }, fresh: [{ i: 2 }, { i: 1 }] });
    expect(seen).toEqual([
      ['pending', null],
      ['best', 'pending'],
    ]);
    // the check fails (the coach closed): not measured, in its place, never the unconfirmed Mistake
    const failed = later<GradedOption[]>();
    const two = context(undefined, () => failed.p);
    gradeWithAdvice(two.ctx, action(3), 1, valued(2, [0, 0, 100]), 0, 2);
    failed.reject(new Error('coach closed'));
    await tick();
    expect(two.grades[0]).toMatchObject({ verdict: 'unscored', gap: null, notMeasured: 'check' });
    // Undo before the check lands: dropped
    const slow = later<GradedOption[]>();
    const three = context(undefined, () => slow.p);
    gradeWithAdvice(three.ctx, action(3), 1, valued(2, [0, 0, 100]), 0, 2);
    three.grades.length = 0;
    slow.resolve([]);
    await tick();
    expect(three.grades).toHaveLength(0);
  });

  it('a move the advice did not value is then scored in its worlds and finished in place', async () => {
    const scored = later<GradedOption[]>();
    const { ctx, grades } = context(() => scored.p);
    const early = later<Advice>();
    gradeWhenAdvised(ctx, action(3), 1, early.p, 0, 1);
    early.resolve({ index: 2, why: 'w', alternatives: [] });
    await tick();
    expect(grades[0]!.verdict).toBe('pending');
    expect(grades[0]!.record?.at).toBe(0);
    scored.resolve([
      { i: 2, v: 50, w: [50, 50] },
      { i: 1, v: 50, w: [50, 50] },
    ] as GradedOption[]);
    await tick();
    // the only two options scored come out the same: no clear difference (REVIEW_2026-11-25 C3), measured in place
    expect(grades[0]!.verdict).toBe('unclear');
    expect(grades[0]!.record?.at).toBe(0);
  });

  it('Undo before the advice lands: the grade is dropped, and the moves played since keep theirs', async () => {
    const { ctx, grades } = context();
    const early = later<Advice>();
    gradeWhenAdvised(ctx, action(3, 'undone'), 1, early.p, 4, 2);
    // Undo truncates the grades by count (practiceSession), then a new answer is graded at the same place
    grades.length = 0;
    gradeWithAdvice(ctx, action(3, 'replayed'), 0, valued(0, [0, 0, 0]), 4, 2);
    early.resolve(valued(2, [0, 1, 2]));
    await tick();
    expect(grades).toHaveLength(1);
    expect(grades[0]!.record).toMatchObject({ at: 4, prompt: 'replayed' });
  });

  it('advice that never comes leaves the move not measured, in its place', async () => {
    const { ctx, grades } = context();
    const early = later<Advice>();
    gradeWhenAdvised(ctx, yesno(), 0, early.p, 0, 1);
    gradeWithAdvice(ctx, yesno('next'), 0, { index: 0, why: '', alternatives: [] }, 1, 1);
    early.reject(new Error('coach closed'));
    await tick();
    expect(grades.map((g) => g.verdict)).toEqual(['unscored', 'unscored']);
    expect(grades[0]!.record).toBeUndefined();
    expect(grades[1]!.record?.at).toBe(1);
  });

  it('the board says so plainly', () => {
    expect(EARLY_MOVE_NOTE).toBe('That move was made before the coach had finished thinking: it is graded when the coach’s advice for it arrives.');
  });
});

/** A stand-in worker: answers advice `index: id` after `ms`, and lists what it was sent. */
function stubWorker(ms = 5) {
  const posted: CoachJob[] = [];
  const w = {
    onmessage: null as null | ((e: { data: CoachReply }) => void),
    onerror: null,
    onmessageerror: null,
    terminate() {},
    postMessage(m: CoachJob) {
      posted.push(structuredClone(m));
      const reply: CoachReply = 'req' in m ? { id: m.id, advice: { index: m.id, why: `answer ${m.id}`, alternatives: [] } } : { id: m.id, scored: [] };
      setTimeout(() => w.onmessage?.({ data: reply }), ms);
    },
  };
  return { make: () => w as unknown as Worker, posted };
}
const newGame = (seed = 1) => Game.create([anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])], [makeTierBot('easy', seed), makeTierBot('easy', seed + 1)], { seed, first: 0 });

describe('the coach client keeps the advice a move already made waits for', () => {
  it('a newer request no longer supersedes it: it runs after the newer advice and answers its own decision', async () => {
    const w = stubWorker();
    const c = new CoachClient(w.make);
    const g = newGame();
    const d0 = yesno('busy');
    const d1 = yesno('answered early');
    const d2 = yesno('next');
    const a0 = c.advise(g, d0); // id 1, sent
    const a1 = c.advise(g, d1); // id 2, queued
    // you answer d1 before its advice: the board asks for that advice to grade the move
    expect(c.adviceFor(d1)).toBe(a1);
    const a2 = c.advise(g, d2); // id 3: the newer advice goes first, d1's is kept
    expect((await a0).index).toBe(1);
    expect((await a2).index).toBe(3);
    expect((await a1).index).toBe(2);
    expect(w.posted.map((m) => m.id)).toEqual([1, 3, 2]);
    // no advice asked: nothing to wait for
    expect(c.adviceFor(yesno('never asked'))).toBeNull();
  });

  it('dispose() rejects a kept request too', async () => {
    const c = new CoachClient(stubWorker().make);
    const g = newGame();
    void c.advise(g, yesno('busy')).catch(() => undefined);
    const d1 = yesno('early');
    void c.advise(g, d1).catch(() => undefined);
    const kept = c.adviceFor(d1)!;
    void c.advise(g, yesno('next')).catch(() => undefined);
    c.dispose();
    await expect(kept).rejects.toThrow('coach closed');
  });
});

// ---- a whole game: every move answered before its advice arrives ----

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const setup = (seed: number): MatchSetup => ({ decks: [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])], seed, first: 0, level: 'easy', botSeed: 4242 });

/** The real coach in this process, messages crossing as structured clones, each answer after a short wait. */
function realWorker() {
  return () => {
    const w = {
      onmessage: null as null | ((e: { data: CoachReply }) => void),
      onerror: null,
      onmessageerror: null,
      terminate() {},
      postMessage(m: CoachJob) {
        const job = structuredClone(m);
        void (async () => {
          await tick(1);
          const reply: CoachReply =
            'score' in job ? { id: job.id, scored: await scoreMoveRequest(job.score) } : 'confirm' in job ? { id: job.id, scored: await confirmMoveRequest(job.confirm) } : { id: job.id, advice: await adviseRequest(job.req) };
          w.onmessage?.({ data: structuredClone(reply) });
        })();
      },
    };
    return w as unknown as Worker;
  };
}

function choose(run: Running, d: Decision): number {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 1;
  if (d.kind === 'pay') return 0;
  return (run.replay.choices.length * 7 + run.g.s.turn * 3) % d.options.length;
}

async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}

/**
 * One game with the board's grading: `early` answers each decision the moment it is asked (the advice still on its
 * way, graded when it lands); otherwise the answer waits for the advice (graded at once); `off` asks nothing.
 */
async function play(mode: 'early' | 'waits' | 'off', seed = 31) {
  const session = new PracticeSession();
  const coach = new CoachClient(realWorker());
  let last: Decision | null = null;
  session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(async () => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      const ctx: GradeContext = { grades: run.grades, score: (x, i, a) => coach.score(x, i, a), confirm: (x, i, a) => coach.confirm(x, i, a), onGrade: () => undefined };
      const asked = mode !== 'off' && coachWorthAsking(d) && d.kind !== 'pay' ? coach.advise(run.g, d) : null;
      asked?.catch(() => undefined);
      const advice = mode === 'waits' && asked ? await asked : null;
      const i = choose(run, d);
      const at = run.replay.choices.length;
      const turn = run.g.s.turn;
      if (!run.human.answer(d, i)) return;
      if (advice) gradeWithAdvice(ctx, d, i, advice, at, turn);
      else if (asked) gradeWhenAdvised(ctx, d, i, coach.adviceFor(d)!, at, turn);
    }, 0);
  });
  session.start(setup(seed));
  const run = await finish(session);
  // let every grade land (advice and scores still on their way when the game ended)
  for (let k = 0; k < 2000 && run.grades.some((g) => g.verdict === 'pending'); k++) await tick(5);
  return { grades: JSON.parse(JSON.stringify(run.grades)) as CoachedGrade[], choices: JSON.stringify(run.replay.choices), state: JSON.stringify(run.g.s) };
}

describe('a whole game answered before every piece of advice', () => {
  it('the same game and record as with the coach off, and the same grades as when every answer waited for its advice', async () => {
    const early = await play('early');
    const waits = await play('waits');
    const off = await play('off');
    expect(early.choices).toBe(off.choices);
    expect(early.state).toBe(off.state);
    expect(waits.choices).toBe(off.choices);
    expect(early.grades.length).toBeGreaterThan(10);
    expect(early.grades.every((g) => g.verdict !== 'pending' && g.record)).toBe(true);
    expect(early.grades).toEqual(waits.grades);
    // in answer order, each keyed to its own answer
    const at = early.grades.map((g) => g.record!.at);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(new Set(at).size).toBe(at.length);
  }, 300_000);
});
