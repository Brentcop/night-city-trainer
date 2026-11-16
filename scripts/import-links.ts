// Write library deck files from a deck-import file (docs/DECK_IMPORT.md): the output of tools/import_decks.py, or the
// file the admin page's "Download for the library" saves (#/admin, Import decks).
//
//   npx tsx scripts/import-links.ts FILE [--dir DIR] [--prefix TEXT] [--notes FILE] [--date YYYY-MM-DD] [--write] [--force]
//
// Without --write it only prints what it would do: each deck, its checks (every card matched, the list legal, whether
// the library already has the list) and the file it would write. With --write it writes each deck that passes as
// <dir>/<prefix><deck name>.txt with a provenance header (Origin "Imported from <site>", the author, the source link, the
// page it was found on), and adds a `needs-owner` placeholder note for it to src/content/deckObjectives/imported.ts
// (the deck-objectives test needs one for every library deck). It never writes a deck with an unmatched card or an
// illegal list, never one whose list the library already has, and never over an existing file without --force. Cards
// are matched by the same code as the admin page (src/lib/deckImport.ts).
//
//   --dir DIR        where deck files go (default data/decks)
//   --prefix TEXT    the start of each file name (default import-)
//   --notes FILE     the deck-note table to add placeholders to (default src/content/deckObjectives/imported.ts)
//   --date DATE      the collection date written in the header (default today)
//   --write          write the files (default: only print)
//   --force          replace a deck file that exists already
//
// It ends with what is left to do before the new decks are library decks. Exits 2 on an unknown flag, a bad value, or a
// file that is not a deck-import file; 1 when no deck could be written.
import { importLinksCommand } from './import-links-run';
import { loadLibrary } from './lib-node';

process.exit(
  importLinksCommand(process.argv.slice(2), {
    out: (l) => console.log(l),
    err: (l) => console.error(l),
    library: () => loadLibrary(),
  }),
);
