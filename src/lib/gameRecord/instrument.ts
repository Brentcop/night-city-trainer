// Hooks on one running game, from outside the engine (no engine file is changed): they see every read of the top of a
// deck, every random number and every die roll, and can steer them. The exporter (./exporter.ts) only watches; the replay
// (./replay.ts) puts the recorded cards on top of a deck just before the engine reads it, and picks the random-number
// state that makes the next die show the recorded result.
//
// How, given that the state must stay plain data (copyState throws on anything else):
//  - each deck array is wrapped in a Proxy. Every way the engine reads a deck's top goes through it: `shift()` (a draw),
//    `slice(0, n)` (look at the top n) and `[0]` (the top card: mills, reveals). Methods run on the real array.
//  - `rng` on the state and `value` on each Gig become accessor properties. nextRandom reads `rng` once and writes it
//    once; a Gig value written straight after a random number is a die roll (rollIn and reroll are the only places).
//  - while an agent decides, and while the engine copies the state (Game.clone, Game.probeCopy), every hook is taken
//    off again (`pause`), so lookahead, probes and anything that copies the state see plain data and plain arrays.
// The hooks change nothing by themselves: a watched game plays exactly like an unwatched one
// (tests/game-record.test.ts checks the log, the result and the RNG).
import type { Game } from '../../engine/engine';
import type { Gig, PlayerId } from '../../engine/types';

export type ReadKind = 'draw' | 'top' | 'look';

export interface InstrumentHooks {
  /** a random number is about to be drawn from RNG state `state`: return the state to draw it from (default: `state`) */
  rng?(state: number): number;
  /** the engine is about to read the top of p's deck (`deck` is the real array: rearrange it here to steer the read) */
  beforeRead?(p: PlayerId, kind: ReadKind, n: number, deck: number[]): void;
  /** what that read gave (uids, top first; empty when the deck was empty) */
  afterRead?(p: PlayerId, kind: ReadKind, uids: number[]): void;
  /** a die roll just set this Gig's value ('in': rolled in from the fixer area; 're': rerolled where it is) */
  die?(gig: Gig, how: 'in' | 're'): void;
}

export interface Instrument {
  /** take every hook off (nested calls count); the state is plain data until the matching resume() */
  pause(): void;
  resume(): void;
  /** take every hook off for good */
  uninstall(): void;
  /** the real deck array of a player (no hooks) */
  deck(p: PlayerId): number[];
}

type Last = 'rng' | 'index' | 'other';

export function instrument(g: Game, hooks: InstrumentHooks): Instrument {
  const s = g.s;
  let last: Last = 'other';
  let paused = 0;
  let removed = false;
  let rngValue = s.rng;
  const gigs = Object.values(s.gigs);
  const gigValue = new Map<number, number>(gigs.map((x) => [x.id, x.value]));
  const raw: [number[], number[]] = [s.players[0].deck, s.players[1].deck];

  const proxy = (p: PlayerId, target: number[]): number[] =>
    new Proxy(target, {
      get(t, prop, receiver) {
        if (prop === 'shift')
          return () => {
            last = 'other';
            hooks.beforeRead?.(p, 'draw', 1, t);
            const u = t.shift();
            hooks.afterRead?.(p, 'draw', u === undefined ? [] : [u]);
            last = 'other';
            return u;
          };
        if (prop === 'slice')
          return (a?: number, b?: number) => {
            last = 'other';
            if ((a ?? 0) === 0 && b !== undefined && b > 0) {
              hooks.beforeRead?.(p, 'look', b, t);
              const out = t.slice(0, b);
              hooks.afterRead?.(p, 'look', out);
              last = 'other';
              return out;
            }
            return t.slice(a, b);
          };
        if (prop === '0') {
          // a top read, unless it is part of a shuffle's swap (read right after a random number or another index read)
          if (last === 'rng' || last === 'index') {
            last = 'index';
            return t[0];
          }
          hooks.beforeRead?.(p, 'top', 1, t);
          const u = t[0];
          hooks.afterRead?.(p, 'top', u === undefined ? [] : [u]);
          last = 'other';
          return u;
        }
        if (typeof prop === 'string' && /^\d+$/.test(prop)) {
          last = 'index';
          return t[Number(prop)];
        }
        const v = Reflect.get(t, prop, receiver);
        if (typeof v === 'function' && prop !== 'constructor')
          return (...args: unknown[]) => {
            last = 'other';
            return (v as (...a: unknown[]) => unknown).apply(t, args);
          };
        return v;
      },
      set(t, prop, value) {
        last = 'other';
        return Reflect.set(t, prop, value);
      },
    });

  const defineRng = () =>
    Object.defineProperty(s, 'rng', {
      configurable: true,
      enumerable: true,
      get: () => (hooks.rng ? hooks.rng(rngValue) : rngValue),
      set: (v: number) => {
        rngValue = v;
        last = 'rng';
      },
    });
  const defineGig = (gig: Gig) =>
    Object.defineProperty(gig, 'value', {
      configurable: true,
      enumerable: true,
      get: () => gigValue.get(gig.id)!,
      set: (v: number) => {
        gigValue.set(gig.id, v);
        const roll = last === 'rng';
        last = 'other';
        if (roll) hooks.die?.(gig, gig.controller === null ? 'in' : 're');
      },
    });

  const install = () => {
    rngValue = s.rng;
    defineRng();
    for (const gig of gigs) {
      gigValue.set(gig.id, gig.value);
      defineGig(gig);
    }
    for (const p of [0, 1] as PlayerId[]) {
      raw[p] = s.players[p].deck;
      s.players[p].deck = proxy(p, raw[p]);
    }
    last = 'other';
  };
  const takeOff = () => {
    Object.defineProperty(s, 'rng', { configurable: true, enumerable: true, writable: true, value: rngValue });
    for (const gig of gigs) Object.defineProperty(gig, 'value', { configurable: true, enumerable: true, writable: true, value: gigValue.get(gig.id) });
    for (const p of [0, 1] as PlayerId[]) s.players[p].deck = raw[p];
  };

  const pause = () => {
    if (removed) return;
    if (paused++ === 0) takeOff();
  };
  const resume = () => {
    if (removed) return;
    if (--paused === 0) install();
  };

  // the engine copies the state in clone() and probeCopy(): hooks off while it does
  const own = g as unknown as Record<'clone' | 'probeCopy', unknown>;
  const clone = g.clone;
  const probeCopy = g.probeCopy;
  own.clone = function (this: Game, ...args: Parameters<Game['clone']>) {
    pause();
    try {
      return clone.apply(this, args);
    } finally {
      resume();
    }
  };
  own.probeCopy = function (this: Game) {
    pause();
    try {
      return probeCopy.apply(this);
    } finally {
      resume();
    }
  };

  install();
  return {
    pause,
    resume,
    uninstall() {
      if (removed) return;
      if (paused === 0) takeOff();
      removed = true;
      delete own.clone;
      delete own.probeCopy;
    },
    deck: (p) => raw[p],
  };
}
