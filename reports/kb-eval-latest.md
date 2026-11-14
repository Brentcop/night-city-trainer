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

4609 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 160 | 11.3 | 15.6 | 15.6 | 0.129 | 92 | 224 | 8 of 11 (72.7%) | 74 of 160 (46.3%) |
| exact | test | 108 | 13.9 | 21.3 | 21.3 | 0.167 | 114 | 255 | 7 of 7 (100.0%) | 39 of 108 (36.1%) |
| exact | all | 268 | 12.3 | 17.9 | 17.9 | 0.144 | 101 | 227 | 15 of 18 (83.3%) | 113 of 268 (42.2%) |
| keyword | dev | 160 | 37.5 | 53.8 | 55.0 | 0.440 | 463 | 612 | 3 of 11 (27.3%) | 26 of 160 (16.3%) |
| keyword | test | 108 | 25.0 | 47.2 | 51.9 | 0.343 | 507 | 625 | 1 of 7 (14.3%) | 10 of 108 (9.3%) |
| keyword | all | 268 | 32.5 | 51.1 | 53.7 | 0.401 | 481 | 617 | 4 of 18 (22.2%) | 36 of 268 (13.4%) |
| exact+keyword | dev | 160 | 35.0 | 62.5 | 66.9 | 0.462 | 518 | 621 | 2 of 11 (18.2%) | 10 of 160 (6.3%) |
| exact+keyword | test | 108 | 30.6 | 63.0 | 71.3 | 0.441 | 528 | 621 | 1 of 7 (14.3%) | 4 of 108 (3.7%) |
| exact+keyword | all | 268 | 33.2 | 62.7 | 68.7 | 0.453 | 522 | 621 | 3 of 18 (16.7%) | 14 of 268 (5.2%) |
| exact+linked+keyword | dev | 160 | 51.2 | 70.6 | 74.4 | 0.596 | 520 | 635 | 2 of 11 (18.2%) | 10 of 160 (6.3%) |
| exact+linked+keyword | test | 108 | 43.5 | 66.7 | 72.2 | 0.539 | 535 | 649 | 1 of 7 (14.3%) | 4 of 108 (3.7%) |
| exact+linked+keyword | all | 268 | 48.1 | 69.0 | 73.5 | 0.573 | 526 | 644 | 3 of 18 (16.7%) | 14 of 268 (5.2%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 14 | 71.4 | 78.6 | 78.6 | 0.750 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 46.4 | 46.4 | 0.327 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | rules | dev | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 68.4 | 68.4 | 0.447 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | rules | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 9 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 24 | 75.0 | 83.3 | 83.3 | 0.792 | 4 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 55.3 | 55.3 | 0.376 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | rules | all | 39 | 0.0 | 0.0 | 0.0 | 0.000 | 25 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 30.0 | 55.0 | 57.5 | 0.402 | 8 |
| keyword | cross | dev | 14 | 50.0 | 78.6 | 85.7 | 0.633 | 0 |
| keyword | number | dev | 28 | 32.1 | 35.7 | 35.7 | 0.339 | 5 |
| keyword | dev | dev | 17 | 64.7 | 88.2 | 88.2 | 0.723 | 1 |
| keyword | rules | dev | 23 | 30.4 | 56.5 | 56.5 | 0.411 | 2 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 10 |
| keyword | entity | test | 10 | 50.0 | 100.0 | 100.0 | 0.717 | 0 |
| keyword | paraphrase | test | 26 | 15.4 | 46.2 | 50.0 | 0.287 | 5 |
| keyword | cross | test | 10 | 40.0 | 50.0 | 80.0 | 0.459 | 0 |
| keyword | number | test | 19 | 15.8 | 31.6 | 31.6 | 0.208 | 1 |
| keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| keyword | rules | test | 16 | 25.0 | 56.3 | 62.5 | 0.379 | 2 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| keyword | entity | all | 24 | 79.2 | 100.0 | 100.0 | 0.882 | 0 |
| keyword | paraphrase | all | 66 | 24.2 | 51.5 | 54.5 | 0.357 | 13 |
| keyword | cross | all | 24 | 45.8 | 66.7 | 83.3 | 0.561 | 0 |
| keyword | number | all | 47 | 25.5 | 34.0 | 34.0 | 0.286 | 6 |
| keyword | dev | all | 28 | 64.3 | 85.7 | 85.7 | 0.718 | 1 |
| keyword | rules | all | 39 | 28.2 | 56.4 | 59.0 | 0.398 | 4 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 12 |
| exact+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 57.5 | 60.0 | 0.370 | 7 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 85.7 | 0.431 | 0 |
| exact+keyword | number | dev | 28 | 46.4 | 64.3 | 64.3 | 0.542 | 0 |
| exact+keyword | dev | dev | 17 | 64.7 | 88.2 | 88.2 | 0.723 | 1 |
| exact+keyword | rules | dev | 23 | 30.4 | 56.5 | 56.5 | 0.393 | 2 |
| exact+keyword | stat | dev | 24 | 0.0 | 25.0 | 45.8 | 0.107 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 26 | 11.5 | 50.0 | 61.5 | 0.276 | 2 |
| exact+keyword | cross | test | 10 | 10.0 | 50.0 | 80.0 | 0.307 | 0 |
| exact+keyword | number | test | 19 | 63.2 | 84.2 | 84.2 | 0.724 | 0 |
| exact+keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| exact+keyword | rules | test | 16 | 12.5 | 56.3 | 56.3 | 0.294 | 2 |
| exact+keyword | stat | test | 16 | 0.0 | 37.5 | 56.3 | 0.131 | 0 |
| exact+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+keyword | paraphrase | all | 66 | 18.2 | 54.5 | 60.6 | 0.333 | 9 |
| exact+keyword | cross | all | 24 | 12.5 | 66.7 | 83.3 | 0.379 | 0 |
| exact+keyword | number | all | 47 | 53.2 | 72.3 | 72.3 | 0.615 | 0 |
| exact+keyword | dev | all | 28 | 64.3 | 85.7 | 85.7 | 0.718 | 1 |
| exact+keyword | rules | all | 39 | 23.1 | 56.4 | 56.4 | 0.352 | 4 |
| exact+keyword | stat | all | 40 | 0.0 | 30.0 | 50.0 | 0.116 | 0 |
| exact+linked+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 52.5 | 60.0 | 0.366 | 7 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.827 | 0 |
| exact+linked+keyword | number | dev | 28 | 50.0 | 64.3 | 64.3 | 0.571 | 0 |
| exact+linked+keyword | dev | dev | 17 | 64.7 | 88.2 | 88.2 | 0.723 | 1 |
| exact+linked+keyword | rules | dev | 23 | 30.4 | 52.2 | 60.9 | 0.388 | 2 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.746 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 11.5 | 42.3 | 53.8 | 0.249 | 2 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 100.0 | 100.0 | 0.820 | 0 |
| exact+linked+keyword | number | test | 19 | 52.6 | 73.7 | 78.9 | 0.637 | 0 |
| exact+linked+keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| exact+linked+keyword | rules | test | 16 | 12.5 | 50.0 | 62.5 | 0.289 | 2 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 18.2 | 48.5 | 57.6 | 0.320 | 9 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 100.0 | 100.0 | 0.824 | 0 |
| exact+linked+keyword | number | all | 47 | 51.1 | 68.1 | 70.2 | 0.598 | 0 |
| exact+linked+keyword | dev | all | 28 | 64.3 | 85.7 | 85.7 | 0.718 | 1 |
| exact+linked+keyword | rules | all | 39 | 23.1 | 51.3 | 61.5 | 0.347 | 4 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.697 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); rule:5.12.3 |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q076 | dev | – | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~26 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 26)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~30 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 30)) |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); rule:6.1.1; guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | refused | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:min-gig (Low Gigs (min Gig)); trule:2.1 |
| q131 | rules | – | is there a maximum number of units I can have on the field | rule:5.6.5 | term:signal/units-on-field (units-on-field); card:field_operator (Field Operator); faq:e83fc5f6 |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); trule:3.4; doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); faq:e512816e |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~22 (Keys (part 22)); trule:E.2 |
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~24 (Game review: a rating for every move (src/lib/gameReview.ts) (part 24)); trule:3.3; doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator) |
| q221 | when does the next booster set come out | pkg:relic-loop (The Relic loop (Metal Over Meat)); doc:docs/BOT_TOOLKIT.md#next-turn-terms-bot-3-nextturnterms-in-src-ai-eval-ts (Next-turn terms (BOT-3, nextTurnTerms in src/ai/eval.ts)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~11 (3. Evaluation function (src/ai/eval.ts) (part 11)) |
| q224 | how many cards are in a hearthstone deck | rule:11.17.3; code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

## Scope: public records only (what a checkout without data/raw searches)

3585 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 40.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 136 | 12.5 | 17.6 | 17.6 | 0.145 | 100 | 227 | 8 of 11 (72.7%) | 58 of 136 (42.6%) |
| exact | test | 92 | 16.3 | 25.0 | 25.0 | 0.196 | 122 | 284 | 7 of 7 (100.0%) | 30 of 92 (32.6%) |
| exact | all | 228 | 14.0 | 20.6 | 20.6 | 0.165 | 109 | 232 | 15 of 18 (83.3%) | 88 of 228 (38.6%) |
| keyword | dev | 136 | 36.8 | 52.2 | 55.1 | 0.430 | 468 | 611 | 3 of 11 (27.3%) | 21 of 136 (15.4%) |
| keyword | test | 92 | 25.0 | 47.8 | 51.1 | 0.349 | 517 | 630 | 4 of 7 (57.1%) | 7 of 92 (7.6%) |
| keyword | all | 228 | 32.0 | 50.4 | 53.5 | 0.397 | 488 | 621 | 7 of 18 (38.9%) | 28 of 228 (12.3%) |
| exact+keyword | dev | 136 | 34.6 | 62.5 | 69.1 | 0.464 | 529 | 629 | 2 of 11 (18.2%) | 7 of 136 (5.1%) |
| exact+keyword | test | 92 | 32.6 | 65.2 | 73.9 | 0.463 | 539 | 621 | 4 of 7 (57.1%) | 2 of 92 (2.2%) |
| exact+keyword | all | 228 | 33.8 | 63.6 | 71.1 | 0.464 | 533 | 623 | 6 of 18 (33.3%) | 9 of 228 (3.9%) |
| exact+linked+keyword | dev | 136 | 53.7 | 74.3 | 77.2 | 0.623 | 532 | 662 | 2 of 11 (18.2%) | 7 of 136 (5.1%) |
| exact+linked+keyword | test | 92 | 47.8 | 69.6 | 75.0 | 0.582 | 549 | 649 | 4 of 7 (57.1%) | 2 of 92 (2.2%) |
| exact+linked+keyword | all | 228 | 51.3 | 72.4 | 76.3 | 0.607 | 539 | 652 | 6 of 18 (33.3%) | 9 of 228 (3.9%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 13 | 69.2 | 76.9 | 76.9 | 0.731 | 3 |
| exact | paraphrase | dev | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 34 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 46.4 | 46.4 | 0.327 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 26 | 0.0 | 0.0 | 0.0 | 0.000 | 17 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 68.4 | 68.4 | 0.447 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 23 | 73.9 | 82.6 | 82.6 | 0.783 | 4 |
| exact | paraphrase | all | 66 | 0.0 | 0.0 | 0.0 | 0.000 | 51 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 55.3 | 55.3 | 0.376 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 40 | 27.5 | 55.0 | 57.5 | 0.387 | 8 |
| keyword | cross | dev | 14 | 50.0 | 71.4 | 85.7 | 0.616 | 0 |
| keyword | number | dev | 28 | 32.1 | 35.7 | 35.7 | 0.333 | 5 |
| keyword | dev | dev | 17 | 58.8 | 88.2 | 94.1 | 0.693 | 0 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 8 |
| keyword | entity | test | 10 | 60.0 | 100.0 | 100.0 | 0.800 | 0 |
| keyword | paraphrase | test | 26 | 15.4 | 50.0 | 53.8 | 0.314 | 4 |
| keyword | cross | test | 10 | 40.0 | 60.0 | 80.0 | 0.474 | 0 |
| keyword | number | test | 19 | 15.8 | 31.6 | 31.6 | 0.208 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| keyword | entity | all | 23 | 82.6 | 100.0 | 100.0 | 0.913 | 0 |
| keyword | paraphrase | all | 66 | 22.7 | 53.0 | 56.1 | 0.358 | 12 |
| keyword | cross | all | 24 | 45.8 | 66.7 | 83.3 | 0.557 | 0 |
| keyword | number | all | 47 | 25.5 | 34.0 | 34.0 | 0.283 | 6 |
| keyword | dev | all | 28 | 57.1 | 85.7 | 89.3 | 0.680 | 0 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 10 |
| exact+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 40 | 22.5 | 57.5 | 60.0 | 0.365 | 7 |
| exact+keyword | cross | dev | 14 | 14.3 | 71.4 | 85.7 | 0.426 | 0 |
| exact+keyword | number | dev | 28 | 46.4 | 64.3 | 64.3 | 0.542 | 0 |
| exact+keyword | dev | dev | 17 | 58.8 | 88.2 | 94.1 | 0.693 | 0 |
| exact+keyword | stat | dev | 24 | 0.0 | 25.0 | 45.8 | 0.111 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 26 | 11.5 | 50.0 | 61.5 | 0.281 | 2 |
| exact+keyword | cross | test | 10 | 10.0 | 50.0 | 80.0 | 0.320 | 0 |
| exact+keyword | number | test | 19 | 63.2 | 84.2 | 84.2 | 0.724 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| exact+keyword | stat | test | 16 | 0.0 | 43.8 | 56.3 | 0.131 | 0 |
| exact+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+keyword | paraphrase | all | 66 | 18.2 | 54.5 | 60.6 | 0.332 | 9 |
| exact+keyword | cross | all | 24 | 12.5 | 62.5 | 83.3 | 0.382 | 0 |
| exact+keyword | number | all | 47 | 53.2 | 72.3 | 72.3 | 0.615 | 0 |
| exact+keyword | dev | all | 28 | 57.1 | 85.7 | 89.3 | 0.680 | 0 |
| exact+keyword | stat | all | 40 | 0.0 | 32.5 | 50.0 | 0.119 | 0 |
| exact+linked+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 40 | 22.5 | 57.5 | 60.0 | 0.365 | 7 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 92.9 | 100.0 | 0.821 | 0 |
| exact+linked+keyword | number | dev | 28 | 50.0 | 64.3 | 64.3 | 0.571 | 0 |
| exact+linked+keyword | dev | dev | 17 | 58.8 | 88.2 | 94.1 | 0.693 | 0 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.746 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 26 | 11.5 | 42.3 | 57.7 | 0.267 | 2 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 100.0 | 100.0 | 0.825 | 0 |
| exact+linked+keyword | number | test | 19 | 52.6 | 73.7 | 78.9 | 0.637 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+linked+keyword | paraphrase | all | 66 | 18.2 | 51.5 | 59.1 | 0.326 | 9 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.823 | 0 |
| exact+linked+keyword | number | all | 47 | 51.1 | 68.1 | 70.2 | 0.598 | 0 |
| exact+linked+keyword | dev | all | 28 | 57.1 | 85.7 | 89.3 | 0.680 | 0 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.697 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); objective:YYY-ripbecca (Addin' Trash game plan); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); doc:docs/STRATEGY.md#season-2-8-new-decks-2026-11-12 (Season 2 (8 new decks, 2026-11-12)) |
| q031 | paraphrase | refused | strategy where you destroy your own equipment to get something out of it | pkg:gear-sacrifice |  |
| q043 | paraphrase | refused | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q076 | dev | – | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~26 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 26)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~30 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 30)) |
| q143 | number | – | how good is rrb wakako midrange | rating:meta-rrb-wakako-midrange | deck:meta-rrb-wakako-midrange (RRB Wakako Midrange); guide:rrb-wakako-midrange#playing-against-it (RRB Wakako Midrange: Playing against it); guide:rrb-wakako-midrange#intro (RRB Wakako Midrange) |
| q147 | paraphrase | refused | is there a program that makes both players dump their whole hand and draw five new cards | card:shattered_memories |  |
| q156 | paraphrase | refused | what does the number comparing win rate in games where a card showed up versus games where it didn't actually mean | term:when-drawn-iwd |  |
| q157 | paraphrase | – | legend that lets me reroll a die I didn't like when I roll it in at the start of my turn | card:kerry_eurodyne_axe_attitude_audience | objective:RBY-samurai (Samurai game plan); guide:fundamentals#economy-checklist (Fundamentals: Economy checklist); doc:docs/GAME_RECORD.md#the-game~2 (The game (part 2)) |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)); doc:docs/GAME_RECORD.md#the-game (The game) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); pkg:rocker (Rocker Units (Johnny Silverhand)) |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~22 (Keys (part 22)); doc:docs/SITE_CONFIG.md#keys~21 (Keys (part 21)) |
| q127 | what time does my local game store open on saturdays | doc:docs/BOT_TOOLKIT.md#game-review-a-rating-for-every-move-src-lib-gamereview-ts~24 (Game review: a rating for every move (src/lib/gameReview.ts) (part 24)); doc:README.md#night-city-trainer-cyberpunk-tcg-practice-simulator (Night City Trainer — Cyberpunk TCG practice simulator); doc:docs/SITE_CONFIG.md#keys~9 (Keys (part 9)) |
| q221 | when does the next booster set come out | pkg:relic-loop (The Relic loop (Metal Over Meat)); doc:docs/BOT_TOOLKIT.md#next-turn-terms-bot-3-nextturnterms-in-src-ai-eval-ts (Next-turn terms (BOT-3, nextTurnTerms in src/ai/eval.ts)); doc:CLAUDE.md#bots (Bots) |
| q224 | how many cards are in a hearthstone deck | code:src/lib/deckSearch.ts (src/lib/deckSearch.ts); doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/SYNERGIES.md#deck-lab-lab~3 (Deck Lab (#/lab) (part 3)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

