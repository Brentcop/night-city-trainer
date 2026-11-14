// INFO-9: a played game exported with the coach's advice per decision (src/lib/coachedReplay.ts): the file round-trips
// as plain JSON, refuses other kinds and schemas, and the match reviewer's re-simulation (scripts/review.ts --from file,
// via practiceAgents) replays exactly the game that was played.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { advise, coachAdvises, gradeMove } from '../src/ai/coach';
import { GIG_SWING } from '../src/ai/eval';
import { buildCoachedReplay, coachedGrade, coachedReplayFileName, coachedReviewSpec, parseCoachedReplay, type CoachedGrade } from '../src/lib/coachedReplay';
import { practiceAgents } from '../src/sim/practiceReview';
import { asReplay, parseReplays, practiceSpec, type PracticeReplay } from '../src/lib/practiceReplays';
import type { Agent, Decision, DeckList } from '../src/engine/types';

const deck = (f: string): DeckList => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const decks: [DeckList, DeckList] = [deck('meta-rrb-wakako-midrange.txt'), deck('meta-bbg-cunningham-econ.txt')];

/** Seat 0 as the Play page records it: every answer kept, and at some decisions the coach asked and the move graded. */
class Recorded implements Agent {
  name = 'You';
  choices: number[][] = [];
  grades: CoachedGrade[] = [];
  private n = 0;
  constructor(private brain: Agent, private at: Set<number>) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    const k = this.n++;
    const ask = coachAdvises(d) && d.options.length > 1 && this.at.has(k) ? await advise(g, d) : null;
    const r = await this.brain.decide(g, d);
    if (ask) this.grades.push(coachedGrade(d, r[0]!, ask, gradeMove(d, r[0]!, ask, g.s.turn), this.choices.length));
    this.choices.push([...r]);
    return r;
  }
}

async function playOne() {
  const seed = 4242;
  const botSeed = 99;
  const you = new Recorded(makeTierBot('easy', 7), new Set([1, 3, 5, 8, 12, 20]));
  const g = Game.create(decks, [you, makeTierBot('easy', botSeed, 'Bot')], { seed, first: 0 });
  const st = await g.run();
  const replay: PracticeReplay = {
    id: 'ptest',
    date: '2026-11-12T10:00:00.000Z',
    decks,
    seed,
    first: 0,
    botLevel: 'easy',
    botSeed,
    choices: you.choices,
    result: st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw',
  };
  return { replay, grades: you.grades, winner: st.winner, turns: st.turn };
}

describe('coached replay export (src/lib/coachedReplay.ts)', () => {
  it('round-trips, carries the advice per decision, and replays the same game for the reviewer', async () => {
    const played = await playOne();
    expect(played.grades.length).toBeGreaterThanOrEqual(3);
    const file = buildCoachedReplay(played.replay, played.grades, '2026-11-12T11:00:00.000Z', GIG_SWING);
    expect(file.kind).toBe('nct-coached-replay');
    expect(file.schema).toBe(1);
    expect(file.decisions).toHaveLength(played.grades.length);
    for (const d of file.decisions) {
      // each record points at the answer it graded
      expect(played.replay.choices[d.at]![0]).toBe(d.chose);
      expect(d.options[d.coach]).toBeDefined();
    }
    expect(file.decisions.some((d) => d.why.length > 0)).toBe(true);
    expect(file.decisions.some((d) => d.scores.length > 1 && d.scores.every((s) => s.w?.length))).toBe(true);
    expect(coachedReplayFileName(file)).toBe('nct-game-RRB_Wakako_Midrange-vs-BBG_Cunningham_Econ-2026-11-12.json');

    const text = JSON.stringify(file, null, 1);
    const back = parseCoachedReplay(text);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.value).toEqual(file);
    expect(JSON.stringify(back.value, null, 1)).toBe(text);

    // the reviewer's re-simulation (review.ts --from file, Play's Full match review) plays the same game
    const spec = coachedReviewSpec(back.value);
    const again = await Game.create(spec.decks, practiceAgents(spec), { seed: spec.seed, first: spec.first }).run();
    expect(again.winner).toBe(played.winner);
    expect(again.turn).toBe(played.turns);
  }, 120_000);

  it('refuses other files and keeps only answers that were recorded', () => {
    expect(parseCoachedReplay('nope')).toEqual({ ok: false, why: 'not JSON' });
    expect(parseCoachedReplay(JSON.stringify({ kind: 'nct-tuned-decks', schema: 1 })).ok).toBe(false);
    const replay: PracticeReplay = { id: 'p1', date: '2026-11-12T10:00:00.000Z', decks, seed: 1, botLevel: 'easy', botSeed: 2, choices: [[0]], result: 'loss' };
    const ok = buildCoachedReplay(replay, [], 'x', GIG_SWING);
    expect(parseCoachedReplay(JSON.stringify(ok)).ok).toBe(true);
    const newer = parseCoachedReplay(JSON.stringify({ ...ok, schema: 2 }));
    expect(newer.ok === false && newer.why).toMatch(/schema 2/);
    expect(parseCoachedReplay(JSON.stringify({ ...ok, replay: { ...replay, seed: 'x' } })).ok).toBe(false);
    // a grade for an answer Undo took back (beyond the recorded choices) is left out
    const d: Decision = { player: 0, kind: 'action', prompt: 'Your turn', min: 1, max: 1, options: [{ label: 'Pass' }, { label: 'Sell X' }] };
    const advice = { index: 0, why: 'Pass.', alternatives: [] };
    const g0 = coachedGrade(d, 0, advice, gradeMove(d, 0, advice, 3), 0);
    const g1 = coachedGrade(d, 1, advice, gradeMove(d, 1, advice, 3), 1);
    expect(buildCoachedReplay(replay, [g0, g1], 'x', GIG_SWING).decisions.map((r) => r.at)).toEqual([0]);
    expect(g1.record!.verdict).toBe('pending');
  });

  it('the recorded position: kept when well formed, through storage, the export and the review spec; a malformed one makes the record incomplete', () => {
    const replay: PracticeReplay = { id: 'p1', date: '2026-11-12T10:00:00.000Z', decks, seed: 1, botLevel: 'easy', botSeed: 2, choices: [[0], [1], [0]], result: 'loss' };
    const good = [{ hash: '0123456789abcdef' }, { hash: 'fedcba9876543210', at: 0 }, { hash: 'fedcba9876543210', at: 3 }];
    for (const position of good) {
      const r = { ...replay, position };
      expect(asReplay(JSON.parse(JSON.stringify(r)))?.position).toEqual(position);
      expect(parseReplays(JSON.stringify([r]))[0]!.position).toEqual(position);
      const back = parseCoachedReplay(JSON.stringify(buildCoachedReplay(r, [], 'x', GIG_SWING)));
      expect(back.ok && back.value.replay.position).toEqual(position);
      expect(back.ok && coachedReviewSpec(back.value).position).toEqual(position);
    }
    // absent: as every older record
    expect('position' in asReplay(replay)!).toBe(false);
    expect('position' in practiceSpec(replay)).toBe(false);
    const bad: unknown[] = [
      null,
      'x',
      [],
      {},
      { hash: '0123456789ABCDEF' },
      { hash: '0123456789abcde' },
      { hash: '0123456789abcdef0' },
      { hash: 12 },
      { hash: '0123456789abcdef', at: -1 },
      { hash: '0123456789abcdef', at: 4 }, // more answers than recorded
      { hash: '0123456789abcdef', at: 1.5 },
      { hash: '0123456789abcdef', at: '1' },
    ];
    for (const position of bad) {
      const r = { ...replay, position };
      expect(asReplay(r), JSON.stringify(position)).toBeNull();
      expect(parseReplays(JSON.stringify([r]))).toEqual([]);
      expect(parseCoachedReplay(JSON.stringify({ ...buildCoachedReplay(replay, [], 'x', GIG_SWING), replay: r })).ok).toBe(false);
    }
  });
});
