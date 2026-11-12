// A deck's recorded results in one summary: tournament games and win rate, seat split, record against the meta,
// best and worst matchups, event finishes, power rank, and whether the numbers predate the current simulator.
// Pure: every source is passed in, so the Home page, the gallery and the profile can each bind only the data they load.
import { CURRENT_SIM_VERSION, isHistorical, parseWL, ratingsHistorical, type RatingsFile } from './playedRecord';
export * from './playedRecord';

export interface EventLite {
  id: number;
  date: string;
  champion: string | null;
  simVersion?: number;
  /** another format, or pairings set by hand (src/lib/eventFormats.ts): its games count, its finishes don't */
  custom?: boolean;
  /** the format of a non-Swiss event (absent for Swiss) */
  kind?: string;
  top8: { deck: string }[];
  standings: { deck: string; record: string; games: string }[];
}
/** A matchup from the deck's side: `w` is the win rate (ties half), fw/fg and sw/sg wins/games on the play and draw. */
export interface MatchLine {
  opp: string;
  oppFile?: string;
  g: number;
  w: number;
  fw?: number;
  fg?: number;
  sw?: number;
  sg?: number;
  /** the matchup estimate shrunk toward the power ratings (tournament head-to-heads from h2h.json with a model) */
  est?: number;
}
export interface H2HFile {
  events: number;
  decks: string[];
  /** [i, j, wins of i vs j (ties half), games], i < j */
  pairs: [number, number, number, number][];
  /** the shrunk estimate of i beating j per entry of `pairs` (src/lib/h2hModel.ts; absent in older files) */
  shrunk?: number[];
}

export interface RecordSources {
  name: string;
  ratings?: RatingsFile;
  events?: EventLite[];
  /** large-sample finals vs the meta archetypes (deckReports.json) */
  finals?: { overall: number; games: number; rows: MatchLine[] };
  /** dedicated head-to-head runs (deckReports.json) */
  h2h?: MatchLine[];
  /** pooled tournament head-to-heads (public/data/h2h.json, loaded lazily) */
  eventH2H?: MatchLine[];
  /** telemetry report (analysis.json) */
  telemetry?: { games: number; wr: number; wrFirst: number; wrSecond: number };
  /** season leaderboard row with its rank */
  leader?: { rank: number; of: number; rating: number; vsMeta: number; metaG: number; percentile: number };
  /** simulator version of each non-event source, from its manifest; missing means it predates versioning (historical) */
  versions?: { reports?: number; telemetry?: number; seasons?: number };
  simVersion?: number;
}

export interface Finish {
  id: number;
  date: string;
  place: number;
  of: number;
  record: string;
  games: string;
  top8: boolean;
  champion: boolean;
}

export interface DeckRecord {
  hasAny: boolean;
  tournament?: {
    games: number;
    /** Swiss game record (top-cut games count in `games` only) */
    won: number;
    lost: number;
    wr: number | null;
    expected: { v: number; lo: number; hi: number };
    wrMeta: number | null;
    rank: number;
    of: number;
    events: number;
    titles: number;
    top8: number;
    matches: string;
  };
  finishes: Finish[];
  seats?: { first: number; second: number; firstN: number | null; secondN: number | null; games: number; source: 'finals' | 'h2h' | 'telemetry' };
  vsMeta?: { wr: number; n: number; source: 'finals' | 'seasons' };
  matchups?: { best: MatchLine; worst: MatchLine | null; count: number; source: 'finals' | 'h2h' | 'events' };
  leader?: RecordSources['leader'];
  /** some of the numbers were recorded before the current simulator (or carry no version, which means the same) */
  historical: boolean;
}

const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st … */
export function ordinal(n: number): string {
  const t = n % 100;
  const s = t >= 11 && t <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${n}${s}`;
}

/** Every standard recorded event the deck entered, newest first (custom events are not finishes: see EventLite.custom). */
export function eventFinishes(name: string, events: EventLite[]): Finish[] {
  const out: Finish[] = [];
  for (const e of events) {
    if (e.custom) continue;
    const i = e.standings.findIndex((s) => s.deck === name);
    const s = e.standings[i];
    if (!s) continue;
    out.push({ id: e.id, date: e.date, place: i + 1, of: e.standings.length, record: s.record, games: s.games, top8: i < e.top8.length, champion: e.champion === name });
  }
  return out.sort((a, b) => b.id - a.id);
}

/** Tournament head-to-heads for one deck from the pooled h2h file, from its side, most games first. */
export function h2hFor(name: string, file: H2HFile | null | undefined): MatchLine[] {
  if (!file) return [];
  const me = file.decks.indexOf(name);
  if (me < 0) return [];
  const out: MatchLine[] = [];
  file.pairs.forEach(([i, j, w, g], q) => {
    if (!g || (i !== me && j !== me)) return;
    const opp = file.decks[i === me ? j : i];
    if (opp === undefined) return;
    const p = file.shrunk?.[q];
    const est = p === undefined ? {} : { est: i === me ? p : 1 - p };
    out.push(i === me ? { opp, g, w: w / g, ...est } : { opp, g, w: (g - w) / g, ...est });
  });
  return out.sort((a, b) => b.g - a.g || a.opp.localeCompare(b.opp));
}

/**
 * Best and worst of the matchups with at least `minGames` games (worst is null when only one qualifies), ranked by the
 * shrunk estimate where a row has one, else by the raw win rate.
 */
export function extremes(rows: MatchLine[], minGames = 1): { best: MatchLine; worst: MatchLine | null; count: number } | null {
  const ok2 = rows.filter((r) => r.g >= minGames && ok(r.w));
  const v = (r: MatchLine) => (ok(r.est) ? r.est : r.w);
  const sorted = [...ok2].sort((a, b) => v(b) - v(a) || b.g - a.g || a.opp.localeCompare(b.opp));
  const best = sorted[0];
  if (!best) return null;
  return { best, worst: sorted.length > 1 ? (sorted[sorted.length - 1] ?? null) : null, count: ok2.length };
}

/** Wins and games on the play and on the draw, summed over matchup rows that record seats. */
export function seatTotals(rows: MatchLine[]) {
  const t = { fw: 0, fg: 0, sw: 0, sg: 0 };
  for (const r of rows) {
    t.fw += r.fw ?? 0;
    t.fg += r.fg ?? 0;
    t.sw += r.sw ?? 0;
    t.sg += r.sg ?? 0;
  }
  return t;
}

/** Minimum games for a tournament head-to-head to count as a best or worst matchup. */
const EVENT_H2H_MIN = 6;

export function deckRecord(src: RecordSources): DeckRecord {
  const current = src.simVersion ?? CURRENT_SIM_VERSION;
  const v = src.versions ?? {};
  const events = src.events ?? [];
  const rows = src.ratings?.decks ?? [];
  const ri = rows.findIndex((r) => r.name === src.name);
  const row = ri >= 0 ? rows[ri] : undefined;
  const rec: DeckRecord = { hasAny: false, finishes: eventFinishes(src.name, events), historical: false };
  const used: boolean[] = []; // historical flag of every source that contributed

  if (row && row.games > 0) {
    const wl = parseWL(row.gamesRecord);
    rec.tournament = {
      games: row.games,
      won: wl?.[0] ?? 0,
      lost: wl?.[1] ?? 0,
      wr: wl && wl[0] + wl[1] > 0 ? wl[0] / (wl[0] + wl[1]) : null,
      expected: { v: row.wrField, lo: row.wrFieldLo, hi: row.wrFieldHi },
      wrMeta: row.wrMeta,
      rank: ri + 1,
      of: rows.length,
      events: row.events,
      titles: row.titles,
      top8: row.top8,
      matches: row.matches,
    };
    used.push(ratingsHistorical(src.ratings, events, current));
  }
  if (rec.finishes.length) used.push(events.filter((e) => rec.finishes.some((f) => f.id === e.id)).some((e) => isHistorical(e.simVersion, current)));

  const finals = src.finals && src.finals.rows.length ? src.finals : undefined;
  if (finals) {
    const t = seatTotals(finals.rows);
    if (t.fg > 0 && t.sg > 0) rec.seats = { first: t.fw / t.fg, second: t.sw / t.sg, firstN: t.fg, secondN: t.sg, games: t.fg + t.sg, source: 'finals' };
    if (ok(finals.overall)) rec.vsMeta = { wr: finals.overall, n: finals.games, source: 'finals' };
    used.push(isHistorical(v.reports, current));
  }
  if (!rec.seats && src.h2h?.length) {
    const t = seatTotals(src.h2h);
    if (t.fg > 0 && t.sg > 0) {
      rec.seats = { first: t.fw / t.fg, second: t.sw / t.sg, firstN: t.fg, secondN: t.sg, games: t.fg + t.sg, source: 'h2h' };
      used.push(isHistorical(v.reports, current));
    }
  }
  const tel = src.telemetry;
  if (!rec.seats && tel && tel.games > 0 && ok(tel.wrFirst) && ok(tel.wrSecond)) {
    rec.seats = { first: tel.wrFirst, second: tel.wrSecond, firstN: null, secondN: null, games: tel.games, source: 'telemetry' };
    used.push(isHistorical(v.telemetry, current));
  }
  if (src.leader) {
    rec.leader = src.leader;
    if (!rec.vsMeta && ok(src.leader.vsMeta) && src.leader.metaG > 0) rec.vsMeta = { wr: src.leader.vsMeta, n: src.leader.metaG, source: 'seasons' };
    used.push(isHistorical(v.seasons, current));
  }

  const fromFinals = finals && extremes(finals.rows);
  const fromH2H = !fromFinals && src.h2h?.length ? extremes(src.h2h) : null;
  const fromEvents = !fromFinals && !fromH2H && src.eventH2H?.length ? extremes(src.eventH2H, EVENT_H2H_MIN) : null;
  if (fromFinals) rec.matchups = { ...fromFinals, source: 'finals' };
  else if (fromH2H) {
    rec.matchups = { ...fromH2H, source: 'h2h' };
    used.push(isHistorical(v.reports, current));
  } else if (fromEvents) {
    rec.matchups = { ...fromEvents, source: 'events' };
    used.push(ratingsHistorical(undefined, events, current));
  }

  rec.hasAny = !!(rec.tournament || rec.finishes.length || rec.seats || rec.vsMeta || rec.matchups || rec.leader);
  rec.historical = used.some(Boolean);
  return rec;
}

