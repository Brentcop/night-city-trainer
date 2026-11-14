// Tournament history: every recorded event, with standings, round results and game replays. Most are Swiss Bo3 + a top-8
// bracket; events in other formats or with pairings set by hand (src/lib/eventFormats.ts) are marked "custom" and shown
// in their own shape (round-robin table, match list, bracket without Swiss). Titles here count standard events only.
// An event's header offers "Run this event again" (components/RerunEvent.tsx): the runner opened with its own setup.
import { useEffect, useMemo, useState } from 'react';
import index from '../../data/tournaments.json';
import { arrangedNote, type EventSetup, type GameRec } from '../../lib/tournament';
import { tierLabel } from '../../ai/tiers';
import { parseEventId } from '../runParams';
import { PageHead } from '../components/PageHead';
import { CURRENT_SIM_VERSION, isHistorical } from '../../lib/playedRecord';
import { Bracket, Champion, GroupTables, MatchModal, RoundList, StandingsTable, standingsTitle, useLib, short, type MatchView } from '../components/TourneyViews';
import { RecordedAt } from '../components/RecordedAt';
import { IfPage } from '../components/SiteChrome';
import { RerunEvent } from '../components/RerunEvent';
import { allDecks } from '../../lib/browserLibrary';
import type { RecordedEvent } from '../eventRerun';

interface EventLite {
  id: number;
  date: string;
  simVersion?: number;
  bot: string;
  format: string;
  /** another format, or pairings set by hand: not counted for titles */
  custom?: boolean;
  /** the format of a non-Swiss event */
  kind?: string;
  champion: string | null;
  entrants: number;
  games: number;
  top8: { deck: string; mp: number; record: string; omw: number }[];
  bracket: { name: string; matches: MatchView[] }[];
  standings: { deck: string; mp: number; record: string; games: string; omw: number }[];
}
interface EventFull extends RecordedEvent {
  id: number;
  bot: string;
  decks: Record<string, { file: string; legends: string[]; main: string[] }>;
  rounds: { round: number; matches: (MatchView & { games: GameRec[] })[] }[];
  bracket: { name: string; matches: (MatchView & { games: GameRec[] })[] }[];
  setup?: EventSetup;
  groups?: { name: string; decks: string[] }[];
}

const I = index as unknown as { updated: string; events: EventLite[] };

export function TournamentsPage({ initial }: { initial?: string }) {
  const lib = useLib();
  const library = useMemo(() => allDecks(), []);
  // ?e= must name a recorded event; anything else (missing, `abc`, unknown id) opens the latest one
  const [sel, setSel] = useState<number | undefined>(() => parseEventId(initial, I.events.map((e) => e.id)) ?? I.events[I.events.length - 1]?.id);
  const ev = I.events.find((e) => e.id === sel);
  // round details for the selected event; tagged with its id so a slow load for event A never shows under B
  const [loaded, setLoaded] = useState<{ id: number; full: EventFull | null; error?: string } | null>(null);
  const full = loaded && loaded.id === sel ? loaded.full : null;
  const loadError = loaded && loaded.id === sel ? loaded.error : undefined;
  const [match, setMatch] = useState<(MatchView & { games: GameRec[] }) | null>(null);
  useEffect(() => {
    setMatch(null);
    if (sel === undefined) return;
    let stale = false;
    fetch(`${import.meta.env.BASE_URL}tournaments/event-${sel}.json`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<EventFull>;
      })
      .then((f) => {
        if (stale) return;
        const ok = !!f && Array.isArray(f.rounds) && !!f.decks && typeof f.decks === 'object';
        setLoaded(ok ? { id: sel, full: { ...f, bracket: Array.isArray(f.bracket) ? f.bracket : [] } } : { id: sel, full: null, error: 'the event file is malformed' });
      })
      .catch((e) => {
        if (!stale) setLoaded({ id: sel, full: null, error: String((e as Error)?.message ?? e) });
      });
    return () => {
      stale = true;
    };
  }, [sel]);

  const runLink = (
    <IfPage path="run">
      <a className="btn primary" href="#/run">
        ▶ Run your own tournament
      </a>
    </IfPage>
  );
  if (!I.events.length)
    return (
      <div className="grid">
        <PageHead kicker="Tournaments" title="Tournament history" actions={runLink} />
        <div className="empty-state">
          <p>No recorded events yet. <span title="For the site owner: npx tsx scripts/tournament.ts records one">Run one live in your browser.</span></p>
        </div>
      </div>
    );
  const historical = I.events.filter((e) => isHistorical(e.simVersion)).length;
  // titles count standard events only: a custom event's winner played a format or pairings set by hand
  const titles = new Map<string, number>();
  for (const e of I.events) if (!e.custom && e.champion) titles.set(e.champion, (titles.get(e.champion) ?? 0) + 1);
  const customCount = I.events.filter((e) => e.custom).length;
  const openMatch = (m: MatchView) => {
    if (!full) return;
    for (const part of [...full.bracket, ...full.rounds]) {
      const x = part.matches.find((y) => y.a === m.a && y.b === m.b);
      if (x) return setMatch(x);
    }
  };
  return (
    <div className="grid">
      <PageHead kicker="Tournaments" title="Tournament history" actions={runLink}>
        {I.events.length} events · {I.events.reduce((a, e) => a + e.games, 0).toLocaleString()} games · every deck in the library. A standard event is Swiss
        rounds of best-of-3 matches (the loser of a game goes first next game), then a top-8 single-elimination bracket. Click a match to watch its games.
        {customCount > 0 && (
          <>
            {' '}
            {customCount} {customCount === 1 ? 'event is' : 'events are'} marked <b>custom</b> (another format, or pairings set by hand): their games count for ratings and
            head-to-heads, but not for titles, top 8s or Swiss records.
          </>
        )}
        <RecordedAt iso={I.events[I.events.length - 1]?.date} prefix=" The latest was recorded " suffix="." />
        {historical > 0 && (
          <>
            {' '}
            {historical === I.events.length ? 'All' : historical} of these events were recorded before the current simulator (v{CURRENT_SIM_VERSION}): their games no longer replay
            exactly.
          </>
        )}
      </PageHead>

      <div className="event-strip">
        {I.events.map((e) => (
          <button key={e.id} className={`event-chip ${e.id === sel ? 'on' : ''}`} aria-pressed={e.id === sel} onClick={() => setSel(e.id)}>
            <b>
              #{e.id}
              {e.custom && <span className="tag ev-set">custom</span>}
            </b>
            <span>{e.champion ? short(e.champion, 22) : 'no champion'}</span>
            <RecordedAt iso={e.date} className="muted" />
          </button>
        ))}
      </div>

      {ev && (
        <>
          <div className="panel flair">
            <div className="spread">
              <h2 style={{ margin: 0 }}>
                Event #{ev.id} {ev.custom && <span className="tag ev-set">custom</span>}
              </h2>
              <span className="muted small">
                {ev.format} · {ev.entrants} decks · {ev.games} games · {tierLabel(ev.bot)} bots
                <RecordedAt iso={ev.date} prefix=" · recorded " />
              </span>
            </div>
            {full && <RerunEvent event={full} lib={library} />}
            {full?.setup && arrangedNote(full.setup) && <p className="small muted">{arrangedNote(full.setup)} Its games count for ratings; it is not counted for titles or top 8s.</p>}
            {ev.champion && (
              <Champion
                name={ev.champion}
                lib={lib}
                note={ev.custom ? 'custom event: not counted as a title' : `${titles.get(ev.champion) ?? 1} title${(titles.get(ev.champion) ?? 1) > 1 ? 's' : ''} across standard events`}
                list={full?.decks[ev.champion]}
              />
            )}
            {ev.bracket.length > 0 && (
              <Bracket rounds={ev.bracket} size={2 ** ev.bracket.length} seeds={ev.kind ? [] : ev.top8.map((t) => t.deck)} champion={ev.champion} lib={lib} onOpen={openMatch} />
            )}
          </div>

          <div className="grid cols-2">
            <div className="panel scroll-x">
              <h3 style={{ marginTop: 0 }}>{ev.kind ? standingsTitle(ev.kind, true) : 'Swiss standings'}</h3>
              {full?.groups ? (
                <GroupTables groups={full.groups} rows={ev.standings} advance={full.setup?.advance ?? 0} lib={lib} />
              ) : (
                <StandingsTable rows={ev.standings} cut={ev.kind ? 0 : ev.top8.length} lib={lib} tiers />
              )}
              <p className="small muted" style={{ marginBottom: 0 }}>
                Sim: each deck’s tier now, from every recorded event (not only this one). <a href="#/ratings">How tiers work</a>
              </p>
            </div>
            <div className="panel">
              <h3 style={{ marginTop: 0 }}>Rounds</h3>
              {!full && !loadError && <p className="muted small">Loading round details…</p>}
              {loadError && <p className="small" style={{ color: 'var(--red)' }}>Couldn't load this event's round details ({loadError}). Standings and bracket above are still correct.</p>}
              {full && (full.rounds.length ? <RoundList rounds={full.rounds} onOpen={(m) => m.games && setMatch(m as MatchView & { games: GameRec[] })} /> : <p className="muted small">A bracket only: every match is in the bracket above.</p>)}
            </div>
          </div>
        </>
      )}
      {match && full && <MatchModal m={match} decks={full.decks} bot={full.bot} lib={lib} onClose={() => setMatch(null)} />}
    </div>
  );
}
