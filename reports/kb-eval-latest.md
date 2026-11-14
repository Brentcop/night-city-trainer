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

3999 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 160 | 11.3 | 12.5 | 12.5 | 0.119 | 78 | 183 | 8 of 11 (72.7%) | 79 of 160 (49.4%) |
| exact | test | 108 | 11.1 | 13.0 | 13.0 | 0.120 | 93 | 221 | 7 of 7 (100.0%) | 44 of 108 (40.7%) |
| exact | all | 268 | 11.2 | 12.7 | 12.7 | 0.119 | 84 | 212 | 15 of 18 (83.3%) | 123 of 268 (45.9%) |
| keyword | dev | 160 | 38.1 | 55.0 | 58.8 | 0.451 | 468 | 614 | 4 of 11 (36.4%) | 24 of 160 (15.0%) |
| keyword | test | 108 | 26.9 | 46.3 | 53.7 | 0.354 | 490 | 621 | 1 of 7 (14.3%) | 12 of 108 (11.1%) |
| keyword | all | 268 | 33.6 | 51.5 | 56.7 | 0.412 | 477 | 616 | 5 of 18 (27.8%) | 36 of 268 (13.4%) |
| exact+keyword | dev | 160 | 31.9 | 56.9 | 60.6 | 0.424 | 511 | 611 | 3 of 11 (27.3%) | 9 of 160 (5.6%) |
| exact+keyword | test | 108 | 23.1 | 51.9 | 60.2 | 0.358 | 507 | 608 | 1 of 7 (14.3%) | 6 of 108 (5.6%) |
| exact+keyword | all | 268 | 28.4 | 54.9 | 60.4 | 0.397 | 509 | 610 | 4 of 18 (22.2%) | 15 of 268 (5.6%) |
| exact+linked+keyword | dev | 160 | 37.5 | 57.5 | 61.9 | 0.462 | 509 | 605 | 3 of 11 (27.3%) | 9 of 160 (5.6%) |
| exact+linked+keyword | test | 108 | 28.7 | 52.8 | 59.3 | 0.393 | 506 | 608 | 1 of 7 (14.3%) | 6 of 108 (5.6%) |
| exact+linked+keyword | all | 268 | 34.0 | 55.6 | 60.8 | 0.434 | 508 | 608 | 4 of 18 (22.2%) | 15 of 268 (5.6%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 14 | 71.4 | 78.6 | 78.6 | 0.750 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | dev | 28 | 25.0 | 28.6 | 28.6 | 0.268 | 3 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | rules | dev | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | entity | test | 10 | 50.0 | 60.0 | 60.0 | 0.550 | 3 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 36.8 | 36.8 | 0.342 | 4 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | rules | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 9 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 1 |
| exact | entity | all | 24 | 62.5 | 70.8 | 70.8 | 0.667 | 6 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 5 |
| exact | number | all | 47 | 27.7 | 31.9 | 31.9 | 0.298 | 7 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | rules | all | 39 | 0.0 | 0.0 | 0.0 | 0.000 | 25 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 30.0 | 55.0 | 60.0 | 0.408 | 8 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.633 | 0 |
| keyword | number | dev | 28 | 35.7 | 39.3 | 42.9 | 0.380 | 4 |
| keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| keyword | rules | dev | 23 | 30.4 | 56.5 | 60.9 | 0.408 | 2 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 10 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 26 | 23.1 | 50.0 | 50.0 | 0.328 | 6 |
| keyword | cross | test | 10 | 40.0 | 40.0 | 80.0 | 0.458 | 0 |
| keyword | number | test | 19 | 21.1 | 26.3 | 36.8 | 0.235 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| keyword | rules | test | 16 | 25.0 | 56.3 | 62.5 | 0.385 | 2 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | all | 24 | 79.2 | 100.0 | 100.0 | 0.882 | 0 |
| keyword | paraphrase | all | 66 | 27.3 | 53.0 | 56.1 | 0.377 | 14 |
| keyword | cross | all | 24 | 45.8 | 62.5 | 83.3 | 0.560 | 0 |
| keyword | number | all | 47 | 29.8 | 34.0 | 40.4 | 0.321 | 5 |
| keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| keyword | rules | all | 39 | 28.2 | 56.4 | 61.5 | 0.399 | 4 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 13 |
| exact+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 57.5 | 62.5 | 0.376 | 7 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.442 | 0 |
| exact+keyword | number | dev | 28 | 28.6 | 50.0 | 50.0 | 0.381 | 0 |
| exact+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| exact+keyword | rules | dev | 23 | 30.4 | 56.5 | 60.9 | 0.390 | 2 |
| exact+keyword | stat | dev | 24 | 0.0 | 0.0 | 4.2 | 0.007 | 0 |
| exact+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.758 | 0 |
| exact+keyword | paraphrase | test | 26 | 15.4 | 53.8 | 61.5 | 0.301 | 3 |
| exact+keyword | cross | test | 10 | 10.0 | 40.0 | 80.0 | 0.305 | 0 |
| exact+keyword | number | test | 19 | 31.6 | 52.6 | 57.9 | 0.414 | 1 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| exact+keyword | rules | test | 16 | 12.5 | 56.3 | 62.5 | 0.310 | 2 |
| exact+keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact+keyword | entity | all | 24 | 83.3 | 100.0 | 100.0 | 0.899 | 0 |
| exact+keyword | paraphrase | all | 66 | 19.7 | 56.1 | 62.1 | 0.346 | 10 |
| exact+keyword | cross | all | 24 | 12.5 | 62.5 | 83.3 | 0.385 | 0 |
| exact+keyword | number | all | 47 | 29.8 | 51.1 | 53.2 | 0.394 | 1 |
| exact+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| exact+keyword | rules | all | 39 | 23.1 | 56.4 | 61.5 | 0.357 | 4 |
| exact+keyword | stat | all | 40 | 0.0 | 0.0 | 2.5 | 0.004 | 0 |
| exact+linked+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 52.5 | 62.5 | 0.372 | 7 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.839 | 0 |
| exact+linked+keyword | number | dev | 28 | 32.1 | 50.0 | 50.0 | 0.411 | 0 |
| exact+linked+keyword | dev | dev | 17 | 64.7 | 94.1 | 100.0 | 0.754 | 0 |
| exact+linked+keyword | rules | dev | 23 | 30.4 | 52.2 | 60.9 | 0.381 | 2 |
| exact+linked+keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 0 |
| exact+linked+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.783 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 15.4 | 46.2 | 53.8 | 0.271 | 3 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 90.0 | 100.0 | 0.817 | 0 |
| exact+linked+keyword | number | test | 19 | 31.6 | 47.4 | 52.6 | 0.387 | 1 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.670 | 0 |
| exact+linked+keyword | rules | test | 16 | 12.5 | 50.0 | 62.5 | 0.295 | 2 |
| exact+linked+keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact+linked+keyword | entity | all | 24 | 83.3 | 100.0 | 100.0 | 0.910 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 19.7 | 50.0 | 59.1 | 0.332 | 10 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.830 | 0 |
| exact+linked+keyword | number | all | 47 | 31.9 | 48.9 | 51.1 | 0.401 | 1 |
| exact+linked+keyword | dev | all | 28 | 60.7 | 89.3 | 96.4 | 0.721 | 0 |
| exact+linked+keyword | rules | all | 39 | 23.1 | 51.3 | 61.5 | 0.346 | 4 |
| exact+linked+keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 0 |

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
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~20 (Game review: a rating for every move (src/lib/gameReview.ts) (part 20)); doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); trule:3.3 |
| q224 | how many cards are in a hearthstone deck | rule:11.17.3; code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

## Scope: public records only (what a checkout without data/raw searches)

2975 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 40.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 136 | 12.5 | 14.0 | 14.0 | 0.132 | 83 | 206 | 8 of 11 (72.7%) | 63 of 136 (46.3%) |
| exact | test | 92 | 13.0 | 15.2 | 15.2 | 0.141 | 98 | 221 | 7 of 7 (100.0%) | 35 of 92 (38.0%) |
| exact | all | 228 | 12.7 | 14.5 | 14.5 | 0.136 | 89 | 218 | 15 of 18 (83.3%) | 98 of 228 (43.0%) |
| keyword | dev | 136 | 37.5 | 52.9 | 57.4 | 0.444 | 459 | 612 | 4 of 11 (36.4%) | 23 of 136 (16.9%) |
| keyword | test | 92 | 27.2 | 47.8 | 52.2 | 0.360 | 497 | 624 | 4 of 7 (57.1%) | 9 of 92 (9.8%) |
| keyword | all | 228 | 33.3 | 50.9 | 55.3 | 0.410 | 474 | 616 | 8 of 18 (44.4%) | 32 of 228 (14.0%) |
| exact+keyword | dev | 136 | 30.9 | 55.1 | 60.3 | 0.420 | 512 | 605 | 3 of 11 (27.3%) | 8 of 136 (5.9%) |
| exact+keyword | test | 92 | 26.1 | 52.2 | 59.8 | 0.376 | 513 | 606 | 4 of 7 (57.1%) | 4 of 92 (4.3%) |
| exact+keyword | all | 228 | 28.9 | 53.9 | 60.1 | 0.402 | 512 | 606 | 7 of 18 (38.9%) | 12 of 228 (5.3%) |
| exact+linked+keyword | dev | 136 | 37.5 | 58.1 | 61.8 | 0.467 | 512 | 607 | 3 of 11 (27.3%) | 8 of 136 (5.9%) |
| exact+linked+keyword | test | 92 | 32.6 | 53.3 | 59.8 | 0.423 | 515 | 608 | 4 of 7 (57.1%) | 4 of 92 (4.3%) |
| exact+linked+keyword | all | 228 | 35.5 | 56.1 | 61.0 | 0.449 | 513 | 607 | 7 of 18 (38.9%) | 12 of 228 (5.3%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 13 | 69.2 | 76.9 | 76.9 | 0.731 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 5 |
| exact | number | dev | 28 | 25.0 | 28.6 | 28.6 | 0.268 | 3 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| exact | entity | test | 10 | 50.0 | 60.0 | 60.0 | 0.550 | 3 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 36.8 | 36.8 | 0.342 | 4 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 1 |
| exact | entity | all | 23 | 60.9 | 69.6 | 69.6 | 0.652 | 6 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 5 |
| exact | number | all | 47 | 27.7 | 31.9 | 31.9 | 0.298 | 7 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 27.5 | 52.5 | 57.5 | 0.389 | 10 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.634 | 0 |
| keyword | number | dev | 28 | 35.7 | 39.3 | 42.9 | 0.379 | 4 |
| keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 9 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 26 | 26.9 | 53.8 | 53.8 | 0.381 | 5 |
| keyword | cross | test | 10 | 40.0 | 60.0 | 80.0 | 0.468 | 0 |
| keyword | number | test | 19 | 15.8 | 26.3 | 31.6 | 0.208 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| keyword | entity | all | 23 | 78.3 | 100.0 | 100.0 | 0.877 | 0 |
| keyword | paraphrase | all | 66 | 27.3 | 53.0 | 56.1 | 0.386 | 15 |
| keyword | cross | all | 24 | 45.8 | 70.8 | 83.3 | 0.565 | 0 |
| keyword | number | all | 47 | 27.7 | 34.0 | 38.3 | 0.310 | 5 |
| keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 12 |
| exact+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 55.0 | 62.5 | 0.371 | 8 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.443 | 0 |
| exact+keyword | number | dev | 28 | 28.6 | 50.0 | 50.0 | 0.381 | 0 |
| exact+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+keyword | stat | dev | 24 | 0.0 | 0.0 | 4.2 | 0.007 | 0 |
| exact+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.758 | 0 |
| exact+keyword | paraphrase | test | 26 | 19.2 | 53.8 | 61.5 | 0.328 | 3 |
| exact+keyword | cross | test | 10 | 10.0 | 50.0 | 80.0 | 0.314 | 0 |
| exact+keyword | number | test | 19 | 31.6 | 52.6 | 57.9 | 0.418 | 1 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact+keyword | entity | all | 23 | 82.6 | 100.0 | 100.0 | 0.895 | 0 |
| exact+keyword | paraphrase | all | 66 | 21.2 | 54.5 | 62.1 | 0.354 | 11 |
| exact+keyword | cross | all | 24 | 12.5 | 66.7 | 83.3 | 0.390 | 0 |
| exact+keyword | number | all | 47 | 29.8 | 51.1 | 53.2 | 0.396 | 1 |
| exact+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+keyword | stat | all | 40 | 0.0 | 0.0 | 2.5 | 0.004 | 0 |
| exact+linked+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 55.0 | 62.5 | 0.371 | 8 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.839 | 0 |
| exact+linked+keyword | number | dev | 28 | 32.1 | 50.0 | 50.0 | 0.411 | 0 |
| exact+linked+keyword | dev | dev | 17 | 58.8 | 88.2 | 100.0 | 0.717 | 0 |
| exact+linked+keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 0 |
| exact+linked+keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.783 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 19.2 | 46.2 | 57.7 | 0.313 | 3 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 90.0 | 100.0 | 0.817 | 0 |
| exact+linked+keyword | number | test | 19 | 31.6 | 47.4 | 52.6 | 0.387 | 1 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 90.9 | 0.674 | 0 |
| exact+linked+keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact+linked+keyword | entity | all | 23 | 82.6 | 100.0 | 100.0 | 0.906 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 21.2 | 51.5 | 60.6 | 0.348 | 11 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.830 | 0 |
| exact+linked+keyword | number | all | 47 | 31.9 | 48.9 | 51.1 | 0.401 | 1 |
| exact+linked+keyword | dev | all | 28 | 57.1 | 85.7 | 96.4 | 0.700 | 0 |
| exact+linked+keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 0 |

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
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~20 (Game review: a rating for every move (src/lib/gameReview.ts) (part 20)); doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); doc:docs/RESEARCH.md#open-questions-and-caveats (Open questions and caveats) |
| q224 | how many cards are in a hearthstone deck | code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/SYNERGIES.md#deck-lab-lab~3 (Deck Lab (#/lab) (part 3)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

