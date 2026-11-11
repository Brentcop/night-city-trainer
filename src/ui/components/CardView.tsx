import type { CardDef } from '../../engine/types';

export function costLabel(c: CardDef) {
  return c.cost === null ? '–' : String(c.cost);
}

/** Render card text with {Keyword} tokens emphasized. */
export function CardText({ text }: { text: string }) {
  const parts = text.split(/(\{[^}]+\})/g);
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('{') ? (
          <b key={i} style={{ color: 'var(--cyan)' }}>
            {p.slice(1, -1).toUpperCase()}
          </b>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </span>
  );
}

/** A card as a text frame (the deck editor's card browser). Not clickable itself: put controls in `extra`. */
export function CardView({ def, power, extra, compact }: { def: CardDef; power?: number | null; extra?: React.ReactNode; compact?: boolean }) {
  return (
    <div className={`card ${def.color}`} title={def.text}>
      {power !== undefined && power !== null && <span className="pw">{power}</span>}
      <div className="name" style={{ paddingRight: power !== undefined ? 26 : 0 }}>
        {def.displayName}
      </div>
      <div className="meta">
        {def.type} · {costLabel(def)} €$ · {def.color} RAM {def.ram}
        {def.sellable ? ' · sellable' : ''}
      </div>
      {!compact && (
        <div className="text">
          <CardText text={def.text} />
        </div>
      )}
      {extra}
    </div>
  );
}
