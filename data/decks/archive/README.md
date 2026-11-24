# Archived decks

Deck lists retired from the active library at the fresh baseline of 2026-11-11 (docs/ROADMAP.md §1 and §4). They were bred, forged or optimised from results of the earlier simulator, before the review fixes and the FAQ conformance pass (SIM_VERSION 5), so their selection evidence no longer describes what the sim does.

- `s1-*` … `s5-*` (40 lists): the decks bred in the earlier seasons 1–5 (`scripts/season.ts`: mutants, crossovers and explorers), forged after breeding.
- `s2-08-explorer-rrg-eor.txt`, `rrg-eor-build.txt`: tournament builds, a list plus a sideboard chosen from old optimizer runs.
- `rrg-v-dexter-optimized.txt`, `rrg-v-smasher-optimized.txt`: optimizer variants of the RRG Dexter Midrange meta list.
- `s<N>-…-v<version>.txt` (none yet): bred decks a season retired with `--retire-below-meta-median` (opt-in since 2026-11-24, `scripts/season-retire.ts`): rated below the meta decks' median against the library under simulator version `<version>`. The version is in the name because a deck of the earlier seasons above may already have the file name. Each ends with a `// Retired:` line, and its note moved to `RETIRED_OBJECTIVES` in `src/content/deckObjectives/archived.ts`.

This folder is not part of the library: the site (`src/lib/browserLibrary.ts`) and the scripts (`scripts/lib-node.ts` `loadLibrary`) do not load it, so these decks take part in no new analysis, season, tournament or recommendation. Their strategy notes are kept in `src/content/deckObjectives/archived.ts`. The new Season 1 (2026-11-11) bred its own decks into `data/decks/custom/`; a new deck may reuse an old file name, which is why these live in a separate folder.

Their old results (events, seasons, leaderboard, ratings, head-to-heads, finals and forge reports) are preserved in git at the tags `archive/pre-season1-reset-2026-11-11` (the last commit with the old data and these decks in the library) and `archive/sim-v2-pre-fairness-baseline-2026-11` (the earlier simulator-era snapshot). To look at one: `git show archive/pre-season1-reset-2026-11-11:data/seasons/leaderboard.json`.

Older versions of some of these lists (before forging) are still in `data/decks/custom/history/`, which is not loaded either.
