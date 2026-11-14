// The coach's answer cache (src/ui/useCoach.ts `answers`): a position already answered in this tab is answered from
// memory, exactly as a fresh computation would answer it. Undo and a restored save re-ask byte-identical requests (pinned
// here: a change that breaks that makes the cache useless and fails below), and a scripted game with Undos gives the same
// coach grades and records with the cache as without it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { adviseRequest, coachRequest, coachWorthAsking, gradeMove, scoreMoveRequest, type Advice, type GradedOption } from '../src/ai/coach';
import type { SeatLift } from '../src/ai/packageLift';
import { exactText } from '../src/lib/exactText';
import { coachedGrade, type CoachedGrade } from '../src/lib/coachedReplay';
import { PracticeSession, type MatchSetup, type Running } from '../src/lib/practiceSession';
import { buildSave, type SavedGame } from '../src/lib/savedGames';
import { clearCoachAnswers, CoachClient, coachAnswersKept, COACH_ANSWERS_MAX } from '../src/ui/useCoach';
import type { CoachJob, CoachReply } from '../src/sim/coach.worker';
import type { Agent, Decision, DeckList } from '../src/engine/types';

const fileDeck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const meta: [DeckList, DeckList] = [fileDeck('meta-rrb-wakako-midrange.txt'), fileDeck('meta-bbg-cunningham-econ.txt')];

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
const setup = (seed: number): MatchSetup => ({ decks, seed, first: 0, level: 'medium', botSeed: 4242 });

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

type Outcome = { advice: Advice } | { error: string };
const outcome = (p: Promise<Advice>): Promise<Outcome> => p.then((advice) => ({ advice }), (e) => ({ error: String((e as Error).message) }));
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

/** A stand-in worker: answers advice `index: id` after `ms` (or an error for the ids in `fail`), and lists what it was sent. */
function stubWorker(o: { ms?: number; fail?: Set<number> } = {}) {
  const posted: CoachJob[] = [];
  const w = {
    onmessage: null as null | ((e: { data: CoachReply }) => void),
    onerror: null,
    onmessageerror: null,
    terminate() {},
    postMessage(m: CoachJob) {
      posted.push(structuredClone(m));
      const reply: CoachReply = o.fail?.has(m.id) ? { id: m.id, error: 'declined' } : 'req' in m ? { id: m.id, advice: { index: m.id, why: `answer ${m.id}`, alternatives: [] } } : { id: m.id, scored: [] };
      setTimeout(() => w.onmessage?.({ data: reply }), o.ms ?? 0);
    },
  };
  return { make: () => w as unknown as Worker, posted, adviceJobs: () => posted.filter((m) => 'req' in m).length };
}

/** A worker that runs the real coach in this process, messages crossing as structured clones (as postMessage does). */
function realWorker() {
  const counts = { advice: 0, score: 0 };
  const make = () => {
    const w = {
      onmessage: null as null | ((e: { data: CoachReply }) => void),
      onerror: null,
      onmessageerror: null,
      terminate() {},
      postMessage(m: CoachJob) {
        const job = structuredClone(m);
        void (async () => {
          let reply: CoachReply;
          try {
            if ('score' in job) {
              counts.score++;
              reply = { id: job.id, scored: await scoreMoveRequest(job.score) };
            } else {
              counts.advice++;
              reply = { id: job.id, advice: await adviseRequest(job.req) };
            }
          } catch (err) {
            reply = { id: job.id, error: String((err as Error)?.message ?? err) };
          }
          w.onmessage?.({ data: structuredClone(reply) });
        })();
      },
    };
    return w as unknown as Worker;
  };
  return { make, counts };
}

const yesno = (prompt = '?'): Decision => ({ player: 0, kind: 'yesno', prompt, options: [{ label: 'Yes' }, { label: 'No' }], min: 1, max: 1 }) as Decision;
const newGame = (seed = 1) => Game.create(meta, [makeTierBot('easy', seed), makeTierBot('easy', seed + 1)], { seed, first: 0 });

/** Frozen copies of real main-phase positions (mid-game), as the coach worker test makes them. */
async function positions(seed: number, n: number): Promise<{ g: Game; d: Decision }[]> {
  const out: { g: Game; d: Decision }[] = [];
  const brain = makeTierBot('easy', seed);
  const s: Agent = {
    name: 's',
    decide: async (g, d) => {
      if (out.length < n && d.kind === 'action' && coachWorthAsking(d) && g.s.turn >= 3) {
        const req = structuredClone(coachRequest(g, d));
        const frozen = new Game(structuredClone(req.state), [s, s]);
        frozen.pending = req.pending.map((x) => ({ ...x, run: async () => undefined }));
        out.push({ g: frozen, d: req.decision });
      }
      return brain.decide(g, d);
    },
  };
  await Game.create(meta, [s, makeTierBot('easy', seed + 1)], { seed, first: 0, maxTurns: 10 }).run();
  return out;
}

describe('coach answer cache: the client', () => {
  it('answers the same request once: one worker job, and each caller gets an equal copy', async () => {
    const w = stubWorker();
    const c = new CoachClient(w.make);
    const g = newGame();
    const first = await c.advise(g, yesno());
    const again = await c.advise(g, yesno()); // a new Decision object for the same position, as after Undo
    expect(w.adviceJobs()).toBe(1);
    expect(again).toEqual(first);
    expect(again).not.toBe(first);
    again.why = 'changed by a caller';
    expect(await c.advise(g, yesno())).toEqual(first);
    expect(w.adviceJobs()).toBe(1);
  });

  it('misses when the state, rng, decision, pending labels or lift differ', async () => {
    const w = stubWorker();
    const c = new CoachClient(w.make);
    const g = newGame();
    const d = yesno();
    let jobs = 1;
    const misses = async (f: () => Promise<unknown>) => {
      await f();
      expect(w.adviceJobs()).toBe(++jobs);
    };
    await c.advise(g, d);
    g.s.turn += 1;
    await misses(() => c.advise(g, d)); // state
    g.s.turn -= 1;
    const rng = g.s.rng;
    g.s.rng = rng + 1;
    await misses(() => c.advise(g, d)); // rng
    g.s.rng = rng;
    await misses(() => c.advise(g, yesno('other prompt'))); // decision
    await misses(() => c.advise(g, { ...d, options: [{ label: 'No' }, { label: 'Yes' }] })); // option order
    g.pending = [{ player: 0, label: 'Draw a card', run: async () => undefined }];
    await misses(() => c.advise(g, d)); // a pending effect
    g.pending = [{ player: 0, label: 'Discard a card', run: async () => undefined }];
    await misses(() => c.advise(g, d)); // another pending label
    g.pending = [];
    const lift = (low95: number) => ({ pkg: { lift: 0.1, low95, high95: 0.2 } }) as unknown as SeatLift;
    await misses(() => c.advise(g, d, lift(0.01))); // a lift
    await misses(() => c.advise(g, d, lift(-0.01))); // another lift
    // and every one of them is now known
    for (const f of [() => c.advise(g, d), () => c.advise(g, yesno('other prompt')), () => c.advise(g, d, lift(0.01))]) await f();
    expect(w.adviceJobs()).toBe(jobs);
  });

  it(`keeps at most ${COACH_ANSWERS_MAX} answers, dropping the least recently used`, async () => {
    const w = stubWorker();
    const c = new CoachClient(w.make);
    const g = newGame();
    for (let i = 0; i < COACH_ANSWERS_MAX; i++) await c.advise(g, yesno(`q${i}`));
    expect(coachAnswersKept()).toBe(COACH_ANSWERS_MAX);
    await c.advise(g, yesno('q0')); // used again: now the most recent
    expect(w.adviceJobs()).toBe(COACH_ANSWERS_MAX);
    await c.advise(g, yesno('new')); // pushes out q1, the least recently used
    expect(coachAnswersKept()).toBe(COACH_ANSWERS_MAX);
    await c.advise(g, yesno('q0'));
    expect(w.adviceJobs()).toBe(COACH_ANSWERS_MAX + 1);
    await c.advise(g, yesno('q1'));
    expect(w.adviceJobs()).toBe(COACH_ANSWERS_MAX + 2);
  });

  it('does not keep an error', async () => {
    const w = stubWorker({ fail: new Set([1]) });
    const c = new CoachClient(w.make);
    const g = newGame();
    expect(await outcome(c.advise(g, yesno()))).toEqual({ error: 'declined' });
    expect(coachAnswersKept()).toBe(0);
    expect((await c.advise(g, yesno())).index).toBe(2);
    expect(w.adviceJobs()).toBe(2);
  });

  it('a newer request still supersedes a queued one, a known answer too; a superseded request is never kept', async () => {
    const w = stubWorker({ ms: 5 });
    const c = new CoachClient(w.make);
    const g = newGame();
    const known = await c.advise(g, yesno('known')); // id 1
    const a = c.advise(g, yesno('a')); // id 2, sent
    const b = outcome(c.advise(g, yesno('b'))); // id 3, queued
    const k = await c.advise(g, yesno('known')); // answered at once, and supersedes b
    expect(k).toEqual(known);
    expect(await b).toEqual({ error: 'superseded' });
    expect((await a).index).toBe(2);
    await tick(10);
    expect(w.posted.map((m) => m.id)).toEqual([1, 2]);
    expect(coachAnswersKept()).toBe(2); // known and a; b was never computed
  });

  it('dispose() closes the client as before, even for a position it knows', async () => {
    const w = stubWorker({ ms: 5 });
    const c = new CoachClient(w.make);
    const g = newGame();
    await c.advise(g, yesno('known'));
    const busy = outcome(c.advise(g, yesno('a')));
    const queued = outcome(c.advise(g, yesno('b')));
    c.dispose();
    expect(await busy).toEqual({ error: 'coach closed' });
    expect(await queued).toEqual({ error: 'coach closed' });
    expect(await outcome(c.advise(g, yesno('known')))).toEqual({ error: 'coach closed' });
    await expect(c.score(yesno('known'), 0, { index: 0, why: '', alternatives: [] })).rejects.toThrow('coach closed');
  });

  it('a known answer equals a fresh computation, and score() after it uses the request and worlds of that answer', async () => {
    const [p] = await positions(7, 1);
    expect(p).toBeDefined();
    const w = realWorker();
    const c = new CoachClient(w.make);
    const fresh = await adviseRequest(coachRequest(p.g, p.d));
    const first = await c.advise(p.g, p.d);
    expect(first).toEqual(fresh);
    const d2 = structuredClone(p.d); // the same decision asked again (a new object, as after Undo)
    const hit = await c.advise(p.g, d2);
    expect(w.counts.advice).toBe(1);
    expect(hit).toEqual(fresh);
    // score a move the coach did not pick, at the re-asked decision, against the known answer
    const chosen = d2.options.findIndex((_, i) => i !== hit.index);
    const scored = await c.score(d2, chosen, hit);
    const direct = await scoreMoveRequest({ req: coachRequest(p.g, p.d), chosen, coach: fresh.index, grade: fresh.grade });
    expect(scored).toEqual(direct);
    expect(w.counts.score).toBe(1);
  }, 60_000);

  it('the main-thread fallback keeps answers too', async () => {
    const [p] = await positions(5, 1);
    let made = 0;
    const noWorker = () => {
      made++;
      throw new Error('no workers here');
    };
    const a = new CoachClient(noWorker);
    const first = await a.advise(p.g, p.d);
    expect(a.broken).toBe(true);
    expect(made).toBe(1);
    // another board in the same tab (a resumed game): answered from memory, no worker started, nothing computed
    const b = new CoachClient(noWorker);
    expect(await b.advise(p.g, structuredClone(p.d))).toEqual(first);
    expect(made).toBe(1);
    expect(b.broken).toBe(false);
    expect(first).toEqual(await adviseRequest(coachRequest(p.g, p.d)));
  }, 60_000);
});

/** Wait until the session's game (following undos) has ended. */
async function finish(session: PracticeSession): Promise<Running> {
  for (;;) {
    const r = session.current!;
    await r.done;
    if (session.current === r) return r;
  }
}

/** A deterministic player: the answer depends only on the decision and how many answers came before. */
function choose(run: Running, d: Decision): number {
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 1;
  if (d.kind === 'pay') return 0;
  return (run.replay.choices.length * 7 + run.g.s.turn * 3) % d.options.length;
}

/**
 * Drive the session's games: `hook` sees each new decision of yours first (with the state then) and returns true to
 * stop answering it (it undid, or saved and stopped).
 */
function drive(session: PracticeSession, hook: (run: Running, d: Decision) => Promise<boolean | void> | boolean | void) {
  let last: Decision | null = null;
  return session.subscribe(() => {
    const run = session.current;
    const d = run?.human.pending?.d;
    if (!run || !d || d === last) return;
    last = d;
    setTimeout(async () => {
      if (run !== session.current || run.human.pending?.d !== d) return;
      if (await hook(run, d)) return;
      if (run !== session.current || run.human.pending?.d !== d) return;
      run.human.answer(d, choose(run, d));
    }, 0);
  });
}

describe('coach answer cache: Undo and a restored save ask the same request again', () => {
  it('Undo re-asks a byte-identical request at every decision it goes back over', async () => {
    let reasked = 0;
    for (const seed of [11, 12]) {
      const session = new PracticeSession();
      const asked = new Map<number, string>();
      let actions = 0;
      let undos = 0;
      drive(session, (run, d) => {
        const k = run.replay.choices.length;
        if (coachWorthAsking(d)) {
          const text = exactText(coachRequest(run.g, d));
          expect(text).not.toBeNull();
          const before = asked.get(k);
          if (before !== undefined) {
            expect(text).toBe(before);
            reasked++;
          }
          asked.set(k, text!);
        }
        if (d.kind === 'action' && ++actions % 5 === 0 && undos < 4) {
          undos++;
          return session.undo();
        }
        return false;
      });
      session.start(setup(seed));
      const run = await finish(session);
      expect(run.replay.undos).toBe(4);
    }
    expect(reasked).toBeGreaterThanOrEqual(10);
  }, 120_000);

  it('a save restored in the same tab re-asks the byte-identical request it stopped at', async () => {
    const a = new PracticeSession();
    let text: string | null = null;
    let save: SavedGame | null = null;
    await new Promise<void>((resolve) => {
      drive(a, (run, d) => {
        if (run.replay.choices.length < 15 || !coachWorthAsking(d)) return;
        text = exactText(coachRequest(run.g, d));
        save = buildSave({ replay: run.replay, grades: run.grades, stable: run.stable, log: run.g.s.log }, { id: 'auto', saved: '2026-11-14T10:00:00Z', coach: true });
        resolve();
        return true;
      });
      a.start(setup(21));
    });
    a.quit();
    const b = new PracticeSession();
    expect((await b.restore(save!)).ok).toBe(true);
    const run = b.current!;
    expect(text).not.toBeNull();
    expect(exactText(coachRequest(run.g, run.human.pending!.d))).toBe(text);
    b.quit();
  }, 60_000);
});

describe('coach answer cache: no difference in grades or records', () => {
  /**
   * A scripted practice game with the coach on, graded as the Play page grades (src/ui/pages/Play.tsx `commit`): advice
   * at each decision worth asking, the grade, and a move the coach did not value scored in its worlds. Undoes at every
   * fourth main-phase decision, five times. `cache: false` forgets every answer before each ask.
   */
  async function coachedGame(cache: boolean) {
    const w = realWorker();
    const client = new CoachClient(w.make);
    const session = new PracticeSession();
    let asks = 0;
    let actions = 0;
    let undos = 0;
    drive(session, async (run, d) => {
      if (d.kind === 'action' && ++actions % 4 === 0 && undos < 5) {
        undos++;
        return session.undo();
      }
      if (!coachWorthAsking(d)) return false;
      if (!cache) clearCoachAnswers();
      asks++;
      const advice = await client.advise(run.g, d);
      const i = choose(run, d);
      const at = run.replay.choices.length;
      const gr = coachedGrade(d, i, advice, gradeMove(d, i, advice, run.g.s.turn), at);
      run.grades.push(gr);
      if (gr.verdict === 'pending') {
        const extra: GradedOption[] = await client.score(d, i, advice).catch(() => []);
        run.grades[run.grades.indexOf(gr)] = coachedGrade(d, i, advice, gradeMove(d, i, advice, gr.turn, extra), at, extra);
      }
      return false;
    });
    session.start({ ...setup(31), level: 'easy' });
    const run = await finish(session);
    client.dispose();
    return { grades: JSON.parse(JSON.stringify(run.grades)) as CoachedGrade[], choices: run.replay.choices, state: JSON.stringify(run.g.s), asks, computed: w.counts.advice, undos: run.replay.undos };
  }

  it('a game with Undos gives identical coach grades, records and game with the cache on and off', async () => {
    const on = await coachedGame(true);
    const off = await coachedGame(false);
    expect(on.undos).toBe(5);
    expect(on.grades.length).toBeGreaterThan(10);
    expect(on.grades.some((g) => g.record?.scores.length)).toBe(true);
    expect(on.grades).toEqual(off.grades);
    expect(on.choices).toEqual(off.choices);
    expect(on.state).toBe(off.state);
    expect(on.asks).toBe(off.asks);
    // without the cache every ask is computed; with it, the decisions Undo went back over were not
    expect(off.computed).toBe(off.asks);
    expect(on.computed).toBeLessThan(on.asks);
  }, 180_000);
});

describe('exact text (the cache key)', () => {
  it('tells apart what JSON.stringify confuses, and keeps key order', () => {
    const shared = { x: 1 };
    const pairs: [unknown, unknown][] = [
      [{ a: undefined }, {}],
      [{ a: -0 }, { a: 0 }],
      [{ a: NaN }, { a: null }],
      [{ a: Infinity }, { a: null }],
      [[undefined], [null]],
      [{ a: 1, b: 2 }, { b: 2, a: 1 }],
      [{ p: shared, q: shared }, { p: { x: 1 }, q: { x: 1 } }],
      [{ a: '1' }, { a: 1 }],
      [{ a: true }, { a: 'T' }],
    ];
    for (const [x, y] of pairs) {
      expect(exactText(x)).not.toBeNull();
      expect(exactText(x)).not.toBe(exactText(y));
    }
    expect(exactText({ a: [1, 'b', { c: null }] })).toBe(exactText(structuredClone({ a: [1, 'b', { c: null }] })));
  });

  it('gives no key for anything but plain data', () => {
    for (const v of [new Map(), new Set(), new Date(0), () => 1, Symbol('s'), 1n, [1, , 3], { m: new Map() }, new (class X {})()]) expect(exactText(v)).toBeNull();
    const cyclic: Record<string, unknown> = { a: 1 };
    cyclic.self = cyclic;
    expect(exactText(cyclic)).toBe('{"a":1,"self":@0}');
  });
});
