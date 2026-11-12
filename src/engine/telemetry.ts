// Decision telemetry (docs/DECISION_TELEMETRY.md, ROADMAP §5 Method step 1): an opt-in, observe-only record of every
// decision an agent is asked to make in one game — the window it was asked in, the legal options, the option chosen,
// any €$ the decision paid and the sources spent, compact PUBLIC board/economy features at that moment, and for
// attacks the outcome.
//
// How it hooks in: a `DecisionRecorder` is set on one Game instance (`g.telemetry = new DecisionRecorder()`), not on
// its state. The engine calls it from `ask()`, `pay()`, the attack steps and the end of each main phase (`turnEnd`, used
// only by the optional board snapshots), behind a single `if` each. Lookahead
// clones and effect probes are new Game objects built from the state alone, so they never carry a recorder and can
// never write records. The recorder only reads the game: it draws no random numbers, asks no agent and changes no
// state, so a game plays out identically with telemetry on or off (tests/decision-telemetry.test.ts).
//
// Hidden information: a record is written from the acting player's point of view. A card id appears only when that
// player can see the card (the same split `hideInfo` in src/ai/heuristic.ts re-deals for the bots): the rival's hand,
// either deck, and face-down Legends the player hasn't looked at are written as `?`. A Legend chosen with a Call is
// face-up right after, so its id is added afterwards in `res.revealed`, never among the options.
import type { CardInst, CardType, Decision, DecisionKind, Opt, PlayerId } from './types';
import type { Game } from './engine';

/** Bump when a field changes meaning or is removed; adding an optional field keeps the version. */
export const DECISION_TELEMETRY_SCHEMA = 1;

/** At most this many distinct option codes are kept per record (`more` counts the rest). */
export const MAX_OPTION_CODES = 40;

/**
 * Where the decision was asked:
 *   main      the active player's main-phase action (pass, sell, play, call, Go Solo, ordinary Legend play, ability, attack)
 *   react     the defender's reaction window during an attack (no more reactions, Call, Block, a Quick Program, a quick ability)
 *   mulligan  the opening-hand question
 *   pay       which source pays one €$ (asked only of agents with `choosesPayment`; bots never are)
 *   order     which of the player's own pending effects resolves next (only agents with `choosesOrder`; bots never are)
 *   effect    a choice inside an effect or cost: yes/no, a target Unit or card, a mode, a Gig, a Gig value, ...
 * The engine has no separate "response to a Quick" window: Quick Programs are played as reactions in the attack window.
 */
export type DecisionWindow = 'main' | 'react' | 'mulligan' | 'pay' | 'order' | 'effect';

/** One side's public board and economy at the moment of a decision. */
export interface SideFeatures {
  /** Gigs controlled */
  gigs: number;
  /** Street Cred (sum of controlled Gig values; 0 with no Gigs) */
  cred: number;
  /** Units on the field (Legends on the field included) */
  units: number;
  /** total power of those Units */
  power: number;
  /** of those Units, how many are ready (not spent) */
  ready: number;
  /** ready Eddies / all Eddies */
  eddies: number;
  eddiesTotal: number;
  /** ready payment sources (ready Eddies plus Legends that can pay): the €$ that could be paid right now */
  payable: number;
  hand: number;
  deck: number;
  /** face-up Legends (in the Legends area or on the field) */
  legendsUp: number;
}

export interface DecisionFeatures {
  /** the acting player's side */
  me: SideFeatures;
  /** the rival's side */
  op: SideFeatures;
  /** me.gigs - op.gigs: > 0 ahead, 0 even, < 0 behind */
  lead: number;
  /** the acting player is the turn player */
  active: boolean;
}

/** €$ paid because of a decision, and what paid it. */
export interface PaymentRecord {
  /** €$ paid in total */
  amount: number;
  eddies: number;
  /** face-down Legends spent (their identity is hidden, so only the count) */
  faceDown: number;
  /** face-up Legends spent, by card id (a Legend paying toward its own Go Solo or ordinary play shows up here) */
  legends: string[];
}

/** How an attack ended. `stolen` counts Gigs that moved to the attacker during it. */
export interface AttackOutcome {
  /** 'fizzled': the attack ended before its fight or steal (its attacker or target left, or the target became invalid) */
  end: 'fizzled' | 'fight' | 'steal';
  /** the attack's target changed to a Blocker */
  blocked: boolean;
  stolen: number;
  /** the attacker is no longer on the field afterwards (defeated, or sent elsewhere) */
  attackerGone: boolean;
  /** the attacked (or blocking) Unit is no longer on the field afterwards; false when the Gig area was attacked */
  targetGone: boolean;
}

export interface AttackRef {
  /** the attack's index in this game (0, 1, 2, ...): groups the reaction decisions of one attack */
  n: number;
  attacker: string;
  /** 'gigs', or the attacked Unit's card id */
  target: string;
}

export interface DecisionRecord {
  /** index of this decision in the game, from 0: the same code and seed give the same index for the same decision */
  i: number;
  /** global turn (0 during the mulligan) */
  t: number;
  /** acting player */
  p: PlayerId;
  /** the engine's decision kind and tag */
  kind: DecisionKind;
  tag?: string;
  w: DecisionWindow;
  /** the card asking, when the engine names one and the acting player can see it */
  src?: string;
  /** distinct option codes in first-listed order (see encodeOption), at most MAX_OPTION_CODES */
  o: string[];
  /** distinct codes left out of `o` by the cap */
  more?: number;
  /** number of options offered (with repeats: three copies of a card in hand are three options) */
  n: number;
  /** chosen option indices (into the full option list; 0 = the first-listed option, the engine's default) */
  c: number[];
  /** the chosen options' codes */
  ch: string[];
  f: DecisionFeatures;
  /** the attack in progress (reaction windows and choices made during an attack), or declared by this main-phase choice */
  atk?: AttackRef;
  /** €$ this decision paid (playing, calling, activating, or "pay to ..." effects) */
  pay?: PaymentRecord;
  /** filled in afterwards: what the chosen Call revealed, and how the attack this decision belongs to ended */
  res?: { revealed?: string; attack?: AttackOutcome };
}

/**
 * Optional (recorder option `boards`): one player's own view of their board at one moment, for the synergy observer
 * (src/analysis/synergies.ts). Only public cards and counts: their field, equipped Gear, face-up Legends, Gigs, trash
 * counts, and the rival's public counts. A snapshot is taken for both players before every decision and at the end of
 * every main phase, and kept only when it differs from that player's previous one in the same turn.
 */
export interface BoardSnapshot {
  /** global turn */
  t: number;
  /** whose view */
  p: PlayerId;
  /** taken before decision `at` (its index), or 'end' at the end of a main phase or of the game */
  at: number | 'end';
  /** friendly Units on the field (Legends there included), by card id */
  units: string[];
  /** Gear equipped to friendly Units and face-up Legends, by card id */
  gear: string[];
  /** friendly Units and Legends with Gear equipped */
  equipped: number;
  /** face-up Legends still in the Legends area (Legends on the field are in `units`) */
  legends: string[];
  /** all face-up friendly Legends (Legends area and field) */
  legendsUp: number;
  /** friendly Gigs as [sides, value] */
  gigs: [number, number][];
  /** Street Cred, null when Null (no Gigs) */
  cred: number | null;
  opCred: number | null;
  opGigs: number;
  opUnits: number;
  /** the player's trash by card type */
  trash: Partial<Record<CardType, number>>;
}

/**
 * Optional (recorder option `boards`): the first time one of a player's own main-deck cards was seen in their hand or in
 * play (field, equipped, resolving), by global turn. Only turns 1 and later count, so a hand shuffled away by a
 * mulligan is not counted. Written for the card's owner, who can see their own hand.
 */
export interface CardSighting {
  p: PlayerId;
  t: number;
  id: string;
}

/** A card the acting player can see: public zones, their own hand / deck / Eddies, and their face-up or known Legends. */
function visibleId(g: Game, uid: number | undefined, viewer: PlayerId): string | null {
  if (uid === undefined) return null;
  const c: CardInst | undefined = g.s.cards[uid];
  if (!c) return null;
  switch (c.zone) {
    case 'field':
    case 'trash':
    case 'removed':
    case 'limbo':
      return c.defId;
    case 'legends':
      return c.faceUp || (c.controller === viewer && c.known) ? c.defId : null;
    default:
      // hand, deck, eddies
      return c.owner === viewer ? c.defId : null;
  }
}

/**
 * Compact code for one option, from the acting player's point of view:
 *   main / react  pass | endReact | sell:ID | play:ID | call:ID | solo:ID | legend:ID | ability:ID#k | attack:ID>gigs |
 *                 attack:ID>TARGET | block:ID   (a face-down Legend's call is call:? unless the player knows it)
 *   other kinds   yes | no | none | mode:k | card:ID | unit:ID | gig:WHERE:d8=5 | effect:ID (pending order) |
 *                 pay:eddie | pay:fd | pay:ID | n:K | key:K | #k
 * A card the player cannot see is written `?`. A Gig's WHERE is own / rival (in a Gig area) or fixer / rivalFixer (still in
 * a fixer area, e.g. when rolling one in); its value is the option's new value for a Gig-value choice.
 */
function encodeOption(g: Game, d: Decision, o: Opt, k: number): string {
  const p = d.player;
  const id = (uid: number | undefined) => visibleId(g, uid, p) ?? '?';
  const a = o.action;
  if (a) {
    switch (a.type) {
      case 'pass':
      case 'endReact':
        return a.type;
      case 'sell':
      case 'play':
      case 'call':
      case 'block':
        return `${a.type}:${id(a.uid)}`;
      case 'goSolo':
        return `solo:${id(a.uid)}`;
      case 'playLegend':
        return `legend:${id(a.uid)}`;
      case 'activate':
        return `ability:${id(a.uid)}#${a.index}`;
      case 'attack':
        return `attack:${id(a.uid)}>${a.targetUnit !== null ? id(a.targetUnit) : 'gigs'}`;
    }
  }
  if (d.kind === 'pay') {
    if (o.key === 'eddie') return 'pay:eddie';
    const v = visibleId(g, o.uid, p);
    return v ? `pay:${v}` : 'pay:fd';
  }
  if (d.kind === 'order') return `effect:${id(o.uid)}`;
  if (o.key === 'yes' || o.key === 'no' || o.key === 'none') return o.key;
  if (d.kind === 'mode') return `mode:${o.key ?? k}`;
  if (o.gig !== undefined) {
    const gg = g.s.gigs[o.gig];
    if (!gg) return `gig:${o.gig}`;
    const where = gg.controller === null ? (gg.owner === p ? 'fixer' : 'rivalFixer') : gg.controller === p ? 'own' : 'rival';
    return `gig:${where}:d${gg.sides}=${o.n ?? gg.value}`;
  }
  if (o.uid !== undefined) return `${d.kind === 'unit' ? 'unit' : 'card'}:${id(o.uid)}`;
  if (o.n !== undefined) return `n:${o.n}`;
  if (o.key !== undefined) return `key:${o.key}`;
  return `#${k}`;
}

/** Split an option code into its kind, card id (if any) and target. */
export function parseOption(code: string): { kind: string; id?: string; target?: string } {
  const c = code.indexOf(':');
  if (c < 0) return { kind: code };
  const kind = code.slice(0, c);
  let rest = code.slice(c + 1);
  let target: string | undefined;
  const gt = rest.indexOf('>');
  if (gt >= 0) {
    target = rest.slice(gt + 1);
    rest = rest.slice(0, gt);
  }
  const hash = rest.indexOf('#');
  if (kind === 'ability' && hash >= 0) rest = rest.slice(0, hash);
  return { kind, id: rest, target };
}

function windowOf(d: Decision): DecisionWindow {
  if (d.kind === 'action') return 'main';
  if (d.kind === 'reaction') return 'react';
  if (d.kind === 'pay') return 'pay';
  if (d.kind === 'order') return 'order';
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 'mulligan';
  return 'effect';
}

function side(g: Game, p: PlayerId): SideFeatures {
  const ps = g.P(p);
  let power = 0;
  let ready = 0;
  const units = g.units(p);
  for (const u of units) {
    power += g.power(u);
    if (!u.spent) ready++;
  }
  let eddies = 0;
  for (const u of ps.eddies) if (!g.s.cards[u].spent) eddies++;
  return {
    gigs: ps.gigs.length,
    cred: g.streetCred(p) ?? 0,
    units: units.length,
    power,
    ready,
    eddies,
    eddiesTotal: ps.eddies.length,
    payable: g.available(p),
    hand: ps.hand.length,
    deck: ps.deck.length,
    legendsUp: g.faceUpLegends(p).length,
  };
}

/** Public features for the acting player `p` (nothing here depends on hidden cards). */
function decisionFeatures(g: Game, p: PlayerId): DecisionFeatures {
  const me = side(g, p);
  const op = side(g, (1 - p) as PlayerId);
  return { me, op, lead: me.gigs - op.gigs, active: g.s.active === p };
}

interface OpenAttack {
  ref: AttackRef;
  attacker: number;
  attackerPlayer: PlayerId;
  target: number | null;
  gigsBefore: number;
  records: DecisionRecord[];
}

/** One player's board snapshot (see BoardSnapshot). Reads only. */
function boardOf(g: Game, p: PlayerId, at: BoardSnapshot['at']): BoardSnapshot {
  const ps = g.P(p);
  const units = g.units(p);
  const upInArea = ps.legends.map((u) => g.s.cards[u]).filter((c) => c.faceUp);
  const gear: string[] = [];
  let equipped = 0;
  for (const c of [...units, ...upInArea]) {
    if (c.gear.length) equipped++;
    for (const u of c.gear) gear.push(g.s.cards[u].defId);
  }
  const trash: Partial<Record<CardType, number>> = {};
  for (const u of ps.trash) {
    const t = g.def(u).type;
    trash[t] = (trash[t] ?? 0) + 1;
  }
  const rival = (1 - p) as PlayerId;
  return {
    t: g.s.turn,
    p,
    at,
    units: units.map((c) => c.defId),
    gear,
    equipped,
    legends: upInArea.map((c) => c.defId),
    legendsUp: g.faceUpLegends(p).length,
    gigs: g.gigsOf(p).map((x) => [x.sides, x.value]),
    cred: g.streetCred(p),
    opCred: g.streetCred(rival),
    opGigs: g.P(rival).gigs.length,
    opUnits: g.units(rival).length,
    trash,
  };
}

export interface RecorderOptions {
  /** also keep board snapshots and card sightings for both players (src/analysis/synergies.ts reads them) */
  boards?: boolean;
}

/** Records every decision of the one Game it is attached to (see the file header). */
export class DecisionRecorder {
  readonly records: DecisionRecord[] = [];
  /** with `boards`: each player's own board before every decision and at the end of every main phase (deduplicated) */
  readonly boards: BoardSnapshot[] = [];
  /** with `boards`: the first sighting of each own main-deck card in hand or play */
  readonly sightings: CardSighting[] = [];
  private attacks = 0;
  private attack: OpenAttack | null = null;
  /** chosen Calls whose Legend is revealed after the decision */
  private calls: { rec: DecisionRecord; uid: number }[] = [];
  private readonly withBoards: boolean;
  private lastBoard: [string, string] = ['', ''];
  private seen = new Set<number>();

  constructor(opts: RecorderOptions = {}) {
    this.withBoards = !!opts.boards;
  }

  /** Board snapshots and sightings for both players (only with the `boards` option). Reads only. */
  private observe(g: Game, at: BoardSnapshot['at']) {
    if (!this.withBoards) return;
    for (const p of [0, 1] as PlayerId[]) {
      const b = boardOf(g, p, at);
      const key = JSON.stringify({ ...b, at: 0 });
      if (key !== this.lastBoard[p]) {
        this.lastBoard[p] = key;
        this.boards.push(b);
      }
      if (g.s.turn < 1) continue;
      const ps = g.P(p);
      const look = (uid: number) => {
        if (this.seen.has(uid)) return;
        const c = g.s.cards[uid];
        if (!c || c.owner !== p || g.def(c).type === 'Legend') return;
        this.seen.add(uid);
        this.sightings.push({ p, t: g.s.turn, id: c.defId });
      };
      for (const u of ps.hand) look(u);
      for (const u of ps.field) {
        look(u);
        for (const x of g.s.cards[u]?.gear ?? []) look(x);
      }
      for (const u of ps.legends) for (const x of g.s.cards[u]?.gear ?? []) look(x);
    }
    // a Program resolving (limbo) is in play for its owner
    for (const c of Object.values(g.s.cards)) {
      if (c.zone !== 'limbo' || this.seen.has(c.uid) || g.s.turn < 1 || g.def(c).type === 'Legend') continue;
      this.seen.add(c.uid);
      this.sightings.push({ p: c.owner, t: g.s.turn, id: c.defId });
    }
  }

  /** engine: the active player's main phase is over (before end-of-turn effects) */
  turnEnd(g: Game) {
    this.observe(g, 'end');
  }

  /** engine: a decision is about to be asked (features are taken before the agent answers) */
  open(g: Game, d: Decision): DecisionRecord {
    this.settleCalls(g);
    this.observe(g, this.records.length);
    const seen = new Map<string, true>();
    const codes = d.options.map((o, k) => encodeOption(g, d, o, k));
    for (const c of codes) seen.set(c, true);
    const distinct = [...seen.keys()];
    const rec: DecisionRecord = {
      i: this.records.length,
      t: g.s.turn,
      p: d.player,
      kind: d.kind,
      w: windowOf(d),
      o: distinct.length > MAX_OPTION_CODES ? distinct.slice(0, MAX_OPTION_CODES) : distinct,
      n: d.options.length,
      c: [],
      ch: [],
      f: decisionFeatures(g, d.player),
    };
    if (d.tag) rec.tag = d.tag;
    const src = visibleId(g, d.source, d.player);
    if (src) rec.src = src;
    if (distinct.length > MAX_OPTION_CODES) rec.more = distinct.length - MAX_OPTION_CODES;
    if (this.attack) {
      rec.atk = this.attack.ref;
      this.attack.records.push(rec);
    }
    this.codes.set(rec, codes);
    this.records.push(rec);
    return rec;
  }
  /** every option's code, from open() until close() */
  private codes = new Map<DecisionRecord, string[]>();

  /** engine: the agent answered */
  close(g: Game, d: Decision, rec: DecisionRecord, chosen: number[]) {
    rec.c = [...chosen];
    const codes = this.codes.get(rec);
    this.codes.delete(rec);
    rec.ch = chosen.map((k) => codes?.[k] ?? encodeOption(g, d, d.options[k], k));
    for (const k of chosen) {
      const a = d.options[k]?.action;
      if (a && a.type === 'call') this.calls.push({ rec, uid: a.uid });
    }
  }

  /** engine: €$ were paid; credited to the payer's latest decision this turn that isn't a single 'pay' pick */
  paid(g: Game, p: PlayerId, sources: CardInst[]) {
    let rec: DecisionRecord | undefined;
    for (let k = this.records.length - 1; k >= 0; k--) {
      const r = this.records[k];
      if (r.t !== g.s.turn) break;
      if (r.p === p && r.w !== 'pay') {
        rec = r;
        break;
      }
    }
    if (!rec) return;
    const pay = (rec.pay ??= { amount: 0, eddies: 0, faceDown: 0, legends: [] });
    for (const c of sources) {
      pay.amount++;
      if (c.zone === 'eddies') pay.eddies++;
      else if (!c.faceUp) pay.faceDown++;
      else pay.legends.push(c.defId);
    }
  }

  /** engine: an attack was declared (g.s.attack is set) */
  attackStart(g: Game) {
    const a = g.s.attack;
    if (!a) return;
    const ref: AttackRef = { n: this.attacks++, attacker: g.s.cards[a.attacker].defId, target: a.targetUnit !== null ? g.s.cards[a.targetUnit].defId : 'gigs' };
    const recs: DecisionRecord[] = [];
    // the main-phase choice that declared it
    const last = this.records[this.records.length - 1];
    if (last && last.w === 'main' && last.p === a.attackerPlayer && last.ch[0]?.startsWith('attack:')) {
      last.atk = ref;
      recs.push(last);
    }
    this.attack = { ref, attacker: a.attacker, attackerPlayer: a.attackerPlayer, target: a.targetUnit, gigsBefore: g.P(a.attackerPlayer).gigs.length, records: recs };
  }

  /** engine: the attack is over (called before g.s.attack is cleared) */
  attackEnd(g: Game, end: AttackOutcome['end']) {
    const open = this.attack;
    this.attack = null;
    if (!open) return;
    const a = g.s.attack;
    const finalTarget = a ? a.targetUnit : open.target;
    const out: AttackOutcome = {
      end,
      blocked: finalTarget !== null && finalTarget !== open.target,
      stolen: Math.max(0, g.P(open.attackerPlayer).gigs.length - open.gigsBefore),
      attackerGone: g.s.cards[open.attacker]?.zone !== 'field',
      targetGone: finalTarget !== null && g.s.cards[finalTarget]?.zone !== 'field',
    };
    for (const r of open.records) (r.res ??= {}).attack = out;
  }

  /** A called Legend is face-up now: note what it was (public from here on). */
  private settleCalls(g: Game) {
    if (!this.calls.length) return;
    const left: typeof this.calls = [];
    for (const x of this.calls) {
      const c = g.s.cards[x.uid];
      if (c && (c.faceUp || c.zone === 'field')) (x.rec.res ??= {}).revealed = c.defId;
      // still face-down: the Call is still being paid for (a 'pay' pick comes first); a Call that failed is dropped
      // at the end of its turn so a later Call of the same Legend is not credited to it
      else if (c && c.zone === 'legends' && x.rec.t === g.s.turn) left.push(x);
    }
    this.calls = left;
  }

  /** Call once the game is over: settles what is still open. Returns the records. */
  finish(g: Game): DecisionRecord[] {
    this.settleCalls(g);
    this.calls = [];
    if (this.attack) this.attackEnd(g, 'fizzled');
    this.observe(g, 'end');
    return this.records;
  }
}
