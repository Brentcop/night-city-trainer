// "By deck": an event's results put together per deck, for an event where a deck was entered more than once ("X" and
// "X #2", src/lib/entrants.ts). Every finished match of the rounds and the bracket counts. A match between two entries
// of the same deck is a mirror match: it is counted apart and never in the deck's record, because it says nothing about
// the deck's strength (the ratings and "Your tournaments" leave those games out too, src/lib/ratingGames.ts). Pure.

interface MatchLike {
  a: string;
  b: string | null;
  winner: string;
  live?: boolean;
  games?: readonly { winner: 0 | 1 | 'tie' }[];
}

/** The parts of an event (a run, or a recorded event file) the summary reads. */
export interface ByDeckEvent {
  rounds: readonly { matches: readonly MatchLike[] }[];
  bracket: readonly { name: string; matches: readonly MatchLike[] }[];
  /** best first */
  standings: readonly { deck: string }[];
  champion: string | null;
  /** every entrant's name, in the event's order */
  entrants: readonly string[];
}

export type BestFinish =
  | { kind: 'champion'; entry: string }
  | { kind: 'bracket'; entry: string; round: string }
  | { kind: 'place'; entry: string; place: number; of: number };

export interface ByDeckRow {
  deck: string;
  /** its entries, in the event's order */
  entries: string[];
  /** finished matches against other decks */
  matches: { won: number; lost: number };
  /** rounds an entry had no opponent (a bye) */
  byes: number;
  /** games of those matches */
  games: { won: number; lost: number; tied: number };
  /** matches and games between two of its own entries, counted apart */
  mirror: { matches: number; games: number };
  best: BestFinish | null;
}

/** One row per deck with two or more entries, in the order its first entry appears. `base` names an entrant's deck. */
export function byDeck(ev: ByDeckEvent, base: (name: string) => string): ByDeckRow[] {
  const entries = new Map<string, string[]>();
  for (const name of ev.entrants) {
    const b = base(name);
    const list = entries.get(b) ?? [];
    if (!list.includes(name)) list.push(name);
    entries.set(b, list);
  }
  const rows = new Map<string, ByDeckRow>();
  for (const [deck, list] of entries)
    if (list.length >= 2) rows.set(deck, { deck, entries: list, matches: { won: 0, lost: 0 }, byes: 0, games: { won: 0, lost: 0, tied: 0 }, mirror: { matches: 0, games: 0 }, best: null });
  if (!rows.size) return [];

  for (const m of [...ev.rounds, ...ev.bracket].flatMap((p) => p.matches)) {
    if (m.live || !m.winner) continue;
    if (m.b === null) {
      const r = rows.get(base(m.a));
      if (r) r.byes++;
      continue;
    }
    const games = m.games ?? [];
    const da = base(m.a);
    const db = base(m.b);
    if (da === db) {
      const r = rows.get(da);
      if (r) (r.mirror.matches++, (r.mirror.games += games.length));
      continue;
    }
    for (const [side, d] of [
      [0, da],
      [1, db],
    ] as const) {
      const r = rows.get(d);
      if (!r) continue;
      if (m.winner === (side === 0 ? m.a : m.b)) r.matches.won++;
      else r.matches.lost++;
      for (const g of games) {
        if (g.winner === 'tie') r.games.tied++;
        else if (g.winner === side) r.games.won++;
        else r.games.lost++;
      }
    }
  }

  // best finish: the title, else the furthest bracket round an entry reached, else the best place in the standings
  for (const r of rows.values()) {
    const mine = (n: string | null) => n !== null && r.entries.includes(n);
    if (mine(ev.champion)) {
      r.best = { kind: 'champion', entry: ev.champion! };
      continue;
    }
    for (let i = ev.bracket.length - 1; i >= 0 && !r.best; i--) {
      const part = ev.bracket[i]!;
      const entry = r.entries.find((e) => part.matches.some((m) => m.a === e || m.b === e));
      if (entry) r.best = { kind: 'bracket', entry, round: part.name };
    }
    if (r.best) continue;
    const place = ev.standings.findIndex((s) => mine(s.deck));
    if (place >= 0) r.best = { kind: 'place', entry: ev.standings[place]!.deck, place: place + 1, of: ev.standings.length };
  }
  return [...rows.values()];
}

/** Wins-losses as the standings write them ("5-3"), with ties as a third number when there are any ("5-3-1"). */
export const recordText = (w: number, l: number, t = 0) => `${w}-${l}${t ? `-${t}` : ''}`;
