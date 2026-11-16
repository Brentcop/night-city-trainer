// Breeding seasons (#/seasons, lazy): the all-time leaderboard and each season's panel (new decks, standings, and
// "Bred decks, then and now"). Rows of the leaderboard whose games come from an older simulator are marked
// (staleLeaderRow, src/lib/parentStrength.ts), and the intro says the breeder no longer uses those numbers to choose
// parents. Which seasons are historical comes from each season's own version (seasonsSimWords; each panel's header
// names its simulator), never from the seasons file's manifest, whose version is the oldest season's. "Then and now" puts each bred deck's win rate in its own season's round robin beside its power rating now and
// its best parent's (today's parent strength), with the season's test of it when one was recorded; it computes no
// difference between them (src/lib/bredDecks.ts). Decks a season's test did not let in are listed under the table.
// `SeasonsView` takes the data as props (tests render it with fixtures); the page hands it the bundled files.
import { useMemo, useState } from 'react';
import { Wr } from '../components/Num';
import { RATINGS, SEASONS, type RatingsData, type SeasonRecord, type SeasonsData } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import { shortCredit, type LibraryDeck } from '../../lib/library';
import { DeckTile, LegendStrip, OriginBadge } from '../components/DeckIdentity';
import { PageHead } from '../components/PageHead';
import { CURRENT_SIM_VERSION } from '../../lib/playedRecord';
import { rankLibraryParents, seasonVersions, staleLeaderRow } from '../../lib/parentStrength';
import { botWord } from '../../lib/evidence';
import {
  bredThenAndNow,
  countedSteps,
  leaderboardStaleWords,
  madeFromWords,
  NOT_TESTED,
  notEntered,
  ratingNowWords,
  SEASON_OLD_TITLE,
  seasonSimNote,
  seasonsSimWords,
  seasonTestWords,
  STALE_ROW_MARK,
  STALE_ROW_TITLE,
  stepFigureWords,
  thenAndNowIntro,
  type BredThenNow,
  type RatingNow,
} from '../../lib/bredDecks';

export function SeasonsPage() {
  const lib = useMemo(() => allDecks(), []);
  return <SeasonsView data={SEASONS} ratings={RATINGS} lib={lib} />;
}

const deckHref = (file: string) => `#/deck?d=${encodeURIComponent(file)}`;
/** A deck's name, linked to its profile when it is in the library. */
function DeckName({ name, file }: { name: string; file: string | null }) {
  return file ? (
    <a href={deckHref(file)}>
      <b>{name}</b>
    </a>
  ) : (
    <b>{name}</b>
  );
}

export function SeasonsView({ data: D, ratings, lib, current = CURRENT_SIM_VERSION }: { data: SeasonsData; ratings: RatingsData; lib: readonly LibraryDeck[]; current?: number }) {
  const [filter, setFilter] = useState('');
  const seasonCols = D.seasons.map((s) => String(s.season));
  const libByFile = new Map(lib.map((d) => [d.file, d]));
  const versions = seasonVersions(D.seasons);
  const stale = new Set(D.leaderboard.filter((r) => staleLeaderRow(r, versions, current)).map((r) => r.name));
  const ranked = useMemo(() => rankLibraryParents(lib, ratings.decks, D, current), [lib, ratings, D, current]);
  const rows = D.leaderboard.filter((r) => !filter || (r.name + r.origin + r.colors + r.arch).toLowerCase().includes(filter.toLowerCase()));
  const staleWords = leaderboardStaleWords(stale.size, D.leaderboard.length - stale.size);
  // each season's own version, never the file's minimum (src/data/seasons.json manifest.simVersion is the oldest season's)
  const simWords = seasonsSimWords(versions, current);
  if (!D.leaderboard.length)
    return (
      <div className="grid">
        <PageHead kicker="Tournaments" title="Seasons" />
        <div className="empty-state">
          No seasons yet. Run <code>npx tsx scripts/season.ts --season 1</code>.
        </div>
      </div>
    );
  return (
    <div className="grid">
      <PageHead
        kicker="Tournaments"
        title="Seasons & all-time leaderboard"
        actions={<input aria-label="Filter the leaderboard" placeholder="Filter (name, origin, colours, archetype)…" value={filter} onChange={(e) => setFilter(e.target.value)} />}
      >
        Each season the breeder makes 8 new decks from the data. A season may test each one before it enters (its panel says which entered
        and which did not), and the ones that enter are measured against the meta. <b>Season rating</b> = win rate vs the meta decks, adjusted
        for sample size.
        {simWords && <> {simWords}</>}
        {staleWords && <> {staleWords}</>}
      </PageHead>
      <div className="panel scroll-x flair">
        <h2 style={{ marginTop: 0 }}>All-time leaderboard</h2>
        <table className="small">
          <thead>
            <tr>
              <th>#</th>
              <th>Deck</th>
              <th>Origin</th>
              <th>Style</th>
              <th>Season rating</th>
              <th>vs meta (raw)</th>
              <th>Games</th>
              <th>Percentile</th>
              {seasonCols.map((s) => (
                <th key={s}>S{s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td>{D.leaderboard.indexOf(r) + 1}</td>
                <td style={{ minWidth: 260 }}>
                  <div className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start' }}>
                    <div style={{ width: 96, flex: 'none' }}>
                      <LegendStrip legends={libByFile.get(r.file)?.deck.legends ?? []} height={34} />
                    </div>
                    <div>
                      <a href={deckHref(r.file)}>
                        <b>{r.name}</b>
                      </a>
                      {libByFile.get(r.file) && (
                        <div>
                          <OriginBadge deck={libByFile.get(r.file)!} />
                        </div>
                      )}
                      {stale.has(r.name) && (
                        <div>
                          <span className="tag muted" title={STALE_ROW_TITLE}>
                            {STALE_ROW_MARK}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="muted">
                  {libByFile.get(r.file) ? shortCredit(libByFile.get(r.file)!) : r.origin}
                  {libByFile.get(r.file)?.prov.parents && <div className="muted">from {libByFile.get(r.file)!.prov.parents}</div>}
                </td>
                <td>
                  <span className="tag">{r.colors}</span> {r.arch}
                </td>
                <td style={{ minWidth: 110 }}>
                  <Wr v={r.rating} digits={1} strong />
                  <div className="bar">
                    <div style={{ width: `${(r.rating ?? 0) * 100}%` }} />
                  </div>
                </td>
                <td>
                  <Wr v={r.vsMeta} digits={1} />
                </td>
                <td>{r.metaG}</td>
                <td>{r.percentile}</td>
                {seasonCols.map((s) => (
                  <td key={s}>
                    <Wr v={r.seasons?.[s]} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[...D.seasons].reverse().map((s) => (
        <div className="panel" key={s.season}>
          <h2 className="rule-head" style={{ marginTop: 0 }}>
            Season {s.season}{' '}
            <span className="muted small">
              ({s.date.slice(0, 10)} · {s.games} games per pairing · {botWord(s.bot)} bot · <SimNote v={versions[String(s.season)]} current={current} />)
            </span>
          </h2>
          {/* one column on a phone: a 320 px minimum would be wider than the panel there */}
          <div className="grid cols-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))' }}>
            <div style={{ minWidth: 0 }}>
              <h3>New decks</h3>
              <div className="deck-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(180px, 100%), 1fr))' }}>
                {s.bred.map((b) => {
                  const d = lib.find((x) => x.deck.name === b.name);
                  return d ? (
                    <DeckTile key={b.name} d={d} href={deckHref(d.file)} />
                  ) : (
                    <div key={b.name} className="small">
                      <b>{b.name}</b> <span className="tag">{b.method}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="scroll-x" style={{ minWidth: 0 }}>
              <h3>Standings</h3>
              <table className="small">
                <tbody>
                  {s.standings.map((r, i) => (
                    <tr key={r.name}>
                      <td>{i + 1}</td>
                      <td>
                        {r.name} {r.isNew && <span className="tier tier-S">NEW</span>}
                      </td>
                      <td>
                        <Wr v={r.wr} digits={1} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <BredThenAndNow season={s} rows={bredThenAndNow(s, lib, ratings.decks, ranked)} ratings={ratings} />
          <NotEntered season={s} lib={lib} />
        </div>
      ))}
    </div>
  );
}

/** A season panel's simulator version: "simulator v9", or "simulator v5, historical" with a tooltip saying why. */
function SimNote({ v, current }: { v: number | null | undefined; current: number }) {
  const n = seasonSimNote(v, current);
  return n.historical ? <span title={SEASON_OLD_TITLE}>{n.text}</span> : <>{n.text}</>;
}

function RatingCell({ r }: { r: RatingNow | null }) {
  if (!r) return <span className="muted">not rated</span>;
  return (
    <div title={ratingNowWords(r)}>
      <Wr v={r.wr} n={r.games} digits={1} strong />
      <div className="muted">
        90% range {(r.lo * 100).toFixed(1)}–{(r.hi * 100).toFixed(1)}%
      </div>
      <div className="muted">{r.games.toLocaleString('en-US')} games</div>
    </div>
  );
}

function TestCell({ row }: { row: BredThenNow }) {
  if (!row.test) return <span className="muted">{NOT_TESTED}</span>;
  return (
    <div>
      {seasonTestWords(row.test)}
      {countedSteps(row.test).map((st, i) => (
        <div key={i} className="muted">
          {stepFigureWords(st)}
        </div>
      ))}
    </div>
  );
}

/** One row per bred deck of the season: its season number beside its rating now, its best parent's now, and its test. */
function BredThenAndNow({ season: s, rows, ratings }: { season: SeasonRecord; rows: BredThenNow[]; ratings: RatingsData }) {
  if (!rows.length) return null;
  const rm = ratings.manifest as { simVersion?: number; bot?: { level?: string } } | undefined;
  return (
    <>
      <h3>Bred decks, then and now</h3>
      <p className="small muted" style={{ marginTop: 0 }}>
        {thenAndNowIntro({
          season: s.season,
          seasonBot: s.bot,
          seasonSim: typeof s.manifest?.simVersion === 'number' ? s.manifest.simVersion : null,
          ratingsBot: rm?.bot?.level ?? null,
          ratingsSim: typeof rm?.simVersion === 'number' ? rm.simVersion : null,
        })}
      </p>
      <div className="scroll-x">
        <table className="small">
          <thead>
            <tr>
              <th>Deck</th>
              <th>Made from</th>
              <th>Season {s.season} round robin</th>
              <th>Rating now</th>
              <th>Best parent now</th>
              <th>Test at entry</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.name}>
                <td style={{ minWidth: 150 }}>
                  <DeckName name={r.name} file={r.file} />
                  <div>
                    <span className="tag">{r.method}</span>
                  </div>
                </td>
                <td style={{ minWidth: 150 }}>{madeFromWords(r)}</td>
                <td>
                  <Wr v={r.season} digits={1} />
                </td>
                <td style={{ minWidth: 110 }}>
                  <RatingCell r={r.now} />
                </td>
                <td style={{ minWidth: 150 }}>
                  {r.parent ? (
                    <>
                      <DeckName name={r.parent.name} file={r.parent.file} />
                      <RatingCell r={r.parent.now} />
                    </>
                  ) : (
                    <span className="muted">{r.explorer ? 'none: an explorer' : 'none of its parents is rated now'}</span>
                  )}
                </td>
                <td style={{ minWidth: 220 }}>
                  <TestCell row={r} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

/** The decks the season's test did not let in, with the test's words and figures. */
function NotEntered({ season: s, lib }: { season: SeasonRecord; lib: readonly LibraryDeck[] }) {
  const out = notEntered(s.gate);
  if (!out.length) return null;
  return (
    <>
      <h3>Bred, but did not enter</h3>
      <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
        {out.map((d) => (
          <li key={d.name}>
            <DeckName name={d.name} file={lib.find((x) => x.deck.name === d.name)?.file ?? null} /> <span className="tag">{d.method}</span> {seasonTestWords(d)}
            {countedSteps(d).map((st, i) => (
              <div key={i} className="muted">
                {stepFigureWords(st)}
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
