// Numbers that read at a glance: win rates and deltas coloured good / even / bad, with the sample size on hover.
// Thresholds: ≥ 55% is good, ≤ 45% is bad, in between is a coin flip (±5 points is usually noise at these sample sizes).

export type Tone = 'pos' | 'neu' | 'neg';
export const wrTone = (v: number, good = 0.55, bad = 0.45): Tone => (v >= good ? 'pos' : v <= bad ? 'neg' : 'neu');
const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** A win rate, coloured. `n` = games behind it (shown on hover; small samples are dimmed). */
export function Wr({ v, n, digits = 0, strong }: { v: number | null | undefined; n?: number; digits?: number; strong?: boolean }) {
  if (!ok(v)) return <span className="num muted">—</span>;
  const text = `${(v * 100).toFixed(digits)}%`;
  const small = n !== undefined && n < 20;
  return (
    <span className={`num ${wrTone(v)} ${small ? 'thin' : ''}`} title={n !== undefined ? `${text} over ${n} game${n === 1 ? '' : 's'}${small ? ' (small sample)' : ''}` : undefined}>
      {strong ? <b>{text}</b> : text}
    </span>
  );
}

/** A signed change, coloured (e.g. "Δ when drawn" in win-rate points). `scale` 100 turns fractions into points. */
export function Signed({ v, digits = 1, scale = 100, unit = '', dead = 0.005 }: { v: number | null | undefined; digits?: number; scale?: number; unit?: string; dead?: number }) {
  if (!ok(v)) return <span className="num muted">—</span>;
  const tone: Tone = v > dead ? 'pos' : v < -dead ? 'neg' : 'neu';
  return (
    <span className={`num ${tone}`}>
      {v > 0 ? '+' : v < 0 ? '−' : '±'}
      {Math.abs(v * scale).toFixed(digits)}
      {unit}
    </span>
  );
}

/** A one-word matchup verdict chip. */
export function Verdict({ v, n }: { v: number | null | undefined; n?: number }) {
  if (!ok(v)) return null;
  const t = wrTone(v);
  const word = v >= 0.62 ? 'Strong' : t === 'pos' ? 'Favored' : t === 'neg' ? (v <= 0.38 ? 'Hard' : 'Unfavored') : 'Even';
  return (
    <span className={`verdict ${t}`} title={n !== undefined ? `${Math.round(v * 100)}% over ${n} games` : undefined}>
      {word}
    </span>
  );
}

/** Small legend explaining the colours. */
export function ToneLegend() {
  return (
    <span className="tone-legend small muted">
      <span className="num pos">■</span> 55%+ good · <span className="num neu">■</span> even · <span className="num neg">■</span> 45% or less
    </span>
  );
}
