// The Game review screen (src/ui/components/GameReview.tsx) renders a stored review: both sides' accuracy and counts,
// the turning point, the advantage chart, the move list with its filters and steps, and a rival error flagged as a
// missed chance; and the dialog opens on the Game review tab with the Full match review beside it.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GameReviewModal, ReviewResult } from '../src/ui/components/GameReview';
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
  ],
  forced: [0, 0],
  ms: 9000,
};

describe('Game review screen', () => {
  it('shows the summary, the turning point, the chart and the move list', () => {
    const html = renderToStaticMarkup(<ReviewResult rec={rec} replay={replay} frames={null} />);
    expect(html).toContain('You lost in 9 turns');
    expect(html).toMatch(/accuracy/);
    // the rival's blunder is the turning point, and it was not punished: a missed chance
    expect(html).toContain('Turning point:');
    expect(html).toContain('the rival played Pass turn');
    expect(html).toContain('missed chance');
    expect(html).toContain('Missed chance: on your next turn you made a mistake');
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
    expect(html).toContain('Full match review');
    expect(html).toContain('Reviewing');
    expect(html).toContain('Stop');
  });
});
