// The change ledger kept in this browser, for the Deck Lab tuner ("earlier held-out games"; docs/SYNERGIES.md "Pooling
// held-out games across runs"). Batches are stored in the compact form of src/lib/changeLedger.ts (encodeBatch), one
// record per batch, findable by the change's base list fingerprint, behind a small storage interface: the IndexedDB
// adapter is src/lib/changeLedgerIdb.ts (database `nct.ledger.v1`), and memoryLedgerStorage() is the same interface in
// memory for tests. Only the Deck Lab's chunk imports this file (never the entry chunk).
//
// BrowserLedgerStore is what tuneDeck reads and appends through (TuneLedgerStore): it loads one base list's batches
// before a generation (after every write queued so far), answers entry() synchronously from them, and appends through
// the same LedgerCache the Node store uses (src/lib/changeLedgerRun.ts), so a repeat adds nothing and a held-out game
// that screened a change is never kept for it. Writes are queued in order; flush() waits for them and never rejects.
// Export writes the `kind: 'nct-change-ledger'`, schema 1 document (ledgerExport); import reads one (parseLedgerExport)
// and adds only the games not already held, by the same rules. Batches recorded under another simulator version are kept
// and exported, never pooled (they are other entries), counted apart, and removed by clear().
//
// The words the Lab shows about it (holdingLine, keptLine, importLine, clearLedgerWords) are here too, pure.
import { decodeBatch, encodeBatch, ledgerExport, mergeBatches, parseLedgerExport, changeBase, type CompactBatch, type EntryId, type LedgerBatch, type LedgerEntry, type LedgerExport } from './changeLedger';
import { LedgerCache, type AppendResult } from './changeLedgerRun';
import { alwaysValidZ, lookZ, pooledShare, type AdoptionRule } from './evidence';
import type { TuneLedgerStore } from './deckLab';
import { heldoutSdSamples, type SdSamples } from './deckSearch';

/** Where the batches live: IndexedDB in the page, a Map in tests. Every batch is stored with its base list fingerprint. */
export interface LedgerStorage {
  /** this base list's batches, in the order they were added */
  forBase(base: string): Promise<CompactBatch[]>;
  /** every batch, in the order they were added */
  all(): Promise<CompactBatch[]>;
  add(base: string, batch: CompactBatch): Promise<void>;
  clear(): Promise<void>;
}

/** The storage interface in memory (tests, and a fallback nothing uses yet). `fail` makes the next writes throw. */
export function memoryLedgerStorage(): LedgerStorage & { rows: { base: string; batch: CompactBatch }[]; fail: boolean } {
  const s = {
    rows: [] as { base: string; batch: CompactBatch }[],
    fail: false,
    async forBase(base: string) {
      return s.rows.filter((r) => r.base === base).map((r) => structuredClone(r.batch));
    },
    async all() {
      return s.rows.map((r) => structuredClone(r.batch));
    },
    async add(base: string, batch: CompactBatch) {
      if (s.fail) throw new Error('storage refused the write');
      s.rows.push({ base, batch: structuredClone(batch) });
    },
    async clear() {
      s.rows.length = 0;
    },
  };
  return s;
}

/** What importing a file did (games), or why it was refused. */
export type ImportOutcome =
  | { problem: string }
  | {
      problem?: undefined;
      batches: number;
      /** games new to this browser */
      added: number;
      /** games this browser already held with the same scores */
      already: number;
      /** games held here with other scores (the ones held here are kept) */
      conflicts: number;
      /** held-out games left out because this browser holds them as screening games of the same change */
      leftOut: number;
      /** games that could not be written (storage full or blocked) */
      failed: number;
    };

/** Everything this browser holds, in games. */
export interface LedgerCounts {
  /** current simulator version: held-out and screening games (each once per entry) and the changes they are on */
  heldout: number;
  screen: number;
  changes: number;
  /** batches of other simulator versions: kept, never used */
  older: { batches: number; games: number };
  /** stored batches that could not be read (skipped) */
  unreadable: number;
}

/** What this browser holds for one list (as the base of its changes), current simulator version. */
export interface ListHolding {
  heldout: number;
  /** changes of this list with at least one held-out game */
  changes: number;
  /** held-out games recorded with this bot against this field: the ones a run with these settings can pool */
  usable: number;
  /** games of this list from other simulator versions (kept, not used) */
  older: number;
}

const decodeAll = (rows: readonly CompactBatch[]): { batches: LedgerBatch[]; unreadable: number } => {
  const batches: LedgerBatch[] = [];
  let unreadable = 0;
  for (const r of rows) {
    const d = decodeBatch(r);
    if (d.batch) batches.push(d.batch);
    else unreadable++;
  }
  return { batches, unreadable };
};

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** The ledger in this browser, as the tuner and the Lab page use it. */
export class BrowserLedgerStore implements TuneLedgerStore {
  private cache = new LedgerCache();
  /** writes, chained so they land in order; never rejects */
  private queue: Promise<void> = Promise.resolve();
  /** games that could not be written, and the last reason (storage full or blocked) */
  failed = 0;
  lastError = '';

  constructor(readonly storage: LedgerStorage) {}

  /** Load what is kept for this base list, after every write queued so far (a read that fails leaves it empty and says why). */
  async load(base: string): Promise<void> {
    await this.queue;
    let rows: CompactBatch[] = [];
    try {
      rows = await this.storage.forBase(base);
    } catch (e) {
      this.lastError = errText(e);
    }
    this.cache.loadBase(
      base,
      decodeAll(rows).batches.filter((b) => changeBase(b.entry.change) === base),
    );
  }

  entry(id: EntryId): LedgerEntry | undefined {
    return this.cache.entry(id);
  }

  /** Every entry of one base list (its batches must be loaded). */
  entriesOf(base: string): LedgerEntry[] {
    return this.cache.entriesOf(base);
  }

  /** Take in a batch (its base list must be loaded): only what is new is queued for writing. */
  append(b: LedgerBatch): AppendResult {
    const { result, toWrite } = this.cache.append(b);
    if (toWrite) {
      const base = changeBase(toWrite.entry.change);
      const row = encodeBatch(toWrite);
      this.queue = this.queue
        .then(() => this.storage.add(base, row))
        .catch((e: unknown) => {
          this.failed += toWrite.games.length;
          this.lastError = errText(e);
        });
    }
    return result;
  }

  /** Wait until every write queued so far has landed (or failed: see `failed`). */
  async flush(): Promise<{ failed: number }> {
    await this.queue;
    return { failed: this.failed };
  }

  private async rows(): Promise<CompactBatch[]> {
    await this.queue;
    return this.storage.all();
  }

  /** The export document of everything held here (every simulator version). */
  async exportDoc(now = new Date()): Promise<LedgerExport> {
    return ledgerExport(decodeAll(await this.rows()).batches, now);
  }

  /** Import an export (text or parsed JSON): only games not already held are added; a refused file adds nothing. */
  async importDoc(input: unknown): Promise<ImportOutcome> {
    const r = parseLedgerExport(input);
    if (!r.batches) return { problem: r.problem };
    const byBase = new Map<string, LedgerBatch[]>();
    for (const b of r.batches) {
      const k = changeBase(b.entry.change);
      byBase.set(k, [...(byBase.get(k) ?? []), b]);
    }
    const failedBefore = this.failed;
    const out = { batches: r.batches.length, added: 0, already: 0, conflicts: 0, leftOut: 0, failed: 0 };
    for (const [base, batches] of byBase) {
      await this.load(base);
      for (const b of batches) {
        const a = this.append(b);
        out.added += a.added.length;
        out.already += a.duplicates;
        out.conflicts += a.conflicts;
        out.leftOut += a.screened;
      }
    }
    await this.flush();
    out.failed = this.failed - failedBefore;
    return out;
  }

  /** Remove everything held here, every simulator version. */
  async clear(): Promise<void> {
    await this.queue;
    await this.storage.clear();
    this.cache.reset();
  }

  /** Everything held here, in games: the current simulator version's, and the older batches kept apart. */
  async counts(simVersion: number): Promise<LedgerCounts> {
    const { batches, unreadable } = decodeAll(await this.rows());
    const now = batches.filter((b) => b.entry.simVersion === simVersion);
    const older = batches.filter((b) => b.entry.simVersion !== simVersion);
    const entries = [...mergeBatches(now).values()];
    return {
      heldout: entries.reduce((s, e) => s + e.heldout.length, 0),
      screen: entries.reduce((s, e) => s + e.screen.length, 0),
      changes: new Set(entries.map((e) => e.id.change)).size,
      older: { batches: older.length, games: older.reduce((s, b) => s + b.games.length, 0) },
      unreadable,
    };
  }

  /** What is held for one list (its fingerprint) under the current simulator version, and how much a run with this bot and field can pool. */
  async holding(base: string, o: { simVersion: number; bot: string | null; field: string }): Promise<ListHolding> {
    await this.queue;
    const { batches } = decodeAll(await this.storage.forBase(base));
    const now = batches.filter((b) => b.entry.simVersion === o.simVersion && changeBase(b.entry.change) === base);
    const entries = [...mergeBatches(now).values()].filter((e) => e.heldout.length);
    return {
      heldout: entries.reduce((s, e) => s + e.heldout.length, 0),
      changes: new Set(entries.map((e) => e.id.change)).size,
      usable: entries.filter((e) => e.id.bot === o.bot && e.id.field === o.field).reduce((s, e) => s + e.heldout.length, 0),
      older: batches.filter((b) => b.entry.simVersion !== o.simVersion).reduce((s, b) => s + b.games.length, 0),
    };
  }

  /**
   * The per-game SDs of this list's changes a run with this bot and field can use (heldoutSdSamples: changes with 200 or
   * more held-out games, one-card swaps apart from larger changes), for what the run can detect (src/lib/deckSearch.ts).
   */
  async sdSamples(base: string, o: { simVersion: number; bot: string | null; field: string }): Promise<SdSamples> {
    await this.queue;
    const { batches } = decodeAll(await this.storage.forBase(base));
    const now = batches.filter((b) => b.entry.simVersion === o.simVersion && changeBase(b.entry.change) === base && b.entry.bot === o.bot && b.entry.field === o.field);
    return heldoutSdSamples([...mergeBatches(now).values()]);
  }
}

// ---------------------------------------------------------------- words

const k = (x: number) => x.toLocaleString('en-US');
const games = (n: number) => `${k(n)} game${n === 1 ? '' : 's'}`;

/** The line under the tuner's checkbox: what this browser holds for this exact list. */
export function holdingLine(h: ListHolding): string {
  const older = h.older ? ` ${games(h.older)} from an earlier simulator version ${h.older === 1 ? 'is' : 'are'} kept but not used.` : '';
  if (!h.heldout) return `This browser holds no held-out games of this list yet.${older}`;
  const head = `This browser holds ${k(h.heldout)} held-out game${h.heldout === 1 ? '' : 's'} on ${k(h.changes)} change${h.changes === 1 ? '' : 's'} of this list`;
  const usable = h.usable === h.heldout ? '' : h.usable ? `; ${k(h.usable)} of them were played with these bots against this field, so only those can be used` : '; none were played with these bots against this field, so none can be used';
  return `${head}${usable}.${older}`;
}

/** The "Evidence kept in this browser" summary. */
export function keptLine(c: LedgerCounts): string {
  const older = c.older.games ? ` Also ${games(c.older.games)} from an earlier simulator version, kept but never used; Clear removes them.` : '';
  const bad = c.unreadable ? ` ${k(c.unreadable)} stored batch${c.unreadable === 1 ? '' : 'es'} could not be read and ${c.unreadable === 1 ? 'is' : 'are'} skipped.` : '';
  if (!c.heldout && !c.screen) return `Nothing kept yet: a tuning run with “Use earlier held-out games” on keeps its games here.${older}${bad}`;
  return `${k(c.heldout)} held-out and ${k(c.screen)} screening games on ${k(c.changes)} change${c.changes === 1 ? '' : 's'}. Only held-out games are used as evidence; screening games are kept so they are never counted as held-out games later.${older}${bad}`;
}

/** An import's result in one sentence. */
export function importLine(o: ImportOutcome): string {
  if (o.problem !== undefined) return `Nothing imported: ${o.problem}`;
  const parts = [`Imported ${games(o.added)} new to this browser`, `${games(o.already)} ${o.already === 1 ? 'was' : 'were'} already held`];
  if (o.conflicts) parts.push(`${games(o.conflicts)} came with other scores than the ones held here, which are kept`);
  if (o.leftOut) parts.push(`${games(o.leftOut)} left out because they screened the same change here`);
  if (o.failed) parts.push(`${games(o.failed)} could not be written (this browser’s storage is full or blocked)`);
  return `${parts.join('; ')}.`;
}

/**
 * What a tuning run kept here: "This run kept 1,232 screening and 448 held-out games in this browser (0 already held)."
 * Only held-out games that came back with other scores are mentioned: they are the evidence. A screening game does so
 * whenever one generation screens the same change twice with its cards in another order (a swap that is also a package
 * move), which changes nothing a reader needs; the totals keep both counts.
 */
export function runKeptLine(t: Record<'heldout' | 'screen', { written: number; duplicates: number; conflicts: number; screened: number }>, failed = 0): string {
  const dup = t.heldout.duplicates + t.screen.duplicates;
  const conflicts = t.heldout.conflicts;
  const extra = [
    `${k(dup)} already held`,
    ...(conflicts ? [`${k(conflicts)} held-out game${conflicts === 1 ? '' : 's'} came back with other scores, the earlier kept`] : []),
    ...(t.heldout.screened ? [`${games(t.heldout.screened)} left out because an earlier run screened the change on ${t.heldout.screened === 1 ? 'it' : 'them'}`] : []),
  ];
  const fail = failed ? ` ${games(failed)} could not be written: this browser’s storage is full or blocked.` : '';
  return `This run kept ${k(t.screen.written)} screening and ${k(t.heldout.written)} held-out games in this browser (${extra.join('; ')}).${fail}`;
}

/**
 * The Lab's sentence after its rule line when a run uses earlier held-out games, in plain words (the command line says
 * the same with describeRule's pooling clause). Under the any-gain rule games are kept but never pooled.
 */
export function earlierGamesRuleWords(rule: Pick<AdoptionRule, 'kind' | 'alpha' | 'capStages' | 'boundary'>, nominees = 1): string {
  if (rule.kind !== 'evidence') return 'This run’s games are kept for later runs, but the any-gain rule never uses earlier ones.';
  const pooledZ = alwaysValidZ(896, pooledShare(rule.alpha, nominees)).toFixed(2);
  const firstZ = lookZ(rule, nominees).toFixed(2);
  return `Earlier held-out games are used: a change that already has some (same list, bots, field and simulator version) is judged on them and the new games together, at a stricter bar that stays right however often the games are looked at (z ${pooledZ} at 896 games, against ${firstZ} at a first confirmation’s last look). A change its earlier games already reject is not tested again.`;
}

/** The confirm dialog's words for Clear. */
export function clearLedgerWords(c: LedgerCounts | null): { title: string; body: string } {
  const n = c ? c.heldout + c.screen + c.older.games : 0;
  return {
    title: 'Clear the evidence kept in this browser?',
    body: `${n ? `All ${games(n)}` : 'Every game'} kept here for the Deck Lab ${n === 1 ? 'is' : 'are'} removed, from every simulator version, and later runs start from nothing. Export first to keep a copy. This cannot be undone.`,
  };
}
