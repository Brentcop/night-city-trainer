// Deck objectives: a short strategy note per library deck (objective, plan, key cards, success signals), tied to the
// list it was written for. The owner corrects them by editing the tables in this folder and setting `status: 'owner'`
// (see vocabulary.ts for the fields and the shared signal vocabulary). Only the deck profile imports this module, so it
// stays in the profile's lazy chunk.
import { listFingerprint } from '../../engine/deck';
import type { DeckList } from '../../engine/types';
import { CHOOM_GUIDE_OBJECTIVES } from './choomGuides';
import { STRATEGY_PAGE_OBJECTIVES } from './strategyPage';
import { LADDER_OBJECTIVES } from './ladder';
import { SEASON_OBJECTIVES } from './seasons';
import type { DeckObjective, ObjectiveTable } from './vocabulary';

export * from './vocabulary';

/**
 * Notes for every deck in the active library. The decks archived at the 2026-11-11 baseline keep their notes in
 * ./archived.ts (ARCHIVED_DECK_OBJECTIVES), which is not part of this table.
 */
export const DECK_OBJECTIVES: ObjectiveTable = {
  ...CHOOM_GUIDE_OBJECTIVES,
  ...STRATEGY_PAGE_OBJECTIVES,
  ...SEASON_OBJECTIVES,
  ...LADDER_OBJECTIVES,
};

/**
 * The library decks the owner brought in, whose notes the owner writes: the sim-ladder decks (Legend trios from the
 * owner's Master-ladder screenshot; origin "cyberpunk-tcg-sim.online …", gallery group "Sim ladder"). An entry is a
 * `needs-owner` placeholder, a `draft` read off the list, or the owner's note (the five current ones are agent-written
 * drafts the owner asked for). Decks saved in the browser ("My decks") have no entry at all.
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
