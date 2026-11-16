// Event entrants and the deck each one plays. A deck can be entered more than once: the second entry of "X" is named
// "X #2" (`copyName`), and the event's setup records it as `{ name: 'X #2', copyOf: 'X' }`. Small and pure, so the light
// views (the event pages, the deck page) can read it without the event formats module (src/lib/eventFormats.ts, which
// re-exports it).
//
//   - `entrantBase` is the rule the recorded data uses (ratings, head-to-heads, upsets, "Your tournaments"): the setup's
//     `copyOf`, else the name itself. It never guesses.
//   - `entrantDeckName` is the rule the views use to find an entrant's deck: the setup when it lists the entrant, else
//     one narrow fallback for an event read without its setup (the events index, an event still loading): a name
//     "X #k" (k of 2 or more) that is not itself a deck's name, where X is a deck's name, is an entry of X.

/** The parts of an entrant a lookup reads: its event name and, for an explicit copy, the name it copies. */
export interface EntrantName {
  name: string;
  copyOf?: string;
}

/** The name of an explicit duplicate entrant: "Deck #2", "Deck #3"… */
export const copyName = (base: string, k: number) => `${base} #${k}`;

/** The library deck name an event entrant plays (an explicit copy "X #2" plays X). */
export function entrantBase(setup: { entrants: readonly EntrantName[] } | null | undefined, name: string): string {
  return setup?.entrants.find((e) => e.name === name)?.copyOf ?? name;
}

const COPY = /^(.+) #(\d+)$/;

/**
 * The deck name an entrant plays, for finding its deck. `isDeck` says whether a name is a deck's name (the library).
 * With a setup that lists the entrant: exactly `entrantBase`. Otherwise (no setup, or a name it does not list) only
 * the narrow fallback: "X #k", k ≥ 2, not itself a deck's name, with X a deck's name, plays X. Anything else is itself.
 */
export function entrantDeckName(setup: { entrants?: readonly EntrantName[] } | null | undefined, name: string, isDeck: (name: string) => boolean): string {
  const listed = setup?.entrants?.find((e) => e.name === name);
  if (listed) return listed.copyOf ?? name;
  const m = COPY.exec(name);
  if (!m || Number(m[2]) < 2 || isDeck(name) || !isDeck(m[1]!)) return name;
  return m[1]!;
}

/** Which entry of its deck a copy is: k for "X #k", null when its name does not say. */
export function copyNumber(name: string, deck: string): number | null {
  const m = COPY.exec(name);
  return m && m[1] === deck && Number(m[2]) >= 2 ? Number(m[2]) : null;
}

const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth'];

/** "second entry of X" for a copy (by its name), "another entry of X" when the name does not say which. */
export function copyWords(name: string, deck: string): string {
  const k = copyNumber(name, deck);
  return k === null ? `another entry of ${deck}` : `${ORDINALS[k - 1] ?? `${k}th`} entry of ${deck}`;
}
