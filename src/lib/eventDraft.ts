// The tournament runner's "Set up the event" form as plain data (#/run, src/ui/pages/TournamentRunner.tsx): the entrant
// list (library files, with explicit copies), the format and its options, and the pairings, seeds, bracket or match
// list set by hand. draftSetup() turns it into the decks and EventSetup the runner plays (src/lib/eventFormats.ts).
// Also the quick entrant sets and the time estimate. Pure: the page binds it to the library and storage.
import type { DeckList } from '../engine/types';
import type { LibraryDeck } from './library';
import { deckSource } from './deckSource';
import {
  autoRounds,
  bracketPlan,
  bracketRounds,
  copyName,
  cutSize,
  estimateGames,
  setupProblems,
  type BestOf,
  type EntrantRef,
  type EventFormat,
  type EventSetup,
  type ForcedPair,
  type Game1Rule,
  type MatchSpec,
  type NextRule,
} from './eventFormats';

/** One entrant: a library deck, and which copy of it (1 = the deck itself, 2 = "Name #2", …). */
export interface DraftEntrant {
  file: string;
  copy: number;
}

export interface EventDraft {
  entrants: DraftEntrant[];
  format: EventFormat;
  bestOf: BestOf;
  game1: Game1Rule;
  next: NextRule;
  /** swiss */
  rounds: number | 'auto';
  top: number;
  /** swiss round 1, by entrant name */
  pairings: ForcedPair[];
  /** swiss: how the top cut is seeded; 'manual' with a fixed order (all at once) or at the cut (round by round) */
  cutSeeding: 'standings' | 'manual';
  cutSeeds: string[];
  /** best-of per bracket round (missing rounds use bestOf) */
  bracketBo: BestOf[];
  /** single-elim: null = seed order (byes to the top seeds), otherwise the first-round slots */
  slots: (string | null)[] | null;
  /** round robin */
  times: number;
  mirror: boolean;
  groups: number;
  advance: number;
  /** match list */
  matches: MatchSpec[];
}

export const DEFAULT_DRAFT: EventDraft = {
  entrants: [],
  format: 'swiss',
  bestOf: 3,
  game1: 'coin',
  next: 'loser',
  rounds: 'auto',
  top: 8,
  pairings: [],
  cutSeeding: 'standings',
  cutSeeds: [],
  bracketBo: [],
  slots: null,
  times: 1,
  mirror: false,
  groups: 1,
  advance: 2,
  matches: [],
};

// ---------------------------------------------------------------- entrants

/** The event name of an entrant ("Name", "Name #2"); '' when its deck is missing. */
export const entrantName = (d: Pick<LibraryDeck, 'deck'> | undefined, e: DraftEntrant) => (d ? (e.copy > 1 ? copyName(d.deck.name, e.copy) : d.deck.name) : '');

/** Add a deck (its first copy) unless it is already in. */
export const addEntrant = (list: readonly DraftEntrant[], file: string): DraftEntrant[] => (list.some((e) => e.file === file) ? [...list] : [...list, { file, copy: 1 }]);
/** Add the next copy of a deck ("#2", "#3"…), right after its last copy. */
export function duplicateEntrant(list: readonly DraftEntrant[], file: string): DraftEntrant[] {
  const copies = list.filter((e) => e.file === file).map((e) => e.copy);
  const next = copies.length ? Math.max(...copies) + 1 : 1;
  const at = list.reduce((k, e, i) => (e.file === file ? i + 1 : k), list.length);
  return [...list.slice(0, at), { file, copy: next }, ...list.slice(at)];
}
/** Remove an entrant; removing a deck's first copy promotes nothing (its copies keep their numbers). */
export const removeEntrant = (list: readonly DraftEntrant[], index: number): DraftEntrant[] => list.filter((_, i) => i !== index);

// ---------------------------------------------------------------- copies in bulk

/** The most times one deck can be entered ("#16" at most). */
export const MAX_COPIES = 16;
/** The most entrants the bulk copy actions build (a field this size already takes a long time with the stronger bots). */
export const MAX_ENTRANTS = 256;

/** A stable key for an entrant row ("file#copy"): selection and React keys survive reordering. */
export const entrantKey = (e: DraftEntrant) => `${e.file}#${e.copy}`;
/** How many times a deck is entered. */
export const copyCount = (list: readonly DraftEntrant[], file: string) => list.filter((e) => e.file === file).length;
/** The distinct decks in the field, in order of first appearance. */
export const distinctFiles = (list: readonly DraftEntrant[]) => [...new Set(list.map((e) => e.file))];

/**
 * The result of a bulk entrant action: the new list, or, when the action would pass a limit, the list unchanged and
 * `problem` saying why (an action is done whole or not at all).
 */
export interface EntrantEdit {
  list: DraftEntrant[];
  problem: string | null;
}
type NameOf = (file: string) => string;
const plainName: NameOf = (f) => f;
const andList = (xs: readonly string[]) => (xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/** Why a list passes a limit (null when it does not). */
function limitProblem(next: readonly DraftEntrant[], nameOf: NameOf): string | null {
  const over = distinctFiles(next).filter((f) => copyCount(next, f) > MAX_COPIES);
  if (over.length) return `${andList(over.map(nameOf))} would be entered more than ${MAX_COPIES} times (×${MAX_COPIES} is the most)`;
  if (next.length > MAX_ENTRANTS) return `that would make ${next.length} entrants; the most is ${MAX_ENTRANTS}`;
  return null;
}
const refuse = (list: readonly DraftEntrant[], problem: string): EntrantEdit => ({ list: [...list], problem: `Nothing changed: ${problem}.` });
const checked = (list: readonly DraftEntrant[], next: DraftEntrant[], nameOf: NameOf): EntrantEdit => {
  const p = limitProblem(next, nameOf);
  return p ? refuse(list, p) : { list: next, problem: null };
};

/** Enter each of these decks once more (its next copy, right after its last one), all or nothing. */
export function duplicateDecks(list: readonly DraftEntrant[], files: Iterable<string>, nameOf: NameOf = plainName): EntrantEdit {
  const want = [...new Set(files)].filter((f) => list.some((e) => e.file === f));
  return checked(list, want.reduce<DraftEntrant[]>((l, f) => duplicateEntrant(l, f), [...list]), nameOf);
}
/** Enter every deck in the field once more. */
export const duplicateAll = (list: readonly DraftEntrant[], nameOf: NameOf = plainName) => duplicateDecks(list, distinctFiles(list), nameOf);

/**
 * Set how many times a deck is entered (1…MAX_COPIES). More: the next copies go right after its last one. Fewer: the
 * highest-numbered copies go. A deck not in the field is added first.
 */
export function setCopies(list: readonly DraftEntrant[], file: string, k: number, nameOf: NameOf = plainName): EntrantEdit {
  if (!Number.isInteger(k) || k < 1) return refuse(list, `a deck is entered at least once (remove it with ✕)`);
  if (k > MAX_COPIES) return refuse(list, `${nameOf(file)} can be entered at most ${MAX_COPIES} times`);
  let next = addEntrant(list, file);
  while (copyCount(next, file) < k) next = duplicateEntrant(next, file);
  const extra = next
    .filter((e) => e.file === file)
    .map((e) => e.copy)
    .sort((a, b) => b - a)
    .slice(0, Math.max(0, copyCount(next, file) - k));
  next = next.filter((e) => e.file !== file || !extra.includes(e.copy));
  return checked(list, next, nameOf);
}

/** Every deck once: drop the extra copies, keeping each deck's lowest-numbered copy where it stands. */
export function oneCopyEach(list: readonly DraftEntrant[]): DraftEntrant[] {
  const keep = new Map<string, number>();
  for (const e of list) keep.set(e.file, Math.min(keep.get(e.file) ?? Infinity, e.copy));
  return list.filter((e) => keep.get(e.file) === e.copy);
}
/** Remove the entrants with these keys (entrantKey). */
export const removeKeys = (list: readonly DraftEntrant[], keys: ReadonlySet<string>): DraftEntrant[] => list.filter((e) => !keys.has(entrantKey(e)));

/** The names entered after `before` became `after`: the entrants added and removed, by key, in list order. */
export function entrantChanges(before: readonly DraftEntrant[], after: readonly DraftEntrant[]): { added: DraftEntrant[]; removed: DraftEntrant[] } {
  const b = new Set(before.map(entrantKey));
  const a = new Set(after.map(entrantKey));
  return { added: after.filter((e) => !b.has(entrantKey(e))), removed: before.filter((e) => !a.has(entrantKey(e))) };
}

/**
 * The entrant names the draft's hand-set parts use (round-1 pairings, a fixed top-cut order, bracket slots, the match
 * list), for the current format only. Bulk entrant changes never rewrite these: a name that is no longer entered shows
 * as a problem in the setup.
 */
export function handSetNames(draft: EventDraft): string[] {
  const out: string[] = [];
  if (draft.format === 'swiss') {
    out.push(...draft.pairings.flatMap((p) => [p.a, p.b]));
    if (draft.cutSeeding === 'manual') out.push(...draft.cutSeeds);
  } else if (draft.format === 'single-elim') out.push(...(draft.slots ?? []).filter((s): s is string => s !== null));
  else if (draft.format === 'matches') out.push(...draft.matches.flatMap((m) => [m.a, m.b]));
  return [...new Set(out.filter(Boolean))];
}

// ---------------------------------------------------------------- the event seed

/** Random seeds are six digits: easy to read and type, 900 000 of them. */
export const SEED_MIN = 100_000;
export const SEED_MAX = 999_999;
/** A new random seed; `avoid` (the last one) is never returned. */
export function randomSeed(rand: () => number = Math.random, avoid?: number): number {
  const v = Math.min(SEED_MAX, Math.max(SEED_MIN, SEED_MIN + Math.floor(rand() * (SEED_MAX - SEED_MIN + 1))));
  return v !== avoid ? v : v === SEED_MAX ? SEED_MIN : v + 1;
}
/** The setup form's seed: the number, and whether it is kept for the next event on purpose. */
export interface SeedChoice {
  seed: number;
  keep: boolean;
}
/**
 * The seed a visit to the setup starts with. A setup link's seed (s=…) is a request to reproduce that event, so it is
 * used and kept; otherwise a new random seed, not kept. Nothing remembers the last seed used between visits.
 */
export const initialSeed = (linkSeed: number | null, rand: () => number = Math.random): SeedChoice => (linkSeed !== null ? { seed: linkSeed, keep: true } : { seed: randomSeed(rand), keep: false });
/** The form's seed once an event has started with it: the same when kept on purpose, otherwise a new random one. */
export const seedAfterStart = (s: SeedChoice, rand: () => number = Math.random): SeedChoice => (s.keep ? s : { seed: randomSeed(rand, s.seed), keep: false });
/** Move an entrant up (−1) or down (+1) in seed order. */
export function moveEntrant<T>(list: readonly T[], index: number, delta: number): T[] {
  const j = index + delta;
  if (index < 0 || index >= list.length || j < 0 || j >= list.length) return [...list];
  const out = [...list];
  const [x] = out.splice(index, 1);
  out.splice(j, 0, x as T);
  return out;
}

/** The breeding season of a bred deck ("Night City Trainer bred deck (season 2, …)"), or null. */
export function seasonOf(d: Pick<LibraryDeck, 'prov'>): number | null {
  const m = (d.prov.origin ?? '').match(/^Night City Trainer bred.*season (\d+)/);
  return m ? Number(m[1]) : null;
}

export interface QuickSet {
  key: string;
  label: string;
  hint: string;
  files: string[];
}
/**
 * Ready-made entrant lists from the deck pool (already de-duplicated): every choom.gg meta deck, every guide list, the
 * owner's sim-ladder imports, the Trainer originals, each bred season, decks saved here, the top 8 and top 16 by our
 * rating (when that many are rated), everything. `rated` is the ratings table in rating order.
 */
export function quickSets(pool: readonly LibraryDeck[], rated: readonly { name: string }[]): QuickSet[] {
  const files = (pred: (d: LibraryDeck) => boolean) => pool.filter(pred).map((d) => d.file);
  const byName = new Map(pool.map((d) => [d.deck.name, d.file]));
  const ranked = rated.map((r) => byName.get(r.name)).filter((f): f is string => !!f);
  const top = (k: number) => ({ key: `top${k}`, label: `Top ${k} rated`, hint: `The ${k} best by our power rating (recorded events)`, files: ranked.length >= k ? ranked.slice(0, k) : [] });
  const seasons = [...new Set(pool.map(seasonOf).filter((s): s is number => s !== null))].sort((a, b) => a - b);
  const sets: QuickSet[] = [
    { key: 'meta', label: 'All meta', hint: 'Every choom.gg meta archetype', files: files((d) => deckSource(d) === 'meta') },
    { key: 'guide', label: 'All guides', hint: 'Every list from the choom.gg guides', files: files((d) => deckSource(d) === 'guide') },
    { key: 'ladder', label: 'Sim ladder', hint: 'The owner’s imports from the sim ladder', files: files((d) => deckSource(d) === 'ladder') },
    { key: 'nc', label: 'Trainer originals', hint: 'The hand-built NC decks', files: files((d) => deckSource(d) === 'nc') },
    ...seasons.map((s) => ({ key: `season-${s}`, label: `Bred season ${s}`, hint: `Every deck bred in season ${s}`, files: files((d) => seasonOf(d) === s) })),
    { key: 'mine', label: 'My decks', hint: 'Decks saved in this browser', files: files((d) => ['mine', 'tuned', 'lab'].includes(deckSource(d))) },
    top(8),
    top(16),
    { key: 'all', label: 'Everything', hint: 'Every distinct deck in the library', files: pool.map((d) => d.file) },
  ];
  return sets.filter((s) => s.files.length > 0);
}

// ---------------------------------------------------------------- the setup

export interface DraftResult {
  /** the decks in entrant order, named as the event names them */
  decks: (DeckList & { file: string })[];
  setup: EventSetup;
  /** problems that stop the event from starting (empty = ready) */
  problems: string[];
  /** entrants left out (match list: decks in no match) */
  unused: string[];
}

/**
 * The event a draft describes. `byFile` finds library decks; entrants whose deck is gone are dropped. Hand-set pairings,
 * seeds, slots and matches naming decks that are no longer entrants show up as problems, not silently changed.
 */
export function draftSetup(draft: EventDraft, byFile: ReadonlyMap<string, LibraryDeck>, o: { roundByRound?: boolean } = {}): DraftResult {
  const all = draft.entrants.flatMap((e) => {
    const d = byFile.get(e.file);
    if (!d) return [];
    const name = entrantName(d, e);
    const ref: EntrantRef = { name, file: d.file, ...(e.copy > 1 ? { copyOf: d.deck.name } : {}) };
    return [{ ref, deck: { ...d.deck, name, sideboard: [...(d.deck.sideboard ?? [])], file: d.file } }];
  });
  let used = all;
  const unused: string[] = [];
  if (draft.format === 'matches') {
    const named = new Set(draft.matches.flatMap((m) => [m.a, m.b]));
    used = all.filter((x) => named.has(x.ref.name));
    unused.push(...all.filter((x) => !named.has(x.ref.name)).map((x) => x.ref.name));
  }
  const n = used.length;
  const rounds = draft.rounds === 'auto' ? autoRounds(n) : draft.rounds;
  const plan = (s: EventSetup) => bracketPlan(s, n);
  const setup: EventSetup = {
    format: draft.format,
    entrants: used.map((x) => x.ref),
    bestOf: draft.bestOf,
    ...(draft.game1 !== 'coin' ? { game1: draft.game1 } : {}),
    ...(draft.next !== 'loser' ? { next: draft.next } : {}),
  };
  if (draft.format === 'swiss') {
    setup.rounds = rounds;
    setup.top = draft.top;
    if (draft.pairings.length) setup.pairings = { 1: draft.pairings.map((p) => ({ a: p.a, b: p.b })) };
    if (draft.cutSeeding === 'manual' && !o.roundByRound && draft.cutSeeds.length) setup.cutSeeds = [...draft.cutSeeds];
  } else if (draft.format === 'single-elim') {
    if (draft.slots) setup.bracket = [...draft.slots];
  } else if (draft.format === 'round-robin') {
    setup.times = Math.max(1, draft.times);
    if (draft.mirror && draft.times > 1) setup.mirror = true;
    if (draft.groups > 1) {
      setup.groups = draft.groups;
      setup.advance = draft.advance;
    }
  } else setup.matches = draft.matches.map((m) => ({ ...m }));
  // best-of per bracket round, only as many rounds as the bracket has, and only when one differs
  const br = plan(setup).slots >= 2 ? bracketRounds(plan(setup).slots) : 0;
  const bos = Array.from({ length: br }, (_, i) => draft.bracketBo[i] ?? draft.bestOf);
  if (bos.some((b) => b !== draft.bestOf)) setup.bracketBestOf = bos;
  const problems = setupProblems(setup);
  if (draft.format === 'swiss' && draft.cutSeeding === 'manual' && !o.roundByRound) {
    const c = cutSize(draft.top, n);
    if (!draft.cutSeeds.length) problems.push('set the top-cut seed order, or seed the cut by the standings');
    else if (draft.cutSeeds.length !== c) problems.push(`the top cut has ${c} seats: order exactly ${c} seeds (you have ${draft.cutSeeds.length})`);
  }
  return { decks: used.map((x) => x.deck), setup, problems, unused };
}

// ---------------------------------------------------------------- time

/** Rough seconds per game on one worker, by bot (measured in Node; a browser is a little slower). */
export const SECONDS_PER_GAME: Record<string, number> = { easy: 0.03, fast: 0.03, medium: 0.2, lookahead: 0.2, mixed: 1.2, hard: 2.2, deep: 2.2, 'hard-v1': 2.2 };

/** Seconds a run of `games` takes on `threads` workers; `measured` (games per second per thread from an earlier run) wins. */
export function estimateSeconds(games: number, bot: string, threads: number, measured?: number | null): number {
  const perGame = measured && measured > 0 ? 1 / measured : (SECONDS_PER_GAME[bot] ?? 1);
  return (games * perGame) / Math.max(1, threads);
}
/** "under a minute", "about 4 minutes", "about 1 h 20 min". */
export function durationText(seconds: number): string {
  if (seconds < 60) return 'under a minute';
  const min = Math.round(seconds / 60);
  if (min < 60) return `about ${min} minute${min === 1 ? '' : 's'}`;
  return `about ${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min`;
}

/** The estimate line before starting: games (expected, range) and time on these threads. */
export function planText(setup: EventSetup, bot: string, threads: number, measured?: number | null): string {
  const n = setup.entrants.length;
  if (n < 2) return '';
  const g = estimateGames(setup, n);
  const range = g.min === g.max ? `${g.max}` : `${g.min.toLocaleString('en-US')}–${g.max.toLocaleString('en-US')}`;
  return `This event plays ${g.matches.toLocaleString('en-US')} match${g.matches === 1 ? '' : 'es'}: about ${g.estimate.toLocaleString('en-US')} games (${range}), ${durationText(estimateSeconds(g.estimate, bot, threads, measured))} on ${threads} thread${threads === 1 ? '' : 's'}${measured ? ' at the pace of your last run' : ''}.`;
}

// ---------------------------------------------------------------- links and resuming

/** Entrants from a setup link's deck list: "file" or "file*2" (the second copy), in order. */
export function entrantsFromList(files: readonly string[]): DraftEntrant[] {
  return files.map((f) => {
    const m = f.match(/^(.*)\*(\d+)$/);
    return m ? { file: m[1] as string, copy: Math.max(1, Number(m[2])) } : { file: f, copy: 1 };
  });
}
/** The setup link's deck list for some entrants (the inverse of entrantsFromList). */
export const entrantsToList = (list: readonly DraftEntrant[]) => list.map((e) => (e.copy > 1 ? `${e.file}*${e.copy}` : e.file));

/** The parts of a saved run and a pause point that tell whether the saved run already got past it. */
interface SavedProgress {
  rounds: { matches: { games: unknown[] }[] }[];
  bracket: unknown[];
  seeds?: string[];
}
/**
 * Whether a saved (stopped) run had already reached this point, so a resumed run goes straight through it with the
 * saved choices instead of pausing again: a Swiss or bracket round it started, a planned round it began playing, the
 * top cut once it was seeded.
 */
export function reachedBefore(saved: SavedProgress, step: { stage: 'swiss' | 'rounds' | 'cut' | 'bracket'; round: number }): boolean {
  switch (step.stage) {
    case 'swiss':
      return step.round <= saved.rounds.length;
    case 'rounds':
      return (saved.rounds[step.round - 1]?.matches ?? []).some((m) => m.games.length > 0);
    case 'cut':
      return !!saved.seeds?.length;
    case 'bracket':
      return step.round <= saved.bracket.length;
  }
}
