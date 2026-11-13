// The deck library gallery (#/decks): every deck as a tile in one grid, filterable by source (multi-select chips with
// counts), colour, tier (choom.gg's and our Sim tier), recorded results and text; sortable; optionally grouped by
// source. The view lives in the URL hash query (#/decks?src=meta,ladder&sort=rating, src/lib/galleryView.ts) and is
// remembered in this browser. Select mode deletes decks saved in this browser and hides built-in ones.
import { useEffect, useMemo, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cards';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { deckStats } from '../../lib/deckStats';
import { classify } from '../../ai/archetype';
import { RATINGS } from '../../data/index';
import { deckSource, SOURCES } from '../../lib/deckSource';
import { loadHidden } from '../../lib/hiddenDecks';
import {
  activeFilters,
  applyView,
  CHOOM_TIERS,
  clearFilters,
  COLORS,
  DEFAULT_VIEW,
  parseView,
  queryHasView,
  SORT_LABEL,
  SORTS,
  sourceCounts,
  viewQuery,
  type DeckFacts,
  type GallerySort,
  type GalleryView,
  type SimFilter,
} from '../../lib/galleryView';
import { SIM_TIER_LETTERS, bandWords } from '../../lib/simTier';
import { DeckTile } from './DeckIdentity';
import { profileHref } from './DeckStats';
import { TypeLegend } from './TypeSplit';
import { loadPref, savePref } from '../prefs';
import { PageHead } from './PageHead';
import { CURRENT_SIM_VERSION, ratingsHistorical } from '../../lib/playedRecord';
import { simTierFor } from './TierBadges';
import { isBuiltin } from '../deckLookup';
import { useLibraryVersion } from '../useLibrary';
import { useDeckActions } from './DeckActions';
import { pageOn } from '../../lib/siteConfig';
import { useSiteConfig } from '../useSiteConfig';

/** The remembered view (the same query string the URL carries). */
export const VIEW_PREF = 'nct.gallery.view.v1';
const COLLAPSED_PREF = 'nct.gallery.collapsed';

/** The view to open with: the URL's when it names one, else the one remembered here (or the old sort pref), else the default. */
export function initialView(query: string, defaultSort: GallerySort = DEFAULT_VIEW.sort): GalleryView {
  if (queryHasView(query)) return parseView(query);
  const saved = loadPref(VIEW_PREF, '');
  if (saved) return parseView(saved);
  const oldSort = loadPref('nct.gallery.sort', '');
  // a first visit opens with the site config's sort (decks.defaultSort)
  return { ...DEFAULT_VIEW, sort: oldSort === 'name' || oldSort === 'newest' || oldSort === 'cost' ? oldSort : oldSort === 'rating' ? 'meta' : defaultSort };
}

/** Put the view in the hash query without a hashchange (the page would remount), so it can be linked and survives reload. */
function syncUrl(v: GalleryView) {
  try {
    const qs = viewQuery(v);
    const hash = qs ? `#/decks?${qs}` : '#/decks';
    if (/^#\/decks(\?|$)/.test(window.location.hash) && !/[?&]d=/.test(window.location.hash) && window.location.hash !== hash) history.replaceState(history.state, '', hash);
  } catch {
    /* history unavailable (sandboxed frame): the URL just doesn't follow */
  }
}

/** The facts the filters and sorts read, for every deck. */
export function deckFacts(decks: readonly LibraryDeck[], hidden: ReadonlySet<string>): DeckFacts[] {
  const power = new Map(RATINGS.decks.map((r) => [r.name, r]));
  return decks.map((d) => {
    const st = deckStats(d.file);
    const meta = st.leader?.rating ?? st.review?.winRate ?? null;
    const colors = new Set(d.deck.legends.map((id) => CARD_BY_ID[id]?.color).filter((c): c is NonNullable<typeof c> => !!c));
    const costs = d.deck.main.map((id) => CARD_BY_ID[id]?.cost ?? 0);
    const row = power.get(d.deck.name);
    return {
      file: d.file,
      name: d.deck.name,
      source: deckSource(d),
      colors,
      arch: st.leader?.arch ?? classify(d.deck.main).arch,
      legends: d.deck.legends,
      text: [d.deck.name, d.prov.author ?? '', ...d.deck.legends.map((id) => CARD_BY_ID[id]?.displayName ?? '')].join(' ').toLowerCase(),
      cards: [...new Set(d.deck.main.map((id) => (CARD_BY_ID[id]?.displayName ?? id).toLowerCase()))],
      power: row ? row.wrField : null,
      games: row?.games ?? 0,
      ...(d.tier ? { choom: d.tier } : {}),
      sim: simTierFor(d.deck.name).letter,
      meta: typeof meta === 'number' && Number.isFinite(meta) ? meta : null,
      avgCost: costs.length ? costs.reduce((a, x) => a + x, 0) / costs.length : 0,
      added: d.prov.added ?? (d.tuned?.date ?? '').slice(0, 10),
      hidden: hidden.has(d.file),
    };
  });
}

/** A toggle chip (the gallery's filters; also the tournament runner's entrant picker). */
export function Chip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button type="button" className={`chip-btn ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick} title={title}>
      {children}
    </button>
  );
}

const toggle = <T,>(xs: readonly T[], x: T): T[] => (xs.includes(x) ? xs.filter((y) => y !== x) : [...xs, x]);

export function DeckGallery({ onNew, query = '' }: { onNew: () => void; query?: string }) {
  useLibraryVersion(); // re-render after a save, delete or hide (here or in another tab)
  const site = useSiteConfig();
  const allowed = site.decks.sources.join(',');
  // allDecks() keeps one list while the stored decks are unchanged, and the hidden set is keyed by its text, so the
  // facts below are only rebuilt when the library changes
  const decks = allDecks();
  const hiddenKey = [...loadHidden()].join('|');
  const hidden = useMemo(() => new Set(hiddenKey.split('|').filter(Boolean)), [hiddenKey]);
  // only the deck sources the site config shows (decks.sources)
  const facts = useMemo(() => deckFacts(decks, hidden).filter((f) => allowed.split(',').includes(f.source)), [decks, hidden, allowed]);
  const byFile = useMemo(() => new Map(decks.map((d) => [d.file, d])), [decks]);
  const [view, setViewRaw] = useState<GalleryView>(() => initialView(query, site.decks.defaultSort));
  // every change goes through the updater form, so two quick changes can't overwrite each other
  const update = (fn: (v: GalleryView) => GalleryView) => setViewRaw(fn);
  useEffect(() => {
    syncUrl(view);
    savePref(VIEW_PREF, viewQuery(view));
  }, [view]);
  const set = <K extends keyof GalleryView>(k: K, val: GalleryView[K]) => update((v) => ({ ...v, [k]: val }));
  /** add or remove one value of a multi-select filter */
  const flip = <K extends 'sources' | 'colors' | 'sim' | 'choom'>(k: K, x: GalleryView[K][number]) => update((v) => ({ ...v, [k]: toggle(v[k] as readonly unknown[], x) }));

  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(loadPref(COLLAPSED_PREF, '').split('|').filter(Boolean)));
  const saveCollapsed = (next: Set<string>) => {
    setCollapsed(next);
    savePref(COLLAPSED_PREF, [...next].join('|'));
  };
  const [selecting, setSelecting] = useState(false);
  // phones: the filters past search and sort sit behind a button, so the first decks show on the first screen (UX-12)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const actions = useDeckActions({ onDeleted: (names) => setSelected((s) => new Set([...s].filter((f) => !names.some((n) => f === `custom:${n}`)))) });

  const shown = applyView(facts, view);
  const counts = sourceCounts(facts, view);
  const active = activeFilters(view);
  const hiddenCount = facts.filter((f) => f.hidden).length;
  const total = facts.filter((f) => !f.hidden || view.hidden).length;
  const archs = useMemo(() => [...new Set(facts.map((f) => f.arch))].sort(), [facts]);
  const legends = useMemo(
    () =>
      [...new Set(decks.flatMap((d) => d.deck.legends))]
        .map((id) => CARD_BY_ID[id])
        .filter((c): c is NonNullable<typeof c> => !!c)
        .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [decks],
  );
  // selection: only decks still shown count
  const sel = shown.filter((f) => selected.has(f.file));
  const selDecks = sel.map((f) => byFile.get(f.file)).filter((d): d is LibraryDeck => !!d);
  const selSaved = selDecks.filter((d) => !isBuiltin(d));
  const selBuiltin = selDecks.filter((d) => isBuiltin(d) && !hidden.has(d.file));
  const selHidden = selDecks.filter((d) => hidden.has(d.file));
  const pick = (file: string, on: boolean) => setSelected((s) => (on ? new Set([...s, file]) : new Set([...s].filter((f) => f !== file))));

  const tile = (f: DeckFacts) => {
    const d = byFile.get(f.file);
    if (!d) return null;
    const isOn = selected.has(f.file);
    return (
      <div className={`gal-tile-wrap ${f.hidden ? 'is-hidden' : ''} ${selecting && isOn ? 'is-picked' : ''}`} key={f.file}>
        <DeckTile d={d} href={`#/decks?d=${encodeURIComponent(d.file)}`} />
        <a className="gal-profile" href={profileHref(d.file)} title="Every stat, lineage and the visual decklist">
          📊 Profile
        </a>
        {selecting && (
          <label className="gal-select">
            <input type="checkbox" checked={isOn} onChange={(e) => pick(f.file, e.target.checked)} />
            <span className="sr-only">Select {d.deck.name}</span>
          </label>
        )}
        {f.hidden && (
          <span className="gal-hidden-tag">
            Hidden
            <button type="button" className="ghost small" onClick={() => actions.hide([f.file], false)}>
              Unhide
            </button>
          </span>
        )}
      </div>
    );
  };

  const groups = view.group ? SOURCES.map((s) => ({ s, list: shown.filter((f) => f.source === s.key) })).filter((g) => g.list.length) : [];
  return (
    <div className="grid">
      <PageHead
        kicker="Decks"
        title="Deck library"
        actions={
          <>
            {pageOn(site, 'tuned') && (
              <a className="btn" href="#/tuned">
                🔧 Tuned decks
              </a>
            )}
            {pageOn(site, 'lab') && (
              <a className="btn" href="#/lab">
                🧬 Breed &amp; tune
              </a>
            )}
            <button className="primary" onClick={onNew}>
              + New / import deck
            </button>
          </>
        }
      >
        Every deck in one list: filter it by source, colour or tier, or group it by source. Click a tile to edit or export it; “Profile” opens every stat and its lineage. Tiles lead with
        each deck’s recorded tournament games; the <b>Sim</b> letter is our tier from those results, the <b>choom</b> letter is choom.gg’s editorial tier.
        {ratingsHistorical(RATINGS) && <> Those results were recorded before the current simulator (v{CURRENT_SIM_VERSION}), so they are historical.</>}
      </PageHead>
      <div className={`panel gal-panel ${filtersOpen ? 'is-open' : ''}`}>
        <div className="gal-filters">
          <input aria-label="Search decks" type="search" placeholder="Search deck, Legend, card or author…" value={view.q} onChange={(e) => set('q', e.target.value)} style={{ flex: '1 1 200px', minWidth: 0 }} />
          <select aria-label="Sort decks" value={view.sort} onChange={(e) => set('sort', e.target.value as GallerySort)}>
            {SORTS.map((s) => (
              <option key={s} value={s}>
                Sort: {SORT_LABEL[s]}
              </option>
            ))}
          </select>
          {/* shown on phones only (deckprofile.css): the rest of the filters open under it */}
          <button type="button" className="gal-filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
            {filtersOpen ? '▾' : '▸'} Filters{active - (view.q ? 1 : 0) > 0 ? ` (${active - (view.q ? 1 : 0)} active)` : ''}
          </button>
          <span className="gal-fold gal-fold-chips">
          <Chip on={view.group} onClick={() => update((v) => ({ ...v, group: !v.group }))} title="Show one section per source instead of one list">
            ▤ Group by source
          </Chip>
          <Chip
            on={selecting}
            onClick={() => {
              setSelecting(!selecting);
              setSelected(new Set());
            }}
            title="Pick decks to delete (saved in this browser) or hide (built-in)"
          >
            ☑ Select
          </Chip>
          {hiddenCount > 0 && (
            <Chip on={view.hidden} onClick={() => update((v) => ({ ...v, hidden: !v.hidden }))} title="Built-in decks hidden in this browser (by you, or by the site by default)">
              👁 Show hidden ({hiddenCount})
            </Chip>
          )}
          </span>
        </div>
        <div className="gal-filters gal-fold" role="group" aria-label="Source">
          <span className="small muted">Source</span>
          {SOURCES.filter((s) => site.decks.sources.includes(s.key) && ((counts.get(s.key) ?? 0) > 0 || view.sources.includes(s.key))).map((s) => (
            <Chip key={s.key} on={view.sources.includes(s.key)} onClick={() => flip('sources', s.key)} title={s.help}>
              <span aria-hidden="true">{s.icon}</span> {s.label} <span className="muted">({counts.get(s.key) ?? 0})</span>
            </Chip>
          ))}
          {view.sources.length > 0 && (
            <button type="button" className="ghost small" onClick={() => set('sources', [])}>
              All sources
            </button>
          )}
        </div>
        <details className="gal-more gal-fold" open={active - (view.sources.length ? 1 : 0) - (view.q ? 1 : 0) > 0 || undefined}>
          <summary className="small">More filters{active ? ` (${active} active)` : ''}</summary>
          <div className="gal-filters" role="group" aria-label="Colour">
            <span className="small muted">Colour</span>
            {COLORS.map((c) => (
              <Chip key={c} on={view.colors.includes(c)} onClick={() => flip('colors', c)}>
                <span className={`dot ${c}`} /> {c}
              </Chip>
            ))}
            {view.colors.length > 0 && (
              <select aria-label="How the chosen colours must match the Legends" value={view.colorMode} onChange={(e) => set('colorMode', e.target.value as GalleryView['colorMode'])}>
                <option value="any">uses any of these</option>
                <option value="all">uses all of these</option>
                <option value="only">exactly these colours</option>
              </select>
            )}
            <span className="small muted gal-sep">Colours</span>
            {[0, 1, 2, 3].map((n) => (
              <Chip key={n} on={view.nColors === n} onClick={() => set('nColors', n)}>
                {n ? `${n}` : 'Any'}
              </Chip>
            ))}
          </div>
          <div className="gal-filters" role="group" aria-label="Tier">
            <span className="small muted" title="Our tier from recorded tournament results (power rating)">
              Sim tier
            </span>
            {SIM_TIER_LETTERS.map((t) => (
              <Chip key={t} on={view.sim.includes(t)} onClick={() => flip('sim', t)} title={`Expected ${bandWords(t)} vs the field`}>
                {t}
              </Chip>
            ))}
            <Chip on={view.sim.includes('none')} onClick={() => flip('sim', 'none' as SimFilter)} title="No tier yet: too few or no recorded games">
              unrated
            </Chip>
            <span className="small muted gal-sep" title="choom.gg's editorial tier (meta archetypes only)">
              choom tier
            </span>
            {CHOOM_TIERS.filter((t) => facts.some((f) => f.choom === t)).map((t) => (
              <Chip key={t} on={view.choom.includes(t)} onClick={() => flip('choom', t)}>
                {t}
              </Chip>
            ))}
          </div>
          <div className="gal-filters" role="group" aria-label="Archetype">
            <span className="small muted">Archetype</span>
            <Chip on={!view.arch} onClick={() => set('arch', '')}>
              Any
            </Chip>
            {archs.map((a) => (
              <Chip key={a} on={view.arch === a} onClick={() => update((v) => ({ ...v, arch: v.arch === a ? '' : a }))}>
                {a}
              </Chip>
            ))}
          </div>
          <div className="gal-filters">
            <select aria-label="Legend" value={view.legend} onChange={(e) => set('legend', e.target.value)} style={{ maxWidth: 260, minWidth: 0 }}>
              <option value="">Any Legend</option>
              {legends.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayName}
                </option>
              ))}
            </select>
            <input aria-label="Contains card" placeholder="Contains card…" value={view.card} onChange={(e) => set('card', e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }} />
            <label className="row small muted" title="Expected win rate vs the whole field (tournament power rating)">
              Power ≥ {view.minPower || 'any'}
              {view.minPower ? '%' : ''}
              <input type="range" min={0} max={75} step={5} value={view.minPower} onChange={(e) => set('minPower', +e.target.value)} />
            </label>
            <label className="row small muted">
              <input type="checkbox" checked={view.recorded} onChange={(e) => set('recorded', e.target.checked)} /> has tournament results
            </label>
          </div>
        </details>
        <div className="row small gal-status">
          <span role="status" aria-live="polite">
            {shown.length === total ? `${total} decks` : `${shown.length} of ${total} decks`}
            {hiddenCount > 0 && !view.hidden ? ` (${hiddenCount} hidden)` : ''}
          </span>
          {active > 0 && (
            <button type="button" className="ghost small" onClick={() => update(clearFilters)}>
              Clear filters ({active})
            </button>
          )}
        </div>
        {selecting && (
          <div className="row small gal-selectbar" role="group" aria-label="Selected decks">
            <span>{sel.length} selected</span>
            <button type="button" className="ghost small" onClick={() => setSelected(new Set(shown.map((f) => f.file)))}>
              Select all shown
            </button>
            <button type="button" className="ghost small" onClick={() => setSelected(new Set())} disabled={!sel.length}>
              Clear selection
            </button>
            <button type="button" className="danger-soft" onClick={() => actions.askDelete(selSaved)} disabled={!selSaved.length} title="Decks saved in this browser are deleted">
              🗑 Delete selected ({selSaved.length})
            </button>
            <button type="button" onClick={() => actions.hide(selBuiltin.map((d) => d.file))} disabled={!selBuiltin.length} title="Built-in decks ship with the site: hiding takes them out of the gallery and pickers in this browser only">
              Hide selected ({selBuiltin.length})
            </button>
            {selHidden.length > 0 && (
              <button type="button" onClick={() => actions.hide(selHidden.map((d) => d.file), false)}>
                Unhide selected ({selHidden.length})
              </button>
            )}
            <span className="muted">Built-in decks can only be hidden, not deleted.</span>
          </div>
        )}
      </div>
      {shown.length === 0 && (
        <div className="empty-state">
          <p>No decks match these filters.</p>
          <p>
            <button className="ghost" onClick={() => update(clearFilters)}>
              Clear filters
            </button>
            {hiddenCount > 0 && !view.hidden && (
              <button className="ghost" onClick={() => set('hidden', true)}>
                Show hidden decks ({hiddenCount})
              </button>
            )}
          </p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="row small muted gal-type-legend">
          <span>Bar under each deck: main-deck card types</span>
          <TypeLegend />
        </div>
      )}
      {!view.group && shown.length > 0 && <div className="deck-grid">{shown.map(tile)}</div>}
      {view.group && groups.length > 1 && (
        <div className="row small">
          <button className="ghost small" onClick={() => saveCollapsed(new Set())}>
            Expand all
          </button>
          <button className="ghost small" onClick={() => saveCollapsed(new Set(groups.map((g) => g.s.key)))}>
            Collapse all
          </button>
        </div>
      )}
      {groups.map(({ s, list }) => {
        const best = list.map((f) => f.power).filter((x): x is number => x !== null);
        return (
          <details
            key={s.key}
            className="gal-group"
            open={!collapsed.has(s.key)}
            onToggle={(e) => {
              const open = (e.target as HTMLDetailsElement).open;
              if (open === !collapsed.has(s.key)) return;
              const next = new Set(collapsed);
              if (open) next.delete(s.key);
              else next.add(s.key);
              saveCollapsed(next);
            }}
          >
            <summary className="gal-group-title">
              {s.icon} {s.label} <span className="small muted">({list.length})</span>
              {best.length > 0 && <span className="small muted">best power {Math.round(Math.max(...best) * 100)}%</span>}
              <span className="small muted gal-group-help" style={{ fontFamily: 'var(--font)', fontWeight: 400 }}>
                {s.help}
              </span>
            </summary>
            {/* links stay out of the <summary>, which is itself the toggle control */}
            {s.key === 'bred' && (
              <a className="small" href="#/seasons">
                How breeding works →
              </a>
            )}
            {s.key === 'tuned' && pageOn(site, 'tuned') && (
              <a className="small" href="#/tuned">
                Every tuned deck with its end result →
              </a>
            )}
            <div className="deck-grid">{list.map(tile)}</div>
          </details>
        );
      })}
      {actions.ui}
    </div>
  );
}
