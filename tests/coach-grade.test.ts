// INFO-1: the coach grades your move by value, in the same worlds as its own candidates, not by its shortlist
// (src/ai/coach.ts gradeMove / scoreMoveRequest; docs/IMPROVEMENT_BACKLOG.md WP-D2).
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { GIG_SWING } from '../src/ai/eval';
import { advise, coachRequest, gradeMove, isClose, MISTAKE_GIGS, scoreMoveRequest, COACH_WORLDS, type Advice } from '../src/ai/coach';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import { gig, setup, spawn } from './engine-helpers';

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / xs.length;
/** An advice whose coach pick (option 0) and other options have the given values per world (evaluation points). */
function advice(kind: 'main' | 'sell', worlds: number[][]): Advice {
  return {
    index: 0,
    why: '',
    alternatives: [],
    grade: { kind, opts: worlds.map((w, i) => ({ i, v: mean(w), w })), worlds: worlds[0].map((_, k) => ({ rng: k, a: k, b: k })) },
  };
}
const sellDecision = (n: number): Decision => ({ player: 0, kind: 'action', prompt: '?', options: Array.from({ length: n }, (_, i) => ({ label: `Sell card ${i}` })), min: 1, max: 1 });

describe('gradeMove: by value with uncertainty', () => {
  const coachSell = [100, 140, 60, 120, 90, 110];
  it('a different sell within the noise is a close call, not a miss', () => {
    // 0.2 Gigs behind on average, but the worlds disagree (paired SE about 0.14 Gigs)
    const other = coachSell.map((x, k) => x - 8 + [12, -12, 10, -10, 6, -6][k]);
    const gr = gradeMove(sellDecision(2), 1, advice('sell', [coachSell, other]), 3);
    expect(gr.gap).toBeCloseTo(8 / GIG_SWING, 9);
    expect(gr.gap!).toBeGreaterThan(0.15); // over the old threshold: the old rule called it a miss
    expect(gr.se).toBeGreaterThan(gr.gap! / 2);
    expect(gr.verdict).toBe('close');
  });

  it('a small gap outside the noise is an inaccuracy; a clearly worse move a mistake; a better one best', () => {
    const d = sellDecision(4);
    const a = advice('sell', [coachSell, coachSell.map((x) => x - 10), coachSell.map((x, k) => x - 60 + (k % 2)), coachSell.map((x) => x + 4)]);
    expect(gradeMove(d, 1, a, 3)).toMatchObject({ verdict: 'inaccuracy', gap: 0.25, se: 0 });
    const worse = gradeMove(d, 2, a, 3);
    expect(worse.verdict).toBe('mistake');
    expect(worse.gap!).toBeGreaterThanOrEqual(MISTAKE_GIGS);
    expect(gradeMove(d, 3, a, 3).verdict).toBe('best');
    expect(gradeMove(d, 0, a, 3)).toMatchObject({ verdict: 'agree', gap: 0 });
  });

  it('a move the advice did not value is pending, then graded from its score; a choice the coach cannot value is unscored', () => {
    const d = sellDecision(3);
    const a = advice('sell', [coachSell, coachSell.map((x) => x - 2)]);
    expect(gradeMove(d, 2, a, 3)).toMatchObject({ verdict: 'pending', gap: null });
    const scored = gradeMove(d, 2, a, 3, [{ i: 2, v: mean(coachSell) - 80, w: coachSell.map((x) => x - 80) }]);
    expect(scored).toMatchObject({ verdict: 'mistake', gap: 2 });
    expect(gradeMove(d, 2, a, 3, [])).toMatchObject({ verdict: 'unscored', gap: null });
    const target: Decision = { player: 0, kind: 'unit', prompt: '?', options: [{ label: 'A' }, { label: 'B' }], min: 1, max: 1 };
    expect(gradeMove(target, 1, { index: 0, why: '', alternatives: [] }, 3).verdict).toBe('unscored');
  });

  it('isClose: under 0.15 Gigs, or within 2 paired standard errors', () => {
    expect(isClose(0.14)).toBe(true);
    expect(isClose(0.3)).toBe(false);
    expect(isClose(0.3, 0.15)).toBe(true);
    expect(isClose(0.31, 0.15)).toBe(false);
  });
});

const deck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;

/** Plays seat 0 with an easy bot and keeps the coach's advice at its main-phase decisions. */
class Sampler implements Agent {
  name = 'Sampler';
  spots: { g: Game; d: Decision; a: Advice; req: ReturnType<typeof coachRequest> }[] = [];
  constructor(private brain: Agent) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'action' && d.options.length > 2 && this.spots.length < 14) {
      const req = coachRequest(g, d);
      this.spots.push({ g, d, a: await advise(g, d), req });
    }
    return this.brain.decide(g, d);
  }
}

describe('the coach scores the move you made in its own worlds', () => {
  it('a sell other than the coach’s, and a move outside its rolled-out candidates, both get a numeric gap and spread', async () => {
    const s = new Sampler(makeTierBot('easy', 21));
    const g = Game.create([deck('meta-rrb-wakako-midrange.txt'), deck('meta-bbg-cunningham-econ.txt')], [s, makeTierBot('easy', 22)], { seed: 21, first: 0, maxTurns: 10 });
    await g.run();
    // the coach compared sells: any other sell it compared has a gap and a paired SE straight away
    const sellSpot = s.spots.find((x) => x.a.grade?.kind === 'sell' && x.a.grade.opts.length > 1);
    expect(sellSpot).toBeDefined();
    const other = sellSpot!.a.grade!.opts.find((o) => o.i !== sellSpot!.a.index)!;
    const gs = gradeMove(sellSpot!.d, other.i, sellSpot!.a, 1);
    expect(gs.gap).not.toBeNull();
    expect(gs.se).toBeGreaterThanOrEqual(0);
    expect(['best', 'close', 'inaccuracy', 'mistake']).toContain(gs.verdict);
    expect(sellSpot!.a.grade!.worlds).toHaveLength(COACH_WORLDS);

    // a move the coach never valued (it sold, so ending the turn or a play was not rolled out): scored on demand
    const spot = s.spots.find((x) => x.d.options.some((_, i) => !x.a.grade?.opts.some((o) => o.i === i)))!;
    expect(spot).toBeDefined();
    const outside = spot.d.options.findIndex((_, i) => !spot.a.grade?.opts.some((o) => o.i === i));
    expect(gradeMove(spot.d, outside, spot.a, 1).verdict).toBe('pending');
    const extra = await scoreMoveRequest({ req: spot.req, chosen: outside, coach: spot.a.index, grade: spot.a.grade });
    expect(extra.some((o) => o.i === outside && o.w?.length === COACH_WORLDS)).toBe(true);
    const gr = gradeMove(spot.d, outside, spot.a, 1, extra);
    expect(typeof gr.gap).toBe('number');
    expect(gr.se).toBeGreaterThanOrEqual(0);
    expect(['best', 'close', 'inaccuracy', 'mistake']).toContain(gr.verdict);
    // the score is reproducible: the same request gives the same values
    expect(await scoreMoveRequest({ req: spot.req, chosen: outside, coach: spot.a.index, grade: spot.a.grade })).toEqual(extra);
  }, 120_000);

  it('passing up a free steal is still a mistake', async () => {
    const { g } = setup();
    for (const sides of [4, 6, 8]) gig(g, 1, sides, 3);
    gig(g, 0, 10, 4);
    spawn(g, 0, 'psycho_squad', 'field');
    let d: Decision | null = null;
    g.agents[0] = { name: 'capture', decide: async (_g, x) => ((d = x), [0]) };
    await g.chooseAction(0, g.legalActions(0));
    const dec = d as unknown as Decision;
    const a = await advise(g, dec);
    const steal = dec.options.findIndex((o) => o.action?.type === 'attack' && o.action.targetGigs !== null);
    const pass = dec.options.findIndex((o) => o.action?.type === 'pass');
    expect(a.index).toBe(steal);
    const gr = gradeMove(dec, pass, a, 3);
    expect(gr.verdict).toBe('mistake');
    expect(gr.gap!).toBeGreaterThanOrEqual(MISTAKE_GIGS);
    expect(gr.gap! - 2 * (gr.se ?? 0)).toBeGreaterThan(0);
  }, 60_000);
});
