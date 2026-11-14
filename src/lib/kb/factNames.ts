// Knowledge pack: the names of the `npm run kb -- fact` answers and what each needs on the command line, apart from
// facts.ts so that reading a command line does not load the recorded-data code (src/lib/eventFacts.ts and, through
// it, the tournament rules, bots and engine). facts.ts re-exports all of this.

export const FACTS = ['champion', 'standings', 'round', 'rating', 'ratings', 'finishes', 'matchup'] as const;
export type FactName = (typeof FACTS)[number];

/** What each fact needs: an event (--event), a round (--round), how many decks, and whether it takes --top. */
export const FACT_NEEDS: Readonly<Record<FactName, { event: boolean; round: 'no' | 'optional' | 'required'; decks: 0 | 1 | 2; top?: true }>> = {
  champion: { event: true, round: 'no', decks: 0 },
  standings: { event: true, round: 'optional', decks: 0 },
  round: { event: true, round: 'required', decks: 0 },
  rating: { event: false, round: 'no', decks: 1 },
  ratings: { event: false, round: 'no', decks: 0, top: true },
  finishes: { event: false, round: 'no', decks: 1 },
  matchup: { event: false, round: 'no', decks: 2 },
};

export interface FactRequest {
  fact: FactName;
  event?: number;
  round?: string;
  /** ratings: only the first N rows (default every row) */
  top?: number;
  /** deck names as typed */
  decks: string[];
  json: boolean;
}

/** A deck as typed → its recorded name, or the nearest names when it is not known. */
export type DeckResolver = (typed: string) => { name: string } | { nearest: string[] };
