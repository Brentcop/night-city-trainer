// The deck editor's card search: filter the card pool and add cards to the open list.
import { useState } from 'react';
import { CARDS, CARD_BY_ID } from '../../engine/cards';
import { ramLimits } from '../../engine/deck';
import type { CardDef, Color, DeckList } from '../../engine/types';
import { CardText, CardView } from './CardView';

const COLORS: Color[] = ['Red', 'Blue', 'Green', 'Yellow'];

export function CardBrowser({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const [q, setQ] = useState('');
  const [color, setColor] = useState<string>('');
  const [type, setType] = useState<string>('');
  const [legalOnly, setLegalOnly] = useState(true);
  const lim = ramLimits(deck);
  const list = CARDS.filter(
    (c) =>
      (!color || c.color === color) &&
      (!type || c.type === type) &&
      (!q || (c.displayName + ' ' + c.text + ' ' + c.tags.join(' ')).toLowerCase().includes(q.toLowerCase())) &&
      (!legalOnly || c.type === 'Legend' || deck.legends.length < 3 || c.ram <= lim[c.color]),
  );
  const addCard = (c: CardDef) => {
    if (c.type === 'Legend') {
      if (deck.legends.length >= 3 || deck.legends.some((id) => CARD_BY_ID[id].name === c.name)) return;
      setDeck({ ...deck, legends: [...deck.legends, c.id] });
    } else setDeck({ ...deck, main: [...deck.main, c.id] });
  };
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>Add cards</h3>
        <div className="row">
          <input aria-label="Search cards" placeholder="Search name, text, tag…" value={q} onChange={(e) => setQ(e.target.value)} />
          <select aria-label="Card colour" value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">All colors</option>
            {COLORS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select aria-label="Card type" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {['Legend', 'Unit', 'Gear', 'Program'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="row small">
            <input type="checkbox" checked={legalOnly} onChange={(e) => setLegalOnly(e.target.checked)} /> fits RAM
          </label>
        </div>
      </div>
      <div className="zone" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', maxHeight: 640, overflowY: 'auto' }}>
        {list.map((c) => {
          const n = c.type === 'Legend' ? (deck.legends.includes(c.id) ? 1 : 0) : deck.main.filter((x) => x === c.id).length;
          return (
            <CardView
              key={c.id}
              def={c}
              power={c.power}
              extra={
                <div className="spread" style={{ marginTop: 6 }}>
                  <span className="small muted">in deck: {n}</span>
                  <button aria-label={`Add ${c.displayName}`} onClick={() => addCard(c)} disabled={c.type === 'Legend' ? n > 0 || deck.legends.length >= 3 : n >= 3}>
                    + Add
                  </button>
                </div>
              }
            />
          );
        })}
      </div>
      <p className="small muted">
        <CardText text="Keywords like {Blocker}, {Quick} and {Go Solo} are explained in the Glossary." />
      </p>
    </div>
  );
}
