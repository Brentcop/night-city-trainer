// Deck archetype classification + matchup play-style profiles.
import { CARD_BY_ID } from '../engine/cards';
import type { EvalWeights } from './eval';
import { ROLES } from './knowledge';
import tuned from './profiles.tuned.json';

export type Archetype = 'aggro' | 'midrange' | 'control';

export interface ArchetypeInfo {
  arch: Archetype;
  units: number; // fraction of main deck
  avgCost: number;
  interaction: number; // removal + sweeper + stun per card
  cardFlow: number; // draw + tutor per card
  aggroScore: number; // >0 leans aggro, <0 leans control
}

/** Classify a list of card ids (main deck, or the cards seen so far). */
export function classify(ids: string[]): ArchetypeInfo {
  const main = ids.filter((id) => CARD_BY_ID[id] && CARD_BY_ID[id].type !== 'Legend');
  const n = Math.max(1, main.length);
  const units = main.filter((id) => CARD_BY_ID[id].type === 'Unit').length / n;
  const avgCost = main.reduce((a, id) => a + (CARD_BY_ID[id].cost ?? 0), 0) / n;
  let inter = 0;
  let flow = 0;
  let power = 0;
  for (const id of main) {
    const r = ROLES[id] ?? [];
    if (r.includes('removal') || r.includes('sweeper') || r.includes('stun')) inter++;
    if (r.includes('draw') || r.includes('tutor')) flow++;
    if (CARD_BY_ID[id].type === 'Unit') power += CARD_BY_ID[id].power ?? 0;
  }
  const interaction = inter / n;
  const cardFlow = flow / n;
  // aggro: many cheap units, little interaction/card flow; control: interaction + card flow, few units
  const aggroScore = units * 2.2 - interaction * 2 - cardFlow * 1.6 - (avgCost - 3.4) * 0.6;
  const arch: Archetype = aggroScore > 0.03 ? 'aggro' : aggroScore < -0.3 ? 'control' : 'midrange';
  return { arch, units, avgCost, interaction, cardFlow, aggroScore };
}

/**
 * Multipliers on evaluation weights by (my archetype, rival archetype).
 * Defaults encode standard TCG theory; scripts/tune-profiles.ts refines them by self-play.
 */
export type ProfileKey = `${Archetype}>${Archetype}`;
export type Profiles = Partial<Record<ProfileKey, Partial<Record<keyof EvalWeights, number>>>>;

export const DEFAULT_PROFILES: Profiles = {
  // Aggro vs control: race. Gigs matter more, cards in hand less, accept exposure.
  'aggro>control': { gig: 1.3, hand: 0.8, spentRisk: 0.6 },
  // Control vs aggro: stabilise the board; units and blockers first, don't expose attackers.
  'control>aggro': { unitPower: 1.3, spentRisk: 1.8, gig: 1.1 },
  // Midrange vs control: be the beatdown.
  'midrange>control': { gig: 1.2, hand: 0.9 },
  // Midrange vs aggro: be the control deck.
  'midrange>aggro': { unitPower: 1.2, spentRisk: 1.4 },
  // Control vs control: card advantage wins.
  'control>control': { hand: 1.25, eddie: 1.15 },
};

export const PLAN_TEXT: Record<ProfileKey, string> = {
  'aggro>aggro': 'Mirror race: trade early, keep one blocker back once you are ahead on Gigs.',
  'aggro>midrange': 'Be the beatdown before their bigger Units land; remove their first blocker.',
  'aggro>control': 'Race. Commit Units every turn and push Gigs before sweepers and card advantage take over.',
  'midrange>aggro': 'Be the control deck: win the early fights, keep blockers ready, then turn the corner.',
  'midrange>midrange': 'Fight for the board; 10-power breakpoints and removal efficiency decide it.',
  'midrange>control': 'Be the beatdown: pressure Gigs early, play around sweepers by not over-committing.',
  'control>aggro': 'Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units.',
  'control>midrange': 'Trade removal for threats one-for-one; win with card advantage in the long game.',
  'control>control': 'Card advantage and Eddies decide it; don’t fire sweepers into one Unit.',
};

/** Effective weights for a matchup. */
export function applyProfile(base: EvalWeights, profiles: Profiles | undefined, me: Archetype, opp: Archetype): EvalWeights {
  const p = profiles?.[`${me}>${opp}`];
  if (!p) return base;
  const w = { ...base };
  for (const [k, m] of Object.entries(p)) (w as any)[k] = (base as any)[k] * (m as number);
  return w;
}

/** Best known profiles: self-play tuned (scripts/tune-profiles.ts) when available. */
export const BEST_PROFILES: Profiles = tuned as Profiles;
