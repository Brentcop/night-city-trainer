// Small reads of a lesson's game for its checks and words.
import type { Game } from '../../engine/engine';
import type { CardInst, PlayerId, Zone } from '../../engine/types';

/** The cards of `defId` that player `p` owns (in any zone). */
export const cardsOf = (g: Game, p: PlayerId, defId: string): CardInst[] => Object.values(g.s.cards).filter((c) => c.owner === p && c.defId === defId);
/** Does player `p` have a card of `defId` in `zone`? */
export const has = (g: Game, p: PlayerId, defId: string, zone: Zone): boolean => cardsOf(g, p, defId).some((c) => c.zone === zone);
/** How many Gigs player `p` holds. */
export const gigs = (g: Game, p: PlayerId): number => g.P(p).gigs.length;
/** "a d8 showing 5" for the die just rolled in or changed. */
export const dieText = (g: Game, id: number | undefined): string => {
  const d = id === undefined ? undefined : g.s.gigs[id];
  return d ? `a ${d.value} on the d${d.sides}` : 'a die';
};
/** Street Cred as the board shows it (☆, or – with no Gigs). */
export const cred = (g: Game, p: PlayerId): string => String(g.streetCred(p) ?? '–');
