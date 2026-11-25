// The Game review screen (src/ui/components/GameReview.tsx) renders a stored review: both sides' accuracy and counts,
// the turning point (the losing side's costliest move), the advantage chart, the move list with its filters and steps,
// and a rival error flagged as a missed chance; no figure past the 3-Gig cap and the board's names ("End turn"); the
// guest's seat reviewed as "you"; a game that can't be replayed refused in a plain sentence; and the dialog opens on
// the Game review tab with the Play-out details beside it.
import { costTag } from '../src/lib/ratingCost';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameReviewModal, GameReviewView, ReviewResult } from '../src/ui/components/GameReview';
import type { GameReviewRecord, ReviewMove } from '../src/lib/gameReview';
import type { PracticeReplay } from '../src/lib/practiceReplays';

const deck = (name: string) => ({ name, legends: [], main: [], sideboard: [] });
const replay: PracticeReplay = { id: 'r1', date: '2026-11-12T10:00:00Z', decks: [deck('Mine'), deck('Theirs')], seed: 1, botLevel: 'hard', botSeed: 2, choices: [[0]], result: 'loss' };
const mv = (o: Partial<ReviewMove> & Pick<ReviewMove, 'seq' | 'p' | 'r'>): ReviewMove => ({ at: o.seq, turn: 1, cat: 'unit', chosen: `Move ${o.seq}`, best: 'Better move', gap: 0, src: 'oracle', ...o });
const rec: GameReviewRecord = {
  kind: 'nct-game-review',
  schema: 1,
  id: 'r1',
  made: '2026-11-12T10:05:00Z',
  rollouts: 8,
  oracleSeed: 1,
  names: ['Mine', 'Theirs'],
  winner: 1,
  reason: 'controls 7+ Gigs at start of turn',
  turns: 9,
  first: 0,
  me: 0,
  timeline: [
    [1, 0],
    [2, 20],
    [3, -40],
    [4, -90],
  ],
  moves: [
    mv({ seq: 0, p: 0, r: 'best', turn: 1, chosen: 'Sell Card A', best: 'Sell Card A', src: 'coach', why: 'Least valuable card.' }),
    mv({ seq: 1, p: 1, r: 'blunder', turn: 2, chosen: 'Pass turn', gap: 1.2, se: 0.2 }),
    mv({ seq: 2, p: 0, r: 'mistake', turn: 3, chosen: 'Play Big Unit', gap: 0.6, se: 0.1 }),
    mv({ seq: 3, p: 1, r: 'slip', turn: 4, chosen: 'Hidden rival slip', gap: 0.2, se: 0.05 }),
    mv({ seq: 4, p: 0, r: 'unclear', turn: 5, chosen: 'Attack with X' }),
    mv({ seq: 5, p: 1, r: 'blunder', turn: 6, chosen: 'Huge rival error', gap: 3, raw: 14.2, se: 1.1 }),
  ],
  forced: [0, 0],
  ms: 9000,
};

describe('Game review screen', () => {
  it('shows the summary, the turning point, the chart and the move list', () => {
    const html = renderToStaticMarkup(<ReviewResult rec={rec} replay={replay} frames={null} />);
    expect(html).toContain('You lost in 9 turns');
    expect(html).toMatch(/accuracy/);
    // you lost: the turning point is your costliest move, not the rival's blunder (REV-5)
    expect(html).toContain('<b>Turning point:</b> turn 3, you played Play Big Unit');
    // the rival's blunder was not punished: a missed chance
    expect(html).toContain('missed chance');
    // the board's name for passing
    expect(html).toContain('End turn');
    expect(html).not.toContain('Pass turn');
    // what the ratings rest on, where a learner reads it
    expect(html).toContain('the cards you couldn&#x27;t see re-dealt');
    // never a figure past the cap (the rival's capped blunder had a raw gap of 14.2)
    expect(html).not.toMatch(/14\.2|\b([4-9]|\d{2,})\.\d+ Gigs/);
    expect(html).toContain('(1 graded by the coach during play, the rest by the review&#x27;s play-outs)');
    // rating words with their marks (never colour alone)
    for (const w of ['Blunder', 'Mistake', 'Best', 'No clear difference']) expect(html).toContain(w);
    expect(html).toContain('▼▼');
    // a rival slip is not shown; your moves are
    expect(html).not.toContain('Hidden rival slip');
    expect(html).toContain('Play Big Unit');
    // filters, steps, the chart
    for (const w of ['All moves', 'Only my mistakes', 'Key moments', 'Previous', 'Next']) expect(html).toContain(w);
    expect(html).toContain('role="img"');
    expect(html).toContain('The board is not available for this review.');
  });

  // 2026-11-25 (docs/REVIEW_2026-11-25.md R3, R8): both seats rated by the same play-outs, the coach's grade from play
  // beside your move for reference, and the mulligan listed by its board name, not rated
  it('a current review: the same instrument for both seats, the coach’s grade beside yours, the mulligan not rated', () => {
    const now: GameReviewRecord = {
      ...rec,
      moves: [
        mv({ seq: 0, p: 0, r: 'unrated', cat: 'mulligan', chosen: 'Keep hand', gap: null, best: undefined }),
        mv({ seq: 1, p: 1, r: 'best', turn: 2, chosen: 'Rival move' }),
        mv({ seq: 2, p: 0, r: 'mistake', turn: 3, chosen: 'Play Big Unit', gap: 0.6, se: 0.1, said: { v: 'best', gap: 0.05, best: 'Better move', why: 'Looked fine.' } }),
        mv({ seq: 3, p: 0, r: 'best', turn: 5, chosen: 'Attack with X', said: { v: 'agree', gap: 0, why: 'Strong.' } }),
      ],
    };
    const html = renderToStaticMarkup(<ReviewResult rec={now} replay={replay} frames={null} />);
    expect(html).toContain('<b>Turning point:</b> turn 3, you played Play Big Unit');
    expect(html).toContain('rated by the review&#x27;s play-outs, as the rival&#x27;s; 2 also graded by the coach during play, shown beside it');
    expect(html).toContain('During play the coach said Best: as good as Better move. Coach: Looked fine.');
    expect(html).toContain('Keep hand');
    expect(html).toContain('Not rated');
    expect(html).not.toContain('keep the coach&#x27;s grade');
    // the counted moves leave the mulligan out
    expect(html).toContain('2 counted moves');
  });

  it('opens on the Game review tab, with the Full match review as the second tab', () => {
    const html = renderToStaticMarkup(<GameReviewModal src={{ replay, coach: [], persist: false, turns: 9 }} title="Game review" onClose={() => undefined} />);
    expect(html).toContain('role="dialog"');
    expect(html).toMatch(/role="tab"[^>]*aria-selected="true"[^>]*>Game review/);
    expect(html).toContain('Play-out details');
    expect(html).not.toContain('Full match review');
    expect(html).toContain('Reviewing');
    expect(html).toContain('Stop');
  });

  it('the missed chance and the follow-up say what happened, not why', () => {
    // you won, and the rival's turn-2 blunder is the turning point (shown first); your turn 3 had a Mistake
    const early = rec.moves.filter((m) => m.seq !== 5);
    const missedHtml = renderToStaticMarkup(<ReviewResult rec={{ ...rec, winner: 0, moves: early }} replay={replay} frames={null} />);
    expect(missedHtml).toContain('<b>Turning point:</b> turn 2, the rival played End turn');
    expect(missedHtml).toContain('Missed chance: your next turn had a Mistake or Blunder.');
    const clean = early.map((m) => (m.seq === 2 ? { ...m, r: 'best' as const, gap: 0 } : m));
    const html = renderToStaticMarkup(<ReviewResult rec={{ ...rec, winner: 0, moves: clean }} replay={replay} frames={null} />);
    expect(html).toContain('Followed up: no costly move on your next turn');
    const missed = renderToStaticMarkup(<ReviewResult rec={{ ...rec, winner: 0 }} replay={replay} frames={null} />);
    // you won: the rival's costliest move is the turning point (the capped blunder with the larger raw gap)
    expect(missed).toContain('<b>Turning point:</b> turn 6, the rival played Huge rival error');
    // the turning point says what its band costs in win chance (row 6), not its gap in Gigs
    expect(missed).toContain(costTag('review', 'blunder'));
    expect(missed).not.toContain('Gigs behind');
  });

  it('the guest of an online game is "you" (seat 1)', () => {
    const guest: GameReviewRecord = { ...rec, me: 1, names: ['Host deck', 'Guest deck'], winner: 1 };
    const html = renderToStaticMarkup(<ReviewResult rec={guest} replay={{ ...replay, pvp: { rival: 'Host', seat: 1, rivalChoices: [] } }} frames={null} />);
    expect(html).toContain('You won in 9 turns');
    expect(html).toContain('Guest deck vs Host deck');
    // seat 0 lost: its costliest move is the turning point, and it is the rival's
    expect(html).toContain('the rival played Play Big Unit');
  });

  it('a move the review could not measure is listed apart with its error, not counted', () => {
    const plain = renderToStaticMarkup(<ReviewResult rec={rec} replay={replay} frames={null} />);
    expect(plain).not.toContain('could not be measured');
    const failed = [{ seq: 99, p: 0 as const, at: 9, turn: 4, cat: 'gig dice', chosen: 'Rival d6: 4 → 3', why: 'clone() with 1 pending effect(s)' }];
    const html = renderToStaticMarkup(<ReviewResult rec={{ ...rec, failed }} replay={replay} frames={null} />);
    expect(html).toContain('1 move could not be measured');
    expect(html).toContain('Turn 4, you: Rival d6: 4 → 3. Error: clone() with 1 pending effect(s)');
    // the summary is the same as without it: the move is not counted
    const seats = (h: string) => [...h.matchAll(/aria-label="(You|Rival): [^"]*"|\d+ counted moves?[^<]*/g)].map((m) => m[0]);
    expect(seats(plain).length).toBeGreaterThanOrEqual(4);
    expect(seats(html)).toEqual(seats(plain));
  });

  it('a game recorded with another simulator version is refused in a plain sentence, not a stack trace', () => {
    const html = renderToStaticMarkup(<GameReviewView src={{ replay: { ...replay, simVersion: 3 }, coach: [], persist: false }} />);
    expect(html).toContain('This game can&#x27;t be reviewed: it was recorded with version 3 of the bots and rules engine');
    expect(html).not.toContain('Reviewing');
    expect(html).not.toMatch(/Error|at \w+ \(/);
  });
});
