// Shared building blocks for card scripts.
import { other, type Game } from '../engine';
import type { CardInst, CardType, Intent, PlayerId } from '../types';
import { shuffleInPlace } from '../rng';

export const rival = (self: CardInst): PlayerId => other(self.controller);

export function rivalUnits(g: Game, self: CardInst, filter?: (c: CardInst) => boolean) {
  return g.units(rival(self)).filter((c) => !filter || filter(c));
}
export function friendlyUnits(g: Game, self: CardInst, filter?: (c: CardInst) => boolean) {
  return g.units(self.controller).filter((c) => !filter || filter(c));
}

/**
 * Say in the log why an effect (or one part of it) did nothing: "<card>: <why>". Log only: nothing reads the log to
 * decide anything, and clones and effect probes don't log, so play and results never depend on it. The log is shown to
 * both players: `why` may only state what both can see (Gigs, Street Cred, face-up cards, the field), never the
 * contents of a hand, a deck or a face-down Legend. `p`: whose line it is (default the card's controller).
 */
export function noEffect(g: Game, self: CardInst, why: string, p: PlayerId = self.controller) {
  g.log(p, `${g.name(self)}: ${why}`);
}

/** The action a choice prompt asks for, without the card name in front or a "(1/2)" count after: the generic reason's wording. */
function promptAction(prompt: string): string {
  const k = prompt.lastIndexOf(': ');
  const tail = k >= 0 ? prompt.slice(k + 2) : prompt;
  const s = tail.replace(/\s*\(\d+\/\d+\)\s*$/, '').replace(/\?$/, '');
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Choose a unit among candidates for the card's controller. With no candidate there is nothing to choose: the log says
 * so (`none`, or a generic line built from the prompt), unless `quiet` (a later pick of "up to N" after an earlier one).
 * Candidates here are Units on the field or face-up Legends, so saying there are none reveals nothing hidden.
 */
export function pick(
  g: Game,
  self: CardInst,
  cands: CardInst[],
  prompt: string,
  intent: Intent,
  optional = false,
  tag?: string,
  none?: string | false,
) {
  if (!cands.length && none !== false) noEffect(g, self, none ?? `no legal target for "${promptAction(prompt)}"`);
  return g.chooseUnit(self.controller, cands, prompt, { optional, intent, tag, source: self.uid });
}

/** "Defeat a rival Unit with ..." */
export async function defeatRival(g: Game, self: CardInst, filter: (c: CardInst) => boolean, optional = false) {
  const t = await pick(g, self, rivalUnits(g, self, filter), `${g.name(self)}: defeat a rival Unit`, 'harm', optional, 'defeat');
  if (t) await g.defeat(t.uid, { by: self.uid });
  return t;
}

/** Bottom-deck a unit (its owner places it). */
/** A rival chooses and discards n cards. */
export async function rivalDiscards(g: Game, self: CardInst, n: number) {
  return g.discard(rival(self), n, undefined, false, `${g.name(self)}: discard ${n}`);
}

/** Effect that lasts until the start of the controller's next turn. */
export function untilMyNextTurn(self: CardInst) {
  return { until: 'startOfTurn' as const, untilPlayer: self.controller };
}

/**
 * "Search the top N cards of your deck. Add up to K (matching filter) to your hand. Bottom-deck the rest."
 * rest: where the unpicked cards go.
 */
export async function searchTop(
  g: Game,
  p: PlayerId,
  n: number,
  opts: {
    filter?: (c: CardInst) => boolean;
    max: number;
    rest: 'bottom' | 'top' | 'trash';
    prompt?: string;
    to?: 'hand' | 'play';
  },
): Promise<number[]> {
  const top = g.P(p).deck.slice(0, n);
  const picked: number[] = [];
  for (let i = 0; i < opts.max; i++) {
    const cands = top.filter((u) => !picked.includes(u) && (!opts.filter || opts.filter(g.c(u))));
    if (!cands.length) break;
    const u = await g.chooseCard(p, cands, opts.prompt ?? `Choose a card to add to your hand (${i + 1}/${opts.max})`, true, 'search', 'help');
    if (u === null) break;
    picked.push(u);
  }
  for (const u of picked) {
    g.move(u, 'hand');
    g.log(p, `adds ${g.name(u)} to hand`);
  }
  const rest = top.filter((u) => !picked.includes(u));
  if (opts.rest === 'bottom') {
    const shuffled = shuffleInPlace(g.s, [...rest]);
    for (const u of shuffled) g.move(u, 'deck', { position: 'bottom' });
  } else if (opts.rest === 'trash') {
    for (const u of rest) g.move(u, 'trash');
  }
  return picked;
}

/** "Trash N. Add a <type> from among them to your hand." Mandatory when a card matches (FAQ All is Lost #1). */
export async function millAndTake(g: Game, p: PlayerId, n: number, filter: (c: CardInst) => boolean, max = 1) {
  const milled = g.mill(p, n);
  const got: number[] = [];
  for (let i = 0; i < max; i++) {
    const cands = milled.filter((u) => !got.includes(u) && g.c(u).zone === 'trash' && filter(g.c(u)));
    const u = await g.chooseCard(p, cands, 'Add a card from among them to your hand', false, 'search', 'help');
    if (u === null) break;
    g.move(u, 'hand');
    g.log(p, `adds ${g.name(u)} to hand`);
    got.push(u);
  }
  return { milled, got };
}

export const isType = (g: Game, t: CardType) => (c: CardInst) => g.def(c).type === t;
export const costLE = (g: Game, n: number) => (c: CardInst) => (g.def(c).cost ?? 0) <= n;

export function has8Plus(g: Game, p: PlayerId) {
  return g.gigsOf(p).some((x) => x.value >= 8);
}
export function count8Plus(g: Game, p: PlayerId) {
  return g.gigsOf(p).filter((x) => x.value >= 8).length;
}
export function hasMinGig(g: Game, p: PlayerId) {
  return g.gigsOf(p).some((x) => x.value === 1);
}
export function countMinGigs(g: Game, p: PlayerId) {
  return g.gigsOf(p).filter((x) => x.value === 1).length;
}
export function rivalHasMoreGigs(g: Game, p: PlayerId, by = 1) {
  return g.P(other(p)).gigs.length - g.P(p).gigs.length >= by;
}
