// Earlier held-out games in the Deck Lab's pages (components/LabHeldOut.tsx, LabEvidence.tsx, pages/DeckLab.tsx and
// pages/TunedDecks.tsx): the tuner's checkbox and its line, pooled wording in the evidence panel, a change not nominated
// because of its earlier games, the "Evidence kept in this browser" block with Export, Import and Clear (behind the
// shared confirm dialog), and what a saved tuned deck records. Server-rendered to HTML (there is no DOM in these tests);
// the stateless parts are also called directly so their buttons can be pressed.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { CARD_BY_ID, cardLabel } from '../src/engine/cards';
import { BUILTIN, saveCustom } from '../src/lib/browserLibrary';
import { ledgerExport, type LedgerBatch } from '../src/lib/changeLedger';
import { BrowserLedgerStore, memoryLedgerStorage, type LedgerCounts } from '../src/lib/changeLedgerStore';
import { adoptionProvenance, adoptionRule, describeRule, type NomineeRecord } from '../src/lib/evidence';
import { pooledManifestTune, pooledTuneRecord, type NotNominated, type TuneLog } from '../src/lib/deckLab';
import { manifestTune, tunedRecord, type TuneLogLike } from '../src/lib/tuneRecord';
import { ruleLine } from '../src/lib/tunedDecks';
import { SIM_VERSION } from '../src/lib/tournament';
import { HeldOutCheckbox, heldOutActions, HeldOutPanel, type HeldOutPanelProps } from '../src/ui/components/LabHeldOut';
import { NomineeTable, NotNominatedList, notNominatedText } from '../src/ui/components/LabEvidence';
import { DeckLabPage, evidenceNote, GenerationSummary } from '../src/ui/pages/DeckLab';
import { TunedDecksPage } from '../src/ui/pages/TunedDecks';
import { setArtEnabled } from '../src/ui/art';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

/** Every element in a tree returned by calling a stateless component (props.children followed, components not run). */
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  const out: ReactElement<Record<string, unknown>>[] = [];
  const walk = (n: ReactNode) => {
    if (Array.isArray(n)) return n.forEach(walk);
    if (!isValidElement(n)) return;
    const el = n as ReactElement<Record<string, unknown>>;
    out.push(el);
    walk(el.props.children as ReactNode);
  };
  walk(node);
  return out;
}
const text = (el: ReactElement<Record<string, unknown>>): string => {
  const c = el.props.children;
  return (Array.isArray(c) ? c : [c]).map((x) => (typeof x === 'string' ? x : isValidElement(x) ? text(x as ReactElement<Record<string, unknown>>) : '')).join('');
};
const button = (tree: ReactNode, label: RegExp) => {
  const b = elements(tree).find((e) => e.type === 'button' && label.test(text(e)));
  if (!b) throw new Error(`no button ${label}`);
  return b as ReactElement<{ onClick: () => void; disabled?: boolean }>;
};

const POOLED: NomineeRecord = {
  label: '-1 A → +1 B',
  screen: { games: 56, mean: 0.12, lower: 0.02, upper: 0.22 },
  heldOut: { games: 224, mean: 0.15, lower: 0.06, upper: 0.24, z: 3.77, looks: 1, baseWr: 0.5, candWr: 0.65, priorGames: 112 },
  outcome: 'adopt',
};
const REJECTED: NotNominated = { label: '-1 C → +1 D', screen: { games: 56, mean: 0.05, lower: -0.03, upper: 0.13 }, heldOut: { games: 400, mean: -0.5, lower: -0.62, upper: -0.38, z: 3.32 }, priorGames: 400 };
const COUNTS: LedgerCounts = { heldout: 1792, screen: 3360, changes: 3, older: { batches: 0, games: 0 }, unreadable: 0 };

describe('the tuner’s checkbox', () => {
  it('is on by default on the Tune tab, with the line under it', () => {
    const lib = BUILTIN.find((d) => d.kind === 'meta')!;
    const html = renderToStaticMarkup(<DeckLabPage q={new URLSearchParams(`d=${lib.file}`)} />);
    expect(html).toMatch(/<input type="checkbox" aria-describedby="lab-heldout-line" checked=""\/><span><b>Use earlier held-out games<\/b> \(on by default\)/);
    expect(html).toContain('id="lab-heldout-line"');
    expect(html).toContain('Checking what this browser holds for this list…');
    expect(html).toContain('<summary>Evidence kept in this browser</summary>');
  });

  it('says what this browser holds for the list, or that it cannot keep games', () => {
    const props = { checked: true, onChange: () => undefined, state: 'ready' as const };
    expect(renderToStaticMarkup(<HeldOutCheckbox {...props} holding={{ heldout: 1792, changes: 3, usable: 1792, older: 0 }} />)).toContain('This browser holds 1,792 held-out games on 3 changes of this list.');
    expect(renderToStaticMarkup(<HeldOutCheckbox {...props} holding={{ heldout: 0, changes: 0, usable: 0, older: 0 }} />)).toContain('This browser holds no held-out games of this list yet.');
    expect(renderToStaticMarkup(<HeldOutCheckbox {...props} holding={null} noList />)).toContain('Pick or paste a list to see what this browser holds for it.');
    const off = renderToStaticMarkup(<HeldOutCheckbox {...props} state="unavailable" holding={null} />);
    expect(off).toMatch(/<input type="checkbox" disabled="" aria-describedby="lab-heldout-line"\/>|<input type="checkbox" aria-describedby="lab-heldout-line" disabled=""\/>/);
    expect(off).toContain('does not let the Lab keep games');
    expect(renderToStaticMarkup(<HeldOutPanel {...panelProps({ state: 'unavailable' })} />)).toBe('');
  });
});

describe('pooled results in the evidence panel', () => {
  it('a pooled nominee says how many games came from earlier runs', () => {
    const html = renderToStaticMarkup(<NomineeTable nominees={[POOLED]} minGames={200} />);
    // the figure in its usual place, and the note under it in an element that wraps (one unbreakable span holding both
    // made the table wider than the page)
    expect(html).toContain('112 from earlier runs; always-valid z 3.77, 1 new stage');
    expect(html).toMatch(/<div class="small muted"[^>]*>112 from earlier runs; always-valid z 3\.77, 1 new stage<\/div>/);
    expect(html).not.toMatch(/class="num"[^>]*>[^<]*from earlier runs/);
    expect(html).toContain('224 games');
    expect(html).toContain('class="verdict pos">adopted');
    // an unpooled nominee is shown as before
    const { priorGames: _, ...plain } = POOLED.heldOut!;
    expect(renderToStaticMarkup(<NomineeTable nominees={[{ ...POOLED, heldOut: plain }]} minGames={200} />)).not.toContain('from earlier runs');
  });

  it('a change its earlier games reject gets its own line', () => {
    expect(notNominatedText(REJECTED)).toBe('Not nominated: -1 C → +1 D (screening +5.0 pts [−3.0, +13.0], 56 games): its earlier held-out games already reject it, −50.0 pts [−62.0, −38.0], 400 games (400 from earlier runs; always-valid z 3.32, decided by the earlier games alone).');
    const html = renderToStaticMarkup(<NotNominatedList items={[REJECTED]} />);
    expect(html).toContain('aria-label="Not nominated because of earlier held-out games"');
    expect(html).toContain('its earlier held-out games already reject it');
    expect(renderToStaticMarkup(<NotNominatedList items={undefined} />)).toBe('');
  });

  it('the generation line, the saved note and the rule line say pooling is on', () => {
    const log: TuneLog = { gen: 1, baseline: 0.5, swaps: [], nominees: [POOLED], adopted: POOLED.label, adoptedGain: { mean: 0.15, lower: 0.06, upper: 0.24, games: 224, z: 3.77 }, adoptedPriorGames: 112 };
    expect(renderToStaticMarkup(<GenerationSummary log={log} />)).toMatch(/held-out .*\+15\.0 pts.*, 112 of them from earlier runs\)/);
    expect(evidenceNote([log])).toBe('Deck Lab adopted: -1 A → +1 B (held-out +15.0 pts [+6.0, +24.0], 224 games, 112 of them from earlier runs).');
    expect(describeRule(adoptionRule(), { firstStage: 112, ledger: true })).toMatch(/held-out games from earlier runs .* always-valid boundary/);
  });
});

function panelProps(o: Partial<HeldOutPanelProps> = {}): HeldOutPanelProps & { calls: string[] } {
  const calls: string[] = [];
  return {
    state: 'ready',
    counts: COUNTS,
    message: '',
    asking: false,
    fileRef: { current: null },
    onExport: () => calls.push('export'),
    onImportFile: (f) => calls.push(`import ${f ? 'file' : 'none'}`),
    onAskClear: () => calls.push('ask'),
    onCancelClear: () => calls.push('cancel'),
    onConfirmClear: () => calls.push('clear'),
    calls,
    ...o,
  };
}

describe('Evidence kept in this browser', () => {
  it('shows the totals and wires Export, Import and Clear; Clear asks first in the shared dialog', () => {
    const p = panelProps();
    const html = renderToStaticMarkup(<HeldOutPanel {...p} />);
    expect(html).toContain('1,792 held-out and 3,360 screening games on 3 changes.');
    expect(html).toContain('aria-label="Import a file of kept games"');
    const tree = HeldOutPanel(p);
    button(tree, /Export/).props.onClick();
    button(tree, /Clear/).props.onClick();
    expect(p.calls).toEqual(['export', 'ask']);
    const input = elements(tree).find((e) => e.type === 'input')! as ReactElement<{ onChange: (e: unknown) => void }>;
    const target = { files: [{}], value: 'x' };
    input.props.onChange({ target });
    expect(p.calls.at(-1)).toBe('import file');
    expect(target.value).toBe('');
    // the confirmation: the shared Modal, the safe choice first in focus
    const asking = panelProps({ asking: true });
    const dialog = renderToStaticMarkup(<HeldOutPanel {...asking} />);
    expect(dialog).toContain('role="dialog"');
    expect(dialog).toContain('Clear the evidence kept in this browser?');
    expect(dialog).toContain('All 5,152 games kept here for the Deck Lab are removed');
    expect(dialog).toMatch(/<button data-autofocus="true">Cancel<\/button>/);
    const t2 = HeldOutPanel(asking);
    const modal = elements(t2).find((e) => typeof e.type === 'function' && (e.type as { name?: string }).name === 'Modal')!;
    button(modal.props.children as ReactNode, /^Clear$/).props.onClick();
    button(modal.props.children as ReactNode, /^Cancel$/).props.onClick();
    expect(asking.calls).toEqual(['clear', 'cancel']);
    // nothing to export or clear; Import and Clear wait while a run is going
    const empty = HeldOutPanel(panelProps({ counts: { ...COUNTS, heldout: 0, screen: 0 } }));
    expect(button(empty, /Export/).props.disabled).toBe(true);
    expect(button(HeldOutPanel(panelProps({ disabled: true })), /Import/).props.disabled).toBe(true);
    expect(renderToStaticMarkup(<HeldOutPanel {...panelProps({ counts: { ...COUNTS, heldout: 0, screen: 0 } })} />)).toContain('Nothing kept yet');
  });

  it('the actions export a file the store imports again, import a file and clear, each in words', async () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const words: string[] = [];
    const saved: { name: string; text: string }[] = [];
    const act = heldOutActions(store, (m) => words.push(m), (name, t) => saved.push({ name, text: t }));
    const b: LedgerBatch = {
      entry: { change: '0123456789abcdef -main:a +main:b', simVersion: SIM_VERSION, bot: 'medium', field: 'fedcba9876543210' },
      kind: 'heldout',
      label: 'swap',
      run: 'forge',
      date: '2026-11-14',
      games: Array.from({ length: 5 }, (_, i) => ({ seed: 10 + i, opp: '1111111111111111', first: 0 as const, base: 0, cand: 1 })),
    };
    await act.importFile({ text: async () => JSON.stringify(ledgerExport([b])) });
    expect(words.at(-1)).toBe('Imported 5 games new to this browser; 0 games were already held.');
    await act.importFile({ text: async () => '{"kind":"nct-tuned-decks","schema":1}' });
    expect(words.at(-1)).toBe('Nothing imported: This is not a change ledger file.');
    await act.importFile({ text: () => Promise.reject(new Error('unreadable')) });
    expect(words.at(-1)).toBe('Nothing imported: the file could not be read.');
    await act.exportAll(new Date('2026-11-14T08:00:00Z'));
    expect(saved[0]!.name).toBe('deck-lab-held-out-games-2026-11-14.json');
    expect(JSON.parse(saved[0]!.text)).toMatchObject({ kind: 'nct-change-ledger', schema: 1 });
    expect(words.at(-1)).toBe('Exported 5 games in 1 batch.');
    const other = new BrowserLedgerStore(memoryLedgerStorage());
    expect(await other.importDoc(saved[0]!.text)).toMatchObject({ added: 5 });
    await act.clear();
    expect(words.at(-1)).toBe('Cleared: this browser keeps no tuning games now.');
    expect((await store.counts(SIM_VERSION)).heldout).toBe(0);
  });
});

describe('a saved tuned deck records pooling', () => {
  const orig = BUILTIN.find((d) => d.file === 'meta-rrg-dexter-midrange.txt')!.deck;
  const add = BUILTIN.flatMap((d) => d.deck.main).find((id) => !orig.main.includes(id) && CARD_BY_ID[id])!;
  const final = { ...orig, main: [...orig.main.slice(1), add] };
  const swap = `−1 ${cardLabel(CARD_BY_ID[orig.main[0]!]!)} → +1 ${cardLabel(CARD_BY_ID[add]!)}`;
  const logs: TuneLogLike[] = [{ gen: 1, adopted: swap, adoptedGain: { mean: 0.03, lower: 0.012, upper: 0.048, games: 2016, z: 3.05 }, adoptedPriorGames: 1120, swaps: [{ label: swap }], vsOriginal: { same: false, adopted: 1, gain: { mean: 0.03, lower: 0.012, upper: 0.048, games: 224, z: 1.96 }, origWr: 0.5, curWr: 0.53, measured: true } }];
  const ARGS = (ledger: boolean) => ({ original: { ...orig, file: 'meta-rrg-dexter-midrange.txt' }, final, logs, partial: false, gens: 1, rule: adoptionProvenance(adoptionRule(), { firstStage: 112, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 }, ledger), manifest: null, bot: 'medium', fieldMode: 'deck-lab-tune:meta', fieldDeckIds: ['f1'], partnerAware: true, date: '2026-11-14T10:00:00.000Z' });
  const make = (ledger: boolean) => pooledTuneRecord(ARGS(ledger));

  it('the record, the manifest and the Tuned decks page', () => {
    const r = make(true);
    expect(r.rule.ledger).toEqual({ boundary: 'normal-mixture', rho: 250 });
    expect(r.changes[0]!.heldOut).toMatchObject({ games: 2016, priorGames: 1120 });
    expect(pooledManifestTune(r).pooled).toEqual([{ gen: 1, label: swap, priorGames: 1120 }]);
    // tuneRecord.ts itself (in the entry chunk's reach) is unchanged: the pooled parts come only from the Lab's helpers
    expect(tunedRecord({ ...ARGS(true) }).changes[0]!.heldOut).not.toHaveProperty('priorGames');
    expect(manifestTune(r)).not.toHaveProperty('pooled');
    expect(ruleLine(r)).toMatch(/earlier held-out games kept in this browser were pooled/);
    // without the ledger nothing new is written
    const plain = make(false);
    expect(pooledManifestTune(plain)).not.toHaveProperty('pooled');
    const unpooled = { ...ARGS(false), logs: logs.map(({ adoptedPriorGames: _, ...l }) => l) };
    expect(pooledTuneRecord(unpooled)).toEqual(tunedRecord(unpooled));
    expect(ruleLine(plain)).not.toMatch(/pooled/);
    expect(saveCustom([{ ...final, name: 'RRG (tuned)', sideboard: [], tuned: r }])).toBe(true);
    const html = renderToStaticMarkup(createElement(TunedDecksPage));
    expect(html).toMatch(/held-out .*\+3\.0 pts.*2016 games.*\(1,120 of them from earlier runs\)/);
  });
});
