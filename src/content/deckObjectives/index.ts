// Deck objectives: a short strategy note per library deck (objective, plan, key cards, success signals), tied to the
// list it was written for. The owner corrects them by editing the tables in this folder and setting `status: 'owner'`
// (see vocabulary.ts for the fields and the shared signal vocabulary). Only the deck profile imports this module, so it
// stays in the profile's lazy chunk.
import { listFingerprint } from '../../engine/deck';
import type { DeckList } from '../../engine/types';
import { CHOOM_GUIDE_OBJECTIVES } from './choomGuides';
import { STRATEGY_PAGE_OBJECTIVES } from './strategyPage';
import { BRED_EARLY_OBJECTIVES } from './bredEarly';
import { BRED_LATE_OBJECTIVES } from './bredLate';
import { LADDER_OBJECTIVES } from './ladder';
import type { DeckObjective, ObjectiveTable } from './vocabulary';

export * from './vocabulary';

export const DECK_OBJECTIVES: ObjectiveTable = {
  ...CHOOM_GUIDE_OBJECTIVES,
  ...STRATEGY_PAGE_OBJECTIVES,
  ...BRED_EARLY_OBJECTIVES,
  ...BRED_LATE_OBJECTIVES,
  ...LADDER_OBJECTIVES,
};

/**
 * The library decks the owner brought in, whose notes the owner writes: the sim-ladder decks (Legend trios from the
 * owner's Master-ladder screenshot; origin "cyberpunk-tcg-sim.online …", gallery group "Sim ladder"). Their entries are
 * `needs-owner` placeholders until then. Decks saved in the browser ("My decks") have no entry at all.
 */
export function isOwnerImport(prov: { origin?: string }): boolean {
  return (prov.origin ?? '').startsWith('cyberpunk-tcg-sim.online');
}

export interface ObjectiveLookup {
  note: DeckObjective;
  /** false when the deck's current list differs from the one the note was written for */
  current: boolean;
}

export function objectiveFor(file: string, deck: Pick<DeckList, 'legends' | 'main'>): ObjectiveLookup | null {
  const note = DECK_OBJECTIVES[file];
  return note ? { note, current: note.listId === listFingerprint(deck) } : null;
}
