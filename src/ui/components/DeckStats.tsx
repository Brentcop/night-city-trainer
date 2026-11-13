// Small deck-stat components shared by the Home page, the Decks gallery, the tournament runner and the deck profile.
// Kept out of src/ui/pages/DeckProfile.tsx so the Home page (in the entry chunk) does not pull in the whole profile page.
import { useEffect, useState } from 'react';
import { pct } from '../../lib/deckStats';
import { lessMotion } from '../useBoardSettings';

// The report data itself (deckReports.json) is in src/data/deckReportsData.ts, so this file stays small for Home.
export type { DeckReports, MatchRec } from '../../data/deckReportsData';

export const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

export function profileHref(file: string) {
  return `#/deck?d=${encodeURIComponent(file)}`;
}

export function WrBar({ v, title }: { v: number | null | undefined; title?: string }) {
  if (!ok(v)) return <div className="wrbar" title={title} />;
  const cls = v >= 0.55 ? '' : v <= 0.45 ? 'lose' : 'even';
  return (
    <div className={`wrbar ${cls}`} title={title ?? pct(v, 1)}>
      <div className="fill" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
      <div className="mid" />
    </div>
  );
}

/** Counts a numeric stat up from zero when it first appears ("72%", "13.5", "527"); other values render as-is. */
function CountUp({ value }: { value: React.ReactNode }) {
  const m = typeof value === 'string' || typeof value === 'number' ? String(value).match(/^(\d+(?:\.\d+)?)(%?)$/) : null;
  const target = m ? +m[1] : 0;
  const digits = m?.[1].includes('.') ? m[1].split('.')[1].length : 0;
  const numeric = !!m;
  const [v, setV] = useState(numeric ? 0 : target);
  useEffect(() => {
    if (!numeric) return;
    if (lessMotion()) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, numeric]);
  if (!m) return <>{value}</>;
  return (
    <>
      {v.toFixed(digits)}
      {m[2]}
    </>
  );
}

export function StatTile({ value, label, caption }: { value: React.ReactNode; label: string; caption?: React.ReactNode }) {
  return (
    <div className="dp-tile">
      <div className="dp-tile-val">
        <CountUp value={value} />
      </div>
      <div className="dp-tile-label">{label}</div>
      {caption && <div className="dp-tile-cap">{caption}</div>}
    </div>
  );
}
