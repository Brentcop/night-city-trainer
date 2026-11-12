# Forge log — S2-08 Explorer (GGY)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, Even Street Cred, Behind on Gigs, Spend, then punish, Face-up Legends; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 47.3%

- **Seat:** 41% on the play vs 54% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Rockn' Rockerboy (+16 pts when drawn), Nadia: Fighting Through Grief (+16 pts when drawn), Pepe Najarro: Working Doubles (+11 pts when drawn), Saul Bright: Stormrider (+10 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Memory Relapse (-11 pts), Goro Takemura: Losing His Way (-10 pts), Zetatech Berserk (-7 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Sandevistan (sold in 99% of games it's drawn), Cyberpsychosis (sold in 99% of games it's drawn), Memory Relapse (sold in 98% of games it's drawn), We Gotta Live Together (sold in 95% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Goro Takemura: Losing His Way | -10.3 | -12.2 | yes | offered as a cut — Δ when drawn −10.3 pts; payoff for Face-up Legends: 39% with a partner (41 games), 50% without (20); partner-aware −12.7 pts; cutting one drops Face-up Legends assembly odds by turn 4 70% → 59%; score with the stranding cost −12.2 pts |
| Zetatech Berserk | -7.5 | -8.3 | yes | offered as a cut — Δ when drawn −7.5 pts; payoff for Face-up Legends: 41% with a partner (32 games), 48% without (21); partner-aware −9.2 pts; cutting one drops Face-up Legends assembly odds by turn 4 70% → 59%; cutting one drops Gear on Units assembly odds by turn 4 36% → 33%; score with the stranding cost −8.3 pts |
| Overwatch: Panam's Gift | -4.2 | -3.2 | no | not offered: the package view moved it up — Δ when drawn −4.2 pts; payoff for Spend, then punish: 46% with a partner (71 games), 0% without (1); partner-aware −3.7 pts; cutting one drops Spend, then punish assembly odds by turn 4 92% → 89%; cutting one drops Gear on Units assembly odds by turn 4 36% → 33%; score with the stranding cost −3.2 pts |
| T-Bug: Amateur Philosopher | -4.1 | -7.1 | yes | offered as a cut (the package view moved it down) — Δ when drawn −4.1 pts; enabler for Face-up Legends: 42% with a partner (55 games), 58% without (19); partner-aware −7.1 pts; surplus piece: cutting one moves Face-up Legends assembly odds by turn 4 only 70% → 70% |
| Fool on the Hill | -1.6 | -1.1 | no | not offered — Δ when drawn −1.6 pts; enabler for Units in the trash: 47% with a partner (30 games), 46% without (28); partner-aware −1.5 pts; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost −1.1 pts |
| We Gotta Live Together | -1.4 | 1.7 | no | not offered — Δ when drawn −1.4 pts; piece for Behind on Gigs: 50% with a partner (42 games), 39% without (18); partner-aware +0.8 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost +1.7 pts |
| Dexter DeShawn: One Last Chance | -0.1 | -0.1 | no | not offered — Δ when drawn −0.1 pts; enabler for Value-pairs: 47% with a partner (36 games), never drawn without one; partner-aware −0.1 pts; surplus piece: cutting one moves Value-pairs assembly odds by turn 4 only 100% → 100% |

Screened (partner-aware):
- -1 Goro Takemura: Losing His Way → +1 Rockn' Rockerboy
- -1 Zetatech Berserk → +1 Rockn' Rockerboy
- -1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy
- -1 Goro Takemura: Losing His Way → +1 Viktor Vektor: You Might Feel a Little Pinch
- -1 Goro Takemura: Losing His Way → +1 Field Operator

The plain ranking would have screened:
- -1 Goro Takemura: Losing His Way → +1 Rockn' Rockerboy
- -1 Zetatech Berserk → +1 Rockn' Rockerboy
- -1 Overwatch: Panam's Gift → +1 Rockn' Rockerboy
- -1 Goro Takemura: Losing His Way → +1 Viktor Vektor: You Might Feel a Little Pinch
- -1 Goro Takemura: Losing His Way → +1 Field Operator

The package plan kept 1 swap from being played:
- -1 Memory Relapse → +1 Rockn' Rockerboy: cuts 1× Memory Relapse from kept package Even Street Cred, below its built-around minimum (3 payoffs, 4 pieces in all)

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy | 50.9% | 3.6 | [-1.9, 9.1] |
| Swap Gear on Units → Units in the trash: +1 Fool on the Hill, +1 Rockn' Rockerboy, +2 Viktor Vektor: You Might Feel a Little Pinch / -2 Sandevistan, -2 Cyberpsychosis | 49.1% | 1.8 | [-7.2, 10.7] |
| -1 Zetatech Berserk → +1 Rockn' Rockerboy | 48.2% | 0.9 | [-3.0, 4.8] |
| -1 Goro Takemura: Losing His Way → +1 Field Operator | 47.3% | 0.0 | [-3.5, 3.5] |
| -1 Goro Takemura: Losing His Way → +1 Viktor Vektor: You Might Feel a Little Pinch | 46.4% | -0.9 | [-2.6, 0.9] |
| Complete Cyberware toolbox (Viktor Vektor): +2 Viktor Vektor: You Might Feel a Little Pinch / -2 Fool on the Hill | 46.4% | -0.9 | [-9.3, 7.5] |
| -1 Goro Takemura: Losing His Way → +1 Rockn' Rockerboy | 44.6% | -2.7 | [-9.0, 3.6] |
| Add Blockers (Goro Takemura): +3 Corpo Security / -2 Fool on the Hill, -1 Cyberpsychosis | 41.1% | -6.3 | [-16.0, 3.5] |

Confirmation of -1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy (fresh paired games; screening +3.6 pts [−1.9, +9.1], 112 games): baseline 50.0% vs swap 49.8%; held-out paired gain −0.2 pts [−3.0, +2.6], 448 games (z 2.50, 2 stages) → **could not tell (stopped early: no gain after 448 games)**


Packages (built around, start → end): kept Value-pairs, Even Street Cred, Behind on Gigs, Spend, then punish, Face-up Legends.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 50.0% | kept (could not tell: -1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy, −0.2 pts [−3.0, +2.6], 448 games; stopped early: no gain after 448 games) |