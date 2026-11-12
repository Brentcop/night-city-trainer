/**
 * Deep copy of plain JSON-like data (objects, arrays, primitives, undefined): the fast replacement for structuredClone
 * in Game.clone() and Game.probeCopy(), about 5× quicker on a game state.
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
