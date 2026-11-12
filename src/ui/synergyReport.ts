// The synergy report (public/data/synergies.json, written by `npm run sim -- analyze --synergies`), fetched once at
// runtime by the Card stats page's Synergies view and the deck profile's "Synergies in this list" block. Never imported
// by the Home entry chunk; no report is bundled with the site.
import { useEffect, useState } from 'react';
import { CATALOGUE_VERSION } from '../content/synergies';
import type { SynergyReport } from '../analysis/synergies';

/**
 * - missing: no usable report
 * - ready:   a report; `current` is false when it was made with another version of the catalogue (packages may differ)
 */
export type SynergyLoaded = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; report: SynergyReport; current: boolean };

/** What a fetched synergies.json holds. */
export function readSynergyReport(j: unknown): SynergyLoaded {
  const r = j as SynergyReport | null;
  if (!r || typeof r !== 'object' || r.kind !== 'synergy-report' || !Array.isArray(r.decks) || !Array.isArray(r.pooled)) return { state: 'missing' };
  return { state: 'ready', report: r, current: r.catalogueVersion === CATALOGUE_VERSION };
}

let file: Promise<SynergyLoaded> | null = null;
export function loadSynergyReport(): Promise<SynergyLoaded> {
  file ??= fetch(`${import.meta.env.BASE_URL}data/synergies.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then(readSynergyReport)
    .catch((): SynergyLoaded => ({ state: 'missing' }));
  return file;
}

/** The report, loaded on first use (a fetch, so it never weighs on the entry chunk). */
export function useSynergyReport(): SynergyLoaded {
  const [loaded, setLoaded] = useState<SynergyLoaded>({ state: 'loading' });
  useEffect(() => {
    let live = true;
    void loadSynergyReport().then((x) => live && setLoaded(x));
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

/** "42%", or "—" for no rate. */
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);
