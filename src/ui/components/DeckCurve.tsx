// A deck's cost curve and card-type split, shared by the deck profile and the deck editor's card view.
import { CARD_BY_ID } from '../../engine/cards';
import type { DeckList } from '../../engine/types';
import { typeSplit } from '../../lib/deckTypes';
import { TypeLegend, TypeSplitBar } from './TypeSplit';

export function CurveAndTypes({ deck }: { deck: DeckList }) {
  const ids = deck.main.filter((id) => CARD_BY_ID[id]);
  const curve: number[] = Array(9).fill(0);
  for (const id of ids) curve[Math.min(8, CARD_BY_ID[id].cost ?? 0)]++;
  const maxC = Math.max(1, ...curve);
  const split = typeSplit(ids);
  const n = Math.max(1, ids.length);
  const avg = ids.reduce((a, id) => a + (CARD_BY_ID[id].cost ?? 0), 0) / n;
  const sellable = ids.filter((id) => CARD_BY_ID[id].sellable).length;
  return (
    <div className="grid cols-2">
      <div>
        <div className="zone-label">Cost curve</div>
        <p className="dp-caption">Main-deck cards at each Eddie (€$) cost · average {avg.toFixed(2)}</p>
        <div className="dp-curve">
          {curve.map((c, i) => (
            <div key={i} title={`${c} cards at cost ${i}${i === 8 ? '+' : ''}`}>
              <span className="muted">{c || ''}</span>
              <div className="col" style={{ height: `${(80 * c) / maxC}%` }} />
              <span>
                {i}
                {i === 8 ? '+' : ''}
              </span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="zone-label">Card types</div>
        <p className="dp-caption">
          {ids.length} main-deck cards · {sellable} sellable for Eddies ({Math.round((100 * sellable) / n)}%)
        </p>
        <TypeSplitBar split={split} />
        <TypeLegend split={split} className="dp-type-legend" />
      </div>
    </div>
  );
}
