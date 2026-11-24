// Notes for the decks retired from the active library at the 2026-11-11 baseline (docs/ROADMAP.md §1 and §4): the bred
// decks of the earlier seasons 1–5 and the builds and optimizer variants derived from the old results. Their lists are
// in data/decks/archive/ (see its README); the notes are kept as written, keyed by the archived file name, and are not
// part of DECK_OBJECTIVES, so the site never shows them and a new deck that reuses a file name (a new Season 1 deck,
// say) gets its own note. tests/deck-objectives.test.ts checks each one still matches its archived list.
import type { DeckObjective, ObjectiveTable } from './vocabulary';
import { BRED_EARLY_OBJECTIVES } from './bredEarly';
import { BRED_LATE_OBJECTIVES } from './bredLate';
import { ARCHIVED_BUILD_OBJECTIVES } from './archivedBuilds';

export const ARCHIVED_DIR = 'data/decks/archive';

/** The line a retirement inserts its notes above (scripts/season-retire.ts); keep it as the table's last line. */
export const RETIRED_MARKER = '// retired notes go above this line (scripts/season-retire.ts)';

/**
 * The note of a retired deck that never had one: a deck a season retired at its own end, before anyone wrote its note
 * (scripts/season-retire.ts). One line in the table below, like an imported deck's placeholder.
 */
export function retiredPlaceholder(listId: string, legends: readonly string[]): DeckObjective {
  return {
    listId,
    objective: 'Placeholder: a bred deck retired at the end of its own season, before a note was written.',
    plan: [
      { phase: 'early', text: 'Placeholder: no note was written; the list is kept for the record.' },
      { phase: 'closing', text: 'Placeholder: no note was written; the list is kept for the record.' },
    ],
    keyCards: [...new Set(legends)].map((id) => ({ id, role: 'Legend.' })),
    signals: [
      { text: 'A Unit on curve by round 2', terms: ['unit-on-curve', 'round'] },
      { text: 'The first Gig stolen by round 4', terms: ['first-steal', 'round'] },
    ],
    risks: [],
    source: 'list',
    status: 'needs-owner',
    placeholder: true,
  };
}

/**
 * Notes of the bred decks a season retired (scripts/season-retire.ts, since 2026-11-24): a bred deck whose 90% range on
 * the win rate against the library lies wholly below the meta decks' median is moved to data/decks/archive/ as
 * `<file stem>-v<simulator version>.txt` (an earlier season may have used its file name). By default a season retires
 * only the decks it bred itself, at its end (they have no note yet: a retiredPlaceholder line); with --retire-earlier
 * also earlier seasons' decks, whose notes move here from ./seasons.ts. Each is keyed by the archived file, with one
 * comment line saying when and why. None so far.
 */
export const RETIRED_OBJECTIVES: ObjectiveTable = {
  // retired notes go above this line (scripts/season-retire.ts)
};

export const ARCHIVED_DECK_OBJECTIVES: ObjectiveTable = {
  ...BRED_EARLY_OBJECTIVES,
  ...BRED_LATE_OBJECTIVES,
  ...ARCHIVED_BUILD_OBJECTIVES,
  ...RETIRED_OBJECTIVES,
};
