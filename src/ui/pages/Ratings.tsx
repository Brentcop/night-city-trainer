// Power ratings from all tournament games (Bradley–Terry), shown as expected win rate with 90% intervals.
import { Fragment, useMemo, useState } from 'react';
import { Wr } from '../components/Num';
import { RATINGS } from '../../data/index';
import { allDecks } from '../../lib/browserLibrary';
import { byName } from '../deckLookup';
import { LegendStrip, OriginBadge, originKind } from '../components/DeckIdentity';
import { PageHead } from '../components/PageHead';
import { CURRENT_SIM_VERSION, ordinal, ratingsHistorical } from '../../lib/playedRecord';
import { bandOf, bandWords, SIM_TIER_LETTERS, SIM_TIER_MIN_GAMES, SIM_TIER_STRADDLE_BANDS, simTier } from '../../lib/simTier';
import { SimTierBadge } from '../components/TierBadges';

const R = RATINGS;
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
        {ratingsHistorical(R) && <> These games were recorded before the current simulator (v{CURRENT_SIM_VERSION}), so the ratings are historical.</>}
      </PageHead>
      <SimTierNote />
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
              <th title="Our tier from this table: the band the expected win rate falls in">Sim tier</th>
              <th>Deck</th>
              <th style={{ minWidth: 220 }}>Expected win % vs field (90% range)</th>
              <th title="The same model's expected win rate against the choom.gg meta decks only">Expected vs meta decks</th>
              <th>Titles</th>
              <th>Top 8</th>
              <th>Avg finish</th>
              <th>Games</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const d = lib.get(r.name);
              const band = bandOf(r.wrField);
              const prev = rows[i - 1];
              return (
                <Fragment key={r.name}>
                  {(!prev || bandOf(prev.wrField) !== band) && (
                    <tr className="tier-divider">
                      <th colSpan={9} scope="rowgroup">
                        Sim tier {band} · {bandWords(band)} expected vs the field
                      </th>
                    </tr>
                  )}
                <tr>
                  <td>{R.decks.indexOf(r) + 1}</td>
                  <td>
                    <SimTierBadge tier={simTier(r)} showUnrated />
                  </td>
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
                  <td>{r.avgFinish === null ? '—' : `${ordinal(Math.round(r.avgFinish * 100))} percentile`}</td>
                  <td>{r.games}</td>
                </tr>
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** How the Sim tier letters are made, with each band and how many of the rated decks are in it now. */
function SimTierNote() {
  const tiers = R.decks.map((r) => simTier(r));
  const count = (l: string) => tiers.filter((t) => t.letter === l).length;
  const unsure = tiers.filter((t) => t.straddle).length;
  const unrated = tiers.filter((t) => !t.letter).length;
  return (
    <details className="panel small sim-tier-note">
      <summary>
        <b>Sim tiers</b>: our letter for each deck from this table, beside choom.gg’s editorial tier (the <span className="tierb tierb-choom t-S"><span className="tierb-src">choom</span><span className="tierb-l">S</span></span> badge), never in place of it.
      </summary>
      <p>
        The letter is the band the deck’s <b>expected win rate against the whole field</b> falls in. The bands are fixed, so a tier means the same thing as the field changes, and the
        letters follow this table whenever the ratings are rebuilt from new events.
      </p>
      <ul className="sim-tier-bands">
        {SIM_TIER_LETTERS.map((l) => (
          <li key={l}>
            <span className={`tierb tierb-sim t-${l}`}>
              <span className="tierb-src">Sim</span>
              <span className="tierb-l">{l}</span>
            </span>{' '}
            {bandWords(l)} <span className="muted">({count(l)} deck{count(l) === 1 ? '' : 's'} now)</span>
          </li>
        ))}
      </ul>
      <p>
        A deck needs {SIM_TIER_MIN_GAMES} recorded games for a letter; with fewer it shows <b>–</b> (unrated{unrated ? `: ${unrated} now` : ''}). When its 90% range reaches {SIM_TIER_STRADDLE_BANDS} or more
        bands away from its letter, the letter is marked <b>±</b> and striped: it could be off by two tiers ({unsure} deck{unsure === 1 ? '' : 's'} now). At today’s sample sizes every range spans
        more than one band, so read neighbouring letters as overlapping.
      </p>
    </details>
  );
}
