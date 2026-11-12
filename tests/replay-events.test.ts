// Golden replays from the recorded events (docs/ROADMAP.md §4 step 4): a few games from public/tournaments/, replayed
// with makeBot() on their recorded seed and seat, must end exactly as recorded (winner and turn count). Each pins the
// engine, the bots and the bots' bundled inputs (src/data/impact.json for the Hard bot) to what recorded the events.
//
// If one fails after a DELIBERATE change to the bots, the engine or the impact table, the recorded events no longer
// replay: bump SIM_VERSION (src/lib/tournament.ts, CURRENT_SIM_VERSION in src/lib/playedRecord.ts) in the same commit,
// so the site marks them historical, and pick new games here once events are recorded on the new code.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { gameDeck, makeBot, SIM_VERSION, type GameRec, type TourneyEvent } from '../src/lib/tournament';

/**
 * event id, the match's two decks (a first, as recorded), the game's index in the match, and its recorded result
 * (winner 0 = deck a). Picked 2026-11-11 from the first events of the fresh baseline: short games, both winners.
 */
const GOLDEN: { event: number; a: string; b: string; game: number; winner: 0 | 1 | 'tie'; turns: number }[] = [
  { event: 1, a: 'RRB Wakako Midrange', b: 'BBG Cunningham Econ', game: 0, winner: 1, turns: 10 },
  { event: 2, a: 'YYB Rogue Gear', b: 'Rainbow Fixer Stuff', game: 0, winner: 0, turns: 10 },
  { event: 3, a: 'RRB Wakako Midrange', b: 'Smash the Curve', game: 0, winner: 1, turns: 9 },
  { event: 4, a: "Gear'n'Go", b: "NC-05 Emperor's Guard (GGB)", game: 0, winner: 1, turns: 9 },
  // picked 2026-11-12 from the events after Season 2 (meta + sim-ladder + Season 2 decks, then the whole library)
  { event: 5, a: 'S2-08 Explorer (GGY)', b: 'Ladder: Jackie / Alt / Hanako (BBG)', game: 1, winner: 1, turns: 10 },
  { event: 6, a: 'Ladder: V / Smasher / Padre (RRG)', b: 'S2-06 Counter (RGG)', game: 2, winner: 0, turns: 9 },
  { event: 7, a: 'Ladder: Dexter / V / Wakako (RRB)', b: 'NC-08 Merc Contract (RRG)', game: 2, winner: 1, turns: 9 },
];

const events = new Map<number, TourneyEvent>();
const eventOf = (id: number) => {
  if (!events.has(id)) events.set(id, JSON.parse(readFileSync(`public/tournaments/event-${id}.json`, 'utf8')) as TourneyEvent);
  return events.get(id)!;
};

describe('golden replays from recorded events', () => {
  it.each(GOLDEN)('event $event: $a vs $b, game $game replays as recorded', async ({ event, a, b, game, winner, turns }) => {
    const ev = eventOf(event);
    expect(ev.simVersion).toBe(SIM_VERSION);
    const match = [...ev.rounds, ...ev.bracket].flatMap((p) => p.matches).find((m) => m.a === a && m.b === b);
    expect(match, `${a} vs ${b}`).toBeDefined();
    const rec: GameRec = match!.games[game];
    expect({ winner: rec.winner, turns: rec.turns }, 'the event file still holds the pinned game').toEqual({ winner, turns });
    // the decks enter the game as the event stored them, under their names (sideboards play no part)
    const deck = (name: string) => gameDeck({ name, legends: ev.decks[name].legends, main: ev.decks[name].main });
    const s = await Game.create([deck(a), deck(b)], [makeBot(ev.bot, rec.seed), makeBot(ev.bot, rec.seed + 7777)], { seed: rec.seed, first: rec.first, log: false }).run();
    expect({ winner: s.winner, turns: s.turn }).toEqual({ winner: rec.winner, turns: rec.turns });
  }, 60_000);
});
