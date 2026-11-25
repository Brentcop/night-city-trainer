# The evaluation refit (REVIEW_2026-11-24 C.3): design, rule and cost, written before any game

Status, 2026-11-25: the pipeline and the two switches are built and tested (42-game runs on the meta decks, `tests/eval-refit.test.ts`). Amended before the fitting games, when the coordinator named the final bot: the fitting games are played on SIM_VERSION 12 (commit 5ece9a8: v10 Street Cred parity, v11 `readyTrick` 12, v12 the matchup profiles dropped; Hard's sell hold credit shelved), the set is `refit-v12` (it would land as version 13), the games run on 10 threads, and C.2's trick credit is fitted as its own term (`readyTrick`, the ready sources covering Quick Programs, `readyTrickFeature`; `readyCall` stays 0 and is not fitted). Nothing here changes `DEFAULT_WEIGHTS`, a tier or a recorded game.

## What is fitted

`npx tsx scripts/eval-refit.ts` (fit: `src/analysis/evalRefit.ts`).

- **Games.** Hard self-play, every ordered pairing of the 71 library decks, `--per 1` (4,970 games), first player alternating, seeds from 80,001. Hard is the bot whose cut the evaluation mostly serves, and the rating bot.
- **Rows** (the positions where a bot uses the evaluation, each with who won):
  - `mid`: a hashed quarter (`--mid 0.25`) of the live game's main-phase decision points, from the active seat (the position as it chooses its next action). Medium's whole decision and Hard's 1-ply screen evaluate positions right after an action in the main phase, which is what the next decision point is. Not the hypothetical positions of options not taken: a known gap, stated.
  - `next`: every end of turn from the seat about to start. This is exactly Hard's main-phase rollout cut: after the rival's end phase, phase `end`, scored for the decider, who moves next (about 83% of Hard's rollouts are scored there, REVIEW §2).
  - `ender`: every end of turn from the seat that ended it: Hard's reaction cut (the reacting seat's own turn played to its end phase).
  - The 2026-11-12 fit had only `ender`; the 11-18 refit too. The rows are pooled unweighted; the held-out log-loss is also reported per kind.
- **Target: who won** (1, ½ for a tie, 0). "The next-turn view" changes which positions are rows and from whose seat (the `next` rows), not the target. A target read off the next cut (the evaluation one turn later) would take the weights being replaced as truth; the final result is the one target that does not.
- **Features**: `evaluateTerms()`'s features, every term in `EVAL_TERMS` of the code that plays the games plus `readyTrick` (`REFIT_TERMS`). The spentRisk feature is measured under the main-phase rule (`--spent-risk main`), so its fitted weight means what the candidate's `spentRiskMainOnly: 1` applies.
- **Controls**: a strength per deck (own list +1, the rival's −1; 70 columns) and going first (±1), so a term is not credited with what the stronger list or seat wins. In the candidate they are dropped: within a game the decks are fixed.
- **Fit**: ridge logistic (penalty on standardized coefficients), λ from {0, 1e-4, 1e-3, 3e-3, 1e-2, 3e-2} by 5 folds of the fitting games (75% of games by `splitOf`; the other 25% are held out of every fit), standard errors cluster-robust by game.
- **Candidate**: each identified term (varies in 2%+ of rows, 95% interval by game narrower than the larger of the current and fitted values) on the gig scale (gig = 20, so `win`, `playOutClamp`, `rivalLethal`, the 5% 1-ply offset and the Call bonus keep their meaning); the others keep their current value; `goSolo` (0, BOT-A) and `rivalLethal` (400: a decided game, near-separation) kept by argument; plus `spentRiskMainOnly: 1` and `subChoiceEval: 1`. Named `refit-v12`, added to `src/ai/weightSets.ts` with its provenance (games, version, date, held-out log-loss against the current weights), not the default.

## The two switches (opt-in, 0 in every built-in set; `tests/game-corpus.test.ts` unchanged)

- `spentRiskMainOnly` (B7): the spent-risk discount only while the active seat is in its main phase. After an end phase (Hard's leaf, the `next` and `ender` rows) the active seat is the one about to start, whose Units ready first: the discount priced a risk that has passed. No effect on Medium's own evaluations (all in the main phase); it acts through Hard's cuts.
- `subChoiceEval` (B7): Unit sub-choices (the Unit to harm, the Unit given up) ranked by `unitValue` on the bot's own weights instead of the hand weights (a Blocker +2 there, −44.1 in the evaluation that scores the result). The fast policy's weights are the hand weights, so Easy and the 1-ply clones are unchanged either way; Hard's rollout bots take the weights, so they follow the switch.

Both ride in `EvalWeights`, so every lookahead agent built from the weights reads them, and a spec turns them on with `{"weights":{"subChoiceEval":1}}` or a weight set.

## The rule (fixed before the fitting games)

The review's group C rule, made exact. Played in this order; a failed step stops the measurement (the candidate is not proposed).

1. **Intended effect.**
   - (a) On **fresh games** (Hard, `--per 1`, seeds from 90,001, recorded with `--compare refit-v12`), the held-out log-loss of the result on the candidate's value beside the deck controls is lower than on the current weights' value beside the same controls: the paired bootstrap interval (2,000 resamples of held-out games) of the difference is wholly below 0 (the line "compared weights (recorded)" under "Paired against the current weights"). The uncontrolled comparison and the per-kind losses are reported, not ruled on: a weight that tracks which list is stronger improves the uncontrolled score and no decision.
   - (b) **No identified term flips sign** against `DEFAULT_WEIGHTS` of v12 without a stated reason, written in the commit that adds the set (the report lists the flips). A flip with no reason fails the step. `blocker`, `hand` and `eddie` (the 11-18 refit's large moves) are shown beside both earlier fits.
2. **Strength** (paired `botcheck`, duplicate format, the whole library): the candidate against the same tier on v12, Hard `--per 1` (4,970 pairs) and Medium `--per 4` (19,880 pairs); the lower bound of the candidate's 95% interval is at least 49.0% in both.
3. **Per-deck report** (`scripts/deck-sensitivity.ts`, base = the tier, change = the tier with the set): Medium `--per 2` and Hard `--per 1`. Chance count at 2 SE: 71 × 4.55% ≈ 3.2 decks. If 7 or more decks move beyond 2 SE in either report (more than twice the chance count), the report names the families and features whose mean change is beyond 2 SE (the script's family and feature table: Blockers, Units, Programs, Quick Programs, BBG, two red Legends, bred, imported) and the weight change that explains each (the B5 pattern: the Blocker weight against Blocker-heavy lists). Step 3 decides nothing by itself; the candidate goes to the owner with it, as the review asks ("accept a refit only with the per-deck report"). A move no weight change explains is looked at before proposing.

Information, not ruled on: the fresh run's own refit beside the first (terms within each other's intervals or not); the switches apart, Medium (`deck-sensitivity` of the set with both switches off against medium, and of the set against the set with both off; the spentRisk switch does nothing on Medium) and, optionally, Hard on the meta decks for `spentRiskMainOnly` alone (`botcheck 'hard+{"weights":{"spentRiskMainOnly":1}}' hard --per 20`).

If accepted, making it the default is a SIM_VERSION bump of its own (one measured change per bump, D.4), with the corpus and recorded events re-recorded; not part of this item.

## Commands (after merging v12; T = the thread count the coordinator gives)

```sh
# fit (the leaves file is about 27 MB: keep it out of the repository; copy the .md, .json and weight-set block)
npx tsx scripts/eval-refit.ts --decks all --per 1 --seed 80001 --mid 0.25 --name refit-v12 --threads T --out <scratch>/fit
# add the block to src/ai/weightSets.ts as 'refit-v12', then:
# 1 (a): fresh games, recorded with the candidate's value too
npx tsx scripts/eval-refit.ts --decks all --per 1 --seed 90001 --mid 0.25 --compare refit-v12 --name refit-v12-fresh --threads T --out <scratch>/fresh
# 2: strength
npx tsx scripts/botcheck.ts 'hard+{"weightSet":"refit-v12"}' hard --decks all --per 1 --seed 61001 --threads T --cache
npx tsx scripts/botcheck.ts 'medium+{"weightSet":"refit-v12"}' medium --decks all --per 4 --seed 61001 --threads T --cache
# 3: per deck
npx tsx scripts/deck-sensitivity.ts medium 'medium+{"weightSet":"refit-v12"}' --decks all --per 2 --seed 61001 --threads T --cache --out <dir> --label refit-v12-medium
npx tsx scripts/deck-sensitivity.ts hard 'hard+{"weightSet":"refit-v12"}' --decks all --per 1 --seed 61001 --threads T --cache --out <dir> --label refit-v12-hard
```

## Cost

Hard costs about 0.8 to 1.0 thread-seconds a game on the library (0.79 in REVIEW §8 at 7 threads; 0.86 on this machine while busy, 42 meta games with the leaves recorded), Medium about 0.03.

| Step | Games | Thread time | On 8 threads |
|---|---|---|---|
| Fitting games | 4,970 Hard (~195,000 rows: ~72,000 mid, ~61,000 each of next and ender) | 70–85 min | ~10 min |
| The fit (one thread; 30 fits for λ, then one) | — | ~13–15 min (158 s measured for 39,000 rows) | same |
| 1 (a) fresh games + their fit | 4,970 Hard | 70–85 min + ~15 min | ~25 min |
| 2 Hard botcheck `--per 1` | 9,940 Hard | 130–165 min | ~20 min |
| 2 Medium botcheck `--per 4` | 39,760 Medium | ~20 min | ~3 min |
| 3 Medium report `--per 2` | 19,880 Medium (the base half from the cache when the same code played it) | ~10 min | ~2 min |
| 3 Hard report `--per 1` | 9,940 Hard (the base half likewise) | 130–165 min | ~20 min |
| Information: switches apart (Medium), spentRisk alone (Hard, meta `--per 20`) | ~40,000 Medium, 3,360 Hard | ~20 + ~50 min | ~10 min |

In all about 30,000 Hard games (33,000 with the optional check) and 100,000 Medium games: 7 to 9 thread-hours, about 1 to 1¼ hours on 8 threads unloaded, plus about half an hour of single-threaded fitting; double it on a shared machine. The fitting games are at the bottom of the 5,000 to 8,000 the item aimed at; with the mid rows they give about 194,000 rows, 1.6 times the 121,328 of the 11-18 calibration's 9,940 games (one view each).

## Results (SIM_VERSION 12, commit 5ece9a8 merged; 10 threads)

### The fit

`npx tsx scripts/eval-refit.ts --decks all --per 1 --seed 80001 --mid 0.25 --name refit-v12 --threads 10`: 4,970 Hard games in 473 s, fitted in 392 s; rows mid 55,710 / 18,330, next 45,641 / 15,209, ender 45,641 / 15,209 (fitting / held-out), games 3,728 / 1,242. λ 1e-4 by 5 folds (the path is flat to 1e-3: 0.5001, 0.5001, 0.5002). Linear reading of the current weights against evaluate(): mean |difference| 2.1 points.

Held-out log-loss (the fit's own held-out games, not yet rule 1 (a)): current weights 0.5409, candidate 0.5305 (no controls); with the deck controls 0.5138 against 0.5066, paired −0.0072 [−0.0125, −0.0018]. Per kind with controls: mid 0.5374 → 0.5210, next 0.4927 → 0.4899, ender 0.5064 → 0.5059: almost all of the gain is on the mid rows; at Hard's cuts the two are within a few thousandths.

| term | current (v12) | fit ± 1.96 SE (by game) | candidate | note |
|---|---|---|---|---|
| gig | 20 | 20.0 (anchor) | 20 | |
| gigNear | 50.8 | 67.9 ± 7.5 | 67.9 | |
| unitPower | 13.2 | 13.5 ± 3.3 | 13.5 | |
| unitCost | −4.81 | +2.34 ± 6.0 | −4.81 | not identified (kept) |
| unitBase | 50.3 | 23.7 ± 17 | 23.7 | |
| blocker | −44.1 | −16.7 ± 15 | −16.7 | as the deck-controlled fit of 11-12 (−18.9); the 11-18 refit without controls said −3.7 |
| unitGear | 1.5 | 14.6 ± 16 | 1.5 | not identified |
| stealsTwo | 42.8 | 34.0 ± 18 | 34 | |
| goSolo | 0 | −145 ± 21 | 0 | fixed by argument (BOT-A) |
| spentRisk | 0.087 | 0.198 ± 0.053 | 0.198 | measured under the main-phase rule |
| hand | 4.54 | 35.2 ± 6.2 | 35.2 | the 11-18 refit said 21.9 |
| eddie | 26.9 | 10.4 ± 12 | 10.4 | the 11-18 refit said 52.5 (no controls, no readyTrick) |
| faceUpLegend | 8.99 | 5.44 ± 8.3 | 5.44 | |
| legendGear | 2 | 15.8 ± 60 | 2 | not identified |
| lowDeck | 8 | — (never varies) | 8 | not identified |
| plan | 0.915 | **−2.18 ± 1.0** | −2.18 | **sign flip** |
| exposed | 0.886 | 0.372 ± 0.029 | 0.372 | |
| threat | 0.971 | 1.15 ± 0.054 | 1.15 | |
| rivalLethal | 400 | 393 ± 52 | 400 | fixed by argument |
| readyTrick | 12 | 2.65 ± 11 | 2.65 | identified only just (1.96 SE 11 < 12) |

### Rule 1 (b): failed, so the measurement stops here

One identified term flips sign: `plan`, 0.915 → −2.18 ± 1.0. No game reason for it could be stated:
- `plan` is mostly Gig count by another name (correlation 0.72 with the gig feature, 0.67 with gigNear; it is non-zero in 99.6% of rows), and the flip comes with gigNear rising from 50.8 to 67.9: a trade between collinear columns, not a price of holding Gigs that fit the list.
- By row kind (features + controls, same λ): mid −1.43 ± 0.79, next −0.28 ± 0.67, ender −0.14 ± 0.72. Only the main-phase rows are negative beyond noise; at Hard's cuts the fit cannot tell plan from 0 (and it excludes 0.915 at next).
- A negative `plan` would turn every Gig choice the evaluation scores against the list's own plan: Kerry Eurodyne's reroll (`wantsReroll` multiplies planScore by `w.plan`), and through `evaluate()` every roll-in, steal, adjust and swap a rollout values, including C.1's Street Cred parity (SIM_VERSION 10). That is a behaviour no one has argued for.

So by the rule written above, the candidate is not proposed and no fresh games, botcheck or per-deck report were played. The set is not added to `src/ai/weightSets.ts`; its block is above in this file's history (the run's `weight-set.ts.txt`) and in the coordinator's report.

Information (the fit's held-out games, paired with controls, not a rule step): the candidate with `plan` kept at 0.915 is −0.0045 [−0.0096, +0.0005] against the current weights (not distinguishable); with `plan` 0, −0.0057 [−0.0108, −0.0005]. Going on with `plan` fixed (by argument, as `goSolo` is) would be a change to the rule after its result, so it is the coordinator's decision, not this run's.

### The one variant, declared before any fresh game: `refit-v12b`

Decided by the coordinator on 2026-11-25, before any fresh game was played, and the only variant: `refit-v12b` is the fitted candidate with `plan` kept at 0.915 by argument, as `goSolo` and `rivalLethal` are. The reason: `plan` correlates 0.72 / 0.67 with the gig / gigNear features, so its fitted value is a trade between overlapping terms, and its job is to steer Gig choices toward the list's payoffs, which a negative value would invert (against SIM_VERSION 10's Street Cred parity fix). The fitted held-out comparison of this variant (−0.0045 [−0.0096, +0.0005]) is information only. `plan` is now in `FIXED_TERMS` with that reason. The rule then runs unchanged from step 1 (a), on fresh games (seed 90001, `--compare refit-v12b`), stopping at the first failure; 10 threads.
