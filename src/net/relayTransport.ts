// Playing through a relay server (src/net/, "Play through the relay" in the lobby; docs/RELAY_PROTOCOL.md): both
// browsers open a WebSocket to the relay named in the site config (`multiplayer.relayUrl`) and join the same room; the
// relay forwards each frame to the other member of the room and keeps nothing. Neither player's address reaches the
// other; the relay's operator sees both addresses (it is the other end of each connection), the room id, and the size
// and timing of frames, never their content.
//
// The invite is "r1" + base64url of a 16-byte join secret (no session description, nothing to send back). From it
// both sides derive, with WebCrypto:
//   - the room id: base64url(SHA-256("nct-relay-room:v1:" ‖ secret)), first 22 characters (the relay sees only this);
//   - the end-to-end key: HKDF-SHA-256(secret, salt "nct-relay:v1", info "nct-relay-e2e") → AES-256-GCM.
// Every game message (protocol.ts), in pieces of at most CHUNK characters as on the data channel (framing.ts), is
// sealed: a random 12-byte nonce, then AES-GCM over [8-byte sender epoch][4-byte sequence][the text], with
// "nct-relay:v1:<room>:<sender role>" as additional data. Each connection to the relay starts a new random epoch at
// sequence 0; the receiver takes a sender's frames strictly in order within an epoch, a new epoch only from 0 and
// never one seen before, so the relay can drop frames but not change, reorder, replay or redirect them unnoticed.
// A locked invite ("2", purpose 'relay-invite', codeLock.ts) seals the "r1" code with a phrase, as the other codes.
//
// RelayTransport is a Transport (transport.ts) built on RoomTransport, like the two-tabs link: the other player
// leaving or the relay connection dropping is "closed" to the session, and the transport keeps trying (backing off)
// until the room has both players again, which the session sees as a link that opened again (it then says hello and
// picks the game up, as after any reconnect). Only close() ends it.
import { keyFromPhrase, lockAvailable, lockBytes, lockedPurpose, unlockBytes } from './codeLock';
import { Reassembler, splitMessage } from './framing';
import { RoomTransport } from './transport';
import { b64url, codeFromText, unb64url, type OpenWhy } from './webrtc';

/** The relay protocol's version (the `v` of a join frame). */
export const RELAY_VERSION = 1;
/** A frame (one WebSocket text message, either way) is at most this many characters. */
export const MAX_FRAME = 65_536;
/** The join secret's length in bytes, and the invite's prefix. */
export const SECRET_BYTES = 16;
export const RELAY_INVITE_PREFIX = 'r1';
/** A keep-alive to the relay this often while connected; no word from it for RELAY_SILENT_MS and the connection is dropped and made again. */
export const RELAY_KEEPALIVE_MS = 25_000;
export const RELAY_SILENT_MS = 60_000;
/** Sender epochs remembered (a replayed old epoch is refused). */
const EPOCHS_KEPT = 64;
const ROOM_LABEL = 'nct-relay-room:v1:';
const AAD_LABEL = 'nct-relay:v1:';
const NONCE = 12;
const HEAD = 12; // epoch 8 + sequence 4

export type RelayRole = 'host' | 'guest';

// ---------------------------------------------------------------- invites

/** A new relay invite: "r1" + base64url of a random join secret. */
export function newRelayInvite(): string {
  return RELAY_INVITE_PREFIX + b64url(crypto.getRandomValues(new Uint8Array(SECRET_BYTES)));
}

/** The join secret of a relay invite (a link or the code), or null when it is not one. */
export function relaySecret(text: string): Uint8Array | null {
  const c = codeFromText(text).replace(/\s+/g, '');
  if (!/^r1[A-Za-z0-9_-]{22}$/.test(c)) return null;
  try {
    const b = unb64url(c.slice(2));
    return b.length === SECRET_BYTES ? b : null;
  } catch {
    return null;
  }
}

/** A relay invite locked with a phrase ("2", purpose 'relay-invite'): a bystander learns nothing, not even the room. */
export async function lockRelayInvite(invite: string, phrase: string): Promise<string> {
  if (!relaySecret(invite)) throw new Error('not a relay invite');
  const key = await keyFromPhrase(phrase);
  return `2${b64url(await lockBytes(new TextEncoder().encode(invite), key, 'relay-invite'))}`;
}

/** A relay invite back from a link or code (locked ones with their phrase). */
export async function openRelayInvite(text: string, phrase?: string | null): Promise<{ ok: true; invite: string } | { ok: false; why: OpenWhy }> {
  const c = codeFromText(text).replace(/\s+/g, '');
  if (/^r[02-9]/.test(c)) return { ok: false, why: 'newer' };
  if (c.startsWith('r1')) return relaySecret(c) ? { ok: true, invite: c } : { ok: false, why: 'not-code' };
  if (c[0] !== '2' || c.length > 2000 || !/^2[A-Za-z0-9_-]+$/.test(c)) return { ok: false, why: 'not-code' };
  if (!lockAvailable()) return { ok: false, why: 'unsupported' };
  let bytes: Uint8Array;
  try {
    bytes = unb64url(c.slice(1));
  } catch {
    return { ok: false, why: 'not-code' };
  }
  if (lockedPurpose(bytes) !== 'relay-invite') return { ok: false, why: 'not-code' };
  if (!phrase) return { ok: false, why: 'locked' };
  const r = await unlockBytes(bytes, phrase, 'relay-invite');
  if (!r.ok) return { ok: false, why: r.why === 'phrase' ? 'phrase' : 'not-code' };
  const invite = new TextDecoder().decode(r.plain);
  return relaySecret(invite) ? { ok: true, invite } : { ok: false, why: 'not-code' };
}

// ---------------------------------------------------------------- the room id and the end-to-end seal

/** The room id and the end-to-end key a join secret gives (the relay is told only the room id). */
export async function relayKeys(secret: Uint8Array): Promise<{ room: string; key: CryptoKey }> {
  const label = new TextEncoder().encode(ROOM_LABEL);
  const buf = new Uint8Array(label.length + secret.length);
  buf.set(label);
  buf.set(secret, label.length);
  const room = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', buf as BufferSource))).slice(0, 22);
  const base = await crypto.subtle.importKey('raw', secret as BufferSource, 'HKDF', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: new TextEncoder().encode('nct-relay:v1') as BufferSource, info: new TextEncoder().encode('nct-relay-e2e') as BufferSource },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { room, key };
}

const aadFor = (room: string, sender: RelayRole) => new TextEncoder().encode(`${AAD_LABEL}${room}:${sender}`) as BufferSource;

/** One piece of a message, sealed for the frame's `d`: base64url of nonce ‖ AES-GCM([epoch][sequence][text]). */
export async function sealFrame(key: CryptoKey, room: string, sender: RelayRole, epoch: Uint8Array, seq: number, text: string): Promise<string> {
  const body = new TextEncoder().encode(text);
  const plain = new Uint8Array(HEAD + body.length);
  plain.set(epoch.subarray(0, 8));
  new DataView(plain.buffer).setUint32(8, seq >>> 0);
  plain.set(body, HEAD);
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource, additionalData: aadFor(room, sender) }, key, plain as BufferSource));
  const out = new Uint8Array(NONCE + ct.length);
  out.set(nonce);
  out.set(ct, NONCE);
  return b64url(out);
}

/** A frame's `d` opened (null when it does not open with this key, room and sender: changed, or not from the peer). */
export async function openFrame(key: CryptoKey, room: string, sender: RelayRole, d: string): Promise<{ epoch: string; seq: number; text: string } | null> {
  if (d.length > MAX_FRAME || !/^[A-Za-z0-9_-]+$/.test(d)) return null;
  let bytes: Uint8Array;
  try {
    bytes = unb64url(d);
  } catch {
    return null;
  }
  if (bytes.length < NONCE + 16 + HEAD) return null;
  let plain: Uint8Array;
  try {
    plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, NONCE) as BufferSource, additionalData: aadFor(room, sender) }, key, bytes.slice(NONCE) as BufferSource));
  } catch {
    return null;
  }
  const epoch = [...plain.subarray(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
  const seq = new DataView(plain.buffer, plain.byteOffset).getUint32(8);
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(plain.subarray(HEAD));
  } catch {
    return null;
  }
  return { epoch, seq, text };
}

// ---------------------------------------------------------------- the transport

/** What the transport needs of a WebSocket (the browser's, or a fake in tests). */
export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
}
export type SocketFactory = (url: string) => SocketLike;
const OPEN = 1;

/** Where the link to the relay is, for the lobby. */
export type RelayStatus =
  | { k: 'connecting' }
  /** in the room, the other player not there (yet, or again) */
  | { k: 'waiting' }
  | { k: 'open' }
  | { k: 'retrying'; inMs: number; why: string }
  /** given up for good (another tab took this seat, or the relay speaks another version) */
  | { k: 'stopped'; why: string };

export interface RelayOptions {
  /** the relay's address (wss:, from the site config) */
  url: string;
  /** the invite ("r1…") */
  invite: string;
  role: RelayRole;
  socket?: SocketFactory;
  /** wait before reconnect attempt n (1, 2, …) */
  retryMs?: (attempt: number) => number;
  keepAliveMs?: number;
  silentMs?: number;
  now?: () => number;
  onStatus?: (s: RelayStatus) => void;
}

const FATAL: Record<string, string> = {
  version: 'The relay speaks another version of the relay protocol. Reload the page; if it keeps happening, the relay needs updating.',
  room: 'The relay refused the room. Make a new invite.',
  role: 'The relay refused this seat. Make a new invite.',
  replaced: 'This game was opened through the relay in another tab or device, so this one stopped.',
};

const defaultSocket: SocketFactory = (url) => new WebSocket(url) as unknown as SocketLike;
const defaultRetry = (n: number) => Math.min(15_000, 500 * 2 ** Math.min(n, 5));

/** The link to the other player through the relay (see the top of this file). */
export class RelayTransport extends RoomTransport {
  readonly role: RelayRole;
  status: RelayStatus = { k: 'connecting' };
  /** frames refused (malformed, not opening with the key, out of order, replayed), and messages sent and delivered */
  readonly stats = { refused: 0, sent: 0, delivered: 0 };
  /** the last problem the relay reported, in plain words */
  problem: string | null = null;
  private o: RelayOptions;
  private keys: Promise<{ room: string; key: CryptoKey }>;
  private ws: SocketLike | null = null;
  private epoch = new Uint8Array(8);
  private seq = 0;
  private msgId = 0;
  private peer: { epoch: string; next: number } | null = null;
  private seenEpochs: string[] = [];
  private joiner: Reassembler;
  private sendChain: Promise<void> = Promise.resolve();
  private recvChain: Promise<void> = Promise.resolve();
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private keepTimer: ReturnType<typeof setInterval> | null = null;
  private lastHeard = 0;
  private stopped = false;
  private now: () => number;

  constructor(o: RelayOptions) {
    super();
    const secret = relaySecret(o.invite);
    if (!secret) throw new Error('not a relay invite');
    this.o = o;
    this.role = o.role;
    this.now = o.now ?? Date.now;
    this.joiner = new Reassembler(this.now);
    this.keys = relayKeys(secret);
    void this.connect();
  }

  private status_(s: RelayStatus) {
    this.status = s;
    this.o.onStatus?.(s);
  }

  /** The room id this link joins (what the relay sees). */
  room(): Promise<string> {
    return this.keys.then((k) => k.room);
  }

  private async connect() {
    if (this.stopped) return;
    const { room } = await this.keys;
    if (this.stopped) return;
    this.status_({ k: 'connecting' });
    let ws: SocketLike;
    try {
      ws = (this.o.socket ?? defaultSocket)(this.o.url);
    } catch {
      this.retry('the relay could not be reached');
      return;
    }
    this.ws = ws;
    // a new connection: a new epoch, from sequence 0 (the peer refuses anything older)
    this.epoch = crypto.getRandomValues(new Uint8Array(8));
    this.seq = 0;
    this.joiner = new Reassembler(this.now);
    let opened = false;
    ws.onopen = () => {
      if (ws !== this.ws) return;
      opened = true;
      this.lastHeard = this.now();
      this.raw(ws, { t: 'join', v: RELAY_VERSION, room, role: this.role });
      this.startKeepAlive(ws);
    };
    ws.onmessage = (e) => {
      if (ws === this.ws) this.frame(e.data);
    };
    ws.onclose = () => this.dropped(ws, opened ? 'the connection to the relay closed' : 'the relay could not be reached');
    ws.onerror = () => undefined;
  }

  private raw(ws: SocketLike, f: object) {
    if (ws.readyState !== OPEN) return;
    try {
      ws.send(JSON.stringify(f));
    } catch {
      /* closing: onclose follows */
    }
  }

  private startKeepAlive(ws: SocketLike) {
    this.stopKeepAlive();
    this.keepTimer = setInterval(() => {
      if (ws !== this.ws) return this.stopKeepAlive();
      if (this.now() - this.lastHeard > (this.o.silentMs ?? RELAY_SILENT_MS)) {
        try {
          ws.close(4000, 'silent');
        } catch {
          /* already closed */
        }
        this.dropped(ws, 'the relay stopped answering');
      } else this.raw(ws, { t: 'ping' });
    }, this.o.keepAliveMs ?? RELAY_KEEPALIVE_MS);
  }
  private stopKeepAlive() {
    if (this.keepTimer) clearInterval(this.keepTimer);
    this.keepTimer = null;
  }

  /** The connection to the relay is gone: the peer is out of reach until it is made again. */
  private dropped(ws: SocketLike, why: string) {
    if (ws !== this.ws) return;
    this.ws = null;
    this.stopKeepAlive();
    if (this.stopped) return;
    // only a link that was open is lost: one still waiting for the peer just keeps waiting
    if (this.state === 'open') this.peerGone();
    this.retry(why);
  }

  private retry(why: string) {
    if (this.stopped) return;
    this.attempt++;
    const ms = (this.o.retryMs ?? defaultRetry)(this.attempt);
    this.status_({ k: 'retrying', inMs: ms, why });
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, ms);
  }

  /** Try again now instead of waiting (the lobby's button). */
  retryNow() {
    if (this.stopped || this.ws || !this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    void this.connect();
  }

  /** A frame from the relay: checked, then acted on; anything malformed is refused (counted) and dropped. */
  private frame(data: unknown) {
    if (typeof data !== 'string' || data.length > MAX_FRAME) return void this.stats.refused++;
    let f: Record<string, unknown>;
    try {
      const v = JSON.parse(data) as unknown;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return void this.stats.refused++;
      f = v as Record<string, unknown>;
    } catch {
      return void this.stats.refused++;
    }
    this.lastHeard = this.now();
    switch (f.t) {
      case 'joined':
        if (typeof f.peer !== 'boolean') return void this.stats.refused++;
        this.attempt = 0;
        this.problem = null;
        if (f.peer) this.here();
        else this.status_({ k: 'waiting' });
        return;
      case 'peer':
        if (typeof f.here !== 'boolean') return void this.stats.refused++;
        if (f.here) this.here();
        else {
          if (this.state === 'open') this.peerGone();
          this.status_({ k: 'waiting' });
        }
        return;
      case 'msg':
        if (typeof f.d !== 'string') return void this.stats.refused++;
        this.received(f.d);
        return;
      case 'error': {
        const why = typeof f.why === 'string' ? f.why.slice(0, 40) : '';
        const fatal = FATAL[why];
        if (fatal) return this.stop(fatal);
        this.problem = `The relay reported a problem (${why || 'unknown'}).`;
        return;
      }
      case 'pong':
        return;
      default:
        this.stats.refused++;
    }
  }

  private here() {
    this.status_({ k: 'open' });
    this.peerHere();
  }

  private received(d: string) {
    const other: RelayRole = this.role === 'host' ? 'guest' : 'host';
    this.recvChain = this.recvChain
      .then(async () => {
        const { key, room } = await this.keys;
        const r = await openFrame(key, room, other, d);
        if (!r) return void this.stats.refused++;
        if (this.peer && r.epoch === this.peer.epoch) {
          if (r.seq !== this.peer.next) return void this.stats.refused++;
          this.peer.next++;
        } else {
          if (r.seq !== 0 || this.seenEpochs.includes(r.epoch)) return void this.stats.refused++;
          this.peer = { epoch: r.epoch, next: 1 };
          this.seenEpochs.push(r.epoch);
          if (this.seenEpochs.length > EPOCHS_KEPT) this.seenEpochs.shift();
          this.joiner = new Reassembler(this.now);
        }
        const whole = r.text[0] === '~' ? this.joiner.push(r.text) : r.text;
        if (whole === null) return;
        this.stats.delivered++;
        this.deliver(whole);
      })
      .catch(() => undefined);
  }

  send(text: string) {
    const ws = this.ws;
    if (this.state !== 'open' || !ws) return;
    const parts = splitMessage(text, this.msgId++);
    if (!parts) return;
    const epoch = this.epoch;
    const seqs = parts.map(() => this.seq++);
    this.stats.sent++;
    this.sendChain = this.sendChain
      .then(async () => {
        const { key, room } = await this.keys;
        for (let i = 0; i < parts.length; i++) {
          const d = await sealFrame(key, room, this.role, epoch, seqs[i]!, parts[i]!);
          // the connection changed meanwhile: these belonged to the old one (its epoch), so they are not sent
          if (ws !== this.ws) return;
          this.raw(ws, { t: 'msg', d });
        }
      })
      .catch(() => undefined);
  }

  /** Stop for good, saying why (the relay refused us in a way trying again won't fix). */
  private stop(why: string) {
    this.problem = why;
    this.status_({ k: 'stopped', why });
    this.end();
  }

  private end() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.stopKeepAlive();
    const ws = this.ws;
    this.ws = null;
    if (ws) {
      this.raw(ws, { t: 'leave' });
      try {
        ws.close(1000, 'bye');
      } catch {
        /* already closed */
      }
    }
    this.setState('closed');
  }

  close() {
    if (this.stopped) return;
    this.end();
  }
}
