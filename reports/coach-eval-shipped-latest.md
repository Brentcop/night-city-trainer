# Coach evaluation (120 decisions from 16 games, oracle = 8 rollouts per candidate)

| Coach config | Agrees with oracle | Regret excl. game-losing (avg) | Game-losing picks | Blunders (>15 pts) | ms / decision |
|---|---|---|---|---|---|
| shipped coach (makeCoach) | 93% | 0.91 | 0 of 120 | 1.7% | 131 |
| coach v1 (deep 12 + profiles + card impact) | 87% | 4.91 | 0 of 120 | 5.8% | 21 |

Regret is measured in evaluation points (a stolen Gig is worth ~40). Lower is better.