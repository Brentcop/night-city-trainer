// Typed view of tournaments.json, the index of recorded events (about 145 KB; see src/data/index.ts). The Events page
// and the deck profile import it; the Deck Lab only needs the count and loads it on demand (recordedEventCount).
import tournamentsJson from './tournaments.json';
import type { TournamentIndex } from './index';

export const TOURNAMENT_INDEX = tournamentsJson as unknown as TournamentIndex;
