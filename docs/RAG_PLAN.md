# Knowledge pack (kb): the retrieval plan

A living plan. It says what we are building, the method every step follows, what is done, and what is next.
Whoever lands a step updates the status board (§4), the scoreboard (§7) and the log (§10) in the same commit.

- Started: 2026-11-13, from six read-only research reports (authored knowledge, scored actions,
  competitive records, platform and query cost, AI game execution, outside tools and methods).
- Lines in this file are kept under about 110 characters so that search tools can show them.
- Related plan: `docs/TUNING_STUDY_2026-11-13.md` (change ledger P1, findings P2, evidence view P3).
  This plan reads what that one produces and does not build it a second time.

## 1. The end result

The work is finished when all of these are true.

1. **Ask and get the few records that answer.** A question about a card, ruling, rule, deck, package, event,
   ranking or the codebase returns a handful of records, each with its source and version, in about
   2,000 tokens or less from the local tool, and in 50 KB or less on the site.
2. **Numbers are exact.** Records, standings, rates and ratings are computed by code from recorded data.
   They are never recalled by a model and never matched by similarity.
3. **Every sentence follows the evidence rules.** Association is never worded as value or advice, a rate
   shows its sample and interval, and a measured record names its bot and sim version and is marked stale
   when that version is no longer current.
4. **The pack grows by rows.** A new card, note, ruling, event or finding becomes records at the next
   build, and only changed records are re-indexed.
5. **Every retrieval change is measured.** Nothing about ranking is kept unless the question set (§5,
   step 1.4) shows it helps on held-out questions.
6. **Bots never read it.** Recorded games replay identically, and no worker or bot imports the pack.

Not part of the end result: a hosted backend, a vector database, a model that visitors download by
default, and LLM-written text on the site that the owner has not reviewed.

## 2. Method

These rules hold in every step. A step that needs to break one says so in §8 first.

- **M1. Records, not chunks.** The unit of knowledge is a typed record built from a table the project
  already has (a card, a ruling, a deck note). It keeps the table's stable id and its links. Files are
  split into passages only where no table exists (docs, guides, rules text), and then by heading.
- **M2. The retrieval ladder.** Cheapest first: (1) exact id or name, (2) records one link away,
  (3) BM25 keyword ranking, (4) later, embeddings. The ranked lists are merged with reciprocal rank
  fusion (score = sum of weight / (60 + rank)), so adding a ranker later is a one-line change.
- **M3. Numbers by code.** A question whose answer is a number is answered by a function over the
  recorded data (§5, step 2.1). Retrieval finds which function and which entity; it does not find the number.
- **M4. Text by templates.** Sentences about measured facts are rendered at build time through the
  existing wording helpers (`coachWords`, `reviewWords`, `evidence.ts`, `simTierText`). Every record
  carries its origin (authored, imported, generated, measured, official) and, for notes, its status
  (draft or owner).
- **M5. Stamps and staleness.** A record that depends on a version carries it: sim version and bot for
  measured facts, list fingerprint for deck notes, rules and FAQ versions for rulings, card data version
  for cards. Each record has a content hash. Measured records from different sim versions are never pooled.
- **M6. Two scopes.** `public` records may be written under `public/`. `local` records come from
  `data/raw/` (official rules and FAQ wording, third-party pages) and are written only under `.cache/kb/`,
  which is gitignored. Nothing derived from `data/raw/` is ever written to a tracked file.
- **M7. One core, two homes.** Search and record code is pure TypeScript in `src/lib/kb/` (no DOM, no
  `node:` imports), so the site and the command line rank identically and Vitest covers both. Scripts do
  the file reading and writing.
- **M8. Deterministic builds.** The same inputs give byte-identical outputs: sorted listings, no wall
  clock, no locale-dependent formatting. Tracked outputs are written with `writeIfChanged`.
- **M9. Measure first.** A change to ranking is compared with the current configuration on the question
  set, tuned on the `dev` split and reported on the `test` split, with a paired interval.
  "Could not tell" is a valid result and means the simpler configuration stays. One look at the `test`
  split per experiment. After about ten looks the split is refreshed with questions written by an agent
  that does not know what they will judge, and the agent that builds a change never reads `test` wording.
- **M10. Kept away from play.** No file under `src/engine`, `src/ai` or `src/sim` imports `src/lib/kb`.
  The entry chunk never reaches it. A test enforces both.
- **M11. Small until measured.** No new runtime dependency and no model download until a measurement on
  the question set justifies it and the owner agrees.
- **M12. No self-reference.** The pack does not index material about itself: this plan, its own code
  headers, its question set and its reports. They quote example questions and everyday words, so they
  compete with the records those questions are looking for. The `CLAUDE.md` bullet about the pack stays
  indexed, so the tool can still be found.

## 3. How it fits together

```mermaid
flowchart TD
  subgraph Sources
    A[Authored: cards, rulings, decks, notes, packages, glossary, guides]
    M[Measured: ratings, findings, decision and synergy statistics]
    P[Play records: events, rounds, games]
    L[Local only: rules and FAQ wording, docs, code headers, reports]
  end
  A --> B[Pack builder: typed, linked, stamped records]
  M --> B
  P --> B
  L --> B
  B --> PUB[Public pack: static files under public/data/kb]
  B --> LOC[Local pack: .cache/kb]
  PUB --> C[Search core: exact, linked, keyword, later vectors]
  LOC --> C
  C --> SITE[Site: dossiers and search, no model]
  C --> CLI[npm run kb: the owner and agents]
  C -.-> DRAFT[Claude drafts, reviewed by the owner]
  Q[Question set] --> E[kb-eval: recall, MRR, paired intervals]
  C --> E
  E --> SB[Scoreboard in this file]
```

Why this shape and not "split files, embed, let a model answer" (measured 2026-11-13):

- The corpus is small and already structured: 150 cards, 311 rulings, 47 library decks with notes,
  26 synergy packages, 54 glossary terms and 80 guide sections (counting each guide's opening). Every
  unit has a stable id and tested links. Chunking would discard both.
- Most questions name a thing or want an exact number. Sixteen card names belong to two or three cards,
  which similarity search confuses, and embeddings retrieve numbers poorly.
- The site cannot carry a model: a query encoder is a 23 to 34 MB download against a first visit of
  about 256 KB, and the worker bundles have about 34 kB of headroom.
- A plain scan of 100,000 vectors took 43 ms on the owner's machine, so size will not force a vector
  database. The real risk is staleness: `SIM_VERSION` went from 2 to 8 between 10 and 13 November.

## 4. Status board

Status is one of: done, in progress, next, blocked (with the reason), waiting (on a decision in §8).

| Step | Outcome | Status | Landed in |
|---|---|---|---|
| 0.1 | Play reads a small lift slice, not the whole synergy report | done | 2026-11-13 |
| 0.2 | Short `CLAUDE.md` core, per-directory files, wrapped doc lines | waiting: D7, and needs step 1.5 first | |
| 0.3 | Official-wording guard; quotes paraphrased; insights worded as association | done | 2026-11-13 |
| 1.1 | Record model and search core in `src/lib/kb/` | done | 2026-11-13 |
| 1.2 | Builders for authored, dev and local-only sources | done | 2026-11-13 |
| 1.3 | `npm run kb` (search, get, related, stats, build) | done | 2026-11-13 |
| 1.4 | Question set and `kb-eval` with first baselines | done | 2026-11-13 |
| 1.5 | Agent skill and a `CLAUDE.md` pointer | done | 2026-11-13 |
| 1.6 | Unanswerable questions; the "no match" floor, the rules misses, two-deck questions | done: measured, no change kept | 2026-11-13 |
| 2.1 | Numbers by code: `src/lib/eventFacts.ts` and `npm run kb -- fact` | done | 2026-11-13 |
| 2.2 | Event, round, rating and matchup records from templates | done in the pack; upsets, Gig margins and site files later | 2026-11-13 |
| 2.3 | Findings as records | waiting: TUNING_STUDY P2 | |
| 2.4 | Card and package play statistics as exact facts and keyed records | done in the pack; found only when asked for by name ("stats"), wider wording to be measured in 4.7b | 2026-11-14 |
| 3.1 | Public pack, byte budgets, guards | waiting: D1, D2 | |
| 3.2 | Search and dossiers on the site behind a feature flag | waiting: D1, D2, D3 | |
| 4.1 | Embeddings as a fourth ranker | done: measured, not kept in the default; opt-in | 2026-11-13 |
| 4.2–4.5 | Reranker, related lists, drafted notes, long-context baseline | waiting: D3, D4, and fresh held-out questions | |
| 4.6 | A small domain synonym table applied to the question | done: kept, part of the default search | 2026-11-13 |
| 4.7a | Folding word forms in the keyword ranker ("flipping", "triggered", "abilities") | done: could not tell, not kept; opt-in | 2026-11-13 |
| 4.7b | Wordings that should reach the statistics records, and questions naming two decks; then described mechanics, decks by description, long questions | in progress: 60 blind questions written, experiment next | |
| 5.1 | Coach answers reused for a position already answered (Undo, resume in the same tab) | done | 2026-11-14 |
| 5.2 | Stored game reviews keep their measurements and are re-rated without play-outs | done | 2026-11-14 |
| 5.3 | A probe of how often positions repeat | waiting: it would edit a file the game cache depends on | |

## 5. Steps

Each step lists its goal, how to build it, the files it owns, and when it counts as done.

### Step 0. Slimming that needs no index

**0.1 Lift slice for Play.**
- Goal: Play stops downloading the whole synergy report (807 KB raw, 115 KB gzip) on every board mount
  to read one list's rows.
- How: derive one small file, `public/data/lift.json` (`kind: 'nct-lift'`, schema 1), holding exactly
  what `seatLift` in `src/ai/packageLift.ts` reads: the pooled rows and each list's rows (measured
  78.6 KB raw, 10.4 KB gzip for all 47 lists). Write it wherever `synergies.json` is written and in
  `npm run refresh`. Add a reader beside `useSynergyReport` in `src/ui/synergyReport.ts`, and have
  `Play.tsx` ask for it only when the coach is on. `check:data` verifies the slice equals the derivation.
- Done when: Play no longer requests `synergies.json`; the coach's package wording is unchanged on the
  pinned tests (`tests/coach-package-lift.test.ts`); the slice is checked for freshness.
- Landed: `liftSlice`, `seatLiftFromSlice` and `readLiftSlice` in `src/ai/packageLift.ts`;
  `scripts/build-lift.ts` (also the last step of `npm run refresh`); the analyze run writes the slice
  beside the report; `check:data` compares the two byte for byte. The slice holds 23 pooled rows and 47
  lists, unrounded, because the coach's gate is "lower bound above 0". For every list, an unknown list
  and a stale catalogue, the slice gives exactly the table the full report gives
  (`tests/lift-slice.test.ts`). In the browser: coach off, no request; coach on, one request for
  `data/lift.json` and none for the report.

**0.2 `CLAUDE.md` core and wrapped docs.**
- Goal: an agent session starts with about 2k tokens of rules instead of about 11k, and every doc line
  can be shown by a search tool (today about half the text in `CLAUDE.md` and `docs/` sits on lines of
  more than 500 characters, which the search tool replaces with "[Omitted long matching line]").
- How: keep in the root file only what must always be seen (replay determinism, plain state, bots read no
  log or report, no third-party loads, `data/raw` local-only and paraphrases only, the evidence wording
  rules, the entry-chunk rule and worker budgets, command-line conventions, the before-commit commands).
  Move each area's detail into a `CLAUDE.md` in that area's directory. Wrap long lines in `docs/`.
- Before starting: step 1.5 is done (so moved detail stays findable), no other session is editing
  `CLAUDE.md`, and nested-file loading has been checked in a throwaway session.
- With it: update the question set's `doc:CLAUDE.md#…` expectations, which all change when the file is split.

**0.3 Corpus hygiene.**
- Goal: the repository follows its own rules before an index copies its text around.
- How, part a: a guard test under `tests/faq/` fails when a tracked source, test or doc file shares ten
  or more consecutive words with the local FAQ (skipped when `data/raw` is absent; runs that also occur
  in a card's own text are ignored; the message names file, line and run length, never the text).
  Paraphrase the quotations it finds in test files now.
- How, part b: a quotation inside a file the game cache hashes is not edited now, because editing such a
  file discards the cached games (168,784 under v8 on 2026-11-13). The guard carries a named exception
  for it (the file, one run, its longest length) until a change turns the cache over anyway.
- How, part c: `insights()` in `src/analysis/analyze.ts` turns win-rate association into instructions
  ("Keep these over everything when you sell or mulligan"). Reword as association, regenerate the stored
  sentences in `src/data/analysis.json` and the texts copied from them, and add a wording test.
- Landed, parts a and b: `tests/faq/wording-guard.test.ts` scans every tracked text file against the FAQ,
  the Comprehensive Rules, the tournament rules and the errata, at ten words, with card text masked word
  by word. It found one labelled FAQ quotation, in `tests/engine-fixes.test.ts`, now paraphrased. A
  correction to the research: the 18-word match in `src/engine/scripts/blue.ts` is that card's own text,
  not FAQ wording, and needs nothing. The real second case is one 15-word sentence from the rules,
  copied into `src/engine/engine.ts` and `src/engine/game/actions.ts`; both are hashed by the game cache,
  so those two are the named exceptions.
- Landed, part c: every line `insights()` writes now states what was observed and its sample, with no
  instruction; the two win-rate-gap lines say they are associations. The stored sentences in
  `src/data/analysis.json` and `reports/analysis-latest.*` were re-derived without playing games (only
  the `insights` arrays changed), `scripts/plan.ts` refreshed the copies, and
  `tests/insights-wording.test.ts` fails on advice wording. Left as they are: the 16 historical forge logs
  under `reports/forge/`, which cannot be re-derived without games.

### Step 1. The pack and the local tool

**1.1 Record model and search core** (`src/lib/kb/`, pure).
- `types.ts`: the record model in §6.
- `text.ts`: tokenizer. Fold accents and quotes with `foldText` from `src/lib/cardMentions.ts`, lower-case,
  split on non-alphanumerics, drop a short stop-word list, strip a plural "s". No other stemming until
  the question set asks for it.
- `bm25.ts`: BM25 with k1 = 1.2 and b = 0.75 over title, aliases and text; title and alias tokens count
  three times.
- `names.ts`: exact lookup by id, by title and by alias, case-insensitive, returning every record that
  shares a name (two cards with one name are both returned).
- `search.ts`: the ladder of M2. Rankers produce ranked lists; `fuse` merges them by reciprocal rank
  fusion with weights (exact 2, linked 1, keyword 1 to start; tuned only on the `dev` split). Options:
  number of results, kinds, scope, which rankers run. A query with no hit above a floor returns
  "no match" rather than the nearest noise.
- `dossier.ts`: one record plus its neighbours grouped by link type, cut to a token budget.
- `render.ts`: plain-text and JSON output with id, title, kind, scope, origin, status, stamps, source
  path and a snippet of at most 300 characters; a token cap (characters divided by 4, a rough rule).

**1.2 Builders** (`src/lib/kb/build/` pure functions over data that scripts load).
- Authored, public scope: cards (`src/data/cards.json`), rulings (`tests/faq/entries/`, our paraphrases),
  library decks (`data/decks/*.txt` through the library rules), deck notes (`src/content/deckObjectives/`),
  synergy packages (`src/content/synergies/`), glossary terms and the two vocabularies, and guide
  sections split at second-level headings.
- Dev knowledge: `CLAUDE.md`, `README.md` and `docs/*.md` split by heading into passages of at most about
  120 words, and one record per source file from its opening comment block. By rule M12 this plan and
  the pack's own code (`src/lib/kb/`, `scripts/kb*.ts`) are left out.
- Local scope, only when `data/raw/` is present: rules by numbered rule, official FAQ wording linked to
  its ruling, tournament rules and errata by section.
- Links come from fields that already exist (ruling to card, note to deck and key cards, package to
  members, guide to deck). Card names in prose are linked with the card-mention matcher; a mention that
  stays ambiguous is counted in the build report, never guessed.
- Not read yet: the `insights` arrays (they come with the measured cells in step 2.4), archived decks
  (D9), and the tutorial lessons under `src/content/tutorial/` (they landed while this step was built).

**1.3 Command line** (`scripts/kb.ts`, run as `npm run kb -- <command>`).
- `search "<question>"`, `get <id or name>`, `related <id or name>`, `stats`, `build`.
- Flags: `--kind`, `--scope public|local|all`, `--k`, `--json`, `--max-tokens`, `--rankers`.
- Follows the script conventions in `scripts/lib-node.ts`: `cli()` for `--help`, exit 2 on an unknown flag
  or bad value. The local pack is a cache in `.cache/kb/` (one record per line, plus a manifest of input
  hashes) rebuilt when an input changed.
- Output from a `local` record is labelled local-only so that it is not pasted into a tracked file.

**1.4 Question set and evaluation.**
- `data/kb/questions.json` (`kind: 'nct-kb-questions'`, schema 1): about 100 questions, each with the
  record ids that answer it, a type (entity, paraphrase, cross-entity, number, dev, rules), a scope and a
  split (`dev` 60, `test` 40). Written the way a player or a developer would ask, not by copying a
  record's wording. It starts as an agent-written draft (D8); the owner can edit it at any time.
- `scripts/kb-eval.ts`: recall at 1, 5 and 10 and MRR at 10, by type and split, for each configuration
  (exact only, plus linked, plus keyword, all fused), with a seeded paired bootstrap for the difference
  between two configurations and the mean and 90th-percentile answer size in tokens. Writes
  `reports/kb-eval-latest.md` and `.json`; rules questions are skipped when `data/raw` is absent.
- First thing to measure: a one-word glossary or vocabulary name inside a longer question takes the exact
  rank and pushes out the package or deck that answers it ("which deck wins by filling the trash" lists
  two "trash" terms before the trash package, and no deck in the first three).
- Done when: the scoreboard in §7 holds the first baselines and the weakest question type is named.
- Landed: 100 questions (entity 20, paraphrase 25, cross-entity 15, dev 20, rules 20; 79 public and 21
  local; 60 `dev` and 40 `test`, split by position within each type). Run it with
  `npm run kb:eval`; `--out` rewrites the two reports, `--against FILE` pairs a run with an earlier report,
  `--scope public` is what a checkout without `data/raw` sees. Reports print a local record by id only,
  because a local title can carry official wording.
- What it showed: names and links work (entity and cross-entity questions find their record in the first
  five 100% and 93% of the time). Paraphrased questions are the weak type (48%), then rules (60%).
  The paraphrase gap is the case experiment 4.1 has to win.
- Keeping it honest: the numbers move a little whenever an indexed doc or code header changes, so rerun
  `npm run kb:eval -- --out` in a commit that edits docs heavily. An expectation that names one passage of
  a doc (`…~3`) goes stale when that doc is reorganised; the script lists stale ids and `--strict` fails on them.

**1.5 Agent skill and pointer.**
- `.claude/skills/kb/SKILL.md` tells an agent when to call `npm run kb` instead of reading whole files,
  and a short bullet in `CLAUDE.md` points to this plan and the command.

**1.6 The "no match" floor and the rules misses.**
- Four `dev` questions return nothing although keyword search has candidates: the floor (best keyword
  hit must hold half of the question's words) discards real answers, and its benefit is unmeasured
  because the set has no question without an answer.
- How: add about ten questions the pack cannot answer, with their own metric (share correctly refused).
  Then test a lower floor, or coverage over the first three hits, against the paraphrase and rules misses.
- Rules questions: keyword search alone beats the default on `dev` (recall at 5 of 67% against 42%),
  because the neighbours of a one-word glossary term crowd out rule records. Stop expanding links from
  one-word term hits while still letting those hits block "no match". This needs fresh held-out questions:
  the current `test` totals already informed the idea.
- Matchups asked with "against": "how does X do against Y" does not find the matchup record, because
  "against" is not a cue (it also names the guide sections "Playing against it"). Add questions in that
  phrasing first, then test a cue that needs two deck names in the question.
- Growth costs a little: each batch of new records moves a few older questions down a rank or two (see
  the scoreboard). Watch the earlier questions whenever a kind is added.
- Landed: the question set grew to 146. Twelve are of a new type, `none`: plausible questions the pack
  cannot answer, scored by how often the search refuses them, with answerable questions wrongly refused
  counted beside it. Ten fresh rules questions and eight number questions in the phrasings the cue words
  miss ("how does X do against Y", "which decks are strongest") joined too, so the baseline is harder
  and more honest than the step 1.4 one. `npm run kb:eval -- --tune k=v` tries a variant without editing
  code. `fact ratings [--top N]` and a `rating:table` record answer "which decks are strongest", and say
  when the 90% ranges overlap.
- Result: none of the three changes was kept (§7). A lower floor answered more real questions on `dev`
  but gained nothing on `test` and refused fewer unanswerable ones. Dropping links from one-word terms
  could not be told from no change. Adding the matchup when two decks are named found two more `test`
  questions and lost none, but its interval reaches zero; it is the one worth retesting with more
  questions in that phrasing.
- Refusing is weak: with all records only 4 of the 12 unanswerable questions are refused, because the
  rules and FAQ records always offer something. This and paraphrase are what embeddings must improve.

### Step 2. Measured and competitive records

**2.1 Records query module** (pure, Node and browser).
- One correct definition per number: champion, standings after round k (export `computeStandings` from
  `src/lib/tournament.ts`), finishes with the real top cut, titles (custom events excluded), first-player
  split, end-reason mix, matchup (shrunk estimate with the raw record), rating and Sim tier with their
  range, and upsets judged against ratings fitted only on earlier events.
- Exposed as `npm run kb -- fact <name> ...` and to templates.
- Landed: `src/lib/eventFacts.ts` (`eventSummary`, `standingsAfter`, `roundSummary`, `deckCompetitive`,
  `matchupFact`), each result carrying its bot, sim version and recorded date. Rebuilt standings equal the
  stored standings on all 7 recorded events (`tests/event-facts.test.ts`). The commands are
  `fact champion --event N`, `fact standings --event N [--round K]`, `fact round --event N --round K`,
  `fact rating <deck>`, `fact finishes <deck>` and `fact matchup <a> vs <b>`.
- "Top 8" comes back as two named numbers (D6): real top-cut appearances, and the ratings file's count of
  Swiss finishes in the first eight places. They differ for five decks today.
- Two things to know: the module reuses `computeStandings` from `src/lib/tournament.ts` (now exported),
  so it pulls in bot and engine imports; and that function breaks its last tie with `localeCompare`,
  which rule M8 would not allow in new code.
- Not built yet: upsets judged against ratings fitted on earlier events, and anything needing Gig margins.

**2.2 Sheets.**
- One sheet per event, per round and per deck, rendered by templates from 2.1. A sheet is keyed on its
  template version, sim version, bot and a content hash of exactly the inputs it read. Event id, date and
  run id are not content identities: a re-recorded event keeps all three.
- Emitted in `npm run refresh` after a ratings step (today `refresh` does not rebuild ratings), and
  rejected by `check:data` when an input hash no longer matches.
- A richer round summary needs per-game Gig counts, which the tournament worker computes and the event
  writer drops (`scripts/worker.ts` lines 73 to 74 and 276 to 277); keeping them is about 15 bytes a game.
- Landed in the pack: 7 event, 71 round (52 Swiss and 19 bracket), 47 rating and 103 matchup records
  (pairings with at least 6 games; the rest are answered by `fact matchup`). Each is `measured`, names
  its bot and sim version in its first sentence, shows every rate with its sample, and is marked stale when
  its sim version is not the current one. They are rebuilt with the pack from the event files, the index,
  `ratings.json` and `h2h.json`, so they are exactly as fresh as those files. A round record is a round
  summary: results, sweeps and deciding games, first-player share, game length, how games ended, and the
  leaders after the round as records.
- Still to do here: emit the same sheets as site files (step 3), who moved into or out of the top-cut
  places per round, and wording for round-robin and match-list events on real data.

**2.3 Findings as records.**
- When `src/lib/findings.ts` and `public/data/evidence/` exist (TUNING_STUDY P2), each `Finding` becomes
  a `finding` record: same id, the cite line as text, its stamps, and `stale` carried through.

**2.4 Evidence cells.**
- Decision cells, synergy rows and impact rows (about 1,550 today) become keyed records with n, rate,
  interval, the gate fields (thin, association, lift gate) and one template sentence each, so that a
  question about one card on one list reads under 1 KB instead of a 547 KB file.
- Landed: `src/lib/cardFacts.ts` (pure, one function per number: `cardUse`, `cardAnalysis`,
  `pooledImpact`, `packageFact`), read by `npm run kb -- fact card <card> [--deck <deck>]` and
  `fact package <package> [--deck <deck>]`, and by the builder `src/lib/kb/build/stats.ts`.
  - Records: 205 `cardstat` (133 for a card on one list, 72 pooled over lists) and 342 `pkgstat` (318 for
    a package on one list, 24 pooled). Lists are matched by fingerprint; none was skipped.
  - Card statistics exist only for the 7 meta lists (the decision report and the deck analysis cover that
    field, 4,200 games); package statistics for all 47 lists (the synergy report, 6,486 games). Each
    record names its own run.
  - Every record says in its first sentence what was measured, by which bot, on which sim version and
    over how many games; every count has its denominator, every rate its games and 95% interval; a slice
    under 20 games says "too few games" and gives no rate. They say what the bot did, as associations,
    never what a card is worth.
  - The interval on the "gap when drawn" is rebuilt (Newcombe's method on the stored win rates and
    game counts), because the analysis file stores none. The coach's pooled impact figure is shown as
    what it is, a weighted mean with no interval of its own.
  - Where two reports define a word differently the record says which is which: "played" is a main-phase
    play from hand in the decision report and any play in the deck analysis; "turn" is the game's turn in
    one and the list's own turn in the other.
- A single-card answer is about 760 tokens, where reading the two report files would be about 158,000.
- These records join a search only when the question says "stats", "statistics" or "telemetry" (or
  names the record). Questions such as "how often is X sold" do not reach them yet: that wording is to be
  chosen on questions written blind (step 4.7b), not guessed.
- The first build moved 26 of the 208 answerable questions, although the new records never appear
  unasked: the keyword ranker counted their words when weighing every other record. They are now scored
  but left out of those counts (`STATS_FREE_KINDS` in `search.ts`), and no earlier ranking moved.
- Not built: statistics as site files (step 3), per-opponent slices (the reports do not keep them).

### Step 3. Site surface

- 3.1 Public pack: hashed shard names and a small manifest under `public/data/kb/`; budgets of nothing
  added to the entry chunk, 10 KB gzip of search code, 50 KB for a first query and 150 KB for the full
  index; a data budget in `tools/size-budget.ts`; freshness in `check:data`.
- 3.2 A search box and dossier panels (card rulings, deck profile) behind a `FEATURES` flag, loaded on
  intent only. Glossary search is repaired on the way (it matches JSON field names today).
- Waits on D1, D2 and D3, and on the tutorial work finishing its `siteConfig.ts` edits.

### Step 4. Experiments

Each experiment records its hypothesis, configuration, `dev` and `test` numbers, the paired interval,
the decision (keep, drop, could not tell) and its cost.

- 4.1 Embeddings computed on the owner's machine (bge-small-en-v1.5 or arctic-embed-s, 384 dimensions),
  scanned by a plain loop and fused by M2. Needs a dev dependency and a model download: owner approval.
  - Run on 2026-11-13 with the owner's approval. Built: `src/lib/kb/dense.ts` (a plain dot-product scan),
    a fourth ranker `dense` that runs only when asked (`--rankers exact,linked,keyword,dense`),
    `scripts/kb-dense.ts` (offline embedder and a vector cache keyed on each record's text), and
    `npm run kb -- embed`. `npm run kb:eval -- --dense` adds the dense configurations.
  - The tools are not in `package.json`. They sit in `.cache/kb-dense/` (gitignored): the package
    `@huggingface/transformers@4.3.2` with its dependencies (456 MB on disk, mostly `onnxruntime-node`) in
    `tools/`, and the model `Xenova/bge-small-en-v1.5` at hub revision `ea104da` in `models/`
    (`onnx/model_quantized.onnx`, 34,014,426 bytes, sha256 `6c9c6101…7dbfe4`, plus four small files).
    `npm run kb -- stats` says what is missing; nothing is ever fetched by the code.
  - Result on the held-out answerable questions (54, all records), keyword-and-links default against the
    hybrid: first five 70.4% to 75.9%, +5.6 points [−1.8, +14.8]; MRR 0.512 to 0.567. The planned single
    look gave MRR +0.049 [−0.008, +0.108]: could not tell. A second look, after a determinism fix, gave
    +0.055 [+0.002, +0.113]. Public records only: +4.8 points [−4.8, +14.3], MRR +0.011 [−0.040, +0.068].
  - Where it helped and where it did not: rules questions gained (MRR +0.185 [+0.046, +0.333], and two
    wrongly refused questions answered). Paraphrased questions, the reason for the experiment, did not
    (first five 50% to 40%). Unanswerable questions were refused no more often. Dense alone was poor
    (first five 54%, and it refused a third of the answerable questions).
  - Decision: not kept in the default search. Two looks, a lower bound of +0.002 on one scope and "could
    not tell" on the other do not justify 456 MB of tools and a second of start-up per search (M11).
  - Found on the way: with the quantized model a text's vector depended on what else was in its batch
    (cosine 0.995 against itself), so embedding is done one text per call. That is byte-identical on a
    rebuild, faster (61 s for 3,545 records) and far smaller in memory.
  - Next, in order: retest on fresh held-out questions; dense for rules questions only; dense as a
    signal for refusing; then the reranker (4.2).
- 4.2 A small cross-encoder reranking the top 50.
- 4.3 Precomputed "related" lists shipped to the site as id lists.
- 4.4 Per-card play notes drafted by Claude from dossiers, checked by a validator (no figure missing from
  the records, no figure past the caps, association wording) and reviewed by the owner before commit.
- 4.5 The baseline every index must beat: the whole public prose in one cached prompt (about 65k tokens;
  Anthropic's guidance is to skip retrieval under about 200k). 4.4 and 4.5 spend API money: owner approval.
- 4.6 A domain synonym table. Paraphrased questions miss because players use everyday words, or words
  from other card games, where the records use this game's terms ("equipment" for Gear, "tap" for spend,
  "discard pile" for trash). A small, reviewable table maps such words to the game's terms and expands
  the question for the keyword ranker. No model and no dependency. To keep it honest, thirty fresh
  paraphrased questions were written first by an agent that knew nothing of the table, and the agent that
  builds the table never reads the held-out ones.
  - Built: `src/lib/kb/synonyms.ts`, 41 entries, each with its reason (tap and exhaust mean spend;
    graveyard and discard pile mean trash; creature and minion mean Unit; opponent and enemy mean rival;
    kill and destroy mean defeat; and so on). A test refuses an entry whose target is not in the pack or
    whose everyday word is itself one of this game's terms or part of a card name. Only the keyword
    ranker and the "no match" floor read the table; exact names and links do not.
  - Diagnosis first: of the 21 paraphrased `dev` questions the search missed, 12 were vocabulary gaps
    the table could bridge and 9 were something else.
  - Result on the held-out answerable questions (66, all records), one planned look: first five 60.6%
    to 65.2%, +4.5 points [0.0, +10.6]; MRR +0.027 [+0.005, +0.058]. Paraphrased questions alone (22):
    first five 31.8% to 45.5%, MRR +0.082 [+0.018, +0.159]. Every other type unchanged. Unanswerable
    questions refused as before; answerable ones wrongly refused fell from 7 to 5. Public records only:
    MRR +0.037 [+0.006, +0.078].
  - Decision: kept. `synonymWeight` is 1 and `synonymCoverage` is on by default.
  - Two side effects seen on `dev`: one unanswerable question is now answered ("commander" stands for
    Legend), and one rules question fell from first to second ("dice" adds Gig).
- 4.7 What the remaining paraphrase misses need, from the same diagnosis: folding word forms in the
  tokenizer ("flipping", "triggered", "abilities"); matching a described mechanic to its keyword ("can
  attack the turn it arrives" is Adrenaline); finding a deck from a description of how it plays; number
  words as digits; and a floor that suits long questions. Each is its own measured experiment.
- 4.7a Word forms. Built in `src/lib/kb/text.ts` as a mode of the index: `s` (a plural "s" only, the
  default), `light` (plurals, "-ing" and "-ed" with doubled consonants and a silent "e" handled, and
  the irregular forms of verbs the game uses) and `porter` (the published Porter algorithm, checked
  against the paper's 77 worked examples). `npm run kb:eval -- --tune stem=porter` runs a variant.
  - Diagnosis: of 37 answerable `dev` misses only 8 had a word-form difference, and most of those had
    other differences too.
  - On `dev`, `porter` looked good: first five +3.2 points [0, +7.2]. On the refreshed held-out split
    it was flat: first five ±0.0 [−4.8, +4.8], MRR −0.002 [−0.043, +0.041]. Dev and rules questions
    leaned better (rules MRR +0.063 [−0.010, +0.167]); paraphrase, cross-entity and number questions
    leaned worse.
  - Decision: could not tell, so the default stays `s`. Both modes stay in the code switched off.
  - Why it probably fails here: stemming merges words this game keeps apart. "ruling" meets "rule",
    "attacker" meets "attack", and under `light` the card name "Dying" meets "die". The fresh held-out
    questions are what showed that the `dev` gain was not real.
- 4.7b The rest of the list above, each as its own experiment. Narrow retests suggested by the data so
  far, each needing fresh questions: stemming and the dense ranker for rules questions only (both leaned
  better there), and the matchup record for a question that names two decks. Since step 2.4 also: which
  everyday wordings should reach the card and package statistics ("how often is X sold", "win rate with
  X"), chosen on questions written before the cue words are.
  - Questions first (2026-11-14): q227 to q286, written from the need before any search was run. Forty
    are a new type, `stat` (a play statistic of a card or package); ten use everyday counting words but
    are answered by another kind of record (a rule, a deck, a rating, an event), so that a wider net
    for statistics can be seen to catch the wrong things; ten ask about two decks meeting.
  - Before any change the search finds almost none of the statistics questions: 1 of 24 on `dev`
    (the one that says "stats"), 0 of 16 held out. Held-out number questions fell from 62% to 47% in
    the first five, because the new two-deck questions are mostly missed.
  - Caveat: the writer's required reading (the agent skill and §6 here) said which words reach the
    statistics records today. It reports writing naturally without steering; one question says "stats".

### Step 5. Exact reuse in game tools

Stored knowledge saves almost nothing in bot play: positions do not repeat (two games of one list share
an opening hand about once in 10,000 to 30,000) and approximate reuse changes how bots play.

- 5.1 Cache coach answers by state hash, options and build: about 126 ms saved per Undo or resume.
  - Landed 2026-11-14 in `src/ui/useCoach.ts`. A position the coach already answered in this tab is
    answered from memory: 32 answers, least recently used out, never written to storage.
  - Proved before it was built: Undo re-asks a byte-identical request (40 of 40 re-asked decisions over
    3 games with 14 Undos), and so does a save restored in the same tab. Both are pinned by tests.
  - The key is the exact text of the whole request (`src/lib/exactText.ts`), not a hash, so a hit is
    provably the same request. `JSON.stringify` would not do: it drops undefined fields and merges −0
    with 0.
  - Measured in Node on 21 positions: a computed answer 73 ms (median), a remembered one 0.8 ms, making
    the key 0.4 ms. In a scripted game with 5 Undos, 10 of 35 asks came from memory.
  - Grades, records and the game are identical with the cache on and off (tested). The Play chunk grew
    by 1.25 kB.
  - Honest size of the gain: a tenth of a second per Undo on a desktop, more on a phone. Nothing else.
- 5.2 Keep each review move's raw measurements, so a change of rating rules re-rates stored reviews in
  milliseconds instead of re-simulating 5 to 8 seconds each.
  - Landed 2026-11-14. Each stored move keeps what its rating read (`ReviewMove.ms`), and each record how
    it was measured (`measure`, `rollouts`, `confirm`). `rerateRecord` in `src/lib/gameReview.ts` rates a
    stored review under the current rules in about 0.2 ms; a fresh review of the same games took 7 to
    22 s. Details are in `docs/BOT_TOOLKIT.md` §8.
  - The gain a player sees: a review of a game that can no longer be replayed (played on an older sim
    version) gets current ratings. Before, it was shown as it was, under rules that no longer applied.
  - What a re-rated review is: the same measurements judged by the new rules. It equals a fresh run when
    the same moves are confirmed. A move the new rules would confirm that never was is not invented: that
    review is run again, as before. So is one measured another way (other play-outs or oracle).
  - Cost: about 41% more bytes per stored review (median 11.8 KB to 16.3 KB; 25 reviews about 0.29 MB to
    0.41 MB of browser storage). Reviews stored earlier keep working unchanged.
  - Exactness is tested on real reviews: re-rating returns every rating and the whole record unchanged,
    and a record with older rules and corrupted ratings is restored. No Inspired move turned up in the
    cheap test games, so that one rating is covered only by the shared code path.
  - Later, if a rule change ever flags more moves for confirmation: confirm only the missing moves, and
    draw each confirmation's worlds from its own decision so that a re-rated review always equals a fresh
    one. The second changes what a fresh review measures, so it needs a measurement version bump.
- 5.3 A repeat probe (exact, public and position keys per decision) before anything larger is considered.

## 6. Reference

**Record** (`src/lib/kb/types.ts`):

```ts
interface KbRecord {
  id: string;        // '<kind>:<stable key>', see the table below
  kind: KbKind;
  title: string;     // the name people use; boosted in search
  aliases?: string[];
  text: string;      // self-contained: the first sentence says what the thing is
  fields?: Record<string, string | number | boolean | null>; // flat facts for exact answers
  links: { rel: KbRel; to: string }[];
  source: { file: string; at?: string }; // path, and a line range or JSON pointer
  origin: 'authored' | 'imported' | 'generated' | 'measured' | 'official';
  scope: 'public' | 'local';
  status?: 'draft' | 'owner';
  stamps?: { simVersion?: number; bot?: string; rulesVersion?: string | null; faqVersion?: string | null;
             listId?: string; cardDataVersion?: string; asOf?: string };
  hash: string;      // fingerprintText over id, title, aliases, text, fields, links and stamps
}
```

**Ids.**

| Kind | Id | Example |
|---|---|---|
| card | `card:<card id>` | `card:<id from cards.json>` |
| ruling | `ruling:<first 8 of the FAQ id>` | the same prefix the FAQ tests use in `faq:<prefix>` |
| faq (local) | `faq:<first 8 of the FAQ id>` | official wording, linked from its ruling |
| rule (local) | `rule:<number>` | `rule:10.28` |
| trule (local) | `trule:<number>` | tournament rules, one record per second-level entry |
| errata (local) | `errata:<slug of the entry heading>` | |
| deck | `deck:<file name without .txt>` | list fingerprint in `stamps.listId` and as an alias |
| objective | `objective:<deck file>` | |
| package | `pkg:<synergy id>` | |
| term | `term:<slug>` | signal and condition terms: `term:signal/<key>`, `term:condition/<key>` |
| guide | `guide:<slug>#<section slug>` | |
| doc | `doc:<path>#<heading slug>` | a long section adds `~2`, `~3` for later passages |
| code | `code:<path>` | the file's opening comment |
| event | `event:<id>` | `event:6`; aliases "event 6" and the event's name |
| round | `round:<event>/<n>`, `round:<event>/<bracket round slug>` | `round:6/5` |
| rating | `rating:<deck file without .txt>` | one per rated deck |
| matchup | `matchup:<deck a>~<deck b>` | the two deck keys in sorted order; 6 games or more |
| cardstat | `cardstat:<deck file without .txt>/<card id>`, `cardstat:<card id>` | a card on one list; a card pooled over lists |
| pkgstat | `pkgstat:<deck file without .txt>/<synergy id>`, `pkgstat:<synergy id>` | a package on one list; pooled |
| later | `finding:<id>` | step 2.3 |

**Link types**: `card`, `deck`, `package`, `ruling`, `rule`, `objective`, `guide`, `term`, `official`,
`test`, `parent`, `mentions`. Links are stored one way; the index adds the reverse direction when it loads.
A public record never links to a local one, so the public records are byte-identical with or without
`data/raw`; local records link outward (an official FAQ item to its ruling and card, a rule to the
glossary terms that cite it). `test` is reserved: a ruling's test file is in `fields.test`.

**Synonyms (step 4.6)**: the keyword ranker expands the question with `src/lib/kb/synonyms.ts`, a small
table from everyday and other-card-game words to this game's terms, so "tap", "graveyard" or "opponent"
find records that say spend, trash or rival. An entry is a general fact about vocabulary with a stated
reason, never a fix for one question.

**Search details settled in step 1.1**: names inside a question are looked for only among card, deck,
package, term, rule, tournament-rule and deck-note records (doc headings such as "Method" would match
ordinary words). Linked records are ordered by keyword score, then id. "No match" means no exact hit and
a best keyword hit holding under half of the question's words. Guides are split at second-level
headings, docs at levels one to four, and a deck links to the packages its list is built around.

**Kinds found only when asked for**: event, round, rating, matchup, cardstat and pkgstat records are many
and look alike, so they join the keyword and linked lists only when the question names their kind
(`KIND_CUES`, `CUE_ONLY_KINDS` in `search.ts`); named exactly they are always found. The two statistics
kinds are also left out of the keyword ranker's word counts (`STATS_FREE_KINDS`), so adding more of them
cannot move the ranking of anything else. The four older kinds are still counted: changing that would be
a ranking change, to be measured first.

**Local pack**: `.cache/kb/records.jsonl` (one record per line, sorted by id) and `.cache/kb/manifest.json`
(`kind: 'nct-kb'`, schema 1, a builder number, counts by kind and scope, a hash per input file, the rules,
FAQ and card data versions, and a build report: mentions linked, resolved by the deck's list, left
ambiguous, links dropped, inputs skipped). Every source file is an input, so an edit triggers a rebuild
on the next query; a rebuild takes about 0.6 s.

**Command line**:

```bash
npm run kb -- search "which deck wins by filling the trash"
```

```bash
npm run kb -- get "Detonate"
```

Running the script directly is about twice as fast, and it is the form to use in Windows PowerShell 5.1,
where `npm run kb -- …` drops flags such as `--event` and `--rankers` (npm takes them for its own):

```bash
node --import tsx scripts/kb.ts fact champion --event 6
```

How the bot used one card on one list, and how a synergy package did over every list that holds it:

```bash
node --import tsx scripts/kb.ts fact card "Jacked-In Voodoo Boy" --deck meta-bbg-cunningham-econ
```

```bash
node --import tsx scripts/kb.ts fact package rocker
```

Where a search spends its time (measured 2026-11-13, about 1.85 s through npm): npm itself 0.85 s, node
and tsx start-up 0.45 s, loading modules 0.2 s (0.14 s of it the tournament code behind the event
builders), hashing 419 input files 0.1 s, building the index 0.2 s, the query itself 5 ms. Loading the
builders only when the pack must be rebuilt (`scripts/kb-sources.ts`) would save about 0.14 s.

## 7. Scoreboard

Numbers over time. A row is added when a step lands or an experiment ends; old rows stay.

| Date | What was measured | Result | Source |
|---|---|---|---|
| 2026-11-13 | Authored units | 150 cards, 311 rulings, 47 decks and notes, 26 packages, 54 terms | research |
| 2026-11-13 | Whole synergy report fetched by Play | 807 KB raw, 115 KB gzip; slice 10.4 KB gzip | research |
| 2026-11-13 | `CLAUDE.md` per agent session | about 11k tokens (bytes divided by 4) | research |
| 2026-11-13 | Text on lines over 500 characters in `CLAUDE.md` and `docs/` | 52% | research |
| 2026-11-13 | What Play downloads for the coach's package wording | 11.6 KB gzip (`lift.json`), was 118.6 KB; nothing with the coach off | step 0.1 |
| 2026-11-13 | Pack, public player records | 761: card 150, ruling 311, deck 47, deck note 47, package 26, term 100, guide 80 | step 1.2 |
| 2026-11-13 | Pack, public dev records | 1,491: doc passage 1,191, code header 300 | step 1.2 |
| 2026-11-13 | Pack, local records | 1,024: official FAQ 311, rule 680, tournament rule 26, errata 7 | step 1.2 |
| 2026-11-13 | Local pack on disk | 2,925 KB in `records.jsonl`, 5,431 links, 401 input files | step 1.2 |
| 2026-11-13 | Card names in prose | 1,173 linked, 64 resolved by the deck's list, 71 left ambiguous | step 1.2 |
| 2026-11-13 | Speed | build 0.6 s; one query 0.7 to 4.9 ms in process; 0.8 s for a warm command | step 1.3 |
| 2026-11-13 | A default `kb search` answer (5 results) | about 430 to 620 tokens | step 1.3 |
| 2026-11-13 | Held-out questions, all records (40): default search | top 1: 40%, top 5: 80%, top 10: 83%, MRR 0.56 | step 1.4 |
| 2026-11-13 | Same, keyword ranking alone | top 5: 70%, MRR 0.50 | step 1.4 |
| 2026-11-13 | Held-out questions, public records (32): default search | top 5: 81%, MRR 0.64; keyword alone 69%, 0.52 | step 1.4 |
| 2026-11-13 | Top 5 by question type, all 100 questions | entity 100%, cross 93%, dev 95%, rules 60%, paraphrase 48% | step 1.4 |
| 2026-11-13 | Answer size from `kb search`, 5 results | mean 499 tokens, 90th percentile 592 | step 1.4 |
| 2026-11-13 | Pack after the competitive records | 3,530 records (2,506 public, 1,024 local), 3,344 KB, built in 0.6 s | step 2.2 |
| 2026-11-13 | Held-out questions, all records (46, with 6 number questions): default search | top 1: 43%, top 5: 80%, top 10: 85%, MRR 0.59; keyword alone 67%, 0.51 | step 2.2 |
| 2026-11-13 | Top 5 by question type, all 116 questions | entity 100%, number 100%, cross 93%, dev 90%, rules 60%, paraphrase 48% | step 2.2 |
| 2026-11-13 | Answer size from `kb fact` | champion 82 tokens, matchup 67, finishes 145, rating 301, round 495, full standings 1,027 | step 2.1 |
| 2026-11-13 | Cost of growth: the 40 earlier held-out questions after 228 records were added | top 5: −2.5 points [−7.5, 0] with all records, −6.3 [−15.6, 0] public only | step 2.2 |
| 2026-11-13 | New baseline, 146 questions. Held-out answerable (54), all records: default search | top 1: 37%, top 5: 70%, top 10: 78%, MRR 0.51; keyword alone 59%, 0.45 | step 1.6 |
| 2026-11-13 | Same baseline, top 5 by type on the held-out split | entity 100%, dev 88%, cross 83%, number 60%, rules 58%, paraphrase 50% | step 1.6 |
| 2026-11-13 | How much these figures move when a doc is edited | one paraphrase question moved in and out of the first five between two edits of this file (40% and 50% of 10) | step 1.6 |
| 2026-11-13 | Unanswerable questions refused (held-out, 5) | 1 of 5 with all records, 4 of 5 public only; answerable wrongly refused: 3 of 54 and 1 of 42 | step 1.6 |
| 2026-11-13 | Cost of adding the ratings table record | top 5 on the held-out split: −1.9 points [−5.6, 0] | step 1.6 |
| 2026-11-13 | Hybrid with embeddings, held-out answerable (54), all records | top 1: 44%, top 5: 76%, top 10: 78%, MRR 0.57 (default 37%, 70%, 78%, 0.51) | step 4.1 |
| 2026-11-13 | Embeddings alone, same questions | top 5: 54%, MRR 0.44; 18 of 54 answerable questions wrongly refused | step 4.1 |
| 2026-11-13 | Cost of embeddings | 61 s to embed 3,545 records; 5.6 MB of vectors; about 1 s more per search from a cold start; 456 MB of tools and a 34 MB model on disk | step 4.1 |
| 2026-11-13 | Baseline with 176 questions (30 fresh paraphrased ones). Held-out answerable (66), all records | top 1: 30%, top 5: 62%, top 10: 71%, MRR 0.44; 7 of 66 wrongly refused | step 4.6 |
| 2026-11-13 | Paraphrased questions, held out (22) | top 5: 36%, MRR 0.15; 5 of 22 refused. Over all 55: top 5 36%, 15 refused | step 4.6 |
| 2026-11-13 | Default search with the synonym table. Held-out answerable (66), all records | top 1: 32%, top 5: 65%, top 10: 74%, MRR 0.47; 5 of 66 wrongly refused | step 4.6 |
| 2026-11-13 | Paraphrased questions with the synonym table, held out (22) | top 5: 45%, MRR 0.23; 3 of 22 refused | step 4.6 |
| 2026-11-13 | What indexing this plan cost, once it described the synonym table in everyday words | held-out MRR 0.466 to 0.459 with all records, and a plan passage ranked first for "spell that kills an enemy creature" | rule M12 |
| 2026-11-13 | After the pack stopped indexing its own plan and code (3,440 records) | held-out answerable (66): top 5 65%, MRR 0.47; public only (54): top 5 67%, MRR 0.53 (was 0.51) | rule M12 |
| 2026-11-13 | Held-out split refreshed: 226 questions, 50 new across every type. Held-out answerable (83), all records | top 1: 34%, top 5: 65%, top 10: 72%, MRR 0.47; 5 of 83 wrongly refused; 1 of 7 unanswerable refused | step 4.7a |
| 2026-11-13 | Same baseline, top 5 by type on the held-out split | entity 100%, cross 89%, dev 82%, number 62%, rules 53%, paraphrase 44% | step 4.7a |
| 2026-11-14 | Pack after the card and package statistics | 3,988 records (2,964 public, 1,024 local): 205 card and 342 package statistics added; 5,014 KB, built in 0.7 s | step 2.4 |
| 2026-11-14 | Answer size from `kb fact card` and `kb fact package` | one card on one list 757 tokens, pooled 796 (the two report files: about 158,000); one package pooled 691, on one list 605 (the synergy report: about 202,000) | step 2.4 |
| 2026-11-14 | Cost of growth with the 547 new records counted by the keyword ranker (208 answerable questions, all records) | 26 questions changed rank; top 5: −0.5 points [−2.9, +1.9]; MRR −0.010 [−0.024, +0.004]; public paraphrase top 5: −4.8 [−11.1, 0] | step 2.4 |
| 2026-11-14 | The same with the new records scored but not counted | no question changed rank with all records; public only, one held-out question went from rank 4 to 5 (a new code header, not the statistics) | step 2.4 |
| 2026-11-14 | Re-rating a stored game review from its kept measurements | 0.18 to 0.27 ms per review; a fresh review of the same six games took 7 to 22 s | step 5.2 |
| 2026-11-14 | Bytes per stored game review with the measurements kept (six Medium-vs-Hard games) | median 11.8 KB to 16.3 KB (+41%), largest 12.4 KB to 17.0 KB; 25 at the cap about 0.29 MB to 0.41 MB | step 5.2 |
| 2026-11-14 | Coach answer for a position already answered (Node, 21 positions) | computed 73 ms (median), remembered 0.8 ms; about 28 KB of memory per remembered answer, 32 kept | step 5.1 |
| 2026-11-14 | New baseline, 286 questions (60 new: statistics, counting words, two decks). Held-out answerable (108), all records: default search | top 1: 29%, top 5: 53%, top 10: 59%, MRR 0.39; 6 of 108 wrongly refused; 1 of 7 unanswerable refused | step 4.7b |
| 2026-11-14 | Same baseline, top 5 by type on the held-out split | entity 100%, cross 90%, dev 82%, rules 50%, number 47%, paraphrase 46%, statistics 0% (of 16) | step 4.7b |

**Experiments.** Judged on the `test` split by a paired bootstrap (2,000 resamples, 95% interval).

| Date | Hypothesis | Change | `test` result | Decision |
|---|---|---|---|---|
| 2026-11-13 | A one-word term name inside a longer question takes the exact rank and pushes out the answer | Terms named inside a question only by names of two or more words | Recall at 5: −2.5 points [−7.5, 0]; MRR −0.006 [−0.019, 0] | Dropped: worse |
| 2026-11-13 | A question names the kind of record it wants ("rulings on", "decks that play") | Neighbours of the asked-for kind sort first and join the exact list | Recall at 5: +5.0 points [0, +12.5]; MRR +0.080 [+0.013, +0.160]; cross-entity MRR 0.24 to 0.78 | Kept |
| 2026-11-13 | Measured records should appear only when asked for ("who won", "rating", "round", "vs") | Names such as "event 6" are recognised; cue words for the four new kinds; measured records join the lists only when cued | Recall at 5: +8.7 points [+2.2, +17.4]; MRR +0.098 [+0.029, +0.174]; no type worse | Kept. Caveat: the cue words were chosen after a first run that showed `test` results |
| 2026-11-13 | The "no match" floor throws away real answers | Best keyword hit must hold a third of the question's words, not half | Recall at 5 and MRR: no change [0, 0]; public: unanswerable refused 4 of 5 to 1 of 5 | Dropped |
| 2026-11-13 | Neighbours of a one-word glossary term crowd out rule records | No link expansion from a term named by one word | Recall at 5: no change [0, 0]; MRR −0.000 [−0.008, +0.006] | Dropped: could not tell |
| 2026-11-13 | A question naming two decks wants their matchup | The pair's matchup record joins the exact list | Recall at 5: +3.7 points [0, +9.3]; MRR +0.012 [0, +0.031]; number questions 60% to 80%; no type worse | Not kept: the interval reaches zero. Retest with more questions |
| 2026-11-13 | Embeddings find paraphrased questions that keywords miss, and help refuse the unanswerable | A dense ranker (bge-small-en-v1.5, quantized) fused at weight 0.5, with a similarity floor of 0.75 | Recall at 5: +5.6 points [−1.8, +14.8]; MRR +0.049 [−0.008, +0.108] on the planned look, +0.055 [+0.002, +0.113] on a second; paraphrase 50% to 40%; rules MRR +0.185 [+0.046, +0.333]; refusals unchanged | Not kept in the default. Two looks; the gain is in rules, not where it was predicted |
| 2026-11-13 | Paraphrased questions miss because players use other words than the records | A 41-entry synonym table expands the question for the keyword ranker and the "no match" floor | Recall at 5: +4.5 points [0.0, +10.6]; MRR +0.027 [+0.005, +0.058]; paraphrase recall at 5 32% to 45%, MRR +0.082 [+0.018, +0.159]; other types unchanged; refusals unchanged | Kept. One look, on questions written before the table by an agent that did not know of it |
| 2026-11-13 | Word forms keep questions and records apart ("flipping" and "flip") | The Porter stemmer for the keyword ranker, in records and questions alike | Recall at 5: ±0.0 [−4.8, +4.8]; MRR −0.002 [−0.043, +0.041]; on `dev` it had been +3.2 points [0, +7.2] | Not kept: could not tell. One look, on the split refreshed with fifty blind questions |

## 8. Decisions and stopgaps

The owner decides these. Until then the stopgap in the last column applies, and it is easy to reverse.

| # | Decision | Stopgap in force |
|---|---|---|
| D1 | First user: the owner and agents, or site visitors? | Local tool first; the site waits. |
| D2 | May the 311 FAQ paraphrases be shown to visitors as per-card rulings? | In the pack, not on the site. |
| D3 | LLM-written text on the site: none, reviewed drafts, or opt-in with the visitor's key? | None. |
| D4 | May a local tool send rules or FAQ wording to a hosted model? | No. Steps 0 to 3 call no API. |
| D5 | Old sim versions: keep as history or keep only the current one? | Current only; older marked stale. |
| D6 | "Top 8": any Swiss finish in the first eight, or a real top-cut appearance? | Unchanged; see below. |
| D7 | Restructure `CLAUDE.md` into a core plus per-directory files? | Not started. |
| D8 | Who writes the question set? | An agent drafts it, marked draft; the owner edits. |
| D9 | Archived and history decks in the pack? | Not yet; the 47 library decks only. |
| D10 | A nickname table for cards ("Smasher")? | None; ambiguous mentions are counted, not guessed. |
| D11 | If a dense ranker is kept later, how are its tools carried? As a dev dependency they add about 456 MB to every install and to CI. | A side folder, `.cache/kb-dense/`, outside `package.json`. |

D6 in detail: `scripts/event-pool.ts` line 132 counts `i < 8`, even in 7-deck events that cut to four,
while the tournament index and the finish chips use the real cut, so five decks show two different counts.

## 9. Risks and guards

- **Version churn.** A sim version bump replaces every measured record. Guard: M5 stamps, the stale
  flag, and no pooling across versions.
- **Local text leaking into the site or the repo.** Guard: M6, the FAQ-wording guard test (step 0.3), and
  builders that read `data/raw` only for `local` records.
- **Determinism.** If bot code ever imported a kb module, each index rebuild would change the game-cache
  code hash and move the pins. Guard: M10 and its test (`tests/kb-guards.test.ts`).
- **The game cache covers more than code.** Its hash includes every file the game worker loads, and that
  includes the card scripts and the tables under `src/content/deckObjectives/` and
  `src/content/synergies/`. Editing any of them, even a comment, discards the cached games. The pack only
  reads these files; a step that edits them says so first.
- **Self-consistency.** Coach grades, review ratings and bot statistics all rest on the bots' own
  evaluation. "How to play a card" from that data describes what the bots do, as association.
- **Drafts read as fact.** None of the 91 deck notes or 26 packages is owner-confirmed. Guard: status is
  shown with every such record.
- **Same word, different meaning.** "Stage" has two definitions (`src/analysis/decisions.ts` and
  `src/ai/benchmark.ts`), "games" means different things in event standings, the index and ratings, and
  "review" names three things. Records name which definition they use.
- **Mixed versions after a deploy.** Files under `public/` are cached for ten minutes. Guard (step 3.1):
  hashed shard names behind one small manifest.
- **Local titles can carry official wording.** A tournament-rule title is the opening words of its text.
  That is fine in `.cache/kb/` and on screen (labelled local-only), but anything written to a tracked file
  shows a local record by its id only, as the evaluation reports do.
- **A question set written by an agent.** The same kind of author wrote the questions and the ranker's
  tuning. Guard: the `dev`/`test` split, no rewording after scoring, and the owner's edits (D8).

## 10. Log

- 2026-11-13: plan written from the research. Steps 1.1 to 1.3 started.
- 2026-11-13: steps 1.1 to 1.3 landed. `src/lib/kb/` (record model, tokenizer, BM25, name lookup, fusion,
  dossier, rendering, builders), `scripts/kb.ts` and `scripts/kb-sources.ts`, 64 tests in four files, and
  the `npm run kb` script. Verified in a clean checkout without `data/raw`: typecheck, 135 test files,
  lint, `check:data` and the build all pass. Two kinds were added for local text (`trule`, `errata`).
- 2026-11-13: step 1.4 landed. `data/kb/questions.json` (100 questions, a draft), `src/lib/kb/eval.ts`,
  `scripts/kb-eval.ts` (`npm run kb:eval`), `reports/kb-eval-latest.md` and `.json`. Two ranking
  experiments: one dropped, one kept (see §7). The evaluation also found that 121 rule records carried the
  heading of the section before them; the rules builder now gives each rule its own heading, else its
  nearest titled ancestor's, and the reports were regenerated after that fix.
- 2026-11-13: step 0.1 landed. Play reads `public/data/lift.json` (11.6 KB gzip) only while the coach is
  on, in place of the whole synergy report (118.6 KB gzip) on every board. No file the game cache hashes
  was edited. Checked in a clean checkout and in the browser.
- 2026-11-13: step 1.5 landed. `.claude/skills/kb/SKILL.md` tells an agent when and how to use
  `npm run kb`, and `CLAUDE.md` has a short "Knowledge pack (kb)" bullet whose lines a search tool can show.
- 2026-11-13: step 0.3 landed. A guard test against official wording in tracked files (FAQ, rules,
  tournament rules, errata), one quotation paraphrased, two named exceptions in hashed engine files.
  The analysis insights are worded as observations and associations, the stored sentences were re-derived
  without games, and the glossary entry and the two deck-profile table headings for "Δ when drawn" follow.
- 2026-11-13: steps 2.1 and 2.2 landed in the pack. `src/lib/eventFacts.ts` computes champions, standings
  after any round, round summaries, a deck's competitive record and matchups; `npm run kb -- fact` prints
  them; 228 event, round, rating and matchup records answer questions such as "who won event 6". Sixteen
  number questions joined the question set (116 now), and one ranking change was kept (see §7).
- 2026-11-13: step 1.6 landed. The question set is 146 with unanswerable questions and harder phrasings,
  the evaluation reports refusals, and `fact ratings` with a ratings-table record was added. Three ranking
  changes were measured and none was kept. This is the baseline the embeddings experiment starts from.
- 2026-11-13: experiment 4.1 ran. A dense ranker over bge-small-en-v1.5 vectors was built and measured.
  It lifted rules questions and did nothing for paraphrased or unanswerable ones, and its overall gain
  could not be told from zero on the planned look. The default search stays keyword-and-links; the dense
  ranker stays in the code as an opt-in for the next experiments. Its tools live outside `package.json`.
- 2026-11-13: thirty fresh paraphrased questions joined the question set (176 now; 55 paraphrased, 22 of
  them held out), written before the synonym experiment by an agent that did not know what would be
  tested. Paraphrase turned out weaker than the first 25 questions showed: 36% in the first five.
- 2026-11-13: experiment 4.6 ran and was kept. A 41-entry synonym table now expands questions for the
  keyword ranker: held-out paraphrased questions went from 32% to 45% in the first five, nothing else
  moved, and no model or dependency was needed. Step 4.7 lists what the remaining misses need.
- 2026-11-13: rule M12 added. Describing the synonym table here put words like "kill" and "graveyard"
  into this file, and its passages began to outrank real answers. The pack no longer indexes this plan
  or its own code headers; the three example questions that showed the problem now return cards and
  packages, and the held-out figures are back to where they were before the description was written.
- 2026-11-13: the held-out split was refreshed after about ten looks. Fifty questions across every type
  were written blind (226 now, 90 held out), and rule M9 now says when and how that is done.
- 2026-11-13: experiment 4.7a ran and was not kept. Folding word forms looked like a gain on the
  development questions and was flat on the refreshed held-out ones, so the tokenizer stays as it was.
  The two stemming modes remain in the code, switched off, for narrower retests.
- 2026-11-14: step 2.4 landed in the pack. `src/lib/cardFacts.ts` computes how the bot used a card and
  how a synergy package did, with the run each number rests on; `fact card` and `fact package` print
  them; 547 statistics records answer when a question asks for statistics. Adding them first moved 26
  earlier questions, so the keyword ranker now scores these records without counting their words, and
  nothing earlier moved. No file the game cache depends on was edited.
- 2026-11-14: step 5.2 landed. A stored game review keeps the measurements its ratings came from, so a
  change of rating rules rates it again in a fraction of a millisecond, also when the game can no longer
  be replayed. A measurement version keeps re-rating apart from re-measuring. Found on the way, not
  fixed: the review screen rebuilds each move's board with the current engine, so for a game played on
  an older sim version the boards shown may not match the game (true before this step as well).
- 2026-11-14: step 5.1 landed. The coach remembers its answers within a tab, so Undo and a resume show
  advice at once. It was built only after a test showed that Undo re-asks exactly the same request.
- 2026-11-14: sixty questions joined the question set (286 now, 115 held out), written blind for the
  next experiment: statistics of cards and packages, counting words that mean something else, and two
  decks meeting. The search answers almost none of the statistics questions yet, which is the point.
