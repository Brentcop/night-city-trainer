// Playing through a relay server (src/net/relayTransport.ts, docs/RELAY_PROTOCOL.md), against an in-memory relay that
// follows the document (tests/fakeRelay.ts): invites and their locks, the end-to-end seal, the frames a misbehaving
// relay or peer might send, a full game between two sessions with a leak search over everything the relay saw,
// reconnecting, the turn timer's pause, the heartbeat and a rematch. Nothing touches the network.
import { describe, expect, it } from 'vitest';
import { validateDeck } from '../src/engine/deck';
import type { Decision, DeckList } from '../src/engine/types';
import { gameDeck } from '../src/lib/tournament';
import { loadLibrary } from '../scripts/lib-node';
import { lockedPurpose, PURPOSES } from '../src/net/codeLock';
import { CHUNK } from '../src/net/framing';
import type { OnlineOutcome, OnlineRecorder } from '../src/net/record';
import {
  lockRelayInvite,
  MAX_FRAME,
  newRelayInvite,
  openFrame,
  openRelayInvite,
  relayKeys,
  relaySecret,
  RelayTransport,
  sealFrame,
  type RelayStatus,
} from '../src/net/relayTransport';
import { OnlineGuest, OnlineHost, LOST_MS, type OnlineSessionAny } from '../src/net/session';
import { viewFor } from '../src/net/view';
import { inviteMode, unb64url } from '../src/net/webrtc';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { FakeRelay, RELAY_RULES } from './fakeRelay';
import { expectNoAddresses } from './netLeak';

const LIB = loadLibrary();
const legal = LIB.map((d) => gameDeck(d.deck)).filter((d) => validateDeck(d).length === 0);
const deckA: DeckList = legal[0]!;
const deckB: DeckList = legal[Math.min(5, legal.length - 1)]!;
const URL_ = 'wss://relay.test/v1';

const flush = () => new Promise((r) => setTimeout(r, 0));
async function until(f: () => boolean, what: string, steps = 2000) {
  for (let i = 0; i < steps; i++) {
    if (f()) return;
    await flush();
  }
  throw new Error(`timed out waiting for ${what}`);
}
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}
function pick(d: Decision, r: () => number): number {
  const pass = d.options.findIndex((o) => o.action?.type === 'pass' || o.action?.type === 'endReact');
  if (pass >= 0 && r() < 0.35) return pass;
  return Math.floor(r() * d.options.length);
}
function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
}
function recorder() {
  const entries: OnlineOutcome[] = [];
  const replays: PracticeReplay[] = [];
  const r: OnlineRecorder = { entry: (o) => entries.push(o), replay: (x) => replays.push(x) };
  return { r, entries, replays };
}

/** Two relay links on one invite, through `relay`. */
function links(relay: FakeRelay, invite = newRelayInvite(), o: { onStatus?: (s: RelayStatus) => void } = {}) {
  const mk = (role: 'host' | 'guest') => new RelayTransport({ url: URL_, invite, role, socket: relay.socket, retryMs: () => 5, ...(role === 'host' && o.onStatus ? { onStatus: o.onStatus } : {}) });
  return { invite, host: mk('host'), guest: mk('guest') };
}

// ---------------------------------------------------------------- invites and the seal

describe('relay invites', () => {
  it('an invite is a room and its key, nothing else; locked, it shows nothing; an older copy refuses both', async () => {
    const inv = newRelayInvite();
    expect(inv).toMatch(/^r1[A-Za-z0-9_-]{22}$/);
    expect(relaySecret(inv)).toHaveLength(16);
    expect(relaySecret(`https://example.test/app/#/play/join/${inv}`)).toHaveLength(16);
    expect(relaySecret('r1short')).toBeNull();
    expect(inviteMode(inv)).toBe('relay');
    expect(inviteMode('r2AAAAAAAAAAAAAAAAAAAAAA')).toBe('newer');
    expect(await openRelayInvite('r2AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ ok: false, why: 'newer' });
    expect(await openRelayInvite(inv)).toEqual({ ok: true, invite: inv });
    // what an older copy of the site reads as a code: a digit 0–2 first, then base64url (webrtc.ts before relays)
    const olderReads = (c: string) => /^[012][A-Za-z0-9_-]+$/.test(c);
    expect(olderReads(inv)).toBe(false);
    const locked = await lockRelayInvite(inv, 'lantern orbit river velvet');
    expect(locked[0]).toBe('2');
    expect(inviteMode(locked)).toBe('relay');
    expect(locked).not.toContain(inv.slice(2));
    // an older copy reads "2" codes, but not this purpose: it refuses the code instead of connecting directly
    const bytes = unb64url(locked.slice(1));
    expect(bytes[2]).toBe(PURPOSES['relay-invite']);
    expect(lockedPurpose(bytes)).toBe('relay-invite');
    expect(Object.values(PURPOSES).slice(0, 4)).not.toContain(bytes[2]);
    expect(await openRelayInvite(locked)).toEqual({ ok: false, why: 'locked' });
    expect(await openRelayInvite(locked, 'lantern orbit river velvets')).toEqual({ ok: false, why: 'phrase' });
    expect(await openRelayInvite(locked, 'Lantern-Orbit river velvet')).toEqual({ ok: true, invite: inv });
    expect(await openRelayInvite('1abcdefghijklmnop')).toEqual({ ok: false, why: 'not-code' });
  }, 20_000);

  it('both sides derive the same room and key; the room says nothing of the secret', async () => {
    const inv = newRelayInvite();
    const a = await relayKeys(relaySecret(inv)!);
    const b = await relayKeys(relaySecret(inv)!);
    expect(a.room).toBe(b.room);
    expect(a.room).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(a.room).not.toBe(inv.slice(2));
    expect((await relayKeys(relaySecret(newRelayInvite())!)).room).not.toBe(a.room);
  });

  it('a sealed piece opens only with the same key, room and sender, unchanged', async () => {
    const { room, key } = await relayKeys(relaySecret(newRelayInvite())!);
    const other = await relayKeys(relaySecret(newRelayInvite())!);
    const epoch = new Uint8Array(8).fill(7);
    const d = await sealFrame(key, room, 'host', epoch, 3, 'hello, Night City');
    expect(d).not.toContain('hello');
    expect(await openFrame(key, room, 'host', d)).toEqual({ epoch: '0707070707070707', seq: 3, text: 'hello, Night City' });
    // sent back to its sender (a relay reflecting frames), another room, another key, one byte changed: refused
    expect(await openFrame(key, room, 'guest', d)).toBeNull();
    expect(await openFrame(key, other.room, 'host', d)).toBeNull();
    expect(await openFrame(other.key, room, 'host', d)).toBeNull();
    const flip = d.slice(0, 30) + (d[30] === 'A' ? 'B' : 'A') + d.slice(31);
    expect(await openFrame(key, room, 'host', flip)).toBeNull();
    expect(await openFrame(key, room, 'host', 'not base64!')).toBeNull();
    expect(await openFrame(key, room, 'host', 'AAAA')).toBeNull();
  });
});

// ---------------------------------------------------------------- the link

describe('RelayTransport through a relay that follows the document', () => {
  it('joins, opens when both are in, carries messages both ways in order (long ones in pieces), and every frame fits', async () => {
    const relay = new FakeRelay();
    const statuses: string[] = [];
    const { host, guest } = links(relay, undefined, { onStatus: (s) => statuses.push(s.k) });
    const got: { h: string[]; g: string[] } = { h: [], g: [] };
    host.onMessage = (t) => got.h.push(t);
    guest.onMessage = (t) => got.g.push(t);
    await until(() => host.state === 'open' && guest.state === 'open', 'both open');
    expect(statuses).toContain('waiting');
    expect(statuses.at(-1)).toBe('open');
    const long = `{"big":"${'é€x'.repeat(Math.ceil((CHUNK * 3) / 3))}"}`;
    host.send('{"n":1}');
    host.send(long);
    host.send('{"n":2}');
    guest.send('{"n":"back"}');
    await until(() => got.g.length === 3 && got.h.length === 1, 'the messages');
    expect(got.g).toEqual(['{"n":1}', long, '{"n":2}']);
    expect(got.h).toEqual(['{"n":"back"}']);
    for (const f of relay.seen) expect(f.length).toBeLessThanOrEqual(MAX_FRAME);
    expect(host.stats.refused + guest.stats.refused).toBe(0);
    host.close();
    guest.close();
  });

  it('refuses what a misbehaving relay or peer sends: oversized, malformed, unknown, changed, reflected, replayed and reordered frames', async () => {
    const relay = new FakeRelay();
    const { host, guest } = links(relay);
    const got: string[] = [];
    guest.onMessage = (t) => got.push(t);
    await until(() => host.state === 'open' && guest.state === 'open', 'both open');
    host.send('{"n":1}');
    host.send('{"n":2}');
    await until(() => got.length === 2, 'two messages');
    // the frames the relay forwarded to the guest, captured as an operator could
    const forwarded = relay.seen.filter((f) => f.startsWith('{"t":"msg"'));
    const toGuest = forwarded.slice(-2);
    const before = guest.stats.refused;
    relay.inject('guest', 'x'.repeat(MAX_FRAME + 1));
    relay.inject('guest', 'not json');
    relay.inject('guest', '[1,2]');
    relay.inject('guest', '{"t":"surprise"}');
    relay.inject('guest', '{"t":"msg","d":42}');
    relay.inject('guest', '{"t":"msg","d":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}');
    // replayed (the same frames again) and reordered (the second before the first of a new pair)
    relay.inject('guest', toGuest[0]!);
    relay.inject('guest', toGuest[1]!);
    // reflected: the guest's own frame sent back to it
    guest.send('{"n":"mine"}');
    await until(() => relay.seen.filter((f) => f.startsWith('{"t":"msg"')).length > forwarded.length + 1, 'the guest frame');
    const own = relay.seen.filter((f) => f.startsWith('{"t":"msg"')).at(-1)!;
    relay.inject('guest', own);
    await until(() => guest.stats.refused >= before + 9, 'the refusals');
    expect(got).toEqual(['{"n":1}', '{"n":2}']);
    // the link is still good afterwards
    host.send('{"n":3}');
    await until(() => got.length === 3, 'the next message');
    expect(got[2]).toBe('{"n":3}');
    host.close();
    guest.close();
  });

  it('frames out of order are refused: a later one first, and one already taken', async () => {
    const relay = new FakeRelay();
    const { host, guest } = links(relay);
    await until(() => host.state === 'open' && guest.state === 'open', 'both open');
    const { room, key } = await relayKeys(relaySecret((host as unknown as { o: { invite: string } }).o.invite)!);
    const got: string[] = [];
    guest.onMessage = (t) => got.push(t);
    // a new epoch from the "host": sequence 1 before 0 is refused; 0 opens the epoch, then 1 is next and taken;
    // 1 again (a replay), 0 again (an epoch seen before) and 3 (a gap) are refused
    const epoch = new Uint8Array(8).fill(9);
    const seal = async (seq: number, text: string) => JSON.stringify({ t: 'msg', d: await sealFrame(key, room, 'host', epoch, seq, text) });
    const f0 = await seal(0, '{"first":0}');
    const f1 = await seal(1, '{"next":1}');
    const f3 = await seal(3, '{"gap":3}');
    const r0 = guest.stats.refused;
    for (const f of [f1, f0, f1, f1, f0, f3]) relay.inject('guest', f);
    await until(() => guest.stats.refused === r0 + 4, 'the refusals', 400);
    expect(got).toEqual(['{"first":0}', '{"next":1}']);
    host.close();
    guest.close();
  });

  it('the relay refuses frames that break the rules, and says why', async () => {
    const relay = new FakeRelay();
    const sockets = Array.from({ length: 4 }, () => relay.socket(URL_));
    const errors: string[][] = sockets.map(() => []);
    sockets.forEach((s, i) => (s.onmessage = (e) => errors[i]!.push(String(e.data))));
    await flush();
    sockets[0]!.send('{"t":"msg","d":"AAAA"}');
    sockets[1]!.send(JSON.stringify({ t: 'join', v: 2, room: 'A'.repeat(22), role: 'host' }));
    sockets[2]!.send(JSON.stringify({ t: 'join', v: 1, room: 'short', role: 'host' }));
    sockets[3]!.send('x'.repeat(RELAY_RULES.maxFrame + 1));
    await until(() => errors.every((e) => e.length === 1), 'the errors');
    expect(errors.map((e) => JSON.parse(e[0]!).why)).toEqual(['join-first', 'version', 'room', 'too-big']);
    await until(() => relay.open === 0, 'closed');
  });

  it('a second tab on the same seat replaces the first, which stops for good and says why', async () => {
    const relay = new FakeRelay();
    const { invite, host, guest } = links(relay);
    await until(() => host.state === 'open' && guest.state === 'open', 'both open');
    const again = new RelayTransport({ url: URL_, invite, role: 'host', socket: relay.socket, retryMs: () => 5 });
    await until(() => host.status.k === 'stopped' && again.state === 'open', 'the replacement');
    expect(host.state).toBe('closed');
    expect(host.problem).toMatch(/another tab or device/);
    again.close();
    guest.close();
  });

  it('a host still waiting for its guest just keeps waiting when the relay connection drops (no "lost" link)', async () => {
    const relay = new FakeRelay();
    const host = new RelayTransport({ url: URL_, invite: newRelayInvite(), role: 'host', socket: relay.socket, retryMs: () => 5 });
    const states: string[] = [];
    host.onState = (s) => states.push(s);
    await until(() => host.status.k === 'waiting', 'in the room');
    relay.cut('host');
    await until(() => host.status.k === 'retrying', 'retrying');
    await until(() => host.status.k === 'waiting', 'back in the room');
    expect(states).toEqual([]);
    host.close();
    expect(states).toEqual(['closed']);
  });

  it('keeps trying when the relay connection drops, and opens again once both are back', async () => {
    const relay = new FakeRelay();
    const { host, guest } = links(relay);
    const states: string[] = [];
    host.onState = (s) => states.push(s);
    await until(() => host.state === 'open' && guest.state === 'open', 'both open');
    relay.cut('guest');
    await until(() => states.includes('closed'), 'the host hears the guest left');
    await until(() => host.state === 'open' && guest.state === 'open', 'both open again');
    expect(states.slice(-2)).toEqual(['closed', 'open']);
    const got: string[] = [];
    guest.onMessage = (t) => got.push(t);
    host.send('{"after":"reconnect"}');
    await until(() => got.length === 1, 'a message after');
    host.close();
    guest.close();
    await until(() => relay.open === 0, 'all closed');
    expect(relay.rooms.size).toBe(0);
  });
});

// ---------------------------------------------------------------- sessions over the relay

async function connect(o: { timer?: number; now?: () => number } = {}) {
  const relay = new FakeRelay();
  const { host: ht, guest: gt, invite } = links(relay);
  const hs = memStore();
  const gs = memStore();
  const hr = recorder();
  const gr = recorder();
  const host = new OnlineHost({ name: 'Annabelle', deck: deckA, heartbeat: false, store: hs, recorder: hr.r, timer: o.timer ?? 0, ...(o.now ? { now: o.now } : {}) });
  const guest = new OnlineGuest({ name: 'Bartholomew', deck: deckB, heartbeat: false, store: gs, recorder: gr.r, resume: null, ...(o.now ? { now: o.now } : {}) });
  host.attach(ht);
  guest.attach(gt);
  await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
  const chooser: OnlineSessionAny = host.chooser === 'me' ? host : guest;
  chooser.chooseFirst(true);
  await until(() => !!host.board && !!guest.board, 'the first view');
  return { relay, invite, host, guest, ht, gt, hr, gr, gs };
}

/** Card ids, names and the players' and decks' names that must never be readable on the relay. */
function secretsOf(decks: DeckList[], names: string[]): string[] {
  const out = new Set<string>(names);
  for (const d of decks) {
    out.add(d.name);
    for (const id of [...d.legends, ...d.main]) out.add(id);
  }
  return [...out].filter((s) => s.length >= 6);
}

describe('a game between two sessions through the relay', () => {
  it('plays to the end; each side records once; the relay saw no card, name or address, and only frames within the caps', async () => {
    const { relay, host, guest, hr, gr } = await connect();
    const r0 = rng(5);
    const r1 = rng(6);
    let checked = 0;
    for (let k = 0; k < 20_000 && !(host.over && guest.over); k++) {
      await flush();
      const hp = host.seat.pending;
      if (hp) host.seat.answer(hp.d, pick(hp.d, r0));
      const gp = guest.seat.pending;
      if (gp) {
        expect(guest.board!.s).toEqual(JSON.parse(JSON.stringify(viewFor(host.game!.g.s, 1))));
        checked++;
        guest.seat.answer(gp.d, pick(gp.d, r1));
      }
    }
    await until(() => !!host.over && !!guest.over && !!guest.record(), 'the end and the record');
    // the roll's secrets and the join secret are random, so the game's length differs from run to run (18 guest
    // decisions failed a "more than 20" check on CI): ask only for enough to show the view was compared throughout
    expect(checked).toBeGreaterThan(5);
    expect(hr.entries).toHaveLength(1);
    expect(gr.entries).toHaveLength(1);
    expect(gr.replays).toHaveLength(1);
    expect(gr.replays[0]!.pvp!.rivalChoices).toEqual(hr.replays[0]!.choices);
    // everything the relay operator could read
    expect(relay.seen.length).toBeGreaterThan(50);
    const secrets = secretsOf([deckA, deckB], ['Annabelle', 'Bartholomew']);
    expect(secrets.length).toBeGreaterThan(20);
    for (const [i, f] of relay.seen.entries()) {
      expect(f.length, `frame ${i}`).toBeLessThanOrEqual(MAX_FRAME);
      for (const s of secrets) expect(f.includes(s), `"${s}" in frame ${i}`).toBe(false);
      expectNoAddresses(f, `relay frame ${i}`, [], { mdns: false });
      const keys = Object.keys(JSON.parse(f) as object).sort();
      expect(['d,t', 'peer,t', 'here,t', 'role,room,t,v', 't'], `frame ${i} fields`).toContain(keys.join(','));
    }
    host.close();
    guest.close();
  }, 120_000);

  it('a dropped link comes back by itself: the guest resumes at the same decision; the turn timer pauses meanwhile', async () => {
    const { relay, host, guest } = await connect({ timer: 60 });
    const r = rng(9);
    for (let k = 0; k < 2000; k++) {
      await flush();
      const hp = host.seat.pending;
      if (hp) host.seat.answer(hp.d, pick(hp.d, r));
      if (k > 30 && guest.seat.pending) break;
      const gp = guest.seat.pending;
      if (gp) guest.seat.answer(gp.d, pick(gp.d, r));
    }
    const want = guest.seat.pending!.d;
    relay.cut('guest');
    await until(() => host.conn === 'lost', 'the host sees the link lost');
    expect(host.timerPaused).toBe(true);
    await until(() => host.conn === 'open' && guest.conn === 'open' && !!guest.seat.pending && host.chat.lines.some((l) => /is back/.test(l.text)), 'back', 4000);
    expect(host.timerPaused).toBe(false);
    expect(guest.seat.pending!.d).toEqual(want);
    host.close();
    guest.close();
  }, 60_000);

  it('the heartbeat goes through the relay, and silence marks the link lost', async () => {
    let clock = 1_000_000;
    const { relay, host, guest } = await connect({ now: () => clock });
    const msgs = () => relay.seen.filter((f) => f.startsWith('{"t":"msg"')).length;
    const n = msgs();
    host.tick();
    // the ping to the guest and its pong back: two sealed frames each way through the relay
    await until(() => msgs() >= n + 4, 'ping and pong');
    expect(host.conn).toBe('open');
    clock += LOST_MS + 1;
    guest.close();
    host.tick();
    expect(host.conn).toBe('lost');
    host.close();
  });

  it('concede and a rematch work over the relay', async () => {
    const { host, guest, gr } = await connect();
    guest.concede();
    await until(() => !!host.over && !!guest.over, 'the concession');
    await until(() => gr.replays.length === 1, 'the record');
    host.offerRematch();
    guest.offerRematch();
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the rematch roll');
    host.close();
    guest.close();
  });
});
