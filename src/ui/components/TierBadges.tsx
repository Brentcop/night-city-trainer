// The tier letters, side by side and never confused: choom.gg's editorial tier ("choom S"), this trainer's own Sim tier
// from recorded tournaments ("Sim A", "Sim B±" when uncertain, "Sim –" when unrated), and, for a list with no recorded
// rating, the visitor's provisional tier from their own tournaments in this browser ("Yours B", dotted, never filled like
// a recorded letter). Each badge names its source in the badge itself, its tooltip and its accessible name. The tier rule
// is src/lib/simTier.ts, read from the bundled ratings (Sim) or the provisional rating (src/lib/yourStats.ts).
//
// Recorded results are found by deck: a library deck by its own name (as always), a deck saved in this browser by its
// list, through the library deck with the same list (src/lib/listTwin.ts), so a renamed copy shows the original's record.
import { RATINGS } from '../../data/index';
import { BUILTIN } from '../../lib/browserLibrary';
import type { LibraryDeck } from '../../lib/library';
import { libraryTwin, isSavedHere } from '../../lib/listTwin';
import { provisionalTierText, simTier, simTierShort, simTierText, simTierVersionNote, type SimTier } from '../../lib/simTier';

/** Ratings rows by deck name (ratings.json is in the entry chunk anyway, through the Home page). */
const RATED = new Map(RATINGS.decks.map((r) => [r.name, r]));
/** The field every recorded letter is measured against: the rated decks (simTierFieldWords), named in each badge's title. */
export const RATED_FIELD = RATINGS.decks.length;
/** Null while ratings.json was fitted on the current simulator; else the sentence every badge's title ends with. */
export const RATINGS_VERSION_NOTE = simTierVersionNote(RATINGS.manifest);

/** The Sim tier of a deck by name, from the bundled ratings (unrated when it has no recorded tournament games). */
export const simTierFor = (name: string): SimTier => simTier(RATED.get(name));

/**
 * Whose recorded results a deck shows: a library deck its own (by name, exactly as before); a deck saved in this browser
 * those of the library deck with the same list (`twin`, preferring one with a recorded rating), or none.
 */
export function recordedSource(d: Pick<LibraryDeck, 'file' | 'deck'>, library: readonly LibraryDeck[] = BUILTIN): { name: string; file: string; twin: LibraryDeck | null } | null {
  if (!isSavedHere(d)) return { name: d.deck.name, file: d.file, twin: null };
  const twin = libraryTwin(d, library, (t) => RATED.has(t.deck.name));
  return twin ? { name: twin.deck.name, file: twin.file, twin } : null;
}

/** A deck's recorded ratings row (its own, or its library twin's), if any. */
export const recordedRow = (d: Pick<LibraryDeck, 'file' | 'deck'>) => {
  const src = recordedSource(d);
  return src ? RATED.get(src.name) : undefined;
};

/** The Sim tier of a deck: recorded results only (its own, or its library twin's). */
export const simTierOf = (d: Pick<LibraryDeck, 'file' | 'deck'>): SimTier => simTier(recordedRow(d));

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
  const text = simTierText(tier, { field: RATED_FIELD, note: RATINGS_VERSION_NOTE });
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

/**
 * The provisional tier from the visitor's own tournaments: "Yours B" with a dotted edge and an unfilled letter, so it is
 * never read as a recorded Sim tier. `showUnrated` draws "Yours –" for a list with too few games.
 */
export function YourTierBadge({ tier, showUnrated }: { tier: SimTier | null | undefined; showUnrated?: boolean }) {
  if (!tier || (!tier.letter && !showUnrated)) return null;
  const cls = tier.letter ? `t-${tier.letter}${tier.straddle ? ' is-unsure' : ''}` : 'is-unrated';
  const name = tier.letter ? `Your provisional tier ${tier.letter}${tier.straddle ? ', uncertain' : ''}, from your tournaments in this browser` : 'Your provisional tier: none yet, from your tournaments in this browser';
  return (
    <span className={`tierb tierb-yours ${cls}`} title={provisionalTierText(tier, { field: RATED_FIELD, note: RATINGS_VERSION_NOTE })}>
      <span className="tierb-src" aria-hidden="true">
        Yours
      </span>
      <span className="tierb-l" aria-hidden="true">
        {simTierShort(tier)}
      </span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Option text for a deck picker (an <option> can't hold markup): " [choom S] [Sim A±]". */
export function tierOptionText(choom: string | undefined, sim: SimTier): string {
  return `${choom ? ` [choom ${choom}]` : ''}${sim.letter ? ` [Sim ${simTierShort(sim)}]` : ''}`;
}
