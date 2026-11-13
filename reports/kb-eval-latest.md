# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4.

Question set: `data/kb/questions.json` (draft), 116 questions. Types: entity 20, paraphrase 25, cross 15, number 16, dev 20, rules 20.
Scopes: public 95, local 21. Splits: dev 70, test 46. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

3537 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 70 | 21.4 | 24.3 | 24.3 | 0.229 | 68 | 123 |
| exact | test | 46 | 15.2 | 17.4 | 17.4 | 0.163 | 78 | 183 |
| exact | all | 116 | 19.0 | 21.6 | 21.6 | 0.203 | 72 | 134 |
| keyword | dev | 70 | 57.1 | 77.1 | 82.9 | 0.655 | 505 | 600 |
| keyword | test | 46 | 39.1 | 67.4 | 76.1 | 0.509 | 490 | 612 |
| keyword | all | 116 | 50.0 | 73.3 | 80.2 | 0.597 | 499 | 605 |
| exact+keyword | dev | 70 | 48.6 | 78.6 | 85.7 | 0.620 | 502 | 591 |
| exact+keyword | test | 46 | 32.6 | 73.9 | 82.6 | 0.499 | 515 | 612 |
| exact+keyword | all | 116 | 42.2 | 76.7 | 84.5 | 0.572 | 507 | 600 |
| exact+linked+keyword | dev | 70 | 58.6 | 78.6 | 85.7 | 0.678 | 499 | 591 |
| exact+linked+keyword | test | 46 | 43.5 | 80.4 | 84.8 | 0.589 | 521 | 612 |
| exact+linked+keyword | all | 116 | 52.6 | 79.3 | 85.3 | 0.643 | 508 | 598 |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 |
|---|---|---|---:|---:|---:|---:|---:|
| exact | entity | dev | 12 | 66.7 | 75.0 | 75.0 | 0.708 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | dev | 10 | 60.0 | 70.0 | 70.0 | 0.650 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 |
| exact | rules | dev | 12 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | test | 6 | 50.0 | 50.0 | 50.0 | 0.500 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | rules | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | all | 20 | 60.0 | 70.0 | 70.0 | 0.650 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | all | 16 | 56.3 | 62.5 | 62.5 | 0.594 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 |
| exact | rules | all | 20 | 0.0 | 0.0 | 0.0 | 0.000 |
| keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 60.0 | 0.393 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.651 |
| keyword | number | dev | 10 | 70.0 | 80.0 | 80.0 | 0.750 |
| keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 |
| keyword | rules | dev | 12 | 33.3 | 66.7 | 75.0 | 0.449 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 |
| keyword | paraphrase | test | 10 | 10.0 | 40.0 | 40.0 | 0.173 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.378 |
| keyword | number | test | 6 | 50.0 | 66.7 | 83.3 | 0.558 |
| keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 |
| keyword | rules | test | 8 | 37.5 | 75.0 | 75.0 | 0.542 |
| keyword | entity | all | 20 | 80.0 | 100.0 | 100.0 | 0.892 |
| keyword | paraphrase | all | 25 | 20.0 | 48.0 | 52.0 | 0.305 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.542 |
| keyword | number | all | 16 | 62.5 | 75.0 | 81.3 | 0.678 |
| keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 |
| keyword | rules | all | 20 | 35.0 | 70.0 | 75.0 | 0.486 |
| exact+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 60.0 | 0.356 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.429 |
| exact+keyword | number | dev | 10 | 60.0 | 100.0 | 100.0 | 0.783 |
| exact+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 |
| exact+keyword | rules | dev | 12 | 33.3 | 58.3 | 75.0 | 0.428 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 |
| exact+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 60.0 | 0.208 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.211 |
| exact+keyword | number | test | 6 | 50.0 | 100.0 | 100.0 | 0.708 |
| exact+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 |
| exact+keyword | rules | test | 8 | 12.5 | 75.0 | 75.0 | 0.400 |
| exact+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.912 |
| exact+keyword | paraphrase | all | 25 | 16.0 | 52.0 | 60.0 | 0.297 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.342 |
| exact+keyword | number | all | 16 | 56.3 | 100.0 | 100.0 | 0.755 |
| exact+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 |
| exact+keyword | rules | all | 20 | 25.0 | 65.0 | 75.0 | 0.417 |
| exact+linked+keyword | entity | dev | 12 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 46.7 | 60.0 | 0.351 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 |
| exact+linked+keyword | number | dev | 10 | 70.0 | 100.0 | 100.0 | 0.850 |
| exact+linked+keyword | dev | dev | 12 | 66.7 | 91.7 | 100.0 | 0.766 |
| exact+linked+keyword | rules | dev | 12 | 33.3 | 50.0 | 66.7 | 0.395 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 |
| exact+linked+keyword | paraphrase | test | 10 | 10.0 | 50.0 | 50.0 | 0.193 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 |
| exact+linked+keyword | number | test | 6 | 66.7 | 100.0 | 100.0 | 0.833 |
| exact+linked+keyword | dev | test | 8 | 62.5 | 87.5 | 100.0 | 0.737 |
| exact+linked+keyword | rules | test | 8 | 12.5 | 75.0 | 75.0 | 0.385 |
| exact+linked+keyword | entity | all | 20 | 85.0 | 100.0 | 100.0 | 0.925 |
| exact+linked+keyword | paraphrase | all | 25 | 16.0 | 48.0 | 56.0 | 0.288 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 |
| exact+linked+keyword | number | all | 16 | 68.8 | 100.0 | 100.0 | 0.844 |
| exact+linked+keyword | dev | all | 20 | 65.0 | 90.0 | 100.0 | 0.754 |
| exact+linked+keyword | rules | all | 20 | 25.0 | 60.0 | 70.0 | 0.391 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10. "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); doc:CLAUDE.md#play-ui~3 (Play UI (part 3)) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)) |
| q031 | paraphrase | – | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | – | which package pays off for flipping my legends early | pkg:legends-up | doc:docs/TUNING_STUDY_2026-11-13.md#what-would-make-them-effective-ranked-by-expected-benefit-for-cost~9 (What would make them effective (ranked by expected benefit for cost) (part 9)); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~29 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 29)); rule:11.11.1 |
| q041 | paraphrase | – | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); rule:6.1.1; guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | – | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:cost-match (Gig value matches a cost); trule:2.1 |

## Scope: public records only (what a checkout without data/raw searches)

2513 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 21.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 |
|---|---|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 57 | 24.6 | 28.1 | 28.1 | 0.263 | 71 | 123 |
| exact | test | 38 | 18.4 | 21.1 | 21.1 | 0.197 | 82 | 183 |
| exact | all | 95 | 22.1 | 25.3 | 25.3 | 0.237 | 75 | 134 |
| keyword | dev | 57 | 59.6 | 78.9 | 84.2 | 0.685 | 501 | 600 |
| keyword | test | 38 | 36.8 | 63.2 | 73.7 | 0.496 | 489 | 612 |
| keyword | all | 95 | 50.5 | 72.6 | 80.0 | 0.609 | 496 | 605 |
| exact+keyword | dev | 57 | 49.1 | 82.5 | 86.0 | 0.643 | 500 | 600 |
| exact+keyword | test | 38 | 36.8 | 71.1 | 84.2 | 0.533 | 522 | 612 |
| exact+keyword | all | 95 | 44.2 | 77.9 | 85.3 | 0.599 | 509 | 605 |
| exact+linked+keyword | dev | 57 | 61.4 | 86.0 | 87.7 | 0.723 | 498 | 595 |
| exact+linked+keyword | test | 38 | 50.0 | 78.9 | 89.5 | 0.646 | 533 | 612 |
| exact+linked+keyword | all | 95 | 56.8 | 83.2 | 88.4 | 0.692 | 512 | 605 |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 |
|---|---|---|---:|---:|---:|---:|---:|
| exact | entity | dev | 11 | 63.6 | 72.7 | 72.7 | 0.682 |
| exact | paraphrase | dev | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | dev | 9 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | dev | 10 | 60.0 | 70.0 | 70.0 | 0.650 |
| exact | dev | dev | 12 | 8.3 | 8.3 | 8.3 | 0.083 |
| exact | entity | test | 8 | 50.0 | 62.5 | 62.5 | 0.563 |
| exact | paraphrase | test | 10 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | test | 6 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | test | 6 | 50.0 | 50.0 | 50.0 | 0.500 |
| exact | dev | test | 8 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | entity | all | 19 | 57.9 | 68.4 | 68.4 | 0.632 |
| exact | paraphrase | all | 25 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | cross | all | 15 | 0.0 | 0.0 | 0.0 | 0.000 |
| exact | number | all | 16 | 56.3 | 62.5 | 62.5 | 0.594 |
| exact | dev | all | 20 | 5.0 | 5.0 | 5.0 | 0.050 |
| keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| keyword | paraphrase | dev | 15 | 26.7 | 53.3 | 53.3 | 0.389 |
| keyword | cross | dev | 9 | 55.6 | 77.8 | 88.9 | 0.653 |
| keyword | number | dev | 10 | 70.0 | 80.0 | 90.0 | 0.762 |
| keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| keyword | entity | test | 8 | 50.0 | 100.0 | 100.0 | 0.729 |
| keyword | paraphrase | test | 10 | 20.0 | 30.0 | 40.0 | 0.250 |
| keyword | cross | test | 6 | 33.3 | 33.3 | 66.7 | 0.380 |
| keyword | number | test | 6 | 33.3 | 66.7 | 66.7 | 0.472 |
| keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 |
| keyword | entity | all | 19 | 78.9 | 100.0 | 100.0 | 0.886 |
| keyword | paraphrase | all | 25 | 24.0 | 44.0 | 48.0 | 0.333 |
| keyword | cross | all | 15 | 46.7 | 60.0 | 80.0 | 0.544 |
| keyword | number | all | 16 | 56.3 | 75.0 | 81.3 | 0.654 |
| keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 |
| exact+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 |
| exact+keyword | cross | dev | 9 | 11.1 | 77.8 | 88.9 | 0.431 |
| exact+keyword | number | dev | 10 | 60.0 | 100.0 | 100.0 | 0.783 |
| exact+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| exact+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.781 |
| exact+keyword | paraphrase | test | 10 | 20.0 | 40.0 | 60.0 | 0.296 |
| exact+keyword | cross | test | 6 | 0.0 | 33.3 | 66.7 | 0.213 |
| exact+keyword | number | test | 6 | 50.0 | 100.0 | 100.0 | 0.722 |
| exact+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 |
| exact+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.908 |
| exact+keyword | paraphrase | all | 25 | 20.0 | 48.0 | 56.0 | 0.328 |
| exact+keyword | cross | all | 15 | 6.7 | 60.0 | 80.0 | 0.344 |
| exact+keyword | number | all | 16 | 56.3 | 100.0 | 100.0 | 0.760 |
| exact+keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 |
| exact+linked+keyword | entity | dev | 11 | 100.0 | 100.0 | 100.0 | 1.000 |
| exact+linked+keyword | paraphrase | dev | 15 | 20.0 | 53.3 | 53.3 | 0.350 |
| exact+linked+keyword | cross | dev | 9 | 77.8 | 100.0 | 100.0 | 0.861 |
| exact+linked+keyword | number | dev | 10 | 70.0 | 100.0 | 100.0 | 0.850 |
| exact+linked+keyword | dev | dev | 12 | 58.3 | 91.7 | 100.0 | 0.725 |
| exact+linked+keyword | entity | test | 8 | 62.5 | 100.0 | 100.0 | 0.813 |
| exact+linked+keyword | paraphrase | test | 10 | 20.0 | 40.0 | 60.0 | 0.296 |
| exact+linked+keyword | cross | test | 6 | 66.7 | 83.3 | 100.0 | 0.778 |
| exact+linked+keyword | number | test | 6 | 66.7 | 100.0 | 100.0 | 0.833 |
| exact+linked+keyword | dev | test | 8 | 50.0 | 87.5 | 100.0 | 0.677 |
| exact+linked+keyword | entity | all | 19 | 84.2 | 100.0 | 100.0 | 0.921 |
| exact+linked+keyword | paraphrase | all | 25 | 20.0 | 48.0 | 56.0 | 0.328 |
| exact+linked+keyword | cross | all | 15 | 73.3 | 93.3 | 100.0 | 0.828 |
| exact+linked+keyword | number | all | 16 | 68.8 | 100.0 | 100.0 | 0.844 |
| exact+linked+keyword | dev | all | 20 | 55.0 | 90.0 | 100.0 | 0.706 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10. "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); doc:CLAUDE.md#play-ui~3 (Play UI (part 3)) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)) |
| q031 | paraphrase | – | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q036 | paraphrase | – | which package pays off for flipping my legends early | pkg:legends-up |  |
| q041 | paraphrase | – | equipment that lets me peek at one of my own hidden legends when the unit attacks | card:kiroshi_optics | objective:RBY-samurai (Samurai game plan); card:sasha_yakovleva_won_t_let_you_down (Sasha Yakovleva: Won't Let You Down); objective:ladder-rrb-dexter-v-wakako (Ladder: Dexter / V / Wakako (RRB) game plan) |
| q043 | paraphrase | – | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini |  |
| q076 | dev | 9 | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~15 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 15)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~19 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 19)) |
| q023 | paraphrase | 4 | which green unit lets another of my units attack on the same turn it arrives | card:valentino_street_racer | term:attack (Attack); objective:RBY-samurai (Samurai game plan); guide:nc-02#why-it-should-compete (NC-02 Stormrider Stampede (GGR): Why it should compete) |
| q055 | cross | 4 | how is nc-01 meant to be piloted | guide:nc-01#how-to-pilot | guide:nc-01#intro (NC-01 Rockerboy Express (RRY)); deck:nc-01-rockerboy-express-rry (NC-01 Rockerboy Express (RRY)); guide:nc-01#against-it (NC-01 Rockerboy Express (RRY): Against it) |

