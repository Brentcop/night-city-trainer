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

export function CardView({
  def,
  power,
  spent,
  extra,
  onClick,
  clickable,
  selected,
  compact,
  showImage,
}: {
  def: CardDef;
  power?: number | null;
  spent?: boolean;
  extra?: React.ReactNode;
  onClick?: () => void;
  clickable?: boolean;
  selected?: boolean;
  compact?: boolean;
  showImage?: boolean;
}) {
  const cls = ['card', def.color, clickable ? 'clickable' : '', selected ? 'selected' : '', spent ? 'spent' : ''].join(' ');
  return (
    <div className={cls} onClick={onClick} title={def.text}>
      {showImage && def.image && <img src={def.image} alt={def.displayName} loading="lazy" />}
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
