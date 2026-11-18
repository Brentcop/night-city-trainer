// The outside picture (ROADMAP2 §13 goal 4; docs/DECK_IMPORT.md "The outside meta"): what two other sites say about the
// decks people really play, kept apart from this trainer's own numbers. cyberpunk-tcg-sim.online's meta reports (a
// ranked season's tier list, win rates and shares of play; a tournament's field and top cut) are collected by
// tools/import_outside_meta.py into a raw file, read here as untrusted input, and written by
// scripts/import-outside-meta.ts to src/data/outsideMeta.json (`kind: 'nct-outside-meta'`, schema 1). choom.gg's hand
// ratings ship in src/data/meta.json already; this module only labels them the same way (`choomArchetypes`).
//
// Never mixed into our numbers: nothing in the ratings, head-to-heads, evidence, card impact, bots, breeder or knowledge
// pack reads this file or this module. The sites' rows are per Legend trio (three Legends, order ignored), not per list,
// so a library deck meets a row by its trio only: "same Legends; the list may differ".
//
// Pure and light: it imports no card data (the Legend cards are handed in), so the pages that show it stay small.
import { nameKey } from './cardNameKey';
import { cleanText } from './cleanText';

export const OUTSIDE_KIND = 'nct-outside-meta';
export const OUTSIDE_SCHEMA = 1;
/** The raw file the Python script writes (gitignored) and its kind. */
export const RAW_KIND = 'nct-outside-meta-import';
export const RAW_SCHEMA = 1;
export const RAW_FILE = 'outside-meta-import.json';
export const OUTSIDE_FILE = 'src/data/outsideMeta.json';
export const OUTSIDE_SCRIPT = 'tools/import_outside_meta.py';

/** The most a raw file may hold; more is cut off (and said), a larger file is refused. */
export const OUTSIDE_LIMITS = { chars: 1_000_000, pages: 12, rows: 200, matchups: 400, name: 80, title: 120, link: 500, note: 200, notes: 20 } as const;

export const SIM_SITE = 'cyberpunk-tcg-sim.online';
const SITE_HOSTS: Record<string, string> = { 'cyberpunk-tcg-sim.online': SIM_SITE, 'www.cyberpunk-tcg-sim.online': SIM_SITE, 'choom.gg': 'choom.gg', 'www.choom.gg': 'choom.gg' };

// ---------------------------------------------------------------- the tracked file

/** Three Legends as the site wrote them, and this trainer's card id for each (null when a name matched no Legend). */
export interface OutsideTrio {
  names: string[];
  ids: (string | null)[];
}

/** One trio's place in a source's field: its share of the field (0–100) and what the site gives beside it. */
export interface OutsideFieldRow {
  trio: OutsideTrio;
  /** percent of the source's field (`shareOf`) */
  share: number;
  /** game win rate in percent, as the site gives it */
  winRate?: number;
  wins?: number;
  losses?: number;
  /** tournament: players who brought it, top-cut places it took, its best finish */
  players?: number;
  top8?: number;
  best?: number;
}

/** A season report's ranked deck (its power rankings). */
export interface OutsideTierRow {
  rank: number;
  trio: OutsideTrio;
  /** the site's tier number (1 is its best) */
  tier: number;
  winRate: number;
  wins: number;
  losses: number;
  /** percent of the season's high-rank decks */
  share: number;
  players?: number;
}

export interface OutsideMatchupRow {
  trio: OutsideTrio;
  vs: OutsideTrio;
  winRate: number;
  wins: number;
  losses: number;
}

interface SourceBase {
  /** stable id: the site and the report's address ("sim:season-1") */
  id: string;
  site: typeof SIM_SITE;
  /** the report's own title */
  title: string;
  /** the report's own address (its canonical link) */
  link: string;
  /** the day the page was read (YYYY-MM-DD) */
  collected: string;
  /** the day the site published the report (YYYY-MM-DD), when it says */
  published: string;
  /** what a share is a share of, in words */
  shareOf: string;
  totals: Record<string, number>;
  field: OutsideFieldRow[];
}
export interface OutsideSeasonSource extends SourceBase {
  kind: 'season';
  period: { from: string; to: string };
  tiers: OutsideTierRow[];
  matchups: OutsideMatchupRow[];
}
export interface OutsideTournamentSource extends SourceBase {
  kind: 'tournament';
  /** the day it was played */
  date: string;
  topCut: { place: number; trio: OutsideTrio }[];
}
export type OutsideSource = OutsideSeasonSource | OutsideTournamentSource;

export interface OutsideMetaFile {
  kind: typeof OUTSIDE_KIND;
  schema: typeof OUTSIDE_SCHEMA;
  /** the newest `collected` of its sources */
  updated: string;
  sources: OutsideSource[];
  /** Legend names that matched no card, each once (they stay as text in their rows) */
  unmatched: string[];
}

// ---------------------------------------------------------------- trios

/** A trio's key: its three card ids sorted (order ignored), or null when a name did not match. */
export function trioKey(t: Pick<OutsideTrio, 'ids'>): string | null {
  if (t.ids.length !== 3 || t.ids.some((id) => !id)) return null;
  return [...(t.ids as string[])].sort().join('+');
}

/** A deck's trio key from its Legends (null when it does not have exactly three). */
export function legendsKey(legends: readonly string[]): string | null {
  return legends.length === 3 ? [...legends].sort().join('+') : null;
}

/** A trio as the site wrote it. */
export const trioWords = (t: OutsideTrio): string => t.names.join(' / ');

/** What a Legend card looks like to the matcher (the caller hands in the Legend cards). */
export type LegendCard = { id: string; name: string; subname?: string | null };

export type LegendMatch = { ok: true; id: string } | { ok: false; why: string };

/**
 * A matcher for Legend names, by resolveRef's rule (src/lib/deckImport.ts) among the Legend cards only: the full name
 * exactly ("V: Streetkid"; accents, case, apostrophes and the separator between name and subname do not matter), else
 * the name alone when one Legend has it ("Adam Smasher"). Never a guess: two Legends with the name, or none, is a reason.
 */
export function legendMatcher(legends: readonly LegendCard[]): (name: string) => LegendMatch {
  const full = new Map<string, LegendCard[]>();
  const base = new Map<string, LegendCard[]>();
  const push = (m: Map<string, LegendCard[]>, k: string, c: LegendCard) => m.set(k, [...(m.get(k) ?? []), c]);
  for (const c of legends) {
    push(full, nameKey(c.subname ? `${c.name} ${c.subname}` : c.name), c);
    push(base, nameKey(c.name), c);
  }
  return (name) => {
    const k = nameKey(name);
    const f = full.get(k) ?? [];
    if (f.length === 1) return { ok: true, id: f[0]!.id };
    const b = f.length ? f : (base.get(k) ?? []);
    if (b.length === 1) return { ok: true, id: b[0]!.id };
    if (b.length > 1) return { ok: false, why: `“${name}” could be ${b.length} Legends: the subname is needed.` };
    return { ok: false, why: `“${name}” is not a Legend this trainer knows.` };
  };
}

// ---------------------------------------------------------------- reading the raw file (untrusted)

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A YYYY-MM-DD day that is a real date, or ''. A longer ISO stamp gives its day. */
export function isoDay(v: unknown): string {
  if (typeof v !== 'string') return '';
  const d = v.slice(0, 10);
  if (!DAY.test(d)) return '';
  const t = Date.parse(`${d}T00:00:00Z`);
  return Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== d ? '' : d;
}

/** A link on one of the two sites (http or https), or '' when it is not one. */
export function outsideLink(v: unknown): string {
  const s = cleanText(v, OUTSIDE_LIMITS.link);
  if (!s) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') && SITE_HOSTS[u.hostname.toLowerCase()] && !u.username && !u.password ? u.href : '';
  } catch {
    return '';
  }
}

const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? v : null);
const int = (v: unknown, lo: number, hi: number): number | null => (num(v, lo, hi) !== null && Number.isInteger(v) ? (v as number) : null);
const pct = (v: unknown) => num(v, 0, 100);
const round1 = (x: number) => Math.round(x * 10) / 10;

export type OutsideReadResult = { ok: true; file: OutsideMetaFile; warnings: string[] } | { ok: false; why: string };

/** The source id for a report's address: "sim:" and the report's slug. */
export function sourceId(link: string): string {
  const slug = new URL(link).pathname.replace(/\/+$/, '').split('/').pop() ?? '';
  return `sim:${slug}`;
}

/**
 * The raw file the script wrote, read as untrusted input and turned into the tracked file: every string cleaned and
 * capped, every number checked against its range, every link kept only on the two sites, every Legend name matched
 * (`legends`: this trainer's Legend cards) or kept as text and reported. Refused with one sentence when the file is not one; rows that are not understood are
 * left out, and said.
 */
export function readOutsideImport(raw: string, legends: readonly LegendCard[]): OutsideReadResult {
  if (raw.length > OUTSIDE_LIMITS.chars) return { ok: false, why: `This file is too large to be an outside-meta file (over ${OUTSIDE_LIMITS.chars / 1_000_000} MB).` };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, why: 'This file is not an outside-meta file (it is not JSON).' };
  }
  if (!isObj(v)) return { ok: false, why: 'This file is not an outside-meta file (it holds no JSON object).' };
  if (v.kind !== RAW_KIND) return { ok: false, why: `This is not a file from ${OUTSIDE_SCRIPT} (its kind is ${typeof v.kind === 'string' ? `“${cleanText(v.kind, 40)}”` : 'missing'}).` };
  if (typeof v.schema !== 'number' || !Number.isInteger(v.schema) || v.schema < 1) return { ok: false, why: 'This outside-meta file has no readable schema number.' };
  if (v.schema > RAW_SCHEMA) return { ok: false, why: `This outside-meta file was written by a newer version of the script (schema ${v.schema}; this reads ${RAW_SCHEMA}).` };
  const warnings: string[] = [];
  const match = legendMatcher(legends);
  const unmatched = new Map<string, string>();
  const trio = (x: unknown): OutsideTrio | null => {
    if (!Array.isArray(x) || x.length !== 3) return null;
    const names = x.map((n) => cleanText(n, OUTSIDE_LIMITS.name));
    if (names.some((n) => !n)) return null;
    const ids = names.map((n) => {
      const m = match(n);
      if (!m.ok) unmatched.set(n, m.why);
      return m.ok ? m.id : null;
    });
    if (ids.every(Boolean) && new Set(ids).size !== 3) return null;
    return { names, ids };
  };
  const rows = <T>(x: unknown, what: string, read: (r: Record<string, unknown>) => T | null, cap: number = OUTSIDE_LIMITS.rows): T[] => {
    if (!Array.isArray(x)) return [];
    if (x.length > cap) warnings.push(`${what}: ${x.length} rows; only the first ${cap} were read.`);
    const out: T[] = [];
    let bad = 0;
    for (const r of x.slice(0, cap)) {
      const got = isObj(r) ? read(r) : null;
      if (got) out.push(got);
      else bad++;
    }
    if (bad) warnings.push(`${what}: ${bad} row${bad === 1 ? ' was' : 's were'} not understood and left out.`);
    return out;
  };
  const pagesIn = Array.isArray(v.pages) ? v.pages : [];
  if (pagesIn.length > OUTSIDE_LIMITS.pages) warnings.push(`The file has ${pagesIn.length} reports; only the first ${OUTSIDE_LIMITS.pages} were read.`);
  const sources: OutsideSource[] = [];
  for (const p of pagesIn.slice(0, OUTSIDE_LIMITS.pages)) {
    if (!isObj(p)) continue;
    const link = outsideLink(p.link);
    let host = '';
    try {
      host = link ? (SITE_HOSTS[new URL(link).hostname.toLowerCase()] ?? '') : '';
    } catch {
      host = '';
    }
    const title = cleanText(p.title, OUTSIDE_LIMITS.title);
    const collected = isoDay(p.collected);
    if (host !== SIM_SITE || !collected) {
      warnings.push(`A report was left out: ${!link ? 'its address is not on cyberpunk-tcg-sim.online' : host !== SIM_SITE ? `${host} reports are not read here` : 'it has no day it was collected'}.`);
      continue;
    }
    const totals: Record<string, number> = {};
    if (isObj(p.totals)) for (const [k, n] of Object.entries(p.totals).slice(0, 20)) if (/^[a-zA-Z]{1,24}$/.test(k) && int(n, 0, 1e9) !== null) totals[k] = n as number;
    const notes = Array.isArray(p.notes) ? p.notes.slice(0, OUTSIDE_LIMITS.notes).map((n) => cleanText(n, OUTSIDE_LIMITS.note)).filter(Boolean) : [];
    for (const n of notes) warnings.push(`${title || link}: the script noted ${n}`);
    const base = { id: sourceId(link), site: SIM_SITE, title, link, collected, published: isoDay(p.published) } as const;
    const name = title || link;
    if (p.kind === 'season') {
      const period = isObj(p.period) ? { from: isoDay(p.period.from), to: isoDay(p.period.to) } : { from: '', to: '' };
      const tiers = rows(p.tiers, `${name}, power rankings`, (r): OutsideTierRow | null => {
        const t = trio(r.trio);
        const rank = int(r.rank, 1, 999);
        const tier = int(r.tier, 1, 9);
        const winRate = pct(r.winRate);
        const wins = int(r.wins, 0, 1e7);
        const losses = int(r.losses, 0, 1e7);
        const share = pct(r.share);
        if (!t || rank === null || tier === null || winRate === null || wins === null || losses === null || share === null) return null;
        const row: OutsideTierRow = { rank, trio: t, tier, winRate, wins, losses, share };
        const players = int(r.players, 0, 1e7);
        if (players !== null) row.players = players;
        return row;
      });
      const field = rows(p.field, `${name}, legend map`, (r): OutsideFieldRow | null => {
        const t = trio(r.trio);
        const share = pct(r.share);
        if (!t || share === null) return null;
        const row: OutsideFieldRow = { trio: t, share };
        const wr = pct(r.winRate);
        if (wr !== null) row.winRate = wr;
        return row;
      });
      // the field is the legend map's trios, then any ranked deck the map folded into "Other" (each with its share)
      const sameTrio = (a: OutsideTrio, b: OutsideTrio) => [...a.names].sort().join('|') === [...b.names].sort().join('|');
      for (const t of tiers) {
        const row = field.find((f) => sameTrio(f.trio, t.trio));
        if (row) Object.assign(row, { wins: t.wins, losses: t.losses, ...(t.players !== undefined ? { players: t.players } : {}) });
        else field.push({ trio: t.trio, share: t.share, winRate: t.winRate, wins: t.wins, losses: t.losses, ...(t.players !== undefined ? { players: t.players } : {}) });
      }
      field.sort((a, b) => b.share - a.share);
      const matchups = rows(
        p.matchups,
        `${name}, matchups`,
        (r): OutsideMatchupRow | null => {
          const a = trio(r.trio);
          const b = trio(r.vs);
          const winRate = pct(r.winRate);
          const wins = int(r.wins, 0, 1e7);
          const losses = int(r.losses, 0, 1e7);
          return a && b && winRate !== null && wins !== null && losses !== null ? { trio: a, vs: b, winRate, wins, losses } : null;
        },
        OUTSIDE_LIMITS.matchups,
      );
      if (!field.length) {
        warnings.push(`${name} was left out: no trio of its field could be read.`);
        continue;
      }
      sources.push({ ...base, kind: 'season', shareOf: 'high-rank decks (both players in Division III or Master)', period, totals, field, tiers, matchups });
    } else if (p.kind === 'tournament') {
      const players = totals.players ?? 0;
      const field = rows(p.field, `${name}, field`, (r): OutsideFieldRow | null => {
        const t = trio(r.trio);
        const n = int(r.players, 1, 1e6);
        if (!t || n === null || !players || n > players) return null;
        // share of the field: the players who brought the trio over the players paired in the event
        const row: OutsideFieldRow = { trio: t, share: round1((100 * n) / players), players: n };
        const wr = pct(r.winRate);
        if (wr !== null) row.winRate = wr;
        const w = int(r.wins, 0, 1e6);
        const l = int(r.losses, 0, 1e6);
        if (w !== null && l !== null) Object.assign(row, { wins: w, losses: l });
        const top = int(r.top8, 0, 64);
        if (top !== null) row.top8 = top;
        const best = int(r.best, 1, 1e6);
        if (best !== null) row.best = best;
        return row;
      });
      const topCut = rows(p.topCut, `${name}, top cut`, (r) => {
        const t = trio(r.trio);
        const place = int(r.place, 1, 64);
        return t && place !== null ? { place, trio: t } : null;
      }).sort((a, b) => a.place - b.place);
      if (!field.length) {
        warnings.push(`${name} was left out: ${players ? 'no trio of its field could be read' : 'it gives no number of players'}.`);
        continue;
      }
      sources.push({ ...base, kind: 'tournament', shareOf: 'players in the event', date: isoDay(p.date), totals, field, topCut });
    } else warnings.push(`${name} was left out: it is neither a season nor a tournament report.`);
  }
  if (!sources.length) return { ok: false, why: 'This outside-meta file holds no report that could be read.' };
  const seen = new Set<string>();
  const kept = sources.filter((s) => (seen.has(s.id) ? (warnings.push(`${s.title} came twice; the first was kept.`), false) : (seen.add(s.id), true)));
  const updated = kept.map((s) => s.collected).sort().pop() ?? '';
  const file: OutsideMetaFile = { kind: OUTSIDE_KIND, schema: OUTSIDE_SCHEMA, updated, sources: kept, unmatched: [...unmatched.keys()].sort() };
  for (const why of unmatched.values()) warnings.push(`Not matched, kept as text: ${why}`);
  return { ok: true, file, warnings };
}

// ---------------------------------------------------------------- checking the tracked file (check:data)

/** What is wrong with a tracked outside-meta file: empty when all is well. `isLegend` says whether an id is a Legend card. */
export function outsideMetaProblems(v: unknown, isLegend: (id: string) => boolean): string[] {
  const out: string[] = [];
  if (!isObj(v)) return ['not a JSON object'];
  if (v.kind !== OUTSIDE_KIND) out.push(`kind is not ${OUTSIDE_KIND}`);
  if (v.schema !== OUTSIDE_SCHEMA) out.push(`schema is not ${OUTSIDE_SCHEMA}`);
  if (!isoDay(v.updated) || v.updated !== isoDay(v.updated)) out.push('updated is not a YYYY-MM-DD day');
  const unmatched = new Set(Array.isArray(v.unmatched) ? v.unmatched.filter((n): n is string => typeof n === 'string') : []);
  if (!Array.isArray(v.unmatched)) out.push('unmatched is not a list');
  const sources = Array.isArray(v.sources) ? v.sources : (out.push('sources is not a list'), []);
  const checkTrio = (t: unknown, where: string) => {
    if (!isObj(t) || !Array.isArray(t.names) || !Array.isArray(t.ids) || t.names.length !== 3 || t.ids.length !== 3) return out.push(`${where}: a trio is not three names and three ids`);
    t.names.forEach((n, i) => {
      const id = (t.ids as unknown[])[i];
      if (typeof n !== 'string' || !n || n !== cleanText(n, OUTSIDE_LIMITS.name)) out.push(`${where}: a Legend name is not clean text`);
      else if (id === null) {
        if (!unmatched.has(n)) out.push(`${where}: “${n}” matched no card but is not listed under unmatched`);
      } else if (typeof id !== 'string' || !isLegend(id)) out.push(`${where}: ${String(id)} is not a Legend card`);
    });
    return 0;
  };
  const ids = new Set<string>();
  let newest = '';
  sources.forEach((s, i) => {
    const where = `source ${i + 1}`;
    if (!isObj(s)) return out.push(`${where}: not an object`);
    const at = `${where} (${typeof s.id === 'string' ? s.id : '?'})`;
    if (typeof s.id !== 'string' || ids.has(s.id)) out.push(`${at}: its id is missing or repeated`);
    else ids.add(s.id);
    if (s.site !== SIM_SITE) out.push(`${at}: site is not ${SIM_SITE}`);
    if (!outsideLink(s.link) || outsideLink(s.link) !== s.link) out.push(`${at}: link is not a link on the two sites`);
    if (!isoDay(s.collected) || s.collected !== isoDay(s.collected)) out.push(`${at}: collected is not a YYYY-MM-DD day`);
    else if (s.collected > newest) newest = s.collected;
    if (s.published !== '' && (typeof s.published !== 'string' || s.published !== isoDay(s.published))) out.push(`${at}: published is not a YYYY-MM-DD day or ''`);
    if (typeof s.title !== 'string' || !s.title) out.push(`${at}: no title`);
    const field = Array.isArray(s.field) ? s.field : (out.push(`${at}: field is not a list`), []);
    let sum = 0;
    for (const r of field) {
      if (!isObj(r) || pct(r.share) === null) {
        out.push(`${at}: a field share is not between 0 and 100`);
        continue;
      }
      sum += r.share as number;
      if (r.winRate !== undefined && pct(r.winRate) === null) out.push(`${at}: a field win rate is not between 0 and 100`);
      checkTrio(r.trio, `${at}, field`);
    }
    if (sum > 100.5) out.push(`${at}: the field's shares add up to ${sum.toFixed(1)}%, over 100`);
    if (s.kind === 'season') {
      if (!isObj(s.period) || !isoDay(s.period.from) || !isoDay(s.period.to) || (s.period.from as string) > (s.period.to as string)) out.push(`${at}: period is not two YYYY-MM-DD days in order`);
      for (const r of Array.isArray(s.tiers) ? s.tiers : (out.push(`${at}: tiers is not a list`), [])) {
        if (!isObj(r) || pct(r.share) === null || pct(r.winRate) === null) out.push(`${at}: a ranked deck's share or win rate is not between 0 and 100`);
        else checkTrio(r.trio, `${at}, tiers`);
      }
      for (const r of Array.isArray(s.matchups) ? s.matchups : (out.push(`${at}: matchups is not a list`), [])) {
        if (!isObj(r) || pct(r.winRate) === null) out.push(`${at}: a matchup win rate is not between 0 and 100`);
        else (checkTrio(r.trio, `${at}, matchups`), checkTrio(r.vs, `${at}, matchups`));
      }
    } else if (s.kind === 'tournament') {
      if (s.date !== '' && (typeof s.date !== 'string' || s.date !== isoDay(s.date))) out.push(`${at}: date is not a YYYY-MM-DD day or ''`);
      for (const r of Array.isArray(s.topCut) ? s.topCut : (out.push(`${at}: topCut is not a list`), [])) {
        if (!isObj(r) || int(r.place, 1, 64) === null) out.push(`${at}: a top-cut place is not a whole number`);
        else checkTrio(r.trio, `${at}, topCut`);
      }
    } else out.push(`${at}: kind is neither season nor tournament`);
    return 0;
  });
  if (sources.length && newest && v.updated !== newest) out.push(`updated is ${String(v.updated)}, but the newest source was collected ${newest}`);
  return out;
}

// ---------------------------------------------------------------- what changed (the CLI's report)

/** One line per difference between the file on disk and the new one (empty when they hold the same figures). */
export function outsideChanges(before: OutsideMetaFile | null, after: OutsideMetaFile): string[] {
  if (!before) return after.sources.map((s) => `new: ${s.title} (${s.field.length} trios in the field, collected ${s.collected})`);
  const out: string[] = [];
  const old = new Map(before.sources.map((s) => [s.id, s]));
  for (const s of after.sources) {
    const o = old.get(s.id);
    old.delete(s.id);
    if (!o) {
      out.push(`new: ${s.title} (${s.field.length} trios in the field, collected ${s.collected})`);
      continue;
    }
    if (o.collected !== s.collected) out.push(`${s.title}: collected ${o.collected} → ${s.collected}`);
    for (const k of new Set([...Object.keys(o.totals), ...Object.keys(s.totals)])) if (o.totals[k] !== s.totals[k]) out.push(`${s.title}: ${k} ${o.totals[k] ?? '—'} → ${s.totals[k] ?? '—'}`);
    const key = (t: OutsideTrio) => [...t.names].sort().join(' / ');
    const was = new Map(o.field.map((r) => [key(r.trio), r]));
    for (const r of s.field) {
      const w = was.get(key(r.trio));
      was.delete(key(r.trio));
      if (!w) out.push(`${s.title}: new in the field: ${trioWords(r.trio)} ${r.share}%`);
      else if (w.share !== r.share || w.winRate !== r.winRate) out.push(`${s.title}: ${trioWords(r.trio)} ${w.share}% → ${r.share}% of the field${w.winRate !== r.winRate ? `, win rate ${w.winRate ?? '—'}% → ${r.winRate ?? '—'}%` : ''}`);
    }
    for (const r of was.values()) out.push(`${s.title}: no longer in the field: ${trioWords(r.trio)} (was ${r.share}%)`);
    if (s.kind === 'season' && o.kind === 'season') {
      const ranks = (x: OutsideSeasonSource) => x.tiers.map((t) => `${t.rank}. ${key(t.trio)} tier ${t.tier} ${t.winRate}%`).join('\n');
      if (ranks(o) !== ranks(s)) out.push(`${s.title}: the power rankings changed`);
      if (o.matchups.length !== s.matchups.length || JSON.stringify(o.matchups) !== JSON.stringify(s.matchups)) out.push(`${s.title}: the matchup table changed (${o.matchups.length} → ${s.matchups.length} cells)`);
    }
    if (s.kind === 'tournament' && o.kind === 'tournament' && JSON.stringify(o.topCut) !== JSON.stringify(s.topCut)) out.push(`${s.title}: the top cut changed`);
  }
  for (const s of old.values()) out.push(`removed: ${s.title}`);
  return out;
}

// ---------------------------------------------------------------- the field as an input (ROADMAP2 §13 goal 5)

/** What outsideFieldShares needs of a library deck. */
export type FieldDeck = { file: string; deck: { name: string; legends: readonly string[] } };

export interface FieldShareDeck {
  file: string;
  name: string;
  /** the deck's trio key */
  trio: string | null;
  /** its trio's share of the source's field (percent), or 0 when the source does not list the trio */
  trioShare: number;
  /** how many of the given decks play that trio */
  splitAmong: number;
  /** the deck's weight: trioShare / splitAmong (percent of the field) */
  weight: number;
}

export interface FieldShares {
  sourceId: string;
  /** what a share is a share of */
  shareOf: string;
  /** every deck given, in the order given */
  decks: FieldShareDeck[];
  /** the share of the field the given decks cover by trio (percent): the listed trios at least one deck plays */
  covered: number;
  /** the source's listed trios no given deck plays, largest first, with their total */
  uncovered: { trio: OutsideTrio; share: number }[];
  uncoveredShare: number;
  /** the share of the field the source lists by trio, and what it leaves unlisted (folded into "Other", or unnamed) */
  listed: number;
  unlisted: number;
}

/**
 * Each library deck's weight in a source's real field, for setting up a tournament that mirrors it (goal 5).
 *
 * The rule: a deck's weight is its Legend trio's share of the source's field, split equally among the given decks that
 * play that trio; a deck whose trio the source does not list weighs 0. The equal split is an assumption: the sites count
 * Legend trios, not lists, so how the trio's players divide among our lists of it is not known. Pass a field that holds
 * each list once (src/lib/distinctLists.ts), or the same list counts twice. `covered` is the share of the source's whole
 * field (100%) whose trio the decks play; `uncovered` the listed trios they miss; `unlisted` what the source does not
 * break down by trio (its "Other" and the trios below its table), which no weight can reach.
 */
export function outsideFieldShares(library: readonly FieldDeck[], source: Pick<OutsideSource, 'id' | 'shareOf' | 'field'>): FieldShares {
  const keyOf = (d: FieldDeck) => legendsKey(d.deck.legends);
  const byTrio = new Map<string, number>();
  for (const d of library) {
    const k = keyOf(d);
    if (k) byTrio.set(k, (byTrio.get(k) ?? 0) + 1);
  }
  const share = new Map<string, number>();
  for (const r of source.field) {
    const k = trioKey(r.trio);
    if (k) share.set(k, (share.get(k) ?? 0) + r.share);
  }
  const decks = library.map((d): FieldShareDeck => {
    const k = keyOf(d);
    const trioShare = k ? (share.get(k) ?? 0) : 0;
    const splitAmong = k ? (byTrio.get(k) ?? 1) : 1;
    return { file: d.file, name: d.deck.name, trio: k, trioShare, splitAmong, weight: trioShare / splitAmong };
  });
  const uncovered = source.field.filter((r) => {
    const k = trioKey(r.trio);
    return !k || !byTrio.has(k);
  }).map((r) => ({ trio: r.trio, share: r.share }));
  uncovered.sort((a, b) => b.share - a.share);
  const listed = source.field.reduce((s, r) => s + r.share, 0);
  const uncoveredShare = uncovered.reduce((s, r) => s + r.share, 0);
  return { sourceId: source.id, shareOf: source.shareOf, decks, covered: round1(listed - uncoveredShare), uncovered, uncoveredShare: round1(uncoveredShare), listed: round1(listed), unlisted: round1(Math.max(0, 100 - listed)) };
}

// ---------------------------------------------------------------- what a deck page shows

/** One source's rows for one trio. */
export interface OutsideForTrio {
  source: OutsideSource;
  field?: OutsideFieldRow;
  tier?: OutsideTierRow;
  /** tournament: the top-cut places the trio took */
  places: number[];
}

/** Every source's rows for a deck's Legends (the same three, any order). */
export function outsideForLegends(legends: readonly string[], file: Pick<OutsideMetaFile, 'sources'> | null): OutsideForTrio[] {
  const k = legendsKey(legends);
  if (!k || !file) return [];
  const out: OutsideForTrio[] = [];
  for (const source of file.sources) {
    const field = source.field.find((r) => trioKey(r.trio) === k);
    const tier = source.kind === 'season' ? source.tiers.find((r) => trioKey(r.trio) === k) : undefined;
    const places = source.kind === 'tournament' ? source.topCut.filter((r) => trioKey(r.trio) === k).map((r) => r.place) : [];
    if (field || tier || places.length) out.push({ source, field, tier, places });
  }
  return out;
}

/** The library decks that play a trio (same three Legends, any order). */
export function decksWithTrio<T extends FieldDeck>(t: OutsideTrio, library: readonly T[]): T[] {
  const k = trioKey(t);
  return k ? library.filter((d) => legendsKey(d.deck.legends) === k) : [];
}

// ---------------------------------------------------------------- choom.gg, labelled the same way

/** choom.gg's Night City Meta page: its hand ratings ship in src/data/meta.json (scripts/import-meta.ts). */
export const CHOOM_META = { site: 'choom.gg', title: 'Night City Meta', link: 'https://choom.gg/meta' } as const;

/** One archetype of src/data/meta.json, as far as this module reads it. */
export type ChoomArchetype = { title: string; tier?: string; power?: number; complexity?: string; source?: string; deckFile?: string };

export interface ChoomRow {
  title: string;
  tier: string;
  power: number | null;
  complexity: string;
  /** the archetype's page on choom.gg */
  link: string;
  /** the library deck that carries its list, and the day that list was collected (its Via line) */
  file: string;
  legends: readonly string[];
  collected: string;
}

/** "choom.gg/meta (collected 2026-11-09)" → "2026-11-09". */
export const collectedOf = (via: string | undefined): string => isoDay(via?.match(/collected (\d{4}-\d{2}-\d{2})/)?.[1] ?? '');

/** choom.gg's archetypes with their library deck's Legends and the day the ratings were collected (archetypes whose deck is not in the library are left out). */
export function choomArchetypes(meta: readonly ChoomArchetype[], library: readonly (FieldDeck & { prov?: { via?: string } })[]): ChoomRow[] {
  return meta.flatMap((m) => {
    const d = library.find((x) => x.file === m.deckFile);
    if (!d || !m.tier) return [];
    const link = outsideLink((m.source ?? '').split(' ')[0]) || CHOOM_META.link;
    return [{ title: m.title, tier: m.tier, power: typeof m.power === 'number' ? m.power : null, complexity: m.complexity ?? '', link, file: d.file, legends: d.deck.legends, collected: collectedOf(d.prov?.via) }];
  });
}

/** choom.gg's archetypes for a deck's Legends (the same three, any order). */
export function choomForLegends(legends: readonly string[], rows: readonly ChoomRow[]): ChoomRow[] {
  const k = legendsKey(legends);
  return k ? rows.filter((r) => legendsKey(r.legends) === k) : [];
}

// ---------------------------------------------------------------- words

/** The words every view uses, so the outside picture is always labelled the same way. */
export const OUTSIDE_WORDS = {
  sameLegends: 'Same Legends; the list may differ: these sites count Legend trios, not lists.',
  notOurs: 'Another site’s numbers, shown beside ours and never mixed into them.',
  choomRated: 'rated by hand by the choom.gg editors, not computed from results',
} as const;

/** A season's period or a tournament's day, in words. */
export function sourceWhen(s: OutsideSource): string {
  if (s.kind === 'season') return s.period.from && s.period.to ? `${s.period.from} to ${s.period.to}` : '';
  return s.date ? `played ${s.date}` : '';
}

/** "Season-1 meta report (2026-09-05 to 2026-11-15)": a source's title with its own period. */
export const sourceTitle = (s: OutsideSource): string => `${s.title}${sourceWhen(s) ? ` (${sourceWhen(s)})` : ''}`;

/** A win rate with its games: "54.2% over 1,718 games". */
export function winRateWords(r: { winRate?: number; wins?: number; losses?: number }): string {
  if (r.winRate === undefined) return '';
  const games = r.wins !== undefined && r.losses !== undefined ? r.wins + r.losses : null;
  return `${r.winRate.toFixed(1)}%${games !== null ? ` over ${games.toLocaleString('en-US')} games` : ''}`;
}

/** An ordinal place: 1st, 2nd, 3rd, 11th. */
export function placeWords(n: number): string {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : (['th', 'st', 'nd', 'rd'][n % 10] ?? 'th')}`;
}
