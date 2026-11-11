// The deck editor's two views of the open list: a text list with +/− controls and the visual card stacks.
import { CARD_BY_ID, cardLabel } from '../../engine/cards';
import { counts, ramLimits } from '../../engine/deck';
import type { CardDef, Color, DeckList } from '../../engine/types';
import { ROLES } from '../../ai/knowledge';
import { costLabel } from './CardView';
import { TcgCard } from './TcgCard';
import { CurveAndTypes } from './DeckCurve';
import { CardNameButton, CardThumb, useCardDialog } from './DeckCards';

const COLORS: Color[] = ['Red', 'Blue', 'Green', 'Yellow'];

export function DeckEditor({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const { open, dialog } = useCardDialog();
  const lim = ramLimits(deck);
  const mainCounts = counts(deck.main);
  const sideCounts = counts(deck.sideboard);
  const add = (id: string, d = 1, where: 'main' | 'sideboard' = 'main') => {
    const list = [...deck[where]];
    if (d > 0) list.push(id);
    else {
      const i = list.indexOf(id);
      if (i >= 0) list.splice(i, 1);
    }
    setDeck({ ...deck, [where]: list });
  };
  const byType = (t: CardDef['type']) => [...mainCounts.entries()].filter(([id]) => CARD_BY_ID[id].type === t).sort((a, b) => (CARD_BY_ID[a[0]].cost ?? 0) - (CARD_BY_ID[b[0]].cost ?? 0));
  const curve: number[] = Array(10).fill(0);
  for (const id of deck.main) curve[Math.min(9, CARD_BY_ID[id].cost ?? 0)]++;
  const maxC = Math.max(1, ...curve);
  const sellable = deck.main.filter((id) => CARD_BY_ID[id].sellable).length;
  const units = deck.main.filter((id) => CARD_BY_ID[id].type === 'Unit').length;

  return (
    <div className="grid cols-2" style={{ marginTop: 10 }}>
      <div>
        <div className="zone-label">Legends ({deck.legends.length}/3)</div>
        {deck.legends.map((id) => (
          <div className="deckrow" key={id}>
            <span className="deckrow-main">
              <CardThumb def={CARD_BY_ID[id]} onOpen={open} />
              <span className={`dot ${CARD_BY_ID[id].color}`} aria-hidden="true" /> <CardNameButton def={CARD_BY_ID[id]} onOpen={open} />{' '}
              <span className="muted small">{CARD_BY_ID[id].cost !== null ? `Go Solo ${CARD_BY_ID[id].cost}` : ''}</span>
            </span>
            <button className="ghost" aria-label={`Remove ${cardLabel(CARD_BY_ID[id])}`} onClick={() => setDeck({ ...deck, legends: deck.legends.filter((x) => x !== id) })}>
              ✕
            </button>
          </div>
        ))}
        <div className="small muted" style={{ margin: '4px 0 10px' }}>
          RAM limits: {COLORS.map((c) => `${c} ${lim[c]}`).join(' · ')}
        </div>
        {(['Unit', 'Gear', 'Program'] as const).map((t) => (
          <div key={t}>
            <div className="zone-label">
              {t}s ({byType(t).reduce((a, [, n]) => a + n, 0)})
            </div>
            {byType(t).map(([id, n]) => (
              <div className="deckrow" key={id} title={CARD_BY_ID[id].text}>
                <span className="deckrow-main">
                  <CardThumb def={CARD_BY_ID[id]} onOpen={open} />
                  <span className="qty">{n}×</span> <span className={`dot ${CARD_BY_ID[id].color}`} aria-hidden="true" /> <CardNameButton def={CARD_BY_ID[id]} onOpen={open} />{' '}
                  <span className="muted small">{costLabel(CARD_BY_ID[id])}€$</span>
                </span>
                <span className="row">
                  <button className="ghost" aria-label={`One fewer ${cardLabel(CARD_BY_ID[id])}`} onClick={() => add(id, -1)}>
                    −
                  </button>
                  <button className="ghost" aria-label={`One more ${cardLabel(CARD_BY_ID[id])}`} onClick={() => add(id, 1)} disabled={n >= 3}>
                    +
                  </button>
                  <button className="ghost" title="Move one copy to sideboard" onClick={() => setDeck({ ...deck, main: removeOne(deck.main, id), sideboard: [...deck.sideboard, id] })}>
                    ↘SB
                  </button>
                </span>
              </div>
            ))}
          </div>
        ))}
        <div className="zone-label">Sideboard ({deck.sideboard.length}/7)</div>
        {[...sideCounts.entries()].map(([id, n]) => (
          <div className="deckrow" key={id}>
            <span className="deckrow-main">
              <CardThumb def={CARD_BY_ID[id]} onOpen={open} />
              <span className="qty">{n}×</span> <CardNameButton def={CARD_BY_ID[id]} onOpen={open} />
            </span>
            <span className="row">
              <button className="ghost" title="Move one copy to the main deck" onClick={() => setDeck({ ...deck, sideboard: removeOne(deck.sideboard, id), main: [...deck.main, id] })}>
                ↖main
              </button>
              <button className="ghost" aria-label={`Remove one ${cardLabel(CARD_BY_ID[id])} from the sideboard`} onClick={() => add(id, -1, 'sideboard')}>
                −
              </button>
            </span>
          </div>
        ))}
      </div>
      <div>
        <div className="zone-label">Stats</div>
        <div className="kv small">
          <span className="muted">Main deck</span>
          <span>{deck.main.length} cards</span>
          <span className="muted">Units</span>
          <span>{units}</span>
          <span className="muted">Sellable (Eddie ratio)</span>
          <span>
            {sellable} ({Math.round((100 * sellable) / Math.max(1, deck.main.length))}%)
          </span>
          <span className="muted">Avg cost</span>
          <span>{(deck.main.reduce((a, id) => a + (CARD_BY_ID[id].cost ?? 0), 0) / Math.max(1, deck.main.length)).toFixed(2)}</span>
        </div>
        <div className="zone-label" style={{ marginTop: 10 }}>
          Cost curve
        </div>
        <div className="row" style={{ alignItems: 'flex-end', height: 90, gap: 4 }}>
          {curve.map((n, c) => (
            <div key={c} style={{ textAlign: 'center', fontSize: 11 }}>
              <div style={{ height: (70 * n) / maxC, width: 22, background: 'var(--accent)', borderRadius: 3 }} title={`${n} cards`} />
              {c}
              {c === 9 ? '+' : ''}
            </div>
          ))}
        </div>
        <div className="zone-label" style={{ marginTop: 10 }}>
          Roles
        </div>
        <div className="row small">
          {Object.entries(
            deck.main.reduce<Record<string, number>>((acc, id) => {
              for (const r of ROLES[id] ?? []) acc[r] = (acc[r] ?? 0) + 1;
              return acc;
            }, {}),
          )
            .sort((a, b) => b[1] - a[1])
            .map(([r, n]) => (
              <span key={r} className="tag">
                {r} {n}
              </span>
            ))}
        </div>
      </div>
      {dialog}
    </div>
  );
}

function removeOne(list: string[], id: string) {
  const l = [...list];
  const i = l.indexOf(id);
  if (i >= 0) l.splice(i, 1);
  return l;
}

// ---------- visual editor: card stacks with +/- controls ----------

export function VisualEditor({ deck, setDeck }: { deck: DeckList; setDeck: (d: DeckList) => void }) {
  const { open, dialog } = useCardDialog();
  const card = (id: string, n?: number) => (
    <TcgCard def={CARD_BY_ID[id]} size="sm" count={n} onClick={() => open(CARD_BY_ID[id])} ariaLabel={`${cardLabel(CARD_BY_ID[id])}${n ? `, ${n} in the list` : ''}: open card details`} />
  );
  const mainCounts = counts(deck.main);
  const sideCounts = counts(deck.sideboard);
  const add = (id: string, d: number, where: 'main' | 'sideboard' = 'main') => {
    const list = d > 0 ? [...deck[where], id] : removeOne(deck[where], id);
    setDeck({ ...deck, [where]: list });
  };
  const byCost = (m: Map<string, number>, t?: CardDef['type']) =>
    [...m.entries()].filter(([id]) => CARD_BY_ID[id] && (!t || CARD_BY_ID[id].type === t)).sort((a, b) => (CARD_BY_ID[a[0]].cost ?? 0) - (CARD_BY_ID[b[0]].cost ?? 0));
  return (
    <div className="vis-editor" style={{ marginTop: 10 }}>
      <div className="zone-label">Legends ({deck.legends.length}/3)</div>
      <div className="dp-cards">
        {deck.legends
          .filter((id) => CARD_BY_ID[id])
          .map((id) => (
            <div className="vis-card" key={id}>
              {card(id)}
              <button className="ghost" onClick={() => setDeck({ ...deck, legends: deck.legends.filter((x) => x !== id) })}>
                ✕ remove
              </button>
            </div>
          ))}
      </div>
      {(['Unit', 'Gear', 'Program'] as const).map((t) => {
        const list = byCost(mainCounts, t);
        if (!list.length) return null;
        return (
          <div key={t} style={{ marginTop: 10 }}>
            <div className="zone-label">
              {t}s ({list.reduce((a, [, n]) => a + n, 0)})
            </div>
            <div className="dp-cards">
              {list.map(([id, n]) => (
                <div className="vis-card" key={id}>
                  {card(id, n)}
                  <div className="row">
                    <button onClick={() => add(id, -1)} title="Remove one copy">
                      −
                    </button>
                    <button onClick={() => add(id, 1)} disabled={n >= 3} title="Add one copy">
                      +
                    </button>
                    <button title="Move one copy to sideboard" onClick={() => setDeck({ ...deck, main: removeOne(deck.main, id), sideboard: [...deck.sideboard, id] })}>
                      SB
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
      {sideCounts.size > 0 && (
        <div style={{ marginTop: 10 }}>
          <div className="zone-label">Sideboard ({deck.sideboard.length}/7)</div>
          <div className="dp-cards">
            {byCost(sideCounts).map(([id, n]) => (
              <div className="vis-card" key={id}>
                {card(id, n)}
                <div className="row">
                  <button onClick={() => add(id, -1, 'sideboard')} title="Remove from sideboard">
                    −
                  </button>
                  <button title="Move one copy to the main deck" onClick={() => setDeck({ ...deck, sideboard: removeOne(deck.sideboard, id), main: [...deck.main, id] })}>
                    Main
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <CurveAndTypes deck={deck} />
      </div>
      {dialog}
    </div>
  );
}
