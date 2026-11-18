// The games a power-rating fit reads from recorded events: the ratings and head-to-heads (scripts/event-pool.ts
// `poolEvents`, behind scripts/ratings.ts and scripts/build-h2h.ts) and the upset yardstick (src/lib/eventUpsets.ts) take
// them from here, so "the same games as the ratings" is one function. Pure, Node and browser.
//
//   - Every played game of every numbered round and every bracket match counts, whatever the event's format or pairing
//     method (custom events too); a bye has no game.
//   - A deck entered twice ("X #2", src/lib/eventFormats.ts) plays as X, and its games against its own copy are left out.
//   - Events in the order given, then rounds, then the bracket, then matches and games as stored.
//   - A played event (some entrant run by a person: `setup.seats`, src/lib/playedEvent.ts) gives no games at all, its
//     bot-against-bot matches included: people's games say nothing about the bots or the lists under them.
//   - With a gate (`ListGate`; the pools pass scripts/event-pool.ts `currentListGate`), a game counts only when both
//     seats' stored lists pass it: for a library deck, the list the event or rating run recorded must be its current
//     list, so a deck whose list was edited is unrated until it plays again; a deck no longer in the library keeps
//     its games. Without a gate every game counts, as before.
import { entrantBase, isPlayedSetup, type EventSetup } from './eventFormats';
import type { RatedGame } from './ratingModel';

interface GamesMatch {
  a: string;
  b: string | null;
  games: readonly { first: 0 | 1; winner: 0 | 1 | 'tie' }[];
}

/** A stored deck list, as an event or run records it (loosely typed: a part that is missing makes the game count). */
export interface StoredList {
  legends?: readonly string[];
  main?: readonly string[];
}
/** Whether a seat's game counts: `deck` is the library deck it plays as, `list` the list the event stored for it. */
export type ListGate = (deck: string, list: StoredList | undefined) => boolean;

/** The parts of a recorded event the games are read from. */
export interface GamesEvent {
  /** the lists the event stored, by entrant name (read only with a gate) */
  decks?: Readonly<Record<string, StoredList>>;
  /** a recorded setup always lists its entrants; read here for the copies ("X #2") and who played (`seats`) */
  setup?: Partial<Pick<EventSetup, 'entrants' | 'seats'>>;
  rounds: readonly { matches: readonly GamesMatch[] }[];
  bracket: readonly { matches: readonly GamesMatch[] }[];
}

/** The rated games of one event's matches (`ratedGamesOf` for several events). */
export function eventRatedGames(e: GamesEvent, gate?: ListGate): RatedGame[] {
  const out: RatedGame[] = [];
  if (isPlayedSetup(e.setup)) return out;
  const entrants = e.setup?.entrants;
  const base = (name: string) => entrantBase(entrants ? { entrants } : null, name);
  for (const part of [...e.rounds, ...e.bracket])
    for (const m of part.matches) {
      if (!m.b) continue;
      const a = base(m.a);
      const b = base(m.b);
      if (a === b) continue;
      if (gate && !(gate(a, e.decks?.[m.a]) && gate(b, e.decks?.[m.b]))) continue;
      for (const g of m.games) out.push({ a, b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 });
    }
  return out;
}

/** Every rated game of these events, in their order: a's score is 1, ½ (a tie) or 0. */
export function ratedGamesOf(events: readonly GamesEvent[], gate?: ListGate): RatedGame[] {
  return events.flatMap((e) => eventRatedGames(e, gate));
}
