# Forge log — S2-05 Counter (RRG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, High Gigs (8+), Behind on Gigs; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 71.4%

- **Seat:** 64% on the play vs 79% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Pepe Najarro: Working Doubles (+22 pts when drawn), Animals Wrecker (+21 pts when drawn), 6th Street Recruits (+14 pts when drawn), Yorinobu Arasaka: Steel Dragon (+12 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Bonnie and Clyde (-18 pts), We Gotta Live Together (-11 pts), Valentino Street Racer (-7 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** We Gotta Live Together (sold in 97% of games it's drawn), Mantis Blades (sold in 97% of games it's drawn), Appetite for Destruction (sold in 97% of games it's drawn), Satori: Sword of Saburo (sold in 94% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Bonnie and Clyde | -18.1 | -16.9 | yes | offered as a cut — Δ when drawn −18.1 pts; piece for Behind on Gigs: 68% with a partner (44 games), 66% without (41); partner-aware −17.4 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost −16.9 pts |
| We Gotta Live Together | -11.2 | -13.0 | yes | offered as a cut — Δ when drawn −11.2 pts; piece for Behind on Gigs: 61% with a partner (33 games), 83% without (6); partner-aware −13.4 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost −13.0 pts |
| Valentino Street Racer | -7.2 | -7.2 | yes | offered as a cut — Δ when drawn −7.2 pts |
| Memory Relapse | -4.9 | -3.9 | no | not offered — Δ when drawn −4.9 pts; payoff for Even Street Cred: — with a partner (0 games), 70% without (69); partner-aware −4.9 pts; cutting one drops Even Street Cred assembly odds by turn 4 44% → 25%; score with the stranding cost −3.9 pts |
| Carnage at the Colosseum | -3.1 | -2.8 | no | not offered — Δ when drawn −3.1 pts; payoff for High Gigs (8+): 71% with a partner (89 games), never drawn without one; partner-aware −3.1 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 85% → 78%; score with the stranding cost −2.8 pts |
| Nadia: Fighting Through Grief | -1.7 | -4.2 | no | not offered — Δ when drawn −1.7 pts; piece for Behind on Gigs: 66% with a partner (32 games), 100% without (5); partner-aware −4.6 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost −4.2 pts |

Screened (partner-aware):
- -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon
- -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon
- -1 Bonnie and Clyde → +1 Shattered Memories
- -1 We Gotta Live Together → +1 Shattered Memories
- -1 Bonnie and Clyde → +1 All is Lost

The plain ranking would have screened:
- -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon
- -1 Bonnie and Clyde → +1 Shattered Memories
- -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon
- -1 Bonnie and Clyde → +1 All is Lost
- -1 Bonnie and Clyde → +1 Field Operator

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon | 76.8% | 5.4 | [1.2, 9.5] |
| -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon | 75.9% | 4.5 | [0.6, 8.3] |
| Complete Units in the trash: +3 All is Lost / -3 Valentino Street Racer | 74.1% | 2.7 | [-6.1, 11.5] |
| Swap Even Street Cred → Ahead on Street Cred: +1 Gunpoint Diplomacy, +1 Yorinobu Arasaka: Steel Dragon / -2 Memory Relapse | 74.1% | 2.7 | [-3.6, 9.0] |
| -1 Bonnie and Clyde → +1 All is Lost | 73.2% | 1.8 | [-0.7, 4.2] |
| -1 We Gotta Live Together → +1 Shattered Memories | 72.3% | 0.9 | [-0.9, 2.6] |
| -1 Bonnie and Clyde → +1 Shattered Memories | 71.4% | 0.0 | [-2.5, 2.5] |
| Add Block, then punish: +3 Maelstrom Zealots, +3 Corpo Security, +1 Riot Shield / -3 Valentino Street Racer, -2 Memory Relapse, -1 Swordwise Huscle, -1 Appetite for Destruction | 62.5% | -8.9 | [-19.0, 1.2] |

Confirmation of -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon (fresh paired games; screening +5.4 pts [+1.2, +9.5], 112 games): baseline 69.3% vs swap 70.8%; held-out paired gain +1.5 pts [−0.3, +3.2], 896 games (z 2.50, 4 stages) → **could not tell**


Packages (built around, start → end): kept High Gigs (8+), Value-pairs, Behind on Gigs.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 69.3% | kept (could not tell: -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon, +1.5 pts [−0.3, +3.2], 896 games) |