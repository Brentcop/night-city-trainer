// The site's knowledge pack (docs/RAG_PLAN.md step 3): builds the public records from the files in the repository and
// cuts them into the shard files the search page fetches (src/lib/kb/site.ts). Called by the Vite plugin in
// vite.config.ts at build time (the shards are emitted next to the other assets, named by content hash) and in the dev
// server (served from memory, rebuilt when an input file changes). Nothing is written to the repository, so a content
// edit can never leave a stale pack behind. data/raw/ is never read (rule M6): the public records are the same bytes
// with or without it.
//   npx tsx tools/kb-site.ts            print each shard's records and raw and gzip sizes
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { buildFromSources, inputFiles } from '../scripts/kb-sources';
import { siteShardFiles, type SiteShardFile } from '../src/lib/kb/site';

export { shardFileName, siteManifest } from '../src/lib/kb/site';
export type { SiteManifest, SiteShardFile } from '../src/lib/kb/site';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export interface SitePack {
  files: SiteShardFile[];
  /** every file the build read (forward slashes, from the root): the dev server rebuilds when one changes */
  inputs: string[];
}

/** Build the site's shard files from the repository at `root`, never reading data/raw. */
export async function buildSitePack(root = ROOT): Promise<SitePack> {
  const built = await buildFromSources(root, { raw: false });
  return { files: siteShardFiles(built.records), inputs: inputFiles(root, { raw: false }) };
}

/** Gzip size in bytes (level 9, close to what a static host serves). */
export const gzipBytes = (s: string): number => gzipSync(Buffer.from(s, 'utf8'), { level: 9 }).length;

async function main() {
  const t0 = performance.now();
  const pack = await buildSitePack();
  console.log(`built in ${Math.round(performance.now() - t0)} ms from ${pack.inputs.length} input files`);
  for (const f of pack.files) console.log(`${f.name.padEnd(9)} ${String(f.records).padStart(4)} records  ${(Buffer.byteLength(f.json) / 1000).toFixed(1).padStart(7)} kB raw  ${(gzipBytes(f.json) / 1000).toFixed(1).padStart(6)} kB gzip  ${f.late ? 'late' : 'first search'}`);
}

if (/[\\/]kb-site\.ts$/.test(process.argv[1] ?? '')) void main();
