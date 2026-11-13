// Turn packets of a multi-day game against a person (src/net/corr.ts): the messages two players send each other by any
// messenger, instead of over a live connection. A packet is plain JSON, signed and packed into one code:
//
//   code  = "T" + ("1" deflate | "0" plain) + base64url(bytes)
//   bytes = mac (64 hex, or "-" on the invite, made before there is a key) + the packet's JSON
//   or, for an invite or a reply locked with a phrase (codeLock.ts), "T2" + base64url(lock header + AES-GCM of
//   [0 plain | 1 deflate] + bytes as above): only someone with the phrase can read the key half inside
//
// The MAC is an HMAC-SHA-256 with a key both players make at the handshake (gameKey: from the host's key in the invite
// and the guest's key in its reply), over the exact JSON text, so a packet changed by hand, or one from another game,
// is refused. Each packet also carries its number in the game (`n`) and the MAC of the one before it (`p`): a packet
// opened twice, out of order, or made from another copy of the game is refused too (corr.ts checks the chain). Every
// field is checked on receipt and every text and list is capped (protocol.ts readers for the board, the decision and
// the record). A view is sent in full the first time and after that as a patch to the last view sent (`patch`, with a
// hash of the result so a patch applied to the wrong board is caught), with the new log lines only.
import type { Decision, GameState, LogEntry } from '../engine/types';
import { keyFromPhrase, lockAvailable, lockBytes, lockedHeader, unlockBytes, WRONG_PHRASE, type CodeKey, type LockPurpose } from './codeLock';
import { CAPS, readDeck, readDecision, readEnd, readRecord, readViewState, tryRead, type DeckMsg, type GameRecordMsg, type ViewMsg } from './protocol';

export const PACKET_KIND = 'nct-turn';
export const PACKET_VERSION = 1;
/** a code longer than this is refused unread */
export const MAX_CODE = 400_000;
/** the packet's JSON, unpacked, at most */
export const MAX_JSON = CAPS.hostMessage;
/** codes up to this length are offered as a link (the same limit as an online invite) */
export const MAX_LINK_PACKET = 1800;
/** chat lines riding in one packet */
export const PACKET_CHAT = 10;
/** at most this much extra time in one "give more time" (ms) */
export const MAX_GRANT = 30 * 86_400_000;

export type Side = 'h' | 'g';

/** A patch from one view to the next: values set at paths, then paths removed (arrays are replaced whole). */
export interface Patch {
  s: [string[], unknown][];
  r: string[][];
}

export interface InviteBody {
  t: 'invite';
  name: string;
  /** the host's deck name (only the name: the list stays on the host's device) */
  deck: string;
  days: number;
  /** the host's half of the game key */
  key: string;
  /** commitment to the host's roll secret (fair.ts) */
  commit: string;
  /** the rules engine's version on the host (SIM_VERSION) */
  sv: number;
}
export interface JoinBody {
  t: 'join';
  name: string;
  deck: DeckMsg;
  /** the guest's half of the game key */
  key: string;
  /** the guest's roll secret, shown at once: the host committed to its own before seeing it */
  nonce: string;
  /** if the roll picks the guest: go first */
  first: boolean;
  /** the host answers the guest's payment and effect-order choices the automatic way (fewer round trips) */
  auto: boolean;
}
export interface HostBody {
  t: 'move';
  /** first move only: the host's roll secret and who goes first (engine seat: 0 host, 1 guest) */
  roll?: { nonce: string; first: 0 | 1 };
  /** the guest's whole view (first packet, or when a patch would be longer) */
  view?: GameState;
  /** or the change from the last view sent, and a hash of the result (viewHash) */
  patch?: Patch;
  hash: string;
  /** log lines since the last packet, as the guest reads them */
  log: LogEntry[];
  /** the guest's decision now waiting, numbered as the host numbers it */
  decision: { seq: number; d: Decision } | null;
  /** whose decision the game waits on, from the guest's side: 0 the guest, 1 the host */
  waiting: 0 | 1 | null;
  /** how the game ended, from the guest's side (by: 0 the guest, 1 the host) */
  end: ViewMsg['end'];
  /** once the game is over: the full record (seed and both seats' answers) for the Game review */
  record?: GameRecordMsg;
  chat: string[];
  /** extra time the host gave the guest (ms) */
  grant?: number;
  /** the game stopped because of an error on the host's device */
  error?: string;
}
export interface GuestBody {
  t: 'answer';
  /** the answer to the decision the host sent (its seq and an option index) */
  a?: { seq: number; i: number };
  concede?: true;
  /** the host's clock ran out: the guest claims the win */
  claim?: true;
  chat: string[];
  /** extra time the guest gave the host (ms) */
  grant?: number;
}
export interface RefuseBody {
  t: 'refuse';
  why: string;
}
export type Body = InviteBody | JoinBody | HostBody | GuestBody | RefuseBody;

export interface Packet {
  k: typeof PACKET_KIND;
  v: typeof PACKET_VERSION;
  /** the game id (16 hex) */
  g: string;
  /** this packet's number in the game: the invite is 0 */
  n: number;
  /** the MAC of the packet before it ('' for the invite) */
  p: string;
  /** who made it */
  f: Side;
  /** when it was made, by the sender's clock (epoch ms) */
  t: number;
  b: Body;
}

/** A packet as read back: the packet, its MAC ('' when unsigned), and the exact JSON the MAC covers. */
export interface Opened {
  packet: Packet;
  mac: string;
  json: string;
}

// ---------------------------------------------------------------- bytes, codes and keys

const toHex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
export const randomHex = (bytes: number) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return toHex(b);
};

const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const unb64url = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > cap) {
      void reader.cancel();
      throw new Error('too long');
    }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** True when this browser can sign packets (Web Crypto: an https page or localhost). */
export const packetsAvailable = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof TextEncoder !== 'undefined';

/** The game's key, from the host's and the guest's halves (each 32 random bytes as hex). */
export async function gameKey(hostKey: string, guestKey: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`nct-corr:${hostKey}:${guestKey}`));
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

async function macOf(key: CryptoKey, json: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(json))));
}

/** The lock's purpose for a packet that may be locked (the invite and the guest's reply only). */
const lockPurpose = (b: Body): LockPurpose | null => (b.t === 'invite' ? 'corr-invite' : b.t === 'join' ? 'corr-join' : null);

/**
 * Pack a packet into its code: signed with `key` (null only for the invite). With `lock` (an invite or a reply only),
 * the code is locked with the phrase's key ("T2").
 */
export async function packPacket(p: Packet, key: CryptoKey | null, lock?: CodeKey | null): Promise<{ code: string; mac: string; json: string }> {
  const json = JSON.stringify(p);
  const mac = key ? await macOf(key, json) : '';
  const raw = new TextEncoder().encode((mac || '-') + json);
  let deflated: Uint8Array | null = null;
  if (typeof CompressionStream !== 'undefined') {
    try {
      deflated = await pipe(raw, new CompressionStream('deflate-raw'));
    } catch {
      /* plain */
    }
  }
  const purpose = lockPurpose(p.b);
  if (lock && purpose) {
    const body = deflated ?? raw;
    const inner = new Uint8Array(body.length + 1);
    inner[0] = deflated ? 1 : 0;
    inner.set(body, 1);
    return { code: `T2${b64url(await lockBytes(inner, lock, purpose))}`, mac, json };
  }
  return { code: deflated ? `T1${b64url(deflated)}` : `T0${b64url(raw)}`, mac, json };
}

/** The packet code inside a pasted link (#/play/turn/<code>), file text or code; '' when there is none. */
export function codeFromText(text: string): string {
  const t = text.trim();
  const m = t.match(/#\/play\/turn\/(T[012][A-Za-z0-9_-]+)/);
  if (m) return m[1]!;
  const c = t.replace(/\s+/g, '');
  return /^T[012][A-Za-z0-9_-]+$/.test(c) ? c : '';
}

/** A locked packet's header, read without the phrase: what it is (invite or reply) and its salt (hex); else null. */
export function lockedPacketInfo(text: string): { purpose: 'corr-invite' | 'corr-join'; salt: string } | null {
  const code = codeFromText(text);
  if (code[1] !== '2' || code.length > MAX_CODE) return null;
  try {
    const h = lockedHeader(unb64url(code.slice(2)));
    if (!h || (h.purpose !== 'corr-invite' && h.purpose !== 'corr-join')) return null;
    return { purpose: h.purpose, salt: toHex(h.salt) };
  } catch {
    return null;
  }
}

/** The reason openPacket gives a locked packet opened without its phrase. */
export const LOCKED_PACKET = 'This packet is locked with a phrase: type the phrase the other player sent you.';

/**
 * Unpack a code (not yet checking its MAC: that needs the game's key). Never throws. A locked code ("T2") needs the
 * phrase, or the key already made from it: `locked` says the phrase is missing or wrong, and `lock` is the key it
 * opened with (the guest locks its reply with the same one).
 */
export async function openPacket(text: string, unlock?: string | CodeKey | null): Promise<{ ok: true; value: Opened; lock: CodeKey | null } | { ok: false; why: string; locked?: true }> {
  if (text.length > MAX_CODE * 2) return { ok: false, why: 'This is far too long to be a turn packet.' };
  const code = codeFromText(text);
  if (!code) return { ok: false, why: 'This is not a turn packet (a link or code made by this site for a multi-day game).' };
  if (code.length > MAX_CODE) return { ok: false, why: 'This packet is too long.' };
  let s: string;
  let lock: CodeKey | null = null;
  try {
    let bytes = unb64url(code.slice(2));
    let deflated = code[1] === '1';
    if (code[1] === '2') {
      const info = lockedPacketInfo(code);
      if (!info) return { ok: false, why: 'This packet is not one this version reads (an unknown lock).' };
      if (!lockAvailable()) return { ok: false, why: "This browser can't open locked packets here (Web Crypto needs a secure page: https or localhost)." };
      if (!unlock) return { ok: false, why: LOCKED_PACKET, locked: true };
      const r = await unlockBytes(bytes, unlock, info.purpose);
      if (!r.ok) return { ok: false, why: WRONG_PHRASE, locked: true };
      lock = r.key;
      deflated = r.plain[0] === 1;
      bytes = r.plain.slice(1);
    }
    if (deflated) {
      if (typeof DecompressionStream === 'undefined') return { ok: false, why: 'This browser cannot unpack this packet (no DecompressionStream).' };
      bytes = await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON + 70);
    }
    s = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, why: 'This packet is damaged (cut short or changed while it was copied). Copy it again.' };
  }
  const mac = s.startsWith('-') ? '' : s.slice(0, 64);
  if (mac && !/^[0-9a-f]{64}$/.test(mac)) return { ok: false, why: 'This packet is damaged (its signature is missing).' };
  const json = s.slice(mac ? 64 : 1);
  if (json.length > MAX_JSON) return { ok: false, why: 'This packet is too long.' };
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, why: 'This packet is damaged (it is not readable).' };
  }
  const r = readPacket(raw);
  if (!r.ok) return { ok: false, why: `This packet is not one this version reads (${r.why}).` };
  if (!mac && r.value.b.t !== 'invite') return { ok: false, why: 'This packet is not signed, so it was not used.' };
  // a locked code must hold what its header says (an invite as an invite, a reply as a reply)
  if (lock && lockPurpose(r.value.b) !== lockedPacketInfo(code)?.purpose) return { ok: false, why: 'This packet is damaged (its lock does not fit what it holds).' };
  return { ok: true, value: { packet: r.value, mac, json }, lock };
}

/** Make the lock for a new invite from a phrase. */
export const packetLock = (phrase: string): Promise<CodeKey> => keyFromPhrase(phrase);

/** Whether `opened` was signed with `key` over its exact text. */
export async function checkMac(opened: Opened, key: CryptoKey): Promise<boolean> {
  if (!opened.mac) return false;
  const bytes = new Uint8Array(opened.mac.match(/../g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(opened.json));
}

// ---------------------------------------------------------------- reading a packet's fields

class Bad extends Error {}
const fail = (why: string): never => {
  throw new Bad(why);
};
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const obj = (v: unknown, what: string) => (isObj(v) ? v : fail(`${what} is not an object`));
function str(v: unknown, what: string, max: number, empty = false): string {
  if (typeof v !== 'string') return fail(`${what} is not text`);
  if (v.length > max) return fail(`${what} is longer than ${max}`);
  if (!empty && !v.length) return fail(`${what} is empty`);
  return v;
}
function int(v: unknown, what: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) return fail(`${what} is not a whole number from ${min} to ${max}`);
  return v;
}
const hex = (v: unknown, what: string, len: number) => {
  const s = str(v, what, len);
  return s.length === len && /^[0-9a-f]+$/.test(s) ? s : fail(`${what} is not ${len} hex digits`);
};
const bool = (v: unknown, what: string) => (typeof v === 'boolean' ? v : fail(`${what} is not true or false`));
const seat01 = (v: unknown, what: string): 0 | 1 => (v === 0 || v === 1 ? v : fail(`${what} is not 0 or 1`));
const reader = <T>(f: () => T, what: string): T => {
  const r = tryRead(f);
  return r.ok ? r.value : fail(`${what}: ${r.why}`);
};
const chatLines = (v: unknown) => (v === undefined ? [] : (Array.isArray(v) && v.length <= PACKET_CHAT ? v : fail('chat has too many lines')).map((x, i) => str(x, `chat[${i}]`, CAPS.chat)));
const grant = (v: unknown) => (v === undefined ? undefined : int(v, 'grant', 1, MAX_GRANT));
const SAFE_KEY = /^[A-Za-z0-9_:.-]{1,80}$/;
const BAD_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
function readPath(v: unknown, what: string): string[] {
  if (!Array.isArray(v) || v.length > 8) return fail(`${what} is not a path`);
  return v.map((k, i) => {
    const s = str(k, `${what}[${i}]`, 80);
    if (!SAFE_KEY.test(s) || BAD_KEYS.has(s)) fail(`${what}[${i}] is not a key`);
    return s;
  });
}
function readPatch(v: unknown): Patch {
  const p = obj(v, 'patch');
  if (!Array.isArray(p.s) || p.s.length > 20_000 || !Array.isArray(p.r) || p.r.length > 20_000) return fail('patch is not a patch');
  return {
    s: p.s.map((x, i) => {
      if (!Array.isArray(x) || x.length !== 2) return fail(`patch.s[${i}] is not a change`);
      return [readPath(x[0], `patch.s[${i}]`), JSON.parse(JSON.stringify(x[1] ?? null)) as unknown] as [string[], unknown];
    }),
    r: p.r.map((x, i) => readPath(x, `patch.r[${i}]`)),
  };
}
const readLog = (v: unknown) =>
  (Array.isArray(v) && v.length <= 2000 ? v : fail('log is not a list')).map((x, i): LogEntry => {
    const l = obj(x, `log[${i}]`);
    return { turn: int(l.turn, `log[${i}].turn`, 0, 10_000), player: l.player === null ? null : seat01(l.player, `log[${i}].player`), text: str(l.text, `log[${i}].text`, CAPS.logText, true) };
  });

function readBody(v: unknown, f: Side): Body {
  const b = obj(v, 'b');
  switch (b.t) {
    case 'invite':
      if (f !== 'h') fail('an invite comes from the host');
      return { t: 'invite', name: str(b.name, 'name', CAPS.name), deck: str(b.deck, 'deck', CAPS.deckName), days: int(b.days, 'days', 1, 366), key: hex(b.key, 'key', 64), commit: hex(b.commit, 'commit', 64), sv: int(b.sv, 'sv') };
    case 'join':
      if (f !== 'g') fail('a reply comes from the guest');
      return { t: 'join', name: str(b.name, 'name', CAPS.name), deck: reader(() => readDeck(b.deck), 'deck'), key: hex(b.key, 'key', 64), nonce: hex(b.nonce, 'nonce', 32), first: bool(b.first, 'first'), auto: bool(b.auto, 'auto') };
    case 'move': {
      if (f !== 'h') fail('a move packet comes from the host');
      if ((b.view === undefined) === (b.patch === undefined)) fail('a move packet has a view or a patch');
      const r = b.roll === undefined ? undefined : obj(b.roll, 'roll');
      const dec = b.decision === null ? null : obj(b.decision, 'decision');
      return {
        t: 'move',
        ...(r ? { roll: { nonce: hex(r.nonce, 'roll.nonce', 32), first: seat01(r.first, 'roll.first') } } : {}),
        ...(b.view !== undefined ? { view: reader(() => readViewState(b.view), 'view') } : {}),
        ...(b.patch !== undefined ? { patch: readPatch(b.patch) } : {}),
        hash: hex(b.hash, 'hash', 16),
        log: readLog(b.log),
        decision: dec ? { seq: int(dec.seq, 'decision.seq'), d: reader(() => readDecision(dec.d), 'decision') } : null,
        waiting: b.waiting === null ? null : seat01(b.waiting, 'waiting'),
        end: reader(() => readEnd(b.end), 'end'),
        ...(b.record !== undefined ? { record: reader(() => readRecord(b.record), 'record') } : {}),
        chat: chatLines(b.chat),
        ...(b.grant !== undefined ? { grant: grant(b.grant) } : {}),
        ...(b.error !== undefined ? { error: str(b.error, 'error', CAPS.why, true) } : {}),
      };
    }
    case 'answer': {
      if (f !== 'g') fail('an answer packet comes from the guest');
      const a = b.a === undefined ? undefined : obj(b.a, 'a');
      return {
        t: 'answer',
        ...(a ? { a: { seq: int(a.seq, 'a.seq'), i: int(a.i, 'a.i', 0, CAPS.options) } } : {}),
        ...(b.concede === true ? { concede: true } : {}),
        ...(b.claim === true ? { claim: true } : {}),
        chat: chatLines(b.chat),
        ...(b.grant !== undefined ? { grant: grant(b.grant) } : {}),
      };
    }
    case 'refuse':
      return { t: 'refuse', why: str(b.why, 'why', CAPS.why) };
    default:
      return fail(`unknown packet type ${JSON.stringify(b.t)?.slice(0, 30)}`);
  }
}

/** A packet's fields, checked and capped, as a fresh object. */
export function readPacket(v: unknown): { ok: true; value: Packet } | { ok: false; why: string } {
  try {
    const o = obj(v, 'packet');
    if (o.k !== PACKET_KIND) fail('not a turn packet');
    if (o.v !== PACKET_VERSION) fail(`packet version ${String(o.v)} (this site reads ${PACKET_VERSION})`);
    const f = o.f === 'h' || o.f === 'g' ? o.f : fail('f is not h or g');
    const n = int(o.n, 'n', 0, 1_000_000);
    return {
      ok: true,
      value: { k: PACKET_KIND, v: PACKET_VERSION, g: hex(o.g, 'g', 16), n, p: n === 0 ? str(o.p, 'p', 0, true) : hex(o.p, 'p', 64), f, t: int(o.t, 't', 0, 8.64e15), b: readBody(o.b, f) },
    };
  } catch (e) {
    if (e instanceof Bad) return { ok: false, why: e.message };
    throw e;
  }
}

// ---------------------------------------------------------------- views: patches and hashes

const isPlain = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** JSON with object keys sorted (the same value gives the same text whatever order its keys were made in). */
export function canonJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonJson).join(',')}]`;
  if (isPlain(v))
    return `{${Object.keys(v)
      .filter((k) => v[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonJson(v[k])}`)
      .join(',')}}`;
  return JSON.stringify(v) ?? 'null';
}

/** FNV-1a 32 twice over the canonical JSON: 16 hex digits. */
export function viewHash(v: unknown): string {
  const s = canonJson(v);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995);
    b ^= b >>> 15;
  }
  return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

/** The change from `a` to `b` (plain JSON values). */
export function diffView(a: unknown, b: unknown): Patch {
  const out: Patch = { s: [], r: [] };
  const walk = (x: unknown, y: unknown, path: string[]) => {
    if (isPlain(x) && isPlain(y)) {
      for (const k of Object.keys(x)) if (!(k in y) || y[k] === undefined) out.r.push([...path, k]);
      for (const k of Object.keys(y)) {
        if (y[k] === undefined) continue;
        if (!(k in x) || x[k] === undefined) out.s.push([[...path, k], y[k]]);
        else if (canonJson(x[k]) !== canonJson(y[k])) walk(x[k], y[k], [...path, k]);
      }
      return;
    }
    out.s.push([path, y]);
  };
  if (canonJson(a) !== canonJson(b)) walk(a, b, []);
  return out;
}

/** `base` with `patch` applied (a fresh copy; `base` is not changed). Throws on a path that does not fit. */
export function applyPatch<T>(base: T, patch: Patch): T {
  let root = JSON.parse(JSON.stringify(base)) as unknown;
  for (const [path, value] of patch.s) {
    if (!path.length) {
      root = JSON.parse(JSON.stringify(value));
      continue;
    }
    let o = root;
    for (const k of path.slice(0, -1)) {
      if (!isPlain(o)) throw new Error('the patch does not fit this board');
      if (!isPlain(o[k])) o[k] = {};
      o = o[k];
    }
    if (!isPlain(o)) throw new Error('the patch does not fit this board');
    o[path[path.length - 1]!] = JSON.parse(JSON.stringify(value));
  }
  for (const path of patch.r) {
    let o = root;
    for (const k of path.slice(0, -1)) o = isPlain(o) ? o[k] : undefined;
    if (isPlain(o)) delete o[path[path.length - 1]!];
  }
  return root as T;
}
