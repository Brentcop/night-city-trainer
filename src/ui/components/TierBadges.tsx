// The two tier letters, side by side and never confused: choom.gg's editorial tier ("choom S") and this trainer's own
// Sim tier from recorded tournaments ("Sim A", "Sim B±" when uncertain, "Sim –" when unrated). Each badge names its
// source in the badge itself and in its tooltip. The Sim tier rule is src/lib/simTier.ts, read from the bundled ratings.
import { RATINGS } from '../../data/index';
import { simTier, simTierShort, simTierText, type SimTier } from '../../lib/simTier';

/** Ratings rows by deck name (ratings.json is in the entry chunk anyway, through the Home page). */
const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));

/** The Sim tier of a deck by name, from the bundled ratings (unrated when it has no recorded tournament games). */
export const simTierFor = (name: string): SimTier => simTier(RATED.get(name));

export const CHOOM_TIER_TEXT = "choom.gg tier: the choom.gg editors' hand rating of this archetype (Night City Meta page), not our results";

/** choom.gg's editorial tier letter. */
export function ChoomTierBadge({ tier }: { tier: string | undefined }) {
  if (!tier) return null;
  return (
    <span className={`tierb tierb-choom t-${tier}`} title={CHOOM_TIER_TEXT}>
      <span className="tierb-src" aria-hidden="true">
        choom
      </span>
      <span className="tierb-l" aria-hidden="true">
        {tier}
      </span>
      <span className="sr-only">choom.gg tier {tier}</span>
    </span>
  );
}

/**
 * The Sim tier letter. `showUnrated`: draw "Sim –" for a deck with too few games (decks with no recorded games show
 * nothing unless `showUnrated` is 'always').
 */
export function SimTierBadge({ tier, showUnrated }: { tier: SimTier; showUnrated?: boolean | 'always' }) {
  if (!tier.letter && (!showUnrated || (tier.unrated === 'no-games' && showUnrated !== 'always'))) return null;
  const text = simTierText(tier);
  const cls = tier.letter ? `t-${tier.letter}${tier.straddle ? ' is-unsure' : ''}` : 'is-unrated';
  return (
    <span className={`tierb tierb-sim ${cls}`} title={text}>
      <span className="tierb-src" aria-hidden="true">
        Sim
      </span>
      <span className="tierb-l" aria-hidden="true">
        {simTierShort(tier)}
      </span>
      <span className="sr-only">{tier.letter ? `Sim tier ${tier.letter}${tier.straddle ? ', uncertain' : ''}` : 'Sim tier: unrated'}</span>
    </span>
  );
}

/** Option text for a deck picker (an <option> can't hold markup): " [choom S] [Sim A±]". */
export function tierOptionText(choom: string | undefined, sim: SimTier): string {
  return `${choom ? ` [choom ${choom}]` : ''}${sim.letter ? ` [Sim ${simTierShort(sim)}]` : ''}`;
}
