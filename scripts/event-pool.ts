// Pools recorded tournament events for the power ratings (scripts/ratings.ts): every game for the fit, and tournament
// results (events, titles, top 8s, finishes, match records) from standard events only. Pure, so it is tested directly.
//
//   - Games: every recorded event counts, whatever its format or pairing method (custom events too). A deck entered
//     twice ("X #2", src/lib/eventFormats.ts) plays as X; its games against its own copy are left out.
//   - Results: an event flagged `custom` (another format, or pairings or seeds set by hand) is skipped, so titles, top-8
//     counts, finishes and Swiss records come only from standard Swiss events.
import { entrantBase, type EventSetup } from '../src/lib/eventFormats';

/** The parts of a recorded event the pool reads. */
export interface PoolEvent {
  champion: string | null;
  custom?: boolean;
  setup?: Pick<EventSetup, 'entrants'>;
  standings: { deck: string; mw: number; ml: number; gw: number; gl: number }[];
  rounds: { matches: { a: string; b: string | null; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
  bracket: { matches: { a: string; b: string | null; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
}
export interface PooledGame {
  a: string;
  b: string;
  first: 0 | 1;
  /** score for a: 1, 0.5, 0 */
  s: number;
}
export interface DeckResults {
  events: number;
  titles: number;
  top8: number;
  finishes: number[];
  mw: number;
  ml: number;
  gw: number;
  gl: number;
}

// ---------------------------------------------------------------- which events are pooled (SIM-7)

/** The parts of an event the pool filter reads. */
export interface PoolKeyEvent {
  id: number | string;
  simVersion?: number;
  bot?: string;
}
/** Which events to pool: a sim version and a bot, each 'latest' (the newest event's), 'all', or a value. */
export interface PoolFilter {
  simVersion?: number | 'latest' | 'all';
  bot?: string | 'latest' | 'all';
}
export interface PoolSelection<E> {
  kept: E[];
  /** events left out, with why */
  excluded: { id: number | string; simVersion: number | null; bot: string }[];
  /** the sim version and bot pooled ('all' when not filtered) */
  simVersion: number | null | 'all';
  bot: string | 'all';
  /** every (sim version, bot) group among the recorded events, newest first */
  groups: { simVersion: number | null; bot: string; events: number }[];
  /** one line per thing a reader should know: a mix that was split, or a mix that was pooled */
  warnings: string[];
}

const keyVersion = (e: PoolKeyEvent) => (typeof e.simVersion === 'number' ? e.simVersion : null);
const keyBot = (e: PoolKeyEvent) => e.bot ?? '?';
const byId = (a: PoolKeyEvent, b: PoolKeyEvent) => (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
const groupName = (v: number | null, bot: string) => `sim v${v ?? '?'} ${bot}`;

/**
 * Pick the events whose games may be pooled (ratings, head-to-heads). The default pools only the sim version and bot of
 * the newest recorded event, so a re-recorded field never mixes silently with older games; 'all' pools them anyway,
 * with a warning line. Events keep their order.
 */
export function selectEvents<E extends PoolKeyEvent>(events: readonly E[], f: PoolFilter = {}): PoolSelection<E> {
  const newest = [...events].sort(byId).at(-1);
  const fv = f.simVersion ?? 'latest';
  const fb = f.bot ?? 'latest';
  const wantV: number | null | 'all' = fv === 'latest' ? (newest ? keyVersion(newest) : null) : fv;
  const wantB: string = fb === 'latest' ? (newest ? keyBot(newest) : '?') : fb;
  const counts = new Map<string, { simVersion: number | null; bot: string; events: number; last: E }>();
  for (const e of [...events].sort(byId)) {
    const k = `${keyVersion(e)}\u0000${keyBot(e)}`;
    const g = counts.get(k) ?? { simVersion: keyVersion(e), bot: keyBot(e), events: 0, last: e };
    g.events++;
    g.last = e;
    counts.set(k, g);
  }
  const groups = [...counts.values()].sort((a, b) => byId(b.last, a.last)).map(({ simVersion, bot, events: n }) => ({ simVersion, bot, events: n }));
  const kept: E[] = [];
  const excluded: PoolSelection<E>['excluded'] = [];
  for (const e of events) {
    const okV = wantV === 'all' || keyVersion(e) === wantV;
    const okB = wantB === 'all' || keyBot(e) === wantB;
    if (okV && okB) kept.push(e);
    else excluded.push({ id: e.id, simVersion: keyVersion(e), bot: keyBot(e) });
  }
  const warnings: string[] = [];
  const list = groups.map((g) => `${groupName(g.simVersion, g.bot)} (${g.events} event${g.events === 1 ? '' : 's'})`).join(', ');
  if (excluded.length) warnings.push(`warning: the recorded events mix sim versions or bots (${list}); pooling ${wantV === 'all' ? 'every version' : `sim v${wantV ?? '?'}`} with ${wantB === 'all' ? 'every bot' : wantB} only, ${excluded.length} event(s) left out (--sim-version all --bot all pools them)`);
  else if (groups.length > 1) warnings.push(`warning: pooling events from different sim versions or bots: ${list}`);
  return { kept, excluded, simVersion: wantV, bot: wantB, groups, warnings };
}

/** `--sim-version` and `--bot` values: 'latest' (default), 'all', or a value. */
export function parsePoolFilter(v: { 'sim-version'?: string; bot?: string }): PoolFilter {
  const sv = v['sim-version'] ?? 'latest';
  return { simVersion: sv === 'latest' || sv === 'all' ? sv : Number(sv), bot: v.bot ?? 'latest' };
}
/** Validates a --sim-version value for cli(). */
export const checkSimVersionFlag = (s: string) => (s === 'latest' || s === 'all' || /^\d+$/.test(s) ? undefined : 'latest, all, or a version number');

/** What an aggregate file records about events it left out (absent when every recorded event was pooled). */
export interface PoolRecord {
  simVersion: number | null | 'all';
  bot: string | 'all';
  excluded: { id: number | string; simVersion: number | null; bot: string }[];
}
export const poolRecord = (s: PoolSelection<unknown>): PoolRecord | undefined => (s.excluded.length ? { simVersion: s.simVersion, bot: s.bot, excluded: s.excluded } : undefined);

export function poolEvents(events: readonly PoolEvent[]): { games: PooledGame[]; results: Record<string, DeckResults>; customEvents: number } {
  const games: PooledGame[] = [];
  const results: Record<string, DeckResults> = {};
  let customEvents = 0;
  for (const e of events) {
    const n = e.standings.length;
    const base = (name: string) => entrantBase(e.setup, name);
    if (e.custom) customEvents++;
    else {
      e.standings.forEach((s, i) => {
        const r = (results[base(s.deck)] ??= { events: 0, titles: 0, top8: 0, finishes: [], mw: 0, ml: 0, gw: 0, gl: 0 });
        r.events++;
        r.finishes.push(1 - i / Math.max(1, n - 1));
        if (i < 8) r.top8++;
        r.mw += s.mw;
        r.ml += s.ml;
        r.gw += s.gw;
        r.gl += s.gl;
      });
      const champ = e.champion ? results[base(e.champion)] : undefined;
      if (champ) champ.titles++;
    }
    for (const part of [...e.rounds, ...e.bracket])
      for (const m of part.matches) {
        if (!m.b) continue;
        const a = base(m.a);
        const b = base(m.b);
        if (a === b) continue;
        for (const g of m.games) games.push({ a, b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 });
      }
  }
  return { games, results, customEvents };
}
