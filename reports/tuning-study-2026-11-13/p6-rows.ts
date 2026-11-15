// P6: the stages of p6-hard.ts as re-measurement rows for the evidence builder (docs/EVIDENCE.md "Re-measurements").
// Stage a's Hard figures (560 paired games), except the two changes stage b measured on 2,800 (stage a's games are the
// first 560 of those, so only the larger measurement is kept), and stage c's Medium figures under SIM_VERSION 9.
//
//   npx tsx reports/tuning-study-2026-11-13/p6-rows.ts OUT data/evidence/remeasure-2026-11-15-p6.json
import fs from 'node:fs';
import path from 'node:path';
import { parseRemeasureFile, REMEASURE_KIND, REMEASURE_SCHEMA } from '../../src/lib/remeasure';

const [OUT, FILE] = process.argv.slice(2);
if (!OUT || !FILE) {
  console.error('usage: npx tsx reports/tuning-study-2026-11-13/p6-rows.ts OUT FILE');
  process.exit(2);
}
if (fs.existsSync(FILE)) {
  console.error(`${FILE} exists already: rows are never rewritten. Move it away first, or name another file.`);
  process.exit(1);
}
interface Stage {
  id: string;
  deck: string;
  label: string;
  baseListId: string;
  candListId: string;
  cuts: string[];
  adds: string[];
  legendCuts: string[];
  legendAdds: string[];
  bot: string;
  simVersion: number;
  games: number;
  mean: number;
  se: number;
  sd: number;
  byOpp: { opp: string; oppListId: string; games: number; mean: number; se: number }[];
  bySeat: { first: 0 | 1; games: number; mean: number; se: number }[];
  opponents: string[];
  seed: number;
}
const read = (s: string): Stage[] => JSON.parse(fs.readFileSync(path.join(OUT, `p6-${s}.json`), 'utf8'));
const a = read('a');
const b = read('b');
const c = read('c');
const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const deep = new Set(b.map((r) => r.id));
const row = (r: Stage, record: string) => ({
  id: `p6-${r.bot}-${r.id}`,
  deck: r.deck,
  label: r.label,
  baseListId: r.baseListId,
  candListId: r.candListId,
  cuts: r.cuts,
  adds: r.adds,
  ...(r.legendCuts.length ? { legendCuts: r.legendCuts } : {}),
  ...(r.legendAdds.length ? { legendAdds: r.legendAdds } : {}),
  bot: r.bot,
  simVersion: r.simVersion,
  games: r.games,
  mean: r6(r.mean),
  se: r6(r.se),
  sd: r6(r.sd),
  byOpp: r.byOpp.map((o) => ({ opp: o.opp, oppListId: o.oppListId, games: o.games, mean: r6(o.mean), se: r6(o.se) })),
  bySeat: r.bySeat.map((s) => ({ first: s.first, games: s.games, mean: r6(s.mean), se: r6(s.se) })),
  opponents: r.opponents,
  seed: r.seed,
  date: '2026-11-15',
  script: 'reports/tuning-study-2026-11-13/p6-hard.ts',
  record,
});
const measurements = [
  ...a.filter((r) => !deep.has(r.id)).map((r) => row(r, 'A change measured with the Medium bot, measured again with the Hard bot (560 paired games)')),
  ...b.map((r) => row(r, 'The change that read highest with the Medium bot on this list, measured with the Hard bot (2,800 paired games)')),
  ...c.map((r) => row(r, 'A recorded change measured again with the Medium bot under SIM_VERSION 9, to compare with its Hard figure')),
];
const file = {
  kind: REMEASURE_KIND,
  schema: REMEASURE_SCHEMA,
  note: 'Plan P6 of the tuning study (docs/TUNING_STUDY_2026-11-13.md; reports/tuning-study-2026-11-13/p6-hard.ts and p6-transfer.txt): do changes measured with the Medium bot hold with the Hard bot? Paired games on the forge layout, seeds from 5,000,000, the 7 meta decks, SIM_VERSION 9: thirteen changes with Hard (560 paired games each; the two that read highest with Medium on 2,800), and the seven recorded changes of experiment E2 again with Medium (2,800 each). mean is after minus before.',
  measurements,
};
const parsed = parseRemeasureFile(JSON.parse(JSON.stringify(file)), path.basename(FILE));
if (parsed.problems.length) {
  console.error(parsed.problems.join('\n'));
  process.exit(1);
}
fs.writeFileSync(FILE, JSON.stringify(file, null, 1) + '\n');
console.log(`${FILE}: ${measurements.length} rows (${measurements.filter((m) => m.bot === 'hard').length} Hard, ${measurements.filter((m) => m.bot === 'medium').length} Medium)`);
