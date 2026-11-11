import { useState } from 'react';
import { Wr } from '../components/Num';
import { SEASONS } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import { shortCredit } from '../../lib/library';
import { DeckTile, LegendStrip, OriginBadge } from '../components/DeckIdentity';
import { PageHead } from '../components/PageHead';
import { CURRENT_SIM_VERSION, isHistorical } from '../../lib/playedRecord';

export function SeasonsPage() {
  const D = SEASONS;
  const [filter, setFilter] = useState('');
  const seasonCols = D.seasons.map((s) => String(s.season));
  const libByFile = new Map(allDecks().map((d) => [d.file, d]));
  const rows = D.leaderboard.filter((r) => !filter || (r.name + r.origin + r.colors + r.arch).toLowerCase().includes(filter.toLowerCase()));
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
        Each season the breeder makes 8 new decks from the data and tests them against the meta. <b>Rating</b> = win rate vs the meta decks,
        adjusted for sample size.
        {isHistorical(D.manifest?.simVersion) && (
          <> These results were recorded before the current simulator (v{CURRENT_SIM_VERSION}), so they are historical.</>
        )}
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
              <th>Rating</th>
              <th>vs meta (raw)</th>
              <th>Games</th>
              <th>Pctl</th>
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
                      <a href={`#/deck?d=${encodeURIComponent(r.file)}`}>
                        <b>{r.name}</b>
                      </a>
                      {libByFile.get(r.file) && (
                        <div>
                          <OriginBadge deck={libByFile.get(r.file)!} />
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
                <td><Wr v={r.vsMeta} digits={1} /></td>
                <td>{r.metaG}</td>
                <td>{r.percentile}</td>
                {seasonCols.map((s) => (
                  <td key={s}><Wr v={r.seasons?.[s]} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {[...D.seasons].reverse().map((s) => (
        <div className="panel" key={s.season}>
          <h2 className="rule-head" style={{ marginTop: 0 }}>
            Season {s.season} <span className="muted small">({s.date.slice(0, 10)} · {s.games} games per pairing · {s.bot} bot)</span>
          </h2>
          <div className="grid cols-2">
            <div>
              <h3>New decks</h3>
              <div className="deck-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
                {s.bred.map((b) => {
                  const d = [...libByFile.values()].find((x) => x.deck.name === b.name);
                  return d ? (
                    <DeckTile key={b.name} d={d} href={`#/deck?d=${encodeURIComponent(d.file)}`} />
                  ) : (
                    <div key={b.name} className="small">
                      <b>{b.name}</b> <span className="tag">{b.method}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div>
              <h3>Standings</h3>
              <table className="small">
                <tbody>
                  {s.standings.map((r, i) => (
                    <tr key={r.name}>
                      <td>{i + 1}</td>
                      <td>
                        {r.name} {r.isNew && <span className="tier tier-S">NEW</span>}
                      </td>
                      <td><Wr v={r.wr} digits={1} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
