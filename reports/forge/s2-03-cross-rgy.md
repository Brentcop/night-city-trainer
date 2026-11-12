# Forge log — S2-03 Cross (RGY)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, High Gigs (8+); package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 49.1%

- **Seat:** 41% on the play vs 57% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Rockn' Rockerboy (+27 pts when drawn), 6th Street Recruits (+21 pts when drawn), Pepe Najarro: Working Doubles (+13 pts when drawn), Saul Bright: Stormrider (+7 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Peace Offering (-14 pts), Over the Edge (-13 pts), Mantis Blades (-10 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Corporate Surveillance (sold in 99% of games it's drawn), Mantis Blades (sold in 96% of games it's drawn), Synapse Burnout (sold in 96% of games it's drawn), The Heist (sold in 88% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Peace Offering | -14.4 | -16.1 | yes | offered as a cut — Δ when drawn −14.4 pts; both for Value-pairs: 41% with a partner (29 games), 47% without (51); partner-aware −16.5 pts; cutting one drops Value-pairs assembly odds by turn 4 15% → 6%; score with the stranding cost −16.1 pts |
| Over the Edge | -12.6 | -11.4 | yes | offered as a cut — Δ when drawn −12.6 pts; payoff for High Gigs (8+): 48% with a partner (91 games), 33% without (6); partner-aware −11.8 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 58% → 50%; score with the stranding cost −11.4 pts |
| Mantis Blades | -9.5 | -7.0 | no | not offered: the package view moved it up — Δ when drawn −9.5 pts; enabler for Cyberware toolbox (Viktor Vektor): 48% with a partner (61 games), 40% without (15); partner-aware −8.4 pts; cutting one drops Cyberware toolbox (Viktor Vektor) assembly odds by turn 4 25% → 14%; cutting one drops Gear on Units assembly odds by turn 4 36% → 33%; score with the stranding cost −7.0 pts |
| Corporate Surveillance | -8.9 | -8.9 | yes | offered as a cut (the package view moved it down) — Δ when drawn −8.9 pts |
| We Gotta Live Together | -5.4 | -4.0 | no | not offered — Δ when drawn −5.4 pts; piece for Behind on Gigs: — with a partner (0 games), 47% without (76); partner-aware −5.4 pts; cutting one drops Behind on Gigs assembly odds by turn 4 44% → 25%; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost −4.0 pts |
| Satori: Sword of Saburo | -5.3 | -3.1 | no | not offered — Δ when drawn −5.3 pts; enabler for Gear on Units: 50% with a partner (48 games), 42% without (26); partner-aware −3.4 pts; cutting one drops Gear on Units assembly odds by turn 4 36% → 33%; score with the stranding cost −3.1 pts |
| The Heist | -5.2 | -3.5 | no | not offered — Δ when drawn −5.2 pts; payoff for Gig value matches a cost: — with a partner (0 games), 47% without (66); partner-aware −5.2 pts; cutting one drops Gig value matches a cost assembly odds by turn 4 44% → 25%; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; cutting one drops Gear on Units assembly odds by turn 4 36% → 33%; score with the stranding cost −3.5 pts |
| Memory Relapse | -3.9 | -3.1 | no | not offered — Δ when drawn −3.9 pts; payoff for Even Street Cred: — with a partner (0 games), 48% without (89); partner-aware −3.9 pts; cutting one drops Even Street Cred assembly odds by turn 4 59% → 44%; score with the stranding cost −3.1 pts |

Screened (partner-aware):
- -1 Peace Offering → +1 Valentino Street Racer
- -1 Peace Offering → +1 Pepe Najarro: Working Doubles
- -1 Over the Edge → +1 Valentino Street Racer
- -1 Over the Edge → +1 Pepe Najarro: Working Doubles
- -1 Peace Offering → +1 Saul Bright: Stormrider

The plain ranking would have screened:
- -1 Peace Offering → +1 Valentino Street Racer
- -1 Peace Offering → +1 Pepe Najarro: Working Doubles
- -1 Over the Edge → +1 Valentino Street Racer
- -1 Over the Edge → +1 Pepe Najarro: Working Doubles
- -1 Mantis Blades → +1 Valentino Street Racer

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| Swap Gear on Units → Arasaka Units: +3 Field Operator, +2 Hanako Arasaka: In a Gilded Cage, +2 Valentino Street Racer, +1 Pepe Najarro: Working Doubles / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 The Heist, -2 Cyberpsychosis | 72.3% | 23.2 | [14.3, 32.2] |
| Complete Ahead on Street Cred: +3 Royce: Don't Call Me Simon / -2 Mantis Blades, -1 Corporate Surveillance | 59.8% | 10.7 | [2.3, 19.1] |
| -1 Peace Offering → +1 Valentino Street Racer | 56.3% | 7.1 | [2.4, 11.9] |
| -1 Peace Offering → +1 Pepe Najarro: Working Doubles | 55.4% | 6.3 | [1.7, 10.8] |
| -1 Over the Edge → +1 Valentino Street Racer | 54.5% | 5.4 | [-0.1, 10.8] |
| -1 Peace Offering → +1 Saul Bright: Stormrider | 53.6% | 4.5 | [-0.1, 9.0] |
| -1 Over the Edge → +1 Pepe Najarro: Working Doubles | 52.7% | 3.6 | [-1.4, 8.5] |
| Add Block, then punish: +3 Maelstrom Zealots, +3 Corpo Security, +1 Riot Shield / -2 Mantis Blades, -3 Corporate Surveillance, -2 We Gotta Live Together | 49.1% | 0.0 | [-9.6, 9.6] |

Confirmation of Swap Gear on Units → Arasaka Units: +3 Field Operator, +2 Hanako Arasaka: In a Gilded Cage, +2 Valentino Street Racer, +1 Pepe Najarro: Working Doubles / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 The Heist, -2 Cyberpsychosis (fresh paired games; screening +23.2 pts [+14.3, +32.2], 112 games): baseline 57.6% vs swap 73.2%; held-out paired gain +15.6 pts [+6.9, +24.4], 224 games (z 2.50, 1 stage) → **adopted**

Saved data\decks\custom\s2-03-cross-rgy.txt (previous version archived in data/decks/custom/history/).

Packages (built around, start → end): kept High Gigs (8+); added Even Street Cred, Arasaka Units. Package moves adopted: Swap Gear on Units → Arasaka Units: +3 Field Operator, +2 Hanako Arasaka: In a Gilded Cage, +2 Valentino Street Racer, +1 Pepe Najarro: Working Doubles / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 The Heist, -2 Cyberpsychosis.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 73.2% | Swap Gear on Units → Arasaka Units: +3 Field Operator, +2 Hanako Arasaka: In a Gilded Cage, +2 Valentino Street Racer, +1 Pepe Najarro: Working Doubles / -2 Mantis Blades, -2 Satori: Sword of Saburo, -2 The Heist, -2 Cyberpsychosis (held-out +15.6 pts [+6.9, +24.4], 224 games) |