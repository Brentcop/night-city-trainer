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
// The JSON is { k: 'o' | 'a', s: sdp }; readers ignore other fields. A new meaning that an older copy must not ignore
// (a relay-only invite, say) needs a new prefix, not a new field.
import { lockAvailable, lockBytes, lockedPurpose, keyFromPhrase, unlockBytes, WRONG_PHRASE, type CodeKey } from './codeLock';
import type { LinkState, Transport } from './transport';

/** What a code carries. */
export interface Signal {
  /** 'o' an invite (offer), 'a' a reply (answer) */
  k: 'o' | 'a';
  sdp: string;
}

/** Codes over this length don't go in a link (the invite is then copied as a code). */
export const MAX_LINK_CODE = 1800;
/** A message over this size is sent in pieces (data channels differ in what they take in one message). */
export const CHUNK = 15_000;
/** How long to wait for the network candidates before making the code with what there is. */
const GATHER_MS = 5000;
/** A code (or a pasted text holding one) longer than this is refused unread. */
export const MAX_CODE = 20_000;
/** A code's JSON, unpacked, at most (the SDP inside is capped at MAX_CODE). */
const MAX_JSON = 60_000;

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
  const relay = info.relay.length ? "a relay server's address" : '';
  const addresses = [own, relay].filter(Boolean).join(' and ');
  const what = addresses || (info.mdns ? 'only a random name standing in for this device (no internet address)' : 'no way to reach you (no network address was found, so connecting will likely fail)');
  if (info.locked) return `Locked: without the phrase, nobody can read this code. With it, it shows ${what}.`;
  return `This code shows ${what}${own ? ': anyone who sees it can read that, so send it privately' : ''}.`;
}

// ---------------------------------------------------------------- codes

async function packJson(s: Signal, o: SanitizeOptions): Promise<{ bytes: Uint8Array; deflated: boolean; sdp: string }> {
  const sdp = sanitizeSdp(s.sdp, o);
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

/**
 * A signal as an unlocked code: "1" + deflate + base64url where the browser can compress, else "0" + base64url. The
 * description is cleaned first (sanitizeSdp), so the code carries only what a connection needs.
 */
export async function encodeSignal(s: Signal, o: SanitizeOptions = {}): Promise<string> {
  const p = await packJson(s, o);
  return `${p.deflated ? '1' : '0'}${b64url(p.bytes)}`;
}

/** A signal as a locked code ("2"): only someone with the phrase (the key made from it) can read it. */
export async function encodeLockedSignal(s: Signal, key: CodeKey, o: SanitizeOptions = {}): Promise<string> {
  const p = await packJson(s, o);
  const inner = new Uint8Array(p.bytes.length + 1);
  inner[0] = p.deflated ? 1 : 0;
  inner.set(p.bytes, 1);
  return `2${b64url(await lockBytes(inner, key, s.k === 'o' ? 'rtc-offer' : 'rtc-answer'))}`;
}

/** The code with spaces and line breaks taken out, or '' when it can't be one. */
function cleanCode(code: string): string {
  if (code.length > MAX_CODE * 2) return '';
  const c = code.trim().replace(/\s+/g, '');
  return c.length >= 10 && c.length <= MAX_CODE && /^[012][A-Za-z0-9_-]+$/.test(c) ? c : '';
}

async function readJson(bytes: Uint8Array, deflated: boolean, want: Signal['k']): Promise<Signal | null> {
  const b = deflated ? await pipe(bytes, new DecompressionStream('deflate-raw'), MAX_JSON) : bytes;
  if (b.length > MAX_JSON) return null;
  const v = JSON.parse(new TextDecoder().decode(b)) as { k?: unknown; s?: unknown };
  if (!v || v.k !== want || typeof v.s !== 'string' || !v.s.startsWith('v=0') || v.s.length > MAX_CODE) return null;
  return { k: want, sdp: v.s };
}

/** An unlocked code back to its signal, or null when it is not one (pasted wrong, cut short, locked, or not a code). */
export async function decodeSignal(code: string, want: Signal['k']): Promise<Signal | null> {
  const c = cleanCode(code);
  if (!c || c[0] === '2') return null;
  try {
    return await readJson(unb64url(c.slice(1)), c[0] === '1', want);
  } catch {
    return null;
  }
}

/** Whether a code (or link) is locked with a phrase. */
export function isLockedCode(text: string): boolean {
  return cleanCode(codeFromText(text))[0] === '2';
}

export type OpenResult = { ok: true; signal: Signal; key: CodeKey | null } | { ok: false; why: 'not-code' | 'kind' | 'locked' | 'phrase' | 'unsupported' };

/**
 * Any code back to its signal: an unlocked one as decodeSignal, a locked one with its phrase (or the key already made,
 * when the host opens the reply to its own invite). `want` is the kind (or kinds) expected.
 */
export async function openCode(code: string, want: Signal['k'] | readonly Signal['k'][], with_?: string | CodeKey | null): Promise<OpenResult> {
  const c = cleanCode(code);
  if (!c) return { ok: false, why: 'not-code' };
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
  if (purpose !== 'rtc-offer' && purpose !== 'rtc-answer') return { ok: false, why: 'not-code' };
  const k: Signal['k'] = purpose === 'rtc-offer' ? 'o' : 'a';
  if (!kinds.includes(k)) return { ok: false, why: 'kind' };
  if (!with_) return { ok: false, why: 'locked' };
  const r = await unlockBytes(bytes, with_, purpose);
  if (!r.ok) return { ok: false, why: r.why === 'phrase' ? 'phrase' : 'not-code' };
  try {
    const s = await readJson(r.plain.slice(1), r.plain[0] === 1, k);
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

/** Pieces of one message at most (CHUNK each: room for the largest host message, protocol.ts CAPS.hostMessage). */
export const MAX_PIECES = 110;
/** A joined message longer than this is dropped. */
export const MAX_JOINED = 1_600_000;
/** Messages being joined at once at most (the oldest is dropped), and how long one may wait for its pieces. */
export const MAX_IN_FLIGHT = 4;
export const PIECE_TTL_MS = 60_000;
/** Characters held in unjoined pieces at most (the oldest messages are dropped). */
export const MAX_HELD = 3_200_000;

/**
 * Joins the pieces of long messages ("~<id>|<k>|<n>|" + piece). Everything about a piece is checked before it is kept:
 * the count and index are bounded, a piece is at most CHUNK long, a message's pieces must agree on the count, and
 * what is held is capped in messages, characters and time, so a peer sending odd pieces can't stall or fill the page.
 */
export class Reassembler {
  private parts = new Map<string, { total: number; got: number; size: number; at: number; list: (string | undefined)[] }>();
  private held = 0;
  constructor(private now: () => number = Date.now) {}
  /** in flight now (tests) */
  get inFlight() {
    return this.parts.size;
  }
  get heldChars() {
    return this.held;
  }
  private drop(id: string) {
    const e = this.parts.get(id);
    if (!e) return;
    this.held -= e.size;
    this.parts.delete(id);
  }
  /** A piece arrived: the whole message once its last piece is in, else null. */
  push(data: string): string | null {
    const m = data.match(/^~(\d{1,9})\|(\d{1,4})\|(\d{1,4})\|/);
    if (!m) return null;
    const [, id, ks, ns] = m;
    const k = Number(ks);
    const total = Number(ns);
    const piece = data.slice(m[0].length);
    if (total < 1 || total > MAX_PIECES || k >= total || piece.length > CHUNK) return null;
    const t = this.now();
    for (const [key, e] of this.parts) if (t - e.at > PIECE_TTL_MS) this.drop(key);
    let e = this.parts.get(id!);
    if (e && e.total !== total) {
      this.drop(id!);
      return null;
    }
    if (!e) {
      while (this.parts.size >= MAX_IN_FLIGHT) this.drop(this.parts.keys().next().value!);
      e = { total, got: 0, size: 0, at: t, list: new Array<string | undefined>(total) };
      this.parts.set(id!, e);
    }
    if (e.list[k] !== undefined) return null;
    e.list[k] = piece;
    e.got++;
    e.size += piece.length;
    this.held += piece.length;
    while (this.held > MAX_HELD && this.parts.size) this.drop(this.parts.keys().next().value!);
    if (!this.parts.has(id!) || e.got < e.total) return null;
    this.drop(id!);
    const whole = e.list.join('');
    return whole.length > MAX_JOINED ? null : whole;
  }
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
      if (text.length <= CHUNK && text[0] !== '~') {
        this.ch.send(text);
        return;
      }
      const id = this.seq++;
      const n = Math.ceil(text.length / CHUNK);
      if (n > MAX_PIECES) return;
      for (let k = 0; k < n; k++) this.ch.send(`~${id}|${k}|${n}|${text.slice(k * CHUNK, (k + 1) * CHUNK)}`);
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
 * How a connection is made: the STUN servers (empty = same network only), whether IPv6 candidates are left out, and
 * the phrase that locks the invite (null = an unlocked code). Kept as one object so later modes (a relay-only private
 * connection with TURN servers) can be added beside these.
 */
export interface ConnectOptions {
  iceServers: readonly string[];
  dropIpv6?: boolean;
  /** host only: lock the invite with this phrase (the guest's reply is then locked with the same key) */
  phrase?: string | null;
}

const rtcConfig = (o: ConnectOptions): RTCConfiguration => ({ iceServers: o.iceServers.length ? [{ urls: [...o.iceServers] }] : [] });
const sanitizeFor = (o: ConnectOptions): SanitizeOptions => ({ sameNetwork: o.iceServers.length === 0, dropIpv6: !!o.dropIpv6 });

export const webrtcAvailable = () => typeof RTCPeerConnection !== 'undefined';

const NOT_REPLY = 'That is not a reply code. Ask your friend to copy the whole reply code again.';

/** The host's side: make the invite code, then take the guest's reply code. */
export async function hostOffer(o: ConnectOptions): Promise<{ code: string; info: SignalInfo; transport: Transport; accept: (reply: string) => Promise<string | null> }> {
  // the key first (a second or two on a phone), so the network isn't asked until the player's code can be made
  const key = o.phrase ? await keyFromPhrase(o.phrase) : null;
  const pc = new RTCPeerConnection(rtcConfig(o));
  const ch = pc.createDataChannel('nct', { ordered: true });
  const transport = new ChannelTransport(pc, ch);
  await pc.setLocalDescription(await pc.createOffer());
  await waitForCandidates(pc);
  const signal: Signal = { k: 'o', sdp: pc.localDescription?.sdp ?? '' };
  const code = key ? await encodeLockedSignal(signal, key, sanitizeFor(o)) : await encodeSignal(signal, sanitizeFor(o));
  const info = describeSdp(sanitizeSdp(signal.sdp, sanitizeFor(o)), !!key);
  const accept = async (reply: string): Promise<string | null> => {
    const r = await openCode(codeFromText(reply), 'a', key);
    if (!r.ok) {
      if (r.why === 'phrase' || r.why === 'locked') return 'This reply was locked for another invite. Ask your friend to open your newest invite and send its reply.';
      if (r.why === 'kind') return 'That is an invite, not a reply code. Paste the reply your friend sends back.';
      return NOT_REPLY;
    }
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
export function inviteProblem(why: Exclude<OpenResult, { ok: true }>['why']): string {
  switch (why) {
    case 'locked':
      return 'This invite is locked: type the phrase the host sent you.';
    case 'phrase':
      return WRONG_PHRASE;
    case 'kind':
      return 'That is a reply code, not an invite. Paste the invite the host sent you.';
    case 'unsupported':
      return "This browser can't open locked codes here (Web Crypto needs a secure page: https or localhost).";
    default:
      return 'That is not an invite code or link. Ask the host to copy it again.';
  }
}

/**
 * The guest's side: take the invite code (with the phrase when it is locked), make the reply code. A locked invite's
 * reply is locked with the same key.
 */
export async function guestAnswer(
  invite: string,
  o: ConnectOptions,
): Promise<{ code: string; info: SignalInfo; transport: Transport } | { error: string; why: Exclude<OpenResult, { ok: true }>['why'] | 'rtc' }> {
  const s = await openCode(codeFromText(invite), 'o', o.phrase ?? null);
  if (!s.ok) return { error: inviteProblem(s.why), why: s.why };
  const pc = new RTCPeerConnection(rtcConfig(o));
  let transport: Transport | null = null;
  const ready = new Promise<Transport>((res) => {
    pc.ondatachannel = (e) => {
      transport = new ChannelTransport(pc, e.channel);
      res(transport);
    };
  });
  try {
    await pc.setRemoteDescription({ type: 'offer', sdp: s.signal.sdp });
    await pc.setLocalDescription(await pc.createAnswer());
  } catch (e) {
    pc.close();
    return { error: `The invite could not be used (${(e as Error).message}). Ask the host for a new one.`, why: 'rtc' };
  }
  await waitForCandidates(pc);
  const signal: Signal = { k: 'a', sdp: pc.localDescription?.sdp ?? '' };
  const code = s.key ? await encodeLockedSignal(signal, s.key, sanitizeFor(o)) : await encodeSignal(signal, sanitizeFor(o));
  const info = describeSdp(sanitizeSdp(signal.sdp, sanitizeFor(o)), !!s.key);
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
