// A stored Game review keeps what its ratings were computed from (ReviewMove.ms, src/lib/gameReview.ts KeptMeasure), so a
// change of the rating rules re-rates it from storage (rerateRecord) instead of playing it out again. Exactness on real
// seeded reviews (src/sim/gameReviewRun.ts, as the browser and the CLI run them), the storage round trip, the loader
// (src/lib/gameReviewStore.ts) under other rules and other measurements, the two awkward cases of confirmation, old
// records exactly as before, and the review screen's line.
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import { makeTierBot } from '../src/ai/tiers';
import type { DecisionReview, GameReview } from '../src/ai/reviewer';
import type { Agent, Decision, DeckList } from '../src/engine/types';
import {
  buildReviewRecord,
  GAME_REVIEW_CONFIRM,
  GAME_REVIEW_HARD,
  GAME_REVIEW_ROLLOUTS,
  measuredAsNow,
  rateOracle,
  rerateRecord,
  REVIEW_MEASURE,
  REVIEW_RULES,
  reviewCounts,
  type CoachRating,
  type GameReviewRecord,
  type Rating,
  type ReviewMove,
} from '../src/lib/gameReview';
import { asReviewRecord, GAME_REVIEWS_KEY, keepReview, loadGameReview, parseGameReviews, saveGameReview } from '../src/lib/gameReviewStore';
import { loadPractice, recordPractice } from '../src/lib/practiceLog';
import { RERATED_TEXT, staleText } from '../src/lib/reviewWords';
import { runGameReview, GAME_REVIEW_CONFIRM as RUN_CONFIRM, GAME_REVIEW_HARD as RUN_HARD, GAME_REVIEW_ROLLOUTS as RUN_ROLLOUTS } from '../src/sim/gameReviewRun';
import type { PracticeReviewSpec } from '../src/sim/practiceReview';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { GameReviewView } from '../src/ui/components/GameReview';

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
const decks: [DeckList, DeckList] = [anyDeck('A', ['Red', 'Yellow']), anyDeck('B', ['Blue', 'Green'])];

/**
 * Coach grades for every 4th of your answers (only those the review grades become coach moves), of every kind the coach
 * gives: its own pick with every other option clearly worse (Best, Sharp or Inspired by the review's screen), a close
 * call, an inaccuracy, a mistake past a whole Gig, and its pick where every option is close (No clear difference).
 */
function coachFor(answers: number): CoachRating[] {
  const out: CoachRating[] = [];
  for (let at = 1; at < answers; at += 4) {
    const k = out.length % 5;
    const base = { at, turn: 0, chose: 0, coach: k === 0 || k === 4 ? 0 : 1, chosen: 'Mine', best: k === 0 || k === 4 ? 'Mine' : 'Coach pick', why: `Reason ${at}.` };
    if (k === 0) out.push({ ...base, verdict: 'agree', gap: 0, alts: [1, 2, 3, 4, 5, 6].map((i): [number, number, number | null] => [i, 0.6 + 0.3 * i, 0.1]) });
    else if (k === 1) out.push({ ...base, verdict: 'close', gap: 0.05, se: 0.04, alts: [[0, 0.05, 0.04], [2, 1, 0.1]] });
    else if (k === 2) out.push({ ...base, verdict: 'inaccuracy', gap: 0.3, se: 0.05, alts: [[0, 0.3, 0.05]] });
    else if (k === 3) out.push({ ...base, verdict: 'mistake', gap: 1.2, se: 0.1, alts: [[0, 1.2, 0.1]] });
    else out.push({ ...base, verdict: 'agree', gap: 0, alts: [[1, 0.05, 0.02], [2, 0.1, null]] });
  }
  return out;
}

interface Played {
  spec: PracticeReviewSpec;
  coach: CoachRating[];
  rec: GameReviewRecord;
}
/** A seeded game (you: Easy, the bot at `level`), reviewed as the browser reviews it with fewer play-outs and confirmation worlds. */
async function played(seed: number, level: string, withCoach: boolean): Promise<Played> {
  const me = new Recorder(makeTierBot('easy', 5));
  await Game.create(decks, [me, makeTierBot(level, 9, 'Bot')], { seed, first: 0, log: false }).run();
  const spec: PracticeReviewSpec = { decks, seed, first: 0, botLevel: level, botSeed: 9, choices: me.choices };
  const coach = withCoach ? coachFor(me.choices.length) : [];
  const rec = await runGameReview({ id: `g${seed}`, spec, coach, rollouts: 2, confirm: 2, hard: 2, made: 'm' });
  return { spec, coach, rec };
}

const games: Played[] = [];
beforeAll(async () => {
  games.push(await played(42, 'easy', false), await played(43, 'medium', true), await played(45, 'hard', true));
}, 180_000);

const ratingsOf = (rec: GameReviewRecord) => rec.moves.map((m) => `${m.seq}:${m.r}`);
const count = (rec: GameReviewRecord, f: (m: ReviewMove) => boolean) => rec.moves.filter(f).length;

describe('re-rating a real stored review from its kept measurements is exact', () => {
  it('the set covers oracle grades with the coach’s beside them, confirmed moves, No clear difference and unrated mulligans', () => {
    const all = games.flatMap((g) => g.rec.moves);
    // every move rated by the oracle (R8), the coach's grade beside your moves it graded
    expect(all.every((m) => m.src === 'oracle')).toBe(true);
    expect(all.filter((m) => m.said).length).toBeGreaterThan(3);
    expect(all.filter((m) => m.ms?.c).length).toBeGreaterThan(3);
    for (const r of ['unclear', 'best', 'close', 'blunder', 'unrated'] satisfies Rating[]) expect(all.some((m) => m.r === r)).toBe(true);
    // a seat's rare Mistakes and Blunders checked with Hard play-outs (R2), only in seats with at most 2 of them
    expect(all.some((m) => m.ms?.h)).toBe(true);
    for (const g of games)
      for (const p of [0, 1] as const) {
        const checked = g.rec.moves.filter((m) => m.p === p && m.ms?.h);
        if (checked.length) expect(checked.length).toBeLessThanOrEqual(2);
      }
    // no Sharp or Inspired since 2026-11-25 (R4)
    expect(all.some((m) => m.r === 'sharp' || m.r === 'inspired')).toBe(false);
    // a confirmed move rated from its confirmation: a move whose screening pass alone would rate it otherwise
    expect(all.some((m) => m.ms?.c && m.ms.f![0] !== m.ms.c[0])).toBe(true);
  });

  it('every move keeps its measurements, and re-rating reproduces every rating and the whole record', () => {
    for (const { rec } of games) {
      // the build keeps an oracle move's measurements only when they read back exactly (keepOracle checks every number
      // a rating reads), so every move having them is the proof that the encoding loses nothing
      for (const m of rec.moves) if (m.r !== 'unrated') expect(m.ms, `move ${m.seq} (${m.src})`).toBeDefined();
      expect(rec.measure).toBe(REVIEW_MEASURE);
      expect(rec.confirm).toBe(2);
      const again = rerateRecord(rec);
      expect(again.ok).toBe(true);
      if (!again.ok) continue;
      expect(ratingsOf(again.rec)).toEqual(ratingsOf(rec));
      expect(again.rec).toEqual(rec);
      expect(JSON.stringify(again.rec)).toBe(JSON.stringify(rec));
      // under older rules: the same ratings and figures, now under the current rules and marked as rated again
      const old = rerateRecord({ ...rec, rules: 1, moves: rec.moves.map((m) => (m.r === 'unrated' ? m : { ...m, r: 'blunder' as const })) });
      expect(old.ok && old.rec).toEqual({ ...rec, rerated: 1 });
    }
  });

  it('through storage: saved, read back and re-rated, it is the same record', () => {
    for (const { rec, coach } of games) {
      const raw = JSON.stringify([{ id: rec.id, coach, review: { ...rec, rules: 1 } }]);
      const [back] = parseGameReviews(raw);
      expect(back!.coach).toEqual(coach);
      const again = rerateRecord(back!.review!);
      expect(again.ok && again.rec).toEqual({ ...rec, rerated: 1 });
      expect(asReviewRecord(JSON.parse(JSON.stringify(rec)))).toEqual(rec);
    }
  });

  it('a gap is kept exactly: a rounded one would cross the Best line (0.1 Gigs = 4 points)', () => {
    // 4.004 points is 0.1001 Gigs: not Best (a Close call); rounded to the reviewer's 0.01 points it would be 4.00, Best
    const d = decision({ regret: 4.004, raw: 4, se: 0.5, others: [[4, 0.5], [30, 2]] });
    const rec = buildReviewRecord(review([d]), [], { id: 'x', made: 'm' });
    expect(rec.moves[0]!.r).toBe('close');
    expect(rec.moves[0]!.ms!.f![0]).toBe(4.004);
    expect(rateOracle({ ...d, regret: 4 })).toBe('best');
    const again = rerateRecord({ ...rec, rules: 1 });
    expect(again.ok && again.rec.moves[0]!.r).toBe('close');
    // past the cap the raw gap is kept (the gap counted is the cap); reviewed with no confirmation, so none is needed
    const big = buildReviewRecord(review([decision({ regret: 120, raw: 333.33, se: 40, others: [[333.33, 40]] })]), [], { id: 'x', made: 'm', confirm: 0, hard: 0 });
    expect(big.moves[0]!.ms!.f).toEqual([333.33, 4000]);
    expect(rerateRecord({ ...big, rules: 1 })).toMatchObject({ ok: true, rec: { moves: [{ r: 'blunder', gap: 3, raw: 8.33 }] } });
  });
});

// ---------------------------------------------------------------------------------------------------- hand-built records

/** A fully measured oracle decision (the reviewer always records these fields), in points. */
function decision(o: Partial<DecisionReview>): DecisionReview {
  return { i: 0, seq: 0, at: 0, turn: 3, player: 0, category: 'unit', options: 4, chosen: 'A', best: 'B', regret: 0, raw: 0, se: 0, top: false, others: [], gameLosing: false, ...o };
}
function review(decisions: DecisionReview[]): GameReview {
  return {
    version: 1,
    seed: 3,
    first: 0,
    winner: 1,
    reason: 'r',
    turns: 9,
    names: ['A', 'B'],
    rollouts: GAME_REVIEW_ROLLOUTS,
    seats: [],
    timeline: [{ turn: 1, v: 0 }],
    swings: [],
    decisions,
    ms: 5,
    forced: [0, 0],
    answers: [{ choices: [[0], [1]], pay: false, order: false }, { choices: [[0]], pay: false, order: false }],
  };
}
const CHOICES = [[0], [1]];

describe('the two awkward cases of confirmation', () => {
  // screening: 4.5 ± 1 points (0.11 Gigs, a Close call); confirmed: 30 ± 2 points (0.75 Gigs, a Slip since the lines
  // were raised on 2026-11-25). Under the current rules a narrow close call (gap < CHECK_GIGS) is not confirmed, so a
  // record like this is one made under rules that flagged it.
  const confirmedNotFlagged = decision({ regret: 30, raw: 30, se: 2, others: [[4.5, 1], [60, 3]], confirmed: 16, first: { regret: 4.5, raw: 4.5, se: 1, gameLosing: false } });
  // screening: a clear 30 ± 2 points, a Mistake, which the current rules confirm; recorded with no confirmation
  const flaggedNotConfirmed = decision({ regret: 30, raw: 30, se: 2, others: [[30, 2]] });

  it('(a) a confirmed move the current rules would not confirm is rated from its screening pass', () => {
    const rec = buildReviewRecord(review([confirmedNotFlagged]), [], { id: 'x', made: 'm' });
    expect(rec.moves[0]).toMatchObject({ r: 'slip', gap: 0.75, se: 0.05 });
    expect(rec.moves[0]!.ms).toEqual({ f: [4.5, 100], c: [30, 200], o: [450, 100, 6000, 300] });
    const again = rerateRecord({ ...rec, rules: 1 });
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    // its screening figures, as a fresh run under these rules would show them; the confirmation is still kept
    expect(again.rec.moves[0]).toMatchObject({ r: 'close', gap: 0.11, se: 0.03, ms: rec.moves[0]!.ms });
    expect(again.rec.moves[0]!.raw).toBeUndefined();
  });

  it('a review stored under rules 4 (Mistake from 0.375 Gigs, Blunder from 1) is rated again under the raised lines, nothing re-measured', () => {
    // seat 0: three confirmed costly moves, so no Hard check (more than HARD_CHECK_MAX_FLAGS of 0.375 Gigs or more)
    // (the reviewer caps a gap at 120 points, 3 Gigs, and keeps the raw one beside it)
    const cap = (x: number) => Math.min(120, x);
    const conf = (raw: number, at: number) => decision({ seq: at, at, regret: cap(raw), raw, se: 2, others: [[raw, 2]], confirmed: 16, first: { regret: cap(raw + 2), raw: raw + 2, se: 2, gameLosing: false } });
    // seat 1: its only costly move, checked with Hard play-outs (CHECK_GIGS counts it, as the old Mistake line did)
    const lone = decision({ seq: 9, at: 0, player: 1, regret: 30, raw: 30, se: 2, others: [[30, 2]], confirmed: 16, first: { regret: 32, raw: 32, se: 2, gameLosing: false }, hard: { worlds: 16, regret: 50, raw: 50, se: 3, gameLosing: false } });
    const rec = buildReviewRecord(review([conf(30, 0), conf(60, 1), conf(140, 2), lone]), [], { id: 'x', made: 'm' });
    expect(rec.moves.map((m) => [m.r, m.gap])).toEqual([
      ['slip', 0.75],
      ['mistake', 1.5],
      ['blunder', 3],
      ['mistake', 1.25],
    ]);
    // as rules 4 stored them: 0.75 a Mistake, 1.5 a Blunder, 3.5 (capped at 3) a Blunder, the Hard-checked 1.25 a Blunder
    const stored: GameReviewRecord = { ...rec, rules: 4, moves: rec.moves.map((m, i) => ({ ...m, r: (['mistake', 'blunder', 'blunder', 'blunder'] as const)[i]! })) };
    const again = rerateRecord(stored);
    expect(again.ok).toBe(true);
    if (!again.ok) return;
    expect(again.rec).toMatchObject({ rules: REVIEW_RULES, rerated: 4 });
    expect(again.rec.moves).toEqual(rec.moves);
    expect(REVIEW_RULES).toBe(5);
  });

  it('(b) a move the current rules confirm that was not confirmed: never made up, the review comes back stale', () => {
    const rec = buildReviewRecord(review([flaggedNotConfirmed]), [], { id: 'x', made: 'm' });
    expect(rec.moves[0]!.ms).toEqual({ f: [30, 200], o: [3000, 200] });
    expect(rerateRecord({ ...rec, rules: 1 })).toEqual({ ok: false, why: 'unconfirmed', moves: [0] });
    // the same move recorded without confirmation at all (confirm 0) needs none
    expect(rerateRecord({ ...rec, rules: 1, confirm: 0, hard: 0 }).ok).toBe(true);
  });

  describe('through the loader', () => {
    let store: Record<string, string>;
    beforeEach(() => {
      store = {};
      vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
    });
    afterEach(() => vi.unstubAllGlobals());
    it('(a) re-rated; (b) stale, as today', () => {
      saveGameReview({ ...buildReviewRecord(review([confirmedNotFlagged]), [], { id: 'x', made: 'm' }), rules: 1 });
      expect(loadGameReview('x', CHOICES)).toMatchObject({ reratedNow: true, review: { rules: REVIEW_RULES, rerated: 1, moves: [{ r: 'close' }] } });
      const b = { ...buildReviewRecord(review([flaggedNotConfirmed]), [], { id: 'x', made: 'm' }), rules: 1 };
      saveGameReview(b);
      expect(loadGameReview('x', CHOICES)).toEqual({ id: 'x', stale: b });
    });
  });
});

describe('the loader, with a real stored review', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
  });
  afterEach(() => vi.unstubAllGlobals());
  // the reviews above were measured with fewer play-outs to keep the test fast; the loader reads only these fields
  const asNow = (rec: GameReviewRecord): GameReviewRecord => ({ ...rec, rollouts: GAME_REVIEW_ROLLOUTS, confirm: GAME_REVIEW_CONFIRM, hard: GAME_REVIEW_HARD });

  it('the measurement constants are one set (the store reads them without loading the oracle)', () => {
    expect(RUN_ROLLOUTS).toBe(GAME_REVIEW_ROLLOUTS);
    expect(RUN_CONFIRM).toBe(GAME_REVIEW_CONFIRM);
    expect(RUN_HARD).toBe(GAME_REVIEW_HARD);
    // changing either changes how a review is measured: bump REVIEW_MEASURE with it (this pin is the reminder)
    expect([REVIEW_MEASURE, GAME_REVIEW_ROLLOUTS, GAME_REVIEW_CONFIRM, GAME_REVIEW_HARD]).toEqual([6, 8, 16, 16]);
  });

  it('other rules: the ratings come back as rated from the measurements, saved under the current rules with the log’s counts', () => {
    const { rec, coach, spec } = games[2]!;
    const now = asNow(rec);
    // made under rules 1, with ratings those rules gave (here: anything else)
    const old: GameReviewRecord = { ...now, rules: 1, moves: now.moves.map((m) => (m.r === 'unrated' ? m : { ...m, r: m.r === 'best' ? 'close' : 'best' })) };
    saveGameReview(old, coach);
    recordPractice({ id: rec.id, date: 'd', deck: 'A', opp: 'B', level: 'hard', result: 'loss', first: true, turns: rec.turns, reason: 'r' });
    const loaded = loadGameReview(rec.id, spec.choices)!;
    expect(loaded.reratedNow).toBe(true);
    expect(loaded.stale).toBeUndefined();
    expect(loaded.review).toEqual({ ...now, rerated: 1 });
    expect(ratingsOf(loaded.review!)).toEqual(ratingsOf(rec));
    // the load only reads: nothing was written yet
    expect(parseGameReviews(store[GAME_REVIEWS_KEY]!)[0]!.review!.rules).toBe(1);
    // the review screen keeps it (an effect, never during render), and the practice log's counts with it
    keepReview(loaded.review!);
    const kept = parseGameReviews(store[GAME_REVIEWS_KEY]!)[0]!;
    expect(kept).toEqual({ id: rec.id, coach, review: { ...now, rerated: 1 } });
    expect(loadPractice().find((g) => g.id === rec.id)!.review).toEqual(reviewCounts(rec));
    // read again: current, no longer to be kept, still marked as rated again
    const again = loadGameReview(rec.id, spec.choices)!;
    expect(again.reratedNow).toBeUndefined();
    expect(again.review!.rerated).toBe(1);
  });

  it('measured another way: stale, whatever the rules', () => {
    const { rec, coach, spec } = games[1]!;
    const now = asNow(rec);
    for (const other of [{ measure: REVIEW_MEASURE + 1 }, { rollouts: 4 }, { confirm: 0 }, { confirm: 32 }, { hard: 0 }, { hard: 8 }]) {
      for (const rules of [REVIEW_RULES, 1]) {
        const r = { ...now, ...other, rules };
        expect(measuredAsNow(r)).toBe(false);
        saveGameReview(r, coach);
        expect(loadGameReview(rec.id, spec.choices)).toEqual({ id: rec.id, coach, stale: r });
      }
    }
    saveGameReview(now, coach);
    expect(loadGameReview(rec.id, spec.choices)).toEqual({ id: rec.id, coach, review: now });
  });

  it('a move rated by the coach’s grade (a review stored before 2026-11-25): stale, run again; the coach’s grades kept with the game do not matter', () => {
    const { rec, coach, spec } = games[1]!;
    const now = { ...asNow(rec), rules: 1 };
    const mine = rec.moves.find((m) => m.p === rec.me && m.said)!;
    const older = { ...now, moves: now.moves.map((m) => (m.seq === mine.seq ? { ...m, src: 'coach' as const, why: 'Reason.', ms: { s: [0, 1] } } : m)) };
    saveGameReview(older, coach);
    expect(loadGameReview(rec.id, spec.choices)?.stale).toEqual(older);
    expect(rerateRecord(older)).toEqual({ ok: false, why: 'coach', moves: [mine.seq] });
    // the coach's grades are reference only: with fewer or none kept, the oracle's ratings re-rate the same
    saveGameReview(now, coach.slice(1));
    expect(loadGameReview(rec.id, spec.choices)?.review).toEqual({ ...asNow(rec), rerated: 1 });
  });

  it('an old record without the kept measurements behaves exactly as before', () => {
    const { rec, coach, spec } = games[1]!;
    const { measure: _m, confirm: _c, ...head } = rec;
    const old: GameReviewRecord = { ...head, moves: rec.moves.map(({ ms: _ms, ...m }) => m) };
    expect(asReviewRecord(JSON.parse(JSON.stringify(old)))).toEqual(old);
    expect(measuredAsNow(old)).toBe(true);
    // under the current rules: shown as it is
    saveGameReview(old, coach);
    expect(loadGameReview(rec.id, spec.choices)).toEqual({ id: rec.id, coach, review: old });
    // under older rules (or none recorded): stale, to be run again, exactly as before
    expect(rerateRecord({ ...old, rules: 1 })).toMatchObject({ ok: false, why: 'not-kept' });
    for (const o of [{ ...old, rules: 1 }, (({ rules: _r, ...x }) => x)(old) as GameReviewRecord]) {
      saveGameReview(o, coach);
      expect(loadGameReview(rec.id, spec.choices)).toEqual({ id: rec.id, coach, stale: o });
    }
  });

  it('malformed kept measurements are dropped (the move stays), a malformed measurement version drops the review, never a throw', () => {
    const { rec, coach } = games[1]!;
    const oracleAt = rec.moves.findIndex((m) => m.ms);
    const coachAt = rec.moves.findIndex((m) => m.r !== 'unrated' && m !== rec.moves[oracleAt]);
    const bad = [{ f: 'x' }, { f: [1] }, { f: [1, 2.5] }, { f: [-1, 2] }, { f: [1, 2], o: [1] }, { f: [1, 2], b: 99 }, { f: [1, 2], s: [1, 2] }, { f: [1, 2], z: 1 }, { f: [1, 2], u: [1, 2, 3] }, { f: [1, 2], u: [1, 2, 3, 4, 5] }, [], null, 7];
    for (const ms of bad) {
      const moves = rec.moves.map((m, i) => (i === oracleAt ? { ...m, ms } : m));
      const back = asReviewRecord(JSON.parse(JSON.stringify({ ...rec, moves })))!;
      expect(back).not.toBeNull();
      expect(back.moves[oracleAt]!.ms).toBeUndefined();
      expect(back.moves[oracleAt]!.r).toBe(rec.moves[oracleAt]!.r);
      expect(back.moves.filter((_m, i) => i !== oracleAt)).toEqual(rec.moves.filter((_m, i) => i !== oracleAt));
      expect(rerateRecord({ ...back, rules: 1 })).toMatchObject({ ok: false, why: 'not-kept', moves: [rec.moves[oracleAt]!.seq] });
    }
    // a coach-graded move of an older review keeps only its screen
    for (const ms of [{ s: [1, 2, 3] }, { f: [1, 2] }, { s: [0.5, 1] }]) {
      const moves = rec.moves.map((m, i) => (i === coachAt ? { ...m, src: 'coach' as const, ms } : m));
      expect(asReviewRecord(JSON.parse(JSON.stringify({ ...rec, moves })))!.moves[coachAt]!.ms).toBeUndefined();
    }
    for (const head of [{ measure: 'one' }, { measure: 1.5 }, { confirm: -1 }, { rerated: 'x' }]) {
      expect(asReviewRecord({ ...rec, ...head })).toBeNull();
      expect(parseGameReviews(JSON.stringify([{ id: 'x', coach, review: { ...rec, ...head } }]))).toEqual([{ id: 'x', coach }]);
    }
  });
});

describe('the review screen', () => {
  let store: Record<string, string>;
  beforeEach(() => {
    store = {};
    vi.stubGlobal('localStorage', { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => void (store[k] = v), removeItem: (k: string) => void delete store[k] });
  });
  afterEach(() => vi.unstubAllGlobals());
  const replayOf = (p: Played, o: Partial<PracticeReplay> = {}): PracticeReplay => ({ id: p.rec.id, date: 'd', decks, seed: p.spec.seed, botLevel: p.spec.botLevel, botSeed: p.spec.botSeed, choices: p.spec.choices, result: 'loss', ...o });
  const html = (p: Played, o?: Partial<PracticeReplay>) => renderToStaticMarkup(<GameReviewView src={{ replay: replayOf(p, o), coach: [], persist: true }} />);
  const stored = (p: Played, rec: GameReviewRecord) => saveGameReview({ ...rec, rollouts: GAME_REVIEW_ROLLOUTS, confirm: GAME_REVIEW_CONFIRM, hard: GAME_REVIEW_HARD }, p.coach);

  it('a review rated again says so in one muted line, and is shown at once', () => {
    const p = games[1]!;
    stored(p, { ...p.rec, rules: 1 });
    const h = html(p);
    expect(h).toContain(`<p class="small muted">${RERATED_TEXT}</p>`);
    expect(h).not.toContain('Reviewing');
    expect(h).toContain('accuracy');
    // rendering only read the store: the effect keeps it (not run by a static render)
    expect(parseGameReviews(store[GAME_REVIEWS_KEY]!)[0]!.review!.rules).toBe(1);
    // a current review, never re-rated: no such line
    stored(p, p.rec);
    expect(html(p)).not.toContain(RERATED_TEXT);
  });

  it('a game from another simulator version whose stored review can be re-rated shows the re-rated review, not the refusal', () => {
    const p = games[2]!;
    stored(p, { ...p.rec, rules: 1 });
    const h = html(p, { simVersion: 3 });
    expect(h).toContain(RERATED_TEXT);
    expect(h).toContain('accuracy');
    expect(h).not.toContain('can&#x27;t be reviewed');
    // one that can't be re-rated (stored before the measurements were kept): the refusal, and the old review as it was
    const old = { ...p.rec, rules: 1, moves: p.rec.moves.map(({ ms: _ms, ...m }) => m) };
    stored(p, old);
    const o = html(p, { simVersion: 3 });
    expect(o).toContain('can&#x27;t be reviewed: it was recorded with version 3');
    expect(o).toContain(staleText(true));
    expect(o).not.toContain(RERATED_TEXT);
    // measured another way, under the current rules: shown as it was, in those words
    saveGameReview({ ...p.rec, rollouts: 4, confirm: GAME_REVIEW_CONFIRM, hard: GAME_REVIEW_HARD }, p.coach);
    expect(html(p, { simVersion: 3 })).toContain(staleText(false));
  });
});

describe('a re-rate is fast', () => {
  it('well under a millisecond a review on this machine’s scale (no play-outs)', () => {
    const { rec } = games[2]!;
    const old = { ...rec, rules: 1 };
    const t0 = performance.now();
    for (let i = 0; i < 50; i++) rerateRecord(old);
    expect((performance.now() - t0) / 50).toBeLessThan(20);
    expect(count(rec, (m) => !!m.ms)).toBe(count(rec, (m) => m.r !== 'unrated'));
  });
});
