// Segmented Unit / Gear / Program bar (colours from the --type-* tokens) and its legend.
import { MAIN_TYPES, typeSplitText, type TypeSplit } from '../../lib/deckTypes';

export function TypeSplitBar({ split, mini }: { split: TypeSplit; mini?: boolean }) {
  const n = Math.max(1, split.total);
  const text = typeSplitText(split);
  return (
    <div className={`typesplit${mini ? ' mini' : ''}`} title={text} role="img" aria-label={`Main deck: ${text}`}>
      {split.types.map(([t, c]) => (c ? <div key={t} className={`type-${t}`} style={{ width: `${(100 * c) / n}%` }} title={mini ? undefined : `${t}: ${c}`} /> : null))}
    </div>
  );
}

/** Colour key. With a split, also shows each count and share. */
export function TypeLegend({ split, className = '' }: { split?: TypeSplit; className?: string }) {
  const n = Math.max(1, split?.total ?? 1);
  return (
    <span className={`type-legend small ${className}`}>
      {(split?.types ?? MAIN_TYPES.map((t) => [t, 0] as const)).map(([t, c]) => (
        <span key={t}>
          <span className={`type-key type-${t}`} aria-hidden="true" />
          {t}
          {split && ` ${c} (${Math.round((100 * c) / n)}%)`}
        </span>
      ))}
    </span>
  );
}
