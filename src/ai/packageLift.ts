// INFO-8: which of a list's synergy packages the coach may talk about. The coach's package notes and warnings
// (packageNotes / packageWarnings in coach.ts) are shown only for a package whose measured lift has a 95% interval above
// 0, read from the synergy report (public/data/synergies.json, `npm run sim -- analyze --synergies`; docs/SYNERGIES.md).
// Lift = win rate in games where the package came online minus win rate in games where it never did. That is an
// association, not value: a package that comes online in games already going well looks good for that reason alone, so
// the wording says so. With no report (not loaded, missing, or made with another catalogue) every package is
// "unmeasured" and the notes say they are an idea from the catalogue; with a report, a package without a lift above 0
// is left out. Plain data throughout: the Play page builds a seat's table and the coach worker gets it in the request.
import type { SynergyReport, SynergyRow } from '../analysis/synergies';

/** One package's measured lift on a list (or pooled over every list that holds it). Rates and bounds are 0–1. */
export interface PackageLift {
  /** 'list': measured on this exact list; 'pooled': every list that holds the package, mixed (this list's slices were thin or absent) */
  basis: 'list' | 'pooled';
  online: number;
  never: number;
  onlineGames: number;
  neverGames: number;
  /** online − never */
  lift: number;
  /** Newcombe's 95% interval for the difference, from the two Wilson intervals */
  low95: number;
  high95: number;
}

/**
 * What the coach knows about one seat's packages: null when there is no usable report (every package unmeasured), else
 * the lift of each package id the report measured (an id missing here was not measured enough to say anything).
 */
export type SeatLift = Record<string, PackageLift> | null;

/** Newcombe's hybrid score interval (method 10) for p1 − p2 from each rate's Wilson bounds. */
export function newcombeDiff(p1: number, l1: number, u1: number, p2: number, l2: number, u2: number): { low95: number; high95: number } {
  const d = p1 - p2;
  return { low95: d - Math.sqrt((p1 - l1) ** 2 + (u2 - p2) ** 2), high95: d + Math.sqrt((u1 - p1) ** 2 + (p2 - l2) ** 2) };
}

function liftOf(r: SynergyRow, basis: PackageLift['basis']): PackageLift | null {
  const a = r.online;
  const b = r.never;
  if (a.thin || b.thin || a.winRate === null || b.winRate === null || a.low95 === null || a.high95 === null || b.low95 === null || b.high95 === null) return null;
  return { basis, online: a.winRate, never: b.winRate, onlineGames: a.games, neverGames: b.games, lift: a.winRate - b.winRate, ...newcombeDiff(a.winRate, a.low95, a.high95, b.winRate, b.low95, b.high95) };
}

/**
 * A seat's table from a report: each package measured on this list (`listId`, listFingerprint), else pooled over every
 * list. `current` false (a report made with another catalogue version) counts as no report.
 */
export function seatLift(report: SynergyReport | null | undefined, listId: string | undefined, current = true): SeatLift {
  if (!report || !current) return null;
  const out: Record<string, PackageLift> = {};
  for (const r of report.pooled) {
    const l = liftOf(r, 'pooled');
    if (l) out[r.id] = l;
  }
  const own = listId ? report.decks.find((d) => d.listId === listId) : undefined;
  for (const r of own?.synergies ?? []) {
    const l = liftOf(r, 'list');
    if (l) out[r.id] = l;
  }
  return out;
}

/** How the coach may speak of a package: 'measured' (lift interval above 0), 'unmeasured' (no report), or 'hidden'. */
export function liftGate(lift: SeatLift | undefined, id: string): 'measured' | 'unmeasured' | 'hidden' {
  if (!lift) return 'unmeasured';
  const l = lift[id];
  return l && l.low95 > 0 ? 'measured' : 'hidden';
}

const pc = (x: number) => `${Math.round(x * 100)}%`;

const andList = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);

/**
 * The label a note carries for the packages it names: for each measured one what was measured, as an association; for
 * the unmeasured ones (no report) that they are ideas from the catalogue. Hidden packages are not named at all.
 */
export function liftLabel(lift: SeatLift | undefined, pkgs: readonly { id: string; name: string }[]): string {
  const out: string[] = [];
  const unmeasured = pkgs.filter((x) => liftGate(lift, x.id) === 'unmeasured').map((x) => x.name);
  if (unmeasured.length) out.push(`(${andList(unmeasured)} ${unmeasured.length > 1 ? 'are ideas' : 'is an idea'} from the package catalogue, not measured in bot games.)`);
  for (const x of pkgs) {
    if (liftGate(lift, x.id) !== 'measured') continue;
    const l = lift![x.id]!;
    const where = l.basis === 'list' ? 'on this list' : 'pooled over every list that holds it';
    out.push(`(In bot games ${where}, games where ${x.name} came online were won ${pc(l.online)} of the time, against ${pc(l.never)} when it never did: an association, not proof that it wins games.)`);
  }
  return out.join(' ');
}
