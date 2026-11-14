// "Your tournaments" on deck tiles, deck pages and the Power ratings page (feature `yourTournamentStats`): the record
// per list from the ledger of runs finished in this browser (src/lib/runLedger.ts, read at once: it is small), and the
// provisional ratings (src/ui/yourStatsRuntime.ts, loaded on demand the first time there is something to rate or saved
// runs to fold in). One store for the page: it follows the ledger when a run finishes or it is cleared, here
// (LEDGER_CHANGED) or in another tab (the `storage` event), the same way useLibraryVersion follows the deck library.
import { useEffect, useSyncExternalStore } from 'react';
import { LEDGER_CHANGED, LEDGER_KEY, ledgerSummary, parseLedger, readLedgerText, yourRecords, type YourRecord } from '../lib/runLedger';
import type { Provisional } from '../lib/yourStats';
import { useFeature } from './useSiteConfig';

type Runtime = typeof import('./yourStatsRuntime');

export interface YourStats {
  /** your record per list fingerprint (counted runs only) */
  records: ReadonlyMap<string, YourRecord>;
  summary: ReturnType<typeof ledgerSummary>;
  /** provisional ratings per unrated list; null until the rating code has loaded */
  provisional: ReadonlyMap<string, Provisional> | null;
}

let runtime: Runtime | null = null;
let loading: Promise<void> | null = null;
/** bumped by every change this store hears of (a write here, another tab, the rating code arriving) */
let version = 0;
let cache: { raw: string | null; rt: Runtime | null; version: number; value: YourStats } | null = null;

function snapshot(): YourStats {
  // while anything listens, every change arrives as an event, so the stored text (up to the ledger's cap) is not re-read
  // on each render of each tile; with no listener (server rendering, tests) it is read and compared every time
  if (subs.size && cache && cache.version === version && cache.rt === runtime) return cache.value;
  const raw = readLedgerText();
  if (cache && cache.raw === raw && cache.rt === runtime) {
    cache.version = version;
    return cache.value;
  }
  const ledger = parseLedger(raw);
  const value: YourStats = { records: yourRecords(ledger), summary: ledgerSummary(ledger), provisional: runtime ? runtime.provisionalFor(raw) : null };
  cache = { raw, rt: runtime, version, value };
  return value;
}

const subs = new Set<() => void>();
const emit = () => {
  version++;
  for (const f of [...subs]) f();
};
const onStorage = (e: StorageEvent) => {
  if (!e.key || e.key === LEDGER_KEY) emit();
};
function subscribe(fn: () => void) {
  if (!subs.size && typeof window !== 'undefined') {
    window.addEventListener(LEDGER_CHANGED, emit);
    window.addEventListener('storage', onStorage);
  }
  subs.add(fn);
  return () => {
    subs.delete(fn);
    if (!subs.size && typeof window !== 'undefined') {
      window.removeEventListener(LEDGER_CHANGED, emit);
      window.removeEventListener('storage', onStorage);
    }
  };
}

/**
 * Load the rating code once (then fold the runner's saved runs into the ledger, once per page load). Tests await it to
 * render the provisional state in static markup.
 */
export function loadYourStatsRuntime(): Promise<void> {
  loading ??= import('./yourStatsRuntime')
    .then((m) => {
      runtime = m;
      m.migrateSavedRuns();
      emit();
    })
    .catch(() => {
      loading = null; // a failed chunk load: try again on a later visit
    });
  return loading;
}

/** Saved runs from before the ledger may need folding in. */
const savedRunsHere = () => {
  try {
    return localStorage.getItem('nct.runs.v1') !== null;
  } catch {
    return false;
  }
};

/** Your tournament stats, or null when the owner turned the feature off. */
export function useYourStats(): YourStats | null {
  const on = useFeature('yourTournamentStats');
  const s = useSyncExternalStore(subscribe, snapshot, snapshot);
  const wants = on && !runtime && (s.summary.hardRuns > 0 || savedRunsHere());
  useEffect(() => {
    if (wants) void loadYourStatsRuntime();
  }, [wants]);
  return on ? s : null;
}

/** A list's record and provisional rating (either may be missing). */
export function yourStatsFor(s: YourStats | null, list: string): { rec?: YourRecord; prov?: Provisional } {
  if (!s) return {};
  const rec = s.records.get(list);
  const prov = s.provisional?.get(list);
  return { ...(rec ? { rec } : {}), ...(prov ? { prov } : {}) };
}
