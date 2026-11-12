// Typed view of deckReports.json (scripts/bundle-reports.ts): large-sample finals, dedicated head-to-heads and forge
// and optimizer history per deck file. About 110 KB, so it has its own module (see src/data/index.ts): the deck
// profile imports it, and the Home page loads it at runtime (loadDeckReports) to keep it out of the entry chunk.
import deckReportsJson from './deckReports.json';

/** One matchup record from the deck's point of view. */
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
  /** SIM_VERSION of the run that measured it (its report's manifest); absent = recorded before manifests */
  simVersion?: number;
}
export interface DeckReports {
  finals?: { overall: number; games: number; date?: string; simVersion?: number; rows: MatchRec[] };
  h2h?: MatchRec[];
  forge?: {
    field?: string;
    gens: { gen: number; baseline: number | null; swaps: { swap: string; wr: number; delta: number }[]; confirm?: string; verdict: 'adopted' | 'rejected' | 'inconclusive' | 'kept' }[];
    summary: { gen: number; wr: number | null; change: string }[];
  };
  optimize?: { vs: string; baseline: number | null; rows: { change: string; s1: number | null; s2: number | null; delta: number }[] }[];
}
export type DeckReportsData = Record<string, DeckReports>;

export const DECK_REPORTS = deckReportsJson as unknown as DeckReportsData;

/** The reports for a deck file ({} when there are none). */
export function deckReports(file: string | undefined): DeckReports {
  return (file && DECK_REPORTS[file]) || {};
}

/**
 * The sim version of a deck's finals and head-to-head reports: the lowest one, or undefined when any of them has none
 * (reports written before manifests, shown as historical) or there are none.
 */
export function reportsSimVersion(r: DeckReports): number | undefined {
  const vs = [...(r.finals ? [r.finals.simVersion] : []), ...(r.h2h ?? []).map((x) => x.simVersion)];
  if (!vs.length || vs.some((v) => typeof v !== 'number')) return undefined;
  return Math.min(...(vs as number[]));
}
