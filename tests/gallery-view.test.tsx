// The deck gallery is one list, filterable by source (src/lib/deckSource.ts) and the other filters, sortable, optionally
// grouped by source, with the view in the URL hash query and remembered per browser (src/lib/galleryView.ts).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BUILTIN, upsertCustom, allDecks } from '../src/lib/browserLibrary';
import { deckSource, SOURCES } from '../src/lib/deckSource';
import { activeFilters, applyView, clearFilters, compareFacts, DEFAULT_VIEW, matchesView, parseView, queryHasView, sourceCounts, viewQuery, type DeckFacts } from '../src/lib/galleryView';
import { DeckGallery, deckFacts, initialView, VIEW_PREF } from '../src/ui/components/DeckGallery';
import { setArtEnabled } from '../src/ui/art';
import { HIDDEN_KEY } from '../src/lib/hiddenDecks';

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());

const facts = (o: Partial<DeckFacts>): DeckFacts => ({
  file: o.name ?? 'x',
  name: 'x',
  source: 'meta',
  colors: new Set(['Red']),
  arch: 'aggro',
  legends: [],
  text: (o.name ?? 'x').toLowerCase(),
  cards: [],
  power: null,
  games: 0,
  sim: null,
  meta: null,
  avgCost: 3,
  added: '',
  hidden: false,
  ...o,
});

describe('deck sources', () => {
  it('every built-in deck has one of the shipped sources, split the way the gallery shows them', () => {
    const by = (k: string) => BUILTIN.filter((d) => deckSource(d) === k).map((d) => d.file);
    expect(by('meta').every((f) => f.startsWith('meta-'))).toBe(true);
    expect(by('ladder').every((f) => f.startsWith('ladder-'))).toBe(true);
    expect(by('bred').length).toBeGreaterThan(0);
    expect(by('bred').every((f) => /^s\d+-/.test(f))).toBe(true);
    expect(by('nc').every((f) => f.startsWith('nc-'))).toBe(true);
    expect(BUILTIN.every((d) => !SOURCES.find((s) => s.key === deckSource(d))!.browser)).toBe(true);
  });
  it('decks saved in this browser are mine, tuned (record or name) or Lab-bred', () => {
    const base = { kind: 'custom' as const, prov: {}, deck: { name: 'Mine', legends: [], main: [], sideboard: [] } };
    expect(deckSource(base)).toBe('mine');
    expect(deckSource({ ...base, deck: { ...base.deck, name: 'X (tuned, partial)' } })).toBe('tuned');
    expect(deckSource({ ...base, deck: { ...base.deck, name: 'Lab-123-04 Mutant (RRY)' } })).toBe('lab');
  });
});

describe('gallery view in the URL', () => {
  it('round-trips through the query, with only the non-default values', () => {
    const v = { ...DEFAULT_VIEW, sources: ['meta', 'ladder'] as const, sim: ['S', 'none'] as const, sort: 'games' as const, group: true, q: 'dexter' };
    const qs = viewQuery({ ...v, sources: [...v.sources], sim: [...v.sim] });
    expect(qs).toBe('src=meta,ladder&sim=S,none&q=dexter&sort=games&group=1');
    expect(parseView(qs)).toEqual({ ...v, sources: ['meta', 'ladder'], sim: ['S', 'none'] });
    expect(viewQuery(DEFAULT_VIEW)).toBe('');
    expect(queryHasView('src=meta')).toBe(true);
    expect(queryHasView('d=meta-x.txt')).toBe(false);
  });
  it('drops unknown values instead of failing', () => {
    expect(parseView('src=meta,bogus&sort=nope&col=Pink,Red&ncol=9&sim=Z,A&choom=S,Q')).toEqual({ ...DEFAULT_VIEW, sources: ['meta'], colors: ['Red'], sim: ['A'], choom: ['S'] });
  });
  it('opens with the URL view, else the remembered one, else the old sort pref, else the default', () => {
    expect(initialView('')).toEqual(DEFAULT_VIEW);
    localStorage.setItem('nct.gallery.sort', 'name');
    expect(initialView('').sort).toBe('name');
    localStorage.setItem(VIEW_PREF, 'src=guide');
    expect(initialView('').sources).toEqual(['guide']);
    expect(initialView('src=ladder&sort=newest')).toMatchObject({ sources: ['ladder'], sort: 'newest' });
  });
  it('counts filters, and clearing keeps sort, grouping and show-hidden', () => {
    const v = { ...DEFAULT_VIEW, sources: ['meta' as const], q: 'x', recorded: true, sort: 'name' as const, group: true, hidden: true };
    expect(activeFilters(v)).toBe(3);
    expect(clearFilters(v)).toEqual({ ...DEFAULT_VIEW, sort: 'name', group: true, hidden: true });
  });
});

describe('gallery filters and sorts', () => {
  const list = [
    facts({ name: 'Alpha', source: 'meta', colors: new Set(['Red', 'Blue']), power: 0.7, games: 60, sim: 'S', choom: 'A', cards: ['psycho squad'] }),
    facts({ name: 'Bravo', source: 'ladder', colors: new Set(['Red']), power: 0.5, games: 40, sim: 'B' }),
    facts({ name: 'Charlie', source: 'mine', colors: new Set(['Green']), meta: 0.9 }),
    facts({ name: 'Delta', source: 'meta', colors: new Set(['Red']), power: 0.3, games: 50, sim: 'D', hidden: true }),
  ];
  const names = (v: Partial<typeof DEFAULT_VIEW>) => applyView(list, { ...DEFAULT_VIEW, ...v }).map((f) => f.name);
  it('sources are multi-select; hidden decks only with show-hidden', () => {
    expect(names({})).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(names({ sources: ['meta', 'mine'] })).toEqual(['Alpha', 'Charlie']);
    expect(names({ sources: ['meta'], hidden: true })).toEqual(['Alpha', 'Delta']);
  });
  it('colours (any / all / only), tiers, recorded results and text', () => {
    expect(names({ colors: ['Red'] })).toEqual(['Alpha', 'Bravo']);
    expect(names({ colors: ['Red', 'Blue'], colorMode: 'all' })).toEqual(['Alpha']);
    expect(names({ colors: ['Red'], colorMode: 'only' })).toEqual(['Bravo']);
    expect(names({ sim: ['S', 'none'] })).toEqual(['Alpha', 'Charlie']);
    expect(names({ choom: ['A'] })).toEqual(['Alpha']);
    expect(names({ recorded: true })).toEqual(['Alpha', 'Bravo']);
    expect(names({ q: 'psycho alpha' })).toEqual(['Alpha']);
  });
  it('sorts by our rating (unrated after, by season rating), name, games and choom tier', () => {
    expect(names({ sort: 'rating' })).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(names({ sort: 'name' })).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(names({ sort: 'games' })).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect([...list].sort(compareFacts('choom'))[0]!.name).toBe('Alpha');
  });
  it('source chip counts follow the other filters, not the source filter', () => {
    const c = sourceCounts(list, { ...DEFAULT_VIEW, sources: ['ladder'], colors: ['Red'] });
    expect(Object.fromEntries(c)).toEqual({ meta: 1, ladder: 1 });
    expect(matchesView(list[0]!, { ...DEFAULT_VIEW, sources: ['ladder'] }, { ignoreSources: true })).toBe(true);
  });
});

describe('gallery page', () => {
  it('is one grid by default, with a polite result count', () => {
    const html = renderToStaticMarkup(<DeckGallery onNew={() => undefined} />);
    expect(html).not.toContain('gal-group');
    expect((html.match(/class="deck-tile /g) ?? []).length).toBe(BUILTIN.length);
    expect(html).toMatch(/role="status" aria-live="polite">39 decks/);
    expect(html).toMatch(/aria-pressed="false"[^>]*>.*choom.gg meta/);
  });
  it('a linked view filters and groups by source', () => {
    const html = renderToStaticMarkup(<DeckGallery onNew={() => undefined} query="src=meta,ladder&group=1" />);
    const meta = BUILTIN.filter((d) => d.kind === 'meta').length;
    const ladder = BUILTIN.filter((d) => d.kind === 'ladder').length;
    expect((html.match(/class="deck-tile /g) ?? []).length).toBe(meta + ladder);
    expect((html.match(/class="gal-group"/g) ?? []).length).toBe(2);
    expect(html).toContain(`${meta + ladder} of ${BUILTIN.length} decks`);
  });
  it('hidden decks leave the list and are counted; saved decks join it', () => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([BUILTIN[0]!.file]));
    upsertCustom({ name: 'My test deck', legends: BUILTIN[0]!.deck.legends, main: BUILTIN[0]!.deck.main, sideboard: [] });
    const html = renderToStaticMarkup(<DeckGallery onNew={() => undefined} />);
    expect(html).toContain(`${BUILTIN.length} decks (1 hidden)`);
    expect(html).toContain('Show hidden (1)');
    expect(html).toContain('My test deck');
    const f = deckFacts(allDecks(), new Set([BUILTIN[0]!.file]));
    expect(f.find((x) => x.name === 'My test deck')).toMatchObject({ source: 'mine', power: null, sim: null });
  });
  it('an empty result says so, with a way out', () => {
    const html = renderToStaticMarkup(<DeckGallery onNew={() => undefined} query="q=zzzz-no-such-deck" />);
    expect(html).toContain('No decks match these filters.');
    expect(html).toContain('Clear filters');
  });
});
