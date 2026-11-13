// The Game review's ratings (src/lib/gameReview.ts): bands in Gigs with the measurement's standard error, the coach's
// grades from play kept as they were, accuracy, the turning point, the rival's relevant moves, the stored record, and a
// seeded real game reviewed end to end (src/sim/gameReviewRun.ts, the function both the browser worker and the CLI run).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { GIG_SWING } from '../src/ai/eval';
import { CAP, NOISE } from '../src/ai/reviewer';
import { CLOSE_GIGS as COACH_CLOSE, MISTAKE_GIGS as COACH_MISTAKE } from '../src/ai/coach';
import type { DecisionReview, GameReview } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import type { CoachedDecision } from '../src/lib/coachedReplay';
import {
  accuracyOf,
  BEST_GIGS,
  buildReviewRecord,
  CAP_GIGS,
  CLOSE_GIGS,
  coachRatingOf,
  coachRatingsFrom,
  costlyText,
  explain,
  GIG,
  isKeyMoment,
  listed,
  MISTAKE_GIGS,
  rateCoach,
  rateMeasured,
  rateOracle,
  ratingStep,
  reviewCounts,
  rivalFollowUps,
  seatSummary,
  turningPoint,
  type CoachRating,
  type ReviewMove,
} from '../src/lib/gameReview';
import { asReviewRecord, GAME_REVIEWS_KEY, loadGameReview, parseGameReviews, reviewMatches, saveCoachRatings, saveGameReview } from '../src/lib/gameReviewStore';
import { parsePractice } from '../src/lib/practiceLog';
import { runGameReview } from '../src/sim/gameReviewRun';
import { reviewFrames } from '../src/lib/reviewFrames';
import type { PracticeReviewSpec } from '../src/sim/practiceReview';

describe('the thresholds are the coach’s and the reviewer’s', () => {
  it('in Gigs on the same scale', () => {
    expect(GIG).toBe(GIG_SWING);
    expect(BEST_GIGS).toBe(NOISE / GIG_SWING);
    expect(CLOSE_GIGS).toBe(COACH_CLOSE);
    expect(MISTAKE_GIGS).toBe(COACH_MISTAKE);
    expect(CAP_GIGS).toBe(CAP / GIG_SWING);
  });
});

describe('rateMeasured: bands with the standard error', () => {
  it('Best, Close call, Slip, Mistake, Blunder by the size of a clear gap', () => {
    expect(rateMeasured({ gap: 0, top: true })).toBe('best');
    expect(rateMeasured({ gap: 0.08, se: 0.01 })).toBe('best');
    expect(rateMeasured({ gap: 0.12, se: 0.01 })).toBe('close');
    expect(rateMeasured({ gap: 0.3, se: 0.05 })).toBe('slip');
    expect(rateMeasured({ gap: 0.5, se: 0.1 })).toBe('mistake');
    expect(rateMeasured({ gap: 1.2, se: 0.2 })).toBe('blunder');
  });
  it('a gap inside 2 standard errors is a close call however large', () => {
    expect(rateMeasured({ gap: 0.9, se: 0.5 })).toBe('close');
    expect(rateMeasured({ gap: 1.5, se: 0.8 })).toBe('close');
    expect(rateMeasured({ gap: 1.5, se: 0.7 })).toBe('blunder');
  });
  it('a clear mistake that loses the game in the play-outs is a Blunder', () => {
    expect(rateMeasured({ gap: 0.5, se: 0.1, gameLosing: true })).toBe('blunder');
    expect(rateMeasured({ gap: 0.3, se: 0.05, gameLosing: true })).toBe('slip');
  });
  it('No clear difference: a decided game, or every option within the noise of the best', () => {
    expect(rateMeasured({ gap: 2, se: 0.1, decided: true })).toBe('unclear');
    expect(rateMeasured({ gap: 0, top: true, others: [[0.1, 0.02], [0.4, 0.3]] })).toBe('unclear');
    expect(rateMeasured({ gap: 0, top: true, others: [[0.1, 0.02], [0.4, 0.1]] })).toBe('best');
  });
  it('Sharp: the only good move, which the quick read did not pick first; Inspired: ranked third or lower, its pick a blunder', () => {
    const only = { gap: 0, top: true, others: [[0.6, 0.1] as const, [1.5, 0.2] as const] };
    expect(rateMeasured({ ...only, screen: { gap: 0, se: 0, chosenRank: 0 } })).toBe('best');
    expect(rateMeasured(only)).toBe('best'); // no screen (a reaction): never more than Best
    expect(rateMeasured({ ...only, screen: { gap: 0.6, se: 0.1, chosenRank: 1 } })).toBe('sharp');
    expect(rateMeasured({ ...only, screen: { gap: 0.6, se: 0.1, chosenRank: 2 } })).toBe('sharp'); // its pick only a mistake
    expect(rateMeasured({ ...only, screen: { gap: 1.5, se: 0.2, chosenRank: 2 } })).toBe('inspired');
    expect(rateMeasured({ ...only, screen: { gap: 1.5, se: 0.2, chosenRank: -1 } })).toBe('inspired');
    // the runner-up within the noise: not the only good move
    expect(rateMeasured({ gap: 0, top: true, others: [[0.6, 0.4], [2, 0.1]], screen: { gap: 1.5, se: 0.2, chosenRank: -1 } })).toBe('best');
    // within 0.1 Gigs but not the top: Best, never more
    expect(rateMeasured({ gap: 0.05, se: 0.01, top: false, others: [[0.6, 0.1]], screen: { gap: 1.5, se: 0.2, chosenRank: -1 } })).toBe('best');
  });
  it('steps: one place each, No clear difference between Best and Close call', () => {
    expect(ratingStep('inspired')).toBe(0);
    expect(ratingStep('blunder')).toBe(6);
    expect(ratingStep('unclear')).toBe(2.5);
    expect(ratingStep('forced')).toBeNull();
  });
});

const review = (o: Partial<DecisionReview>): DecisionReview => ({ i: 0, turn: 3, player: 0, category: 'unit', options: 4, chosen: 'A', best: 'B', regret: 0, gameLosing: false, ...o });

describe('rateOracle reads the reviewer’s points', () => {
  it('converts to Gigs', () => {
    expect(rateOracle(review({ regret: 24, se: 4, others: [[24, 4]] }))).toBe('mistake');
    expect(rateOracle(review({ regret: 24, se: 14, others: [[24, 14]] }))).toBe('unclear');
    expect(rateOracle(review({ regret: 24, se: 14, others: [[24, 14], [80, 10]] }))).toBe('close');
    expect(rateOracle(review({ regret: 0, top: true, decided: true }))).toBe('unclear');
  });
});

/** A coach record: option 0 is the coach's pick; `vals` per option per world (points). */
function record(chose: number, vals: number[][], verdict: CoachedDecision['verdict'], gap: number | null, se?: number): CoachedDecision {
  const mean = (w: number[]) => w.reduce((a, x) => a + x, 0) / w.length;
  return {
    at: 5,
    turn: 4,
    kind: 'action',
    prompt: '?',
    options: vals.map((_, i) => `Option ${i}`),
    chose,
    coach: 0,
    why: 'Because. '.repeat(40),
    alternatives: [],
    verdict,
    gap,
    ...(se !== undefined ? { se } : {}),
    scoreKind: 'main',
    scores: vals.map((w, i) => ({ i, v: mean(w), w })),
  };
}

describe('the coach’s grades from play are kept', () => {
  const pick = [100, 120, 80, 110, 90, 100];
  it('coachRatingOf: gaps below the coach’s pick with paired SE; a move not measured gives nothing', () => {
    const c = coachRatingOf(record(0, [pick, pick.map((x) => x - 40), pick.map((x) => x - 2)], 'agree', 0), GIG)!;
    expect(c.alts.find(([i]) => i === 1)).toEqual([1, 1, 0]);
    expect(c.alts.find(([i]) => i === 2)?.[1]).toBe(0.05);
    expect(c.why.length).toBeLessThanOrEqual(220);
    expect(coachRatingOf(record(1, [pick, pick], 'pending', null))).toBeNull();
    expect(coachRatingOf(record(1, [pick, pick], 'unscored', null))).toBeNull();
    expect(coachRatingsFrom([record(0, [pick, pick.map((x) => x - 40)], 'agree', 0), undefined], 5)).toEqual([]); // at 5 is past 5 answers
    expect(coachRatingsFrom([record(0, [pick, pick.map((x) => x - 40)], 'agree', 0)], 6)).toHaveLength(1);
  });
  it('the verdict decides the band: close stays a close call, inaccuracy is a Slip, mistake splits at a whole Gig', () => {
    const base = (verdict: CoachRating['verdict'], gap: number, se?: number): CoachRating => ({ at: 1, turn: 2, chose: 1, coach: 0, chosen: 'B', best: 'A', why: '', verdict, gap, ...(se !== undefined ? { se } : {}), alts: [[1, gap, se ?? null], [2, 2, 0.1]] });
    expect(rateCoach(base('close', 0.05, 0.01))).toBe('close');
    expect(rateCoach(base('inaccuracy', 0.3, 0.05))).toBe('slip');
    expect(rateCoach(base('mistake', 0.6, 0.1))).toBe('mistake');
    expect(rateCoach(base('mistake', 1.4, 0.1))).toBe('blunder');
    expect(rateCoach(base('best', -0.1, 0.05))).toBe('best');
  });
  it('the coach’s own pick: Sharp or Inspired with the review’s quick read, no clear difference when every option is close', () => {
    const agree = (alts: CoachRating['alts']): CoachRating => ({ at: 1, turn: 2, chose: 0, coach: 0, chosen: 'A', best: 'A', why: '', verdict: 'agree', gap: 0, alts });
    expect(rateCoach(agree([[1, 0.05, 0.02], [2, 0.1, null]]))).toBe('unclear');
    expect(rateCoach(agree([[1, 0.6, 0.1], [2, 1.5, 0.1]]))).toBe('best');
    expect(rateCoach(agree([[1, 0.6, 0.1], [2, 1.5, 0.1]]), { screenTop: 0, chosenRank: 0 })).toBe('best');
    expect(rateCoach(agree([[1, 0.6, 0.1], [2, 1.5, 0.1]]), { screenTop: 1, chosenRank: 1 })).toBe('sharp');
    expect(rateCoach(agree([[1, 0.6, 0.1], [2, 1.5, 0.1]]), { screenTop: 2, chosenRank: 3 })).toBe('inspired');
    // the screen's pick was not scored by the coach: no claim
    expect(rateCoach(agree([[1, 0.6, 0.1], [2, 1.5, 0.1]]), { screenTop: 4, chosenRank: 3 })).toBe('best');
  });
});

const mv = (o: Partial<ReviewMove> & Pick<ReviewMove, 'seq' | 'p' | 'r'>): ReviewMove => ({ at: o.seq, turn: 1, cat: 'unit', chosen: `m${o.seq}`, best: 'b', gap: 0, src: 'oracle', ...o });

describe('summary: accuracy, turning point, the rival’s relevant moves', () => {
  it('accuracy = 100 × e^(−average Gigs lost), moves inside the noise losing 0', () => {
    expect(accuracyOf(0)).toBe(100);
    expect(accuracyOf(0.1)).toBe(90);
    expect(accuracyOf(1)).toBe(37);
    const moves = [mv({ seq: 0, p: 0, r: 'best' }), mv({ seq: 1, p: 0, r: 'close', gap: 0.12 }), mv({ seq: 2, p: 0, r: 'mistake', gap: 0.6 }), mv({ seq: 3, p: 0, r: 'unclear', gap: 2 }), mv({ seq: 4, p: 0, r: 'blunder', gap: 5 })];
    const s = seatSummary(moves, 0, 2);
    expect(s.counted).toBe(4);
    expect(s.avgLoss).toBeCloseTo((0.6 + 3) / 4, 9);
    expect(s.accuracy).toBe(accuracyOf((0.6 + 3) / 4));
    expect(s.n.forced).toBe(2);
    expect(s.n.unclear).toBe(1);
    expect(seatSummary([], 1).accuracy).toBeNull();
  });
  it('the turning point is the biggest loss outside the noise, earliest on ties; none in a clean game', () => {
    const moves = [mv({ seq: 0, p: 0, r: 'slip', gap: 0.3 }), mv({ seq: 1, p: 1, r: 'blunder', gap: 1.4 }), mv({ seq: 2, p: 0, r: 'blunder', gap: 1.4 }), mv({ seq: 3, p: 0, r: 'unclear', gap: 3 })];
    expect(turningPoint(moves)?.seq).toBe(1);
    expect(turningPoint([mv({ seq: 0, p: 0, r: 'close', gap: 0.5 })])).toBeNull();
  });
  it('a rival error is a missed chance when your next turn has a mistake, followed up when it is clean', () => {
    const moves = [
      mv({ seq: 0, p: 1, r: 'blunder', gap: 1.5, turn: 2 }),
      mv({ seq: 1, p: 0, r: 'best', turn: 3 }),
      mv({ seq: 2, p: 0, r: 'mistake', gap: 0.5, turn: 3 }),
      mv({ seq: 3, p: 0, r: 'best', turn: 5 }),
      mv({ seq: 4, p: 1, r: 'mistake', gap: 0.5, turn: 4 }), // seq order is what counts
      mv({ seq: 5, p: 0, r: 'close', gap: 0.1, turn: 5 }),
      mv({ seq: 6, p: 1, r: 'mistake', gap: 0.5, turn: 5 }), // a reaction on your turn: the rest of that turn answers
      mv({ seq: 7, p: 0, r: 'slip', gap: 0.2, turn: 5 }),
      mv({ seq: 8, p: 1, r: 'slip', gap: 0.2, turn: 6 }),
    ];
    const f = rivalFollowUps(moves, 0);
    expect(f.get(0)).toBe('missed');
    expect(f.get(4)).toBeUndefined(); // your answer (turn 5: best, close, slip) has a slip: neither
    expect(f.get(6)).toBeUndefined();
    const g = rivalFollowUps([mv({ seq: 0, p: 1, r: 'mistake', gap: 0.5, turn: 2 }), mv({ seq: 1, p: 0, r: 'sharp', turn: 3 }), mv({ seq: 2, p: 0, r: 'blunder', gap: 2, turn: 5 })], 0);
    expect(g.get(0)).toBe('followed');
    // shown: all your moves, and the rival's Mistakes, Blunders, Sharp and Inspired moves only
    expect(listed(mv({ seq: 0, p: 1, r: 'slip' }), 0)).toBe(false);
    expect(listed(mv({ seq: 0, p: 1, r: 'inspired' }), 0)).toBe(true);
    expect(listed(mv({ seq: 0, p: 0, r: 'unclear' }), 0)).toBe(true);
    expect(isKeyMoment(mv({ seq: 0, p: 0, r: 'best' }), 0, null)).toBe(false);
    expect(isKeyMoment(mv({ seq: 0, p: 0, r: 'slip' }), 0, mv({ seq: 0, p: 0, r: 'slip' }))).toBe(true);
    expect(costlyText([0, 0, 3, 1, 2, 1, 1])).toBe('1 blunder, 1 mistake, 2 slips');
  });
  it('explains a move in plain words, with the coach’s reason for a coach grade', () => {
    expect(explain(mv({ seq: 0, p: 0, r: 'mistake', gap: 0.62, se: 0.1, best: 'Attack' }))).toBe('The review preferred Attack: about 0.62 ± 0.10 Gigs better.');
    expect(explain(mv({ seq: 0, p: 0, r: 'best', chosen: 'X', best: 'X', src: 'coach', why: 'Strong.' }))).toBe('The coach rates this the best move. Coach: Strong.');
  });
});

describe('the stored record', () => {
  const g: GameReview = {
    version: 1,
    seed: 3,
    first: 0,
    winner: 1,
    reason: 'r',
    turns: 9,
    names: ['A', 'B'],
    rollouts: 8,
    seats: [],
    timeline: [{ turn: 1, v: 0 }, { turn: 2, v: 41.4 }],
    swings: [],
    decisions: [review({ seq: 1, at: 2, player: 0, regret: 30, se: 2, others: [[30, 2]], gameLosing: true }), review({ seq: 3, at: 1, player: 1, regret: 0, top: true, se: 0, others: [[80, 4]], screen: { gap: 80, se: 4, chosenRank: 1 } })],
    ms: 5,
    skipped: [{ player: 0, at: 4, seq: 2, turn: 3, screenTop: 1, chosenRank: 1 }],
    forced: [1, 0],
    answers: [{ choices: [[0], [1], [0], [2], [0]], pay: false, order: false }, { choices: [[0], [3]], pay: false, order: false }],
  };
  const coach: CoachRating[] = [{ at: 4, turn: 3, chose: 0, coach: 0, chosen: 'Pick', best: 'Pick', why: 'Good.', verdict: 'agree', gap: 0, alts: [[1, 0.8, 0.1]] }];
  it('merges the coach’s grades (skipped by the oracle) with the oracle’s, in game order', () => {
    const rec = buildReviewRecord(g, coach, { id: 'x', made: 'now' });
    expect(rec.moves.map((m) => [m.seq, m.src, m.r])).toEqual([
      [1, 'oracle', 'blunder'],
      [2, 'coach', 'sharp'],
      [3, 'oracle', 'sharp'],
    ]);
    expect(rec.moves[0]).toMatchObject({ gap: 0.75, se: 0.05, lost: true });
    expect(rec.timeline).toEqual([[1, 0], [2, 41]]);
    expect(reviewCounts(rec)).toEqual({ acc: accuracyOf(0.75 / 2), n: [0, 1, 0, 0, 0, 0, 1] });
    expect(asReviewRecord(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    expect(asReviewRecord({ ...rec, schema: 2 })).toBeNull();
    expect(asReviewRecord({ ...rec, moves: [{ ...rec.moves[0], r: 'great' }] })).toBeNull();
    expect(reviewMatches(rec, [[0], [1], [0], [2], [0]])).toBe(true);
    expect(reviewMatches(rec, [[0], [1], [0], [2], [1]])).toBe(false);
  });

  describe('in localStorage', () => {
    let store: Record<string, string>;
    beforeEach(() => {
      store = {};
      vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
    });
    afterEach(() => vi.unstubAllGlobals());
    it('keeps the coach’s grades until the review, then the review; a review of other answers is not reused', () => {
      const choices = g.answers![0].choices;
      saveCoachRatings('x', coach, choices);
      expect(loadGameReview('x', choices)).toEqual({ id: 'x', coach });
      const rec = buildReviewRecord(g, coach, { id: 'x', made: 'now' });
      saveGameReview(rec);
      expect(loadGameReview('x', choices)?.review).toEqual(rec);
      saveCoachRatings('x', coach, choices); // the same game: the review stays
      expect(loadGameReview('x', choices)?.review).toEqual(rec);
      expect(loadGameReview('x', [[1]])?.review).toBeUndefined(); // replayed after Undo
      saveCoachRatings('x', [], [[1]]);
      expect(loadGameReview('x', [[1]])).toBeNull();
      expect(parseGameReviews('{oops')).toEqual([]);
      expect(parseGameReviews(JSON.stringify([{ id: 'y', review: { kind: 'nope' } }, { id: 'z', coach }, 7]))).toEqual([{ id: 'z', coach }]);
      expect(Object.keys(store)).toEqual([GAME_REVIEWS_KEY]);
    });
    it('the practice log keeps the counts, and old entries without them still read', () => {
      const [a, b] = parsePractice(JSON.stringify([{ deck: 'A', opp: 'B', result: 'win', review: { acc: 81, n: [0, 1, 20, 3, 1, 0, 1] } }, { deck: 'A', opp: 'B', result: 'loss', review: { acc: 81, n: [1] } }]));
      expect(a!.review).toEqual({ acc: 81, n: [0, 1, 20, 3, 1, 0, 1] });
      expect(b!.review).toBeUndefined();
    });
  });
});

// ---------------------------------------------------------------------------------------------------- a real game
function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
class Recorder implements Agent {
  name = 'rec';
  choices: number[][] = [];
  constructor(private inner: Agent) {}
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

describe('a seeded game, reviewed as the browser and the CLI review it', () => {
  it('rates both seats, keeps the coach’s grades, replays the board, and gives the same ratings every time', async () => {
    const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
    const me = new Recorder(makeTierBot('easy', 5));
    const played = await Game.create(decks, [me, makeTierBot('easy', 9, 'Bot')], { seed: 42, first: 0, log: false }).run();
    const spec: PracticeReviewSpec = { decks, seed: 42, first: 0, botLevel: 'easy', botSeed: 9, choices: me.choices };
    const a = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, made: 'm' });
    const b = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, made: 'm' });
    expect({ ...b, ms: 0 }).toEqual({ ...a, ms: 0 });
    expect(a.winner).toBe(played.winner);
    expect(a.turns).toBe(played.turn);
    expect(a.moves.some((m) => m.p === 0)).toBe(true);
    expect(a.moves.some((m) => m.p === 1)).toBe(true);
    expect(a.answers![0].choices).toEqual(me.choices);
    for (const m of a.moves) {
      expect(m.src).toBe('oracle');
      expect(m.gap).toBeGreaterThanOrEqual(0);
      expect(a.answers![m.p].choices[m.at]).toBeDefined();
    }
    // another oracle seed: the same decisions, rated again
    const c = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, made: 'm', oracleSeed: 7 });
    expect(c.oracleSeed).toBe(7);
    expect(c.moves.map((m) => `${m.p}:${m.at}`)).toEqual(a.moves.map((m) => `${m.p}:${m.at}`));

    // the coach graded two of your moves during play: the review keeps its grades for them and does not play them out
    const mine = a.moves.filter((m) => m.p === 0).slice(0, 2);
    const coach: CoachRating[] = mine.map((m, k) => ({ at: m.at, turn: m.turn, chose: 0, coach: k, chosen: 'Mine', best: 'Coach pick', why: 'Reason.', verdict: k ? 'mistake' : 'agree', gap: k ? 0.5 : 0, se: 0.1, alts: [[1, 0.05, 0.02]] }));
    const withCoach = await runGameReview({ id: 'g', spec, coach, rollouts: 2, made: 'm' });
    for (const [k, m] of mine.entries()) {
      const r = withCoach.moves.find((x) => x.p === 0 && x.at === m.at)!;
      expect(r).toMatchObject({ src: 'coach', chosen: 'Mine', best: 'Coach pick', why: 'Reason.', r: k ? 'mistake' : 'unclear' });
    }
    expect(withCoach.moves.filter((m) => m.src === 'coach')).toHaveLength(2);

    // the board at each decision: replayed from the stored answers, every answer tied to a frame
    const f = await reviewFrames({ decks, seed: 42, first: 0 }, a.answers!);
    expect(f.data.final.winner).toBe(played.winner);
    expect(f.at[0]).toHaveLength(me.choices.length);
    for (const m of a.moves) expect(f.at[m.p][m.at]).toBeGreaterThanOrEqual(-1);
    expect(f.at[0][f.at[0].length - 1]).toBeLessThan(f.data.frames.length);
  }, 120_000);
});
