// Earlier held-out games in the Deck Lab (the change ledger kept in this browser; docs/SYNERGIES.md "Pooling held-out
// games across runs"): the tuner's "Use earlier held-out games" checkbox with its line on this exact list, and the
// "Evidence kept in this browser" block (totals, Export, Import, Clear behind the shared confirm dialog). The store and
// its words are src/lib/changeLedgerStore.ts, the IndexedDB adapter src/lib/changeLedgerIdb.ts; this file and the Deck
// Lab page are the only UI that imports them, so none of it reaches the entry chunk. The checkbox also turns on the
// shortlist from pooled evidence (src/lib/shortlist.ts; SHORTLIST_LINE says so under its line), with no control of its own.
//
// HeldOutCheckbox and HeldOutPanel take everything as props and use no hooks (tests call them directly); the hooks
// below open the store once per page load and read its counts.
import { useCallback, useEffect, useState, type RefObject } from 'react';
import { openLedgerStorage } from '../../lib/changeLedgerIdb';
import { BrowserLedgerStore, clearLedgerWords, holdingLine, importLine, keptLine, type LedgerCounts, type ListHolding } from '../../lib/changeLedgerStore';
import { download } from '../../lib/download';
import type { SdSamples } from '../../lib/deckSearch';
import { SIM_VERSION } from '../../lib/tournament';
import { Modal } from './Modal';

export type HeldOutState = 'loading' | 'ready' | 'unavailable';

/** One store per page load: IndexedDB is opened once, the first time the Lab asks. */
let opening: Promise<BrowserLedgerStore | null> | null = null;
const openStore = () =>
  (opening ??= openLedgerStorage()
    .then((s) => (s ? new BrowserLedgerStore(s) : null))
    .catch(() => null));

/** The store (null while opening or when this browser has no usable IndexedDB), its totals, and a refresh after writes. */
export function useHeldOutStore() {
  const [store, setStore] = useState<BrowserLedgerStore | null>(null);
  const [state, setState] = useState<HeldOutState>('loading');
  const [counts, setCounts] = useState<LedgerCounts | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let live = true;
    void openStore().then((s) => {
      if (!live) return;
      setStore(s);
      setState(s ? 'ready' : 'unavailable');
    });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!store) return;
    let live = true;
    store.counts(SIM_VERSION).then(
      (c) => live && setCounts(c),
      () => live && setCounts(null),
    );
    return () => {
      live = false;
    };
  }, [store, version]);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { store, state, counts, version, refresh };
}

/** What the store holds for one list with this bot and field (null while reading or without a store). */
export function useListHolding(store: BrowserLedgerStore | null, base: string, bot: string | null, field: string, version: number): ListHolding | null {
  const [h, setH] = useState<{ key: string; holding: ListHolding } | null>(null);
  const key = `${base}|${bot}|${field}|${version}`;
  useEffect(() => {
    if (!store || !base) return;
    let live = true;
    store.holding(base, { simVersion: SIM_VERSION, bot, field }).then(
      (holding) => live && setH({ key, holding }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [store, base, bot, field, key]);
  return h && h.key === key ? h.holding : null;
}

/** The per-game SDs of this list's changes kept here for this bot and field (null while reading or without a store). */
export function useListSds(store: BrowserLedgerStore | null, base: string, bot: string | null, field: string, version: number): SdSamples | null {
  const [h, setH] = useState<{ key: string; sds: SdSamples } | null>(null);
  const key = `${base}|${bot}|${field}|${version}`;
  useEffect(() => {
    if (!store || !base) return;
    let live = true;
    store.sdSamples(base, { simVersion: SIM_VERSION, bot, field }).then(
      (sds) => live && setH({ key, sds }),
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, [store, base, bot, field, key]);
  return h && h.key === key ? h.sds : null;
}

const LINE_ID = 'lab-heldout-line';

/** The tuner's checkbox, with one line on what this browser holds for this exact list (`noList`: no valid list yet). */
export function HeldOutCheckbox({ checked, onChange, disabled, state, holding, noList }: { checked: boolean; onChange: (on: boolean) => void; disabled?: boolean; state: HeldOutState; holding: ListHolding | null; noList?: boolean }) {
  const unavailable = state === 'unavailable';
  return (
    <div className="grid" style={{ gap: 2 }}>
      <label className="row small">
        <input type="checkbox" checked={checked && !unavailable} onChange={(e) => onChange(e.target.checked)} disabled={disabled || unavailable} aria-describedby={LINE_ID} />
        <span>
          <b>Use earlier held-out games</b> (on by default): a change that earlier runs in this browser already confirmed on fresh games is judged on those games and the new ones together, and every
          game this run plays is kept for the next one.
        </span>
      </label>
      <div id={LINE_ID} className="small muted" role="status" aria-live="polite">
        {unavailable
          ? 'This browser does not let the Lab keep games (its storage is blocked here, as in some private windows), so each run starts from nothing.'
          : noList
            ? 'Pick or paste a list to see what this browser holds for it.'
            : state === 'loading' || !holding
            ? 'Checking what this browser holds for this list…'
            : holdingLine(holding)}
      </div>
      {!unavailable && <div className="small muted">{SHORTLIST_LINE}</div>}
    </div>
  );
}

/** What the checkbox also turns on (the shortlist from pooled evidence, src/lib/shortlist.ts), in one plain sentence. */
export const SHORTLIST_LINE = 'With it on, each generation also tests again the two most promising changes from earlier runs on this list, and skips changes that earlier games say are not worth testing.';

export interface HeldOutPanelProps {
  state: HeldOutState;
  counts: LedgerCounts | null;
  /** the last action's result, in words */
  message: string;
  /** the Clear confirmation is open */
  asking: boolean;
  /** a run is going: Import and Clear wait */
  disabled?: boolean;
  /** the hidden file input Import opens */
  fileRef: RefObject<HTMLInputElement>;
  onExport: () => void;
  onImportFile: (file: File | undefined) => void;
  onAskClear: () => void;
  onCancelClear: () => void;
  onConfirmClear: () => void;
}

const CLEAR_TITLE_ID = 'lab-heldout-clear-title';

/** "Evidence kept in this browser": the totals, Export, Import and Clear (behind the shared confirm dialog). */
export function HeldOutPanel(p: HeldOutPanelProps) {
  if (p.state === 'unavailable') return null;
  const empty = !p.counts || p.counts.heldout + p.counts.screen + p.counts.older.games === 0;
  const words = clearLedgerWords(p.counts);
  return (
    <details className="small lab-heldout">
      <summary>Evidence kept in this browser</summary>
      <div className="grid" style={{ gap: 6, marginTop: 6 }}>
        <p className="muted" style={{ margin: 0 }}>
          The games of every tuning run with “Use earlier held-out games” on, kept in this browser only. A change’s held-out games are used again only by a run on the same list with the same bots,
          the same field and the same simulator version. Export them to keep a copy or to use them in another browser; games recorded by the command-line forge can be imported too.
        </p>
        <p style={{ margin: 0 }}>{p.state === 'loading' || !p.counts ? 'Reading…' : keptLine(p.counts)}</p>
        <div className="row">
          <button type="button" onClick={p.onExport} disabled={empty} title="A JSON file of every game kept here">
            ⤓ Export
          </button>
          <button type="button" onClick={() => p.fileRef.current?.click()} disabled={p.disabled}>
            ⤒ Import
          </button>
          <input
            ref={p.fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            aria-label="Import a file of kept games"
            onChange={(e) => {
              p.onImportFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
          <button type="button" className="danger-soft" onClick={p.onAskClear} disabled={p.disabled || empty}>
            🗑 Clear
          </button>
        </div>
        {p.message && (
          <p role="status" style={{ margin: 0 }}>
            {p.message}
          </p>
        )}
      </div>
      {p.asking && (
        <Modal labelledBy={CLEAR_TITLE_ID} onClose={p.onCancelClear} className="confirm-dialog">
          <h3 id={CLEAR_TITLE_ID} style={{ marginTop: 0 }}>
            {words.title}
          </h3>
          <p className="muted">{words.body}</p>
          <div className="row confirm-actions">
            <button className="danger" onClick={p.onConfirmClear}>
              Clear
            </button>
            {/* the safe choice takes focus when the dialog opens */}
            <button onClick={p.onCancelClear} data-autofocus>
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </details>
  );
}

/** The panel's actions over a store: export (download), import (a file), clear; each ends with words for the panel. */
export function heldOutActions(store: BrowserLedgerStore | null, done: (message: string) => void, save: (name: string, text: string) => void = (n, t) => download(n, t, 'application/json')) {
  return {
    async exportAll(now = new Date()) {
      if (!store) return;
      const doc = await store.exportDoc(now);
      save(`deck-lab-held-out-games-${now.toISOString().slice(0, 10)}.json`, JSON.stringify(doc));
      const n = doc.batches.reduce((s, b) => s + b.g.length, 0);
      done(`Exported ${n.toLocaleString('en-US')} game${n === 1 ? '' : 's'} in ${doc.batches.length.toLocaleString('en-US')} batch${doc.batches.length === 1 ? '' : 'es'}.`);
    },
    async importFile(file: Pick<File, 'text'> | undefined) {
      if (!store || !file) return;
      let text: string;
      try {
        text = await file.text();
      } catch {
        done('Nothing imported: the file could not be read.');
        return;
      }
      done(importLine(await store.importDoc(text)));
    },
    async clear() {
      if (!store) return;
      try {
        await store.clear();
        done('Cleared: this browser keeps no tuning games now.');
      } catch {
        done('Nothing was cleared: this browser refused the change.');
      }
    },
  };
}
