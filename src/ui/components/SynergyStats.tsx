// The Card stats page's Synergies view: for each package of the synergy catalogue (src/content/synergies) a list holds,
// how often its pieces were held and the package came online (beside the draw odds), the median round it came online,
// and win rates when online versus never online, each with its sample and 95% interval; and each member card's use
// split by "partner present" and "partner absent". It reads public/data/synergies.json (written by `npm run sim --
// analyze --synergies`) on first open; this file is loaded lazily, so none of it is in the entry chunk. The numbers are
// association, not causal value (src/analysis/synergies.ts).
import { useEffect, useMemo, useState } from 'react';
import type { RateWithInterval, SynergyRow } from '../../analysis/synergies';
import type { RoleCounts } from '../../content/synergies';
import { loadSynergyReport, pct, type SynergyLoaded } from '../synergyReport';
import { SliceCell } from './DecisionStats';
import { CardMention, MentionText } from './CardMention';

/** "42% (21/50)" with the interval in the tooltip, or "—". */
export function RateCell({ r }: { r: RateWithInterval }) {
  if (r.rate === null) return <span className="muted">—</span>;
  return (
    <span title={`${r.n} of ${r.of}; 95% interval ${pct(r.low95)}–${pct(r.high95)}`}>
      <span className="num">{pct(r.rate)}</span> <span className="muted small num">{r.n}/{r.of}</span>
    </span>
  );
}

export const roleText = (c: RoleCounts) =>
  (['enabler', 'payoff', 'both', 'piece'] as const)
    .filter((k) => c[k])
    .map((k) => `${c[k]} ${k === 'both' ? 'both' : k === 'piece' ? 'pieces' : `${k}${c[k] === 1 ? '' : 's'}`}`)
    .join(' · ');

function PackageTable({ rows, rounds, caption }: { rows: SynergyRow[]; rounds: readonly number[]; caption: string }) {
  if (!rows.length) return <p className="muted">No package of the catalogue is in this list.</p>;
  return (
    <div className="scroll-x">
      <table className="small">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Games</th>
            <th scope="col" title="Games in which the needed pieces were held at some point (drawn, or a Legend in the list)">
              Pieces held
            </th>
            {rounds.map((n) => (
              <th scope="col" key={n} title={`By your own turn ${n}: share with the pieces held (draw odds in brackets) / share online so far`}>
                By turn {n}
              </th>
            ))}
            <th scope="col" title="Games in which the package’s board condition held at least once">
              Online
            </th>
            <th scope="col" title="Median round (your own turn) in which it first came online">
              Median turn
            </th>
            <th scope="col" title="Win rate in games where it came online, with its 95% interval and the number of games">
              Won when online
            </th>
            <th scope="col" title="Win rate in games where it never came online">
              Won when never
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((x) => (
            <tr key={x.id}>
              <th scope="row" style={{ fontWeight: 'normal' }}>
                <MentionText text={x.name} />
                {x.builtAround && <span className="tag" style={{ marginLeft: 6 }}>built around</span>}
                {x.copies && <div className="muted small">{roleText(x.copies)}</div>}
              </th>
              <td className="num">{x.games}</td>
              <td>
                <RateCell r={x.assembledRate} />
              </td>
              {x.byRound.map((b) => (
                <td key={b.round} className="num" title={`${b.reached} games reached turn ${b.round}`}>
                  {pct(b.assembled.rate)}
                  {b.expected !== null && <span className="muted"> ({pct(b.expected)})</span>} / {pct(b.online.rate)}
                </td>
              ))}
              <td>
                <RateCell r={x.onlineRate} />
              </td>
              <td className="num">{x.medianRound ?? '—'}</td>
              <td>
                <SliceCell s={x.online} />
              </td>
              <td>
                <SliceCell s={x.never} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CardSplit({ rows }: { rows: SynergyRow[] }) {
  const cards = rows.flatMap((s) => s.cards.filter((c) => c.present.games + c.absent.games > 0).map((c) => ({ s, c })));
  if (!cards.length) return <p className="muted small">No member card was used.</p>;
  return (
    <div className="scroll-x">
      <table className="small">
        <thead>
          <tr>
            <th scope="col">Package</th>
            <th scope="col">Card</th>
            <th scope="col">Role</th>
            <th scope="col" title="Win rate in games where the card was used with a partner piece held (a Legend partner: face-up)">
              Used with a partner
            </th>
            <th scope="col" title="Win rate in games where the card was used with no partner piece held">
              Used without
            </th>
          </tr>
        </thead>
        <tbody>
          {cards.map(({ s, c }) => (
            <tr key={`${s.id}|${c.id}`}>
              <td>
                <MentionText text={s.name} />
              </td>
              <th scope="row" style={{ fontWeight: 'normal' }}>
                <CardMention id={c.id}>{c.name}</CardMention>
              </th>
              <td>{c.role}</td>
              <td>
                <SliceCell s={c.present} />
              </td>
              <td>
                <SliceCell s={c.absent} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Fetches the report once, then shows it (or says how to make one). */
export function SynergyStats({ deck, listId }: { deck?: string; listId?: string }) {
  const [loaded, setLoaded] = useState<SynergyLoaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    void loadSynergyReport().then((x) => live && setLoaded(x));
    return () => {
      live = false;
    };
  }, []);
  return <SynergyReportView loaded={loaded} deck={deck} listId={listId} />;
}

/** The view itself, for a report already read; `deck` / `listId` pick the deck shown first. */
export function SynergyReportView({ loaded, deck, listId }: { loaded: SynergyLoaded; deck?: string; listId?: string }) {
  const [pick, setPick] = useState<string | null>(null);
  const [pooled, setPooled] = useState(false);
  const report = loaded.state === 'ready' ? loaded.report : null;
  const current = useMemo(() => {
    if (!report) return undefined;
    const id = pick ?? report.decks.find((d) => (listId && d.listId === listId) || d.name === deck)?.listId ?? report.decks[0]?.listId;
    return report.decks.find((d) => d.listId === id);
  }, [report, pick, deck, listId]);

  if (loaded.state === 'loading') return <p className="muted">Loading the synergy report…</p>;
  if (loaded.state !== 'ready')
    return (
      <div className="empty-state">
        <h2>No synergy report</h2>
        <p>
          Nothing has measured the synergy packages for this site yet. The report is made by <code>npm run sim -- analyze --synergies</code> (or{' '}
          <code>--synergies-only</code>), which watches each list’s packages in bot games and writes <code>public/data/synergies.json</code>.
        </p>
      </div>
    );
  const r = report!;
  const m = r.manifest;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <p className="muted small">
        {r.games.toLocaleString()} bot games
        {m && (
          <>
            {' '}
            · sim v{m.simVersion} · {m.bot.level} bot · seed {m.seedBase} · {m.createdAt.slice(0, 10)}
          </>
        )}{' '}
        · {r.pooled.length} packages
      </p>
      {loaded.state === 'ready' && !loaded.current && (
        <div className="empty-state small" role="note">
          <span aria-hidden="true">⚠ </span>Measured with an earlier version of the synergy catalogue: some packages may have changed since.
        </div>
      )}
      <p className="small">
        <b>Association, not value.</b> {r.note} Slices with fewer than {r.minSliceGames} games show only their size, underlined: not rated. Turns are your own
        turns.
      </p>
      <div className="row">
        <label className="row small">
          <span>Deck</span>
          <select value={current?.listId ?? ''} onChange={(e) => setPick(e.target.value)} disabled={pooled}>
            {r.decks.map((d) => (
              <option key={d.listId} value={d.listId}>
                {d.name} ({d.games} games)
              </option>
            ))}
          </select>
        </label>
        <div className="seg" role="group" aria-label="Which games">
          <button type="button" className={!pooled ? 'on' : ''} aria-pressed={!pooled} onClick={() => setPooled(false)}>
            This list
          </button>
          <button type="button" className={pooled ? 'on' : ''} aria-pressed={pooled} onClick={() => setPooled(true)}>
            All lists pooled
          </button>
        </div>
      </div>
      {pooled ? (
        <div>
          <h3 className="rule-head">Packages, every list pooled</h3>
          <p className="muted small">More games per row, but different decks mixed together; counts are per player-game, with no draw odds.</p>
          <PackageTable rows={r.pooled} rounds={r.rounds} caption="Packages, every list pooled" />
          {r.dormant?.length ? (
            <p className="muted small">
              Not in any library deck (dormant, left out of these tables):{' '}
              {r.dormant.map((d, i) => (
                <span key={d.id} title={d.reason}>
                  {i ? ', ' : ''}
                  <MentionText text={d.name} />
                </span>
              ))}
              .
            </p>
          ) : null}
        </div>
      ) : current ? (
        <>
          <div>
            <h3 className="rule-head">
              Packages · {current.name} · {current.games} games, {pct(current.winRate)} won
            </h3>
            <PackageTable rows={current.synergies} rounds={r.rounds} caption={`Packages in ${current.name}`} />
          </div>
          <div>
            <h3 className="rule-head">Member cards: with and without a partner</h3>
            <p className="muted small">
              Win rate in the games where the card was used (played, Called, gone solo, ability, attack or reaction; selling is not a use) while a partner piece
              of its package was held, and while none was. A game counts once per column.
            </p>
            <CardSplit rows={current.synergies} />
          </div>
        </>
      ) : (
        <p className="muted">This report has no decks.</p>
      )}
    </div>
  );
}
