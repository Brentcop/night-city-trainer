// Display order of your hand in the Play board: sort modes, the remembered preference, and drag-to-reorder.
import type { Game } from '../../../engine/engine';

export type HandSort = 'drawn' | 'cost' | 'color' | 'manual';
export const SORT_LABEL: Record<HandSort, string> = { drawn: 'As drawn', cost: 'By cost', color: 'By color', manual: 'Custom' };
export const nextSort = (m: HandSort): HandSort => (m === 'drawn' ? 'cost' : m === 'cost' ? 'color' : 'drawn');
const COLOR_ORDER = ['Red', 'Blue', 'Green', 'Yellow'];
const KEY = 'nct.handSort';

export function loadHandSort(): HandSort {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'cost' || v === 'color' ? v : 'drawn';
  } catch {
    return 'drawn';
  }
}
export function saveHandSort(m: HandSort) {
  try {
    if (m !== 'manual') localStorage.setItem(KEY, m);
  } catch {
    /* storage blocked */
  }
}

/** The card facts sorting needs (a Game's `def` fits). */
export type CardInfo = (uid: number) => { cost?: number | null; color: string; displayName: string };

/** Display order of the hand: as drawn, by cost (then colour), by colour (then cost), or your own drag order. */
export function sortHand(def: CardInfo | Game, hand: number[], mode: HandSort, manual: number[]): number[] {
  if (mode === 'manual') return [...manual.filter((u) => hand.includes(u)), ...hand.filter((u) => !manual.includes(u))];
  if (mode === 'drawn') return hand;
  const info: CardInfo = typeof def === 'function' ? def : (u) => def.def(u);
  const key = (u: number) => {
    const d = info(u);
    return { cost: d.cost ?? 0, color: COLOR_ORDER.indexOf(d.color), name: d.displayName };
  };
  return [...hand].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const byCost = x.cost - y.cost || x.color - y.color;
    const byColor = x.color - y.color || x.cost - y.cost;
    return (mode === 'cost' ? byCost : byColor) || x.name.localeCompare(y.name);
  });
}

/**
 * Move `uid` onto the slot of `target` in the shown order. Dragging right lands after the target and dragging left
 * lands before it, so any card can reach either end.
 */
export function reorderHand(order: number[], uid: number, target: number): number[] {
  const from = order.indexOf(uid);
  const to = order.indexOf(target);
  if (from < 0 || to < 0 || uid === target) return order;
  const out = order.filter((u) => u !== uid);
  out.splice(out.indexOf(target) + (from < to ? 1 : 0), 0, uid);
  return out;
}
