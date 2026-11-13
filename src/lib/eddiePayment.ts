// Choosing what pays a cost on the Play board ("Choose before" / "Choose after" in the board settings). A UI layer only:
// the engine is untouched. A cost is paid right after its action is chosen (Game.pay); the human seat already answers a
// 'pay' decision per €$ whenever a Legend could pay instead of an Eddie. "Automatic" answers those itself with the
// engine's automatic pick (autoPayAnswer), so it never asks. The other modes hold the chosen action back until the
// player has picked the sources, then answer it and answer those 'pay' decisions from the picks (planAnswer). With
// only Eddies to pay from the engine asks nothing and spends the first ready ones: Eddies are interchangeable in the
// current rules, so a selection of Eddies is a count, shown as your first ready Eddies.
import type { Game } from '../engine/engine';
import { paySourceOrder } from '../engine/game/economy';
import type { Decision, Opt, PlayerId } from '../engine/types';

/** One source that could pay a cost. */
export interface PaySource {
  uid: number;
  kind: 'eddie' | 'legend';
  label: string;
}

/** What choosing an action will cost, as the engine will ask for it. */
export interface PayCost {
  amount: number;
  /** what the cost is for (the engine's own wording) */
  what: string;
  /** sources that can't pay this cost (a Legend whose ability spends it) */
  exclude: number[];
  /** the engine's automatic order hints (Go Solo spends the Legend itself first; a Legend paying its own play, last) */
  order: { first?: number[]; last?: number[] };
}

/** Selected sources. Eddies are interchangeable, so they are a count; Legends are named. */
export interface PaySelection {
  eddies: number;
  legends: number[];
}

export const EMPTY_SELECTION: PaySelection = Object.freeze({ eddies: 0, legends: Object.freeze([]) as unknown as number[] }) as PaySelection;

/**
 * The €$ cost of choosing `opt` in a main-phase or reaction decision of player `p`, or null when it costs nothing or
 * isn't a cost this layer knows (costs asked later by a card's own effect are paid the usual way).
 */
export function optionCost(g: Game, p: PlayerId, opt: Opt | undefined): PayCost | null {
  const a = opt?.action;
  if (!a) return null;
  let cost: PayCost | null = null;
  try {
    switch (a.type) {
      case 'call':
        cost = { amount: g.callCost(p), what: `Call ${g.name(a.uid)}`, exclude: [], order: {} };
        break;
      case 'play':
        cost = { amount: g.playCost(a.uid, p), what: `Play ${g.name(a.uid)}`, exclude: [], order: {} };
        break;
      case 'goSolo':
        cost = { amount: g.playCost(a.uid, p, 'goSolo'), what: `${g.name(a.uid)} goes solo`, exclude: [], order: { first: [a.uid] } };
        break;
      case 'playLegend':
        cost = { amount: g.playCost(a.uid, p), what: `Play ${g.name(a.uid)}`, exclude: [], order: { last: [a.uid] } };
        break;
      case 'activate': {
        const ab = g.script(a.uid).abilities?.[a.index];
        if (ab?.eddies) cost = { amount: ab.eddies, what: `${g.name(a.host)}: ${ab.label}`, exclude: ab.spend ? [a.host] : [], order: {} };
        break;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
  return cost && cost.amount > 0 ? cost : null;
}

/** The sources that could pay `cost`, in the order the game would spend them automatically. */
export function paySources(g: Game, p: PlayerId, cost?: Pick<PayCost, 'exclude' | 'order'>): PaySource[] {
  const legends = g.P(p).legends;
  return paySourceOrder(g, p, cost?.exclude ?? [], cost?.order ?? {}).map((c) =>
    c.zone === 'eddies'
      ? { uid: c.uid, kind: 'eddie' as const, label: 'Eddie' }
      : { uid: c.uid, kind: 'legend' as const, label: c.faceUp ? g.name(c) : `Face-down Legend (slot ${legends.indexOf(c.uid) + 1})` },
  );
}

export const readyEddies = (sources: readonly PaySource[]) => sources.filter((s) => s.kind === 'eddie').length;
export const selectionCount = (sel: PaySelection) => sel.eddies + sel.legends.length;

/** The selection limited to what can pay now (Eddies spent since, Legends no longer ready or excluded). */
export function clampSelection(sel: PaySelection, sources: readonly PaySource[]): PaySelection {
  const eddies = Math.max(0, Math.min(sel.eddies, readyEddies(sources)));
  const ok = new Set(sources.filter((s) => s.kind === 'legend').map((s) => s.uid));
  const legends = sel.legends.filter((u) => ok.has(u));
  if (eddies === sel.eddies && legends.length === sel.legends.length) return sel;
  return { eddies, legends };
}

/** What automatic payment would spend: the first `amount` sources in its order. */
export function automaticSelection(sources: readonly PaySource[], amount: number): PaySelection {
  const take = sources.slice(0, Math.max(0, amount));
  return { eddies: take.filter((s) => s.kind === 'eddie').length, legends: take.filter((s) => s.kind === 'legend').map((s) => s.uid) };
}

/**
 * Tap the `index`-th ready Eddie (0-based). Selected Eddies are always your first ones, so tapping a selected Eddie
 * keeps only those before it, and tapping an unselected one selects up to and including it.
 */
export function tapEddie(sel: PaySelection, index: number, ready: number): PaySelection {
  if (index < 0 || index >= ready) return sel;
  return { ...sel, eddies: index < sel.eddies ? index : index + 1 };
}

/** One more Eddie (or none again once all ready Eddies are selected): a tap on the €$ pile. */
export function addEddie(sel: PaySelection, ready: number): PaySelection {
  return { ...sel, eddies: sel.eddies >= ready ? 0 : sel.eddies + 1 };
}

export function toggleLegend(sel: PaySelection, uid: number): PaySelection {
  return { ...sel, legends: sel.legends.includes(uid) ? sel.legends.filter((u) => u !== uid) : [...sel.legends, uid] };
}

/** "Selected 2 of 3" and whether the selection pays the cost exactly. */
export function payStatus(sel: PaySelection, amount: number): { selected: number; need: number; exact: boolean; text: string } {
  const selected = selectionCount(sel);
  const more = amount - selected;
  const tail = more > 0 ? `: select ${more} more` : more < 0 ? `: remove ${-more}` : '';
  return { selected, need: amount, exact: more === 0, text: `Selected ${selected} of ${amount}${tail}` };
}

/**
 * Answer one 'pay' decision from a confirmed selection: a selected Legend the decision offers (in the decision's order),
 * else an Eddie while the selection has Eddies left. Returns the option and the selection still to spend, or null when
 * the selection offers nothing the decision asks for (the player is then asked as usual).
 */
export function planAnswer(d: Decision, plan: PaySelection): { i: number; rest: PaySelection } | null {
  if (d.kind !== 'pay') return null;
  const li = d.options.findIndex((o) => o.key === 'legend' && o.uid !== undefined && plan.legends.includes(o.uid));
  if (li >= 0) {
    const uid = d.options[li]?.uid;
    return { i: li, rest: { ...plan, legends: plan.legends.filter((u) => u !== uid) } };
  }
  const ei = d.options.findIndex((o) => o.key === 'eddie');
  if (ei >= 0 && plan.eddies > 0) return { i: ei, rest: { ...plan, eddies: plan.eddies - 1 } };
  return null;
}

/**
 * "Automatic" payment answers the engine's 'pay' decisions itself (UX-9): the human seat is always asked which source
 * pays each €$ when a Legend could pay instead of an Eddie, and the first option is always what the engine's automatic
 * rule would spend (Eddies first, then the Legends that lose least by being spent: economy.ts paySourceOrder), so
 * Automatic answers 0 and the player is never prompted. The other modes pick the sources themselves (planAnswer) and
 * leave anything their plan doesn't cover to the player. Returns the option to answer, or null to leave it.
 */
export function autoPayAnswer(d: Decision | null, mode: 'auto' | 'before' | 'after'): number | null {
  return mode === 'auto' && d?.kind === 'pay' && d.options.length > 0 ? 0 : null;
}

/** The cost of answering option `i` of a main-phase or reaction decision (null for any other decision, or no cost). */
export function costOfAnswer(g: Game, d: Decision | null, i: number): PayCost | null {
  if (!d || (d.kind !== 'action' && d.kind !== 'reaction')) return null;
  return optionCost(g, d.player, d.options[i]);
}
