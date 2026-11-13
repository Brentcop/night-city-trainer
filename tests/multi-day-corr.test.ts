// Multi-day games against a person (src/net/corr.ts, corrSession.ts, packet.ts): two simulated devices that share
// nothing but the turn packets they hand each other. A full game to the end with every packet to the guest searched for
// hidden cards; packets refused when replayed, reordered, edited or from another game; claiming a win on time and
// giving more time; moving a game to another device; and the packet counts and sizes (do they fit a link?).
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { makeTierBot } from '../src/ai/tiers';
import type { HeuristicAgent } from '../src/ai/heuristic';
import { validateDeck } from '../src/engine/deck';
import type { Decision, DeckList } from '../src/engine/types';
import { gameDeck } from '../src/lib/tournament';
import { loadLibrary } from '../scripts/lib-node';
import { ongoingFileText, parseOngoingFile } from '../src/lib/multiDay';
import { clockState, DAY_MS, type CorrGame } from '../src/net/corr';
import { FINISHED_KEEP, kvCorrStore, parseCorrGame, pruneList, settled, slimGame } from '../src/net/corrStore';
import { CorrSession, createInvite, joinGame, readInvite } from '../src/net/corrSession';
import { WRONG_PHRASE } from '../src/net/codeLock';
import { applyPatch, codeFromText, diffView, lockedPacketInfo, MAX_LINK_PACKET, openPacket, viewHash } from '../src/net/packet';
import type { OnlineOutcome, OnlineRecorder } from '../src/net/record';
import { viewFor } from '../src/net/view';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { expectNoAddresses, expectNoHiddenIds } from './netLeak';

const LIB = loadLibrary();
const legal = LIB.map((d) => gameDeck(d.deck)).filter((d) => validateDeck(d).length === 0);
const deckA: DeckList = legal[0]!;
const deckB: DeckList = legal[Math.min(5, legal.length - 1)]!;
const deckC: DeckList = legal[Math.min(11, legal.length - 1)]!;

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

function memKV() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), m };
}
function recorder() {
  const entries: OnlineOutcome[] = [];
  const replays: PracticeReplay[] = [];
  const r: OnlineRecorder = { entry: (o) => entries.push(o), replay: (x) => replays.push(x) };
  return { r, entries, replays };
}
function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

const T0 = Date.parse('2026-11-12T10:00:00.000Z');
const HOUR = 3_600_000;

/** Two devices: a host and a guest, each with its own storage, recorder and clock, joined by the invite and the reply. */
async function pair(o: { decks?: [DeckList, DeckList]; days?: number; phrase?: string } = {}) {
  const clock = { t: T0 };
  const now = () => clock.t;
  const hs = kvCorrStore(memKV());
  const gs = kvCorrStore(memKV());
  const hr = recorder();
  const gr = recorder();
  const [dh, dg] = o.decks ?? [deckA, deckB];
  const days = o.days ?? 7;
  const inv = await createInvite({ name: 'Ana', deck: dh, days, prefFirst: true }, now(), o.phrase);
  hs.save(inv.game);
  const info = await readInvite(`https://example.test/#/play/turn/${inv.code}`, o.phrase);
  expect(info).toMatchObject({ ok: true, host: 'Ana', deck: dh.name, days, locked: !!o.phrase });
  clock.t += HOUR;
  const j = await joinGame(inv.code, { name: 'Bo', deck: dg, days: 0, prefFirst: false, auto: true }, now(), o.phrase);
  if (!j.ok) throw new Error(j.why);
  gs.save(j.game);
  const host = await CorrSession.open(hs.load()[0]!, { store: hs, recorder: hr.r, now });
  const guest = await CorrSession.open(gs.load()[0]!, { store: gs, recorder: gr.r, now });
  clock.t += HOUR;
  expect(await host.receive(j.code)).toBeNull();
  return { clock, now, hs, gs, hr, gr, host, guest, invite: inv.code, join: j.code };
}

type Pair = Awaited<ReturnType<typeof pair>>;

/**
 * Play on: each side answers its own decisions; a new packet is carried to the other side (an hour later). Every packet
 * to the guest is searched for hidden cards against the host's real game at that moment.
 */
async function playOn(P: Pair, o: { seed: number; maxPackets?: number; until?: () => boolean; check?: boolean; bots?: [HeuristicAgent, HeuristicAgent] }) {
  const r0 = rng(o.seed);
  const r1 = rng(o.seed + 1000);
  // the players' "brains": random answers, or bots deciding on the host's real game (in this harness only: the guest's
  // device never sees that game)
  const brain = async (seat: 0 | 1, d: Decision) => {
    const game = P.host.game!;
    if (!o.bots) return pick(d, seat === 0 ? r0 : r1);
    const real = game.seats[seat].pending!.d;
    return (await o.bots[seat].decide(game.g, real))[0]!;
  };
  const { host, guest, clock } = P;
  let toGuest = host.outbox?.n ?? 0;
  let toHost = guest.outbox?.n ?? 0;
  const stats = { packets: 0, hostPackets: 0, guestPackets: 0, sizes: [] as number[], hostSizes: [] as number[], guestSizes: [] as number[], fullViews: 0, links: 0 };
  for (let k = 0; k < 40_000; k++) {
    await host.idle();
    await guest.idle();
    if (o.until?.()) break;
    if (o.maxPackets !== undefined && stats.packets >= o.maxPackets) break;
    if (host.g.end && guest.g.end && guest.g.end.replay && (host.outbox?.n ?? 0) <= toGuest && (guest.outbox?.n ?? 0) <= toHost) break;
    const hp = host.seat.pending;
    if (hp) {
      expect(host.seat.answer(hp.d, await brain(0, hp.d))).toBe(true);
      continue;
    }
    if (host.outbox && host.outbox.n > toGuest) {
      toGuest = host.outbox.n;
      const code = host.outbox.code;
      const opened = await openPacket(code);
      if (!opened.ok) throw new Error(opened.why);
      const b = opened.value.packet.b;
      if (o.check !== false && host.game && b.t === 'move' && !b.end) expectNoHiddenIds(host.game.g.s, 1, opened.value.json, `packet ${toGuest}`);
      if (o.check !== false) expectNoAddresses(opened.value.json, `packet ${toGuest}`);
      if (b.t === 'move' && b.view) stats.fullViews++;
      stats.packets++;
      stats.hostPackets++;
      stats.sizes.push(code.length);
      stats.hostSizes.push(code.length);
      if (code.length <= MAX_LINK_PACKET) stats.links++;
      clock.t += HOUR;
      expect(await guest.receive(code)).toBeNull();
      // the guest's board is exactly what viewFor shows it
      if (o.check !== false && host.game && !guest.g.end) expect(guest.board!.s).toEqual(JSON.parse(JSON.stringify(viewFor(host.game.g.s, 1))));
      continue;
    }
    const gp = guest.seat.pending;
    if (gp) {
      if (o.check !== false && host.game) expect(gp.d).toEqual(JSON.parse(JSON.stringify(host.game.pendingView(1)!.d)));
      expect(guest.seat.answer(gp.d, await brain(1, gp.d))).toBe(true);
      continue;
    }
    if (guest.outbox && guest.outbox.n > toHost) {
      toHost = guest.outbox.n;
      const code = guest.outbox.code;
      stats.packets++;
      stats.guestPackets++;
      stats.sizes.push(code.length);
      stats.guestSizes.push(code.length);
      if (code.length <= MAX_LINK_PACKET) stats.links++;
      clock.t += HOUR;
      expect(await host.receive(code)).toBeNull();
      continue;
    }
  }
  return stats;
}

/** Carry the newest packet of `from` to `to`; the reason when it was refused. */
async function carry(P: Pair, from: CorrSession, to: CorrSession, hours = 1) {
  P.clock.t += hours * HOUR;
  return to.receive(from.outbox!.code);
}

/** Play until the host's own decision waits, at least `packets` into the game. */
async function untilHostDecides(P: Pair, seed: number, packets = 6) {
  await playOn(P, { seed, until: () => !!P.host.seat.pending && P.host.g.head!.n >= packets });
  expect(P.host.seat.pending).not.toBeNull();
}

/** A packet with its JSON changed by hand (its MAC left as it was). */
function edited(code: string, change: (json: string) => string): string {
  const raw = Buffer.from(code.slice(2), 'base64url');
  const bytes = code[1] === '1' ? zlib.inflateRawSync(raw) : raw;
  const text = bytes.toString('utf8');
  return `T0${Buffer.from(text.slice(0, 64) + change(text.slice(64)), 'utf8').toString('base64url')}`;
}

describe('a multi-day game between two devices, by turn packets only', () => {
  it('plays to the end; the guest only ever gets its view; each side records once (multi-day, pvp)', async () => {
    const P = await pair();
    const s = await playOn(P, { seed: 3 });
    const { host, guest, hr, gr } = P;
    expect(host.g.end).not.toBeNull();
    expect(guest.g.end).not.toBeNull();
    const flip = { win: 'loss', loss: 'win', draw: 'draw' } as const;
    expect(guest.g.end!.result).toBe(flip[host.g.end!.result]);
    expect(hr.entries).toHaveLength(1);
    expect(gr.entries).toHaveLength(1);
    expect(hr.replays).toHaveLength(1);
    expect(gr.replays).toHaveLength(1);
    expect(hr.entries[0]!.multiDay).toEqual({ days: 7 });
    expect(gr.replays[0]!.multiDay).toEqual({ days: 7 });
    expect(gr.replays[0]!.botLevel).toBe('pvp');
    expect(gr.replays[0]!.pvp).toMatchObject({ seat: 1, rival: 'Ana' });
    expect(gr.replays[0]!.pvp!.rivalChoices).toEqual(hr.replays[0]!.choices);
    expect(gr.replays[0]!.choices).toEqual(hr.replays[0]!.pvp!.rivalChoices);
    expect(s.packets).toBeGreaterThan(10);
    // the guest's packets (an answer) always fit a link
    expect(Math.max(...s.guestSizes)).toBeLessThanOrEqual(MAX_LINK_PACKET);
    expect(s.fullViews).toBe(1);
    console.log(`[corr random] packets ${s.packets} (host ${s.hostPackets}, guest ${s.guestPackets}); host packets median ${median(s.hostSizes)} chars, max ${Math.max(...s.hostSizes)}; guest max ${Math.max(...s.guestSizes)}; fit a link ${s.links}/${s.packets}`);
    // the stored games read back, and a finished game reopens on its last board
    expect(parseCorrGame(JSON.parse(JSON.stringify(host.g))).ok).toBe(true);
    expect(parseCorrGame(JSON.parse(JSON.stringify(guest.g))).ok).toBe(true);
    const again = await CorrSession.open(P.gs.load()[0]!, { store: P.gs, recorder: recorder().r, now: P.now });
    expect(again.over?.result).toBe(guest.g.end!.result);
    expect(again.board!.s.winner).toBe(guest.board!.s.winner);
    expect(again.reviewReplay()?.id).toBe(gr.replays[0]!.id);
  }, 120_000);

  it('the host reopening its page mid-game (a replay of its save) carries on with the same packets', async () => {
    const P = await pair();
    await untilHostDecides(P, 4, 6);
    const want = P.host.seat.pending!.d;
    P.host.close();
    const host = await CorrSession.open(P.hs.load()[0]!, { store: P.hs, recorder: P.hr.r, now: P.now });
    expect(host.seat.pending!.d).toEqual(want);
    const Q = { ...P, host };
    await playOn(Q, { seed: 41, maxPackets: 8 });
    expect(host.g.problem).toBeNull();
    expect(P.guest.g.problem).toBeNull();
  }, 60_000);
});

describe('an invite and a reply locked with a phrase (NET-13)', () => {
  const PHRASE = 'lantern orbit river velvet';
  it('a bystander reads nothing; the guest opens it with the phrase; the reply is locked with the same key; the game plays on', async () => {
    const inv = await createInvite({ name: 'Ana', deck: deckA, days: 5, prefFirst: true }, T0, PHRASE);
    expect(inv.code.startsWith('T2')).toBe(true);
    expect(inv.game.lock?.phrase).toBe(PHRASE);
    expect(lockedPacketInfo(inv.code)).toEqual({ purpose: 'corr-invite', salt: inv.game.lock!.salt });
    expect(codeFromText(`https://example.test/app/#/play/turn/${inv.code}`)).toBe(inv.code);
    // without the phrase: nothing, and the key half never shows
    expect(await openPacket(inv.code)).toMatchObject({ ok: false, locked: true });
    const bytes = Buffer.from(inv.code.slice(2), 'base64url').toString('latin1');
    expect(bytes).not.toContain(inv.game.keys.host);
    expect(bytes).not.toContain('Ana');
    expect(await readInvite(inv.code)).toMatchObject({ ok: false, locked: true });
    expect(await readInvite(inv.code, 'lantern orbit river velvets')).toEqual({ ok: false, why: WRONG_PHRASE, locked: true });
    expect(await joinGame(inv.code, { name: 'Bo', deck: deckB, days: 0, prefFirst: false, auto: true }, T0, 'wrong wrong wrong phrase')).toMatchObject({ ok: false, locked: true });
    // the whole game, with the phrase on both sides
    const P = await pair({ phrase: PHRASE, days: 5 });
    expect(P.invite.startsWith('T2')).toBe(true);
    expect(P.join.startsWith('T2')).toBe(true);
    expect(lockedPacketInfo(P.join)?.purpose).toBe('corr-join');
    const joinBytes = Buffer.from(P.join.slice(2), 'base64url').toString('latin1');
    expect(joinBytes).not.toContain(P.guest.g.keys.guest!);
    // the host forgets the phrase once the reply is in; packets after the handshake are signed, not locked
    expect(P.host.g.lock).toBeUndefined();
    expect(P.host.g.stage).toBe('playing');
    await playOn(P, { seed: 31, maxPackets: 6 });
    expect(P.host.outbox!.code.startsWith('T1')).toBe(true);
    expect(P.host.g.problem).toBeNull();
    expect(P.guest.g.problem).toBeNull();
  }, 60_000);

  it('a locked reply for another invite is refused; an unlocked invite still joins; a weak phrase is refused', async () => {
    const a = await createInvite({ name: 'Ana', deck: deckA, days: 5, prefFirst: true }, T0, PHRASE);
    const b = await createInvite({ name: 'Ana', deck: deckA, days: 5, prefFirst: true }, T0, PHRASE);
    const j = await joinGame(b.code, { name: 'Bo', deck: deckB, days: 0, prefFirst: false, auto: true }, T0, PHRASE);
    if (!j.ok) throw new Error(j.why);
    const hs = kvCorrStore(memKV());
    hs.save(a.game);
    const host = await CorrSession.open(a.game, { store: hs, recorder: recorder().r, now: () => T0 });
    expect(await host.receive(j.code)).toMatch(/locked for another invite/);
    expect(host.g.stage).toBe('invited');
    host.close();
    const plain = await createInvite({ name: 'Ana', deck: deckA, days: 5, prefFirst: true }, T0);
    expect(plain.code.startsWith('T1')).toBe(true);
    expect(plain.game.lock).toBeUndefined();
    expect(await readInvite(plain.code)).toMatchObject({ ok: true, locked: false });
    await expect(createInvite({ name: 'Ana', deck: deckA, days: 5, prefFirst: true }, T0, 'too short')).rejects.toThrow(/four words/);
  }, 30_000);
});

describe('the host checks a claim on time by its own clock (NET-8)', () => {
  it('a claim that the host ran out is refused while the host still has time by its own clock', async () => {
    const P = await pair({ days: 3 });
    const { host, guest } = P;
    await untilHostDecides(P, 13, 4);
    // a modified guest (its clock three days ahead) claims at once
    const fake = await CorrSession.open(JSON.parse(JSON.stringify(guest.g)) as CorrGame, { store: kvCorrStore(memKV()), recorder: recorder().r, now: () => P.now() + 3 * DAY_MS });
    expect(await fake.claimWin()).toBe(true);
    const head = JSON.stringify(host.g.head);
    expect(await host.receive(fake.outbox!.code)).toMatch(/claims your time ran out, but by this device.s clock you still have/);
    expect(host.g.end).toBeNull();
    expect(JSON.stringify(host.g.head)).toBe(head);
    fake.close();
  }, 60_000);
});

describe('finished games are kept light (NET-12)', () => {
  it('a settled game drops its save, board and (after a while) its last packet; the list keeps the newest finished games', async () => {
    const P = await pair();
    await playOn(P, { seed: 3 });
    const h = P.hs.load()[0]!;
    const g = P.gs.load()[0]!;
    expect(settled(h) && settled(g)).toBe(true);
    // stored without the heavy parts, but still a finished game that reopens on its last board with its record
    expect(h.host!.save).toBeNull();
    expect(h.host!.sent).toBeNull();
    expect(g.guest!.view).toBeNull();
    expect(h.finalView).not.toBeNull();
    expect(h.record).not.toBeNull();
    expect(h.outbox).not.toBeNull();
    expect(slimGame(h, Date.parse(h.lastPlayed) + 31 * DAY_MS).outbox).toBeNull();
    // a game in progress is never slimmed
    const Q = await pair();
    expect(slimGame(Q.host.g, Date.now() + 365 * DAY_MS)).toBe(Q.host.g);
    // only the newest FINISHED_KEEP finished games stay
    const many = Array.from({ length: FINISHED_KEEP + 5 }, (_, i) => ({ ...h, id: i.toString(16).padStart(16, '0'), lastPlayed: new Date(T0 + i * HOUR).toISOString() }));
    const kept = pruneList([...many, Q.host.g], T0);
    expect(kept).toHaveLength(FINISHED_KEEP + 1);
    expect(kept).toContain(Q.host.g);
    expect(kept.some((x) => x.id === '0000000000000000')).toBe(false);
  }, 120_000);

  it('a full store makes room from finished games before refusing to save the game in progress', async () => {
    const P = await pair();
    await playOn(P, { seed: 3 });
    const done = P.hs.load()[0]!;
    // a storage that holds at most `cap` characters under one key
    const m = new Map<string, string>();
    let cap = Infinity;
    const kv = {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (v.length > cap) throw new Error('QuotaExceededError');
        m.set(k, v);
      },
    };
    const store = kvCorrStore(kv, 'nct.corr.v1', () => T0);
    for (let i = 0; i < 6; i++) expect(store.save({ ...done, id: `${i}`.padStart(16, 'a'), lastPlayed: new Date(T0 + i * HOUR).toISOString() })).toBeNull();
    const Q = await pair();
    const live = Q.host.g;
    cap = m.get('nct.corr.v1')!.length;
    expect(store.save(live)).toBeNull();
    const after = store.load();
    expect(after.some((x) => x.id === live.id)).toBe(true);
    expect(after.filter((x) => settled(x)).length).toBeLessThanOrEqual(6);
    // nothing finished left to drop and still no room: then it says so
    cap = 10;
    expect(store.save(live)).toMatch(/storage is full or blocked/);
  }, 120_000);
});

describe('packets refused, with the reason, and nothing applied', () => {
  it('replayed, reordered, edited, other-game and own packets', async () => {
    const P = await pair();
    const { host, guest } = P;
    await untilHostDecides(P, 5);
    // a copy of the guest's device as it is now (an older device)
    const copyOfGuest = JSON.parse(JSON.stringify(guest.g)) as CorrGame;
    const codes: string[] = [];
    await playOn(P, {
      seed: 6,
      until: () => {
        const o = host.outbox;
        if (o && host.g.head!.f === 'h' && !codes.includes(o.code)) codes.push(o.code);
        return codes.length >= 3 && !!guest.seat.pending;
      },
    });
    expect(codes.length).toBeGreaterThanOrEqual(3);
    const head = JSON.stringify(guest.g.head);
    // replayed: a packet the guest already opened
    expect(await guest.receive(codes[0]!)).toMatch(/already opened|older than/);
    // reordered: the older copy gets a later packet first
    const old = await CorrSession.open(copyOfGuest, { store: kvCorrStore(memKV()), recorder: recorder().r, now: P.now });
    expect(await old.receive(codes[2]!)).toMatch(/A packet is missing/);
    // edited by hand: the MAC no longer fits
    expect(await guest.receive(edited(codes[2]!, (j) => j.replace('"t":', '"t":1')))).toMatch(/changed after it was made/);
    // another game's packet
    const Q = await pair({ decks: [deckC, deckA] });
    expect(await guest.receive(Q.host.outbox!.code)).toMatch(/another game/);
    // your own packet
    expect(await guest.receive(guest.outbox!.code)).toMatch(/packet you made/);
    // not a packet at all
    expect(await guest.receive('hello there')).toMatch(/not a turn packet/);
    expect(JSON.stringify(guest.g.head)).toBe(head);
    old.close();
  }, 60_000);

  it('an answer from a forked copy of the guest is refused by the host', async () => {
    const P = await pair();
    const { host, guest } = P;
    await playOn(P, { seed: 8, until: () => !!guest.seat.pending && host.g.head!.n >= 4 });
    const fork = await CorrSession.open(JSON.parse(JSON.stringify(guest.g)) as CorrGame, { store: kvCorrStore(memKV()), recorder: recorder().r, now: P.now });
    const d = guest.seat.pending!.d;
    guest.seat.answer(d, 0);
    await guest.idle();
    expect(await carry(P, guest, host)).toBeNull();
    // the copy answers the same decision another way: its packet has the same place in the chain, already taken
    fork.seat.answer(fork.seat.pending!.d, d.options.length - 1);
    await fork.idle();
    expect(await carry(P, fork, host)).toMatch(/already opened|older than|does not follow/);
    fork.close();
  }, 60_000);
});

describe('the clock: a chess clock in days, kept by each device', () => {
  it('both devices count the same time used, from the stamps in the packets', async () => {
    const P = await pair({ days: 4 });
    // stop when both devices have seen the same packets
    await playOn(P, { seed: 11, until: () => P.host.g.head!.n >= 12 && P.host.g.head!.n === P.guest.g.head!.n });
    expect(P.host.g.clock.used).toEqual(P.guest.g.clock.used);
    expect(P.host.g.clock.bank).toBe(2 * DAY_MS);
    expect(P.host.g.clock.used[0] + P.host.g.clock.used[1]).toBeGreaterThan(0);
  }, 60_000);

  it('the host gives more time, then claims the win when the guest runs out; the guest records the loss from the last packet', async () => {
    const P = await pair({ days: 4 });
    const { host, guest, hr, gr } = P;
    await playOn(P, { seed: 12, until: () => !!guest.seat.pending && host.g.head!.n >= 4 });
    expect(clockState(host.g, P.now()).canClaim).toBe(false);
    // the guest goes quiet for three days: its two-day clock runs out (on both devices' clocks)
    P.clock.t += 3 * DAY_MS;
    expect(clockState(guest.g, P.now())).toMatchObject({ onMove: 'me', late: true, canClaim: false });
    expect(clockState(host.g, P.now())).toMatchObject({ onMove: 'rival', late: true, canClaim: true });
    // more time: two days; no claim until they run out too
    host.giveTime(2 * DAY_MS);
    expect(clockState(host.g, P.now()).canClaim).toBe(false);
    P.clock.t += 2 * DAY_MS;
    expect(await host.claimWin()).toBe(true);
    expect(host.g.end).toMatchObject({ result: 'win', why: 'timeout', byMe: false });
    expect(await carry(P, host, guest)).toBeNull();
    expect(guest.g.end).toMatchObject({ result: 'loss', why: 'timeout', byMe: true });
    expect(hr.entries[0]!.multiDay).toEqual({ days: 4, timedOut: true });
    expect(gr.replays[0]!.multiDay).toEqual({ days: 4, timedOut: true });
    expect(gr.replays[0]!.pvp!.rivalChoices).toEqual(hr.replays[0]!.choices);
    // the extra time rode in the last packet: both devices agree
    expect(guest.g.clock.extra).toEqual(host.g.clock.extra);
  }, 60_000);

  it('the guest claims when the host runs out; the host applies it and sends back the record', async () => {
    const P = await pair({ days: 3 });
    const { host, guest, gr } = P;
    await untilHostDecides(P, 13, 4);
    expect(await guest.claimWin()).toBe(false);
    P.clock.t += 2 * DAY_MS;
    expect(clockState(guest.g, P.now()).canClaim).toBe(true);
    expect(await guest.claimWin()).toBe(true);
    expect(guest.g.end).toMatchObject({ result: 'win', why: 'timeout' });
    expect(gr.entries).toHaveLength(1);
    expect(gr.replays).toHaveLength(0);
    expect(await carry(P, guest, host)).toBeNull();
    expect(host.g.end).toMatchObject({ result: 'loss', why: 'timeout', byMe: true });
    // the host's last packet brings the record for the guest's Game review
    expect(await carry(P, host, guest)).toBeNull();
    expect(gr.replays).toHaveLength(1);
    expect(guest.g.end!.replay).toBe(true);
    expect(await carry(P, host, guest)).toMatch(/over|already opened/);
  }, 60_000);

  it("a concede that crosses the other side's packet still ends the game on both devices", async () => {
    const P = await pair();
    const { host, guest, hr, gr } = P;
    await playOn(P, { seed: 14, until: () => !!guest.seat.pending && host.g.head!.n >= 5 });
    // the guest answers (its packet n), and at the same time the host concedes (its packet n too)
    guest.seat.answer(guest.seat.pending!.d, 0);
    await guest.idle();
    await host.concede();
    expect(host.g.end).toMatchObject({ result: 'loss', why: 'conceded', byMe: true });
    expect(await carry(P, guest, host)).toMatch(/over/);
    expect(await carry(P, host, guest)).toBeNull();
    expect(guest.g.end).toMatchObject({ result: 'win', why: 'conceded', byMe: false });
    expect(hr.entries[0]!.conceded).toBe(true);
    expect(gr.replays[0]!.pvp!.rivalConceded).toBe(true);
  }, 60_000);
});

describe('moving a game to another device', () => {
  it('an ongoing game exported as a file and imported elsewhere plays on', async () => {
    const P = await pair();
    await playOn(P, { seed: 21, until: () => !!P.guest.seat.pending && P.host.g.head!.n >= 4 });
    const file = ongoingFileText({ type: 'pvp', game: P.guest.g }, '2026-11-13T00:00:00.000Z');
    expect(parseOngoingFile(file)).toMatchObject({ ok: false, why: expect.stringMatching(/could not be checked/) });
    const back = parseOngoingFile(file, parseCorrGame);
    expect(back.ok).toBe(true);
    if (!back.ok || back.value.type !== 'pvp') return;
    const store = kvCorrStore(memKV());
    store.save(back.value.game);
    const moved = await CorrSession.open(store.load()[0]!, { store, recorder: recorder().r, now: P.now });
    expect(moved.seat.pending!.d).toEqual(P.guest.seat.pending!.d);
    expect(moved.board!.s).toEqual(P.guest.board!.s);
    moved.seat.answer(moved.seat.pending!.d, 0);
    await moved.idle();
    expect(await carry(P, moved, P.host)).toBeNull();
    expect(parseOngoingFile('{"kind":"nct-ongoing-game","schema":1,"game":{"kind":"nct-corr-game","schema":1}}', parseCorrGame)).toMatchObject({ ok: false, why: expect.stringMatching(/damaged/) });
    moved.close();
  }, 60_000);
});

describe('views travel as patches', () => {
  it('a patch rebuilds the next view exactly; the hash catches a patch applied to another board', () => {
    const a = { cards: { 1: { zone: 'hand', spent: false } }, turn: 1, list: [1, 2] };
    const b = { cards: { 1: { zone: 'field', spent: true }, 2: { zone: 'hand' } }, turn: 2, list: [2] };
    const p = diffView(a, b);
    expect(applyPatch(a, p)).toEqual(b);
    expect(viewHash(applyPatch(a, p))).toBe(viewHash(b));
    expect(viewHash(applyPatch({ ...a, turn: 9 }, p))).toBe(viewHash(b));
    expect(viewHash(applyPatch({ ...a, other: 1 }, p))).not.toBe(viewHash(b));
  });
});

describe('packets per game and their size (measured)', () => {
  it('easy bots on both sides, several deals', async () => {
    const rows: string[] = [];
    for (const [seed, decks] of [
      [31, [deckA, deckB]],
      [32, [deckB, deckC]],
      [33, [deckC, deckA]],
    ] as [number, [DeckList, DeckList]][]) {
      const P = await pair({ decks });
      const s = await playOn(P, { seed, check: false, bots: [makeTierBot('easy', seed, 'A'), makeTierBot('easy', seed + 7777, 'B')] });
      expect(P.host.g.end).not.toBeNull();
      rows.push(
        `seed ${seed}: ${P.host.g.summary.turn} turns, ${s.packets} packets (${s.guestPackets} round trips); host packets median ${median(s.hostSizes)} chars, max ${Math.max(...s.hostSizes)}; guest max ${Math.max(...s.guestSizes)}; ${s.links}/${s.packets} fit a link`,
      );
    }
    console.log(`[corr bots]\n${rows.join('\n')}`);
  }, 300_000);
});
