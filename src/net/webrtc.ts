// The WebRTC link (src/net/): one data channel between the two browsers, set up by hand with no signalling server.
// The host makes an offer and gets an invite code (its connection details, compressed); the guest opens it and gets a
// reply code; the host pastes the reply and the channel opens. Each code holds the session description with its
// network candidates (gathered before the code is shown, so there is nothing more to exchange). The STUN servers come
// from the site config (`multiplayer.iceServers`); none means same-network play only. Kept thin: the browser does the
// work, and the codes are the part that can be tested without one.
//
// What a code carries (sanitizeSdp, applied to every code made): only what a connection needs. Candidates that name a
// LAN or loopback address the browser did not hide are dropped (random `.local` names are kept; in same-network mode,
// with no STUN server, LAN addresses are kept because that is how the other device reaches you); the reflexive and
// relay candidates keep their address and port (a direct connection across networks needs your public address) but
// lose the `raddr`/`rport` that would name the address behind them; the `c=` line, the m-line's port and the origin
// are set to placeholders. Optionally every IPv6 candidate is left out. describeSignal says what is left, as data.
//
// Code formats (the first character):
//   "0" plain base64url of the JSON {k, s}       "1" deflate-raw, then base64url (both: older copies read these)
//   "2" locked with a phrase (codeLock.ts): base64url of the lock's header + AES-GCM of [0|1 + the JSON or its deflate]
//   "3" a private connection's code (relay only): base64url of [0|1 + the JSON or its deflate]
// A private connection's locked codes are "2" with their own purposes ('rtc-offer-relay', 'rtc-answer-relay'). The
// JSON is { k: 'o' | 'a', s: sdp }; readers ignore other fields, so a meaning an older copy must not ignore (relay
// only) has its own prefix and purposes: an older copy refuses those codes as "not a code" and never connects directly.
// Other digits are kept for later formats ("made by a newer version of the site"); "r…" is the relay server's invite
// (relayTransport.ts), which has no session description at all.
//
// A private connection ("Private connection" in the lobby; ConnectOptions.relay): the browser is told to use only TURN
// relays (iceTransportPolicy 'relay'), both codes keep only relay candidates and are marked as private, and the host
// refuses a reply holding any other candidate. The other player then sees only the relay's address; the relay's
// operator sees both players' addresses (not the game: the data channel is encrypted, DTLS).
import type { TurnServer } from '../lib/siteConfig';
import { lockAvailable, lockBytes, lockedPurpose, keyFromPhrase, unlockBytes, WRONG_PHRASE, type CodeKey, type LockPurpose } from './codeLock';
import { Reassembler, splitMessage } from './framing';
import type { LinkState, Transport } from './transport';

export { CHUNK, MAX_HELD, MAX_IN_FLIGHT, MAX_JOINED, MAX_PIECES, PIECE_TTL_MS, Reassembler } from './framing';

/** What a code carries. */
export interface Signal {
  /** 'o' an invite (offer), 'a' a reply (answer) */
  k: 'o' | 'a';
  sdp: string;
  /** a private connection's code: relay candidates only, and the other side must relay too */
  relayOnly?: boolean;
}

/** Codes over this length don't go in a link (the invite is then copied as a code). */
export const MAX_LINK_CODE = 1800;
/** How long to wait for the network candidates before making the code with what there is. */
const GATHER_MS = 5000;
/** A code (or a pasted text holding one) longer than this is refused unread. */
export const MAX_CODE = 20_000;
/** A code's JSON, unpacked, at most (the SDP inside is capped at MAX_CODE). */
const MAX_JSON = 60_000;

/** Bytes as base64url (no padding), and back (shared with relayTransport.ts). */
export const b64url = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
export const unb64url = (s: string) => {
  const t = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(t.length);
  for (let i = 0; i < t.length; i++) out[i] = t.charCodeAt(i);
  return out;
};

/** Run bytes through a (de)compression stream, stopping with an error past `cap` bytes out. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, cap = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > cap) {
      void reader.cancel().catch(() => undefined);
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

// ---------------------------------------------------------------- what goes in a code

/** How a code is cleaned (sanitizeSdp). */
export interface SanitizeOptions {
  /** no STUN server: same-network play, so the LAN addresses the browser shows are kept (they are the way in) */
  sameNetwork?: boolean;
  /** leave out every IPv6 candidate */
  dropIpv6?: boolean;
  /** keep only relay candidates (a relayed connection: the codes name the relay, never a player) */
  relayOnly?: boolean;
}

const CANDIDATE = /^a=candidate:(\S+) (\d+) (\S+) (\d+) (\S+) (\d+) typ (\S+)(.*)$/i;
const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export type AddressKind = 'mdns' | 'loopback' | 'lan' | 'public' | 'other';

/** What kind of address a candidate names: a random mDNS name, loopback/unspecified, a LAN address, public, or a name. */
export function addressKind(addr: string): AddressKind {
  const a = addr.toLowerCase().replace(/^\[|\]$/g, '');
  if (a.endsWith('.local')) return 'mdns';
  const v4 = a.match(IPV4) ?? a.match(/^::ffff:(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [p, q] = [Number(v4[1]), Number(v4[2])];
    if (p === 127 || p === 0) return 'loopback';
    if (p === 10 || (p === 172 && q >= 16 && q <= 31) || (p === 192 && q === 168) || (p === 169 && q === 254) || (p === 100 && q >= 64 && q <= 127)) return 'lan';
    return 'public';
  }
  if (a.includes(':')) {
    if (a === '::' || a === '::1') return 'loopback';
    if (/^f[cd]/.test(a) || /^fe[89ab]/.test(a)) return 'lan';
    return 'public';
  }
  return 'other';
}
const isV6 = (addr: string) => addr.includes(':') && !/^::ffff:\d/i.test(addr);

/**
 * The session description with only what a connection needs (see the top of this file). Lines are kept in order; a
 * dropped candidate is simply left out. Pure: the same text in gives the same text out.
 */
export function sanitizeSdp(sdp: string, o: SanitizeOptions = {}): string {
  const out: string[] = [];
  for (const line of sdp.split(/\r?\n/)) {
    if (!line) continue;
    if (/^a=(extmap-allow-mixed|msid-semantic)/.test(line)) continue;
    if (/^c=IN IP[46] /.test(line)) {
      out.push('c=IN IP4 0.0.0.0');
      continue;
    }
    if (/^o=/.test(line)) {
      out.push(line.replace(/ IN IP[46] \S+$/, ' IN IP4 127.0.0.1'));
      continue;
    }
    if (/^m=application \d+ /.test(line)) {
      out.push(line.replace(/^m=application \d+ /, 'm=application 9 '));
      continue;
    }
    if (/^a=rtcp:/.test(line)) {
      out.push('a=rtcp:9 IN IP4 0.0.0.0');
      continue;
    }
    if (/^a=candidate:/i.test(line)) {
      const m = line.match(CANDIDATE);
      if (!m) continue;
      const addr = m[5]!;
      const type = m[7]!.toLowerCase();
      if (o.dropIpv6 && isV6(addr)) continue;
      if (o.relayOnly && type !== 'relay') continue;
      const kind = addressKind(addr);
      if (type === 'host') {
        if (kind === 'mdns' || (o.sameNetwork && (kind === 'lan' || kind === 'public'))) out.push(line);
        continue;
      }
      if (type === 'srflx' || type === 'prflx' || type === 'relay') {
        if (kind === 'loopback' || kind === 'mdns') continue;
        // the address behind a reflexive or relay candidate (your LAN address, or your public one behind a relay)
        out.push(line.replace(/ raddr \S+ rport \d+/i, isV6(addr) ? ' raddr :: rport 0' : ' raddr 0.0.0.0 rport 0'));
      }
      continue;
    }
    out.push(line);
  }
  return out.join('\r\n').concat('\r\n');
}

/** The SDP lines a data channel needs, unchanged otherwise (kept for older callers: sanitizeSdp does more). */
export function trimSdp(sdp: string): string {
  const drop = /^a=(extmap-allow-mixed|msid-semantic)/;
  return sdp
    .split(/\r?\n/)
    .filter((l) => l && !drop.test(l))
    .join('\r\n')
    .concat('\r\n');
}

/** What a code reveals to whoever reads it. */
export interface SignalInfo {
  /** locked with a phrase: without it the code shows nothing (the rest says what it shows with the phrase, when known) */
  locked: boolean;
  /** opened (an unlocked code, or a locked one read with its phrase): the lists below are filled in */
  readable: boolean;
  /** random `.local` names standing in for this device's addresses (reveal nothing) */
  mdns: number;
  /** LAN addresses (only kept in same-network mode) */
  lan: string[];
  /** public internet addresses (reflexive candidates, or a host candidate in same-network mode) */
  publicV4: string[];
  publicV6: string[];
  /** relay addresses (a relay server's, not a player's) */
  relay: string[];
  /** candidates of any kind */
  candidates: number;
}

/** What a session description reveals. */
export function describeSdp(sdp: string, locked = false): SignalInfo {
  const info: SignalInfo = { locked, readable: true, mdns: 0, lan: [], publicV4: [], publicV6: [], relay: [], candidates: 0 };
  const add = (list: string[], a: string) => void (list.includes(a) || list.push(a));
  for (const line of sdp.split(/\r?\n/)) {
    const m = line.match(CANDIDATE);
    if (!m) continue;
    info.candidates++;
    const addr = m[5]!;
    const type = m[7]!.toLowerCase();
    const kind = addressKind(addr);
    if (type === 'relay') add(info.relay, addr);
    else if (kind === 'mdns') info.mdns++;
    else if (kind === 'lan') add(info.lan, addr);
    else if (kind === 'public') add(isV6(addr) ? info.publicV6 : info.publicV4, addr);
  }
  return info;
}

/** What a code reveals: opened with `phrase` when it is locked and one is given, else only that it is locked. */
export async function describeSignal(code: string, phrase?: string): Promise<SignalInfo | null> {
  const c = cleanCode(code);
  if (!c) return null;
  if (c[0] === '2') {
    if (!phrase) return { locked: true, readable: false, mdns: 0, lan: [], publicV4: [], publicV6: [], relay: [], candidates: 0 };
    const r = await openCode(c, ['o', 'a'], phrase);
    return r.ok ? describeSdp(r.signal.sdp, true) : null;
  }
  const s = (await decodeSignal(c, 'o')) ?? (await decodeSignal(c, 'a'));
  return s ? describeSdp(s.sdp) : null;
}

/** One line in plain words under a code: what it holds, and who can read it. */
export function describeText(info: SignalInfo): string {
  if (!info.readable) return 'Locked: without the phrase, nobody can read anything in this code.';
  const items: string[] = [];
  if (info.publicV4.length) items.push('public internet address');
  if (info.publicV6.length) items.push('IPv6 address (it can name the device itself)');
  if (info.lan.length) items.push('address on the local network');
  const own = items.length ? `your ${items.length === 1 ? items[0] : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`}` : '';
  const relay = info.relay.length ? (own ? "a relay server's address" : "only a relay server's address (nothing that names you)") : '';
  const addresses = [own, relay].filter(Boolean).join(' and ');
  const what = addresses || (info.mdns ? 'only a random name standing in for this device (no internet address)' : 'no way to reach you (no network address was found, so connecting will likely fail)');
  if (info.locked) return `Locked: without the phrase, nobody can read this code. With it, it shows ${what}.`;
  return `This code shows ${what}${own ? ': anyone who sees it can read that, so send it privately' : ''}.`;
}

// ---------------------------------------------------------------- codes

async function packJson(s: Signal, o: SanitizeOptions): Promise<{ bytes: Uint8Array; deflated: boolean; sdp: string }> {
  const sdp = sanitizeSdp(s.sdp, s.relayOnly ? { ...o, relayOnly: true } : o);
  const raw = new TextEncoder().encode(JSON.stringify({ k: s.k, s: sdp }));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return { bytes: await pipe(raw, new CompressionStream('deflate-raw')), deflated: true, sdp };
    } catch {
      /* fall through to plain */
    }
  }
  return { bytes: raw, deflated: false, sdp };
}

const withFlag = (p: { bytes: Uint8Array; deflated: boolean }) => {
  const inner = new Uint8Array(p.bytes.length + 1);
  inner[0] = p.deflated ? 1 : 0;
  inner.set(p.bytes, 1);
  return inner;
};

/** The purpose a locked code of this kind is sealed for. */
const purposeFor = (s: Pick<Signal, 'k' | 'relayOnly'>): LockPurpose => (s.relayOnly ? (s.k === 'o' ? 'rtc-offer-relay' : 'rtc-answer-relay') : s.k === 'o' ? 'rtc-offer' : 'rtc-answer');
const RTC_PURPOSES: Partial<Record<LockPurpose, { k: Signal['k']; relayOnly: boolean }>> = {
  'rtc-offer': { k: 'o', relayOnly: false },
  'rtc-answer': { k: 'a', relayOnly: false },
  'rtc-offer-relay': { k: 'o', relayOnly: true },
  'rtc-answer-relay': { k: 'a', relayOnly: true },
};

/**
 * A signal as an unlocked code: "1" + deflate + base64url where the browser can compress, else "0" + base64url; a
 * private connection's code is "3" + base64url of [0|1 + the JSON or its deflate]. The description is cleaned first
 * (sanitizeSdp; relay candidates only for a private connection), so the code carries only what a connection needs.
 */
export async function encodeSignal(s: Signal, o: SanitizeOptions = {}): Promise<string> {
  const p = await packJson(s, o);
  if (s.relayOnly) return `3${b64url(withFlag(p))}`;
  return `${p.deflated ? '1' : '0'}${b64url(p.bytes)}`;
}

/** A signal as a locked code ("2"): only someone with the phrase (the key made from it) can read it. */
export async function encodeLockedSignal(s: Signal, key: CodeKey, o: SanitizeOptions = {}): Promise<string> {
  const p = await packJson(s, o);
  return `2${b64url(await lockBytes(withFlag(p), key, purposeFor(s)))}`;
}

/** The code with spaces and line breaks taken out, or '' when it can't be one (any digit first: see KNOWN_FORMATS). */
function cleanCode(code: string): string {
  if (code.length > MAX_CODE * 2) return '';
  const c = code.trim().replace(/\s+/g, '');
  return c.length >= 10 && c.length <= MAX_CODE && /^[0-9][A-Za-z0-9_-]+$/.test(c) ? c : '';
}
/** The formats this version reads (a code starting with another digit was made by a newer version of the site). */
const KNOWN_FORMATS = '0123';

async function readJson(bytes: Uint8Array, deflated: boolean, want: Signal['k'], relayOnly = false): Promise<Signal | null> {
  const b = deflated ? await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON) : bytes;
  if (b.length > MAX_JSON) return null;
  const v = JSON.parse(new TextDecoder().decode(b)) as { k?: unknown; s?: unknown };
  if (!v || v.k !== want || typeof v.s !== 'string' || !v.s.startsWith('v=0') || v.s.length > MAX_CODE) return null;
  return relayOnly ? { k: want, sdp: v.s, relayOnly: true } : { k: want, sdp: v.s };
}

/** An unlocked code back to its signal, or null when it is not one (pasted wrong, cut short, locked, or not a code). */
export async function decodeSignal(code: string, want: Signal['k']): Promise<Signal | null> {
  const c = cleanCode(code);
  if (!c || !'013'.includes(c[0]!)) return null;
  try {
    const bytes = unb64url(c.slice(1));
    if (c[0] === '3') return bytes.length > 1 && bytes[0]! <= 1 ? await readJson(bytes.slice(1), bytes[0] === 1, want, true) : null;
    return await readJson(bytes, c[0] === '1', want);
  } catch {
    return null;
  }
}

/** Whether a code (or link) is locked with a phrase. */
export function isLockedCode(text: string): boolean {
  return cleanCode(codeFromText(text))[0] === '2';
}

/** How an invite connects, read without opening it (a locked code's purpose is in its header, in the clear). */
export type InviteMode = 'direct' | 'private' | 'relay';

/**
 * What an invite (link or code) asks for: a direct connection, a private one (relay only), or the relay server's room
 * (relayTransport.ts); 'newer' when it was made by a newer version of the site; null when it is not an invite.
 */
export function inviteMode(text: string): InviteMode | 'newer' | null {
  const raw = codeFromText(text).replace(/\s+/g, '');
  if (/^r[0-9]/.test(raw)) return raw[1] === '1' ? 'relay' : 'newer';
  const c = cleanCode(raw);
  if (!c) return null;
  if (!KNOWN_FORMATS.includes(c[0]!)) return 'newer';
  if (c[0] === '3') return 'private';
  if (c[0] !== '2') return 'direct';
  try {
    const p = lockedPurpose(unb64url(c.slice(1)));
    return p === 'rtc-offer' ? 'direct' : p === 'rtc-offer-relay' ? 'private' : p === 'relay-invite' ? 'relay' : null;
  } catch {
    return null;
  }
}

export type OpenWhy = 'not-code' | 'kind' | 'locked' | 'phrase' | 'unsupported' | 'newer';
export type OpenResult = { ok: true; signal: Signal; key: CodeKey | null } | { ok: false; why: OpenWhy };

/**
 * Any code back to its signal: an unlocked one as decodeSignal, a locked one with its phrase (or the key already made,
 * when the host opens the reply to its own invite). `want` is the kind (or kinds) expected. The signal says whether it
 * is a private connection's code (`relayOnly`).
 */
export async function openCode(code: string, want: Signal['k'] | readonly Signal['k'][], with_?: string | CodeKey | null): Promise<OpenResult> {
  const c = cleanCode(code);
  if (!c) return { ok: false, why: 'not-code' };
  if (!KNOWN_FORMATS.includes(c[0]!)) return { ok: false, why: 'newer' };
  const kinds = typeof want === 'string' ? [want] : want;
  if (c[0] !== '2') {
    for (const k of kinds) {
      const s = await decodeSignal(c, k);
      if (s) return { ok: true, signal: s, key: null };
    }
    const other = (await decodeSignal(c, 'o')) ?? (await decodeSignal(c, 'a'));
    return { ok: false, why: other ? 'kind' : 'not-code' };
  }
  if (!lockAvailable()) return { ok: false, why: 'unsupported' };
  let bytes: Uint8Array;
  try {
    bytes = unb64url(c.slice(1));
  } catch {
    return { ok: false, why: 'not-code' };
  }
  const purpose = lockedPurpose(bytes);
  const what = purpose ? RTC_PURPOSES[purpose] : undefined;
  if (!purpose || !what) return { ok: false, why: 'not-code' };
  if (!kinds.includes(what.k)) return { ok: false, why: 'kind' };
  if (!with_) return { ok: false, why: 'locked' };
  const r = await unlockBytes(bytes, with_, purpose);
  if (!r.ok) return { ok: false, why: r.why === 'phrase' ? 'phrase' : 'not-code' };
  try {
    const s = await readJson(r.plain.slice(1), r.plain[0] === 1, what.k, what.relayOnly);
    return s ? { ok: true, signal: s, key: r.key } : { ok: false, why: 'not-code' };
  } catch {
    return { ok: false, why: 'not-code' };
  }
}

/** The invite's code from a link (#/play/join/<code>) or the code itself, pasted. */
export function codeFromText(text: string): string {
  const t = text.trim();
  const m = t.match(/#\/play\/join\/([A-Za-z0-9_-]+)/);
  return m ? m[1]! : t;
}

// ---------------------------------------------------------------- the channel

function waitForCandidates(pc: RTCPeerConnection): Promise<void> {
  if (pc.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((res) => {
    const t = setTimeout(res, GATHER_MS);
    pc.addEventListener('icegatheringstatechange', () => {
      if (pc.iceGatheringState === 'complete') {
        clearTimeout(t);
        res();
      }
    });
  });
}

/** One data channel as a Transport. Long messages go in pieces ("<id>|<k>|<n>|" + piece) and are joined on arrival. */
class ChannelTransport implements Transport {
  onMessage: ((text: string) => void) | null = null;
  onState: ((s: LinkState) => void) | null = null;
  state: LinkState = 'connecting';
  private joiner = new Reassembler();
  private seq = 0;
  constructor(
    private pc: RTCPeerConnection,
    private ch: RTCDataChannel,
  ) {
    ch.onopen = () => this.set('open');
    ch.onclose = () => this.set('closed');
    ch.onerror = () => this.set('closed');
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') this.set('closed');
    });
    ch.onmessage = (e: MessageEvent) => {
      if (typeof e.data !== 'string') return;
      this.piece(e.data);
    };
    if (ch.readyState === 'open') this.state = 'open';
  }
  private set(s: LinkState) {
    if (this.state === s || this.state === 'closed') return;
    this.state = s;
    this.onState?.(s);
  }
  private piece(data: string) {
    if (data[0] !== '~') {
      this.onMessage?.(data);
      return;
    }
    const whole = this.joiner.push(data);
    if (whole !== null) this.onMessage?.(whole);
  }
  send(text: string) {
    if (this.state !== 'open') return;
    try {
      const parts = splitMessage(text, this.seq++);
      if (!parts) return;
      for (const piece of parts) this.ch.send(piece);
    } catch {
      this.set('closed');
    }
  }
  close() {
    this.set('closed');
    try {
      this.ch.close();
      this.pc.close();
    } catch {
      /* already closed */
    }
  }
}

/**
 * How a connection is made: the STUN servers (empty = same network only), whether IPv6 candidates are left out, the
 * phrase that locks the invite (null = an unlocked code), and for a private connection the TURN relays to go through.
 */
export interface ConnectOptions {
  iceServers: readonly string[];
  dropIpv6?: boolean;
  /** host only: lock the invite with this phrase (the guest's reply is then locked with the same key) */
  phrase?: string | null;
  /** host: a private connection through these TURN relays (relay only; no STUN server is asked); null = direct */
  relay?: readonly TurnServer[] | null;
  /**
   * guest: the TURN relays for a private invite, asked only when the invite is one (null or absent: this copy of the
   * site has none, so a private invite is refused, never answered directly)
   */
  relayFor?: (() => Promise<readonly TurnServer[]>) | null;
  /** guest: false refuses a direct invite (the player did not choose to share their address); absent = allowed */
  directOk?: boolean;
}

/** The browser's configuration: STUN for a direct connection; for a private one, the TURN relays and relay only. */
export function rtcConfig(o: Pick<ConnectOptions, 'iceServers'>, relay?: readonly TurnServer[] | null): RTCConfiguration {
  if (relay)
    return {
      iceServers: relay.map((s) => ({ urls: [...s.urls], ...(s.username ? { username: s.username } : {}), ...(s.credential ? { credential: s.credential } : {}) })),
      iceTransportPolicy: 'relay',
    };
  return { iceServers: o.iceServers.length ? [{ urls: [...o.iceServers] }] : [] };
}
const sanitizeFor = (o: ConnectOptions, relayOnly = false): SanitizeOptions => (relayOnly ? { relayOnly: true, dropIpv6: !!o.dropIpv6 } : { sameNetwork: o.iceServers.length === 0, dropIpv6: !!o.dropIpv6 });

/** Candidates in a session description that are not relay candidates (a private connection's codes have none). */
export function nonRelayCandidates(sdp: string): number {
  let n = 0;
  for (const line of sdp.split(/\r?\n/)) {
    if (!/^a=candidate:/i.test(line)) continue;
    const m = line.match(CANDIDATE);
    if (!m || m[7]!.toLowerCase() !== 'relay') n++;
  }
  return n;
}

export const webrtcAvailable = () => typeof RTCPeerConnection !== 'undefined';

const NOT_REPLY = 'That is not a reply code. Ask your friend to copy the whole reply code again.';
/** No relay candidate was gathered: the code is not made, and nothing direct is tried. */
export const NO_RELAY_REACHED = 'Could not reach the relay server, so no code was made (no direct connection was tried). Try again in a moment; if it keeps failing, the relay may be down.';
export const NO_RELAY_HERE =
  'This invite asks for a private connection (through a relay), but this copy of the site has no relay set up, so no reply was made. Ask the host for a direct invite only if you are happy to share your address, or play a multi-day game.';
export const DIRECT_NOT_CHOSEN = 'This invite is for a direct connection, which shares your internet address with the host. Tick "Connect directly" to reply to it anyway, or ask the host for a private invite.';
export const NEWER_CODE = 'This code was made by a newer version of the site. Reload this page (or check that you both use the same site) and try again.';

/** The host's side: make the invite code, then take the guest's reply code. A private connection's reply must be one. */
export async function hostOffer(o: ConnectOptions): Promise<{ code: string; info: SignalInfo; transport: Transport; accept: (reply: string) => Promise<string | null> }> {
  // the key first (a second or two on a phone), so the network isn't asked until the player's code can be made
  const key = o.phrase ? await keyFromPhrase(o.phrase) : null;
  const relayOnly = !!o.relay;
  const pc = new RTCPeerConnection(rtcConfig(o, o.relay));
  const ch = pc.createDataChannel('nct', { ordered: true });
  const transport = new ChannelTransport(pc, ch);
  await pc.setLocalDescription(await pc.createOffer());
  await waitForCandidates(pc);
  const signal: Signal = { k: 'o', sdp: pc.localDescription?.sdp ?? '', ...(relayOnly ? { relayOnly: true } : {}) };
  const clean = sanitizeSdp(signal.sdp, sanitizeFor(o, relayOnly));
  if (relayOnly && !describeSdp(clean).relay.length) {
    transport.close();
    throw new Error(NO_RELAY_REACHED);
  }
  const code = key ? await encodeLockedSignal(signal, key, sanitizeFor(o, relayOnly)) : await encodeSignal(signal, sanitizeFor(o, relayOnly));
  const info = describeSdp(clean, !!key);
  const accept = async (reply: string): Promise<string | null> => {
    const r = await openCode(codeFromText(reply), 'a', key);
    if (!r.ok) {
      if (r.why === 'phrase' || r.why === 'locked') return 'This reply was locked for another invite. Ask your friend to open your newest invite and send its reply.';
      if (r.why === 'kind') return 'That is an invite, not a reply code. Paste the reply your friend sends back.';
      if (r.why === 'newer') return NEWER_CODE;
      return NOT_REPLY;
    }
    if (relayOnly && (!r.signal.relayOnly || nonRelayCandidates(r.signal.sdp) > 0))
      return 'This reply would connect directly (it is not a private reply, or it names an address other than a relay), so it was refused and nothing was connected. Ask your friend to open your newest invite on this site and send the reply it makes.';
    if (!relayOnly && r.signal.relayOnly) return 'That reply belongs to a private invite, not this one. Ask your friend to open your newest invite and send its reply.';
    try {
      await pc.setRemoteDescription({ type: 'answer', sdp: r.signal.sdp });
      return null;
    } catch (e) {
      return `The reply code could not be used (${(e as Error).message}). Make a new invite and try again.`;
    }
  };
  return { code, info, transport, accept };
}

/** Why an invite can't be opened, in plain words. */
export function inviteProblem(why: OpenWhy): string {
  switch (why) {
    case 'locked':
      return 'This invite is locked: type the phrase the host sent you.';
    case 'phrase':
      return WRONG_PHRASE;
    case 'kind':
      return 'That is a reply code, not an invite. Paste the invite the host sent you.';
    case 'unsupported':
      return "This browser can't open locked codes here (Web Crypto needs a secure page: https or localhost).";
    case 'newer':
      return NEWER_CODE;
    default:
      return 'That is not an invite code or link. Ask the host to copy it again.';
  }
}

/**
 * The guest's side: take the invite code (with the phrase when it is locked), make the reply code. A locked invite's
 * reply is locked with the same key. A private invite is answered privately (relay only, through this site's TURN
 * relays) or not at all.
 */
export async function guestAnswer(invite: string, o: ConnectOptions): Promise<{ code: string; info: SignalInfo; transport: Transport } | { error: string; why: OpenWhy | 'rtc' | 'no-relay' | 'direct' }> {
  const s = await openCode(codeFromText(invite), 'o', o.phrase ?? null);
  if (!s.ok) return { error: inviteProblem(s.why), why: s.why };
  const relayOnly = !!s.signal.relayOnly;
  let relay: readonly TurnServer[] | null = null;
  if (relayOnly) {
    if (!o.relayFor) return { error: NO_RELAY_HERE, why: 'no-relay' };
    try {
      relay = await o.relayFor();
    } catch (e) {
      return { error: (e as Error).message, why: 'no-relay' };
    }
    if (!relay.length) return { error: NO_RELAY_HERE, why: 'no-relay' };
  } else if (o.directOk === false) return { error: DIRECT_NOT_CHOSEN, why: 'direct' };
  const pc = new RTCPeerConnection(rtcConfig(o, relay));
  let transport: Transport | null = null;
  const ready = new Promise<Transport>((res) => {
    pc.ondatachannel = (e) => {
      transport = new ChannelTransport(pc, e.channel);
      res(transport);
    };
  });
  try {
    // a private invite: only its relay candidates are used, whatever else it holds
    await pc.setRemoteDescription({ type: 'offer', sdp: relayOnly ? sanitizeSdp(s.signal.sdp, { relayOnly: true }) : s.signal.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
  } catch (e) {
    pc.close();
    return { error: `The invite could not be used (${(e as Error).message}). Ask the host for a new one.`, why: 'rtc' };
  }
  await waitForCandidates(pc);
  const signal: Signal = { k: 'a', sdp: pc.localDescription?.sdp ?? '', ...(relayOnly ? { relayOnly: true } : {}) };
  const clean = sanitizeSdp(signal.sdp, sanitizeFor(o, relayOnly));
  if (relayOnly && !describeSdp(clean).relay.length) {
    pc.close();
    return { error: NO_RELAY_REACHED, why: 'no-relay' };
  }
  const code = s.key ? await encodeLockedSignal(signal, s.key, sanitizeFor(o, relayOnly)) : await encodeSignal(signal, sanitizeFor(o, relayOnly));
  const info = describeSdp(clean, !!s.key);
  // the channel object arrives once the host has the reply; until then a stand-in forwards to it
  return { code, info, transport: deferredTransport(ready, pc) };
}

/** A transport whose channel arrives later (the guest's, before the host has pasted the reply). */
function deferredTransport(ready: Promise<Transport>, pc: RTCPeerConnection): Transport {
  const t: Transport & { state: LinkState } = {
    onMessage: null,
    onState: null,
    state: 'connecting',
    send: () => undefined,
    close: () => {
      t.state = 'closed';
      pc.close();
    },
  };
  void ready.then((real) => {
    if (t.state === 'closed') {
      real.close();
      return;
    }
    real.onMessage = (x) => t.onMessage?.(x);
    real.onState = (s) => {
      t.state = s;
      t.onState?.(s);
    };
    t.send = (x) => real.send(x);
    t.close = () => {
      t.state = 'closed';
      real.close();
    };
    if (real.state === 'open') {
      t.state = 'open';
      t.onState?.('open');
    }
  });
  return t;
}
