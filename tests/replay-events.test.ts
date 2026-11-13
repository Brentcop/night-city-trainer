// Golden replays from the recorded events (docs/ROADMAP.md §4 step 4): a few games from public/tournaments/, replayed
// with makeBot() on their recorded seed and seat, must end exactly as recorded (winner and turn count). Each pins the
// engine and the bots to what recorded the events (since SIM_VERSION 6 Hard reads no card impact, so src/data/impact.json
// no longer moves them; since SIM_VERSION 7 Hard also picks its sell by rollout; SIM_VERSION 8 is the bot review's fixes).
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
 * (winner 0 = deck a). Picked 2026-11-13 from the events as re-recorded on SIM_VERSION 8 (the bot review's fixes):
 * games whose winner differs from the same deal on version 7 (the shortest such game of each event), both winners.
 */
const GOLDEN: { event: number; a: string; b: string; game: number; winner: 0 | 1 | 'tie'; turns: number }[] = [
  { event: 1, a: 'RRY Smasher Aggro', b: 'Rainbow Fixer Stuff', game: 0, winner: 1, turns: 10 },
  { event: 2, a: 'BBG Cunningham Econ', b: 'RRB Wakako Midrange', game: 0, winner: 0, turns: 11 },
  { event: 3, a: 'S1-07 Explorer (RYY)', b: 'BBG Cunningham Econ', game: 0, winner: 1, turns: 10 },
  { event: 4, a: "Gear'n'Go", b: 'RRG Dexter Midrange', game: 0, winner: 0, turns: 12 },
  { event: 5, a: 'Ladder: Dexter / V / Wakako (RRB)', b: 'Ladder: Smasher / River / Viktor (RYY)', game: 0, winner: 0, turns: 13 },
  { event: 6, a: 'Ladder: V / Smasher / Saburo (RRG)', b: 'NC-08 Merc Contract (RRG)', game: 0, winner: 1, turns: 11 },
  { event: 7, a: 'S1-07 Explorer (RYY)', b: 'S1-06 Cross (BGY)', game: 0, winner: 0, turns: 13 },
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
