// Maps a pending Decision onto the board: which cards/dice are clickable and what each click does.
import type { Game } from '../../../engine/engine';
import type { Action, Decision, Opt, PlayerId, Reaction } from '../../../engine/types';

export interface MenuItem {
  /** option index to answer; -1 for "Attack…" (enters target mode) */
  i: number;
  label: string;
  kind: string;
}

export interface AttackOpt {
  i: number;
  unit: number | null;
  gigs: PlayerId | null;
  label: string;
}

export interface Interaction {
  /** card uid -> actions it can take (main-phase actions and reactions) */
  menus: Map<number, MenuItem[]>;
  /** attacker uid -> attack targets */
  attacks: Map<number, AttackOpt[]>;
  /** card uid -> option index (click answers immediately; non-action decisions) */
  direct: Map<number, number>;
  /** gig id -> option index (click answers immediately) */
  gigDirect: Map<number, number>;
  /** gig ids mentioned by options (highlight only) */
  gigHighlight: Set<number>;
  /** "pass" / "endReact" option index */
  passIndex: number | null;
  /** options with a uid (for the choice tray) */
  cardOpts: { i: number; uid: number }[];
  /** options without a uid (rendered as buttons) */
  buttonOpts: number[];
}

export const EMPTY_IX: Interaction = {
  menus: new Map(),
  attacks: new Map(),
  direct: new Map(),
  gigDirect: new Map(),
  gigHighlight: new Set(),
  passIndex: null,
  cardOpts: [],
  buttonOpts: [],
};

/**
 * Your turn with nothing left to do but end it: a main-phase decision whose one option is to pass. The engine asks it
 * only of a seat that ends its turns by hand (`confirmsEndTurn`). It is forced: the coach neither advises nor grades it.
 */
export function onlyEndTurn(d: Decision | null | undefined): boolean {
  return !!d && d.kind === 'action' && d.options.length === 1 && (d.options[0]?.action as Action | undefined)?.type === 'pass';
}

function safeName(g: Game, uid: number): string {
  try {
    return g.name(uid);
  } catch {
    return 'card';
  }
}

function shortLabel(g: Game, a: Action | Reaction): string {
  try {
    switch (a.type) {
      case 'sell':
        return 'Sell for an Eddie';
      case 'call':
        return 'Call this Legend';
      case 'play': {
        const cost = g.playCost(a.uid, g.c(a.uid).owner);
        const t = g.def(a.uid).type;
        return `${t === 'Gear' ? 'Equip' : t === 'Program' ? 'Run program' : 'Play'} (${cost} €$)`;
      }
      case 'goSolo':
        return `Go Solo (${g.playCost(a.uid, g.c(a.uid).controller, 'goSolo')} €$)`;
      case 'playLegend':
        return `Play to the field (${g.playCost(a.uid, g.c(a.uid).controller)} €$, with Lag)`;
      case 'activate': {
        const ab = g.script(a.uid).abilities?.[a.index];
        const lbl = ab?.label ?? 'Activate';
        return a.uid !== a.host ? `${safeName(g, a.uid)}: ${lbl}` : lbl;
      }
      case 'block':
        return 'Block this attack';
      case 'attack':
        return `Attack ${a.targetUnit !== null ? `${safeName(g, a.targetUnit)} (${g.power(a.targetUnit)})` : 'the Gig area'}`;
      default:
        return g.describeAction(a);
    }
  } catch {
    return g.describeAction(a);
  }
}

function push<K, V>(m: Map<K, V[]>, k: K, v: V) {
  const arr = m.get(k);
  if (arr) arr.push(v);
  else m.set(k, [v]);
}

export function buildInteraction(g: Game, d: Decision | null): Interaction {
  if (!d) return EMPTY_IX;
  const ix: Interaction = {
    menus: new Map(),
    attacks: new Map(),
    direct: new Map(),
    gigDirect: new Map(),
    gigHighlight: new Set(),
    passIndex: null,
    cardOpts: [],
    buttonOpts: [],
  };
  if (d.kind === 'action' || d.kind === 'reaction') {
    d.options.forEach((o, i) => {
      const a = o.action;
      if (!a) return;
      if (a.type === 'pass' || a.type === 'endReact') {
        ix.passIndex = i;
        return;
      }
      if (a.type === 'attack') {
        push(ix.attacks, a.uid, { i, unit: a.targetUnit, gigs: a.targetGigs, label: shortLabel(g, a) });
        return;
      }
      const host = a.type === 'activate' ? a.host : a.uid;
      push(ix.menus, host, { i, label: shortLabel(g, a), kind: a.type });
    });
    for (const [uid, ts] of ix.attacks) {
      if (ts.length === 1) push(ix.menus, uid, { i: ts[0].i, label: ts[0].label, kind: 'attackDirect' });
      else push(ix.menus, uid, { i: -1, label: `Attack… (${ts.length} targets)`, kind: 'attack' });
    }
    return ix;
  }
  if (d.kind === 'pay') {
    // every source is a button (Legends sit on the table, the Eddie pile isn't a card); Legends are also clickable
    d.options.forEach((o, i) => {
      ix.buttonOpts.push(i);
      if (o.uid !== undefined && o.key === 'legend') ix.direct.set(o.uid, i);
    });
    return ix;
  }
  if (d.kind === 'order') {
    // each pending effect is a button naming its source card (the card may have left play); a source card on the table
    // with just one of the effects is also clickable
    const perCard = new Map<number, number>();
    d.options.forEach((o) => o.uid !== undefined && perCard.set(o.uid, (perCard.get(o.uid) ?? 0) + 1));
    d.options.forEach((o, i) => {
      ix.buttonOpts.push(i);
      if (o.uid !== undefined && perCard.get(o.uid) === 1) ix.direct.set(o.uid, i);
    });
    return ix;
  }
  const gigCount = new Map<number, number>();
  d.options.forEach((o) => o.gig !== undefined && gigCount.set(o.gig, (gigCount.get(o.gig) ?? 0) + 1));
  d.options.forEach((o, i) => {
    if (o.uid !== undefined) {
      ix.direct.set(o.uid, i);
      ix.cardOpts.push({ i, uid: o.uid });
      return;
    }
    if (o.gig !== undefined) {
      ix.gigHighlight.add(o.gig);
      if (gigCount.get(o.gig) === 1) ix.gigDirect.set(o.gig, i);
    }
    ix.buttonOpts.push(i);
  });
  return ix;
}

/** Choosing a target for an attacker that has several (the UI's target mode; the targets come from the options). */
export interface Targeting {
  attacker: number;
  targets: AttackOpt[];
}

/**
 * How a card on the table looks right now:
 *   play: can be played, called or put on the field (Go Solo, a Legend's ordinary play)
 *   sell: its only action is selling it for an Eddie
 *   attack: an attack-ready unit;  ability: an ability can be activated;  block: can block this attack
 *   target: a legal choice for the prompt (or the attack being aimed);  aiming: the attacker being aimed
 *   idle: one of your cards with nothing to do now (quieter);  dim: not a choice while a target is being picked
 */
export type CardMark = 'play' | 'sell' | 'attack' | 'ability' | 'block' | 'target' | 'aiming' | 'idle' | 'dim';

export interface Marks {
  /** card uid -> its look (cards not listed look normal) */
  cards: Map<number, CardMark>;
  /** a target or card choice is being made: everything that isn't a choice dims */
  choosing: boolean;
}

export const NO_MARKS: Marks = { cards: new Map(), choosing: false };

/** Words for each mark, for screen readers and tooltips (the outline style and icon carry it visually). */
export const MARK_TEXT: Record<CardMark, string> = {
  play: 'can be played',
  sell: 'can be sold',
  attack: 'can attack',
  ability: 'has an ability to use',
  block: 'can block',
  target: 'a legal choice',
  aiming: 'attacking: choose its target',
  idle: 'no action now',
  dim: 'not a choice',
};

/** The broad kind of a card's actions (first match wins: attack, block, play, ability, sell). */
function markOfMenu(items: MenuItem[]): CardMark {
  const has = (...k: string[]) => items.some((m) => k.includes(m.kind));
  if (has('attack', 'attackDirect')) return 'attack';
  if (has('block')) return 'block';
  if (has('play', 'call', 'goSolo', 'playLegend')) return 'play';
  if (has('activate')) return 'ability';
  return 'sell';
}

/** Cards on the table the human can see: both fields and Legend areas, and your hand. */
function tableCards(g: Game): number[] {
  const me = g.P(0);
  const rival = g.P(1);
  return [...me.hand, ...me.field, ...me.legends, ...rival.field, ...rival.legends];
}

/**
 * Which cards can be acted on, derived only from the pending decision's options (via `buildInteraction`) and the
 * target mode, never from the rules: main-phase and reaction options mark their cards by kind and quieten your other
 * cards; a target mode or any card choice marks the legal choices and dims everything else.
 */
export function boardMarks(g: Game, pend: Decision | null, ix: Interaction, targeting: Targeting | null): Marks {
  if (!pend || g.s.winner !== null) return NO_MARKS;
  const cards = new Map<number, CardMark>();
  const dimRest = () => {
    for (const u of tableCards(g)) if (!cards.has(u)) cards.set(u, 'dim');
  };
  if (targeting) {
    for (const t of targeting.targets) if (t.unit !== null) cards.set(t.unit, 'target');
    cards.set(targeting.attacker, 'aiming');
    dimRest();
    return { cards, choosing: true };
  }
  if (pend.kind === 'action' || pend.kind === 'reaction') {
    for (const [uid, items] of ix.menus) cards.set(uid, markOfMenu(items));
    const me = g.P(0);
    for (const u of [...me.hand, ...me.field, ...me.legends]) if (!cards.has(u)) cards.set(u, 'idle');
    return { cards, choosing: false };
  }
  for (const uid of ix.direct.keys()) cards.set(uid, 'target');
  const choosing = ix.direct.size > 0 || ix.gigDirect.size > 0 || ix.gigHighlight.size > 0 || ix.cardOpts.length > 0;
  if (choosing) dimRest();
  return { cards, choosing };
}

/** A card the player can see and tap on the table: either side's field or Legends, or your hand. */
function onTable(g: Game, uid: number): boolean {
  const c = g.s.cards[uid];
  if (!c) return false;
  return c.zone === 'field' || c.zone === 'legends' || (c.zone === 'hand' && c.controller === 0);
}

/** How a non-action prompt's options are offered (the same rule on every layout). */
export interface PromptChoices {
  /** card options on the table: picked on the board (they are marked), never repeated in the panel */
  board: number[];
  /** card options that aren't on the table (revealed from the deck, in the trash…): shown small in the panel */
  tray: { i: number; uid: number }[];
  /** options without a card (yes/no, skip, numbers, dice, modes, payment sources): buttons in the panel */
  buttons: number[];
}

export function promptChoices(g: Game, ix: Interaction): PromptChoices {
  const board: number[] = [];
  const tray: { i: number; uid: number }[] = [];
  for (const o of ix.cardOpts) (onTable(g, o.uid) ? board.push(o.i) : tray.push(o));
  return { board, tray, buttons: ix.buttonOpts };
}

/** What the coach's suggested option points at on the board. */
export interface CoachMark {
  i: number;
  uids: Set<number>;
  gigs: Set<number>;
  gigArea: PlayerId | null;
  attacker: number | null;
}

export function coachMark(d: Decision | null, i: number | null | undefined): CoachMark | null {
  if (!d || i === null || i === undefined) return null;
  const o: Opt | undefined = d.options[i];
  if (!o) return null;
  const m: CoachMark = { i, uids: new Set(), gigs: new Set(), gigArea: null, attacker: null };
  if (o.uid !== undefined) m.uids.add(o.uid);
  if (o.gig !== undefined) m.gigs.add(o.gig);
  const a = o.action;
  if (a && a.type !== 'pass' && a.type !== 'endReact') {
    m.uids.add(a.type === 'activate' ? a.host : a.uid);
    if (a.type === 'attack') {
      m.attacker = a.uid;
      if (a.targetUnit !== null) m.uids.add(a.targetUnit);
      if (a.targetGigs !== null) m.gigArea = a.targetGigs;
    }
  }
  return m;
}
