# Coach evaluation (120 decisions from 15 games, oracle = 8 rollouts per candidate)

| Coach config | Agrees with oracle | Regret excl. game-losing (avg) | Game-losing picks | Blunders (>15 pts) | ms / decision |
|---|---|---|---|---|---|
| shipped coach (makeCoach) | 89% | 1.25 | 0 of 120 | 2.5% | 116 |
| coach v1 (deep 12 + profiles + card impact) | 86% | 5.62 | 0 of 120 | 5.0% | 20 |

Regret is measured in evaluation points (a stolen Gig is worth ~40). Lower is better.