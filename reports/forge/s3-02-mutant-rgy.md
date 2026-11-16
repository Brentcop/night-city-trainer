# Forge log — S3-02 Mutant (RGY)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep High Gigs (8+), Value-pairs, Even Street Cred; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 57.1%

- **Seat:** in 112 games, this list won 64% on the play and 50% on the draw.
- **Cards most associated with wins:** Corporate Surveillance (+22 points, drawn in 94 games), Pepe Najarro: Working Doubles (+17 points, drawn in 89 games), Memory Relapse (+12 points, drawn in 83 games), Shattered Memories (+11 points, drawn in 56 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** MaxTac Suppression Team (-18 points, drawn in 91 games), Mantis Blades (-15 points, drawn in 60 games), We Gotta Live Together (-14 points, drawn in 68 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Corporate Surveillance (sold in 99% of the 94 games it was drawn), Detonate (sold in 96% of the 70 games it was drawn), Mantis Blades (sold in 93% of the 60 games it was drawn), All is Lost (sold in 86% of the 76 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| MaxTac Suppression Team | -17.6 | -17.6 | yes | offered as a cut — Δ when drawn −17.6 pts |
| Mantis Blades | -15.4 | -13.2 | yes | offered as a cut — Δ when drawn −15.4 pts; enabler for Gear on Units: 50% with a partner (54 games), 50% without (6); partner-aware −15.4 pts; cutting one drops Gear on Units assembly odds by turn 4 70% → 59%; cutting one drops Gear as fuel assembly odds by turn 4 70% → 59%; score with the stranding cost −13.2 pts |
| We Gotta Live Together | -14.4 | -13.1 | yes | offered as a cut — Δ when drawn −14.4 pts; piece for Behind on Gigs: — with a partner (0 games), 51% without (68); partner-aware −14.4 pts; cutting one drops Behind on Gigs assembly odds by turn 4 44% → 25%; cutting one drops Units in the trash assembly odds by turn 4 18% → 10%; score with the stranding cost −13.1 pts |
| 6th Street Recruits | -10.2 | -9.7 | no | not offered — Δ when drawn −10.2 pts; enabler for High Gigs (8+): 56% with a partner (79 games), 50% without (10); partner-aware −9.7 pts; surplus piece: cutting one moves High Gigs (8+) assembly odds by turn 4 only 70% → 70% |
| Satori: Sword of Saburo | -7.3 | -5.4 | no | not offered — Δ when drawn −7.3 pts; enabler for Gear on Units: 53% with a partner (58 games), 60% without (5); partner-aware −7.6 pts; cutting one drops Gear on Units assembly odds by turn 4 70% → 59%; cutting one drops Gear as fuel assembly odds by turn 4 70% → 59%; score with the stranding cost −5.4 pts |
| Over the Edge | -1.5 | -1.0 | no | not offered — Δ when drawn −1.5 pts; payoff for High Gigs (8+): 57% with a partner (88 games), never drawn without one; partner-aware −1.5 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 70% → 59%; score with the stranding cost −1.0 pts |

Screened (partner-aware):
- -1 MaxTac Suppression Team → +1 Shattered Memories
- -1 MaxTac Suppression Team → +1 Industrial Assembly
- -1 MaxTac Suppression Team → +1 Johnny Silverhand: Never Stop Fighting
- -1 MaxTac Suppression Team → +1 Rockn' Rockerboy
- -1 MaxTac Suppression Team → +1 Valentino Street Racer

The plain ranking would have screened:
- -1 MaxTac Suppression Team → +1 Shattered Memories
- -1 MaxTac Suppression Team → +1 All is Lost
- -1 MaxTac Suppression Team → +1 Johnny Silverhand: Never Stop Fighting
- -1 Mantis Blades → +1 Shattered Memories
- -1 Mantis Blades → +1 All is Lost

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 MaxTac Suppression Team → +1 Rockn' Rockerboy | 58.9% | 1.8 | [-0.7, 4.2] |
| -1 MaxTac Suppression Team → +1 Valentino Street Racer | 58.9% | 1.8 | [-1.7, 5.3] |
| -1 MaxTac Suppression Team → +1 Johnny Silverhand: Never Stop Fighting | 57.1% | 0.0 | [-5.0, 5.0] |
| -1 MaxTac Suppression Team → +1 Shattered Memories | 56.3% | -0.9 | [-4.8, 3.0] |
| -1 MaxTac Suppression Team → +1 Industrial Assembly | 56.3% | -0.9 | [-5.5, 3.8] |

No swap beat the baseline by 2+ points — **list kept**.


Packages (built around, start → end): kept High Gigs (8+), Value-pairs, Even Street Cred.

Change ledger: appended 560 screening and 0 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 57.1% | kept |