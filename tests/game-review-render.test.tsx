// The Game review screen (src/ui/components/GameReview.tsx) renders a stored review: both sides' accuracy and counts,
// the turning point (the losing side's costliest move), the advantage chart, the move list with its filters and steps,
// and a rival error flagged as a missed chance; no figure past the 3-Gig cap and the board's names ("End turn"); the
// guest's seat reviewed as "you"; a game that can't be replayed refused in a plain sentence; and the dialog opens on
// the Game review tab with the Play-out details beside it.
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
    expect(missed).toContain('more than 3 Gigs behind');
  });

  it('the guest of an online game is "you" (seat 1)', () => {
    const guest: GameReviewRecord = { ...rec, me: 1, names: ['Host deck', 'Guest deck'], winner: 1 };
    const html = renderToStaticMarkup(<ReviewResult rec={guest} replay={{ ...replay, pvp: { rival: 'Host', seat: 1, rivalChoices: [] } }} frames={null} />);
    expect(html).toContain('You won in 9 turns');
    expect(html).toContain('Guest deck vs Host deck');
    // seat 0 lost: its costliest move is the turning point, and it is the rival's
    expect(html).toContain('the rival played Play Big Unit');
  });

  it('a game recorded with another simulator version is refused in a plain sentence, not a stack trace', () => {
    const html = renderToStaticMarkup(<GameReviewView src={{ replay: { ...replay, simVersion: 3 }, coach: [], persist: false }} />);
    expect(html).toContain('This game can&#x27;t be reviewed: it was recorded with version 3 of the bots and rules engine');
    expect(html).not.toContain('Reviewing');
    expect(html).not.toMatch(/Error|at \w+ \(/);
  });
});
