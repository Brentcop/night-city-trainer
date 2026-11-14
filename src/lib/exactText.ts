// Exact text of plain data, for keys that must never confuse two different values (the coach's answer cache,
// src/ui/useCoach.ts). JSON.stringify is not enough for that: it drops undefined fields, writes -0 as 0 and NaN or
// Infinity as null, and writes an object reached by two paths twice, while structuredClone (what a worker receives)
// keeps all of those apart. Two values with the same exact text are structurally identical as structuredClone sees
// them: same types, same numbers, same keys in the same order (insertion order is kept, never sorted, because code
// that iterates an object sees that order), same shared references.
//
// Only plain objects (prototype Object or null) and arrays are supported; anything else (a Map, Set, Date, class
// instance, function, symbol or bigint) gives null, meaning "no exact key: do not cache".

/** The exact text of `v`, or null when it holds something other than plain data. */
export function exactText(v: unknown): string | null {
  const seen = new Map<object, number>();
  const out: string[] = [];
  const walk = (x: unknown): boolean => {
    switch (typeof x) {
      case 'undefined':
        out.push('U');
        return true;
      case 'boolean':
        out.push(x ? 'T' : 'F');
        return true;
      case 'string':
        out.push(JSON.stringify(x));
        return true;
      case 'number':
        // String() writes NaN, Infinity and -Infinity apart; only -0 needs its own mark
        out.push(Object.is(x, -0) ? '-0' : String(x));
        return true;
      case 'object':
        break;
      default:
        return false;
    }
    if (x === null) {
      out.push('N');
      return true;
    }
    // an object met again (shared, or a cycle) is written as a reference to its first appearance
    const ref = seen.get(x);
    if (ref !== undefined) {
      out.push(`@${ref}`);
      return true;
    }
    seen.set(x, seen.size);
    if (Array.isArray(x)) {
      if (Object.getPrototypeOf(x) !== Array.prototype || Object.keys(x).length !== x.length) return false; // extra keys or holes
      out.push('[');
      for (let i = 0; i < x.length; i++) {
        if (i) out.push(',');
        if (!walk(x[i])) return false;
      }
      out.push(']');
      return true;
    }
    const proto = Object.getPrototypeOf(x);
    if (proto !== Object.prototype && proto !== null) return false;
    if (Object.getOwnPropertySymbols(x).length) return false;
    out.push(proto === null ? '{0' : '{');
    let first = true;
    for (const k of Object.keys(x)) {
      if (!first) out.push(',');
      first = false;
      out.push(JSON.stringify(k), ':');
      if (!walk((x as Record<string, unknown>)[k])) return false;
    }
    out.push('}');
    return true;
  };
  return walk(v) ? out.join('') : null;
}
