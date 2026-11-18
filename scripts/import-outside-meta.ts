// Write the outside picture's tracked file (src/data/outsideMeta.json) from the raw file of
// tools/import_outside_meta.py (docs/DECK_IMPORT.md "The outside meta"; ROADMAP2 §13 goal 4).
//
//   npx tsx scripts/import-outside-meta.ts FILE [--out FILE] [--previous FILE] [--merge | --fresh] [--force] [--summary FILE]
//
// It reads the raw file as untrusted input (src/lib/outsideMeta.ts): every string cleaned and capped, every number
// checked, every link kept only on the two sites, every Legend name matched to this trainer's Legend cards or kept as
// text and reported. Then it carries the previous tracked file forward (mergeOutside): a report not read this run, or
// read with under half its previous rows (a layout change), or read older than the file's entry, keeps its previous
// entry, older day and all; a report whose figures did not change keeps its entry as it was, so a run that finds nothing
// new writes nothing; at most 8 reports are kept, the newest by published day. It prints each report it read, what it
// carried forward or dropped, and what changed against the file on disk, and never writes a file check:data would
// refuse.
//
//   --out FILE       where to write (default src/data/outsideMeta.json)
//   --previous FILE  the file to carry forward (default: the --out file, when it exists)
//   --merge          replace the --out file when it is the file carried forward (the scheduled workflow's way: the
//                    result only ever takes newer readings, so a stale raw file cannot undo newer figures)
//   --fresh          do not carry anything forward (with --force, also replaces a previous file that is not sound)
//   --force          replace the --out file whatever it holds
//   --summary FILE   append what changed, as Markdown, to FILE (the workflow's job summary)
//
// Exits 2 on an unknown flag, a bad value, a file that is not a raw outside-meta file, a previous file that is not
// sound, a result that would not pass check:data, or an existing file without --merge or --force; 0 otherwise
// (written, or nothing to write).
import { CARDS } from '../src/engine/cards';
import { importOutsideCommand } from './import-outside-meta-run';

process.exit(
  importOutsideCommand(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    legends: () => CARDS.filter((c) => c.type === 'Legend'),
  }),
);
