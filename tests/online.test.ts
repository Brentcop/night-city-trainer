// Online play (src/net/): the protocol's checks, viewFor's hiding of every hidden card, a full game between two
// sessions over the in-memory link, refused answers, coming back after a reload on either side, the turn timer, and
// the chat's caps.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateDeck } from '../src/engine/deck';
import type { Decision, DeckList, GameState, PlayerId } from '../src/engine/types';
import { gameDeck } from '../src/lib/tournament';
import { loadLibrary } from '../scripts/lib-node';
import { Chat, CHAT_MAX, CHAT_RATE, CHAT_WINDOW_MS, cleanChat } from '../src/net/chat';
import { checkReveal, chosenSeat, commitOf, newNonce } from '../src/net/fair';
import { defaultAnswer, HostGame, parseHostSave, type OnlineSetup } from '../src/net/hostGame';
import { CAPS, encode, parseGuestMessage, parseHostMessage } from '../src/net/protocol';
import type { OnlineOutcome, OnlineRecorder } from '../src/net/record';
import { OnlineGuest, OnlineHost, REFUSALS_PER_SECOND, type OnlineSessionAny } from '../src/net/session';
import { loopbackPair, type Transport } from '../src/net/transport';
import { HIDDEN_BASE, redactLine, viewDecision, viewFor, ViewGame } from '../src/net/view';
import { decodeSignal, encodeSignal } from '../src/net/webrtc';
import type { PracticeReplay } from '../src/lib/practiceReplays';
import { expectNoAddresses, hiddenUids, knownIds } from './netLeak';

const LIB = loadLibrary();
const legal = LIB.map((d) => gameDeck(d.deck)).filter((d) => validateDeck(d).length === 0);
const deckA: DeckList = legal[0]!;
const deckB: DeckList = legal[Math.min(5, legal.length - 1)]!;
const deckC: DeckList = legal[Math.min(11, legal.length - 1)]!;

/** A small seeded random number generator for the players' "brains". */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 2 ** 32;
  };
}
/** Pick an option, passing often enough that games end. */
function pick(d: Decision, r: () => number): number {
  const pass = d.options.findIndex((o) => o.action?.type === 'pass' || o.action?.type === 'endReact');
  if (pass >= 0 && r() < 0.35) return pass;
  return Math.floor(r() * d.options.length);
}

const setup = (seed: number, first: PlayerId = 0, timer = 0, decks: [DeckList, DeckList] = [deckA, deckB]): OnlineSetup => ({
  game: `g${seed}`,
  token: 't'.repeat(32),
  names: ['Ana', 'Bo'],
  decks,
  seed,
  first,
  timer,
  started: '2026-11-12T00:00:00.000Z',
});

const flush = () => new Promise((r) => setTimeout(r, 0));

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------- protocol

describe('protocol', () => {
  it('reads back what it encodes, building fresh objects from the checked fields only', () => {
    const hello = { v: 1 as const, t: 'hello' as const, name: 'Bo', deck: { name: 'X', legends: ['a'], main: ['b'], sideboard: [] }, resume: { game: 'g', token: 'k' } };
    const p = parseGuestMessage(JSON.stringify({ ...hello, extra: 'dropped' }));
    expect(p).toEqual({ ok: true, msg: hello });
    expect(parseGuestMessage(encode({ v: 1, t: 'answer', seq: 3, i: 2 }))).toEqual({ ok: true, msg: { v: 1, t: 'answer', seq: 3, i: 2 } });
    expect(parseHostMessage(encode({ v: 1, t: 'start', youFirst: true }))).toEqual({ ok: true, msg: { v: 1, t: 'start', youFirst: true } });
  });
  it('refuses malformed, oversized and unknown messages', () => {
    const bad = [
      'not json',
      '[]',
      JSON.stringify({ v: 2, t: 'chat', text: 'x' }),
      JSON.stringify({ v: 1, t: 'nope' }),
      JSON.stringify({ v: 1, t: 'answer', seq: 1, i: -1 }),
      JSON.stringify({ v: 1, t: 'answer', seq: 1.5, i: 0 }),
      JSON.stringify({ v: 1, t: 'answer', seq: 1, i: '0' }),
      JSON.stringify({ v: 1, t: 'chat', text: 'x'.repeat(CAPS.chat + 1) }),
      JSON.stringify({ v: 1, t: 'hello', name: 'x'.repeat(CAPS.name + 1), deck: { name: 'd', legends: [], main: [] } }),
      JSON.stringify({ v: 1, t: 'hello', name: 'Bo', deck: { name: 'd', legends: [], main: Array(CAPS.main + 1).fill('a') } }),
      JSON.stringify({ v: 1, t: 'commit', h: 'zz' }),
      'x'.repeat(CAPS.guestMessage + 1),
    ];
    for (const b of bad) expect(parseGuestMessage(b).ok, b.slice(0, 60)).toBe(false);
    expect(parseHostMessage(JSON.stringify({ v: 1, t: 'view', n: 1, state: {}, decision: null, timeLeft: null, waiting: null, end: null, error: null })).ok).toBe(false);
  });
  it('a host view of a real game survives the round trip', () => {
    const h = new HostGame(setup(3));
    const v = h.view(1);
    const text = encode({ v: 1, t: 'view', n: 1, state: v.state, decision: v.decision, timeLeft: null, waiting: 0, end: null, error: null });
    const p = parseHostMessage(text);
    expect(p.ok).toBe(true);
    if (p.ok && p.msg.t === 'view') expect(p.msg.state).toEqual(JSON.parse(JSON.stringify(v.state)));
    h.quit();
  });
  it('invite codes round-trip and anything else is refused', async () => {
    const sdp = 'v=0\r\no=- 1 2 IN IP4 127.0.0.1\r\ns=-\r\na=extmap-allow-mixed\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';
    const code = await encodeSignal({ k: 'o', sdp });
    expect(code).toMatch(/^[01][A-Za-z0-9_-]+$/);
    const back = await decodeSignal(code, 'o');
    expect(back?.sdp).toContain('webrtc-datachannel');
    expect(back?.sdp).not.toContain('extmap-allow-mixed');
    expect(await decodeSignal(code, 'a')).toBeNull();
    expect(await decodeSignal('hello there', 'o')).toBeNull();
    expect(await decodeSignal(`${code.slice(0, 20)}`, 'o')).toBeNull();
  });
  it('the fair roll: each side checks the other and both get the same chooser', async () => {
    const a = newNonce();
    const b = newNonce();
    expect(await checkReveal(await commitOf(a), a)).toBe(true);
    expect(await checkReveal(await commitOf(a), b)).toBe(false);
    expect(chosenSeat(a, b)).toBe(chosenSeat(a, b));
    expect([0, 1]).toContain(chosenSeat(a, b));
  });
});

// ---------------------------------------------------------------- viewFor

/** Every leak check for one seat's view of one position. */
function checkView(st: GameState, d: Decision | null, seat: PlayerId) {
  const view = viewFor(st, seat);
  const text = JSON.stringify({ view, d: d && d.player === seat ? viewDecision(st, d, seat) : null });
  const known = knownIds(st, seat);
  const rival = (1 - seat) as PlayerId;
  // the cards the seat may not see: both decks, the rival's hand, every Eddie, face-down Legends it doesn't know
  for (const u of hiddenUids(st, seat)) {
    const id = st.cards[u]!.defId;
    if (!known.has(id)) expect(text.includes(`"${id}"`), `hidden ${id} (uid ${u}) in seat ${seat}'s view`).toBe(false);
    // the real uid of a hidden card names its place in the list: it is never a card of the view
    expect(view.cards[u], `hidden uid ${u} in seat ${seat}'s view`).toBeUndefined();
  }
  expect(view.rng).toBe(0);
  expect(view.players[1].listId).toBeUndefined();
  // turned round: the seat is player 0, its hand is visible, the rival's is counted only
  expect(view.players[0].hand.length).toBe(st.players[seat].hand.length);
  expect(view.players[0].hand.every((u) => view.cards[u]?.defId === st.cards[u]?.defId)).toBe(true);
  expect(view.players[1].hand.every((u) => u >= HIDDEN_BASE)).toBe(true);
  expect(view.players[0].deck.length).toBe(st.players[seat].deck.length);
  expect(view.players[1].deck.length).toBe(st.players[rival].deck.length);
  // the rival never shows what it sold or took into its hand unseen
  for (const l of view.log) if (l.player === 1) expect(l.text).toBe(redactLine(l.text));
  // the board's calls work on the view alone
  const g = new ViewGame(view);
  for (const p of [0, 1] as PlayerId[]) {
    for (const u of [...view.players[p].field]) g.power(u);
    for (const u of [...view.players[p].hand, ...view.players[p].legends, ...view.players[p].eddies, ...view.players[p].trash]) g.name(u);
    g.streetCred(p);
    g.payables(p);
  }
  return view;
}

describe('viewFor hides what a seat may not see', () => {
  it('for every decision of several seeded games, from both seats', async () => {
    let decisions = 0;
    for (const [seed, decks] of [
      [11, [deckA, deckB]],
      [12, [deckB, deckC]],
      [13, [deckC, deckA]],
      [14, [deckB, deckA]],
    ] as [number, [DeckList, DeckList]][]) {
      const h = new HostGame(setup(seed, (seed % 2) as PlayerId, 0, decks));
      const r = rng(seed);
      for (let k = 0; k < 2000 && !h.ended && !h.error; k++) {
        await flush();
        const w = h.waitingSeat();
        if (w === null) continue;
        const d = h.seats[w].pending!.d;
        checkView(h.g.s, d, 0);
        checkView(h.g.s, d, 1);
        decisions++;
        expect(h.answer(w, h.seats[w].pending!.seq, pick(d, r))).toBeNull();
      }
      expect(h.error).toBeNull();
      h.quit();
    }
    expect(decisions).toBeGreaterThan(200);
  }, 60_000);

  it('a face-down Legend its controller knows shows to it, never to the rival; a sold card is named (it was revealed), one taken unseen is not', () => {
    const h = new HostGame(setup(21));
    const st = h.g.s;
    const fd = st.players[0].legends.find((u) => !st.cards[u]!.faceUp)!;
    st.cards[fd]!.known = true;
    const own = viewFor(st, 0);
    expect(own.cards[fd]?.defId).toBe(st.cards[fd]!.defId);
    const theirs = viewFor(st, 1);
    expect(theirs.cards[fd]).toBeUndefined();
    expect(Object.values(theirs.cards).some((c) => c.zone === 'legends' && c.known && c.defId === 'hidden-legend')).toBe(true);
    // Sell for Turn reveals the card it sells (Comprehensive Rules 8.11, 5.8.2.2): named for both, as in practice games
    st.log.push({ turn: 1, player: 0, text: 'sells Some Card for an Eddie' });
    expect(viewFor(st, 1).log.at(-1)).toEqual({ turn: 1, player: 1, text: 'sells Some Card for an Eddie' });
    expect(viewFor(st, 0).log.at(-1)!.text).toBe('sells Some Card for an Eddie');
    // a card taken into the hand unseen stays unnamed for the rival
    st.log.push({ turn: 1, player: 0, text: 'adds Some Card to hand' });
    expect(viewFor(st, 1).log.at(-1)!.text).toBe('adds a card to hand');
    h.quit();
  });
});

// ---------------------------------------------------------------- sessions over the loopback link

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
}
function recorder() {
  const entries: OnlineOutcome[] = [];
  const replays: PracticeReplay[] = [];
  const r: OnlineRecorder = { entry: (o) => entries.push(o), replay: (x) => replays.push(x) };
  return { r, entries, replays };
}

async function until(f: () => boolean, what: string, steps = 400) {
  for (let i = 0; i < steps; i++) {
    if (f()) return;
    await flush();
  }
  throw new Error(`timed out waiting for ${what}`);
}

/**
 * A loopback pair whose sends are recorded in `log` and can be held back (`pass` false: dropped), so a test can see
 * every message and cut the link at a chosen moment.
 */
function tapPair(log: string[] = [], pass: (from: 'h' | 'g', text: string) => boolean = () => true): [Transport, Transport] {
  const [a, b] = loopbackPair();
  const wrap = (t: Transport, from: 'h' | 'g'): Transport => ({
    get state() {
      return t.state;
    },
    send: (x) => {
      log.push(x);
      if (pass(from, x)) t.send(x);
    },
    close: () => t.close(),
    get onMessage() {
      return t.onMessage;
    },
    set onMessage(f) {
      t.onMessage = f;
    },
    get onState() {
      return t.onState;
    },
    set onState(f) {
      t.onState = f;
    },
  });
  return [wrap(a, 'h'), wrap(b, 'g')];
}

/** Connect a host and a guest and get them through the roll to the first decision. */
async function connect(seed = 1, o: { log?: string[]; timer?: number } = {}) {
  const hs = memStore();
  const gs = memStore();
  const hr = recorder();
  const gr = recorder();
  const host = new OnlineHost({ name: 'Ana', deck: deckA, heartbeat: false, store: hs, recorder: hr.r, timer: o.timer ?? 0 });
  const guest = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: gs, recorder: gr.r, resume: null });
  const [a, b] = tapPair(o.log);
  host.attach(a);
  guest.attach(b);
  await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
  expect(host.chooser).toBe(guest.chooser === 'me' ? 'rival' : 'me');
  const chooser: OnlineSessionAny = host.chooser === 'me' ? host : guest;
  chooser.chooseFirst(seed % 2 === 0);
  await until(() => !!host.board && !!guest.board, 'the first view');
  return { host, guest, hs, gs, hr, gr };
}

describe('a game between two sessions over the loopback link', () => {
  it('plays to the end; the guest always sees exactly its view; each side records once; no message names an address', async () => {
    const log: string[] = [];
    const { host, guest, hr, gr } = await connect(2, { log });
    expect(guest.rivalName).toBe('Ana');
    expect(host.rivalDeck).toBe(deckB.name);
    expect(guest.rivalDeck).toBe(deckA.name);
    const r0 = rng(5);
    const r1 = rng(6);
    let checked = 0;
    for (let k = 0; k < 5000 && !(host.over && guest.over); k++) {
      await flush();
      const hp = host.seat.pending;
      if (hp) host.seat.answer(hp.d, pick(hp.d, r0));
      const gp = guest.seat.pending;
      if (gp) {
        // the host waits on the guest, so the guest's board is the host's view for seat 1 exactly
        expect(guest.board!.s).toEqual(JSON.parse(JSON.stringify(viewFor(host.game!.g.s, 1))));
        expect(gp.d).toEqual(JSON.parse(JSON.stringify(host.game!.pendingView(1)!.d)));
        checked++;
        guest.seat.answer(gp.d, pick(gp.d, r1));
      }
    }
    await until(() => !!host.over && !!guest.over && !!guest.record(), 'the end and the record');
    // the first-player roll uses fresh random secrets, so the game and its length differ from run to run (a short one
    // has under 20 guest decisions): ask only for enough to show the view was compared throughout a real game
    expect(checked).toBeGreaterThan(5);
    expect(guest.board!.s).toEqual(JSON.parse(JSON.stringify(viewFor(host.game!.g.s, 1))));
    const flip = { win: 'loss', loss: 'win', draw: 'draw' } as const;
    expect(guest.over!.result).toBe(flip[host.over!.result]);
    expect(hr.entries).toHaveLength(1);
    expect(gr.entries).toHaveLength(1);
    expect(hr.replays).toHaveLength(1);
    expect(gr.replays).toHaveLength(1);
    expect(hr.entries[0]!.rival).toBe('Bo');
    expect(gr.replays[0]!.pvp).toMatchObject({ seat: 1, rival: 'Ana' });
    // both records are the same game: the host's answers are the guest's rival answers
    expect(gr.replays[0]!.pvp!.rivalChoices).toEqual(hr.replays[0]!.choices);
    expect(gr.replays[0]!.choices).toEqual(hr.replays[0]!.pvp!.rivalChoices);
    expect(log.length).toBeGreaterThan(50);
    log.forEach((m, i) => expectNoAddresses(m, `message ${i}`));
    host.close();
    guest.close();
  }, 60_000);

  it('refuses out-of-turn, stale and illegal answers without applying them', async () => {
    const { host, guest } = await connect(4);
    const h = host.game!;
    // drive until the host's own decision waits, then send guest answers
    for (let k = 0; k < 200 && h.waitingSeat() !== 0; k++) {
      await flush();
      const gp = guest.seat.pending;
      if (gp) guest.seat.answer(gp.d, 0);
    }
    expect(h.waitingSeat()).toBe(0);
    const before = h.answers[1].length;
    expect(h.answer(1, h.seq, 0)).toMatch(/Nothing is waiting/);
    const guestSend = (o: object) => (guest as unknown as { send: (m: object) => void }).send(o);
    guestSend({ v: 1, t: 'answer', seq: h.seq, i: 0 });
    await until(() => host.notes.some((n) => /Nothing is waiting/.test(n)), 'the refusal');
    expect(h.answers[1].length).toBe(before);
    // the host's seat: stale sequence numbers and options out of range are refused
    expect(h.answer(0, h.seq - 1, 0)).toMatch(/earlier decision/);
    expect(h.answer(0, h.seq, 999)).toMatch(/not one of the options/);
    // a malformed message is refused and noted
    (guest as unknown as { transport: { send: (t: string) => void } }).transport.send('{"v":1,"t":"answer","seq":"x","i":0}');
    await until(() => host.notes.some((n) => /Refused a message/.test(n)), 'the malformed refusal');
    host.close();
    guest.close();
  });

  it('a guest reload comes back to the same decision with a new connection', async () => {
    const { host, guest, gs } = await connect(6);
    const r = rng(9);
    // play a little, until the guest has a decision
    for (let k = 0; k < 300; k++) {
      await flush();
      const hp = host.seat.pending;
      if (hp) host.seat.answer(hp.d, pick(hp.d, r));
      if (k > 30 && guest.seat.pending) break;
      const gp = guest.seat.pending;
      if (gp) guest.seat.answer(gp.d, pick(gp.d, r));
    }
    const want = guest.seat.pending!.d;
    const state = guest.board!.s;
    // the guest's page reloads: a new session reads its resume token from storage; a new link to the same host
    guest.close();
    const again = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: gs, recorder: recorder().r });
    expect(again.resume).not.toBeNull();
    const [a, b] = loopbackPair();
    host.attach(a);
    again.attach(b);
    await until(() => !!again.seat.pending, 'the decision again');
    expect(again.stage).toBe('game');
    expect(again.seat.pending!.d).toEqual(want);
    expect(again.board!.s).toEqual(state);
    host.close();
    again.close();
  });

  it('a host reload restores the game from its save and the guest comes back to the same decision', async () => {
    // play a few turns, until the host has a decision (a game that ends first is dealt again)
    let c = await connect(8);
    for (let tries = 0; ; tries++) {
      const r = rng(10 + tries);
      for (let k = 0; k < 400 && !c.host.over; k++) {
        await flush();
        const hp = c.host.seat.pending;
        if (hp && c.host.game!.g.s.turn >= 3) break;
        if (hp) c.host.seat.answer(hp.d, pick(hp.d, r));
        const gp = c.guest.seat.pending;
        if (gp) c.guest.seat.answer(gp.d, pick(gp.d, r));
      }
      if (c.host.seat.pending || tries >= 3) break;
      c.host.close();
      c.guest.close();
      c = await connect(8);
    }
    const { host, guest, hs } = c;
    expect(host.seat.pending).not.toBeNull();
    const wantHost = host.seat.pending!.d;
    const realState = JSON.parse(JSON.stringify(host.game!.g.s)) as GameState;
    host.flush();
    const save = parseHostSave(hs.getItem('nct.online.host.v1'));
    expect(save).not.toBeNull();
    host.quit();
    // the host's page reloads
    const back = await OnlineHost.restore(save!, { heartbeat: false, store: hs, recorder: recorder().r });
    expect(back.seat.pending!.d).toEqual(wantHost);
    const { log: _a, ...restBack } = back.game!.g.s;
    const { log: _b, ...restReal } = realState;
    expect(restBack).toEqual(restReal);
    // the guest (its page still open) joins with a new invite and its token
    const [a, b] = loopbackPair();
    back.attach(a);
    guest.attach(b);
    await until(() => back.conn === 'open' && guest.board!.s.turn === realState.turn && back.chat.lines.some((l) => /is back/.test(l.text)), 'the guest back');
    back.close();
    guest.close();
  }, 20_000);

  it('a deck that is not legal is refused in the lobby', async () => {
    const host = new OnlineHost({ name: 'Ana', deck: deckA, heartbeat: false, store: memStore(), recorder: recorder().r });
    const guest = new OnlineGuest({ name: 'Bo', deck: { ...deckB, main: deckB.main.slice(0, 10) }, heartbeat: false, store: memStore(), recorder: recorder().r, resume: null });
    const [a, b] = loopbackPair();
    host.attach(a);
    guest.attach(b);
    await until(() => guest.stage === 'refused', 'the refusal');
    expect(guest.problem).toMatch(/deck can't be used/);
    expect(host.stage).toBe('waiting');
    host.close();
    guest.close();
  });

  it('concede ends the game for both, recorded once each as conceded / won', async () => {
    const { host, guest, hr, gr } = await connect(10);
    guest.concede();
    await until(() => !!host.over && !!guest.over, 'the concession');
    expect(guest.over).toMatchObject({ result: 'loss', conceded: true });
    expect(host.over).toMatchObject({ result: 'win', rivalConceded: true });
    await until(() => gr.replays.length === 1, 'the record');
    expect(hr.entries).toHaveLength(1);
    expect(gr.entries).toHaveLength(1);
    expect(gr.replays[0]!.conceded).toBe(true);
    expect(hr.replays[0]!.pvp!.rivalConceded).toBe(true);
    // a mutual rematch starts a new roll
    host.offerRematch();
    guest.offerRematch();
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the rematch roll');
    host.close();
    guest.close();
  });
});

// ---------------------------------------------------------------- a link lost before the game starts

/** Cut the link of a connected pair (both sides see it closed). */
function cut(t: Transport) {
  t.close();
}

describe('a link lost before the game starts comes back (NET-6)', () => {
  /** Host and guest over a tapped link, the host's messages filtered by `pass`. */
  function lobby(pass: (from: 'h' | 'g', text: string) => boolean) {
    const hs = memStore();
    const gs = memStore();
    const host = new OnlineHost({ name: 'Ana', deck: deckA, heartbeat: false, store: hs, recorder: recorder().r });
    const guest = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: gs, recorder: recorder().r, resume: null });
    const [a, b] = tapPair([], pass);
    host.attach(a);
    guest.attach(b);
    return { host, guest, gs, a };
  }
  /** A new link (a new invite and reply), then on to the first view. */
  async function reconnectAndStart(host: OnlineHost, guest: OnlineGuest) {
    const back = host.chat.lines.filter((l) => /is back/.test(l.text)).length;
    const [a, b] = tapPair();
    host.attach(a);
    guest.attach(b);
    await until(() => host.chat.lines.filter((l) => /is back/.test(l.text)).length > back, 'the guest back');
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll again');
    const chooser = host.chooser;
    (host.chooser === 'me' ? host : guest).chooseFirst(true);
    await until(() => !!host.board && !!guest.board, 'the first view');
    expect(host.stage).toBe('game');
    expect(guest.stage).toBe('game');
    return chooser;
  }

  it('during the roll', async () => {
    // the host's commitment never reaches the guest: both wait in the roll when the link goes
    const { host, guest, a } = lobby((from, t) => !(from === 'h' && t.includes('"t":"commit"')));
    await until(() => host.stage === 'roll' && guest.stage === 'roll' && guest.resume !== null, 'the roll');
    await flush();
    cut(a);
    await until(() => host.conn === 'lost' && guest.conn === 'lost', 'the link lost');
    expect(guest.resume?.nonce).toMatch(/^[0-9a-f]{32}$/);
    await reconnectAndStart(host, guest);
    host.close();
    guest.close();
  }, 30_000);

  it('during the first-or-second choice: the roll comes out the same', async () => {
    const { host, guest, a } = lobby(() => true);
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
    const before = host.chooser;
    cut(a);
    await until(() => host.conn === 'lost', 'the link lost');
    expect(await reconnectAndStart(host, guest)).toBe(before);
    host.close();
    guest.close();
  }, 30_000);

  it('after a reload of the guest page during the choice (its roll secret kept with its token)', async () => {
    const { host, guest, gs, a } = lobby(() => true);
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
    const before = host.chooser;
    guest.close();
    cut(a);
    const again = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: gs, recorder: recorder().r });
    expect(again.resume?.nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(await reconnectAndStart(host, again)).toBe(before);
    // the game started: the secret is no longer kept
    expect(JSON.parse(gs.getItem('nct.online.guest.v1')!).nonce).toBeUndefined();
    host.close();
    again.close();
  }, 30_000);

  it('a guest back with another roll secret is refused (no re-roll by dropping the link)', async () => {
    const { host, guest, gs, a } = lobby(() => true);
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the roll');
    guest.close();
    cut(a);
    const saved = JSON.parse(gs.getItem('nct.online.guest.v1')!);
    const again = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: gs, recorder: recorder().r, resume: { ...saved, nonce: undefined } });
    const [x, y] = tapPair();
    host.attach(x);
    again.attach(y);
    await until(() => again.stage === 'refused', 'the refusal');
    expect(again.problem).toMatch(/different roll/);
    expect(host.stage).toBe('waiting');
    host.close();
    again.close();
  }, 30_000);

  it('after a rematch, before its game starts', async () => {
    const { host, guest } = await connect(14);
    guest.concede();
    await until(() => !!host.over && !!guest.over, 'the concession');
    host.offerRematch();
    guest.offerRematch();
    await until(() => host.stage === 'choose' && guest.stage === 'choose', 'the rematch roll');
    const before = host.chooser;
    (host as unknown as { transport: Transport }).transport.close();
    await until(() => host.conn === 'lost' && guest.conn === 'lost', 'the link lost');
    expect(await reconnectAndStart(host, guest)).toBe(before);
    host.close();
    guest.close();
  }, 30_000);
});

// ---------------------------------------------------------------- refusals are rate-limited

describe('refused guest messages (NET-9)', () => {
  it('past a few a second they are dropped unanswered and counted in one note', async () => {
    let t = 1_000_000;
    const host = new OnlineHost({ name: 'Ana', deck: deckA, heartbeat: false, store: memStore(), recorder: recorder().r, now: () => t });
    const guest = new OnlineGuest({ name: 'Bo', deck: deckB, heartbeat: false, store: memStore(), recorder: recorder().r, resume: null, now: () => t });
    const log: string[] = [];
    const [a, b] = tapPair(log);
    host.attach(a);
    guest.attach(b);
    await until(() => host.stage === 'choose', 'the roll');
    const notes = host.notes.length;
    const versions = host.version;
    for (let i = 0; i < 60; i++) b.send('{"v":1,"t":"answer","seq":"x","i":0}');
    await until(() => guest.notes.filter((n) => /host refused/.test(n)).length >= REFUSALS_PER_SECOND, 'the answers');
    await flush();
    expect(log.filter((m) => m.includes('"t":"reject"'))).toHaveLength(REFUSALS_PER_SECOND);
    expect(host.notes.length - notes).toBe(REFUSALS_PER_SECOND);
    expect(host.version - versions).toBeLessThanOrEqual(REFUSALS_PER_SECOND + 2);
    t += 1500;
    b.send('{"v":1,"t":"answer","seq":"x","i":0}');
    await until(() => host.notes.some((n) => /Dropped 50 more refused messages/.test(n)), 'the summary');
    host.close();
    guest.close();
  });
});

// ---------------------------------------------------------------- turn timer

describe('turn timer', () => {
  it('pauses while the connection is lost and goes on with the time that was left (NET-7)', async () => {
    vi.useFakeTimers();
    const h = new HostGame(setup(32, 0, 30));
    await vi.advanceTimersByTimeAsync(0);
    const w = h.waitingSeat()!;
    await vi.advanceTimersByTimeAsync(10_000);
    h.pauseTimer();
    expect(h.timerPaused).toBe(true);
    expect(h.timeLeft()).toBeNull();
    await vi.advanceTimersByTimeAsync(120_000);
    expect(h.answers[w]).toEqual([]);
    h.resumeTimer();
    expect(h.timeLeft()).toBe(20_000);
    await vi.advanceTimersByTimeAsync(19_000);
    expect(h.answers[w]).toEqual([]);
    // a decision asked while paused waits with its whole time
    h.pauseTimer();
    expect(h.answer(w, h.seq, 0)).toBeNull();
    await vi.advanceTimersByTimeAsync(0);
    const w2 = h.waitingSeat()!;
    await vi.advanceTimersByTimeAsync(300_000);
    expect(h.answers[w2]).toHaveLength(w2 === w ? 1 : 0);
    h.resumeTimer();
    expect(h.timeLeft()).toBe(30_000);
    h.quit();
  });

  it('the sessions pause it on a lost link and say so on both sides', async () => {
    const { host, guest } = await connect(16, { timer: 60 });
    await until(() => host.deadlineAt !== null || guest.deadlineAt !== null, 'a timed decision');
    expect(host.timerPaused).toBe(false);
    (host as unknown as { transport: Transport }).transport.close();
    await until(() => host.conn === 'lost' && guest.conn === 'lost', 'the link lost');
    expect(host.game!.timerPaused).toBe(true);
    expect(host.timerPaused).toBe(true);
    expect(guest.timerPaused).toBe(true);
    expect(host.game!.timeLeft()).toBeNull();
    const [a, b] = tapPair();
    host.attach(a);
    guest.attach(b);
    await until(() => host.conn === 'open' && guest.conn === 'open' && !host.timerPaused, 'back');
    expect(host.game!.timeLeft()).toBeGreaterThan(50_000);
    expect(guest.timerPaused).toBe(false);
    host.close();
    guest.close();
  });

  it('answers with the safe default when time runs out and says so in the log', async () => {
    vi.useFakeTimers();
    const h = new HostGame(setup(31, 0, 30));
    await vi.advanceTimersByTimeAsync(0);
    const w = h.waitingSeat()!;
    const d = h.seats[w].pending!.d;
    expect(d.kind).toBe('yesno'); // the mulligan
    expect(h.timeLeft()).toBe(30_000);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(h.answers[w]).toEqual([[defaultAnswer(d)]]);
    expect(d.options[defaultAnswer(d)]!.key).toBe('no'); // keep the hand
    // the log names the kind of choice only, never the option (a label can name a card the other seat can't see)
    const line = h.g.s.log.find((l) => /Time ran out/.test(l.text))!;
    expect(line.text).toMatch(/^Time ran out for (Ana|Bo): a yes-or-no choice was answered automatically$/);
    expect(line.text).not.toContain(d.options[defaultAnswer(d)]!.label);
    h.quit();
  });
  it('the default is pass, no reaction or "none" when offered, else the first option', () => {
    const d = (kind: Decision['kind'], options: Decision['options']): Decision => ({ player: 0, kind, prompt: '', options, min: 1, max: 1 });
    expect(defaultAnswer(d('action', [{ label: 'a', action: { type: 'sell', uid: 1 } }, { label: 'p', action: { type: 'pass' } }]))).toBe(1);
    expect(defaultAnswer(d('reaction', [{ label: 'b', action: { type: 'block', uid: 1 } }, { label: 'e', action: { type: 'endReact' } }]))).toBe(1);
    expect(defaultAnswer(d('card', [{ label: 'x', uid: 1 }, { label: 'None', key: 'none' }]))).toBe(1);
    expect(defaultAnswer(d('mode', [{ label: 'x', key: '0' }, { label: 'y', key: '1' }]))).toBe(0);
  });
});

// ---------------------------------------------------------------- chat

describe('chat', () => {
  it('plain text, one line, capped', () => {
    expect(cleanChat('  hi\nthere\u0007 ‮')).toBe('hi there');
    expect(cleanChat('x'.repeat(CHAT_MAX + 50))).toHaveLength(CHAT_MAX);
    expect(new Chat().outgoing('   ')).toBeNull();
  });
  it('rate-limits the sender and drops a flood on the receiving side', () => {
    const c = new Chat();
    for (let i = 0; i < CHAT_RATE; i++) expect(c.outgoing(`m${i}`, 1000 + i)).toBe(`m${i}`);
    expect(c.outgoing('one more', 2000)).toBeNull();
    expect(c.waitMs(2000)).toBeGreaterThan(0);
    expect(c.outgoing('later', 1000 + CHAT_WINDOW_MS + 1)).toBe('later');
    const r = new Chat();
    let got = 0;
    for (let i = 0; i < 20; i++) if (r.incoming(`x${i}`, false, 5000 + i)) got++;
    expect(got).toBeLessThan(20);
    expect(r.lines.filter((l) => l.from === 'system')).toHaveLength(1);
    expect(r.unread).toBe(got);
    r.muted = true;
    const n = r.lines.length;
    r.incoming('muted', false, 5000 + CHAT_WINDOW_MS * 2);
    expect(r.lines.length).toBe(n);
  });
  it('travels between the sessions, capped on receipt', async () => {
    const { host, guest } = await connect(12);
    expect(guest.sendChat('gg <b>hi</b>')).toBe(true);
    await until(() => host.chat.lines.some((l) => l.from === 'rival'), 'the message');
    expect(host.chat.lines.find((l) => l.from === 'rival')!.text).toBe('gg <b>hi</b>');
    expect(host.chat.unread).toBe(1);
    host.setChatSeen(true);
    expect(host.chat.unread).toBe(0);
    host.close();
    guest.close();
  });
});
