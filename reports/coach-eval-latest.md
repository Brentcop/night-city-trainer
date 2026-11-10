# Coach evaluation — 2026-11-10

How good is the coach's advice? `scripts/coach-eval.ts` samples 200 main-phase decisions (3 or more options) from bot games between meta and original decks. Each coach config decides the same spot, and an **oracle** scores every candidate. The oracle averages 6 randomized rollouts of the rest of the turn plus the rival's full reply, with hidden information re-dealt.

## Run 1 (seed 1): breadth of configs

| Coach config | Agrees with oracle | Blunders (>15 pts) | ms / decision |
|---|---|---|---|
| old coach (1-ply + profiles) | 58% | 25.0% | 5 |
| 1-ply + card impact | 61% | 25.0% | 5 |
| deep 3 | 68% | 16.0% | 100 |
| deep 3 + card impact | 71% | 16.0% | 98 |
| deep 5 + card impact | 77% | 10.5% | 143 |

## Run 2 (seed 11): search depth

| Coach config | Agrees with oracle | Regret excl. game-losing | Game-losing picks | Blunders | ms / decision |
|---|---|---|---|---|---|
| deep 5 + card impact | 67% | 8.47 | 4 of 200 | 15.5% | 181 |
| deep 8 + card impact | 71% | 4.64 | 4 of 200 | 9.5% | 244 |
| **deep 12 + card impact** | **73%** | **3.91** | 4 of 200 | **7.5%** | 303 |
| deep 8 (no impact) | 70% | 4.68 | 4 of 200 | 9.5% | 238 |

## Head-to-head as players (vs the in-app Deep bot, every meta pairing, 168 games each)

| Config | Win rate |
|---|---|
| deep 12 + card impact | 51.2% |
| deep 5 + card impact | 50.6% |
| deep 12 (no impact) | 47.0% |

The 90% margin is about ±6 points, so no config clearly beats the Deep bot in real games.

## Verdict

The coach now runs **deep 12 + tuned profiles + card impact** (`src/ai/coach.ts`).
- Compared with the old coach, it makes **about a third as many blunders** (7.5% vs 25%) and agrees with the oracle far more often.
- Card impact (in-deck telemetry: "Δ when drawn") adds a few points of agreement and steers sells and mulligans toward each deck's game-winners.

**Caveats.**
- The oracle uses the same kind of rollout as deep search, so it favours deep configs somewhat.
- The win-rate test can't detect differences this small. Treat the coach as a careful second opinion, not an oracle.
- About 2% of spots were game-losing whatever the config picked.
