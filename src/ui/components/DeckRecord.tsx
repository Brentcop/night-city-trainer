// A deck's recorded results, shown first on its profile: tournament games and win rate, seat split, record against
// the meta, best and worst matchups, event finishes and power rank, each with its sample size. Small samples are
// marked the `.num.thin` way and say so; a deck with nothing recorded says that plainly; numbers recorded before the
// current simulator get a one-line note. The summary itself is src/lib/deckRecord.ts.
//
// A deck saved in this browser with a library deck's list shows that deck's recorded results, with a line naming it
// (src/lib/listTwin.ts). Below them, "Your tournaments": this list's record in the tournaments the visitor ran in this
// browser (src/lib/runLedger.ts) and, for a list with no recorded rating, its provisional rating (src/lib/yourStats.ts),
// always labelled as theirs and set apart from the recorded results (feature `yourTournamentStats`).
import { useEffect, useMemo, useState } from 'react';
import { RATINGS, SEASONS } from '../../data/index';
import { TOURNAMENT_INDEX } from '../../data/tournamentIndex';
import { ANALYSIS, telemetryReport } from '../../data/analysisData';
import { deckReports, reportsSimVersion } from '../../data/deckReportsData';
import { deckStats, pct, statsName } from '../../lib/deckStats';
import type { LibraryDeck } from '../../lib/library';
import { CURRENT_SIM_VERSION, SMALL_SAMPLE, deckRecord, h2hFor, ordinal, type DeckRecord, type H2HFile, type MatchLine } from '../../lib/deckRecord';
import { profileHref } from './DeckStats';
import { wrTone } from './Num';
import { RecordedAt, formatRecorded } from './RecordedAt';
import { recordedSource, SimTierBadge, simTierOf, YourTierBadge } from './TierBadges';
import { bandWords, SIM_TIER_MIN_GAMES } from '../../lib/simTier';
import { listOf } from '../../lib/listTwin';
import { BOT_LABEL, type YourRecord } from '../../lib/runLedger';
import type { Provisional } from '../../lib/yourStats';
import { useYourStats, yourStatsFor } from '../useYourStats';

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
function recordFor(d: Pick<LibraryDeck, 'file' | 'deck'>, eventH2H?: MatchLine[]): DeckRecord {
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
const recordedNote = (iso: string) => {
  const at = formatRecorded(iso);
  return at ? ` (recorded ${at})` : '';
};
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

/**
 * A matchup's number: the estimate shrunk toward the power ratings when the row has one (tournament head-to-heads), with
 * the raw record beside it; otherwise the raw win rate.
 */
function MatchValue({ m }: { m: MatchLine }) {
  if (m.est !== undefined)
    return (
      <>
        <Sampled text={pct(m.est)} n={m.g} tone={wrTone(m.est)} />{' '}
        <span className="muted small" title="Estimated from the power ratings plus this pairing's own record, shrunk by how much pairings differ from the ratings' prediction">
          (estimate; raw {pct(m.w)} in {games(m.g)}
          {m.g < SMALL_SAMPLE ? ', a small sample' : ''})
        </span>
      </>
    );
  return (
    <>
      <Sampled text={pct(m.w)} n={m.g} tone={wrTone(m.w)} />{' '}
      <span className="muted small">
        ({games(m.g)}
        {small(m.g)})
      </span>
    </>
  );
}

const MATCHUP_SOURCE: Record<NonNullable<DeckRecord['matchups']>['source'], string> = {
  finals: 'vs the choom.gg meta archetypes (finals)',
  h2h: 'from dedicated head-to-head runs',
  events: `from tournament games (pairings with at least 6 games)`,
};

/**
 * Whether a deck's best and worst matchups must come from the tournament head-to-heads (the bundled reports have none
 * for it, and it has played in recorded events). A boolean on purpose: it is an effect dependency, and the record it is
 * read from is a new object on every render.
 */
export const needsEventH2H = (base: Pick<DeckRecord, 'matchups' | 'tournament' | 'finishes'>): boolean => !base.matchups && (!!base.tournament || base.finishes.length > 0);

export function DeckRecordPanel({ d, headingId }: { d: Pick<LibraryDeck, 'file' | 'deck'>; headingId: string }) {
  // the head-to-head file once it has loaded (undefined until then; null when it could not be read). The state is the
  // file, never one deck's lines: the file is the same object for every deck, so setting it again changes nothing, and
  // the page can go from one deck to another without showing the first deck's lines or re-rendering without end
  const [h2h, setH2h] = useState<H2HFile | null | undefined>(undefined);
  // whose recorded results: the deck's own, or the library deck with the same list (a deck saved here)
  const twin = recordedSource(d)?.twin ?? null;
  const rd = twin ?? d;
  const base = recordFor(rd);
  // tournament head-to-heads only fill in best/worst matchups when the bundled reports have none
  const needH2H = needsEventH2H(base);
  useEffect(() => {
    if (!needH2H || h2h !== undefined) return;
    let live = true;
    void loadEventH2H().then((f) => live && setH2h(f));
    return () => {
      live = false;
    };
  }, [needH2H, h2h]);
  const eventH2H = useMemo<MatchLine[] | undefined>(() => (needH2H && h2h !== undefined ? h2hFor(rd.deck.name, h2h) : undefined), [needH2H, h2h, rd.deck.name]);
  const rec = eventH2H ? recordFor(rd, eventH2H) : base;
  const t = rec.tournament;
  const sim = simTierOf(d);
  const ys = yourStatsFor(useYourStats(), listOf(d.deck));
  // a provisional rating only for a list with no recorded rating
  const prov = t ? undefined : ys.prov;
  const yours = ys.rec ? <YourTournaments rec={ys.rec} prov={prov} recorded={!!t} alone={!rec.hasAny} /> : null;
  return (
    <section className="rec flair" aria-labelledby={headingId}>
      <div className="rec-head">
        <h2 id={headingId} className="rec-title">
          {!rec.hasAny && yours ? 'Your tournaments' : 'Recorded results'}
        </h2>
        {rec.hasAny && rec.historical && (
          <p className="rec-note">
            <span aria-hidden="true">⏱ </span>Historical: recorded before the current simulator (v{CURRENT_SIM_VERSION}), so new games may differ.
          </p>
        )}
      </div>
      {twin && (
        <p className="rec-note rec-twin">
          Same list as <a href={profileHref(twin.file)}>{twin.deck.name}</a>
          {rec.hasAny ? ': these are its recorded results.' : '.'}
        </p>
      )}
      {!rec.hasAny ? (
        yours ?? (
        <p className="rec-empty">
          <b>No recorded games.</b> This deck has not played in a recorded event, season or report yet. Measure it in the <a href="#/arena">Matchup Lab</a> (the
          results stay in your browser).
        </p>
        )
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
              <Tile label="Swiss win rate" value={<Sampled text={pct(t.wr)} n={t.won + t.lost} tone={wrTone(t.wr)} />}>
                the raw record in {games(t.won + t.lost)} of Swiss rounds{small(t.won + t.lost)} · its power rating expects {pct(t.expected.v)} vs the whole field (90% range{' '}
                {pct(t.expected.lo)}–{pct(t.expected.hi)})
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
              <Tile label={rec.vsMeta.source === 'finals' ? 'Finals vs the meta' : 'Seasons vs the meta'} value={<Sampled text={pct(rec.vsMeta.wr)} n={rec.vsMeta.n} tone={wrTone(rec.vsMeta.wr)} />}>
                raw win rate in {games(rec.vsMeta.n)}
                {small(rec.vsMeta.n)} {rec.vsMeta.source === 'finals' ? 'of the finals vs the choom.gg meta archetypes' : 'vs the meta decks across the breeding seasons'}
              </Tile>
            )}
            {(t || rec.leader) && (
              <Tile label={t ? 'Power rank' : 'Season rank'} value={t ? `#${t.rank} of ${t.of}` : `#${rec.leader!.rank} of ${rec.leader!.of}`}>
                {t ? 'by tournament power rating (expected win rate vs the whole field)' : 'on the all-time season leaderboard'}
                {t && rec.leader && (
                  <>
                    {' '}
                    · season leaderboard #{rec.leader.rank} of {rec.leader.of} (season rating {pct(rec.leader.rating)})
                  </>
                )}
                {!t && rec.leader && (
                  <>
                    {' '}
                    · season rating {pct(rec.leader.rating)}, {ordinal(rec.leader.percentile)} percentile
                  </>
                )}
              </Tile>
            )}
            {sim.unrated !== 'no-games' && (
              <Tile label="Sim tier" value={<SimTierBadge tier={sim} showUnrated />}>
                {sim.letter ? (
                  <>
                    our tier from the power rating: tier {sim.letter} is {bandWords(sim.letter)} expected vs the field
                    {sim.straddle && sim.loLetter && sim.hiLetter ? ` · uncertain: its 90% range reaches from ${sim.loLetter} to ${sim.hiLetter}` : ''}
                  </>
                ) : (
                  `unrated: ${sim.games} of the ${SIM_TIER_MIN_GAMES} games a tier needs`
                )}
                {' · '}
                <a href="#/ratings">how tiers work</a>
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
                <MatchValue m={rec.matchups.best} />
              </span>
              {rec.matchups.worst && (
                <span>
                  <span className="rec-k">Worst matchup</span> <Opp m={rec.matchups.worst} />{' '}
                  <MatchValue m={rec.matchups.worst} />
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
                      title={`Event #${f.id}${recordedNote(f.date)}: ${ordinal(f.place)} of ${f.of}, Swiss ${f.record} (games ${f.games})${f.champion ? ', champion' : f.top8 ? ', top 8' : ''}`}
                    >
                      <span className="muted">#{f.id}</span> {f.champion ? '🏆 won' : ordinal(f.place)}
                      {f.top8 && !f.champion && <span className="sr-only">, top 8</span>}
                      <RecordedAt iso={f.date} compact className="muted" prefix=" · " />
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {yours}
        </>
      )}
    </section>
  );
}

const winLoss = (r: { wins: number; losses: number; ties: number }) => `${r.wins}–${r.losses}${r.ties ? `–${r.ties}` : ''}`;

/**
 * "Your tournaments" on a deck's page: the list's record in the tournaments run in this browser, by bots, and for a list
 * with no recorded rating its provisional rating against the recorded field. `alone`: the deck has no recorded results,
 * so this is the panel's only content (the panel's heading then says "Your tournaments").
 */
export function YourTournaments({ rec, prov, recorded, alone }: { rec: YourRecord; prov?: Provisional; recorded?: boolean; alone?: boolean }) {
  const pt = prov?.tier ?? null;
  const bots = rec.byBot.map((b) => `${BOT_LABEL[b.bot] ?? b.bot} ${winLoss(b.rec)}`).join(' · ');
  return (
    <div className={`rec-yours${alone ? ' is-alone' : ''}`}>
      {!alone && <h3 className="rec-sub">Your tournaments</h3>}
      <p className="rec-note">From the tournaments you ran in this browser only, kept apart from the recorded results.</p>
      <div className="rec-tiles">
        <Tile label="Your games" value={rec.games.toLocaleString()}>
          in {rec.runs} of your tournaments
          {rec.won > 0 ? `, won ${rec.won}` : ''} · {bots}
        </Tile>
        <Tile label="Your win rate" value={<Sampled text={pct(rec.wr)} n={rec.games} tone={wrTone(rec.wr)} />}>
          {winLoss(rec)} ({rec.ties ? 'wins–losses–ties; a tie counts half' : 'wins–losses'}){small(rec.games)}
        </Tile>
        {prov && (
          <Tile
            label="Provisional rating"
            value={
              <>
                <Sampled text={pct(prov.wr)} n={prov.games} tone={wrTone(prov.wr)} /> <YourTierBadge tier={pt} showUnrated />
              </>
            }
          >
            {prov.connected ? (
              <>
                expected vs the recorded field (90% range {pct(prov.lo)}–{pct(prov.hi)}) from {games(prov.games)} with All Hard bots{small(prov.games)} · would place{' '}
                {ordinal(prov.place)} of {prov.of} in the <a href="#/ratings">Power ratings</a>
                {pt?.letter ? '' : ` · a provisional tier needs ${SIM_TIER_MIN_GAMES} of these games`}
              </>
            ) : (
              <>
                from {games(prov.games)} with All Hard bots, none of them against a recorded deck: its place against the recorded field is only the prior's guess of an average deck, so
                the range is wide ({pct(prov.lo)}–{pct(prov.hi)})
              </>
            )}
          </Tile>
        )}
      </div>
      {!prov && !recorded && (
        <p className="rec-note">
          {rec.byBot.some((b) => b.bot === 'hard')
            ? 'Working out the provisional rating…'
            : 'Only tournaments run with All Hard bots give a provisional rating, and this list has none of those games yet.'}
        </p>
      )}
    </div>
  );
}
