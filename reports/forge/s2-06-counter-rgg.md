# Forge log — S2-06 Counter (RGG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, Behind on Gigs, Spend, then punish; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 58.9%

- **Seat:** 52% on the play vs 66% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Pepe Najarro: Working Doubles (+28 pts when drawn), Wild in the Streets (+27 pts when drawn), Peace Offering (+14 pts when drawn), 6th Street Recruits (+12 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Shattered Memories (-13 pts), Valentino Street Racer (-9 pts), Corporate Surveillance (-5 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Corporate Surveillance (sold in 100% of games it's drawn), Satori: Sword of Saburo (sold in 93% of games it's drawn), We Gotta Live Together (sold in 93% of games it's drawn), Peace Offering (sold in 92% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Shattered Memories | -13.4 | -13.4 | yes | offered as a cut — Δ when drawn −13.4 pts |
| Valentino Street Racer | -8.9 | -8.9 | yes | offered as a cut — Δ when drawn −8.9 pts |
| Corporate Surveillance | -4.8 | -3.9 | yes | offered as a cut — Δ when drawn −4.8 pts; enabler for Spend, then punish: 58% with a partner (64 games), 0% without (1); partner-aware −4.1 pts; cutting one drops Spend, then punish assembly odds by turn 4 84% → 81%; score with the stranding cost −3.9 pts |
| (Don't Fear) The Reaper | -2.4 | -2.1 | no | not offered — Δ when drawn −2.4 pts; both for Spend, then punish: 58% with a partner (84 games), never drawn without one; partner-aware −2.4 pts; cutting one drops Spend, then punish assembly odds by turn 4 84% → 78%; score with the stranding cost −2.1 pts |
| Industrial Assembly | 0.1 | -0.4 | no | not offered — Δ when drawn +0.1 pts; both for High Gigs (8+): 57% with a partner (35 games), 75% without (4); partner-aware −1.1 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 28% → 14%; score with the stranding cost −0.4 pts |
| Over the Edge | 3.0 | 3.9 | no | not offered — Δ when drawn +3.0 pts; payoff for High Gigs (8+): 60% with a partner (53 games), 58% without (36); partner-aware +3.6 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 28% → 22%; score with the stranding cost +3.9 pts |
| We Gotta Live Together | 5.6 | 9.1 | no | not offered — Δ when drawn +5.6 pts; piece for Behind on Gigs: 65% with a partner (43 games), 54% without (24); partner-aware +8.3 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost +9.1 pts |

Screened (partner-aware):
- -1 Shattered Memories → +1 Peace Offering
- -1 Shattered Memories → +1 6th Street Recruits
- -1 Valentino Street Racer → +1 Peace Offering
- -1 Valentino Street Racer → +1 6th Street Recruits
- -1 Corporate Surveillance → +1 Peace Offering

The plain ranking would have screened:
- -1 Shattered Memories → +1 Peace Offering
- -1 Shattered Memories → +1 6th Street Recruits
- -1 Valentino Street Racer → +1 Peace Offering
- -1 Valentino Street Racer → +1 6th Street Recruits
- -1 Corporate Surveillance → +1 Peace Offering

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Shattered Memories → +1 6th Street Recruits | 63.4% | 4.5 | [-0.7, 9.7] |
| -1 Shattered Memories → +1 Peace Offering | 60.7% | 1.8 | [-3.2, 6.7] |
| Swap Units in the trash → Arasaka Units: +3 Field Operator, +2 Goro Takemura: Losing His Way / -2 Fool on the Hill, -3 Shattered Memories | 60.7% | 1.8 | [-7.5, 11.1] |
| -1 Corporate Surveillance → +1 Peace Offering | 59.8% | 0.9 | [-2.1, 3.9] |
| -1 Valentino Street Racer → +1 Peace Offering | 58.9% | 0.0 | [-6.1, 6.1] |
| Complete Ahead on Street Cred: +3 Royce: Don't Call Me Simon / -3 Shattered Memories | 58.9% | 0.0 | [-7.9, 7.9] |
| -1 Valentino Street Racer → +1 6th Street Recruits | 57.1% | -1.8 | [-7.9, 4.3] |
| Add Block, then punish: +3 Maelstrom Zealots, +3 Corpo Security, +1 Riot Shield / -3 Shattered Memories, -3 Valentino Street Racer, -1 Satori: Sword of Saburo | 46.4% | -12.5 | [-24.2, -0.8] |

Confirmation of -1 Shattered Memories → +1 6th Street Recruits (fresh paired games; screening +4.5 pts [−0.7, +9.7], 112 games): baseline 58.7% vs swap 63.2%; held-out paired gain +4.5 pts [+1.2, +7.8], 448 games (z 2.50, 2 stages) → **adopted**

Saved data\decks\custom\s2-06-counter-rgg.txt (previous version archived in data/decks/custom/history/).

Packages (built around, start → end): kept Value-pairs, Behind on Gigs, Spend, then punish; added High Gigs (8+).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 63.2% | -1 Shattered Memories → +1 6th Street Recruits (held-out +4.5 pts [+1.2, +7.8], 448 games) |