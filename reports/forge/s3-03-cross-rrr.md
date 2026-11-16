# Forge log — S3-03 Cross (RRR)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep High Gigs (8+), Braindance Programs; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 52.7%

- **Seat:** in 112 games, this list won 63% on the play and 43% on the draw.
- **Cards most associated with wins:** Animals Wrecker (+29 points, drawn in 71 games), Over the Edge (+11 points, drawn in 87 games), Mantis Blades (+11 points, drawn in 55 games), Shattered Memories (+11 points, drawn in 55 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** Gunpoint Diplomacy (-33 points, drawn in 63 games), Meredith Stout: Stone Cold Corpo (-18 points, drawn in 88 games), Satori: Sword of Saburo (-15 points, drawn in 59 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Detonate (sold in 98% of the 64 games it was drawn), Arasaka Emergency Radioport (sold in 93% of the 67 games it was drawn), All is Lost (sold in 89% of the 44 games it was drawn), Mantis Blades (sold in 87% of the 55 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Gunpoint Diplomacy | -33.3 | -33.1 | yes | offered as a cut — Δ when drawn −33.3 pts; payoff for Ahead on Street Cred: 37% with a partner (62 games), 100% without (1); partner-aware −34.1 pts; cutting one drops Ahead on Street Cred assembly odds by turn 4 44% → 25%; score with the stranding cost −33.1 pts |
| Meredith Stout: Stone Cold Corpo | -17.8 | -17.8 | yes | offered as a cut — Δ when drawn −17.8 pts |
| Satori: Sword of Saburo | -14.6 | -14.6 | yes | offered as a cut — Δ when drawn −14.6 pts |
| Carnage at the Colosseum | 6.1 | 5.5 | no | not offered — Δ when drawn +6.1 pts; payoff for High Gigs (8+): 53% with a partner (87 games), 100% without (2); partner-aware +5.2 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; cutting one drops Braindance Programs assembly odds by turn 4 96% → 95%; score with the stranding cost +5.5 pts |

Screened (partner-aware):
- -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon
- -1 Gunpoint Diplomacy → +1 Shattered Memories
- -1 Gunpoint Diplomacy → +1 Mantis Blades
- -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting
- -1 Gunpoint Diplomacy → +1 Industrial Assembly

The plain ranking would have screened:
- -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon
- -1 Gunpoint Diplomacy → +1 Mantis Blades
- -1 Gunpoint Diplomacy → +1 Shattered Memories
- -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting
- -1 Gunpoint Diplomacy → +1 Industrial Assembly

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting | 58.0% | 5.4 | [1.2, 9.5] |
| -1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon | 55.4% | 2.7 | [-0.3, 5.7] |
| -1 Gunpoint Diplomacy → +1 Mantis Blades | 54.5% | 1.8 | [-0.7, 4.2] |
| -1 Gunpoint Diplomacy → +1 Shattered Memories | 53.6% | 0.9 | [-0.9, 2.6] |
| -1 Gunpoint Diplomacy → +1 Industrial Assembly | 53.6% | 0.9 | [-2.1, 3.9] |

Confirmation of -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting (fresh paired games; screening +5.4 pts [+1.2, +9.5], 112 games): baseline 49.7% vs swap 54.3%; held-out paired gain +4.6 pts [+2.0, +7.2], 672 games (z 2.36, 3 stages) → **adopted**

Saved data\decks\custom\s3-03-cross-rrr.txt (previous version archived in data/decks/custom/history/).

Packages (built around, start → end): kept High Gigs (8+), Braindance Programs.

Change ledger: appended 560 screening and 672 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 54.3% | -1 Gunpoint Diplomacy → +1 Johnny Silverhand: Never Stop Fighting (held-out +4.6 pts [+2.0, +7.2], 672 games) |