# Night City Trainer — Cyberpunk TCG practice simulator

An unofficial, local-first simulator for the **Cyberpunk Trading Card Game** (WeirdCo / CD PROJEKT RED, set 1 *Welcome to Night City*), built to find the strongest deck for the **Edgerunner Open Regional — Chicago (Dec 11–13, 2026)** and practice it.

It combines what two community sites do:

- **[cyberpunk-tcg-sim.online](https://cyberpunk-tcg-sim.online/):** a full rules engine, a deck builder, and play against AI.
- **[choom.gg](https://choom.gg/):** meta tiers, guides, deck lists, and import/export.

On top of that it adds a **matchup lab** that runs thousands of bot-vs-bot games and writes reports, plus **strategy guides** built from those results.

> Not affiliated with CD PROJEKT RED, WeirdCo, choom.gg or cyberpunk-tcg-sim.online. Card data comes from the public catalog of cyberpunk-tcg-sim.online (sourced from netdeck.gg). Meta ratings and deck lists from choom.gg are credited per deck.

## What's inside

| Area | Where | What it does |
|---|---|---|
| Rules engine | `src/engine/` | Implements the Comprehensive Rules (Oct 29 2026): setup and mulligans, economy (Eddies, selling, Legends as money), Call a Legend (also as a reaction), Go Solo, Lag, attack / react / fight / steal, Blocker, Quick, pending-effect order, replacement effects, overtime, and win/deck-out checks. |
| Card scripts | `src/engine/scripts/{red,blue,green,yellow}.ts` | All 150 legal cards. A handful are approximated; they are flagged `partial` and shown as "sim: approximated" on the Cards page. |
| Bots | `src/ai/` | The lookahead bot clones the game, plays each candidate action out, and scores the result. Reactions are scored by projecting the attack's outcome. Sub-choices (targets, dice, discards, modes) use a card-knowledge base and each deck's "Gig plan". |
| Deck formats | `src/engine/deck.ts` | Imports choom.gg text, the "Official" format (cyberpunktcg.com / ChoomBattler / the Sim), Sim deck JSON, and loose lists. Exports all three. Validates RAM limits, copies, size and sideboard. |
| Deck library | `data/decks/` | Choom.gg meta archetypes (`meta-*.txt`), choom.gg guide lists, and your own decks in `data/decks/custom/`. |
| Web app | `src/ui/`, `src/App.tsx` | The pages are listed under [Pages](#pages). |
| Matchup scripts | `scripts/simulate.ts` | Multi-threaded deck testing from the CLI (see below). |
| Research | `data/raw/`, `docs/` | `data/raw/` holds saved copies of the rules, errata, tournament rules, card catalog, and choom.gg meta pages and guides. It is gitignored: it stays on your machine and is not shipped with the site or the repository. `docs/` holds the research notes. |

## Quick start

Needs Node 22.12 or newer (`engines` in `package.json`; `.nvmrc` is `22`). The toolchain is Vite 8 and Vitest 5.

```bash
npm install
npm run dev          # http://localhost:5173
```

## Pages

Routes are hash-based (`#/<page>`); see `src/App.tsx`.

| Menu | Page | Route | What it does |
|---|---|---|---|
| Home | Home | `#/home` | Recommendation and shortcuts. |
| Decks | All decks | `#/decks` | Deck list with filters, builder, import and export. |
| Decks | Deck profile | `#/deck?d=<file>` | One deck's results: tests, head-to-heads, forge history, seasons, card stats. |
| Decks | Deck Lab | `#/lab` | Tunes a submitted deck in the browser, or breeds new decks (including counter decks from the head-to-heads). |
| Play | Play vs Bot | `#/play` | Practice against Easy, Medium or Hard bots, with coach mode, undo, and a full match review. |
| Tournaments | Events | `#/tournaments` | The recorded tournament events: standings, brackets, and every match. Matches can be reviewed or watched as a visual replay. |
| Tournaments | Run a tournament | `#/run` | Runs a tournament in the browser with the same rules and seeds as the CLI. |
| Tournaments | Power ratings | `#/ratings` | Deck ratings fitted to every game of every recorded event. |
| Tournaments | Breeding seasons | `#/seasons` | Bred decks per season and the all-time leaderboard. |
| Tournaments | choom.gg meta | `#/meta` | Meta tiers and sim results for the archetypes. |
| Tournaments | Matchup Lab | `#/arena` | Bot-vs-bot games between any decks in the browser; any game can be watched as a visual replay. |
| Learn | Strategy | `#/guides` | Strategy guides and the tournament plan. |
| Learn | Cards | `#/cards` | Card list; approximated cards are marked. |
| Learn | Glossary | `#/glossary` | Rules terms. |
| Learn | Card stats | `#/insights` | Per-deck card telemetry from `sim -- analyze` ("Δ when drawn" and more). |
| Learn | Credits | `#/credits` | Where every deck came from and who made it. |

Visual replays show a game on the real board; click a log line to rewind to it.

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` / `build` / `preview` | Vite dev server, production build (typecheck first), and a preview of the build. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Runs the test suite once (see [Tests](#tests)). |
| `npm run test:cov` | The test suite with V8 coverage of `src/` (report in `coverage/`, no thresholds). |
| `npm run lint` | ESLint, limited to the React hooks rules. Not part of CI yet. |
| `npm run build:data` | Regenerates `src/data/cards.json` from `data/raw/sim_catalog.json` (`tools/build-data.ts`). Needs the local catalog copy. |
| `npm run sim -- <command>` | The matchup CLI (below). |
| `npm run tournament -- [flags]` | Runs tournament events from the CLI (below). |
| `npm run build-h2h` | Rebuilds `public/data/h2h.json` (head-to-heads for the Deck Lab) from the recorded events. |
| `npm run bundle-reports` | Bundles per-deck report data from `reports/` into `src/data/deckReports.json` for the deck profile page. |
| `npm run refresh` | `bundle-reports`, then `scripts/plan.ts`, then `build-h2h`. |
| `npm run check:data` | Read-only consistency check of the recorded data: the event index matches `public/tournaments/`, `h2h.json` covers every event, and every run manifest has a known schema and deck ids that match the stored lists. Exits 1 on a problem; events without a manifest are counted as legacy. |

## Matchup scripts

```bash
npm run sim -- catalog                              # list decks (match by file or name fragment)
npm run sim -- show rrg                             # print a deck + legality check
npm run sim -- vs meta-rrg meta-bbg --games 400     # head-to-head
npm run sim -- test "Smash the Curve" --games 200   # one deck vs every meta deck  (--field all for every deck)
npm run sim -- review --field all --games 60        # full round robin, rankings + matrix
npm run sim -- add my-list.txt --name "My RRG"      # add a deck (choom.gg / official / sim JSON / plain list)
npx tsx scripts/tune.ts --per 8 --seed 1            # matched training (adopt only if the paired 95% lower bound > 0) + held-out check vs --min-gain (default 1pp); writes a report, never applies weights
npm run sim -- analyze --field all --bot deep       # telemetry round robin -> Insights page, rankings, reports/analysis-latest.md
npx tsx scripts/plan.ts                             # regenerate the Tournament plan + Home recommendation from the data
npx tsx scripts/forge.ts --nc --gens 2 --seed 1     # data-driven iteration of the Trainer-original decks (or pass any deck)
npx tsx scripts/optimize.ts <deck> --vs <opp> --sideboard   # Bo3 sideboard swaps for one matchup
npx tsx scripts/tune-profiles.ts --seed 1           # matched meta-field training (same adoption rule) + held-out profile evaluation on this --seed's own seed range
npx tsx scripts/tune-profiles.ts --seed 1 --apply   # apply only when the held-out lower CI exceeds --min-gain (default 1pp)
npx tsx scripts/season.ts                           # the next unrecorded season: breed 8 new decks, tournament, forge, finals, leaderboard
npm run tournament -- --field meta --bo 3 --top 8 --bot hard   # record a new event (shown on the Events page)
```

Every script prints its usage with `--help`. Unknown flags and invalid values exit with code 2 before anything is read or written. The multi-threaded scripts (`sim`, `tournament`, `season.ts`, `forge.ts`, `optimize.ts`, `tune.ts`, `tune-profiles.ts`, `botcheck.ts`, `review.ts`) take `--threads N` (default: all cores but one, at most 16); `tune.ts`, `tune-profiles.ts` and `forge.ts` take `--seed`, so a run can be repeated. The scripts also refuse to overwrite recorded data unless you pass `--force`:

- `npm run tournament`: `--start` defaults to the highest recorded event + 1, and an existing event is only overwritten with `--force`. Events are read from and written to `public/tournaments/` (plus the index `src/data/tournaments.json`). A game that throws aborts the event: nothing is recorded for it and the run exits 1.
- `scripts/season.ts`: `--season` defaults to the next unrecorded season. An existing season is refused without `--force`, because it would count its games twice; with `--force` its leaderboard totals are taken out first. Seasons 1–5 cannot be forced, because they were recorded before per-season totals were kept.
- `sim add`, `scripts/import-meta.ts`, `scripts/import-guides.ts`, `scripts/eor-build.ts` and `scripts/theorize-ladder.ts` will not overwrite an existing deck file without `--force`. When they do replace one, they keep its provenance header.
- `scripts/review.ts` writes per-decision dumps to `data/reviews/` (gitignored) and summaries to `reports/review-<name>.md` (kept).

### Data-driven deck building
Eight original decks (`data/decks/custom/nc-*.txt`, "Trainer originals" on the site) were designed from gaps in the meta, then refined with the **forge** loop: baseline vs the meta with telemetry, then cut the lowest-impact cards, test adds on identical seeds, and confirm on fresh seeds. Earlier versions are archived in `data/decks/custom/history/`, and the reasoning is in `reports/forge/`. The full process is on the Strategy page → "How decks are built here", and in `docs/ANALYSIS.md`.

Reports go to `reports/` (`*-latest.md` plus timestamped copies, which are gitignored). `review` also refreshes `src/data/review.json`, which feeds the Meta and Home pages; `analyze` refreshes `src/data/analysis.json`, which feeds Card stats, the coach and the Deck Lab.

Every result file carries a run manifest (`src/lib/runManifest.ts`): deck lists by fingerprint, sim version, bot, field, seeds, seats and sample size. The sim CLI, tournaments, `forge.ts`, `optimize.ts`, `season.ts`, the tuners and the Matchup Lab and Deck Lab write one. `ratings.ts` and `build-h2h.ts` aggregate recorded events instead of playing games: their manifest lists the input events with their sim versions and run ids, and is built from those inputs alone, so an unchanged rebuild leaves the file as it was. Card impact is matched by list fingerprint, not by deck name.

## Adding decks

- **In the browser:** go to Decks → Import, paste a list, then Save to My decks. Decks are stored in your browser's localStorage.
- **For the CLI and the bundled site:** run `npm run sim -- add file.txt`, or drop a `.txt` file into `data/decks/custom/`. Any supported format works.
- **Refreshing the choom.gg data:** re-download the pages into your local `data/raw/`, then run `npx tsx scripts/import-meta.ts --force` and `npx tsx scripts/import-guides.ts --force`. Without `--force` they refuse to replace decks that already exist; with it, each deck's provenance header is kept and only the list (and the meta Tier line) is refreshed.

## Deploying to GitHub Pages
The app is fully static: hash routing, relative `base`, and no server. `.github/workflows/pages.yml` uses GitHub's official Pages actions and has two jobs. `check` installs, typechecks, tests, lints, runs `npm run check:data` and builds on every push and every pull request (read-only permissions). `deploy` runs after it, only for pushes to `main`, and publishes the `dist/` that `check` built to `https://<user>.github.io/<repo>/`. The repository's Pages source must be set to "GitHub Actions" (Settings → Pages); see `docs/ROADMAP.md` §2.

## Sources and credits
Every deck file carries a provenance header (`// Origin:`, `// Author:`, `// Source:`, `// Via:`, `// Credits:`, `// Parents:`, `// Added:`). These headers are shown on the Decks, Strategy, Seasons and **Credits** pages. Collected lists credit their authors and link back to choom.gg. Saved copies of third-party pages used during research stay local in `data/raw/` and are not published.

The code is MIT-licensed ([LICENSE](LICENSE)). Card data, rules, artwork and collected deck lists belong to their owners and are not covered by that licence; see [NOTICE.md](NOTICE.md).

## Tests

```bash
npm test             # every tests/*.test.ts(x) file, run by Vitest
npm run test:cov     # the same with coverage
npm run typecheck
```

The table lists the main suites by area; `ls tests` has the full set.

| File | Covers |
|---|---|
| `smoke.test.ts` | 50 random games play to completion. |
| `rules.test.ts` | Core rules, with their rule numbers: setup, steals, fights, attack targets, once-per-turn sell and Call. |
| `red.test.ts`, `blue.test.ts`, `green.test.ts`, `yellow.test.ts` | Card scripts, colour by colour. |
| `deck.test.ts` | Deck import in every format, export round-trips, legality checks, and that the meta decks are legal. |
| `tournament.test.ts` | Bracket seeding, top-cut size, Swiss with a bye and no rematches, and results that don't depend on the order games finish. |
| `tiers.test.ts` | Bot tier names and the mixed-tier seat choice. |
| `reviewer.test.ts` | The match reviewer replays games exactly, does not change them, and summarises accuracy. |
| `play-tools.test.ts` | Undo snapshots replay exactly, drag-to-act targets, and Deck Lab swaps. |
| `engine-fixes.test.ts`, `meta-cards.test.ts`, `library-cards.test.ts`, `library.test.ts` | Engine and card-script regressions, and cards in the meta and library decks. |
| `bots.test.ts`, `bot-choices.test.ts`, `hide-info.test.ts` | Same seed gives the same game for every tier; sub-choices by tag; what lookahead clones hide. |
| `play-session.test.ts`, `pool.test.ts`, `scripts-pool.test.ts`, `scripts-args.test.ts` | The Play session (undo, errors, recording), game errors in the browser and CLI pools, and CLI flag parsing. |
| `pages.test.ts`, `markdown.test.ts`, `summarize.test.ts` | Page helpers, link safety in the Markdown renderer, and game summaries. |
| `runManifest.test.ts`, `check-data.test.ts`, `impact.test.ts` | Run manifests (game runs and deterministic aggregates), the recorded-data check, and card impact matched by list fingerprint. |

## Scripts

Everything in `scripts/` runs with `npx tsx scripts/<file>` (or `bash` for the `.sh` files). Most files start with a usage comment.

| Scripts | Status |
|---|---|
| `simulate.ts` (`npm run sim`), `worker.ts`, `worker-boot.mjs`, `lib-node.ts`, `tournament.ts`, `build-h2h.ts`, `bundle-reports.ts`, `plan.ts`, `forge.ts`, `optimize.ts`, `tune.ts`, `tune-profiles.ts`, `botcheck.ts`, `season.ts`, `import-meta.ts`, `import-guides.ts`, `review.ts`, `review-worker.ts`, `review-boot.mjs`, `review-noise.ts`, `review-debug.ts`, `coach-eval.ts` | Maintained. Covered above, in `docs/BOT_TOOLKIT.md` and in `docs/REVIEW_FINDINGS.md`. |
| `coach-h2h.sh`, `bot-tiers.sh`, `finals.sh` | Maintained bash wrappers: coach configs vs the Deep bot, bot tiers head-to-head, and a final large-sample test followed by the plan. |
| `ratings.ts` | Fits the power ratings (`src/data/ratings.json`, `reports/ratings-latest.md`). |
| `check-data.ts` (`npm run check:data`) | Read-only consistency check of the recorded events, `h2h.json` and run manifests. |
| `breed-data.ts`, `breed-preview.ts` | What the deck breeder learns from past runs; a preview of the next season's breeding without playing games. |
| `tag-provenance.ts` | Rewrites every deck file with a standard provenance header. |
| `classify.ts` | Prints the archetype read of every library deck. |
| `quick.ts`, `showlog.ts` | Quick checks: a few games between two decks, or one game's log. |
| `theorize-ladder.ts`, `eor-build.ts` | One-time deck writers: decks for ladder Legend trios, and a sideboarded list from optimizer reports. |
| `replay-check.ts` | Stale; to be replaced by a replay test. |
| `scripts/archive/` | Unmaintained one-offs kept for history: `new-decks.ts`, `variants.ts`, `tournament-build.ts`, `diag.ts`, `bbg-plan.sh`, `pick-followup.sh`, `refine-measure.sh`, `final.sh`, `followup.sh`, `nc-chain.sh`, `series.sh`, `seasons-45.sh`, `seasons.sh`. Don't run them: several overwrite forged decks or re-run past seasons. |

`tools/build-data.ts` (`npm run build:data`) normalises the card catalog into `src/data/cards.json`.

## Known limits

- The bots are strong heuristic players, not perfect ones. They favour proactive decks over high-skill control decks such as BBG Econ, so treat sim win rates as a floor for those decks. See `docs/STRATEGY.md`.
- Hidden information is respected: bots don't see your hand or deck order, and nobody knows which face-down Legend is which. Lookahead copies re-deal the rival's hand from their unseen cards, shuffle deck order, and shuffle the identities of face-down Legends the bot hasn't seen (its own and the rival's). An unknown Legend Call is valued as one averaged option, in the main phase, in reactions and in deep rollouts.
- Bot and engine fixes change play, so events recorded before them (no `simVersion` in the event file) no longer replay identically; the legacy `deep` and `hard-v1` bot settings are kept but share the fixes. New games replay identically from their seed with the same code (`makeBot()`). A fresh baseline is planned in `docs/ROADMAP.md` §1.
- Approximated cards are listed on the Cards page; search "approximated".
