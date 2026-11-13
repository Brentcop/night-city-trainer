// A link between the two players' browsers, whatever carries it: a WebRTC data channel (webrtc.ts), a BroadcastChannel
// between two tabs of this browser, or an in-memory pair for tests. Text messages only; the game protocol on top
// (protocol.ts) decides what they mean. A transport is one connection: when it closes, a new one is made (a new invite).

export type LinkState = 'connecting' | 'open' | 'closed';

export interface Transport {
  /** send one message (dropped when the link is not open) */
  send(text: string): void;
  /** the peer's messages, in order */
  onMessage: ((text: string) => void) | null;
  /** the link opened or closed */
  onState: ((s: LinkState) => void) | null;
  readonly state: LinkState;
  close(): void;
}

/** Shared bookkeeping for the transports below. */
abstract class BaseTransport implements Transport {
  onMessage: ((text: string) => void) | null = null;
  onState: ((s: LinkState) => void) | null = null;
  state: LinkState = 'connecting';
  abstract send(text: string): void;
  abstract close(): void;
  protected setState(s: LinkState) {
    if (this.state === s || this.state === 'closed') return;
    this.state = s;
    this.onState?.(s);
  }
  protected deliver(text: string) {
    if (this.state === 'open') this.onMessage?.(text);
  }
}

class LoopEnd extends BaseTransport {
  peer: LoopEnd | null = null;
  constructor(private async_: boolean) {
    super();
  }
  send(text: string) {
    if (this.state !== 'open' || !this.peer) return;
    const peer = this.peer;
    if (this.async_) queueMicrotask(() => peer.deliver(text));
    else peer.deliver(text);
  }
  close() {
    const peer = this.peer;
    this.setState('closed');
    this.peer = null;
    if (peer && peer.state !== 'closed') peer.close();
  }
  open() {
    this.setState('open');
  }
}

/**
 * Two ends joined in memory (tests). Both open at once (on the next microtask, so handlers can be attached first);
 * messages arrive asynchronously and in order, as over a real link.
 */
export function loopbackPair(): [Transport, Transport] {
  const a = new LoopEnd(true);
  const b = new LoopEnd(true);
  a.peer = b;
  b.peer = a;
  queueMicrotask(() => {
    a.open();
    b.open();
  });
  return [a, b];
}

/**
 * A link through a room that the other player joins or leaves: two tabs (BroadcastTransport) or a relay server
 * (relayTransport.ts). Either side may come and go; the session hears a link that comes back as "closed" then "open"
 * (and says hello again over it), and a peer that left as "closed", while this end keeps waiting in the room. Only
 * close() ends it for good.
 */
export abstract class RoomTransport extends BaseTransport {
  /** The peer is here (the first time, or back after a restart): a link that was open is reported closed, then open. */
  protected peerHere() {
    if (this.state === 'closed') return;
    if (this.state === 'open') this.onState?.('closed');
    this.state = 'connecting';
    this.setState('open');
  }
  /** The peer left (or the way to it dropped): reported as closed; the link may open again. */
  protected peerGone() {
    if (this.state === 'closed') return;
    this.state = 'connecting';
    this.onState?.('closed');
  }
}

type BcFrame = { room: string; from: string; k: 'hi' | 'hi-back' | 'msg' | 'bye'; to?: string; text?: string };

/**
 * Two tabs of this browser, over a BroadcastChannel named after a room code. Each end says hello when it starts and
 * the other answers, so either tab can be reloaded and the link opens again; a closed tab says goodbye (pagehide).
 * Only the first other tab to answer is paired with; anything from a third tab is ignored.
 */
export class BroadcastTransport extends RoomTransport {
  private ch: BroadcastChannel;
  private id = Math.random().toString(36).slice(2, 10);
  private peerId: string | null = null;
  private bye = () => this.close();
  constructor(readonly room: string) {
    super();
    this.ch = new BroadcastChannel(`nct-online-${room}`);
    this.ch.onmessage = (e: MessageEvent<BcFrame>) => this.receive(e.data);
    this.post({ k: 'hi' });
    if (typeof window !== 'undefined') window.addEventListener('pagehide', this.bye);
  }
  private post(f: Omit<BcFrame, 'room' | 'from'>) {
    try {
      this.ch.postMessage({ room: this.room, from: this.id, ...f });
    } catch {
      /* channel closed */
    }
  }
  private receive(f: BcFrame) {
    if (!f || typeof f !== 'object' || f.room !== this.room || typeof f.from !== 'string' || f.from === this.id) return;
    if (f.k === 'hi') {
      // a (re)started tab: pair with it if we have no peer, or if our peer is the one that restarted
      if (this.peerId && this.peerId !== f.from && this.state === 'open') return;
      this.peerId = f.from;
      this.post({ k: 'hi-back', to: f.from });
      this.peerHere();
      return;
    }
    if (f.k === 'hi-back') {
      if (f.to !== this.id || (this.peerId && this.peerId !== f.from && this.state === 'open')) return;
      this.peerId = f.from;
      this.peerHere();
      return;
    }
    if (f.from !== this.peerId) return;
    if (f.k === 'bye') {
      this.peerId = null;
      this.peerGone();
      return;
    }
    if (f.k === 'msg' && typeof f.text === 'string') this.deliver(f.text);
  }
  send(text: string) {
    if (this.state !== 'open') return;
    this.post({ k: 'msg', to: this.peerId ?? undefined, text });
  }
  close() {
    if (this.state === 'closed') return;
    this.post({ k: 'bye' });
    if (typeof window !== 'undefined') window.removeEventListener('pagehide', this.bye);
    this.setState('closed');
    this.ch.close();
  }
}

/** A room code: `len` letters and digits (8 for the two-tabs mode). */
export function newRoomCode(len = 8): string {
  const a = 'abcdefghjkmnpqrstuvwxyz23456789';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => a[b % a.length]).join('');
}
