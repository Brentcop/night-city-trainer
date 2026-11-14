# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable
questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no
match", which is right. Wrongly refused: answerable questions for which it said "no match".

Question set: `data/kb/questions.json` (draft), 286 questions. Types: entity 24, paraphrase 66, cross 24, number 47, dev 28, rules 39, stat 40, none 18.
Scopes: public 246, local 40. Splits: dev 171, test 115. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

4075 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 160 | 11.3 | 18.1 | 18.1 | 0.137 | 95 | 224 | 8 of 11 (72.7%) | 74 of 160 (46.3%) |
| exact | test | 108 | 13.9 | 22.2 | 22.2 | 0.170 | 115 | 284 | 7 of 7 (100.0%) | 39 of 108 (36.1%) |
| exact | all | 268 | 12.3 | 19.8 | 19.8 | 0.150 | 103 | 232 | 15 of 18 (83.3%) | 113 of 268 (42.2%) |
| keyword | dev | 160 | 38.1 | 55.0 | 58.1 | 0.448 | 467 | 611 | 4 of 11 (36.4%) | 24 of 160 (15.0%) |
| keyword | test | 108 | 25.0 | 47.2 | 54.6 | 0.345 | 489 | 621 | 1 of 7 (14.3%) | 12 of 108 (11.1%) |
| keyword | all | 268 | 32.8 | 51.9 | 56.7 | 0.407 | 476 | 614 | 5 of 18 (27.8%) | 36 of 268 (13.4%) |
| exact+keyword | dev | 160 | 36.9 | 66.3 | 72.5 | 0.488 | 520 | 618 | 3 of 11 (27.3%) | 9 of 160 (5.6%) |
| exact+keyword | test | 108 | 30.6 | 62.0 | 74.1 | 0.446 | 517 | 621 | 1 of 7 (14.3%) | 5 of 108 (4.6%) |
| exact+keyword | all | 268 | 34.3 | 64.6 | 73.1 | 0.471 | 519 | 619 | 4 of 18 (22.2%) | 14 of 268 (5.2%) |
| exact+linked+keyword | dev | 160 | 53.8 | 73.8 | 78.8 | 0.623 | 524 | 656 | 3 of 11 (27.3%) | 9 of 160 (5.6%) |
| exact+linked+keyword | test | 108 | 44.4 | 66.7 | 74.1 | 0.548 | 525 | 638 | 1 of 7 (14.3%) | 5 of 108 (4.6%) |
| exact+linked+keyword | all | 268 | 50.0 | 70.9 | 76.9 | 0.593 | 525 | 649 | 4 of 18 (22.2%) | 14 of 268 (5.2%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 14 | 71.4 | 78.6 | 78.6 | 0.750 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 60.7 | 60.7 | 0.375 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | rules | dev | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 73.7 | 73.7 | 0.465 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | rules | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 9 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 24 | 75.0 | 83.3 | 83.3 | 0.792 | 4 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 66.0 | 66.0 | 0.411 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | rules | all | 39 | 0.0 | 0.0 | 0.0 | 0.000 | 25 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 30.0 | 55.0 | 57.5 | 0.406 | 8 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.633 | 0 |
| keyword | number | dev | 28 | 35.7 | 39.3 | 39.3 | 0.369 | 4 |
| keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.743 | 0 |
| keyword | rules | dev | 23 | 30.4 | 56.5 | 65.2 | 0.412 | 2 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 10 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 26 | 19.2 | 50.0 | 50.0 | 0.315 | 6 |
| keyword | cross | test | 10 | 40.0 | 40.0 | 80.0 | 0.453 | 0 |
| keyword | number | test | 19 | 15.8 | 26.3 | 42.1 | 0.201 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| keyword | rules | test | 16 | 25.0 | 62.5 | 62.5 | 0.382 | 2 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | all | 24 | 79.2 | 100.0 | 100.0 | 0.882 | 0 |
| keyword | paraphrase | all | 66 | 25.8 | 53.0 | 54.5 | 0.370 | 14 |
| keyword | cross | all | 24 | 45.8 | 62.5 | 83.3 | 0.558 | 0 |
| keyword | number | all | 47 | 27.7 | 34.0 | 40.4 | 0.301 | 5 |
| keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.716 | 0 |
| keyword | rules | all | 39 | 28.2 | 59.0 | 64.1 | 0.400 | 4 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 13 |
| exact+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 57.5 | 60.0 | 0.373 | 7 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.431 | 0 |
| exact+keyword | number | dev | 28 | 57.1 | 78.6 | 78.6 | 0.667 | 0 |
| exact+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.743 | 0 |
| exact+keyword | rules | dev | 23 | 30.4 | 56.5 | 65.2 | 0.394 | 2 |
| exact+keyword | stat | dev | 24 | 0.0 | 29.2 | 50.0 | 0.115 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 26 | 15.4 | 53.8 | 61.5 | 0.305 | 3 |
| exact+keyword | cross | test | 10 | 10.0 | 40.0 | 80.0 | 0.301 | 0 |
| exact+keyword | number | test | 19 | 63.2 | 84.2 | 89.5 | 0.730 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+keyword | rules | test | 16 | 12.5 | 56.3 | 62.5 | 0.306 | 2 |
| exact+keyword | stat | test | 16 | 0.0 | 31.3 | 56.3 | 0.127 | 0 |
| exact+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+keyword | paraphrase | all | 66 | 19.7 | 56.1 | 60.6 | 0.346 | 10 |
| exact+keyword | cross | all | 24 | 12.5 | 62.5 | 83.3 | 0.377 | 0 |
| exact+keyword | number | all | 47 | 59.6 | 80.9 | 83.0 | 0.692 | 0 |
| exact+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.716 | 0 |
| exact+keyword | rules | all | 39 | 23.1 | 56.4 | 64.1 | 0.358 | 4 |
| exact+keyword | stat | all | 40 | 0.0 | 30.0 | 52.5 | 0.120 | 0 |
| exact+linked+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 52.5 | 60.0 | 0.369 | 7 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.827 | 0 |
| exact+linked+keyword | number | dev | 28 | 64.3 | 78.6 | 78.6 | 0.714 | 0 |
| exact+linked+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.743 | 0 |
| exact+linked+keyword | rules | dev | 23 | 30.4 | 52.2 | 65.2 | 0.385 | 2 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.746 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 15.4 | 46.2 | 53.8 | 0.277 | 3 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 90.0 | 100.0 | 0.817 | 0 |
| exact+linked+keyword | number | test | 19 | 57.9 | 73.7 | 84.2 | 0.670 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+linked+keyword | rules | test | 16 | 12.5 | 50.0 | 62.5 | 0.292 | 2 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 19.7 | 50.0 | 57.6 | 0.333 | 10 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.823 | 0 |
| exact+linked+keyword | number | all | 47 | 61.7 | 76.6 | 80.9 | 0.697 | 0 |
| exact+linked+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.716 | 0 |
| exact+linked+keyword | rules | all | 39 | 23.1 | 51.3 | 64.1 | 0.347 | 4 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.697 | 0 |

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
| q134 | rules | refused | am I allowed to look through my opponent's discard pile | rule:5.9.2 |  |
| q138 | rules | – | if a card lets me pick up to two targets, may I pick none | rule:2.8 | doc:docs/BOT_TOOLKIT.md#5-decision-procedures-src-ai-heuristic-ts~25 (5. Decision procedures (src/ai/heuristic.ts) (part 25)); term:call-a-legend (Call a Legend); doc:docs/BOT_TOOLKIT.md#5-decision-procedures-src-ai-heuristic-ts~24 (5. Decision procedures (src/ai/heuristic.ts) (part 24)) |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); trule:3.4; doc:docs/GAME_RECORD.md#the-game (The game) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); faq:e512816e |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~22 (Keys (part 22)); trule:E.2 |
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~20 (Game review: a rating for every move (src/lib/gameReview.ts) (part 20)); doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); trule:3.3 |
| q224 | how many cards are in a hearthstone deck | rule:11.17.3; code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

## Scope: public records only (what a checkout without data/raw searches)

3051 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 40.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 136 | 12.5 | 20.6 | 20.6 | 0.154 | 104 | 240 | 8 of 11 (72.7%) | 58 of 136 (42.6%) |
| exact | test | 92 | 16.3 | 26.1 | 26.1 | 0.199 | 123 | 295 | 7 of 7 (100.0%) | 30 of 92 (32.6%) |
| exact | all | 228 | 14.0 | 22.8 | 22.8 | 0.173 | 112 | 284 | 15 of 18 (83.3%) | 88 of 228 (38.6%) |
| keyword | dev | 136 | 37.5 | 52.9 | 56.6 | 0.441 | 457 | 607 | 4 of 11 (36.4%) | 23 of 136 (16.9%) |
| keyword | test | 92 | 26.1 | 45.7 | 52.2 | 0.350 | 496 | 626 | 4 of 7 (57.1%) | 9 of 92 (9.8%) |
| keyword | all | 228 | 32.9 | 50.0 | 54.8 | 0.404 | 473 | 616 | 8 of 18 (44.4%) | 32 of 228 (14.0%) |
| exact+keyword | dev | 136 | 36.8 | 66.2 | 73.5 | 0.494 | 523 | 622 | 3 of 11 (27.3%) | 8 of 136 (5.9%) |
| exact+keyword | test | 92 | 34.8 | 62.0 | 76.1 | 0.477 | 526 | 621 | 4 of 7 (57.1%) | 3 of 92 (3.3%) |
| exact+keyword | all | 228 | 36.0 | 64.5 | 74.6 | 0.487 | 524 | 622 | 7 of 18 (38.9%) | 11 of 228 (4.8%) |
| exact+linked+keyword | dev | 136 | 56.6 | 77.2 | 80.9 | 0.656 | 528 | 664 | 3 of 11 (27.3%) | 8 of 136 (5.9%) |
| exact+linked+keyword | test | 92 | 51.1 | 68.5 | 77.2 | 0.602 | 540 | 649 | 4 of 7 (57.1%) | 3 of 92 (3.3%) |
| exact+linked+keyword | all | 228 | 54.4 | 73.7 | 79.4 | 0.634 | 533 | 662 | 7 of 18 (38.9%) | 11 of 228 (4.8%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 13 | 69.2 | 76.9 | 76.9 | 0.731 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 60.7 | 60.7 | 0.375 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 73.7 | 73.7 | 0.465 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 23 | 73.9 | 82.6 | 82.6 | 0.783 | 4 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 66.0 | 66.0 | 0.411 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 27.5 | 52.5 | 55.0 | 0.382 | 10 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.634 | 0 |
| keyword | number | dev | 28 | 35.7 | 39.3 | 42.9 | 0.373 | 4 |
| keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 9 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 26 | 23.1 | 50.0 | 53.8 | 0.359 | 5 |
| keyword | cross | test | 10 | 40.0 | 50.0 | 80.0 | 0.460 | 0 |
| keyword | number | test | 19 | 15.8 | 26.3 | 31.6 | 0.194 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | all | 23 | 78.3 | 100.0 | 100.0 | 0.877 | 0 |
| keyword | paraphrase | all | 66 | 25.8 | 51.5 | 54.5 | 0.373 | 15 |
| keyword | cross | all | 24 | 45.8 | 66.7 | 83.3 | 0.562 | 0 |
| keyword | number | all | 47 | 27.7 | 34.0 | 38.3 | 0.301 | 5 |
| keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 12 |
| exact+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 55.0 | 60.0 | 0.364 | 8 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.432 | 0 |
| exact+keyword | number | dev | 28 | 57.1 | 78.6 | 78.6 | 0.667 | 0 |
| exact+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+keyword | stat | dev | 24 | 0.0 | 29.2 | 50.0 | 0.115 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 26 | 19.2 | 50.0 | 61.5 | 0.323 | 3 |
| exact+keyword | cross | test | 10 | 10.0 | 40.0 | 80.0 | 0.307 | 0 |
| exact+keyword | number | test | 19 | 63.2 | 84.2 | 89.5 | 0.734 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+keyword | stat | test | 16 | 0.0 | 31.3 | 56.3 | 0.127 | 0 |
| exact+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+keyword | paraphrase | all | 66 | 21.2 | 53.0 | 60.6 | 0.348 | 11 |
| exact+keyword | cross | all | 24 | 12.5 | 62.5 | 83.3 | 0.380 | 0 |
| exact+keyword | number | all | 47 | 59.6 | 80.9 | 83.0 | 0.694 | 0 |
| exact+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+keyword | stat | all | 40 | 0.0 | 30.0 | 52.5 | 0.120 | 0 |
| exact+linked+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 55.0 | 60.0 | 0.364 | 8 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.827 | 0 |
| exact+linked+keyword | number | dev | 28 | 64.3 | 78.6 | 78.6 | 0.714 | 0 |
| exact+linked+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.746 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 19.2 | 42.3 | 57.7 | 0.309 | 3 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 90.0 | 100.0 | 0.817 | 0 |
| exact+linked+keyword | number | test | 19 | 57.9 | 73.7 | 84.2 | 0.670 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 21.2 | 50.0 | 59.1 | 0.342 | 11 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.823 | 0 |
| exact+linked+keyword | number | all | 47 | 61.7 | 76.6 | 80.9 | 0.697 | 0 |
| exact+linked+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.697 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q043 | paraphrase | refused | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q143 | number | – | how good is rrb wakako midrange | rating:meta-rrb-wakako-midrange | deck:meta-rrb-wakako-midrange (RRB Wakako Midrange); guide:rrb-wakako-midrange#playing-against-it (RRB Wakako Midrange: Playing against it); guide:rrb-wakako-midrange#intro (RRB Wakako Midrange) |
| q147 | paraphrase | refused | is there a program that makes both players dump their whole hand and draw five new cards | card:shattered_memories |  |
| q151 | paraphrase | refused | how does the list that pays for things with its legends and then sends those same legends in as surprise attackers want to win | objective:nc-08-merc-contract-rrg |  |
| q156 | paraphrase | refused | what does the number comparing win rate in games where a card showed up versus games where it didn't actually mean | term:when-drawn-iwd |  |
| q157 | paraphrase | – | legend that lets me reroll a die I didn't like when I roll it in at the start of my turn | card:kerry_eurodyne_axe_attitude_audience | objective:RBY-samurai (Samurai game plan); doc:docs/GAME_RECORD.md#the-game~2 (The game (part 2)); guide:fundamentals#economy-checklist (Fundamentals: Economy checklist) |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); doc:docs/GAME_RECORD.md#the-game (The game); doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); pkg:rocker (Rocker Units (Johnny Silverhand)) |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~22 (Keys (part 22)); doc:docs/SITE_CONFIG.md#keys~21 (Keys (part 21)) |
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~20 (Game review: a rating for every move (src/lib/gameReview.ts) (part 20)); doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); doc:docs/RESEARCH.md#open-questions-and-caveats (Open questions and caveats) |
| q224 | how many cards are in a hearthstone deck | code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/SYNERGIES.md#deck-lab-lab~3 (Deck Lab (#/lab) (part 3)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

