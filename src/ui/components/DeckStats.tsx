// Small deck-stat helpers shared by the Home page, the Decks gallery, the tournament runner and the deck profile.
// Kept out of src/ui/pages/DeckProfile.tsx so the Home page (in the entry chunk) does not pull in the whole profile page.
import { useEffect, useState } from 'react';
import deckReportsData from '../../data/deckReports.json';
import { pct } from '../../lib/deckStats';

export const ok = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);

/** One matchup record from the deck's point of view (see scripts/bundle-reports.ts). */
export interface MatchRec {
  opp: string;
  oppFile?: string;
  g: number;
  w: number; // win rate, ties count half
  ties: number;
  fw: number; // wins / games on the play
  fg: number;
  sw: number; // wins / games on the draw
  sg: number;
  turns?: number;
  ot?: number;
}
export interface DeckReports {
  finals?: { overall: number; games: number; date?: string; rows: MatchRec[] };
  h2h?: MatchRec[];
  forge?: {
    field?: string;
    gens: { gen: number; baseline: number | null; swaps: { swap: string; wr: number; delta: number }[]; confirm?: string; verdict: 'adopted' | 'rejected' | 'kept' }[];
    summary: { gen: number; wr: number | null; change: string }[];
  };
  optimize?: { vs: string; baseline: number | null; rows: { change: string; s1: number | null; s2: number | null; delta: number }[] }[];
}
const DR = deckReportsData as unknown as Record<string, DeckReports>;
export function deckReports(file: string | undefined): DeckReports {
  return (file && DR[file]) || {};
}

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
  const [v, setV] = useState(m ? 0 : target);
  useEffect(() => {
    if (!m) return;
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return setV(target);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, !!m]);
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
