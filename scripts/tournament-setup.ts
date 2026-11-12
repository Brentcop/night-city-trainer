// The event setup scripts/tournament.ts builds from its flags: the entrants (field, an ordered --entrants list, or the
// decks a match list or bracket file names), the format, pairings set by hand and the other options. Pure apart from
// the deck resolver and file reader it is given, so the flags are tested without running an event (tests/tournament-cli.test.ts).
// Bad input throws ArgError: the CLI prints it and exits 2 before anything is played or written.
import { ArgError } from './lib-node';
import type { LibraryDeck } from '../src/lib/library';
import type { DeckList } from '../src/engine/types';
import {
  autoRounds,
  BEST_OF,
  copyName,
  isPlainSetup,
  setupProblems,
  type BestOf,
  type EntrantRef,
  type EventFormat,
  type EventSetup,
  type ForcedPair,
  type Game1Rule,
  type MatchSpec,
  type NextRule,
} from '../src/lib/eventFormats';

export interface SetupFlags {
  /** undefined = inferred: matches with --matches, single-elim with --bracket, otherwise swiss */
  format?: EventFormat;
  bo: BestOf;
  rounds: string;
  top: number;
  /** "A vs B", round 1 of a Swiss event */
  pair: string[];
  /** contents of --matches (already read and parsed) */
  matches?: unknown;
  /** contents of --bracket (already read and parsed) */
  bracket?: unknown;
  /** ordered comma list of decks (seed order); a deck listed twice is entered twice ("X #2") */
  entrants?: string;
  /** comma list of best-of per bracket round, e.g. "3,3,5" */
  bracketBo?: string;
  times: number;
  mirror: boolean;
  groups: number;
  advance: number;
  game1: Game1Rule;
  next: NextRule;
  /** comma list: the top-cut seeds in order, set by hand */
  cutSeeds?: string;
}
export interface BuiltEvent {
  decks: (DeckList & { file?: string })[];
  /** undefined for a plain Swiss event (recorded exactly as events always were) */
  setup: EventSetup | undefined;
  rounds: number;
  top: number;
  bestOf: BestOf;
}

const list = (s: string | undefined) => (s ?? '').split(',').map((x) => x.trim()).filter(Boolean);
const COPY = /^(.*\S) #(\d+)$/;

/** Entrants from deck references in order: a reference repeated (or written "X #2") becomes an explicit copy. */
class Entrants {
  decks: (DeckList & { file?: string })[] = [];
  refs: EntrantRef[] = [];
  private byRef = new Map<string, string>();
  constructor(private resolve: (ref: string) => LibraryDeck) {}
  private lookup(ref: string): LibraryDeck {
    try {
      return this.resolve(ref);
    } catch (e) {
      throw new ArgError((e as Error).message);
    }
  }
  private add(d: LibraryDeck, name: string, copyOf?: string) {
    this.decks.push({ ...d.deck, name, file: d.file });
    this.refs.push({ name, file: d.file, ...(copyOf ? { copyOf } : {}) });
    return name;
  }
  /** Each call enters the deck again (for ordered lists: the second mention is "#2"). */
  enter(ref: string): string {
    const m = ref.match(COPY);
    const d = this.lookup(m ? (m[1] as string) : ref);
    const base = d.deck.name;
    const k = this.refs.filter((r) => r.name === base || r.copyOf === base).length;
    return k === 0 ? this.add(d, base) : this.add(d, copyName(base, k + 1), base);
  }
  /** The same reference always names the same entrant (match lists): "X #2" is a second entrant of X. */
  named(ref: string): string {
    const known = this.byRef.get(ref);
    if (known) return known;
    const m = ref.match(COPY);
    const d = this.lookup(m ? (m[1] as string) : ref);
    const base = d.deck.name;
    const name = m && m[2] !== '1' ? copyName(base, Number(m[2])) : base;
    const existing = this.refs.find((r) => r.name === name);
    if (!existing) this.add(d, name, name === base ? undefined : base);
    this.byRef.set(ref, name);
    return name;
  }
}

/** Parse "A vs B" (also "A v B", "A - B" is not accepted: deck names may contain dashes). */
export function parsePair(s: string): [string, string] {
  const parts = s.split(/\s+vs?\.?\s+/i);
  if (parts.length !== 2 || !parts[0]?.trim() || !parts[1]?.trim()) throw new ArgError(`--pair must look like "A vs B", got "${s}"`);
  return [parts[0].trim(), parts[1].trim()];
}

function bestOfList(s: string | undefined): BestOf[] | undefined {
  if (!s) return undefined;
  const out = list(s).map((x) => Number(x));
  for (const b of out) if (!BEST_OF.includes(b as BestOf)) throw new ArgError(`--bracket-bo must be a comma list of 1, 3 or 5, got "${s}"`);
  return out as BestOf[];
}

/**
 * The event's decks and setup from the flags. `field` is the --field selection (used when no ordered list, match list
 * or bracket names the entrants); `resolve` finds a deck by file or name.
 */
export function buildEvent(f: SetupFlags, field: () => LibraryDeck[], resolve: (ref: string) => LibraryDeck): BuiltEvent {
  const format: EventFormat = f.format ?? (f.matches !== undefined ? 'matches' : f.bracket !== undefined ? 'single-elim' : 'swiss');
  if (f.matches !== undefined && format !== 'matches') throw new ArgError('--matches needs --format matches');
  if (f.bracket !== undefined && format !== 'single-elim') throw new ArgError('--bracket needs --format single-elim');
  if (f.pair.length && format !== 'swiss') throw new ArgError('--pair sets Swiss round-1 pairings; use --matches for a match list');
  if (f.cutSeeds && format !== 'swiss') throw new ArgError('--cut-seeds is for the Swiss top cut');
  if (format === 'matches' && f.matches === undefined) throw new ArgError('--format matches needs --matches file.json');
  if ((f.times > 1 || f.mirror) && format !== 'round-robin') throw new ArgError('--times and --mirror are for --format round-robin (a match list sets them per match)');
  if ((f.groups > 1 || f.advance > 0) && format !== 'round-robin') throw new ArgError('--groups and --advance are for --format round-robin');

  const E = new Entrants(resolve);
  let bracket: (string | null)[] | undefined;
  let matches: MatchSpec[] | undefined;
  if (format === 'matches') {
    const raw = Array.isArray(f.matches) ? f.matches : (f.matches as { matches?: unknown })?.matches;
    if (!Array.isArray(raw) || !raw.length) throw new ArgError('--matches must be a JSON list of { "a", "b", "bestOf"?, "times"?, "mirror"?, "round"? } (or { "matches": [...] })');
    matches = raw.map((x, i) => {
      const m = x as Record<string, unknown>;
      if (!m || typeof m.a !== 'string' || typeof m.b !== 'string') throw new ArgError(`--matches: match ${i + 1} needs "a" and "b" deck names or files`);
      const spec: MatchSpec = { a: E.named(m.a), b: E.named(m.b) };
      if (m.bestOf !== undefined) spec.bestOf = m.bestOf as BestOf;
      if (m.times !== undefined) spec.times = m.times as number;
      if (m.mirror !== undefined) spec.mirror = !!m.mirror;
      if (m.round !== undefined) spec.round = m.round as number;
      return spec;
    });
  } else if (format === 'single-elim' && f.bracket !== undefined) {
    const raw = Array.isArray(f.bracket) ? f.bracket : (f.bracket as { slots?: unknown })?.slots;
    if (!Array.isArray(raw)) throw new ArgError('--bracket must be a JSON list of first-round slots (deck names or files, null for a bye), or { "slots": [...] }');
    bracket = raw.map((x, i) => {
      if (x === null) return null;
      if (typeof x !== 'string') throw new ArgError(`--bracket: slot ${i + 1} must be a deck name or file, or null`);
      return E.named(x);
    });
  } else if (f.entrants) {
    for (const ref of list(f.entrants)) E.enter(ref);
  } else {
    for (const d of field()) E.enter(d.file);
  }

  const n = E.refs.length;
  const names = E.refs.map((r) => r.name);
  const entrantFor = (ref: string, flag: string) => {
    const hit = names.find((x) => x === ref) ?? E.refs.find((r) => r.file === ref || r.file === `${ref}.txt`)?.name;
    if (hit) return hit;
    try {
      const d = resolve(ref);
      if (names.includes(d.deck.name)) return d.deck.name;
    } catch {
      /* reported below */
    }
    throw new ArgError(`${flag}: "${ref}" is not an entrant`);
  };
  const pairs: ForcedPair[] = f.pair.map((p) => {
    const [a, b] = parsePair(p);
    return { a: entrantFor(a, '--pair'), b: entrantFor(b, '--pair') };
  });
  const cutSeeds = f.cutSeeds ? list(f.cutSeeds).map((x) => entrantFor(x, '--cut-seeds')) : undefined;
  const rounds = f.rounds === 'auto' ? autoRounds(n) : Number(f.rounds);
  const setup: EventSetup = {
    format,
    entrants: E.refs,
    bestOf: f.bo,
    ...(f.game1 !== 'coin' ? { game1: f.game1 } : {}),
    ...(f.next !== 'loser' ? { next: f.next } : {}),
    ...(format === 'swiss' ? { rounds, top: f.top } : {}),
    ...(pairs.length ? { pairings: { 1: pairs } } : {}),
    ...(cutSeeds ? { cutSeeds } : {}),
    ...(bestOfList(f.bracketBo) ? { bracketBestOf: bestOfList(f.bracketBo) } : {}),
    ...(bracket ? { bracket } : {}),
    ...(format === 'round-robin' ? { times: f.times, ...(f.mirror ? { mirror: true } : {}), ...(f.groups > 1 ? { groups: f.groups, advance: f.advance } : {}) } : {}),
    ...(matches ? { matches } : {}),
  };
  const problems = setupProblems(setup);
  if (problems.length) throw new ArgError(problems.join('; '));
  return { decks: E.decks, setup: isPlainSetup(setup) ? undefined : setup, rounds, top: f.top, bestOf: f.bo };
}
