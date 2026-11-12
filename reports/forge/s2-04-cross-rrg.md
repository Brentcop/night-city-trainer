# Forge log — S2-04 Cross (RRG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, High Gigs (8+), Behind on Gigs, Braindance Programs; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 63.4%

- **Seat:** 59% on the play vs 68% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** 6th Street Recruits (+27 pts when drawn), Animals Wrecker (+14 pts when drawn), Pepe Najarro: Working Doubles (+13 pts when drawn), Appetite for Destruction (+11 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Gunpoint Diplomacy (-18 pts), Carnage at the Colosseum (-17 pts), Industrial Assembly (-12 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Appetite for Destruction (sold in 100% of games it's drawn), Detonate (sold in 95% of games it's drawn), Mantis Blades (sold in 91% of games it's drawn), Satori: Sword of Saburo (sold in 91% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Gunpoint Diplomacy | -17.9 | -16.9 | yes | offered as a cut — Δ when drawn −17.9 pts; payoff for Ahead on Street Cred: 56% with a partner (66 games), never drawn without one; partner-aware −17.9 pts; cutting one drops Ahead on Street Cred assembly odds by turn 4 44% → 25%; score with the stranding cost −16.9 pts |
| Carnage at the Colosseum | -17.1 | -17.0 | yes | offered as a cut — Δ when drawn −17.1 pts; payoff for High Gigs (8+): 61% with a partner (94 games), never drawn without one; partner-aware −17.1 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; score with the stranding cost −17.0 pts |
| Industrial Assembly | -12.5 | -12.3 | yes | offered as a cut — Δ when drawn −12.5 pts; both for High Gigs (8+): 57% with a partner (56 games), never drawn without one; partner-aware −12.5 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; score with the stranding cost −12.3 pts |
| Bonnie and Clyde | -7.8 | -8.3 | no | not offered — Δ when drawn −7.8 pts; piece for Behind on Gigs: 60% with a partner (48 games), 63% without (41); partner-aware −8.7 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost −8.3 pts |
| Memory Relapse | -2.2 | -1.4 | no | not offered — Δ when drawn −2.2 pts; payoff for Even Street Cred: — with a partner (0 games), 63% without (75); partner-aware −2.2 pts; cutting one drops Even Street Cred assembly odds by turn 4 59% → 44%; score with the stranding cost −1.4 pts |

Screened (partner-aware):
- -1 Carnage at the Colosseum → +1 Pepe Najarro: Working Doubles
- -1 Gunpoint Diplomacy → +1 Pepe Najarro: Working Doubles
- -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon
- -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon
- -1 Carnage at the Colosseum → +1 Appetite for Destruction

The plain ranking would have screened:
- -1 Gunpoint Diplomacy → +1 Pepe Najarro: Working Doubles
- -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon
- -1 Carnage at the Colosseum → +1 Pepe Najarro: Working Doubles
- -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon
- -1 Gunpoint Diplomacy → +1 Appetite for Destruction

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| Swap Ahead on Street Cred → Even Street Cred: +1 Field Operator, +1 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy | 72.3% | 8.9 | [1.2, 16.6] |
| -1 Carnage at the Colosseum → +1 Pepe Najarro: Working Doubles | 67.0% | 3.6 | [-0.7, 7.8] |
| -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon | 67.0% | 3.6 | [0.1, 7.0] |
| Add Value-pairs: +2 Peace Offering, +2 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy, -2 Satori: Sword of Saburo | 66.1% | 2.7 | [-5.4, 10.7] |
| -1 Gunpoint Diplomacy → +1 Pepe Najarro: Working Doubles | 65.2% | 1.8 | [-3.2, 6.7] |
| -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon | 65.2% | 1.8 | [-1.7, 5.3] |
| Complete Value-pairs: +2 Peace Offering / -2 Gunpoint Diplomacy | 64.3% | 0.9 | [-5.4, 7.2] |
| -1 Carnage at the Colosseum → +1 Appetite for Destruction | 62.5% | -0.9 | [-2.6, 0.9] |

Confirmation of Swap Ahead on Street Cred → Even Street Cred: +1 Field Operator, +1 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy (fresh paired games; screening +8.9 pts [+1.2, +16.6], 112 games): baseline 63.4% vs swap 72.3%; held-out paired gain +8.9 pts [+2.8, +15.1], 224 games (z 2.50, 1 stage) → **adopted**

Saved data\decks\custom\s2-04-cross-rrg.txt (previous version archived in data/decks/custom/history/).

Packages (built around, start → end): kept High Gigs (8+), Behind on Gigs, Braindance Programs; added Even Street Cred. Package moves adopted: Swap Ahead on Street Cred → Even Street Cred: +1 Field Operator, +1 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 72.3% | Swap Ahead on Street Cred → Even Street Cred: +1 Field Operator, +1 Pepe Najarro: Working Doubles / -2 Gunpoint Diplomacy (held-out +8.9 pts [+2.8, +15.1], 224 games) |