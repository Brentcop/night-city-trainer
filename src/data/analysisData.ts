// Typed views of the analysis the site loads (`npm run sim -- analyze`). Since 2026-11-24 (REVIEW_2026-11-24 B.2) the
// analysis covers all 71 library lists, and its site copy (src/data/analysis.json, about 580 kB) is read by the Node tools
// only: the pages load its slices (src/lib/telemetrySlices.ts, cut from that file by scripts/build-telemetry-slices.ts):
//   - ANALYSIS_SUMMARY (src/data/analysis/summary.json, about 20 kB): per deck the win rates, the tempo row after turn 4 and
//     the matchups, for the Play page, the coach's tips, the deck record and the Card stats list;
//   - one deck's whole report (src/data/analysis/decks/<listId>.json), a chunk of its own loaded when a page shows that
//     deck's insights (loadTelemetryReport, useTelemetryReport in src/ui/useTelemetryReport.ts).
// None of it is in the entry chunk (tests/home-data.test.tsx).
import summaryJson from './analysis/summary.json';
import type { DeckReport } from '../analysis/analyze';
import type { AnalysisSummary, AnalysisSummaryDeck } from '../lib/telemetrySlices';

export const ANALYSIS_SUMMARY = summaryJson as unknown as AnalysisSummary;

/** A deck's summary row by deck name. */
export function telemetrySummary(name: string): AnalysisSummaryDeck | undefined {
  return ANALYSIS_SUMMARY.decks.find((d) => d.deck === name);
}

const parts = import.meta.glob<DeckReport>('./analysis/decks/*.json', { import: 'default' });

/** A deck's whole telemetry report by deck name, loaded on demand (undefined when the analysis has none for it). */
export async function loadTelemetryReport(name: string): Promise<DeckReport | undefined> {
  const id = telemetrySummary(name)?.id;
  const load = id ? parts[`./analysis/decks/${id}.json`] : undefined;
  return load ? await load() : undefined;
}
