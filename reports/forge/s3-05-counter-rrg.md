# Forge log — S3-05 Counter (RRG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep High Gigs (8+), Value-pairs, Behind on Gigs, Braindance Programs; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 55.4%

- **Seat:** in 112 games, this list won 61% on the play and 50% on the draw.
- **Cards most associated with wins:** Animals Wrecker (+42 points, drawn in 86 games), Saul Bright: Stormrider (+23 points, drawn in 40 games), Yorinobu Arasaka: Steel Dragon (+22 points, drawn in 67 games), Shattered Memories (+17 points, drawn in 64 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** Memory Relapse (-33 points, drawn in 76 games), Bonnie and Clyde (-17 points, drawn in 76 games), Gunpoint Diplomacy (-8 points, drawn in 62 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Detonate (sold in 100% of the 38 games it was drawn), Corporate Surveillance (sold in 98% of the 41 games it was drawn), We Gotta Live Together (sold in 93% of the 74 games it was drawn), Satori: Sword of Saburo (sold in 90% of the 83 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Memory Relapse | -33.0 | -32.3 | yes | offered as a cut — Δ when drawn −33.0 pts; payoff for Even Street Cred: — with a partner (0 games), 45% without (76); partner-aware −33.0 pts; cutting one drops Even Street Cred assembly odds by turn 4 59% → 44%; score with the stranding cost −32.3 pts |
| Bonnie and Clyde | -16.7 | -17.6 | yes | offered as a cut — Δ when drawn −16.7 pts; piece for Behind on Gigs: 48% with a partner (52 games), 54% without (24); partner-aware −18.1 pts; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost −17.6 pts |
| Gunpoint Diplomacy | -8.4 | -3.7 | no | not offered: the package view moved it up — Δ when drawn −8.4 pts; payoff for Ahead on Street Cred: 57% with a partner (42 games), 40% without (20); partner-aware −4.6 pts; cutting one drops Ahead on Street Cred assembly odds by turn 4 44% → 25%; score with the stranding cost −3.7 pts |
| Detonate | -8.1 | -8.1 | yes | offered as a cut (the package view moved it down) — Δ when drawn −8.1 pts |
| We Gotta Live Together | 0.1 | 1.2 | no | not offered — Δ when drawn +0.1 pts; payoff for Units in the trash: 56% with a partner (72 games), 50% without (2); partner-aware +0.3 pts; cutting one drops Units in the trash assembly odds by turn 4 70% → 59%; cutting one drops Behind on Gigs assembly odds by turn 4 78% → 70%; score with the stranding cost +1.2 pts |
| Over the Edge | 2.8 | 7.1 | no | not offered — Δ when drawn +2.8 pts; payoff for High Gigs (8+): 62% with a partner (60 games), 41% without (22); partner-aware +6.9 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 52% → 49%; score with the stranding cost +7.1 pts |

Screened (partner-aware):
- -1 Memory Relapse → +1 Saul Bright: Stormrider
- -1 Memory Relapse → +1 Yorinobu Arasaka: Steel Dragon
- -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting
- -1 Bonnie and Clyde → +1 Saul Bright: Stormrider
- -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon

The plain ranking would have screened:
- -1 Memory Relapse → +1 Saul Bright: Stormrider
- -1 Memory Relapse → +1 Yorinobu Arasaka: Steel Dragon
- -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting
- -1 Bonnie and Clyde → +1 Saul Bright: Stormrider
- -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting | 60.7% | 5.4 | [0.5, 10.2] |
| -1 Memory Relapse → +1 Saul Bright: Stormrider | 58.9% | 3.6 | [-1.4, 8.5] |
| -1 Memory Relapse → +1 Yorinobu Arasaka: Steel Dragon | 57.1% | 1.8 | [-3.2, 6.7] |
| -1 Bonnie and Clyde → +1 Saul Bright: Stormrider | 56.3% | 0.9 | [-3.0, 4.8] |
| -1 Bonnie and Clyde → +1 Yorinobu Arasaka: Steel Dragon | 53.6% | -1.8 | [-6.1, 2.5] |

Confirmation of -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting (fresh paired games; screening +5.4 pts [+0.5, +10.2], 112 games): baseline 50.0% vs swap 50.0%; held-out paired gain +0.0 pts [−4.4, +4.4], 448 games (z 2.96, 2 stages) → **could not tell (stopped early: no gain after 448 games)**


Packages (built around, start → end): kept High Gigs (8+), Value-pairs, Behind on Gigs, Braindance Programs.

Change ledger: appended 560 screening and 448 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 50.0% | kept (could not tell: -1 Memory Relapse → +1 Johnny Silverhand: Never Stop Fighting, +0.0 pts [−4.4, +4.4], 448 games; stopped early: no gain after 448 games) |