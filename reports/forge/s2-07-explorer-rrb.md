# Forge log — S2-07 Explorer (RRB)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 split over 4 looks (Bonferroni, z = 2.50).

Packages: keep Rocker Units (Johnny Silverhand), Value-pairs, High Gigs (8+), Ahead on Street Cred; package moves on (3 per generation).

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 67.0%

- **Seat:** 59% on the play vs 75% on the draw. When you choose (you lost the last game), choose to go **second**.
- **Cards that win games:** 6th Street Recruits (+18 pts when drawn), Royce: Don't Call Me Simon (+11 pts when drawn), Gunpoint Diplomacy (+10 pts when drawn), NetWatch Netdriver (+7 pts when drawn). Keep these over everything when you sell or mulligan.
- **Underperformers:** Swordwise Huscle (-29 pts), Johnny Silverhand: Never Stop Fighting (-21 pts), Psycho Squad (-14 pts). Sell these first, and consider cutting them or moving them to the sideboard.
- **Usual Eddie fodder:** Appetite for Destruction (sold in 100% of games it's drawn), Unlikely Bond (sold in 95% of games it's drawn), NetWatch Netdriver (sold in 95% of games it's drawn), Nocturne OP55 N1 (sold in 95% of games it's drawn).

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Swordwise Huscle | -29.2 | -29.2 | yes | offered as a cut — Δ when drawn −29.2 pts |
| Psycho Squad | -14.5 | -14.5 | yes | offered as a cut — Δ when drawn −14.5 pts |
| Industrial Assembly | -11.7 | -11.1 | yes | offered as a cut — Δ when drawn −11.7 pts; both for High Gigs (8+): 59% with a partner (34 games), never drawn without one; partner-aware −11.7 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 70% → 59%; score with the stranding cost −11.1 pts |
| Bonnie and Clyde | -8.6 | -7.6 | no | not offered — Δ when drawn −8.6 pts; piece for Behind on Gigs: — with a partner (0 games), 64% without (72); partner-aware −8.6 pts; cutting one drops Behind on Gigs assembly odds by turn 4 44% → 25%; score with the stranding cost −7.6 pts |
| Over the Edge | -6.6 | -2.5 | no | not offered — Δ when drawn −6.6 pts; payoff for High Gigs (8+): 70% with a partner (43 games), 47% without (15); partner-aware −2.5 pts; surplus piece: cutting one moves High Gigs (8+) assembly odds by turn 4 only 70% → 70% |

Screened (partner-aware):
- -1 Swordwise Huscle → +1 Royce: Don't Call Me Simon
- -1 Swordwise Huscle → +1 Gunpoint Diplomacy
- -1 Swordwise Huscle → +1 Placide: Voodoo Sentinel
- -1 Swordwise Huscle → +1 All is Lost
- -1 Swordwise Huscle → +1 Bonnie and Clyde

The plain ranking would have screened:
- -1 Swordwise Huscle → +1 Royce: Don't Call Me Simon
- -1 Swordwise Huscle → +1 Gunpoint Diplomacy
- -1 Swordwise Huscle → +1 Placide: Voodoo Sentinel
- -1 Swordwise Huscle → +1 Bonnie and Clyde
- -1 Swordwise Huscle → +1 All is Lost

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Swordwise Huscle → +1 Gunpoint Diplomacy | 71.4% | 4.5 | [-0.1, 9.0] |
| -1 Swordwise Huscle → +1 All is Lost | 71.4% | 4.5 | [-0.1, 9.0] |
| -1 Swordwise Huscle → +1 Bonnie and Clyde | 71.4% | 4.5 | [-0.1, 9.0] |
| -1 Swordwise Huscle → +1 Royce: Don't Call Me Simon | 70.5% | 3.6 | [-0.7, 7.8] |
| -1 Swordwise Huscle → +1 Placide: Voodoo Sentinel | 68.8% | 1.8 | [-1.7, 5.3] |
| Add Low Gigs (min Gig): +3 Trust No One, +3 Chrome Reverie / -2 Swordwise Huscle, -3 Psycho Squad, -1 Unlikely Bond | 65.2% | -1.8 | [-11.4, 7.8] |
| Swap Behind on Gigs → Behind on Street Cred: +3 Modded Muramasa, +2 Trust No One / -2 Bonnie and Clyde, -2 Swordwise Huscle, -1 Psycho Squad | 61.6% | -5.4 | [-16.1, 5.4] |
| Complete Programs as fuel (Blue): +3 Placide: Voodoo Sentinel, +1 Lizzy Wizzy: Delicate Weapon / -2 Swordwise Huscle, -2 Psycho Squad | 60.7% | -6.3 | [-16.6, 4.1] |

Confirmation of -1 Swordwise Huscle → +1 Gunpoint Diplomacy (fresh paired games; screening +4.5 pts [−0.1, +9.0], 112 games): baseline 71.9% vs swap 71.0%; held-out paired gain −0.9 pts [−3.4, +1.6], 448 games (z 2.50, 2 stages) → **could not tell (stopped early: no gain after 448 games)**


Packages (built around, start → end): kept High Gigs (8+), Ahead on Street Cred, Rocker Units (Johnny Silverhand).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 71.9% | kept (could not tell: -1 Swordwise Huscle → +1 Gunpoint Diplomacy, −0.9 pts [−3.4, +1.6], 448 games; stopped early: no gain after 448 games) |