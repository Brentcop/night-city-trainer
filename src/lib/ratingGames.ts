// The games a power-rating fit reads from recorded events: the ratings and head-to-heads (scripts/event-pool.ts
// `poolEvents`, behind scripts/ratings.ts and scripts/build-h2h.ts) and the upset yardstick (src/lib/eventUpsets.ts) take
// them from here, so "the same games as the ratings" is one function. Pure, Node and browser.
//
//   - Every played game of every numbered round and every bracket match counts, whatever the event's format or pairing
//     method (custom events too); a bye has no game.
//   - A deck entered twice ("X #2", src/lib/eventFormats.ts) plays as X, and its games against its own copy are left out.
//   - Events in the order given, then rounds, then the bracket, then matches and games as stored.
import { entrantBase, type EventSetup } from './eventFormats';
import type { RatedGame } from './ratingModel';

interface GamesMatch {
  a: string;
  b: string | null;
  games: readonly { first: 0 | 1; winner: 0 | 1 | 'tie' }[];
}

/** The parts of a recorded event the games are read from. */
export interface GamesEvent {
  /** a recorded setup always lists its entrants; read here only for the copies ("X #2") */
  setup?: Partial<Pick<EventSetup, 'entrants'>>;
  rounds: readonly { matches: readonly GamesMatch[] }[];
  bracket: readonly { matches: readonly GamesMatch[] }[];
}

/** The rated games of one event's matches (`ratedGamesOf` for several events). */
export function eventRatedGames(e: GamesEvent): RatedGame[] {
  const out: RatedGame[] = [];
  const entrants = e.setup?.entrants;
  const base = (name: string) => entrantBase(entrants ? { entrants } : null, name);
  for (const part of [...e.rounds, ...e.bracket])
    for (const m of part.matches) {
      if (!m.b) continue;
      const a = base(m.a);
      const b = base(m.b);
      if (a === b) continue;
      for (const g of m.games) out.push({ a, b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 });
    }
  return out;
}

/** Every rated game of these events, in their order: a's score is 1, ½ (a tie) or 0. */
export function ratedGamesOf(events: readonly GamesEvent[]): RatedGame[] {
  return events.flatMap(eventRatedGames);
}
