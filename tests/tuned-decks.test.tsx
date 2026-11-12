// The tuned decks page (#/tuned): the Deck Lab's tuned lists saved in this browser with their end results (verdict in
// the Lab's words, paired gain, adopted changes), sort and filter, Export all / Import, delete, and the repository's
// forge lines. Server-rendered: there is no DOM here.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cardLabel, CARD_BY_ID } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import { addCustomDecks, allDecks, BUILTIN, deleteCustomDecks, forgedBuiltins, loadStored, saveCustom, type StoredDeck } from '../src/lib/browserLibrary';
import { adoptionProvenance, adoptionRule } from '../src/lib/evidence';
import { tunedRecord, type TuneLogLike } from '../src/lib/tuneRecord';
import {
  applyTunedFilter,
  DEFAULT_TUNED_FILTER,
  importReport,
  parseForged,
  planImport,
  tunedEntries,
  tunedExport,
  tunedSummary,
  tunedWithoutRecord,
  verdictLine,
  verdictOf,
} from '../src/lib/tunedDecks';
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

type Gain = { mean: number; lower: number; upper: number; games: number; z: number };
const BETTER: Gain = { mean: 0.058, lower: 0.027, upper: 0.089, games: 224, z: 3.6 };
const UNCLEAR: Gain = { mean: 0.021, lower: -0.004, upper: 0.046, games: 448, z: 1.6 };
const WORSE: Gain = { mean: -0.041, lower: -0.07, upper: -0.012, games: 224, z: -2.7 };
const label = (id: string) => cardLabel(CARD_BY_ID[id]!);

/** A tuned deck as the Lab saves it: one adopted swap on a library deck, then the final list against the original. */
function tuned(file: string, gain: Gain | null, date: string, o: { partial?: boolean; name?: string } = {}): StoredDeck {
  const orig = BUILTIN.find((d) => d.file === file)!.deck;
  const add = BUILTIN.flatMap((d) => d.deck.main).find((id) => !orig.main.includes(id) && CARD_BY_ID[id])!;
  const cut = orig.main[0]!;
  const final = { ...orig, main: [...orig.main.slice(1), add] };
  const swap = `−1 ${label(cut)} → +1 ${label(add)}`;
  const logs: TuneLogLike[] = gain
    ? [{ gen: 1, adopted: swap, adoptedGain: { mean: 0.03, lower: 0.011, upper: 0.05, games: 448, z: 2.5 }, swaps: [{ label: swap, pkg: { kind: 'swap-in' } }], vsOriginal: { same: false, adopted: 1, gain, origWr: 0.47, curWr: 0.47 + gain.mean, measured: true } }]
    : [{ gen: 1, adopted: null, swaps: [], vsOriginal: { same: true, adopted: 0, measured: true } }];
  const rule = adoptionProvenance(adoptionRule(), { firstStage: 112, nominees: 1, cardsPerChange: 1, packagesPerChange: 1 });
  const record = tunedRecord({ original: { ...orig, file }, final: gain ? final : orig, logs, partial: !!o.partial, gens: 3, rule, manifest: null, bot: 'medium', fieldMode: 'deck-lab-tune:meta', fieldDeckIds: ['f1', 'f2'], partnerAware: true, date });
  return { ...(gain ? final : orig), name: o.name ?? `${orig.name} (tuned)`, sideboard: [], tuned: record };
}

const seed = () => {
  const decks = [
    tuned('meta-rrg-dexter-midrange.txt', BETTER, '2026-11-12T03:00:00.000Z'),
    tuned('meta-bbg-cunningham-econ.txt', UNCLEAR, '2026-11-11T20:00:00.000Z', { name: 'BBG (tuned, not shown better)' }),
    tuned('meta-yyb-rogue-gear.txt', WORSE, '2026-11-12T05:00:00.000Z', { partial: true, name: 'YYB (tuned, partial, not shown better)' }),
  ];
  expect(saveCustom(decks)).toBe(true);
  return decks;
};

describe('verdict wording (the Lab’s words)', () => {
  it('better / could not tell / worse with the paired gain, unchanged and not measured in plain words', () => {
    const [b, u, w] = seed().map((d) => d.tuned!);
    expect(verdictLine(b!)).toBe('better: +5.8 pts [+2.7, +8.9], 224 games');
    expect(verdictLine(u!)).toBe('could not tell: +2.1 pts [−0.4, +4.6], 448 games');
    expect(verdictLine(w!)).toBe('worse: −4.1 pts [−7.0, −1.2], 224 games');
    const same = tuned('meta-rrg-dexter-midrange.txt', null, '2026-11-10T00:00:00.000Z').tuned!;
    expect(verdictOf(same)).toBe('unchanged');
    expect(verdictLine(same)).toBe('unchanged: no change was adopted, so the result is the original list');
    expect(verdictLine({ ...same, vsOriginal: null })).toMatch(/^not measured: the run ended before/);
  });
});

describe('list, summary, sort and filter', () => {
  it('lists only decks with a record, newest first, and notes Lab-looking decks without one', () => {
    seed();
    addCustomDecks([{ ...BUILTIN[0]!.deck, name: 'Old (tuned)', sideboard: [] }]);
    const e = tunedEntries(allDecks());
    expect(e.map((x) => x.deck.deck.name)).toEqual(['YYB (tuned, partial, not shown better)', 'RRG Dexter Midrange (tuned)', 'BBG (tuned, not shown better)']);
    expect(tunedWithoutRecord(allDecks()).map((d) => d.deck.name)).toEqual(['Old (tuned)']);
    expect(tunedSummary(e)).toEqual({ total: 3, better: 1, medianGain: 0.058 });
  });
  it('filters by verdict and original, sorts by gain, verdict, original and date', () => {
    seed();
    const e = tunedEntries(allDecks());
    const names = (f: Partial<typeof DEFAULT_TUNED_FILTER>) => applyTunedFilter(e, { ...DEFAULT_TUNED_FILTER, ...f }).map((x) => x.record.original.name);
    expect(names({ verdicts: ['better', 'worse'] })).toEqual(['YYB Rogue Gear', 'RRG Dexter Midrange']);
    expect(names({ original: 'BBG Cunningham Econ' })).toEqual(['BBG Cunningham Econ']);
    expect(names({ sort: 'gain' })).toEqual(['RRG Dexter Midrange', 'BBG Cunningham Econ', 'YYB Rogue Gear']);
    expect(names({ sort: 'verdict' })).toEqual(['RRG Dexter Midrange', 'BBG Cunningham Econ', 'YYB Rogue Gear']);
    expect(names({ sort: 'oldest' })).toEqual(['BBG Cunningham Econ', 'RRG Dexter Midrange', 'YYB Rogue Gear']);
    expect(names({ sort: 'original' })).toEqual(['BBG Cunningham Econ', 'RRG Dexter Midrange', 'YYB Rogue Gear']);
  });
});

describe('Export all / Import', () => {
  it('round-trips into another browser with records intact, skipping lists already there', () => {
    const decks = seed();
    const file = JSON.stringify(tunedExport(tunedEntries(allDecks()), new Date('2026-11-12T09:00:00Z')));
    // another browser: empty, then import
    vi.stubGlobal('localStorage', memoryStorage());
    const plan = planImport(file, loadStored());
    expect(plan.add).toHaveLength(3);
    expect(addCustomDecks(plan.add)).toBe(true);
    const back = tunedEntries(allDecks());
    expect(back.map((x) => x.record)).toEqual([decks[2]!.tuned, decks[0]!.tuned, decks[1]!.tuned]);
    expect(importReport(plan)).toBe('Imported 3 tuned decks.');
    // importing again finds every list already saved
    const again = planImport(file, loadStored());
    expect(again.add).toEqual([]);
    expect(again.duplicates).toHaveLength(3);
    expect(importReport(again)).toBe('Imported 0 tuned decks; skipped 3 already saved here (same list).');
  });
  it('renames on a name clash with a different list, skips entries without a record, rejects other files', () => {
    const [d] = seed();
    const other: StoredDeck = { ...d!, main: d!.main.slice(2) };
    const file = JSON.stringify({ kind: 'nct-tuned-decks', schema: 1, exported: '', decks: [other, { name: 'no record', legends: [], main: [] }, 'junk'] });
    const p = planImport(file, loadStored());
    expect(p.add.map((x) => x.name)).toEqual(['RRG Dexter Midrange (tuned) (2)']);
    expect(listFingerprint(p.add[0]!)).toBe(listFingerprint(other));
    expect(p.invalid).toBe(2);
    expect(importReport(p)).toMatch(/renamed “RRG Dexter Midrange \(tuned\)” to “RRG Dexter Midrange \(tuned\) \(2\)”/);
    expect(planImport('{nope', []).error).toBe('This is not a JSON file.');
    expect(planImport('{"kind":"other"}', []).error).toMatch(/not a tuned decks file/);
    expect(planImport('{"kind":"nct-tuned-decks","schema":2,"decks":[]}', []).error).toMatch(/newer format/);
  });
});

describe('tuned decks page', () => {
  it('shows each deck with its verdict, gain, changes and actions, and the summary strip', () => {
    seed();
    const html = renderToStaticMarkup(<TunedDecksPage />);
    expect(html).toContain('Tuned decks');
    expect(html.indexOf('YYB (tuned, partial')).toBeLessThan(html.indexOf('RRG Dexter Midrange (tuned)'));
    expect(html).toContain('better: +5.8 pts [+2.7, +8.9], 224 games');
    expect(html).toContain('could not tell: +2.1 pts [−0.4, +4.6], 448 games');
    expect(html).toContain('partial: stopped before it finished');
    expect(html).toContain('package · swap-in');
    expect(html).toContain('href="#/deck?d=meta-rrg-dexter-midrange.txt"');
    expect(html).toContain('href="#/lab?d=custom%3ARRG%20Dexter%20Midrange%20(tuned)"');
    expect(html).toContain('Run details');
    expect(html).toContain('partner-aware cuts on');
    expect(html).toContain('🗑 Delete');
    expect(html).toMatch(/Shown better<\/div><div class="rec-tile-val">1</);
  });
  it('a deleted tuned deck leaves the page', () => {
    seed();
    expect(deleteCustomDecks(['RRG Dexter Midrange (tuned)'])).toHaveLength(1);
    expect(renderToStaticMarkup(<TunedDecksPage />)).not.toContain('RRG Dexter Midrange (tuned)');
  });
  it('explains how to get a deck here when there are none', () => {
    const html = renderToStaticMarkup(<TunedDecksPage />);
    expect(html).toContain('No tuned decks in this browser yet');
    expect(html).toContain('Save to My decks');
  });
});

describe('forged in the repository', () => {
  it('reads the forge line with or without held-out figures', () => {
    expect(parseForged('2026-11-12: −1 A → +1 B (held-out +2.4 pts [+1.1, +3.8], 560 games); −1 C → +1 D')).toEqual({
      date: '2026-11-12',
      changes: [{ label: '−1 A → +1 B', heldOut: '+2.4 pts [+1.1, +3.8], 560 games' }, { label: '−1 C → +1 D' }],
    });
    expect(parseForged('no date')).toBeNull();
    const f = forgedBuiltins();
    expect(f.length).toBeGreaterThan(0);
    expect(f.every((x) => BUILTIN.some((d) => d.file === x.file) && parseForged(x.forged))).toBe(true);
  });
});
