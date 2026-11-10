// Gig die rendered as an SVG polyhedron outline (shape by die type) with its current value.
const SHAPES: Record<number, string> = {
  4: '50,6 94,88 6,88', // triangle
  6: '10,10 90,10 90,90 10,90', // square
  8: '50,4 94,50 50,96 6,50', // diamond
  10: '50,4 92,40 76,94 24,94 8,40', // kite-ish pentagon
  12: '50,4 90,30 90,72 50,96 10,72 10,30', // hexagon
  20: '50,3 88,24 94,66 68,96 32,96 6,66 12,24', // heptagon-ish
};

export function Die({
  sides,
  value,
  size = 44,
  owner,
  pending,
  onClick,
  highlight,
  title,
}: {
  sides: number;
  value?: number;
  size?: number;
  owner?: 'me' | 'rival';
  pending?: boolean; // still in the fixer area
  onClick?: () => void;
  highlight?: boolean;
  title?: string;
}) {
  const isMax = value === sides;
  const isMin = value === 1;
  return (
    <svg
      className={['die', owner ? `die-${owner}` : '', pending ? 'die-pending' : '', highlight ? 'die-hl' : '', onClick ? 'is-click' : ''].join(' ')}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <title>{title ?? `d${sides}${value !== undefined ? `: ${value}` : ''}`}</title>
      <polygon points={SHAPES[sides] ?? SHAPES[6]} />
      <text x="50" y={sides === 4 ? 70 : 60} textAnchor="middle" className={isMax ? 'die-max' : isMin ? 'die-min' : ''}>
        {pending ? `d${sides}` : value}
      </text>
      {!pending && (
        <text x="50" y="92" textAnchor="middle" className="die-sides">
          d{sides}
        </text>
      )}
    </svg>
  );
}
