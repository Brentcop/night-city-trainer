// Typed view of analysis.json (`npm run sim -- analyze`): the telemetry report of every analysed deck. About 330 KB,
// so it has its own module (see src/data/index.ts) and stays out of the entry chunk: the deck profile, Card stats,
// Strategy and Play pages import it.
import analysisJson from './analysis.json';
import type { AnalysisData } from './index';
import type { DeckReport } from '../analysis/analyze';

export const ANALYSIS = analysisJson as unknown as AnalysisData;

/** A deck's telemetry report by deck name. */
export function telemetryReport(name: string): DeckReport | undefined {
  return ANALYSIS.decks.find((d) => d.deck === name);
}
