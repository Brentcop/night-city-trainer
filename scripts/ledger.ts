// The change ledger: what it holds, and an export of it for the Deck Lab (src/lib/changeLedger.ts; docs/SYNERGIES.md "Pooling held-out games across runs").
//
//   npm run ledger -- stats [deck…] [--dir DIR] [--all-versions]
//   npm run ledger -- export [deck…] [--dir DIR] [--all-versions] --out FILE [--force]
//
// stats   one line per change the ledger holds (for the named decks, by file or name as the builders take them; else for
//         every list in the ledger): the change, the deck whose list it starts from (when the library has that list),
//         bot, simulator version, field, held-out games, the pooled gain with its always-valid interval, the verdict the
//         next run would start from under the default rule (ADOPTION_DEFAULTS, one nominee; for an undecided change,
//         roughly how many more held-out games it needs if its mean and spread stay as they are), screening games, and
//         games that came back with other scores (conflicts). Writes nothing.
// export  writes the ledger's batches (for the named decks' lists, else every list) as one export document,
//         `kind: 'nct-change-ledger'`, schema 1, to FILE: the Deck Lab's "Evidence kept in this browser" imports it, and
//         its games pool there when the simulator version, bot and field match the Lab's run. Lines that cannot be read
//         are left out and listed. Refuses to replace an existing FILE without --force; writes nothing else.
//   --dir DIR        the ledger directory (default data/ledger)
//   --all-versions   also entries recorded under other simulator versions (default: the current one only)
//   --out FILE       export: the file to write (required)
//   --force          export: replace FILE if it exists
// Exits 2 on an unknown command or flag.
import fs from 'node:fs';
import path from 'node:path';
import { listFingerprint } from '../src/engine/deck';
import { ADOPTION_DEFAULTS, formatGain } from '../src/lib/evidence';
import { fieldFingerprint, gamesToSettle, ledgerVerdict, mergeBatches, type LedgerEntry } from '../src/lib/changeLedger';
import { SIM_VERSION } from '../src/lib/tournament';
import { bool, cli, loadLibrary, resolveDeck, str } from './lib-node';
import { LEDGER_DIR } from './evidence-flags';
import { exportLedgerDir, readLedgerDir } from './ledger-store';

const { values: V, positionals } = cli(import.meta.url, { dir: str(LEDGER_DIR), 'all-versions': bool(), out: str(), force: bool() }, { minPositionals: 1, maxPositionals: Infinity });
const [command, ...decks] = positionals;
if (command !== 'stats' && command !== 'export') {
  console.error(`error: unknown command "${command}" (the commands are stats and export)\nRun with --help for usage.`);
  process.exit(2);
}
if (command === 'stats' && (V.out !== undefined || V.force)) {
  console.error('error: --out and --force are for export only\nRun with --help for usage.');
  process.exit(2);
}
if (command === 'export' && !V.out) {
  console.error('error: export needs --out FILE\nRun with --help for usage.');
  process.exit(2);
}

const lib = loadLibrary();
const byList = new Map<string, string>();
for (const d of lib) if (!byList.has(listFingerprint(d.deck))) byList.set(listFingerprint(d.deck), d.deck.name);
const fields = new Map<string, string>([
  [fieldFingerprint(lib.filter((d) => d.kind === 'meta').map((d) => listFingerprint(d.deck))), 'meta'],
  [fieldFingerprint(lib.filter((d) => d.kind !== 'custom').map((d) => listFingerprint(d.deck))), 'all'],
]);
/** the optimizer's field leaves the deck itself out of the meta decks */
const fieldName = (field: string, base: string) =>
  fields.get(field) ?? (fieldFingerprint(lib.filter((d) => d.kind === 'meta' && listFingerprint(d.deck) !== base).map((d) => listFingerprint(d.deck))) === field ? 'meta without the deck' : field);

const wanted = decks.length ? new Set(decks.map((q) => listFingerprint(resolveDeck(q, lib).deck))) : null;
const k = (x: number) => x.toLocaleString('en-US');
if (command === 'export') exportTo(V.out!);
const { files } = readLedgerDir(V.dir);
if (!files.length) {
  console.log(`The change ledger at ${V.dir} is empty (no .jsonl files).`);
  process.exit(0);
}
let shown = 0;
let otherVersions = 0;
for (const f of files) {
  const base = f.file.slice(0, 16);
  if (wanted && !wanted.has(base)) continue;
  const entries = [...mergeBatches(f.batches.map((b) => b.batch)).values()];
  const here = entries.filter((e) => V['all-versions'] || e.id.simVersion === SIM_VERSION);
  otherVersions += entries.length - here.length;
  if (!here.length && !f.problems.length) continue;
  console.log(`\n${byList.get(base) ?? 'a list not in the library'} (${base}): ${here.length} change${here.length === 1 ? '' : 's'}`);
  for (const p of f.problems) console.log(`  unreadable: ${p}`);
  for (const e of here.sort((a, b) => b.heldout.length - a.heldout.length || (a.label < b.label ? -1 : 1))) {
    shown++;
    console.log(`  ${e.label}`);
    console.log(`    bot ${e.id.bot}, simulator v${e.id.simVersion}, field ${fieldName(e.id.field, base)}; ${k(e.runs.length)} run${e.runs.length === 1 ? '' : 's'}, ${e.firstDate}${e.lastDate !== e.firstDate ? ` to ${e.lastDate}` : ''}`);
    console.log(`    ${heldOutLine(e)}`);
    const conflicts = e.conflicts.heldout + e.conflicts.screen;
    console.log(`    screening: ${k(e.screen.length)} games (never pooled)${conflicts ? `; ${k(conflicts)} game${conflicts === 1 ? '' : 's'} came back with other scores (the earlier kept)` : ''}`);
  }
}
if (wanted && !shown) console.log(`\nNo change in the ledger starts from ${decks.join(', ')}${V['all-versions'] ? '' : ` under simulator version ${SIM_VERSION}`}.`);
if (otherVersions) console.log(`\n${k(otherVersions)} entr${otherVersions === 1 ? 'y' : 'ies'} under other simulator versions not shown (--all-versions shows them).`);

function heldOutLine(e: LedgerEntry): string {
  const n = e.heldout.length;
  if (!n) return 'held-out: none yet';
  const { iv, verdict } = ledgerVerdict(e.heldout, ADOPTION_DEFAULTS);
  const at = `held-out: ${formatGain(iv).replace(/, (\d+) games$/, (_m, g: string) => `, ${k(+g)} games`)} (always-valid z ${iv.z.toFixed(2)})`;
  if (verdict === 'adopt') return `${at}: adopted by the pooled games`;
  if (verdict === 'reject') return `${at}: rejected by the pooled games`;
  const settle = gamesToSettle(e.heldout, ADOPTION_DEFAULTS);
  return `${at}: undecided; ${Number.isFinite(settle) ? `about ${k(Math.max(0, settle - n))} more held-out games at this rate` : 'the mean is not above the bar, so more games at this rate would not adopt it'}`;
}

/** export: the document for the wanted lists to `file`, never over an existing file without --force. */
function exportTo(file: string): never {
  if (fs.existsSync(file) && !V.force) {
    console.error(`error: ${file} already exists. Pass --force to replace it.`);
    process.exit(1);
  }
  const { doc, games, otherVersions, problems } = exportLedgerDir(V.dir, { ...(wanted ? { bases: wanted } : {}), ...(V['all-versions'] ? {} : { simVersion: SIM_VERSION }) });
  for (const p of problems) console.log(`  unreadable, left out: ${p}`);
  if (!doc.batches.length) {
    console.log(`Nothing to export: the change ledger at ${V.dir} holds no batch${wanted ? ` for ${decks.join(', ')}` : ''}${V['all-versions'] ? '' : ` under simulator version ${SIM_VERSION}`}. No file written.`);
    process.exit(0);
  }
  if (path.dirname(file)) fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(doc));
  console.log(`Wrote ${file}: ${k(games)} games in ${k(doc.batches.length)} batch${doc.batches.length === 1 ? '' : 'es'}${otherVersions ? ` (${k(otherVersions)} batch${otherVersions === 1 ? '' : 'es'} under other simulator versions left out; --all-versions includes them)` : ''}.`);
  process.exit(0);
}
