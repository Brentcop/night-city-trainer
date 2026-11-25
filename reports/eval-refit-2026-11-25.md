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
