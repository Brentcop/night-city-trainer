// Long messages in pieces (src/net/): the WebRTC data channel (webrtc.ts) and the relay (relayTransport.ts) both carry
// the game protocol's messages (protocol.ts: up to CAPS.hostMessage characters) in pieces of at most CHUNK characters,
// "~<id>|<k>|<n>|" + piece, joined on arrival by a Reassembler that checks every piece before keeping it.

/** A message over this size is sent in pieces (data channels differ in what they take in one message). */
export const CHUNK = 15_000;
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
 * A message as what goes on the wire: itself when it is short (and doesn't start with "~"), else its pieces; null when
 * it is too long to send at all.
 */
export function splitMessage(text: string, id: number): string[] | null {
  if (text.length <= CHUNK && text[0] !== '~') return [text];
  const n = Math.ceil(text.length / CHUNK);
  if (n > MAX_PIECES) return null;
  const out: string[] = [];
  for (let k = 0; k < n; k++) out.push(`~${id}|${k}|${n}|${text.slice(k * CHUNK, (k + 1) * CHUNK)}`);
  return out;
}

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
