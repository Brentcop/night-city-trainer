// Write the outside picture's tracked file (src/data/outsideMeta.json) from the raw file of
// tools/import_outside_meta.py (docs/DECK_IMPORT.md "The outside meta"; ROADMAP2 §13 goal 4).
//
//   npx tsx scripts/import-outside-meta.ts FILE [--out FILE] [--force]
//
// It reads the raw file as untrusted input (src/lib/outsideMeta.ts): every string cleaned and capped, every number
// checked, every link kept only on the two sites, every Legend name matched to this trainer's Legend cards or kept as
// text and reported. It prints each report it read and what changed against the file on disk, and never replaces that
// file without --force.
//
//   --out FILE   where to write (default src/data/outsideMeta.json)
//   --force      replace the file if it exists
//
// Exits 2 on an unknown flag, a bad value, a file that is not a raw outside-meta file, or an existing file without
// --force.
import { CARDS } from '../src/engine/cards';
import { importOutsideCommand } from './import-outside-meta-run';

process.exit(
  importOutsideCommand(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    legends: () => CARDS.filter((c) => c.type === 'Legend'),
  }),
);
