// Competitive facts by code (src/lib/eventFacts.ts; docs/RAG_PLAN.md rule M3, step 2.1). On every recorded event: the
// standings rebuilt after the last Swiss round equal the stored standings, the champion is the stored champion, and round
// summaries count the stored matches and games. On the ratings and head-to-head files: the deck and matchup facts equal
// the files' own fields. On invented fixtures: a bye, a best-of-three decided in game three, and a custom event that
// must not count for titles or finishes.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  deckCompetitive,
  eventSummary,
  matchupFact,
  rangesOverlap,
  ratingsTable,
  roundKey,
  roundSummary,
  standingsAfter,
  type EventIndex,
  type H2HInput,
  type RatingsInput,
  type RecordedEvent,
} from '../src/lib/eventFacts';
import { simTier } from '../src/lib/simTier';
import type { GameRec, MatchRec } from '../src/lib/tournament';

const ROOT = path.resolve(__dirname, '..');
const json = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) as T;
const EVENT_FILES = fs
  .readdirSync(path.join(ROOT, 'public/tournaments'))
  .filter((f) => /^event-.+\.json$/.test(f))
  .sort();
const EVENTS = EVENT_FILES.map((f) => json<RecordedEvent>(`public/tournaments/${f}`));
const INDEX = json<EventIndex>('src/data/tournaments.json');
const RATINGS = json<RatingsInput>('src/data/ratings.json');
const H2H = json<H2HInput>('public/data/h2h.json');

const RANKING_FIELDS = ['deck', 'mp', 'mw', 'ml', 'gw', 'gl', 'opps', 'omw', 'gwp'] as const;
const TALLY_FIELDS = ['games', 'turns', 'playW', 'playG', 'drawW', 'drawG'] as const;

describe('every recorded event', () => {
  it('has events to check', () => {
    expect(EVENTS.length).toBeGreaterThanOrEqual(7);
  });

  for (const ev of EVENTS) {
    describe(`event ${ev.id}`, () => {
      const last = standingsAfter(ev);

      it('standings after the last Swiss round equal the stored standings', () => {
        expect(last.round).toBe(ev.rounds.length);
        expect(last.rows).toHaveLength(ev.standings.length);
        last.rows.forEach((r, i) => {
          const s = ev.standings[i]!;
          for (const k of RANKING_FIELDS) expect(r[k], `${ev.id} place ${i + 1} ${k}`).toEqual(s[k]);
        });
      });

      it('the stored rows also tally the top-cut games: rebuilt Swiss tallies plus the bracket games give them', () => {
        const extra = new Map<string, Record<(typeof TALLY_FIELDS)[number], number>>();
        for (const b of ev.bracket)
          for (const m of b.matches) {
            if (!m.b) continue;
            for (const g of m.games)
              for (const [deck, seat] of [[m.a, 0], [m.b, 1]] as const) {
                const t = extra.get(deck) ?? { games: 0, turns: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 };
                t.games++;
                t.turns += g.turns;
                if (g.first === seat) (t.playG++, g.winner === seat && t.playW++);
                else (t.drawG++, g.winner === seat && t.drawW++);
                extra.set(deck, t);
              }
          }
        last.rows.forEach((r, i) => {
          const s = ev.standings[i]!;
          for (const k of TALLY_FIELDS) expect(r[k] + (extra.get(r.deck)?.[k] ?? 0), `${ev.id} ${r.deck} ${k}`).toBe(s[k]);
        });
      });

      it('the champion, entrants, games and format match the event and the index', () => {
        const s = eventSummary(ev);
        const ix = INDEX.events.find((e) => e.id === ev.id)!;
        expect(s.champion).toBe(ev.champion);
        expect(s.champion).toBe(ix.champion);
        expect(s.final?.winner).toBe(ev.champion);
        expect(s.finalists[0]).toBe(ev.champion);
        expect(s.entrants).toBe(ix.entrants);
        expect(s.games.total).toBe(ix.games);
        expect(s.format.label).toBe(ix.format);
        expect(s.format.topCut).toBe(ix.top8.length);
        expect([s.simVersion, s.bot, s.asOf]).toEqual([ev.simVersion, ev.bot, ev.date]);
        expect(s.firstPlayer.decided + s.firstPlayer.ties).toBe(s.games.total);
        expect(s.endReasons.reduce((a, r) => a + r.games, 0)).toBe(s.games.total);
      });

      it('round summaries count the stored matches and games', () => {
        const rounds = [...ev.rounds.map((r) => roundSummary(ev, r.round)), ...ev.bracket.map((b) => roundSummary(ev, b.name))];
        const stored = [...ev.rounds, ...ev.bracket].flatMap((r) => r.matches);
        expect(rounds.reduce((a, r) => a + r.played + r.byes, 0)).toBe(stored.length);
        expect(rounds.reduce((a, r) => a + r.games, 0)).toBe(eventSummary(ev).games.total);
        for (const r of rounds) {
          expect(r.sweeps + r.deciders).toBeLessThanOrEqual(r.played);
          expect(r.turns.games).toBe(r.games);
        }
        // the leaders after the last Swiss round are the top of the stored standings
        const lastRound = rounds[ev.rounds.length - 1]!;
        expect(lastRound.leaders[0]?.deck).toBe(ev.standings[0]?.deck);
        expect(roundSummary(ev, ev.bracket.at(-1)!.name).advancing).toEqual([ev.champion]);
      });

      it('refuses rounds the event did not play', () => {
        expect(() => standingsAfter(ev, 0)).toThrow(RangeError);
        expect(() => standingsAfter(ev, ev.rounds.length + 1)).toThrow(RangeError);
        expect(() => roundSummary(ev, 'Round of 64')).toThrow(RangeError);
      });
    });
  }
});

describe('deck and matchup facts equal the files they read', () => {
  it('every ratings row: rating, range, games, Swiss record, titles and both "top 8" counts under their own names', () => {
    expect(RATINGS.decks.length).toBeGreaterThan(0);
    RATINGS.decks.forEach((row, i) => {
      const d = deckCompetitive(row.name, { ratings: RATINGS, index: INDEX, h2h: H2H });
      expect(d.rating).toMatchObject({ value: row.rating, position: i + 1, of: RATINGS.decks.length, ratedGames: row.games, wrField: row.wrField, lo: row.wrFieldLo, hi: row.wrFieldHi, wrMeta: row.wrMeta });
      expect(d.swiss?.matchRecord).toBe(row.matches);
      expect(d.swiss?.gameRecord).toBe(row.gamesRecord);
      expect(d.events).toBe(row.events);
      expect(d.titles, row.name).toBe(row.titles);
      expect(d.swissTopEight).toBe(row.top8);
      expect(d.topCutAppearances).toBeLessThanOrEqual(d.swissTopEight);
      expect(d.tier).toEqual(simTier(row));
      expect(d.finishes.length).toBe(row.events);
      expect(d.file).toBe(row.file);
      expect(d).not.toHaveProperty('top8');
    });
  });

  it('the ratings table: the file\'s own order and fields, the tier now, and which ranges overlap', () => {
    const all = ratingsTable(RATINGS);
    expect(all.of).toBe(RATINGS.decks.length);
    expect(all.rows.map((r) => [r.position, r.deck, r.file, r.rating, r.wrField, r.lo, r.hi, r.ratedGames])).toEqual(RATINGS.decks.map((d, i) => [i + 1, d.name, d.file, d.rating, d.wrField, d.wrFieldLo, d.wrFieldHi, d.games]));
    all.rows.forEach((r, i) => expect(r.tier).toEqual(simTier(RATINGS.decks[i])));
    expect([all.simVersion, all.bot, all.asOf, all.events]).toEqual([RATINGS.manifest?.simVersion, RATINGS.manifest?.bot?.level, RATINGS.manifest?.createdAt, RATINGS.events]);
    const top = ratingsTable(RATINGS, { top: 10 });
    expect(top.rows).toEqual(all.rows.slice(0, 10));
    const [first, ...rest] = RATINGS.decks.slice(0, 10);
    expect(top.overlapFirst).toEqual(rest.flatMap((d, i) => (d.wrFieldLo <= first!.wrFieldHi && first!.wrFieldLo <= d.wrFieldHi ? [i + 2] : [])));
    expect(ratingsTable(RATINGS, { top: 0 }).rows).toEqual([]);
  });

  it('every head-to-head pair: raw record, games and the shrunk estimate, from both sides', () => {
    H2H.pairs.forEach(([i, j, w, g], q) => {
      const a = H2H.decks[i]!;
      const b = H2H.decks[j]!;
      const ab = matchupFact(a, b, H2H);
      const ba = matchupFact(b, a, H2H);
      expect([ab.games, ab.winsA, ab.estimate]).toEqual([g, w, H2H.shrunk![q]]);
      expect([ba.games, ba.winsA]).toEqual([g, g - w]);
      expect(ba.estimate).toBeCloseTo(1 - H2H.shrunk![q]!, 12);
      expect(ab.known).toBe(true);
    });
    expect(matchupFact('No such deck', H2H.decks[0]!, H2H)).toMatchObject({ known: false, games: 0 });
  });
});

// ---------------------------------------------------------------- invented fixtures

const game = (first: 0 | 1, winner: 0 | 1 | 'tie', turns = 10, reason = 'invented end'): GameRec => ({ seed: 0, first, winner, turns, reason });
const match = (a: string, b: string | null, games: GameRec[]): MatchRec => {
  const score: [number, number] = [games.filter((g) => g.winner === 0).length, games.filter((g) => g.winner === 1).length];
  return { a, b, games, score: b ? score : [2, 0], winner: b ? (score[0] > score[1] ? a : b) : a };
};

function fixture(o: { custom?: boolean; id?: number; champion?: string } = {}): RecordedEvent {
  return {
    id: o.id ?? 101,
    name: `Fixture ${o.id ?? 101}`,
    date: '2030-01-02T03:04:05.000Z',
    bot: 'fixture-bot',
    format: 'Swiss 2 rounds (Bo3)',
    config: { rounds: 2, top: 0, bestOf: 3 },
    decks: { Alpha: { file: 'alpha.txt' }, Bravo: {}, Charlie: {} },
    rounds: [
      // Alpha beats Bravo in three games; Charlie has the bye
      { round: 1, matches: [match('Alpha', 'Bravo', [game(0, 0, 12, 'gigs'), game(1, 1, 9, 'overtime'), game(1, 0, 14, 'gigs')]), match('Charlie', null, [])] },
      // Alpha sweeps Charlie; Bravo has the bye
      { round: 2, matches: [match('Alpha', 'Charlie', [game(1, 0), game(0, 0)]), match('Bravo', null, [])] },
    ],
    bracket: [],
    standings: [],
    champion: o.champion ?? 'Alpha',
    simVersion: 8,
    ...(o.custom ? { custom: true } : {}),
  };
}

describe('fixtures', () => {
  const ev = fixture();

  it('a bye is a match win with no games; the standings rank by match points, then opponents, then games', () => {
    const r1 = standingsAfter(ev, 1).rows;
    expect(r1.map((r) => [r.deck, r.mp, r.matchRecord, r.gameRecord, r.games])).toEqual([
      ['Alpha', 3, '1-0', '2-1', 3],
      ['Charlie', 3, '1-0', '0-0', 0],
      ['Bravo', 0, '0-1', '1-2', 3],
    ]);
    expect(r1[1]!.opps).toEqual(['BYE']);
    // Alpha's only opponent won no match: the floor of a third; Charlie's bye leaves no opponent: 0
    expect(r1[0]!.omw).toBeCloseTo(1 / 3);
    expect(r1[1]!.omw).toBe(0);
    const r2 = standingsAfter(ev).rows;
    expect(r2.map((r) => [r.deck, r.mp, r.matchRecord])).toEqual([
      ['Alpha', 6, '2-0'],
      ['Bravo', 3, '1-1'],
      ['Charlie', 3, '1-1'],
    ]);
    // seats: Alpha went first in games 1 and 5 of its matches (won both) and second in games 2, 3 and 4
    expect(r2[0]).toMatchObject({ playW: 2, playG: 2, drawW: 2, drawG: 3, turns: 55 });
  });

  it('a best-of-three decided in game three is a decider, not a sweep; a 2-0 is a sweep', () => {
    const r1 = roundSummary(ev, 1);
    expect(r1).toMatchObject({ stage: 'swiss', played: 1, byes: 1, games: 3, sweeps: 0, deciders: 1, bestOf: 3, atTop: 2 });
    expect(r1.firstPlayer).toEqual({ won: 2, decided: 3, ties: 0 });
    expect(r1.endReasons).toEqual([
      { reason: 'gigs', games: 2 },
      { reason: 'overtime', games: 1 },
    ]);
    expect(r1.turns.mean).toBeCloseTo(35 / 3);
    expect(r1.leaders.map((l) => `${l.deck} ${l.matchRecord}`)).toEqual(['Alpha 1-0', 'Charlie 1-0']);
    expect(roundSummary(ev, '2')).toMatchObject({ sweeps: 1, deciders: 0, atTop: 1 });
    const s = eventSummary(ev);
    expect(s).toMatchObject({ entrants: 3, champion: 'Alpha', finalists: [], final: null, games: { total: 5, rounds: 5, topCut: 0 }, matches: { played: 2, byes: 2 } });
  });

  it('a bracket round is found by its name or key, and a tie is not a first-player win', () => {
    const withCut: RecordedEvent = { ...ev, bracket: [{ name: 'Round of 16', matches: [match('Alpha', 'Bravo', [game(0, 'tie'), game(1, 1), game(0, 0), game(1, 1)])] }] };
    expect(roundKey('Round of 16')).toBe('round-of-16');
    const r = roundSummary(withCut, 'round-of-16');
    expect(r).toMatchObject({ stage: 'bracket', name: 'Round of 16', key: 'round-of-16', games: 4, sweeps: 0, deciders: 0, advancing: ['Bravo'] });
    expect(r.firstPlayer).toEqual({ won: 3, decided: 3, ties: 1 });
    expect(r.leaders).toEqual([]);
  });

  it('the ratings table says which shown ranges overlap the first and which neighbours separate', () => {
    const row = (name: string, lo: number, hi: number, games = 100) => ({ name, file: `${name}.txt`, rating: 0, games, wrField: (lo + hi) / 2, wrFieldLo: lo, wrFieldHi: hi, wrMeta: null, events: 1, titles: 0, top8: 0, avgFinish: null, matches: '0-0' });
    const ratings: RatingsInput = { events: 3, decks: [row('A', 0.6, 0.8), row('B', 0.55, 0.65), row('C', 0.4, 0.54), row('D', 0.45, 0.6), row('E', 0.1, 0.2)], manifest: { simVersion: 8, bot: { level: 'fixture-bot' }, createdAt: '2030-01-01T00:00:00.000Z' } };
    const t = ratingsTable(ratings);
    expect(t.overlapFirst).toEqual([2, 4]);
    expect(t.separated).toEqual([
      [2, 3],
      [4, 5],
    ]);
    expect(ratingsTable(ratings, { top: 2 })).toMatchObject({ of: 5, overlapFirst: [2], separated: [] });
    expect(rangesOverlap({ lo: 0.1, hi: 0.2 }, { lo: 0.2, hi: 0.3 })).toBe(true);
    expect(rangesOverlap({ lo: 0.1, hi: 0.2 }, { lo: 0.21, hi: 0.3 })).toBe(false);
  });

  it('a custom event counts for neither titles nor finishes', () => {
    const index: EventIndex = {
      events: [
        { id: 1, date: '2030-01-01T00:00:00.000Z', champion: 'Alpha', simVersion: 8, bot: 'fixture-bot', top8: [{ deck: 'Alpha' }, { deck: 'Bravo' }], standings: [{ deck: 'Alpha', record: '2-0', games: '4-1' }, { deck: 'Bravo', record: '1-1', games: '2-2' }, { deck: 'Charlie', record: '0-2', games: '0-4' }] },
        { id: 2, date: '2030-01-02T00:00:00.000Z', champion: 'Alpha', simVersion: 8, bot: 'fixture-bot', custom: true, top8: [{ deck: 'Alpha' }], standings: [{ deck: 'Alpha', record: '2-0', games: '4-0' }] },
        // another sim version: listed as a finish, but outside the ratings' pool for titles and top cuts
        { id: 3, date: '2030-01-03T00:00:00.000Z', champion: 'Alpha', simVersion: 7, bot: 'fixture-bot', top8: [{ deck: 'Alpha' }], standings: [{ deck: 'Alpha', record: '1-0', games: '2-0' }] },
      ],
    };
    const ratings: RatingsInput = {
      events: 2,
      decks: [{ name: 'Alpha', file: 'alpha.txt', rating: 0.5, se: 0.2, games: 12, wrField: 0.6, wrFieldLo: 0.5, wrFieldHi: 0.7, wrMeta: null, events: 1, titles: 1, top8: 1, avgFinish: 1, matches: '2-0', gamesRecord: '4-1' }],
      manifest: { simVersion: 8, bot: { level: 'fixture-bot' }, createdAt: '2030-01-02T00:00:00.000Z' },
    };
    const d = deckCompetitive('Alpha', { ratings, index });
    expect(d.titles).toBe(1);
    expect(d.topCutAppearances).toBe(1);
    expect(d.finishes.map((f) => [f.event, f.champion, f.madeTopCut, f.simVersion])).toEqual([
      [3, true, true, 7],
      [1, true, true, 8],
    ]);
    expect(d.tier.letter).toBeNull(); // 12 games: too few to rate
    expect(d.tierText).toContain('too few games');
    expect([d.simVersion, d.bot, d.asOf]).toEqual([8, 'fixture-bot', '2030-01-02T00:00:00.000Z']);
    const bravo = deckCompetitive('Bravo', { ratings, index });
    expect(bravo).toMatchObject({ rating: null, swiss: null, titles: 0, topCutAppearances: 1, swissTopEight: 0 });
    // the custom event itself still summarises, flagged
    expect(eventSummary(fixture({ custom: true })).custom).toBe(true);
  });
});
