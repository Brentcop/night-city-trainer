// Golden replays: pin what makeBot / makeTierBot play for a fixed seed, so bot or engine behaviour cannot drift silently.
//
// If one of these fails after a DELIBERATE change to the bots or the engine (new heuristics, rules fixes, card scripts),
// that change alters recorded games: re-run this file, update the goldens below to the new values, and bump
// `SIM_VERSION` in src/lib/tournament.ts in the same commit so older recorded events are flagged as made with other code.
// If you did not mean to change play, a failure here is a regression: find what changed instead of updating the goldens.
// Since SIM_VERSION 6 Hard reads no card impact, so regenerating src/data/impact.json no longer moves these games.
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
    { seed: 101, first: 0, winner: 0, turns: 11, log: 'e9ac3d15' },
    { seed: 102, first: 1, winner: 1, turns: 13, log: 'e9f7dece' },
  ],
  medium: [
    { seed: 201, first: 0, winner: 1, turns: 12, log: 'c16a835e' },
    { seed: 202, first: 1, winner: 1, turns: 14, log: 'e62bf71e' },
  ],
  // Re-pinned 2026-11-12 for SIM_VERSION 6 (the fitted evaluation weights; Hard without card impact, plain mulligan).
  // Easy did not move (the fast policy keeps the hand weights). Was 0/11/8888fe17 and 1/11/589d1a10 (Medium 5d0e65c4, 0/14/1c55ca83).
  // Re-pinned 2026-11-12 for SIM_VERSION 7 (Hard picks its sell by rollout, sellLookahead 3): the logs moved, the
  // winners and turn counts did not; Easy and Medium did not move. Version 6: 71f08fdb, 8f89047f.
  // Log hashes re-taken 2026-11-12 for the "why an effect did nothing" log lines (log only): every winner, turn count and
  // final state is unchanged (Medium game 2 logged no such line). Before: easy c5b1a212, 826caaf2; medium b67d76fe;
  // hard a807cd81, cbf6d762.
  hard: [
    { seed: 301, first: 0, winner: 0, turns: 14, log: 'af90824d' },
    { seed: 302, first: 1, winner: 1, turns: 11, log: '0c9f8216' },
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
