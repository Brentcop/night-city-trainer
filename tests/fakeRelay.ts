// An in-memory relay server that follows docs/RELAY_PROTOCOL.md exactly, and a fake WebSocket to reach it
// (tests/net-relay.test.ts). Nothing touches the network. Every frame the relay receives or sends is kept in `seen`,
// so a test can search everything a relay operator could read. A real server can be written to the same rules (and
// checked against the same tests by swapping this class for a client of it).
import type { SocketFactory, SocketLike } from '../src/net/relayTransport';

/** The protocol's numbers (docs/RELAY_PROTOCOL.md "Limits"). */
export const RELAY_RULES = {
  version: 1,
  maxFrame: 65_536,
  /** token buckets per connection: frames and characters, burst and refill per second */
  frameBurst: 200,
  framesPerSecond: 50,
  charBurst: 4_000_000,
  charsPerSecond: 1_000_000,
} as const;

type Role = 'host' | 'guest';

/** The relay's end of one connection. */
class Conn {
  joined: { room: string; role: Role } | null = null;
  closed = false;
  frames: number = RELAY_RULES.frameBurst;
  chars: number = RELAY_RULES.charBurst;
  at = 0;
  constructor(
    readonly relay: FakeRelay,
    readonly client: FakeSocket,
  ) {}
}

export class FakeRelay {
  /** room id → its two seats (nothing else is kept) */
  rooms = new Map<string, { host?: Conn; guest?: Conn }>();
  /** every frame in either direction, as text */
  seen: string[] = [];
  /** connections the relay has closed, and why */
  closes: { code: number; why: string }[] = [];
  now = 0;
  private conns = new Set<Conn>();

  /** A WebSocket factory whose sockets reach this relay. */
  socket: SocketFactory = (url: string) => new FakeSocket(this, url);

  connect(client: FakeSocket): Conn {
    const c = new Conn(this, client);
    this.conns.add(c);
    return c;
  }

  /** a frame from a client */
  receive(c: Conn, data: string) {
    if (c.closed) return;
    this.seen.push(data);
    // rate: refill, then spend
    const dt = Math.max(0, this.now - c.at) / 1000;
    c.at = this.now;
    c.frames = Math.min(RELAY_RULES.frameBurst, c.frames + dt * RELAY_RULES.framesPerSecond) - 1;
    c.chars = Math.min(RELAY_RULES.charBurst, c.chars + dt * RELAY_RULES.charsPerSecond) - data.length;
    if (data.length > RELAY_RULES.maxFrame) return this.fail(c, 'too-big', 1009);
    if (c.frames < 0 || c.chars < 0) return this.fail(c, 'rate', 1008);
    let f: Record<string, unknown>;
    try {
      const v = JSON.parse(data) as unknown;
      if (!v || typeof v !== 'object' || Array.isArray(v)) return this.fail(c, 'frame', 1008);
      f = v as Record<string, unknown>;
    } catch {
      return this.fail(c, 'frame', 1008);
    }
    if (!c.joined) {
      if (f.t !== 'join') return this.fail(c, 'join-first', 1008);
      if (f.v !== RELAY_RULES.version) return this.fail(c, 'version', 1008);
      if (typeof f.room !== 'string' || !/^[A-Za-z0-9_-]{22}$/.test(f.room)) return this.fail(c, 'room', 1008);
      if (f.role !== 'host' && f.role !== 'guest') return this.fail(c, 'role', 1008);
      const room = this.rooms.get(f.room) ?? {};
      this.rooms.set(f.room, room);
      const old = room[f.role];
      if (old && !old.closed) {
        // the seat is taken by an older connection: the newest wins (a reload, or a connection the relay hasn't seen drop)
        this.send(old, { t: 'error', why: 'replaced' });
        this.drop(old, 4001, 'replaced', false);
      }
      room[f.role] = c;
      c.joined = { room: f.room, role: f.role };
      const other = room[f.role === 'host' ? 'guest' : 'host'];
      this.send(c, { t: 'joined', peer: !!other });
      if (other) this.send(other, { t: 'peer', here: true });
      return;
    }
    switch (f.t) {
      case 'msg': {
        if (typeof f.d !== 'string' || !/^[A-Za-z0-9_-]+$/.test(f.d)) return this.fail(c, 'frame', 1008);
        const other = this.other(c);
        // forwarded as is, or dropped when the other seat is empty (the relay keeps no queue)
        if (other) this.send(other, { t: 'msg', d: f.d });
        return;
      }
      case 'ping':
        return this.send(c, { t: 'pong' });
      case 'leave':
        return this.drop(c, 1000, 'leave', true);
      default:
        return this.fail(c, 'frame', 1008);
    }
  }

  private other(c: Conn): Conn | null {
    if (!c.joined) return null;
    const room = this.rooms.get(c.joined.room);
    const o = room?.[c.joined.role === 'host' ? 'guest' : 'host'];
    return o && !o.closed ? o : null;
  }

  send(c: Conn, f: object) {
    if (c.closed) return;
    const text = JSON.stringify(f);
    this.seen.push(text);
    c.client.fromServer(text);
  }

  /** Send a client any text at all (a misbehaving relay, in the tests). */
  inject(role: Role, text: string, room?: string) {
    for (const c of this.conns) if (!c.closed && c.joined?.role === role && (!room || c.joined.room === room)) c.client.fromServer(text);
  }

  private fail(c: Conn, why: string, code: number) {
    this.send(c, { t: 'error', why });
    this.drop(c, code, why, true);
  }

  /** Close a connection from the relay's side (`tell`: the other seat hears that its peer left). */
  drop(c: Conn, code: number, why: string, tell: boolean) {
    if (c.closed) return;
    c.closed = true;
    this.closes.push({ code, why });
    this.conns.delete(c);
    if (c.joined) {
      const room = this.rooms.get(c.joined.room);
      if (room && room[c.joined.role] === c) {
        delete room[c.joined.role];
        const o = room[c.joined.role === 'host' ? 'guest' : 'host'];
        if (tell && o && !o.closed) this.send(o, { t: 'peer', here: false });
        if (!room.host && !room.guest) this.rooms.delete(c.joined.room);
      }
    }
    c.client.closedByServer();
  }

  /** The client closed its socket (or the network dropped it). */
  clientClosed(c: Conn) {
    this.drop(c, 1000, 'closed', true);
  }

  /** Cut a seat's connection, as a network drop would (both ends see it close). */
  cut(role: Role, room?: string) {
    for (const c of [...this.conns]) if (c.joined?.role === role && (!room || c.joined.room === room)) this.drop(c, 1006, 'cut', true);
  }

  /** Open connections (tests). */
  get open(): number {
    return this.conns.size;
  }
}

/** A WebSocket that reaches a FakeRelay; every delivery is asynchronous, as over a real socket. */
export class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private conn: Conn;
  constructor(
    private relay: FakeRelay,
    readonly url: string,
  ) {
    this.conn = relay.connect(this);
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      this.onopen?.();
    }, 0);
  }
  send(data: string) {
    if (this.readyState === 0) throw new Error('InvalidStateError: still connecting');
    if (this.readyState !== 1) return;
    queueMicrotask(() => this.relay.receive(this.conn, data));
  }
  close() {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    queueMicrotask(() => this.relay.clientClosed(this.conn));
    setTimeout(() => this.onclose?.(), 0);
  }
  /** called by the relay */
  fromServer(text: string) {
    queueMicrotask(() => {
      if (this.readyState === 1) this.onmessage?.({ data: text });
    });
  }
  closedByServer() {
    // after the frames already on their way (an error, say), as on a real socket
    queueMicrotask(() => {
      if (this.readyState === 3) return;
      this.readyState = 3;
      setTimeout(() => this.onclose?.(), 0);
    });
  }
}
