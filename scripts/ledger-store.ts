// Node store of the change ledger (src/lib/changeLedger.ts; docs/SYNERGIES.md "Pooling held-out games across runs").
//
// Files: <dir>/<base list fingerprint>.jsonl, one batch per line, append-only (default dir data/ledger, committed;
// under a builder's --out DIR it is DIR/ledger). Appending drops the games the entry already holds with the same scores
// and writes nothing for an empty batch, so repeating a run does not grow the files. A game that comes back with other
// scores is written once (so the conflict is on record) and counted; the earlier scores are the ones kept. A held-out
// game that screened the same change in an earlier run is not written at all: it is never evidence for that change.
//
// RunLedger is what a builder (scripts/forge.ts, scripts/optimize.ts) holds for one run: the entry context (simulator
// version, canonical bot, field), the priors it hands confirmStaged and the batches it appends.
import fs from 'node:fs';
import path from 'node:path';
import { addBatch, batchLine, changeBase, changeKey, entryKey, fieldFingerprint, gameId, parseBatchLine, priorOf, screenedBefore, type AddResult, type BatchKind, type EntryId, type LedgerBatch, type LedgerEntry, type LedgerGame } from '../src/lib/changeLedger';
import type { PairedScores } from '../src/lib/evidence';
import type { DeckList } from '../src/engine/types';

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

interface FileState {
  entries: Map<string, LedgerEntry>;
  /** per entry and kind, every game id + scores on record (kept and conflicting), so nothing is written twice */
  written: Map<string, Set<string>>;
  problems: string[];
}

const tupleOf = (g: LedgerGame) => `${gameId(g)}=${g.base}/${g.cand}`;

/** One ledger directory: read lazily, one base list's file at a time, and appended to. */
export class LedgerStore {
  private files = new Map<string, FileState>();
  constructor(readonly dir: string) {}

  fileOf(base: string): string {
    return path.join(this.dir, `${base}.jsonl`);
  }

  private load(base: string): FileState {
    let s = this.files.get(base);
    if (s) return s;
    s = { entries: new Map(), written: new Map(), problems: [] };
    const file = this.fileOf(base);
    if (fs.existsSync(file)) {
      fs.readFileSync(file, 'utf8')
        .split('\n')
        .forEach((raw, i) => {
          const line = raw.replace(/\r$/, '');
          if (!line.trim()) return;
          const r = parseBatchLine(line);
          if (!r.batch) return void s!.problems.push(`${file} line ${i + 1}: ${r.problem}`);
          addBatch(s!.entries, r.batch);
          const set = this.writtenSet(s!, r.batch);
          for (const g of r.batch.games) set.add(tupleOf(g));
        });
    }
    this.files.set(base, s);
    return s;
  }

  private writtenSet(s: FileState, b: Pick<LedgerBatch, 'entry' | 'kind'>): Set<string> {
    const k = `${entryKey(b.entry)}|${b.kind}`;
    let set = s.written.get(k);
    if (!set) s.written.set(k, (set = new Set()));
    return set;
  }

  /** Lines of this base list's file that could not be read (they are skipped, never rewritten). */
  problems(base: string): string[] {
    return this.load(base).problems;
  }

  entry(id: EntryId): LedgerEntry | undefined {
    return this.load(changeBase(id.change)).entries.get(entryKey(id));
  }

  /**
   * Append a batch: games already on record with the same scores are dropped, and an empty batch writes nothing. Returns
   * what was written: `added` (new games), `conflicts` (written, but the earlier scores are kept) and `duplicates` (dropped).
   */
  append(b: LedgerBatch): AddResult & { written: number } {
    const s = this.load(changeBase(b.entry.change));
    const set = this.writtenSet(s, b);
    const entry = s.entries.get(entryKey(b.entry));
    const fresh: LedgerGame[] = [];
    let duplicates = 0;
    let screened = 0;
    for (const g of b.games) {
      // a held-out game that screened this change in an earlier run is never evidence for it: it is not written
      if (b.kind === 'heldout' && entry && screenedBefore(entry, g)) {
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
    if (!fresh.length) return { added: [], duplicates, conflicts: 0, screened, written: 0 };
    const batch: LedgerBatch = { ...b, games: fresh };
    fs.mkdirSync(this.dir, { recursive: true });
    fs.appendFileSync(this.fileOf(changeBase(b.entry.change)), `${batchLine(batch)}\n`);
    const r = addBatch(s.entries, batch);
    return { added: r.added, duplicates: duplicates + r.duplicates, conflicts: r.conflicts, screened: screened + r.screened, written: fresh.length };
  }
}

/** A game's place in a builder's layout, before it is played. */
export type GameSlot = Pick<LedgerGame, 'seed' | 'opp' | 'first'>;

/**
 * The forge's and the optimizer's layout (their jobs code): game k of a block that starts at seed `seed0` plays opponent
 * `opponents[k % n]`, seed `seed0 + k`, the list under test first when floor(k / n) is even.
 */
export function blockSlots(seed0: number, games: number, opponents: readonly string[]): GameSlot[] {
  const n = opponents.length;
  return Array.from({ length: games }, (_, k) => ({ seed: seed0 + k, opp: opponents[k % n] ?? '', first: (Math.floor(k / n) % 2) as 0 | 1 }));
}

/** Slots with the scores the base list and the candidate got in them (game for game). */
export function scored(slots: readonly GameSlot[], base: readonly number[], cand: readonly number[]): LedgerGame[] {
  if (base.length !== slots.length || cand.length !== slots.length) throw new Error(`a block of ${slots.length} games came back with ${base.length} base and ${cand.length} candidate scores`);
  return slots.map((s, i) => ({ ...s, base: base[i] ?? 0, cand: cand[i] ?? 0 }));
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

/** The ledger as one builder run uses it. */
export class RunLedger {
  readonly store: LedgerStore;
  readonly field: string;
  readonly totals: Record<BatchKind, LedgerTotals> = { heldout: { written: 0, duplicates: 0, conflicts: 0, screened: 0 }, screen: { written: 0, duplicates: 0, conflicts: 0, screened: 0 } };
  /** `store`: share one store between runs of one process (default: a new one on `dir`) */
  constructor(readonly o: { dir: string; simVersion: number; bot: string; opponents: readonly string[]; run: string; date: string; store?: LedgerStore }) {
    this.store = o.store ?? new LedgerStore(o.dir);
    this.field = fieldFingerprint(o.opponents);
  }

  entryId(base: Lists, cand: Lists): EntryId {
    return { change: changeKey(base, cand), simVersion: this.o.simVersion, bot: this.o.bot, field: this.field };
  }

  /** The held-out games of this change from earlier runs, leaving out the games in `leaveOut`. */
  prior(base: Lists, cand: Lists, leaveOut: ReadonlySet<string>): PairedScores {
    return priorOf(this.store.entry(this.entryId(base, cand)), leaveOut);
  }

  /** Append one change's games of one kind (nothing is written when they are all on record). */
  record(kind: BatchKind, base: Lists, cand: Lists, label: string, games: LedgerGame[]): AddResult & { written: number } {
    const r = this.store.append({ entry: this.entryId(base, cand), kind, label, run: this.o.run, date: this.o.date, games });
    const t = this.totals[kind];
    t.written += r.written;
    t.duplicates += r.duplicates;
    t.conflicts += r.conflicts;
    t.screened += r.screened;
    return r;
  }

  /** "appended 1,232 screening and 448 held-out games to DIR (0 already on record)", plus conflicts and left-out games when there are any */
  summary(): string {
    const k = (x: number) => x.toLocaleString('en-US');
    const s = this.totals.screen;
    const h = this.totals.heldout;
    const conflicts = s.conflicts + h.conflicts;
    const leftOut = h.screened ? `; ${k(h.screened)} held-out game${h.screened === 1 ? '' : 's'} left out because an earlier run screened the change on ${h.screened === 1 ? 'it' : 'them'}` : '';
    return `appended ${k(s.written)} screening and ${k(h.written)} held-out games to ${this.o.dir} (${k(s.duplicates + h.duplicates)} already on record${conflicts ? `; ${k(conflicts)} came back with other scores, the earlier kept` : ''}${leftOut})`;
  }
}
