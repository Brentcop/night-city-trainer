// Write the slices of the telemetry reports the site loads (src/lib/telemetrySlices.ts): the decision report's index,
// its per-deck parts and the sells slice (public/data/), and the analysis summary and per-deck parts (src/data/analysis/),
// cut from reports/decisions-latest.json and src/data/analysis.json. `sim analyze` writes them after a whole-field run;
// this rebuilds them, and runs in `npm run refresh`. Deterministic: an unchanged file is not rewritten, and a part
// file whose deck is no longer in its report is removed. `npm run check:data` fails when the stored slices are not
// this rebuild.
//   npx tsx scripts/build-telemetry-slices.ts
// Exits 2 on a bad flag.
import fs from 'node:fs';
import path from 'node:path';
import { cli, runMain, writeIfChanged } from './lib-node';
import type { DecisionReport } from '../src/analysis/decisions';
import { ANALYSIS_PARTS_DIR, ANALYSIS_SITE_FILE, DECISION_PARTS_DIR, DECISIONS_FULL_FILE, telemetrySliceFiles, type AnalysisSite } from '../src/lib/telemetrySlices';

const readJson = <T>(f: string): T | null => (fs.existsSync(f) ? (JSON.parse(fs.readFileSync(f, 'utf8')) as T) : null);

/** The slices as they should be in a checkout, and the part files there that no report deck asks for. */
export function expectedSlices(root = '.'): { files: Map<string, string>; stale: string[] } {
  const decisions = readJson<DecisionReport>(path.join(root, DECISIONS_FULL_FILE));
  const analysis = readJson<AnalysisSite>(path.join(root, ANALYSIS_SITE_FILE));
  const files = telemetrySliceFiles({ decisions, analysis });
  const stale: string[] = [];
  for (const dir of [DECISION_PARTS_DIR, ANALYSIS_PARTS_DIR]) {
    const at = path.join(root, dir);
    if (!fs.existsSync(at)) continue;
    for (const f of fs.readdirSync(at)) if (f.endsWith('.json') && !files.has(`${dir}/${f}`)) stale.push(`${dir}/${f}`);
  }
  return { files, stale };
}

/** Problems with the stored slices (check:data): missing, different from the rebuild, or left over. */
export function sliceProblems(root = '.'): { failures: string[]; passed: string[] } {
  const { files, stale } = expectedSlices(root);
  const bad: string[] = [];
  for (const [f, text] of files) {
    const p = path.join(root, f);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8').trimEnd() !== text) bad.push(f);
  }
  const failures: string[] = [];
  const fix = 'rebuild them with npx tsx scripts/build-telemetry-slices.ts';
  if (bad.length) failures.push(`${bad.length} telemetry slice file(s) are missing or not cut from ${DECISIONS_FULL_FILE} and ${ANALYSIS_SITE_FILE} (${bad.slice(0, 3).join(', ')}${bad.length > 3 ? ', …' : ''}); ${fix}`);
  if (stale.length) failures.push(`${stale.length} telemetry part file(s) belong to no deck of their report (${stale.slice(0, 3).join(', ')}${stale.length > 3 ? ', …' : ''}); ${fix}`);
  return { failures, passed: failures.length ? [] : [`the telemetry slices are cut from ${DECISIONS_FULL_FILE} and ${ANALYSIS_SITE_FILE} (${files.size} files)`] };
}

/** Write the slices into a checkout; returns how many files changed and were removed. */
export function writeTelemetrySlices(root = '.'): { written: number; removed: number; files: number } {
  const { files, stale } = expectedSlices(root);
  let written = 0;
  for (const [f, text] of files) {
    fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true });
    if (writeIfChanged(path.join(root, f), text)) written++;
  }
  for (const f of stale) fs.rmSync(path.join(root, f));
  return { written, removed: stale.length, files: files.size };
}

if (process.argv[1]?.endsWith('build-telemetry-slices.ts')) {
  cli(import.meta.url, {});
  runMain(async () => {
    const r = writeTelemetrySlices();
    console.log(`Telemetry slices: ${r.files} files (${r.written} written, ${r.removed} removed)`);
  });
}
