# Forge log — S2-01 Mutant (RYY)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, High Gigs (8+), Mixed Gig values, Gig value matches a cost; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 46.4%

- **Seat:** 38% on the play vs 55% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Dexter DeShawn: One Last Chance (+20 pts when drawn), Industrial Assembly (+14 pts when drawn), Gorilla Arms (+12 pts when drawn), Rockn' Rockerboy (+9 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** 6th Street Recruits (-19 pts), Shattered Memories (-16 pts), Live with the Aftermath (-10 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Detonate (sold in 97% of games it's drawn), Afterparty at Lizzie's (sold in 92% of games it's drawn), Mantis Blades (sold in 89% of games it's drawn), Cyberpsychosis (sold in 88% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| 6th Street Recruits | -19.0 | -18.9 | yes | offered as a cut — Δ when drawn −19.0 pts; enabler for High Gigs (8+): 43% with a partner (86 games), 40% without (5); partner-aware −18.9 pts; surplus piece: cutting one moves High Gigs (8+) assembly odds by turn 4 only 78% → 78% |
| Shattered Memories | -15.9 | -15.9 | yes | offered as a cut — Δ when drawn −15.9 pts |
| Live with the Aftermath | -9.8 | -9.8 | no | not offered: the package view moved it up — Δ when drawn −9.8 pts |
| Bootleg Black Sapphire Show | -9.6 | -10.4 | yes | offered as a cut (the package view moved it down) — Δ when drawn −9.6 pts; payoff for Mixed Gig values: 41% with a partner (63 games), 60% without (5); partner-aware −10.7 pts; cutting one drops Mixed Gig values assembly odds by turn 4 85% → 78%; score with the stranding cost −10.4 pts |
| Mantis Blades | -6.5 | -4.9 | no | not offered — Δ when drawn −6.5 pts; enabler for Gear on Units: 44% with a partner (62 games), never drawn without one; partner-aware −6.5 pts; cutting one drops Gear on Units assembly odds by turn 4 85% → 78%; cutting one drops Gear as fuel assembly odds by turn 4 85% → 78%; cutting one drops Cyberware toolbox (Viktor Vektor) assembly odds by turn 4 17% → 14%; score with the stranding cost −4.9 pts |
| Afterparty at Lizzie's | -3.3 | -2.0 | no | not offered — Δ when drawn −3.3 pts; both for Mixed Gig values: 47% with a partner (73 games), 0% without (2); partner-aware −2.3 pts; cutting one drops Mixed Gig values assembly odds by turn 4 85% → 78%; score with the stranding cost −2.0 pts |
| Over the Edge | -1.8 | -1.8 | no | not offered — Δ when drawn −1.8 pts; payoff for High Gigs (8+): 45% with a partner (88 games), 100% without (1); partner-aware −2.3 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 78% → 70%; score with the stranding cost −1.8 pts |

Screened (partner-aware):
- -1 6th Street Recruits → +1 Industrial Assembly
- -1 6th Street Recruits → +1 Gorilla Arms
- -1 Shattered Memories → +1 Industrial Assembly
- -1 Shattered Memories → +1 Gorilla Arms
- -1 Bootleg Black Sapphire Show → +1 Industrial Assembly

The plain ranking would have screened:
- -1 6th Street Recruits → +1 Industrial Assembly
- -1 6th Street Recruits → +1 Gorilla Arms
- -1 Shattered Memories → +1 Industrial Assembly
- -1 Shattered Memories → +1 Gorilla Arms
- -1 Live with the Aftermath → +1 Industrial Assembly

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| Swap Gear on Units → Ahead on Street Cred: +3 Royce: Don't Call Me Simon, +1 Industrial Assembly, +2 Viktor Vektor: You Might Feel a Little Pinch / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 Cyberpsychosis | 53.6% | 7.1 | [-2.1, 16.3] |
| Complete Ahead on Street Cred: +3 Royce: Don't Call Me Simon / -2 Shattered Memories, -1 Live with the Aftermath | 51.8% | 5.4 | [-3.2, 13.9] |
| -1 Bootleg Black Sapphire Show → +1 Industrial Assembly | 49.1% | 2.7 | [-2.6, 7.9] |
| -1 Shattered Memories → +1 Industrial Assembly | 47.3% | 0.9 | [-0.9, 2.6] |
| -1 6th Street Recruits → +1 Gorilla Arms | 46.4% | 0.0 | [-6.1, 6.1] |
| -1 Shattered Memories → +1 Gorilla Arms | 46.4% | 0.0 | [-2.5, 2.5] |
| -1 6th Street Recruits → +1 Industrial Assembly | 44.6% | -1.8 | [-6.1, 2.5] |
| Add Block, then punish: +3 Safety Override, +3 Augmented Negotiators, +1 La Llorona: Ghost of the Past / -2 Shattered Memories, -3 Live with the Aftermath, -2 Mantis Blades | 44.6% | -1.8 | [-12.0, 8.5] |

Confirmation of Swap Gear on Units → Ahead on Street Cred: +3 Royce: Don't Call Me Simon, +1 Industrial Assembly, +2 Viktor Vektor: You Might Feel a Little Pinch / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 Cyberpsychosis (fresh paired games; screening +7.1 pts [−2.1, +16.3], 112 games): baseline 45.8% vs swap 49.3%; held-out paired gain +3.6 pts [−0.2, +7.4], 896 games (z 2.50, 4 stages) → **could not tell**


Packages (built around, start → end): kept High Gigs (8+), Mixed Gig values, Gig value matches a cost.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 45.8% | kept (could not tell: Swap Gear on Units → Ahead on Street Cred: +3 Royce: Don't Call Me Simon, +1 Industrial Assembly, +2 Viktor Vektor: You Might Feel a Little Pinch / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 Cyberpsychosis, +3.6 pts [−0.2, +7.4], 896 games) |