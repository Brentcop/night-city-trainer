// The synergy report (public/data/synergies.json, written by `npm run sim -- analyze --synergies`), fetched once at
// runtime by the Card stats page's Synergies view and the deck profile's "Synergies in this list" block. Never imported
// by the Home entry chunk; no report is bundled with the site. The Play page reads the small lift slice instead
// (useLiftSlice, below), and only while the coach is on.
import { useEffect, useState } from 'react';
import { CATALOGUE_VERSION } from '../content/synergies';
import type { SynergyReport } from '../analysis/synergies';
import { readLiftSlice, type LiftSlice } from '../ai/packageLift';

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

/**
 * The lift slice (public/data/lift.json, `liftSlice` in src/ai/packageLift.ts): only what the coach's package wording
 * reads, so the Play page never fetches the whole report. `current` as for the report.
 */
export type LiftLoaded = { state: 'loading' } | { state: 'missing' } | { state: 'ready'; slice: LiftSlice; current: boolean };

let liftFile: Promise<LiftLoaded> | null = null;
export function loadLiftSlice(): Promise<LiftLoaded> {
  liftFile ??= fetch(`${import.meta.env.BASE_URL}data/lift.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j): LiftLoaded => {
      const slice = readLiftSlice(j);
      return slice ? { state: 'ready', slice, current: slice.catalogueVersion === CATALOGUE_VERSION } : { state: 'missing' };
    })
    .catch((): LiftLoaded => ({ state: 'missing' }));
  return liftFile;
}

/** The slice, fetched the first time `enabled` is true (the coach is on); no request before that. */
export function useLiftSlice(enabled: boolean): LiftLoaded {
  const [loaded, setLoaded] = useState<LiftLoaded>({ state: 'loading' });
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadLiftSlice().then((x) => live && setLoaded(x));
    return () => {
      live = false;
    };
  }, [enabled]);
  return loaded;
}

/** "42%", or "—" for no rate. */
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? '—' : `${Math.round(x * 100)}%`);
