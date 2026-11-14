// The hash of a game position that saves (src/lib/savedGames.ts, src/net/hostGame.ts) and the Game review's strict
// replay (src/ai/reviewer.ts, src/sim/practiceReview.ts) compare. Pure and dependency-free, so the review worker can
// import it without the saved-games module. Its exact output is stored in saves: never change it.
import type { GameState } from '../engine/types';

/** FNV-1a 32 of a string, twice with different seeds: 16 hex digits. */
export function hash64(s: string): string {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** The state a save checks: everything but the log and the trace. */
export function stateHash(st: GameState): string {
  const { log: _log, trace: _trace, ...rest } = st;
  return hash64(JSON.stringify(rest));
}

/** A stateHash value: 16 lowercase hex digits. */
export const isStateHash = (x: unknown): x is string => typeof x === 'string' && /^[0-9a-f]{16}$/.test(x);
