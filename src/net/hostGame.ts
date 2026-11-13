// The authoritative game of an online match, in the host's browser (src/net/): a real Game whose two seats are both
// people. Each seat's decision waits here until that seat answers; the answer is checked against the decision actually
// waiting (its sequence number, and an index among its options) before the engine sees it, so a late, repeated or
// out-of-turn answer is refused, never applied. Every answer is recorded per seat, so the game is "setup + seed + both
// seats' answers" and can be rebuilt by replay (the host's save, for a host page reload: HostSave). An optional turn
// timer answers for a seat that runs out of time, with the safe default (defaultAnswer) and a line in the log.
// Concede and abandon are session verdicts (as in practice games): the engine is stopped, then the result is written.
import { Game } from '../engine/engine';
import type { Agent, Decision, DeckList, GameState, PlayerId } from '../engine/types';
import { stateHash } from '../lib/savedGames';
import { SIM_VERSION } from '../lib/tournament';
import { viewDecision, viewFor } from './view';

/** Everything that decides the game besides the answers. The seed never leaves the host before the game is over. */
export interface OnlineSetup {
  game: string;
  /** the guest's secret for coming back to this game (a reload or a new connection) */
  token: string;
  /** [host, guest] player names */
  names: [string, string];
  /** [host, guest] decks (engine seats 0 and 1) */
  decks: [DeckList, DeckList];
  seed: number;
  first: PlayerId;
  /** seconds per decision, 0 = no timer */
  timer: number;
  /** ISO start time */
  started: string;
  /**
   * [host, guest]: the seat ends its turns with End turn even when nothing else is left (each player's own setting,
   * fixed at the start). Absent: both automatic, as every game before it existed.
   */
  endTurnClick?: [boolean, boolean];
}

export const HOST_SAVE_KIND = 'nct-online-host';

/** The host's save of a game in progress: rebuilt by replaying both seats' answers. */
export interface HostSave {
  kind: typeof HOST_SAVE_KIND;
  schema: 1;
  simVersion: number;
  setup: OnlineSetup;
  answers: [number[][], number[][]];
  /** the last decision asked: how many answers each seat had given, and the state hash then */
  check: { at: [number, number]; hash: string } | null;
  saved: string;
}

/** 'timeout': a player's clock in a multi-day game ran out and the other claimed the win (src/net/corr.ts) */
export type EndWhy = 'finished' | 'conceded' | 'abandoned' | 'timeout';

/** Thrown inside a seat once the game is stopped (concede, abandon, quit), so the engine's loop unwinds quietly. */
export class GameStopped extends Error {
  constructor() {
    super('game stopped');
  }
}

/** The answer given for a seat that ran out of time: pass, no reaction, "no", or "none" when offered, else the first option. */
export function defaultAnswer(d: Decision): number {
  const at = (f: (o: Decision['options'][number]) => boolean) => d.options.findIndex(f);
  let i = -1;
  if (d.kind === 'action') i = at((o) => o.action?.type === 'pass');
  else if (d.kind === 'reaction') i = at((o) => o.action?.type === 'endReact');
  else if (d.kind === 'yesno') i = at((o) => o.key === 'no');
  else i = at((o) => o.key === 'none');
  return i >= 0 ? i : 0;
}

interface Waiting {
  d: Decision;
  seq: number;
  /** this seat's view of it (built once, so it stays the same object while it waits) */
  view: Decision;
  resolve: (r: number[]) => void;
  reject: (e: Error) => void;
}

class SeatAgent implements Agent {
  readonly choosesPayment = true;
  readonly choosesOrder = true;
  readonly confirmsEndTurn: boolean;
  pending: Waiting | null = null;
  constructor(
    readonly name: string,
    private host: HostGame,
    readonly seat: PlayerId,
  ) {
    this.confirmsEndTurn = !!host.setup.endTurnClick?.[seat];
  }
  decide(g: Game, d: Decision): Promise<number[]> {
    return this.host.ask(this, g, d);
  }
}

export interface HostGameOptions {
  /** answers to replay first (a restore), per seat */
  feed?: [number[][], number[][]];
  /** the check the replay must pass (HostSave.check) */
  check?: HostSave['check'];
  now?: () => number;
}

export class HostGame {
  readonly g: Game;
  readonly seats: [SeatAgent, SeatAgent];
  readonly answers: [number[][], number[][]] = [[], []];
  /** the last decision's sequence number (both seats share one count) */
  seq = 0;
  stopped = false;
  ended: { why: EndWhy; by?: PlayerId } | null = null;
  error: string | null = null;
  /** when the decision waiting runs out of time (epoch ms), or null */
  deadline: number | null = null;
  /** the last decision asked (for the save's check) */
  check: HostSave['check'] = null;
  /** replaying a save: no timer, nothing sent; `restored` settles when the live position is reached */
  restoring: boolean;
  readonly restored: Promise<void>;
  readonly done: Promise<void>;
  /** anything changed (engine tick, a decision asked or answered, the end) */
  onChange: (() => void) | null = null;
  /** a seat's new decision is waiting */
  onAsk: ((seat: PlayerId) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private feed: [number[][], number[][]];
  private fed: [number, number] = [0, 0];
  private now: () => number;
  private reached!: () => void;
  private failed!: (e: Error) => void;
  /** the save's check, until the replay has passed it */
  private pendingCheck: HostSave['check'] = null;

  constructor(
    readonly setup: OnlineSetup,
    opts: HostGameOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.feed = opts.feed ?? [[], []];
    this.restoring = !!opts.feed && (this.feed[0].length > 0 || this.feed[1].length > 0);
    const wantCheck = opts.check ?? null;
    this.restored = new Promise<void>((res, rej) => {
      this.reached = res;
      this.failed = rej;
    });
    if (!this.restoring) this.reached();
    this.seats = [new SeatAgent(setup.names[0], this, 0), new SeatAgent(setup.names[1], this, 1)];
    this.g = Game.create(setup.decks, this.seats, { seed: setup.seed, first: setup.first });
    this.pendingCheck = wantCheck;
    this.g.onUpdate = () => this.onChange?.();
    this.done = this.g.run().then(
      () => {
        if (this.stopped) return;
        this.ended = { why: 'finished' };
        this.clearTimer();
        if (this.restoring) this.failed(new Error('The saved game ended during the replay.'));
        this.onChange?.();
      },
      (e: unknown) => {
        if (this.stopped || e instanceof GameStopped) return;
        this.error = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
        if (this.restoring) this.failed(new Error(this.error));
        this.onChange?.();
      },
    );
  }

  /** @internal SeatAgent.decide: replay a saved answer, or wait for the seat to answer. */
  ask(seat: SeatAgent, g: Game, d: Decision): Promise<number[]> {
    if (this.stopped) return Promise.reject(new GameStopped());
    const p = seat.seat;
    const c = this.pendingCheck;
    if (this.restoring && c && this.answers[0].length === c.at[0] && this.answers[1].length === c.at[1]) {
      this.pendingCheck = null;
      if (stateHash(g.s) !== c.hash) return Promise.reject(new Error('The saved moves no longer lead to the same position.'));
    }
    const k = this.fed[p];
    const saved = this.feed[p][k];
    if (saved) {
      if (!saved.length || !saved.every((x) => Number.isInteger(x) && x >= 0 && x < d.options.length)) return Promise.reject(new Error('A saved answer does not fit the decision it was given for.'));
      this.fed[p] = k + 1;
      this.answers[p].push([...saved]);
      return Promise.resolve([...saved]);
    }
    if (this.restoring && this.fed[0] >= this.feed[0].length && this.fed[1] >= this.feed[1].length) {
      if (this.pendingCheck) return Promise.reject(new Error('The saved moves no longer lead to the same position.'));
      this.restoring = false;
      // decision numbers go on from the answers given, so an answer meant for a decision before the reload never fits
      this.seq = this.answers[0].length + this.answers[1].length;
      this.reached();
    }
    return new Promise<number[]>((resolve, reject) => {
      const seq = ++this.seq;
      seat.pending = { d, seq, view: viewDecision(g.s, d, p), resolve, reject };
      this.check = { at: [this.answers[0].length, this.answers[1].length], hash: stateHash(g.s) };
      this.startTimer(p, seq);
      this.onAsk?.(p);
      this.onChange?.();
    });
  }

  /** The seat whose decision the game is waiting on, or null. */
  waitingSeat(): PlayerId | null {
    return this.seats[0].pending ? 0 : this.seats[1].pending ? 1 : null;
  }

  /** What `seat` sees now: the view of the state and its own decision waiting (if any). */
  view(seat: PlayerId): { state: GameState; decision: { seq: number; d: Decision } | null } {
    const w = this.seats[seat].pending;
    return { state: viewFor(this.g.s, seat), decision: w ? { seq: w.seq, d: w.view } : null };
  }

  /** The seat's decision as its view numbers it (the same object while it waits), or null. */
  pendingView(seat: PlayerId): { seq: number; d: Decision } | null {
    const w = this.seats[seat].pending;
    return w ? { seq: w.seq, d: w.view } : null;
  }

  /** Ms left on the timer, or null. */
  timeLeft(): number | null {
    return this.deadline === null ? null : Math.max(0, this.deadline - this.now());
  }

  /**
   * Answer `seat`'s decision number `seq` with option `i`. Returns null when applied, or why it was refused (nothing is
   * applied then): the game is over, it is not that seat's decision, the decision was already answered, or `i` is not
   * one of its options.
   */
  answer(seat: PlayerId, seq: number, i: number): string | null {
    if (this.stopped || this.ended || this.g.s.winner !== null) return 'The game is over.';
    const w = this.seats[seat].pending;
    if (!w) return 'Nothing is waiting for your answer.';
    if (w.seq !== seq) return 'That answer is for an earlier decision.';
    if (!Number.isInteger(i) || i < 0 || i >= w.d.options.length) return 'That is not one of the options.';
    this.seats[seat].pending = null;
    this.clearTimer();
    this.answers[seat].push([i]);
    w.resolve([i]);
    this.onChange?.();
    return null;
  }

  private startTimer(seat: PlayerId, seq: number) {
    this.clearTimer();
    if (this.restoring || this.setup.timer <= 0) return;
    const ms = this.setup.timer * 1000;
    this.deadline = this.now() + ms;
    this.timer = setTimeout(() => this.expire(seat, seq), ms);
  }

  private clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.deadline = null;
  }

  /** The timer ran out: answer with the safe default and say so in the log. */
  expire(seat: PlayerId, seq: number) {
    const w = this.seats[seat].pending;
    if (!w || w.seq !== seq) return;
    const i = defaultAnswer(w.d);
    this.g.log(null, `Time ran out for ${this.setup.names[seat]}: ${w.d.options[i]?.label ?? 'the first option'} (chosen automatically)`);
    this.answer(seat, seq, i);
  }

  /** Stop the engine without a result yet (the waiting seats' promises reject, so its loop unwinds). */
  private stop() {
    this.stopped = true;
    this.clearTimer();
    for (const s of this.seats) {
      const w = s.pending;
      s.pending = null;
      w?.reject(new GameStopped());
    }
  }

  /** `seat` concedes: the game ends now as a win for the other seat. */
  concede(seat: PlayerId): boolean {
    if (this.stopped || this.ended || this.g.s.winner !== null) return false;
    this.stop();
    const st = this.g.s;
    st.winner = (1 - seat) as PlayerId;
    st.winReason = `${this.setup.names[seat]} conceded`;
    st.phase = 'over';
    this.g.log(null, `${this.setup.names[seat]} conceded: ${this.setup.names[1 - seat]} wins`);
    this.ended = { why: 'conceded', by: seat };
    this.onChange?.();
    return true;
  }

  /**
   * `seat` ran out of time in a multi-day game and the other player claimed the win (src/net/corr.ts): the game ends
   * now as a win for the other seat. A session verdict like concede: the engine is stopped first.
   */
  timeLoss(seat: PlayerId): boolean {
    if (this.stopped || this.ended || this.g.s.winner !== null) return false;
    this.stop();
    const st = this.g.s;
    st.winner = (1 - seat) as PlayerId;
    st.winReason = `${this.setup.names[seat]} ran out of time`;
    st.phase = 'over';
    this.g.log(null, `${this.setup.names[seat]} ran out of time: ${this.setup.names[1 - seat]} claims the win`);
    this.ended = { why: 'timeout', by: seat };
    this.onChange?.();
    return true;
  }

  /** The game ends without a winner (a player left or the connection was given up): recorded as a draw. */
  abandon(why: string, by?: PlayerId): boolean {
    if (this.stopped || this.ended || this.g.s.winner !== null) return false;
    this.stop();
    const st = this.g.s;
    st.winner = 'tie';
    st.winReason = why;
    st.phase = 'over';
    this.g.log(null, `Game abandoned: ${why}`);
    this.ended = { why: 'abandoned', ...(by !== undefined ? { by } : {}) };
    this.onChange?.();
    return true;
  }

  /** Stop for good without a result (leaving the page). */
  quit() {
    if (!this.stopped) this.stop();
    this.g.onUpdate = null;
  }

  /** The save of the game in progress (null once it is over or failed). */
  save(saved = new Date().toISOString()): HostSave | null {
    if (this.ended || this.error || this.restoring) return null;
    return {
      kind: HOST_SAVE_KIND,
      schema: 1,
      simVersion: SIM_VERSION,
      setup: JSON.parse(JSON.stringify(this.setup)) as OnlineSetup,
      answers: [this.answers[0].map((a) => [...a]), this.answers[1].map((a) => [...a])],
      check: this.check ? { at: [...this.check.at] as [number, number], hash: this.check.hash } : null,
      saved,
    };
  }

  /** Rebuild a saved game by replaying both seats' answers; settles once the live decision is reached. */
  static async restore(save: HostSave): Promise<HostGame> {
    if (save.simVersion !== SIM_VERSION) throw new Error(`It was saved with version ${save.simVersion} of the rules engine; this is version ${SIM_VERSION}.`);
    const h = new HostGame(save.setup, { feed: save.answers, check: save.check });
    await h.restored;
    return h;
  }
}

const isInt = (x: unknown): x is number => Number.isInteger(x);
const isAnswers = (x: unknown): x is number[][] => Array.isArray(x) && x.length <= 5000 && x.every((a) => Array.isArray(a) && a.length > 0 && a.length <= 10 && a.every((i) => isInt(i) && i >= 0));
const isDeck = (x: unknown): x is DeckList => {
  const d = x as DeckList | null;
  const ids = (v: unknown) => Array.isArray(v) && v.every((s) => typeof s === 'string');
  return !!d && typeof d === 'object' && typeof d.name === 'string' && ids(d.legends) && ids(d.main) && ids(d.sideboard ?? []);
};

/** A host save read back from storage, or null when it is not one. */
export function parseHostSave(text: string | null): HostSave | null {
  if (!text) return null;
  try {
    const v = JSON.parse(text) as HostSave;
    const s = v?.setup;
    if (v?.kind !== HOST_SAVE_KIND || v.schema !== 1 || !isInt(v.simVersion) || !s || typeof s !== 'object') return null;
    if (typeof s.game !== 'string' || typeof s.token !== 'string' || !Array.isArray(s.names) || s.names.length !== 2 || !s.names.every((n) => typeof n === 'string')) return null;
    if (!Array.isArray(s.decks) || s.decks.length !== 2 || !s.decks.every(isDeck) || !isInt(s.seed) || (s.first !== 0 && s.first !== 1) || !isInt(s.timer) || typeof s.started !== 'string') return null;
    if (s.endTurnClick !== undefined && (!Array.isArray(s.endTurnClick) || s.endTurnClick.length !== 2 || !s.endTurnClick.every((x) => typeof x === 'boolean'))) return null;
    if (!Array.isArray(v.answers) || v.answers.length !== 2 || !v.answers.every(isAnswers)) return null;
    const c = v.check;
    if (c !== null && (!c || !Array.isArray(c.at) || c.at.length !== 2 || !c.at.every(isInt) || typeof c.hash !== 'string')) return null;
    return v;
  } catch {
    return null;
  }
}
