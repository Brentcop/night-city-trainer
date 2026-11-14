// Movement around the top-cut places (src/lib/eventFacts.ts `roundMovement`) and upsets judged by ratings fitted on
// earlier events only (src/lib/eventUpsets.ts). On the recorded data: "the same games as the ratings" is pinned (a fit on
// every pooled event reproduces src/data/ratings.json, and the shared extraction equals the ratings script's pool), and one
// real round's movement is checked against its results by hand. On invented fixtures: a small Swiss event whose movement
// and cut line are known by construction, the formats where movement does not apply, and upsets where a strong and a weak
// deck met often enough earlier that the answer is known (the first event, a deck below the minimum, another bot).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { roundMovement, roundSummary, standingsAfter, type RatingsInput, type RecordedEvent } from '../src/lib/eventFacts';
import { earlierEvents, eventUpsets, judgeMatches, MIN_EARLIER_GAMES, UPSET_MAX_CHANCE, upsetCalibration, upsetYardstick } from '../src/lib/eventUpsets';
import { ratedGamesOf } from '../src/lib/ratingGames';
import { fitRatings } from '../src/lib/ratingModel';
import type { GameRec, MatchRec } from '../src/lib/tournament';
import { poolEvents, selectEvents, type PoolEvent } from '../scripts/event-pool';

const ROOT = path.resolve(__dirname, '..');
const json = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')) as T;
const EVENTS = fs
  .readdirSync(path.join(ROOT, 'public/tournaments'))
  .filter((f) => /^event-\d+\.json$/.test(f))
  .map((f) => json<RecordedEvent>(`public/tournaments/${f}`))
  .sort((a, b) => Number(a.id) - Number(b.id));
const RATINGS = json<RatingsInput & { games: number }>('src/data/ratings.json');

describe('the yardstick takes the same games as the ratings', () => {
  const pooled = selectEvents(EVENTS).kept;

  it('the shared extraction is the ratings script\'s pool, game for game', () => {
    expect(ratedGamesOf(pooled)).toEqual(poolEvents(pooled as unknown as PoolEvent[]).games);
  });

  it('a fit on every pooled event reproduces src/data/ratings.json', () => {
    const games = ratedGamesOf(pooled);
    expect(games.length).toBe(RATINGS.games);
    expect(pooled.length).toBe(RATINGS.events);
    const fit = fitRatings(games);
    const at = new Map(fit.names.map((n, i) => [n, i]));
    expect(fit.names.length).toBe(RATINGS.decks.length);
    for (const row of RATINGS.decks) {
      const i = at.get(row.name);
      expect(i, row.name).toBeDefined();
      expect(fit.r[i!], row.name).toBeCloseTo(row.rating, 12);
      expect(fit.played[i!], row.name).toBe(row.games);
    }
  });

  it('the yardstick of the newest event is the events before it, with its sim version and bot', () => {
    const last = EVENTS.at(-1)!;
    const y = upsetYardstick(EVENTS, last);
    expect(y.events).toEqual(earlierEvents(EVENTS, last).map((e) => e.id));
    expect(y.events).not.toContain(last.id);
    expect(y.games).toBe(ratedGamesOf(earlierEvents(EVENTS, last)).length);
    expect(upsetYardstick(EVENTS, EVENTS[0]!)).toMatchObject({ events: [], games: 0, fit: null });
  });
});

describe('movement on a real round, checked by hand', () => {
  const ev6 = EVENTS.find((e) => e.id === 6);

  // Event 6, round 9 (the last Swiss round, top cut of 8), as re-recorded on SIM_VERSION 9 (2026-11-14; re-checked by hand
  // from the round results: match points, OMW and GWP rebuilt independently, the same order as the stored standings). In
  // round 9 the deck that moved in won (V / Smasher / Padre beat S1-05 Cross 2-0) and the one that dropped out lost
  // (Braindance Burn lost 1-2 to V / Smasher / Saburo). After round 8 both were on 15 match points (places 7 to 18),
  // Braindance Burn 7th and Padre 10th on OMW; after round 9 places 6 to 12 are all on 18 points.
  it.skipIf(!ev6)('event 6 round 9: who moved in and out of the top 8, the cut and who missed it on tiebreakers', () => {
    const m = roundMovement(ev6!, 9);
    expect(m).toMatchObject({ notApplicable: null, cut: 8, hasBefore: true });
    expect(m.movedIn.map((c) => [c.deck, c.before, c.place])).toEqual([['Ladder: V / Smasher / Padre (RRG)', 10, 8]]);
    expect(m.droppedOut.map((c) => [c.deck, c.before, c.place])).toEqual([['NC-07 Braindance Burn (RRB)', 7, 14]]);
    // the cut line equals the stored standings and the recorded seeds
    const cl = m.cutLine!;
    expect(cl.made.map((r) => r.deck)).toEqual(ev6!.standings.slice(0, 8).map((s) => s.deck));
    expect(cl.seedsAgree).toBe(true);
    expect(cl.last).toMatchObject({ deck: 'Ladder: V / Smasher / Padre (RRG)', place: 8, mp: 18, matchRecord: '6-3' });
    expect(cl.missedOnTiebreak.map((r) => [r.deck, r.place, r.separatedBy])).toEqual([
      ['RRG Dexter Midrange', 9, 'omw'],
      ['Ladder: V / Smasher / Saburo (RRG)', 10, 'omw'],
      ['BBG Cunningham Econ', 11, 'omw'],
      ['YYY Adam v1 - Ready for Brawl', 12, 'omw'],
    ]);
    expect(ev6!.standings[12]!.mp).toBeLessThan(18);
    // a climb and a drop are the largest change in places, every deck that made it
    const before = new Map(standingsAfter(ev6!, 8).rows.map((r) => [r.deck, r.place]));
    const gains = standingsAfter(ev6!, 9).rows.map((r) => before.get(r.deck)! - r.place);
    expect(m.climb!.places).toBe(Math.max(...gains));
    expect(m.drop!.places).toBe(-Math.min(...gains));
    expect(m.climb!.decks.length).toBe(gains.filter((g) => g === m.climb!.places).length);
  });

  it.skipIf(!ev6)('round 1 has nothing before it; a middle round has no cut line; a bracket round has no movement', () => {
    expect(roundMovement(ev6!, 1)).toMatchObject({ hasBefore: false, movedIn: [], droppedOut: [], climb: null, drop: null, cutLine: null });
    expect(roundMovement(ev6!, 5).cutLine).toBeNull();
    expect(roundSummary(ev6!, 5).movement).toEqual(roundMovement(ev6!, 5));
    expect(roundSummary(ev6!, 'final').movement).toBeNull();
    expect(() => roundMovement(ev6!, 10)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------- invented fixtures

let seed = 0;
const game = (first: 0 | 1, winner: 0 | 1 | 'tie'): GameRec => ({ seed: seed++, first, winner, turns: 10, reason: 'invented end' });
const match = (a: string, b: string | null, winners: (0 | 1)[] = []): MatchRec => {
  // the loser of a game goes first in the next, as the recorder plays it
  let first: 0 | 1 = 0;
  const games = winners.map((w) => {
    const g = game(first, w);
    first = w === 0 ? 1 : 0;
    return g;
  });
  const score: [number, number] = [winners.filter((w) => w === 0).length, winners.filter((w) => w === 1).length];
  return { a, b, games, score: b ? score : [2, 0], winner: b ? (score[0] > score[1] ? a : b) : a };
};

function event(o: { id: number; bot?: string; simVersion?: number; decks: string[]; rounds: MatchRec[][]; bracket?: { name: string; matches: MatchRec[] }[]; custom?: boolean; setup?: RecordedEvent['setup']; seeds?: string[] }): RecordedEvent {
  return {
    id: o.id,
    name: `Fixture ${o.id}`,
    date: `2030-01-0${o.id}T00:00:00.000Z`,
    bot: o.bot ?? 'fixture-bot',
    format: 'invented',
    decks: Object.fromEntries(o.decks.map((d) => [d, {}])),
    rounds: o.rounds.map((matches, i) => ({ round: i + 1, matches })),
    bracket: o.bracket ?? [],
    standings: [],
    champion: null,
    simVersion: o.simVersion ?? 8,
    ...(o.custom ? { custom: true } : {}),
    ...(o.setup ? { setup: o.setup } : {}),
    ...(o.seeds ? { seeds: o.seeds } : {}),
  };
}

describe('movement on a small Swiss event (known by construction)', () => {
  // R1: A beats B 2-0, C beats D 2-1 → A, C, B, D. R2: A beats C 2-1, B beats D 2-0 → A 6 points; B and C on 3 points
  // with equal opponents' share (2/3) and game share (1/2), so the name puts B second: B moves into the cut of 2, C out.
  const ev = event({
    id: 1,
    decks: ['A', 'B', 'C', 'D'],
    rounds: [
      [match('A', 'B', [0, 0]), match('C', 'D', [0, 1, 0])],
      [match('A', 'C', [0, 1, 0]), match('B', 'D', [0, 0])],
    ],
    bracket: [{ name: 'Final', matches: [match('A', 'B', [0, 0])] }],
    seeds: ['A', 'B'],
  });

  it('who moved, the biggest climb and drop, the cut and who missed it on tiebreakers', () => {
    expect(standingsAfter(ev, 1).rows.map((r) => r.deck)).toEqual(['A', 'C', 'B', 'D']);
    const m = roundMovement(ev, 2);
    expect(m).toMatchObject({ cut: 2, hasBefore: true, notApplicable: null });
    expect(m.movedIn).toEqual([{ deck: 'B', before: 3, place: 2, matchRecord: '1-1' }]);
    expect(m.droppedOut).toEqual([{ deck: 'C', before: 2, place: 3, matchRecord: '1-1' }]);
    expect(m.climb).toEqual({ places: 1, decks: [{ deck: 'B', before: 3, place: 2, matchRecord: '1-1' }] });
    expect(m.drop).toEqual({ places: 1, decks: [{ deck: 'C', before: 2, place: 3, matchRecord: '1-1' }] });
    expect(m.cutLine).toEqual({
      made: [
        { deck: 'A', place: 1, matchRecord: '2-0', mp: 6 },
        { deck: 'B', place: 2, matchRecord: '1-1', mp: 3 },
      ],
      last: { deck: 'B', place: 2, matchRecord: '1-1', mp: 3 },
      missedOnTiebreak: [{ deck: 'C', place: 3, matchRecord: '1-1', mp: 3, separatedBy: 'name' }],
      seedsAgree: true,
    });
    expect(roundMovement(ev, 1)).toMatchObject({ hasBefore: false, movedIn: [], climb: null });
  });

  it('is not applicable to other formats, custom events or an event without a cut, and says why', () => {
    const rr = roundMovement({ ...ev, setup: { format: 'round-robin' } }, 2);
    expect(rr.notApplicable).toBe('not a Swiss event (round-robin)');
    expect(rr).toMatchObject({ movedIn: [], droppedOut: [], climb: null, drop: null, cutLine: null });
    expect(roundMovement({ ...ev, setup: { format: 'match-list' } }, 1).notApplicable).toBe('not a Swiss event (match-list)');
    expect(roundMovement({ ...ev, custom: true }, 2).notApplicable).toMatch(/^a custom event/);
    expect(roundMovement({ ...ev, bracket: [] }, 2).notApplicable).toBe('the event had no top cut');
    expect(roundSummary({ ...ev, setup: { format: 'round-robin' } }, 2).movement?.notApplicable).toBe('not a Swiss event (round-robin)');
  });
});

describe('upsets on fixtures (known by construction)', () => {
  // Event 1: Strong beats Weak in all ten matches (19 of 24 games, from both seats); Even and Level split 30 games 15-15.
  // Fresh only arrives in event 2. Every pairing wins and loses from both seats, so the going-first term stays finite (a
  // record perfect from one seat would send the fit's unpenalised going-first term to infinity).
  const seats = (a: string, b: string, gs: [0 | 1, 0 | 1][]): MatchRec => {
    const games = gs.map(([first, w]) => game(first, w));
    const score: [number, number] = [gs.filter(([, w]) => w === 0).length, gs.filter(([, w]) => w === 1).length];
    return { a, b, games, score, winner: score[0] > score[1] ? a : b };
  };
  const P1 = (): MatchRec => seats('Strong', 'Weak', [[0, 0], [1, 0]]);
  const P2 = (): MatchRec => seats('Strong', 'Weak', [[1, 0], [0, 1], [1, 0]]);
  const P3 = (): MatchRec => seats('Strong', 'Weak', [[1, 1], [0, 0], [1, 0]]);
  const evenWins = (): MatchRec => seats('Even', 'Level', [[0, 1], [1, 0], [0, 0]]);
  const levelWins = (): MatchRec => seats('Even', 'Level', [[1, 1], [0, 0], [1, 1]]);
  const e1 = event({ id: 1, decks: ['Strong', 'Weak', 'Even', 'Level'], rounds: [P1, P1, P2, P1, P3, P1, P1, P2, P1, P3].map((p, i) => [p(), i % 2 ? evenWins() : levelWins()]) });
  const e2 = event({
    id: 2,
    decks: ['Strong', 'Weak', 'Even', 'Level', 'Fresh'],
    rounds: [
      [seats('Weak', 'Strong', [[0, 0], [1, 1], [1, 0]]), seats('Even', 'Level', [[0, 1], [1, 0], [0, 1]]), match('Fresh', null)],
      [seats('Fresh', 'Strong', [[0, 1], [1, 1]])],
    ],
    bracket: [{ name: 'Final', matches: [seats('Strong', 'Weak', [[0, 0], [1, 0]])] }],
  });
  const weak20 = () => seats('Weak', 'Strong', [[0, 0], [1, 0]]);
  const other = event({ id: 3, bot: 'other-bot', decks: ['Strong', 'Weak'], rounds: [[weak20()]] });
  const older = event({ id: 4, simVersion: 7, decks: ['Strong', 'Weak'], rounds: [[weak20()]] });
  const e5 = event({ id: 5, decks: ['Strong', 'Weak'], rounds: [[weak20()]] });
  const all = [e5, older, other, e2, e1];

  it('the first event has no yardstick: nothing is judged, and says why', () => {
    const u = eventUpsets(all, e1);
    expect(u.yardstick).toMatchObject({ events: [], games: 0 });
    expect(u).toMatchObject({ played: 20, judged: 0, notJudged: 20, upsets: [] });
    expect(u.matches[0]!.reason).toBe('no earlier recorded event on sim version 8 with the fixture-bot bot');
    expect(u.belowMinimum).toEqual([]);
  });

  it('the weak deck beating the strong one is an upset; the favourite winning and a coin-flip pairing are not', () => {
    const u = eventUpsets(all, e2);
    expect(u.yardstick).toEqual({ events: [1], games: 54, minEarlierGames: MIN_EARLIER_GAMES, upsetMaxChance: UPSET_MAX_CHANCE });
    expect(u.played).toBe(4); // the bye is no match
    const [weakWin, evenWin, fresh, final] = u.matches;
    expect(weakWin).toMatchObject({ winner: 'Weak', loser: 'Strong', score: [2, 1], judged: true, upset: true, earlierGames: { winner: 24, loser: 24 } });
    expect(weakWin!.winnerChance!).toBeLessThanOrEqual(UPSET_MAX_CHANCE);
    expect(evenWin).toMatchObject({ winner: 'Level', loser: 'Even', judged: true, upset: false });
    expect(Math.abs(evenWin!.winnerChance! - 0.5)).toBeLessThan(0.15);
    expect(final).toMatchObject({ stage: 'bracket', roundName: 'Final', key: 'final', winner: 'Strong', judged: true, upset: false });
    expect(final!.winnerChance!).toBeCloseTo(1 - weakWin!.winnerChance!, 12);
    // a deck below the minimum: not judged, with the reason and its earlier games
    expect(fresh).toMatchObject({ winner: 'Strong', loser: 'Fresh', judged: false, winnerChance: null, upset: false, earlierGames: { winner: 24, loser: 0 } });
    expect(fresh!.reason).toBe(`Fresh had 0 earlier games (fewer than ${MIN_EARLIER_GAMES})`);
    expect(u).toMatchObject({ judged: 3, notJudged: 1, belowMinimum: [{ deck: 'Fresh', earlierGames: 0 }] });
    expect(u.upsets).toEqual([weakWin]);
    // one round, or the bracket round by its name
    expect(eventUpsets(all, e2, { round: 2 })).toMatchObject({ round: 'Round 2', played: 1, judged: 0, notJudged: 1, upsets: [] });
    expect(eventUpsets(all, e2, { round: 'final' })).toMatchObject({ round: 'Final', played: 1, judged: 1, upsets: [] });
    expect(() => eventUpsets(all, e2, { round: 3 })).toThrow(RangeError);
    expect(() => eventUpsets(all, e2, { round: 'semifinals' })).toThrow(RangeError);
  });

  it('another bot or sim version is never in the yardstick, and an event never judges itself', () => {
    expect(upsetYardstick(all, e5).events).toEqual([1, 2]);
    expect(upsetYardstick(all, other).events).toEqual([]);
    expect(upsetYardstick(all, older).events).toEqual([]);
    expect(upsetYardstick(all, e1).events).toEqual([]);
    // a deck against its own copy is not judged (the ratings leave those games out)
    const copies = event({ id: 6, decks: ['Strong', 'Strong #2'], rounds: [[match('Strong', 'Strong #2', [0, 0])]], setup: { format: 'swiss', entrants: [{ name: 'Strong' }, { name: 'Strong #2', copyOf: 'Strong' }] } as RecordedEvent['setup'] });
    const j = judgeMatches(copies, upsetYardstick([...all, copies], copies));
    expect(j[0]).toMatchObject({ judged: false, reason: 'a deck against its own copy (not in the ratings)' });
  });

  it('the calibration counts the favourite\'s wins by band over every judged match', () => {
    const c = upsetCalibration(all);
    expect(c.events).toEqual([2, 5]);
    expect(c.judged).toBe(4);
    // event 2: Strong was the favourite at over 70% twice (lost round 1, won the final); Even and Level are level (50 to
    // 55%, either side the favourite). Event 5: Strong is still the favourite at over 70% after one upset, and loses again.
    const e5Match = judgeMatches(e5, upsetYardstick(all, e5))[0]!;
    expect(e5Match).toMatchObject({ winner: 'Weak', judged: true, upset: true });
    expect(1 - e5Match.winnerChance!).toBeGreaterThan(0.7);
    expect(c.bands.map((b) => [b.lo, b.hi, b.matches, b.favouriteWon])).toEqual([
      [0.5, 0.55, 1, expect.any(Number)],
      [0.55, 0.6, 0, 0],
      [0.6, 0.7, 0, 0],
      [0.7, 1, 3, 1],
    ]);
  });
});
