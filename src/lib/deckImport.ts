// Importing decks from shared links (docs/DECK_IMPORT.md): everything about an import that is not fetching. The owner's
// script (tools/import_decks.py) reads public pages on choom.gg and cyberpunk-tcg-sim.online and writes one JSON
// document (`kind: 'nct-deck-import'`, `schema: 1`) with each card as the site wrote it; this module reads that
// document as untrusted input, matches every card reference to this project's cards (never guessing), builds and
// checks each deck, says whether the library or this browser already has its list, decodes the deck-builder links
// that carry their whole list in the address, sorts pasted links, and writes a deck in the library's file format.
// The admin page (#/admin, components/AdminDeckImport.tsx) and the command-line step (scripts/import-links.ts) both use
// it. Pure. A deck's name and author are other people's text: cleaned and capped here, shown as text only, never run
// through the card-name matcher (src/lib/cardMentions.ts).
import { CARDS, CARD_BY_ID, cardLabel } from '../engine/cards';
import { exportChoom, listFingerprint, validateDeck } from '../engine/deck';
import type { CardDef, DeckList } from '../engine/types';
import { distinctLists, type Listed } from './distinctLists';
import { IMPORT_NO_AUTHOR, IMPORT_ORIGIN, libraryDeck } from './library';
import { cleanText } from './cleanText';
import { nameKey } from './cardNameKey';

export const IMPORT_KIND = 'nct-deck-import';
export const IMPORT_SCHEMA = 1;
/** Where the script writes by default (the folder it runs in: the repository's root). */
export const IMPORT_FILE = 'deck-import.json';
export const SCRIPT = 'tools/import_decks.py';

/** The most an import document may hold; more is cut off (and said), a larger file is refused. */
export const IMPORT_LIMITS = { chars: 2_000_000, decks: 200, links: 200, refs: 60, refText: 120, name: 80, author: 60, title: 160, link: 2000, placement: 40, note: 200, notes: 8, count: 50 } as const;

export const SITES = { 'choom.gg': 'choom.gg', 'www.choom.gg': 'choom.gg', 'cyberpunk-tcg-sim.online': 'cyberpunk-tcg-sim.online', 'www.cyberpunk-tcg-sim.online': 'cyberpunk-tcg-sim.online' } as const;
export type Site = (typeof SITES)[keyof typeof SITES];

/** How a site wrote a card: a card id ("cb-…"), a compact code ("w2s", "w5-a") or a name ("Name — Subname"). */
export type RefBy = 'id' | 'code' | 'name';
export interface CardRef {
  ref: string;
  by?: RefBy;
  /** a second way to match the same card: the name the site shows beside its id */
  name?: string;
  count: number;
}

export interface DeckSourceInfo {
  site: Site | '';
  /** the deck's own link (a choom.gg deck page or a deck-builder link) */
  link: string;
  /** the title of the page the deck was found on, and its address */
  page: string;
  pageLink: string;
  /** a tournament placement, as the site wrote it ("1st", "Season-1 #2") */
  placement: string;
  /** the page's publication date, when it gave one */
  date: string;
}

/** One deck as a site wrote it. */
export interface RawDeck {
  name: string;
  author: string;
  source: DeckSourceInfo;
  legends: CardRef[];
  main: CardRef[];
  sideboard: CardRef[];
  /** parts of the link or page that were not understood */
  notes: string[];
}

export interface LinkReport {
  link: string;
  status: string;
  decks: number;
  note: string;
}

export interface ImportDoc {
  kind: typeof IMPORT_KIND;
  schema: typeof IMPORT_SCHEMA;
  ran: string;
  links: LinkReport[];
  decks: RawDeck[];
}

// ---------------------------------------------------------------- links

/** The site a link is on, or null. */
export function siteOf(u: URL): Site | null {
  return (SITES as Record<string, Site>)[u.hostname.toLowerCase()] ?? null;
}

/** A link on one of the two sites, cleaned for showing and linking to (http/https only), or '' when it is not one. */
export function safeLink(v: unknown): string {
  const s = cleanText(v, IMPORT_LIMITS.link);
  if (!s) return '';
  try {
    const u = new URL(s);
    return (u.protocol === 'https:' || u.protocol === 'http:') && siteOf(u) ? u.href : '';
  } catch {
    return '';
  }
}

const DECK_PAGE = /^\/decks\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/;
/** A compact card code: the set's first letter, the print number in base 36, and the number's letter ("w5-a" is 005a). */
const CODE = /^([a-z])([0-9a-z]{1,4})(?:-([a-z]{1,2}))?$/;
const PLACEMENT = /\(([^()]{1,40})\)\s*$/;
const PLAYER_EVENT = /^(.{1,60}?) - (.+)$/;

/** The author and placement a deck-builder link's name carries: "PLAYER - EVENT (1st)", or "A / B / C (Season-1 #2)". */
export function splitDeckName(name: string): { author: string; placement: string } {
  const placement = name.match(PLACEMENT)?.[1]?.trim() ?? '';
  const author = placement ? (name.match(PLAYER_EVENT)?.[1]?.trim() ?? '') : '';
  return { author, placement };
}

const emptyRaw = (site: Site | '', link: string): RawDeck => ({
  name: '',
  author: '',
  source: { site, link, page: '', pageLink: '', placement: '', date: '' },
  legends: [],
  main: [],
  sideboard: [],
  notes: [],
});

function countsList(value: string, notes: string[]): CardRef[] {
  const out: CardRef[] = [];
  for (const part of value.split(',').map((p) => p.trim()).filter(Boolean)) {
    const i = part.lastIndexOf(':');
    const ref = part.slice(0, i);
    const n = part.slice(i + 1);
    if (i <= 0 || !/^\d{1,2}$/.test(n) || +n < 1 || +n > IMPORT_LIMITS.count) notes.push(`part not understood: ${part.slice(0, 60)}`);
    else out.push({ ref, by: 'id', count: +n });
  }
  return out;
}

function compactList(code: string, notes: string[]): Pick<RawDeck, 'legends' | 'main' | 'sideboard'> {
  const sections = { l: 'legends', d: 'main', s: 'sideboard' } as const;
  const out: Pick<RawDeck, 'legends' | 'main' | 'sideboard'> = { legends: [], main: [], sideboard: [] };
  let at: (typeof sections)[keyof typeof sections] | null = null;
  for (const token of code.split('.')) {
    if (token in sections) {
      at = sections[token as keyof typeof sections];
      continue;
    }
    if (/^[a-z]$/.test(token)) {
      at = null; // a section this reader does not know: its parts are noted, not read
      notes.push(`section not understood: ${token}`);
      continue;
    }
    if (at === 'legends' && CODE.test(token)) {
      out.legends.push({ ref: token, by: 'code', count: 1 });
      continue;
    }
    const m = token.match(/^(\d{1,2})_(.+)$/);
    if ((at === 'main' || at === 'sideboard') && m && CODE.test(m[2]!) && +m[1]! >= 1 && +m[1]! <= IMPORT_LIMITS.count) {
      out[at].push({ ref: m[2]!, by: 'code', count: +m[1]! });
      continue;
    }
    notes.push(`part not understood: ${token.slice(0, 60)}`);
  }
  return out;
}

const isDeckBuilder = (u: URL) => siteOf(u) === 'cyberpunk-tcg-sim.online' && u.pathname.replace(/\/+$/, '') === '/deck-builder' && u.search.length > 1;

/**
 * A cyberpunk-tcg-sim.online deck-builder link read from its address alone: `?deck=cb-<id>:<n>,…&sideboard=…&name=…`
 * (the first three entries of `deck` are the Legends) or the compact `?deck=saved-…&d=l.<code>….d.<n>_<code>….s.…`
 * (no name). The same reading as tools/import_decks.py (decode_deck_builder), pinned on the same links by both tests.
 */
export function decodeDeckBuilder(u: URL): { deck: RawDeck } | { why: string } {
  const q = u.searchParams;
  const deck = emptyRaw('cyberpunk-tcg-sim.online', u.href);
  const d = q.get('d') ?? '';
  const ids = q.get('deck') ?? '';
  if (d) Object.assign(deck, compactList(d, deck.notes));
  else if (ids.startsWith('cb-')) {
    const refs = countsList(ids, deck.notes);
    deck.legends = refs.slice(0, 3);
    deck.main = refs.slice(3);
    deck.sideboard = countsList(q.get('sideboard') ?? '', deck.notes);
  } else return { why: 'This deck-builder link carries no list (it names a deck saved in someone’s browser). Ask for a link with the list in it.' };
  deck.name = cleanText(q.get('name') ?? '', IMPORT_LIMITS.name);
  const { author, placement } = splitDeckName(deck.name);
  deck.author = cleanText(author, IMPORT_LIMITS.author);
  deck.source.placement = cleanText(placement, IMPORT_LIMITS.placement);
  if (!deck.legends.length && !deck.main.length) return { why: 'This deck-builder link has no cards in it.' };
  return { deck };
}

export type SortedLink =
  | { link: string; kind: 'decoded'; deck: RawDeck; why: string }
  | { link: string; kind: 'script'; why: string }
  | { link: string; kind: 'refused'; why: string };

export const SITES_WORDS = 'This tool reads only choom.gg and cyberpunk-tcg-sim.online.';

/**
 * A choom.gg path its robots rules keep automated readers out of (/api/ and /admin), compared the way a server would
 * read it: percent-escapes undone, repeated slashes as one, any letter case (`URL` has already taken the "." and ".."
 * steps). The same rule as site_of in tools/import_decks.py, which is the one that decides what is requested.
 */
export function keptOut(pathname: string): boolean {
  const p = serverPath(pathname);
  return p === '/api' || p.startsWith('/api/') || p.startsWith('/admin');
}

/** The same for cyberpunk-tcg-sim.online, whose robots rules (read 2026-11-18) keep every reader out of /api/, /dashboard and /metrics. */
export function simKeptOut(pathname: string): boolean {
  const p = serverPath(pathname);
  return p === '/api' || p.startsWith('/api/') || p.startsWith('/dashboard') || p.startsWith('/metrics');
}

function serverPath(pathname: string): string {
  let p = pathname;
  try {
    p = decodeURIComponent(p);
  } catch {
    // a malformed escape: compared as written
  }
  return p.replace(/\/+/g, '/').toLowerCase();
}

/** One pasted link: decoded here and now, needs the script (a page on one of the two sites), or refused, with why. */
export function sortLink(text: string): SortedLink {
  const link = cleanText(text, IMPORT_LIMITS.link);
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(link) ? link : `https://${link}`);
  } catch {
    return { link, kind: 'refused', why: 'This is not a link.' };
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return { link, kind: 'refused', why: 'This is not a web link (it should start with https://).' };
  const site = siteOf(u);
  if (!site) return { link, kind: 'refused', why: `${SITES_WORDS} This link is on ${u.hostname || 'another site'}.` };
  const path = u.pathname;
  if (site === 'choom.gg' && keptOut(path))
    return { link: u.href, kind: 'refused', why: 'choom.gg asks automated readers to stay out of /api/ and /admin, so neither this page nor the script reads them.' };
  if (site === 'cyberpunk-tcg-sim.online' && simKeptOut(path))
    return { link: u.href, kind: 'refused', why: 'cyberpunk-tcg-sim.online asks automated readers to stay out of /api/, /dashboard and /metrics, so neither this page nor the script reads them.' };
  if (isDeckBuilder(u)) {
    const r = decodeDeckBuilder(u);
    if ('why' in r) return { link: u.href, kind: 'refused', why: r.why };
    return { link: u.href, kind: 'decoded', deck: r.deck, why: 'The list is in the link itself: read here, nothing fetched.' };
  }
  if (site === 'choom.gg' && DECK_PAGE.test(path)) return { link: u.href, kind: 'script', why: 'A choom.gg deck page: the list is on the page, so the script reads it.' };
  return { link: u.href, kind: 'script', why: `A page on ${site}: the script reads it and every deck linked from it (up to its limit).` };
}

/** Every link in a pasted text (one per line or separated by spaces), each once. */
export function sortLinks(text: string): SortedLink[] {
  const seen = new Set<string>();
  const out: SortedLink[] = [];
  for (const token of text.split(/\s+/).filter(Boolean).slice(0, IMPORT_LIMITS.links)) {
    const s = sortLink(token);
    if (seen.has(s.link)) continue;
    seen.add(s.link);
    out.push(s);
  }
  return out;
}

/** A link written inside double quotes on a command line: characters a shell would read are percent-encoded. */
const quoted = (link: string) => `"${link.replace(/[`$!"\\]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase().padStart(2, '0')}`)}"`;

/** The command that reads these links, run from the repository's folder. */
export function scriptCommand(links: readonly string[], out: string = IMPORT_FILE): string {
  return ['python', SCRIPT, ...links.map(quoted), ...(out === IMPORT_FILE ? [] : ['--out', out])].join(' ');
}

// ---------------------------------------------------------------- reading an import document (untrusted)

export type ReadResult = { ok: true; doc: ImportDoc; warnings: string[] } | { ok: false; why: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max: number) => cleanText(v, max);

function readRef(v: unknown, notes: string[]): CardRef | null {
  if (!isObj(v)) return null;
  const ref = text(v.ref, IMPORT_LIMITS.refText);
  const count = v.count;
  if (!ref) return null;
  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > IMPORT_LIMITS.count) {
    notes.push(`left out ${ref}: its count is not a whole number from 1 to ${IMPORT_LIMITS.count}`);
    return null;
  }
  const out: CardRef = { ref, count };
  if (v.by === 'id' || v.by === 'code' || v.by === 'name') out.by = v.by;
  const name = text(v.name, IMPORT_LIMITS.refText);
  if (name) out.name = name;
  return out;
}

function readRefs(v: unknown, notes: string[], what: string): CardRef[] {
  if (!Array.isArray(v)) return [];
  if (v.length > IMPORT_LIMITS.refs) notes.push(`the ${what} had ${v.length} entries; only the first ${IMPORT_LIMITS.refs} were read`);
  return v
    .slice(0, IMPORT_LIMITS.refs)
    .map((r) => readRef(r, notes))
    .filter((r): r is CardRef => r !== null);
}

/** One deck of an import document, every field checked and every string cleaned and capped (null when it is no deck). */
export function readRawDeck(v: unknown): RawDeck | null {
  if (!isObj(v)) return null;
  const s = isObj(v.source) ? v.source : {};
  const link = safeLink(s.link);
  let site: Site | '' = '';
  try {
    site = link ? (siteOf(new URL(link)) ?? '') : '';
  } catch {
    site = '';
  }
  const notes = Array.isArray(v.notes) ? v.notes.slice(0, IMPORT_LIMITS.notes).map((n) => text(n, IMPORT_LIMITS.note)).filter(Boolean) : [];
  const deck: RawDeck = {
    name: text(v.name, IMPORT_LIMITS.name),
    author: text(v.author, IMPORT_LIMITS.author),
    source: {
      site,
      link,
      page: text(s.page, IMPORT_LIMITS.title),
      pageLink: safeLink(s.pageLink),
      placement: text(s.placement, IMPORT_LIMITS.placement),
      date: typeof s.date === 'string' && s.date.length <= 40 && !Number.isNaN(Date.parse(s.date)) ? s.date : '',
    },
    legends: readRefs(v.legends, notes, 'Legends'),
    main: readRefs(v.main, notes, 'main deck'),
    sideboard: readRefs(v.sideboard, notes, 'sideboard'),
    notes,
  };
  if (!deck.legends.length && !deck.main.length) return null;
  return deck;
}

/** An import document read back as untrusted input: refused with one sentence, or read with what was left out. */
export function readImportValue(v: unknown): ReadResult {
  if (!isObj(v)) return { ok: false, why: 'This file is not a deck-import file (it holds no JSON object).' };
  if (v.kind !== IMPORT_KIND) return { ok: false, why: `This is not a deck-import file from ${SCRIPT} (its kind is ${typeof v.kind === 'string' ? `“${text(v.kind, 40)}”` : 'missing'}).` };
  if (typeof v.schema !== 'number' || !Number.isInteger(v.schema) || v.schema < 1) return { ok: false, why: 'This deck-import file has no readable schema number.' };
  if (v.schema > IMPORT_SCHEMA) return { ok: false, why: `This deck-import file was written by a newer version of the script (schema ${v.schema}; this page reads ${IMPORT_SCHEMA}). Update the site, or use the script that came with it.` };
  const warnings: string[] = [];
  const decksIn = Array.isArray(v.decks) ? v.decks : [];
  if (decksIn.length > IMPORT_LIMITS.decks) warnings.push(`The file has ${decksIn.length} decks; only the first ${IMPORT_LIMITS.decks} were read.`);
  const decks: RawDeck[] = [];
  decksIn.slice(0, IMPORT_LIMITS.decks).forEach((d) => {
    const r = readRawDeck(d);
    if (r) decks.push(r);
  });
  const dropped = Math.min(decksIn.length, IMPORT_LIMITS.decks) - decks.length;
  if (dropped > 0) warnings.push(`${dropped === 1 ? 'One entry was' : `${dropped} entries were`} left out: not a deck this page can read.`);
  const links: LinkReport[] = (Array.isArray(v.links) ? v.links : []).slice(0, IMPORT_LIMITS.links).flatMap((l) => {
    if (!isObj(l)) return [];
    const decks = typeof l.decks === 'number' && Number.isInteger(l.decks) && l.decks >= 0 && l.decks <= 10_000 ? l.decks : 0;
    return [{ link: text(l.link, IMPORT_LIMITS.link), status: text(l.status, 20), decks, note: text(l.note, 2 * IMPORT_LIMITS.note) }];
  });
  const ran = typeof v.ran === 'string' && v.ran.length <= 40 && !Number.isNaN(Date.parse(v.ran)) ? v.ran : '';
  return { ok: true, doc: { kind: IMPORT_KIND, schema: IMPORT_SCHEMA, ran, links, decks }, warnings };
}

/** The text of an import file read back (never throws). */
export function readImport(raw: string): ReadResult {
  if (raw.length > IMPORT_LIMITS.chars) return { ok: false, why: `This file is too large to be a deck-import file (over ${IMPORT_LIMITS.chars / 1_000_000} MB).` };
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return { ok: false, why: 'This file is not a deck-import file (it is not JSON).' };
  }
  return readImportValue(v);
}

/** An import document holding these decks (the admin page's download for the command-line step). */
export const importDocument = (decks: readonly RawDeck[], ran: string): ImportDoc => ({ kind: IMPORT_KIND, schema: IMPORT_SCHEMA, ran, links: [], decks: [...decks] });

// ---------------------------------------------------------------- matching card references

export { nameKey };

interface Index {
  eid: Map<string, CardDef>;
  code: Map<string, CardDef>;
  full: Map<string, CardDef[]>;
  base: Map<string, CardDef[]>;
}
let index: Index | null = null;
function cardIndex(): Index {
  if (index) return index;
  const push = (m: Map<string, CardDef[]>, k: string, c: CardDef) => m.set(k, [...(m.get(k) ?? []), c]);
  const ix: Index = { eid: new Map(), code: new Map(), full: new Map(), base: new Map() };
  for (const c of CARDS) {
    if (c.eid) ix.eid.set(c.eid, c);
    const m = c.number.match(/^(\d+)([a-z]*)$/);
    if (m) ix.code.set(`${c.set[0]}:${parseInt(m[1]!, 10)}${m[2]}`, c);
    push(ix.full, nameKey(c.subname ? `${c.name} ${c.subname}` : c.name), c);
    push(ix.base, nameKey(c.name), c);
  }
  return (index = ix);
}

export type Resolution = { ok: true; card: CardDef } | { ok: false; why: string };

const which = (cs: readonly CardDef[]) => cs.map(cardLabel).join(' or ');

/** This project's card with exactly this id. The table is a plain object, so only its own entries count: "constructor" and "__proto__" are not cards. */
const cardOf = (id: string): CardDef | null => (Object.prototype.hasOwnProperty.call(CARD_BY_ID, id) ? CARD_BY_ID[id]! : null);

/** A card id as the sites write it: "cb-" and this project's id with dashes (first), else the card database's id. */
function byId(ref: string): CardDef | null {
  const own = cardOf(ref);
  if (own) return own;
  if (!ref.startsWith('cb-')) return null;
  return cardOf(ref.slice(3).replace(/-/g, '_')) ?? cardIndex().eid.get(ref) ?? null;
}

function byCode(ref: string): CardDef | null {
  const m = ref.match(CODE);
  if (!m) return null;
  const n = parseInt(m[2]!, 36);
  return Number.isFinite(n) ? (cardIndex().code.get(`${m[1]}:${n}${m[3] ?? ''}`) ?? null) : null;
}

function byName(ref: string): Resolution {
  const k = nameKey(ref);
  const ix = cardIndex();
  const full = ix.full.get(k) ?? [];
  if (full.length === 1) return { ok: true, card: full[0]! };
  if (full.length > 1) return { ok: false, why: `“${ref}” could be ${which(full)}.` };
  const base = ix.base.get(k) ?? [];
  if (base.length === 1) return { ok: true, card: base[0]! };
  if (base.length > 1) return { ok: false, why: `“${ref}” could be ${which(base)}: the subname is needed.` };
  return { ok: false, why: `“${ref}” is not a card this trainer knows.` };
}

const guessBy = (ref: string): RefBy => (ref.startsWith('cb-') || cardOf(ref) ? 'id' : CODE.test(ref) ? 'code' : 'name');

/**
 * This project's card for a reference, or why there is none. An id is tried as "cb-" + the card's id with dashes, then
 * as the card database's id (eid: an older spelling for six cards with accents); a code by set letter and print number;
 * a name exactly (accents, case, apostrophes and "—", "–", ":" or " - " between name and subname do not matter), or by
 * the name alone when only one card has it. A reference the site also names must agree with its name. Never a guess:
 * anything ambiguous or unknown is reported.
 */
export function resolveRef(r: Pick<CardRef, 'ref' | 'by' | 'name'>): Resolution {
  const by = r.by ?? guessBy(r.ref);
  let card: CardDef | null = null;
  if (by === 'id') card = byId(r.ref);
  else if (by === 'code') card = byCode(r.ref);
  else {
    const n = byName(r.ref);
    if (!n.ok) return n;
    card = n.card;
  }
  if (r.name) {
    const n = byName(r.name);
    if (card && n.ok && n.card.id !== card.id) return { ok: false, why: `${r.ref} is ${cardLabel(card)}, but the site names it “${r.name}”.` };
    if (!card) return n.ok ? n : { ok: false, why: `${r.ref} is not a card this trainer knows (named “${r.name}” on the site).` };
  }
  if (!card) return { ok: false, why: by === 'code' ? `Code ${r.ref} is not a card this trainer knows.` : `${r.ref} is not a card this trainer knows.` };
  return { ok: true, card };
}

// ---------------------------------------------------------------- building and checking a deck

export interface ImportedDeck {
  raw: RawDeck;
  /** the deck (name: the deck's own, else its Legends) */
  deck: DeckList;
  /** a sentence per card reference that matched no card or more than one */
  unmatched: string[];
  /** validateDeck's reasons the list is not legal */
  illegal: string[];
  /** listFingerprint: Legends and main deck */
  listId: string;
  /** every card matched and the list legal */
  ready: boolean;
}

/** A name from the Legends, as the sim writes one ("Adam Smasher / Padre / V: Streetkid"). */
export function legendsName(legends: readonly string[]): string {
  const ix = cardIndex();
  return legends
    .map(cardOf)
    .filter((c): c is CardDef => !!c)
    .map((c) => ((ix.base.get(nameKey(c.name)) ?? []).filter((x) => x.type === 'Legend').length > 1 ? cardLabel(c) : c.name))
    .join(' / ');
}

/** The deck a raw deck describes, with every check. */
export function buildDeck(raw: RawDeck): ImportedDeck {
  const unmatched: string[] = [];
  const ids = (refs: readonly CardRef[]) =>
    refs.flatMap((r) => {
      const res = resolveRef(r);
      if (!res.ok) {
        unmatched.push(res.why);
        return [];
      }
      return Array<string>(r.count).fill(res.card.id);
    });
  const legends = ids(raw.legends);
  const main = ids(raw.main);
  const sideboard = ids(raw.sideboard);
  const deck: DeckList = { name: raw.name || legendsName(legends) || 'Imported deck', legends, main, sideboard };
  if (raw.source.link) deck.source = raw.source.link;
  const illegal = validateDeck(deck);
  return { raw, deck, unmatched, illegal, listId: listFingerprint(deck), ready: !unmatched.length && !illegal.length };
}

/** Who already holds an imported deck's list: a library deck, a deck saved in this browser, or an earlier deck of the import. */
export type Holder = { where: 'library'; file: string; name: string } | { where: 'saved'; name: string } | { where: 'import'; index: number; name: string };

/**
 * For each imported deck, who already has its list (null: nobody), by the rule a field follows (one entry per list,
 * src/lib/distinctLists.ts): a library deck first, then a deck saved in this browser, then an earlier deck of this
 * import. A deck with unmatched cards has no full list to compare and gets null.
 */
export function sameListHolders(decks: readonly ImportedDeck[], library: readonly Listed[]): (Holder | null)[] {
  type Entry = Listed & { importIndex?: number };
  const entries: Entry[] = [
    ...library,
    // decks of the import count as saved here (`custom:`) so the library's decks and this browser's come first
    ...decks.flatMap((d, i) => (d.unmatched.length ? [] : [{ file: `custom:\u0000import:${i}`, deck: d.deck, importIndex: i }])),
  ];
  const out: (Holder | null)[] = decks.map(() => null);
  for (const { deck, sameAs } of distinctLists(entries).left) {
    if (deck.importIndex === undefined) continue;
    out[deck.importIndex] =
      sameAs.importIndex !== undefined
        ? { where: 'import', index: sameAs.importIndex, name: sameAs.deck.name }
        : sameAs.file.startsWith('custom:')
          ? { where: 'saved', name: sameAs.deck.name }
          : { where: 'library', file: sameAs.file, name: sameAs.deck.name };
  }
  return out;
}

/** The holder in words. */
export function holderWords(h: Holder, names: readonly string[] = []): string {
  if (h.where === 'library') return `The library already has this list: ${h.name} (${h.file}).`;
  if (h.where === 'saved') return `This browser already has this list in My decks, as ${h.name}.`;
  return `Same list as deck ${h.index + 1} of this import${names[h.index] ? ` (${names[h.index]})` : ''}.`;
}

// ---------------------------------------------------------------- library deck files

/** A file name for a deck: the prefix and the deck's name in lower case, letters and digits only. */
export function deckFileName(name: string, prefix = 'import-'): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return `${prefix}${slug || 'deck'}.txt`;
}

/**
 * The deck's Origin header line: always starts "Imported from" (IMPORT_ORIGIN; isImportedOrigin in src/lib/library.ts
 * reads it, which makes the file a library deck of kind `shared`).
 */
export const importOrigin = (raw: RawDeck) => `${IMPORT_ORIGIN}${raw.source.site || 'a shared link'}${raw.source.placement ? ` (placed ${raw.source.placement})` : ''}`;

/**
 * The deck as a library file: the provenance header scripts/tag-provenance.ts writes (Origin, Author, Source, Via,
 * Added), crediting the author and the source link, then the list in choom.gg text format. `date` is the day it was
 * collected (YYYY-MM-DD) and is the deck's Added date (the day it joined the library: the gallery's "newest" sorts by
 * it); the page's own publication date, when it gave one, is said in the Via line.
 */
export function deckFileText(d: Pick<ImportedDeck, 'raw' | 'deck'>, date: string): string {
  const s = d.raw.source;
  const via = s.pageLink && s.pageLink !== s.link ? `${s.page ? `${s.page} ` : ''}${s.pageLink}` : s.site || 'a shared link';
  const published = s.date && !Number.isNaN(Date.parse(s.date)) ? s.date.slice(0, 10) : '';
  const p: [string, string][] = [
    ['Origin', importOrigin(d.raw)],
    ['Author', d.raw.author || IMPORT_NO_AUTHOR],
    ['Source', s.link],
    ['Via', `${via} (${published ? `published ${published}, ` : ''}collected ${date})`],
    ['Added', date],
  ];
  const body = exportChoom(d.deck).split('\n');
  // exportChoom starts with "// Name", "// Format: Constructed"
  return [body[0], ...p.filter(([, v]) => v).map(([k, v]) => `// ${k}: ${cleanText(v, IMPORT_LIMITS.link)}`), ...body.slice(1)].join('\n') + '\n';
}

/** Why a deck's file would not read back as the same deck (its name, its list), or '' when it does. */
export function deckFileProblem(file: string, textOf: string, d: Pick<ImportedDeck, 'deck'>): string {
  const back = libraryDeck(file, textOf);
  if (!back) return `${file} is not a library file name.`;
  if (back.deck.name !== d.deck.name) return `The name “${d.deck.name}” does not survive the file format (it reads back as “${back.deck.name}”): rename the deck.`;
  if (listFingerprint(back.deck) !== listFingerprint(d.deck) || back.deck.sideboard.length !== d.deck.sideboard.length) return 'The list does not read back the same from the file.';
  return '';
}

/**
 * The deck note (src/content/deckObjectives) a new library deck needs before the test suite passes: one line of the
 * IMPORTED_OBJECTIVES table (src/content/deckObjectives/imported.ts), a call to importedPlaceholder there (the one
 * definition of the placeholder's words), tied to the list and naming the Legends, for the owner to replace with a full
 * note. TypeScript source, without a line break.
 */
export function placeholderNote(file: string, d: Pick<ImportedDeck, 'deck' | 'listId'>): string {
  const legends = [...new Set(d.deck.legends)];
  return `  ${noteString(file)}: ${PLACEHOLDER_CALL}(${noteString(d.listId)}, [${legends.map(noteString).join(', ')}]),`;
}

/** The helper a placeholder line calls (src/content/deckObjectives/imported.ts importedPlaceholder). */
export const PLACEHOLDER_CALL = 'importedPlaceholder';

/**
 * Whether the deck-note table's source has an entry for this file already: a full note (the owner's, or an older
 * placeholder written out in full) or a placeholder line.
 */
export const hasNoteFor = (notes: string, file: string): boolean => notes.includes(`${noteString(file)}: {`) || notes.includes(`${noteString(file)}: ${PLACEHOLDER_CALL}(`);

/** A string in the deck-note table's source: single quotes, as the tables are written. */
export const noteString = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/[\r\n\u2028\u2029]/g, ' ')}'`;

/** The line in src/content/deckObjectives/imported.ts above which the command-line step adds placeholder notes. */
export const NOTE_MARKER = '  // new imported decks are added above this line (scripts/import-links.ts)';
