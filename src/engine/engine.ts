// Cyberpunk TCG rules engine. Implements the Comprehensive Rules (Oct 29 2026) turn structure,
// economy (Eddies / Legends as payment), Call a Legend, Go Solo, attacks (react / fight / steal),
// pending-effect resolution, overtime and win/lose checks. Card text lives in ./scripts.
// Game is the facade that scripts, bots, the UI and tests use. Setup, the turn loop, accessors, active script sources
// and the log live here; every other method hands over to the function of the same name in ./game/ (mods, economy,
// zones, gigs, choices, pending, history, actions, combat), which takes the game as its first argument.
import { CARD_BY_ID } from './cards';
import { listFingerprint } from './deck';
import { nextRandom, randInt, shuffleInPlace } from './rng';
import { SCRIPTS } from './scripts';
import type { DecisionRecorder } from './telemetry';
import { GameOverSignal, other } from './game/common';
import * as actionRules from './game/actions';
import * as choiceRules from './game/choices';
import * as combatRules from './game/combat';
import * as economyRules from './game/economy';
import * as gigRules from './game/gigs';
import * as historyRules from './game/history';
import * as modRules from './game/mods';
import * as pendingRules from './game/pending';
import * as zoneRules from './game/zones';
import type { Pending } from './game/pending';
import type {
  Ability,
  Action,
  Agent,
  AttackTargetRef,
  CardDef,
  CardInst,
  CardScript,
  Decision,
  DeckList,
  EventMap,
  EventName,
  GameState,
  Gig,
  Intent,
  Keyword,
  Mod,
  ModKind,
  ModOf,
  ModUntil,
  NewMod,
  PlayerId,
  PlayerState,
  Reaction,
  TurnEvent,
  Zone,
} from './types';

const DICE = [4, 6, 8, 10, 12, 20];
const EMPTY_SCRIPT: CardScript = {};

/** Thrown by the probe copy's agents: the probed effect asks a question, so it would do something. */
class ProbeAsked extends Error {}
const PROBE_AGENT: Agent = {
  name: 'probe',
  decide: async () => {
    throw new ProbeAsked();
  },
};

export interface GameOptions {
  seed?: number;
  first?: PlayerId; // who goes first; random if omitted
  maxTurns?: number;
  log?: boolean;
  trace?: boolean;
}

export class Game {
  s: GameState;
  agents: [Agent, Agent];
  pending: Pending[] = [];
  onUpdate: (() => void) | null = null;
  logEnabled = true;
  /**
   * Opt-in decision telemetry (src/engine/telemetry.ts): set it on the game to record. It lives on this object, not in
   * the state, so clone() and effect probes (new Games from the state) never record. It only observes.
   */
  telemetry: DecisionRecorder | null = null;

  constructor(state: GameState, agents: [Agent, Agent]) {
    this.s = state;
    this.agents = agents;
  }

  // ------------------------------------------------------------------ setup

  static create(decks: [DeckList, DeckList], agents: [Agent, Agent], opts: GameOptions = {}): Game {
    const seed = opts.seed ?? Math.floor(Math.random() * 2 ** 31);
    const s: GameState = {
      rng: seed,
      turn: 0,
      active: 0,
      first: 0,
      phase: 'setup',
      players: [null as any, null as any],
      cards: {},
      gigs: {},
      mods: [],
      attack: null,
      winner: null,
      winReason: '',
      overtime: false,
      emptyFixerStreak: 0,
      nextUid: 1,
      nextModId: 1,
      once: {},
      counters: {},
      turnEvents: [],
      log: [],
      stats: { attacks: [0, 0], gigsStolen: [0, 0], unitsDefeated: [0, 0], cardsPlayed: [0, 0], sold: [0, 0], calls: [0, 0] },
      maxTurns: opts.maxTurns ?? 60,
      trace: opts.trace ? [] : undefined,
    };
    let gigId = 1;
    for (const p of [0, 1] as PlayerId[]) {
      const d = decks[p];
      const ps: PlayerState = {
        id: p,
        name: d.name,
        listId: listFingerprint(d),
        deck: [],
        hand: [],
        field: [],
        legends: [],
        eddies: [],
        trash: [],
        removed: [],
        fixer: [],
        gigs: [],
        sideboard: [...d.sideboard],
      };
      s.players[p] = ps;
      for (const id of d.main) {
        if (!CARD_BY_ID[id]) throw new Error(`Unknown card id ${id}`);
        const uid = s.nextUid++;
        s.cards[uid] = mkInst(uid, id, p, 'deck');
        ps.deck.push(uid);
      }
      for (const id of d.legends) {
        if (!CARD_BY_ID[id]) throw new Error(`Unknown legend id ${id}`);
        const uid = s.nextUid++;
        s.cards[uid] = mkInst(uid, id, p, 'legends');
        ps.legends.push(uid);
      }
      for (const sides of DICE) {
        const g: Gig = { id: gigId++, sides, value: sides, owner: p, controller: null };
        s.gigs[g.id] = g;
        ps.fixer.push(g.id);
      }
    }
    const game = new Game(s, agents);
    if (opts.log === false) game.logEnabled = false;
    s.first = opts.first ?? ((randInt(s, 2) as PlayerId));
    s.active = s.first;
    for (const p of [0, 1] as PlayerId[]) {
      shuffleInPlace(s, s.players[p].deck);
      shuffleInPlace(s, s.players[p].legends);
    }
    // First player spends their 2 left-most legends (7.7.4)
    const fl = s.players[s.first].legends;
    s.cards[fl[0]].spent = true;
    s.cards[fl[1]].spent = true;
    for (const p of [0, 1] as PlayerId[]) for (let i = 0; i < 6; i++) game.drawRaw(p);
    if (s.trace) for (const p of [0, 1] as PlayerId[]) for (const u of s.players[p].hand) game.tr('open', p, s.cards[u].defId);
    return game;
  }

  /**
   * Clone for lookahead. Agents must be supplied (scripts are stateless).
   * The log and trace are left out (lookahead never reads them, and copying them made clones slower as a game went
   * on); pass keepLog to copy the log too (the Play undo snapshot shows it). Clones never record telemetry.
   * Throws if effects are still pending: they live outside the state and a clone would silently drop them.
   */
  clone(agents: [Agent, Agent], opts: { keepLog?: boolean } = {}): Game {
    if (this.pending.length) throw new Error(`clone() with ${this.pending.length} pending effect(s): ${this.pending.map((x) => x.label).join(', ')}`);
    const { log, trace } = this.s;
    let st: GameState;
    this.s.log = [];
    this.s.trace = undefined;
    try {
      st = structuredClone(this.s);
    } finally {
      this.s.log = log;
      this.s.trace = trace;
    }
    if (opts.keepLog) st.log = log.map((e) => ({ ...e }));
    const g = new Game(st, agents);
    g.logEnabled = false;
    return g;
  }

  /**
   * @internal A throwaway copy for an effect probe (game/pending.ts effectMatters): the state without log or trace,
   * agents that refuse to answer, no logging. Unlike clone() it allows pending effects (probes run while they resolve).
   */
  probeCopy(): Game {
    const { log, trace } = this.s;
    let st: GameState;
    this.s.log = [];
    this.s.trace = undefined;
    try {
      st = structuredClone(this.s);
    } finally {
      this.s.log = log;
      this.s.trace = trace;
    }
    const cg = new Game(st, [PROBE_AGENT, PROBE_AGENT]);
    cg.logEnabled = false;
    return cg;
  }

  // ------------------------------------------------------------------ main loop

  async run(): Promise<GameState> {
    try {
      await this.mulligans();
      while (this.s.winner === null) {
        await this.playTurn();
      }
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    this.s.phase = 'over';
    this.update();
    return this.s;
  }

  /**
   * Continue a game restored from a snapshot taken during the active player's main phase (used by Undo):
   * finish that main phase, then play on to the end exactly like run().
   */
  async resume(): Promise<GameState> {
    if (this.pending.length) throw new Error(`resume() with ${this.pending.length} pending effect(s)`);
    try {
      await this.mainLoop();
      await this.endPhase();
      while (this.s.winner === null) await this.playTurn();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    this.s.phase = 'over';
    this.update();
    return this.s;
  }

  async mulligans() {
    for (const p of [this.s.first, other(this.s.first)]) {
      const ok = await this.yesNo(p, 'Mulligan your opening hand (shuffle it back and draw 6)?', 'mulligan');
      if (ok) {
        const ps = this.P(p);
        for (const uid of ps.hand) this.s.cards[uid].zone = 'deck';
        ps.deck.push(...ps.hand);
        ps.hand = [];
        shuffleInPlace(this.s, ps.deck);
        for (let i = 0; i < 6; i++) this.drawRaw(p);
        this.log(p, 'mulligans');
        this.tr('mulligan', p);
        for (const u of ps.hand) this.tr('open', p, this.s.cards[u].defId);
      }
    }
  }

  async playTurn() {
    await this.startPhase();
    await this.mainLoop();
    await this.endPhase();
  }

  async startPhase() {
    const s = this.s;
    s.turn += 1;
    const p = s.active;
    const ps = this.P(p);
    s.phase = 'start';
    // per-turn bookkeeping only ever compares against the current turn: drop last turn's entries
    s.turnEvents = [];
    for (const k of Object.keys(s.once)) if (s.once[k] !== s.turn) delete s.once[k];
    if (s.turn > s.maxTurns) return this.endGame('tie', 'turn limit reached');
    if (ps.gigs.length >= 7) return this.endGame(p, 'controls 7+ Gigs at start of turn');
    s.counters.fixerEmptyAtStart = ps.fixer.length === 0 ? 1 : 0;
    this.log(p, `--- Turn ${s.turn} (${ps.name}) ---`);
    // remove "until start of your next turn" effects
    s.mods = s.mods.filter((m) => !(m.until === 'startOfTurn' && m.untilPlayer === p));
    this.emit('turnStart', { player: p });
    await this.resolvePending();
    // ready step
    const firstTurnHold = s.turn === 1 ? new Set(ps.legends.filter((u) => s.cards[u].spent)) : new Set<number>();
    for (const uid of [...ps.legends, ...ps.field, ...ps.eddies]) {
      if (firstTurnHold.has(uid)) continue;
      const c = s.cards[uid];
      if (c.spent && !this.hasMod('cantReady', uid)) c.spent = false;
    }
    // draw
    await this.draw(p, 1);
    // roll in a gig
    if (ps.fixer.length > 0) await this.rollIn(p);
    await this.resolvePending();
  }

  /** Main phase action loop (also used by lookahead rollouts to finish a turn). */
  async mainLoop() {
    const s = this.s;
    const p = s.active;
    s.phase = 'main';
    this.update();
    while (s.winner === null) {
      const actions = this.legalActions(p);
      const action = await this.chooseAction(p, actions);
      if (action.type === 'pass') break;
      await this.doAction(p, action);
      await this.resolvePending();
      this.checkState();
      this.update();
    }
  }

  async endPhase() {
    const s = this.s;
    const p = s.active;
    const fixerEmptyAtStart = s.counters.fixerEmptyAtStart === 1;
    s.phase = 'end';
    this.tr('turnEnd', p, undefined, `${this.P(0).gigs.length}-${this.P(1).gigs.length}`);
    const spent = Object.values(s.cards)
      .filter((c) => c.spent && (c.zone === 'field' || c.zone === 'legends'))
      .map((c) => c.uid);
    this.emit('turnEnd', { player: p, spent });
    await this.resolvePending();
    s.mods = s.mods.filter((m) => m.until !== 'endOfTurn');
    for (const c of Object.values(s.cards)) c.lag = false;
    // overtime: two consecutive turns where the turn player began with an empty fixer
    s.emptyFixerStreak = fixerEmptyAtStart ? s.emptyFixerStreak + 1 : 0;
    if (!s.overtime && s.emptyFixerStreak >= 2) {
      s.overtime = true;
      this.log(null, 'OVERTIME begins: 7+ Gigs wins immediately.');
      this.checkState();
    }
    s.active = other(p);
    this.update();
  }

  endGame(w: PlayerId | 'tie', reason: string): never {
    this.s.winner = w;
    this.s.winReason = reason;
    this.s.phase = 'over';
    this.log(null, w === 'tie' ? `Game drawn: ${reason}` : `${this.P(w).name} wins: ${reason}`);
    throw new GameOverSignal(reason);
  }

  checkState() {
    if (this.s.overtime) {
      const a = this.P(0).gigs.length >= 7;
      const b = this.P(1).gigs.length >= 7;
      if (a && b) this.endGame('tie', 'both reached 7 Gigs in overtime');
      if (a) this.endGame(0, 'reached 7 Gigs in overtime');
      if (b) this.endGame(1, 'reached 7 Gigs in overtime');
    }
  }

  update() {
    this.onUpdate?.();
  }

  /** Called after every log line (replay viewers capture the board state here). */
  onLog: (() => void) | null = null;

  log(p: PlayerId | null, text: string) {
    if (!this.logEnabled) return;
    this.s.log.push({ turn: this.s.turn, player: p, text });
    if (this.s.log.length > 2000) this.s.log.splice(0, 500);
    this.onLog?.();
  }

  // ------------------------------------------------------------------ accessors

  P(p: PlayerId): PlayerState {
    return this.s.players[p];
  }
  c(uid: number): CardInst {
    return this.s.cards[uid];
  }
  def(x: number | CardInst): CardDef {
    const ci = typeof x === 'number' ? this.s.cards[x] : x;
    return CARD_BY_ID[ci.defId];
  }
  script(x: number | CardInst): CardScript {
    const ci = typeof x === 'number' ? this.s.cards[x] : x;
    return SCRIPTS[ci.defId] ?? EMPTY_SCRIPT;
  }
  name(x: number | CardInst): string {
    return this.def(x).displayName;
  }
  gig(id: number): Gig {
    return this.s.gigs[id];
  }
  isTag(x: number | CardInst, tag: string): boolean {
    return this.def(x).tags.some((t) => t.toLowerCase() === tag.toLowerCase());
  }
  hasName(x: number | CardInst, name: string): boolean {
    const n = this.def(x).name.toLowerCase();
    return n === name.toLowerCase() || n.split(' & ').includes(name.toLowerCase());
  }

  /** Units in play for player (includes Legends on the field, whether they went solo or were played by paying their cost). */
  units(p: PlayerId): CardInst[] {
    return this.P(p).field.map((u) => this.s.cards[u]).filter((c) => c.zone === 'field');
  }
  allUnits(): CardInst[] {
    return [...this.units(0), ...this.units(1)];
  }
  isUnit(c: CardInst): boolean {
    return c.zone === 'field';
  }
  isLegend(c: CardInst): boolean {
    return this.def(c).type === 'Legend';
  }
  /** Face-up legends: legends area face-up + Legends on the field. */
  faceUpLegends(p: PlayerId): CardInst[] {
    const ps = this.P(p);
    const a = ps.legends.map((u) => this.s.cards[u]).filter((c) => c.faceUp);
    const b = ps.field.map((u) => this.s.cards[u]).filter((c) => this.isLegend(c));
    return [...a, ...b];
  }
  faceDownLegends(p: PlayerId): CardInst[] {
    return this.P(p)
      .legends.map((u) => this.s.cards[u])
      .filter((c) => !c.faceUp);
  }
  gigsOf(p: PlayerId): Gig[] {
    return this.P(p).gigs.map((id) => this.s.gigs[id]);
  }
  allGigs(): Gig[] {
    return [...this.gigsOf(0), ...this.gigsOf(1)];
  }
  streetCred(p: PlayerId): number | null {
    const g = this.gigsOf(p);
    if (!g.length) return null;
    return g.reduce((a, x) => a + x.value, 0);
  }
  /** Compare street cred: returns true if p has less ☆ than rival (null is smallest). */
  lessCred(p: PlayerId): boolean {
    const a = this.streetCred(p);
    const b = this.streetCred(other(p));
    if (a === null) return b !== null;
    if (b === null) return false;
    return a < b;
  }
  moreCred(p: PlayerId): boolean {
    const a = this.streetCred(p);
    const b = this.streetCred(other(p));
    if (a === null) return false;
    if (b === null) return true;
    return a > b;
  }
  credEven(p: PlayerId): boolean {
    const v = this.streetCred(p);
    return v !== null && v % 2 === 0;
  }
  isMinGig(g: Gig) {
    return g.value === 1;
  }
  isMaxGig(g: Gig) {
    return g.value === g.sides;
  }
  valuePairs(p: PlayerId): number {
    const counts: Record<number, number> = {};
    for (const g of this.gigsOf(p)) counts[g.value] = (counts[g.value] ?? 0) + 1;
    return Object.values(counts).reduce((a, n) => a + Math.floor(n / 2), 0);
  }
  distinctValues(p: PlayerId): number {
    return new Set(this.gigsOf(p).map((g) => g.value)).size;
  }

  // ------------------------------------------------------------------ active script sources

  /** All (self, host) pairs whose text is currently active, for a player or both. */
  sources(p?: PlayerId): { self: CardInst; host: CardInst; controller: PlayerId }[] {
    const out: { self: CardInst; host: CardInst; controller: PlayerId }[] = [];
    const ps = p === undefined ? ([0, 1] as PlayerId[]) : [p];
    for (const pl of ps) {
      const P = this.P(pl);
      for (const uid of [...P.field, ...P.legends]) {
        const c = this.s.cards[uid];
        if (c.zone === 'legends' && !c.faceUp) continue;
        out.push({ self: c, host: c, controller: pl });
        for (const gu of c.gear) out.push({ self: this.s.cards[gu], host: c, controller: pl });
      }
    }
    return out;
  }

  // ------------------------------------------------------------------ modifiers

  addMod<K extends ModKind>(m: Extract<NewMod, { kind: K }>): ModOf<K> {
    return modRules.addMod(this, m);
  }
  modsFor<K extends ModKind>(kind: K, uid?: number): ModOf<K>[] {
    return modRules.modsFor(this, kind, uid);
  }
  hasMod(kind: ModKind, uid: number): boolean {
    return modRules.hasMod(this, kind, uid);
  }
  playerMods<K extends ModKind>(kind: K, p: PlayerId): ModOf<K>[] {
    return modRules.playerMods(this, kind, p);
  }
  removeMod(id: number) {
    return modRules.removeMod(this, id);
  }
  /** Give a unit +N power until end of turn (or other duration). */
  givePower(uid: number, amount: number, until?: Exclude<ModUntil, 'startOfTurn'>, untilPlayer?: undefined, source?: number): void;
  givePower(uid: number, amount: number, until: 'startOfTurn', untilPlayer: PlayerId, source?: number): void;
  givePower(uid: number, amount: number, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId, source?: number) {
    return modRules.givePower(this, uid, amount, until, untilPlayer, source);
  }
  giveKeyword(uid: number, kw: Keyword, until: Exclude<ModUntil, 'startOfTurn'> = 'endOfTurn') {
    return modRules.giveKeyword(this, uid, kw, until);
  }

  // ------------------------------------------------------------------ derived stats

  /** Raw power (may be negative). */
  rawPower(x: number | CardInst): number {
    return modRules.rawPower(this, x);
  }
  power(x: number | CardInst): number {
    return modRules.power(this, x);
  }
  hasKw(x: number | CardInst, kw: Keyword): boolean {
    return modRules.hasKw(this, x, kw);
  }

  /** Play cost for a card in hand/trash (after modifiers, min 1 if reduced). */
  playCost(uid: number, p: PlayerId, kind: 'play' | 'goSolo' = 'play'): number {
    return economyRules.playCost(this, uid, p, kind);
  }

  /** Ready payment sources for player. */
  payables(p: PlayerId): CardInst[] {
    return economyRules.payables(this, p);
  }
  available(p: PlayerId): number {
    return economyRules.available(this, p);
  }

  /**
   * Pay amount using Eddies first, then legends that benefit from being spent, then face-down legends, etc.
   * If the paying agent opts in (`choosesPayment`) and the choice is real, it picks each source instead
   * (one 'pay' decision per €$; the first option is always what the automatic rule would pick).
   * `what` names the cost in the prompt. `order.first` / `order.last` move sources to the front or back of the automatic
   * order (a Legend paying for its own Go Solo costs nothing, so it goes first; one paying for its own ordinary play
   * enters spent, so it goes last).
   */
  pay(p: PlayerId, amount: number, exclude: number[] = [], what = 'a cost', order: { first?: number[]; last?: number[] } = {}): Promise<boolean> {
    return economyRules.pay(this, p, amount, exclude, what, order);
  }

  /** Ready up to n spent friendly Eddies. */
  readyEddies(p: PlayerId, n: number) {
    return economyRules.readyEddies(this, p, n);
  }

  // ------------------------------------------------------------------ zones & movement

  zoneList(p: PlayerId, z: Zone): number[] | null {
    return zoneRules.zoneList(this, p, z);
  }

  /**
   * Move a card to a zone of its owner (or controller for field). Handles Legend invalid zones and gear.
   * position: 'top' | 'bottom' for deck.
   */
  move(uid: number, to: Zone, opts: { position?: 'top' | 'bottom'; controller?: PlayerId; faceUp?: boolean } = {}) {
    return zoneRules.move(this, uid, to, opts);
  }

  // ------------------------------------------------------------------ basic game actions

  /** Record a telemetry event (no-op unless the game was created with trace: true). */
  tr(k: import('./types').TraceKind, p: PlayerId, id?: string, x?: string | number) {
    if (this.s.trace) this.s.trace.push({ t: this.s.turn, p, k, id, x });
  }

  drawRaw(p: PlayerId): number | null {
    return zoneRules.drawRaw(this, p);
  }

  draw(p: PlayerId, n: number): Promise<number[]> {
    return zoneRules.draw(this, p, n);
  }

  /** "Trash X": reveal top card of deck and put it in the trash. Returns uids trashed. */
  mill(p: PlayerId, n: number): number[] {
    return zoneRules.mill(this, p, n);
  }

  /** Player discards n cards of their choice from hand. Returns discarded uids. */
  discard(p: PlayerId, n: number, filter?: (c: CardInst) => boolean, optional = false, prompt?: string): Promise<number[]> {
    return zoneRules.discard(this, p, n, filter, optional, prompt);
  }

  sell(p: PlayerId, uid: number) {
    return zoneRules.sell(this, p, uid);
  }

  spend(uid: number, cause: EventMap['spent']['cause'] = 'effect') {
    return zoneRules.spend(this, uid, cause);
  }
  ready(uid: number) {
    return zoneRules.ready(this, uid);
  }

  bottomDeck(uid: number) {
    return zoneRules.bottomDeck(this, uid);
  }
  returnToHand(uid: number) {
    return zoneRules.returnToHand(this, uid);
  }

  equip(gearUid: number, hostUid: number) {
    return zoneRules.equip(this, gearUid, hostUid);
  }

  /** Defeat a Unit (or Legend on field / face-up legend). Returns true if it was defeated. */
  defeat(uid: number, opts: { inFight?: boolean; by?: number | null } = {}): Promise<boolean> {
    return zoneRules.defeat(this, uid, opts);
  }

  /** Defeat a Gear (e.g. Detonate). */
  defeatGear(uid: number) {
    return zoneRules.defeatGear(this, uid);
  }

  // ------------------------------------------------------------------ gigs

  rollIn(p: PlayerId) {
    return gigRules.rollIn(this, p);
  }

  /** Re-roll an existing gig in place (used by Kerry). */
  reroll(gid: number) {
    return gigRules.reroll(this, gid);
  }

  setGigValue(gid: number, value: number, by: PlayerId, kind: 'adjust' | 'set' = 'adjust'): boolean {
    return gigRules.setGigValue(this, gid, value, by, kind);
  }

  moveGig(gid: number, to: PlayerId) {
    return gigRules.moveGig(this, gid, to);
  }

  swapGigs(friendly: number, rival: number, by: PlayerId) {
    return gigRules.swapGigs(this, friendly, rival, by);
  }

  /** Steal a specific gig as `actor` (unit uid) for player p. Fires steal triggers. */
  stealGig(actor: number, gid: number, p: PlayerId) {
    return gigRules.stealGig(this, actor, gid, p);
  }

  // ------------------------------------------------------------------ high-level gig helpers for scripts

  /**
   * "Increase/Decrease/Adjust a Gig by up to N" — presents every (gig, newValue) option.
   * whose: which gigs are eligible. Returns chosen gig id or null.
   */
  adjustGig(p: PlayerId, amount: number, dir: 'up' | 'down' | 'either', whose: 'any' | 'friendly' | 'rival' = 'any', opts: { exact?: boolean; source?: number; optional?: boolean } = {},): Promise<number | null> {
    return gigRules.adjustGig(this, p, amount, dir, whose, opts);
  }

  /** Choose a gig (no modification). */
  chooseGig(p: PlayerId, gigs: Gig[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
    return gigRules.chooseGig(this, p, gigs, prompt, optional, tag, intent);
  }

  // ------------------------------------------------------------------ choices

  ask(d: Decision): Promise<number[]> {
    return choiceRules.ask(this, d);
  }

  yesNo(p: PlayerId, prompt: string, tag?: string, source?: number): Promise<boolean> {
    return choiceRules.yesNo(this, p, prompt, tag, source);
  }

  chooseUnit(p: PlayerId, cands: CardInst[], prompt: string, opts: { optional?: boolean; intent?: Intent; tag?: string; source?: number } = {},): Promise<CardInst | null> {
    return choiceRules.chooseUnit(this, p, cands, prompt, opts);
  }

  chooseCard(p: PlayerId, uids: number[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
    return choiceRules.chooseCard(this, p, uids, prompt, optional, tag, intent);
  }

  chooseMode(p: PlayerId, prompt: string, modes: string[], source?: number, tag?: string): Promise<number> {
    return choiceRules.chooseMode(this, p, prompt, modes, source, tag);
  }

  // ------------------------------------------------------------------ pending effects / events

  enqueue(player: PlayerId, label: string, run: () => Promise<void>, extra: { source?: number; probe?: (g: Game) => Promise<void> } = {}) {
    return pendingRules.enqueue(this, player, label, run, extra);
  }

  /**
   * Register a delayed trigger owned by `self` (e.g. a Program that says "the next time ... this turn").
   * The card's script must define delayed[event]. data is stored on mod.value.data.
   */
  addDelayed(self: CardInst, event: EventName, data?: any, until?: Exclude<ModUntil, 'startOfTurn'>, untilPlayer?: undefined): ModOf<'delayed'>;
  addDelayed(self: CardInst, event: EventName, data: any, until: 'startOfTurn', untilPlayer: PlayerId): ModOf<'delayed'>;
  addDelayed(self: CardInst, event: EventName, data: any = {}, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId): ModOf<'delayed'> {
    return pendingRules.addDelayed(this, self, event, data, until, untilPlayer);
  }

  emit<K extends EventName>(name: K, ev: EventMap[K]) {
    return pendingRules.emit(this, name, ev);
  }

  /** @internal Player currently resolving their pending effects (10.14.1); kept across nested resolvePending calls. */
  resolving: PlayerId | null = null;

  /**
   * Resolve pending effects. The turn player resolves theirs first (10.13); once a player has started, they keep
   * resolving their own effects, including ones that become pending meanwhile, until none remain, and only then does
   * the other player resolve theirs (10.14.1). The resolving player chooses the order of their own effects (10.12):
   * an agent with `choosesOrder` is asked (see chooseNextPending); every other agent resolves them first in, first out.
   */
  resolvePending() {
    return pendingRules.resolvePending(this);
  }

  // ------------------------------------------------------------------ per-turn history

  /** Number of events of a kind this turn (optionally filtered). */
  turnCount(k: TurnEvent['k'], pred?: (e: TurnEvent) => boolean): number {
    return historyRules.turnCount(this, k, pred);
  }

  /**
   * "The first time ... each turn": true if no event of this kind matching pred happened this turn before the event
   * with index `seq` (the `seq` carried by the event payload). Counts events whether or not the asking card was in play.
   */
  firstThisTurn(seq: number | undefined, k: TurnEvent['k'], pred: (e: TurnEvent) => boolean): boolean {
    return historyRules.firstThisTurn(this, seq, k, pred);
  }

  oncePerTurn(key: string): boolean {
    return historyRules.oncePerTurn(this, key);
  }
  usedThisTurn(key: string): boolean {
    return historyRules.usedThisTurn(this, key);
  }

  // ------------------------------------------------------------------ legal actions

  canSell(p: PlayerId): boolean {
    return actionRules.canSell(this, p);
  }
  canCall(p: PlayerId): boolean {
    return actionRules.canCall(this, p);
  }
  /** €$ cost of p's normal Call action: 1, unless a card makes it cheaper (Panam Palmer: Strength Through Family). */
  callCost(p: PlayerId): number {
    return economyRules.callCost(this, p);
  }

  /** Host candidates for a gear. */
  gearHosts(p: PlayerId): CardInst[] {
    return actionRules.gearHosts(this, p);
  }

  canPlayCard(p: PlayerId, uid: number, free = false): boolean {
    return actionRules.canPlayCard(this, p, uid, free);
  }

  abilityUsable(p: PlayerId, self: CardInst, host: CardInst, a: Ability, asReaction: boolean): boolean {
    return actionRules.abilityUsable(this, p, self, host, a, asReaction);
  }

  listAbilities(p: PlayerId, asReaction: boolean): { self: CardInst; host: CardInst; index: number; a: Ability }[] {
    return actionRules.listAbilities(this, p, asReaction);
  }

  canAttackAtAll(c: CardInst): boolean {
    return combatRules.canAttackAtAll(this, c);
  }

  /** Lag permission: what a lagging unit may attack ('any' | 'units' | 'gigs' | null). */
  lagPermission(c: CardInst): 'any' | 'units' | 'gigs' | null {
    return combatRules.lagPermission(this, c);
  }

  attackTargets(c: CardInst): AttackTargetRef[] {
    return combatRules.attackTargets(this, c);
  }

  legalActions(p: PlayerId): Action[] {
    return actionRules.legalActions(this, p);
  }

  describeAction(a: Action | Reaction): string {
    return actionRules.describeAction(this, a);
  }

  programsPlayedThisTurn(p: PlayerId): number {
    return actionRules.programsPlayedThisTurn(this, p);
  }

  chooseAction(p: PlayerId, actions: Action[]): Promise<Action> {
    return choiceRules.chooseAction(this, p, actions);
  }

  // ------------------------------------------------------------------ performing actions

  doAction(p: PlayerId, a: Action) {
    return actionRules.doAction(this, p, a);
  }

  /** Call a Legend (flip face-up). Respects once-per-turn. free = effect-granted. */
  callLegend(p: PlayerId, uid?: number, opts: { free?: boolean; filter?: (c: CardInst) => boolean } = {}): Promise<boolean> {
    return actionRules.callLegend(this, p, uid, opts);
  }

  playFromHand(p: PlayerId, uid: number) {
    return actionRules.playFromHand(this, p, uid);
  }

  /** Play a card for free (or already paid) from any zone. */
  playFree(p: PlayerId, uid: number, from: Zone, opts: { bottomDeckAfter?: boolean; hostFilter?: (c: CardInst) => boolean } = {}) {
    return actionRules.playFree(this, p, uid, from, opts);
  }

  /**
   * Go Solo (11.29.1): pay the Legend's Go Solo cost and play it as a ready Unit that can attack this turn.
   * The Legend may be spent as one of its own payment sources (general FAQ #10). Go Solo plays it "as a ready Unit", so
   * it enters ready even then (assumption: the card text's "ready" overrides 4.5.1's "same orientation"; the FAQ text
   * itself is not in the repo). Spending it costs nothing, so automatic payment spends it first.
   * Trigger order: its "when spent" triggers (e.g. Netwatch Netdriver on it) become pending while it pays, before it is
   * played, so they come before "when a card is played" triggers and its own {Play}; its controller may reorder them
   * (10.12) when they choose the order of their effects.
   */
  goSolo(p: PlayerId, uid: number) {
    return actionRules.goSolo(this, p, uid);
  }

  /**
   * Play a face-up Legend from the Legends area to the field as a Unit by paying its cost, without Go Solo (4.5). It
   * enters in the orientation it had when it left the Legends area (4.5.1: spent if it helped pay its own cost, so
   * automatic payment spends it last) and with Lag (4.5.2). It is not a Go Solo Unit, so it gets no permission to attack
   * this turn; if it later goes anywhere but the Legends area or field it is removed from the game (4.4.1, see move()).
   */
  playLegend(p: PlayerId, uid: number) {
    return actionRules.playLegend(this, p, uid);
  }

  activate(p: PlayerId, selfUid: number, hostUid: number, index: number, asReaction = false) {
    return actionRules.activate(this, p, selfUid, hostUid, index, asReaction);
  }

  // ------------------------------------------------------------------ attack

  attack(p: PlayerId, uid: number, target: AttackTargetRef) {
    return combatRules.attack(this, p, uid, target);
  }

  /**
   * The rest of an attack after its {Attack} triggers: the rival's reaction window, then the fight or the steal,
   * then cleanup. Split out so a lookahead clone taken during a reaction can resume the attack.
   */
  attackRest(uid: number, reactionsClosed = false) {
    return combatRules.attackRest(this, uid, reactionsClosed);
  }

  attackValid(): boolean {
    return combatRules.attackValid(this);
  }

  legalReactions(p: PlayerId): Reaction[] {
    return combatRules.legalReactions(this, p);
  }

  doReaction(p: PlayerId, rx: Reaction) {
    return combatRules.doReaction(this, p, rx);
  }

  fightOutcome(aUid: number, bUid: number): { a: 'win' | 'lose'; b: 'win' | 'lose' } {
    return combatRules.fightOutcome(this, aUid, bUid);
  }

  fight(aUid: number, bUid: number) {
    return combatRules.fight(this, aUid, bUid);
  }

  /** Does a 'noDefeatOpp' effect cover this Unit (a mod on the Unit, or a player-wide mod for its controller)? */
  noDefeatOppMod(uid: number): Mod | undefined {
    return combatRules.noDefeatOppMod(this, uid);
  }

  stealCount(att: CardInst): number {
    return combatRules.stealCount(this, att);
  }

  /** Effects that change how many Gigs the actor steals ("steals 1 fewer Gig"). Applied to every steal (11.5.1.3). */
  stealModifier(att: CardInst): number {
    return combatRules.stealModifier(this, att);
  }

  /**
   * Gigs of player `from` that the actor may select to steal, after every effect that restricts its ability to steal
   * (11.5.1.3): player-level 'stealBan' mods (Chrome Fang, Westbrook Netrunner) and scripts' stealBan hooks. Used by
   * attack steals and effect steals alike.
   */
  stealableGigs(att: CardInst, from: PlayerId): Gig[] {
    return combatRules.stealableGigs(this, att, from);
  }

  steal(attUid: number, from: PlayerId) {
    return combatRules.steal(this, attUid, from);
  }

  /**
   * Effect-driven steal: actor steals one rival Gig chosen by p (e.g. Gorilla Arms, Appetite). The same restrictions
   * and steal-count modifiers as an attack steal apply (11.5.1.3), so "steals 1 fewer Gig" cancels it.
   */
  stealOne(p: PlayerId, actor: number, filter?: (g: Gig) => boolean) {
    return combatRules.stealOne(this, p, actor, filter);
  }
}

function mkInst(uid: number, defId: string, owner: PlayerId, zone: Zone): CardInst {
  return { uid, defId, owner, controller: owner, zone, spent: false, faceUp: zone === 'legends' ? false : false, lag: false, gear: [], host: null, enteredTurn: 0, goSolo: false };
}

export { nextRandom };
export { GameOverSignal, other };
export { costModMatches } from './game/economy';

