import type { CardInst, GameState } from './types';

/**
 * Deep copy of plain JSON-like data (objects, arrays, primitives, undefined): the fast replacement for structuredClone,
 * about 5× quicker on a game state. Game.clone() and Game.probeCopy() use copyGameState below, which gives exactly the
 * same copy of a state, faster.
 *
 * It is generic on purpose, so a field added to GameState is copied without touching this file. Differences from
 * structuredClone, none of which the engine relies on (tests/copy-state.test.ts compares the two on real game states):
 * - An object reached by two paths becomes two separate copies (structuredClone keeps one shared copy). The only
 *   sharing the engine creates is synapse_burnout passing one read-only `data` object to two delayed mods.
 * - Only plain objects and arrays are supported: anything else throws (a function or symbol, as structuredClone does;
 *   also a Map, Set, Date or class instance, which structuredClone would copy), because the state must stay plain data.
 * - Array holes become undefined entries (the state has none).
 */
export function copyState<T>(v: T): T {
  return copy(v) as T;
}

function copy(v: unknown): unknown {
  const t = typeof v;
  if (t !== 'object') {
    if (t === 'function' || t === 'symbol') throw new Error(`copyState: not plain data (a ${t})`);
    return v;
  }
  if (v === null) return v;
  if (Array.isArray(v)) {
    const n = v.length;
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = copy(v[i]);
    return out;
  }
  const o = v as Record<string, unknown>;
  if (o.constructor !== Object) throw new Error(`copyState: not plain data (${(o.constructor as { name?: string } | undefined)?.name ?? 'null prototype'})`);
  const out: Record<string, unknown> = {};
  for (const k in o) out[k] = copy(o[k]);
  return out;
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v) && (v as object).constructor === Object;

/** The fields of a card instance whose value is not a primitive (null and undefined count as primitives). */
type CardObjectFields = { [K in keyof CardInst]-?: NonNullable<CardInst[K]> extends string | number | boolean ? never : K }[keyof CardInst];
/**
 * The card fields copyCard copies; it takes every other field as it is. The type makes this exactly the object-valued
 * fields CardInst declares, so a new one fails the typecheck here until copyCard copies it too (otherwise a game and its
 * copy would share it). tests/copy-state.test.ts checks real cards against it.
 */
export const CARD_OBJECT_FIELDS: { readonly [K in CardObjectFields]: true } = { gear: true };

/**
 * A copy of a card instance identical to copyState's: a spread keeps the card's own keys in their order, whichever
 * optional keys it carries (`known`) and wherever they were added, and writes no key the card lacks; `gear` is replaced in
 * place by a copy. Anything that is not a plain card with a gear array is copied by copyState's rule (and refused where
 * it refuses).
 */
function copyCard(c: unknown): unknown {
  if (!isPlainObject(c) || !Array.isArray(c.gear)) return copy(c);
  return { ...c, gear: copy(c.gear) };
}

/**
 * copyState of a game state, faster: the same keys in the same order in every object (so JSON.stringify and stateHash
 * of the two copies are equal), the same values and nothing shared with the source, but each card of the `cards` record
 * is copied by a spread (copyCard) instead of key by key. The cards are most of a state, and Game.clone() runs on every
 * lookahead step. What it no longer checks at run time: that a card's fields other than `gear` hold no object, function
 * or symbol (copyState would refuse one; here it would be carried over as it is). CardObjectFields above makes that a
 * type error for every field CardInst declares, and tests/copy-state.test.ts checks on real states, hand-built states and
 * cards with and without every optional field that the copy equals copyState's and shares nothing with the source.
 */
export function copyGameState(s: GameState): GameState {
  if (!isPlainObject(s)) return copy(s) as GameState;
  const out: Record<string, unknown> = {};
  for (const k in s) {
    const v = s[k];
    if (k === 'cards' && isPlainObject(v)) {
      const cards: Record<string, unknown> = {};
      for (const u in v) cards[u] = copyCard(v[u]);
      out[k] = cards;
    } else out[k] = copy(v);
  }
  return out as unknown as GameState;
}
