// A shared profile: one plain, versioned JSON document (`kind: 'nct-profile'`, `schema: 1`) holding ONLY the sections the
// player marked public, built from the profile choices (src/lib/profile.ts) and the derived stats
// (src/lib/profileStats.ts). It travels in a link (#/u/<payload>: the JSON, deflate-compressed where the browser can,
// base64url) or as a file; nothing is uploaded anywhere, and a server could later store the same document unchanged.
// Reading one back treats it as untrusted: every field is checked, every string cleaned and capped, unknown fields and
// anything malformed dropped, and a newer schema refused with a plain message.
import type { LibraryDeck } from './library';
import type { PracticeGame } from './practiceLog';
import { CARD_ID, cleanText, NAME_MAX, PROFILE_SECTIONS, type ProfileDoc, type ProfileSection } from './profile';
import {
  BOT_TIERS,
  deckStatRows,
  headline,
  MY_DECK_GROUPS,
  mostPlayed,
  myDecks,
  newestFirst,
  botTier,
  type BotTier,
  type MyDeckGroup,
  type Result,
  type WLD,
} from './profileStats';

export const SHARE_KIND = 'nct-profile';
export const SHARE_SCHEMA = 1;

/** How much of each list a share carries. */
export const SHARE_LIMITS = { history: 50, deckStats: 40, byOpp: 20, decks: 30, cardsPerDeck: 60, text: 80 } as const;
/** The longest payload a share link carries (characters after #/u/); a bigger profile is shared as a file instead. */
export const LINK_MAX = 8000;
/** The largest shared document read back (bytes of JSON, after decompression): a guard against oversized or crafted input. */
export const DOC_MAX = 512 * 1024;

type Grade = 'A' | 'B' | 'C' | 'D';

export interface SharedHistoryGame {
  date: string;
  deck: string;
  opp: string;
  tier: BotTier;
  result: Result;
  turns: number;
  first: boolean;
  /** Gigs at the end, [the player's, the bot's], when recorded */
  gigs: [number, number] | null;
  conceded: boolean;
  grade: Grade | null;
}

export interface SharedDeckStat extends WLD {
  deck: string;
  first: WLD;
  second: WLD;
  avgTurns: number | null;
  last: string;
  byOpp: (WLD & { opp: string })[];
  byTier: (WLD & { tier: BotTier })[];
}

export interface SharedDeck {
  name: string;
  group: MyDeckGroup;
  legends: string[];
  /** the main deck as [card id, copies] */
  cards: [string, number][];
  added: string | null;
}

export interface SharedProfile {
  kind: 'nct-profile';
  schema: 1;
  /** when the share was made (ISO) */
  createdAt: string;
  identity?: { name: string; picture: string | null };
  favourite?: { name: string; legends: string[]; chosen: boolean };
  headline?: {
    record: WLD;
    conceded: number;
    byTier: (WLD & { tier: BotTier })[];
    streak: { result: Result; n: number } | null;
    bestWinStreak: number;
    coach: { games: number; avgPct: number; grade: Grade } | null;
  };
  history?: SharedHistoryGame[];
  deckStats?: SharedDeckStat[];
  decks?: SharedDeck[];
}

const text = (s: string, max: number = SHARE_LIMITS.text) => cleanText(s, max);
const wld = (r: WLD): WLD => ({ games: r.games, wins: r.wins, losses: r.losses, draws: r.draws });

/** The main deck as [id, copies], in first-seen order. */
function cardCounts(main: readonly string[]): [string, number][] {
  const m = new Map<string, number>();
  for (const id of main) if (CARD_ID.test(id)) m.set(id, (m.get(id) ?? 0) + 1);
  return [...m.entries()].slice(0, SHARE_LIMITS.cardsPerDeck);
}

export interface ShareInput {
  profile: ProfileDoc;
  games: readonly PracticeGame[];
  lib: readonly LibraryDeck[];
  now?: string;
}

/** The deck the profile shows as favourite: the one chosen, else the most played (null when neither is known). */
export function favouriteDeck(profile: ProfileDoc, games: readonly PracticeGame[], lib: readonly LibraryDeck[]): { name: string; legends: string[]; file: string | null; chosen: boolean } | null {
  if (profile.favourite) {
    const d = lib.find((x) => x.file === profile.favourite);
    if (d) return { name: d.deck.name, legends: d.deck.legends, file: d.file, chosen: true };
  }
  const name = mostPlayed(games);
  if (!name) return null;
  const d = lib.find((x) => x.deck.name === name);
  return { name, legends: d?.deck.legends ?? [], file: d?.file ?? null, chosen: false };
}

/**
 * The shared document: only the public sections, each built from its own data alone. A private section contributes
 * nothing at all, not even to another section's summary.
 */
export function buildShared({ profile, games, lib, now = new Date().toISOString() }: ShareInput): SharedProfile {
  const pub = profile.public;
  const out: SharedProfile = { kind: SHARE_KIND, schema: SHARE_SCHEMA, createdAt: now };
  if (pub.identity) out.identity = { name: text(profile.name, NAME_MAX), picture: profile.picture && CARD_ID.test(profile.picture) ? profile.picture : null };
  if (pub.favourite) {
    const f = favouriteDeck(profile, games, lib);
    if (f) out.favourite = { name: text(f.name), legends: f.legends.filter((id) => CARD_ID.test(id)).slice(0, 3), chosen: f.chosen };
  }
  if (pub.headline) {
    const h = headline(games);
    out.headline = { record: wld(h.record), conceded: h.conceded, byTier: h.byTier.map((t) => ({ tier: t.tier, ...wld(t) })), streak: h.streak, bestWinStreak: h.bestWinStreak, coach: h.coach };
  }
  if (pub.history)
    out.history = newestFirst(games)
      .slice(0, SHARE_LIMITS.history)
      .map((g) => ({
        date: g.date,
        deck: text(g.deck),
        opp: text(g.opp),
        tier: botTier(g.level),
        result: g.result,
        turns: g.turns,
        first: g.first,
        gigs: g.gigs ?? null,
        conceded: !!g.conceded,
        grade: g.coach?.grade ?? null,
      }));
  if (pub.deckStats)
    out.deckStats = deckStatRows(games)
      .slice(0, SHARE_LIMITS.deckStats)
      .map((r) => ({
        deck: text(r.deck),
        ...wld(r),
        first: wld(r.first),
        second: wld(r.second),
        avgTurns: r.avgTurns === null ? null : Math.round(r.avgTurns * 10) / 10,
        last: r.last,
        byOpp: r.byOpp.slice(0, SHARE_LIMITS.byOpp).map((o) => ({ opp: text(o.opp), ...wld(o) })),
        byTier: r.byTier.map((t) => ({ tier: t.tier, ...wld(t) })),
      }));
  if (pub.decks) {
    const byFile = new Map(lib.map((d) => [d.file, d]));
    out.decks = myDecks(lib)
      .slice(0, SHARE_LIMITS.decks)
      .map((d) => ({ name: text(d.name), group: d.group, legends: d.legends.filter((id) => CARD_ID.test(id)).slice(0, 3), cards: cardCounts(byFile.get(d.file)?.deck.main ?? []), added: d.added }));
  }
  return out;
}

/** The sections a shared document carries. */
export const sharedSections = (p: SharedProfile): ProfileSection[] => PROFILE_SECTIONS.filter((k) => p[k] !== undefined);

// ---------- reading a shared document back (untrusted) ----------

export type ParseResult = { ok: true; profile: SharedProfile } | { ok: false; why: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const nat = (v: unknown, max = 1e6): number | null => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= max ? v : null);
const RESULTS: readonly Result[] = ['win', 'loss', 'draw'];
const GRADES: readonly Grade[] = ['A', 'B', 'C', 'D'];
const isResult = (v: unknown): v is Result => RESULTS.includes(v as Result);
const isGrade = (v: unknown): v is Grade => GRADES.includes(v as Grade);
const isTier = (v: unknown): v is BotTier => BOT_TIERS.includes(v as BotTier);
const date = (v: unknown): string => (typeof v === 'string' && v.length <= 40 && !Number.isNaN(Date.parse(v)) ? v : '');
const str = (v: unknown, max: number = SHARE_LIMITS.text) => cleanText(v, max);
const ids = (v: unknown, max: number) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && CARD_ID.test(x)).slice(0, max) : []);
const list = <T>(v: unknown, max: number, f: (x: unknown) => T | null): T[] => (Array.isArray(v) ? v.slice(0, max).map(f).filter((x): x is T => x !== null) : []);

function readWLD(v: unknown): WLD | null {
  if (!isObj(v)) return null;
  const games = nat(v.games);
  const wins = nat(v.wins);
  const losses = nat(v.losses);
  const draws = nat(v.draws);
  if (games === null || wins === null || losses === null || draws === null || wins + losses + draws !== games) return null;
  return { games, wins, losses, draws };
}
const readTierRow = (v: unknown) => {
  const r = readWLD(v);
  return r && isObj(v) && isTier(v.tier) ? { tier: v.tier, ...r } : null;
};

function readHistory(v: unknown): SharedHistoryGame | null {
  if (!isObj(v) || !isResult(v.result)) return null;
  const deck = str(v.deck);
  const opp = str(v.opp);
  if (!deck) return null;
  const g0 = Array.isArray(v.gigs) && v.gigs.length === 2 ? nat(v.gigs[0], 99) : null;
  const g1 = Array.isArray(v.gigs) && v.gigs.length === 2 ? nat(v.gigs[1], 99) : null;
  return {
    date: date(v.date),
    deck,
    opp,
    tier: isTier(v.tier) ? v.tier : 'other',
    result: v.result,
    turns: nat(v.turns, 999) ?? 0,
    first: v.first === true,
    gigs: g0 !== null && g1 !== null ? [g0, g1] : null,
    conceded: v.conceded === true && v.result === 'loss',
    grade: isGrade(v.grade) ? v.grade : null,
  };
}

function readDeckStat(v: unknown): SharedDeckStat | null {
  const r = readWLD(v);
  if (!r || !isObj(v)) return null;
  const deck = str(v.deck);
  if (!deck) return null;
  const avg = typeof v.avgTurns === 'number' && Number.isFinite(v.avgTurns) && v.avgTurns >= 0 && v.avgTurns < 1000 ? v.avgTurns : null;
  return {
    deck,
    ...r,
    first: readWLD(v.first) ?? { games: 0, wins: 0, losses: 0, draws: 0 },
    second: readWLD(v.second) ?? { games: 0, wins: 0, losses: 0, draws: 0 },
    avgTurns: avg,
    last: date(v.last),
    byOpp: list(v.byOpp, SHARE_LIMITS.byOpp, (o) => {
      const w = readWLD(o);
      return w && isObj(o) && str(o.opp) ? { opp: str(o.opp), ...w } : null;
    }),
    byTier: list(v.byTier, BOT_TIERS.length, readTierRow),
  };
}

function readDeck(v: unknown): SharedDeck | null {
  if (!isObj(v)) return null;
  const name = str(v.name);
  if (!name) return null;
  return {
    name,
    group: MY_DECK_GROUPS.includes(v.group as MyDeckGroup) ? (v.group as MyDeckGroup) : 'unrecorded',
    legends: ids(v.legends, 3),
    cards: list(v.cards, SHARE_LIMITS.cardsPerDeck, (c) => (Array.isArray(c) && typeof c[0] === 'string' && CARD_ID.test(c[0]) && nat(c[1], 60) ? ([c[0], c[1]] as [string, number]) : null)),
    added: date(v.added) || null,
  };
}

/** Check a shared document and keep only what is well-formed (never throws). */
export function parseShared(v: unknown): ParseResult {
  if (!isObj(v) || v.kind !== SHARE_KIND) return { ok: false, why: 'This is not a shared Night City Trainer profile.' };
  if (typeof v.schema !== 'number' || !Number.isInteger(v.schema) || v.schema < 1) return { ok: false, why: 'This shared profile is damaged: its version is missing.' };
  if (v.schema > SHARE_SCHEMA) return { ok: false, why: 'This shared profile was made by a newer version of the site, so it cannot be shown here. Reload the page to get the latest version.' };
  const p: SharedProfile = { kind: SHARE_KIND, schema: SHARE_SCHEMA, createdAt: date(v.createdAt) };
  if (isObj(v.identity)) p.identity = { name: str(v.identity.name, NAME_MAX), picture: typeof v.identity.picture === 'string' && CARD_ID.test(v.identity.picture) ? v.identity.picture : null };
  if (isObj(v.favourite) && str(v.favourite.name)) p.favourite = { name: str(v.favourite.name), legends: ids(v.favourite.legends, 3), chosen: v.favourite.chosen === true };
  if (isObj(v.headline)) {
    const h = v.headline;
    const record = readWLD(h.record);
    if (record) {
      const st = isObj(h.streak) && isResult(h.streak.result) && nat(h.streak.n) ? { result: h.streak.result, n: nat(h.streak.n)! } : null;
      const c = isObj(h.coach) && nat(h.coach.games) && nat(h.coach.avgPct, 100) !== null && isGrade(h.coach.grade) ? { games: nat(h.coach.games)!, avgPct: nat(h.coach.avgPct, 100)!, grade: h.coach.grade } : null;
      p.headline = { record, conceded: nat(h.conceded) ?? 0, byTier: list(h.byTier, BOT_TIERS.length, readTierRow), streak: st, bestWinStreak: nat(h.bestWinStreak) ?? 0, coach: c };
    }
  }
  if (Array.isArray(v.history)) p.history = list(v.history, SHARE_LIMITS.history, readHistory);
  if (Array.isArray(v.deckStats)) p.deckStats = list(v.deckStats, SHARE_LIMITS.deckStats, readDeckStat);
  if (Array.isArray(v.decks)) p.decks = list(v.decks, SHARE_LIMITS.decks, readDeck);
  return { ok: true, profile: p };
}

/** Parse a shared file's or link's JSON text. */
export function parseSharedText(json: string): ParseResult {
  if (json.length > DOC_MAX) return { ok: false, why: 'This shared profile is too large to open.' };
  try {
    return parseShared(JSON.parse(json));
  } catch {
    return { ok: false, why: 'This is not a shared profile: it is not readable JSON.' };
  }
}

// ---------- the link payload ----------

function toB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(s: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

const canCompress = () => typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, max: number): Promise<Uint8Array | null> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** The link payload: 'z' + base64url of the deflated JSON, or 'j' + base64url of the plain JSON where compression is missing. */
export async function encodeShared(p: SharedProfile): Promise<string> {
  const raw = new TextEncoder().encode(JSON.stringify(p));
  if (canCompress()) {
    const z = await pipe(raw, new CompressionStream('deflate-raw'), Infinity);
    if (z) return 'z' + toB64url(z);
  }
  return 'j' + toB64url(raw);
}

/** Read a link payload back (never throws). */
export async function decodeShared(payload: string): Promise<ParseResult> {
  const bad: ParseResult = { ok: false, why: 'This share link is damaged or incomplete. Ask for the link again, or for the profile file.' };
  if (!payload || payload.length > LINK_MAX * 2) return bad;
  const bytes = fromB64url(payload.slice(1));
  if (!bytes) return bad;
  let json: Uint8Array | null = null;
  try {
    if (payload[0] === 'j') json = bytes.length <= DOC_MAX ? bytes : null;
    else if (payload[0] === 'z') {
      if (!canCompress()) return { ok: false, why: 'This browser cannot unpack a share link. Ask for the profile file instead.' };
      json = await pipe(bytes, new DecompressionStream('deflate-raw'), DOC_MAX);
    }
  } catch {
    return bad;
  }
  if (!json) return bad;
  let s: string;
  try {
    s = new TextDecoder('utf-8', { fatal: true }).decode(json);
  } catch {
    return bad;
  }
  return parseSharedText(s);
}

/** The share link for a payload, or null when it is longer than LINK_MAX (share the file instead). */
export function shareLink(base: string, payload: string): string | null {
  return payload.length <= LINK_MAX ? `${base}#/u/${payload}` : null;
}

export const shareFileName = (p: SharedProfile) => `nct-profile-${(p.createdAt || new Date().toISOString()).slice(0, 10)}.json`;
