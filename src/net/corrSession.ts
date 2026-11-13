// One device's side of a multi-day game against a person (src/net/corr.ts), played by turn packets (packet.ts).
//
// The host's device runs the real game (HostGame, as in live online play): it applies the guest's answers through the
// same check as live play (the decision actually waiting, by its number and an option index), plays the host's own
// decisions on its board, and whenever the game waits on the guest (or ends) makes a packet with the guest's view
// (viewFor), the guest's decision and the log lines since. The guest's device draws that view and sends back only its
// answer. Nothing is sent while the host decides, so the host takes a whole turn before a packet is needed; each of the
// guest's decisions (its reactions and blocks during the host's turn too) costs a round trip, because only the host's
// device knows the hidden cards that decide what comes next.
//
// Every packet is checked: its MAC (the game key made at the handshake), then the chain (its number follows the last
// packet's and it names that packet's MAC), so a stale, repeated, reordered, edited or other game's packet is refused
// with the reason and nothing is applied. Time is injected (`now`), never read inside the logic.
import { validateDeck } from '../engine/deck';
import type { Decision, DeckList, GameState, PlayerId } from '../engine/types';
import type { PracticeReplay } from '../lib/practiceReplays';
import { gameDeck, SIM_VERSION } from '../lib/tournament';
import { Chat } from './chat';
import {
  clockGrant,
  clockPass,
  clockStart,
  clockState,
  CORR_CHAT_KEEP,
  CORR_KIND,
  CORR_SCHEMA,
  mySeat,
  newClock,
  spanText,
  timeLeft,
  type CorrGame,
} from './corr';
import { keyFromPhrase, phraseProblem, type CodeKey } from './codeLock';
import type { CorrStore } from './corrStore';
import { checkReveal, chosenSeat, commitOf, newNonce } from './fair';
import { HostGame, type OnlineSetup } from './hostGame';
import {
  applyPatch,
  checkMac,
  diffView,
  gameKey,
  MAX_GRANT,
  lockedPacketInfo,
  openPacket,
  packetLock,
  packPacket,
  PACKET_CHAT,
  PACKET_KIND,
  PACKET_VERSION,
  randomHex,
  viewHash,
  type Body,
  type GuestBody,
  type HostBody,
  type Opened,
  type Packet,
  type Patch,
} from './packet';
import { readViewState, tryRead, type DeckMsg, type GameRecordMsg, type ViewMsg } from './protocol';
import { browserRecorder, replayOf, type OnlineOutcome, type OnlineRecorder } from './record';
import { cleanName, SeatControl, type Over } from './session';
import { VIEW_LOG_LINES, ViewGame, viewFor, viewLog } from './view';

export interface CorrDeps {
  store: CorrStore;
  recorder?: OnlineRecorder;
  /** the clock (epoch ms); tests pass their own */
  now: () => number;
}

const iso = (t: number) => new Date(t).toISOString();
const deckMsg = (d: DeckList): DeckMsg => ({ name: d.name.slice(0, 80), legends: [...d.legends], main: [...d.main], sideboard: [] });
const deckOf = (d: DeckMsg): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] });
const copy = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;
const SAFE_KEY = /^[A-Za-z0-9_:.-]{1,80}$/;
const patchFits = (p: Patch) => [...p.s.map((x) => x[0]), ...p.r].every((path) => path.length <= 8 && path.every((k) => SAFE_KEY.test(k) && k !== '__proto__' && k !== 'prototype' && k !== 'constructor'));
/** a view without its log (the log travels as new lines only) */
const stripLog = (v: GameState): GameState => ({ ...v, log: [] });

/** Wait until the engine has moved on to a decision, the end, or an error (it runs on promises). */
async function settle(h: HostGame) {
  for (let i = 0; i < 50_000; i++) {
    if (h.ended || h.error || h.stopped || h.waitingSeat() !== null || h.g.s.winner !== null) return;
    await new Promise((r) => setTimeout(r, 0));
  }
}

// ---------------------------------------------------------------- starting a game: the invite and the reply

export interface NewGame {
  name: string;
  deck: DeckList;
  days: number;
  /** go first if the roll picks you */
  prefFirst: boolean;
}

function baseGame(o: { id: string; role: 'host' | 'guest'; me: string; deck: DeckList; days: number; now: number; nonce: string; prefFirst: boolean; auto: boolean; hostKey: string; guestKey: string | null }): CorrGame {
  return {
    kind: CORR_KIND,
    schema: CORR_SCHEMA,
    id: o.id,
    role: o.role,
    me: o.me,
    rival: null,
    myDeck: { name: o.deck.name, legends: [...o.deck.legends], main: [...o.deck.main], sideboard: [] },
    rivalDeck: null,
    days: o.days,
    created: iso(o.now),
    lastPlayed: iso(o.now),
    stage: o.role === 'host' ? 'invited' : 'joined',
    keys: { host: o.hostKey, guest: o.guestKey },
    nonce: o.nonce,
    prefFirst: o.prefFirst,
    auto: o.auto,
    head: null,
    prevHead: null,
    outbox: null,
    clock: newClock(o.days),
    chat: [],
    unsent: [],
    grantOwed: 0,
    summary: { turn: 0, gigs: [0, 0], yourMove: false, reaction: false },
    end: null,
    problem: null,
    finalView: null,
    record: null,
  };
}

/** How long a host's clock may run ahead of the guest's before a claim on time is refused (devices' clocks differ). */
export const CLAIM_SKEW_MS = 15 * 60_000;

const saltHex = (k: CodeKey) => [...k.salt].map((b) => b.toString(16).padStart(2, '0')).join('');

/**
 * The host makes a new game and its invite packet. With `phrase`, the invite is locked with it (the guest needs the
 * phrase to read it, and its reply is locked with the same key): the phrase must pass phraseProblem.
 */
export async function createInvite(o: NewGame, now: number, phrase?: string | null): Promise<{ game: CorrGame; code: string }> {
  if (phrase && phraseProblem(phrase)) throw new Error(phraseProblem(phrase)!);
  const lock = phrase ? await packetLock(phrase) : null;
  const id = randomHex(8);
  const hostKey = randomHex(32);
  const nonce = newNonce();
  const commit = await commitOf(nonce);
  const name = cleanName(o.name, 'Host');
  const packet: Packet = { k: PACKET_KIND, v: PACKET_VERSION, g: id, n: 0, p: '', f: 'h', t: now, b: { t: 'invite', name, deck: o.deck.name.slice(0, 80), days: o.days, key: hostKey, commit, sv: SIM_VERSION } };
  const { code } = await packPacket(packet, null, lock);
  const game = baseGame({ id, role: 'host', me: name, deck: gameDeck(o.deck), days: o.days, now, nonce, prefFirst: o.prefFirst, auto: true, hostKey, guestKey: null });
  if (phrase && lock) game.lock = { phrase, salt: saltHex(lock) };
  // the invite has no MAC: the chain starts from the host's commitment
  game.head = { n: 0, m: commit, f: 'h' };
  game.outbox = { n: 0, code, made: iso(now) };
  game.host = { save: null, sent: null, guestDeck: null, rolled: false, first: null };
  return { game, code };
}

/** What an invite says (to show before joining), or why it is not one (`locked`: it needs the phrase, or another one). */
export async function readInvite(text: string, phrase?: string | null): Promise<{ ok: true; id: string; host: string; deck: string; days: number; sv: number; locked: boolean } | { ok: false; why: string; locked?: true }> {
  const r = await openPacket(text, phrase);
  if (!r.ok) return r;
  const b = r.value.packet.b;
  if (b.t !== 'invite') return { ok: false, why: 'This is a packet of a game in progress, not an invite.' };
  return { ok: true, id: r.value.packet.g, host: b.name, deck: b.deck, days: b.days, sv: b.sv, locked: !!r.lock };
}

/** The guest joins with its deck: its game and the reply packet for the host (locked like the invite, with its key). */
export async function joinGame(text: string, o: NewGame & { auto: boolean }, now: number, phrase?: string | null): Promise<{ ok: true; game: CorrGame; code: string } | { ok: false; why: string; locked?: true }> {
  const r = await openPacket(text, phrase);
  if (!r.ok) return r;
  const p = r.value.packet;
  const b = p.b;
  if (b.t !== 'invite') return { ok: false, why: 'This is a packet of a game in progress, not an invite.' };
  if (b.sv !== SIM_VERSION) return { ok: false, why: `The host's app runs version ${b.sv} of the rules engine and yours runs ${SIM_VERSION}: both players need the same version (reload the page, or ask the host to).` };
  const deck = gameDeck(o.deck);
  const errs = validateDeck(deck);
  if (errs.length) return { ok: false, why: `Your deck can't be used: ${errs[0]}` };
  const guestKey = randomHex(32);
  const nonce = newNonce();
  const name = cleanName(o.name, 'Guest');
  const key = await gameKey(b.key, guestKey);
  const join: Packet = { k: PACKET_KIND, v: PACKET_VERSION, g: p.g, n: 1, p: b.commit, f: 'g', t: now, b: { t: 'join', name, deck: deckMsg(deck), key: guestKey, nonce, first: o.prefFirst, auto: o.auto } };
  const packed = await packPacket(join, key, r.lock);
  const game = baseGame({ id: p.g, role: 'guest', me: name, deck, days: b.days, now, nonce, prefFirst: o.prefFirst, auto: o.auto, hostKey: b.key, guestKey });
  game.rival = cleanName(b.name, 'Host');
  game.rivalDeck = b.deck;
  game.prevHead = { n: 0, m: b.commit, f: 'h' };
  game.head = { n: 1, m: packed.mac, f: 'g' };
  game.outbox = { n: 1, code: packed.code, made: iso(now) };
  // the host is on move from the reply's stamp
  game.clock = clockStart(newClock(b.days), 0, now);
  game.guest = { commit: b.commit, view: null, decision: null, waiting: 1 };
  return { ok: true, game, code: packed.code };
}

// ---------------------------------------------------------------- the session

/** Does this packet end the game (it may then cross the other side's last packet)? */
const endsGame = (b: Body) => (b.t === 'answer' && (b.concede || b.claim)) || (b.t === 'move' && b.end !== null);

export class CorrSession {
  version = 0;
  readonly seat: SeatControl;
  readonly chat = new Chat();
  chatSeen = false;
  board: ViewGame | null = null;
  /** host only: the real game */
  game: HostGame | null = null;
  /** whose decision the game waits on: 0 you, 1 the rival */
  waiting: 0 | 1 | null = null;
  over: Over | null = null;
  /** a packet is being made or applied */
  busy = false;
  /** the board bumps when the game (re)starts */
  match = 1;
  private key: CryptoKey | null = null;
  /** host, invited: the key the invite was locked with (made from the phrase once, when a locked reply arrives) */
  private lockKey: CodeKey | null = null;
  private subs = new Set<() => void>();
  private queue: Promise<unknown> = Promise.resolve();
  private recorder: OnlineRecorder;
  private pendKey = -1;
  private replayCache: { rec: GameRecordMsg; r: PracticeReplay } | null = null;

  private constructor(
    public g: CorrGame,
    private deps: CorrDeps,
  ) {
    this.recorder = deps.recorder ?? browserRecorder;
    this.seat = new SeatControl((d, i) => this.submit(d, i));
    for (const l of g.chat) this.chat.lines.push({ ...l });
  }

  /** Open a stored game: the host's is rebuilt by replaying its save. */
  static async open(g: CorrGame, deps: CorrDeps): Promise<CorrSession> {
    const s = new CorrSession(copy(g), deps);
    await s.init();
    return s;
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  };
  private changed() {
    this.version++;
    for (const f of [...this.subs]) f();
  }
  /** Run one step at a time (packets, answers and verdicts never interleave). */
  private run<T>(f: () => Promise<T>): Promise<T> {
    const p = this.queue.then(async () => {
      this.busy = true;
      this.changed();
      try {
        return await f();
      } finally {
        this.busy = false;
        this.changed();
      }
    });
    this.queue = p.catch(() => undefined);
    return p;
  }
  /** Settles once everything asked so far is done (tests). */
  idle(): Promise<void> {
    return this.queue.then(() => undefined);
  }

  get role() {
    return this.g.role;
  }
  get rivalName() {
    return this.g.rival ?? (this.g.role === 'host' ? 'Guest' : 'Host');
  }
  get engineSeat(): PlayerId {
    return mySeat(this.g);
  }

  private async init() {
    const g = this.g;
    if (g.keys.guest) this.key = await gameKey(g.keys.host, g.keys.guest);
    if (g.end) {
      // a finished game shows its last board; nothing runs
      this.over = overOf(g.end);
      if (g.finalView) this.board = new ViewGame(copy(g.finalView));
      return;
    }
    if (g.role === 'host') {
      const save = g.host?.save;
      if (save && g.stage === 'playing') {
        try {
          this.useGame(await HostGame.restore(save));
        } catch (e) {
          g.problem = `This game can't be continued on this version of the app: ${(e as Error).message}`;
        }
      }
    } else if (g.guest?.view) {
      this.board = new ViewGame(copy(g.guest.view));
      this.waiting = g.guest.waiting;
      if (g.guest.decision) {
        this.seat.pending = { d: g.guest.decision.d };
        this.pendKey = g.guest.decision.seq;
      }
    }
  }

  // ------------------------------------------------------------ the host's game

  private useGame(game: HostGame) {
    this.game = game;
    this.board = new ViewGame(viewFor(game.g.s, 0));
    game.onChange = () => this.hostChanged();
    this.hostChanged();
  }

  private hostChanged() {
    const game = this.game;
    if (!game || !this.board) return;
    this.board.s = viewFor(game.g.s, 0);
    const pv = game.pendingView(0);
    if (!pv || this.g.end) {
      this.seat.pending = null;
      this.pendKey = -1;
    } else if (pv.seq !== this.pendKey) {
      this.pendKey = pv.seq;
      this.seat.pending = { d: pv.d };
    }
    const w = game.waitingSeat();
    this.waiting = w === null ? null : w === 0 ? 0 : 1;
    this.changed();
  }

  /** After an answer or a packet: let the engine move on, answer the guest's automatic choices, then send or save. */
  private async pumpHost(force = false) {
    const game = this.game;
    if (!game) return;
    for (let k = 0; k < 10_000; k++) {
      await settle(game);
      const pv = game.seats[1].pending;
      if (this.g.auto && pv && (pv.d.kind === 'pay' || pv.d.kind === 'order') && !game.ended) {
        // the guest asked for the automatic way: option 0 is what automatic payment or first-in-first-out picks
        game.answer(1, pv.seq, 0);
        continue;
      }
      break;
    }
    const over = !!game.ended || !!game.error || game.g.s.winner !== null;
    if (over && !this.g.end) {
      await this.hostFinish();
      return;
    }
    const w = game.waitingSeat();
    // a packet is owed when the guest must decide and the last packet of the chain is the guest's
    if (w === 1 && (force || this.g.head?.f === 'g')) await this.hostSend();
    else this.persist();
  }

  /** The guest's packet: the view now, its decision, the log since, the chat, and the record once it is over. */
  private async hostSend() {
    const game = this.game!;
    const g = this.g;
    const h = g.host!;
    const now = this.deps.now();
    const st = game.g.s;
    const full = stripLog(viewFor(st, 1));
    const hash = viewHash(full);
    let viewPart: { view: GameState } | { patch: Patch } = { view: full };
    if (h.sent) {
      const patch = diffView(h.sent.view, full);
      if (patchFits(patch) && JSON.stringify(patch).length < JSON.stringify(full).length) viewPart = { patch };
    }
    const log = viewLog(st.log.slice(h.sent ? h.sent.logLen : 0), 1);
    const w = game.waitingSeat();
    const e = game.ended;
    const end: ViewMsg['end'] = e ? { why: e.why, by: e.by === undefined ? null : e.by === 1 ? 0 : 1 } : st.winner !== null ? { why: 'finished', by: null } : null;
    const pv = game.pendingView(1);
    const body: HostBody = {
      t: 'move',
      ...(!h.rolled && h.first !== null ? { roll: { nonce: g.nonce, first: h.first } } : {}),
      ...viewPart,
      hash,
      log,
      decision: pv && !end ? { seq: pv.seq, d: pv.d } : null,
      waiting: end ? null : w === 1 ? 0 : w === 0 ? 1 : null,
      end,
      ...(end ? { record: this.record()! } : {}),
      chat: g.unsent.slice(0, PACKET_CHAT),
      ...(g.grantOwed > 0 ? { grant: Math.min(MAX_GRANT, g.grantOwed) } : {}),
      ...(game.error ? { error: game.error.slice(0, 300) } : {}),
    };
    await this.sendPacket(body, now, !!end);
    h.sent = { view: full, logLen: st.log.length };
    h.rolled = true;
    this.persist();
  }

  /** The game ended on the host: record it once, and send the guest the last packet (the end and the record). */
  private async hostFinish() {
    const game = this.game!;
    const g = this.g;
    const st = viewFor(game.g.s, 0);
    const e = game.ended;
    const end: ViewMsg['end'] = e ? { why: e.why, by: e.by === undefined ? null : e.by === 0 ? 0 : 1 } : { why: 'finished', by: null };
    if (game.error && !e) {
      g.problem = `The game stopped because of an error: ${game.error}`;
      await this.hostSend();
      return;
    }
    this.finishWith(st, end);
    await this.hostSend();
  }

  // ------------------------------------------------------------ packets out

  private async sendPacket(body: Body, now: number, over: boolean) {
    const g = this.g;
    const head = g.head!;
    const packet: Packet = { k: PACKET_KIND, v: PACKET_VERSION, g: g.id, n: head.n + 1, p: head.m, f: g.role === 'host' ? 'h' : 'g', t: now, b: body };
    const packed = await packPacket(packet, this.key);
    g.prevHead = head;
    g.head = { n: packet.n, m: packed.mac, f: packet.f };
    g.outbox = { n: packet.n, code: packed.code, made: iso(now) };
    g.clock = clockPass(g.clock, mySeat(g), now, over || !!g.end);
    g.unsent = g.unsent.slice(PACKET_CHAT);
    g.grantOwed = 0;
    g.lastPlayed = iso(now);
  }

  /** The packet to send now (made after your move), or null. */
  get outbox() {
    return this.g.outbox;
  }

  /** The guest's answer: it goes to the host in a packet at once (the next decision needs the host's device). */
  private submit(d: Decision, i: number): boolean {
    const g = this.g;
    if (g.role === 'host') {
      const game = this.game;
      const pv = game?.pendingView(0);
      if (!game || !pv || pv.d !== d || g.end) return false;
      if (game.answer(0, pv.seq, i) !== null) return false;
      void this.run(() => this.pumpHost());
      return true;
    }
    const dec = g.guest?.decision;
    if (!dec || this.seat.pending?.d !== d || g.end || this.busy) return false;
    this.seat.pending = null;
    g.guest!.decision = null;
    g.guest!.waiting = 1;
    this.waiting = 1;
    void this.run(() => this.guestSend({ t: 'answer', a: { seq: dec.seq, i }, chat: [] }));
    this.changed();
    return true;
  }

  private async guestSend(body: GuestBody, over = false) {
    const g = this.g;
    const b: GuestBody = { ...body, chat: g.unsent.slice(0, PACKET_CHAT), ...(g.grantOwed > 0 ? { grant: Math.min(MAX_GRANT, g.grantOwed) } : {}) };
    await this.sendPacket(b, this.deps.now(), over);
    this.persist();
  }

  // ------------------------------------------------------------ packets in

  /** Open a packet from the rival (a link, code or file text): null when it was applied, else why it was refused. */
  receive(text: string): Promise<string | null> {
    return this.run(() => this.receiveNow(text));
  }

  private async receiveNow(text: string): Promise<string | null> {
    const g0 = this.g;
    if (!this.lockKey && g0.lock && lockedPacketInfo(text)) {
      const salt = g0.lock.salt.match(/../g)!.map((h) => parseInt(h, 16));
      this.lockKey = await keyFromPhrase(g0.lock.phrase, new Uint8Array(salt));
    }
    const r = await openPacket(text, this.lockKey);
    if (!r.ok) return r.locked ? (this.g.role === 'host' && this.g.stage === 'invited' ? 'This reply is locked for another invite (not the one of this game).' : 'This packet is locked: only an invite and its reply are, and this game is past them.') : r.why;
    const o = r.value;
    const p = o.packet;
    const g = this.g;
    const mine = g.role === 'host' ? 'h' : 'g';
    if (p.g !== g.id) return `This packet belongs to another game, not this one (${g.myDeck.name} vs ${g.rivalDeck ?? 'your rival'}). Open it from the Ongoing games list, or from its link.`;
    if (p.f === mine) return `This is a packet you made. Send it to ${this.rivalName}; their reply is the one to open here.`;
    if (p.b.t === 'invite') return g.role === 'host' ? 'This is the invite of this game: it is for your rival to open.' : 'You already joined this game with this invite.';
    // the MAC: the host learns the guest's half of the key from the reply itself
    let key = this.key;
    if (!key && g.role === 'host' && p.b.t === 'join') key = await gameKey(g.keys.host, p.b.key);
    if (!key || !(await checkMac(o, key))) return `This packet was changed after it was made, or it is not from ${this.rivalName} in this game. It was not used.`;
    const why = this.chainProblem(o);
    if (why) return why;
    if (g.role === 'host') return this.hostGot(o, key);
    return this.guestGot(o);
  }

  /** Why a signed packet of this game does not follow the chain here, or null. */
  private chainProblem(o: Opened): string | null {
    const g = this.g;
    const p = o.packet;
    const head = g.head;
    if (!head) return 'This game has no packets yet.';
    // the guest that ended the game itself (concede, claim) still takes the host's last packet: it brings the record
    const lastRecord = g.role === 'guest' && p.b.t === 'move' && !!p.b.record && !g.end?.replay;
    if (p.n === head.n + 1 && p.p === head.m) return g.stage === 'over' && !lastRecord ? 'This game is already over here.' : null;
    // the rival ended the game (concede, claim, or the host's last packet) at the same time as you sent your packet
    const crossed = head.f === (g.role === 'host' ? 'h' : 'g') && p.n === head.n && p.p === g.prevHead?.m && endsGame(p.b);
    if (crossed) return null;
    if (g.stage === 'over') return 'This game is already over here.';
    if (p.n <= head.n) return o.mac === head.m || o.mac === g.prevHead?.m ? 'You already opened this packet: it is used.' : "This packet is older than the game's last move: it was already used, or replaced by a later one. It was not used.";
    if (p.n > head.n + 1) return `A packet is missing: this is packet ${p.n} of the game and this device is at packet ${head.n}. Ask ${this.rivalName} for the packet before it (or open the earlier one first).`;
    return 'This packet does not follow the last move here (it was made from another copy of this game). It was not used.';
  }

  private takeChat(lines: string[]) {
    for (const t of lines) this.chat.incoming(t, this.chatSeen, this.deps.now());
    this.syncChat();
  }
  private syncChat() {
    this.g.chat = this.chat.lines.slice(-CORR_CHAT_KEEP).map((l) => ({ ...l }));
  }

  private async hostGot(o: Opened, key: CryptoKey): Promise<string | null> {
    const g = this.g;
    const p = o.packet;
    const b = p.b;
    if (b.t === 'join') {
      if (g.stage !== 'invited') return 'Someone already joined this game.';
      const deck = deckOf(b.deck);
      const errs = validateDeck(gameDeck(deck));
      g.rival = cleanName(b.name, 'Guest');
      g.rivalDeck = deck.name;
      g.keys.guest = b.key;
      this.key = key;
      // the phrase did its job: it isn't kept once the reply is in
      delete g.lock;
      this.lockKey = null;
      this.link(o);
      if (errs.length) {
        g.stage = 'refused';
        g.problem = `${g.rival}'s deck can't be used: ${errs[0]}`;
        await this.sendPacket({ t: 'refuse', why: g.problem.slice(0, 300) }, this.deps.now(), true);
        this.persist();
        return null;
      }
      g.auto = b.auto;
      // the roll (fair.ts): the host committed to its secret in the invite, the guest showed its own in the reply
      const chooser = chosenSeat(g.nonce, b.nonce);
      const first: 0 | 1 = chooser === 0 ? (g.prefFirst ? 0 : 1) : b.first ? 1 : 0;
      const seed = new Uint32Array(1);
      crypto.getRandomValues(seed);
      const setup: OnlineSetup = {
        game: g.id,
        token: randomHex(16),
        names: [g.me, g.rival],
        decks: [gameDeck(g.myDeck), gameDeck(deck)],
        seed: seed[0]! % 2 ** 31,
        first,
        timer: 0,
        started: iso(p.t),
      };
      g.host = { ...g.host!, guestDeck: deck, first, rolled: false };
      g.stage = 'playing';
      g.clock = clockStart(g.clock, 0, p.t);
      this.chat.note(`${g.rival} joined with ${deck.name}. ${chooser === 0 ? 'The roll picked you' : `The roll picked ${g.rival}`}: ${first === 0 ? 'you go first' : `${g.rival} goes first`}.`, this.deps.now());
      this.syncChat();
      this.useGame(new HostGame(setup, { now: this.deps.now }));
      await this.pumpHost(true);
      return null;
    }
    if (b.t !== 'answer') return 'This packet is not a move of your rival.';
    const game = this.game;
    if (!game) return g.problem ?? 'This game is not running on this device.';
    // check the answer before anything changes: it must fit the decision actually waiting
    if (b.a && !g.end) {
      const pv = game.pendingView(1);
      if (!pv) return `Nothing is waiting for ${this.rivalName}'s answer here, so this packet does not fit this game.`;
      if (pv.seq !== b.a.seq) return `This packet answers another decision (number ${b.a.seq}; the game waits on number ${pv.seq}). It was not used.`;
      if (b.a.i >= pv.d.options.length) return 'This packet answers with an option that does not exist. It was not used.';
    }
    if (b.claim && !g.end) {
      // the guest says your clock ran out: check it by this device's own clock (with a little room for clocks that differ)
      const left = g.clock.onMove === 0 ? timeLeft(g.clock, 0, this.deps.now() + CLAIM_SKEW_MS) : 1;
      if (left > 0)
        return `${this.rivalName} claims your time ran out, but by this device's clock you still have ${spanText(timeLeft(g.clock, 0, this.deps.now()))}. The packet was not used. (If one of the devices' clocks is wrong, set it right; you can also concede.)`;
    }
    this.link(o);
    this.takeChat(b.chat);
    if (b.grant) g.clock = clockGrant(g.clock, 0, b.grant);
    g.clock = clockPass(g.clock, 1, p.t, !!b.concede || !!b.claim);
    if (g.end) {
      // it crossed the host's own last packet: the game is already over here
      this.persist();
      return null;
    }
    if (b.claim) game.timeLoss(0);
    else if (b.concede) game.concede(1);
    else if (b.a) {
      const why = game.answer(1, b.a.seq, b.a.i);
      if (why) return why;
    }
    await this.pumpHost();
    return null;
  }

  private async guestGot(o: Opened): Promise<string | null> {
    const g = this.g;
    const q = g.guest!;
    const p = o.packet;
    const b = p.b;
    if (b.t === 'refuse') {
      this.link(o);
      g.stage = 'refused';
      g.problem = `${this.rivalName} could not start the game: ${b.why}`;
      this.persist();
      return null;
    }
    if (b.t !== 'move') return 'This packet is not a move of the host.';
    // the roll: the host's secret must match the commitment in its invite, and the first player the rule
    if (b.roll) {
      if (!(await checkReveal(q.commit, b.roll.nonce))) return `${this.rivalName}'s roll does not match what they committed to in the invite, so the roll can't be trusted. Start a new game.`;
      const chooser = chosenSeat(b.roll.nonce, g.nonce);
      if (chooser === 1 && b.roll.first !== (g.prefFirst ? 1 : 0)) return `${this.rivalName}'s game did not follow your first-or-second choice. Start a new game.`;
    }
    // the board: a whole view, or the change from the last one
    let next: GameState;
    if (b.view) next = b.view;
    else {
      if (!q.view) return 'This packet changes a board this device does not have (open the packets in order).';
      try {
        const patched = applyPatch(stripLog(q.view), b.patch!);
        const r = tryRead(() => readViewState(patched));
        if (!r.ok) return `This packet does not fit the board here (${r.why}). It was not used.`;
        next = r.value;
      } catch (e) {
        return `This packet does not fit the board here (${(e as Error).message}). It was not used.`;
      }
    }
    if (viewHash(stripLog(next)) !== b.hash) return 'This packet does not fit the board here (it was made from another copy of the game). It was not used.';
    if (g.end && g.end.replay) return 'This game is already over here.';
    this.link(o);
    const log = [...(q.view?.log ?? []), ...b.log].slice(-VIEW_LOG_LINES);
    next = { ...stripLog(next), log };
    this.takeChat(b.chat);
    if (b.grant) g.clock = clockGrant(g.clock, 1, b.grant);
    g.clock = clockPass(g.clock, 0, p.t, b.end !== null);
    if (b.roll) {
      this.chat.note(b.roll.first === 1 ? 'You go first.' : `${this.rivalName} goes first.`, this.deps.now());
      this.syncChat();
    }
    if (g.end) {
      // you had already ended the game here (concede or claim): this is the host's answer with the full record
      if (b.record) {
        g.record = b.record;
        this.writeReplay();
      }
      this.persist();
      return null;
    }
    g.stage = 'playing';
    q.view = next;
    q.waiting = b.waiting;
    q.decision = b.decision ? { seq: b.decision.seq, d: b.decision.d } : null;
    if (b.error) g.problem = `The game stopped on ${this.rivalName}'s device because of an error: ${b.error}`;
    if (!this.board) this.board = new ViewGame(copy(next));
    else this.board.s = copy(next);
    this.waiting = b.waiting;
    this.seat.pending = q.decision ? { d: q.decision.d } : null;
    this.pendKey = q.decision?.seq ?? -1;
    if (b.end) {
      if (b.record) g.record = b.record;
      this.finishWith(next, b.end);
    } else this.persist();
    return null;
  }

  /** Move the chain on to a packet just applied. */
  private link(o: Opened) {
    this.g.prevHead = this.g.head;
    this.g.head = { n: o.packet.n, m: o.mac, f: o.packet.f };
    this.g.lastPlayed = iso(this.deps.now());
  }

  // ------------------------------------------------------------ the end

  /** Record the finished game once (practice log, and the replay once the record is known). `st` is this side's view. */
  private finishWith(st: GameState, end: ViewMsg['end']) {
    const g = this.g;
    if (g.end) return;
    const result = st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw';
    g.end = { result, reason: st.winReason, why: end?.why ?? 'finished', byMe: end?.by === 0 ? true : end?.by === 1 ? false : null, recorded: false, replay: false };
    g.stage = 'over';
    g.summary = { ...g.summary, turn: st.turn, gigs: [st.players[0].gigs.length, st.players[1].gigs.length], yourMove: false, reaction: false };
    g.finalView = copy(endedView(st, g.end));
    if (g.role === 'host') g.record = this.record();
    this.over = overOf(g.end);
    this.seat.pending = null;
    this.waiting = null;
    this.recorder.entry(this.outcome(st));
    g.end.recorded = true;
    this.writeReplay();
    this.persist();
  }

  private outcome(st: GameState): OnlineOutcome {
    const g = this.g;
    const e = g.end!;
    return {
      id: `corr-${g.id}-${g.role === 'host' ? 'h' : 'g'}`,
      date: iso(this.deps.now()),
      result: e.result,
      reason: e.reason,
      myDeck: g.myDeck.name,
      rivalDeck: g.rivalDeck ?? '',
      rival: g.rival ?? '',
      first: st.first === 0,
      turns: st.turn,
      gigs: [st.players[0].gigs.length, st.players[1].gigs.length],
      conceded: e.why === 'conceded' && e.byMe === true,
      rivalConceded: e.why === 'conceded' && e.byMe === false,
      abandoned: e.why === 'abandoned',
      ...(e.why === 'timeout' ? (e.byMe ? { timedOut: true } : { rivalTimedOut: true }) : {}),
      multiDay: this.mark(),
    };
  }

  /** The multi-day mark the records carry. */
  private mark() {
    return { days: this.g.days, ...(this.g.end?.why === 'timeout' ? { timedOut: true } : {}) };
  }

  private writeReplay() {
    const g = this.g;
    const r = this.reviewReplay();
    if (!r || !g.end || g.end.replay) return;
    this.recorder.replay(r);
    g.end.replay = true;
  }

  /** The full record: the host has it; the guest gets it in the host's last packet. */
  record(): GameRecordMsg | null {
    const g = this.g;
    if (g.record || g.role === 'guest') return g.record;
    const game = this.game;
    if (!game || !(game.ended || game.g.s.winner !== null)) return null;
    const s = game.setup;
    return { game: s.game, seed: s.seed, first: s.first, decks: [deckMsg(s.decks[0]), deckMsg(s.decks[1])], answers: [game.answers[0].map((a) => [...a]), game.answers[1].map((a) => [...a])] };
  }

  /** The finished game as a replay for the Game review (null until the record is known). */
  reviewReplay(): PracticeReplay | null {
    const rec = this.record();
    const g = this.g;
    if (!rec || !g.end) return null;
    if (this.replayCache?.rec === rec) return this.replayCache.r;
    const st = g.finalView ?? this.board?.s;
    const o = st ? this.outcome(st) : null;
    if (!o) return null;
    const r = replayOf(o, rec, this.engineSeat);
    this.replayCache = { rec, r };
    return r;
  }

  // ------------------------------------------------------------ verdicts, time, chat

  canConcede(): boolean {
    return this.g.stage === 'playing' && !this.g.end && !this.busy;
  }

  /** Concede: the game ends now as your loss; the rival's device learns it from the packet this makes. */
  concede(): Promise<void> {
    return this.run(async () => {
      if (this.g.stage !== 'playing' || this.g.end) return;
      if (this.g.role === 'host') {
        this.game?.concede(0);
        await this.pumpHost(true);
        return;
      }
      const st = this.board?.s;
      if (!st) return;
      this.finishWith({ ...st, winner: 1, winReason: `${this.g.me} conceded`, phase: 'over' }, { why: 'conceded', by: 0 });
      this.board!.s = endedView(st, this.g.end!);
      await this.guestSend({ t: 'answer', concede: true, chat: [] }, true);
    });
  }

  /** The rival's clock ran out (by this device's clock): claim the win. */
  claimWin(): Promise<boolean> {
    return this.run(async () => {
      const c = clockState(this.g, this.deps.now());
      if (!c.canClaim || this.g.end) return false;
      if (this.g.role === 'host') {
        this.game?.timeLoss(1);
        await this.pumpHost(true);
        return true;
      }
      const st = this.board?.s;
      if (!st) return false;
      this.finishWith({ ...st, winner: 0, winReason: `${this.rivalName} ran out of time`, phase: 'over' }, { why: 'timeout', by: 1 });
      this.board!.s = endedView(st, this.g.end!);
      await this.guestSend({ t: 'answer', claim: true, chat: [] }, true);
      return true;
    });
  }

  /** Give the rival more time (it rides in your next packet so their device knows too). */
  giveTime(ms: number) {
    const g = this.g;
    if (g.end || ms <= 0) return;
    const rival = (1 - mySeat(g)) as 0 | 1;
    g.clock = clockGrant(g.clock, rival, ms);
    g.grantOwed = Math.min(MAX_GRANT, g.grantOwed + ms);
    this.chat.note(`You gave ${this.rivalName} ${Math.round(ms / 3_600_000)} more hours.`, this.deps.now());
    this.syncChat();
    this.persist();
  }

  /** A chat line: shown now, sent with your next packet. */
  sendChat(text: string): boolean {
    if (this.g.unsent.length >= PACKET_CHAT) return false;
    const t = this.chat.outgoing(text, this.deps.now());
    if (t === null) return false;
    this.g.unsent.push(t);
    this.syncChat();
    this.persist();
    return true;
  }
  setChatSeen(open: boolean) {
    this.chatSeen = open;
    if (open && this.chat.unread) {
      this.chat.unread = 0;
      this.changed();
    }
  }
  setMuted(on: boolean) {
    this.chat.muted = on;
    this.changed();
  }

  // ------------------------------------------------------------ saving

  private summarize() {
    const g = this.g;
    if (g.end) return;
    if (g.role === 'host' && this.game) {
      const st = this.game.g.s;
      const pv = this.game.pendingView(1);
      g.summary = { turn: st.turn, gigs: [st.players[0].gigs.length, st.players[1].gigs.length], yourMove: this.game.waitingSeat() === 0, reaction: !!pv && pv.d.kind === 'reaction' };
    } else if (g.role === 'guest' && g.guest?.view) {
      const st = g.guest.view;
      g.summary = { turn: st.turn, gigs: [st.players[0].gigs.length, st.players[1].gigs.length], yourMove: !!g.guest.decision, reaction: false };
    }
  }

  private persist() {
    const g = this.g;
    this.summarize();
    if (g.role === 'host' && this.game && !g.end) {
      const s = this.game.save(iso(this.deps.now()));
      if (s) g.host!.save = s;
    }
    const why = this.deps.store.save(copy(g));
    if (why) g.problem = why;
    this.changed();
  }

  /** Leave the page: nothing is lost (the game is saved after every step). */
  close() {
    this.game?.quit();
    this.subs.clear();
  }
}

function overOf(e: NonNullable<CorrGame['end']>): Over {
  return { result: e.result, reason: e.reason, conceded: e.why === 'conceded' && e.byMe === true, rivalConceded: e.why === 'conceded' && e.byMe === false, abandoned: e.why === 'abandoned' };
}

/** A view showing a result decided off the board (a concession or a claim on time). */
function endedView(st: GameState, e: NonNullable<CorrGame['end']>): GameState {
  return { ...st, winner: e.result === 'win' ? 0 : e.result === 'loss' ? 1 : 'tie', winReason: e.reason, phase: 'over' };
}
