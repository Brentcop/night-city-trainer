# Coach evaluation (200 decisions from 17 games, oracle = 6 rollouts per candidate)

| Coach config | Agrees with oracle | Regret excl. game-losing (avg) | Game-losing picks | Blunders (>15 pts) | ms / decision |
|---|---|---|---|---|---|
| deep 5 + profiles + card impact | 67% | 8.47 | 4 of 200 | 15.5% | 181 |
| deep 8 + profiles + card impact | 71% | 4.64 | 4 of 200 | 9.5% | 244 |
| deep 12 + profiles + card impact | 73% | 3.91 | 4 of 200 | 7.5% | 303 |
| deep 8 + profiles (no impact) | 70% | 4.68 | 4 of 200 | 9.5% | 238 |

Regret is measured in evaluation points (a stolen Gig is worth ~40). Lower is better.