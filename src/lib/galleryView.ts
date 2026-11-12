// The deck gallery's view: filters, sort and grouping, as plain data. It round-trips through the URL hash query
// (#/decks?src=meta,ladder&sort=rating) so a filtered view can be linked, and the same string is remembered per
// browser. Filtering and sorting work on precomputed facts per deck (built by src/ui/components/DeckGallery.tsx), so
// the rules here are pure and tested without the card pool.
import { isSourceKey, type SourceKey } from './deckSource';
import { SIM_TIER_LETTERS, type SimTierLetter } from './simTier';

export const COLORS = ['Red', 'Blue', 'Green', 'Yellow'] as const;
export type Color = (typeof COLORS)[number];
export const SORTS = ['rating', 'name', 'newest', 'games', 'choom', 'meta', 'cost'] as const;
export type GallerySort = (typeof SORTS)[number];
export const SORT_LABEL: Record<GallerySort, string> = {
  rating: 'our rating (tournaments)',
  name: 'name',
  newest: 'newest',
  games: 'games played',
  choom: 'choom.gg tier',
  meta: 'season rating vs meta',
  cost: 'lowest average cost',
};
export const CHOOM_TIERS = ['S', 'A', 'B', 'C'] as const;
/** a Sim tier filter value: a letter, or 'none' for unrated */
export type SimFilter = SimTierLetter | 'none';

export interface GalleryView {
  sources: SourceKey[];
  colors: Color[];
  colorMode: 'any' | 'all' | 'only';
  /** number of distinct Legend colours (0 = any) */
  nColors: number;
  arch: string;
  legend: string;
  card: string;
  /** minimum expected win rate vs the field, points (0 = any) */
  minPower: number;
  choom: string[];
  sim: SimFilter[];
  /** only decks with recorded tournament results */
  recorded: boolean;
  q: string;
  sort: GallerySort;
  /** the sectioned view, one section per source */
  group: boolean;
  /** include decks hidden in this browser */
  hidden: boolean;
}

export const DEFAULT_VIEW: GalleryView = {
  sources: [],
  colors: [],
  colorMode: 'any',
  nColors: 0,
  arch: '',
  legend: '',
  card: '',
  minPower: 0,
  choom: [],
  sim: [],
  recorded: false,
  q: '',
  sort: 'rating',
  group: false,
  hidden: false,
};

/** The query keys this view owns (anything else in the hash query, such as ?d=, is left alone). */
export const VIEW_KEYS = ['src', 'col', 'cmode', 'ncol', 'arch', 'legend', 'card', 'minp', 'choom', 'sim', 'rec', 'q', 'sort', 'group', 'hidden'] as const;

const list = (s: string | null) => (s ? s.split(',').map((x) => x.trim()).filter(Boolean) : []);
const uniq = <T,>(xs: T[]) => [...new Set(xs)];

/** A view from a query string; unknown or malformed values fall back to the default. */
export function parseView(qs: string | URLSearchParams): GalleryView {
  const p = typeof qs === 'string' ? new URLSearchParams(qs.replace(/^\?/, '')) : qs;
  const num = (k: string, lo: number, hi: number) => {
    const v = Number(p.get(k));
    return Number.isInteger(v) && v >= lo && v <= hi ? v : 0;
  };
  const sort = p.get('sort');
  const cmode = p.get('cmode');
  return {
    sources: uniq(list(p.get('src')).filter(isSourceKey)),
    colors: uniq(list(p.get('col')).filter((c): c is Color => (COLORS as readonly string[]).includes(c))),
    colorMode: cmode === 'all' || cmode === 'only' ? cmode : 'any',
    nColors: num('ncol', 0, 3),
    arch: p.get('arch') ?? '',
    legend: p.get('legend') ?? '',
    card: p.get('card') ?? '',
    minPower: num('minp', 0, 100),
    choom: uniq(list(p.get('choom')).filter((t) => (CHOOM_TIERS as readonly string[]).includes(t))),
    sim: uniq(list(p.get('sim')).filter((t): t is SimFilter => t === 'none' || (SIM_TIER_LETTERS as readonly string[]).includes(t))),
    recorded: p.get('rec') === '1',
    q: p.get('q') ?? '',
    sort: (SORTS as readonly string[]).includes(sort ?? '') ? (sort as GallerySort) : 'rating',
    group: p.get('group') === '1',
    hidden: p.get('hidden') === '1',
  };
}

/** The view as a query string with only what differs from the default ('' for the default view). */
export function viewQuery(v: GalleryView): string {
  const p = new URLSearchParams();
  if (v.sources.length) p.set('src', v.sources.join(','));
  if (v.colors.length) p.set('col', v.colors.join(','));
  if (v.colors.length && v.colorMode !== 'any') p.set('cmode', v.colorMode);
  if (v.nColors) p.set('ncol', String(v.nColors));
  if (v.arch) p.set('arch', v.arch);
  if (v.legend) p.set('legend', v.legend);
  if (v.card) p.set('card', v.card);
  if (v.minPower) p.set('minp', String(v.minPower));
  if (v.choom.length) p.set('choom', v.choom.join(','));
  if (v.sim.length) p.set('sim', v.sim.join(','));
  if (v.recorded) p.set('rec', '1');
  if (v.q) p.set('q', v.q);
  if (v.sort !== 'rating') p.set('sort', v.sort);
  if (v.group) p.set('group', '1');
  if (v.hidden) p.set('hidden', '1');
  // commas read better in a shared link than %2C
  return p.toString().replace(/%2C/gi, ',');
}

/** True when the query names any of the view's keys (then the URL wins over the remembered view). */
export const queryHasView = (qs: string | URLSearchParams): boolean => {
  const p = typeof qs === 'string' ? new URLSearchParams(qs.replace(/^\?/, '')) : qs;
  return VIEW_KEYS.some((k) => p.has(k));
};

/** How many filters are set (sort, grouping and "show hidden" are not filters). */
export function activeFilters(v: GalleryView): number {
  return [v.sources.length, v.colors.length, v.nColors, v.arch, v.legend, v.card, v.minPower, v.choom.length, v.sim.length, v.recorded, v.q].filter(Boolean).length;
}

/** The view with every filter cleared, keeping sort, grouping and "show hidden". */
export const clearFilters = (v: GalleryView): GalleryView => ({ ...DEFAULT_VIEW, sort: v.sort, group: v.group, hidden: v.hidden });

/** What the gallery knows about one deck, computed once per list. */
export interface DeckFacts {
  file: string;
  name: string;
  source: SourceKey;
  /** the Legends' colours */
  colors: ReadonlySet<string>;
  arch: string;
  legends: readonly string[];
  /** lower-case text the search box matches: name, author, Legend names */
  text: string;
  /** lower-case main-deck card names */
  cards: readonly string[];
  /** expected win rate vs the field (tournament power rating), or null */
  power: number | null;
  /** tournament games behind it */
  games: number;
  /** choom.gg editorial tier, if any */
  choom?: string;
  /** Sim tier letter, null when unrated */
  sim: SimTierLetter | null;
  /** season leaderboard rating vs the meta, or the round-robin win rate */
  meta: number | null;
  avgCost: number;
  /** YYYY-MM-DD the deck was added, or '' */
  added: string;
  hidden: boolean;
}

/** Whether a deck passes the view's filters (not the source filter when `ignoreSources`, used for the chip counts). */
export function matchesView(f: DeckFacts, v: GalleryView, o: { ignoreSources?: boolean } = {}): boolean {
  if (f.hidden && !v.hidden) return false;
  if (!o.ignoreSources && v.sources.length && !v.sources.includes(f.source)) return false;
  if (v.colors.length) {
    const ok =
      v.colorMode === 'any' ? v.colors.some((c) => f.colors.has(c)) : v.colorMode === 'all' ? v.colors.every((c) => f.colors.has(c)) : v.colors.every((c) => f.colors.has(c)) && [...f.colors].every((c) => (v.colors as string[]).includes(c));
    if (!ok) return false;
  }
  if (v.nColors && f.colors.size !== v.nColors) return false;
  if (v.arch && f.arch !== v.arch) return false;
  if (v.legend && !f.legends.includes(v.legend)) return false;
  if (v.card && !f.cards.some((n) => n.includes(v.card.toLowerCase()))) return false;
  if (v.minPower && (f.power ?? 0) * 100 < v.minPower) return false;
  if (v.choom.length && !(f.choom && v.choom.includes(f.choom))) return false;
  if (v.sim.length && !v.sim.includes(f.sim ?? 'none')) return false;
  if (v.recorded && f.power === null) return false;
  if (v.q) {
    const words = v.q.toLowerCase().split(/\s+/).filter(Boolean);
    const hay = `${f.text} ${f.cards.join(' ')}`;
    if (!words.every((w) => hay.includes(w))) return false;
  }
  return true;
}

const CHOOM_RANK = (t?: string) => (t ? 'SABCD'.indexOf(t) : 9);
const SIM_RANK = (t: SimTierLetter | null) => (t ? SIM_TIER_LETTERS.indexOf(t) : SIM_TIER_LETTERS.length);

/** The comparator for a sort; ties go by name. "Our rating" falls back to the season rating for decks never rated in a tournament. */
export function compareFacts(sort: GallerySort): (a: DeckFacts, b: DeckFacts) => number {
  const byName = (a: DeckFacts, b: DeckFacts) => a.name.localeCompare(b.name);
  switch (sort) {
    case 'name':
      return byName;
    case 'newest':
      return (a, b) => b.added.localeCompare(a.added) || byName(a, b);
    case 'games':
      return (a, b) => b.games - a.games || byName(a, b);
    case 'choom':
      return (a, b) => CHOOM_RANK(a.choom) - CHOOM_RANK(b.choom) || SIM_RANK(a.sim) - SIM_RANK(b.sim) || (b.power ?? -1) - (a.power ?? -1) || byName(a, b);
    case 'meta':
      return (a, b) => (b.meta ?? -1) - (a.meta ?? -1) || byName(a, b);
    case 'cost':
      return (a, b) => a.avgCost - b.avgCost || byName(a, b);
    default:
      return (a, b) => (b.power === null ? 0 : 1) - (a.power === null ? 0 : 1) || (b.power ?? b.meta ?? -1) - (a.power ?? a.meta ?? -1) || byName(a, b);
  }
}

/** The decks a view shows, sorted. */
export function applyView(facts: readonly DeckFacts[], v: GalleryView): DeckFacts[] {
  return facts.filter((f) => matchesView(f, v)).sort(compareFacts(v.sort));
}

/** Per source: how many decks pass every other filter (the counts on the source chips). */
export function sourceCounts(facts: readonly DeckFacts[], v: GalleryView): Map<SourceKey, number> {
  const m = new Map<SourceKey, number>();
  for (const f of facts) if (matchesView(f, v, { ignoreSources: true })) m.set(f.source, (m.get(f.source) ?? 0) + 1);
  return m;
}
