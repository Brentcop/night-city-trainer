// Knowledge pack on the site (docs/RAG_PLAN.md step 3): which records the site ships, how they are cut into shards, and
// what the search page shows for each. Pure, like the rest of the core (rule M7): the build side (tools/kb-site.ts,
// run by the Vite plugin in vite.config.ts) and the browser (siteSearch.ts, the Search page) share it.
// What ships: the public records of twelve kinds. Left out on purpose: the FAQ paraphrases (`ruling`, decision D2 is
// still open), the contributors' docs and code headers (`doc`, `code`), and every local record (data/raw, rule M6).
// No text is written by a model: every record is a template sentence or the site's own content (decision D3).
// Shards: the six authored kinds and the four tournament kinds load with the first search (the keyword ranker counts
// the tournament kinds' words, so the ranking needs them from the start); each statistics kind loads only when a
// question asks for it (`lateShardsFor`). The statistics kinds are left out of the keyword ranker's word counts
// (search.ts STATS_FREE_KINDS) and are found only when asked for, so a search without them ranks every other record
// exactly as the full pack does (tests/kb-site.test.ts checks it).
import { snippet } from './render';
import { cuedKinds, rankExactHits, SEARCH_TUNING, STAT_KINDS, statKinds, type KbIndex } from './search';
import { byString, hashText, KB_KINDS, type KbFieldValue, type KbKind, type KbLink, type KbRecord } from './types';

export const SITE_SHARD_KIND = 'nct-kb-shard';
export const SITE_MANIFEST_KIND = 'nct-kb-site';
export const SITE_SCHEMA = 1;

export interface SiteShardPlan {
  name: string;
  kinds: readonly KbKind[];
  /** loaded only when a question asks for its kinds (false: with the first search) */
  late: boolean;
}

export const SITE_SHARDS: readonly SiteShardPlan[] = [
  { name: 'core', kinds: ['card', 'deck', 'objective', 'package', 'term', 'guide'], late: false },
  { name: 'events', kinds: ['event', 'round', 'rating', 'matchup'], late: false },
  { name: 'cardstat', kinds: ['cardstat'], late: true },
  { name: 'pkgstat', kinds: ['pkgstat'], late: true },
];

/** Every kind the site ships. */
export const SITE_KINDS: readonly KbKind[] = SITE_SHARDS.flatMap((s) => s.kinds);
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

/** A shard file as the build writes it (the manifest names it by content hash). */
export interface SiteShardFile {
  name: string;
  kinds: readonly KbKind[];
  late: boolean;
  records: number;
  /** hashText of `json`: the file name carries it, so a deploy never mixes versions */
  hash: string;
  json: string;
}

/** What the page needs to fetch the shards (the Vite plugin's virtual module `virtual:nct-kb-site`). */
export interface SiteManifest {
  kind: typeof SITE_MANIFEST_KIND;
  schema: typeof SITE_SCHEMA;
  /** hashText over the shard hashes, in order */
  pack: string;
  shards: { name: string; kinds: readonly KbKind[]; late: boolean; records: number; bytes: number; hash: string; url: string }[];
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

/** The shard files for a built pack (same records, same bytes: rule M8). */
export function siteShardFiles(records: readonly KbRecord[]): SiteShardFile[] {
  const recs = siteRecords(records);
  const shipped = new Set(recs.map((r) => r.id));
  return SITE_SHARDS.map((plan) => {
    const shard: SiteShard = { kind: SITE_SHARD_KIND, schema: SITE_SCHEMA, name: plan.name, records: recs.filter((r) => plan.kinds.includes(r.kind)).map((r) => slim(r, shipped)) };
    const json = JSON.stringify(shard);
    return { name: plan.name, kinds: plan.kinds, late: plan.late, records: shard.records.length, hash: hashText(json), json };
  });
}

/** A shard's file name: `kb-<name>-<hash>.json`. */
export const shardFileName = (f: Pick<SiteShardFile, 'name' | 'hash'>): string => `kb-${f.name}-${f.hash}.json`;

/** The manifest for shard files; `url(file)` says where each is served from (relative to the site's base). */
export function siteManifest(files: readonly SiteShardFile[], url: (f: SiteShardFile) => string): SiteManifest {
  return {
    kind: SITE_MANIFEST_KIND,
    schema: SITE_SCHEMA,
    pack: hashText(files.map((f) => f.hash).join(' ')),
    shards: files.map((f) => ({ name: f.name, kinds: f.kinds, late: f.late, records: f.records, bytes: utf8Bytes(f.json), hash: f.hash, url: url(f) })),
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
 * The late shards a question needs, read the way the search reads it: a statistics kind it asks for by a cue word
 * ("stats", "statistics", "telemetry"), or by naming a card or package beside a word of STAT_WORDS (statsIntent).
 * `ix` may be built without the late shards: the names it looks for are cards and packages.
 */
export function lateShardsFor(ix: KbIndex, query: string): string[] {
  const exact = rankExactHits(ix, query, { deckShortNames: SEARCH_TUNING.deckShortNames, packageShortNames: SEARCH_TUNING.statsIntent }).map((h) => h.id);
  const cued = cuedKinds(query);
  if (SEARCH_TUNING.statsIntent) for (const k of statKinds(ix, query, exact)) cued.add(k);
  const kinds = STAT_KINDS.filter((k) => cued.has(k));
  return SITE_SHARDS.filter((s) => s.late && s.kinds.some((k) => kinds.includes(k))).map((s) => s.name);
}

// ---------------------------------------------------------------- what a result shows

/** Questions the page offers on an empty box and after "no match" (each answered by the pack: tests/kb-site.test.ts). */
export const SITE_EXAMPLES: readonly string[] = ['What does Blocker do?', 'Which decks play Detonate?', 'Who won event 7?'];

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
