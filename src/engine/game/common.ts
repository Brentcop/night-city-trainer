// Small pieces the Game facade (../engine.ts) and its modules share.
import type { PlayerId } from '../types';

export function other(p: PlayerId): PlayerId {
  return (1 - p) as PlayerId;
}

/** Thrown by Game.endGame to unwind the game loop (and any lookahead) once a game is decided. */
export class GameOverSignal extends Error {}
