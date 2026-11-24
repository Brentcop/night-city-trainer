// A deck's whole telemetry report, loaded on demand (loadTelemetryReport in src/data/analysisData.ts): undefined until it
// arrives, and for a deck the analysis does not cover.
import { useEffect, useState } from 'react';
import type { DeckReport } from '../analysis/analyze';
import { loadTelemetryReport } from '../data/analysisData';

export function useTelemetryReport(name: string | undefined): DeckReport | undefined {
  const [got, setGot] = useState<{ name: string; report: DeckReport | undefined } | null>(null);
  useEffect(() => {
    if (!name) return;
    let live = true;
    void loadTelemetryReport(name).then((report) => live && setGot({ name, report }));
    return () => {
      live = false;
    };
  }, [name]);
  return got && got.name === name ? got.report : undefined;
}
