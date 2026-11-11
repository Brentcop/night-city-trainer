// A deck's recorded results, shown first on its profile: tournament games and win rate, seat split, record against
// the meta, best and worst matchups, event finishes and power rank, each with its sample size. Small samples are
// marked the `.num.thin` way and say so; a deck with nothing recorded says that plainly; numbers recorded before the
// current simulator get a one-line note. The summary itself is src/lib/deckRecord.ts.
import { useEffect, useState } from 'react';
import { RATINGS, SEASONS } from '../../data/index';
import { TOURNAMENT_INDEX } from '../../data/tournamentIndex';
import { ANALYSIS, telemetryReport } from '../../data/analysisData';
import { deckReports, reportsSimVersion } from '../../data/deckReportsData';
import { deckStats, pct, statsName } from '../../lib/deckStats';
import type { LibraryDeck } from '../../lib/library';
import { CURRENT_SIM_VERSION, SMALL_SAMPLE, deckRecord, h2hFor, ordinal, type DeckRecord, type H2HFile, type MatchLine } from '../../lib/deckRecord';
import { profileHref } from './DeckStats';
import { wrTone } from './Num';

const EVENTS = TOURNAMENT_INDEX.events;
// every source's sim version comes from the data itself, so the "historical" note returns on its own when SIM_VERSION
// moves past what is recorded; deckReports.json carries each finals / head-to-head report's version (reportsSimVersion)
const VERSIONS = { telemetry: ANALYSIS.manifest?.simVersion, seasons: SEASONS.manifest?.simVersion };

// tournament head-to-heads (public/data/h2h.json): fetched once, only when a profile needs them
let h2hFile: Promise<H2HFile | null> | null = null;
function loadEventH2H(): Promise<H2HFile | null> {
  h2hFile ??= fetch(`${import.meta.env.BASE_URL}data/h2h.json`)
    .then((r) => (r.ok ? (r.json() as Promise<H2HFile>) : null))
    .then((f) => (f && Array.isArray(f.decks) && Array.isArray(f.pairs) ? f : null))
    .catch(() => null);
  return h2hFile;
}

/** The record for a library deck from every bundled source (tournament head-to-heads passed in once loaded). */
export function recordFor(d: Pick<LibraryDeck, 'file' | 'deck'>, eventH2H?: MatchLine[]): DeckRecord {
  const st = deckStats(d.file);
  const rep = deckReports(d.file);
  return deckRecord({
    name: d.deck.name,
    ratings: RATINGS,
    events: EVENTS,
    finals: rep.finals,
    h2h: rep.h2h,
    eventH2H,
    telemetry: telemetryReport(statsName(d.file)),
    leader: st.leader && { rank: st.leader.rank, of: st.leader.of, rating: st.leader.rating, vsMeta: st.leader.vsMeta, metaG: st.leader.metaG, percentile: st.leader.percentile },
    versions: { ...VERSIONS, reports: reportsSimVersion(rep) },
    simVersion: CURRENT_SIM_VERSION,
  });
}

/** A number with its sample: underlined dotted and labelled when the sample is small. */
function Sampled({ text, n, tone }: { text: string; n: number | null; tone?: 'pos' | 'neu' | 'neg' }) {
  const thin = n !== null && n < SMALL_SAMPLE;
  return <span className={`num ${tone ?? ''} ${thin ? 'thin' : ''}`}>{text}</span>;
}
const games = (n: number) => `${n.toLocaleString()} game${n === 1 ? '' : 's'}`;
const small = (n: number | null) => (n !== null && n < SMALL_SAMPLE ? ' (small sample)' : '');

function Tile({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="rec-tile">
      <div className="rec-tile-label">{label}</div>
      <div className="rec-tile-val">{value}</div>
      {children && <div className="rec-tile-cap">{children}</div>}
    </div>
  );
}

function Opp({ m }: { m: MatchLine }) {
  return m.oppFile ? <a href={profileHref(m.oppFile)}>{m.opp}</a> : <>{m.opp}</>;
}

const MATCHUP_SOURCE: Record<NonNullable<DeckRecord['matchups']>['source'], string> = {
  finals: 'vs the choom.gg meta archetypes (finals)',
  h2h: 'from dedicated head-to-head runs',
  events: `from tournament games (pairings with at least 6 games)`,
};

export function DeckRecordPanel({ d, headingId }: { d: Pick<LibraryDeck, 'file' | 'deck'>; headingId: string }) {
  const [eventH2H, setEventH2H] = useState<MatchLine[] | undefined>(undefined);
  const base = recordFor(d);
  // tournament head-to-heads only fill in best/worst matchups when the bundled reports have none
  const needH2H = !base.matchups && (base.tournament || base.finishes.length > 0);
  useEffect(() => {
    if (!needH2H) return;
    let live = true;
    loadEventH2H().then((f) => live && setEventH2H(h2hFor(d.deck.name, f)));
    return () => {
      live = false;
    };
  }, [needH2H, d.deck.name]);
  const rec = eventH2H ? recordFor(d, eventH2H) : base;
  const t = rec.tournament;
  return (
    <section className="rec flair" aria-labelledby={headingId}>
      <div className="rec-head">
        <h2 id={headingId} className="rec-title">
          Recorded results
        </h2>
        {rec.hasAny && rec.historical && (
          <p className="rec-note">
            <span aria-hidden="true">⏱ </span>Historical: recorded before the current simulator (v{CURRENT_SIM_VERSION}), so new games may differ.
          </p>
        )}
      </div>
      {!rec.hasAny ? (
        <p className="rec-empty">
          <b>No recorded games.</b> This deck has not played in a recorded event, season or report yet. Measure it in the <a href="#/arena">Matchup Lab</a> (the
          results stay in your browser).
        </p>
      ) : (
        <>
          <div className="rec-tiles">
            {t && (
              <Tile label="Games played" value={t.games.toLocaleString()}>
                tournament games in {t.events} event{t.events === 1 ? '' : 's'}
                {t.won + t.lost > 0 && (
                  <>
                    {' '}
                    · Swiss {t.won}–{t.lost}
                  </>
                )}
              </Tile>
            )}
            {t && t.wr !== null && (
              <Tile label="Win rate" value={<Sampled text={pct(t.wr)} n={t.won + t.lost} tone={wrTone(t.wr)} />}>
                {games(t.won + t.lost)} in Swiss rounds{small(t.won + t.lost)} · expected vs the field {pct(t.expected.v)} (90% range {pct(t.expected.lo)}–{pct(t.expected.hi)})
              </Tile>
            )}
            {rec.seats && (
              <Tile
                label="Going first / second"
                value={
                  <>
                    <Sampled text={pct(rec.seats.first)} n={rec.seats.firstN} tone={wrTone(rec.seats.first)} /> <span className="rec-sep">/</span>{' '}
                    <Sampled text={pct(rec.seats.second)} n={rec.seats.secondN} tone={wrTone(rec.seats.second)} />
                  </>
                }
              >
                {rec.seats.source === 'telemetry'
                  ? `${games(rec.seats.games)} of telemetry across both seats${small(rec.seats.games)}`
                  : `on the play ${games(rec.seats.firstN!)}${small(rec.seats.firstN)}, on the draw ${games(rec.seats.secondN!)}${small(rec.seats.secondN)} (${
                      rec.seats.source === 'finals' ? 'finals vs the meta' : 'head-to-head runs'
                    })`}
              </Tile>
            )}
            {rec.vsMeta && (
              <Tile label="Vs the meta field" value={<Sampled text={pct(rec.vsMeta.wr)} n={rec.vsMeta.n} tone={wrTone(rec.vsMeta.wr)} />}>
                {games(rec.vsMeta.n)}
                {small(rec.vsMeta.n)} {rec.vsMeta.source === 'finals' ? 'in the finals vs the choom.gg meta archetypes' : 'vs the meta decks across the breeding seasons'}
              </Tile>
            )}
            {(t || rec.leader) && (
              <Tile label="Rating and rank" value={t ? `#${t.rank} of ${t.of}` : `#${rec.leader!.rank} of ${rec.leader!.of}`}>
                {t ? 'by tournament power rating' : 'on the all-time season leaderboard'}
                {t && rec.leader && (
                  <>
                    {' '}
                    · season leaderboard #{rec.leader.rank} of {rec.leader.of} (rating {pct(rec.leader.rating)})
                  </>
                )}
                {!t && rec.leader && <> · rating {pct(rec.leader.rating)}, {rec.leader.percentile}th percentile</>}
              </Tile>
            )}
            {(t || rec.finishes.length > 0) && (
              <Tile label="Event finishes" value={t && t.titles > 0 ? `${t.titles} title${t.titles === 1 ? '' : 's'}` : rec.finishes.length ? `Best ${ordinal(Math.min(...rec.finishes.map((f) => f.place)))}` : '—'}>
                {t ? `top 8 in ${t.top8} of ${t.events} events · matches ${t.matches}` : `${rec.finishes.length} event${rec.finishes.length === 1 ? '' : 's'}`}
              </Tile>
            )}
          </div>
          {rec.matchups && (
            <div className="rec-matchups">
              <span>
                <span className="rec-k">Best matchup</span> <Opp m={rec.matchups.best} />{' '}
                <Sampled text={pct(rec.matchups.best.w)} n={rec.matchups.best.g} tone={wrTone(rec.matchups.best.w)} />{' '}
                <span className="muted small">
                  ({games(rec.matchups.best.g)}
                  {small(rec.matchups.best.g)})
                </span>
              </span>
              {rec.matchups.worst && (
                <span>
                  <span className="rec-k">Worst matchup</span> <Opp m={rec.matchups.worst} />{' '}
                  <Sampled text={pct(rec.matchups.worst.w)} n={rec.matchups.worst.g} tone={wrTone(rec.matchups.worst.w)} />{' '}
                  <span className="muted small">
                    ({games(rec.matchups.worst.g)}
                    {small(rec.matchups.worst.g)})
                  </span>
                </span>
              )}
              <span className="muted small">
                {rec.matchups.count} matchup{rec.matchups.count === 1 ? '' : 's'} {MATCHUP_SOURCE[rec.matchups.source]}
              </span>
            </div>
          )}
          {rec.finishes.length > 0 && (
            <div className="rec-finishes">
              <span className="rec-k">Finishes, newest first</span>
              <ul>
                {rec.finishes.map((f) => (
                  <li key={f.id}>
                    <a
                      className={`rec-finish ${f.champion ? 'is-champ' : f.top8 ? 'is-top8' : ''}`}
                      href={`#/tournaments?e=${f.id}`}
                      title={`Event #${f.id}: ${ordinal(f.place)} of ${f.of}, Swiss ${f.record} (games ${f.games})${f.champion ? ', champion' : f.top8 ? ', top 8' : ''}`}
                    >
                      <span className="muted">#{f.id}</span> {f.champion ? '🏆 won' : ordinal(f.place)}
                      {f.top8 && !f.champion && <span className="sr-only">, top 8</span>}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}
