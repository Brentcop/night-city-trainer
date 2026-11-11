// Power ratings from all tournament games (Bradley–Terry), shown as expected win rate with 90% intervals.
import { useMemo, useState } from 'react';
import { Wr } from '../components/Num';
import ratings from '../../data/ratings.json';
import { allDecks } from '../../lib/browserLibrary';
import { byName } from '../deckLookup';
import { LegendStrip, OriginBadge, originKind } from '../components/DeckIdentity';
import { PageHead } from '../components/PageHead';
import { CURRENT_SIM_VERSION, ratingsHistorical, type RatingsFile } from '../../lib/playedRecord';

interface Row {
  name: string;
  file: string;
  rating: number;
  se: number;
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
  wrMeta: number | null;
  events: number;
  titles: number;
  top8: number;
  avgFinish: number | null;
  matches: string;
}
const R = ratings as unknown as { updated: string; events: number; games: number; firstPlayerEdge: number; decks: Row[] };
const pct = (x: number | null | undefined) => (typeof x === 'number' && Number.isFinite(x) ? `${(x * 100).toFixed(1)}%` : '—');

const GROUPS: [string, string][] = [
  ['', 'All decks'],
  ['choom-meta', 'choom.gg meta'],
  ['choom-guide', 'choom.gg guides'],
  ['nc-original', 'NC originals'],
  ['nc-bred', 'Bred'],
  ['nc-variant', 'Variants'],
];

export function RatingsPage() {
  const lib = useMemo(() => byName(allDecks()), []);
  const [group, setGroup] = useState('');
  if (!R.decks.length)
    return (
      <div className="grid">
        <PageHead kicker="Tournaments" title="Power ratings" />
        <div className="empty-state">No recorded tournament games yet, so there is nothing to rate.</div>
      </div>
    );
  const rows = R.decks.filter((r) => !group || originKind(lib.get(r.name)?.prov, lib.get(r.name)?.kind) === group);
  const lo = 0.2;
  const hi = 0.85;
  const x = (v: number) => `${((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * 100}%`;
  return (
    <div className="grid">
      <PageHead kicker="Tournaments" title="Power ratings">
        <b>
          {R.events} events · {R.games.toLocaleString()} games · going first is worth {(R.firstPlayerEdge * 100).toFixed(1)} pts.
        </b>{' '}
        One model fitted to every tournament game every deck has played: each deck's <b>expected win rate against the whole field</b>, with a bar
        for the 90% confidence range. Ranges that overlap are not meaningfully different.
        {ratingsHistorical(R as unknown as RatingsFile) && <> These games were recorded before the current simulator (v{CURRENT_SIM_VERSION}), so the ratings are historical.</>}
      </PageHead>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {GROUPS.map(([k, label]) => (
          <button key={k} className={group === k ? 'on' : ''} aria-pressed={group === k} onClick={() => setGroup(k)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel scroll-x flair">
        <table className="small ratings">
          <thead>
            <tr>
              <th>#</th>
              <th>Deck</th>
              <th style={{ minWidth: 220 }}>Expected win % vs field (90% range)</th>
              <th>vs meta</th>
              <th>Titles</th>
              <th>Top 8</th>
              <th>Avg finish</th>
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const d = lib.get(r.name);
              return (
                <tr key={r.name}>
                  <td>{R.decks.indexOf(r) + 1}</td>
                  <td style={{ minWidth: 240 }}>
                    <div className="row" style={{ flexWrap: 'nowrap' }}>
                      {d && (
                        <div style={{ width: 84, flex: 'none' }}>
                          <LegendStrip legends={d.deck.legends} height={30} />
                        </div>
                      )}
                      <div>
                        <a href={d ? `#/deck?d=${encodeURIComponent(d.file)}` : undefined}>{r.name}</a>
                        {d && (
                          <div>
                            <OriginBadge deck={d} />
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="ci">
                      <div className="ci-mid" style={{ left: x(0.5) }} />
                      <div className="ci-range" style={{ left: x(r.wrFieldLo), width: `calc(${x(r.wrFieldHi)} - ${x(r.wrFieldLo)})` }} />
                      <div className="ci-dot" style={{ left: x(r.wrField) }} />
                    </div>
                    <div className="muted">
                      <Wr v={r.wrField} n={r.games} digits={1} strong /> ({pct(r.wrFieldLo)}–{pct(r.wrFieldHi)})
                    </div>
                  </td>
                  <td><Wr v={r.wrMeta} digits={1} /></td>
                  <td>{r.titles ? `🏆 ${r.titles}` : '—'}</td>
                  <td>
                    {r.top8}/{r.events}
                  </td>
                  <td>{r.avgFinish === null ? '—' : `${Math.round(r.avgFinish * 100)}th pct`}</td>
                  <td>{r.games}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
