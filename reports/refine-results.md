# Review-driven refinement — results (2026-11-10)

Inputs: `docs/REVIEW_FINDINGS.md` backlog items 1–3. Every change was measured before it was kept.

| Change | Measured how | Before → after | Kept? |
|---|---|---|---|
| Hard: roll out the best 2 attack options too | Head-to-head vs previous Hard, 168 games | 50.6% win rate (no gain) | ❌ reverted (setting stays, off) |
| | Reviewer, 24 games, Hard vs previous Hard | Gig attacks 0.17 vs 0.16 Gigs lost | |
| Coach: choose which card to sell by rollout (top 3) | Reviewer on the same 60 recorded games | sell accuracy 94% → **97%**, Gigs lost 0.05 → **0.03** | ✅ |
| Reviewer: grade reactions (blocks, reaction calls/programs, letting the attack through) | Tier check, 30 games | Reactions now graded; still doesn't separate Easy from Medium (0.33 vs 0.38 Gigs lost) | ✅ (new coverage) |
| **New (found by the reaction grading):** choose reactions by rollout | Coach on the same 60 games | blocks 57% → **93%** accurate (0.56 → **0.02** Gigs lost); reaction calls 83% → **91%** | ✅ coach |
| | Hard + reaction rollouts vs previous Hard, 168 games | **56.0%** win rate | ✅ Hard |

Coach overall: 95% agreement with the oracle, 0.03 Gigs lost per decision (was 0.04; the bots that actually played: 0.16–0.21).

Still open:
- Why Easy loses 62% to Medium while scoring about the same per graded decision. Suspects: target choices, modes, mulligans and Gig dice, which are still ungraded.
- A longer-horizon calibration of "Gigs lost" to win chance.
- Mid-game attack planning for the Medium bot.

Previous settings are kept for replays and comparisons: `hard-v1` (Hard before this refinement), `COACH_CONFIG_V1`.
