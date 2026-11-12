// Pools recorded tournament events for the power ratings (scripts/ratings.ts): every game for the fit, and tournament
// results (events, titles, top 8s, finishes, match records) from standard events only. Pure, so it is tested directly.
//
//   - Games: every recorded event counts, whatever its format or pairing method (custom events too). A deck entered
//     twice ("X #2", src/lib/eventFormats.ts) plays as X; its games against its own copy are left out.
//   - Results: an event flagged `custom` (another format, or pairings or seeds set by hand) is skipped, so titles, top-8
//     counts, finishes and Swiss records come only from standard Swiss events.
import { entrantBase, type EventSetup } from '../src/lib/eventFormats';

/** The parts of a recorded event the pool reads. */
export interface PoolEvent {
  champion: string | null;
  custom?: boolean;
  setup?: Pick<EventSetup, 'entrants'>;
  standings: { deck: string; mw: number; ml: number; gw: number; gl: number }[];
  rounds: { matches: { a: string; b: string | null; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
  bracket: { matches: { a: string; b: string | null; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
}
export interface PooledGame {
  a: string;
  b: string;
  first: 0 | 1;
  /** score for a: 1, 0.5, 0 */
  s: number;
}
export interface DeckResults {
  events: number;
  titles: number;
  top8: number;
  finishes: number[];
  mw: number;
  ml: number;
  gw: number;
  gl: number;
}

export function poolEvents(events: readonly PoolEvent[]): { games: PooledGame[]; results: Record<string, DeckResults>; customEvents: number } {
  const games: PooledGame[] = [];
  const results: Record<string, DeckResults> = {};
  let customEvents = 0;
  for (const e of events) {
    const n = e.standings.length;
    const base = (name: string) => entrantBase(e.setup, name);
    if (e.custom) customEvents++;
    else {
      e.standings.forEach((s, i) => {
        const r = (results[base(s.deck)] ??= { events: 0, titles: 0, top8: 0, finishes: [], mw: 0, ml: 0, gw: 0, gl: 0 });
        r.events++;
        r.finishes.push(1 - i / Math.max(1, n - 1));
        if (i < 8) r.top8++;
        r.mw += s.mw;
        r.ml += s.ml;
        r.gw += s.gw;
        r.gl += s.gl;
      });
      const champ = e.champion ? results[base(e.champion)] : undefined;
      if (champ) champ.titles++;
    }
    for (const part of [...e.rounds, ...e.bracket])
      for (const m of part.matches) {
        if (!m.b) continue;
        const a = base(m.a);
        const b = base(m.b);
        if (a === b) continue;
        for (const g of m.games) games.push({ a, b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 });
      }
  }
  return { games, results, customEvents };
}
