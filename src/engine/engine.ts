// Cyberpunk TCG rules engine. Implements the Comprehensive Rules (Oct 29 2026) turn structure,
// economy (Eddies / Legends as payment), Call a Legend, Go Solo, attacks (react / fight / steal),
// pending-effect resolution, overtime and win/lose checks. Card text lives in ./scripts.
import { CARD_BY_ID } from './cards';
import { listFingerprint } from './deck';
import { nextRandom, randInt, shuffleInPlace } from './rng';
import { SCRIPTS } from './scripts';
import type { DecisionRecorder } from './telemetry';
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
  DefeatInfo,
  EventMap,
  EventName,
  GameState,
  Gig,
  Intent,
  Keyword,
  LegendPlay,
  Mod,
  ModUntil,
  Opt,
  PlayerId,
  PlayerState,
  Reaction,
  TurnEvent,
  Zone,
} from './types';

export const DICE = [4, 6, 8, 10, 12, 20];
const EMPTY_SCRIPT: CardScript = {};

export function other(p: PlayerId): PlayerId {
  return (1 - p) as PlayerId;
}

interface Pending {
  player: PlayerId;
  /** names the effect and its source card (shown when its controller orders their effects) */
  label: string;
  run: () => Promise<void>;
  /** uid of the card whose text this is */
  source?: number;
  /**
   * Runs the same effect against a throwaway copy of the game, to tell whether resolving it now would do anything
   * (see effectMatters). Absent: assume it would.
   */
  probe?: (g: Game) => Promise<void>;
}

/** Event wording for pending-effect labels ("Netwatch Netdriver (on V): when spent"). */
const EVENT_TEXT: Record<EventName, string> = {
  spent: 'when spent',
  attack: 'when a Unit attacks',
  steal: 'when a Gig is stolen',
  fight: 'after a fight',
  unitDefeated: 'when a Unit is defeated',
  cardPlayed: 'when a card is played',
  blockerUsed: 'when a Blocker is used',
  gigRolled: 'when a Gig is rolled in',
  gigChanged: 'when a Gig changes',
  legendCalled: 'when a Legend is Called',
  turnEnd: 'at the end of the turn',
  turnStart: 'at the start of the turn',
};

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

export class GameOverSignal extends Error {}

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

  addMod(m: Omit<Mod, 'id' | 'turn'>): Mod {
    const mod: Mod = { ...m, id: this.s.nextModId++, turn: this.s.turn };
    this.s.mods.push(mod);
    return mod;
  }
  modsFor(kind: string, uid?: number): Mod[] {
    return this.s.mods.filter((m) => m.kind === kind && (uid === undefined || m.target === uid));
  }
  hasMod(kind: string, uid: number): boolean {
    return this.s.mods.some((m) => m.kind === kind && m.target === uid);
  }
  playerMods(kind: string, p: PlayerId): Mod[] {
    return this.s.mods.filter((m) => m.kind === kind && m.player === p);
  }
  removeMod(id: number) {
    this.s.mods = this.s.mods.filter((m) => m.id !== id);
  }
  /** Give a unit +N power until end of turn (or other duration). */
  givePower(uid: number, amount: number, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId, source?: number) {
    this.addMod({ kind: 'power', target: uid, amount, until, untilPlayer, source });
  }
  giveKeyword(uid: number, kw: Keyword, until: ModUntil = 'endOfTurn') {
    this.addMod({ kind: 'keyword', target: uid, value: kw, until });
  }

  // ------------------------------------------------------------------ derived stats

  /** Raw power (may be negative). */
  rawPower(x: number | CardInst): number {
    const c = typeof x === 'number' ? this.s.cards[x] : x;
    const d = this.def(c);
    let p = d.power ?? 0;
    for (const gu of c.gear) p += this.def(gu).power ?? 0;
    for (const m of this.s.mods) if (m.kind === 'power' && m.target === c.uid) p += m.amount ?? 0;
    if (c.zone === 'field' || c.zone === 'legends') {
      for (const src of this.sources()) {
        const fn = this.script(src.self).power;
        if (fn) p += fn(this, src.self, src.host, c);
      }
    }
    return p;
  }
  power(x: number | CardInst): number {
    return Math.max(0, this.rawPower(x));
  }
  hasKw(x: number | CardInst, kw: Keyword): boolean {
    const c = typeof x === 'number' ? this.s.cards[x] : x;
    if (this.def(c).keywords.includes(kw)) return true;
    for (const gu of c.gear) if (this.def(gu).keywords.includes(kw)) return true;
    if (this.s.mods.some((m) => m.kind === 'keyword' && m.target === c.uid && m.value === kw)) return true;
    for (const src of this.sources()) {
      const fn = this.script(src.self).keywords;
      if (fn && fn(this, src.self, src.host, c).includes(kw)) return true;
    }
    return false;
  }

  /** Play cost for a card in hand/trash (after modifiers, min 1 if reduced). */
  playCost(uid: number, p: PlayerId, kind: 'play' | 'goSolo' = 'play'): number {
    const c = this.s.cards[uid];
    const d = this.def(c);
    const sc = this.script(c);
    let base = d.cost ?? 0;
    const alt = sc.altCost?.(this, c, p);
    if (alt !== null && alt !== undefined) base = alt;
    let delta = sc.selfCost ? sc.selfCost(this, c, p) : 0;
    for (const src of this.sources()) {
      const fn = this.script(src.self).costMod;
      if (fn) delta += fn(this, src.self, src.host, c, p, kind);
    }
    for (const m of this.playerMods('costMod', p)) {
      if (costModMatches(this, m.value, c, kind)) delta += m.amount ?? 0;
    }
    const cost = base + delta;
    if (delta < 0) return Math.max(1, cost);
    return Math.max(0, cost);
  }

  /** Ready payment sources for player. */
  payables(p: PlayerId): CardInst[] {
    const ps = this.P(p);
    const ed = ps.eddies.map((u) => this.s.cards[u]).filter((c) => !c.spent);
    const lg = ps.legends
      .map((u) => this.s.cards[u])
      .filter((c) => !c.spent && (!c.faceUp || this.def(c).sellable));
    return [...ed, ...lg];
  }
  available(p: PlayerId): number {
    return this.payables(p).length;
  }

  /**
   * Pay amount using Eddies first, then legends that benefit from being spent, then face-down legends, etc.
   * If the paying agent opts in (`choosesPayment`) and the choice is real, it picks each source instead
   * (one 'pay' decision per €$; the first option is always what the automatic rule would pick).
   * `what` names the cost in the prompt. `order.first` / `order.last` move sources to the front or back of the automatic
   * order (a Legend paying for its own Go Solo costs nothing, so it goes first; one paying for its own ordinary play
   * enters spent, so it goes last).
   */
  async pay(p: PlayerId, amount: number, exclude: number[] = [], what = 'a cost', order: { first?: number[]; last?: number[] } = {}): Promise<boolean> {
    if (amount <= 0) return true;
    const srcs = this.payables(p).filter((c) => !exclude.includes(c.uid));
    if (srcs.length < amount) return false;
    const score = (c: CardInst) => {
      if (order.first?.includes(c.uid)) return -1;
      if (order.last?.includes(c.uid)) return 9;
      if (c.zone === 'eddies') return 0;
      if (c.gear.length) return 1; // "when spent" gear triggers
      if (!c.faceUp) return 2;
      const sc = this.script(c);
      return sc.abilities?.some((a) => a.spend) ? 4 : 3;
    };
    srcs.sort((a, b) => score(a) - score(b));
    const chosen = this.agents[p]?.choosesPayment ? await this.choosePayment(p, srcs, amount, what) : srcs.slice(0, amount);
    this.telemetry?.paid(this, p, chosen);
    for (const c of chosen) {
      c.spent = true;
      if (c.zone === 'legends') this.emit('spent', { uid: c.uid, cause: 'pay' });
    }
    return true;
  }

  /** Let the paying player pick `amount` of the (already sorted) sources, asking only while the choice is real. */
  private async choosePayment(p: PlayerId, srcs: CardInst[], amount: number, what: string): Promise<CardInst[]> {
    const pool = [...srcs];
    const out: CardInst[] = [];
    const legends = this.P(p).legends;
    for (let k = 0; k < amount; k++) {
      const left = amount - k;
      // no real choice: everything left must be spent, or only (interchangeable) Eddies are left
      if (pool.length <= left || pool.every((c) => c.zone === 'eddies')) {
        out.push(...pool.slice(0, left));
        break;
      }
      const eddies = pool.filter((c) => c.zone === 'eddies');
      const picks: CardInst[] = [];
      const options: Opt[] = [];
      for (const c of pool) {
        if (c.zone === 'eddies') {
          if (c !== eddies[0]) continue;
          options.push({ label: `an Eddie (${eddies.length} ready)`, uid: c.uid, key: 'eddie' });
        } else {
          const label = c.faceUp ? this.name(c) : `face-down Legend (slot ${legends.indexOf(c.uid) + 1})`;
          options.push({ label, uid: c.uid, key: 'legend' });
        }
        picks.push(c);
      }
      const [i] = await this.ask({ player: p, kind: 'pay', prompt: `${what}: pay €$ ${k + 1} of ${amount} — spend:`, options, min: 1, max: 1 });
      const c = picks[i];
      out.push(c);
      pool.splice(pool.indexOf(c), 1);
    }
    return out;
  }

  /** Ready up to n spent friendly Eddies. */
  readyEddies(p: PlayerId, n: number) {
    let k = 0;
    for (const u of this.P(p).eddies) {
      const c = this.s.cards[u];
      if (c.spent && k < n) {
        c.spent = false;
        k++;
      }
    }
    if (k) this.log(p, `readies ${k} Eddie${k > 1 ? 's' : ''}`);
  }

  // ------------------------------------------------------------------ zones & movement

  zoneList(p: PlayerId, z: Zone): number[] | null {
    const ps = this.P(p);
    switch (z) {
      case 'deck':
        return ps.deck;
      case 'hand':
        return ps.hand;
      case 'field':
        return ps.field;
      case 'legends':
        return ps.legends;
      case 'eddies':
        return ps.eddies;
      case 'trash':
        return ps.trash;
      case 'removed':
        return ps.removed;
      default:
        return null;
    }
  }

  private detach(uid: number) {
    const c = this.s.cards[uid];
    const list = this.zoneList(c.zone === 'field' || c.zone === 'legends' || c.zone === 'eddies' ? c.controller : c.owner, c.zone);
    if (list) {
      const i = list.indexOf(uid);
      if (i >= 0) list.splice(i, 1);
      else {
        // fall back: search both players
        for (const p of [0, 1] as PlayerId[]) {
          const l = this.zoneList(p, c.zone);
          const j = l ? l.indexOf(uid) : -1;
          if (l && j >= 0) l.splice(j, 1);
        }
      }
    }
    if (c.host !== null) {
      const h = this.s.cards[c.host];
      if (h) h.gear = h.gear.filter((g) => g !== uid);
      c.host = null;
    }
  }

  /**
   * Move a card to a zone of its owner (or controller for field). Handles Legend invalid zones and gear.
   * position: 'top' | 'bottom' for deck.
   */
  move(uid: number, to: Zone, opts: { position?: 'top' | 'bottom'; controller?: PlayerId; faceUp?: boolean } = {}) {
    const c = this.s.cards[uid];
    const from = c.zone;
    const leavingPlay = (from === 'field' || from === 'legends') && to !== from;
    const gear = leavingPlay ? [...c.gear] : [];
    this.detach(uid);
    if (leavingPlay) {
      c.gear = [];
      this.s.mods = this.s.mods.filter((m) => m.target !== uid);
    }
    let dest = to;
    // A Legend sent anywhere but the Legends area or the field is removed from the game (4.4.1); that covers a Legend
    // played to the field by paying its cost (4.5) wherever it goes. One that went solo is removed whenever it leaves
    // the field (11.29.1), even to the Legends area.
    if (this.isLegend(c) && ((to !== 'legends' && to !== 'field') || (c.goSolo && from === 'field' && to !== 'field'))) dest = 'removed';
    c.zone = dest;
    c.spent = false;
    c.lag = false;
    c.enteredTurn = this.s.turn;
    if (dest !== 'field') c.goSolo = false;
    const owner = c.owner;
    if (dest === 'field' || dest === 'eddies') c.controller = opts.controller ?? c.controller;
    else c.controller = owner;
    c.faceUp = opts.faceUp ?? (dest !== 'deck' && dest !== 'hand' && dest !== 'eddies');
    const list = this.zoneList(dest === 'field' || dest === 'eddies' ? c.controller : owner, dest)!;
    if (dest === 'deck') {
      if (opts.position === 'top') list.unshift(uid);
      else list.push(uid);
    } else list.push(uid);
    // Gear follows its Unit or Legend to the area it was sent to, unequipped (4.12, 4.12.1). A Legend sent to the trash
    // is removed from the game but its Gear stays in the trash (4.12.2); a Unit removed from the game takes its Gear along.
    for (const gu of gear) {
      const gz: Zone = to === 'field' || to === 'legends' ? 'trash' : to;
      this.move(gu, gz, { position: opts.position });
    }
    // An equipped Unit bottom-decked: the cards go to the bottom in a random order (4.12.3).
    if (gear.length && dest === 'deck' && opts.position !== 'top') {
      const group = new Set([uid, ...gear]);
      for (const p of [0, 1] as PlayerId[]) {
        const deck = this.P(p).deck;
        const mine = deck.filter((u) => group.has(u));
        if (mine.length < 2) continue;
        const rest = deck.filter((u) => !group.has(u));
        shuffleInPlace(this.s, mine);
        deck.splice(0, deck.length, ...rest, ...mine);
      }
    }
  }

  // ------------------------------------------------------------------ basic game actions

  /** Record a telemetry event (no-op unless the game was created with trace: true). */
  tr(k: import('./types').TraceKind, p: PlayerId, id?: string, x?: string | number) {
    if (this.s.trace) this.s.trace.push({ t: this.s.turn, p, k, id, x });
  }

  drawRaw(p: PlayerId): number | null {
    const ps = this.P(p);
    const uid = ps.deck.shift();
    if (uid === undefined) return null;
    const c = this.s.cards[uid];
    c.zone = 'hand';
    c.faceUp = false;
    ps.hand.push(uid);
    return uid;
  }

  async draw(p: PlayerId, n: number): Promise<number[]> {
    const got: number[] = [];
    for (let i = 0; i < n; i++) {
      const u = this.drawRaw(p);
      if (u === null) {
        this.endGame(other(p), `${this.P(p).name} had to draw from an empty deck`);
      }
      got.push(u!);
    }
    if (n > 0) this.log(p, `draws ${n}`);
    if (this.s.trace) for (const u of got) this.tr('draw', p, this.s.cards[u].defId);
    return got;
  }

  /** "Trash X": reveal top card of deck and put it in the trash. Returns uids trashed. */
  mill(p: PlayerId, n: number): number[] {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const u = this.P(p).deck[0];
      if (u === undefined) break;
      this.move(u, 'trash');
      out.push(u);
    }
    if (out.length) this.log(p, `trashes ${out.map((u) => this.name(u)).join(', ')}`);
    return out;
  }

  /** Player discards n cards of their choice from hand. Returns discarded uids. */
  async discard(p: PlayerId, n: number, filter?: (c: CardInst) => boolean, optional = false, prompt?: string): Promise<number[]> {
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
      const cands = this.P(p).hand.filter((u) => !filter || filter(this.s.cards[u]));
      if (!cands.length) break;
      const pick = await this.chooseCard(p, cands, prompt ?? `Discard a card (${i + 1}/${n})`, optional, 'discard');
      if (pick === null) break;
      this.move(pick, 'trash');
      out.push(pick);
      this.log(p, `discards ${this.name(pick)}`);
    }
    return out;
  }

  sell(p: PlayerId, uid: number) {
    this.tr('sell', p, this.s.cards[uid].defId);
    this.move(uid, 'eddies', { controller: p, faceUp: false });
    this.s.stats.sold[p]++;
    this.log(p, `sells ${this.name(uid)} for an Eddie`);
  }

  spend(uid: number, cause: EventMap['spent']['cause'] = 'effect') {
    const c = this.s.cards[uid];
    if (c.spent) return false;
    c.spent = true;
    this.emit('spent', { uid, cause });
    return true;
  }
  ready(uid: number) {
    const c = this.s.cards[uid];
    if (!c.spent) return false;
    if (this.hasMod('cantReady', uid)) return false;
    c.spent = false;
    return true;
  }

  bottomDeck(uid: number) {
    const c = this.s.cards[uid];
    this.log(c.owner, `bottom-decks ${this.name(uid)}`);
    this.move(uid, 'deck', { position: 'bottom' });
  }
  returnToHand(uid: number) {
    this.log(this.s.cards[uid].owner, `returns ${this.name(uid)} to hand`);
    this.move(uid, 'hand');
  }

  /** Put a card into play as a Unit for player p (already paid). */
  private enterField(p: PlayerId, uid: number, opts: { spent?: boolean } = {}) {
    this.move(uid, 'field', { controller: p });
    const c = this.s.cards[uid];
    c.lag = true;
    c.spent = !!opts.spent;
    c.enteredTurn = this.s.turn;
  }

  equip(gearUid: number, hostUid: number) {
    const g = this.s.cards[gearUid];
    const h = this.s.cards[hostUid];
    this.detach(gearUid);
    g.zone = h.zone;
    g.controller = h.controller;
    g.host = hostUid;
    g.faceUp = true;
    g.spent = false;
    h.gear.push(gearUid);
  }

  /** Defeat a Unit (or Legend on field / face-up legend). Returns true if it was defeated. */
  async defeat(uid: number, opts: { inFight?: boolean; by?: number | null } = {}): Promise<boolean> {
    const c = this.s.cards[uid];
    if (!c || (c.zone !== 'field' && c.zone !== 'legends')) return false;
    const inFight = !!opts.inFight;
    if (inFight && this.hasMod('noFightDefeat', uid)) {
      this.log(c.controller, `${this.name(uid)} can't be defeated in a fight`);
      return false;
    }
    // replacement effects: mandatory ones (e.g. Deadman Transmitter) before optional ones (e.g. Jackie Welles) (10.28)
    const zoneBefore = c.zone;
    const repl = this.sources(c.controller).filter((src) => this.script(src.self).replaceDefeat);
    const ordered = [...repl.filter((x) => !this.script(x.self).optionalReplacement), ...repl.filter((x) => this.script(x.self).optionalReplacement)];
    for (const src of ordered) {
      const fn = this.script(src.self).replaceDefeat!;
      if (await fn(this, src.self, src.host, c, inFight)) return false;
      if (c.zone !== zoneBefore) return false; // moved by something else
    }
    const info: DefeatInfo = {
      uid,
      defId: c.defId,
      controller: c.controller,
      owner: c.owner,
      gear: [...c.gear],
      wasEquipped: c.gear.length > 0,
      inFight,
      by: opts.by ?? null,
      power: this.power(c),
      tags: this.def(c).tags,
      goSolo: c.goSolo,
    };
    info.seq = this.noteTurnEvent({ k: 'defeat', p: c.controller, uid, defId: c.defId });
    const gearScripts = c.gear.map((g) => this.s.cards[g]);
    this.log(c.controller, `${this.name(uid)} is defeated`);
    this.move(uid, 'trash');
    this.s.stats.unitsDefeated[other(c.controller)]++;
    this.tr('defeated', c.controller, c.defId, inFight ? 'fight' : 'effect');
    const own = this.script(c).defeated;
    if (own)
      this.enqueue(info.controller, `${this.name(uid)} {Defeated}`, () => own(this, c, info), {
        source: uid,
        probe: (cg) => own(cg, cg.c(uid), structuredClone(info)),
      });
    for (const gc of gearScripts) {
      const fn = this.script(gc).defeated;
      if (fn)
        this.enqueue(info.controller, `${this.name(gc)} {Defeated}`, () => fn(this, gc, info), {
          source: gc.uid,
          probe: (cg) => fn(cg, cg.c(gc.uid), structuredClone(info)),
        });
    }
    this.emit('unitDefeated', info);
    return true;
  }

  /** Defeat a Gear (e.g. Detonate). */
  defeatGear(uid: number) {
    const g = this.s.cards[uid];
    this.log(g.controller, `${this.name(uid)} (Gear) is defeated`);
    this.move(uid, 'trash');
  }

  // ------------------------------------------------------------------ gigs

  async rollIn(p: PlayerId) {
    const ps = this.P(p);
    let opts = ps.fixer.map((id) => this.s.gigs[id]);
    if (opts.length > 1) opts = opts.filter((g) => g.sides !== 20);
    let gig: Gig;
    if (opts.length === 1) gig = opts[0];
    else {
      const i = await this.ask({
        player: p,
        kind: 'gig',
        prompt: 'Roll in a Gig from your fixer area',
        options: opts.map((g) => ({ label: `d${g.sides}`, gig: g.id })),
        min: 1,
        max: 1,
        tag: 'rollIn',
      });
      gig = opts[i[0]];
    }
    gig.value = 1 + randInt(this.s, gig.sides);
    ps.fixer = ps.fixer.filter((id) => id !== gig.id);
    gig.controller = p;
    ps.gigs.push(gig.id);
    this.log(p, `rolls in d${gig.sides}: ${gig.value}`);
    this.emit('gigRolled', { gig: gig.id, player: p, fromFixer: true });
  }

  /** Re-roll an existing gig in place (used by Kerry). */
  reroll(gid: number) {
    const g = this.s.gigs[gid];
    g.value = 1 + randInt(this.s, g.sides);
  }

  setGigValue(gid: number, value: number, by: PlayerId, kind: 'adjust' | 'set' = 'adjust'): boolean {
    const g = this.s.gigs[gid];
    if (value < 1 || value > g.sides || value === g.value) return false;
    const old = g.value;
    g.value = value;
    this.log(by, `${kind === 'set' ? 'sets' : value > old ? 'increases' : 'decreases'} ${g.controller === by ? 'friendly' : 'rival'} d${g.sides} ${old}→${value}`);
    this.emit('gigChanged', { gig: gid, by, kind });
    return true;
  }

  moveGig(gid: number, to: PlayerId) {
    const g = this.s.gigs[gid];
    if (g.controller === null) return;
    const from = this.P(g.controller);
    from.gigs = from.gigs.filter((x) => x !== gid);
    g.controller = to;
    this.P(to).gigs.push(gid);
  }

  swapGigs(friendly: number, rival: number, by: PlayerId) {
    const a = this.s.gigs[friendly];
    const b = this.s.gigs[rival];
    const pa = a.controller!;
    const pb = b.controller!;
    this.moveGig(friendly, pb);
    this.moveGig(rival, pa);
    this.log(by, `swaps d${a.sides}(${a.value}) with d${b.sides}(${b.value})`);
    this.emit('gigChanged', { gig: friendly, by, kind: 'swap' });
    this.emit('gigChanged', { gig: rival, by, kind: 'swap' });
    this.checkState();
  }

  /** Steal a specific gig as `actor` (unit uid) for player p. Fires steal triggers. */
  stealGig(actor: number, gid: number, p: PlayerId) {
    const g = this.s.gigs[gid];
    if (g.controller === p || g.controller === null) return;
    this.moveGig(gid, p);
    this.s.stats.gigsStolen[p]++;
    this.tr('steal', p, this.s.cards[actor]?.defId, g.value);
    this.log(p, `${this.name(actor)} steals d${g.sides} (${g.value})`);
    const seq = this.noteTurnEvent({ k: 'steal', p, uid: actor, defId: this.s.cards[actor]?.defId ?? '' });
    this.emit('steal', { actor, gig: gid, player: p, value: g.value, seq });
    this.checkState();
  }

  // ------------------------------------------------------------------ high-level gig helpers for scripts

  /**
   * "Increase/Decrease/Adjust a Gig by up to N" — presents every (gig, newValue) option.
   * whose: which gigs are eligible. Returns chosen gig id or null.
   */
  async adjustGig(
    p: PlayerId,
    amount: number,
    dir: 'up' | 'down' | 'either',
    whose: 'any' | 'friendly' | 'rival' = 'any',
    opts: { exact?: boolean; source?: number; optional?: boolean } = {},
  ): Promise<number | null> {
    const gigs = this.allGigs().filter(
      (g) => whose === 'any' || (whose === 'friendly' ? g.controller === p : g.controller !== p),
    );
    const options: Opt[] = [];
    for (const g of gigs) {
      for (let d = 1; d <= amount; d++) {
        if (opts.exact && d !== amount) continue;
        for (const sgn of dir === 'either' ? [1, -1] : dir === 'up' ? [1] : [-1]) {
          const v = g.value + sgn * d;
          if (v < 1 || v > g.sides) continue;
          options.push({ label: `${g.controller === p ? 'Friendly' : 'Rival'} d${g.sides}: ${g.value} → ${v}`, gig: g.id, n: v });
        }
      }
    }
    if (!options.length) return null;
    // "up to" lets you choose 0; an exact adjustment ("Adjust a Gig by 1") must change a Gig
    if (!opts.exact) options.push({ label: 'No change', key: 'none' });
    const [i] = await this.ask({
      player: p,
      kind: 'gigValue',
      prompt: `${dir === 'up' ? 'Increase' : dir === 'down' ? 'Decrease' : 'Adjust'} a Gig by ${opts.exact ? '' : 'up to '}${amount}`,
      options,
      min: 1,
      max: 1,
      source: opts.source,
      tag: 'adjust',
    });
    const o = options[i];
    if (o.key === 'none') return null;
    this.setGigValue(o.gig!, o.n!, p, 'adjust');
    return o.gig!;
  }

  /** Choose a gig (no modification). */
  async chooseGig(p: PlayerId, gigs: Gig[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
    if (!gigs.length) return null;
    const options: Opt[] = gigs.map((g) => ({ label: `${g.controller === p ? 'Friendly' : 'Rival'} d${g.sides} (${g.value})`, gig: g.id }));
    if (optional) options.push({ label: 'None', key: 'none' });
    const [i] = await this.ask({ player: p, kind: 'gig', prompt, options, min: 1, max: 1, tag, intent });
    return options[i].key === 'none' ? null : options[i].gig!;
  }

  // ------------------------------------------------------------------ choices

  async ask(d: Decision): Promise<number[]> {
    if (d.options.length === 0) return [];
    this.update();
    const rec = this.telemetry?.open(this, d);
    const r = await this.agents[d.player].decide(this, d);
    if (!Array.isArray(r) || r.some((i) => i < 0 || i >= d.options.length)) {
      throw new Error(`Agent ${this.agents[d.player].name} returned invalid choice ${JSON.stringify(r)} for ${d.prompt}`);
    }
    if (rec) this.telemetry!.close(this, d, rec, r);
    return r;
  }

  async yesNo(p: PlayerId, prompt: string, tag?: string, source?: number): Promise<boolean> {
    const [i] = await this.ask({
      player: p,
      kind: 'yesno',
      prompt,
      options: [
        { label: 'Yes', key: 'yes' },
        { label: 'No', key: 'no' },
      ],
      min: 1,
      max: 1,
      tag,
      source,
    });
    return i === 0;
  }

  async chooseUnit(
    p: PlayerId,
    cands: CardInst[],
    prompt: string,
    opts: { optional?: boolean; intent?: Intent; tag?: string; source?: number } = {},
  ): Promise<CardInst | null> {
    if (!cands.length) return null;
    const options: Opt[] = cands.map((c) => ({
      label:
        c.zone === 'legends' && !c.faceUp && !c.known
          ? `Face-down Legend (slot ${this.P(c.controller).legends.indexOf(c.uid) + 1})`
          : `${c.controller === p ? '' : 'Rival '}${this.name(c)} (${this.power(c)})${c.spent ? ' [spent]' : ''}`,
      uid: c.uid,
    }));
    if (opts.optional) options.push({ label: 'None', key: 'none' });
    const [i] = await this.ask({ player: p, kind: 'unit', prompt, options, min: 1, max: 1, intent: opts.intent, tag: opts.tag, source: opts.source });
    return options[i].key === 'none' ? null : this.s.cards[options[i].uid!];
  }

  async chooseCard(p: PlayerId, uids: number[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
    if (!uids.length) return null;
    const options: Opt[] = uids.map((u) => ({ label: this.name(u), uid: u }));
    if (optional) options.push({ label: 'None', key: 'none' });
    const [i] = await this.ask({ player: p, kind: 'card', prompt, options, min: 1, max: 1, tag, intent });
    return options[i].key === 'none' ? null : options[i].uid!;
  }

  async chooseMode(p: PlayerId, prompt: string, modes: string[], source?: number, tag?: string): Promise<number> {
    const [i] = await this.ask({
      player: p,
      kind: 'mode',
      prompt,
      options: modes.map((m, k) => ({ label: m, key: String(k) })),
      min: 1,
      max: 1,
      source,
      tag,
    });
    return i;
  }

  // ------------------------------------------------------------------ pending effects / events

  enqueue(player: PlayerId, label: string, run: () => Promise<void>, extra: { source?: number; probe?: (g: Game) => Promise<void> } = {}) {
    this.pending.push({ player, label, run, ...extra });
  }

  /**
   * Register a delayed trigger owned by `self` (e.g. a Program that says "the next time ... this turn").
   * The card's script must define delayed[event]. data is stored on mod.value.data.
   */
  addDelayed(self: CardInst, event: EventName, data: any = {}, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId) {
    return this.addMod({ kind: 'delayed', player: self.controller, source: self.uid, value: { defId: self.defId, event, data }, until, untilPlayer });
  }

  emit<K extends EventName>(name: K, ev: EventMap[K]) {
    for (const m of this.s.mods) {
      if (m.kind !== 'delayed' || m.value?.event !== name) continue;
      const fn = (SCRIPTS[m.value.defId]?.delayed as any)?.[name];
      if (!fn) continue;
      const modId = m.id;
      const resolve = async (g: Game, e: EventMap[K]) => {
        const live = g.s.mods.find((x) => x.id === modId);
        if (!live) return;
        const consumed = await fn(g, live, e);
        if (consumed) g.removeMod(modId);
      };
      const from = m.source !== undefined && this.s.cards[m.source] ? this.name(m.source) : (CARD_BY_ID[m.value.defId]?.displayName ?? m.value.defId);
      this.enqueue(m.player ?? this.s.active, `${from} (delayed): ${EVENT_TEXT[name]}`, () => resolve(this, ev), {
        source: m.source,
        probe: (cg) => resolve(cg, structuredClone(ev)),
      });
    }
    for (const src of this.sources()) {
      const fn = this.script(src.self).on?.[name] as any;
      if (fn) {
        const { self, host, controller } = src;
        const label = `${this.name(self)}${self.uid !== host.uid ? ` (on ${this.name(host)})` : ''}: ${EVENT_TEXT[name]}`;
        this.enqueue(
          controller,
          label,
          async () => {
            await fn(this, self, host, ev);
          },
          { source: self.uid, probe: async (cg) => void (await fn(cg, cg.c(self.uid), cg.c(host.uid), structuredClone(ev))) },
        );
      }
    }
  }

  /** Player currently resolving their pending effects (10.14.1); kept across nested resolvePending calls. */
  private resolving: PlayerId | null = null;

  /**
   * Resolve pending effects. The turn player resolves theirs first (10.13); once a player has started, they keep
   * resolving their own effects, including ones that become pending meanwhile, until none remain, and only then does
   * the other player resolve theirs (10.14.1). The resolving player chooses the order of their own effects (10.12):
   * an agent with `choosesOrder` is asked (see chooseNextPending); every other agent resolves them first in, first out.
   */
  async resolvePending() {
    const outer = this.resolving === null;
    let guard = 0;
    try {
      while (this.pending.length) {
        if (++guard > 500) {
          const labels = this.pending.slice(0, 5).map((x) => x.label).join(', ');
          this.pending = [];
          throw new Error(`resolvePending: more than 500 effects resolved in one pass (loop?): ${labels}`);
        }
        let cur = this.resolving;
        if (cur === null || !this.pending.some((x) => x.player === cur)) {
          cur = this.pending.some((x) => x.player === this.s.active) ? this.s.active : other(this.s.active);
          this.resolving = cur;
        }
        let idx = this.pending.findIndex((x) => x.player === cur);
        if (this.agents[cur]?.choosesOrder) idx = await this.chooseNextPending(cur, idx);
        const [pe] = this.pending.splice(idx, 1);
        await pe.run();
        this.checkState();
      }
    } finally {
      if (outer) this.resolving = null;
    }
  }

  /**
   * Rule 10.12 for an agent that opts in: which of p's pending effects resolves next. `first` is the oldest one (what
   * first-in-first-out would resolve). Asked only when the order could matter: the oldest effect would do something
   * now, and so would at least one other (effects that would do nothing are left in queue order), and they are not
   * all copies of the same effect. Option 0 is always the oldest, so answering 0 every time plays exactly like FIFO.
   */
  private async chooseNextPending(p: PlayerId, first: number): Promise<number> {
    const mine: number[] = [];
    this.pending.forEach((x, i) => x.player === p && mine.push(i));
    if (mine.length < 2) return first;
    if (!(await this.effectMatters(this.pending[first]))) return first;
    const live = [first];
    for (const i of mine) if (i !== first && (await this.effectMatters(this.pending[i]))) live.push(i);
    if (live.length < 2 || new Set(live.map((i) => this.pending[i].label)).size < 2) return first;
    const options: Opt[] = live.map((i) => {
      const pe = this.pending[i];
      return { label: pe.label, key: 'effect', uid: pe.source };
    });
    const [k] = await this.ask({ player: p, kind: 'order', prompt: 'Your effects resolve one at a time (10.12). Resolve which first?', options, min: 1, max: 1, tag: 'order' });
    if (k !== 0) this.log(p, `resolves ${this.pending[live[k]].label} first`);
    return live[k];
  }

  /**
   * Would resolving this pending effect now do anything? Runs its probe on a throwaway copy of the game (no log, no
   * trace, agents that refuse to answer): it matters if it changes the state, makes anything pending, asks a question
   * or fails. Never touches this game (its RNG included).
   */
  private async effectMatters(pe: Pending): Promise<boolean> {
    if (!pe.probe) return true;
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
    const before = JSON.stringify(st);
    const cg = new Game(st, [PROBE_AGENT, PROBE_AGENT]);
    cg.logEnabled = false;
    try {
      await pe.probe(cg);
    } catch {
      return true;
    }
    return cg.pending.length > 0 || JSON.stringify(cg.s) !== before;
  }

  // ------------------------------------------------------------------ per-turn history

  /** Record an event in this turn's history (cleared at the start of every turn). Returns its index. */
  private noteTurnEvent(e: TurnEvent): number {
    const list = (this.s.turnEvents ??= []);
    list.push(e);
    return list.length - 1;
  }

  /** Number of events of a kind this turn (optionally filtered). */
  turnCount(k: TurnEvent['k'], pred?: (e: TurnEvent) => boolean): number {
    return (this.s.turnEvents ?? []).filter((e) => e.k === k && (!pred || pred(e))).length;
  }

  /**
   * "The first time ... each turn": true if no event of this kind matching pred happened this turn before the event
   * with index `seq` (the `seq` carried by the event payload). Counts events whether or not the asking card was in play.
   */
  firstThisTurn(seq: number | undefined, k: TurnEvent['k'], pred: (e: TurnEvent) => boolean): boolean {
    const list = this.s.turnEvents ?? [];
    const end = seq ?? list.length;
    for (let i = 0; i < end && i < list.length; i++) if (list[i].k === k && pred(list[i])) return false;
    return true;
  }

  oncePerTurn(key: string): boolean {
    if (this.s.once[key] === this.s.turn) return false;
    this.s.once[key] = this.s.turn;
    return true;
  }
  usedThisTurn(key: string): boolean {
    return this.s.once[key] === this.s.turn;
  }

  // ------------------------------------------------------------------ legal actions

  canSell(p: PlayerId): boolean {
    return !this.usedThisTurn(`sell:${p}`);
  }
  canCall(p: PlayerId): boolean {
    return !this.usedThisTurn(`call:${p}`) && this.faceDownLegends(p).length > 0;
  }
  /** €$ cost of p's normal Call action: 1, unless a card makes it cheaper (Panam Palmer: Strength Through Family). */
  callCost(p: PlayerId): number {
    let cost = 1;
    for (const src of this.sources()) {
      const fn = this.script(src.self).callCost;
      const v = fn?.(this, src.self, src.host, p);
      if (v !== null && v !== undefined) cost = Math.min(cost, v);
    }
    return Math.max(0, cost);
  }

  /** Host candidates for a gear. */
  gearHosts(p: PlayerId): CardInst[] {
    const ps = this.P(p);
    const units = ps.field.map((u) => this.s.cards[u]);
    const legs = ps.legends.map((u) => this.s.cards[u]).filter((c) => c.faceUp);
    return [...units, ...legs];
  }

  canPlayCard(p: PlayerId, uid: number, free = false): boolean {
    const c = this.s.cards[uid];
    const d = this.def(c);
    const sc = this.script(c);
    if (d.type === 'Legend') return false;
    if (d.type === 'Gear' && this.gearHosts(p).length === 0) return false;
    if (sc.canPlay && !sc.canPlay(this, c, p)) return false;
    if (!free && this.playCost(uid, p) > this.available(p)) return false;
    return true;
  }

  abilityUsable(p: PlayerId, self: CardInst, host: CardInst, a: Ability, asReaction: boolean): boolean {
    if (asReaction && !a.quick) return false;
    if (host.controller !== p) return false;
    if (host.zone === 'legends' && !host.faceUp) return false;
    if (a.spend) {
      if (host.spent) return false;
      if (host.zone === 'field' && host.lag) return false;
    }
    let cost = a.eddies ?? 0;
    // if host is a ready legend in legends area and the ability spends it, it can't also pay
    const avail = this.payables(p).filter((c) => !(a.spend && c.uid === host.uid)).length;
    if (cost > avail) return false;
    if (a.discard && this.P(p).hand.length < a.discard) return false;
    if (a.can && !a.can(this, self, host)) return false;
    return true;
  }

  listAbilities(p: PlayerId, asReaction: boolean): { self: CardInst; host: CardInst; index: number; a: Ability }[] {
    const out: { self: CardInst; host: CardInst; index: number; a: Ability }[] = [];
    for (const src of this.sources(p)) {
      const abs = this.script(src.self).abilities ?? [];
      abs.forEach((a, index) => {
        if (this.abilityUsable(p, src.self, src.host, a, asReaction)) out.push({ self: src.self, host: src.host, index, a });
      });
    }
    return out;
  }

  canAttackAtAll(c: CardInst): boolean {
    if (c.zone !== 'field' || c.spent) return false;
    if (c.controller !== this.s.active) return false;
    if (this.hasMod('cantAttack', c.uid)) return false;
    for (const src of this.sources()) {
      const fn = this.script(src.self).attackBan;
      if (fn && fn(this, src.self, src.host, c, null)) return false;
    }
    return true;
  }

  /** Lag permission: what a lagging unit may attack ('any' | 'units' | 'gigs' | null). */
  lagPermission(c: CardInst): 'any' | 'units' | 'gigs' | null {
    if (!c.lag) return 'any';
    if (this.hasKw(c, 'adrenaline')) return 'any';
    if (c.goSolo) return 'any';
    const mods = this.modsFor('lagAttack', c.uid);
    if (mods.some((m) => m.value === 'any')) return 'any';
    const u = mods.some((m) => m.value === 'units');
    const gg = mods.some((m) => m.value === 'gigs');
    if (u && gg) return 'any';
    if (u) return 'units';
    if (gg) return 'gigs';
    return null;
  }

  attackTargets(c: CardInst): AttackTargetRef[] {
    if (!this.canAttackAtAll(c)) return [];
    const perm = this.lagPermission(c);
    if (perm === null) return [];
    const p = c.controller;
    const r = other(p);
    const out: AttackTargetRef[] = [];
    const allowAll = (t: AttackTargetRef) => {
      for (const src of this.sources()) {
        const fn = this.script(src.self).attackBan;
        if (fn && fn(this, src.self, src.host, c, t)) return false;
      }
      return true;
    };
    const specialAllow = (t: AttackTargetRef) => {
      for (const src of this.sources()) {
        const fn = this.script(src.self).attackAllow;
        if (fn && fn(this, src.self, src.host, c, t)) return true;
      }
      return false;
    };
    if (perm === 'any' || perm === 'units') {
      for (const u of this.units(r)) {
        const t = { unit: u.uid, gigs: null };
        const ok = u.spent || this.hasMod('attackReady', c.uid) || specialAllow(t);
        if (ok && allowAll(t)) out.push(t);
      }
    }
    if ((perm === 'any' || perm === 'gigs') && this.P(r).gigs.length > 0) {
      const t = { unit: null, gigs: r };
      if (allowAll(t)) out.push(t);
    }
    return out;
  }

  legalActions(p: PlayerId): Action[] {
    const out: Action[] = [{ type: 'pass' }];
    const ps = this.P(p);
    if (this.canSell(p)) {
      for (const u of ps.hand) if (this.def(u).sellable) out.push({ type: 'sell', uid: u });
    }
    if (this.canCall(p) && this.available(p) >= this.callCost(p)) {
      for (const c of this.faceDownLegends(p)) out.push({ type: 'call', uid: c.uid });
    }
    for (const u of ps.hand) if (this.canPlayCard(p, u)) out.push({ type: 'play', uid: u });
    // Face-up Legends with a cost: Go Solo (11.29) if they have it, and the ordinary play by paying the cost (4.5; a
    // null cost can't be played, 4.5.3). The Legend itself may help pay either (it is still in the Legends area while
    // the cost is paid; general FAQ #10 for Go Solo).
    for (const u of ps.legends) {
      const c = this.s.cards[u];
      if (!c.faceUp || this.def(c).cost === null) continue;
      if (this.hasKw(c, 'goSolo') && this.playCost(u, p, 'goSolo') <= this.available(p)) out.push({ type: 'goSolo', uid: u });
      if (this.playCost(u, p) <= this.available(p)) out.push({ type: 'playLegend', uid: u });
    }
    for (const ab of this.listAbilities(p, false)) out.push({ type: 'activate', uid: ab.self.uid, host: ab.host.uid, index: ab.index });
    let forced = false;
    for (const c of this.units(p)) {
      const ts = this.attackTargets(c);
      if (ts.length && this.hasMod('mustAttack', c.uid)) forced = true;
      for (const t of ts) out.push({ type: 'attack', uid: c.uid, targetUnit: t.unit, targetGigs: t.gigs });
    }
    // "must attack next turn if it can": you can't pass while such a Unit can still attack
    if (forced) return out.filter((x) => x.type !== 'pass');
    return out;
  }

  describeAction(a: Action | Reaction): string {
    switch (a.type) {
      case 'pass':
        return 'Pass turn';
      case 'endReact':
        return 'No (more) reactions';
      case 'sell':
        return `Sell ${this.name(a.uid)}`;
      case 'call':
        return `Call a Legend (${this.c(a.uid).known ? this.name(a.uid) : `face-down slot ${this.P(this.c(a.uid).controller).legends.indexOf(a.uid) + 1}`})`;
      case 'play':
        return `Play ${this.name(a.uid)} (${this.playCost(a.uid, this.c(a.uid).owner)} €$)`;
      case 'goSolo':
        return `Go Solo: ${this.name(a.uid)} (${this.playCost(a.uid, this.c(a.uid).controller, 'goSolo')} €$)`;
      case 'playLegend':
        return `Play ${this.name(a.uid)} to the field (${this.playCost(a.uid, this.c(a.uid).controller)} €$, with Lag)`;
      case 'activate': {
        const ab = this.script(a.uid).abilities![a.index];
        return `${this.name(a.host)}${a.host !== a.uid ? ` [${this.name(a.uid)}]` : ''}: ${ab.label}`;
      }
      case 'block':
        return `Block with ${this.name(a.uid)}`;
      case 'attack':
        return `Attack with ${this.name(a.uid)} (${this.power(a.uid)}) → ${a.targetUnit ? this.name(a.targetUnit) + ` (${this.power(a.targetUnit)})` : 'Gig area'}`;
    }
  }

  programsPlayedThisTurn(p: PlayerId): number {
    return this.turnCount('play', (e) => e.p === p && e.type === 'Program');
  }

  async chooseAction(p: PlayerId, actions: Action[]): Promise<Action> {
    if (actions.length === 1) return actions[0];
    const [i] = await this.ask({
      player: p,
      kind: 'action',
      prompt: 'Choose an action',
      options: actions.map((a) => ({ label: this.describeAction(a), action: a })),
      min: 1,
      max: 1,
    });
    return actions[i];
  }

  // ------------------------------------------------------------------ performing actions

  async doAction(p: PlayerId, a: Action) {
    switch (a.type) {
      case 'pass':
        return;
      case 'sell':
        this.s.once[`sell:${p}`] = this.s.turn;
        this.sell(p, a.uid);
        return;
      case 'call':
        if (!(await this.pay(p, this.callCost(p), [], `Call ${this.name(a.uid)}`))) return;
        await this.callLegend(p, a.uid);
        return;
      case 'play':
        await this.playFromHand(p, a.uid);
        return;
      case 'goSolo':
        await this.goSolo(p, a.uid);
        return;
      case 'playLegend':
        await this.playLegend(p, a.uid);
        return;
      case 'activate':
        await this.activate(p, a.uid, a.host, a.index);
        return;
      case 'attack':
        await this.attack(p, a.uid, { unit: a.targetUnit, gigs: a.targetGigs });
        return;
    }
  }

  /** Call a Legend (flip face-up). Respects once-per-turn. free = effect-granted. */
  async callLegend(p: PlayerId, uid?: number, opts: { free?: boolean; filter?: (c: CardInst) => boolean } = {}): Promise<boolean> {
    if (!this.canCall(p)) return false;
    let target: number | null | undefined = uid;
    if (target === undefined) {
      const cands = this.faceDownLegends(p).filter((c) => !opts.filter || opts.filter(c));
      const pick = await this.chooseUnit(p, cands, 'Call which Legend?', { optional: true, tag: 'call' });
      if (!pick) return false;
      target = pick.uid;
    }
    const c = this.s.cards[target];
    if (c.faceUp) return false;
    this.s.once[`call:${p}`] = this.s.turn;
    c.faceUp = true;
    this.s.stats.calls[p]++;
    this.tr('call', p, c.defId, opts.free ? 'free' : this.s.phase === 'main' && this.s.active === p ? 'main' : 'react');
    this.log(p, `calls ${this.name(c)}${opts.free ? ' (free)' : ''}`);
    const fn = this.script(c).call;
    if (fn) this.enqueue(p, `${this.name(c)} {Call}`, () => fn(this, c), { source: c.uid, probe: (cg) => fn(cg, cg.c(c.uid)) });
    this.emit('legendCalled', { uid: c.uid, player: p });
    return true;
  }

  async playFromHand(p: PlayerId, uid: number) {
    const cost = this.playCost(uid, p);
    if (!(await this.pay(p, cost, [], `Play ${this.name(uid)}`))) return;
    await this.resolvePlay(p, uid, 'hand');
  }

  /** Play a card for free (or already paid) from any zone. */
  async playFree(p: PlayerId, uid: number, from: Zone, opts: { bottomDeckAfter?: boolean; hostFilter?: (c: CardInst) => boolean } = {}) {
    if (!this.canPlayCard(p, uid, true)) return false;
    this.log(p, `plays ${this.name(uid)} for free from ${from}`);
    await this.resolvePlay(p, uid, from, opts);
    return true;
  }

  private async resolvePlay(p: PlayerId, uid: number, from: Zone, opts: { bottomDeckAfter?: boolean; hostFilter?: (c: CardInst) => boolean } = {}) {
    const c = this.s.cards[uid];
    const d = this.def(c);
    const sc = this.script(c);
    this.s.stats.cardsPlayed[p]++;
    this.tr('play', p, c.defId, from);
    if (from === 'hand') this.log(p, `plays ${d.displayName}`);
    const seq = this.noteTurnEvent({ k: 'play', p, uid, defId: c.defId, type: d.type });
    if (d.type === 'Unit') {
      this.enterField(p, uid);
      this.emit('cardPlayed', { uid, player: p, type: 'Unit', seq });
      if (sc.play) this.enqueue(p, `${d.displayName} {Play}`, () => sc.play!(this, c), { source: uid, probe: (cg) => sc.play!(cg, cg.c(uid)) });
    } else if (d.type === 'Gear') {
      const hosts = this.gearHosts(p).filter((h) => !opts.hostFilter || opts.hostFilter(h));
      const host = await this.chooseUnit(p, hosts, `Equip ${d.displayName} to?`, { intent: 'help', tag: 'equip', source: uid });
      if (!host) {
        this.move(uid, 'trash');
        return;
      }
      this.equip(uid, host.uid);
      this.log(p, `equips ${d.displayName} to ${this.name(host)}`);
      this.emit('cardPlayed', { uid, player: p, type: 'Gear', seq });
      if (sc.play) this.enqueue(p, `${d.displayName} (equipped)`, () => sc.play!(this, c), { source: uid, probe: (cg) => sc.play!(cg, cg.c(uid)) });
    } else if (d.type === 'Program') {
      this.detach(uid);
      c.zone = 'limbo';
      c.controller = p;
      this.emit('cardPlayed', { uid, player: p, type: 'Program', seq });
      if (sc.play) await sc.play(this, c);
      if (c.zone === 'limbo') {
        if (opts.bottomDeckAfter) this.move(uid, 'deck', { position: 'bottom' });
        else this.move(uid, 'trash');
      }
    }
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
  async goSolo(p: PlayerId, uid: number) {
    const cost = this.playCost(uid, p, 'goSolo');
    if (!(await this.pay(p, cost, [], `${this.name(uid)} goes solo`, { first: [uid] }))) return;
    this.legendToField(p, uid, 'goSolo');
  }

  /**
   * Play a face-up Legend from the Legends area to the field as a Unit by paying its cost, without Go Solo (4.5). It
   * enters in the orientation it had when it left the Legends area (4.5.1: spent if it helped pay its own cost, so
   * automatic payment spends it last) and with Lag (4.5.2). It is not a Go Solo Unit, so it gets no permission to attack
   * this turn; if it later goes anywhere but the Legends area or field it is removed from the game (4.4.1, see move()).
   */
  async playLegend(p: PlayerId, uid: number) {
    const cost = this.playCost(uid, p);
    if (!(await this.pay(p, cost, [], `Play ${this.name(uid)}`, { last: [uid] }))) return;
    this.legendToField(p, uid, 'legend');
  }

  /** Move a (paid-for) Legend from the Legends area to the field, keeping its Gear and effects, and fire its play. */
  private legendToField(p: PlayerId, uid: number, via: LegendPlay) {
    const c = this.s.cards[uid];
    const gear = [...c.gear];
    this.detach(uid);
    c.zone = 'field';
    c.controller = p;
    if (via === 'goSolo') c.spent = false; // "as a ready Unit"; the ordinary play keeps c.spent as it was (4.5.1)
    c.lag = true;
    c.goSolo = via === 'goSolo';
    c.enteredTurn = this.s.turn;
    this.P(p).field.push(uid);
    for (const g of gear) this.s.cards[g].zone = 'field';
    c.gear = gear;
    this.s.stats.cardsPlayed[p]++;
    this.tr(via === 'goSolo' ? 'solo' : 'legend', p, c.defId);
    this.log(p, via === 'goSolo' ? `${this.name(c)} goes solo!` : `plays ${this.name(c)} to the field${c.spent ? ' (spent)' : ''}`);
    const seq = this.noteTurnEvent({ k: 'play', p, uid, defId: c.defId, type: 'Unit', via });
    this.emit('cardPlayed', { uid, player: p, type: 'Unit', seq, via });
    const fn = this.script(c).play;
    if (fn) this.enqueue(p, `${this.name(c)} {Play}`, () => fn(this, c), { source: uid, probe: (cg) => fn(cg, cg.c(uid)) });
  }

  async activate(p: PlayerId, selfUid: number, hostUid: number, index: number, asReaction = false) {
    const self = this.s.cards[selfUid];
    const host = this.s.cards[hostUid];
    const a = this.script(self).abilities![index];
    if (!this.abilityUsable(p, self, host, a, asReaction)) return;
    // pay costs in order: eddies, spend, discard
    if (a.eddies && !(await this.pay(p, a.eddies, a.spend ? [host.uid] : [], `${this.name(host)}: ${a.label}`))) return;
    if (a.spend) {
      host.spent = true;
      this.emit('spent', { uid: host.uid, cause: 'ability' });
    }
    const discarded = a.discard ? await this.discard(p, a.discard) : [];
    this.log(p, `activates ${this.name(host)}: ${a.label}`);
    this.tr('activate', p, self.defId, index);
    await a.run(this, self, host, { discarded });
  }

  // ------------------------------------------------------------------ attack

  async attack(p: PlayerId, uid: number, target: AttackTargetRef) {
    const s = this.s;
    const att = s.cards[uid];
    const r = other(p);
    s.attack = { attacker: uid, attackerPlayer: p, targetUnit: target.unit, targetGigs: target.gigs, step: 'declare', ended: false };
    s.stats.attacks[p]++;
    this.tr('attack', p, att.defId, target.unit ? 'unit' : 'gigs');
    this.telemetry?.attackStart(this);
    att.spent = true;
    // mustAttack mods are satisfied; one-shot attack permissions are used up
    s.mods = s.mods.filter((m) => !((m.kind === 'mustAttack' || (m.kind === 'attackReady' && m.value === 'once')) && m.target === uid));
    this.log(p, `${this.name(att)} (${this.power(att)}) attacks ${target.unit ? this.name(target.unit) : 'the rival Gig area'}`);
    this.emit('spent', { uid, cause: 'attack' });
    // {Attack} triggers (unit and its gear)
    const atkFn = this.script(att).attack;
    if (atkFn) this.enqueue(p, `${this.name(att)} {Attack}`, () => atkFn(this, att, att), { source: uid, probe: (cg) => atkFn(cg, cg.c(uid), cg.c(uid)) });
    for (const gu of att.gear) {
      const g = s.cards[gu];
      const fn = this.script(g).attack;
      if (fn) this.enqueue(p, `${this.name(g)} (on ${this.name(att)}) {Attack}`, () => fn(this, g, att), { source: gu, probe: (cg) => fn(cg, cg.c(gu), cg.c(uid)) });
    }
    const seq = this.noteTurnEvent({ k: 'attack', p, uid, defId: att.defId });
    this.emit('attack', { attacker: uid, targetUnit: target.unit, targetGigs: target.gigs, seq });
    await this.resolvePending();
    await this.attackRest(uid);
  }

  /**
   * The rest of an attack after its {Attack} triggers: the rival's reaction window, then the fight or the steal,
   * then cleanup. Split out so a lookahead clone taken during a reaction can resume the attack.
   */
  async attackRest(uid: number, reactionsClosed = false) {
    const s = this.s;
    if (!s.attack) return;
    const att = s.cards[uid];
    const r = other(s.attack.attackerPlayer);
    let end: 'fizzled' | 'fight' | 'steal' = 'fizzled';
    try {
      if (!this.attackValid()) return;
      // ---- React step
      s.attack.step = 'react';
      let guard = reactionsClosed ? 30 : 0;
      while (guard++ < 30) {
        if (!this.attackValid()) return;
        const reacts = this.legalReactions(r);
        if (reacts.length <= 1) break;
        const [i] = await this.ask({
          player: r,
          kind: 'reaction',
          prompt: `${this.name(att)} (${this.power(att)}) is attacking ${s.attack.targetUnit ? this.name(s.attack.targetUnit) : 'your Gig area'} — react?`,
          options: reacts.map((x) => ({ label: this.describeAction(x), action: x })),
          min: 1,
          max: 1,
        });
        const rx = reacts[i];
        if (rx.type === 'endReact') break;
        await this.doReaction(r, rx);
        await this.resolvePending();
        this.update();
      }
      if (!this.attackValid()) return;
      if (s.attack.targetUnit !== null) {
        s.attack.step = 'fight';
        end = 'fight';
        await this.fight(uid, s.attack.targetUnit);
      } else {
        s.attack.step = 'steal';
        end = 'steal';
        await this.steal(uid, s.attack.targetGigs!);
      }
      await this.resolvePending();
    } finally {
      this.telemetry?.attackEnd(this, end);
      if (s.attack) s.attack.step = 'done';
      s.attack = null;
      s.mods = s.mods.filter((m) => m.until !== 'attackEnd');
    }
  }

  attackValid(): boolean {
    const a = this.s.attack;
    if (!a || a.ended) return false;
    const att = this.s.cards[a.attacker];
    if (att.zone !== 'field' || att.controller !== a.attackerPlayer) return false;
    if (a.targetUnit !== null) {
      const t = this.s.cards[a.targetUnit];
      if (t.zone !== 'field' || t.controller === a.attackerPlayer) return false;
    }
    // The attack ends if its target stops being a valid target for the attacker (9.21.3): an attack restriction that
    // now forbids this target. (Readiness is not re-checked: a Blocker is ready-then-spent by design, and one-shot
    // "may attack ready Units" permissions are used up when the attack is declared.)
    const t: AttackTargetRef = { unit: a.targetUnit, gigs: a.targetUnit === null ? a.targetGigs : null };
    for (const src of this.sources()) {
      const fn = this.script(src.self).attackBan;
      if (fn && fn(this, src.self, src.host, att, t)) return false;
    }
    return true;
  }

  legalReactions(p: PlayerId): Reaction[] {
    const out: Reaction[] = [{ type: 'endReact' }];
    const a = this.s.attack!;
    if (this.canCall(p) && this.available(p) >= this.callCost(p)) for (const c of this.faceDownLegends(p)) out.push({ type: 'call', uid: c.uid });
    const att = this.s.cards[a.attacker];
    const unblockable = this.sources().some((src) => this.script(src.self).unblockable?.(this, src.self, src.host, att));
    if (!unblockable) {
      for (const c of this.units(p)) {
        if (!c.spent && c.uid !== a.targetUnit && this.hasKw(c, 'blocker')) out.push({ type: 'block', uid: c.uid });
      }
    }
    for (const u of this.P(p).hand) {
      const d = this.def(u);
      if (d.type === 'Program' && d.keywords.includes('quick') && this.canPlayCard(p, u)) out.push({ type: 'play', uid: u });
    }
    for (const ab of this.listAbilities(p, true)) out.push({ type: 'activate', uid: ab.self.uid, host: ab.host.uid, index: ab.index });
    return out;
  }

  async doReaction(p: PlayerId, rx: Reaction) {
    const a = this.s.attack!;
    switch (rx.type) {
      case 'call':
        if (await this.pay(p, this.callCost(p), [], `Call ${this.name(rx.uid)}`)) await this.callLegend(p, rx.uid);
        return;
      case 'block': {
        const c = this.s.cards[rx.uid];
        c.spent = true;
        a.targetUnit = rx.uid;
        a.targetGigs = null;
        this.log(p, `${this.name(c)} blocks!`);
        this.emit('spent', { uid: rx.uid, cause: 'block' });
        this.emit('blockerUsed', { uid: rx.uid });
        return;
      }
      case 'play':
        await this.playFromHand(p, rx.uid);
        return;
      case 'activate':
        await this.activate(p, rx.uid, rx.host, rx.index, true);
        return;
    }
  }

  fightOutcome(aUid: number, bUid: number): { a: 'win' | 'lose'; b: 'win' | 'lose' } {
    const A = this.s.cards[aUid];
    const B = this.s.cards[bUid];
    const pa = this.power(A);
    const pb = this.power(B);
    let a: 'win' | 'lose' = pa > pb ? 'win' : 'lose';
    let b: 'win' | 'lose' = pb > pa ? 'win' : 'lose';
    for (const src of this.sources()) {
      const fn = this.script(src.self).fightOverride;
      if (!fn) continue;
      if (src.host.uid === aUid) {
        const o = fn(this, src.self, src.host, B);
        if (o) {
          a = o;
          b = o === 'win' ? 'lose' : b;
        }
      }
      if (src.host.uid === bUid) {
        const o = fn(this, src.self, src.host, A);
        if (o) {
          b = o;
          a = o === 'win' ? 'lose' : a;
        }
      }
    }
    return { a, b };
  }

  async fight(aUid: number, bUid: number) {
    const A = this.s.cards[aUid];
    const B = this.s.cards[bUid];
    const pa = this.power(A);
    const pb = this.power(B);
    const res = this.fightOutcome(aUid, bUid);
    this.log(A.controller, `fight: ${this.name(A)} (${pa}) vs ${this.name(B)} (${pb})`);
    this.emit('fight', { uid: aUid, opp: bUid, result: res.a, power: pa, oppPower: pb });
    this.emit('fight', { uid: bUid, opp: aUid, result: res.b, power: pb, oppPower: pa });
    // defeat losers (power 0 can't defeat). "noDefeatOpp" (Reboot Optics) is used up by the next fight of a Unit it
    // covers, and that Unit doesn't defeat its opponent.
    const noDefA = this.consumeNoDefeat(aUid);
    const noDefB = this.consumeNoDefeat(bUid);
    const toDefeat: [number, number][] = [];
    for (const [loser, lost, by, byPower, spared] of [
      [aUid, res.a, bUid, pb, noDefB],
      [bUid, res.b, aUid, pa, noDefA],
    ] as const) {
      if (lost !== 'lose' || byPower <= 0) continue;
      if (spared) this.log(this.s.cards[by].controller, `${this.name(by)} doesn't defeat its opponent`);
      else toDefeat.push([loser, by]);
    }
    for (const [loser, by] of toDefeat) await this.defeat(loser, { inFight: true, by });
  }

  /** Does a 'noDefeatOpp' effect cover this Unit (a mod on the Unit, or a player-wide mod for its controller)? */
  noDefeatOppMod(uid: number): Mod | undefined {
    const c = this.s.cards[uid];
    return this.s.mods.find((x) => x.kind === 'noDefeatOpp' && (x.target === uid || (x.target === undefined && x.player === c.controller)));
  }

  /** Use up a 'noDefeatOpp' effect covering this fighting Unit. */
  private consumeNoDefeat(uid: number): boolean {
    const m = this.noDefeatOppMod(uid);
    if (!m) return false;
    this.removeMod(m.id);
    return true;
  }

  stealCount(att: CardInst): number {
    const pw = this.power(att);
    if (pw <= 0) return 0;
    return Math.max(0, Math.floor(pw / 10) + 1 + this.stealModifier(att));
  }

  /** Effects that change how many Gigs the actor steals ("steals 1 fewer Gig"). Applied to every steal (11.5.1.3). */
  stealModifier(att: CardInst): number {
    let n = 0;
    for (const src of this.sources()) {
      const fn = this.script(src.self).stealMod;
      if (fn) n += fn(this, src.self, src.host, att);
    }
    for (const m of this.modsFor('stealMod', att.uid)) n += m.amount ?? 0;
    return n;
  }

  /**
   * Gigs of player `from` that the actor may select to steal, after every effect that restricts its ability to steal
   * (11.5.1.3): player-level 'stealBan' mods (Chrome Fang, Westbrook Netrunner) and scripts' stealBan hooks. Used by
   * attack steals and effect steals alike.
   */
  stealableGigs(att: CardInst, from: PlayerId): Gig[] {
    const pw = this.power(att);
    return this.gigsOf(from).filter((g) => {
      // value {cmp:'gt'|'lt', legendsOnly?}: the actor can't steal Gigs with value higher / lower than its power
      for (const m of this.playerMods('stealBan', from)) {
        const v = m.value ?? {};
        if (v.legendsOnly && !this.isLegend(att)) continue;
        if (v.cmp === 'gt' && g.value > pw) return false;
        if (v.cmp === 'lt' && g.value < pw) return false;
      }
      for (const src of this.sources()) {
        const fn = this.script(src.self).stealBan;
        if (fn && fn(this, src.self, src.host, att, g)) return false;
      }
      return true;
    });
  }

  /** Rival effects that stop a selected Gig from being stolen ("would be stolen", 11.5.1.5). */
  private async stealPrevented(att: CardInst, from: PlayerId, gid: number): Promise<boolean> {
    for (const src of this.sources(from)) {
      const fn = this.script(src.self).preventSteal;
      if (fn && (await fn(this, src.self, src.host, att, this.s.gigs[gid]))) return true;
    }
    return false;
  }

  async steal(attUid: number, from: PlayerId) {
    const att = this.s.cards[attUid];
    const p = att.controller;
    const n = this.stealCount(att);
    const chosen: number[] = [];
    for (let i = 0; i < n; i++) {
      const cands = this.stealableGigs(att, from).filter((g) => !chosen.includes(g.id));
      if (!cands.length) break;
      const gid = await this.chooseGig(p, cands, `Steal a Gig (${i + 1}/${n})`, false, 'steal');
      if (gid === null) break;
      chosen.push(gid);
    }
    // prevention (rival's effects)
    const final: number[] = [];
    for (const gid of chosen) if (!(await this.stealPrevented(att, from, gid))) final.push(gid);
    for (const gid of final) this.stealGig(attUid, gid, p);
    if (!final.length) this.log(p, `${this.name(att)} steals nothing`);
  }

  /**
   * Effect-driven steal: actor steals one rival Gig chosen by p (e.g. Gorilla Arms, Appetite). The same restrictions
   * and steal-count modifiers as an attack steal apply (11.5.1.3), so "steals 1 fewer Gig" cancels it.
   */
  async stealOne(p: PlayerId, actor: number, filter?: (g: Gig) => boolean) {
    const att = this.s.cards[actor];
    const from = other(p);
    const n = 1 + this.stealModifier(att);
    if (n <= 0) {
      this.log(p, `${this.name(att)} steals nothing`);
      return;
    }
    const chosen: number[] = [];
    for (let i = 0; i < n; i++) {
      const cands = this.stealableGigs(att, from).filter((g) => !chosen.includes(g.id) && (!filter || filter(g)));
      if (!cands.length) break;
      const gid = await this.chooseGig(p, cands, n > 1 ? `Steal a rival Gig (${i + 1}/${n})` : 'Steal a rival Gig', false, 'steal');
      if (gid === null) break;
      chosen.push(gid);
    }
    const final: number[] = [];
    for (const gid of chosen) if (!(await this.stealPrevented(att, from, gid))) final.push(gid);
    for (const gid of final) this.stealGig(actor, gid, p);
  }
}

/**
 * Player-level 'costMod' mods store a plain-data filter (so game state stays cloneable):
 * { kind?: 'play'|'goSolo', uid?: number, type?: CardType, tag?: string, color?: Color }
 */
export function costModMatches(g: Game, v: any, c: CardInst, kind: 'play' | 'goSolo'): boolean {
  if (!v) return kind === 'play';
  if (v.kind && v.kind !== kind) return false;
  if (!v.kind && kind !== 'play') return false;
  if (v.uid !== undefined && v.uid !== c.uid) return false;
  if (v.type && g.def(c).type !== v.type) return false;
  if (v.tag && !g.isTag(c, v.tag)) return false;
  if (v.color && g.def(c).color !== v.color) return false;
  return true;
}

function mkInst(uid: number, defId: string, owner: PlayerId, zone: Zone): CardInst {
  return { uid, defId, owner, controller: owner, zone, spent: false, faceUp: zone === 'legends' ? false : false, lag: false, gear: [], host: null, enteredTurn: 0, goSolo: false };
}

export { nextRandom };

