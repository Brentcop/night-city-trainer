// This turn's history (plays, attacks, defeats, steals; cleared every turn) and once-per-turn keys.
import type { Game } from '../engine';
import type { TurnEvent } from '../types';

/** Record an event in this turn's history (cleared at the start of every turn). Returns its index. */
export function noteTurnEvent(game: Game, e: TurnEvent): number {
  const list = (game.s.turnEvents ??= []);
  list.push(e);
  return list.length - 1;
}

/** Number of events of a kind this turn (optionally filtered). */
export function turnCount(game: Game, k: TurnEvent['k'], pred?: (e: TurnEvent) => boolean): number {
  return (game.s.turnEvents ?? []).filter((e) => e.k === k && (!pred || pred(e))).length;
}

/**
 * "The first time ... each turn": true if no event of this kind matching pred happened this turn before the event
 * with index `seq` (the `seq` carried by the event payload). Counts events whether or not the asking card was in play.
 */
export function firstThisTurn(game: Game, seq: number | undefined, k: TurnEvent['k'], pred: (e: TurnEvent) => boolean): boolean {
  const list = game.s.turnEvents ?? [];
  const end = seq ?? list.length;
  for (let i = 0; i < end && i < list.length; i++) if (list[i].k === k && pred(list[i])) return false;
  return true;
}

export function oncePerTurn(game: Game, key: string): boolean {
  if (game.s.once[key] === game.s.turn) return false;
  game.s.once[key] = game.s.turn;
  return true;
}

export function usedThisTurn(game: Game, key: string): boolean {
  return game.s.once[key] === game.s.turn;
}
