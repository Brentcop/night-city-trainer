// Golden replays: pin what makeBot / makeTierBot play for a fixed seed, so bot or engine behaviour cannot drift silently.
//
// If one of these fails after a DELIBERATE change to the bots or the engine (new heuristics, rules fixes, card scripts),
// that change alters recorded games: re-run this file, update the goldens below to the new values, and bump
// `SIM_VERSION` in src/lib/tournament.ts in the same commit so older recorded events are flagged as made with other code.
// If you did not mean to change play, a failure here is a regression: find what changed instead of updating the goldens.
// Since SIM_VERSION 6 Hard reads no card impact, so regenerating src/data/impact.json no longer moves these games
// (checked again on SIM_VERSION 8: they pass with the version-7 table and the version-8 one; and on SIM_VERSION 9 with
// the version-8 table and the version-9 one).
// Games from the recorded events are pinned in tests/replay-events.test.ts.
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
    { seed: 101, first: 0, winner: 0, turns: 14, log: 'acf31057' },
    { seed: 102, first: 1, winner: 1, turns: 13, log: 'fbe3f662' },
  ],
  medium: [
    { seed: 201, first: 0, winner: 1, turns: 12, log: '11d126ae' },
    { seed: 202, first: 1, winner: 1, turns: 13, log: 'd5419ee5' },
  ],
  // Re-pinned 2026-11-12 for SIM_VERSION 6 (the fitted evaluation weights; Hard without card impact, plain mulligan).
  // Easy did not move (the fast policy keeps the hand weights). Was 0/11/8888fe17 and 1/11/589d1a10 (Medium 5d0e65c4, 0/14/1c55ca83).
  // Re-pinned 2026-11-12 for SIM_VERSION 7 (Hard picks its sell by rollout, sellLookahead 3): the logs moved, the
  // winners and turn counts did not; Easy and Medium did not move. Version 6: 71f08fdb, 8f89047f.
  // Log hashes re-taken 2026-11-12 for the "why an effect did nothing" log lines (log only): every winner, turn count and
  // final state is unchanged (Medium game 2 logged no such line). Before: easy c5b1a212, 826caaf2; medium b67d76fe;
  // hard a807cd81, cbf6d762.
  // Re-pinned 2026-11-13 for SIM_VERSION 8 (the bot review's fixes: every tier moved, Easy through easyGuard and the fast
  // policy's sub-choices): winners unchanged; Medium game 2 and both Hard games end on another turn. Version 7: easy
  // e9ac3d15, e9f7dece; medium c16a835e, 14/e62bf71e; hard 14/af90824d, 11/0c9f8216.
  // Re-pinned 2026-11-14 for SIM_VERSION 9 (whole-list reads: a seat's own Gig plan and both archetypes come from every
  // card it owns): winners unchanged; Easy game 1 and Hard game 2 end on another turn; Medium game 1 did not move. Easy
  // moved too: it never evaluates the live game, so its live plan used to be frozen at its first Gig choice, after some
  // sales. Version 8: easy 11/30b29a3e, 28161a31; medium 170e3ed4; hard 2806f35d, 13/79232b1c.
  hard: [
    { seed: 301, first: 0, winner: 0, turns: 13, log: '8b31b479' },
    { seed: 302, first: 1, winner: 1, turns: 11, log: '393394c9' },
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
