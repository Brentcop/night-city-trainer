# Forge log — S3-08 Explorer (RRB)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep High Gigs (8+), Ahead on Street Cred; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 52.7%

- **Seat:** in 112 games, this list won 66% on the play and 39% on the draw.
- **Cards most associated with wins:** Yorinobu Arasaka: Steel Dragon (+25 points, drawn in 71 games), Animals Wrecker (+21 points, drawn in 78 games), Unlikely Bond (+18 points, drawn in 77 games), Gunpoint Diplomacy (+14 points, drawn in 59 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** Royce: Don't Call Me Simon (-24 points, drawn in 64 games), Shattered Memories (-16 points, drawn in 67 games), Arasaka Emergency Radioport (-16 points, drawn in 40 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Satori: Sword of Saburo (sold in 100% of the 48 games it was drawn), Arasaka Emergency Radioport (sold in 100% of the 40 games it was drawn), Nocturne OP55 N1 (sold in 95% of the 62 games it was drawn), Over the Edge (sold in 94% of the 66 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Royce: Don't Call Me Simon | -24.5 | -23.9 | yes | offered as a cut — Δ when drawn −24.5 pts; payoff for Ahead on Street Cred: 42% with a partner (64 games), never drawn without one; partner-aware −24.5 pts; cutting one drops Ahead on Street Cred assembly odds by turn 4 70% → 59%; score with the stranding cost −23.9 pts |
| Shattered Memories | -16.0 | -16.0 | yes | offered as a cut — Δ when drawn −16.0 pts |
| Arasaka Emergency Radioport | -15.8 | -15.8 | yes | offered as a cut — Δ when drawn −15.8 pts |
| 6th Street Recruits | -13.6 | -13.1 | no | not offered — Δ when drawn −13.6 pts; enabler for High Gigs (8+): 50% with a partner (84 games), 0% without (1); partner-aware −13.1 pts; surplus piece: cutting one moves High Gigs (8+) assembly odds by turn 4 only 92% → 92% |
| Carnage at the Colosseum | -5.0 | -4.8 | no | not offered — Δ when drawn −5.0 pts; payoff for High Gigs (8+): 51% with a partner (80 games), never drawn without one; partner-aware −5.0 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; score with the stranding cost −4.8 pts |
| Kerry Eurodyne: The Last Rockerboy | -2.1 | -2.0 | no | not offered — Δ when drawn −2.1 pts; payoff for High Gigs (8+): 51% with a partner (39 games), never drawn without one; partner-aware −2.1 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; score with the stranding cost −2.0 pts |
| Over the Edge | 0.9 | 1.0 | no | not offered — Δ when drawn +0.9 pts; payoff for High Gigs (8+): 53% with a partner (66 games), never drawn without one; partner-aware +0.9 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 92% → 89%; score with the stranding cost +1.0 pts |

Screened (partner-aware):
- -1 Royce: Don't Call Me Simon → +1 Unlikely Bond
- -1 Royce: Don't Call Me Simon → +1 Gunpoint Diplomacy
- -1 Shattered Memories → +1 Unlikely Bond
- -1 Arasaka Emergency Radioport → +1 Unlikely Bond
- -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting

The plain ranking would have screened:
- -1 Royce: Don't Call Me Simon → +1 Unlikely Bond
- -1 Royce: Don't Call Me Simon → +1 Gunpoint Diplomacy
- -1 Shattered Memories → +1 Unlikely Bond
- -1 Arasaka Emergency Radioport → +1 Unlikely Bond
- -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting | 58.0% | 5.4 | [-0.7, 11.4] |
| -1 Royce: Don't Call Me Simon → +1 Unlikely Bond | 54.5% | 1.8 | [-1.7, 5.3] |
| -1 Royce: Don't Call Me Simon → +1 Gunpoint Diplomacy | 53.6% | 0.9 | [-2.1, 3.9] |
| -1 Arasaka Emergency Radioport → +1 Unlikely Bond | 51.8% | -0.9 | [-2.6, 0.9] |
| -1 Shattered Memories → +1 Unlikely Bond | 50.9% | -1.8 | [-4.2, 0.7] |

Confirmation of -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting (fresh paired games; screening +5.4 pts [−0.7, +11.4], 112 games): baseline 49.2% vs swap 51.1%; held-out paired gain +1.9 pts [+0.0, +3.8], 896 games (z 2.01, 4 stages) → **could not tell**


Packages (built around, start → end): kept High Gigs (8+), Ahead on Street Cred.

Change ledger: appended 560 screening and 896 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 49.2% | kept (could not tell: -1 Royce: Don't Call Me Simon → +1 Johnny Silverhand: Never Stop Fighting, +1.9 pts [+0.0, +3.8], 896 games) |