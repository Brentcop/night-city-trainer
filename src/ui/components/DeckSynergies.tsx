// The deck profile's "Synergies in this list" block: the packages of the synergy catalogue (src/content/synergies) the
// list holds, with copies per role, whether the list is built around each, the odds of holding the needed pieces by
// turns 2, 4 and 6, and, when public/data/synergies.json has measured this exact list, how often each package came
// online and the win rates online versus never online (association, not value).
import { useEffect, useId, useMemo, useState } from 'react';
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import { listFingerprint } from '../../engine/deck';
import type { DeckList } from '../../engine/types';
import { ODDS_ROUNDS, synergiesIn, type ListSynergy } from '../../content/synergies';
import type { SynergyRow } from '../../analysis/synergies';
import { loadSynergyReport, pct, type SynergyLoaded } from '../synergyReport';
import { SliceCell } from './DecisionStats';
import { RateCell, roleText } from './SynergyStats';

const name = (id: string) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id);

function Measured({ row, report }: { row: SynergyRow | undefined; report: boolean }) {
  if (!row) return <span className="muted small">{report ? 'not measured for this list' : 'no synergy report yet'}</span>;
  return (
    <span className="small">
      online in <RateCell r={row.onlineRate} />
      {row.medianRound !== null && <> (median turn {row.medianRound})</>} · won <SliceCell s={row.online} /> when online, <SliceCell s={row.never} /> when never
    </span>
  );
}

export function DeckSynergies({ deck, named = [] }: { deck: Pick<DeckList, 'legends' | 'main'>; named?: readonly string[] }) {
  const headingId = useId();
  const found: ListSynergy[] = useMemo(() => synergiesIn(deck), [deck]);
  const listId = useMemo(() => listFingerprint(deck), [deck]);
  const [loaded, setLoaded] = useState<SynergyLoaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    void loadSynergyReport().then((x) => live && setLoaded(x));
    return () => {
      live = false;
    };
  }, []);
  const measured = loaded.state === 'ready' ? loaded.report.decks.find((d) => d.listId === listId) : undefined;
  if (!found.length) return null;
  return (
    <section className="panel dp-synergies" aria-labelledby={headingId}>
      <h2 id={headingId} className="dp-section-title rule-head">
        Synergies in this list
      </h2>
      <p className="dp-caption">
        Packages from the synergy catalogue (drafts, being checked by the owner) that this list holds the pieces for. Odds: the chance of holding the needed
        pieces by your own turn {ODDS_ROUNDS.join(', ')} from the opening 6 and one draw a turn, with Legends counted as held.
        {measured
          ? ` Measured: ${measured.games} bot games of this list; rates are association, not value.`
          : loaded.state === 'ready'
            ? ' The synergy report has not measured this exact list.'
            : ''}
        {loaded.state === 'ready' && !loaded.current && ' The report used an earlier version of the catalogue.'}
      </p>
      <div className="scroll-x">
        <table className="small">
          <thead>
            <tr>
              <th scope="col">Package</th>
              <th scope="col">Pieces in the list</th>
              <th scope="col">Odds by turn {ODDS_ROUNDS.join(' / ')}</th>
              <th scope="col">Measured</th>
            </tr>
          </thead>
          <tbody>
            {found.map((x) => (
              <tr key={x.synergy.id}>
                <th scope="row" style={{ fontWeight: 'normal' }} title={`${x.synergy.description} Online: ${x.synergy.onlineText}`}>
                  <b>{x.synergy.name}</b>
                  {x.builtAround && <span className="tag" style={{ marginLeft: 6 }}>built around</span>}
                  {named.includes(x.synergy.id) && <span className="tag" style={{ marginLeft: 6 }}>in the game plan</span>}
                  <div className="muted small">{x.synergy.bond === 'requires' ? 'pieces need each other' : 'pieces help each other'}</div>
                </th>
                <td>
                  {roleText(x.copies)}
                  <div className="muted small">
                    {x.cards
                      .slice(0, 6)
                      .map((c) => `${c.copies}× ${name(c.id)}`)
                      .join(', ')}
                    {x.cards.length > 6 && `, +${x.cards.length - 6} more`}
                  </div>
                </td>
                <td className="num">{x.odds.map((o) => pct(o.p)).join(' / ')}</td>
                <td>
                  <Measured row={measured?.synergies.find((s) => s.id === x.synergy.id)} report={loaded.state === 'ready'} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
