# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4.

Question set: `data/kb/questions.json` (draft), 100 questions. Types: entity 20, paraphrase 25, cross 15, dev 20, rules 20.
Scopes: public 79, local 21. Splits: dev 60, test 40. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

3293 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 60 | 15.0 | 16.7 | 16.7 | 0.158 | 56 | 114 |
| exact | test | 40 | 10.0 | 12.5 | 12.5 | 0.113 | 68 | 165 |
| exact | all | 100 | 13.0 | 15.0 | 15.0 | 0.140 | 61 | 115 |
| keyword | dev | 60 | 55.0 | 76.7 | 83.3 | 0.638 | 493 | 583 |
| keyword | test | 40 | 37.5 | 70.0 | 75.0 | 0.503 | 478 | 604 |
| keyword | all | 100 | 48.0 | 74.0 | 80.0 | 0.584 | 487 | 592 |
| exact+keyword | dev | 60 | 46.7 | 75.0 | 83.3 | 0.591 | 489 | 579 |
| exact+keyword | test | 40 | 30.0 | 72.5 | 80.0 | 0.472 | 508 | 598 |
| exact+keyword | all | 100 | 40.0 | 74.0 | 82.0 | 0.544 | 496 | 589 |
| exact+linked+keyword | dev | 60 | 56.7 | 75.0 | 83.3 | 0.648 | 488 | 581 |
| exact+linked+keyword | test | 40 | 40.0 | 80.0 | 82.5 | 0.555 | 515 | 598 |
| exact+linked+keyword | all | 100 | 50.0 | 77.0 | 83.0 | 0.611 | 499 | 592 |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 |
|---|---|---|---:|---:|---:|---:|---:|
| exact | entity | dev | 12 | 66.7 | 75.0 | 75.0 | 0.708 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 |
| exact | rules | dev | 12 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | rules | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | all | 20 | 60.0 | 70.0 | 70.0 | 0.650 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 |
| exact | rules | all | 20 | 0.0 | 0.0 | 0.0 | 0.000 |
| keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 60.0 | 0.393 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.651 |
| keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.762 |
| keyword | rules | dev | 12 | 33.3 | 66.7 | 75.0 | 0.449 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 |
| keyword | paraphrase | test | 10 | 10.0 | 40.0 | 40.0 | 0.173 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.378 |
| keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| keyword | rules | test | 8 | 37.5 | 75.0 | 75.0 | 0.542 |
| keyword | entity | all | 20 | 80.0 | 100.0 | 100.0 | 0.892 |
| keyword | paraphrase | all | 25 | 20.0 | 48.0 | 52.0 | 0.305 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.542 |
| keyword | dev | all | 20 | 65.0 | 95.0 | 100.0 | 0.755 |
| keyword | rules | all | 20 | 35.0 | 70.0 | 75.0 | 0.486 |
| exact+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 60.0 | 0.356 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.429 |
| exact+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.762 |
| exact+keyword | rules | dev | 12 | 33.3 | 58.3 | 75.0 | 0.428 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 |
| exact+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 60.0 | 0.221 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.211 |
| exact+keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| exact+keyword | rules | test | 8 | 12.5 | 75.0 | 75.0 | 0.400 |
| exact+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.912 |
| exact+keyword | paraphrase | all | 25 | 16.0 | 52.0 | 60.0 | 0.302 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.342 |
| exact+keyword | dev | all | 20 | 65.0 | 95.0 | 100.0 | 0.755 |
| exact+keyword | rules | all | 20 | 25.0 | 65.0 | 75.0 | 0.417 |
| exact+linked+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 46.7 | 60.0 | 0.351 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 |
| exact+linked+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.762 |
| exact+linked+keyword | rules | dev | 12 | 33.3 | 50.0 | 66.7 | 0.395 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 |
| exact+linked+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 50.0 | 0.198 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| exact+linked+keyword | rules | test | 8 | 12.5 | 75.0 | 75.0 | 0.385 |
| exact+linked+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.925 |
| exact+linked+keyword | paraphrase | all | 25 | 16.0 | 48.0 | 56.0 | 0.290 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 |
| exact+linked+keyword | dev | all | 20 | 65.0 | 95.0 | 100.0 | 0.755 |
| exact+linked+keyword | rules | all | 20 | 25.0 | 60.0 | 70.0 | 0.391 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10. "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); doc:CLAUDE.md#play-ui~3 (Play UI (part 3)) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)) |
| q031 | paraphrase | – | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | – | which package pays off for flipping my legends early | pkg:legends-up | doc:docs/TUNING_STUDY_2026-11-13.md#what-would-make-them-effective-ranked-by-expected-benefit-for-cost~9 (What would make them effective (ranked by expected benefit for cost) (part 9)); rule:11.11.1; doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~29 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 29)) |
| q041 | paraphrase | – | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); rule:6.1.1; guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | – | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:cost-match (Gig value matches a cost); trule:2.1 |

## Scope: public records only (what a checkout without data/raw searches)

2269 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 21.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 47 | 17.0 | 19.1 | 19.1 | 0.181 | 56 | 114 |
| exact | test | 32 | 12.5 | 15.6 | 15.6 | 0.141 | 71 | 165 |
| exact | all | 79 | 15.2 | 17.7 | 17.7 | 0.165 | 62 | 115 |
| keyword | dev | 47 | 57.4 | 78.7 | 83.0 | 0.668 | 471 | 581 |
| keyword | test | 32 | 40.6 | 68.8 | 75.0 | 0.519 | 473 | 600 |
| keyword | all | 79 | 50.6 | 74.7 | 79.7 | 0.608 | 472 | 598 |
| exact+keyword | dev | 47 | 46.8 | 78.7 | 83.0 | 0.613 | 472 | 581 |
| exact+keyword | test | 32 | 37.5 | 71.9 | 81.3 | 0.521 | 515 | 600 |
| exact+keyword | all | 79 | 43.0 | 75.9 | 82.3 | 0.576 | 489 | 598 |
| exact+linked+keyword | dev | 47 | 59.6 | 83.0 | 85.1 | 0.696 | 474 | 588 |
| exact+linked+keyword | test | 32 | 50.0 | 81.3 | 87.5 | 0.635 | 528 | 598 |
| exact+linked+keyword | all | 79 | 55.7 | 82.3 | 86.1 | 0.671 | 496 | 593 |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 |
|---|---|---|---:|---:|---:|---:|---:|
| exact | entity | dev | 11 | 63.6 | 72.7 | 72.7 | 0.682 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | all | 19 | 57.9 | 68.4 | 68.4 | 0.632 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 |
| keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 53.3 | 0.389 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.653 |
| keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 |
| keyword | paraphrase | test | 10 | 20.0 | 40.0 | 40.0 | 0.253 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.380 |
| keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| keyword | entity | all | 19 | 78.9 | 100.0 | 100.0 | 0.886 |
| keyword | paraphrase | all | 25 | 24.0 | 48.0 | 48.0 | 0.335 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.544 |
| keyword | dev | all | 20 | 60.0 | 95.0 | 100.0 | 0.732 |
| exact+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.431 |
| exact+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 |
| exact+keyword | paraphrase | test | 10 | 20.0 | 50.0 | 60.0 | 0.320 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.213 |
| exact+keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| exact+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.908 |
| exact+keyword | paraphrase | all | 25 | 20.0 | 52.0 | 56.0 | 0.338 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.344 |
| exact+keyword | dev | all | 20 | 60.0 | 95.0 | 100.0 | 0.732 |
| exact+linked+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 |
| exact+linked+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 |
| exact+linked+keyword | paraphrase | test | 10 | 20.0 | 50.0 | 60.0 | 0.320 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 100.0 | 100.0 | 0.744 |
| exact+linked+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.921 |
| exact+linked+keyword | paraphrase | all | 25 | 20.0 | 52.0 | 56.0 | 0.338 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 |
| exact+linked+keyword | dev | all | 20 | 60.0 | 95.0 | 100.0 | 0.732 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10. "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); objective:BBG-bbg-draw-and-wipe (BBG Draw and Wipe game plan) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)) |
| q031 | paraphrase | – | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | – | which package pays off for flipping my legends early | pkg:legends-up |  |
| q041 | paraphrase | – | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics |  |
| q043 | paraphrase | – | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q076 | dev | 9 | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~15 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 15)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~19 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 19)) |
| q023 | paraphrase | 4 | which green unit lets another of my units attack on the same turn it arrives | card:valentino_street_racer | term:attack (Attack); objective:RBY-samurai (Samurai game plan); guide:nc-02#why-it-should-compete (NC-02 Stormrider Stampede (GGR): Why it should compete) |
| q055 | cross | 4 | how is nc-01 meant to be piloted | guide:nc-01#how-to-pilot | guide:nc-01#intro (NC-01 Rockerboy Express (RRY)); guide:nc-01#against-it (NC-01 Rockerboy Express (RRY): Against it); deck:nc-01-rockerboy-express-rry (NC-01 Rockerboy Express (RRY)) |

