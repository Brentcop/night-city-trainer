# Match reviewer: validation and findings (2026-11-10)

> **Note (2026-11-10, updated 2026-11-11):** the figures in this document were measured before the bot and engine fixes listed in `docs/IMPROVEMENT_BACKLOG.md` (Wave B) and have not been re-measured; treat them as history. The 200 "series games" of the backfill were the events recorded then, which were wiped at the fresh baseline of 2026-11-11 (`docs/ROADMAP.md` §1; they are kept at the tag `archive/pre-season1-reset-2026-11-11`). The reports cited below are kept in `reports/` as that history. Re-measuring on the new events (`review.ts --from events`) is pending.

The match reviewer (`src/ai/reviewer.ts`) replays a finished game exactly and scores every main-phase decision against an **oracle**. The oracle plays each candidate move out 8 times: the rest of the turn plus the rival's whole reply, with hidden cards re-dealt. Every candidate shares the same 8 random worlds, so only the move differs between them. Reports:

- `reports/review-backfill.md`: 200 recorded series games, with the coach checked on every decision.
- `reports/review-validate-*.md` and `reports/review-noise*.md`: the validation runs.

## 1. Can the reviewer be trusted?

| Check | Result | Verdict |
|---|---|---|
| Replays reproduce the real game | 200/200 series games, 30/30 tier games, practice games via recorded choices | ✅ exact |
| Same decision reviewed twice (independent play-outs) | same verdict 94%, blunder↔accurate flips 1% | ✅ consistent |
| Before the fixes below | same verdict 74%, flips 8% | ❌ was too noisy |
| Planted random moves vs Hard's own moves | random moves cost 0.38 Gigs vs 0.10; flagged worse 70% of the time | ✅ detects mistakes |
| Planted random moves vs Medium's own moves | 0.42 vs 0.36 Gigs; 61% | ⚠️ Medium is itself error-prone, so a weak baseline |
| Bot tiers (30 games) | Hard 89% accurate (0.10 Gigs lost/decision), Medium 71% (0.40), Easy 64% (0.37) | ⚠️ Hard ≫ Medium, but Easy ≈ Medium (see §3) |
| "Game-losing" flags vs who lost | 16 of 19 flags were on the side that lost | ✅ predictive |
| Small per-move "Gigs lost" vs who won | side with fewer Gigs lost won 44% (deck strength held fixed: no effect) | ❌ does not predict results |

**Fixes made during validation**
1. **Common random numbers.** All candidates now share the same random worlds, which raised verdict agreement from 74% to 94%.
2. **Bounded play-out scores.** A won or lost play-out now counts as ±600 points instead of ±10,000, and every score is clamped to that range. One unlucky world can no longer read as a certain loss, and a hopeless position can no longer outscore an actual loss. (This was a real bug: "Pass turn" was being recommended in lost positions.)
3. **Decided positions are not graded.** When every option wins, or every option loses, all moves score 0.
4. **8 play-outs per candidate, not 4.** Flips dropped from 3% to 1%.

**What to trust:** the costliest-decision lists, the game-losing flags, and comparisons between decision types or bots. **What not to over-read:** the small per-move "Gigs lost" totals as a predictor of who wins. In bot-vs-bot games the result is driven far more by deck strength (each point of power-rating gap is worth about 28 points of win chance) and by the decisions the reviewer does not yet grade.

## 2. What the backfill found (200 series games, 9,294 decisions, Deep bot)

**Bots: where the Deep bot loses value** (costliest first)

| Decision type | Accuracy | Gigs lost / decision | Share of game-losing flags |
|---|---|---|---|
| Attack the Gig area | 72% | 0.33 | 11 of 19 |
| Attack a Unit | 79% | 0.29 | 2 |
| Play a Unit | 84% | 0.20 | 3 |
| Program | 86% | 0.12 | 0 |
| Sell / Call / End turn | 93–96% | 0.03–0.05 | 2 |

Mistakes concentrate in the middle game (turns 7–12 lose about 0.22–0.26 Gigs per decision, against ≤0.13 before turn 7). Attacks are the weak spot: which unit attacks, the Gig area or a unit, and whether to attack at all.

**Coach (deep 12 + card impact).** It agrees with the oracle on **94%** of decisions, against 86% for the bot that actually played. Following it would have cost 0.04 Gigs per decision instead of 0.16. It fixes the attack problem (Gig attacks: 0.03 vs 0.33) but **is no better than the bots on sells** (0.06 vs 0.05). Sells still go through the shared "sell first" heuristic, not the coach's deep search.

**Decks the bots misplay most.** Rainbow Fixer Stuff, NC-06 Metal Over Meat (YYY), the RRY "Fills up Discard" guide list, and several RBG/RRB crosses. Treat their sim win rates as a floor.

## 3. Refinement backlog (input for the next round)

Ordered by expected value. Each item names how to measure it.

| # | Area | Change | Why (evidence) | Measure with |
|---|---|---|---|---|
| 1 | Bots (Hard) | Re-score attack options with the deep rollout. Today attacks often miss the deep top-3 that the 1-ply screen picks. | Attacks are 55% of value lost and 13 of 19 game-losing flags | `review.ts --from tiers` (attack rows) + `botcheck.ts` Hard vs Hard-old |
| 2 | Coach | Decide sells by lookahead (sell card X vs Y vs keep) instead of the fixed sell-first rule | Coach no better than bots on sells; 2,272 sell decisions per 200 games | `review.ts --coach` (sell row) |
| 3 | Reviewer | Grade the other decisions: blocks, reactions, attack targets, mulligans, Gig dice | Easy loses 62% of games to Medium, yet scores about the same as Medium on the main-phase moves graded today | Re-run the tier check: Easy should then score clearly below Medium |
| 4 | Reviewer | Calibrate "Gigs lost" to win chance with a longer horizon (two full rounds) on a sample | Per-move totals don't predict results (44%) | The calibration section of `review.ts` |
| 5 | Bots (all) | Mid-game attack planning: eval weights for Gig-area pressure vs unit trades (turns 7–12) | Value lost doubles from turn 7 | `tune.ts` then the backfill |
| 6 | Decks | Forge the decks the bots misplay most, with Hard bots, before trusting their ratings | Their sim numbers are a floor | `forge.ts --bot hard` |

**Status** (checked against the code after round 1, see §3b):

1. Implemented, then switched off. `HeuristicAgent` has a `deepAttacks` option, but Hard runs with `HARD_DEEP_ATTACKS = 0` (`src/ai/tiers.ts`) because attack rollouts measured no gain.
2. Done. The coach decides sells with `sellLookahead: 3` (`COACH_CONFIG` in `src/ai/coach.ts`).
3. Partly done. Reactions (blocks, reaction-time calls and programs, and letting the attack through) are now graded. Mulligans and Gig dice are not.
4. Open. `review.ts` has a calibration section, but it still uses the short horizon.
5. Open.
6. Open. `forge.ts --bot hard` works, but the forge logs in `reports/` were all made with the `lookahead` or `medium` bot.

## 3b. Refinement round 1: what happened

See `reports/refine-results.md`:
- Attack rollouts for Hard: no gain, reverted.
- Coach sell rollouts: kept (sell accuracy 94% → 97%).
- Reaction grading: added. It revealed that blocks were the weakest decision type.
- Reaction rollouts: kept. Coach blocks went from 57% to 93% accurate, and Hard with them beats the previous Hard 56%.

## 4. How to re-run everything

```bash
npx tsx scripts/review-noise.ts --samples 80 --rollouts 8                 # oracle noise
npx tsx scripts/review.ts --from chaos --chaos-bot hard --games 24        # planted mistakes
npx tsx scripts/review.ts --from tiers --games 30                        # Easy / Medium / Hard
npx tsx scripts/review.ts --from events --games 200 --coach --name backfill
npx tsx scripts/review-debug.ts data/reviews/backfill.json <game-id> <seat> <decision#>   # one decision, world by world (data/reviews/ is gitignored review.ts output)
```

In the app: **Play** → finish a game → **Full match review** (or **Review a recent game**). **Tournaments** → any match → **🔍 Review**.
