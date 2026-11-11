// Pure helpers behind a deck's recorded results (src/lib/deckRecord.ts) and its list as structure (src/lib/deckCards.ts).
import { describe, expect, it } from 'vitest';
import { SIM_VERSION } from '../src/lib/tournament';
import {
  CURRENT_SIM_VERSION,
  deckRecord,
  eventFinishes,
  extremes,
  h2hFor,
  isHistorical,
  ordinal,
  parseWL,
  ratingsHistorical,
  seatTotals,
  tileRecord,
  type EventLite,
  type RatingRow,
} from '../src/lib/deckRecord';
import { deckDiff, groupDeck, parseSwap } from '../src/lib/deckCards';
import { CARDS, CARD_BY_ID, cardLabel } from '../src/engine/cards';

const row = (name: string, over: Partial<RatingRow> = {}): RatingRow => ({
  name,
  file: `${name}.txt`,
  rating: 0,
  games: 30,
  wrField: 0.6,
  wrFieldLo: 0.5,
  wrFieldHi: 0.7,
  wrMeta: 0.55,
  events: 2,
  titles: 1,
  top8: 2,
  avgFinish: 0.8,
  matches: '7-3',
  gamesRecord: '15-9',
  ...over,
});
const ev = (id: number, standings: string[], champion = standings[0], simVersion?: number): EventLite => ({
  id,
  date: `2026-11-${10 + id}`,
  champion,
  simVersion,
  top8: standings.slice(0, 2).map((deck) => ({ deck })),
  standings: standings.map((deck, i) => ({ deck, record: `${3 - i}-${i}`, games: `${6 - i}-${i}` })),
});

describe('deck record', () => {
  it('mirrors the simulator version in src/lib/tournament.ts', () => {
    expect(CURRENT_SIM_VERSION).toBe(SIM_VERSION);
  });

  it('parses records and ordinals', () => {
    expect(parseWL('329-156')).toEqual([329, 156]);
    expect(parseWL('')).toBeNull();
    expect(parseWL(undefined)).toBeNull();
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 68].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '68th']);
  });

  it('lists event finishes newest first, with top-8 and title flags', () => {
    const events = [ev(1, ['A', 'B', 'C']), ev(2, ['B', 'C', 'A']), ev(3, ['C', 'B'])];
    const f = eventFinishes('A', events);
    expect(f.map((x) => [x.id, x.place, x.of, x.top8, x.champion])).toEqual([
      [2, 3, 3, false, false],
      [1, 1, 3, true, true],
    ]);
    expect(f[0].record).toBe('1-2');
  });

  it('reads tournament head-to-heads from either side of a pair', () => {
    const file = { events: 2, decks: ['A', 'B', 'C'], pairs: [[0, 1, 3, 4], [1, 2, 1, 2], [0, 2, 0.5, 1]] as [number, number, number, number][] };
    expect(h2hFor('B', file)).toEqual([
      { opp: 'A', g: 4, w: 0.25 },
      { opp: 'C', g: 2, w: 0.5 },
    ]);
    expect(h2hFor('Z', file)).toEqual([]);
    expect(h2hFor('A', null)).toEqual([]);
  });

  it('picks best and worst matchups above a sample floor', () => {
    const rows = [
      { opp: 'X', g: 60, w: 0.8 },
      { opp: 'Y', g: 60, w: 0.35 },
      { opp: 'Z', g: 3, w: 0.0 },
    ];
    expect(extremes(rows, 10)).toMatchObject({ best: { opp: 'X' }, worst: { opp: 'Y' }, count: 2 });
    expect(extremes(rows, 61)).toBeNull();
    expect(extremes([rows[0]])).toMatchObject({ best: { opp: 'X' }, worst: null, count: 1 });
  });

  it('sums seats from matchup rows', () => {
    expect(seatTotals([{ opp: 'X', g: 4, w: 0.5, fw: 1, fg: 2, sw: 1, sg: 2 }, { opp: 'Y', g: 2, w: 1, fw: 1, fg: 1, sw: 1, sg: 1 }])).toEqual({ fw: 2, fg: 3, sw: 2, sg: 3 });
  });

  it('a deck with nothing recorded has no record', () => {
    const r = deckRecord({ name: 'Nobody', ratings: { decks: [row('A')] }, events: [ev(1, ['A'])] });
    expect(r.hasAny).toBe(false);
    expect(r.historical).toBe(false);
    expect(r.finishes).toEqual([]);
  });

  it('assembles tournament numbers, seats, meta record and matchups with their sources', () => {
    const r = deckRecord({
      name: 'B',
      ratings: { decks: [row('A'), row('B', { games: 40, gamesRecord: '12-4', titles: 0, top8: 1 })] },
      events: [ev(1, ['A', 'B'], 'A', 3)],
      finals: {
        overall: 0.6,
        games: 120,
        rows: [
          { opp: 'M1', g: 60, w: 0.7, fw: 20, fg: 30, sw: 22, sg: 30 },
          { opp: 'M2', g: 60, w: 0.5, fw: 16, fg: 30, sw: 14, sg: 30 },
        ],
      },
      telemetry: { games: 100, wr: 0.5, wrFirst: 0.9, wrSecond: 0.1 },
      versions: { reports: 3 },
    });
    expect(r.hasAny).toBe(true);
    expect(r.tournament).toMatchObject({ games: 40, won: 12, lost: 4, wr: 0.75, rank: 2, of: 2, titles: 0, top8: 1 });
    // the finals rows give exact seat samples, so they win over telemetry
    expect(r.seats).toMatchObject({ source: 'finals', firstN: 60, secondN: 60, first: 36 / 60, second: 36 / 60 });
    expect(r.vsMeta).toEqual({ wr: 0.6, n: 120, source: 'finals' });
    expect(r.matchups).toMatchObject({ source: 'finals', best: { opp: 'M1' }, worst: { opp: 'M2' } });
    expect(r.finishes).toHaveLength(1);
    // ratings without a manifest fall back to the events (all current here) and the reports carry version 3
    expect(r.historical).toBe(false);
  });

  it('falls back to telemetry seats and season results, and marks unversioned data historical', () => {
    const r = deckRecord({
      name: 'C',
      telemetry: { games: 12, wr: 0.5, wrFirst: 0.6, wrSecond: 0.4 },
      leader: { rank: 3, of: 10, rating: 0.58, vsMeta: 0.61, metaG: 90, percentile: 80 },
    });
    expect(r.seats).toMatchObject({ source: 'telemetry', games: 12, firstN: null });
    expect(r.vsMeta).toEqual({ wr: 0.61, n: 90, source: 'seasons' });
    expect(r.tournament).toBeUndefined();
    expect(r.historical).toBe(true);
  });

  it('takes exact seats and matchups from dedicated head-to-heads before telemetry', () => {
    const r = deckRecord({
      name: 'D',
      h2h: [
        { opp: 'X', g: 400, w: 0.5, fw: 110, fg: 200, sw: 90, sg: 200 },
        { opp: 'Y', g: 10, w: 0.3, fw: 2, fg: 5, sw: 1, sg: 5 },
      ],
      telemetry: { games: 50, wr: 0.5, wrFirst: 0.9, wrSecond: 0.1 },
    });
    expect(r.seats).toMatchObject({ source: 'h2h', firstN: 205, secondN: 205, first: 112 / 205, second: 91 / 205 });
    expect(r.matchups).toMatchObject({ source: 'h2h', best: { opp: 'X' }, worst: { opp: 'Y', g: 10 } });
    expect(r.historical).toBe(true);
  });

  it('uses tournament head-to-heads only when no report has matchups, with a sample floor', () => {
    const r = deckRecord({
      name: 'A',
      ratings: { decks: [row('A')] },
      events: [ev(1, ['A', 'B'])],
      eventH2H: [
        { opp: 'B', g: 9, w: 0.7 },
        { opp: 'C', g: 2, w: 0 },
        { opp: 'D', g: 8, w: 0.25 },
      ],
    });
    expect(r.matchups).toMatchObject({ source: 'events', best: { opp: 'B' }, worst: { opp: 'D' }, count: 2 });
    expect(r.historical).toBe(true); // the event has no simVersion
  });

  it('knows historical data from versions, manifests and events', () => {
    expect(isHistorical(undefined)).toBe(true);
    expect(isHistorical(CURRENT_SIM_VERSION - 1)).toBe(true);
    expect(isHistorical(CURRENT_SIM_VERSION)).toBe(false);
    expect(ratingsHistorical({ decks: [], manifest: { simVersion: CURRENT_SIM_VERSION } })).toBe(false);
    expect(ratingsHistorical({ decks: [], manifest: { simVersion: 0 } })).toBe(true);
    expect(ratingsHistorical({ decks: [] }, [{ simVersion: CURRENT_SIM_VERSION }])).toBe(false);
    expect(ratingsHistorical({ decks: [] }, [{ simVersion: CURRENT_SIM_VERSION }, {}])).toBe(true);
    expect(ratingsHistorical(undefined)).toBe(true);
  });

  it('gives tiles the Swiss game win rate and its sample', () => {
    expect(tileRecord(row('A', { gamesRecord: '15-5' }))).toMatchObject({ wr: 0.75, n: 20, games: 30, titles: 1 });
    expect(tileRecord(row('A', { games: 0 }))).toBeNull();
    expect(tileRecord(row('A', { gamesRecord: '' }))).toBeNull();
    expect(tileRecord(undefined)).toBeNull();
  });
});

describe('deck structure', () => {
  const legends = CARDS.filter((c) => c.type === 'Legend').slice(0, 3).map((c) => c.id);
  const of = (t: string) => CARDS.filter((c) => c.type === t);
  const units = of('Unit').sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0));
  const [u1, u2] = [units[0], units[units.length - 1]]; // dearest, cheapest
  const g1 = of('Gear')[0];
  const p1 = of('Program')[0];

  it('groups Legends, then Units, Gear and Programs by cost, then the sideboard', () => {
    const groups = groupDeck({ legends, main: [u1.id, u2.id, u2.id, g1.id, p1.id, 'no-such-card'], sideboard: [u1.id] });
    expect(groups.map((g) => g.key)).toEqual(['legends', 'Unit', 'Gear', 'Program', 'sideboard']);
    expect(groups[0].cards.map((c) => c.id)).toEqual(legends);
    const units = groups[1];
    expect(units.total).toBe(3);
    // cheapest first
    expect(units.cards.map((c) => c.id)).toEqual([u2.id, u1.id]);
    expect(units.cards[0].n).toBe(2);
    expect(groups[4]).toMatchObject({ label: 'Sideboard', total: 1 });
  });

  it('keeps an empty Legends group and drops other empty groups', () => {
    expect(groupDeck({ legends: [], main: [g1.id] }).map((g) => [g.key, g.total])).toEqual([
      ['legends', 0],
      ['Gear', 1],
    ]);
  });

  it('diffs two lists, cuts first', () => {
    expect(deckDiff({ main: [u1.id, u1.id, g1.id] }, { main: [u1.id, g1.id, p1.id] })).toEqual([
      { id: u1.id, d: -1 },
      { id: p1.id, d: 1 },
    ]);
  });

  it('reads the cards out of a Deck Lab swap label', () => {
    const label = `−1 ${cardLabel(CARD_BY_ID[u1.id])} → +1 ${cardLabel(CARD_BY_ID[p1.id])}`;
    expect(parseSwap(label)).toEqual({ out: u1.id, in: p1.id });
    expect(parseSwap('−1 Nothing → +1 Else')).toEqual({ out: undefined, in: undefined });
    expect(parseSwap('something else')).toEqual({});
  });
});
