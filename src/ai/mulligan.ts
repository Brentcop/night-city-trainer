// The opening-hand (mulligan) decision's inputs: features of the hand a player sees, and the plain rule over them
// (BOT-6, docs/BOT_TOOLKIT.md §5). Only the player's own hand is read.
import type { Game } from '../engine/engine';
import type { PlayerId } from '../engine/types';

/**
 * HeuristicOptions.mulligan. 'rule' (default): the bots' rule, where a bot with card impact (Hard, the coach) also keeps
 * a hand holding 2+ high-impact cards and 2+ cards costing ≤4. 'plain': the same rule without that card-impact keep.
 * Measured 2026-11-12 (scripts/mulligan-check.ts, Hard, 4,200 forced-choice hands): on the hands where the two differ,
 * mulliganing was worth +11.0 points [3.6, 18.5].
 */
export type MulliganRule = 'rule' | 'plain';

/** What an opening hand holds (6 cards), from its owner's view. */
export interface HandFeatures {
  /** Units costing ≤4 */
  cheapUnits: number;
  /** cards costing ≤4 */
  cheap: number;
  /** cards costing ≤2 */
  early: number;
  /** Units costing ≤2 / ≤3 */
  earlyUnits: number;
  units3: number;
  /** Units in hand */
  units: number;
  /** sellable cards */
  sellable: number;
  /** mean cost of the hand's cards (a card without a cost counts 0) */
  meanCost: number;
  /** cards costing 5+ */
  top: number;
}

export function handFeatures(g: Game, p: PlayerId): HandFeatures {
  const hand = g.P(p).hand.map((u) => g.def(u));
  const cost = (c: (typeof hand)[number]) => c.cost ?? 9;
  const unit = (c: (typeof hand)[number]) => c.type === 'Unit';
  return {
    cheapUnits: hand.filter((c) => unit(c) && cost(c) <= 4).length,
    cheap: hand.filter((c) => cost(c) <= 4).length,
    early: hand.filter((c) => cost(c) <= 2).length,
    earlyUnits: hand.filter((c) => unit(c) && cost(c) <= 2).length,
    units3: hand.filter((c) => unit(c) && cost(c) <= 3).length,
    units: hand.filter(unit).length,
    sellable: hand.filter((c) => c.sellable).length,
    meanCost: hand.length ? hand.reduce((a, c) => a + (c.cost ?? 0), 0) / hand.length : 0,
    top: hand.filter((c) => (c.cost ?? 0) >= 5).length,
  };
}

/** The plain rule: mulligan unless the hand has a Unit costing ≤4, three cards costing ≤4 and something to sell. */
export function plainRuleMulligan(g: Game, p: PlayerId): boolean {
  const f = handFeatures(g, p);
  return !(f.cheapUnits >= 1 && f.cheap >= 3 && f.sellable >= 1);
}
