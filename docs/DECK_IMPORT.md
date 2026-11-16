# Importing decks from shared links

A way to bring decks other players shared on **choom.gg** and **cyberpunk-tcg-sim.online** into the trainer, so the
library and the tournaments come closer to the real field. The site has no server, so the work is split: a small Python
script on your own machine reads the pages, and the admin page (`#/admin`, section **Import decks**) reads the script's
output, checks every deck and adds the ones you choose.

## The three steps

1. **Paste.** Open `#/admin` and paste one or more links (one per line) into **Import decks**. Each link is sorted at
   once, with its reason:
   - **Read here**: a cyberpunk-tcg-sim.online deck-builder link carries its whole list in the address, so the page reads
     it on the spot and nothing is fetched. The deck appears in the preview below.
   - **Needs the script**: any other page on the two sites (a choom.gg deck page, the choom.gg deck list, a tournament or
     season report). The page shows the exact command, with a Copy button.
   - **Refused**: another site, a path choom.gg asks automated readers to keep out of (`/api/`, `/admin`), or a
     deck-builder link that only names a deck saved in someone's browser.
2. **Run.** In a terminal in the repository folder (Python 3.9 or later; nothing to install; on Windows `py` works in
   place of `python`):

   ```
   python tools/import_decks.py "https://choom.gg/decks" "https://cyberpunk-tcg-sim.online/meta/season-1"
   ```

   It writes `deck-import.json` there (ignored by git) and prints a short summary. `--out FILE` writes elsewhere,
   `--force` replaces an existing file, `--from-file links.txt` reads one link per line, `--limit N` (default 20, at most
   60) caps the decks read from one page, `--delay S` (default 2, at least 1) sets the pause between requests, and
   `--help` prints all of it.
3. **Load.** Back on `#/admin`, **Load the script's output** and pick the file. Every deck is previewed: its name
   (editable), author and source, the three Legends, the card counts, whether the list is legal (with the reasons when it
   is not), any card that could not be matched, and whether the library or My decks already hold the list (and under
   which name). Choose decks, then:
   - **Add to My decks** saves them in this browser, like a deck imported in the deck editor (`origin: 'imported'`, the
     date it was added, the source link in `source` and a credit line in `notes`). A list the library or My decks
     already has is not added again.
   - **Download deck files** saves each chosen deck as a `.txt` in the library's format, with its provenance header; or
     **Download for the command line** saves `deck-import-chosen.json` (the chosen decks, under the names you gave them)
     for the step below, which also adds the deck notes.

A deck with an unmatched card or an illegal list can be neither added nor downloaded; the preview says why.

## What each page gives

| Link | Read how | Gives |
| --- | --- | --- |
| `cyberpunk-tcg-sim.online/deck-builder/?deck=cb-…:n,…&sideboard=…&name=…` | from the address | The first three entries are the Legends, the rest the main deck, then the sideboard. The name; for a tournament list "PLAYER - EVENT (1st)", so the author and the placement. |
| `cyberpunk-tcg-sim.online/deck-builder/?deck=saved-…&d=l.….d.….s.…` | from the address | Legends (`l.`), main deck (`d.`) and sideboard (`s.`) as short codes: the set's first letter and the print number in base 36, with the number's letter after a dash (`w5-a` is card 005a, V: Streetkid). No name, so the deck is named after its Legends. Parts not understood are kept as notes. |
| a cyberpunk-tcg-sim.online page with decks (a tournament or season report) | fetched once | Every "Open in deck builder" link on it, read from its address, with the page's title and date. |
| `choom.gg/decks/<id>` | fetched | The deck record in the page's data: name, Legends, main deck and sideboard by card id, with the card names beside them; the author from the page's description. Without that record, the list the page shows (no sideboard). |
| `choom.gg/decks` or another choom.gg page | fetched, then each deck page | The `/decks/<id>` links on it, in page order, then each deck as above. |

Not confirmed: how a choom.gg deck with a sideboard looks (the examples had none; the script reads a `sideboard` list
shaped like the main deck's), and the sim's codes for cards whose print number carries a letter other than V's `005a`.

## The rules the script keeps

- Only `choom.gg` and `cyberpunk-tcg-sim.online` (and their `www.` forms); any other link is refused, and a redirect off
  the two sites is not followed.
- Never `/api/` or `/admin` on choom.gg (its robots rules), however the path is written (percent-escapes, doubled
  slashes, `..` steps and letter case are undone before the comparison). These are the two sites' robots rules as they
  stood on 2026-11-16: the script does not re-read them, so if a site changes its rules, change `site_of` in the script
  (and `keptOut` in `src/lib/deckImport.ts`, which sorts the pasted links the same way).
- Both sites' robots rules also keep the bulk AI-training crawlers out by name. This script is not one: it reads the few
  pages you point it at, to get decks to play against. Keep it that small: do not raise the limits to sweep a site, and
  if either site asks you to stop, stop. Neither site's terms of use were read beyond its robots rules.
- One request at a time, at least `--delay` seconds apart (2 by default, never under 1), a 30-second timeout, one retry,
  at most 60 pages in one run, at most `--limit` decks from one page. A 403 or 429 stops the run at once.
- A plain User-Agent (`deck-import-script/1.0`) that says nothing about you or your machine.
- It writes nothing but its output file, runs nothing it downloads, and knows nothing about the trainer's cards: it
  writes each card as the site wrote it, and the trainer matches it.

Tests: `python -m unittest discover -s tools -p "test_*.py"` (made-up pages, no network); the `check` job of
`.github/workflows/pages.yml` runs them on every push.

## Matching cards

`src/lib/deckImport.ts` matches every reference, for the admin page and the command-line step alike. An id `cb-…` is
this project's card id with dashes (tried first), else the card database's id (`eid`, an older spelling for six cards
with accents). A code is matched by set letter and print number. A name is matched exactly, whatever the accents, the
case, straight or curly apostrophes, and the "—", "–", ":" or " - " between name and subname; a name without its
subname only when one card has that name. A reference the site also names must agree with that name. Anything else is
reported, never guessed.

## From an import to a library deck

```
npx tsx scripts/import-links.ts deck-import.json              # prints each deck, its checks and the file it would write
npx tsx scripts/import-links.ts deck-import.json --write      # writes them
```

With `--write` it writes `data/decks/import-<name>.txt` (`--dir`, `--prefix`) with the header the other decks carry
(`Origin: Imported from <site>`, `Author`, `Source` (the deck's link), `Via` (the page it was found on), `Added`), and
adds a `needs-owner` placeholder note for each to `src/content/deckObjectives/imported.ts`. It never writes over a file
without `--force`, never a list the library already has, never a deck with an unmatched card or an illegal list. Then:

1. Write each deck's note in `src/content/deckObjectives/imported.ts` and set `status: 'owner'` (the placeholder is
   enough for the tests).
2. `npm run evidence` (every library deck has an evidence file), then `npm run check:data`.
3. `npm run typecheck`, `npx vitest run tests/deck-objectives.test.ts`, then the whole suite before committing.
4. A deck with fewer than 13 Units (the step names it) fails `tests/breeder-units.test.ts`: that test holds the bred
   decks' floor (`MIN_BRED_UNITS` in `src/ai/breeder.ts`) at the fewest Units of any hand-built library list. Lowering
   the floor changes what the breeder makes, so it is your call (two of the Discord 5k top-8 lists have 10 Units, and
   the Season-1 #2 list has 12).
5. The deck has no rating until an event that includes it is recorded.

Checked on 2026-11-16 by writing six of the example decks into a scratch copy of the library: with the placeholder notes
and `npm run evidence`, `check:data` passed and the whole suite failed only on the Units floor above.

In the gallery an imported deck at the top of `data/decks/` is grouped with the choom.gg guides (the library's kind for a
file that is not `meta-`, `ladder-` or a Trainer original), and its badge reads "Other".
