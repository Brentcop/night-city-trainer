# Improvement backlog (project review, 2026-11-10)

Eight parallel reviewers audited the project at commit `befda3e`. Baseline at that commit: `npx tsc --noEmit` clean, `npx vitest run` 95/95 passing. They reported 131 findings. This file groups them into work packages that can be handed to separate agents.

## Status (2026-11-10)

**Waves A and B are done and merged on the branch `improvements/review-2026-11`**, together with the MIT licence, the dev-dependency upgrade (vite 8, vitest 5; `npm audit` clean) and the approved data deletions. At the end: `tsc` clean, 514 tests passing (95 before), build and lint passing. Wave C has not been started.

**Wave C so far** (branch `improvements/wave-c`): WP-C1's bundle work is done except for loading Home's data at runtime (entry script 1,341 → 820 kB, each worker ~485 → ~205 kB; LIB-1, LIB-2 lazy routes, LIB-12 partly). ENG-8 is done: the human player chooses which Eddies or Legends pay a cost, including for reactions; bots still pay automatically. WP-C2, WP-C3, the rest of WP-C4 and WP-C5 are not started.

What is left over from Waves A and B:

| Item | State |
|---|---|
| ENG-3 | Pending effects resolve in the right player order, but a player still can't choose the order of their own effects (rule 10.12). |
| ENG-7 | An attack ends when a restriction starts forbidding its target; it does not re-check whether the target was readied. |
| ENG-2 | Effect steals now take steal-count modifiers ("steals 1 fewer Gig"), on a reading of rule 11.5.1.3 that should be confirmed against an official ruling. |
| OPS-2 | A forced re-run of seasons 1–5 is refused (they predate per-season totals); the subtract-then-recount path is untested end to end. Moot once the fresh baseline restarts seasons. |
| APP-7 | After Stop, Deck Lab no longer offers to save anything, including swaps already confirmed. |
| AI-11 | Not done: card impact is still keyed by deck name. Needs a card-list signature in the analysis data. |
| AI-8 | Not done: the reviewer oracle still shares its rollout policy with the bots it grades. |
| Card tests | 21 cards still have no direct test (9 of them in library decks); list in the WP-B1 hand-back. |
| Bot strength | New Hard vs old Hard: 48.1% ±2.6 over 1,400 games; Medium 50.1% ±3.1 over 1,000. No bug found; the old bot knew which face-down Legend was which. Tier win rates in the docs are pre-fix and not re-measured. |
| Dependencies | `overrides` pins `minimatch` 11.0.1 under typescript-eslint; remove it when typescript-eslint accepts minimatch 11. |
| Lint | 5 `react-hooks/exhaustive-deps` warnings, not fixed. |
| Browser checks | Checked by hand: Play start, moves, Undo, Quit mid-turn; Matchup Lab in workers; not-found routes; page loads. Not checked: deck-editor unsaved-changes prompts, a full browser tournament, Deck Lab tuning, the error banner, phone layout. |
| CI | The split check/deploy workflow has not run on GitHub yet. |
| Recorded data | Still from the old sim. See [ROADMAP.md](ROADMAP.md) §1. |

**How to read it**

- IDs keep the reviewer prefix: `ENG` engine, `RG` red/green scripts, `BY` blue/yellow scripts, `AI` bots, `PLAY` play UI, `APP` other pages, `LIB` lib/workers/build, `OPS` scripts/CI/docs.
- Severity: **H** high, **M** medium, **L** low. No reviewer rated anything critical.
- ✓ = re-checked against the code by the dispatcher after the reviewer reported it. Everything else is as reported; reviewers reproduced or traced most items, and the ones they could not are marked *(suspected)*.
- Each package lists the files it owns. Two packages in the same wave never own the same file.
- Every package ends with `npx tsc --noEmit && npx vitest run` green, and adds the tests named in its rows.

**What the review found sound** (so nobody re-audits it): engine determinism and plain-data state (60 random games, 9,276 clone points); turn structure, economy, combat, fight and overtime rules; 144 of 150 card scripts match their text; undo/resume and replay-from-choices (6/6 exact); tournament seeding, top cut, byes, tiebreakers and order-independence; worker chunks and asset paths under `base: './'`; no `dangerouslySetInnerHTML` anywhere; production dependencies have no advisories.

---

## Owner decisions

Status as of 2026-11-10. Waves A and B were approved for dispatch on that date.

| # | Decision | Status |
|---|---|---|
| D1 | **Recorded events vs. fixes.** WP-B1, WP-B2 and WP-B3 change how games play out, so the 20 recorded events no longer replay identically. | **Decided: fix forward, no compatibility flag.** The recorded data will be wiped and restarted from Season 1 on the fixed sim at a later date; see [ROADMAP.md](ROADMAP.md) §1. WP-B4 below is replaced by that roadmap item. |
| D2 | **Licence** for the code, plus a third-party notice (OPS-18). | **Decided: MIT.** `LICENSE` and `NOTICE.md` added. |
| D3 | **Dev-dependency major upgrades** (LIB-20): vite 5→6/7, vitest 2→4, tsx. Production is clean; the advisories affect the dev server and test runner. | **Decided: do it now**, as part of the current change. |
| D4 | **Stale one-off scripts** (OPS-12 and appendix). | Applied: moved to `scripts/archive/`. |
| D5 | **Tracked data nobody reads** (OPS-11, OPS-17): the duplicate `data/tournaments/`, `data/reviews/*.json`, superseded report write-ups. | **Decided: delete.** Done when Wave A is merged, after scripts point at the single events copy and doc references are checked. |
| D6 | **Deploy method** (OPS-9): keep publishing to the `gh-pages` branch, or switch to GitHub's official Pages actions. | **Decided: switch, as part of the refactoring wave** (WP-C5; ROADMAP.md §2). Wave A keeps the current method. |

---

## Wave A — safe fixes (no change to how games play out)

These can run in parallel. None of them alters engine or bot behaviour, so recorded events keep replaying.

### WP-A1 · CLI tooling safety

Owns: `scripts/**`. Does not touch `package.json`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| OPS-1 ✓ | H | `scripts/tournament.ts:29` defaults `--start 1`; `writeEvent` (`:103`) overwrites `event-N.json`. Events 1–20 exist. | Default `--start` to max existing id + 1; refuse to overwrite without `--force`; print planned ids first. |
| OPS-2 | H | `scripts/season.ts:151-200` adds a season's games to `leaderboard.json` with no "already counted" check, and rewrites `s<N>-*.txt` decks. | Abort if `season-N.json` exists unless `--force`; keep per-season totals so a re-run subtracts first. |
| OPS-3 | H | `scripts/worker.ts:121` returns a tie on an exception; only `botcheck.ts` and `tournament.ts` look at `r.error`, and the latter still records the tie. An engine regression silently pulls every deck toward 50%. | `runJobs` counts errors, prints the first stack, exits non-zero; errored games excluded from tallies; `tournament.ts` aborts the event. |
| OPS-4 | H | The `flag()` helper (copied in 11 scripts) accepts anything. `--threads abc` → NaN → zero games, and `review`/`analyze` still overwrite `src/data/review.json`; in `tournament.ts` it hangs. Unknown flags, `--field al`, unknown `--bot` are silently accepted. | `parseArgs(spec)` in `scripts/lib-node.ts` on `node:util` `parseArgs` (`strict: true`), integer ≥ 1 and enum validation; all scripts use it. |
| OPS-5 | H | `scripts/review.ts:107-131` hangs forever if a review worker crashes; `tournament.ts` pool (`:84-97`) has no `error`/`exit` handler; `simulate.ts` rejects but leaves workers running. | One shared `workerPool()` in `lib-node.ts` handling `error` and `exit`, re-queueing the in-flight job, terminating all on fatal. |
| OPS-8 | M | `import-meta.ts:31`, `import-guides.ts:24` rewrite deck files without the provenance headers added by `tag-provenance.ts`; `sim add --name <existing>` overwrites silently. | Merge existing header lines on rewrite; refuse overwrite without `--force`. |
| OPS-10 | M | Generated JSON is unstable: `build-h2h.ts` stamps `updated` every run; `readdirSync` order is unsorted in 5 scripts; `bundle-reports.ts:70,82` uses file mtime as "finals date"; `simulate.ts:57` returns results in completion order. | Sort every directory read (numeric for `event-N`); write only when content changed; store the date in the report JSON; sort results by seed. |
| OPS-11 | M | `data/tournaments/` and `public/tournaments/` are byte-identical (4.3 MB twice); `data/reviews/*.json` (7.6 MB) is read by nothing in `src/`. | Keep one copy of the events and point scripts at it. Report which review files nothing reads; the `.gitignore` change is WP-A5's. |
| OPS-12 | M | `final.sh`, `followup.sh`, `nc-chain.sh`, `series.sh` poll for gitignored logs forever; `final.sh` uses `pgrep` (absent in Git Bash); `seasons.sh`, `seasons-45.sh` re-run past seasons. | Per D4: move the class (c) files in the appendix to `scripts/archive/` with a README line. |
| OPS-20 | L | 11 copies of `flag()`, 3 worker pools, 5 event-file iterators, 5 slug functions; `tune.ts:22` seeds with `Math.random()`. | Consolidate into `lib-node.ts`; `--seed` flag for `tune.ts`; pass `threads` to `runJobs` explicitly. |
| OPS-21 | L | `simulate.ts:253,315` credits ties to the first player in `firstPlayerWinRate`. | Track `bFirstWins` in `tally()`. |
| OPS-22 | L | `bundle-reports.ts:104-152` regex-parses forge/optimize markdown; a reworded table drops data silently. | `forge.ts` and `optimize.ts` also write a JSON sidecar; bundle from that. |
| OPS-14 | L | `coach-eval.ts:130` writes `coach-eval-<set>-latest.md`; usage header says `--rollouts 4` (default is 8). | Fix the header. (Doc reference is WP-A5's.) |

### WP-A2 · Deck parsing and saved-data robustness

Owns: `src/engine/deck.ts`, `src/lib/browserLibrary.ts`, `src/lib/practiceLog.ts`, `src/lib/practiceReplays.ts`, `tests/deck.test.ts`, new `tests/library.test.ts`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| APP-2 ✓ | H | `parseSimJson` (`deck.ts:101`) trusts `name` and quantities. A numeric name saved to localStorage breaks Decks, Arena, Deck Lab and Play permanently; a quantity of `1e9` hangs the tab. | Name must be a string (cap 80); clamp quantities to integers 0–3. |
| LIB-8 | M | `validateDeck` (`deck.ts:148`) throws on an unknown card id; `loadCustom` casts stored JSON without checking shape; a corrupt entry can make every custom deck vanish and the next save overwrites the rest; `saveCustom` swallows quota errors. | Report "Unknown card id"; validate entries field by field; back up the raw string before any rewrite; `saveCustom` returns a boolean. |
| LIB-9 ✓ | M | `Mantis Blades (x3)` parses as 1 copy with no error (the set-code stripper at `deck.ts:86` eats it); `x3 Mantis Blades` is rejected. | Match `(xN)` and leading `xN` before stripping set codes. |
| LIB-10 | L | A Legend under `// Sideboard` joins `deck.legends`; Sim JSON accepts a Unit id as a legend and `validateDeck` never checks type; a provenance comment before the name becomes the deck name. | Error on sideboard legends; require type Legend; skip known provenance keys when naming (not every `Key:` — ladder decks are named "Ladder: …"). |
| LIB-11 | L | `exportOfficial` (`deck.ts:164`) drops the sideboard; 5 library decks lose it on round-trip and the test doesn't check. | Emit the sideboard section; extend the round-trip test to name and sideboard for all three formats across every library deck. |
| PLAY-15 | L | `practiceReplays.ts:21`, `practiceLog.ts:14` return whatever `JSON.parse` gives; a non-array crashes the Play setup page. | `Array.isArray` plus per-entry field checks. |
| OPS-16a | M | `deck.test.ts:106` validates only `meta-*` decks. | `tests/library.test.ts`: every `data/decks/**` file parses with zero errors and every id has a card and a script. Note `BBB-running-and-dancing.txt` has a 3-card sideboard today. |

### WP-A3 · Play game loop hardening

Owns: `src/ui/pages/Play.tsx`, `src/ui/HumanAgent.ts`, `src/ui/components/ReviewPanel.tsx`, `src/ui/components/ReplayBoard.tsx`, new `src/lib/practiceSession.ts`, new `src/ui/components/board/handSort.ts`, `tests/play-tools.test.ts`. Callers of `human.answer` in `board/PromptPanel.tsx`, `Overlays.tsx`, `BoardCard.tsx`, `Zones.tsx` change signature only.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| PLAY-1 ✓ | H | `launch` (`Play.tsx:106`) has no `.catch`. Any throw leaves "Rival is thinking…" forever with Undo disabled. | Catch, store the error, show a banner with Undo and Quit; allow undo when errored. |
| PLAY-2 ✓ | M | Undo after game over re-runs `launch`; its `.then` calls `recordPractice` again (append-only), double-counting the result. | Store the replay id in `PracticeGame` and upsert. (`practiceLog.ts` belongs to WP-A2 — coordinate the field name or sequence after it.) |
| PLAY-3 | M | Each undo makes a new `Running.id` (`Play.tsx:104`) so `Board` remounts: coach scorecard and manual hand order are lost. | Stable match id; move grades into `Running` and truncate on undo like `choices`. |
| PLAY-4 ✓ | M | Quit or navigating away during the bot's turn leaves the old game running; it can still record a result. | `cancelled` flag checked by `PacedAgent`/`RecordingAgent`; `.then` returns early; null `onUpdate`. |
| PLAY-14 | L | `HumanAgent.answer(i)` isn't tied to a decision; a stale click can answer the next prompt or throw *(suspected, narrow window)*. `undo()` doesn't check game state first. | `answer(d, i)` ignoring mismatches and out-of-range; guard `undo()`. |
| PLAY-7 | L–M | `PlayPage` re-renders on every engine tick and calls `allDecks()` (localStorage parse) three times per render. | Lazy `useState` initialisers, `useMemo`, tick state in `Board`. |
| PLAY-13 | L | Hand reorder (`Play.tsx:309`) always inserts before the target, so a card can't be moved to the last position. | Insert after when the source is to the left. |
| PLAY-16 | L | `ReviewPanel.tsx:12-29` has no `worker.onerror`; a failed worker spins forever. | Set error state in `onerror`. |
| PLAY-17 | L | `ReplayBoard` assumes frame i = log line i, but the engine trims 500 lines past 2000 (`engine.ts:313`); Space handler fires when a button has focus. | Store the log index per frame; ignore Space on interactive focus. |
| PLAY-20 (1–3) | L | `Play.tsx` holds the session logic; the test re-implements `cloneBot`. | Extract `practiceSession.ts` (agents, snapshots, undo target), a `usePracticeGame()` hook, and `handSort.ts`. |
| PLAY-21 | M | No test that undo-truncated choices replay identically, undo with a pending sub-decision, undo after game over, `sortHand`, stale answers. | Add them against the extracted modules. |

### WP-A4 · Page bugs and browser worker pool

Owns: `src/ui/pages/*` except `Play.tsx`, `src/ui/components/{DeckPicker,Markdown,Provenance,TourneyViews}.tsx`, `src/ui/art.ts`, `src/sim/pool.ts`, `src/sim/game.worker.ts`, `src/App.tsx`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| APP-1 ✓ | H | `Arena.tsx:25` runs `Game.run()` on the main thread, yielding every 2 games; no unmount cleanup, so "A vs all decks" keeps running after you leave; a throw leaves `running` true forever. MatchModal "Watch" does the same. | Run on `GamePool` like Deck Lab; terminate on unmount; try/finally. |
| LIB-6 | M | `pool.ts:15-23` has no `onerror`/`onmessageerror` and doesn't track in-flight jobs; a crashed worker hangs the run; `play()` after `terminate()` queues forever. | Track `Map<Worker, id>`; reject or retry on error, replace the worker; reject after terminate. |
| LIB-5 | M | A game exception aborts a browser tournament silently (`pool.ts:21` rejects, `TournamentRunner.tsx:136` shows "stopped"), while the CLI records a tie. | Same semantics as WP-A1's OPS-3: surface the error; show its text. |
| APP-3 | M | Saving a custom deck under a built-in name hijacks name-keyed lookups (`TourneyViews.tsx:13`, Ratings, Home) and duplicates React keys in Arena. | Refuse or suffix the name on save; name maps prefer built-ins. |
| APP-4 | M | `findDeck` (`DeckPicker.tsx:35`) falls back to substring matching, so a link to a deleted deck opens a different one. | Exact match for URL params. |
| APP-5 | M | Deck editor: "Play it" plays the saved version, not the draft; edits are dropped on navigation; Delete has no confirm. | Dirty flag; label or disable while dirty; confirm delete; put `?d=` in the URL. |
| APP-6 | M | `Tournaments.tsx:36-43`: fast switching can show event A under B's header; a failed load says "Loading" forever; `?e=abc` → NaN. | Cancel stale loads; error state; validate the param. |
| APP-7 | M | Deck Lab says "Tuning finished" after Stop and offers to save a partly measured deck; the bare `catch {}` hides worker errors. | Set phase to Stopped/Failed in the catch and show the message. |
| APP-8, LIB-7 | M/L | Switching Tune/Breed tabs kills a running tune silently; a quick-test result is written by index and can land on a different deck after re-breeding; bred decks are scored on different seeds; the test pool leaks. | Disable tabs while running; key results by deck name; one shared seed; try/catch and terminate. |
| APP-9 | L–M | `TournamentRunner.tsx`: an event file without `bracket` crashes the page; stored runs and URL params aren't validated. | `isEvent()` guard; `Array.isArray`; parse params with fallbacks. |
| APP-10 ✓ | L | `Markdown.tsx:18` puts any link target in `href`. A pasted deck named `[x](javascript:…)` becomes a clickable script link when it appears in an insights line. | Allow only `#`, `http(s):`, `mailto:`; same guard for `prov.source`. |
| APP-12 | L | `art.ts:55-64` fetches the third-party catalog even with art off, and refetches on every mount after a failure. | Skip when disabled; back off after failure. |
| APP-18 | L | Unknown routes render Home silently; `scrollTo(0,0)` on Back loses list position. | NotFound route; skip scroll reset on `popstate`. |

### WP-A5 · CI, docs and repository hygiene

Owns: `.github/**`, `package.json`, `package-lock.json`, `.gitignore`, `README.md`, `CLAUDE.md`, `docs/**` (except this file), `reports/**` housekeeping, `tools/**`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| OPS-7 ✓ | M | `npm run gauntlet` points at `scripts/gauntlet.ts`, which does not exist. | Remove or alias to `sim test`. |
| OPS-9 | M | `pages.yml` runs only on push to main, with workflow-wide `contents: write`, tag-pinned actions, and `cancel-in-progress: true` on deploy. | `check` job on push and pull_request with read permissions; `deploy` job needing it, using the official Pages actions; pin by SHA; add `engines`. |
| OPS-13, AI-14 | M | README and CLAUDE.md are stale: missing `analyze`, Deck Lab, Events, runner, Ratings, Seasons, replays; test list says 3 suites (there are 11); season examples are destructive; README.md:80 says the rival hand is cloned (it is re-dealt); BOT_TOOLKIT §3 weights don't match code. | Update each line; add a Scripts table from the appendix. |
| OPS-17 | L | Tracked leftovers: `reports/tune-profiles.out`, `review-final.json`, three versions each of several write-ups. | Ignore `*.out`; keep current versions; say which report files are build inputs. |
| OPS-11b | M | `data/reviews/*.json` (7.6 MB) unused by the app. | Ignore or keep only the one the docs cite. |
| OPS-18 | L | No LICENSE or third-party notice. | Per D2. |
| OPS-19, LIB-19 | L | No ESLint/Prettier, no Node pin; `build:data` needs an undocumented Python. | `engines` + `.nvmrc`; ESLint flat config with `react-hooks`; Prettier check; port `tools/build_data.py` (56 lines) to tsx or document Python 3. |
| OPS-16b | M | No coverage reporting. | `@vitest/coverage-v8` and a `test:cov` script. |
| LIB-18a | L | `noFallthroughCasesInSwitch` and `noImplicitReturns` cost 0 errors. | Enable both in `tsconfig.json`. |

---

## Wave B — behaviour fixes (changes how games play out; needs D1)

B1 and B2 touch disjoint files and can run in parallel. B3 follows them, and B4 follows B3.

### WP-B1 · Engine rules and card scripts

Owns: `src/engine/engine.ts`, `src/engine/types.ts`, `src/engine/scripts/*.ts`, `tests/{rules,smoke,red,green,blue,yellow}.test.ts`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| ENG-2 ✓, RG-6, BY-6 | M | `stealOne` (`engine.ts:1648`) skips the `stealBan` filter that `steal()` applies, so Appetite for Destruction and Gorilla Arms bypass Chrome Fang and Westbrook Netrunner. | Shared `stealableGigs(att, from)` used by both. |
| ENG-1 ✓, RG-5 | M | Replacement hooks run in board order (`engine.ts:766`) despite the "mandatory first" comment: Jackie's optional sacrifice pre-empts Deadman Transmitter (rule 10.28). Deadman also protects a Legend in the Legends area (`red.ts:279`). | Mandatory hooks first, then optional; Deadman requires `host.zone === 'field'`. |
| ENG-3 | M | `resolvePending` (`engine.ts:1050`) always takes the turn player's next effect; rule 10.14.1 wants the resolving player to finish first. Players can't order their own pending effects (10.12). | Track the resolving player; keep FIFO as the bot default. |
| BY-1, BY-2, RG-8 | M/L | "First time each turn" effects only count events seen while the card was face-up or in play: Jackie Welles: Pour One Out (`blue.ts:136`, in the S-tier BBG list), Viktor Vektor: Drop Your Illusions (`yellow.ts:449`, flagged partial), both Yorinobus (`red.ts:93,455`). | Per-turn counters in `s.counters` maintained by `resolvePlay`, `goSolo`, `attack`, `defeat`; scripts read the count. Removes one `partial`. |
| BY-4 | L | Reboot Optics (`blue.ts:220`, flagged partial) misses rival Units that enter after it resolves *(suspected)*. | Player-level `noDefeatOpp` mod read by `consumeNoDefeat`. Removes one `partial`. |
| BY-3 | L | The Relic (`yellow.ts:234`) bottom-decks itself; CR 11.23.3's example with this exact card says it stays in the trash. The existing test asserts the wrong zone. | Delete the line; fix the test. |
| BY-5 | L | Muamar Reyes's "Adjust a Gig by 1" offers "No change" (`engine.ts:916` adds it unconditionally). | Offer it only for "up to" adjustments. |
| RG-7 | L | MaxTac Squadron's end-of-turn "if spent" is checked at resolution, so Saul Bright readying it first makes it fizzle. | Capture the condition when the trigger is queued. |
| RG-9 | L | Panam Palmer: Strength Through Family — the normal Call action still charges 1 while her free Call is available; not flagged partial. | `callCost` hook, or flag it. |
| ENG-6 | L | Gear of a removed Unit goes to trash instead of removed (4.12); Unit + Gear bottom-deck in a fixed order (4.12.3). | Gear follows to the same zone; shuffle the group with the game RNG. |
| ENG-7 | L | An attack doesn't end when its Unit target stops being a legal target (9.21.3). No current card triggers it. | Re-check target legality in `attackValid`. |
| ENG-4 ✓, AI-9a | M | `clone()` (`engine.ts:150`) deep-copies the log and trace on every lookahead: 0.24 ms → 1.5–2.9 ms per clone as a game goes on; clones are ~60% of a Hard game's time. | Detach `log`/`trace` before cloning; `keepLog` option for the undo snapshot. Outcome-neutral. |
| ENG-5, ENG-10 | L | `cloneDropFunctions` fallback and the function branch in `costModMatches` would hide non-clonable state; `clone()`/`resume()` silently drop a non-empty pending queue; the 500-step guard drops effects without a log. | Delete the fallbacks; assert in `clone()`/`resume()`; make the guard throw in tests. |
| ENG-13 | M | `rules.test.ts` has 7 cases. Untested: mulligans, deck-out, overtime, Go Solo, Call as a reaction, Blocker redirect, Quick programs, lag clearing, pending and replacement order, Gear following its Unit, cost floor, same-seed determinism. | Add them. |
| RG-10, BY gaps | M | ~75 cards with real text have no direct test (lists in the reviewer reports; meta cards first: Zetatech Faceplate, The Heist, Wakako, Trust No One, Dexter DeShawn, All Is Lost, Gunpoint Diplomacy, Satori, La Llorona, Padre, Field Operator, Pepe Najarro). No all-yellow random-games test. | Add tests for the meta cards first. |

### WP-B2 · Bots, coach and reviewer

Owns: `src/ai/**`, `tests/{tiers,reviewer}.test.ts`, new `tests/bot-choices.test.ts`, new `tests/replay.test.ts`. Strength changes are measured with `scripts/botcheck.ts` before and after.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| AI-1 ✓, RG-1, RG-3 | H | `chooseCardOpt` (`heuristic.ts:524`) picks the lowest-value card whenever the prompt matches `discard\|trash\|bottom` or intent is harm. Eight "from your trash" prompts mean "get this back", so the bot recovers its worst card (Meredith Stout, Screw, V Streetkid, We Gotta Live Together, Alt Cunningham, The Relic, Viktor Vektor); Detonate defeats the rival's weakest Gear. Shared by every tier, the coach and the rollout bots. | Decide by `d.tag`, not prompt text; harm on rival cards takes the highest value. |
| RG-2 | H | Gig swaps give away the highest Gig (Hanako, MaxTac AV): `chooseGigOpt` (`heuristic.ts:562`) falls back to highest when all options are friendly. | `swapGive` branch picking the lowest plan value, or score (give, take) pairs and allow None. |
| AI-2 | H | Bots, coach and reviewer use the true identity of face-down Legends in reactions and deep rollouts: with 2+ unknown call options the bot picked the true-best slot 16 of 17 times. The coach effectively tells the player which face-down Legend is best. | Average unknown calls in reactions as the main phase already does; permute face-down identities in `hideInfo`. |
| AI-3 | H | `deepReactions: 3` runs the same rollout three times (identical RNG in each clone; identical in 12 of 12 decisions measured). ~15% of Hard's time is wasted. | Per-rollout world seeds shared across candidates, or set it to 1. |
| AI-4 ✓ | M–H | The 14-candidate cap is a plain `slice` after filtering (`heuristic.ts:178`) and attacks are listed last: 153 of 154 capped decisions lost attack options, 7 lost all of them. Affects Hard's rollouts and the reviewer oracle. | Rank by the fast prior before slicing, or reserve attack slots. |
| AI-6 ✓, RG side note | M | `yesNo` (`heuristic.ts:430`) answers yes to everything except the mulligan: Kerry always rerolls, Jackie always sacrifices herself, Tetratronic always trashes the top card. | Per-tag rules. |
| RG-4 | M | Valentino Street Racer and Johnny: Rocking Renegade give "attack this turn" to a Unit that isn't lagging (`heuristic.ts:502-508`). | Prefer lagging Units for those tags. |
| AI-5, OPS-6 | H | Nothing pins bot behaviour: any fix here changes replays of all 20 recorded `deep` events, and no test would notice. `scripts/tune-profiles.ts` rewrites the profiles the `deep` bot reads. | Per D1. Either way add `tests/replay.test.ts` (golden seed → winner/turns for each tier, plus recorded games once regenerated) and store a bot version in recorded events. |
| AI-7, AI-12 | M | Reviewer grades only the first 6 reaction options (`reviewer.ts:316`), and never grades "sell or not", only "which card". | Collapse unknown calls then include all options; add the best non-sell move as an alternative. |
| AI-10 | L–M | Every clone re-runs the Gig-plan regexes (8.7% of CPU; `eval.ts:41`, `knowledge.ts:107`). | Precompute a per-card plan vector. Outcome-neutral. |
| AI-11 | M–L | Card impact is keyed by deck name (`impact.ts:29`): a renamed deck loses it, a custom deck with a meta name inherits it. | Key by card-list hash or nearest analysed list. |
| AI-16 | L | `lastThought` never resets on the fast path; `chooseGigOpt` scores rival-only choices as steals; breeder sort comparators use random jitter. | Fix each. |
| AI-8, AI-13 | M | The oracle shares horizon, rollout bots and evaluator with Hard and the coach, so "agreement" figures are partly self-consistency. Backlog items in `docs/REVIEW_FINDINGS.md` §3 are partly stale (#1 off, #2 done, #3 partial, #4–5 open). | Document; validate on a sample with a longer horizon. |
| AI-17 | M | No tests for `hideInfo`, `chooseCardOpt`, `yesNo`, reaction choice, or the breeder; the non-interference test uses Easy bots only. | Add them. |

### WP-B3 · Tournament logic and telemetry

Owns: `src/lib/tournament.ts`, `src/analysis/summarize.ts`, `tests/tournament.test.ts`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| LIB-4 ✓ | H | Swiss pairing is greedy (`tournament.ts:139`): avoidable rematches in 44–72% of simulated events. The test checks one configuration that happens to pass. | Backtracking pairing, bye chosen inside the search; property test over sizes 4–16 and 100 seeds. Changes pairings of past seeds. |
| LIB-14 ✓ | L | A tied match goes to `seed % 2 ? a : b` (`tournament.ts:208`); the reviewer reports game-1 seeds are always even, so it always goes to B and counts as a full win. No recorded game has tied. | Hash-based tie-break, or score a Swiss draw as 1 point each. |
| LIB-13 | M | `summarize.ts:64-71` keeps a mulliganed-away hand in "seen", biasing the "Δ when drawn" numbers that drive the coach, Deck Lab swaps and insights. | Rebuild `seen` on mulligan. |
| LIB-21 | M | No tests for Bo1, even fields, no top cut, a full-event determinism check, or `summarize` with a mulligan. | Add them. |

### WP-B4 · Fresh baseline (moved to the roadmap)

Replaced by [ROADMAP.md](ROADMAP.md) §1: wipe the recorded data and restart from Season 1 on the fixed sim, at a later date. Not part of the current waves.

---

## Wave C — structure, performance and accessibility

Run after Wave B so refactors don't collide with behaviour fixes.

### WP-C1 · Bundle size and data loading

Owns: `src/App.tsx` (routes), `vite.config.ts`, `src/lib/deckStats.ts`, `src/lib/deckLab.ts`, `src/ai/impact.ts` data source, `scripts/bundle-reports.ts`, `scripts/build-h2h.ts`, `scripts/plan.ts`, new `src/data/index.ts`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| LIB-1 ✓ | H | Both workers bundle the 330 KB `analysis.json` via `impact.ts:3` to read three fields per card. Measured: a slim file cuts each worker 474 → 193 kB. | Emit `src/data/impact.json` from `bundle-reports`. |
| LIB-2, APP-11 ✓ | H/M | One 1.31 MB entry chunk (293 kB gzip): no `React.lazy`, ~970 KB of data JSON eager, `chunkSizeWarningLimit: 2000` hides it. Measured: lazy routes alone bring the entry to 227 kB. | Lazy routes; small per-deck summary for `deckStats`, fetch full reports; exclude deck history from the eager glob; drop the limit override. |
| LIB-3 | M | Deck Lab imports all of `tournaments.json` to count events. | Generated count. |
| LIB-12 | L | Card impact is computed twice with different thresholds (`deckLab.ts:18` vs `impact.ts:8`). | One implementation. |
| APP-21 | L | `allDecks()` re-parses localStorage inside render loops on six pages; `DeckProfile.tsx:325` sorts the library per deck. | Memoise with a version counter. |
| OPS-15 | L | `plan.ts` freezes "31 days to Chicago" into the built site. | Store the date; compute in the UI. |
| APP-20 (data) | L | `ratings.json` is re-typed five ways; 16 `as any` casts. | Typed views in `src/data/index.ts`. |

### WP-C2 · Play performance, accessibility and CSS

Owns: `src/ui/components/board/**`, `src/ui/components/{TcgCard,Dice}.tsx`, `src/ui/{board,cards,motion}.css`, new `src/sim/coach.worker.ts`; `Play.tsx` for the coach hook only.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| PLAY-5 | M | Coach advice blocks the main thread: 67 ms median, 679 ms max per decision in Node; phones likely 3–5× slower *(phone impact suspected)*. | Run `advise` in a worker. |
| PLAY-6 | M | `drag.tsx:88` sets state on every pointer move, re-rendering the whole board. | Move the ghost via ref + rAF; memoise sidebar parts. |
| PLAY-8 | M | Phone: discard prompts point at hand cards hidden under the dock *(visual suspected)*. | Show hand cards in the dock tray in narrow mode. |
| PLAY-9, PLAY-10 | M | Menus and dialogs don't take or trap focus; face-down cards, dice, the Gig area and the trash aren't keyboard-operable. | `useDialog` hook on all six overlays; role/tabIndex/key handlers. |
| PLAY-11 | L–M | The log identifies the actor by colour only. | Prefix the seat name. |
| PLAY-12 | L–M | Page entrance animation gives `.pb` a transform for 0.45 s, mis-positioning fixed overlays such as the mulligan dialog *(suspected)*. | Exclude `.pb` or portal the overlays. |
| PLAY-18 | L | Refusal toast swallows taps over the hand bar; several tap targets are 24–32 px *(suspected)*. | `pointer-events: none`; 40–44 px targets. |
| PLAY-19 | L | Dead `.ci-bar`; `.pb-handbar-actions` defined 6 times; the compact media query is copy-pasted 4 times. | Merge. |
| PLAY-20 (4–5) | L | Coach and setup panels live in `Play.tsx`. | Extract `useCoach`, `CoachPanel`, `PlaySetup`. |

### WP-C3 · Pages accessibility, CSS and structure

Owns: `src/ui/pages/*` except `Play.tsx`, `src/ui/components/*` outside `board/`, `src/ui/{styles,deckprofile}.css`, `index.html`.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| APP-13 | M | Light theme contrast fails: `--accent` #b8a800 on white is 2.43:1; `--cyan` links 4.25:1; `--green` 4.16–4.47:1. Dark theme passes. | `--accent-text` token; darken cyan and green. |
| APP-14 | M | Deck, guide and Insights lists are `<div onClick>` with no keyboard access. | Buttons or links. |
| APP-15 | L–M | Buttons nested inside links in 16 places. | Style the anchors as buttons. |
| APP-16 | L–M | Card and match modals lack dialog semantics, focus handling, and (CardModal) Escape. | Shared `<Modal>`. |
| APP-17 | L | Unlabelled inputs; no `aria-current`; theme flash on load; button inside `<summary>`. | Labels; inline theme script in `index.html`. |
| APP-19 | L | Dead selectors, duplicated `.panel`/`.topbar`/`.nav a` blocks, dark tokens written twice. | Clean up. |
| APP-20 | L–M | `Decks.tsx` (842 lines) holds four components; `DeckProfile.tsx` is imported as a helper library by three pages; pool lifecycle code is written three times; `download()` twice. | Extract `DeckGallery`, `DeckEditors`, `CardBrowser`, `DeckStats`, `usePoolRun`, `lib/download.ts`. |

### WP-C4 · Type hardening and engine structure

Owns: `tsconfig*.json`, then `src/engine/**` and `src/ai/**` for the refactors. Run last and alone.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| ENG-9 | M | `Mod.kind: string`, `value?: any` (`types.ts:58`): a typo silently does nothing; `until: 'startOfTurn'` without `untilPlayer` is never removed. | Discriminated union keyed on `kind`. |
| LIB-18b | L | `noUnusedLocals`/`Parameters` cost 19 errors; `noUncheckedIndexedAccess` costs 909. | Enable the unused pair; index-access per directory starting with `src/lib` and `src/analysis` (26). |
| LIB-17 | L | One tsconfig mixes DOM and Node types. | Split app and node configs; webworker lib reference. |
| ENG-8 | L | Players can't choose which Eddies or Legends pay a cost (`engine.ts:529`). | Optional `pay` decision; bots keep the heuristic. |
| ENG-12 | L | 1,689-line `Game` class; steal and attack-ban logic duplicated. | Split into zones, economy, combat, pending modules behind the `Game` facade. |
| AI-15 | L | The play-out loop exists five times; `delta/40` hard-coded; magic numbers out of `tune.ts`'s reach. | One `playOut` helper; move constants to weights. |
| LIB-15, LIB-16 | L | Dead exports; three pool implementations and two library loaders. | Delete; generic `WorkPool`; one deck-path rule. |
| D3 / LIB-20 | M | 6 dev-dependency advisories (vitest, tinypool, vite, esbuild, tsx). | Upgrade, rebuild, re-test. |

### WP-C5 · Production deploy pipeline

Owns: `.github/workflows/**`. Needs one owner step in the repository settings. Detail in [ROADMAP.md](ROADMAP.md) §2.

| ID | Sev | Problem | Fix |
|---|---|---|---|
| OPS-9b | M | Deploys force-push `dist/` to `gh-pages` through a third-party action on every push to main. | Official Pages actions with `pages: write` and `id-token: write` on the deploy job only. Owner changes the Pages source to "GitHub Actions" at the same time. |
| OPS-9c | M | Nothing checks that generated data is consistent at deploy time. | `check:data` step: event index matches event files; head-to-heads cover the recorded events. |
| OPS-9d | L | Every push to main is a production release. | Decide between that and a manual or tagged release once the fresh baseline exists. |

---

## Appendix — `scripts/` classification

| File | Status | Action |
|---|---|---|
| simulate.ts, worker.ts, worker-boot.mjs, lib-node.ts, tournament.ts, build-h2h.ts, bundle-reports.ts, plan.ts, forge.ts, optimize.ts, tune.ts, tune-profiles.ts, botcheck.ts, season.ts, import-meta.ts, import-guides.ts, review.ts, review-worker.ts, review-boot.mjs, review-noise.ts, review-debug.ts, coach-eval.ts | documented | keep |
| coach-h2h.sh, bot-tiers.sh, finals.sh | documented | keep (or port to tsx for PowerShell) |
| ratings.ts, breed-data.ts, breed-preview.ts, tag-provenance.ts, classify.ts, showlog.ts, quick.ts | useful, undocumented | document; add usage headers |
| theorize-ladder.ts, eor-build.ts | one-time deck writers | document or archive |
| seasons.sh | documented but destructive | archive or rewrite to run the next season only |
| new-decks.ts, variants.ts, tournament-build.ts | stale deck writers that would overwrite forged lists | archive |
| bbg-plan.sh, pick-followup.sh, refine-measure.sh, final.sh, followup.sh, nc-chain.sh, series.sh, seasons-45.sh | stale one-offs | archive |
| diag.ts | duplicate of quick.ts | delete |
| replay-check.ts | stale bot factory | replace with `tests/replay.test.ts`, then delete |
