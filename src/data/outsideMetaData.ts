// The outside picture's data (src/data/outsideMeta.json, written by scripts/import-outside-meta.ts; types and rules in
// src/lib/outsideMeta.ts). Its own module, like the other large views, so that nothing in the entry chunk carries it:
// the deck profile, Power ratings and Credits pages (all lazy) import it, the Home page never does
// (tests/home-data.test.tsx).
//
// The file is optional: it is written only when the owner collects the two sites' reports, so a checkout without it
// builds and shows no outside rows (import.meta.glob finds nothing). The figures are another site's; nothing that
// computes our own numbers reads this module.
import type { OutsideMetaFile } from '../lib/outsideMeta';

const found = import.meta.glob('./outsideMeta.json', { eager: true, import: 'default' }) as Record<string, OutsideMetaFile>;

/** The collected outside meta, or null when the file is not in this build. */
export const OUTSIDE_META: OutsideMetaFile | null = found['./outsideMeta.json'] ?? null;
