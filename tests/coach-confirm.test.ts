// REVIEW_2026-11-25 C1–C5: the live coach grades on the Game review oracle's scale, confirms a costly or wide-close grade
// on fresh worlds before it settles, and calls a decision where nothing differs "No clear difference" (src/ai/coach.ts
// gradeMove, needsConfirm, confirmMoveRequest, gradeConfirmed, gradeFully).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { DEFAULT_WEIGHTS, GIG_SWING } from '../src/ai/eval';
import { HeuristicAgent } from '../src/ai/heuristic';
import { oracleValue } from '../src/ai/reviewer';
import { makeWorlds } from '../src/ai/playOut';
import type { RolloutPool } from '../src/ai/playoutPool';
import { runPlayoutBatch } from '../src/sim/playoutBatch';
import {
  adviseRequest,
  advise,
  COACH_CONFIG,
  COACH_CONFIRM_WORLDS,
  coachRequest,
  confirmMoveRequest,
  DECIDED_GRADE,
  gradeConfirmed,
  gradeFully,
  gradeMove,
  makeCoach,
  MISTAKE_GIGS,
  needsConfirm,
  type Advice,
  type CoachRequest,
  type GradedOption,
} from '../src/ai/coach';
import type { Action, Agent, Decision, DeckList } from '../src/engine/types';
import { gig, setup, spawn } from './engine-helpers';
import { coachedGrade } from '../src/lib/coachedReplay';
import { coachRatingOf, rateCoach } from '../src/lib/gameReview';

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
const deck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const action = (n: number): Decision => ({ player: 0, kind: 'action', prompt: '?', options: Array.from({ length: n }, (_, i) => ({ label: `Option ${i}` })), min: 1, max: 1 });
/** Advice whose pick is option 0, every option valued in each world as given (evaluation points). */
const advice = (worlds: number[][]): Advice => ({
  index: 0,
  why: '',
  alternatives: [],
  grade: { kind: 'main', opts: worlds.map((w, i) => ({ i, v: mean(w), w })), worlds: worlds[0]!.map((_, k) => ({ rng: k, a: k, b: k })) },
});
const base = [100, 140, 60, 120, 90, 110];

describe('No clear difference and the confirmation, on made-up scores', () => {
  it('a decision where every scored option is within the noise of the pick is unclear, whichever move was made', () => {
    const noisy = (dx: number) => base.map((x, k) => x - dx + [12, -12, 10, -10, 6, -6][k]!);
    const a = advice([base, noisy(4), noisy(6)]);
    expect(gradeMove(action(3), 0, a, 1)).toMatchObject({ verdict: 'unclear', gap: 0, band: 'agree' });
    expect(gradeMove(action(3), 2, a, 1).verdict).toBe('unclear');
    // the record keeps the verdict by the gap alone, marked unclear: a Game review reads it as before (rateCoach)
    const rec = coachedGrade(action(3), 2, a, gradeMove(action(3), 2, a, 1), 0).record!;
    expect(rec).toMatchObject({ verdict: 'close', unclear: true });
    expect(rateCoach(coachRatingOf(rec)!)).toBe('unclear');
    // one option clearly worse: the decision mattered, and the same moves are graded as before
    const b = advice([base, noisy(4), base.map((x) => x - 60)]);
    expect(gradeMove(action(3), 0, b, 1).verdict).toBe('agree');
    expect(gradeMove(action(3), 1, b, 1).verdict).toBe('best');
  });

  it('a game already decided in every play-out is unclear, and says so', () => {
    const won = advice([base.map(() => 590), base.map(() => 560)]);
    expect(gradeMove(action(2), 1, won, 1)).toMatchObject({ verdict: 'unclear', decided: true });
    const lost = advice([base.map(() => -DECIDED_GRADE - 10), base.map(() => -590)]);
    expect(gradeMove(action(2), 1, lost, 1)).toMatchObject({ verdict: 'unclear', decided: true });
  });

  it('Slip or worse and a wide close call are confirmed; the confirmed verdict comes from the fresh worlds alone', () => {
    const d = action(3);
    const a = advice([base, base.map((x, k) => x - 30 + (k % 2 ? 8 : -8)), base.map((x) => x - 80)]);
    const screen = gradeMove(d, 1, a, 2);
    expect(screen.verdict).toBe('mistake');
    expect(needsConfirm(screen)).toBe(true);
    // the fresh worlds find the move as good as the pick: Best, with the screen kept beside it
    const same: GradedOption[] = [
      { i: 0, v: 50, w: [50, 60, 40, 55] },
      { i: 1, v: 50, w: [51, 59, 41, 54] },
    ];
    expect(gradeConfirmed(1, a, screen, same)).toMatchObject({ verdict: 'best', confirmed: 4, screen: { verdict: 'mistake', gap: screen.gap } });
    // the fresh worlds agree: a Mistake, with their gap (not the screen's, which picked the best of noisy means)
    const worse: GradedOption[] = [
      { i: 0, v: 50, w: [50, 60, 40, 50] },
      { i: 1, v: 20, w: [20, 30, 10, 20] },
    ];
    expect(gradeConfirmed(1, a, screen, worse)).toMatchObject({ verdict: 'mistake', gap: 30 / GIG_SWING, confirmed: 4 });
    // no values back: not measured, never the screen
    expect(gradeConfirmed(1, a, screen, [])).toMatchObject({ verdict: 'unscored', gap: null, notMeasured: 'check' });
    // a confirmed move inside the noise in a decision where nothing else differed: unclear
    const two = advice([base, base.map((x, k) => x - 30 + (k % 2 ? 8 : -8))]);
    expect(gradeConfirmed(1, two, gradeMove(action(2), 1, two, 2), same).verdict).toBe('unclear');
    // a wide close call (a Mistake's width, inside the noise only because the worlds disagree) is confirmed too
    const wide = advice([base, base.map((x, k) => x - 20 + (k % 2 ? 40 : -40)), base.map((x) => x - 80)]);
    const w = gradeMove(d, 1, wide, 2);
    expect(w.verdict).toBe('close');
    expect(w.gap!).toBeGreaterThanOrEqual(MISTAKE_GIGS);
    expect(needsConfirm(w)).toBe(true);
    // a narrow close call, Best, and agree are not
    expect(needsConfirm(gradeMove(d, 0, a, 2))).toBe(false);
    expect(needsConfirm({ ...w, gap: 0.3 })).toBe(false);
    expect(needsConfirm({ ...screen, confirmed: 16 })).toBe(false);
  });

  it('the mulligan and a Gig value say why they are not measured', () => {
    const mull: Decision = { player: 0, kind: 'yesno', tag: 'mulligan', prompt: '?', options: [{ label: 'Yes', key: 'yes' }, { label: 'No', key: 'no' }], min: 1, max: 1 } as Decision;
    expect(gradeMove(mull, 1, { index: 1, why: '', alternatives: [] }, 0)).toMatchObject({ verdict: 'unscored', notMeasured: 'mulligan' });
    const gv: Decision = { player: 0, kind: 'gigValue', prompt: '?', options: [{ label: 'Set 3' }, { label: 'Leave it' }], min: 1, max: 1 } as Decision;
    expect(gradeMove(gv, 0, { index: 1, why: '', alternatives: [] }, 0)).toMatchObject({ verdict: 'unscored', notMeasured: 'gig' });
  });
});

/** Seat 0 by an easy bot; keeps the coach's request at its first few main-phase decisions with several options. */
class Sampler implements Agent {
  name = 'Sampler';
  spots: { g: Game; d: Decision; req: CoachRequest }[] = [];
  constructor(private brain: Agent) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'action' && d.options.length > 3 && this.spots.length < 3) this.spots.push({ g, d, req: coachRequest(g, d) });
    return this.brain.decide(g, d);
  }
}

async function positions() {
  const s = new Sampler(makeTierBot('easy', 21));
  const g = Game.create([deck('meta-rrb-wakako-midrange.txt'), deck('meta-bbg-cunningham-econ.txt')], [s, makeTierBot('easy', 22)], { seed: 21, first: 0, maxTurns: 6 });
  await g.run();
  return s.spots;
}

/** A pool that runs each batch in this process as the playout workers do, split over two "workers" like the real one. */
const inProcessPool: RolloutPool = {
  async runBatch(state, pending, player, tasks, config) {
    const half = Math.ceil(tasks.length / 2);
    const parts = [tasks.slice(0, half), tasks.slice(half)].filter((x) => x.length);
    return (await Promise.all(parts.map((t) => runPlayoutBatch(structuredClone({ state, pending, player, tasks: t, config }))))).flat();
  },
  dispose() {},
};

describe('the coach on real positions', () => {
  it('its grade scale is the review oracle’s exactly: the same play-outs, DEFAULT_WEIGHTS, clamped, no offset', async () => {
    const [spot] = await positions();
    const { req } = spot!;
    const g = new Game(structuredClone(req.state), [{ name: 'x', decide: async () => [0] }, { name: 'y', decide: async () => [0] }]);
    const d = req.decision;
    const actions = d.options.map((o) => o.action as Action);
    const i = actions.findIndex((a) => a.type === 'pass');
    let seed = 99;
    const worlds = makeWorlds(4, () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296));
    const [o] = await makeCoach().valueMain(g, d.player, actions, [i], worlds);
    expect(o!.g).toHaveLength(4);
    expect(mean(o!.g!)).toBeCloseTo(await oracleValue(g, d.player, actions[i]!, worlds), 9);
    // the choice scale is the coach's own (profiled, with its 1-ply offset), so it generally differs
    expect(o!.w).toHaveLength(4);
  }, 60_000);

  it('the grade scale is observe-only: without it the coach decides and values exactly the same', async () => {
    const [spot] = await positions();
    const { req } = spot!;
    const { gradeWeights: _g, ...rest } = COACH_CONFIG;
    const plain = new HeuristicAgent({ name: 'Coach', ...rest });
    const graded = new HeuristicAgent({ name: 'Coach', ...COACH_CONFIG });
    const mk = () => new Game(structuredClone(req.state), [{ name: 'x', decide: async () => [0] }, { name: 'y', decide: async () => [0] }]);
    const [a] = await plain.decide(mk(), structuredClone(req.decision));
    const [b] = await graded.decide(mk(), structuredClone(req.decision));
    expect(b).toBe(a);
    const strip = (s: typeof plain.lastScores) => s!.opts.map(({ g: _x, ...o }) => o);
    expect(strip(graded.lastScores)).toEqual(strip(plain.lastScores));
    expect(graded.lastScores!.opts.every((o) => !o.w || o.g?.length === o.w.length)).toBe(true);
    expect(graded.lastScores!.opts.every((o) => (o.g ?? []).every((x) => Math.abs(x) <= DEFAULT_WEIGHTS.playOutClamp))).toBe(true);
  }, 60_000);

  it('the browser’s parallel play-outs give the same advice and the same confirmation as one thread', async () => {
    const spots = await positions();
    for (const { req } of spots.slice(0, 2)) {
      const one = await adviseRequest(req);
      const pooled = await adviseRequest(req, inProcessPool);
      expect(pooled).toEqual(one);
      const other = req.decision.options.findIndex((_, k) => k !== one.index);
      const c = { req, chosen: other, coach: one.index };
      expect(await confirmMoveRequest(c, inProcessPool)).toEqual(await confirmMoveRequest(c));
    }
  }, 120_000);

  it('a confirmation is the same for the same position and move (the coach cache and Undo rely on it)', async () => {
    const [spot] = await positions();
    const { req } = spot!;
    const a = await adviseRequest(req);
    const other = req.decision.options.findIndex((_, k) => k !== a.index);
    const first = await confirmMoveRequest({ req, chosen: other, coach: a.index });
    expect(first).toHaveLength(2);
    expect(first.every((o) => o.w?.length === COACH_CONFIRM_WORLDS)).toBe(true);
    expect(await confirmMoveRequest({ req: structuredClone(req), chosen: other, coach: a.index })).toEqual(first);
  }, 60_000);

  it('passing up a free steal is a confirmed Mistake', async () => {
    const { g } = setup();
    for (const sides of [4, 6, 8]) gig(g, 1, sides, 3);
    gig(g, 0, 10, 4);
    spawn(g, 0, 'psycho_squad', 'field');
    let d: Decision | null = null;
    g.agents[0] = { name: 'capture', decide: async (_g, x) => ((d = x), [0]) };
    await g.chooseAction(0, g.legalActions(0));
    const dec = d as unknown as Decision;
    const a = await advise(g, dec);
    const pass = dec.options.findIndex((o) => o.action?.type === 'pass');
    const { grade, fresh } = await gradeFully(coachRequest(g, dec), pass, a, 3);
    expect(grade).toMatchObject({ verdict: 'mistake', confirmed: COACH_CONFIRM_WORLDS });
    expect(grade.screen?.verdict).toBe('mistake');
    expect(fresh).toHaveLength(2);
    expect(grade.gap! - 2 * (grade.se ?? 0)).toBeGreaterThan(MISTAKE_GIGS);
  }, 60_000);
});
