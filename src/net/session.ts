// One player's side of an online game (src/net/), over any Transport. OnlineHost runs the real game (HostGame) and
// sends the guest only its view (viewFor) and its own decision; OnlineGuest draws that view and sends back only option
// indexes. Both sides: the lobby (names and decks, the fair roll for who picks first or second), a heartbeat with a
// "connection lost" state, coming back to the same game over a new connection (the guest's resume token; the host's
// save survives a reload), the chat, concede / leave / rematch, and recording the game once on each side. Every
// message is checked on receipt (protocol.ts); one that is malformed or not legal now is refused and noted, never
// acted on.
//
// Trust model: the host's browser runs the game, so a modified host could see hidden cards or cheat; this is for
// friendly play. The guest's answers are checked against the decision actually waiting before the engine sees them.
import { validateDeck } from '../engine/deck';
import type { Decision, DeckList, GameState, PlayerId } from '../engine/types';
import type { PracticeReplay } from '../lib/practiceReplays';
import { gameDeck } from '../lib/tournament';
import { Chat } from './chat';
import { checkReveal, chosenSeat, commitOf, newNonce } from './fair';
import { HostGame, parseHostSave, type HostSave, type OnlineSetup } from './hostGame';
import { encode, parseGuestMessage, parseHostMessage, type DeckMsg, type GameRecordMsg, type GuestMsg, type HostMsg, type ViewMsg } from './protocol';
import { browserRecorder, replayOf, type OnlineOutcome, type OnlineRecorder } from './record';
import type { LinkState, Transport } from './transport';
import { ViewGame, viewFor } from './view';

export const HOST_SAVE_KEY = 'nct.online.host.v1';
export const GUEST_RESUME_KEY = 'nct.online.guest.v1';
/** a heartbeat every PING_MS; no word from the other side for LOST_MS means the connection is lost */
export const PING_MS = 2000;
export const LOST_MS = 8000;
export const NAME_MAX = 30;

export type Role = 'host' | 'guest';
/**
 * waiting: the host has nobody yet, or the guest waits for the host's welcome; roll: the fair roll for who picks;
 * choose: one player picks first or second; game: playing (or over); refused: the host turned the guest away.
 */
export type Stage = 'waiting' | 'roll' | 'choose' | 'game' | 'refused';
export type Conn = 'idle' | 'connecting' | 'open' | 'lost';

type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function localKV(): KV | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/** A player name as it may be shown: plain text, one line, capped. */
export function cleanName(s: string, fallback = 'Player'): string {
  // eslint-disable-next-line no-control-regex
  const t = s.replace(/[\u0000-\u001F\u007F-\u009F​-‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim().slice(0, NAME_MAX);
  return t || fallback;
}

const randomHex = (bytes: number) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
};
const deckMsg = (d: DeckList): DeckMsg => ({ name: d.name.slice(0, 80), legends: [...d.legends], main: [...d.main], sideboard: [] });
const deckOf = (d: DeckMsg): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] });

/** The seat the board answers through (shaped like the practice HumanAgent). */
export class SeatControl {
  pending: { d: Decision } | null = null;
  constructor(private submit: (d: Decision, i: number) => boolean) {}
  answer(d: Decision | null, i: number): boolean {
    const p = this.pending;
    if (!p || !d || p.d !== d || !Number.isInteger(i) || i < 0 || i >= d.options.length) return false;
    return this.submit(d, i);
  }
}

/** How the game ended, from this side. */
export interface Over {
  result: 'win' | 'loss' | 'draw';
  reason: string;
  conceded: boolean;
  rivalConceded: boolean;
  abandoned: boolean;
}

export interface SessionOptions {
  name: string;
  deck: DeckList;
  /** host: seconds per decision (0 = off) */
  timer?: number;
  /** the heartbeat (off in tests that step by hand) */
  heartbeat?: boolean;
  store?: KV | null;
  recorder?: OnlineRecorder;
  now?: () => number;
}

abstract class OnlineSession {
  abstract readonly role: Role;
  version = 0;
  stage: Stage = 'waiting';
  conn: Conn = 'idle';
  readonly name: string;
  readonly deck: DeckList;
  rivalName: string | null = null;
  rivalDeck: string | null = null;
  timer: number;
  /** why the host refused us, or why the lobby failed */
  problem: string | null = null;
  /** after the roll: who picks first or second */
  chooser: 'me' | 'rival' | null = null;
  /** you go first (known once the game starts) */
  youFirst: boolean | null = null;
  readonly chat = new Chat();
  /** the panel showing the chat is open (unread messages are not counted) */
  chatSeen = false;
  /** protocol notes: refused messages and other problems (newest last, capped) */
  readonly notes: string[] = [];
  /** the board: a view with you as player 0 (null before the game) */
  board: ViewGame | null = null;
  readonly seat: SeatControl;
  /** whose decision the game waits on: 0 you, 1 the rival */
  waiting: 0 | 1 | null = null;
  /** local time the decision waiting runs out, or null */
  deadlineAt: number | null = null;
  over: Over | null = null;
  error: string | null = null;
  rematch = { mine: false, theirs: false };
  /** bumps when a new game starts (the board remounts) */
  match = 0;
  protected transport: Transport | null = null;
  protected store: KV | null;
  protected recorder: OnlineRecorder;
  protected now: () => number;
  protected lastHeard = 0;
  private beat: ReturnType<typeof setInterval> | null = null;
  private heartbeat: boolean;
  private subs = new Set<() => void>();
  protected myNonce: string | null = null;
  protected theirCommit: string | null = null;
  protected sentCommit = false;
  protected sentReveal = false;
  protected closed = false;
  /** how the game ended, from this side (once it has) */
  protected outcomeNow: OnlineOutcome | null = null;
  private replayCache: { rec: GameRecordMsg; r: PracticeReplay } | null = null;

  constructor(o: SessionOptions) {
    this.name = cleanName(o.name);
    this.deck = o.deck;
    this.timer = o.timer ?? 0;
    this.heartbeat = o.heartbeat ?? true;
    this.store = o.store === undefined ? localKV() : o.store;
    this.recorder = o.recorder ?? browserRecorder;
    this.now = o.now ?? Date.now;
    this.seat = new SeatControl((d, i) => this.submit(d, i));
  }

  subscribe = (fn: () => void) => {
    this.subs.add(fn);
    return () => void this.subs.delete(fn);
  };
  protected changed() {
    this.version++;
    for (const f of [...this.subs]) f();
  }
  note(text: string) {
    this.notes.push(text.slice(0, 300));
    if (this.notes.length > 50) this.notes.splice(0, this.notes.length - 50);
    this.changed();
  }

  /** Use this connection from now on (a new invite, or the two-tabs channel). */
  attach(t: Transport) {
    if (this.transport && this.transport !== t) {
      this.transport.onMessage = null;
      this.transport.onState = null;
      this.transport.close();
    }
    this.transport = t;
    t.onMessage = (text) => {
      this.lastHeard = this.now();
      if (this.conn !== 'open') this.conn = 'open';
      this.receive(text);
    };
    t.onState = (s) => this.linkState(s);
    this.conn = t.state === 'open' ? 'open' : 'connecting';
    if (t.state === 'open') this.linkState('open');
    this.startBeat();
    this.changed();
  }

  private linkState(s: LinkState) {
    if (this.closed) return;
    if (s === 'open') {
      this.conn = 'open';
      this.lastHeard = this.now();
      this.opened();
    } else if (s === 'closed') this.conn = 'lost';
    this.changed();
  }

  private startBeat() {
    if (!this.heartbeat || this.beat) return;
    this.beat = setInterval(() => this.tick(), PING_MS);
  }
  /** One heartbeat: ping, and mark the connection lost after LOST_MS of silence. */
  tick() {
    if (this.conn === 'open') {
      if (this.now() - this.lastHeard > LOST_MS) {
        this.conn = 'lost';
        this.changed();
      } else this.send({ v: 1, t: 'ping', at: this.now() });
    }
  }

  protected send(m: GuestMsg | HostMsg) {
    if (this.transport?.state === 'open') this.transport.send(encode(m));
  }

  /** Send a chat line; false when empty or over the rate limit. */
  sendChat(text: string): boolean {
    const t = this.chat.outgoing(text, this.now());
    if (t === null) return false;
    this.send({ v: 1, t: 'chat', text: t });
    this.changed();
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
  protected gotChat(text: string) {
    if (this.chat.incoming(text, this.chatSeen, this.now())) this.changed();
  }

  /** Answering a ping, and the heartbeat's bookkeeping. */
  protected heard(m: { t: string; at?: number }): boolean {
    if (m.t === 'ping') {
      this.send({ v: 1, t: 'pong', at: m.at ?? 0 });
      return true;
    }
    return m.t === 'pong';
  }

  private rollQueue: Promise<void> = Promise.resolve();
  /** The roll: send our commitment (once), and our secret once we have theirs. Steps run one at a time, in order. */
  protected rollStep(): Promise<void> {
    this.rollQueue = this.rollQueue.then(() => this.rollStepNow()).catch((e: unknown) => this.note(`The roll failed: ${String(e)}`));
    return this.rollQueue;
  }
  private async rollStepNow() {
    if (!this.myNonce) this.myNonce = newNonce();
    if (!this.sentCommit) {
      this.sentCommit = true;
      this.send({ v: 1, t: 'commit', h: await commitOf(this.myNonce) });
    }
    if (this.theirCommit && !this.sentReveal) {
      this.sentReveal = true;
      this.send({ v: 1, t: 'reveal', n: this.myNonce });
    }
  }
  protected resetRoll() {
    this.myNonce = null;
    this.theirCommit = null;
    this.sentCommit = false;
    this.sentReveal = false;
    this.chooser = null;
  }
  /** Their secret arrived: check it against their commitment and work out who picks. */
  protected async gotReveal(n: string): Promise<boolean> {
    if (!this.theirCommit || !this.myNonce) {
      this.note('A roll secret arrived before its commitment; ignored.');
      return false;
    }
    if (!(await checkReveal(this.theirCommit, n))) {
      this.problem = "The other player's roll did not match what they committed to, so the roll can't be trusted. Start again with a new invite.";
      this.note(this.problem);
      return false;
    }
    const host = this.role === 'host' ? this.myNonce : n;
    const guest = this.role === 'host' ? n : this.myNonce;
    const picker = chosenSeat(host, guest);
    this.chooser = (picker === 0) === (this.role === 'host') ? 'me' : 'rival';
    this.stage = 'choose';
    this.changed();
    return true;
  }

  /** Board answers go here (SeatControl). */
  protected abstract submit(d: Decision, i: number): boolean;
  protected abstract receive(text: string): void;
  /** the link opened (first time or again) */
  protected abstract opened(): void;
  abstract chooseFirst(goFirst: boolean): void;
  abstract concede(): void;
  /** Leave: ends the game in progress as abandoned (a draw), and closes the connection. */
  abstract leave(): void;
  /** The connection is gone for good: end the game in progress as abandoned (a draw). */
  abstract giveUp(): void;
  abstract offerRematch(): void;
  /** The full record for the Game review and the export (null when not known yet). */
  abstract record(): GameRecordMsg | null;
  /** The finished game as a replay for the Game review and the export (the same object until the record changes). */
  reviewReplay(): PracticeReplay | null {
    const rec = this.record();
    if (!rec || !this.outcomeNow) return null;
    if (this.replayCache?.rec !== rec) this.replayCache = { rec, r: replayOf(this.outcomeNow, rec, this.engineSeat) };
    return this.replayCache.r;
  }
  /** this side's seat in the engine (host 0, guest 1) */
  get engineSeat(): PlayerId {
    return this.role === 'host' ? 0 : 1;
  }
  canConcede(): boolean {
    return this.stage === 'game' && !this.over && !this.error && !!this.board && this.board.s.winner === null;
  }

  protected outcome(st: GameState, end: ViewMsg['end'], game: string): OnlineOutcome {
    // `st` is this side's view: you are player 0
    const result = st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw';
    return {
      id: `pvp-${game}-${this.role === 'host' ? 'h' : 'g'}`,
      date: new Date(this.now()).toISOString(),
      result,
      reason: st.winReason,
      myDeck: this.deck.name,
      rivalDeck: this.rivalDeck ?? '',
      rival: this.rivalName ?? '',
      first: st.first === 0,
      turns: st.turn,
      gigs: [st.players[0].gigs.length, st.players[1].gigs.length],
      conceded: end?.why === 'conceded' && end.by === 0,
      rivalConceded: end?.why === 'conceded' && end.by === 1,
      abandoned: end?.why === 'abandoned',
    };
  }
  protected overOf(o: OnlineOutcome): Over {
    return { result: o.result, reason: o.reason, conceded: o.conceded, rivalConceded: o.rivalConceded, abandoned: o.abandoned };
  }

  /** Stop: no more messages, heartbeat or timers. */
  close() {
    this.closed = true;
    if (this.beat) clearInterval(this.beat);
    this.beat = null;
    if (this.transport) {
      this.transport.onMessage = null;
      this.transport.onState = null;
      this.transport.close();
    }
    this.transport = null;
  }
}

// ======================================================================== host

export class OnlineHost extends OnlineSession {
  readonly role = 'host' as const;
  game: HostGame | null = null;
  guestDeck: DeckList | null = null;
  private gameId = '';
  private token = '';
  private viewN = 0;
  private viewTimer: ReturnType<typeof setTimeout> | null = null;
  private recorded = false;
  private pendKey = -1;
  /** the guest's first-or-second choice, when it arrived before this side finished checking the roll */
  private earlyFirst: boolean | null = null;

  constructor(o: SessionOptions) {
    super(o);
  }

  /** A host save in this browser (a game the page was left during), or null. */
  static saved(store: KV | null = localKV()): HostSave | null {
    try {
      return parseHostSave(store?.getItem(HOST_SAVE_KEY) ?? null);
    } catch {
      return null;
    }
  }
  static clearSaved(store: KV | null = localKV()) {
    try {
      store?.removeItem(HOST_SAVE_KEY);
    } catch {
      /* storage blocked */
    }
  }

  /** Bring back a saved game (replayed to where it was); the guest comes back with a new invite and its token. */
  static async restore(save: HostSave, o: Omit<SessionOptions, 'name' | 'deck' | 'timer'>): Promise<OnlineHost> {
    const s = save.setup;
    const h = new OnlineHost({ ...o, name: s.names[0], deck: s.decks[0], timer: s.timer });
    const game = await HostGame.restore(save);
    h.gameId = s.game;
    h.token = s.token;
    h.rivalName = s.names[1];
    h.rivalDeck = s.decks[1].name;
    h.guestDeck = s.decks[1];
    h.youFirst = s.first === 0;
    h.stage = 'game';
    h.useGame(game);
    h.chat.note(`Game restored. Send ${s.names[1]} a new invite to carry on.`);
    return h;
  }

  protected opened() {
    // the guest speaks first (hello)
  }

  protected receive(text: string) {
    const p = parseGuestMessage(text);
    if (!p.ok) {
      this.note(`Refused a message from the guest: ${p.why}`);
      this.send({ v: 1, t: 'reject', why: `Message refused: ${p.why}`.slice(0, 300) });
      return;
    }
    const m = p.msg;
    if (this.heard(m)) return;
    const refuse = (why: string) => {
      this.note(`Refused the guest's ${m.t}: ${why}`);
      this.send({ v: 1, t: 'reject', why });
    };
    switch (m.t) {
      case 'hello':
        return this.hello(m);
      case 'commit':
        if (this.stage !== 'roll' || this.theirCommit) return refuse('No roll is waiting for a commitment.');
        this.theirCommit = m.h;
        void this.rollStep();
        return;
      case 'reveal':
        if (this.stage !== 'roll') return refuse('No roll is waiting for a secret.');
        void this.gotReveal(m.n);
        return;
      case 'first':
        if (this.stage === 'roll' && this.theirCommit) {
          this.earlyFirst = m.first;
          return;
        }
        if (this.stage !== 'choose' || this.chooser !== 'rival') return refuse('It is not your choice to make.');
        this.startGame(m.first ? 1 : 0);
        return;
      case 'answer': {
        if (!this.game || this.stage !== 'game') return refuse('There is no game to answer in.');
        const why = this.game.answer(1, m.seq, m.i);
        if (why) {
          refuse(why);
          this.sendView();
        }
        return;
      }
      case 'chat':
        return this.gotChat(m.text);
      case 'concede':
        if (!this.game?.concede(1)) return refuse('There is no game in progress to concede.');
        return;
      case 'leave':
        this.rematch.theirs = false;
        if (this.game && !this.game.ended) this.game.abandon(`${this.rivalName ?? 'The guest'} left the game`, 1);
        else this.chat.note(`${this.rivalName ?? 'The guest'} left.`);
        if (!this.game) {
          // left in the lobby: wait for someone new
          this.stage = 'waiting';
          this.rivalName = null;
          this.rivalDeck = null;
          this.guestDeck = null;
          this.resetRoll();
        }
        this.changed();
        return;
      case 'rematch':
        if (!this.over) return refuse('The game is not over.');
        this.rematch.theirs = true;
        this.maybeRematch();
        this.changed();
        return;
      case 'record': {
        const r = this.record();
        if (!r) return refuse('The record is sent once the game is over.');
        this.send({ v: 1, t: 'record', record: r });
        return;
      }
      case 'ping':
      case 'pong':
        return;
    }
  }

  private hello(m: Extract<GuestMsg, { t: 'hello' }>) {
    const g = this.game;
    if (m.resume && g && m.resume.game === this.gameId && m.resume.token === this.token) {
      // the guest is back (reload or new connection): the same game, from where it is
      this.send({ v: 1, t: 'welcome', name: this.name, deckName: this.deck.name, game: this.gameId, token: this.token, timer: this.timer, resumed: true });
      this.chat.note(`${this.rivalName ?? 'The guest'} is back.`);
      this.sendView();
      this.changed();
      return;
    }
    if (this.stage !== 'waiting' && this.stage !== 'refused') {
      this.send({ v: 1, t: 'refuse', why: 'This host is already playing with someone else.' });
      this.note('Turned away a second guest.');
      return;
    }
    const deck = deckOf(m.deck);
    const errs = validateDeck(gameDeck(deck));
    if (errs.length) {
      this.send({ v: 1, t: 'refuse', why: `Your deck can't be used: ${errs[0]}`.slice(0, 300) });
      this.note(`Refused the guest's deck: ${errs[0]}`);
      return;
    }
    this.guestDeck = deck;
    this.rivalName = cleanName(m.name, 'Guest');
    this.rivalDeck = deck.name;
    this.gameId = randomHex(8);
    this.token = randomHex(16);
    this.send({ v: 1, t: 'welcome', name: this.name, deckName: this.deck.name, game: this.gameId, token: this.token, timer: this.timer, resumed: false });
    this.stage = 'roll';
    this.resetRoll();
    void this.rollStep();
    this.changed();
  }

  protected async gotReveal(n: string): Promise<boolean> {
    // the host reveals only once it has the guest's commitment (rollStep), so the guest's reveal can be checked now
    const ok = await super.gotReveal(n);
    if (!ok) this.stage = 'waiting';
    const early = this.earlyFirst;
    this.earlyFirst = null;
    if (ok && early !== null) {
      if (this.chooser === 'rival') this.startGame(early ? 1 : 0);
      else this.note("Refused the guest's first-or-second choice: it was not theirs to make.");
    }
    this.changed();
    return ok;
  }

  chooseFirst(goFirst: boolean) {
    if (this.stage !== 'choose' || this.chooser !== 'me') return;
    this.startGame(goFirst ? 0 : 1);
  }

  private startGame(first: PlayerId) {
    if (!this.guestDeck) return;
    const seed = new Uint32Array(1);
    crypto.getRandomValues(seed);
    const setup: OnlineSetup = {
      game: this.gameId,
      token: this.token,
      names: [this.name, this.rivalName ?? 'Guest'],
      decks: [gameDeck(this.deck), gameDeck(this.guestDeck)],
      seed: seed[0]! % 2 ** 31,
      first,
      timer: this.timer,
      started: new Date(this.now()).toISOString(),
    };
    this.youFirst = first === 0;
    this.stage = 'game';
    this.send({ v: 1, t: 'start', youFirst: first === 1 });
    this.useGame(new HostGame(setup, { now: this.now }));
  }

  private useGame(game: HostGame) {
    this.game = game;
    this.match++;
    this.over = null;
    this.outcomeNow = null;
    this.hostRecord = null;
    this.recorded = false;
    this.rematch = { mine: false, theirs: false };
    this.board = new ViewGame(viewFor(game.g.s, 0));
    game.onAsk = (seat) => {
      if (seat === 1) this.sendView();
      this.saveGame();
    };
    game.onChange = () => this.gameChanged();
    this.gameChanged();
  }

  private gameChanged() {
    const game = this.game;
    if (!game || !this.board) return;
    this.board.s = viewFor(game.g.s, 0);
    const pv = game.pendingView(0);
    if (!pv) {
      this.seat.pending = null;
      this.pendKey = -1;
    } else if (pv.seq !== this.pendKey) {
      this.pendKey = pv.seq;
      this.seat.pending = { d: pv.d };
    }
    const w = game.waitingSeat();
    this.waiting = w === null ? null : w === 0 ? 0 : 1;
    const left = game.timeLeft();
    this.deadlineAt = left === null ? null : this.now() + left;
    this.error = game.error;
    if ((game.ended || game.error) && !this.recorded) this.finish();
    else this.scheduleView();
    this.changed();
  }

  /** Send the guest its view soon (several engine ticks in a row make one message). */
  private scheduleView() {
    if (this.viewTimer) return;
    this.viewTimer = setTimeout(() => {
      this.viewTimer = null;
      this.sendView();
    }, 30);
  }

  /** Send the guest its view now. */
  sendView() {
    if (this.viewTimer) clearTimeout(this.viewTimer);
    this.viewTimer = null;
    const game = this.game;
    if (!game) return;
    const v = game.view(1);
    const w = game.waitingSeat();
    const e = game.ended;
    this.send({
      v: 1,
      t: 'view',
      n: ++this.viewN,
      state: v.state,
      decision: v.decision,
      timeLeft: game.timeLeft(),
      waiting: w === null ? null : w === 1 ? 0 : 1,
      end: e ? { why: e.why, by: e.by === undefined ? null : e.by === 1 ? 0 : 1 } : null,
      error: game.error,
    });
  }

  private endOf(): ViewMsg['end'] {
    const e = this.game?.ended;
    return e ? { why: e.why, by: e.by === undefined ? null : e.by === 0 ? 0 : 1 } : null;
  }

  /** The game ended (or failed): record it once, clear the save, tell the guest. */
  private finish() {
    const game = this.game;
    if (!game || !this.board) return;
    this.recorded = true;
    OnlineHost.clearSaved(this.store);
    this.sendView();
    if (game.error && !game.ended) return;
    const o = this.outcome(this.board.s, this.endOf(), this.gameId);
    this.outcomeNow = o;
    this.over = this.overOf(o);
    this.hostRecord = this.record();
    this.recorder.entry(o);
    const r = this.reviewReplay();
    if (r) this.recorder.replay(r);
  }

  private saveGame() {
    const s = this.game?.save();
    if (!s) return;
    try {
      this.store?.setItem(HOST_SAVE_KEY, JSON.stringify(s));
    } catch {
      /* storage blocked or full: the game goes on, it just can't come back after a reload */
    }
  }

  /** Write the save now (the page is being hidden or left). */
  flush() {
    this.saveGame();
  }

  private hostRecord: GameRecordMsg | null = null;
  record(): GameRecordMsg | null {
    if (this.hostRecord) return this.hostRecord;
    const g = this.game;
    if (!g || !(g.ended || g.g.s.winner !== null)) return null;
    const s = g.setup;
    return { game: s.game, seed: s.seed, first: s.first, decks: [deckMsg(s.decks[0]), deckMsg(s.decks[1])], answers: [g.answers[0].map((a) => [...a]), g.answers[1].map((a) => [...a])] };
  }

  protected submit(d: Decision, i: number): boolean {
    const g = this.game;
    const pv = g?.pendingView(0);
    if (!g || !pv || pv.d !== d) return false;
    return g.answer(0, pv.seq, i) === null;
  }

  concede() {
    this.game?.concede(0);
  }

  leave() {
    if (this.game && !this.game.ended) this.game.abandon(`${this.name} left the game`, 0);
    this.send({ v: 1, t: 'leave' });
    OnlineHost.clearSaved(this.store);
    this.close();
    this.changed();
  }

  giveUp() {
    if (this.game && !this.game.ended) this.game.abandon('The connection was lost');
    this.changed();
  }

  offerRematch() {
    if (!this.over || this.rematch.mine) return;
    this.rematch.mine = true;
    this.send({ v: 1, t: 'rematch' });
    this.maybeRematch();
    this.changed();
  }

  private maybeRematch() {
    if (!this.rematch.mine || !this.rematch.theirs) return;
    // a new game with the same players and decks: a new roll for who picks
    this.game?.quit();
    this.game = null;
    this.board = null;
    this.over = null;
    this.seat.pending = null;
    this.gameId = randomHex(8);
    this.rematch = { mine: false, theirs: false };
    this.stage = 'roll';
    this.resetRoll();
    this.send({ v: 1, t: 'welcome', name: this.name, deckName: this.deck.name, game: this.gameId, token: this.token, timer: this.timer, resumed: false });
    void this.rollStep();
  }

  close() {
    if (this.viewTimer) clearTimeout(this.viewTimer);
    this.viewTimer = null;
    super.close();
  }

  /** Stop the game and the link without recording anything (leaving the page; the save stays). */
  quit() {
    this.flush();
    this.game?.quit();
    this.close();
  }
}

// ======================================================================== guest

/** What a guest keeps to come back to its game after a reload (the host's game id and the guest's token). */
export interface GuestResume {
  game: string;
  token: string;
  host: string;
  saved: string;
}

export class OnlineGuest extends OnlineSession {
  readonly role = 'guest' as const;
  resume: GuestResume | null;
  private viewN = 0;
  private pendSeq = -1;
  private gameId = '';
  private recorded = false;
  private fullRecord: GameRecordMsg | null = null;

  constructor(o: SessionOptions & { resume?: GuestResume | null }) {
    super(o);
    this.resume = o.resume === undefined ? OnlineGuest.saved(this.store) : o.resume;
  }

  static saved(store: KV | null = localKV()): GuestResume | null {
    try {
      const v = JSON.parse(store?.getItem(GUEST_RESUME_KEY) ?? 'null') as GuestResume | null;
      if (!v || typeof v.game !== 'string' || typeof v.token !== 'string' || typeof v.host !== 'string' || typeof v.saved !== 'string') return null;
      // a day old at most
      if (Date.now() - Date.parse(v.saved) > 24 * 3600 * 1000) return null;
      return v;
    } catch {
      return null;
    }
  }
  static clearSaved(store: KV | null = localKV()) {
    try {
      store?.removeItem(GUEST_RESUME_KEY);
    } catch {
      /* storage blocked */
    }
  }

  protected opened() {
    this.send({ v: 1, t: 'hello', name: this.name, deck: deckMsg(this.deck), ...(this.resume ? { resume: { game: this.resume.game, token: this.resume.token } } : {}) });
  }

  protected receive(text: string) {
    const p = parseHostMessage(text);
    if (!p.ok) {
      this.note(`Ignored a message from the host: ${p.why}`);
      return;
    }
    const m = p.msg;
    if (this.heard(m)) return;
    switch (m.t) {
      case 'welcome':
        return this.welcome(m);
      case 'refuse':
        this.stage = 'refused';
        this.problem = m.why;
        if (this.resume) {
          // the token is no good (another game): forget it, so the next try starts fresh
          this.resume = null;
          OnlineGuest.clearSaved(this.store);
        }
        this.changed();
        return;
      case 'reject':
        this.note(`The host refused: ${m.why}`);
        return;
      case 'commit':
        if (this.stage !== 'roll' || this.theirCommit) return this.note('A roll commitment arrived out of turn; ignored.');
        this.theirCommit = m.h;
        void this.rollStep();
        return;
      case 'reveal':
        if (this.stage !== 'roll') return this.note('A roll secret arrived out of turn; ignored.');
        void this.gotReveal(m.n);
        return;
      case 'start':
        this.youFirst = m.youFirst;
        this.stage = 'game';
        this.match++;
        this.over = null;
        this.recorded = false;
        this.fullRecord = null;
        this.outcomeNow = null;
        this.rematch = { mine: false, theirs: false };
        this.board = null;
        this.seat.pending = null;
        this.pendSeq = -1;
        this.viewN = 0;
        this.changed();
        return;
      case 'view':
        return this.gotView(m);
      case 'chat':
        return this.gotChat(m.text);
      case 'rematch':
        if (!this.over) return this.note('A rematch offer arrived during the game; ignored.');
        this.rematch.theirs = true;
        this.changed();
        return;
      case 'record':
        return this.gotRecord(m.record);
      case 'leave':
        this.chat.note(`${this.rivalName ?? 'The host'} left.`);
        if (this.stage === 'game' && !this.over && this.board) this.endLocally('abandoned', `${this.rivalName ?? 'The host'} left the game`);
        this.changed();
        return;
      case 'ping':
      case 'pong':
        return;
    }
  }

  private welcome(m: Extract<HostMsg, { t: 'welcome' }>) {
    this.rivalName = cleanName(m.name, 'Host');
    this.rivalDeck = m.deckName;
    this.timer = m.timer;
    this.problem = null;
    this.gameId = m.game;
    // a restarted host numbers its views and decisions afresh
    this.viewN = 0;
    this.pendSeq = -1;
    this.resume = { game: m.game, token: m.token, host: this.rivalName, saved: new Date(this.now()).toISOString() };
    try {
      this.store?.setItem(GUEST_RESUME_KEY, JSON.stringify(this.resume));
    } catch {
      /* storage blocked: coming back after a reload won't work */
    }
    if (m.resumed) {
      this.stage = 'game';
      this.chat.note('Back in the game.');
    } else {
      // a fresh game (or a rematch): the roll
      this.stage = 'roll';
      this.board = null;
      this.over = null;
      this.seat.pending = null;
      this.resetRoll();
      void this.rollStep();
    }
    this.changed();
  }

  chooseFirst(goFirst: boolean) {
    if (this.stage !== 'choose' || this.chooser !== 'me') return;
    this.send({ v: 1, t: 'first', first: goFirst });
    this.chooser = null;
    this.changed();
  }

  private gotView(m: ViewMsg) {
    if (this.stage !== 'game') return this.note('A board arrived before the game started; ignored.');
    if (m.n <= this.viewN) return;
    this.viewN = m.n;
    if (!this.board) this.board = new ViewGame(m.state);
    else this.board.s = m.state;
    if (!m.decision) {
      this.seat.pending = null;
      this.pendSeq = -1;
    } else if (m.decision.seq !== this.pendSeq) {
      this.pendSeq = m.decision.seq;
      this.seat.pending = { d: m.decision.d };
    }
    this.waiting = m.waiting;
    this.deadlineAt = m.timeLeft === null ? null : this.now() + m.timeLeft;
    this.error = m.error;
    if (m.state.winner !== null && !this.recorded) {
      this.recorded = true;
      const o = this.outcome(m.state, m.end, this.gameId);
      this.outcomeNow = o;
      this.over = this.overOf(o);
      this.recorder.entry(o);
      // the full record (seed and both seats' answers) comes only now that the game is over: ask for it for the review
      this.send({ v: 1, t: 'record' });
    }
    this.changed();
  }

  private gotRecord(r: GameRecordMsg) {
    if (!this.over || !this.outcomeNow) return this.note('A game record arrived before the game was over; ignored.');
    if (r.game !== this.gameId) return this.note('A game record for another game arrived; ignored.');
    this.fullRecord = r;
    const rp = this.reviewReplay();
    if (rp) this.recorder.replay(rp);
    this.resume = null;
    OnlineGuest.clearSaved(this.store);
    this.changed();
  }

  /** The game is over here without the host's word (the host left or the connection was given up). */
  private endLocally(why: 'abandoned', reason: string) {
    const b = this.board;
    if (!b || this.recorded) return;
    const st: GameState = { ...b.s, winner: 'tie', winReason: reason, phase: 'over' };
    b.s = st;
    this.seat.pending = null;
    this.waiting = null;
    this.deadlineAt = null;
    this.recorded = true;
    const o = this.outcome(st, { why, by: null }, this.gameId);
    this.outcomeNow = o;
    this.over = this.overOf(o);
    this.recorder.entry(o);
    this.resume = null;
    OnlineGuest.clearSaved(this.store);
  }

  record(): GameRecordMsg | null {
    return this.fullRecord;
  }

  /** Ask the host for the record again (it is sent only after the game is over). */
  requestRecord() {
    if (this.over && !this.fullRecord) this.send({ v: 1, t: 'record' });
  }

  protected submit(d: Decision, i: number): boolean {
    if (this.conn !== 'open' || this.seat.pending?.d !== d) return false;
    this.send({ v: 1, t: 'answer', seq: this.pendSeq, i });
    // the next view brings the next decision
    this.seat.pending = null;
    this.changed();
    return true;
  }

  concede() {
    if (this.canConcede()) this.send({ v: 1, t: 'concede' });
  }

  leave() {
    if (this.stage === 'game' && !this.over && this.board) this.endLocally('abandoned', `${this.name} left the game`);
    this.send({ v: 1, t: 'leave' });
    OnlineGuest.clearSaved(this.store);
    this.close();
    this.changed();
  }

  giveUp() {
    if (this.stage === 'game' && !this.over) this.endLocally('abandoned', 'The connection was lost');
    this.changed();
  }

  offerRematch() {
    if (!this.over || this.rematch.mine) return;
    this.rematch.mine = true;
    this.send({ v: 1, t: 'rematch' });
    this.changed();
  }
}

export type OnlineSessionAny = OnlineHost | OnlineGuest;
