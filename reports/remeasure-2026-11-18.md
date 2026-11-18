# Bots re-measured on SIM_VERSION 9 (2026-11-18)

ROADMAP2 §11 batch B, items 7 to 11. Measured on the current code (commit `253dd03`, SIM_VERSION 9, the active library of 71 decks: 41 in `data/decks/`, 30 in `data/decks/custom/`). Nothing in the bots, weights, engine, data or scripts was changed; the only files written are this report and the "last measured" sentences of `docs/BOT_TOOLKIT.md`.

Machine: Windows, Node 22, every simulation at `--threads 6` (another agent was running test suites on the same machine; seeds are fixed, so results do not depend on load, only the timings do). All runs together took 68 minutes of wall time (08:32 to 09:40). Logs and result files were kept outside the repository. The game cache (`.cache/games/`, gitignored) was empty at the start.

The tier specs are `TIER_SETTINGS` (`src/ai/tiers.ts`), which `TIER_SPECS` / `HARD_SPEC` in `scripts/agent-spec.ts` are (`tests/impact-uses.test.ts`):

- Easy `{"lookahead":false,"noise":0,"easyGuard":true}`
- Medium `{"noise":0.15,"profiles":"best"}`
- Hard `{"noise":0.15,"deep":3,"deepAttacks":0,"deepReactions":3,"sellLookahead":3,"mulligan":"plain","profiles":"best"}`

## Summary

| Item | Now (SIM_VERSION 9, 2026-11-18) | Before | Conclusion |
|---|---|---|---|
| 7. Hard vs Medium, meta `--per 10` | **68.0% [65.5, 70.5]** | 67.0% [64.6, 69.5] (v8), 64.4% [61.9, 66.9] (v6) | unchanged |
| 7. Medium vs Easy, meta `--per 10` | **77.4% [74.7, 80.0]** | 79.8% [77.1, 82.4] (v8), 76.5% [74.0, 79.1] (v6) | unchanged within the noise (2.4 points lower than v8, not significant) |
| 7. Hard vs Medium, all 71 decks `--per 1` | **61.8% [61.1, 62.5]** | none | new: the margin is smaller across the library than on the meta decks |
| 7. Medium vs Easy, all 71 decks `--per 2` | **72.2% [71.7, 72.8]** | none | new: same, about 5 points smaller than on the meta decks |
| 8. Rank stability Medium vs Hard, all 71 decks `--per 2` | **rho 0.899 [0.844, 0.896]** | 0.867 [0.797, 0.888] (v6, 47 decks), 0.75 [0.71, 0.80] (v5) | as stable as on v6, a little higher |
| 8. Rank stability, meta `--per 50` | **rho 0.750 [0.500, 0.883]** | 0.36 [0.32, 0.76] (v5) | much more stable than on v5 |
| 9. Calibration of `DEFAULT_WEIGHTS`, all decks `--per 2` | held-out log-loss **0.526** (Brier 0.182); refit 0.497; gap 0.029 | 0.515 (0.178); refit 0.486; gap 0.029 (v6, 47 decks) | the shipped weights lose no ground against their own refit; both losses are 0.011 higher on the larger field |
| 10. Benchmark regret (156 counted positions, `--reps 3`) | Easy 5.0 [3.7, 6.2], Medium 4.9 [3.6, 6.2], Hard 4.8 [3.5, 6.1] | v6 build: Easy 5.3, Medium 5.1, Hard 5.8 | order now as expected in the point estimates, but still no separation (Easy − Hard +0.2 [−1.0, 1.4]) |
| 11. Game review stability, `--games 12 --seed 3` | Mistake or worse kept 97% (38/39), within one step 98.6%, accuracy moved 3.4 | 86% (32/37), 98.0%, 4.8 (v8, with confirmation 16) | at least as stable; other games, so not a same-games comparison |

Nothing is worse than before beyond the noise. Two things the docs do not say and a reader could get wrong: the tier margins on the whole library are smaller than the meta-deck figures the docs quote (item 7), and `rank-stability.ts --per 1` gives a degenerate bootstrap (item 8).

## 7. The tier ladder

Commands (from the repository root; `$HARD`, `$MED`, `$EASY` are the specs above):

```
npx tsx scripts/botcheck.ts "$HARD" "$MED"  --per 10 --decks meta --seed 61001 --threads 6 --cache
npx tsx scripts/botcheck.ts "$MED"  "$EASY" --per 10 --decks meta --seed 61001 --threads 6 --cache
npx tsx scripts/botcheck.ts "$HARD" "$MED"  --per 1  --decks all  --seed 90001 --threads 6 --cache
npx tsx scripts/botcheck.ts "$MED"  "$EASY" --per 2  --decks all  --seed 90001 --threads 6 --cache
```

Paired duplicate format (each deal played twice with the configs swapped), 95% paired interval from `duplicateSummary`. The meta runs use the same seeds and layout as the version-8 ladder (BOT_TOOLKIT §6, "Ladder on version 8": meta `--per 10`, seed 61001, 420 pairs); the games themselves differ because SIM_VERSION 9 changed play.

| Run | Pairs | A wins (95%, paired) | Split | Swept (A / B) | Per-pair SD |
|---|---|---|---|---|---|
| Hard vs Medium, meta | 420 | **68.0% [65.5, 70.5]** | 253 | 159 / 8 | 0.52 |
| Medium vs Easy, meta | 420 | **77.4% [74.7, 80.0]** | 166 | 242 / 12 | 0.55 |
| Hard vs Medium, all 71 decks | 4,970 | **61.8% [61.1, 62.5]** | 3,314 | 1,415 / 241 | 0.53 |
| Medium vs Easy, all 71 decks | 9,940 | **72.2% [71.7, 72.8]** | 4,807 | 4,777 / 356 | 0.56 |

Earlier figures (docs/BOT_TOOLKIT.md §6): version 8 (2026-11-13, meta `--per 10`, seed 61001, 420 pairs) Hard vs Medium 67.0% [64.6, 69.5], Medium vs Easy 79.8% [77.1, 82.4]; version 6 (2026-11-12, meta `--per 10`) 64.4% [61.9, 66.9] and 76.5% [74.0, 79.1]. No all-decks ladder was measured before.

Hard vs Medium on the meta decks is where it was on version 8 (+1.0 point, well inside both intervals). Medium vs Easy is 2.4 points lower than on version 8; the two intervals overlap widely (a rough difference of 2.4 ± 3.7), and Easy itself moved in version 9 (its Gig plan was frozen after some sales before), so this is not a loss that can be told from noise. What changes the conclusion is the library-wide figure: across all 71 decks Hard beats Medium by 61.8%, about 6 points less than on the 7 meta decks, and Medium beats Easy by 72.2%, about 5 points less. The order Easy < Medium < Hard holds clearly everywhere, but a statement or forecast about the whole library should quote the all-decks margins, not the meta ones.

Cost: Hard vs Medium, 840 meta games in 28 s; 9,940 all-deck games in about 5 minutes; Medium vs Easy all decks, 19,880 games in about 1 minute (6 threads).

## 8. Rank stability under Medium and Hard

Commands:

```
npx tsx scripts/rank-stability.ts --bots medium,hard --decks all  --per 2  --threads 6 --cache --out <scratch>
npx tsx scripts/rank-stability.ts --bots medium,hard --decks meta --per 50 --threads 6 --cache --out <scratch>
npx tsx scripts/rank-stability.ts --bots medium,hard --decks all  --per 1  --threads 6 --cache --out <scratch>   (see the caution below)
```

Default seed 61001 and 2,000 bootstrap resamples (both as before). The version-6 measurement (BOT_TOOLKIT §11) was all 47 decks `--per 2`; the library is now 71 decks (Season 3's six decks and the 18 player lists joined it since), and `--decks` cannot select the old 47, so the closest comparable run is all decks `--per 2`. The meta `--per 50` run repeats the first (version-5) measurement.

**All 71 decks, `--per 2`** (9,940 deals per bot, 280 games per deck, about ±5.7 points per deck; Medium 35 s, Hard 984 s): Spearman rho **0.899 [0.844, 0.896]** (the point estimate sits just above the bootstrap interval: resampling adds noise to both rankings, so the bootstrap distribution of rho is pulled down; the version-6 interval was computed the same way). Band letter differs for 29 of 71 decks (14 beyond noise); 21 decks' ranks moved beyond the noise; largest rank change 33 places (Discord 5k #6: Jackie / Alt / Hanako, 37.9% → 54.6%); mean |win-rate change| 4.1 points; 16 decks changed win rate beyond 1.96 paired SE. Largest moves: Discord 5k #6 +16.8, BBG Cunningham Econ +11.1 (45.7% → 56.8%), Ladder S1 #10: Jackie / Judy / Hanako +10.0, S2-01 Mutant −9.6, Ladder S1 #4: V / Padre / Jackie +8.2, S3-03 Cross −8.2, RRB Wakako Midrange +7.9, S3-06 Counter −7.5, Ladder: V / Smasher / Padre −6.8 (70.0% → 63.2%).

Earlier (BOT_TOOLKIT §11): version 6, all 47 decks `--per 2`: rho 0.867 [0.797, 0.888], band differs for 21 of 47 (7 beyond noise), largest rank change 20, 9 decks beyond 1.96 paired SE; version 5: 0.75 [0.71, 0.80].

**Meta decks, `--per 50`** (2,100 deals per bot, 600 games per deck, about ±4 points; Medium 11 s, Hard 243 s): rho **0.750 [0.500, 0.883]**; band letter differs for 3 of 7 (3 beyond noise), largest rank change 3; 4 of 7 decks changed beyond 1.96 paired SE (mean |change| 5.0 points): BBG Cunningham Econ 42.5% → 52.8% (5th → 3rd), GRY Trauma Team 51.8% → 40.5% (3rd → 6th), RRB Wakako Midrange 34.2% → 39.0%, RRY Smasher Aggro 62.5% → 57.2%. RRG Dexter Midrange is first under both (72.3%, 71.7%), and YYB Rogue Gear no longer moves (47.3% → 47.5%). Earlier (version 5, BOT_TOOLKIT §11): rho 0.36 [0.32, 0.76], 5 of 7 beyond the noise, mean |change| 8.3 points, YYB Rogue Gear last → second.

Conclusion: rankings under Medium and Hard agree at least as well as on version 6 (rho about 0.9 over the library, 0.75 within the meta), so the version-6 decision to keep screening on Medium stands on these numbers. The direction noted on version 5 is still visible but weaker: the decks Hard rates higher are mostly slower or decision-heavy (BBG Cunningham Econ, RRB Wakako, BBG Draw and Wipe +3.6, the Jackie / Alt / Hanako player lists), and some aggressive red lists drop (The Red Chrome −5.4, Ladder: V / Smasher / Padre −6.8, Discord 5k #7: Smasher / River / V −6.1); YYB Rogue Gear (+3.9) and S2-02 Mutant (−1.8) no longer move beyond the noise. With 21 decks' ranks moved beyond the noise, a single deck's rank under Medium is still not a stand-in for its rank under Hard.

**Caution, `--per 1` (a limitation of the script, not fixed):** the bootstrap resamples deals within each ordered pairing, so with one deal per pairing every resample is the original sample. The run at `--per 1` (4,970 deals per bot, Hard 524 s) printed rho 0.845 [0.845, 0.845] and flagged all 71 decks as "rank moved" with zero-width rank intervals. Its point estimate (0.845, band differs for 34 of 71) is a usable second sample on mostly different deals, but its intervals and noise flags mean nothing. Use `--per 2` or more; `--help` does not say so.

## 9. The evaluation's calibration (a measurement of the shipped weights, no refit)

Command (the version-6 command with `--threads 6`):

```
npx tsx scripts/eval-calibrate.ts --decks all --per 2 --seed 70001 --bot hard --threads 6 --out <scratch>
```

9,940 Hard games over the 71 decks (961 s), 121,328 ends of turns, ender's view, split by game 60/15/25 (5,970 / 1,488 / 2,482 games; held-out 30,331 rows). The value is `evaluate()` with `DEFAULT_WEIGHTS`. Nothing was written under `src/ai/`; the fitted weights below are the script's report, not a candidate set.

| Held-out | log-loss | Brier |
|---|---|---|
| coin | 0.693 | 0.250 |
| σ(a·value), `DEFAULT_WEIGHTS` | **0.526** | **0.182** |
| σ(b + a·value) | 0.507 | 0.173 |
| σ(a·value), Hard's profiled weights | 0.527 | 0.182 |
| σ(a_stage·value) | 0.522 | 0.180 |
| ridge logistic on the 19 features (λ 0) | 0.497 | 0.169 |

Slope a = 0.00645 per point (a 40-point Gig swing moves the odds ×1.29); by stage early 0.00231, mid 0.00773, late 0.00641. Win rate by value bin: ≤−200 3.2%, −200…−120 13.2%, −50…−25 27.2%, −10…10 31.5%, 25…50 47.1%, 50…80 52.5%, 80…120 53.4%, 120…200 68.7%, >200 90.8%.

Earlier (docs/IMPROVEMENT_BACKLOG.md WP-D1, status 2026-11-12, SIM_VERSION 6; 47 decks, 4,324 games, 53,003 ends of turns): σ(a·value) 0.515 (Brier 0.178), refit 0.486, gap 0.029, slope 0.0068 (×1.31), early slope 0.0023; bins ≤−200 2.9%, −50…−25 27.3%, −10…10 31.9%, 25…50 47.4%, 50…80 53.4%, 80…120 53.4%, 120…200 72.3%, >200 91.5%.

A second sample, `--per 1` (4,970 games, 60,531 rows, 495 s), gave 0.518 (0.179), refit 0.487, gap 0.031, slope 0.00652.

Conclusion: the shipped weights predict the winner as well, relative to their own refit, as on version 6 (gap 0.029 both times). Both losses are about 0.011 higher than on version 6; since the refit rose by the same amount, that is the larger and different field (71 decks, with 18 player lists and Season 3), not the weights drifting. The known faults are unchanged: off-centre (the seat that just moved wins 31.5% at a value near 0), flat between 50 and 120 (52.5% to 53.4%), weak early (slope 0.0023). The refit moves several terms far from the shipped values (gig scale, ±1.96 SE): goSolo −99.6 ± 6.6 (shipped 0, v6 fit −50.6), blocker −3.7 ± 3.9 (shipped −44.1), unitBase 14.8 ± 4.8 (50.3), unitCost 0.4 ± 1.8 (−4.81), hand 21.9 ± 1.5 (4.54), eddie 52.5 ± 3.6 (26.9), stealsTwo 57.0 ± 5.3 (42.8), plan 1.58 ± 0.35 (0.915). These are associations with winning, not values (the goSolo figure is the same selection effect BOT-A set aside), and whether a refit on version 9 plays better is ROADMAP2 §12 gain 10 / batch E, not measured here.

## 10. The bots on the SIM_VERSION 9 benchmark suite

Commands (the first build's `--reps 3`; the second bot gives the paired difference):

```
npx tsx scripts/benchmark.ts easy   hard --reps 3 --threads 6 --out <scratch>
npx tsx scripts/benchmark.ts medium hard --reps 3 --threads 6 --out <scratch>
```

Suite `data/benchmark/suite.json` (rebuilt 2026-11-14 for version 9): 300 positions, 144 indifferent, 156 counted. Regret in win-rate points, 95% interval over positions, and the share of picks among the oracle's best. Both runs took seconds. Hard's figures were identical in both runs.

| Rows | Easy | Medium | Hard |
|---|---|---|---|
| all (156) | 5.0 [3.7, 6.2], 57.1% | 4.9 [3.6, 6.2], 57.1% | 4.8 [3.5, 6.1], 59.6% |
| mulligan (24) | 5.3 [2.3, 8.4] | 5.3 [2.3, 8.4] | 5.3 [2.3, 8.4] |
| main (48) | 5.7 [3.0, 8.5] | 6.3 [3.3, 9.3] | 6.9 [3.8, 10.0] |
| sell (41) | 5.7 [3.0, 8.4] | 5.7 [3.0, 8.4] | 5.3 [2.8, 7.8] |
| react (20) | 4.6 [1.5, 7.7], 50% | 2.7 [0.4, 5.0], 55% | 1.2 [−0.4, 2.8], 85% |
| effect (23) | 1.9 [0.8, 3.0] | 1.9 [0.8, 3.0] | 1.9 [0.8, 3.0] |
| early (53) | 4.8 [2.6, 7.0] | 4.7 [2.5, 6.9] | 5.2 [3.0, 7.4] |
| mid (52) | 6.3 [3.7, 8.9] | 4.6 [2.7, 6.5] | 3.8 [2.0, 5.6] |
| late (27) | 2.4 [0.9, 4.0] | 5.6 [1.1, 10.0] | 5.2 [0.8, 9.7] |

Paired difference against Hard: Easy +0.2 [−1.0, 1.4] (same pick at 209 of 300 positions), Medium +0.1 [−0.4, 0.7] (258 of 300).

Earlier (BOT_TOOLKIT §10, first build, 2026-11-12, SIM_VERSION 6, 128 counted positions, `--reps 3`): Easy 5.3 [3.7, 6.9], Medium 5.1 [3.5, 6.7], Hard 5.8 [3.8, 7.8]; Easy − Hard −0.5 [−2.0, 1.1], Medium − Hard −0.7 [−2.2, 0.8]. The version-8 and version-9 rebuilds were not scored by bot before.

Conclusion: on the version-9 suite the overall order is now the expected one (Easy ≥ Medium ≥ Hard), but only in the point estimates: every difference is far inside its interval, so the statement in the docs stands: the benchmark does not yet separate Easy from Hard. The reactions are the one row with the expected order by a visible margin (Hard 1.2, Medium 2.7, Easy 4.6; 85% of Hard's picks among the best), and mid-game decisions lean the same way; main-phase decisions are reversed (Hard 6.9 against Easy 5.7) and so is the late game. Mulligan and effect rows are identical for all three (rule-decided choices).

## 11. The reviewer's validation

Commands (`--threads 6` instead of 8; confirmation at its default, 16 worlds):

```
npx tsx scripts/game-review-check.ts --games 12 --seed 3 --threads 6 --out <scratch>
npx tsx scripts/game-review-check.ts --games 20 --threads 6 --out <scratch>        (seed 1, the default)
```

A Medium bot in the player's seat against Hard on the meta decks, each game reviewed twice with different oracle seeds (the confirmation worlds follow the oracle seed, so the two runs are independent). The games come from the same seeds as before but are not the same games, because version 9 plays differently. Intervals below are Wilson 95%.

**`--games 12 --seed 3`** (24 reviews, 37 s):

| | Now (v9) | Before (v8, 2026-11-13, + confirmation 16) |
|---|---|---|
| Mistake or worse kept on the re-run | **97% (38/39) [87, 99.5]** | 86% (32/37) [72, 94] |
| Blunder kept | **96% (27/28) [82, 99]** | 86% |
| Sharp or Inspired kept | 82% (9/11) | not given |
| Ratings within one step (all) | **98.6% (705/715)** | 98.0% |
| Same rating | 90.2% | not given |
| Accuracy moved, mean (max) | **3.4 (20)** | 4.8 (23) |
| Turning point the same move | **11 of 12** | 8 of 12 |
| Review time, median (max) | 8.9 s (15.2), 6 in parallel | 16.1 s, 8 in parallel |
| Medium side | 148 Best, 33 Close call, 0 Slip, 10 Mistake, 23 Blunder, 134 No clear difference; accuracy 80.2 | 139 / 33 / 0 / 8 / 24 / 115; 78.1 |
| Hard side | 2 Inspired, 9 Sharp, 196 Best, 15 Close call, 1 Slip, 1 Mistake, 5 Blunder, 138 No clear difference; accuracy 94.3 | 3 / 7 / 191 / 15 / 1 / (Mistake not given) / 5 / 125; 94.3 |

**`--games 20`** (40 reviews, 52 s): ratings per side, Medium 251 Best (49.3%), 33 Close call (6.5%), 2 Slip, 8 Mistake (1.6%), 43 Blunder (8.4%), 172 No clear difference (33.8%), accuracy 71.8; Hard 5 Inspired, 21 Sharp (3.8%), 324 Best (57.9%), 22 Close call, 0 Slip, 3 Mistake, 15 Blunder (2.7%), 170 No clear difference (30.4%), accuracy 91.3. Per game Hard 0.25 Inspired and 1.05 Sharp, Medium none. Re-run: 1,069 decisions rated both times, same rating 90.9% [89.1, 92.5], within one step 97.9% (counted by both runs 97.8% of 694); Mistake or worse kept 96% (66/69), Blunder 95% (55/58), Sharp or Inspired 85% (22/26); accuracy moved 2.4 (max 19); turning point the same in 18 of 20. Review time median 5.6 s, max 14.7 s.

Earlier for `--games 20` (BOT_TOOLKIT §8, 2026-11-12, before the rule changes and the confirmation stage): Medium 260 Best (50.0%), 25 Close call, 4 Slip, 15 Mistake, 54 Blunder (10.4%), 162 No clear difference, accuracy 69.0; Hard 11 Inspired, 9 Sharp, 345 Best, 23 Close call, 2 Slip, 5 Mistake, 17 Blunder, 144 No clear difference, accuracy 89.8; same rating 89.3%, counted within one step 95.7%. Not a like-for-like comparison (rating rules 2 and confirmation since).

Conclusion: the review's ratings are at least as stable on version 9 as on version 8; the learner-facing figures (Mistakes and Blunders kept, turning point, accuracy) look better on this sample, but the earlier figure lies inside the new interval for the kept share, and the games differ, so read it as "no worse", not as an improvement. Hard now earns more Sharp ratings per game (0.75 and 1.05 against 0.45 to 0.58) and fewer Inspired; its Best share and accuracy are as before. The review time is about half the version-8 figure, which fits the 2026-11-16 speed-ups (measured at 6 rather than 8 in parallel on a shared machine).

## Not run

- `scripts/coach-eval.ts` and the coach on the benchmark: not in this batch.
- The calibration's `--view next`, `--stages` and `--deck-effects` variants: the version-6 comparison is the ender's view only.
- The version-6 47-deck set for rank stability and calibration: `--decks` takes `meta`, `all` or a file prefix, so the old set cannot be selected without a new script; the library-wide runs are reported instead.
