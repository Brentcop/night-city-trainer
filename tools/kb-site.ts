// The site's knowledge pack (docs/RAG_PLAN.md step 3): builds the public records from the files in the repository and
// cuts them into the part files the search page fetches (src/lib/kb/site.ts: groups cut into parts, each at most
// KB_FILE_CAP_KB gzip, tools/size-budget.ts). Called by the Vite plugin in vite.config.ts at build time (the parts are
// emitted next to the other assets, named by content hash) and in the dev server (served from memory, rebuilt when an
// input file changes). Nothing is written to the repository, so a content edit can never leave a stale pack behind.
// data/raw/ is never read (rule M6): the public records are the same bytes with or without it.
//   npx tsx tools/kb-site.ts            print each part's records and raw and gzip sizes, and the first-search sum
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildFromSources, inputFiles } from '../scripts/kb-sources';
import { siteShardFiles, type SiteShardFile, type SiteSizing } from '../src/lib/kb/site';
import type { KbRecord } from '../src/lib/kb/types';
import { KB_FILE_CAP_KB, KB_FIRST_SEARCH_BUDGET_KB } from './size-budget';

export { SITE_GROUPS, shardFileName, siteManifest } from '../src/lib/kb/site';
export type { SiteManifest, SiteShardFile } from '../src/lib/kb/site';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface SitePack {
  files: SiteShardFile[];
  /** every file the build read (forward slashes, from the root): the dev server rebuilds when one changes */
  inputs: string[];
}

/** Gzip size in bytes (level 9, close to what a static host serves; the build's budget check measures the same way). */
export const gzipBytes = (s: string): number => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length;

/** How the build weighs a part file: gzip bytes, against the per-file cap. */
export const SITE_SIZING: SiteSizing = { size: gzipBytes, cap: KB_FILE_CAP_KB * 1000 };

/** The part files the site ships for built records: the build's own cut (the evaluation's site scope reads these). */
export const sitePartFiles = (records: readonly KbRecord[]): SiteShardFile[] => siteShardFiles(records, SITE_SIZING);

/** Build the site's part files from the repository at `root`, never reading data/raw. */
export async function buildSitePack(root = ROOT): Promise<SitePack> {
  const built = await buildFromSources(root, { raw: false });
  return { files: sitePartFiles(built.records), inputs: inputFiles(root, { raw: false }) };
}

async function main() {
  const t0 = performance.now();
  const pack = await buildSitePack();
  console.log(`built in ${Math.round(performance.now() - t0)} ms from ${pack.inputs.length} input files`);
  let first = 0;
  for (const f of pack.files) {
    const gz = gzipBytes(f.json);
    if (!f.late) first += gz;
    console.log(`${f.name.padEnd(11)} ${String(f.records).padStart(4)} records  ${(Buffer.byteLength(f.json) / 1000).toFixed(1).padStart(7)} kB raw  ${(gz / 1000).toFixed(1).padStart(6)} kB gzip  ${f.late ? 'late' : 'first search'}`);
  }
  console.log(`first search ${(first / 1000).toFixed(1)} kB gzip in ${pack.files.filter((f) => !f.late).length} files (budget ${KB_FIRST_SEARCH_BUDGET_KB} kB; per-file cap ${KB_FILE_CAP_KB} kB)`);
}

if (/[\\/]kb-site\.ts$/.test(process.argv[1] ?? '')) void main();
