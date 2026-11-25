// The Game review's ratings (src/lib/gameReview.ts): bands in Gigs with the measurement's standard error, the coach's
// grades from play kept beside the review's ratings, accuracy, the turning point, the rival's relevant moves, the stored record, and a
// seeded real game reviewed end to end (src/sim/gameReviewRun.ts, the function both the browser worker and the CLI run).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import { GIG_SWING } from '../src/ai/eval';
import { CAP, NOISE, reviewGame } from '../src/ai/reviewer';
import { CLOSE_GIGS as COACH_CLOSE, isClose, MISTAKE_GIGS as COACH_MISTAKE } from '../src/ai/coach';
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
  confirmFlag,
  costlyText,
  FIXED_SE_GIGS,
  GIG,
  isKeyMoment,
  listed,
  MISTAKE_GIGS,
  RATING_INFO,
  rateMeasured,
  rateOracle,
  ratingStep,
  reviewCounts,
  rivalFollowUps,
  seatSummary,
  REVIEW_RULES,
  rerateRecord,
  saidOf,
  turningName,
  turningPoint,
  withinNoise,
  type CoachRating,
  type ReviewMove,
} from '../src/lib/gameReview';
import { explain, gapTag, HARD_CHECK_TEXT, moveName, saidText, UNRATED_TEXT } from '../src/lib/reviewWords';
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
  // R4 (docs/REVIEW_2026-11-25.md, reports/review-validity-2026-11-25.md): confirmed on fresh worlds, Sharp and Inspired
  // still came more often in Easy's won games than in its lost ones; dropped, such a move is Best
  it('no Sharp or Inspired since 2026-11-25: the only good move, unseen by a quick read, is Best', () => {
    const only = { gap: 0, top: true, others: [[0.6, 0.1] as const, [1.5, 0.2] as const] };
    for (const screen of [{ gap: 0, se: 0, chosenRank: 0 }, { gap: 0.6, se: 0.1, chosenRank: 1 }, { gap: 1.5, se: 0.2, chosenRank: 2 }, { gap: 1.5, se: 0.2, chosenRank: -1 }])
      expect(rateMeasured({ ...only, screen })).toBe('best');
    expect(rateMeasured(only)).toBe('best');
    expect(rateMeasured({ gap: 0, top: true, pass: true, others: [[0.6, 0.1]], screen: { gap: 0.6, se: 0.1, chosenRank: -1 } })).toBe('best');
    // nothing is confirmed for being the best: only a costly or wide gap is
    expect(confirmFlag(review({ regret: 0, top: true, se: 0, others: [[40, 4]], screen: { gap: 40, se: 4, chosenRank: 1 } }))).toBe(false);
    // older reviews that show them keep their names and words
    expect(RATING_INFO.sharp.means).toMatch(/^Older reviews only/);
  });
  it('the noise test reads the raw gap: a capped gap far outside its SE is not a Close call (REV-3)', () => {
    // capped at 3 Gigs, raw 8 ± 1.6: before, 3 <= 2 × 1.6 made it a Close call
    expect(rateMeasured({ gap: 3, raw: 8, se: 1.6 })).toBe('blunder');
    expect(rateMeasured({ gap: 3, raw: 5, se: 2.25 })).toBe('blunder');
    // a raw gap that really is inside its noise stays a Close call
    expect(rateMeasured({ gap: 3, raw: 4, se: 2.25 })).toBe('close');
    // the reviewer's points: regret capped at 120, raw 320, SE 64
    expect(rateOracle(review({ regret: 120, raw: 320, se: 64, others: [[320, 64]] }))).toBe('blunder');
  });
  it('a gap that is the same in every play-out (SE 0) is fixed evaluation terms, not measured (COACH-14)', () => {
    expect(rateMeasured({ gap: 0.31, se: 0 })).toBe('close');
    expect(rateMeasured({ gap: 0.49, se: 0.001 })).toBe('close');
    expect(rateMeasured({ gap: 0.32, se: 0.02 })).toBe('close'); // under one evaluation point of spread
    expect(rateMeasured({ gap: 0.32, se: 0.03 })).toBe('slip');
    // it is given a typical SE (0.25 Gigs): a larger fixed difference still counts, and a loss in every world is certain
    expect(rateMeasured({ gap: 0.6, se: 0 })).toBe('mistake');
    expect(rateMeasured({ gap: 2, se: 0 })).toBe('blunder');
    expect(rateMeasured({ gap: 3, raw: 30, se: 0 })).toBe('blunder');
    // no paired SE at all (not measured in shared worlds): the gap alone, as before
    expect(rateMeasured({ gap: 0.31 })).toBe('slip');
    // the coach's isClose is the same test, everywhere on a grid
    for (const g of [0, 0.1, 0.149, 0.15, 0.3, 0.5, 1, 2.99, 3, 8])
      for (const se of [undefined, 0, 0.004, 0.024, FIXED_SE_GIGS, 0.05, 0.2, 1]) expect(isClose(g, se)).toBe(withinNoise(g, se));
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
    // agreeing when the coach scored nothing else measured nothing: left to the oracle (REV-11)
    expect(coachRatingOf(record(0, [pick], 'agree', 0))).toBeNull();
  });
  // R8 (docs/REVIEW_2026-11-25.md): the coach's grade is kept beside the review's rating, never in its place
  it('the coach’s grade is kept for reference, in the names the coach showed it in during play', () => {
    const base = (verdict: CoachRating['verdict'], gap: number, se?: number, best = 'A'): CoachRating => ({ at: 1, turn: 2, chose: 1, coach: 0, chosen: 'B', best, why: 'Because.', verdict, gap, ...(se !== undefined ? { se } : {}), alts: [[1, gap, se ?? null]] });
    expect(saidOf(base('mistake', 0.62, 0.1))).toEqual({ v: 'mistake', gap: 0.62, se: 0.1, best: 'A', why: 'Because.' });
    expect(saidOf(base('best', -0.1, 0.05))).toMatchObject({ v: 'best', gap: 0 });
    expect(saidOf(base('agree', 0, undefined, 'B'))).toEqual({ v: 'agree', gap: 0, why: 'Because.' });
    expect(saidText(saidOf(base('mistake', 0.62, 0.1)), 'unit')).toBe('During play the coach said Mistake: it preferred A (−0.6 ± 0.1 Gigs). Coach: Because.');
    expect(saidText(saidOf(base('mistake', 1.4, 0.1)), 'unit')).toMatch(/^During play the coach said Blunder: it preferred A/);
    expect(saidText(saidOf(base('inaccuracy', 0.3, 0.05, 'Pass turn')), 'unit')).toMatch(/^During play the coach said Slip: it preferred End turn/);
    expect(saidText(saidOf(base('close', 0.05, 0.01)), 'unit')).toMatch(/^During play the coach said Close call/);
    expect(saidText(saidOf(base('best', 0.02, 0.01)), 'unit')).toBe('During play the coach said Best: as good as A. Coach: Because.');
    expect(saidText(saidOf(base('agree', 0, undefined, 'B')), 'unit')).toBe('During play the coach said this was its own pick. Coach: Because.');
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
  it('the turning point is the losing side’s biggest loss outside the noise, ties by the raw gap (REV-5)', () => {
    const moves = [mv({ seq: 0, p: 0, r: 'slip', gap: 0.3 }), mv({ seq: 1, p: 1, r: 'blunder', gap: 1.4 }), mv({ seq: 2, p: 0, r: 'blunder', gap: 1.4 }), mv({ seq: 3, p: 0, r: 'unclear', gap: 3 })];
    // no winner given (a draw): either side, earliest on ties
    expect(turningPoint(moves)?.seq).toBe(1);
    expect(turningPoint(moves, 'tie')?.seq).toBe(1);
    // seat 1 won: the winner's blunder is not where the game turned, seat 0's is
    expect(turningPoint(moves, 1)?.seq).toBe(2);
    expect(turningPoint(moves, 0)?.seq).toBe(1);
    // two losses at the cap: the larger raw gap
    const capped = [mv({ seq: 0, p: 0, r: 'blunder', gap: 3, raw: 4 }), mv({ seq: 1, p: 0, r: 'blunder', gap: 3, raw: 9 })];
    expect(turningPoint(capped, 1)?.seq).toBe(1);
    // the winner made the only costly move: no turning point
    expect(turningPoint([mv({ seq: 0, p: 1, r: 'blunder', gap: 2 })], 1)).toBeNull();
    expect(turningPoint([mv({ seq: 0, p: 0, r: 'close', gap: 0.5 })])).toBeNull();
    expect(turningName(1)).toBe('Turning point');
    expect(turningName('tie')).toBe('Biggest error');
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
    // a rival Slip that is the turning point is always listed (REV-9)
    expect(listed(mv({ seq: 0, p: 1, r: 'slip' }), 0, mv({ seq: 0, p: 1, r: 'slip' }))).toBe(true);
    expect(listed(mv({ seq: 0, p: 1, r: 'inspired' }), 0)).toBe(true);
    expect(listed(mv({ seq: 0, p: 0, r: 'unclear' }), 0)).toBe(true);
    expect(isKeyMoment(mv({ seq: 0, p: 0, r: 'best' }), 0, null)).toBe(false);
    expect(isKeyMoment(mv({ seq: 0, p: 0, r: 'slip' }), 0, mv({ seq: 0, p: 0, r: 'slip' }))).toBe(true);
    expect(costlyText([0, 0, 3, 1, 2, 1, 1])).toBe('1 blunder, 1 mistake, 2 slips');
  });
  it('explains a move in plain words, with the coach’s reason for a coach grade', () => {
    expect(explain(mv({ seq: 0, p: 0, r: 'mistake', gap: 0.62, se: 0.1, best: 'Attack' }))).toBe('The review preferred Attack, about 0.6 ± 0.1 Gigs better.');
    expect(explain(mv({ seq: 0, p: 0, r: 'best', chosen: 'X', best: 'X', src: 'coach', why: 'Strong.' }))).toBe('The coach rates this the best move found. Coach: Strong.');
    // the board's names: End turn, not Pass turn
    expect(explain(mv({ seq: 0, p: 0, r: 'slip', gap: 0.2, se: 0.05, best: 'Pass turn' }))).toContain('preferred End turn');
    // a wide close call is too uncertain, not "slightly preferred"; game-losing says how often
    expect(explain(mv({ seq: 0, p: 0, r: 'close', gap: 3, raw: 3, se: 1.6, best: 'B' }))).toBe('The review preferred B by 3.0 ± 1.6 Gigs, but its play-outs disagree too much to call it.');
    expect(explain(mv({ seq: 0, p: 0, r: 'blunder', gap: 0.5, se: 0.1, best: 'B', lost: true }))).toContain('at least 1 in 4 more of the play-outs');
  });
  it('no review text prints a Gig figure above the cap (REV-10)', () => {
    const big = mv({ seq: 0, p: 0, r: 'blunder', gap: 3, raw: 220.9, se: 1.2, best: 'B' });
    for (const text of [explain(big), gapTag(big), explain({ ...big, r: 'close' }), explain({ ...big, r: 'mistake' })]) {
      expect(text).not.toMatch(/220|\b([4-9]|\d{2,})(\.\d+)? Gigs/);
      for (const n of text.match(/\d+(\.\d+)?(?= (± [\d.]+ )?Gigs)/g) ?? []) expect(Number(n)).toBeLessThanOrEqual(CAP_GIGS);
    }
    expect(explain(big)).toBe('The review preferred B: in its play-outs the difference decides the game.');
    expect(gapTag(big)).toBe('decides the game in the play-outs');
    const over = { ...big, raw: 8.04 };
    expect(explain(over)).toBe('The review preferred B, more than 3 Gigs better.');
    expect(gapTag(over)).toBe('more than 3 Gigs behind');
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
    decisions: [
      // a Blunder on the oracle's play-outs; the seat's only costly move, checked with Hard play-outs: a Slip there (R2)
      review({ seq: 1, at: 2, player: 0, regret: 30, raw: 30, se: 2, top: false, others: [[30, 2]], gameLosing: true, confirmed: 16, first: { regret: 30, raw: 30, se: 2, gameLosing: true }, hard: { worlds: 16, regret: 10, raw: 10, se: 2, gameLosing: false } }),
      // the only good move, unseen by a quick read: Best since 2026-11-25 (R4)
      review({ seq: 2, at: 4, player: 0, regret: 0, raw: 0, top: true, se: 0, others: [[60, 4]], screen: { gap: 60, se: 4, chosenRank: 1 } }),
      review({ seq: 3, at: 1, player: 1, regret: 0, raw: 0, top: true, se: 0, others: [[80, 4]], screen: { gap: 80, se: 4, chosenRank: 1 } }),
    ],
    ms: 5,
    unrated: [{ player: 0, at: 0, seq: 0, turn: 1, category: 'mulligan', chosen: 'Keep hand' }],
    forced: [1, 0],
    answers: [{ choices: [[0], [1], [0], [2], [0]], pay: false, order: false }, { choices: [[0], [3]], pay: false, order: false }],
  };
  const coach: CoachRating[] = [
    { at: 4, turn: 3, chose: 0, coach: 0, chosen: 'Pick', best: 'Pick', why: 'Good.', verdict: 'agree', gap: 0, alts: [[1, 0.8, 0.1]] },
    { at: 2, turn: 2, chose: 1, coach: 0, chosen: 'A', best: 'B', why: 'Worse.', verdict: 'mistake', gap: 0.5, se: 0.1, alts: [[1, 0.5, 0.1]] },
  ];
  it('rates both seats by the oracle, the coach’s grade beside your move, mulligans not rated, in game order', () => {
    const rec = buildReviewRecord(g, coach, { id: 'x', made: 'now' });
    expect(rec.moves.map((m) => [m.seq, m.src, m.r])).toEqual([
      [0, 'oracle', 'unrated'],
      [1, 'oracle', 'slip'],
      [2, 'oracle', 'best'],
      [3, 'oracle', 'best'],
    ]);
    expect(rec.moves[0]).toEqual({ seq: 0, p: 0, at: 0, turn: 1, cat: 'mulligan', chosen: 'Keep hand', r: 'unrated', gap: null, src: 'oracle' });
    expect(rec.moves[1]!.lost).toBeUndefined();
    expect(rec.moves[1]!.ms).toMatchObject({ f: [30, 200], c: [30, 200], h: [10, 200], b: 12 });
    expect(rec.moves[1]).toMatchObject({ gap: 0.25, se: 0.05, said: { v: 'mistake', gap: 0.5, se: 0.1, best: 'B', why: 'Worse.' } });
    expect(rec.moves[2]).toMatchObject({ said: { v: 'agree', gap: 0, why: 'Good.' } });
    expect(rec.moves[3]!.said).toBeUndefined(); // the rival's move: no coach
    expect(rec.rules).toBe(REVIEW_RULES);
    expect(rec.timeline).toEqual([[1, 0], [2, 41]]);
    // the mulligan is not counted
    expect(reviewCounts(rec)).toEqual({ acc: accuracyOf(0.25 / 2), n: [0, 0, 1, 0, 1, 0, 0] });
    expect(seatSummary(rec.moves, 0).n.unrated).toBe(1);
    expect(explain(rec.moves[0]!)).toBe(UNRATED_TEXT);
    expect(explain(rec.moves[1]!)).toMatch(new RegExp(`about 0.3 ± 0.1 Gigs better. ${HARD_CHECK_TEXT}$`));
    expect(explain(rec.moves[2]!)).not.toContain(HARD_CHECK_TEXT);
    expect(moveName(rec.moves[0]!)).toBe('Keep hand');
    expect(moveName({ cat: 'mulligan', chosen: 'Yes' })).toBe('Mulligan'); // a review stored before 2026-11-25
    // re-rated under the same rules: the same record
    const again = rerateRecord(rec);
    expect(again.ok && again.rec).toEqual(rec);
    // a malformed coach grade beside a move is left out, the move stays
    const bad = asReviewRecord({ ...rec, moves: rec.moves.map((m) => (m.seq === 1 ? { ...m, said: { v: 'great' } } : m)) })!;
    expect(bad.moves[1]!.said).toBeUndefined();
    expect(bad.moves[1]!.r).toBe('slip');
    // without its Hard check the record cannot be rated again: the check is never made up
    expect(rerateRecord({ ...rec, rules: 1, moves: rec.moves.map((m) => (m.seq === 1 ? { ...m, ms: { ...m.ms!, h: undefined } } : m)) })).toMatchObject({ ok: false, why: 'unconfirmed', moves: [1] });
    // with the check turned off, it is rated from its screening pass
    expect(rerateRecord({ ...rec, rules: 1, hard: 0 })).toMatchObject({ ok: true, rec: { moves: [{}, { r: 'blunder' }, {}, {}] } });
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
    it('a review made under older rating rules comes back stale (run again), with the coach grades kept (REV-12)', () => {
      const choices = g.answers![0].choices;
      const rec = buildReviewRecord(g, coach, { id: 'x', made: 'now' });
      saveGameReview(rec, coach);
      expect(loadGameReview('x', choices)).toEqual({ id: 'x', coach, review: rec });
      // a review stored before rules existed (no `rules`) or under rules 1, without the kept measurements: readable, but stale
      const { rules: _r, ...old } = { ...rec, moves: rec.moves.map(({ ms: _m, ...m }) => m) };
      saveGameReview(old as typeof rec);
      const back = loadGameReview('x', choices)!;
      expect(back.review).toBeUndefined();
      expect(back.stale).toEqual(old);
      expect(back.coach).toEqual(coach); // kept from the earlier save
      saveGameReview({ ...(old as typeof rec), rules: 1 });
      expect(loadGameReview('x', choices)?.stale?.rules).toBe(1);
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
/** anyDeck with three copies of each card in `must` first. */
function deckWith(name: string, colors: string[], must: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const main = must.flatMap((id) => [id, id, id]);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2 && !must.includes(c.id));
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
    const a = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, confirm: 2, hard: 2, made: 'm' });
    const b = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, confirm: 2, hard: 2, made: 'm' });
    expect({ ...b, ms: 0 }).toEqual({ ...a, ms: 0 });
    expect(a.winner).toBe(played.winner);
    expect(a.turns).toBe(played.turn);
    expect(a.moves.some((m) => m.p === 0)).toBe(true);
    expect(a.moves.some((m) => m.p === 1)).toBe(true);
    expect(a.answers![0].choices).toEqual(me.choices);
    for (const m of a.moves) {
      expect(m.src).toBe('oracle');
      if (m.r === 'unrated') expect([m.cat, m.gap]).toEqual(['mulligan', null]);
      else expect(m.gap).toBeGreaterThanOrEqual(0);
      expect(a.answers![m.p].choices[m.at]).toBeDefined();
    }
    // the coach graded two of your moves during play: both are rated by the oracle, exactly as without the coach (R8),
    // with the coach's grade kept beside them; with another oracle seed, the same decisions are rated again
    const mine = a.moves.filter((m) => m.p === 0 && m.r !== 'unrated').slice(0, 2);
    const coach: CoachRating[] = mine.map((m, k) => ({ at: m.at, turn: m.turn, chose: 0, coach: k, chosen: 'Mine', best: 'Coach pick', why: 'Reason.', verdict: k ? 'mistake' : 'agree', gap: k ? 0.5 : 0, se: 0.1, alts: [[1, 0.05, 0.02]] }));
    const sameSeed = await runGameReview({ id: 'g', spec, coach, rollouts: 2, confirm: 2, hard: 2, made: 'm' });
    expect(sameSeed.moves.map(({ said: _s, ...m }) => m)).toEqual(a.moves);
    expect(sameSeed.moves.filter((m) => m.said).map((m) => m.at)).toEqual(mine.map((m) => m.at));
    const withCoach = await runGameReview({ id: 'g', spec, coach, rollouts: 2, confirm: 2, hard: 2, made: 'm', oracleSeed: 7 });
    expect(withCoach.oracleSeed).toBe(7);
    expect(withCoach.moves.map((m) => `${m.p}:${m.at}`)).toEqual(a.moves.map((m) => `${m.p}:${m.at}`));
    const kept = withCoach.moves.find((x) => x.p === 0 && x.at === mine[0]!.at)!;
    expect(kept).toMatchObject({ src: 'oracle', said: { v: 'agree', why: 'Reason.' } });
    const costly = withCoach.moves.find((x) => x.p === 0 && x.at === mine[1]!.at)!;
    expect(costly).toMatchObject({ src: 'oracle', said: { v: 'mistake', gap: 0.5, best: 'Coach pick' } });
    expect(withCoach.moves.filter((m) => m.src === 'coach')).toHaveLength(0);

    // the board at each decision: replayed from the stored answers, every answer tied to a frame
    const f = await reviewFrames({ decks, seed: 42, first: 0 }, a.answers!);
    expect(f.data.final.winner).toBe(played.winner);
    expect(f.at[0]).toHaveLength(me.choices.length);
    for (const m of a.moves) expect(f.at[m.p][m.at]).toBeGreaterThanOrEqual(-1);
    expect(f.at[0][f.at[0].length - 1]).toBeLessThan(f.data.frames.length);
  }, 120_000);
});

// ------------------------------------------------------------------------------------------------ mulligans, Gig choices
describe('mulligans are not rated (R3, 2026-11-25); Gig choices are graded (D25)', () => {
  it('both players’ mulligans are listed unrated, by the board’s names, with nothing played out for them', async () => {
    const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
    const review = await reviewGame(
      { decks, seed: 100, first: 0, agents: [makeTierBot('easy', 1), makeTierBot('easy', 2)], agentNames: ['easy', 'easy'] },
      { rollouts: 2, seats: [0, 1] },
    );
    expect(review.decisions.filter((d) => d.category === 'mulligan')).toEqual([]);
    const mulligans = review.unrated ?? [];
    expect(mulligans.length).toBe(2);
    expect(mulligans[0]!.player).not.toBe(mulligans[1]!.player);
    for (const m of mulligans) {
      expect(m).toMatchObject({ at: 0, category: 'mulligan' });
      expect(['Keep hand', 'Mulligan']).toContain(m.chosen);
    }
    // a seat not reviewed lists nothing
    const one = await reviewGame({ decks, seed: 100, first: 0, agents: [makeTierBot('easy', 1), makeTierBot('easy', 2)], agentNames: ['easy', 'easy'] }, { rollouts: 1, seats: [0] });
    expect((one.unrated ?? []).map((u) => u.player)).toEqual([0]);
  }, 120_000);

  // A Gig choice that changes a rival Gig while the rival has Meredith Stout on the field triggers her ("When a Rival
  // adjusts or swaps 1 or more friendly Gigs …"). The oracle plays every option out, so her trigger becomes pending in
  // its copies; until 2026-11-25 it was never resolved, and the next copy a bot made threw "clone() with 1 pending
  // effect(s): Meredith Stout …", which failed the whole review (18 of 51 meta-deck reviews).
  it('grades a Gig choice that triggers the rival’s Meredith Stout (her effect resolves in the play-outs)', async () => {
    const decks: [DeckList, DeckList] = [deckWith('A', ['Yellow'], ['afterparty_at_lizzie_s', 'zetatech_faceplate']), deckWith('B', ['Red'], ['meredith_stout_stone_cold_corpo'])];
    let triggers = 0;
    let graded = 0;
    for (const seed of [5, 7, 9]) {
      const inner = makeTierBot('easy', seed);
      const watch: Agent = {
        name: inner.name,
        decide: (g: Game, d: Decision) => {
          const meredith = g.P(1).field.some((u) => g.s.cards[u]!.defId === 'meredith_stout_stone_cold_corpo');
          if (d.kind === 'gigValue' && d.options.length >= 2 && g.pending.length === 0 && meredith && d.options.some((o) => o.gig !== undefined && g.s.gigs[o.gig]!.controller === 1)) triggers++;
          return inner.decide(g, d);
        },
      };
      const review = await reviewGame({ decks, seed, first: (seed % 2) as 0 | 1, agents: [watch, makeTierBot('easy', seed + 1000)], agentNames: ['easy', 'easy'] }, { rollouts: 1, seats: [0] });
      graded += review.decisions.filter((d) => d.category === 'gig dice').length;
      expect(review.failed ?? []).toEqual([]);
    }
    expect(triggers).toBeGreaterThan(0);
    expect(graded).toBeGreaterThanOrEqual(triggers);
  }, 120_000);

  it('a decision whose grading throws is not counted, kept with its error, and the review carries on', async () => {
    const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
    const spec = () => ({ decks, seed: 100, first: 0 as const, agents: [makeTierBot('easy', 1), makeTierBot('easy', 2)] as [Agent, Agent], agentNames: ['easy', 'easy'] as [string, string] });
    const plain = await reviewGame(spec(), { rollouts: 1, seats: [0] });
    expect(plain.failed).toBeUndefined();
    // the coach is asked inside the grading of every decision: make the third ask throw
    let asks = 0;
    const coach = () => ({ name: 'broken', decide: async (_g: Game, _d: Decision) => (++asks === 3 ? Promise.reject(new Error('grading broke')) : [0]) });
    const r = await reviewGame(spec(), { rollouts: 1, seats: [0], withCoach: true, coach });
    // the game is the same game, played to the end
    expect([r.winner, r.turns, r.reason]).toEqual([plain.winner, plain.turns, plain.reason]);
    expect(r.failed).toHaveLength(1);
    const f = r.failed![0]!;
    expect(f).toMatchObject({ player: 0, reason: 'grading broke' });
    // not graded, and nothing half-recorded: every other decision is, the failed one is not
    expect(r.decisions.length + 1).toBe(plain.decisions.length);
    expect(r.decisions.some((d) => d.seq === f.seq)).toBe(false);
    expect(new Set(r.decisions.map((d) => d.i)).size).toBe(r.decisions.length);
    // the stored record lists it apart (not a move, not counted), keeps it through storage, and a rules change runs the review again
    const rec = buildReviewRecord(r, [], { id: 'g', made: 'm' });
    expect(rec.failed).toEqual([{ seq: f.seq, p: 0, at: f.at, turn: f.turn, cat: f.category, chosen: f.chosen, why: 'grading broke' }]);
    expect(rec.moves.some((m) => m.seq === f.seq)).toBe(false);
    expect(asReviewRecord(JSON.parse(JSON.stringify(rec)))?.failed).toEqual(rec.failed);
    expect(asReviewRecord({ ...rec, failed: [{ ...rec.failed![0], why: 3 }] })).toBeNull();
    const again = rerateRecord({ ...rec, rules: REVIEW_RULES - 1 });
    expect(again.ok).toBe(false);
    if (!again.ok) expect(again.moves).toContain(f.seq);
  }, 120_000);

  it('the full Game review (runGameReview) lists the mulligans unrated, never counted', async () => {
    const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];
    const me = new Recorder(makeTierBot('easy', 5));
    await Game.create(decks, [me, makeTierBot('easy', 9, 'Bot')], { seed: 42, first: 0, log: false }).run();
    const spec: PracticeReviewSpec = { decks, seed: 42, first: 0, botLevel: 'easy', botSeed: 9, choices: me.choices };
    const rec = await runGameReview({ id: 'g', spec, coach: [], rollouts: 2, confirm: 2, hard: 2, made: 'm' });
    const mulligans = rec.moves.filter((m) => m.cat === 'mulligan');
    expect(mulligans.length).toBeGreaterThanOrEqual(1);
    for (const m of mulligans) {
      expect(m).toMatchObject({ src: 'oracle', r: 'unrated', gap: null });
      expect(['Keep hand', 'Mulligan']).toContain(m.chosen);
      expect(m.ms).toBeUndefined();
    }
    expect(seatSummary(rec.moves, 0).counted).toBe(rec.moves.filter((m) => m.p === 0 && m.r !== 'unrated' && m.r !== 'unclear').length);
  }, 120_000);
});
