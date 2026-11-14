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

3556 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 98 | 15.3 | 17.3 | 17.3 | 0.163 | 62 | 123 | 5 of 7 (71.4%) | 58 of 98 (59.2%) |
| exact | test | 66 | 10.6 | 12.1 | 12.1 | 0.114 | 79 | 198 | 5 of 5 (100.0%) | 31 of 66 (47.0%) |
| exact | all | 164 | 13.4 | 15.2 | 15.2 | 0.143 | 69 | 160 | 10 of 12 (83.3%) | 89 of 164 (54.3%) |
| keyword | dev | 98 | 46.9 | 64.3 | 70.4 | 0.539 | 471 | 605 | 4 of 7 (57.1%) | 13 of 98 (13.3%) |
| keyword | test | 66 | 28.8 | 54.5 | 63.6 | 0.399 | 466 | 621 | 1 of 5 (20.0%) | 11 of 66 (16.7%) |
| keyword | all | 164 | 39.6 | 60.4 | 67.7 | 0.483 | 469 | 609 | 5 of 12 (41.7%) | 24 of 164 (14.6%) |
| exact+keyword | dev | 98 | 39.8 | 65.3 | 72.4 | 0.508 | 473 | 600 | 3 of 7 (42.9%) | 12 of 98 (12.2%) |
| exact+keyword | test | 66 | 22.7 | 60.6 | 69.7 | 0.381 | 482 | 606 | 1 of 5 (20.0%) | 7 of 66 (10.6%) |
| exact+keyword | all | 164 | 32.9 | 63.4 | 71.3 | 0.457 | 476 | 600 | 4 of 12 (33.3%) | 19 of 164 (11.6%) |
| exact+linked+keyword | dev | 98 | 46.9 | 65.3 | 73.5 | 0.551 | 469 | 595 | 3 of 7 (42.9%) | 12 of 98 (12.2%) |
| exact+linked+keyword | test | 66 | 30.3 | 62.1 | 71.2 | 0.439 | 483 | 606 | 1 of 5 (20.0%) | 7 of 66 (10.6%) |
| exact+linked+keyword | all | 164 | 40.2 | 64.0 | 72.6 | 0.506 | 475 | 600 | 4 of 12 (33.3%) | 19 of 164 (11.6%) |

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
| keyword | paraphrase | dev | 33 | 24.2 | 42.4 | 48.5 | 0.318 | 10 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.651 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 64.3 | 0.607 | 1 |
| keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| keyword | rules | dev | 18 | 27.8 | 55.6 | 66.7 | 0.374 | 2 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 22 | 9.1 | 36.4 | 36.4 | 0.185 | 9 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.378 | 0 |
| keyword | number | test | 10 | 30.0 | 40.0 | 60.0 | 0.346 | 0 |
| keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| keyword | rules | test | 12 | 25.0 | 58.3 | 66.7 | 0.403 | 2 |
| keyword | entity | all | 20 | 80.0 | 100.0 | 100.0 | 0.892 | 0 |
| keyword | paraphrase | all | 55 | 18.2 | 40.0 | 43.6 | 0.265 | 19 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.542 | 0 |
| keyword | number | all | 24 | 45.8 | 54.2 | 62.5 | 0.498 | 1 |
| keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 | 0 |
| keyword | rules | all | 30 | 26.7 | 56.7 | 66.7 | 0.386 | 4 |
| exact+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 33 | 18.2 | 42.4 | 48.5 | 0.285 | 10 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.429 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| exact+keyword | rules | dev | 18 | 27.8 | 50.0 | 66.7 | 0.360 | 2 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 22 | 4.5 | 45.5 | 50.0 | 0.170 | 5 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.211 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.436 | 0 |
| exact+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| exact+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.303 | 2 |
| exact+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.912 | 0 |
| exact+keyword | paraphrase | all | 55 | 12.7 | 43.6 | 49.1 | 0.239 | 15 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.342 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.550 | 0 |
| exact+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 | 0 |
| exact+keyword | rules | all | 30 | 20.0 | 53.3 | 66.7 | 0.337 | 4 |
| exact+linked+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 33 | 18.2 | 36.4 | 48.5 | 0.280 | 10 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| exact+linked+keyword | rules | dev | 18 | 27.8 | 50.0 | 66.7 | 0.352 | 2 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 22 | 4.5 | 36.4 | 45.5 | 0.148 | 5 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| exact+linked+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.297 | 2 |
| exact+linked+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.925 | 0 |
| exact+linked+keyword | paraphrase | all | 55 | 12.7 | 36.4 | 47.3 | 0.227 | 15 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 | 0 |
| exact+linked+keyword | number | all | 24 | 50.0 | 70.8 | 75.0 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 | 0 |
| exact+linked+keyword | rules | all | 30 | 20.0 | 53.3 | 66.7 | 0.330 | 4 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); doc:CLAUDE.md#play-ui~3 (Play UI (part 3)) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)) |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | – | which package pays off for flipping my legends early | pkg:legends-up | doc:docs/TUNING_STUDY_2026-11-13.md#what-would-make-them-effective-ranked-by-expected-benefit-for-cost~9 (What would make them effective (ranked by expected benefit for cost) (part 9)); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~29 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 29)); rule:11.11.1 |
| q041 | paraphrase | refused | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics |  |
| q045 | paraphrase | refused | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); rule:6.1.1; guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | refused | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:cost-match (Gig value matches a cost); trule:2.1 |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); faq:e512816e |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~19 (Keys (part 19)); trule:E.2 |

## Scope: public records only (what a checkout without data/raw searches)

2532 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 31.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 79 | 17.7 | 20.3 | 20.3 | 0.190 | 65 | 120 | 5 of 7 (71.4%) | 46 of 79 (58.2%) |
| exact | test | 54 | 13.0 | 14.8 | 14.8 | 0.139 | 81 | 183 | 5 of 5 (100.0%) | 24 of 54 (44.4%) |
| exact | all | 133 | 15.8 | 18.0 | 18.0 | 0.169 | 71 | 134 | 10 of 12 (83.3%) | 70 of 133 (52.6%) |
| keyword | dev | 79 | 49.4 | 65.8 | 70.9 | 0.566 | 464 | 605 | 4 of 7 (57.1%) | 12 of 79 (15.2%) |
| keyword | test | 54 | 27.8 | 53.7 | 63.0 | 0.402 | 475 | 621 | 4 of 5 (80.0%) | 8 of 54 (14.8%) |
| keyword | all | 133 | 40.6 | 60.9 | 67.7 | 0.500 | 468 | 610 | 8 of 12 (66.7%) | 20 of 133 (15.0%) |
| exact+keyword | dev | 79 | 40.5 | 68.4 | 72.2 | 0.529 | 469 | 600 | 3 of 7 (42.9%) | 11 of 79 (13.9%) |
| exact+keyword | test | 54 | 25.9 | 59.3 | 70.4 | 0.403 | 490 | 609 | 4 of 5 (80.0%) | 5 of 54 (9.3%) |
| exact+keyword | all | 133 | 34.6 | 64.7 | 71.4 | 0.478 | 478 | 605 | 7 of 12 (58.3%) | 16 of 133 (12.0%) |
| exact+linked+keyword | dev | 79 | 49.4 | 70.9 | 73.4 | 0.586 | 467 | 595 | 3 of 7 (42.9%) | 11 of 79 (13.9%) |
| exact+linked+keyword | test | 54 | 35.2 | 61.1 | 74.1 | 0.478 | 495 | 609 | 4 of 5 (80.0%) | 5 of 54 (9.3%) |
| exact+linked+keyword | all | 133 | 43.6 | 66.9 | 73.7 | 0.542 | 478 | 605 | 7 of 12 (58.3%) | 16 of 133 (12.0%) |

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
| keyword | paraphrase | dev | 33 | 24.2 | 42.4 | 45.5 | 0.319 | 11 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.653 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 71.4 | 0.616 | 1 |
| keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 22 | 13.6 | 36.4 | 40.9 | 0.239 | 8 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.380 | 0 |
| keyword | number | test | 10 | 20.0 | 40.0 | 50.0 | 0.294 | 0 |
| keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| keyword | entity | all | 19 | 78.9 | 100.0 | 100.0 | 0.886 | 0 |
| keyword | paraphrase | all | 55 | 20.0 | 40.0 | 43.6 | 0.287 | 19 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.544 | 0 |
| keyword | number | all | 24 | 41.7 | 54.2 | 62.5 | 0.482 | 1 |
| keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 | 0 |
| exact+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 33 | 18.2 | 42.4 | 45.5 | 0.284 | 11 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.431 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 22 | 9.1 | 40.9 | 50.0 | 0.199 | 5 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.213 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.444 | 0 |
| exact+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| exact+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.908 | 0 |
| exact+keyword | paraphrase | all | 55 | 14.5 | 41.8 | 47.3 | 0.250 | 16 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.344 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.553 | 0 |
| exact+keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 | 0 |
| exact+linked+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 33 | 18.2 | 42.4 | 45.5 | 0.284 | 11 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 22 | 9.1 | 31.8 | 50.0 | 0.187 | 5 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| exact+linked+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.921 | 0 |
| exact+linked+keyword | paraphrase | all | 55 | 14.5 | 38.2 | 47.3 | 0.245 | 16 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 | 0 |
| exact+linked+keyword | number | all | 24 | 50.0 | 70.8 | 75.0 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); doc:CLAUDE.md#play-ui~3 (Play UI (part 3)) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)) |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | refused | which package pays off for flipping my legends early | pkg:legends-up |  |
| q041 | paraphrase | – | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics | objective:RBY-samurai (Samurai game plan); card:sasha_yakovleva_won_t_let_you_down (Sasha Yakovleva: Won't Let You Down); objective:ladder-rrb-dexter-v-wakako (Ladder: Dexter / V / Wakako (RRB) game plan) |
| q043 | paraphrase | refused | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | refused | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q142 | number | – | does yyb rogue gear beat rry smasher aggro | matchup:meta-rry-smasher-aggro~meta-yyb-rogue-gear | deck:meta-yyb-rogue-gear (YYB Rogue Gear); deck:meta-rry-smasher-aggro (RRY Smasher Aggro); guide:yyb-rogue-gear#intro (YYB Rogue Gear) |
| q143 | number | – | how good is rrb wakako midrange | rating:meta-rrb-wakako-midrange | deck:meta-rrb-wakako-midrange (RRB Wakako Midrange); guide:rrb-wakako-midrange#playing-against-it (RRB Wakako Midrange: Playing against it); guide:rrb-wakako-midrange#intro (RRB Wakako Midrange) |
| q145 | number | – | how well does rainbow fixer stuff fare against the smasher river viktor ladder deck | matchup:ladder-ryy-smasher-river-viktor~meta-rainbow-fixer-stuff | deck:meta-rainbow-fixer-stuff (Rainbow Fixer Stuff); guide:rainbow-fixer-stuff#intro (Rainbow Fixer Stuff); guide:rainbow-fixer-stuff#playing-against-it (Rainbow Fixer Stuff: Playing against it) |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); pkg:rocker (Rocker Units (Johnny Silverhand)) |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~19 (Keys (part 19)); doc:docs/SITE_CONFIG.md#keys~18 (Keys (part 18)) |

