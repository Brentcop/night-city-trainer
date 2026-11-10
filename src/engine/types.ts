// Core types for the Cyberpunk TCG engine.
// Rules reference: data/raw/official_comprehensive_rules.txt (cyberpunktcg.com, updated Oct 29 2026).

export type PlayerId = 0 | 1;
export type Color = 'Red' | 'Blue' | 'Green' | 'Yellow';
export type CardType = 'Unit' | 'Program' | 'Gear' | 'Legend';
export type Keyword = 'blocker' | 'adrenaline' | 'goSolo' | 'quick';
export type Zone = 'deck' | 'hand' | 'field' | 'legends' | 'eddies' | 'trash' | 'removed' | 'limbo';

export interface CardDef {
  id: string;
  name: string;
  subname: string | null;
  displayName: string;
  color: Color;
  type: CardType;
  cost: number | null;
  power: number | null;
  ram: number;
  rarity: string;
  tags: string[];
  text: string;
  keywords: Keyword[];
  sellable: boolean;
  set: string;
  number: string;
  image: string | null;
  eid?: string | null; // netdeck.gg external id (art lookup)
  url?: string | null; // official card page
  simStatus?: string;
  simNotes?: string | null;
}

export interface CardInst {
  uid: number;
  defId: string;
  owner: PlayerId;
  controller: PlayerId;
  zone: Zone;
  spent: boolean;
  faceUp: boolean;
  lag: boolean;
  gear: number[]; // uids of Gear equipped to this card
  host: number | null; // for Gear: uid it's equipped to
  enteredTurn: number; // global turn number it entered its current zone
  goSolo: boolean; // a Legend played to the field
  known?: boolean; // face-down legend whose identity is known to its controller via an effect
}

export interface Gig {
  id: number;
  sides: number; // 4,6,8,10,12,20
  value: number;
  owner: PlayerId;
  controller: PlayerId | null; // null while in the owner's fixer area
}

export type ModUntil =
  | 'endOfTurn' // removed at end of the current turn
  | 'startOfTurn' // removed at start of `untilPlayer`'s next turn
  | 'attackEnd'
  | 'permanent';

export interface Mod {
  id: number;
  kind: string; // 'power' | 'keyword' | 'cantAttack' | 'cantReady' | 'mustAttack' | 'attackReady' | 'lagAttack' | ...
  target?: number; // uid
  player?: PlayerId; // for player-wide mods
  amount?: number;
  value?: any;
  until: ModUntil;
  untilPlayer?: PlayerId;
  source?: number; // uid that created it
  turn: number; // turn created
}

export interface PlayerState {
  id: PlayerId;
  name: string;
  deck: number[]; // index 0 = top
  hand: number[];
  field: number[];
  legends: number[];
  eddies: number[];
  trash: number[]; // last = top
  removed: number[];
  fixer: number[]; // gig ids
  gigs: number[]; // gig ids controlled
  sideboard: string[];
}

export interface AttackState {
  attacker: number;
  attackerPlayer: PlayerId;
  targetUnit: number | null;
  targetGigs: PlayerId | null;
  step: 'declare' | 'react' | 'fight' | 'steal' | 'done';
  ended: boolean;
}

export interface LogEntry {
  turn: number;
  player: PlayerId | null;
  text: string;
}

export interface Stats {
  attacks: number[];
  gigsStolen: number[];
  unitsDefeated: number[];
  cardsPlayed: number[];
  sold: number[];
  calls: number[];
}

export interface GameState {
  rng: number;
  turn: number; // global turn counter, starts at 1
  active: PlayerId;
  first: PlayerId;
  phase: 'setup' | 'start' | 'main' | 'end' | 'over';
  players: [PlayerState, PlayerState];
  cards: Record<number, CardInst>;
  gigs: Record<number, Gig>;
  mods: Mod[];
  attack: AttackState | null;
  winner: PlayerId | 'tie' | null;
  winReason: string;
  overtime: boolean;
  emptyFixerStreak: number;
  nextUid: number;
  nextModId: number;
  once: Record<string, number>; // key -> turn used (once-per-turn bookkeeping)
  counters: Record<string, number>; // misc per-game counters
  log: LogEntry[];
  stats: Stats;
  maxTurns: number;
  /** Opt-in telemetry for analysis (GameOptions.trace). */
  trace?: TraceEvent[];
}

export type TraceKind = 'open' | 'mulligan' | 'draw' | 'play' | 'sell' | 'call' | 'solo' | 'attack' | 'steal' | 'defeated' | 'turnEnd' | 'activate';
export interface TraceEvent {
  t: number; // turn
  p: PlayerId;
  k: TraceKind;
  id?: string; // card def id
  x?: string | number; // extra: attack target 'gigs'|'unit', gig counts 'a-b', etc.
}

// ---------- Actions & decisions ----------

export type Action =
  | { type: 'pass' }
  | { type: 'sell'; uid: number }
  | { type: 'call'; uid: number }
  | { type: 'play'; uid: number }
  | { type: 'goSolo'; uid: number }
  | { type: 'activate'; uid: number; host: number; index: number }
  | { type: 'attack'; uid: number; targetUnit: number | null; targetGigs: PlayerId | null };

export type Reaction =
  | { type: 'endReact' }
  | { type: 'call'; uid: number }
  | { type: 'block'; uid: number }
  | { type: 'play'; uid: number }
  | { type: 'activate'; uid: number; host: number; index: number };

export type Intent = 'harm' | 'help' | 'neutral';

export interface Opt {
  label: string;
  uid?: number;
  gig?: number;
  n?: number;
  key?: string;
  action?: Action | Reaction;
}

export type DecisionKind =
  | 'action'
  | 'reaction'
  | 'mulligan'
  | 'unit'
  | 'card'
  | 'gig'
  | 'gigValue'
  | 'number'
  | 'mode'
  | 'yesno'
  | 'steal'
  | 'legend'
  | 'cardType';

export interface Decision {
  player: PlayerId;
  kind: DecisionKind;
  prompt: string;
  options: Opt[];
  min: number;
  max: number;
  source?: number; // uid of the card asking
  intent?: Intent;
  tag?: string; // free-form hint for bots, e.g. 'discard', 'bottomdeck', 'steal'
}

export interface Agent {
  name: string;
  decide(g: import('./engine').Game, d: Decision): Promise<number[]>;
}

// ---------- Card scripts ----------

export interface EventMap {
  spent: { uid: number; cause: 'attack' | 'pay' | 'ability' | 'effect' | 'block' };
  attack: { attacker: number; targetUnit: number | null; targetGigs: PlayerId | null };
  steal: { actor: number; gig: number; player: PlayerId; value: number };
  fight: { uid: number; opp: number; result: 'win' | 'lose'; power?: number; oppPower?: number };
  unitDefeated: DefeatInfo;
  cardPlayed: { uid: number; player: PlayerId; type: CardType };
  blockerUsed: { uid: number };
  gigRolled: { gig: number; player: PlayerId; fromFixer: boolean };
  gigChanged: { gig: number; by: PlayerId; kind: 'adjust' | 'swap' | 'set' };
  legendCalled: { uid: number; player: PlayerId };
  turnEnd: { player: PlayerId };
  turnStart: { player: PlayerId };
}
export type EventName = keyof EventMap;

export interface DefeatInfo {
  uid: number;
  defId: string;
  controller: PlayerId;
  owner: PlayerId;
  gear: number[]; // gear that was equipped (now in trash)
  wasEquipped: boolean;
  inFight: boolean;
  by: number | null;
  power: number;
  tags: string[];
  goSolo: boolean;
}

export interface Ability {
  label: string;
  eddies?: number; // €$ part of activation cost
  spend?: boolean; // {Spend} — spend the host
  quick?: boolean; // usable as a reaction
  discard?: number; // additional cost: discard N
  can?: (g: import('./engine').Game, self: CardInst, host: CardInst) => boolean;
  run: (g: import('./engine').Game, self: CardInst, host: CardInst, paid: { discarded: number[] }) => Promise<void>;
}

type G = import('./engine').Game;

export interface CardScript {
  /** Unit {Play}, Program resolution, Gear top-text "when played" */
  play?: (g: G, self: CardInst) => Promise<void>;
  /** Extra playability check (beyond cost). */
  canPlay?: (g: G, self: CardInst, p: PlayerId) => boolean;
  /** Delta to this card's own play cost (e.g. "-1 €$ for each ..."). Return negative for discounts. */
  selfCost?: (g: G, self: CardInst, p: PlayerId) => number;
  /** Override cost entirely (e.g. Nocturne: "play for 1 €$ if fixer empty"). */
  altCost?: (g: G, self: CardInst, p: PlayerId) => number | null;
  /** Legend {Call} */
  call?: (g: G, self: CardInst) => Promise<void>;
  /** {Attack} trigger. For Gear, host is the attacking unit. */
  attack?: (g: G, self: CardInst, host: CardInst) => Promise<void>;
  /** {Defeated} trigger (self = card defeated, or its gear's bottom text). */
  defeated?: (g: G, self: CardInst, info: DefeatInfo) => Promise<void>;
  abilities?: Ability[];
  /** Event triggers while this card's text is active. */
  on?: { [K in EventName]?: (g: G, self: CardInst, host: CardInst, ev: EventMap[K]) => Promise<void> | void };
  /** Persistent: power contribution to `target` (any card in play). */
  power?: (g: G, self: CardInst, host: CardInst, target: CardInst) => number;
  /** Persistent: keywords granted to `target`. */
  keywords?: (g: G, self: CardInst, host: CardInst, target: CardInst) => Keyword[];
  /** Persistent: return true to forbid attacker attacking (target null = check "can attack at all"). */
  attackBan?: (g: G, self: CardInst, host: CardInst, attacker: CardInst, target: AttackTargetRef | null) => boolean;
  /** Persistent: return true to allow an otherwise-illegal attack target. */
  attackAllow?: (g: G, self: CardInst, host: CardInst, attacker: CardInst, target: AttackTargetRef) => boolean;
  /** Persistent: delta to another card's play cost / go-solo cost. */
  costMod?: (g: G, self: CardInst, host: CardInst, card: CardInst, p: PlayerId, kind: 'play' | 'goSolo') => number;
  /** Persistent: delta to number of gigs the attacker steals. */
  stealMod?: (g: G, self: CardInst, host: CardInst, attacker: CardInst) => number;
  /** Persistent: true if `attacker` can't steal `gig`. */
  stealBan?: (g: G, self: CardInst, host: CardInst, attacker: CardInst, gig: Gig) => boolean;
  /** Called when a friendly gig would be stolen (after selection). Return true to prevent. */
  preventSteal?: (g: G, self: CardInst, host: CardInst, attacker: CardInst, gig: Gig) => Promise<boolean>;
  /** Replacement: a card would be defeated. Return true if replaced (defeat doesn't happen). */
  replaceDefeat?: (g: G, self: CardInst, host: CardInst, victim: CardInst, inFight: boolean) => Promise<boolean>;
  /** Fight outcome override for host: 'win' | 'lose' | null. */
  fightOverride?: (g: G, self: CardInst, host: CardInst, opp: CardInst) => 'win' | 'lose' | null;
  /** Can this Unit be blocked? return true to make unblockable */
  unblockable?: (g: G, self: CardInst, host: CardInst, attacker: CardInst) => boolean;
  /**
   * Delayed triggers created by this card (usually a Program) via g.addDelayed(self, event, data, until).
   * The handler runs when the event fires; return true to consume (remove) the delayed trigger.
   */
  delayed?: { [K in EventName]?: (g: G, mod: Mod, ev: EventMap[K]) => Promise<boolean | void> | boolean | void };
  /** Mark scripts that are not fully implemented. */
  partial?: string;
}

export interface AttackTargetRef {
  unit: number | null;
  gigs: PlayerId | null;
}

export interface DeckList {
  name: string;
  legends: string[]; // card def ids
  main: string[]; // card def ids, with repeats
  sideboard: string[];
  source?: string;
  notes?: string;
}
