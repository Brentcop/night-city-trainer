# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable
questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no
match", which is right. Wrongly refused: answerable questions for which it said "no match".

Question set: `data/kb/questions.json` (draft), 176 questions. Types: entity 20, paraphrase 55, cross 15, number 24, dev 20, rules 30, none 12.
Scopes: public 145, local 31. Splits: dev 105, test 71. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

3440 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 98 | 15.3 | 17.3 | 17.3 | 0.163 | 62 | 123 | 5 of 7 (71.4%) | 58 of 98 (59.2%) |
| exact | test | 66 | 10.6 | 12.1 | 12.1 | 0.114 | 79 | 198 | 5 of 5 (100.0%) | 31 of 66 (47.0%) |
| exact | all | 164 | 13.4 | 15.2 | 15.2 | 0.143 | 69 | 160 | 10 of 12 (83.3%) | 89 of 164 (54.3%) |
| keyword | dev | 98 | 46.9 | 68.4 | 73.5 | 0.561 | 494 | 611 | 2 of 7 (28.6%) | 9 of 98 (9.2%) |
| keyword | test | 66 | 30.3 | 59.1 | 68.2 | 0.429 | 489 | 621 | 1 of 5 (20.0%) | 8 of 66 (12.1%) |
| keyword | all | 164 | 40.2 | 64.6 | 71.3 | 0.508 | 492 | 612 | 3 of 12 (25.0%) | 17 of 164 (10.4%) |
| exact+keyword | dev | 98 | 39.8 | 70.4 | 75.5 | 0.528 | 495 | 600 | 1 of 7 (14.3%) | 8 of 98 (8.2%) |
| exact+keyword | test | 66 | 24.2 | 63.6 | 74.2 | 0.411 | 499 | 608 | 1 of 5 (20.0%) | 5 of 66 (7.6%) |
| exact+keyword | all | 164 | 33.5 | 67.7 | 75.0 | 0.481 | 497 | 606 | 2 of 12 (16.7%) | 13 of 164 (7.9%) |
| exact+linked+keyword | dev | 98 | 46.9 | 69.4 | 76.5 | 0.570 | 493 | 600 | 1 of 7 (14.3%) | 8 of 98 (8.2%) |
| exact+linked+keyword | test | 66 | 31.8 | 65.2 | 74.2 | 0.466 | 498 | 608 | 1 of 5 (20.0%) | 5 of 66 (7.6%) |
| exact+linked+keyword | all | 164 | 40.9 | 67.7 | 75.6 | 0.528 | 495 | 606 | 2 of 12 (16.7%) | 13 of 164 (7.9%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 12 | 66.7 | 75.0 | 75.0 | 0.708 | 3 |
| exact | paraphrase | dev | 33 | 0.0 | 0.0 | 0.0 | 0.000 | 29 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | dev | 14 | 42.9 | 50.0 | 50.0 | 0.464 | 1 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 | 11 |
| exact | rules | dev | 18 | 0.0 | 0.0 | 0.0 | 0.000 | 12 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 | 2 |
| exact | paraphrase | test | 22 | 0.0 | 0.0 | 0.0 | 0.000 | 13 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 10 | 30.0 | 30.0 | 30.0 | 0.300 | 2 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | rules | test | 12 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | entity | all | 20 | 60.0 | 70.0 | 70.0 | 0.650 | 5 |
| exact | paraphrase | all | 55 | 0.0 | 0.0 | 0.0 | 0.000 | 42 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | all | 24 | 37.5 | 41.7 | 41.7 | 0.396 | 3 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 | 18 |
| exact | rules | all | 30 | 0.0 | 0.0 | 0.0 | 0.000 | 19 |
| keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 33 | 27.3 | 54.5 | 60.6 | 0.389 | 6 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.651 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 64.3 | 0.607 | 1 |
| keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.759 | 0 |
| keyword | rules | dev | 18 | 22.2 | 55.6 | 61.1 | 0.369 | 2 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 22 | 13.6 | 50.0 | 50.0 | 0.274 | 6 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.378 | 0 |
| keyword | number | test | 10 | 30.0 | 40.0 | 60.0 | 0.346 | 0 |
| keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.734 | 0 |
| keyword | rules | test | 12 | 25.0 | 58.3 | 66.7 | 0.403 | 2 |
| keyword | entity | all | 20 | 80.0 | 100.0 | 100.0 | 0.892 | 0 |
| keyword | paraphrase | all | 55 | 21.8 | 52.7 | 56.4 | 0.343 | 12 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.542 | 0 |
| keyword | number | all | 24 | 45.8 | 54.2 | 62.5 | 0.498 | 1 |
| keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.749 | 0 |
| keyword | rules | all | 30 | 23.3 | 56.7 | 63.3 | 0.382 | 4 |
| exact+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 33 | 21.2 | 54.5 | 60.6 | 0.354 | 6 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.429 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.759 | 0 |
| exact+keyword | rules | dev | 18 | 22.2 | 55.6 | 61.1 | 0.345 | 2 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 22 | 9.1 | 54.5 | 63.6 | 0.262 | 3 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.211 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.436 | 0 |
| exact+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.734 | 0 |
| exact+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.303 | 2 |
| exact+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.912 | 0 |
| exact+keyword | paraphrase | all | 55 | 16.4 | 54.5 | 61.8 | 0.317 | 9 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.342 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.550 | 0 |
| exact+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.749 | 0 |
| exact+keyword | rules | all | 30 | 16.7 | 56.7 | 63.3 | 0.328 | 4 |
| exact+linked+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 33 | 21.2 | 48.5 | 60.6 | 0.350 | 6 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.759 | 0 |
| exact+linked+keyword | rules | dev | 18 | 22.2 | 50.0 | 61.1 | 0.334 | 2 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 22 | 9.1 | 45.5 | 54.5 | 0.229 | 3 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.734 | 0 |
| exact+linked+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.297 | 2 |
| exact+linked+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.925 | 0 |
| exact+linked+keyword | paraphrase | all | 55 | 16.4 | 47.3 | 58.2 | 0.301 | 9 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 | 0 |
| exact+linked+keyword | number | all | 24 | 50.0 | 70.8 | 75.0 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.749 | 0 |
| exact+linked+keyword | rules | all | 30 | 16.7 | 53.3 | 63.3 | 0.319 | 4 |

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

## Scope: public records only (what a checkout without data/raw searches)

2416 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 31.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 79 | 17.7 | 20.3 | 20.3 | 0.190 | 65 | 120 | 5 of 7 (71.4%) | 46 of 79 (58.2%) |
| exact | test | 54 | 13.0 | 14.8 | 14.8 | 0.139 | 81 | 183 | 5 of 5 (100.0%) | 24 of 54 (44.4%) |
| exact | all | 133 | 15.8 | 18.0 | 18.0 | 0.169 | 71 | 134 | 10 of 12 (83.3%) | 70 of 133 (52.6%) |
| keyword | dev | 79 | 50.6 | 70.9 | 77.2 | 0.599 | 491 | 607 | 2 of 7 (28.6%) | 8 of 79 (10.1%) |
| keyword | test | 54 | 33.3 | 61.1 | 68.5 | 0.461 | 504 | 626 | 4 of 5 (80.0%) | 5 of 54 (9.3%) |
| keyword | all | 133 | 43.6 | 66.9 | 73.7 | 0.543 | 496 | 612 | 6 of 12 (50.0%) | 13 of 133 (9.8%) |
| exact+keyword | dev | 79 | 41.8 | 73.4 | 78.5 | 0.561 | 497 | 605 | 1 of 7 (14.3%) | 7 of 79 (8.9%) |
| exact+keyword | test | 54 | 29.6 | 64.8 | 75.9 | 0.452 | 509 | 608 | 4 of 5 (80.0%) | 3 of 54 (5.6%) |
| exact+keyword | all | 133 | 36.8 | 69.9 | 77.4 | 0.517 | 502 | 606 | 5 of 12 (41.7%) | 10 of 133 (7.5%) |
| exact+linked+keyword | dev | 79 | 50.6 | 75.9 | 79.7 | 0.618 | 495 | 605 | 1 of 7 (14.3%) | 7 of 79 (8.9%) |
| exact+linked+keyword | test | 54 | 38.9 | 66.7 | 77.8 | 0.525 | 513 | 608 | 4 of 5 (80.0%) | 3 of 54 (5.6%) |
| exact+linked+keyword | all | 133 | 45.9 | 72.2 | 78.9 | 0.580 | 502 | 606 | 5 of 12 (41.7%) | 10 of 133 (7.5%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 11 | 63.6 | 72.7 | 72.7 | 0.682 | 3 |
| exact | paraphrase | dev | 33 | 0.0 | 0.0 | 0.0 | 0.000 | 29 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | dev | 14 | 42.9 | 50.0 | 50.0 | 0.464 | 1 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 | 11 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 | 2 |
| exact | paraphrase | test | 22 | 0.0 | 0.0 | 0.0 | 0.000 | 13 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 10 | 30.0 | 30.0 | 30.0 | 0.300 | 2 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | entity | all | 19 | 57.9 | 68.4 | 68.4 | 0.632 | 5 |
| exact | paraphrase | all | 55 | 0.0 | 0.0 | 0.0 | 0.000 | 42 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | all | 24 | 37.5 | 41.7 | 41.7 | 0.396 | 3 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 | 18 |
| keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 33 | 27.3 | 54.5 | 60.6 | 0.398 | 7 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.653 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 71.4 | 0.616 | 1 |
| keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 22 | 22.7 | 54.5 | 54.5 | 0.360 | 5 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.380 | 0 |
| keyword | number | test | 10 | 20.0 | 40.0 | 50.0 | 0.294 | 0 |
| keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.740 | 0 |
| keyword | entity | all | 19 | 78.9 | 100.0 | 100.0 | 0.886 | 0 |
| keyword | paraphrase | all | 55 | 25.5 | 54.5 | 58.2 | 0.383 | 12 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.544 | 0 |
| keyword | number | all | 24 | 41.7 | 54.2 | 62.5 | 0.482 | 1 |
| keyword | dev | all | 20 | 60.0 | 90.0 | 100.0 | 0.731 | 0 |
| exact+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 33 | 21.2 | 54.5 | 60.6 | 0.360 | 7 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.431 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 22 | 13.6 | 54.5 | 63.6 | 0.297 | 3 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.213 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.444 | 0 |
| exact+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.740 | 0 |
| exact+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.908 | 0 |
| exact+keyword | paraphrase | all | 55 | 18.2 | 54.5 | 61.8 | 0.335 | 10 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.344 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.553 | 0 |
| exact+keyword | dev | all | 20 | 60.0 | 90.0 | 100.0 | 0.731 | 0 |
| exact+linked+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 33 | 21.2 | 54.5 | 60.6 | 0.360 | 7 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 22 | 13.6 | 45.5 | 59.1 | 0.279 | 3 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.740 | 0 |
| exact+linked+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.921 | 0 |
| exact+linked+keyword | paraphrase | all | 55 | 18.2 | 50.9 | 60.0 | 0.327 | 10 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 | 0 |
| exact+linked+keyword | number | all | 24 | 50.0 | 70.8 | 75.0 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 20 | 60.0 | 90.0 | 100.0 | 0.731 | 0 |

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

