import { useState } from 'react';
import { CARDS } from '../../engine/cards';
import { CardView } from '../components/CardView';
import { CHOOM_RATINGS, ROLES } from '../../ai/knowledge';
import { SCRIPTS } from '../../engine/scripts';

export function CardsPage() {
  const [q, setQ] = useState('');
  const [color, setColor] = useState('');
  const [type, setType] = useState('');
  const [images, setImages] = useState(false);
  const list = CARDS.filter(
    (c) =>
      (!color || c.color === color) &&
      (!type || c.type === type) &&
      (!q || (c.displayName + ' ' + c.text + ' ' + c.tags.join(' ') + ' ' + (ROLES[c.id] ?? []).join(' ')).toLowerCase().includes(q.toLowerCase())),
  );
  return (
    <div className="grid">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Card database ({list.length})</h1>
        <div className="row">
          <input placeholder="Search name, text, tag, role (e.g. removal)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: 260 }} />
          <select value={color} onChange={(e) => setColor(e.target.value)}>
            <option value="">All colors</option>
            {['Red', 'Blue', 'Green', 'Yellow'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">All types</option>
            {['Legend', 'Unit', 'Gear', 'Program'].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <label className="row small">
            <input type="checkbox" checked={images} onChange={(e) => setImages(e.target.checked)} /> card art
          </label>
        </div>
      </div>
      <div className="zone" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${images ? 230 : 260}px, 1fr))` }}>
        {list.map((c) => (
          <CardView
            key={c.id}
            def={c}
            power={c.power}
            showImage={images}
            extra={
              <div className="row small" style={{ marginTop: 6 }}>
                {c.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
                {(ROLES[c.id] ?? []).map((r) => (
                  <span key={r} className="tag" style={{ borderColor: 'var(--cyan)' }}>
                    {r}
                  </span>
                ))}
                {CHOOM_RATINGS[c.id] && <span className="tag" style={{ borderColor: 'var(--accent)' }}>choom {CHOOM_RATINGS[c.id]}</span>}
                {c.url && (
                  <a className="tag" href={c.url} target="_blank" rel="noreferrer">
                    official page ↗
                  </a>
                )}
                {SCRIPTS[c.id]?.partial && (
                  <span className="tag" title={SCRIPTS[c.id].partial} style={{ borderColor: 'var(--red)' }}>
                    sim: approximated
                  </span>
                )}
              </div>
            }
          />
        ))}
      </div>
    </div>
  );
}
