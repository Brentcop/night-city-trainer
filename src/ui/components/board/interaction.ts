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

function safeName(g: Game, uid: number): string {
  try {
    return g.name(uid);
  } catch {
    return 'card';
  }
}

export function shortLabel(g: Game, a: Action | Reaction): string {
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
