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
- **The robots file, read at the start of every run.** Before its first request to a host in a run, the script reads
  that host's `/robots.txt` (`tools/robots.py`, RFC 9309: groups by user-agent, same-agent groups merged, a blank line
  or a comment never ends a group, `*` and `$` patterns, the longest match wins and a tie goes to Allow) and never asks
  for an address the rules keep `deck-import-script` out of. It waits at least the file's `Crawl-delay` between
  requests and stops when that is over 60 seconds. It fails closed: a robots file that answers 403, 429 or 5xx (after
  one retry), times out, redirects to another host, is over 500 KiB or is a web page rather than a robots file stops the
  run before any page is read there (exit code 3); a 404, 410 or other 4xx means the host sets no rules. Python's own
  `urllib.robotparser` is not used for any decision (several "`User-agent: *`" groups and blank lines inside a group
  have been read differently from one Python release to the next).
- **cyberpunk-tcg-sim.online's content signals, checked every run.** Its robots file (Cloudflare-managed) states
  content signals as a condition of reading the site. The values a person read and accepted are written in
  `tools/robots.py` (`ACCEPTED`), with the day: `search=yes, ai-train=no, use=reference`, accepted by the owner on
  2026-11-18 (the job collects plain figures to show with attribution; it is not an AI system and trains nothing). When
  the "`User-agent: *`" group's signals are anything else (a changed or removed signal, a new key; order, spaces and
  capitals do not matter), when a group names `deck-import-script`, when the rules disallow `/meta` or `/meta/`, or when
  the file is missing or cannot be read, the run stops before reading any page and exits 3 with one sentence saying
  why (its output file records what it saw, and no page). The accepted values change only when a person edits that
  file (see "Running by itself"). The check applies to the deck import too.
- What the run saw of each robots file (status, the group that applies, its rules, the content signals, a SHA-256 of the
  text, the day) goes into the output file (`robots`) and, for the outside meta, the job summary.
- A second belt, kept: never `/api/` or `/admin` on choom.gg, and never `/api/`, `/dashboard` or `/metrics` on
  cyberpunk-tcg-sim.online (their robots rules for every reader as read on 2026-11-18), however the path is written
  (percent-escapes, doubled slashes, `..` steps and letter case are undone before the comparison): `site_of` in the
  script, and `keptOut` / `simKeptOut` in `src/lib/deckImport.ts`, which sort the pasted links the same way. If a site
  adds a path to its rules, the robots gate keeps to it at once; add it here too.
- Both sites' robots rules also keep the bulk AI-training crawlers out by name. This script is not one: it reads the few
  pages you point it at, to get decks to play against. Keep it that small: do not raise the limits to sweep a site, and
  if either site asks you to stop, stop.
- What else the sites say (read 2026-11-18). cyberpunk-tcg-sim.online's robots file also keeps out, by name, the
  fetchers AI assistants use on a person's behalf (`Claude-User`, `ChatGPT-User`, `Perplexity-User` and others); it
  links no terms-of-use page. So the scripts are run by a person, or by the scheduled workflow (see "Running by
  itself"), never by an AI assistant: an AI agent working in this repository does not run them against that site, nor
  fetch its pages (or its robots file) any other way, not even to test; its tests use invented pages. choom.gg allows
  those assistant fetchers; its terms (updated 2026-11-11) forbid scraping "abusively" and set no rule on reusing its
  ratings or statistics.
- One request at a time, at least `--delay` seconds apart (2 by default, never under 1, never under the site's
  Crawl-delay), a 30-second timeout, one retry, at most 60 pages in one run (12 for the outside meta; the robots file is
  not counted), at most `--limit` decks from one page. A 403, a 429 or a bot check (a Cloudflare interstitial) stops the
  run at once; a challenge is never answered, worked around or retried.
- A plain User-Agent (`deck-import-script/1.0`) that says nothing about you or your machine.
- It writes nothing but its output file, runs nothing it downloads, and knows nothing about the trainer's cards: it
  writes each card as the site wrote it, and the trainer matches it.

Exit codes of both scripts: 0 read, 1 stopped by a 403, 429 or bot check (or nothing read), 2 a bad command line or an
existing output file, 3 stopped by a site's robots rules.

Tests: `python -m unittest discover -s tools -p "test_*.py"` (made-up pages and made-up robots files with the two sites'
shapes, no network; `tools/test_robots.py` for the parser and the tripwire); the `check` job of
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
(`Origin: Imported from <site>`, `Author`, `Source` (the deck's link), `Via` (the page it was found on, with the page's
own date when it gave one: "(published 2026-11-15, collected 2026-11-16)"), `Added` (the day it was collected, `--date`:
the day the deck joins the library, which the gallery's "newest" sorts by)), and adds a `needs-owner` placeholder note
for each to `src/content/deckObjectives/imported.ts`: one line, `'<file>': importedPlaceholder('<listId>', [<the three
Legends>]),`, just above the marker line. The placeholder's words are written once, in `importedPlaceholder` in that
file, so a placeholder costs one line, not a whole note. It never writes
over a file without `--force`, never a list the library already has, never a deck with an unmatched card or an illegal
list, and never adds a second note for a file that has one (a full note or a placeholder line). Then:

1. Write each deck's note: in `src/content/deckObjectives/imported.ts`, replace its `importedPlaceholder(...)` call with
   a full note object (the fields in `vocabulary.ts`, as in the other note tables) and set `status: 'owner'` (the
   placeholder is enough for the tests). The first 18 imported decks have agent-written drafts instead (`status:
   'draft'`, `source: 'list'`, 2026-11-16): read off each list and the cards' texts, not checked by the owner. If the
   note names `synergies`, run `npx tsx scripts/note-synergies.ts` and commit the regenerated table.
2. `npm run evidence` (every library deck has an evidence file), then `npm run check:data`.
3. `npm run typecheck`, `npx vitest run tests/deck-objectives.test.ts`, then the whole suite before committing.
4. The deck has no rating until an event that includes it is recorded.

For a list with fewer Units than the bred decks' floor the step prints a note ("10 Units; the bred decks' floor is 13"),
for information only. `tests/breeder-units.test.ts` holds that floor (`MIN_BRED_UNITS` in `src/ai/breeder.ts`) against
the trainer's own sources (meta, guides, sim ladder, Trainer originals) and does not count lists imported from players,
which go down to 10 Units in real tournament top cuts. The floor was kept at 13 on 2026-11-16; lowering it changes what
the breeder makes, so it is the owner's call.

## In the library

A file at the top of `data/decks/` whose Origin starts "Imported from" is a library deck of its own kind, `shared`
(`src/lib/library.ts`; decided by the Origin, so `--prefix` does not change it; a file in `data/decks/custom/` stays a
custom deck). The gallery shows these as "Player lists" (a source of their own for the filter and "Group by source"),
each with the badge "Player list" and the credit "site · author" (the site alone when the page named no author); the
deck editor's list has a "Player lists" section, the tournament runner a quick set "All player lists" (and the setup
link `f=shared`), and `npm run tournament -- --field shared` enters them all. They are never grouped with the choom.gg
guides, and `scripts/tag-provenance.ts` leaves their header as the import step wrote it.

On 2026-11-16 the owner added 18 lists this way: the Discord 5k Celebration Tournament's top 8 ("Discord 5k #1: …",
each credited to its player) and the ten lists of cyberpunk-tcg-sim.online's Season-1 ranked report ("Ladder S1 #1: …",
anonymous lists the site built for each Legend trio). Two of the top-8 lists have 10 Units and the Season-1 #2 list has
12. Events 16 to 19, each with all 71 library decks, rated the 18 the same day: 86 to 106 games each, so ranges of 7 to
8 points either side (after event 16 alone: 21 to 33 games, and 12 to 16 points).

## The outside meta (ROADMAP2 §13 goal 4)

What the two sites say about the decks people really play, shown beside the trainer's own numbers and never mixed into
them. choom.gg's hand ratings (tier, power, complexity of seven archetypes) already ship in `src/data/meta.json` (from
`scripts/import-meta.ts`); cyberpunk-tcg-sim.online's meta reports are collected by a sibling script that shares the
deck import's fetcher and rules (the robots file re-read at the start of every run and the content signals checked, as
above). The scheduled workflow `.github/workflows/outside-meta.yml` is how the data is refreshed (see "Running by
itself"); a person can run the same two steps:

```
python tools/import_outside_meta.py                       # the default run; writes outside-meta-import.json
npx tsx scripts/import-outside-meta.ts outside-meta-import.json            # writes src/data/outsideMeta.json (first time)
npx tsx scripts/import-outside-meta.ts outside-meta-import.json --merge    # carries the file forward and replaces it
npm run check:data
```

The default run (no link) reads `https://cyberpunk-tcg-sim.online/meta/season-1` and
`https://cyberpunk-tcg-sim.online/meta/discord-5k-celebration-tournament`, then the reports `src/data/outsideMeta.json`
already holds (`--previous FILE` names another file), then the reports it finds by following links on the pages it
read: `/meta/<report>` links on the sim site, and the "Meta reports" page (`/meta`) that every report's breadcrumb links
to, read only for its report links (the reports link to no other report themselves; the index page is followed because
the reports link to it, never guessed). At most 6 new reports a run and 12 pages in all; a page that is not a report the
script understands is recorded as "not a report" and never fails the run. Given links, it reads those (`--discover`
follows links from them too; only `/meta/<report>` pages on the sim site). `--saved PAGE.html --collected YYYY-MM-DD`
reads pages saved earlier, with no request (each page's own address is taken from inside it). `--summary FILE` appends a
Markdown account of the run (the robots file as seen, each page, what was found) to FILE. It keeps facts only: Legend
names as the site wrote them and the numbers beside them; no player names, no page text, no decklists (those come
through the deck import).

The converter carries the previous file forward (`mergeOutside` in `src/lib/outsideMeta.ts`; `--previous FILE`, by
default the output file):

- a report not read this run (it failed, or was not among the run's pages) keeps its previous entry, older day and all,
  and the run says why;
- a report read with under half its previous ranked decks, field trios or top-cut places (a layout change, most
  likely), or read as another kind of report, keeps its previous entry, and the run says so;
- a reading older than the entry the file has never replaces it;
- a report whose figures did not change keeps its entry as it was, collected day included: `collected` is the day these
  figures were first collected, and a run that finds nothing new writes a file byte for byte the same (nothing to
  commit);
- at most 8 reports are kept, the newest by published day (else collected day), ties by id, and the run names those it
  dropped.

It writes over an existing file only with `--merge` (onto the very file it carried forward: the result only ever takes
newer readings, so running it on a stale raw file cannot undo newer figures) or `--force`; `--fresh` carries nothing
forward. It never writes a file that `check:data` would refuse (`outsideMetaProblems`), and refuses a previous file that
fails that check (`--fresh --force` replaces it).

What `src/data/outsideMeta.json` (`kind: 'nct-outside-meta'`, schema 1; types and rules in `src/lib/outsideMeta.ts`)
holds per report: the site, the report's title and own address, the day it was collected and published, and

- a season report: its period, its totals (series, games, players, trios, the high-rank series, games and decks), its
  power rankings (rank, trio, the site's tier, game win rate with wins and losses, share of high-rank decks, players),
  its field (the legend map's whole trios with their share and win rate, plus any ranked trio the map folded into
  "Other") and its matchup table (cells with a win rate; the site leaves cells under 20 games blank);
- a tournament report: its day, its totals (players, registered, rounds, top cut, games, trios), its field table (players
  who brought each trio, their share of the players paired in the event, game record, top-cut places, best finish) and
  its top cut place by place (trios only).

A trio is three Legends, order ignored. Each name is matched to this trainer's Legend cards by the deck import's rule,
among Legends only (`legendMatcher`: the full name, else the name alone when one Legend has it; "Adam Smasher" is the
Legend, not the Unit); a name that matches none stays as text and is listed under `unmatched`. Shares are percents of the
report's own field (`shareOf`): the season's high-rank decks (two per game, both players in Division III or Master), or
the tournament's players.

Where it shows: a deck page's block **What other sites say** (each source's row for the deck's Legend trio, with
choom.gg's archetype when one has the same Legends; "Same Legends; the list may differ"), and a section **The outside
picture** at the end of Power ratings (each report's field with the library decks of each trio, our Sim tier and our
expected win rate in a column of their own, and how much of the field the library covers). Every row names its site,
links to the report and gives the day it was collected. The Credits page lists the reports when the file is there.
Without the file the site builds and shows choom.gg's ratings only. `outsideFieldShares(library, source)` turns a report's
field into a weight per library deck for goal 5 (a trio's share split equally among the library decks that play it).

Never read by the ratings, head-to-heads, evidence, card impact, bots, breeder or knowledge pack. Tests:
`tests/outside-meta.test.ts`, `tests/outside-meta-ui.test.tsx`, `tests/outside-meta-refresh.test.ts`,
`tools/test_import_outside_meta.py`, `tools/test_robots.py` (made-up pages and robots files).

## Running by itself

The owner decided on 2026-11-18 that the outside figures are refreshed without the owner or an AI assistant running
anything: a scheduled GitHub Actions workflow in this repository, `.github/workflows/outside-meta.yml` ("Refresh outside
meta"), runs the two steps above. **No AI assistant takes part when it runs**: GitHub runs the repository's own scripts
on its own machines. An AI assistant working in this repository still never runs the scripts against
cyberpunk-tcg-sim.online, nor fetches its pages or its robots file in any other way; its tests use invented pages.

**What it does.** Every Monday at 04:37 UTC:

1. `refresh` (read-only permissions, at most 30 minutes): installs the project, then asks the site config whether
   "Figures from other sites" (`features.outsideMeta`) is on (`scripts/automation-switch.ts`). Off: it writes a notice to
   the run's summary and stops, green, before any request to the site. On: `tools/import_outside_meta.py` reads the
   site's robots file (stopping with exit code 3 and a reason when it is not what was accepted), the reports and the
   reports it finds; `scripts/import-outside-meta.ts --merge` carries the previous file forward and writes
   `src/data/outsideMeta.json`; then the same checks as the deploy workflow's `check` job run on that tree (typecheck,
   tests, the Python tests, lint, `check:data`, the build). If the data file changed (and nothing else did,
   `scripts/outside-meta-diff.ts`), that one file is uploaded as the run's artifact. Each step writes what it saw and
   what changed into the run's summary.
2. `commit` (only on `main`, only with a change, only when every check passed, never on a dry run): it runs no
   repository code. It checks the artifact is that one file, commits it as `github-actions[bot]` ("Outside meta:
   refreshed automatically, collected <day>"), checks the commit touches that file alone, pushes to `main` (up to three
   tries, rebasing on a newer `main`), then starts the deploy workflow (`gh workflow run pages.yml --ref main`; a push
   made by the workflow's own token starts no workflow, a dispatch does, and the deploy checks everything again).

**Run it now.** GitHub → Actions → "Refresh outside meta" → Run workflow. Tick "Dry run" to read and check without
committing anything: the summary then says what would have changed.

**Switch it off.** Untick "Figures from other sites" on `#/admin`, download the file and commit it (the steps in
docs/SITE_CONFIG.md): the figures disappear from every page and the next run stops before reading the site. Or disable
the workflow in GitHub (Actions → "Refresh outside meta" → ⋯ → Disable workflow), which stops the runs and leaves the
figures shown as they are.

**When it fails.** GitHub emails the account that last changed the workflow's schedule (the owner) when a scheduled run
fails, and the run's summary says why: "Stopped by the site's robots rules (exit 3)" with the reason, "Stopped" for a
403, 429 or bot check (exit 1; GitHub's machines can be challenged by the site's protection, and the job never answers
a challenge), or the check that failed. Nothing is committed unless every step passed, so the site keeps showing the
last good figures. A report that could not be read, or read hollow, keeps its previous entry and the summary says so;
that alone does not fail the run.

**Accepting a changed robots file.** When the site changes its content signals (or names this script, or disallows the
report pages), every run stops with exit 3 until a person decides. Read the site's new robots file yourself, in a
browser. If it still allows this job (plain figures shown with attribution; not AI training, not an AI system), edit
`ACCEPTED` in `tools/robots.py`: the new `signals`, and `accepted` set to the day you read it; then run the Python tests
and commit. If it does not, leave the file alone and switch the job off as above. No script changes the accepted
values.
