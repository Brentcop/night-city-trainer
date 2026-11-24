// The heavier half of "your tournaments" (src/ui/useYourStats.ts loads it on demand, so the rating maths stays out of the
// entry chunk): the provisional ratings of your unrated lists against the recorded decks, and the one-time fold of the
// runner's saved runs into the ledger.
import { RATINGS } from '../data/index';
import { BUILTIN } from '../lib/browserLibrary';
import { listOf } from '../lib/listTwin';
import { parseLedger } from '../lib/runLedger';
import { provisionalRatings, type Provisional, type RecordedDeck } from '../lib/yourStats';
import { byName } from './deckLookup';

export { migrateSavedRuns } from '../lib/runLedgerEntry';

let recorded: RecordedDeck[] | null = null;
/** Every deck with a recorded rating, with its library list (a rated name with no library deck keeps a stand-in key). */
export function recordedDecks(): RecordedDeck[] {
  if (!recorded) {
    const lib = byName(BUILTIN);
    recorded = RATINGS.decks.map((r) => {
      const d = lib.get(r.name);
      return { name: r.name, list: d ? listOf(d.deck) : `name:${r.name}`, rating: r.rating, wrField: r.wrField };
    });
  }
  return recorded;
}

let memo: { raw: string | null; value: Map<string, Provisional> } | null = null;
/** The provisional ratings for the ledger's stored text (remembered for the last text). */
export function provisionalFor(raw: string | null): Map<string, Provisional> {
  if (!memo || memo.raw !== raw) memo = { raw, value: provisionalRatings(parseLedger(raw), { recorded: recordedDecks(), firstPlayerEdge: RATINGS.firstPlayerEdge, ...(RATINGS.priorSd !== undefined ? { priorSd: RATINGS.priorSd } : {}) }) };
  return memo.value;
}
