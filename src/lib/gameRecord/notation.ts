// The game record notation (docs/GAME_RECORD.md): a line-based plain-text record of one game that a person can type while
// watching a video, and that the engine can replay (./replay.ts). This file is the model, the parser and the writer.
// Pure: no engine state, no Node APIs.
//
// A record is a small header (format, players, decks, who goes first) and then the game, one line per choice or chance
// outcome. Every body line may start with a video timestamp `[12:34]` and end with a comment `# ...`. Cards are written
// by full name, by an unambiguous short form (the part before the colon, as in src/lib/cardMentions.ts) or by id; case,
// spacing and apostrophes are forgiven. Anything hidden may be written `?`: the parser accepts it and lists the lines.
import { CARDS } from '../../engine/cards';
import type { PlayerId } from '../../engine/types';
import { buildCardIndex, foldText } from '../cardMentions';

export const RECORD_MAGIC = 'nct-record';
export const RECORD_FORMAT = 1;
/** the engine's default turn limit (GameOptions.maxTurns); a record says `max turns: N` only when it differs */
export const DEFAULT_MAX_TURNS = 60;
export const GIG_SIDES = [4, 6, 8, 10, 12, 20] as const;

/** The zones a line may name to say where a card is (`from trash`). */
export const CARD_ZONES = ['hand', 'deck', 'trash', 'field', 'legends', 'eddies', 'removed'] as const;
export type CardZone = (typeof CARD_ZONES)[number];

/**
 * A card as a line names it: its id and, only when that is needed to tell it from another card the line could mean,
 * whose it is (`p2's`: the controller of a card in play or in the Legends area, the owner of any other), where it is
 * (`from trash`) and which copy (`[2]`: 1-based, in the order of that zone).
 */
export interface CardRef {
  id: string;
  n?: number;
  who?: PlayerId;
  zone?: CardZone;
}
/** null: written `?` (hidden from whoever wrote the record) */
export type MaybeCard = CardRef | null;

/** A Gig as a line names it: its die, and its owner and value when needed to tell it apart. */
export interface GigRef {
  owner?: PlayerId;
  sides: number;
  value?: number;
}

/** The answer to a choice inside an effect (a target, a mode, yes or no, a Gig, a Gig's new value...). */
export type Choice =
  | { c: 'yes' }
  | { c: 'no' }
  | { c: 'none' }
  | { c: 'mode'; n: number }
  | { c: 'card'; card: MaybeCard }
  | { c: 'gig'; gig: GigRef; to?: number }
  | { c: 'number'; n: number }
  | { c: 'option'; n: number };

export type DeckReadKind = 'draw' | 'mill' | 'reveal' | 'look';

/** What one body line says. */
export type RecordEvent =
  | { k: 'turn'; turn: number; p?: PlayerId }
  | { k: 'legends' | 'hand' | DeckReadKind; p: PlayerId; cards: MaybeCard[] }
  | { k: 'roll'; p: PlayerId; sides: number; value: number | null; re?: true }
  | { k: 'mulligan'; p: PlayerId; yes: boolean }
  | { k: 'pass'; p: PlayerId }
  | { k: 'sell' | 'play' | 'call' | 'solo' | 'block'; p: PlayerId; card: MaybeCard }
  | { k: 'use'; p: PlayerId; card: MaybeCard; host?: MaybeCard; ability?: number }
  | { k: 'attack'; p: PlayerId; card: MaybeCard; target: 'gigs' | MaybeCard }
  | { k: 'noReaction'; p: PlayerId }
  | { k: 'choose'; p: PlayerId; verb: ChooseVerb; what: Choice }
  | { k: 'pay'; p: PlayerId; source: 'eddie' | MaybeCard }
  | { k: 'order'; p: PlayerId; card: MaybeCard | undefined; n?: number }
  | { k: 'end'; p: PlayerId | null; how: 'concedes' | 'timeout' | 'abandoned' }
  | { k: 'result'; winner: PlayerId | 'tie'; reason?: string }
  | { k: 'note' };

export type ChooseVerb = 'chooses' | 'discards' | 'steals';
export type EventKind = RecordEvent['k'];

export interface RecordLine {
  /** 1-based line number in the text it was parsed from (0 for a line made in code) */
  line: number;
  ev: RecordEvent;
  /** video timestamp as written, without brackets ("12:34" or "1:02:03") */
  time?: string;
  comment?: string;
}

export type DeckRef =
  | { kind: 'file'; file: string }
  | { kind: 'name'; name: string }
  | { kind: 'list'; name: string; legends: string[]; main: string[] }
  | { kind: 'unknown' };

export interface RecordHeader {
  players: [string | null, string | null];
  decks: [DeckRef, DeckRef];
  /** who goes first; null when written `?` */
  first: PlayerId | null;
  maxTurns?: number;
  date?: string;
  source?: string;
  /** comment-only lines in the header, kept in order */
  notes?: string[];
  /** comments at the end of header lines, by key ("p1", "p1 deck", "first", "max turns", "date", "source") */
  comments?: Record<string, string>;
}

export interface GameRecord {
  header: RecordHeader;
  lines: RecordLine[];
}

export interface ParseError {
  line: number;
  message: string;
}

export interface ParseResult {
  record: GameRecord | null;
  errors: ParseError[];
  /** body lines (1-based numbers) that hold an unknown `?` (and the header, line numbers of `deck: ?` / `first: ?`) */
  unknownLines: number[];
}

// ------------------------------------------------------------------ card names

const squeeze = (s: string) => foldText(s).replace(/[\s']+/g, '');

interface NameIndex {
  byKey: Map<string, string>;
  keys: string[];
}
let nameIndex: NameIndex | null = null;

function names(): NameIndex {
  if (nameIndex) return nameIndex;
  const byKey = new Map<string, string>();
  const add = (name: string, id: string) => {
    const k = squeeze(name);
    if (!k) return;
    const had = byKey.get(k);
    if (had === undefined) byKey.set(k, id);
    else if (had !== id) byKey.set(k, ''); // the same text names two cards: never resolved by it
  };
  for (const [name, id] of buildCardIndex(CARDS).names) add(name, id);
  for (const c of CARDS) add(c.id, c.id);
  for (const c of CARDS) add(c.id.replace(/_/g, ' '), c.id);
  nameIndex = { byKey, keys: [...byKey.keys()].filter((k) => byKey.get(k)) };
  return nameIndex;
}

/** The card id a name (full name, unambiguous short form or id) stands for, or null. */
export function resolveCardName(text: string): string | null {
  const id = names().byKey.get(squeeze(text));
  return id ? id : null;
}

function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n] ?? 0;
}

/** Up to three card names close to `text`, for an error message. */
export function closeCardNames(text: string): string[] {
  const q = squeeze(text);
  if (!q) return [];
  const byId = new Map(CARDS.map((c) => [c.id, c.displayName]));
  const scored: [number, string][] = [];
  for (const k of names().keys) {
    const id = names().byKey.get(k)!;
    const prefix = k.startsWith(q) || q.startsWith(k);
    const d = prefix ? 0 : Math.min(editDistance(q, k), editDistance(q, k.slice(0, q.length)));
    if (d <= Math.max(2, Math.floor(q.length * 0.3))) scored.push([d, byId.get(id) ?? id]);
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
  return [...new Set(scored.map((x) => x[1]))].slice(0, 3);
}

let displayById: Map<string, string> | null = null;
/** The canonical way to write a card: its full name. */
export function cardName(id: string): string {
  displayById ??= new Map(CARDS.map((c) => [c.id, c.displayName]));
  return displayById.get(id) ?? id;
}

// ------------------------------------------------------------------ parsing

class LineError extends Error {}

const SEAT = /^(p1|p2)$/i;
const seatOf = (s: string): PlayerId => (s.toLowerCase() === 'p1' ? 0 : 1);

function cardError(text: string): LineError {
  const near = closeCardNames(text);
  return new LineError(`expected a card name (its full name, the part before the colon when only one card has it, or its id), found "${text}"${near.length ? `; did you mean ${near.map((n) => `"${n}"`).join(' or ')}?` : ''}`);
}

/** One card ref: `?`, or `[p1's |p2's ]<name>[[n]][ from <zone>]` (whose, which copy, where). */
export function parseCardRef(text: string): MaybeCard {
  let t = text.trim();
  if (t === '?') return null;
  const ref: Omit<CardRef, 'id'> = {};
  const whoM = t.match(/^(p1|p2)(?:'s|’s)?\s+(.*)$/i);
  if (whoM) {
    ref.who = seatOf(whoM[1]!);
    t = whoM[2]!;
  }
  const zoneM = t.match(/^(.*?)\s+from\s+(\w+)$/i);
  if (zoneM) {
    const z = zoneM[2]!.toLowerCase();
    if (!(CARD_ZONES as readonly string[]).includes(z)) throw new LineError(`expected a zone after "from" (${CARD_ZONES.join(', ')}), found "${zoneM[2]}"`);
    ref.zone = z as CardZone;
    t = zoneM[1]!;
  }
  const inst = t.match(/^(.*?)\s*\[(\d+)\]$/);
  if (inst) {
    t = inst[1]!;
    ref.n = Number(inst[2]);
    if (ref.n < 1) throw new LineError(`a copy number in [ ] counts from 1, found [${inst[2]}]`);
  }
  if (!t) throw new LineError('expected a card name');
  const id = resolveCardName(t);
  if (!id) throw cardError(t);
  return { id, ...ref };
}

/**
 * A comma-separated list of cards. Two card names contain a comma ("Three Mouths, One Desire"), so at each place the
 * longest run of comma-separated pieces that names a card is taken.
 */
export function parseCardList(text: string): MaybeCard[] {
  const t = text.trim();
  if (!t) throw new LineError('expected at least one card');
  const parts = t.split(',').map((x) => x.trim());
  const out: MaybeCard[] = [];
  for (let i = 0; i < parts.length; ) {
    if (parts[i] === '?') {
      out.push(null);
      i++;
      continue;
    }
    let taken = 0;
    for (let j = parts.length; j > i; j--) {
      const piece = parts.slice(i, j).join(', ');
      if (resolveCardName(piece)) {
        out.push({ id: resolveCardName(piece)! });
        taken = j - i;
        break;
      }
    }
    if (!taken) {
      if (!parts[i]) throw new LineError('expected a card name between two commas');
      throw cardError(parts[i]!);
    }
    i += taken;
  }
  return out;
}

export function parseGigRef(text: string): GigRef | null {
  const m = text.trim().match(/^(?:(p1|p2)(?:'s|’s)?\s+)?d(\d+)(?:\s*=\s*(\d+))?$/i);
  if (!m) return null;
  const sides = Number(m[2]);
  if (!(GIG_SIDES as readonly number[]).includes(sides)) throw new LineError(`a Gig is a d4, d6, d8, d10, d12 or d20, found d${m[2]}`);
  const ref: GigRef = { sides };
  if (m[1]) ref.owner = seatOf(m[1]);
  if (m[3] !== undefined) {
    const v = Number(m[3]);
    if (v < 1 || v > sides) throw new LineError(`a d${sides} shows 1 to ${sides}, found ${v}`);
    ref.value = v;
  }
  return ref;
}

function parseChoice(text: string): Choice {
  const t = text.trim();
  const low = t.toLowerCase();
  if (low === 'yes' || low === 'no' || low === 'none') return { c: low };
  let m = low.match(/^mode\s+(\d+)$/);
  if (m) return { c: 'mode', n: posInt(m[1]!, 'a mode number') };
  m = low.match(/^number\s+(\d+)$/);
  if (m) return { c: 'number', n: Number(m[1]) };
  m = low.match(/^option\s+(\d+)$/);
  if (m) return { c: 'option', n: posInt(m[1]!, 'an option number') };
  const to = t.match(/^(.*?)\s+to\s+(\d+)$/i);
  if (to) {
    const gig = parseGigRef(to[1]!);
    if (gig) {
      const v = Number(to[2]);
      if (v < 1 || v > gig.sides) throw new LineError(`a d${gig.sides} can be set to 1 to ${gig.sides}, found ${v}`);
      return { c: 'gig', gig, to: v };
    }
  }
  const gig = parseGigRef(t);
  if (gig) return { c: 'gig', gig };
  if (!t) throw new LineError('expected what was chosen: yes, no, none, mode N, a card, a Gig (d8=5) or a Gig and its new value (d8=5 to 7)');
  return { c: 'card', card: parseCardRef(t) };
}

function posInt(s: string, what: string): number {
  const n = Number(s);
  if (!Number.isInteger(n) || n < 1) throw new LineError(`expected ${what} (1 or more), found "${s}"`);
  return n;
}

const DIE = /^d(\d+)\s*:\s*(\d+|\?)$/i;
function parseDie(text: string, verb: string): { sides: number; value: number | null } {
  const m = text.trim().match(DIE);
  if (!m) throw new LineError(`expected the die and its result after "${verb}", like "d8: 5"`);
  const sides = Number(m[1]);
  if (!(GIG_SIDES as readonly number[]).includes(sides)) throw new LineError(`a Gig is a d4, d6, d8, d10, d12 or d20, found d${m[1]}`);
  if (m[2] === '?') return { sides, value: null };
  const value = Number(m[2]);
  if (value < 1 || value > sides) throw new LineError(`a d${sides} rolls 1 to ${sides}, found ${value}`);
  return { sides, value };
}

/** The ends of a game a record may state: short codes in the result line, and the engine's reasons they stand for. */
export const RESULT_REASONS = ['7 gigs', 'overtime', 'deck out', 'turn limit', 'concession', 'time', 'abandoned'] as const;

const VERBS_HELP =
  'expected one of: hand, legends, keeps, mulligans, draws, mills, reveals, looks at, rolls in, rerolls, ends turn, sells, plays, calls, goes solo, uses, attacks, no reaction, blocks, chooses, discards, steals, pays, resolves, concedes, runs out of time';

function parsePlayerLine(p: PlayerId, rest: string): RecordEvent {
  const r = rest.trim();
  const low = r.toLowerCase();
  let m: RegExpMatchArray | null;
  if ((m = r.match(/^(hand|legends)\s*:\s*(.*)$/i))) return { k: m[1]!.toLowerCase() as 'hand' | 'legends', p, cards: parseCardList(m[2]!) };
  if (low === 'keeps') return { k: 'mulligan', p, yes: false };
  if (low === 'mulligans') return { k: 'mulligan', p, yes: true };
  if (low === 'ends turn') return { k: 'pass', p };
  if (low === 'no reaction') return { k: 'noReaction', p };
  if (low === 'concedes') return { k: 'end', p, how: 'concedes' };
  if (low === 'runs out of time') return { k: 'end', p, how: 'timeout' };
  if ((m = r.match(/^draws\s+(.*)$/i))) return { k: 'draw', p, cards: parseCardList(m[1]!) };
  if ((m = r.match(/^mills\s+(.*)$/i))) return { k: 'mill', p, cards: parseCardList(m[1]!) };
  if ((m = r.match(/^reveals\s+(.*)$/i))) return { k: 'reveal', p, cards: parseCardList(m[1]!) };
  if ((m = r.match(/^looks\s+at\s+(.*)$/i))) return { k: 'look', p, cards: parseCardList(m[1]!) };
  if ((m = r.match(/^rolls(?:\s+in)?\s+(.*)$/i))) return { k: 'roll', p, ...parseDie(m[1]!, 'rolls in') };
  if ((m = r.match(/^rerolls\s+(.*)$/i))) return { k: 'roll', p, ...parseDie(m[1]!, 'rerolls'), re: true };
  if ((m = r.match(/^goes\s+solo\s+(.*)$/i))) return { k: 'solo', p, card: parseCardRef(m[1]!) };
  if ((m = r.match(/^(sells|plays|calls)\s+(.*)$/i))) {
    const k = ({ sells: 'sell', plays: 'play', calls: 'call' } as const)[m[1]!.toLowerCase() as 'sells' | 'plays' | 'calls'];
    return { k, p, card: parseCardRef(m[2]!) };
  }
  if ((m = r.match(/^blocks(?:\s+with)?\s+(.*)$/i))) return { k: 'block', p, card: parseCardRef(m[1]!) };
  if ((m = r.match(/^uses\s+(.*)$/i))) {
    let body = m[1]!.trim();
    let ability: number | undefined;
    const ab = body.match(/^(.*?)\s+ability\s+(\d+)$/i);
    if (ab) {
      body = ab[1]!;
      ability = posInt(ab[2]!, 'an ability number');
    }
    const at = body.split('@');
    if (at.length > 2) throw new LineError('expected "uses <card> @ <card it is on>" with one @');
    const ev: RecordEvent = { k: 'use', p, card: parseCardRef(at[0]!) };
    if (at.length === 2) ev.host = parseCardRef(at[1]!);
    if (ability !== undefined) ev.ability = ability;
    return ev;
  }
  if ((m = r.match(/^attacks\s+(.*)$/i))) {
    const parts = m[1]!.split('>');
    if (parts.length !== 2) throw new LineError('expected "attacks <attacker> > gigs" or "attacks <attacker> > <Unit attacked>"');
    const target = parts[1]!.trim();
    return { k: 'attack', p, card: parseCardRef(parts[0]!), target: /^gigs?$/i.test(target) ? 'gigs' : parseCardRef(target) };
  }
  if ((m = r.match(/^(chooses|discards|steals)\s+(.*)$/i))) return { k: 'choose', p, verb: m[1]!.toLowerCase() as ChooseVerb, what: parseChoice(m[2]!) };
  if ((m = r.match(/^pays\s+(.*)$/i))) {
    const what = m[1]!.trim();
    return { k: 'pay', p, source: /^(an\s+)?eddie$/i.test(what) ? 'eddie' : parseCardRef(what) };
  }
  if ((m = r.match(/^resolves\s+(.*)$/i))) {
    const what = m[1]!.trim();
    const eff = what.match(/^effect\s+(\d+)$/i);
    if (eff) return { k: 'order', p, card: undefined, n: posInt(eff[1]!, 'an effect number') };
    return { k: 'order', p, card: parseCardRef(what) };
  }
  throw new LineError(`could not read "${r}" after "${p === 0 ? 'p1' : 'p2'}": ${VERBS_HELP}`);
}

function parseBody(body: string): RecordEvent {
  const t = body.trim();
  let m: RegExpMatchArray | null;
  if ((m = t.match(/^turn\s+(\d+)(?:\s+(p1|p2))?$/i))) {
    const ev: RecordEvent = { k: 'turn', turn: posInt(m[1]!, 'a turn number') };
    if (m[2]) ev.p = seatOf(m[2]);
    return ev;
  }
  if ((m = t.match(/^result\s*:\s*(.*)$/i))) {
    const r = m[1]!.trim();
    const w = r.match(/^(?:(p1|p2)\s+wins|(draw))(?:\s*\((.*)\))?$/i);
    if (!w) throw new LineError('expected "result: p1 wins", "result: p2 wins" or "result: draw", with an optional reason in parentheses');
    const ev: RecordEvent = { k: 'result', winner: w[2] ? 'tie' : seatOf(w[1]!) };
    if (w[3] !== undefined && w[3].trim()) ev.reason = w[3].trim().toLowerCase();
    return ev;
  }
  if (/^game\s+abandoned$/i.test(t)) return { k: 'end', p: null, how: 'abandoned' };
  if ((m = t.match(/^(p1|p2)\s+(.*)$/i))) return parsePlayerLine(seatOf(m[1]!), m[2]!);
  throw new LineError(`could not read "${t}": a line starts with p1 or p2, "turn N", or "result:"`);
}

/** Split a raw line into timestamp, body and comment. Card names hold no '#', so the first '#' starts a comment. */
function splitLine(raw: string): { time?: string; body: string; comment?: string } {
  let s = raw;
  let comment: string | undefined;
  const hash = s.indexOf('#');
  if (hash >= 0) {
    comment = s.slice(hash + 1).trim();
    s = s.slice(0, hash);
  }
  s = s.trim();
  let time: string | undefined;
  const ts = s.match(/^\[\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\s*\]\s*/) ?? s.match(/^((?:\d{1,2}:)?\d{1,2}:\d{2})\s+/);
  if (ts) {
    time = ts[1];
    s = s.slice(ts[0].length);
  }
  const out: { time?: string; body: string; comment?: string } = { body: s.trim() };
  if (time !== undefined) out.time = time;
  if (comment !== undefined) out.comment = comment;
  return out;
}

/** Does this event hold an unknown (`?`) card or value? */
export const hasUnknown = (ev: RecordEvent): boolean => {
  switch (ev.k) {
    case 'legends':
    case 'hand':
    case 'draw':
    case 'mill':
    case 'reveal':
    case 'look':
      return ev.cards.some((c) => c === null);
    case 'roll':
      return ev.value === null;
    case 'sell':
    case 'play':
    case 'call':
    case 'solo':
    case 'block':
      return ev.card === null;
    case 'use':
      return ev.card === null || ev.host === null;
    case 'attack':
      return ev.card === null || ev.target === null;
    case 'choose':
      return ev.what.c === 'card' && ev.what.card === null;
    case 'pay':
      return ev.source === null;
    case 'order':
      return ev.card === null;
    default:
      return false;
  }
};

/** The deck a header names: `file <name>.txt`, `name <deck name>`, `list <deck name>` (cards on the indented lines below) or `?`. */
function parseDeckRef(text: string): DeckRef | 'list' {
  const t = text.trim();
  if (t === '?') return { kind: 'unknown' };
  let m = t.match(/^file\s+(.+)$/i);
  if (m) return { kind: 'file', file: m[1]!.trim() };
  m = t.match(/^name\s+(.+)$/i);
  if (m) return { kind: 'name', name: m[1]!.trim() };
  if (/^list\b/i.test(t)) return 'list';
  if (/\.txt$/i.test(t)) return { kind: 'file', file: t };
  if (!t) throw new LineError('expected the deck: "file <file>.txt", "name <deck name>", "list <deck name>" with its cards on indented lines below, or "?"');
  return { kind: 'name', name: t };
}

/**
 * Parse a record. Every line is read; each problem is reported with its line number (at most 50). `record` is null when
 * any line could not be read.
 */
export function parseRecord(text: string): ParseResult {
  const rawLines = text.replace(/^﻿/, '').split(/\r?\n/);
  const errors: ParseError[] = [];
  const unknownLines: number[] = [];
  const header: RecordHeader = { players: [null, null], decks: [{ kind: 'unknown' }, { kind: 'unknown' }], first: null };
  const seen = new Set<string>();
  const lines: RecordLine[] = [];
  let i = 0;
  const err = (line: number, message: string) => {
    if (errors.length < 50) errors.push({ line, message });
  };
  // the format line
  while (i < rawLines.length && !rawLines[i]!.trim()) i++;
  const first = rawLines[i]?.trim() ?? '';
  const fm = first.match(/^nct-record\s+(\d+)$/i);
  if (!fm) {
    err(i + 1, `expected the format line "${RECORD_MAGIC} ${RECORD_FORMAT}" first, found "${first}"`);
    return { record: null, errors, unknownLines };
  }
  if (Number(fm[1]) !== RECORD_FORMAT) {
    err(i + 1, `this is format ${fm[1]}; this version reads format ${RECORD_FORMAT}`);
    return { record: null, errors, unknownLines };
  }
  i++;
  // the header: key: value lines until the first body line
  let inBody = false;
  for (; i < rawLines.length; i++) {
    const raw = rawLines[i]!;
    const n = i + 1;
    if (!raw.trim()) continue;
    const { body, comment, time } = splitLine(raw);
    if (!inBody) {
      if (!body && comment !== undefined) {
        (header.notes ??= []).push(comment);
        continue;
      }
      const hm = body.match(/^(p1|p2)\s*:\s*(.*)$/i) ?? body.match(/^(p1\s+deck|p2\s+deck|first|date|source|max\s+turns)\s*:\s*(.*)$/i);
      if (hm && time === undefined) {
        const key = hm[1]!.toLowerCase().replace(/\s+/g, ' ');
        const val = hm[2]!.trim();
        if (comment !== undefined) (header.comments ??= {})[key] = comment;
        if (seen.has(key)) err(n, `"${key}" is given twice in the header`);
        seen.add(key);
        try {
          if (key === 'p1' || key === 'p2') header.players[seatOf(key)] = val || null;
          else if (key === 'p1 deck' || key === 'p2 deck') {
            const seat = seatOf(key.slice(0, 2));
            const ref = parseDeckRef(val);
            if (ref === 'list') {
              const name = val.replace(/^list\s*/i, '').trim() || `Deck ${seat + 1}`;
              const legends: string[] = [];
              const main: string[] = [];
              while (i + 1 < rawLines.length && /^\s+\S/.test(rawLines[i + 1]!)) {
                i++;
                const cl = splitLine(rawLines[i]!).body;
                if (!cl) continue;
                const qm = cl.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
                const qty = qm ? Number(qm[1]) : 1;
                const nameText = qm ? qm[2]! : cl;
                try {
                  const c = parseCardRef(nameText);
                  if (!c) throw new LineError('a deck list names its cards; "?" is the whole deck unknown ("deck: ?")');
                  const def = CARDS.find((x) => x.id === c.id)!;
                  if (qty < 1 || qty > 50) throw new LineError(`expected 1 to 50 copies, found ${qty}`);
                  for (let q = 0; q < qty; q++) (def.type === 'Legend' ? legends : main).push(c.id);
                } catch (e) {
                  if (!(e instanceof LineError)) throw e;
                  err(i + 1, `deck list: ${e.message}`);
                }
              }
              if (!main.length && !legends.length) err(n, 'an inline deck list ("list <name>") needs its cards on the indented lines below it');
              header.decks[seat] = { kind: 'list', name, legends, main };
            } else header.decks[seat] = ref;
            if (header.decks[seat].kind === 'unknown') unknownLines.push(n);
          } else if (key === 'first') {
            if (val === '?') {
              header.first = null;
              unknownLines.push(n);
            } else if (SEAT.test(val)) header.first = seatOf(val);
            else throw new LineError(`expected "first: p1", "first: p2" or "first: ?", found "${val}"`);
          } else if (key === 'max turns') header.maxTurns = posInt(val, 'a turn limit');
          else if (key === 'date') header.date = val;
          else if (key === 'source') header.source = val;
        } catch (e) {
          if (!(e instanceof LineError)) throw e;
          err(n, e.message);
        }
        continue;
      }
      inBody = true;
    }
    if (!body) {
      if (comment !== undefined || time !== undefined) {
        const rl: RecordLine = { line: n, ev: { k: 'note' } };
        if (time !== undefined) rl.time = time;
        if (comment !== undefined) rl.comment = comment;
        lines.push(rl);
      }
      continue;
    }
    try {
      const ev = parseBody(body);
      const rl: RecordLine = { line: n, ev };
      if (time !== undefined) rl.time = time;
      if (comment !== undefined) rl.comment = comment;
      lines.push(rl);
      if (hasUnknown(ev)) unknownLines.push(n);
    } catch (e) {
      if (!(e instanceof LineError)) throw e;
      err(n, e.message);
    }
  }
  if (!seen.has('p1 deck')) err(i, 'the header must name p1\'s deck ("p1 deck: ...", "?" when unknown)');
  if (!seen.has('p2 deck')) err(i, 'the header must name p2\'s deck ("p2 deck: ...", "?" when unknown)');
  if (!seen.has('first')) err(i, 'the header must say who goes first ("first: p1", "first: p2" or "first: ?")');
  const results = lines.filter((l) => l.ev.k === 'result');
  if (results.length > 1) err(results[1]!.line, 'a record has at most one result line');
  else if (results.length === 1 && lines.slice(lines.indexOf(results[0]!) + 1).some((l) => l.ev.k !== 'note')) err(results[0]!.line, 'the result line is the last line of a record');
  return { record: errors.length ? null : { header, lines }, errors, unknownLines: [...new Set(unknownLines)].sort((a, b) => a - b) };
}

// ------------------------------------------------------------------ writing

const seatText = (p: PlayerId) => (p === 0 ? 'p1' : 'p2');

export function cardRefText(c: MaybeCard | undefined): string {
  if (!c) return '?';
  return `${c.who !== undefined ? `${seatText(c.who)}'s ` : ''}${cardName(c.id)}${c.n !== undefined ? `[${c.n}]` : ''}${c.zone !== undefined ? ` from ${c.zone}` : ''}`;
}
const listText = (cards: MaybeCard[]) => cards.map(cardRefText).join(', ');
export function gigRefText(g: GigRef): string {
  return `${g.owner !== undefined ? `${seatText(g.owner)}'s ` : ''}d${g.sides}${g.value !== undefined ? `=${g.value}` : ''}`;
}

function choiceText(c: Choice): string {
  switch (c.c) {
    case 'yes':
    case 'no':
    case 'none':
      return c.c;
    case 'mode':
      return `mode ${c.n}`;
    case 'number':
      return `number ${c.n}`;
    case 'option':
      return `option ${c.n}`;
    case 'card':
      return cardRefText(c.card);
    case 'gig':
      return `${gigRefText(c.gig)}${c.to !== undefined ? ` to ${c.to}` : ''}`;
  }
}

/** The canonical text of one event (no timestamp, no comment). */
export function eventText(ev: RecordEvent): string {
  switch (ev.k) {
    case 'turn':
      return `turn ${ev.turn}${ev.p !== undefined ? ` ${seatText(ev.p)}` : ''}`;
    case 'legends':
    case 'hand':
      return `${seatText(ev.p)} ${ev.k}: ${listText(ev.cards)}`;
    case 'draw':
      return `${seatText(ev.p)} draws ${listText(ev.cards)}`;
    case 'mill':
      return `${seatText(ev.p)} mills ${listText(ev.cards)}`;
    case 'reveal':
      return `${seatText(ev.p)} reveals ${listText(ev.cards)}`;
    case 'look':
      return `${seatText(ev.p)} looks at ${listText(ev.cards)}`;
    case 'roll':
      return `${seatText(ev.p)} ${ev.re ? 'rerolls' : 'rolls in'} d${ev.sides}: ${ev.value ?? '?'}`;
    case 'mulligan':
      return `${seatText(ev.p)} ${ev.yes ? 'mulligans' : 'keeps'}`;
    case 'pass':
      return `${seatText(ev.p)} ends turn`;
    case 'sell':
      return `${seatText(ev.p)} sells ${cardRefText(ev.card)}`;
    case 'play':
      return `${seatText(ev.p)} plays ${cardRefText(ev.card)}`;
    case 'call':
      return `${seatText(ev.p)} calls ${cardRefText(ev.card)}`;
    case 'solo':
      return `${seatText(ev.p)} goes solo ${cardRefText(ev.card)}`;
    case 'block':
      return `${seatText(ev.p)} blocks ${cardRefText(ev.card)}`;
    case 'use':
      return `${seatText(ev.p)} uses ${cardRefText(ev.card)}${ev.host !== undefined ? ` @ ${cardRefText(ev.host)}` : ''}${ev.ability !== undefined ? ` ability ${ev.ability}` : ''}`;
    case 'attack':
      return `${seatText(ev.p)} attacks ${cardRefText(ev.card)} > ${ev.target === 'gigs' ? 'gigs' : cardRefText(ev.target)}`;
    case 'noReaction':
      return `${seatText(ev.p)} no reaction`;
    case 'choose':
      return `${seatText(ev.p)} ${ev.verb} ${choiceText(ev.what)}`;
    case 'pay':
      return `${seatText(ev.p)} pays ${ev.source === 'eddie' ? 'Eddie' : cardRefText(ev.source)}`;
    case 'order':
      return `${seatText(ev.p)} resolves ${ev.card === undefined ? `effect ${ev.n ?? 1}` : cardRefText(ev.card)}`;
    case 'end':
      return ev.how === 'abandoned' ? 'game abandoned' : `${seatText(ev.p ?? 0)} ${ev.how === 'concedes' ? 'concedes' : 'runs out of time'}`;
    case 'result':
      return `result: ${ev.winner === 'tie' ? 'draw' : `${seatText(ev.winner)} wins`}${ev.reason ? ` (${ev.reason})` : ''}`;
    case 'note':
      return '';
  }
}

export function lineText(l: RecordLine): string {
  const body = eventText(l.ev);
  let s = l.time !== undefined ? `[${l.time}]${body ? ' ' : ''}${body}` : body;
  if (l.comment !== undefined) s = s ? `${s}  # ${l.comment}` : `# ${l.comment}`;
  return s;
}

function deckRefText(d: DeckRef, seat: PlayerId): string[] {
  const key = `${seatText(seat)} deck:`;
  switch (d.kind) {
    case 'unknown':
      return [`${key} ?`];
    case 'file':
      return [`${key} file ${d.file}`];
    case 'name':
      return [`${key} name ${d.name}`];
    case 'list': {
      const out = [`${key} list ${d.name}`];
      const counts = new Map<string, number>();
      for (const id of [...d.legends, ...d.main]) counts.set(id, (counts.get(id) ?? 0) + 1);
      for (const [id, n] of counts) out.push(`  ${n} ${cardName(id)}`);
      return out;
    }
  }
}

/**
 * The canonical text of a record: the format line, the header, a blank line, then one line per event, with a blank line
 * before each turn and before the result. Parsing this text and writing it again gives the same text.
 */
export function writeRecord(rec: GameRecord): string {
  const h = rec.header;
  const out: string[] = [`${RECORD_MAGIC} ${RECORD_FORMAT}`];
  const put = (key: string, line: string) => out.push(h.comments?.[key] !== undefined ? `${line}  # ${h.comments[key]}` : line);
  for (const note of h.notes ?? []) out.push(`# ${note}`);
  for (const p of [0, 1] as PlayerId[]) if (h.players[p]) put(seatText(p), `${seatText(p)}: ${h.players[p]}`);
  for (const p of [0, 1] as PlayerId[]) {
    const [first, ...rest] = deckRefText(h.decks[p], p);
    put(`${seatText(p)} deck`, first!);
    out.push(...rest);
  }
  put('first', `first: ${h.first === null ? '?' : seatText(h.first)}`);
  if (h.maxTurns !== undefined && h.maxTurns !== DEFAULT_MAX_TURNS) put('max turns', `max turns: ${h.maxTurns}`);
  if (h.date) put('date', `date: ${h.date}`);
  if (h.source) put('source', `source: ${h.source}`);
  out.push('');
  let started = false;
  for (const l of rec.lines) {
    if (started && (l.ev.k === 'turn' || l.ev.k === 'result')) out.push('');
    out.push(lineText(l));
    started = true;
  }
  return out.join('\n') + '\n';
}
