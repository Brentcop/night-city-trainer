// Notes for the decks retired from the active library at the 2026-11-11 baseline (docs/ROADMAP.md §1 and §4): the bred
// decks of the earlier seasons 1–5 and the builds and optimizer variants derived from the old results. Their lists are
// in data/decks/archive/ (see its README); the notes are kept as written, keyed by the archived file name, and are not
// part of DECK_OBJECTIVES, so the site never shows them and a new deck that reuses a file name (a new Season 1 deck,
// say) gets its own note. tests/deck-objectives.test.ts checks each one still matches its archived list.
import type { ObjectiveTable } from './vocabulary';
import { BRED_EARLY_OBJECTIVES } from './bredEarly';
import { BRED_LATE_OBJECTIVES } from './bredLate';
import { ARCHIVED_BUILD_OBJECTIVES } from './archivedBuilds';

export const ARCHIVED_DIR = 'data/decks/archive';

export const ARCHIVED_DECK_OBJECTIVES: ObjectiveTable = {
  ...BRED_EARLY_OBJECTIVES,
  ...BRED_LATE_OBJECTIVES,
  ...ARCHIVED_BUILD_OBJECTIVES,
};
