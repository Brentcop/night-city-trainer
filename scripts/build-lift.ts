// Build the lift slice the Play page's coach reads (public/data/lift.json) from the synergy report
// (public/data/synergies.json): the pooled table and each list's own measured rows, exactly what `seatLift` reads
// (`liftSlice` in src/ai/packageLift.ts). `sim analyze --synergies` writes it beside the report; this rebuilds it, and
// runs last in `npm run refresh`. Deterministic: the same report gives the same bytes, and an unchanged file is not
// rewritten. `npm run check:data` fails when the two disagree.
//   npx tsx scripts/build-lift.ts
// Exits 1 when the report is missing or unreadable, 2 on a bad flag.
import fs from 'node:fs';
import { cli, writeIfChanged } from './lib-node';
import { liftSlice, liftSliceText } from '../src/ai/packageLift';
import type { SynergyReport } from '../src/analysis/synergies';

cli(import.meta.url, {});

const REPORT = 'public/data/synergies.json';
const OUT = 'public/data/lift.json';

if (!fs.existsSync(REPORT)) {
  console.error(`error: ${REPORT} is missing (make it with npm run sim -- analyze --synergies)`);
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(REPORT, 'utf8')) as SynergyReport;
if (report?.kind !== 'synergy-report' || !Array.isArray(report.decks) || !Array.isArray(report.pooled)) {
  console.error(`error: ${REPORT} is not a synergy report`);
  process.exit(1);
}
const slice = liftSlice(report);
const changed = writeIfChanged(OUT, liftSliceText(report));
console.log(`${changed ? 'Wrote' : 'Unchanged:'} ${OUT} (${Object.keys(slice.pooled).length} pooled rows, ${Object.keys(slice.lists).length} lists)`);
