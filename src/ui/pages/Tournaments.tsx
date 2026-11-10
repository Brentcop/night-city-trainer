// Tournament history: every simulated event (Swiss Bo3 + top-8 bracket), with standings, round results and game replays.
import { useEffect, useState } from 'react';
import index from '../../data/tournaments.json';
import type { GameRec } from '../../lib/tournament';
import { tierLabel } from '../../ai/tiers';
import { Bracket, Champion, MatchModal, RoundList, StandingsTable, useLib, short, type MatchView } from '../components/TourneyViews';

interface EventLite {
  id: number;
  date: string;
  bot: string;
  format: string;
  champion: string;
  entrants: number;
  games: number;
  top8: { deck: string; mp: number; record: string; omw: number }[];
  bracket: { name: string; matches: MatchView[] }[];
  standings: { deck: string; mp: number; record: string; games: string; omw: number }[];
}
interface EventFull {
  id: number;
  bot: string;
  decks: Record<string, { file: string; legends: string[]; main: string[] }>;
  rounds: { round: number; matches: (MatchView & { games: GameRec[] })[] }[];
  bracket: { name: string; matches: (MatchView & { games: GameRec[] })[] }[];
}

const I = index as unknown as { updated: string; events: EventLite[] };

export function TournamentsPage({ initial }: { initial?: string }) {
  const lib = useLib();
  const [sel, setSel] = useState<number | undefined>(initial ? +initial : I.events[I.events.length - 1]?.id);
  const ev = I.events.find((e) => e.id === sel);
  const [full, setFull] = useState<EventFull | null>(null);
  const [match, setMatch] = useState<(MatchView & { games: GameRec[] }) | null>(null);
  useEffect(() => {
    setFull(null);
    if (sel === undefined) return;
    fetch(`${import.meta.env.BASE_URL}tournaments/event-${sel}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setFull)
      .catch(() => setFull(null));
  }, [sel]);

  const runLink = (
    <a href="#/run">
      <button className="primary">▶ Run your own tournament</button>
    </a>
  );
  if (!I.events.length)
    return (
      <div className="panel">
        <h1>Tournaments</h1>
        <p className="muted">No recorded events yet. Run one live in your browser, or from the CLI with <code>npx tsx scripts/tournament.ts</code>.</p>
        {runLink}
      </div>
    );
  const titles = new Map<string, number>();
  for (const e of I.events) titles.set(e.champion, (titles.get(e.champion) ?? 0) + 1);
  const openMatch = (m: MatchView) => {
    if (!full) return;
    for (const part of [...full.bracket, ...full.rounds]) {
      const x = part.matches.find((y) => y.a === m.a && y.b === m.b);
      if (x) return setMatch(x);
    }
  };
  return (
    <div className="grid">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Tournament history</h1>
        {runLink}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {I.events.length} events · {I.events.reduce((a, e) => a + e.games, 0).toLocaleString()} games · every deck in the library. Each event is Swiss
        rounds of best-of-3 matches (the loser of a game goes first next game), then a top-8 single-elimination bracket. Click a match to watch its games.
      </p>

      <div className="event-strip">
        {I.events.map((e) => (
          <button key={e.id} className={`event-chip ${e.id === sel ? 'on' : ''}`} onClick={() => setSel(e.id)}>
            <b>#{e.id}</b>
            <span>{short(e.champion, 22)}</span>
          </button>
        ))}
      </div>

      {ev && (
        <>
          <div className="panel">
            <div className="spread">
              <h2 style={{ margin: 0 }}>Event #{ev.id}</h2>
              <span className="muted small">
                {ev.format} · {ev.entrants} decks · {ev.games} games · {tierLabel(ev.bot)} bots
              </span>
            </div>
            <Champion name={ev.champion} lib={lib} note={`${titles.get(ev.champion) ?? 1} title${(titles.get(ev.champion) ?? 1) > 1 ? 's' : ''} across all events`} />
            <Bracket rounds={ev.bracket} size={2 ** ev.bracket.length} seeds={ev.top8.map((t) => t.deck)} champion={ev.champion} lib={lib} onOpen={openMatch} />
          </div>

          <div className="grid cols-2">
            <div className="panel scroll-x">
              <h3 style={{ marginTop: 0 }}>Swiss standings</h3>
              <StandingsTable rows={ev.standings} cut={ev.top8.length} lib={lib} />
            </div>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Rounds</h3>
              {!full && <p className="muted small">Loading round details…</p>}
              {full && <RoundList rounds={full.rounds} onOpen={(m) => m.games && setMatch(m as MatchView & { games: GameRec[] })} />}
            </div>
          </div>
        </>
      )}
      {match && full && <MatchModal m={match} decks={full.decks} bot={full.bot} lib={lib} onClose={() => setMatch(null)} />}
    </div>
  );
}
