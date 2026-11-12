// What a Deck Lab tuning run stores with the list it saves (StoredDeck.tuned in src/lib/browserLibrary.ts), so a later
// page can list tuned decks with their end results without re-reading the run: which list it started from and ended
// with, each adopted change with its held-out gain, the tuned list against the original on common held-out games, the
// rule, field, bot and date, and the run manifest's id (the whole manifest is stored beside it). Plain data.
import { listFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';
import type { AdoptionProvenance } from './evidence';
import type { PackageProvenance } from './deckPackages';
import type { PairedInterval } from './evidence';
import type { RunManifest } from './runManifest';

/** The current list against the original submitted list, after one generation (TuneLog.vsOriginal). */
export interface VsOriginal {
  /** nothing adopted yet: the current list is the original (no games needed) */
  same: boolean;
  /** changes adopted so far */
  adopted: number;
  /** the paired gain of the current list over the original on the common held-out block (plain 95%); absent while `same` */
  gain?: PairedInterval;
  /** win rates of the original and the current list on that block */
  origWr?: number;
  curWr?: number;
  /** measured after this generation (false: carried over, the list did not change this generation) */
  measured: boolean;
}
export type VsOriginalVerdict = 'unchanged' | 'better' | 'unclear' | 'worse';

/**
 * Whether the tuned list is shown better than the original: 'better' when the lower bound of the paired gain clears the
 * adoption bar (minGainPp points), 'worse' when the upper bound is below zero, 'unclear' otherwise ("could not tell");
 * 'unchanged' when nothing was adopted. Null when the run never got that far.
 */
export function vsOriginalVerdict(v: Pick<VsOriginal, 'same' | 'gain'> | undefined, minGainPp: number): VsOriginalVerdict | null {
  if (!v) return null;
  if (v.same || !v.gain) return 'unchanged';
  if (v.gain.lower > minGainPp / 100) return 'better';
  if (v.gain.upper < 0) return 'worse';
  return 'unclear';
}

/** The run's last vs-original state (the final list against the original), or undefined when it was never set. */
export const finalVsOriginal = (logs: readonly { vsOriginal?: VsOriginal }[]): VsOriginal | undefined => [...logs].reverse().find((l) => l.vsOriginal)?.vsOriginal;

/** The parts of a generation's log (src/lib/deckLab.ts TuneLog) a record reads. */
export interface TuneLogLike {
  gen: number;
  adopted: string | null;
  adoptedGain?: PairedInterval;
  swaps: readonly { label: string; pkg?: { kind: string } }[];
  vsOriginal?: VsOriginal;
}

export interface GainRecord {
  mean: number;
  lower: number;
  upper: number;
  games: number;
  z: number;
}

/** Schema 1. Add optional fields only; anything else bumps `schema`. */
export interface TunedDeckRecord {
  kind: 'deck-lab-tune';
  schema: 1;
  /** when the list was saved (ISO) */
  date: string;
  original: { name: string; file?: string; listId: string };
  final: { listId: string };
  /** a run stopped (or failed) before it finished: only the changes confirmed by then */
  partial: boolean;
  generations: { planned: number; run: number };
  /** each adopted change, in order, with its held-out paired gain against the list before it (the adoption evidence) */
  changes: { gen: number; label: string; package?: string; heldOut: GainRecord | null }[];
  /**
   * the final list against the original on one common held-out block (paired, plain 95%); verdict 'unchanged' when
   * nothing was adopted; null when the run ended before it was measured
   */
  vsOriginal: { verdict: VsOriginalVerdict; gain?: GainRecord; origWr?: number; finalWr?: number; minGainPp: number } | null;
  rule: AdoptionProvenance;
  field: { mode: string; deckIds: string[] };
  bot: string;
  /** cuts and adds ranked partner-aware (src/lib/cutRanking.ts) */
  partnerAware: boolean;
  packages?: PackageProvenance;
  /** the run manifest's runId (StoredDeck.manifest holds the whole manifest) */
  runId: string | null;
}

const r4 = (x: number) => Math.round(x * 10_000) / 10_000;
const gainOf = (g: { mean: number; lower: number; upper: number; games: number; z: number }): GainRecord => ({ mean: r4(g.mean), lower: r4(g.lower), upper: r4(g.upper), games: g.games, z: r4(g.z) });

/** The record of one run, from its logs and manifest. */
export function tunedRecord(o: {
  original: Pick<DeckList, 'name' | 'legends' | 'main'> & { file?: string };
  final: Pick<DeckList, 'legends' | 'main'>;
  logs: readonly TuneLogLike[];
  partial: boolean;
  gens: number;
  rule: AdoptionProvenance;
  manifest: RunManifest | null;
  bot: string;
  fieldMode: string;
  fieldDeckIds: string[];
  partnerAware: boolean;
  packages?: PackageProvenance;
  date?: string;
}): TunedDeckRecord {
  const v = finalVsOriginal(o.logs);
  const verdict = vsOriginalVerdict(v, o.rule.minGainPp);
  return {
    kind: 'deck-lab-tune',
    schema: 1,
    date: o.date ?? new Date().toISOString(),
    original: { name: o.original.name, ...(o.original.file ? { file: o.original.file } : {}), listId: listFingerprint(o.original) },
    final: { listId: listFingerprint(o.final) },
    partial: o.partial,
    generations: { planned: o.gens, run: o.logs.length },
    changes: o.logs.flatMap((l) => {
      if (!l.adopted) return [];
      const pkg = l.swaps.find((x) => x.label === l.adopted)?.pkg?.kind;
      return [{ gen: l.gen, label: l.adopted, ...(pkg ? { package: pkg } : {}), heldOut: l.adoptedGain ? gainOf(l.adoptedGain) : null }];
    }),
    vsOriginal:
      v && verdict
        ? { verdict, ...(v.gain ? { gain: gainOf(v.gain) } : {}), ...(v.origWr !== undefined ? { origWr: r4(v.origWr) } : {}), ...(v.curWr !== undefined ? { finalWr: r4(v.curWr) } : {}), minGainPp: o.rule.minGainPp }
        : null,
    rule: o.rule,
    field: { mode: o.fieldMode, deckIds: o.fieldDeckIds },
    bot: o.bot,
    partnerAware: o.partnerAware,
    ...(o.packages ? { packages: o.packages } : {}),
    runId: o.manifest?.runId ?? null,
  };
}

/** What the run manifest carries of it (RunManifest.tune). */
export function manifestTune(r: TunedDeckRecord): NonNullable<RunManifest['tune']> {
  return { originalListId: r.original.listId, finalListId: r.final.listId, adopted: r.changes.length, vsOriginal: r.vsOriginal };
}

/** A stored record read back (localStorage): the shape is checked, unknown extra fields are kept. */
export function isTunedRecord(v: unknown): v is TunedDeckRecord {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<TunedDeckRecord>;
  return o.kind === 'deck-lab-tune' && o.schema === 1 && typeof o.date === 'string' && !!o.original && typeof o.original.listId === 'string' && !!o.final && typeof o.final.listId === 'string' && Array.isArray(o.changes);
}
