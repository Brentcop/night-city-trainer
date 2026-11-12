// The Events page (#/tournaments) with custom events recorded (another format, or pairings set by hand): marked
// "custom", no title counted, the right table for the format, a bracket only when there is one. Deck finishes skip
// custom events. The recorded index is replaced by a small fixture here.
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { eventFinishes, type EventLite } from '../src/lib/deckRecord';

const row = (deck: string, mp: number) => ({ deck, mp, record: `${mp / 3}-0`, games: '2-0', omw: 0.5 });
vi.mock('../src/data/tournaments.json', () => ({
  default: {
    updated: '',
    events: [
      {
        id: 1,
        date: '2026-11-12T00:00:00Z',
        simVersion: 5,
        bot: 'hard',
        format: 'Swiss 3 rounds (Bo3) + top 4',
        champion: 'Alpha',
        entrants: 4,
        games: 10,
        top8: [{ deck: 'Alpha', mp: 9, record: '3-0', omw: 0.5 }],
        bracket: [{ name: 'Final', matches: [{ a: 'Alpha', b: 'Bravo', score: [2, 0], winner: 'Alpha' }] }],
        standings: [row('Alpha', 9), row('Bravo', 6)],
      },
      {
        id: 2,
        date: '2026-11-12T01:00:00Z',
        simVersion: 5,
        bot: 'hard',
        format: 'Round robin (Bo1)',
        custom: true,
        kind: 'round-robin',
        champion: 'Alpha',
        entrants: 3,
        games: 3,
        top8: [],
        bracket: [],
        standings: [row('Alpha', 6), row('Bravo', 3), row('Charlie', 0)],
      },
      {
        id: 3,
        date: '2026-11-12T02:00:00Z',
        simVersion: 5,
        bot: 'hard',
        format: 'Match list: 2 matches',
        custom: true,
        kind: 'matches',
        champion: null,
        entrants: 2,
        games: 4,
        top8: [],
        bracket: [],
        standings: [row('Bravo', 6), row('Alpha', 0)],
      },
    ],
  },
}));

describe('Events page with custom events', async () => {
  const { TournamentsPage } = await import('../src/ui/pages/Tournaments');
  it('marks custom events and says how they count', () => {
    const html = renderToStaticMarkup(<TournamentsPage initial="2" />);
    expect(html).toContain('2 events are marked <b>custom</b>');
    expect(html.split('>custom</span>').length - 1).toBeGreaterThanOrEqual(3); // two chips and the header
    expect(html).toContain('custom event: not counted as a title');
    expect(html).toContain('Final table'); // a round-robin table, not Swiss standings
    expect(html).not.toContain('Swiss standings');
    expect(html).not.toContain('class="bracket"'); // no bracket in a plain round robin
  });
  it('a match list has a results table and no champion', () => {
    const html = renderToStaticMarkup(<TournamentsPage initial="3" />);
    expect(html).toContain('>Results<');
    expect(html).not.toContain('CHAMPION');
    expect(html).toContain('no champion');
  });
  it('a standard event counts titles from standard events only', () => {
    const html = renderToStaticMarkup(<TournamentsPage initial="1" />);
    expect(html).toContain('1 title across standard events');
    expect(html).toContain('Swiss standings');
    expect(html).toContain('class="bracket"');
  });
});

describe('deck finishes', () => {
  it('skip custom events', () => {
    const ev = (id: number, custom?: boolean): EventLite => ({ id, date: '', champion: 'Alpha', ...(custom ? { custom } : {}), top8: [{ deck: 'Alpha' }], standings: [{ deck: 'Alpha', record: '3-0', games: '6-0' }] });
    expect(eventFinishes('Alpha', [ev(1), ev(2, true), ev(3)]).map((f) => f.id)).toEqual([3, 1]);
  });
});
