// Deck objectives for library decks imported from shared links (scripts/import-links.ts, docs/DECK_IMPORT.md): decks
// other players built and shared on choom.gg or cyberpunk-tcg-sim.online, whose header's Origin starts "Imported from".
// The command-line step adds a `needs-owner` placeholder here for each deck it writes, tied to the list and naming the
// three Legends, so the test suite passes; the owner replaces it with the deck's note and sets `status: 'owner'`.
import type { ObjectiveTable } from './vocabulary';

export const IMPORTED_OBJECTIVES: ObjectiveTable = {
  // new imported decks are added above this line (scripts/import-links.ts)
};
