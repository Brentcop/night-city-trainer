# Forge log — S2-02 Mutant (RGG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, Even Street Cred, Behind on Gigs, Spend, then punish; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 62.5%

- **Seat:** 48% on the play vs 77% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** Wild in the Streets (+10 pts when drawn), Field Operator (+10 pts when drawn), We Gotta Live Together (+8 pts when drawn), Nadia: Fighting Through Grief (+8 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Satori: Sword of Saburo (-15 pts), (Don't Fear) The Reaper (-7 pts), Saul Bright: Stormrider (-6 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Synapse Burnout (sold in 100% of games it's drawn), We Gotta Live Together (sold in 99% of games it's drawn), Peace Offering (sold in 98% of games it's drawn), Memory Relapse (sold in 96% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Satori: Sword of Saburo | -14.9 | -14.9 | yes | offered as a cut — Δ when drawn −14.9 pts |
| (Don't Fear) The Reaper | -7.1 | -5.4 | no | not offered: the package view moved it up — Δ when drawn −7.1 pts; both for Spend, then punish: 62% with a partner (77 games), 43% without (7); partner-aware −5.9 pts; cutting one drops Spend, then punish assembly odds by turn 4 67% → 58%; score with the stranding cost −5.4 pts |
| Saul Bright: Stormrider | -6.4 | -6.4 | yes | offered as a cut — Δ when drawn −6.4 pts |
| Valentino Street Racer | -5.9 | -5.9 | yes | offered as a cut (the package view moved it down) — Δ when drawn −5.9 pts |
| Goro Takemura: Losing His Way | -1.1 | -0.3 | no | not offered — Δ when drawn −1.1 pts; payoff for Face-up Legends: — with a partner (0 games), 62% without (34); partner-aware −1.1 pts; cutting one drops Face-up Legends assembly odds by turn 4 59% → 44%; score with the stranding cost −0.3 pts |
| Fool on the Hill | 2.8 | 4.7 | no | not offered — Δ when drawn +2.8 pts; enabler for Units in the trash: 66% with a partner (41 games), 60% without (25); partner-aware +4.3 pts; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost +4.7 pts |

Screened (partner-aware):
- -1 Satori: Sword of Saburo → +1 Field Operator
- -1 Satori: Sword of Saburo → +1 We Gotta Live Together
- -1 Satori: Sword of Saburo → +1 All is Lost
- -1 Saul Bright: Stormrider → +1 Field Operator
- -1 Valentino Street Racer → +1 Field Operator

The plain ranking would have screened:
- -1 Satori: Sword of Saburo → +1 Field Operator
- -1 Satori: Sword of Saburo → +1 We Gotta Live Together
- -1 Satori: Sword of Saburo → +1 All is Lost
- -1 (Don't Fear) The Reaper → +1 Field Operator
- -1 Saul Bright: Stormrider → +1 Field Operator

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Saul Bright: Stormrider → +1 Field Operator | 63.4% | 0.9 | [-3.0, 4.8] |
| -1 Satori: Sword of Saburo → +1 All is Lost | 61.6% | -0.9 | [-2.6, 0.9] |
| -1 Valentino Street Racer → +1 Field Operator | 61.6% | -0.9 | [-2.6, 0.9] |
| -1 Satori: Sword of Saburo → +1 We Gotta Live Together | 60.7% | -1.8 | [-5.3, 1.7] |
| -1 Satori: Sword of Saburo → +1 Field Operator | 58.9% | -3.6 | [-9.6, 2.5] |
| Swap Arasaka Units → Ahead on Street Cred: +3 Royce: Don't Call Me Simon / -1 Goro Takemura: Losing His Way, -2 Satori: Sword of Saburo | 58.0% | -4.5 | [-13.6, 4.6] |
| Complete Ahead on Street Cred: +3 Royce: Don't Call Me Simon / -2 Satori: Sword of Saburo, -1 Saul Bright: Stormrider | 54.5% | -8.0 | [-17.4, 1.3] |
| Add Block, then punish: +3 Maelstrom Zealots, +3 Corpo Security, +1 Riot Shield / -2 Satori: Sword of Saburo, -3 Saul Bright: Stormrider, -2 Valentino Street Racer | 53.6% | -8.9 | [-20.2, 2.3] |

No swap beat the baseline by 2+ points — **list kept**.


Packages (built around, start → end): kept Value-pairs, Even Street Cred, Behind on Gigs, Spend, then punish.

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 62.5% | kept |