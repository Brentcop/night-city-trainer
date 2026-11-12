// The play-out every lookahead shares: from a candidate move, play the rest of the turn and the next one in a clone, so
// the result can be evaluated. Used by the deep bot's rollouts and reactions (heuristic.ts), the reviewer's oracle
// (reviewer.ts) and scripts/review-debug.ts.
import { GameOverSignal, type Game } from '../engine/engine';
import type { Action, PlayerId, Reaction } from '../engine/types';
import { clampPlayOut, DEFAULT_WEIGHTS, evaluate, type EvalWeights } from './eval';

/** One random world of a play-out: the clone's RNG and the two bots' seeds. */
export interface World {
  rng: number;
  a: number;
  b: number;
}
/** n worlds. Score every candidate of a decision in the SAME worlds (common random numbers): only the move differs,
 *  so the comparison is far less noisy than scoring each candidate in its own random worlds. */
export const makeWorlds = (n: number, rnd: () => number): World[] =>
  Array.from({ length: n }, () => ({ rng: Math.floor(rnd() * 2 ** 31), a: Math.floor(rnd() * 1e9), b: Math.floor(rnd() * 1e9) }));

/** Where a play-out starts: a main-phase action of player p, or p's reaction to the attack by `attacker`. */
export type PlayOutMove = { action: Action } | { reaction: Reaction; attacker: number };

/** The steps of a play-out, in order (reported to `onStep` as each begins; 'done' once it ran to the end). */
export type PlayOutStep = 'move' | 'restOfTurn' | 'endPhase' | 'nextStart' | 'nextMain' | 'nextEnd' | 'done';

/**
 * Play `move` out in the clone `cg` for player p. After an action (none for 'pass'): resolve it, the rest of p's turn,
 * p's end phase, then the rival's whole turn. After a reaction: the rest of the attack, the attacker's turn, then p's
 * whole turn. A game that ends on the way stops the play-out; any other error is thrown.
 */
export async function playOut(cg: Game, p: PlayerId, move: PlayOutMove, onStep?: (s: PlayOutStep) => void): Promise<void> {
  try {
    if ('action' in move) {
      if (move.action.type !== 'pass') {
        onStep?.('move');
        await cg.doAction(p, move.action);
        await cg.resolvePending();
        cg.checkState();
        onStep?.('restOfTurn');
        await cg.mainLoop();
      }
    } else {
      onStep?.('move');
      if (move.reaction.type === 'endReact') await cg.attackRest(move.attacker, true);
      else {
        await cg.doReaction(p, move.reaction);
        await cg.resolvePending();
        await cg.attackRest(move.attacker);
      }
      cg.checkState();
      onStep?.('restOfTurn');
      await cg.mainLoop(); // the attacker finishes their turn
    }
    onStep?.('endPhase');
    await cg.endPhase();
    onStep?.('nextStart');
    await cg.startPhase();
    onStep?.('nextMain');
    await cg.mainLoop();
    onStep?.('nextEnd');
    await cg.endPhase();
    onStep?.('done');
  } catch (e) {
    if (!(e instanceof GameOverSignal)) throw e;
  }
}

/**
 * The result of the start-of-turn check the play-out stops just before (engine.ts `startPhase`): a play-out ends after
 * an end phase, so the seat now active begins its turn next. In the engine's order: past the turn limit the game is a
 * tie; else that seat wins with 7+ Gigs. null when the game goes on (or already ended in the play-out). Overtime needs
 * no case here: in overtime 7+ Gigs ends the game at once (`checkState`), so no seat still holds 7 once the play-out
 * is over.
 */
export function nextStartResult(cg: Game): PlayerId | 'tie' | null {
  const s = cg.s;
  if (s.winner !== null) return null;
  if (s.turn + 1 > s.maxTurns) return 'tie';
  return cg.P(s.active).gigs.length >= 7 ? s.active : null;
}

/** How a finished play-out is scored. All off = plain `evaluate()` (the bots before BOT-1). */
export interface PlayOutScoring {
  /** score the next start-of-turn result (`nextStartResult`) as the won, lost or tied game it is */
  wins?: boolean;
  /** clamp the score to ±playOutClamp (`clampPlayOut`) */
  clamp?: boolean;
}

/** The value of a finished play-out for p (deep rollouts, deep reactions, the reviewer's oracle, review-debug). */
export function playOutValue(cg: Game, p: PlayerId, w: EvalWeights = DEFAULT_WEIGHTS, how: PlayOutScoring = {}): number {
  const next = how.wins ? nextStartResult(cg) : null;
  const v = next === null ? evaluate(cg, p, w) : next === 'tie' ? 0 : next === p ? w.win : -w.win;
  return how.clamp ? clampPlayOut(v, w) : v;
}
