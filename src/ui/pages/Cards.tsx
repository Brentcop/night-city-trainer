import { useMemo, useState } from 'react';
import { CARDS } from '../../engine/cards';
import type { CardDef } from '../../engine/types';
import { CHOOM_RATINGS, ROLES } from '../../ai/knowledge';
import { SCRIPTS } from '../../engine/scripts';
import { TcgCard } from '../components/TcgCard';
import { CardText } from '../components/CardView';
import { useArt } from '../art';
import { allDecks } from '../../lib/browserLibrary';

const COLORS = ['Red', 'Blue', 'Green', 'Yellow'];
const TYPES = ['Legend', 'Unit', 'Gear', 'Program'];

export function CardsPage() {
  const [q, setQ] = useState('');
  const [color, setColor] = useState('');
  const [type, setType] = useState('');
  const [sort, setSort] = useState<'cost' | 'name' | 'power'>('cost');
  const [open, setOpen] = useState<CardDef | null>(null);
  const { unavailable } = useArt(undefined);
  const list = useMemo(
    () =>
      CARDS.filter(
        (c) =>
          (!color || c.color === color) &&
          (!type || c.type === type) &&
          (!q || (c.displayName + ' ' + c.text + ' ' + c.tags.join(' ') + ' ' + (ROLES[c.id] ?? []).join(' ')).toLowerCase().includes(q.toLowerCase())),
      ).sort((a, b) =>
        sort === 'name' ? a.displayName.localeCompare(b.displayName) : sort === 'power' ? (b.power ?? -1) - (a.power ?? -1) : (a.cost ?? 0) - (b.cost ?? 0) || a.displayName.localeCompare(b.displayName),
      ),
    [q, color, type, sort],
  );
  return (
    <div className="grid">
      <div className="spread">
        <h1 style={{ margin: 0 }}>Card database</h1>
        <span className="muted small">{list.length} of 150 cards · Welcome to Night City</span>
      </div>
      <div className="filterbar">
        <input placeholder="Search name, text, tag, role (e.g. removal, blocker)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <div className="seg">
          <button className={!color ? 'on' : ''} onClick={() => setColor('')}>
            All
          </button>
          {COLORS.map((c) => (
            <button key={c} className={color === c ? 'on' : ''} onClick={() => setColor(color === c ? '' : c)}>
              <span className={`dot ${c}`} /> {c}
            </button>
          ))}
        </div>
        <div className="seg">
          {TYPES.map((t) => (
            <button key={t} className={type === t ? 'on' : ''} onClick={() => setType(type === t ? '' : t)}>
              {t}
            </button>
          ))}
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="cost">Sort: cost</option>
          <option value="power">Sort: power</option>
          <option value="name">Sort: name</option>
        </select>
      </div>
      {unavailable && <div className="panel small muted">Card art couldn't be loaded (offline?), so cards are shown as text frames.</div>}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {list.map((c) => (
          <TcgCard key={c.id} def={c} size="md" onClick={() => setOpen(c)} />
        ))}
      </div>
      {open && <CardModal def={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function CardModal({ def, onClose }: { def: CardDef; onClose: () => void }) {
  const decks = allDecks().filter((d) => d.deck.legends.includes(def.id) || d.deck.main.includes(def.id));
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="ghost modal-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="modal-body">
          <TcgCard def={def} size="xl" noZoom />
          <div style={{ minWidth: 0, flex: 1 }}>
            <h2 style={{ marginTop: 0 }}>{def.displayName}</h2>
            <div className="row small">
              <span className={`dot ${def.color}`} /> {def.color} · {def.type} · {def.cost ?? '–'} €$ · RAM {def.ram}
              {def.power !== null && ` · power ${def.power}`}
              {def.sellable && <span className="tag">sellable</span>}
            </div>
            <p style={{ whiteSpace: 'pre-wrap' }}>
              <CardText text={def.text} />
            </p>
            <div className="row small">
              {def.tags.map((t) => (
                <span key={t} className="tag">
                  {t}
                </span>
              ))}
              {(ROLES[def.id] ?? []).map((r) => (
                <span key={r} className="tag" style={{ borderColor: 'var(--cyan)' }}>
                  {r}
                </span>
              ))}
              {CHOOM_RATINGS[def.id] && <span className="tag" style={{ borderColor: 'var(--accent)' }}>choom.gg rating {CHOOM_RATINGS[def.id]}</span>}
              {SCRIPTS[def.id]?.partial && (
                <span className="tag" style={{ borderColor: 'var(--red)' }} title={SCRIPTS[def.id].partial}>
                  sim: approximated
                </span>
              )}
            </div>
            {def.url && (
              <p className="small">
                <a href={def.url} target="_blank" rel="noreferrer">
                  Official card page & rulings ↗
                </a>
              </p>
            )}
            <h3>In {decks.length} library decks</h3>
            <div className="row small" style={{ maxHeight: 160, overflowY: 'auto' }}>
              {decks.map((d) => (
                <a key={d.file} className="tag" href={`#/deck?d=${encodeURIComponent(d.file)}`}>
                  {d.deck.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
