import { describe, expect, it } from 'vitest';
import { summarize } from '../src/analysis/summarize';
import type { GameState, PlayerId, TraceEvent } from '../src/engine/types';

// Only the fields summarize() reads. Trace order mirrors the engine: both opening hands as 'open' at creation, then
// (first player first) 'mulligan' followed by the new hand as 'open', then turns with 'draw'/'play'/'turnEnd'.
const state = (trace: TraceEvent[]) =>
  ({
    players: [{ name: 'A' }, { name: 'B' }],
    first: 0,
    winner: 0,
    turn: 2,
    overtime: false,
    winReason: 'test',
    trace,
  }) as unknown as GameState;

const ev = (t: number, p: PlayerId, k: TraceEvent['k'], id?: string, x?: string | number): TraceEvent => ({ t, p, k, id, x });
const open = (p: PlayerId, ids: string[]) => ids.map((id) => ev(0, p, 'open', id));

describe('summarize', () => {
  it('counts the opening hand and later draws as seen when nobody mulligans', () => {
    const [a, b] = summarize(
      state([
        ...open(0, ['a1', 'a2', 'a3']),
        ...open(1, ['b1', 'b2', 'b3']),
        ev(1, 0, 'play', 'a1', 'hand'),
        ev(1, 0, 'turnEnd', undefined, '0-0'),
        ev(2, 1, 'draw', 'b4'),
        ev(2, 1, 'turnEnd', undefined, '0-1'),
      ]),
    );
    expect(a.mulligan).toBe(false);
    expect(a.opening).toEqual(['a1', 'a2', 'a3']);
    expect(a.seen.sort()).toEqual(['a1', 'a2', 'a3']);
    expect(b.seen.sort()).toEqual(['b1', 'b2', 'b3', 'b4']);
    expect(a.result).toBe(1);
    expect(b.diffAfterOwnTurn).toEqual([1]);
  });

  it('drops a mulliganed-away hand from seen but keeps the new hand and later draws', () => {
    const [a, b] = summarize(
      state([
        ...open(0, ['a1', 'a2', 'a3']),
        ...open(1, ['b1', 'b2', 'b3']),
        ev(0, 0, 'mulligan'),
        ...open(0, ['a4', 'a2', 'a5']), // a2 came back after the shuffle: still seen
        ev(1, 0, 'play', 'a4', 'hand'),
        ev(1, 0, 'turnEnd', undefined, '0-0'),
        ev(2, 1, 'draw', 'b4'),
        ev(2, 1, 'turnEnd', undefined, '0-0'),
        ev(3, 0, 'draw', 'a1'), // drawn again later: seen again
      ]),
    );
    expect(a.mulligan).toBe(true);
    expect(a.opening).toEqual(['a4', 'a2', 'a5']);
    expect(a.seen.sort()).toEqual(['a1', 'a2', 'a4', 'a5']);
    expect(a.seen).not.toContain('a3');
    // the other player's hand is untouched by A's mulligan
    expect(b.mulligan).toBe(false);
    expect(b.seen.sort()).toEqual(['b1', 'b2', 'b3', 'b4']);
  });

  it('counts a Legend played to the field by paying its cost as a play, and Go Solo separately', () => {
    const [a, b] = summarize(
      state([
        ...open(0, ['a1']),
        ...open(1, ['b1']),
        ev(1, 0, 'play', 'a1', 'hand'),
        ev(1, 0, 'turnEnd', undefined, '0-0'),
        ev(2, 1, 'solo', 'legB'),
        ev(2, 1, 'turnEnd', undefined, '0-0'),
        ev(3, 0, 'legend', 'legA'), // A's 2nd own turn
        ev(3, 0, 'turnEnd', undefined, '0-0'),
        ev(5, 0, 'legend', 'legA'), // played again after leaving the field: counted, first turn kept
      ]),
    );
    expect(a.played).toEqual({ a1: 1, legA: 2 });
    expect(a.playCount).toEqual({ a1: 1, legA: 2 });
    expect(a.legendPlays).toEqual(['legA', 'legA']);
    expect(a.seen).not.toContain('legA'); // a Legend is never drawn
    expect(a.solos).toEqual([]);
    expect(b.solos).toEqual(['legB']);
    expect(b.played).toEqual({});
    expect(b.legendPlays).toEqual([]);
  });
});
