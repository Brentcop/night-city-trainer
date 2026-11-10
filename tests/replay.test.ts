// Golden replays: pin what makeBot / makeTierBot play for a fixed seed, so bot or engine behaviour cannot drift silently.
//
// If one of these fails after a DELIBERATE change to the bots or the engine (new heuristics, rules fixes, card scripts),
// that change alters recorded games: re-run this file, update the goldens below to the new values, and bump
// `SIM_VERSION` in src/lib/tournament.ts in the same commit so older recorded events are flagged as made with other code.
// If you did not mean to change play, a failure here is a regression: find what changed instead of updating the goldens.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeBot } from '../src/lib/tournament';
import { makeTierBot } from '../src/ai/tiers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const A = deck('meta-rrb-wakako-midrange.txt');
const B = deck('meta-gry-trauma-team.txt');

/** FNV-1a over the final log (turn, player, text of every line). */
function hashLog(log: { turn: number; player: number | null; text: string }[]): string {
  let h = 0x811c9dc5;
  for (const e of log) {
    const s = `${e.turn}|${e.player}|${e.text}\n`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

async function play(level: string, seed: number, first: 0 | 1, mk: (level: string, seed: number) => ReturnType<typeof makeTierBot>) {
  const s = await Game.create([A, B], [mk(level, seed), mk(level, seed + 7777)], { seed, first }).run();
  return { winner: s.winner, turns: s.turn, log: hashLog(s.log) };
}

const GOLDEN: Record<string, { seed: number; first: 0 | 1; winner: 0 | 1 | 'tie'; turns: number; log: string }[]> = {
  easy: [
    { seed: 101, first: 0, winner: 0, turns: 11, log: 'c5b1a212' },
    { seed: 102, first: 1, winner: 1, turns: 13, log: 'adb607e1' },
  ],
  medium: [
    { seed: 201, first: 0, winner: 1, turns: 12, log: '8b5e1a40' },
    { seed: 202, first: 1, winner: 0, turns: 14, log: 'a7189cc2' },
  ],
  hard: [
    { seed: 301, first: 0, winner: 0, turns: 9, log: '0227daf0' },
    { seed: 302, first: 1, winner: 0, turns: 14, log: 'ebf24165' },
  ],
};

describe('golden replays', () => {
  for (const level of ['easy', 'medium', 'hard'] as const) {
    for (const [n, gd] of GOLDEN[level].entries()) {
      it(`${level} game ${n + 1} (seed ${gd.seed}) plays exactly as recorded`, async () => {
        // tournaments build their bots with makeBot; the Play screen and the CLI use makeTierBot directly
        const mk = n === 0 ? makeBot : makeTierBot;
        expect(await play(level, gd.seed, gd.first, mk)).toEqual({ winner: gd.winner, turns: gd.turns, log: gd.log });
      }, 30_000);
    }
  }
});
