// Event formats and hand-arranged events: the setup an event is run from (entrants, format, pairings set by hand,
// top-cut seeds, a fixed bracket, a match list, best-of per bracket round, who goes first) and the pure pairing,
// bracket and schedule functions the runner (runTournament in src/lib/tournament.ts, which re-exports this module)
// plays them with. Shared by the CLI (scripts/tournament.ts) and the in-browser runner (#/run); nothing here plays a game.
//
// Formats
//   swiss         Swiss rounds (algorithm pairings; any round's pairings can be set by hand), then a top cut seeded by
//                 the standings or by a manual order.
//   single-elim   a fixed bracket: entrants in seed order (byes to the top seeds when the field is not a power of two)
//                 or placed slot by slot (null slots are byes); best-of per round.
//   round-robin   everyone plays everyone (each pairing `times` times, seats mirrored on repeats if asked); with
//                 `groups` > 1, a round robin in each group and the top `advance` of each group go to a bracket.
//   matches       a "showdown": exactly the listed matches (A vs B Bo3, played N times, seats mirrored), in rounds,
//                 with a results table and no champion.
//
// Seeds (see matchSeedBase): a match's game seeds are its seed base + game index (0..bestOf-1).
//   table scheme  (the original one, unchanged) Swiss round r, table k: event seed × 1,000,000 + r × 10,000 + k × 10;
//                 top cut round i, table k: event seed × 1,000,000 + 900,000 + i × 10,000 + k × 10. Used by every Swiss
//                 round and top cut with no hand-set input, so default events play exactly as before.
//   keyed scheme  every other match: a hash of the event seed and a stable match key (stage, round, the two decks in
//                 seat order, and the repeat number), so a match's games do not depend on the table it lands on or on
//                 which other matches were arranged. Keys: swiss:<round>:<A>|<B>, top:<i>:<A>|<B>, ko:<i>:<A>|<B>,
//                 rr:<A>|<B>#<repeat>, m:<round>:<A>|<B>#<occurrence>.

export type BestOf = 1 | 3 | 5;
export const BEST_OF: readonly BestOf[] = [1, 3, 5];
export type EventFormat = 'swiss' | 'single-elim' | 'round-robin' | 'matches';
export const EVENT_FORMATS: readonly { key: EventFormat; label: string; hint: string }[] = [
  { key: 'swiss', label: 'Swiss + top cut', hint: 'Swiss rounds paired by record, then a single-elimination top cut. Set any pairing by hand.' },
  { key: 'single-elim', label: 'Bracket', hint: 'Single elimination from a bracket you arrange: seed order or slot by slot.' },
  { key: 'round-robin', label: 'Round robin', hint: 'Everyone plays everyone; optionally in groups, then a bracket.' },
  { key: 'matches', label: 'Match list', hint: 'Exactly the matches you list (A vs B Bo3, C vs D Bo5…), with a results table.' },
];
export const isEventFormat = (s: string): s is EventFormat => EVENT_FORMATS.some((f) => f.key === s);

/** Game 1 of a series: seat by a coin flip from the match seed (default), seat A, seat B, or alternating by table. */
export type Game1Rule = 'coin' | 'a' | 'b' | 'alternate';
/** Games 2+: the loser of the previous game goes first (default), or the seats alternate. */
export type NextRule = 'loser' | 'alternate';
export const GAME1_RULES: readonly { key: Game1Rule; label: string }[] = [
  { key: 'coin', label: 'Coin flip (from the seed)' },
  { key: 'a', label: 'First-named deck' },
  { key: 'b', label: 'Second-named deck' },
  { key: 'alternate', label: 'Alternate by table' },
];
export const NEXT_RULES: readonly { key: NextRule; label: string }[] = [
  { key: 'loser', label: 'Loser goes first' },
  { key: 'alternate', label: 'Alternate seats' },
];

/** An entrant: its event name (unique), its library file, and for an explicit duplicate the name it copies ("X #2"). */
export interface EntrantRef {
  name: string;
  file?: string;
  copyOf?: string;
}
/** A pairing set by hand. A rematch must be ticked (`rematch: true`) to be allowed. */
export interface ForcedPair {
  a: string;
  b: string;
  rematch?: boolean;
}
/** One line of a match list: A vs B (A in seat A), best-of, played `times` times, seats swapped on every other repeat with `mirror`. */
export interface MatchSpec {
  a: string;
  b: string;
  bestOf?: BestOf;
  times?: number;
  mirror?: boolean;
  /** the round it is played in (default 1) */
  round?: number;
}

/**
 * How an event is run. Recorded on the event (`setup`) whenever anything departs from a plain Swiss event, so the
 * event can be re-run (same code + same seed + same setup = same event) and readers can tell how it was arranged.
 */
export interface EventSetup {
  format: EventFormat;
  /** in seed order (Swiss: the order the standings start in) */
  entrants: EntrantRef[];
  /** best-of for every series unless a round or match says otherwise */
  bestOf: BestOf;
  game1?: Game1Rule;
  next?: NextRule;
  /** swiss: rounds */
  rounds?: number;
  /** swiss: top-cut size (rounded down to a power of two that fits) */
  top?: number;
  /** swiss: pairings set by hand, by round number; unlisted entrants are paired by the algorithm among themselves */
  pairings?: Record<number, ForcedPair[]>;
  /** swiss: the top-cut seeds in order, set by hand (default: the standings) */
  cutSeeds?: string[];
  /** best-of per bracket round (top cut, single elimination, groups bracket), first round first; missing rounds use bestOf */
  bracketBestOf?: BestOf[];
  /** single-elim: the bracket's first-round slots (length a power of two, null = bye); absent = seeded from entrant order */
  bracket?: (string | null)[];
  /** round-robin: times each pairing is played */
  times?: number;
  /** round-robin / matches: swap seats on every other repeat */
  mirror?: boolean;
  /** round-robin: number of groups (1 = one table) */
  groups?: number;
  /** round-robin with groups: decks per group that go to the bracket */
  advance?: number;
  /** matches: the match list */
  matches?: MatchSpec[];
}

/** The name of an explicit duplicate entrant: "Deck #2", "Deck #3"… */
export const copyName = (base: string, k: number) => `${base} #${k}`;

// ---------------------------------------------------------------- small helpers

export function autoRounds(n: number) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))) + (n > 16 ? 3 : 1));
}
/** Largest power of two ≤ requested top cut and ≤ field size. */
export function cutSize(top: number, n: number) {
  let s = 1;
  while (s * 2 <= Math.min(top, n)) s *= 2;
  return s >= 2 ? s : 0;
}
/** Smallest power of two ≥ n (at least 2). */
export function bracketSize(n: number) {
  let s = 2;
  while (s < n) s *= 2;
  return s;
}
/** Standard bracket order: 1v8, 4v5, 2v7, 3v6 for 8 (indices into the seed list). */
export function bracketOrder(size: number) {
  let o = [0, 1];
  while (o.length < size) o = o.flatMap((x) => [x, o.length * 2 - 1 - x]);
  return o.slice(0, size);
}
/** Name of a bracket round by the number of slots in it. */
export const roundName = (alive: number) => (alive === 2 ? 'Final' : alive === 4 ? 'Semifinals' : alive === 8 ? 'Quarterfinals' : `Round of ${alive}`);

/** Games a player needs to win a best-of-N. */
export const winsNeeded = (bo: number) => Math.ceil(bo / 2);
/** Expected games of a best-of-N between even decks (Bo1 1, Bo3 2.5, Bo5 4.125). */
export const avgGames = (bo: number) => (bo === 1 ? 1 : bo === 3 ? 2.5 : bo === 5 ? 4.125 : (bo + winsNeeded(bo)) / 2);

/** FNV-1a 32-bit hash of a string. */
function fnv32(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/**
 * The keyed seed base of a match: a multiple of 10 from a hash of the event seed and the match key, so game i of the
 * match plays seed base + i (Bo5 uses 0..4). Seat B's bot seed is game seed + 7777, as everywhere.
 */
export function matchSeedBase(eventSeed: number, key: string) {
  return ((fnv32(`${eventSeed}|${key}`) % 99_999_989) + 1) * 10;
}

/** Deterministic integer hash bit (also used for the game-1 coin flip). */
export const hashBit = (x: number, shift = 16) => (Math.imul(x, 2654435761) >>> shift) & 1;

/**
 * Who goes first in game `gi` of a series (0 = seat A). `prev` is the previous game; `alt` the match's table index
 * plus its repeat number (for the 'alternate' game-1 rule). With the defaults (coin, loser) this is the rule every
 * recorded event used: a coin flip from the seed base for game 1, then the loser of the previous game (after a tie,
 * the other seat).
 */
export function firstPlayer(o: { gi: number; prev?: { first: 0 | 1; winner: 0 | 1 | 'tie' }; seedBase: number; game1?: Game1Rule; next?: NextRule; alt?: number }): 0 | 1 {
  const { prev } = o;
  if (!prev || o.gi === 0) {
    switch (o.game1 ?? 'coin') {
      case 'a':
        return 0;
      case 'b':
        return 1;
      case 'alternate':
        return ((o.alt ?? 0) % 2) as 0 | 1;
      default:
        return hashBit(o.seedBase) ? 1 : 0;
    }
  }
  if ((o.next ?? 'loser') === 'alternate' || prev.winner === 'tie') return (1 - prev.first) as 0 | 1;
  return (1 - prev.winner) as 0 | 1;
}

// ---------------------------------------------------------------- Swiss pairings

/** Cap on search steps per pairing pass, so a pathological late round can't stall the event (deterministic). */
const SEARCH_LIMIT = 200_000;

/** What a Swiss pairing pass reads of a standings row. */
export interface PairingRow {
  deck: string;
  mp: number;
  opps: string[];
}

/**
 * Swiss pairings for one round. Decks are ordered by match points (random order within a point group). A backtracking
 * search pairs the top unpaired deck with the first legal partner below it, recursing and backtracking on failure, so a
 * rematch happens only when no rematch-free matching exists. With an odd field the bye goes to the lowest-ranked deck
 * without one that still leaves a rematch-free matching; only if none does are rematches allowed (as few as possible).
 *
 * `forced` pairings (set by hand) are taken out first and the rest are paired among themselves. Every deck still draws
 * its random key, so the random stream (and every later round) moves only as far as the forced pairings make it.
 */
export function swissPairings(st: ReadonlyMap<string, PairingRow>, r: () => number, forced: readonly ForcedPair[] = []): { pairs: [string, string][]; bye: string | null } {
  const ranked = [...st.values()].map((s) => ({ s, k: r() })).sort((x, y) => y.s.mp - x.s.mp || x.k - y.k).map((x) => x.s.deck);
  const taken = new Set(forced.flatMap((p) => [p.a, p.b]));
  const order = taken.size ? ranked.filter((d) => !taken.has(d)) : ranked;
  const met = new Map(order.map((d) => [d, new Set(st.get(d)?.opps ?? [])]));
  const hadBye = (d: string) => met.get(d)?.has('BYE') ?? false;
  const rematch = (a: string, b: string) => met.get(a)?.has(b) ?? false;
  // bye candidates: lowest-ranked first, decks that already had a bye only if everyone has had one
  const byeCands: (string | null)[] = order.length % 2 ? [...order].reverse().filter((d) => !hadBye(d)) : [null];
  const last = order[order.length - 1];
  if (!byeCands.length && last !== undefined) byeCands.push(last);

  let steps = 0;
  /** Rematch-free perfect matching of `rest` (score order kept), or null. */
  const strict = (rest: string[]): [string, string][] | null => {
    const [d, ...tail] = rest;
    if (d === undefined) return [];
    if (++steps > SEARCH_LIMIT) return null;
    // prune: every remaining deck must still have a legal partner
    for (const x of rest) if (!rest.some((o) => o !== x && !rematch(x, o))) return null;
    for (const [i, o] of tail.entries()) {
      if (rematch(d, o)) continue;
      const sub = strict([...tail.slice(0, i), ...tail.slice(i + 1)]);
      if (sub) return [[d, o], ...sub];
    }
    return null;
  };
  for (const bye of byeCands) {
    steps = 0;
    const pairs = strict(order.filter((d) => d !== bye));
    if (pairs) return { pairs, bye };
  }

  // No rematch-free matching: branch and bound for the fewest rematches (fresh partners tried first).
  let best: { pairs: [string, string][]; bye: string | null; cost: number } | null = null;
  const min = (rest: string[], acc: [string, string][], cost: number, bye: string | null) => {
    if (best && cost >= best.cost) return;
    const [d, ...tail] = rest;
    if (d === undefined) {
      best = { pairs: [...acc], bye, cost };
      return;
    }
    if (++steps > SEARCH_LIMIT && best) return;
    const partners = [...tail.entries()];
    for (const [i, o] of [...partners.filter(([, o]) => !rematch(d, o)), ...partners.filter(([, o]) => rematch(d, o))]) {
      acc.push([d, o]);
      min([...tail.slice(0, i), ...tail.slice(i + 1)], acc, cost + (rematch(d, o) ? 1 : 0), bye);
      acc.pop();
    }
  };
  steps = 0;
  for (const bye of byeCands) min(order.filter((d) => d !== bye), [], 0, bye);
  const b = best as unknown as { pairs: [string, string][]; bye: string | null };
  return { pairs: b.pairs, bye: b.bye };
}

/** The pairing RNG of an event (Swiss pairing order within a point group). */
export function pairingRng(eventSeed: number) {
  let s = (eventSeed * 7919 + 13) >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/**
 * Round 1 of a Swiss event as the runner will pair it, before anything is played: forced pairings first, then the
 * algorithm's, then the bye. Lets the setup page show the exact opening round.
 */
export function swissRound1(entrants: readonly string[], eventSeed: number, forced: readonly ForcedPair[] = []): { a: string; b: string | null; set?: true }[] {
  const st = new Map(entrants.map((d) => [d, { deck: d, mp: 0, opps: [] as string[] }]));
  const { pairs, bye } = swissPairings(st, pairingRng(eventSeed), forced);
  return [...forced.map((p) => ({ a: p.a, b: p.b, set: true as const })), ...pairs.map(([a, b]) => ({ a, b })), ...(bye ? [{ a: bye, b: null }] : [])];
}

/**
 * Problems with a round's hand-set pairings (empty when they are fine): unknown decks, a deck paired with itself or
 * twice in the round, and rematches that are not ticked. `met(a, b)` says whether they have already played.
 */
export function forcedPairProblems(entrants: readonly string[], pairs: readonly ForcedPair[], met: (a: string, b: string) => boolean = () => false): string[] {
  const known = new Set(entrants);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const p of pairs) {
    for (const d of [p.a, p.b]) if (!known.has(d)) out.push(`${d} is not an entrant`);
    if (p.a === p.b) out.push(`${p.a} can't play itself`);
    for (const d of [p.a, p.b]) {
      if (seen.has(d) && p.a !== p.b) out.push(`${d} is paired twice in the round`);
      seen.add(d);
    }
    if (p.a !== p.b && met(p.a, p.b) && !p.rematch) out.push(`${p.a} vs ${p.b} is a rematch: tick "allow rematch" to keep it`);
  }
  return [...new Set(out)];
}

// ---------------------------------------------------------------- brackets

/** First-round slots of a bracket seeded from `seeds` (best first): byes (null) go to the top seeds. */
export function seededSlots(seeds: readonly string[]): (string | null)[] {
  return bracketOrder(bracketSize(seeds.length)).map((i) => seeds[i] ?? null);
}

/** Problems with a hand-arranged bracket (empty when it is fine). */
export function bracketProblems(slots: readonly (string | null)[], entrants: readonly string[]): string[] {
  const out: string[] = [];
  const n = slots.length;
  if (n < 2 || (n & (n - 1)) !== 0) out.push(`a bracket needs a power-of-two number of slots (2, 4, 8…), this one has ${n}`);
  const known = new Set(entrants);
  const named = slots.filter((s): s is string => s !== null);
  for (const d of named) if (!known.has(d)) out.push(`${d} is not an entrant`);
  const dup = named.filter((d, i) => named.indexOf(d) !== i);
  if (dup.length) out.push(`${[...new Set(dup)].join(', ')} ${dup.length > 1 ? 'are' : 'is'} in the bracket twice`);
  if (named.length < 2) out.push('a bracket needs at least 2 decks');
  for (let i = 0; i + 1 < n; i += 2) if (slots[i] === null && slots[i + 1] === null) out.push(`first-round match ${i / 2 + 1} has two byes`);
  return out;
}

/**
 * Standings of a single-elimination event in bracket order: the champion, then the finalist, then the decks that went out
 * in the semifinals, and so on (ties keep the order they came in: match points, then tiebreaks).
 */
export function rankByBracket<T extends { deck: string }>(rows: readonly T[], bracket: readonly { matches: readonly { a: string; b: string | null }[] }[], champion: string | null): T[] {
  const reached = new Map<string, number>();
  bracket.forEach((r, i) => {
    for (const m of r.matches) for (const d of [m.a, m.b]) if (d !== null) reached.set(d, i);
  });
  if (champion) reached.set(champion, bracket.length);
  return rows
    .map((r, i) => ({ r, i, k: reached.get(r.deck) ?? -1 }))
    .sort((x, y) => y.k - x.k || x.i - y.i)
    .map((x) => x.r);
}

// ---------------------------------------------------------------- round robin

export interface ScheduledMatch {
  a: string;
  b: string;
  /** which repeat of this pairing (0 = first) */
  rep: number;
}

/**
 * Round-robin schedule by the circle method: n−1 rounds for an even field, n for an odd one (one deck sits out each
 * round). Each pairing is played `times` times (the schedule repeats); with `mirror`, every other repeat swaps seats.
 * Within a pass the seats are balanced (each deck has seat A in about half its matches).
 */
export function roundRobinSchedule(names: readonly string[], times = 1, mirror = false): ScheduledMatch[][] {
  const ring: (string | null)[] = [...names];
  if (ring.length % 2) ring.push(null);
  const n = ring.length;
  const pass: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const x = ring[i];
      const y = ring[n - 1 - i];
      if (x == null || y == null) continue;
      // the fixed deck alternates seats by round; the others by position, so seats stay balanced
      round.push((i === 0 ? r % 2 === 1 : i % 2 === 1) ? [y, x] : [x, y]);
    }
    pass.push(round);
    // rotate everything but the first deck
    const moved = ring.splice(n - 1, 1)[0] ?? null;
    ring.splice(1, 0, moved);
  }
  const out: ScheduledMatch[][] = [];
  for (let t = 0; t < Math.max(1, times); t++) for (const round of pass) out.push(round.map(([a, b]) => (mirror && t % 2 === 1 ? { a: b, b: a, rep: t } : { a, b, rep: t })));
  return out;
}

/** Split entrants (seed order) into groups by snake order: 1→A, 2→B, …, then back. */
export function groupSplit(names: readonly string[], groups: number): string[][] {
  const g = Math.max(1, Math.min(groups, names.length));
  const out: string[][] = Array.from({ length: g }, () => []);
  names.forEach((d, i) => {
    const pass = Math.floor(i / g);
    const k = i % g;
    out[pass % 2 ? g - 1 - k : k]?.push(d);
  });
  return out;
}
export const groupName = (i: number) => `Group ${String.fromCharCode(65 + (i % 26))}`;

/** Bracket seeds from group standings: every group's winner (group order), then every runner-up, and so on. */
export function groupSeeds(groupStandings: readonly (readonly string[])[], advance: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < advance; k++) for (const g of groupStandings) if (g[k] !== undefined) out.push(g[k] as string);
  return out;
}

// ---------------------------------------------------------------- match lists

export interface ListedMatch {
  a: string;
  b: string;
  bestOf: BestOf;
  /** repeat of its line (0 = first) */
  rep: number;
  /** occurrence of this seat-ordered pairing in its round (for the seed key) */
  occ: number;
}

/** A match list expanded into rounds (ascending round number): repeats, mirrored seats and per-line best-of applied. */
export function expandMatchList(specs: readonly MatchSpec[], bestOf: BestOf): { round: number; matches: ListedMatch[] }[] {
  const rounds = new Map<number, ListedMatch[]>();
  for (const s of specs) {
    const round = Math.max(1, Math.floor(s.round ?? 1));
    const list = rounds.get(round) ?? [];
    rounds.set(round, list);
    for (let t = 0; t < Math.max(1, Math.floor(s.times ?? 1)); t++) {
      const [a, b] = s.mirror && t % 2 === 1 ? [s.b, s.a] : [s.a, s.b];
      const occ = list.filter((m) => m.a === a && m.b === b).length;
      list.push({ a, b, bestOf: s.bestOf ?? bestOf, rep: t, occ });
    }
  }
  return [...rounds.entries()].sort((x, y) => x[0] - y[0]).map(([round, matches]) => ({ round, matches }));
}

/** Problems with a match list (empty when it is fine). */
export function matchListProblems(specs: readonly MatchSpec[], entrants: readonly string[]): string[] {
  const known = new Set(entrants);
  const out: string[] = [];
  if (!specs.length) out.push('the match list is empty');
  specs.forEach((s, i) => {
    const at = `match ${i + 1}`;
    for (const d of [s.a, s.b]) if (!known.has(d)) out.push(`${at}: ${d || '(none)'} is not an entrant`);
    if (s.a === s.b) out.push(`${at}: a deck can't play itself (add a copy, "#2", for a mirror match)`);
    if (s.bestOf !== undefined && !BEST_OF.includes(s.bestOf)) out.push(`${at}: best-of must be 1, 3 or 5`);
    if (s.times !== undefined && (!Number.isInteger(s.times) || s.times < 1 || s.times > 100)) out.push(`${at}: times must be a whole number from 1 to 100`);
    if (s.round !== undefined && (!Number.isInteger(s.round) || s.round < 1 || s.round > 99)) out.push(`${at}: round must be a whole number from 1 to 99`);
  });
  return out;
}

// ---------------------------------------------------------------- whole setups

/** The best-of of bracket round `i` (0 = first). */
export const bracketBo = (s: Pick<EventSetup, 'bestOf' | 'bracketBestOf'>, i: number): BestOf => s.bracketBestOf?.[i] ?? s.bestOf;

const anyPairings = (s: EventSetup) => Object.values(s.pairings ?? {}).some((p) => p.length > 0);

/**
 * A standard event: Swiss rounds paired by the algorithm and a top cut seeded by the standings. Titles, top-8 counts,
 * Swiss records and finishes come only from standard events; every other event is recorded with `custom: true`.
 */
export function isStandardSetup(s: EventSetup | null | undefined): boolean {
  return !s || (s.format === 'swiss' && !anyPairings(s) && !s.cutSeeds?.length);
}
/**
 * A plain event: standard, and every option at its default (Bo1 or Bo3, coin flip then loser first, one best-of
 * throughout, no duplicate entrants). A plain event records no `setup` and plays exactly as events always have.
 */
export function isPlainSetup(s: EventSetup | null | undefined): boolean {
  if (!s) return true;
  return (
    isStandardSetup(s) &&
    (s.bestOf === 1 || s.bestOf === 3) &&
    (s.game1 ?? 'coin') === 'coin' &&
    (s.next ?? 'loser') === 'loser' &&
    (s.bracketBestOf ?? []).every((b) => b === s.bestOf) &&
    !s.entrants.some((e) => e.copyOf)
  );
}

/** Bracket rounds of a bracket with `slots` first-round slots. */
export const bracketRounds = (slots: number) => (slots >= 2 ? Math.round(Math.log2(bracketSize(slots))) : 0);

/** The number of decks in the bracket stage of a setup (0 = none) and its first-round slot count. */
export function bracketPlan(s: EventSetup, n: number): { decks: number; slots: number } {
  if (s.format === 'swiss') {
    const c = s.cutSeeds?.length ? s.cutSeeds.length : cutSize(s.top ?? 0, n);
    return { decks: c, slots: c };
  }
  if (s.format === 'single-elim') {
    if (s.bracket) return { decks: s.bracket.filter((x) => x !== null).length, slots: s.bracket.length };
    return { decks: n, slots: n >= 2 ? bracketSize(n) : 0 };
  }
  if (s.format === 'round-robin' && (s.groups ?? 1) > 1 && (s.advance ?? 0) > 0) {
    const sizes = groupSplit(Array.from({ length: n }, (_, i) => String(i)), s.groups ?? 1).map((g) => g.length);
    const d = sizes.reduce((a, x) => a + Math.min(x, s.advance ?? 0), 0);
    return { decks: d, slots: d >= 2 ? bracketSize(d) : 0 };
  }
  return { decks: 0, slots: 0 };
}

/** Matches per bracket round for a bracket of `decks` in `slots` slots (round 1 skips the byes). */
function bracketMatches(decks: number, slots: number): number[] {
  const out: number[] = [];
  for (let alive = slots, i = 0; alive > 1; alive /= 2, i++) out.push(i === 0 ? decks - alive / 2 : alive / 2);
  return out;
}

/** Rounds and matches a setup will play with `n` entrants (Swiss rounds count as rounds, the bracket separately). */
export function eventShape(s: EventSetup, n: number): { rounds: number; roundMatches: { bo: number; count: number }[]; bracket: number[] } {
  const bp = bracketPlan(s, n);
  const bracket = bp.decks >= 2 ? bracketMatches(bp.decks, bp.slots) : [];
  switch (s.format) {
    case 'swiss': {
      const rounds = s.rounds ?? autoRounds(n);
      return { rounds, roundMatches: [{ bo: s.bestOf, count: rounds * Math.floor(n / 2) }], bracket };
    }
    case 'single-elim':
      return { rounds: 0, roundMatches: [], bracket };
    case 'round-robin': {
      const groups = groupSplit(Array.from({ length: n }, (_, i) => String(i)), s.groups ?? 1);
      const times = Math.max(1, s.times ?? 1);
      const count = groups.reduce((a, g) => a + ((g.length * (g.length - 1)) / 2) * times, 0);
      const rounds = Math.max(0, ...groups.map((g) => (g.length % 2 ? g.length : g.length - 1) * times));
      return { rounds, roundMatches: [{ bo: s.bestOf, count }], bracket };
    }
    case 'matches': {
      const ex = expandMatchList(s.matches ?? [], s.bestOf);
      const byBo = new Map<number, number>();
      for (const r of ex) for (const m of r.matches) byBo.set(m.bestOf, (byBo.get(m.bestOf) ?? 0) + 1);
      return { rounds: ex.length, roundMatches: [...byBo.entries()].map(([bo, count]) => ({ bo, count })), bracket: [] };
    }
  }
}

/**
 * Games a setup will play with `n` entrants: `estimate` (even matches), `min` (every series a sweep) and `max` (every
 * series goes the distance). For a plain Swiss event `estimate` and `max` are the numbers the runner has always used.
 */
export function estimateGames(s: EventSetup, n: number): { estimate: number; min: number; max: number; matches: number } {
  const sh = eventShape(s, n);
  const series = [...sh.roundMatches, ...sh.bracket.map((count, i) => ({ bo: bracketBo(s, i), count }))];
  let est = 0;
  let min = 0;
  let max = 0;
  let matches = 0;
  for (const { bo, count } of series) {
    est += count * avgGames(bo);
    min += count * winsNeeded(bo);
    max += count * bo;
    matches += count;
  }
  return { estimate: Math.round(est), min, max, matches };
}

/** Problems with a whole setup for these entrant names (empty = it can run). */
export function setupProblems(s: EventSetup): string[] {
  const names = s.entrants.map((e) => e.name);
  const out: string[] = [];
  const dup = names.filter((d, i) => names.indexOf(d) !== i);
  if (dup.length) out.push(`entrant names must be unique (${[...new Set(dup)].join(', ')}); add a copy as "#2"`);
  if (!BEST_OF.includes(s.bestOf)) out.push('best-of must be 1, 3 or 5');
  for (const b of s.bracketBestOf ?? []) if (!BEST_OF.includes(b)) out.push('bracket best-of must be 1, 3 or 5');
  const n = names.length;
  switch (s.format) {
    case 'swiss': {
      if (n < 2) out.push('Swiss needs at least 2 entrants');
      if (s.rounds !== undefined && (!Number.isInteger(s.rounds) || s.rounds < 1 || s.rounds > 30)) out.push('Swiss rounds must be 1 to 30');
      for (const [round, pairs] of Object.entries(s.pairings ?? {})) for (const p of forcedPairProblems(names, pairs)) out.push(`round ${round}: ${p}`);
      if (s.cutSeeds?.length) {
        const c = s.cutSeeds.length;
        if ((c & (c - 1)) !== 0 || c < 2) out.push(`a manual top cut needs 2, 4, 8 or 16 seeds, not ${c}`);
        if (s.cutSeeds.some((d) => !names.includes(d))) out.push('every top-cut seed must be an entrant');
        if (new Set(s.cutSeeds).size !== c) out.push('a deck is seeded twice in the top cut');
      }
      break;
    }
    case 'single-elim':
      if (n < 2) out.push('a bracket needs at least 2 entrants');
      if (s.bracket) out.push(...bracketProblems(s.bracket, names));
      break;
    case 'round-robin': {
      const g = s.groups ?? 1;
      if (n < 2) out.push('a round robin needs at least 2 entrants');
      if (!Number.isInteger(g) || g < 1) out.push('groups must be a whole number ≥ 1');
      else if (g > 1 && n < 2 * g) out.push(`${g} groups need at least ${2 * g} entrants`);
      if (s.times !== undefined && (!Number.isInteger(s.times) || s.times < 1 || s.times > 20)) out.push('each pairing can be played 1 to 20 times');
      if (g > 1 && s.advance !== undefined && (!Number.isInteger(s.advance) || s.advance < 0)) out.push('decks advancing per group must be a whole number');
      break;
    }
    case 'matches':
      out.push(...matchListProblems(s.matches ?? [], names));
      break;
  }
  return out;
}

/** One line on what the field gives in this format: byes, sitting out, bracket size. */
export function fieldNote(s: EventSetup): string {
  const n = s.entrants.length;
  const bp = bracketPlan(s, n);
  const plural = (k: number, w: string) => `${k} ${w}${k === 1 ? '' : w.endsWith('ch') ? 'es' : 's'}`;
  switch (s.format) {
    case 'swiss':
      return n < 2
        ? 'Swiss needs at least 2 entrants.'
        : `${plural(n, 'entrant')}${n % 2 ? ': one bye each round (a win), never twice to the same deck' : ', no byes'}${bp.decks ? ` · top ${bp.decks}` : ' · no top cut'}.`;
    case 'single-elim':
      return n < 2 ? 'A bracket needs at least 2 entrants.' : `${plural(bp.decks, 'deck')} in a bracket of ${bp.slots}${bp.slots > bp.decks ? `: ${plural(bp.slots - bp.decks, 'bye')}${s.bracket ? '' : ' to the top seeds'}` : ', no byes'}.`;
    case 'round-robin': {
      const g = s.groups ?? 1;
      if (n < 2) return 'A round robin needs at least 2 entrants.';
      const groups = groupSplit(s.entrants.map((e) => e.name), g);
      const odd = groups.some((x) => x.length % 2);
      return `${plural(n, 'entrant')}${g > 1 ? ` in ${g} groups of ${[...new Set(groups.map((x) => x.length))].join(' or ')}` : ''}${odd ? ': one deck sits out each round (no points)' : ''}${bp.decks >= 2 ? ` · top ${s.advance} of each group to a bracket of ${bp.slots}` : ''}.`;
    }
    case 'matches': {
      const ex = expandMatchList(s.matches ?? [], s.bestOf);
      const total = ex.reduce((a, r) => a + r.matches.length, 0);
      return total ? `${plural(total, 'match')} in ${plural(ex.length, 'round')}; no standings beyond a results table.` : 'Add at least one match.';
    }
  }
}

/** The event's format line ("Swiss 4 rounds (Bo3) + top 8", "Round robin ×2 (Bo3)", …). Plain Swiss keeps the old text. */
export function formatLabel(s: EventSetup, n: number): string {
  const bp = bracketPlan(s, n);
  const boList = (k: number) => {
    const bos = Array.from({ length: k }, (_, i) => bracketBo(s, i));
    return bos.every((b) => b === bos[0]) ? `Bo${bos[0] ?? s.bestOf}` : bos.map((b) => `Bo${b}`).join('/');
  };
  const cutRounds = bp.slots >= 2 ? bracketRounds(bp.slots) : 0;
  const cutBo = cutRounds && !Array.from({ length: cutRounds }, (_, i) => bracketBo(s, i)).every((b) => b === s.bestOf) ? `, ${boList(cutRounds)}` : '';
  const extras: string[] = [];
  if (anyPairings(s)) extras.push('custom pairings');
  if (s.cutSeeds?.length) extras.push('manual seeds');
  if (s.format === 'single-elim' && s.bracket) extras.push('custom bracket');
  if ((s.game1 ?? 'coin') !== 'coin') extras.push(`game 1: ${GAME1_RULES.find((g) => g.key === s.game1)?.label.toLowerCase()}`);
  if ((s.next ?? 'loser') !== 'loser') extras.push('seats alternate');
  const tail = extras.length ? ` · ${extras.join(', ')}` : '';
  switch (s.format) {
    case 'swiss': {
      const r = s.rounds ?? autoRounds(n);
      return `Swiss ${r} round${r > 1 ? 's' : ''} (Bo${s.bestOf})${bp.decks ? ` + top ${bp.decks}${cutBo}` : ''}${tail}`;
    }
    case 'single-elim':
      return `Single elimination, ${bp.decks} decks (${boList(cutRounds)})${tail}`;
    case 'round-robin': {
      const g = s.groups ?? 1;
      const t = Math.max(1, s.times ?? 1);
      return `${g > 1 ? `${g} round-robin groups` : 'Round robin'}${t > 1 ? ` ×${t}` : ''}${s.mirror && t > 1 ? ' mirrored' : ''} (Bo${s.bestOf})${bp.decks >= 2 ? ` + top ${s.advance} per group (${boList(cutRounds)})` : ''}${tail}`;
    }
    case 'matches': {
      const ex = expandMatchList(s.matches ?? [], s.bestOf);
      const total = ex.reduce((a, r) => a + r.matches.length, 0);
      return `Match list: ${total} match${total === 1 ? '' : 'es'}${ex.length > 1 ? ` in ${ex.length} rounds` : ''}${tail}`;
    }
  }
}

/** The manifest's field mode for a setup: 'swiss' for a standard Swiss event, otherwise what was arranged. */
export function fieldMode(s: EventSetup | null | undefined): string {
  if (!s) return 'swiss';
  const parts: string[] = [s.format === 'matches' ? 'custom-matches' : s.format === 'round-robin' && (s.groups ?? 1) > 1 ? 'groups' : s.format];
  if (anyPairings(s)) parts.push('custom-pairings');
  if (s.cutSeeds?.length) parts.push('manual-seeds');
  if (s.format === 'single-elim' && s.bracket) parts.push('custom-bracket');
  return parts.join('+');
}

/** What was arranged by hand, in words, for the "set by you" note ('' for none). */
export function arrangedNote(s: EventSetup | null | undefined): string {
  if (!s) return '';
  const out: string[] = [];
  const rounds = Object.entries(s.pairings ?? {}).filter(([, p]) => p.length).map(([r]) => r);
  if (rounds.length) out.push(`pairings in round${rounds.length > 1 ? 's' : ''} ${rounds.join(', ')}`);
  if (s.cutSeeds?.length) out.push('the top-cut seeds');
  if (s.format === 'single-elim') out.push(s.bracket ? 'the bracket, slot by slot' : 'the bracket seed order');
  if (s.format === 'round-robin') out.push((s.groups ?? 1) > 1 ? 'the groups' : 'the round-robin field');
  if (s.format === 'matches') out.push('every match');
  return out.length ? `Set by you: ${out.join('; ')}.` : '';
}

/** The library deck name an event entrant plays (an explicit copy "X #2" plays X). */
export function entrantBase(setup: Pick<EventSetup, 'entrants'> | null | undefined, name: string): string {
  return setup?.entrants.find((e) => e.name === name)?.copyOf ?? name;
}
