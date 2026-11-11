// Shared building blocks for card scripts.
import { other, type Game } from '../engine';
import type { CardInst, CardType, Gig, Intent, PlayerId } from '../types';
import { shuffleInPlace } from '../rng';

export const rival = (self: CardInst): PlayerId => other(self.controller);

export function rivalUnits(g: Game, self: CardInst, filter?: (c: CardInst) => boolean) {
  return g.units(rival(self)).filter((c) => !filter || filter(c));
}
export function friendlyUnits(g: Game, self: CardInst, filter?: (c: CardInst) => boolean) {
  return g.units(self.controller).filter((c) => !filter || filter(c));
}

/** Choose a unit among candidates for the card's controller. */
export function pick(
  g: Game,
  self: CardInst,
  cands: CardInst[],
  prompt: string,
  intent: Intent,
  optional = false,
  tag?: string,
) {
  return g.chooseUnit(self.controller, cands, prompt, { optional, intent, tag, source: self.uid });
}

/** "Defeat a rival Unit with ..." */
export async function defeatRival(g: Game, self: CardInst, filter: (c: CardInst) => boolean, optional = false) {
  const t = await pick(g, self, rivalUnits(g, self, filter), `${g.name(self)}: defeat a rival Unit`, 'harm', optional, 'defeat');
  if (t) await g.defeat(t.uid, { by: self.uid });
  return t;
}

/** Bottom-deck a unit (its owner places it). */
export function bottomDeckUnit(g: Game, c: CardInst) {
  g.bottomDeck(c.uid);
}

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
export const powerLE = (g: Game, n: number) => (c: CardInst) => g.power(c) <= n;

export function friendlyGigs(g: Game, self: CardInst): Gig[] {
  return g.gigsOf(self.controller);
}
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
export function friendlyGigValues(g: Game, p: PlayerId) {
  return new Set(g.gigsOf(p).map((x) => x.value));
}
export function rivalHasMoreGigs(g: Game, p: PlayerId, by = 1) {
  return g.P(other(p)).gigs.length - g.P(p).gigs.length >= by;
}

/** Choose a card type (Unit/Gear/Program). */
export async function chooseCardType(g: Game, p: PlayerId, prompt: string): Promise<CardType> {
  const types: CardType[] = ['Unit', 'Gear', 'Program'];
  const i = await g.chooseMode(p, prompt, types, undefined, 'cardType');
  return types[i];
}
