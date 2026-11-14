# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable
questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no
match", which is right. Wrongly refused: answerable questions for which it said "no match".

Question set: `data/kb/questions.json` (draft), 226 questions. Types: entity 24, paraphrase 63, cross 23, number 32, dev 28, rules 38, none 18.
Scopes: public 187, local 39. Splits: dev 136, test 90. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

3440 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 125 | 14.4 | 16.0 | 16.0 | 0.152 | 62 | 127 | 8 of 11 (72.7%) | 76 of 125 (60.8%) |
| exact | test | 83 | 10.8 | 13.3 | 13.3 | 0.120 | 77 | 198 | 7 of 7 (100.0%) | 40 of 83 (48.2%) |
| exact | all | 208 | 13.0 | 14.9 | 14.9 | 0.139 | 68 | 165 | 15 of 18 (83.3%) | 116 of 208 (55.8%) |
| keyword | dev | 125 | 46.4 | 67.2 | 72.0 | 0.554 | 497 | 613 | 4 of 11 (36.4%) | 11 of 125 (8.8%) |
| keyword | test | 83 | 31.3 | 56.6 | 66.3 | 0.427 | 502 | 621 | 1 of 7 (14.3%) | 8 of 83 (9.6%) |
| keyword | all | 208 | 40.4 | 63.0 | 69.7 | 0.503 | 499 | 616 | 5 of 18 (27.8%) | 19 of 208 (9.1%) |
| exact+keyword | dev | 125 | 40.0 | 70.4 | 74.4 | 0.529 | 502 | 605 | 3 of 11 (27.3%) | 9 of 125 (7.2%) |
| exact+keyword | test | 83 | 25.3 | 61.4 | 72.3 | 0.413 | 508 | 608 | 1 of 7 (14.3%) | 5 of 83 (6.0%) |
| exact+keyword | all | 208 | 34.1 | 66.8 | 73.6 | 0.482 | 504 | 608 | 4 of 18 (22.2%) | 14 of 208 (6.7%) |
| exact+linked+keyword | dev | 125 | 46.4 | 70.4 | 76.0 | 0.571 | 500 | 600 | 3 of 11 (27.3%) | 9 of 125 (7.2%) |
| exact+linked+keyword | test | 83 | 33.7 | 65.1 | 72.3 | 0.474 | 506 | 608 | 1 of 7 (14.3%) | 5 of 83 (6.0%) |
| exact+linked+keyword | all | 208 | 41.3 | 68.3 | 74.5 | 0.533 | 502 | 608 | 4 of 18 (22.2%) | 14 of 208 (6.7%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 14 | 71.4 | 78.6 | 78.6 | 0.750 | 3 |
| exact | paraphrase | dev | 38 | 0.0 | 0.0 | 0.0 | 0.000 | 33 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | dev | 19 | 36.8 | 42.1 | 42.1 | 0.395 | 3 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | rules | dev | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | entity | test | 10 | 50.0 | 60.0 | 60.0 | 0.550 | 3 |
| exact | paraphrase | test | 25 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | cross | test | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 13 | 30.8 | 38.5 | 38.5 | 0.346 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | rules | test | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 9 |
| exact | entity | all | 24 | 62.5 | 70.8 | 70.8 | 0.667 | 6 |
| exact | paraphrase | all | 63 | 0.0 | 0.0 | 0.0 | 0.000 | 49 |
| exact | cross | all | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | all | 32 | 34.4 | 40.6 | 40.6 | 0.375 | 5 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | rules | all | 38 | 0.0 | 0.0 | 0.0 | 0.000 | 25 |
| keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 38 | 26.3 | 52.6 | 57.9 | 0.377 | 8 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.633 | 0 |
| keyword | number | dev | 19 | 47.4 | 52.6 | 57.9 | 0.508 | 1 |
| keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| keyword | rules | dev | 23 | 30.4 | 56.5 | 60.9 | 0.419 | 2 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 25 | 16.0 | 48.0 | 48.0 | 0.281 | 6 |
| keyword | cross | test | 9 | 33.3 | 33.3 | 77.8 | 0.397 | 0 |
| keyword | number | test | 13 | 30.8 | 38.5 | 53.8 | 0.343 | 0 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| keyword | rules | test | 15 | 26.7 | 53.3 | 60.0 | 0.389 | 2 |
| keyword | entity | all | 24 | 79.2 | 100.0 | 100.0 | 0.882 | 0 |
| keyword | paraphrase | all | 63 | 22.2 | 50.8 | 54.0 | 0.339 | 14 |
| keyword | cross | all | 23 | 43.5 | 60.9 | 82.6 | 0.541 | 0 |
| keyword | number | all | 32 | 40.6 | 46.9 | 56.3 | 0.441 | 1 |
| keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| keyword | rules | all | 38 | 28.9 | 55.3 | 60.5 | 0.407 | 4 |
| exact+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 38 | 21.1 | 55.3 | 60.5 | 0.356 | 7 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.442 | 0 |
| exact+keyword | number | dev | 19 | 42.1 | 68.4 | 68.4 | 0.544 | 0 |
| exact+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| exact+keyword | rules | dev | 23 | 30.4 | 56.5 | 60.9 | 0.401 | 2 |
| exact+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.758 | 0 |
| exact+keyword | paraphrase | test | 25 | 12.0 | 52.0 | 60.0 | 0.271 | 3 |
| exact+keyword | cross | test | 9 | 0.0 | 33.3 | 77.8 | 0.228 | 0 |
| exact+keyword | number | test | 13 | 30.8 | 61.5 | 69.2 | 0.451 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| exact+keyword | rules | test | 15 | 13.3 | 53.3 | 60.0 | 0.309 | 2 |
| exact+keyword | entity | all | 24 | 83.3 | 100.0 | 100.0 | 0.899 | 0 |
| exact+keyword | paraphrase | all | 63 | 17.5 | 54.0 | 60.3 | 0.322 | 10 |
| exact+keyword | cross | all | 23 | 8.7 | 60.9 | 82.6 | 0.359 | 0 |
| exact+keyword | number | all | 32 | 37.5 | 65.6 | 68.8 | 0.506 | 0 |
| exact+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| exact+keyword | rules | all | 38 | 23.7 | 55.3 | 60.5 | 0.364 | 4 |
| exact+linked+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 38 | 21.1 | 50.0 | 60.5 | 0.352 | 7 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.839 | 0 |
| exact+linked+keyword | number | dev | 19 | 42.1 | 68.4 | 68.4 | 0.553 | 0 |
| exact+linked+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| exact+linked+keyword | rules | dev | 23 | 30.4 | 52.2 | 60.9 | 0.392 | 2 |
| exact+linked+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.783 | 0 |
| exact+linked+keyword | paraphrase | test | 25 | 12.0 | 44.0 | 52.0 | 0.241 | 3 |
| exact+linked+keyword | cross | test | 9 | 66.7 | 88.9 | 100.0 | 0.796 | 0 |
| exact+linked+keyword | number | test | 13 | 38.5 | 61.5 | 69.2 | 0.489 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| exact+linked+keyword | rules | test | 15 | 13.3 | 53.3 | 60.0 | 0.304 | 2 |
| exact+linked+keyword | entity | all | 24 | 83.3 | 100.0 | 100.0 | 0.910 | 0 |
| exact+linked+keyword | paraphrase | all | 63 | 17.5 | 47.6 | 57.1 | 0.308 | 10 |
| exact+linked+keyword | cross | all | 23 | 69.6 | 95.7 | 100.0 | 0.822 | 0 |
| exact+linked+keyword | number | all | 32 | 40.6 | 65.6 | 68.8 | 0.527 | 0 |
| exact+linked+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| exact+linked+keyword | rules | all | 38 | 23.7 | 52.6 | 60.5 | 0.357 | 4 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); rule:5.12.3 |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); rule:6.1.1; guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | refused | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:cost-match (Gig value matches a cost); trule:2.1 |
| q131 | rules | – | is there a maximum number of units I can have on the field | rule:5.6.5 | term:signal/units-on-field (units-on-field); card:field_operator (Field Operator); faq:e83fc5f6 |
| q134 | rules | refused | am I allowed to look through my opponent's discard pile | rule:5.9.2 |  |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); trule:3.4; trule:D.2 |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); faq:e512816e |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~19 (Keys (part 19)); trule:E.2 |
| q127 | what time does my local game store open on saturdays | doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); trule:3.3; doc:docs/RESEARCH.md#open-questions-and-caveats (Open questions and caveats) |
| q224 | how many cards are in a hearthstone deck | rule:11.17.3; code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

## Scope: public records only (what a checkout without data/raw searches)

2416 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 39.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 101 | 16.8 | 18.8 | 18.8 | 0.178 | 65 | 123 | 8 of 11 (72.7%) | 60 of 101 (59.4%) |
| exact | test | 68 | 13.2 | 16.2 | 16.2 | 0.147 | 80 | 210 | 7 of 7 (100.0%) | 31 of 68 (45.6%) |
| exact | all | 169 | 15.4 | 17.8 | 17.8 | 0.166 | 71 | 175 | 15 of 18 (83.3%) | 91 of 169 (53.8%) |
| keyword | dev | 101 | 48.5 | 68.3 | 74.3 | 0.577 | 491 | 605 | 4 of 11 (36.4%) | 10 of 101 (9.9%) |
| keyword | test | 68 | 33.8 | 61.8 | 67.6 | 0.458 | 514 | 630 | 4 of 7 (57.1%) | 5 of 68 (7.4%) |
| keyword | all | 169 | 42.6 | 65.7 | 71.6 | 0.529 | 500 | 616 | 8 of 18 (44.4%) | 15 of 169 (8.9%) |
| exact+keyword | dev | 101 | 40.6 | 72.3 | 77.2 | 0.549 | 502 | 600 | 3 of 11 (27.3%) | 8 of 101 (7.9%) |
| exact+keyword | test | 68 | 29.4 | 64.7 | 75.0 | 0.450 | 517 | 608 | 4 of 7 (57.1%) | 3 of 68 (4.4%) |
| exact+keyword | all | 169 | 36.1 | 69.2 | 76.3 | 0.509 | 508 | 607 | 7 of 18 (38.9%) | 11 of 169 (6.5%) |
| exact+linked+keyword | dev | 101 | 48.5 | 75.2 | 79.2 | 0.606 | 500 | 599 | 3 of 11 (27.3%) | 8 of 101 (7.9%) |
| exact+linked+keyword | test | 68 | 39.7 | 67.6 | 76.5 | 0.528 | 519 | 608 | 4 of 7 (57.1%) | 3 of 68 (4.4%) |
| exact+linked+keyword | all | 169 | 45.0 | 72.2 | 78.1 | 0.574 | 508 | 607 | 7 of 18 (38.9%) | 11 of 169 (6.5%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 13 | 69.2 | 76.9 | 76.9 | 0.731 | 3 |
| exact | paraphrase | dev | 38 | 0.0 | 0.0 | 0.0 | 0.000 | 33 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | dev | 19 | 36.8 | 42.1 | 42.1 | 0.395 | 3 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | entity | test | 10 | 50.0 | 60.0 | 60.0 | 0.550 | 3 |
| exact | paraphrase | test | 25 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | cross | test | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 13 | 30.8 | 38.5 | 38.5 | 0.346 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | entity | all | 23 | 60.9 | 69.6 | 69.6 | 0.652 | 6 |
| exact | paraphrase | all | 63 | 0.0 | 0.0 | 0.0 | 0.000 | 49 |
| exact | cross | all | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | all | 32 | 34.4 | 40.6 | 40.6 | 0.375 | 5 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 38 | 26.3 | 52.6 | 57.9 | 0.385 | 9 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.634 | 0 |
| keyword | number | dev | 19 | 47.4 | 52.6 | 57.9 | 0.507 | 1 |
| keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 25 | 24.0 | 52.0 | 52.0 | 0.357 | 5 |
| keyword | cross | test | 9 | 33.3 | 55.6 | 77.8 | 0.409 | 0 |
| keyword | number | test | 13 | 23.1 | 38.5 | 46.2 | 0.303 | 0 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| keyword | entity | all | 23 | 78.3 | 100.0 | 100.0 | 0.877 | 0 |
| keyword | paraphrase | all | 63 | 25.4 | 52.4 | 55.6 | 0.374 | 14 |
| keyword | cross | all | 23 | 43.5 | 69.6 | 82.6 | 0.546 | 0 |
| keyword | number | all | 32 | 37.5 | 46.9 | 53.1 | 0.424 | 1 |
| keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 38 | 21.1 | 55.3 | 60.5 | 0.361 | 8 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.443 | 0 |
| exact+keyword | number | dev | 19 | 42.1 | 68.4 | 68.4 | 0.544 | 0 |
| exact+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.758 | 0 |
| exact+keyword | paraphrase | test | 25 | 16.0 | 52.0 | 60.0 | 0.301 | 3 |
| exact+keyword | cross | test | 9 | 0.0 | 44.4 | 77.8 | 0.238 | 0 |
| exact+keyword | number | test | 13 | 30.8 | 61.5 | 69.2 | 0.457 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+keyword | entity | all | 23 | 82.6 | 100.0 | 100.0 | 0.895 | 0 |
| exact+keyword | paraphrase | all | 63 | 19.0 | 54.0 | 60.3 | 0.337 | 11 |
| exact+keyword | cross | all | 23 | 8.7 | 65.2 | 82.6 | 0.363 | 0 |
| exact+keyword | number | all | 32 | 37.5 | 65.6 | 68.8 | 0.509 | 0 |
| exact+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+linked+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 38 | 21.1 | 55.3 | 60.5 | 0.361 | 8 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.839 | 0 |
| exact+linked+keyword | number | dev | 19 | 42.1 | 68.4 | 68.4 | 0.553 | 0 |
| exact+linked+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+linked+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.783 | 0 |
| exact+linked+keyword | paraphrase | test | 25 | 16.0 | 44.0 | 56.0 | 0.285 | 3 |
| exact+linked+keyword | cross | test | 9 | 66.7 | 88.9 | 100.0 | 0.796 | 0 |
| exact+linked+keyword | number | test | 13 | 38.5 | 61.5 | 69.2 | 0.489 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+linked+keyword | entity | all | 23 | 82.6 | 100.0 | 100.0 | 0.906 | 0 |
| exact+linked+keyword | paraphrase | all | 63 | 19.0 | 50.8 | 58.7 | 0.331 | 11 |
| exact+linked+keyword | cross | all | 23 | 69.6 | 95.7 | 100.0 | 0.822 | 0 |
| exact+linked+keyword | number | all | 32 | 40.6 | 65.6 | 68.8 | 0.527 | 0 |
| exact+linked+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q043 | paraphrase | refused | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q142 | number | – | does yyb rogue gear beat rry smasher aggro | matchup:meta-rry-smasher-aggro~meta-yyb-rogue-gear | deck:meta-yyb-rogue-gear (YYB Rogue Gear); deck:meta-rry-smasher-aggro (RRY Smasher Aggro); guide:yyb-rogue-gear#intro (YYB Rogue Gear) |
| q143 | number | – | how good is rrb wakako midrange | rating:meta-rrb-wakako-midrange | deck:meta-rrb-wakako-midrange (RRB Wakako Midrange); guide:rrb-wakako-midrange#playing-against-it (RRB Wakako Midrange: Playing against it); guide:rrb-wakako-midrange#intro (RRB Wakako Midrange) |
| q145 | number | – | how well does rainbow fixer stuff fare against the smasher river viktor ladder deck | matchup:ladder-ryy-smasher-river-viktor~meta-rainbow-fixer-stuff | deck:meta-rainbow-fixer-stuff (Rainbow Fixer Stuff); guide:rainbow-fixer-stuff#intro (Rainbow Fixer Stuff); guide:rainbow-fixer-stuff#playing-against-it (Rainbow Fixer Stuff: Playing against it) |
| q147 | paraphrase | refused | is there a program that makes both players dump their whole hand and draw five new cards | card:shattered_memories |  |
| q151 | paraphrase | refused | how does the list that pays for things with its legends and then sends those same legends in as surprise attackers want to win | objective:nc-08-merc-contract-rrg |  |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)); doc:docs/SYNERGIES.md#deck-lab-lab~3 (Deck Lab (#/lab) (part 3)) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); pkg:rocker (Rocker Units (Johnny Silverhand)) |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~19 (Keys (part 19)); doc:docs/SITE_CONFIG.md#keys~18 (Keys (part 18)) |
| q127 | what time does my local game store open on saturdays | doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); doc:docs/RESEARCH.md#open-questions-and-caveats (Open questions and caveats); doc:CLAUDE.md#knowledge-pack-kb~3 (Knowledge pack (kb) (part 3)) |
| q224 | how many cards are in a hearthstone deck | code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/SYNERGIES.md#deck-lab-lab~3 (Deck Lab (#/lab) (part 3)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

