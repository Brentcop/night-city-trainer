// Knowledge pack: the names of the `npm run kb -- fact` answers and what each needs on the command line, apart from
// facts.ts so that reading a command line does not load the recorded-data code (src/lib/eventFacts.ts and, through
// it, the tournament rules, bots and engine). facts.ts re-exports all of this.

export const FACTS = ['champion', 'standings', 'round', 'rating', 'ratings', 'finishes', 'matchup', 'card', 'package'] as const;
export type FactName = (typeof FACTS)[number];

/**
 * What each fact needs: an event (--event), a round (--round), how many decks, whether it takes --top, and for the
 * evidence cells (step 2.4) the thing it is about (a card or a package, named by the words) and an optional --deck.
 */
export const FACT_NEEDS: Readonly<Record<FactName, { event: boolean; round: 'no' | 'optional' | 'required'; decks: 0 | 1 | 2; top?: true; subject?: 'card' | 'package' }>> = {
  champion: { event: true, round: 'no', decks: 0 },
  standings: { event: true, round: 'optional', decks: 0 },
  round: { event: true, round: 'required', decks: 0 },
  rating: { event: false, round: 'no', decks: 1 },
  ratings: { event: false, round: 'no', decks: 0, top: true },
  finishes: { event: false, round: 'no', decks: 1 },
  matchup: { event: false, round: 'no', decks: 2 },
  card: { event: false, round: 'no', decks: 0, subject: 'card' },
  package: { event: false, round: 'no', decks: 0, subject: 'package' },
};

export interface FactRequest {
  fact: FactName;
  event?: number;
  round?: string;
  /** ratings: only the first N rows (default every row) */
  top?: number;
  /** deck names as typed */
  decks: string[];
  /** card / package: the card or package as typed */
  subject?: string;
  /** card / package: the library list (--deck) as typed; absent: every list pooled */
  deck?: string;
  json: boolean;
}

/** A deck as typed → its recorded name, or the nearest names when it is not known. */
export type DeckResolver = (typed: string) => { name: string } | { nearest: string[] };

/** Names for the evidence cells: a card, a package or a library deck as typed → its pack id, or the nearest names. */
export interface StatResolver {
  card: (typed: string) => { id: string; name: string } | { nearest: string[] };
  package: (typed: string) => { id: string; name: string } | { nearest: string[] };
  /** a library deck: its file, name and list fingerprint */
  deck: (typed: string) => { file: string; name: string; listId: string } | { nearest: string[] };
}
