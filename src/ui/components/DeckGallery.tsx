// The deck library gallery (#/decks): every deck as a tile, grouped by origin, with search, filters and sorting.
import { useMemo, useState } from 'react';
import { CARD_BY_ID } from '../../engine/cards';
import type { Color } from '../../engine/types';
import { allDecks } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { deckStats } from '../../lib/deckStats';
import { classify } from '../../ai/archetype';
import ratings from '../../data/ratings.json';
import { DeckTile, originKind } from './DeckIdentity';
import { profileHref } from './DeckStats';
import { TypeLegend } from './TypeSplit';
import { loadPref, savePref } from '../prefs';
import { PageHead } from './PageHead';
import { CURRENT_SIM_VERSION, ratingsHistorical, type RatingsFile } from '../../lib/playedRecord';

const COLORS: Color[] = ['Red', 'Blue', 'Green', 'Yellow'];

interface Group {
  key: string;
  label: string;
  order: number;
}
function groupOf(d: LibraryDeck): Group {
  const k = originKind(d.prov, d.kind);
  switch (k) {
    case 'choom-meta':
      return { key: 'meta', label: '◆ choom.gg meta archetypes', order: 0 };
    case 'sim-ladder':
      return { key: 'ladder', label: '▲ Sim ladder (Master-rank Legend trios)', order: 0.5 };
    case 'choom-guide':
      return { key: 'guide', label: '✎ choom.gg community guides', order: 1 };
    case 'nc-original':
      return { key: 'nc', label: '⚙ Night City Trainer originals', order: 2 };
    case 'nc-bred': {
      const s = d.prov.origin?.match(/season (\d+)/)?.[1] ?? '0';
      return { key: `bred-${s}`, label: `🧬 Bred · Season ${s}`, order: 3 + Number(s) / 100 };
    }
    case 'nc-build':
    case 'nc-variant':
      return { key: 'builds', label: '🏆 Tournament builds & variants', order: 4 };
    case 'mine':
      return { key: 'mine', label: '★ My decks', order: 5 };
    default:
      return d.kind === 'custom' ? { key: 'mine', label: '★ My decks', order: 5 } : { key: 'other', label: '• Other', order: 6 };
  }
}
const GROUP_HELP: Record<string, string> = {
  meta: 'The archetypes choom.gg tracks as the current meta, with their tier.',
  ladder: 'Legend trios seen at Master rank on cyberpunk-tcg-sim.online. Only the Legends are public, so the main decks are theorized by this trainer from our data, then forged.',
  guide: 'Lists from community strategy guides, credited to their authors.',
  nc: 'Hand-built by this trainer around a single plan.',
  builds: 'Ready-to-register lists with a data-chosen sideboard, and optimizer-tuned variants.',
  mine: 'Saved in this browser only.',
};

export function DeckGallery({ onNew }: { onNew: () => void }) {
  const decks = useMemo(() => allDecks(), []);
  const R = ratings as unknown as { decks: { name: string; wrField: number }[] };
  const power = useMemo(() => new Map(R.decks.map((r) => [r.name, r.wrField])), [R]);
  const info = useMemo(
    () =>
      new Map(
        decks.map((d) => {
          const st = deckStats(d.file);
          const score = st.leader?.rating ?? st.review?.winRate ?? null;
          const cols = new Set(d.deck.legends.map((id) => CARD_BY_ID[id]?.color).filter(Boolean));
          const costs = d.deck.main.map((id) => CARD_BY_ID[id]?.cost ?? 0);
          return [
            d.file,
            {
              group: groupOf(d),
              arch: st.leader?.arch ?? classify(d.deck.main).arch,
              score: typeof score === 'number' && Number.isFinite(score) ? score : null,
              power: power.get(d.deck.name) ?? null,
              nColors: cols.size,
              avgCost: costs.length ? costs.reduce((a, x) => a + x, 0) / costs.length : 0,
              cards: new Set(d.deck.main.map((id) => (CARD_BY_ID[id]?.displayName ?? id).toLowerCase())),
            },
          ];
        }),
      ),
    [decks, power],
  );
  const [origin, setOrigin] = useState(() => loadPref('nct.gallery.origin', ''));
  const [colors, setColors] = useState<Color[]>([]);
  const [colorMode, setColorMode] = useState<'any' | 'all' | 'only'>('any');
  const [nColors, setNColors] = useState(0);
  const [arch, setArch] = useState('');
  const [legend, setLegend] = useState('');
  const [card, setCard] = useState('');
  const [minPower, setMinPower] = useState(0);
  const [tier, setTier] = useState('');
  const [ratedOnly, setRatedOnly] = useState(false);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'rating' | 'power' | 'name' | 'newest' | 'cost'>(() => (loadPref('nct.gallery.sort', 'rating') as 'rating'));
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set(loadPref('nct.gallery.collapsed', '').split('|').filter(Boolean)));
  const toggleGroup = (k: string, open: boolean) => {
    const next = new Set(collapsed);
    if (open) next.delete(k);
    else next.add(k);
    setCollapsed(next);
    savePref('nct.gallery.collapsed', [...next].join('|'));
  };
  const groups = [...new Map([...info.values()].map((i) => [i.group.key, i.group])).values()].sort((a, b) => a.order - b.order);
  const archs = [...new Set([...info.values()].map((i) => i.arch))].sort();
  const legends = useMemo(() => [...new Set(decks.flatMap((d) => d.deck.legends))].map((id) => CARD_BY_ID[id]).filter(Boolean).sort((a, b) => a.displayName.localeCompare(b.displayName)), [decks]);
  const activeOrigin = groups.some((g) => g.key === origin) ? origin : '';
  const pick = (k: string) => {
    setOrigin(k);
    savePref('nct.gallery.origin', k);
  };
  const reset = () => {
    pick('');
    setColors([]);
    setColorMode('any');
    setNColors(0);
    setArch('');
    setLegend('');
    setCard('');
    setMinPower(0);
    setTier('');
    setRatedOnly(false);
    setQ('');
  };
  const active = [activeOrigin, colors.length, nColors, arch, legend, card, minPower, tier, ratedOnly, q].filter(Boolean).length;
  const shown = decks.filter((d) => {
    const i = info.get(d.file)!;
    const dc = new Set(d.deck.legends.map((id) => CARD_BY_ID[id]?.color));
    const colorOk =
      !colors.length ||
      (colorMode === 'any' ? colors.some((c) => dc.has(c)) : colorMode === 'all' ? colors.every((c) => dc.has(c)) : colors.every((c) => dc.has(c)) && [...dc].every((c) => colors.includes(c as Color)));
    return (
      (!activeOrigin || i.group.key === activeOrigin) &&
      colorOk &&
      (!nColors || i.nColors === nColors) &&
      (!arch || i.arch === arch) &&
      (!legend || d.deck.legends.includes(legend)) &&
      (!card || [...i.cards].some((n) => n.includes(card.toLowerCase()))) &&
      (!minPower || (i.power ?? 0) * 100 >= minPower) &&
      (!tier || d.tier === tier) &&
      (!ratedOnly || i.power !== null) &&
      (!q || (d.deck.name + ' ' + (d.prov.author ?? '') + ' ' + d.deck.legends.map((id) => CARD_BY_ID[id]?.displayName ?? '').join(' ')).toLowerCase().includes(q.toLowerCase()))
    );
  });
  const cmp = (a: LibraryDeck, b: LibraryDeck) => {
    const A = info.get(a.file)!;
    const B = info.get(b.file)!;
    if (sort === 'name') return a.deck.name.localeCompare(b.deck.name);
    if (sort === 'newest') return (b.prov.added ?? '').localeCompare(a.prov.added ?? '') || a.deck.name.localeCompare(b.deck.name);
    if (sort === 'power') return (B.power ?? -1) - (A.power ?? -1) || a.deck.name.localeCompare(b.deck.name);
    if (sort === 'cost') return A.avgCost - B.avgCost || a.deck.name.localeCompare(b.deck.name);
    return (B.score ?? -1) - (A.score ?? -1) || a.deck.name.localeCompare(b.deck.name);
  };
  const visibleGroups = groups.filter((g) => shown.some((d) => info.get(d.file)!.group.key === g.key));
  const chip = (on: boolean, label: React.ReactNode, onClick: () => void, key?: string) => (
    <button key={key} className={`chip-btn ${on ? 'on' : ''}`} aria-pressed={on} onClick={onClick}>
      {label}
    </button>
  );
  return (
    <div className="grid">
      <PageHead
        kicker="Decks"
        title="Deck library"
        actions={
          <>
            <a className="btn" href="#/lab">
              🧬 Breed &amp; tune
            </a>
            <button className="primary" onClick={onNew}>
              + New / import deck
            </button>
          </>
        }
      >
        {shown.length} of {decks.length} decks. Click a tile to edit or export it; “Profile” opens every stat and its lineage. Tiles lead with each deck’s
        recorded tournament games.
        {ratingsHistorical(ratings as unknown as RatingsFile) && <> Those results were recorded before the current simulator (v{CURRENT_SIM_VERSION}), so they are historical.</>}
      </PageHead>
      <div className="panel">
        <div className="gal-filters">
          <input aria-label="Search decks" placeholder="Search name, author, Legend…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 180px', minWidth: 0 }} />
          <select
            aria-label="Sort decks"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value as typeof sort);
              savePref('nct.gallery.sort', e.target.value);
            }}
          >
            <option value="rating">Sort: rating vs meta</option>
            <option value="power">Sort: power rating (tournaments)</option>
            <option value="name">Sort: name</option>
            <option value="newest">Sort: newest</option>
            <option value="cost">Sort: lowest average cost</option>
          </select>
          {/* outside the <summary> below: a button inside a summary is invalid and fights the toggle */}
          {active > 0 && (
            <button className="ghost small" onClick={reset}>
              Reset filters ({active})
            </button>
          )}
        </div>
        <details className="gal-more" open={active > 0 || undefined}>
          <summary className="small">Filters{active ? ` (${active} active)` : ''}</summary>
          <div className="gal-filters">
            <span className="small muted">Origin</span>
            {chip(!activeOrigin, 'All', () => pick(''))}
            {groups.map((g) => chip(activeOrigin === g.key, g.label, () => pick(g.key), g.key))}
          </div>
          <div className="gal-filters">
            <span className="small muted">Colour</span>
            {COLORS.map((c) =>
              chip(
                colors.includes(c),
                <>
                  <span className={`dot ${c}`} /> {c}
                </>,
                () => setColors(colors.includes(c) ? colors.filter((x) => x !== c) : [...colors, c]),
                c,
              ),
            )}
            {colors.length > 0 && (
              <select aria-label="How the chosen colours must match the Legends" value={colorMode} onChange={(e) => setColorMode(e.target.value as typeof colorMode)} title="How the chosen colours must match the Legends">
                <option value="any">uses any of these</option>
                <option value="all">uses all of these</option>
                <option value="only">exactly these colours</option>
              </select>
            )}
            <span className="small muted" style={{ marginLeft: 8 }}>
              Colours
            </span>
            {[0, 1, 2, 3].map((n) => chip(nColors === n, n ? `${n}` : 'Any', () => setNColors(n), `n${n}`))}
          </div>
          <div className="gal-filters">
            <span className="small muted">Archetype</span>
            {chip(!arch, 'Any', () => setArch(''))}
            {archs.map((a) => chip(arch === a, a, () => setArch(arch === a ? '' : a), a))}
            <span className="small muted" style={{ marginLeft: 8 }}>
              Tier
            </span>
            {['', 'S', 'A', 'B'].map((t) => chip(tier === t, t || 'Any', () => setTier(t), `t${t}`))}
          </div>
          <div className="gal-filters">
            <select aria-label="Legend" value={legend} onChange={(e) => setLegend(e.target.value)} style={{ maxWidth: 260 }}>
              <option value="">Any Legend</option>
              {legends.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.displayName}
                </option>
              ))}
            </select>
            <input aria-label="Contains card" placeholder="Contains card…" value={card} onChange={(e) => setCard(e.target.value)} style={{ flex: '1 1 140px', minWidth: 0 }} />
            <label className="row small muted" title="Expected win rate vs the whole field (tournament power rating)">
              Power ≥ {minPower || 'any'}
              {minPower ? '%' : ''}
              <input type="range" min={0} max={75} step={5} value={minPower} onChange={(e) => setMinPower(+e.target.value)} />
            </label>
            <label className="row small muted">
              <input type="checkbox" checked={ratedOnly} onChange={(e) => setRatedOnly(e.target.checked)} /> rated in tournaments
            </label>
          </div>
        </details>
      </div>
      {shown.length === 0 && (
        <div className="empty-state">
          No decks match these filters.{' '}
          <button className="ghost" onClick={reset}>
            Reset filters
          </button>
        </div>
      )}
      {shown.length > 0 && (
        <div className="row small muted gal-type-legend">
          <span>Bar under each deck: main-deck card types</span>
          <TypeLegend />
        </div>
      )}
      {visibleGroups.length > 1 && (
        <div className="row small">
          <button className="ghost small" onClick={() => (setCollapsed(new Set()), savePref('nct.gallery.collapsed', ''))}>
            Expand all
          </button>
          <button
            className="ghost small"
            onClick={() => {
              const all = new Set(visibleGroups.map((g) => g.key));
              setCollapsed(all);
              savePref('nct.gallery.collapsed', [...all].join('|'));
            }}
          >
            Collapse all
          </button>
        </div>
      )}
      {visibleGroups.map((g) => {
        const list = shown.filter((d) => info.get(d.file)!.group.key === g.key).sort(cmp);
        const best = list.map((d) => info.get(d.file)!.power).filter((x): x is number => x !== null);
        return (
          <details key={g.key} className="gal-group" open={!collapsed.has(g.key)} onToggle={(e) => toggleGroup(g.key, (e.target as HTMLDetailsElement).open)}>
            <summary className="gal-group-title">
              {g.label} <span className="small muted">({list.length})</span>
              {best.length > 0 && <span className="small muted">best power {Math.round(Math.max(...best) * 100)}%</span>}
              {GROUP_HELP[g.key] && (
                <span className="small muted gal-group-help" style={{ fontFamily: 'var(--font)', fontWeight: 400 }}>
                  {GROUP_HELP[g.key]}
                </span>
              )}
            </summary>
            {/* links stay out of the <summary>, which is itself the toggle control */}
            {g.key.startsWith('bred-') && (
              <a className="small" href="#/seasons">
                How breeding works →
              </a>
            )}
            <div className="deck-grid">
              {list.map((d) => (
                <div className="gal-tile-wrap" key={d.file}>
                  <DeckTile d={d} href={`#/decks?d=${encodeURIComponent(d.file)}`} />
                  <a className="gal-profile" href={profileHref(d.file)} title="Every stat, lineage and the visual decklist">
                    📊 Profile
                  </a>
                </div>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

