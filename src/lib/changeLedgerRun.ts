// The change ledger as one builder run uses it, whatever keeps it (docs/SYNERGIES.md "Pooling held-out games across
// runs"). Plain data and plain functions only, so the forge and optimizer (scripts/ledger-store.ts, files on disk) and
// the Deck Lab tuner (src/lib/deckLab.ts with src/lib/changeLedgerStore.ts, IndexedDB) share exactly the same logic:
//
// - blockSlots / scored: where each game of a block sits (the builders' layout: seed, opponent, who went first) and the
//   paired scores the block came back with;
// - LedgerCache: one or more base lists' batches merged into entries, with the record of every game id + scores already
//   kept, so an append keeps only what is new (and a held-out game that screened the change is never kept for it);
// - ChangeLedgerRun: the entry context of one run (simulator version, canonical bot, field), the prior it hands
//   confirmStaged, what it records and the running totals.
//
// Reading is synchronous: a store loads a base list's batches before a run (or a generation) reads them. Writing is the
// store's business: the Node store appends a line at once, the browser store queues an IndexedDB write.
import { addBatch, changeBase, changeKey, entryKey, fieldFingerprint, gameId, priorGamesOf, priorOf, screenedBefore, type AddResult, type BatchKind, type EntryId, type LedgerBatch, type LedgerEntry, type LedgerGame } from './changeLedger';
import type { PairedScores } from './evidence';
import { listFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';

/** A game's place in a builder's layout, before it is played. */
export type GameSlot = Pick<LedgerGame, 'seed' | 'opp' | 'first'>;

/**
 * The builders' layout (the forge's and optimizer's jobs, the Deck Lab's playSet): game k of a block that starts at seed
 * `seed0` plays opponent `opponents[k % n]`, seed `seed0 + k`, the list under test first when floor(k / n) is even.
 */
export function blockSlots(seed0: number, games: number, opponents: readonly string[]): GameSlot[] {
  const n = opponents.length;
  return Array.from({ length: games }, (_, k) => ({ seed: seed0 + k, opp: opponents[k % n] ?? '', first: (Math.floor(k / n) % 2) as 0 | 1 }));
}

/** Every game a staged confirmation may play: `stages` blocks of `firstStage` games from `seed1`, each laid out afresh. */
export const confirmationSlots = (seed1: number, firstStage: number, stages: number, opponents: readonly string[]): GameSlot[] =>
  Array.from({ length: stages }, (_, s) => blockSlots(seed1 + s * firstStage, firstStage, opponents)).flat();

/** Slots with the scores the base list and the candidate got in them (game for game). */
export function scored(slots: readonly GameSlot[], base: readonly number[], cand: readonly number[]): LedgerGame[] {
  if (base.length !== slots.length || cand.length !== slots.length) throw new Error(`a block of ${slots.length} games came back with ${base.length} base and ${cand.length} candidate scores`);
  return slots.map((s, i) => ({ ...s, base: base[i] ?? 0, cand: cand[i] ?? 0 }));
}

/** What an append did: AddResult, plus `written` (games the store keeps from this batch: new ones and conflicts). */
export type AppendResult = AddResult & { written: number };

/** What a run reads and appends, synchronously (the base list's batches are loaded first). */
export interface LedgerBackend {
  entry(id: EntryId): LedgerEntry | undefined;
  /** every entry of one base list (its list fingerprint), every version, bot and field (the shortlist reads them) */
  entriesOf(base: string): LedgerEntry[];
  append(b: LedgerBatch): AppendResult;
}

interface BaseState {
  entries: Map<string, LedgerEntry>;
  /** per entry and kind, every game id + scores on record (kept and conflicting), so nothing is written twice */
  written: Map<string, Set<string>>;
}

const tupleOf = (g: LedgerGame) => `${gameId(g)}=${g.base}/${g.cand}`;

/**
 * Batches merged into entries, one base list at a time, with what is on record: the part of a store that is the same on
 * disk and in the browser. `loadBase` (re)fills a base list from its stored batches in the order they were stored;
 * `append` keeps only what is new and returns the batch the store must persist (null when nothing is new).
 */
export class LedgerCache {
  private bases = new Map<string, BaseState>();

  has(base: string): boolean {
    return this.bases.has(base);
  }

  /** Replace a base list's state by its stored batches. */
  loadBase(base: string, batches: Iterable<LedgerBatch>): void {
    const s: BaseState = { entries: new Map(), written: new Map() };
    for (const b of batches) {
      addBatch(s.entries, b);
      const set = this.writtenSet(s, b);
      for (const g of b.games) set.add(tupleOf(g));
    }
    this.bases.set(base, s);
  }

  /** Forget everything (the store was cleared). */
  reset(): void {
    this.bases.clear();
  }

  private state(base: string): BaseState {
    let s = this.bases.get(base);
    if (!s) this.bases.set(base, (s = { entries: new Map(), written: new Map() }));
    return s;
  }

  private writtenSet(s: BaseState, b: Pick<LedgerBatch, 'entry' | 'kind'>): Set<string> {
    const k = `${entryKey(b.entry)}|${b.kind}`;
    let set = s.written.get(k);
    if (!set) s.written.set(k, (set = new Set()));
    return set;
  }

  entry(id: EntryId): LedgerEntry | undefined {
    return this.bases.get(changeBase(id.change))?.entries.get(entryKey(id));
  }

  /** Every entry of one base list (empty when it is not loaded). */
  entriesOf(base: string): LedgerEntry[] {
    return [...(this.bases.get(base)?.entries.values() ?? [])];
  }

  /**
   * Take in a batch: games already on record with the same scores are dropped, and a held-out game that screened this
   * change earlier is left out (never evidence for it). Returns what was taken and the batch to persist (null when
   * nothing is new): new games and games that came back with other scores (written once so the conflict is on record;
   * the earlier scores are the ones kept).
   */
  append(b: LedgerBatch): { result: AppendResult; toWrite: LedgerBatch | null } {
    const s = this.state(changeBase(b.entry.change));
    const set = this.writtenSet(s, b);
    const entry = s.entries.get(entryKey(b.entry));
    // a game is its slot (seed, opponent, seat), whichever bot played it: one that screened this change with another bot
    // (another entry of the same change, version and field) is never held-out evidence for it either
    const others = b.kind === 'heldout' ? [...s.entries.values()].filter((e) => e !== entry && e.id.change === b.entry.change && e.id.simVersion === b.entry.simVersion && e.id.field === b.entry.field) : [];
    const fresh: LedgerGame[] = [];
    let duplicates = 0;
    let screened = 0;
    for (const g of b.games) {
      if (b.kind === 'heldout' && ((entry && screenedBefore(entry, g)) || others.some((e) => screenedBefore(e, g)))) {
        screened++;
        continue;
      }
      const t = tupleOf(g);
      if (set.has(t)) duplicates++;
      else {
        set.add(t);
        fresh.push(g);
      }
    }
    if (!fresh.length) return { result: { added: [], duplicates, conflicts: 0, screened, written: 0 }, toWrite: null };
    const batch: LedgerBatch = { ...b, games: fresh };
    const r = addBatch(s.entries, batch);
    return { result: { added: r.added, duplicates: duplicates + r.duplicates, conflicts: r.conflicts, screened: screened + r.screened, written: fresh.length }, toWrite: batch };
  }
}

type Lists = Pick<DeckList, 'legends' | 'main'>;

/** Running totals of what a run appended. */
export interface LedgerTotals {
  written: number;
  duplicates: number;
  conflicts: number;
  /** held-out games left out because they had screened the change in an earlier run (always 0 for screening games) */
  screened: number;
}
export const emptyTotals = (): Record<BatchKind, LedgerTotals> => ({ heldout: { written: 0, duplicates: 0, conflicts: 0, screened: 0 }, screen: { written: 0, duplicates: 0, conflicts: 0, screened: 0 } });

export interface ChangeLedgerRunOptions {
  simVersion: number;
  /** the canonical bot name (ledgerBot) */
  bot: string;
  /** the field's list fingerprints, in the order the games use them */
  opponents: readonly string[];
  /** this run's id, kept with every batch */
  run: string;
  /** YYYY-MM-DD */
  date: string;
  /**
   * running totals to add to (a run whose confirmation is played by another bot has one ChangeLedgerRun per bot, and they
   * share one total); absent: its own
   */
  totals?: Record<BatchKind, LedgerTotals>;
}

/** The ledger as one builder run uses it: entry ids, priors and recording, over any store. */
export class ChangeLedgerRun {
  readonly field: string;
  readonly totals: Record<BatchKind, LedgerTotals>;
  constructor(
    readonly store: LedgerBackend,
    readonly o: ChangeLedgerRunOptions,
  ) {
    this.field = fieldFingerprint(o.opponents);
    this.totals = o.totals ?? emptyTotals();
  }

  entryId(base: Lists, cand: Lists): EntryId {
    return this.entryIdOf(changeKey(base, cand));
  }

  /** The entry id of a change key in this run's context (simulator version, bot, field). */
  entryIdOf(change: string): EntryId {
    return { change, simVersion: this.o.simVersion, bot: this.o.bot, field: this.field };
  }

  /** What the store holds for one change in this run's context. */
  entryOf(change: string): LedgerEntry | undefined {
    return this.store.entry(this.entryIdOf(change));
  }

  /** Every entry of this base list in this run's context: the same simulator version, bot and field (src/lib/shortlist.ts). */
  entries(base: Lists): LedgerEntry[] {
    const fp = listFingerprint(base);
    return this.store.entriesOf(fp).filter((e) => e.id.simVersion === this.o.simVersion && e.id.bot === this.o.bot && e.id.field === this.field && changeBase(e.id.change) === fp);
  }

  /** The held-out games of this change from earlier runs, leaving out the games in `leaveOut`. */
  prior(base: Lists, cand: Lists, leaveOut: ReadonlySet<string>): PairedScores {
    const id = this.entryId(base, cand);
    return priorOf(this.store.entry(id), this.withOtherScreens(id, leaveOut));
  }

  /** The games `prior` takes, in its order, with where each sat (seed, opponent, who went first). */
  priorGames(base: Lists, cand: Lists, leaveOut: ReadonlySet<string>): LedgerGame[] {
    const id = this.entryId(base, cand);
    return priorGamesOf(this.store.entry(id), this.withOtherScreens(id, leaveOut));
  }

  /**
   * `leaveOut` and every slot that screened this change under another bot (the same change, simulator version and field):
   * a deal is the same deal whichever bot plays it, so one that picked a change never vouches for it. With one bot's
   * entries only (every run before another bot confirmed one), this is `leaveOut` itself.
   */
  private withOtherScreens(id: EntryId, leaveOut: ReadonlySet<string>): ReadonlySet<string> {
    const others = this.store.entriesOf(changeBase(id.change)).filter((e) => e.id.change === id.change && e.id.simVersion === id.simVersion && e.id.field === id.field && e.id.bot !== id.bot && e.screen.length);
    if (!others.length) return leaveOut;
    const out = new Set(leaveOut);
    for (const e of others) for (const g of e.screen) out.add(gameId(g));
    return out;
  }

  /** Append one change's games of one kind (nothing is written when they are all on record). */
  record(kind: BatchKind, base: Lists, cand: Lists, label: string, games: LedgerGame[]): AppendResult {
    const r = this.store.append({ entry: this.entryId(base, cand), kind, label, run: this.o.run, date: this.o.date, games });
    const t = this.totals[kind];
    t.written += r.written;
    t.duplicates += r.duplicates;
    t.conflicts += r.conflicts;
    t.screened += r.screened;
    return r;
  }
}
