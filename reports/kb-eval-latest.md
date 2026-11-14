# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable
questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no
match", which is right. Wrongly refused: answerable questions for which it said "no match".

Question set: `data/kb/questions.json` (draft), 146 questions. Types: entity 20, paraphrase 25, cross 15, number 24, dev 20, rules 30, none 12.
Scopes: public 115, local 31. Splits: dev 87, test 59. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

3553 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 80 | 18.8 | 21.3 | 21.3 | 0.200 | 69 | 132 | 5 of 7 (71.4%) | 42 of 80 (52.5%) |
| exact | test | 54 | 13.0 | 14.8 | 14.8 | 0.139 | 82 | 210 | 5 of 5 (100.0%) | 24 of 54 (44.4%) |
| exact | all | 134 | 16.4 | 18.7 | 18.7 | 0.175 | 74 | 169 | 10 of 12 (83.3%) | 66 of 134 (49.3%) |
| keyword | dev | 80 | 52.5 | 71.3 | 77.5 | 0.602 | 495 | 600 | 4 of 7 (57.1%) | 6 of 80 (7.5%) |
| keyword | test | 54 | 33.3 | 59.3 | 70.4 | 0.445 | 490 | 612 | 1 of 5 (20.0%) | 6 of 54 (11.1%) |
| keyword | all | 134 | 44.8 | 66.4 | 74.6 | 0.539 | 493 | 605 | 5 of 12 (41.7%) | 12 of 134 (9.0%) |
| exact+keyword | dev | 80 | 45.0 | 72.5 | 80.0 | 0.571 | 499 | 591 | 3 of 7 (42.9%) | 5 of 80 (6.3%) |
| exact+keyword | test | 54 | 27.8 | 64.8 | 75.9 | 0.435 | 508 | 612 | 1 of 5 (20.0%) | 3 of 54 (5.6%) |
| exact+keyword | all | 134 | 38.1 | 69.4 | 78.4 | 0.516 | 503 | 600 | 4 of 12 (33.3%) | 8 of 134 (6.0%) |
| exact+linked+keyword | dev | 80 | 53.8 | 73.8 | 81.3 | 0.626 | 496 | 591 | 3 of 7 (42.9%) | 5 of 80 (6.3%) |
| exact+linked+keyword | test | 54 | 37.0 | 70.4 | 77.8 | 0.512 | 513 | 612 | 1 of 5 (20.0%) | 3 of 54 (5.6%) |
| exact+linked+keyword | all | 134 | 47.0 | 72.4 | 79.9 | 0.580 | 503 | 598 | 4 of 12 (33.3%) | 8 of 134 (6.0%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 12 | 66.7 | 75.0 | 75.0 | 0.708 | 3 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 13 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | dev | 14 | 42.9 | 50.0 | 50.0 | 0.464 | 1 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 | 11 |
| exact | rules | dev | 18 | 0.0 | 0.0 | 0.0 | 0.000 | 12 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 | 2 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 | 6 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 10 | 30.0 | 30.0 | 30.0 | 0.300 | 2 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | rules | test | 12 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | entity | all | 20 | 60.0 | 70.0 | 70.0 | 0.650 | 5 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 | 19 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | all | 24 | 37.5 | 41.7 | 41.7 | 0.396 | 3 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 | 18 |
| exact | rules | all | 30 | 0.0 | 0.0 | 0.0 | 0.000 | 19 |
| keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 60.0 | 0.393 | 3 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.651 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 64.3 | 0.607 | 1 |
| keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| keyword | rules | dev | 18 | 27.8 | 55.6 | 66.7 | 0.374 | 2 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 10 | 10.0 | 40.0 | 40.0 | 0.173 | 4 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.378 | 0 |
| keyword | number | test | 10 | 30.0 | 40.0 | 60.0 | 0.346 | 0 |
| keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| keyword | rules | test | 12 | 25.0 | 58.3 | 66.7 | 0.403 | 2 |
| keyword | entity | all | 20 | 80.0 | 100.0 | 100.0 | 0.892 | 0 |
| keyword | paraphrase | all | 25 | 20.0 | 48.0 | 52.0 | 0.305 | 7 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.542 | 0 |
| keyword | number | all | 24 | 45.8 | 54.2 | 62.5 | 0.498 | 1 |
| keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 | 0 |
| keyword | rules | all | 30 | 26.7 | 56.7 | 66.7 | 0.386 | 4 |
| exact+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 60.0 | 0.356 | 3 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.429 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| exact+keyword | rules | dev | 18 | 27.8 | 50.0 | 66.7 | 0.360 | 2 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 60.0 | 0.208 | 1 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.211 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.436 | 0 |
| exact+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| exact+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.303 | 2 |
| exact+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.912 | 0 |
| exact+keyword | paraphrase | all | 25 | 16.0 | 52.0 | 60.0 | 0.297 | 4 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.342 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.550 | 0 |
| exact+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 | 0 |
| exact+keyword | rules | all | 30 | 20.0 | 53.3 | 66.7 | 0.337 | 4 |
| exact+linked+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 46.7 | 60.0 | 0.351 | 3 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 | 0 |
| exact+linked+keyword | rules | dev | 18 | 27.8 | 50.0 | 66.7 | 0.352 | 2 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 50.0 | 0.193 | 1 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 | 0 |
| exact+linked+keyword | rules | test | 12 | 8.3 | 58.3 | 66.7 | 0.297 | 2 |
| exact+linked+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.925 | 0 |
| exact+linked+keyword | paraphrase | all | 25 | 16.0 | 48.0 | 56.0 | 0.288 | 4 |
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

2529 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 31.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 61 | 23.0 | 26.2 | 26.2 | 0.246 | 74 | 123 | 5 of 7 (71.4%) | 30 of 61 (49.2%) |
| exact | test | 42 | 16.7 | 19.0 | 19.0 | 0.179 | 86 | 210 | 5 of 5 (100.0%) | 17 of 42 (40.5%) |
| exact | all | 103 | 20.4 | 23.3 | 23.3 | 0.218 | 79 | 183 | 10 of 12 (83.3%) | 47 of 103 (45.6%) |
| keyword | dev | 61 | 57.4 | 75.4 | 80.3 | 0.656 | 494 | 593 | 4 of 7 (57.1%) | 5 of 61 (8.2%) |
| keyword | test | 42 | 33.3 | 57.1 | 69.0 | 0.452 | 495 | 612 | 4 of 5 (80.0%) | 4 of 42 (9.5%) |
| keyword | all | 103 | 47.6 | 68.0 | 75.7 | 0.573 | 494 | 605 | 8 of 12 (66.7%) | 9 of 103 (8.7%) |
| exact+keyword | dev | 61 | 47.5 | 78.7 | 82.0 | 0.617 | 502 | 593 | 3 of 7 (42.9%) | 4 of 61 (6.6%) |
| exact+keyword | test | 42 | 33.3 | 64.3 | 78.6 | 0.484 | 526 | 612 | 4 of 5 (80.0%) | 1 of 42 (2.4%) |
| exact+keyword | all | 103 | 41.7 | 72.8 | 80.6 | 0.563 | 512 | 605 | 7 of 12 (58.3%) | 5 of 103 (4.9%) |
| exact+linked+keyword | dev | 61 | 59.0 | 82.0 | 83.6 | 0.692 | 499 | 591 | 3 of 7 (42.9%) | 4 of 61 (6.6%) |
| exact+linked+keyword | test | 42 | 45.2 | 71.4 | 83.3 | 0.587 | 536 | 612 | 4 of 5 (80.0%) | 1 of 42 (2.4%) |
| exact+linked+keyword | all | 103 | 53.4 | 77.7 | 83.5 | 0.649 | 514 | 605 | 7 of 12 (58.3%) | 5 of 103 (4.9%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 11 | 63.6 | 72.7 | 72.7 | 0.682 | 3 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 13 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | dev | 14 | 42.9 | 50.0 | 50.0 | 0.464 | 1 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 | 11 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 | 2 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 | 6 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | number | test | 10 | 30.0 | 30.0 | 30.0 | 0.300 | 2 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 | 7 |
| exact | entity | all | 19 | 57.9 | 68.4 | 68.4 | 0.632 | 5 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 | 19 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | number | all | 24 | 37.5 | 41.7 | 41.7 | 0.396 | 3 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 | 18 |
| keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 53.3 | 0.389 | 4 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.653 | 0 |
| keyword | number | dev | 14 | 57.1 | 64.3 | 71.4 | 0.616 | 1 |
| keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 | 0 |
| keyword | paraphrase | test | 10 | 20.0 | 30.0 | 40.0 | 0.250 | 4 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.380 | 0 |
| keyword | number | test | 10 | 20.0 | 40.0 | 50.0 | 0.294 | 0 |
| keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| keyword | entity | all | 19 | 78.9 | 100.0 | 100.0 | 0.886 | 0 |
| keyword | paraphrase | all | 25 | 24.0 | 44.0 | 48.0 | 0.333 | 8 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.544 | 0 |
| keyword | number | all | 24 | 41.7 | 54.2 | 62.5 | 0.482 | 1 |
| keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 | 0 |
| exact+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 | 4 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.431 | 0 |
| exact+keyword | number | dev | 14 | 50.0 | 78.6 | 78.6 | 0.631 | 0 |
| exact+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 | 0 |
| exact+keyword | paraphrase | test | 10 | 20.0 | 40.0 | 60.0 | 0.296 | 1 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.213 | 0 |
| exact+keyword | number | test | 10 | 30.0 | 60.0 | 70.0 | 0.444 | 0 |
| exact+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| exact+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.908 | 0 |
| exact+keyword | paraphrase | all | 25 | 20.0 | 48.0 | 56.0 | 0.328 | 5 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.344 | 0 |
| exact+keyword | number | all | 24 | 41.7 | 70.8 | 75.0 | 0.553 | 0 |
| exact+keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 | 0 |
| exact+linked+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 | 4 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 | 0 |
| exact+linked+keyword | number | dev | 14 | 57.1 | 78.6 | 78.6 | 0.679 | 0 |
| exact+linked+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 | 0 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 | 0 |
| exact+linked+keyword | paraphrase | test | 10 | 20.0 | 40.0 | 60.0 | 0.296 | 1 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 | 0 |
| exact+linked+keyword | number | test | 10 | 40.0 | 60.0 | 70.0 | 0.511 | 0 |
| exact+linked+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 | 0 |
| exact+linked+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.921 | 0 |
| exact+linked+keyword | paraphrase | all | 25 | 20.0 | 48.0 | 56.0 | 0.328 | 5 |
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

