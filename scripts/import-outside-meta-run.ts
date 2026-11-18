// The command-line step of the outside picture (scripts/import-outside-meta.ts, docs/DECK_IMPORT.md "The outside meta"):
// read the raw file tools/import_outside_meta.py wrote, check it with src/lib/outsideMeta.ts and write the tracked file.
// The file system is real; the output and the Legend cards are handed in, so the tests run it on a temporary folder.
import fs from 'node:fs';
import path from 'node:path';
import { ArgError, bool, parseArgs, str, usageOf } from './lib-node';
import { OUTSIDE_FILE, outsideChanges, readOutsideImport, type LegendCard, type OutsideMetaFile } from '../src/lib/outsideMeta';

export interface ImportOutsideIO {
  out: (line: string) => void;
  err: (line: string) => void;
  legends: () => readonly LegendCard[];
}

const FLAGS = { out: str(OUTSIDE_FILE), force: bool() };

class Refusal extends Error {}

/** The tracked file's text: JSON indented by one space, with a final newline (like the other files in src/data). */
export const outsideFileText = (f: OutsideMetaFile): string => `${JSON.stringify(f, null, 1)}\n`;

export function importOutsideCommand(argv: string[], io: ImportOutsideIO): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./import-outside-meta.ts', import.meta.url).href));
    return 0;
  }
  try {
    return run(argv, io);
  } catch (e) {
    if (e instanceof Refusal || e instanceof ArgError) {
      io.err(`error: ${e.message.replace(/\.$/, '')}.`);
      io.err('Run with --help for usage.');
      return 2;
    }
    throw e;
  }
}

function run(argv: string[], io: ImportOutsideIO): number {
  const { values: V, positionals } = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
  const input = positionals[0]!;
  let raw: string;
  try {
    raw = fs.readFileSync(input, 'utf8');
  } catch {
    throw new Refusal(`cannot read ${input}`);
  }
  const read = readOutsideImport(raw, io.legends());
  if (!read.ok) throw new Refusal(read.why);
  const file = read.file;
  io.out(`${input}: ${file.sources.length} report${file.sources.length === 1 ? '' : 's'}.`);
  for (const s of file.sources) {
    const rows = s.kind === 'season' ? `${s.tiers.length} ranked decks, ${s.matchups.length} matchup cells` : `${s.topCut.length} top-cut places`;
    io.out(`  ${s.title} (${s.link}): ${s.field.length} trios in the field (${s.field.reduce((a, r) => a + r.share, 0).toFixed(1)}% of ${s.shareOf}), ${rows}; collected ${s.collected}${s.published ? `, published ${s.published}` : ''}.`);
  }
  for (const w of read.warnings) io.out(`  ${w}`);
  let before: OutsideMetaFile | null = null;
  const exists = fs.existsSync(V.out);
  if (exists) {
    try {
      before = JSON.parse(fs.readFileSync(V.out, 'utf8')) as OutsideMetaFile;
    } catch {
      before = null;
    }
  }
  const changes = outsideChanges(before && Array.isArray(before.sources) ? before : null, file);
  io.out('');
  if (exists && before && changes.length === 0 && before.updated === file.updated) {
    io.out(`${V.out} already holds these figures; nothing to write.`);
    return 0;
  }
  io.out(changes.length ? `What changed${exists ? ` against ${V.out}` : ''}:` : 'No figure changed.');
  for (const c of changes) io.out(`  ${c}`);
  if (exists && !V.force) {
    io.out('');
    io.err(`error: ${V.out} exists already; pass --force to replace it.`);
    return 2;
  }
  fs.mkdirSync(path.dirname(path.resolve(V.out)), { recursive: true });
  fs.writeFileSync(V.out, outsideFileText(file));
  io.out('');
  io.out(`Wrote ${V.out}. Next: npm run check:data, then look at a deck page and Power ratings → The outside picture.`);
  return 0;
}
