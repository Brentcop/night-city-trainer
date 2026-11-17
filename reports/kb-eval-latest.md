# Knowledge pack evaluation

Written by `npm run kb:eval -- --out` (scripts/kb-eval.ts, docs/RAG_PLAN.md step 1.4). Ids and public titles only,
never record text (a local-only record shows by its id). Recall at k: the share of questions with an expected
record in the first k results. MRR at 10: the mean of 1 / rank of the first expected record (0 when it is not in
the first 10). Tokens: the plain-text answer at 5 results, characters / 4. These are over the answerable
questions (`n`). None refused: the questions the pack cannot answer (type none) for which the search said "no
match", which is right. Wrongly refused: answerable questions for which it said "no match".

Question set: `data/kb/questions.json` (draft), 352 questions. Types: entity 24, paraphrase 132, cross 24, number 47, dev 28, rules 39, stat 40, none 18.
Scopes: public 312, local 40. Splits: dev 210, test 142. Shown here: split all.

## Scope: all records (the local pack, with data/raw when present)

5655 records searched; local records present. Questions skipped (nothing they expect is in this pack): 0.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 199 | 9.0 | 12.6 | 12.6 | 0.104 | 88 | 218 | 8 of 11 (72.7%) | 96 of 199 (48.2%) |
| exact | test | 135 | 11.9 | 17.8 | 17.8 | 0.141 | 104 | 227 | 7 of 7 (100.0%) | 54 of 135 (40.0%) |
| exact | all | 334 | 10.2 | 14.7 | 14.7 | 0.119 | 95 | 222 | 15 of 18 (83.3%) | 150 of 334 (44.9%) |
| keyword | dev | 199 | 33.2 | 49.7 | 54.8 | 0.401 | 473 | 626 | 3 of 11 (27.3%) | 33 of 199 (16.6%) |
| keyword | test | 135 | 29.6 | 53.3 | 59.3 | 0.394 | 525 | 642 | 1 of 7 (14.3%) | 11 of 135 (8.1%) |
| keyword | all | 334 | 31.7 | 51.2 | 56.6 | 0.398 | 494 | 629 | 4 of 18 (22.2%) | 44 of 334 (13.2%) |
| exact+keyword | dev | 199 | 29.6 | 58.3 | 66.8 | 0.417 | 516 | 632 | 2 of 11 (18.2%) | 14 of 199 (7.0%) |
| exact+keyword | test | 135 | 29.6 | 64.4 | 74.8 | 0.435 | 529 | 629 | 1 of 7 (14.3%) | 6 of 135 (4.4%) |
| exact+keyword | all | 334 | 29.6 | 60.8 | 70.1 | 0.424 | 521 | 630 | 3 of 18 (16.7%) | 20 of 334 (6.0%) |
| exact+linked+keyword | dev | 199 | 42.7 | 64.3 | 69.8 | 0.518 | 518 | 656 | 2 of 11 (18.2%) | 14 of 199 (7.0%) |
| exact+linked+keyword | test | 135 | 40.0 | 64.4 | 72.6 | 0.505 | 530 | 649 | 1 of 7 (14.3%) | 6 of 135 (4.4%) |
| exact+linked+keyword | all | 334 | 41.6 | 64.4 | 71.0 | 0.513 | 523 | 650 | 3 of 18 (16.7%) | 20 of 334 (6.0%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 14 | 71.4 | 78.6 | 78.6 | 0.750 | 3 |
| exact | paraphrase | dev | 79 | 0.0 | 0.0 | 0.0 | 0.000 | 56 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 46.4 | 46.4 | 0.327 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | rules | dev | 23 | 0.0 | 0.0 | 0.0 | 0.000 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 53 | 1.9 | 1.9 | 1.9 | 0.019 | 32 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 68.4 | 68.4 | 0.447 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | rules | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 9 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 24 | 75.0 | 83.3 | 83.3 | 0.792 | 4 |
| exact | paraphrase | all | 132 | 0.8 | 0.8 | 0.8 | 0.008 | 88 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 55.3 | 55.3 | 0.376 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | rules | all | 39 | 0.0 | 0.0 | 0.0 | 0.000 | 25 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 79 | 27.8 | 50.6 | 58.2 | 0.371 | 16 |
| keyword | cross | dev | 14 | 42.9 | 64.3 | 78.6 | 0.533 | 0 |
| keyword | number | dev | 28 | 28.6 | 35.7 | 35.7 | 0.321 | 4 |
| keyword | dev | dev | 17 | 52.9 | 82.4 | 82.4 | 0.620 | 1 |
| keyword | rules | dev | 23 | 30.4 | 47.8 | 56.5 | 0.406 | 2 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 10 |
| keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| keyword | paraphrase | test | 53 | 24.5 | 60.4 | 67.9 | 0.396 | 7 |
| keyword | cross | test | 10 | 40.0 | 50.0 | 80.0 | 0.458 | 0 |
| keyword | number | test | 19 | 21.1 | 31.6 | 31.6 | 0.247 | 1 |
| keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| keyword | rules | test | 16 | 25.0 | 62.5 | 68.8 | 0.378 | 1 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| keyword | paraphrase | all | 132 | 26.5 | 54.5 | 62.1 | 0.381 | 23 |
| keyword | cross | all | 24 | 41.7 | 58.3 | 79.2 | 0.502 | 0 |
| keyword | number | all | 47 | 25.5 | 34.0 | 34.0 | 0.291 | 5 |
| keyword | dev | all | 28 | 57.1 | 82.1 | 82.1 | 0.656 | 1 |
| keyword | rules | all | 39 | 28.2 | 53.8 | 61.5 | 0.394 | 3 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 12 |
| exact+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 79 | 17.7 | 51.9 | 62.0 | 0.324 | 11 |
| exact+keyword | cross | dev | 14 | 14.3 | 78.6 | 92.9 | 0.438 | 0 |
| exact+keyword | number | dev | 28 | 46.4 | 64.3 | 64.3 | 0.539 | 0 |
| exact+keyword | dev | dev | 17 | 52.9 | 82.4 | 82.4 | 0.620 | 1 |
| exact+keyword | rules | dev | 23 | 30.4 | 47.8 | 56.5 | 0.388 | 2 |
| exact+keyword | stat | dev | 24 | 0.0 | 29.2 | 50.0 | 0.116 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 53 | 17.0 | 58.5 | 71.7 | 0.334 | 5 |
| exact+keyword | cross | test | 10 | 10.0 | 50.0 | 80.0 | 0.305 | 0 |
| exact+keyword | number | test | 19 | 68.4 | 84.2 | 84.2 | 0.747 | 0 |
| exact+keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| exact+keyword | rules | test | 16 | 12.5 | 56.3 | 68.8 | 0.297 | 1 |
| exact+keyword | stat | test | 16 | 0.0 | 43.8 | 56.3 | 0.134 | 0 |
| exact+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+keyword | paraphrase | all | 132 | 17.4 | 54.5 | 65.9 | 0.328 | 16 |
| exact+keyword | cross | all | 24 | 12.5 | 66.7 | 87.5 | 0.383 | 0 |
| exact+keyword | number | all | 47 | 55.3 | 72.3 | 72.3 | 0.623 | 0 |
| exact+keyword | dev | all | 28 | 57.1 | 82.1 | 82.1 | 0.656 | 1 |
| exact+keyword | rules | all | 39 | 23.1 | 51.3 | 61.5 | 0.350 | 3 |
| exact+keyword | stat | all | 40 | 0.0 | 35.0 | 52.5 | 0.123 | 0 |
| exact+linked+keyword | entity | dev | 14 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 79 | 17.7 | 48.1 | 57.0 | 0.308 | 11 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 100.0 | 100.0 | 0.827 | 0 |
| exact+linked+keyword | number | dev | 28 | 50.0 | 64.3 | 64.3 | 0.571 | 0 |
| exact+linked+keyword | dev | dev | 17 | 52.9 | 82.4 | 82.4 | 0.620 | 1 |
| exact+linked+keyword | rules | dev | 23 | 30.4 | 47.8 | 60.9 | 0.384 | 2 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.746 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 53 | 17.0 | 49.1 | 62.3 | 0.302 | 5 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 100.0 | 100.0 | 0.820 | 0 |
| exact+linked+keyword | number | test | 19 | 57.9 | 73.7 | 78.9 | 0.664 | 0 |
| exact+linked+keyword | dev | test | 11 | 63.6 | 81.8 | 81.8 | 0.712 | 0 |
| exact+linked+keyword | rules | test | 16 | 12.5 | 50.0 | 68.8 | 0.285 | 1 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 24 | 91.7 | 100.0 | 100.0 | 0.958 | 0 |
| exact+linked+keyword | paraphrase | all | 132 | 17.4 | 48.5 | 59.1 | 0.305 | 16 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 100.0 | 100.0 | 0.824 | 0 |
| exact+linked+keyword | number | all | 47 | 53.2 | 68.1 | 70.2 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 28 | 57.1 | 82.1 | 82.1 | 0.656 | 1 |
| exact+linked+keyword | rules | all | 39 | 23.1 | 48.7 | 64.1 | 0.343 | 3 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.697 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5); code:src/ui/components/board/drag.tsx (src/ui/components/board/drag.tsx) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); rule:5.12.3 |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q076 | dev | – | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~35 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 35)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~38 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 38)) |
| q081 | rules | – | what happens if both players reach seven gigs at the same moment | rule:1.13.1 | doc:docs/DECISION_TELEMETRY.md#hidden-information~2 (Hidden information (part 2)); doc:docs/SYNERGIES.md#a-shortlist-carried-across-runs-src-lib-shortlist-ts~13 (A shortlist carried across runs (src/lib/shortlist.ts) (part 13)); guide:fundamentals#how-games-are-actually-won (Fundamentals: How games are actually won) |
| q085 | rules | refused | one effect lets me do something and another forbids it, which one wins | rule:2.6 |  |
| q091 | rules | – | is there a cap on how many eddies I can have | rule:5.8.2.1 | term:eddies (Eddies (€$)); term:signal/eddies (eddies); rule:5.8 |
| q098 | rules | – | are any cards banned or restricted in organized play | trule:B | term:condition/any (any); pkg:min-gig (Low Gigs (min Gig)); trule:2.1 |
| q131 | rules | – | is there a maximum number of units I can have on the field | rule:5.6.5 | term:signal/units-on-field (units-on-field); card:field_operator (Field Operator); faq:e83fc5f6 |
| q134 | rules | refused | am I allowed to look through my opponent's discard pile | rule:5.9.2 |  |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/ROADMAP2.md#13-goals-added-by-the-owner-2026-11-16~11 (13. Goals added by the owner (2026-11-16) (part 11)); doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); faq:e512816e |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~26 (Keys (part 26)); doc:docs/SITE_CONFIG.md#keys~25 (Keys (part 25)) |
| q127 | what time does my local game store open on saturdays | doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~34 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 34)); doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~13 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 13)); doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~11 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 11)) |
| q221 | when does the next booster set come out | pkg:relic-loop (The Relic loop (Metal Over Meat)); doc:docs/BOT_TOOLKIT.md#next-turn-terms-bot-3-nextturnterms-in-src-ai-eval-ts (Next-turn terms (BOT-3, nextTurnTerms in src/ai/eval.ts)); doc:docs/EVIDENCE.md#the-page~11 (The page (part 11)) |
| q224 | how many cards are in a hearthstone deck | rule:11.17.3; doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/REVIEW_2026-11-16.md#found-wrong-on-the-way~2 (Found wrong on the way (part 2)) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

## Scope: public records only (what a checkout without data/raw searches)

4631 records searched; local records absent. Questions skipped (nothing they expect is in this pack): 40.
Stale expectations: none.

### By configuration and split

| configuration | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | tokens mean | tokens p90 | none refused | wrongly refused |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| exact | dev | 175 | 9.7 | 13.7 | 13.7 | 0.112 | 94 | 224 | 8 of 11 (72.7%) | 80 of 175 (45.7%) |
| exact | test | 119 | 13.4 | 20.2 | 20.2 | 0.160 | 109 | 232 | 7 of 7 (100.0%) | 45 of 119 (37.8%) |
| exact | all | 294 | 11.2 | 16.3 | 16.3 | 0.132 | 100 | 226 | 15 of 18 (83.3%) | 125 of 294 (42.5%) |
| keyword | dev | 175 | 33.1 | 48.0 | 55.4 | 0.397 | 475 | 626 | 3 of 11 (27.3%) | 29 of 175 (16.6%) |
| keyword | test | 119 | 31.9 | 54.6 | 58.0 | 0.411 | 527 | 644 | 4 of 7 (57.1%) | 9 of 119 (7.6%) |
| keyword | all | 294 | 32.7 | 50.7 | 56.5 | 0.402 | 496 | 626 | 7 of 18 (38.9%) | 38 of 294 (12.9%) |
| exact+keyword | dev | 175 | 29.7 | 57.1 | 68.6 | 0.420 | 518 | 630 | 2 of 11 (18.2%) | 13 of 175 (7.4%) |
| exact+keyword | test | 119 | 32.8 | 67.2 | 75.6 | 0.466 | 534 | 629 | 4 of 7 (57.1%) | 4 of 119 (3.4%) |
| exact+keyword | all | 294 | 31.0 | 61.2 | 71.4 | 0.439 | 524 | 629 | 6 of 18 (33.3%) | 17 of 294 (5.8%) |
| exact+linked+keyword | dev | 175 | 44.6 | 65.1 | 72.0 | 0.537 | 522 | 668 | 2 of 11 (18.2%) | 13 of 175 (7.4%) |
| exact+linked+keyword | test | 119 | 44.5 | 68.9 | 73.9 | 0.552 | 542 | 650 | 4 of 7 (57.1%) | 4 of 119 (3.4%) |
| exact+linked+keyword | all | 294 | 44.6 | 66.7 | 72.8 | 0.543 | 530 | 653 | 6 of 18 (33.3%) | 17 of 294 (5.8%) |

### By question type

| configuration | type | split | n | R@1 % | R@5 % | R@10 % | MRR@10 | refused |
|---|---|---|---:|---:|---:|---:|---:|---:|
| exact | entity | dev | 13 | 69.2 | 76.9 | 76.9 | 0.731 | 3 |
| exact | paraphrase | dev | 79 | 0.0 | 0.0 | 0.0 | 0.000 | 56 |
| exact | cross | dev | 14 | 0.0 | 0.0 | 0.0 | 0.000 | 3 |
| exact | number | dev | 28 | 25.0 | 46.4 | 46.4 | 0.327 | 2 |
| exact | dev | dev | 17 | 5.9 | 5.9 | 5.9 | 0.059 | 16 |
| exact | stat | dev | 24 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | test | 10 | 80.0 | 90.0 | 90.0 | 0.850 | 1 |
| exact | paraphrase | test | 53 | 1.9 | 1.9 | 1.9 | 0.019 | 32 |
| exact | cross | test | 10 | 10.0 | 10.0 | 10.0 | 0.100 | 0 |
| exact | number | test | 19 | 31.6 | 68.4 | 68.4 | 0.447 | 2 |
| exact | dev | test | 11 | 0.0 | 0.0 | 0.0 | 0.000 | 10 |
| exact | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| exact | entity | all | 23 | 73.9 | 82.6 | 82.6 | 0.783 | 4 |
| exact | paraphrase | all | 132 | 0.8 | 0.8 | 0.8 | 0.008 | 88 |
| exact | cross | all | 24 | 4.2 | 4.2 | 4.2 | 0.042 | 3 |
| exact | number | all | 47 | 27.7 | 55.3 | 55.3 | 0.376 | 4 |
| exact | dev | all | 28 | 3.6 | 3.6 | 3.6 | 0.036 | 26 |
| exact | stat | all | 40 | 0.0 | 0.0 | 0.0 | 0.000 | 0 |
| keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| keyword | paraphrase | dev | 79 | 27.8 | 49.4 | 60.8 | 0.374 | 16 |
| keyword | cross | dev | 14 | 42.9 | 57.1 | 78.6 | 0.532 | 0 |
| keyword | number | dev | 28 | 28.6 | 35.7 | 35.7 | 0.315 | 4 |
| keyword | dev | dev | 17 | 52.9 | 76.5 | 82.4 | 0.615 | 1 |
| keyword | stat | dev | 24 | 0.0 | 4.2 | 4.2 | 0.008 | 8 |
| keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| keyword | paraphrase | test | 53 | 30.2 | 64.2 | 67.9 | 0.437 | 6 |
| keyword | cross | test | 10 | 40.0 | 60.0 | 80.0 | 0.472 | 0 |
| keyword | number | test | 19 | 21.1 | 31.6 | 31.6 | 0.247 | 1 |
| keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| keyword | stat | test | 16 | 0.0 | 0.0 | 0.0 | 0.000 | 2 |
| keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| keyword | paraphrase | all | 132 | 28.8 | 55.3 | 63.6 | 0.399 | 22 |
| keyword | cross | all | 24 | 41.7 | 58.3 | 79.2 | 0.507 | 0 |
| keyword | number | all | 47 | 25.5 | 34.0 | 34.0 | 0.288 | 5 |
| keyword | dev | all | 28 | 53.6 | 78.6 | 82.1 | 0.632 | 1 |
| keyword | stat | all | 40 | 0.0 | 2.5 | 2.5 | 0.005 | 10 |
| exact+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+keyword | paraphrase | dev | 79 | 19.0 | 50.6 | 63.3 | 0.331 | 12 |
| exact+keyword | cross | dev | 14 | 14.3 | 71.4 | 92.9 | 0.437 | 0 |
| exact+keyword | number | dev | 28 | 46.4 | 64.3 | 64.3 | 0.539 | 0 |
| exact+keyword | dev | dev | 17 | 52.9 | 76.5 | 82.4 | 0.615 | 1 |
| exact+keyword | stat | dev | 24 | 0.0 | 25.0 | 50.0 | 0.117 | 0 |
| exact+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+keyword | paraphrase | test | 53 | 20.8 | 62.3 | 71.7 | 0.370 | 4 |
| exact+keyword | cross | test | 10 | 10.0 | 50.0 | 80.0 | 0.318 | 0 |
| exact+keyword | number | test | 19 | 68.4 | 84.2 | 84.2 | 0.750 | 0 |
| exact+keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| exact+keyword | stat | test | 16 | 0.0 | 43.8 | 56.3 | 0.138 | 0 |
| exact+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+keyword | paraphrase | all | 132 | 19.7 | 55.3 | 66.7 | 0.346 | 16 |
| exact+keyword | cross | all | 24 | 12.5 | 62.5 | 87.5 | 0.387 | 0 |
| exact+keyword | number | all | 47 | 55.3 | 72.3 | 72.3 | 0.624 | 0 |
| exact+keyword | dev | all | 28 | 53.6 | 78.6 | 82.1 | 0.632 | 1 |
| exact+keyword | stat | all | 40 | 0.0 | 32.5 | 52.5 | 0.125 | 0 |
| exact+linked+keyword | entity | dev | 13 | 100.0 | 100.0 | 100.0 | 1.000 | 0 |
| exact+linked+keyword | paraphrase | dev | 79 | 19.0 | 48.1 | 59.5 | 0.318 | 12 |
| exact+linked+keyword | cross | dev | 14 | 71.4 | 92.9 | 100.0 | 0.821 | 0 |
| exact+linked+keyword | number | dev | 28 | 50.0 | 64.3 | 64.3 | 0.571 | 0 |
| exact+linked+keyword | dev | dev | 17 | 52.9 | 76.5 | 82.4 | 0.615 | 1 |
| exact+linked+keyword | stat | dev | 24 | 70.8 | 79.2 | 83.3 | 0.749 | 0 |
| exact+linked+keyword | entity | test | 10 | 80.0 | 100.0 | 100.0 | 0.900 | 0 |
| exact+linked+keyword | paraphrase | test | 53 | 20.8 | 54.7 | 64.2 | 0.351 | 4 |
| exact+linked+keyword | cross | test | 10 | 70.0 | 100.0 | 100.0 | 0.825 | 0 |
| exact+linked+keyword | number | test | 19 | 57.9 | 73.7 | 78.9 | 0.664 | 0 |
| exact+linked+keyword | dev | test | 11 | 54.5 | 81.8 | 81.8 | 0.659 | 0 |
| exact+linked+keyword | stat | test | 16 | 62.5 | 62.5 | 62.5 | 0.625 | 0 |
| exact+linked+keyword | entity | all | 23 | 91.3 | 100.0 | 100.0 | 0.957 | 0 |
| exact+linked+keyword | paraphrase | all | 132 | 19.7 | 50.8 | 61.4 | 0.331 | 16 |
| exact+linked+keyword | cross | all | 24 | 70.8 | 95.8 | 100.0 | 0.823 | 0 |
| exact+linked+keyword | number | all | 47 | 53.2 | 68.1 | 70.2 | 0.609 | 0 |
| exact+linked+keyword | dev | all | 28 | 53.6 | 78.6 | 82.1 | 0.632 | 1 |
| exact+linked+keyword | stat | all | 40 | 67.5 | 72.5 | 75.0 | 0.699 | 0 |

### Worst dev questions under exact+linked+keyword

Rank "–" means no expected record in the first 10; "refused" means the search said "no match". "Ranked above" lists up to three records before it.

| question | type | rank | asked | expected (first) | ranked above |
|---|---|---:|---|---|---|
| q021 | paraphrase | – | which card wipes every other unit off the board when it comes in | card:adam_smasher_metal_over_meat | pkg:relic-loop (The Relic loop (Metal Over Meat)); ruling:f5220c5b (Jackie Welles: Mama's Favorite ruling 5); code:src/ui/components/board/drag.tsx (src/ui/components/board/drag.tsx) |
| q026 | paraphrase | – | package about keeping my total dice score under the opponent's | pkg:low-cred | doc:docs/REVIEW_FINDINGS.md#3-refinement-backlog-input-for-the-next-round~2 (3. Refinement backlog (input for the next round) (part 2)); doc:docs/BOT_TOOLKIT.md#3-evaluation-function-src-ai-eval-ts~3 (3. Evaluation function (src/ai/eval.ts) (part 3)); doc:docs/SYNERGIES.md#how-scoring-uses-packages-src-ai-packages-ts~6 (How scoring uses packages (src/ai/packages.ts) (part 6)) |
| q043 | paraphrase | refused | how do triggered abilities wait while another effect is still resolving | term:pending-effects |  |
| q045 | paraphrase | – | unit whose entry effect taps both itself and an enemy unit | card:offduty_malfini | pkg:spend-punish (Spend, then punish); doc:docs/SYNERGIES.md#owner-review-2026-11-12~6 (Owner review, 2026-11-12 (part 6)); pkg:forced-attacks (Forced attacks into Blockers) |
| q076 | dev | – | where are the settings for the easy medium and hard bots defined | code:src/ai/tiers.ts | term:bot-difficulty-easy-medium-hard (Bot difficulty (Easy / Medium / Hard)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~35 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 35)); doc:docs/BOT_TOOLKIT.md#6-difficulty-tiers-and-strength-check-src-ai-tiers-ts~38 (6. Difficulty tiers and strength check (src/ai/tiers.ts) (part 38)) |
| q143 | number | – | how good is rrb wakako midrange | rating:meta-rrb-wakako-midrange | deck:meta-rrb-wakako-midrange (RRB Wakako Midrange); guide:rrb-wakako-midrange#playing-against-it (RRB Wakako Midrange: Playing against it); guide:rrb-wakako-midrange#intro (RRB Wakako Midrange) |
| q147 | paraphrase | refused | is there a program that makes both players dump their whole hand and draw five new cards | card:shattered_memories |  |
| q151 | paraphrase | refused | how does the list that pays for things with its legends and then sends those same legends in as surprise attackers want to win | objective:nc-08-merc-contract-rrg |  |
| q156 | paraphrase | refused | what does the number comparing win rate in games where a card showed up versus games where it didn't actually mean | term:when-drawn-iwd |  |
| q159 | paraphrase | – | how do I beat the budget three colour deck built out of commons | guide:rainbow-fixer-stuff#playing-against-it | guide:rainbow-fixer-stuff#intro (Rainbow Fixer Stuff); guide:gry-trauma-team#playing-against-it (GRY Trauma Team: Playing against it); doc:docs/SYNERGIES.md#using-packages-when-building-src-lib-deckpackages-ts~6 (Using packages when building (src/lib/deckPackages.ts) (part 6)) |

### Dev questions the pack cannot answer, answered anyway under exact+linked+keyword

| question | asked | first results |
|---|---|---|
| q117 | what does the card neon samurai overlord do | deck:RBY-samurai (Samurai); objective:RBY-samurai (Samurai game plan); card:kerry_eurodyne_the_last_rockerboy (Kerry Eurodyne: The Last Rockerboy) |
| q121 | is there an iphone app I can download | doc:docs/IMPROVEMENT_BACKLOG.md#wp-c3-pages-accessibility-css-and-structure~2 (WP-C3 · Pages accessibility, CSS and structure (part 2)); doc:docs/REVIEW_2026-11-13.md#newer-features-app~5 (Newer features (APP) (part 5)); code:src/lib/download.ts (src/lib/download.ts) |
| q122 | how many players are in a game of magic the gathering commander | doc:docs/ROADMAP2.md#13-goals-added-by-the-owner-2026-11-16~11 (13. Goals added by the owner (2026-11-16) (part 11)); doc:docs/DECISION_TELEMETRY.md#record-schema-version-1~3 (Record schema (version 1) (part 3)); doc:docs/IMPROVEMENT_BACKLOG.md#wp-c4-type-hardening-and-engine-structure~3 (WP-C4 · Type hardening and engine structure (part 3)) |
| q124 | what is a foil johnny silverhand selling for on ebay | card:johnny_silverhand_never_stop_fighting (Johnny Silverhand: Never Stop Fighting); card:johnny_silverhand_rocking_renegade (Johnny Silverhand: Rocking Renegade); pkg:rocker (Rocker Units (Johnny Silverhand)) |
| q126 | how do I connect my discord account to the site | doc:docs/RELAY_PROTOCOL.md#versioning (Versioning); doc:docs/SITE_CONFIG.md#keys~26 (Keys (part 26)); doc:docs/SITE_CONFIG.md#keys~25 (Keys (part 25)) |
| q127 | what time does my local game store open on saturdays | doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~34 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 34)); doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~13 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 13)); doc:docs/SYNERGIES.md#pooling-held-out-games-across-runs-src-lib-changeledger-ts-scripts-ledger-store-ts~11 (Pooling held-out games across runs (src/lib/changeLedger.ts, scripts/ledger-store.ts) (part 11)) |
| q221 | when does the next booster set come out | pkg:relic-loop (The Relic loop (Metal Over Meat)); doc:docs/BOT_TOOLKIT.md#next-turn-terms-bot-3-nextturnterms-in-src-ai-eval-ts (Next-turn terms (BOT-3, nextTurnTerms in src/ai/eval.ts)); doc:docs/EVIDENCE.md#the-page~11 (The page (part 11)) |
| q224 | how many cards are in a hearthstone deck | doc:docs/ROADMAP2.md#1-synergy-packages-and-evidence-thresholds-requested-2026-11-11~5 (1. Synergy packages and evidence thresholds (requested 2026-11-11) (part 5)); doc:docs/REVIEW_2026-11-16.md#found-wrong-on-the-way~2 (Found wrong on the way (part 2)); doc:docs/SYNERGIES.md#synergy-packages (Synergy packages) |
| q226 | who drew the art on the judy alvarez cards | card:judy_alvarez_braindance_maestro (Judy Álvarez: Braindance Maestro); card:judy_alvarez_nothing_to_doubt (Judy Álvarez: Nothing to Doubt); ruling:3dbd8dd8 (Judy Álvarez: Braindance Maestro ruling 1) |

