// Knowledge pack on the site (docs/RAG_PLAN.md step 3): which records the site ships, how they are cut into files, and
// what the search page shows for each. Pure, like the rest of the core (rule M7): the build side (tools/kb-site.ts,
// run by the Vite plugin in vite.config.ts) and the browser (siteSearch.ts, the Search page) share it.
// What ships: the public records of twelve kinds. Left out on purpose: the FAQ paraphrases (`ruling`, decision D2 is
// still open), the contributors' docs and code headers (`doc`, `code`), and every local record (data/raw, rule M6).
// No text is written by a model: every record is a template sentence or the site's own content (decision D3).
// Groups: the six authored kinds and the four tournament kinds load with the first search (the keyword ranker counts
// the tournament kinds' words, so the ranking needs them from the start); each statistics kind loads only when a
// question asks for it (`lateShardsFor`). The statistics kinds are left out of the keyword ranker's word counts
// (search.ts STATS_FREE_KINDS) and are found only when asked for, so a search without them ranks every other record
// exactly as the full pack does (tests/kb-site.test.ts checks it).
// Parts: each group is cut into one or more part files (shards), each at most a per-file cap as the build measures
// it (gzip; the measure and the cap are handed in, so this module never imports zlib). The files grow in number, not
// in size. The events group is packed whole events at a time in event order, so a full part never changes when later
// events are recorded and a returning visitor's browser keeps it cached; the other groups are packed in record id order.
import { snippet } from './render';
import { cuedKinds, rankExactHits, SEARCH_TUNING, STAT_KINDS, statKinds, type KbIndex } from './search';
import { byString, hashText, KB_KINDS, type KbFieldValue, type KbKind, type KbLink, type KbRecord } from './types';

export const SITE_SHARD_KIND = 'nct-kb-shard';
export const SITE_MANIFEST_KIND = 'nct-kb-site';
export const SITE_SCHEMA = 1;

export interface SiteGroupPlan {
  name: string;
  kinds: readonly KbKind[];
  /** loaded only when a question asks for its kinds (false: with the first search) */
  late: boolean;
  /** 'event': packed whole events at a time, in event order (the records' `event` field); else one record at a time, in id order */
  unit?: 'event';
}

export const SITE_GROUPS: readonly SiteGroupPlan[] = [
  // the site's own content: cards, guides, packages and the glossary
  { name: 'core', kinds: ['card', 'guide', 'package', 'term'], late: false },
  // grows with the library: a deck and its note
  { name: 'decks', kinds: ['deck', 'objective'], late: false },
  // grows with every recorded event: an event and its rounds stay in one file
  { name: 'events', kinds: ['event', 'round'], late: false, unit: 'event' },
  // refitted after every event
  { name: 'ratings', kinds: ['rating', 'matchup'], late: false },
  { name: 'cardstat', kinds: ['cardstat'], late: true },
  { name: 'pkgstat', kinds: ['pkgstat'], late: true },
];

/** Every kind the site ships. */
export const SITE_KINDS: readonly KbKind[] = SITE_GROUPS.flatMap((s) => s.kinds);
/** The kinds never shipped: the FAQ paraphrases (D2), docs and code (for contributors), and the local kinds. */
export const SITE_LEFT_OUT: readonly KbKind[] = KB_KINDS.filter((k) => !SITE_KINDS.includes(k));

/**
 * The fields a shard keeps: the ones a result's link and its stale mark need. The rest are exact numbers for the
 * command line (`npm run kb -- fact`); the text already says them in words.
 */
export const SITE_FIELDS: readonly string[] = ['deck', 'deckFile', 'event', 'file', 'guide', 'stale', 'vocabulary'];

/** A record as a shard holds it: no source path, scope or hash; only SITE_FIELDS; links only to shipped records. */
export type SiteRecord = Pick<KbRecord, 'id' | 'kind' | 'title' | 'aliases' | 'text' | 'fields' | 'links' | 'origin' | 'status' | 'stamps'>;

export interface SiteShard {
  kind: typeof SITE_SHARD_KIND;
  schema: typeof SITE_SCHEMA;
  name: string;
  records: SiteRecord[];
}

/** A part file as the build writes it (the manifest names it by content hash). */
export interface SiteShardFile {
  /** the part's name, `<group>-<part>` (`events-1`); the file carries it */
  name: string;
  group: string;
  /** from 1, in packing order */
  part: number;
  late: boolean;
  records: number;
  /** hashText of `json`: the file name carries it, so a deploy never mixes versions */
  hash: string;
  json: string;
}

/** What the page needs to fetch the parts (the Vite plugin's virtual module `virtual:nct-kb-site`). */
export interface SiteManifest {
  kind: typeof SITE_MANIFEST_KIND;
  schema: typeof SITE_SCHEMA;
  /** hashText over the part hashes, in order */
  pack: string;
  /** every part file, group by group in plan order, each group's parts in order */
  parts: { name: string; group: string; late: boolean; records: number; bytes: number; hash: string; url: string }[];
}

/** How the build weighs a file (gzip bytes in the build, any measure in a test) and the most one file may weigh. */
export interface SiteSizing {
  size: (json: string) => number;
  cap: number;
}

/** The records the site ships, from a built pack: public, of SITE_KINDS, never from data/raw. */
export function siteRecords(records: readonly KbRecord[]): KbRecord[] {
  return records.filter((r) => r.scope === 'public' && SITE_KINDS.includes(r.kind) && !r.source.file.startsWith('data/raw/')).sort((a, b) => byString(a.id, b.id));
}

function slim(r: KbRecord, shipped: ReadonlySet<string>): SiteRecord {
  const fields: Record<string, KbFieldValue> = {};
  for (const k of SITE_FIELDS) if (r.fields && Object.prototype.hasOwnProperty.call(r.fields, k)) fields[k] = r.fields[k]!;
  const links = r.links.filter((l) => shipped.has(l.to));
  return {
    id: r.id,
    kind: r.kind,
    title: r.title,
    ...(r.aliases?.length ? { aliases: r.aliases } : {}),
    text: r.text,
    ...(Object.keys(fields).length ? { fields } : {}),
    links,
    origin: r.origin,
    ...(r.status ? { status: r.status } : {}),
    ...(r.stamps ? { stamps: r.stamps } : {}),
  };
}

/** One part as the packing made it: the units it holds and its file's text. */
export interface PackedPart<T> {
  units: (readonly T[])[];
  json: string;
}

/**
 * Cut `units` (each a list of items that stay in one file) into parts, in order: each part takes the most whole units
 * from where the last one stopped whose file (`render(items, part number)`) weighs at most `cap` by `size`. A part is
 * closed when the next unit does not fit, so every part but the last depends only on its own units and the one after
 * it: adding units at the end never changes a closed part (as long as a file grows when a unit is added to it, which
 * gzip does in practice). The boundary is found with few measurements: the whole rest first, then doubling and halving
 * (about 2 log2(n) for a part of n units), never one after every unit. A unit too large for a part of its own is an
 * error that names it (`label`). Deterministic for a given `size` (rule M8).
 */
export function packParts<T>(units: readonly (readonly T[])[], render: (items: readonly T[], part: number) => string, sizing: SiteSizing, label: (unit: readonly T[]) => string): PackedPart<T>[] {
  const out: PackedPart<T>[] = [];
  let start = 0;
  while (start < units.length) {
    const part = out.length + 1;
    const rest = units.length - start;
    const tried = new Map<number, string | null>();
    const fits = (n: number): boolean => {
      if (!tried.has(n)) {
        const json = render(units.slice(start, start + n).flat(), part);
        tried.set(n, sizing.size(json) <= sizing.cap ? json : null);
      }
      return tried.get(n) !== null;
    };
    if (!fits(1)) {
      const json = render(units[start]!, part);
      throw new Error(`${label(units[start]!)} weighs ${sizing.size(json)} bytes on its own, over the per-file cap of ${sizing.cap}: it cannot go in any part file. Raise the cap on purpose, or make it smaller.`);
    }
    let lo = 1;
    if (rest > 1 && !fits(rest)) {
      // lo fits, hi does not: double from 1 until a count does not fit, then halve the gap
      let hi = rest;
      for (let n = 2; n < rest; n *= 2) {
        if (!fits(n)) {
          hi = n;
          break;
        }
        lo = n;
      }
      while (hi - lo > 1) {
        const mid = (lo + hi) >> 1;
        if (fits(mid)) lo = mid;
        else hi = mid;
      }
    } else lo = rest;
    out.push({ units: units.slice(start, start + lo), json: tried.get(lo)! });
    start += lo;
  }
  return out;
}

/** The event number a record of the events group belongs to (its `event` field). */
function eventOf(r: KbRecord): number {
  const e = r.fields?.event;
  if (typeof e !== 'number' || !Number.isFinite(e)) throw new Error(`${r.id} has no event number: an event or round record must name its event`);
  return e;
}

/** A group's records cut into units: one per event (in event order) for the events group, else one per record (id order). */
function unitsOf(plan: SiteGroupPlan, recs: readonly SiteRecord[], source: ReadonlyMap<string, KbRecord>): SiteRecord[][] {
  if (plan.unit !== 'event') return recs.map((r) => [r]);
  const byEvent = new Map<number, SiteRecord[]>();
  for (const r of recs) {
    const e = eventOf(source.get(r.id)!);
    const list = byEvent.get(e) ?? [];
    list.push(r);
    byEvent.set(e, list);
  }
  return [...byEvent.keys()].sort((a, b) => a - b).map((e) => byEvent.get(e)!);
}

const partJson = (group: string, part: number, records: readonly SiteRecord[]): string => {
  const shard: SiteShard = { kind: SITE_SHARD_KIND, schema: SITE_SCHEMA, name: `${group}-${part}`, records: [...records].sort((a, b) => byString(a.id, b.id)) };
  return JSON.stringify(shard);
};

/**
 * The part files for a built pack, group by group in plan order (same records, same bytes for the same measure: rule
 * M8). Every file weighs at most `sizing.cap` by `sizing.size`; a group with no records has no part. Records in a file
 * are in id order.
 */
export function siteShardFiles(records: readonly KbRecord[], sizing: SiteSizing): SiteShardFile[] {
  const recs = siteRecords(records);
  const shipped = new Set(recs.map((r) => r.id));
  const source = new Map(recs.map((r) => [r.id, r]));
  return SITE_GROUPS.flatMap((plan) => {
    const units = unitsOf(
      plan,
      recs.filter((r) => plan.kinds.includes(r.kind)).map((r) => slim(r, shipped)),
      source,
    );
    const label = (u: readonly SiteRecord[]) => (plan.unit === 'event' ? `Event ${eventOf(source.get(u[0]!.id)!)} with its rounds (${u.length} records)` : `The record ${u[0]!.id}`);
    return packParts(units, (items, part) => partJson(plan.name, part, items), sizing, label).map((p, i) => ({
      name: `${plan.name}-${i + 1}`,
      group: plan.name,
      part: i + 1,
      late: plan.late,
      records: p.units.reduce((n, u) => n + u.length, 0),
      hash: hashText(p.json),
      json: p.json,
    }));
  });
}

/** A part's file name: `kb-<group>-<part>-<hash>.json`. */
export const shardFileName = (f: Pick<SiteShardFile, 'name' | 'hash'>): string => `kb-${f.name}-${f.hash}.json`;

/** The manifest for part files; `url(file)` says where each is served from (relative to the site's base). */
export function siteManifest(files: readonly SiteShardFile[], url: (f: SiteShardFile) => string): SiteManifest {
  return {
    kind: SITE_MANIFEST_KIND,
    schema: SITE_SCHEMA,
    pack: hashText(files.map((f) => f.hash).join(' ')),
    parts: files.map((f) => ({ name: f.name, group: f.group, late: f.late, records: f.records, bytes: utf8Bytes(f.json), hash: f.hash, url: url(f) })),
  };
}

/** The size of a string in UTF-8 bytes (what the file weighs). */
export const utf8Bytes = (s: string): number => new TextEncoder().encode(s).length;

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** Read a shard file back into records (scope public; no source or hash). Throws on anything that is not one. */
export function parseShard(text: string, expect?: { name: string }): KbRecord[] {
  const s = JSON.parse(text) as unknown;
  if (!isObj(s) || s.kind !== SITE_SHARD_KIND || s.schema !== SITE_SCHEMA || !Array.isArray(s.records)) throw new Error('not a knowledge pack shard');
  if (expect && s.name !== expect.name) throw new Error(`expected shard ${expect.name}, got ${String(s.name)}`);
  return (s.records as unknown[]).map((x, i) => {
    if (!isObj(x) || typeof x.id !== 'string' || typeof x.title !== 'string' || typeof x.text !== 'string' || !Array.isArray(x.links) || !SITE_KINDS.includes(x.kind as KbKind)) throw new Error(`shard record ${i + 1} is not a record`);
    const r = x as unknown as SiteRecord;
    return { ...r, links: r.links as KbLink[], source: { file: '' }, scope: 'public', hash: '' } satisfies KbRecord;
  });
}

/**
 * The late groups a question needs (their names; every part of each is loaded), read the way the search reads it: a
 * statistics kind it asks for by a cue word ("stats", "statistics", "telemetry"), or by naming a card or package beside
 * a word of STAT_WORDS (statsIntent). `ix` may be built without the late groups: the names it looks for are cards and
 * packages.
 */
export function lateShardsFor(ix: KbIndex, query: string): string[] {
  const exact = rankExactHits(ix, query, { deckShortNames: SEARCH_TUNING.deckShortNames, packageShortNames: SEARCH_TUNING.statsIntent }).map((h) => h.id);
  const cued = cuedKinds(query);
  if (SEARCH_TUNING.statsIntent) for (const k of statKinds(ix, query, exact)) cued.add(k);
  const kinds = STAT_KINDS.filter((k) => cued.has(k));
  return SITE_GROUPS.filter((s) => s.late && s.kinds.some((k) => kinds.includes(k))).map((s) => s.name);
}

// ---------------------------------------------------------------- what a result shows

/** Questions the page offers on an empty box and after "no match" (each answered by the pack: tests/kb-site.test.ts). */
export const SITE_EXAMPLES: readonly string[] = ['What does Blocker do?', 'Which decks play Detonate?', 'Who won event 20?'];

/** What each kind is, in a plain word. */
export const KIND_LABEL: Readonly<Partial<Record<KbKind, string>>> = {
  card: 'Card',
  deck: 'Deck',
  objective: 'Game plan',
  package: 'Synergy package',
  term: 'Glossary',
  guide: 'Guide',
  event: 'Event',
  round: 'Round',
  rating: 'Rating',
  matchup: 'Matchup',
  cardstat: 'Card statistics',
  pkgstat: 'Package statistics',
};

/** Where a result leads: the card dialog, a page of the site, or nowhere (the thing has no page of its own). */
export type SiteLink = { to: 'card'; cardId: string; label: string } | { to: 'page'; href: string; label: string } | null;

const field = (r: KbRecord, k: string): string | undefined => {
  const v = r.fields?.[k];
  return typeof v === 'string' && v ? v : typeof v === 'number' ? String(v) : undefined;
};
const q = (k: string, v: string) => `${k}=${encodeURIComponent(v)}`;
const deckPage = (file: string | undefined): SiteLink => (file ? { to: 'page', href: `#/deck?${q('d', file)}`, label: 'Deck profile' } : null);
const key = (id: string) => id.slice(id.indexOf(':') + 1);

/** The site's page for a record (routes as in src/App.tsx). */
export function siteLink(r: KbRecord): SiteLink {
  switch (r.kind) {
    case 'card':
      return { to: 'card', cardId: key(r.id), label: 'Card' };
    case 'deck':
      return deckPage(field(r, 'file'));
    case 'objective': {
      const l = deckPage(field(r, 'deck'));
      return l && { ...l, label: 'Game plan on the deck profile' };
    }
    case 'package':
      return { to: 'page', href: '#/insights?v=synergies', label: 'Card stats: Synergies' };
    case 'term':
      // the signal and condition vocabularies are not on a page of their own
      return field(r, 'vocabulary') ? null : { to: 'page', href: `#/glossary?${q('q', r.title)}`, label: 'Glossary' };
    case 'guide': {
      const g = field(r, 'guide');
      return g ? { to: 'page', href: `#/guides?${q('g', g)}`, label: 'Strategy guide' } : null;
    }
    case 'event':
    case 'round': {
      const e = field(r, 'event');
      return e ? { to: 'page', href: `#/tournaments?${q('e', e)}`, label: 'Event page' } : null;
    }
    case 'rating':
      return { to: 'page', href: '#/ratings', label: 'Power ratings' };
    case 'matchup': {
      // the deck profile shows its matchups; the first deck of the pair (in id order)
      const d = r.links.find((l) => l.rel === 'deck');
      return d ? { to: 'page', href: `#/deck?${q('d', `${key(d.to)}.txt`)}`, label: 'Matchups on the deck profile' } : null;
    }
    case 'cardstat': {
      // Card stats → Decisions, opened on the list (by its name, as the page's `?d=` takes it); pooled: no list
      const deck = field(r, 'deck');
      return { to: 'page', href: `#/insights?${deck ? `${q('d', deck)}&` : ''}v=decisions`, label: 'Card stats: Decisions' };
    }
    case 'pkgstat': {
      // a package on one list: the deck profile's "Synergies in this list" (the Card stats page covers fewer lists);
      // pooled over lists: Card stats → Synergies
      const l = deckPage(field(r, 'file'));
      return l ? { ...l, label: 'Synergies on the deck profile' } : { to: 'page', href: '#/insights?v=synergies', label: 'Card stats: Synergies' };
    }
    default:
      return null;
  }
}

/** A short excerpt: the text near the question's first word, at most `max` characters. */
export const siteExcerpt = (r: KbRecord, query: string, max = 220): string => snippet(r.text, query, max);

/** What a measured record rests on, in plain words ("The hard bot's games on sim version 8, recorded 2026-11-12."). */
export function basisLine(r: KbRecord): string | null {
  if (r.origin !== 'measured') return null;
  const s = r.stamps ?? {};
  const parts = [s.bot ? `the ${s.bot} bot's games` : 'the bots’ games', ...(s.simVersion !== undefined ? [`on sim version ${s.simVersion}`] : [])];
  const date = s.asOf ? `, recorded ${s.asOf.slice(0, 10)}` : '';
  return `Measured from ${parts.join(' ')}${date}.`;
}

/** The record's own "association, not value" sentence (statistics records), else null. */
export function associationLine(r: KbRecord): string | null {
  if (r.kind !== 'cardstat' && r.kind !== 'pkgstat') return null;
  const m = /[^.\n]*\bassociations?\b[^.\n]*\./i.exec(r.text);
  return m ? m[0].trim() : 'An association in the bot’s own games, not the value of the card and not advice.';
}

/** Whether a record is marked stale (measured on an older sim version than the current one). */
export const isStale = (r: KbRecord): boolean => r.fields?.stale === true;
