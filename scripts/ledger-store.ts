// Node store of the change ledger (src/lib/changeLedger.ts; docs/SYNERGIES.md "Pooling held-out games across runs").
//
// Files: <dir>/<base list fingerprint>.jsonl, one batch per line, append-only (default dir data/ledger, committed;
// under a builder's --out DIR it is DIR/ledger). Appending drops the games the entry already holds with the same scores
// and writes nothing for an empty batch, so repeating a run does not grow the files. A game that comes back with other
// scores is written once (so the conflict is on record) and counted; the earlier scores are the ones kept. A held-out
// game that screened the same change in an earlier run is not written at all: it is never evidence for that change.
//
// What does not depend on files is shared with the Deck Lab's browser store (src/lib/changeLedgerRun.ts): the game
// layout (blockSlots, scored), the merge of a base list's batches with the record of what is already kept (LedgerCache)
// and the per-run logic (ChangeLedgerRun). RunLedger is that run logic over this store: what a builder
// (scripts/forge.ts, scripts/optimize.ts) holds for one run, with the summary line its log prints.
import fs from 'node:fs';
import path from 'node:path';
import { batchLine, changeBase, ledgerExport, parseBatchLine, type EntryId, type LedgerBatch, type LedgerEntry, type LedgerExport } from '../src/lib/changeLedger';
import { ChangeLedgerRun, LedgerCache, type AppendResult, type LedgerBackend } from '../src/lib/changeLedgerRun';

export { blockSlots, confirmationSlots, scored, type GameSlot, type LedgerTotals } from '../src/lib/changeLedgerRun';

const FILE_RE = /^[0-9a-f]{16}\.jsonl$/;

/** Every batch in a ledger directory, file by file, with the lines that could not be read. Read-only. */
export function readLedgerDir(dir: string): { files: { file: string; batches: { line: number; batch: LedgerBatch }[]; problems: string[] }[] } {
  if (!fs.existsSync(dir)) return { files: [] };
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.jsonl'))
    .sort()
    .map((file) => {
      const problems: string[] = [];
      const batches: { line: number; batch: LedgerBatch }[] = [];
      if (!FILE_RE.test(file)) problems.push('the file name is not a list fingerprint');
      const text = fs.readFileSync(path.join(dir, file), 'utf8');
      text.split('\n').forEach((raw, i) => {
        const line = raw.replace(/\r$/, '');
        if (!line.trim()) return;
        const r = parseBatchLine(line);
        if (!r.batch) problems.push(`line ${i + 1}: ${r.problem}`);
        else if (FILE_RE.test(file) && changeBase(r.batch.entry.change) !== file.slice(0, 16)) problems.push(`line ${i + 1}: the change's base list is not this file's`);
        else batches.push({ line: i + 1, batch: r.batch });
      });
      return { file, batches, problems };
    });
  return { files };
}

/**
 * The export document (`kind: 'nct-change-ledger'`, schema 1; the Deck Lab imports it) of a ledger directory: every
 * readable batch, file by file in line order, of the base lists in `bases` (all when absent) and the simulator version
 * `simVersion` (all when absent). Unreadable lines are left out and listed in `problems`. Read-only.
 */
export function exportLedgerDir(dir: string, o: { bases?: ReadonlySet<string>; simVersion?: number; now?: Date } = {}): { doc: LedgerExport; games: number; otherVersions: number; problems: string[] } {
  const batches: LedgerBatch[] = [];
  const problems: string[] = [];
  let otherVersions = 0;
  for (const f of readLedgerDir(dir).files) {
    if (o.bases && !o.bases.has(f.file.slice(0, 16))) continue;
    problems.push(...f.problems.map((p) => `${f.file}: ${p}`));
    for (const { batch } of f.batches) {
      if (o.simVersion !== undefined && batch.entry.simVersion !== o.simVersion) otherVersions++;
      else batches.push(batch);
    }
  }
  return { doc: ledgerExport(batches, o.now), games: batches.reduce((s, b) => s + b.games.length, 0), otherVersions, problems };
}

/** One ledger directory: read lazily, one base list's file at a time, and appended to. */
export class LedgerStore implements LedgerBackend {
  private cache = new LedgerCache();
  private problemsOf = new Map<string, string[]>();
  constructor(readonly dir: string) {}

  fileOf(base: string): string {
    return path.join(this.dir, `${base}.jsonl`);
  }

  private load(base: string): void {
    if (this.cache.has(base)) return;
    const problems: string[] = [];
    const batches: LedgerBatch[] = [];
    const file = this.fileOf(base);
    if (fs.existsSync(file)) {
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((raw, i) => {
          const line = raw.replace(/\r$/, '');
          if (!line.trim()) return;
          const r = parseBatchLine(line);
          if (!r.batch) problems.push(`${file} line ${i + 1}: ${r.problem}`);
          else batches.push(r.batch);
        });
    }
    this.cache.loadBase(base, batches);
    this.problemsOf.set(base, problems);
  }

  /** Lines of this base list's file that could not be read (they are skipped, never rewritten). */
  problems(base: string): string[] {
    this.load(base);
    return this.problemsOf.get(base) ?? [];
  }

  entry(id: EntryId): LedgerEntry | undefined {
    this.load(changeBase(id.change));
    return this.cache.entry(id);
  }

  /** Every entry of one base list (read from its file the first time). */
  entriesOf(base: string): LedgerEntry[] {
    this.load(base);
    return this.cache.entriesOf(base);
  }

  /**
   * Append a batch: games already on record with the same scores are dropped, and an empty batch writes nothing. Returns
   * what was written: `added` (new games), `conflicts` (written, but the earlier scores are kept) and `duplicates` (dropped).
   */
  append(b: LedgerBatch): AppendResult {
    const base = changeBase(b.entry.change);
    this.load(base);
    const { result, toWrite } = this.cache.append(b);
    if (toWrite) {
      fs.mkdirSync(this.dir, { recursive: true });
      fs.appendFileSync(this.fileOf(base), `${batchLine(toWrite)}\n`);
    }
    return result;
  }
}

/** The ledger as one builder run uses it (ChangeLedgerRun over a LedgerStore), with the line its log prints. */
export class RunLedger extends ChangeLedgerRun {
  declare readonly store: LedgerStore;
  declare readonly o: ChangeLedgerRun['o'] & { dir: string };
  /** `store`: share one store between runs of one process (default: a new one on `dir`) */
  constructor(o: { dir: string; simVersion: number; bot: string; opponents: readonly string[]; run: string; date: string; store?: LedgerStore; totals?: ChangeLedgerRun['totals'] }) {
    super(o.store ?? new LedgerStore(o.dir), o);
  }

  /** "appended 1,232 screening and 448 held-out games to DIR (0 already on record)", plus conflicts and left-out games when there are any */
  summary(): string {
    const k = (x: number) => x.toLocaleString('en-US');
    const s = this.totals.screen;
    const h = this.totals.heldout;
    // by kind: a screening game comes back with other scores whenever one generation screens the same change twice with
    // its cards in another order (a swap that is also a package move); a held-out one is the case worth a look
    const kinds = [h.conflicts ? `${k(h.conflicts)} held-out` : '', s.conflicts ? `${k(s.conflicts)} screening` : ''].filter(Boolean);
    const conflicts = kinds.length ? `; ${kinds.join(' and ')} game${h.conflicts + s.conflicts === 1 ? '' : 's'} came back with other scores, the earlier kept` : '';
    const leftOut = h.screened ? `; ${k(h.screened)} held-out game${h.screened === 1 ? '' : 's'} left out because an earlier run screened the change on ${h.screened === 1 ? 'it' : 'them'}` : '';
    return `appended ${k(s.written)} screening and ${k(h.written)} held-out games to ${this.o.dir} (${k(s.duplicates + h.duplicates)} already on record${conflicts}${leftOut})`;
  }
}
