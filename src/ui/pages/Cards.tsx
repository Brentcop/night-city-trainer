import { useMemo, useState } from 'react';
import { CARDS } from '../../engine/cards';
import type { CardDef } from '../../engine/types';
import { ROLES } from '../../ai/knowledge';
import { TcgCard } from '../components/TcgCard';
import { useArt } from '../art';
import { CardModal } from '../components/CardModal';
import { PageHead } from '../components/PageHead';

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
      <PageHead kicker="Learn" title="Card database">
        {list.length} of {CARDS.length} cards · Welcome to Night City. Choose a card for its full text, rulings and the decks that play it.
      </PageHead>
      <div className="filterbar">
        <input aria-label="Search cards" placeholder="Search name, text, tag, role (e.g. removal, blocker)…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1, minWidth: 220 }} />
        <div className="seg">
          <button className={!color ? 'on' : ''} aria-pressed={!color} onClick={() => setColor('')}>
            All
          </button>
          {COLORS.map((c) => (
            <button key={c} className={color === c ? 'on' : ''} aria-pressed={color === c} onClick={() => setColor(color === c ? '' : c)}>
              <span className={`dot ${c}`} /> {c}
            </button>
          ))}
        </div>
        <div className="seg">
          {TYPES.map((t) => (
            <button key={t} className={type === t ? 'on' : ''} aria-pressed={type === t} onClick={() => setType(type === t ? '' : t)}>
              {t}
            </button>
          ))}
        </div>
        <select aria-label="Sort cards" value={sort} onChange={(e) => setSort(e.target.value as any)}>
          <option value="cost">Sort: cost</option>
          <option value="power">Sort: power</option>
          <option value="name">Sort: name</option>
        </select>
      </div>
      {unavailable && <div className="empty-state small">Card art couldn't be loaded (offline?), so cards are shown as text frames.</div>}
      {list.length === 0 && <div className="empty-state">No cards match these filters.</div>}
      <div className="card-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
        {list.map((c) => (
          <TcgCard key={c.id} def={c} size="md" onClick={() => setOpen(c)} ariaLabel={`${c.displayName}: open card details`} />
        ))}
      </div>
      {open && <CardModal def={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
