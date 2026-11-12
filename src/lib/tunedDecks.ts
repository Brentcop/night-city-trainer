// The tuned decks page (#/tuned): every deck tuned in the Deck Lab and saved in this browser, with its end result
// read from its tuning record (src/lib/tuneRecord.ts): the verdict against the original in the Lab's words, the paired
// gain, each adopted change. Also the Export all / Import file that moves tuned decks between browsers, and the forge
// lines of tuned decks committed to the repository. Pure: the page is src/ui/pages/TunedDecks.tsx.
import { listFingerprint } from '../engine/deck';
import { formatGain } from './evidence';
import type { LibraryDeck } from './library';
import { toDeck, type StoredDeck } from './browserLibrary';
import { TUNED_NAME } from './deckSource';
import { isTunedRecord, type GainRecord, type TunedDeckRecord, type VsOriginalVerdict } from './tuneRecord';

export interface TunedEntry {
  deck: LibraryDeck;
  record: TunedDeckRecord;
}

/** The decks saved in this browser with a tuning record, newest first. */
export function tunedEntries(lib: readonly LibraryDeck[]): TunedEntry[] {
  return lib
    .flatMap((d) => (d.kind === 'custom' && d.tuned ? [{ deck: d, record: d.tuned }] : []))
    .sort((a, b) => b.record.date.localeCompare(a.record.date) || a.deck.deck.name.localeCompare(b.deck.deck.name));
}

/** Saved decks that look like Deck Lab tuning output ("… (tuned)") but have no record: saved before records existed. */
export const tunedWithoutRecord = (lib: readonly LibraryDeck[]): LibraryDeck[] => lib.filter((d) => d.kind === 'custom' && !d.tuned && TUNED_NAME.test(d.deck.name));

/** The verdict against the original; 'unmeasured' when the run ended before the tuned list was compared. */
export type VerdictKey = VsOriginalVerdict | 'unmeasured';
export const VERDICTS: readonly VerdictKey[] = ['better', 'unclear', 'unchanged', 'worse', 'unmeasured'];
export const verdictOf = (r: TunedDeckRecord): VerdictKey => r.vsOriginal?.verdict ?? 'unmeasured';

/** The words the Lab uses (src/lib/deckLab.ts trajectoryLine / tuneSummaryText). */
export const VERDICT_WORD: Record<VerdictKey, string> = {
  better: 'better',
  unclear: 'could not tell',
  unchanged: 'unchanged',
  worse: 'worse',
  unmeasured: 'not measured',
};
export const verdictTone = (k: VerdictKey): 'pos' | 'neg' | 'neu' => (k === 'better' ? 'pos' : k === 'worse' ? 'neg' : 'neu');

/** The verdict in one line: "better: +5.8 pts [+2.7, +8.9], 224 games", "could not tell: …", "unchanged: …". */
export function verdictLine(r: TunedDeckRecord): string {
  const k = verdictOf(r);
  const g = r.vsOriginal?.gain;
  if (k === 'unchanged') return 'unchanged: no change was adopted, so the result is the original list';
  if (k === 'unmeasured') return `not measured: the run ended before the tuned list was compared with the original, so it is not shown to be better`;
  return `${VERDICT_WORD[k]}${g ? `: ${formatGain(g)}` : ''}`;
}

/** The paired gain against the original, if measured. */
export const gainOf = (r: TunedDeckRecord): GainRecord | undefined => r.vsOriginal?.gain;

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? (s[m] ?? null) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2;
};

/** The summary strip: how many tuned, how many shown better, and the median gain of those. */
export function tunedSummary(entries: readonly TunedEntry[]): { total: number; better: number; medianGain: number | null } {
  const better = entries.filter((e) => verdictOf(e.record) === 'better');
  return { total: entries.length, better: better.length, medianGain: median(better.map((e) => gainOf(e.record)?.mean).filter((x): x is number => typeof x === 'number')) };
}

export type TunedSort = 'newest' | 'oldest' | 'gain' | 'verdict' | 'original';
export const TUNED_SORT_LABEL: Record<TunedSort, string> = { newest: 'newest', oldest: 'oldest', gain: 'gain vs original', verdict: 'verdict', original: 'original deck' };
export interface TunedFilter {
  /** verdicts to show (empty: all) */
  verdicts: VerdictKey[];
  /** the original deck's name ('' = any) */
  original: string;
  sort: TunedSort;
}
export const DEFAULT_TUNED_FILTER: TunedFilter = { verdicts: [], original: '', sort: 'newest' };

/** The entries a filter shows, sorted. */
export function applyTunedFilter(entries: readonly TunedEntry[], f: TunedFilter): TunedEntry[] {
  const newest = (a: TunedEntry, b: TunedEntry) => b.record.date.localeCompare(a.record.date) || a.deck.deck.name.localeCompare(b.deck.deck.name);
  const cmp: Record<TunedSort, (a: TunedEntry, b: TunedEntry) => number> = {
    newest,
    oldest: (a, b) => -newest(a, b),
    gain: (a, b) => (gainOf(b.record)?.mean ?? -Infinity) - (gainOf(a.record)?.mean ?? -Infinity) || newest(a, b),
    verdict: (a, b) => VERDICTS.indexOf(verdictOf(a.record)) - VERDICTS.indexOf(verdictOf(b.record)) || newest(a, b),
    original: (a, b) => a.record.original.name.localeCompare(b.record.original.name) || newest(a, b),
  };
  return entries.filter((e) => (!f.verdicts.length || f.verdicts.includes(verdictOf(e.record))) && (!f.original || e.record.original.name === f.original)).sort(cmp[f.sort]);
}

/** The rule a run used, in one line, from what the record keeps of it. */
export function ruleLine(r: TunedDeckRecord): string {
  const a = r.rule;
  if (a.rule === 'any-gain') return 'any-gain (legacy): adopted when a change scored higher at all on fresh games';
  const stop = a.futilityAfterStages ? `; stops early with ${a.futilityMaxGainPp ? `a gain of at most ${a.futilityMaxGainPp} pts` : 'no gain'} after ${a.futilityAfterStages} stage${a.futilityAfterStages === 1 ? '' : 's'}` : '';
  return `evidence: adopt when the held-out paired gain's lower bound clears ${a.minGainPp} pt${a.minGainPp === 1 ? '' : 's'} with at least ${a.minGames} games; stages of ${a.firstStage} up to ${a.firstStage * a.capStages} games; α ${a.alpha} (${a.correction === 'obrien-fleming' ? "O'Brien–Fleming" : a.correction})${stop}`;
}

// ---------------------------------------------------------------- export / import

export const TUNED_EXPORT_KIND = 'nct-tuned-decks';
export interface TunedExport {
  kind: typeof TUNED_EXPORT_KIND;
  schema: 1;
  exported: string;
  /** each deck as stored, with its tuning record and run manifest */
  decks: StoredDeck[];
}

/** A library deck back in its stored form (the list, its manifest and record). */
export function storedOf(d: Pick<LibraryDeck, 'deck' | 'manifest' | 'tuned'>): StoredDeck {
  return { ...d.deck, sideboard: d.deck.sideboard ?? [], ...(d.manifest ? { manifest: d.manifest } : {}), ...(d.tuned ? { tuned: d.tuned } : {}) };
}

/** The Export all file. */
export function tunedExport(entries: readonly TunedEntry[], now = new Date()): TunedExport {
  return { kind: TUNED_EXPORT_KIND, schema: 1, exported: now.toISOString(), decks: entries.map((e) => storedOf(e.deck)) };
}

export interface ImportPlan {
  /** decks to add, renamed where their name is taken by a different list */
  add: StoredDeck[];
  /** names skipped because the same list (fingerprint) is already saved here or earlier in the file */
  duplicates: string[];
  /** entries that are not a deck with a tuning record */
  invalid: number;
  renamed: { from: string; to: string }[];
  /** the file itself could not be read */
  error?: string;
}

/** What importing a tuned decks file would do, against the decks already saved here. Nothing is written. */
export function planImport(text: string, existing: readonly StoredDeck[], reserved: ReadonlySet<string> = new Set()): ImportPlan {
  const empty: ImportPlan = { add: [], duplicates: [], invalid: 0, renamed: [] };
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ...empty, error: 'This is not a JSON file.' };
  }
  const o = data as Partial<TunedExport> | null;
  if (!o || typeof o !== 'object' || o.kind !== TUNED_EXPORT_KIND) return { ...empty, error: 'This is not a tuned decks file (exported from this page).' };
  if (o.schema !== 1) return { ...empty, error: `This file uses a newer format (schema ${String(o.schema)}) than this page reads.` };
  if (!Array.isArray(o.decks)) return { ...empty, error: 'The file has no deck list.' };
  const seen = new Set(existing.map((d) => listFingerprint(d)));
  const names = new Set([...existing.map((d) => d.name), ...reserved]);
  const plan: ImportPlan = { ...empty, add: [], duplicates: [], renamed: [] };
  for (const raw of o.decks) {
    const d = toDeck(raw);
    if (!d || !isTunedRecord(d.tuned)) {
      plan.invalid++;
      continue;
    }
    const fp = listFingerprint(d);
    if (seen.has(fp)) {
      plan.duplicates.push(d.name);
      continue;
    }
    seen.add(fp);
    let name = d.name;
    for (let k = 2; names.has(name); k++) name = `${d.name} (${k})`;
    if (name !== d.name) plan.renamed.push({ from: d.name, to: name });
    names.add(name);
    plan.add.push({ ...d, name });
  }
  return plan;
}

/** The import's result in one sentence. */
export function importReport(p: ImportPlan): string {
  if (p.error) return `Nothing imported: ${p.error}`;
  const parts = [`Imported ${p.add.length} tuned deck${p.add.length === 1 ? '' : 's'}`];
  if (p.duplicates.length) parts.push(`skipped ${p.duplicates.length} already saved here (same list)`);
  if (p.invalid) parts.push(`skipped ${p.invalid} entr${p.invalid === 1 ? 'y' : 'ies'} without a tuning record`);
  if (p.renamed.length) parts.push(`renamed ${p.renamed.map((r) => `“${r.from}” to “${r.to}”`).join(', ')} (the name was taken)`);
  return `${parts.join('; ')}.`;
}

// ---------------------------------------------------------------- forged in the repository

export interface ForgedChange {
  label: string;
  /** the held-out paired gain as the forge wrote it ("+2.4 pts [+1.1, +3.8], 560 games"), when it did */
  heldOut?: string;
}

/**
 * A deck file's forge line ("2026-11-12: −1 A → +1 B (held-out +2.4 pts [+1.1, +3.8], 560 games); …", what follows
 * "// Forged "), split into its date and changes.
 */
export function parseForged(line: string): { date: string; changes: ForgedChange[] } | null {
  const m = line.match(/^(\d{4}-\d{2}-\d{2}):\s*(.*)$/);
  if (!m || m[1] === undefined) return null;
  const changes = (m[2] ?? '')
    .split(/;\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s): ForgedChange => {
      const h = s.match(/^(.*?)\s*\(held-out (.+)\)$/);
      return h && h[1] !== undefined && h[2] !== undefined ? { label: h[1], heldOut: h[2] } : { label: s };
    });
  return { date: m[1], changes };
}
