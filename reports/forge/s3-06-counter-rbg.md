# Forge log — S3-06 Counter (RBG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep Lower, then swap, Spend, then punish; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 41.1%

- **Seat:** in 112 games, this list won 38% on the play and 45% on the draw.
- **Cards most associated with wins:** MaxTac AV (+27 points, drawn in 87 games), Peace Offering (+25 points, drawn in 47 games), Valentino Street Racer (+22 points, drawn in 94 games), Psycho Squad (+20 points, drawn in 85 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** Chrome Reverie (-24 points, drawn in 71 games), We Gotta Live Together (-15 points, drawn in 79 games), Shattered Memories (-11 points, drawn in 75 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Industrial Assembly (sold in 89% of the 66 games it was drawn), Peace Offering (sold in 83% of the 47 games it was drawn), Trust No One (sold in 82% of the 66 games it was drawn), Floor It (sold in 78% of the 60 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Chrome Reverie | -23.7 | -23.3 | yes | offered as a cut — Δ when drawn −23.7 pts; payoff for Low Gigs (min Gig): 31% with a partner (70 games), 100% without (1); partner-aware −24.5 pts; cutting one drops Low Gigs (min Gig) assembly odds by turn 4 70% → 59%; score with the stranding cost −23.3 pts |
| We Gotta Live Together | -14.8 | -13.8 | yes | offered as a cut — Δ when drawn −14.8 pts; piece for Behind on Gigs: — with a partner (0 games), 37% without (79); partner-aware −14.8 pts; cutting one drops Behind on Gigs assembly odds by turn 4 44% → 25%; score with the stranding cost −13.8 pts |
| Shattered Memories | -11.3 | -10.0 | yes | offered as a cut — Δ when drawn −11.3 pts; enabler for Programs as fuel (Blue): 39% with a partner (64 games), 27% without (11); partner-aware −10.0 pts; surplus piece: cutting one moves Programs as fuel (Blue) assembly odds by turn 4 only 59% → 59% |
| Trust No One | -4.1 | -4.4 | no | not offered — Δ when drawn −4.1 pts; both for Low Gigs (min Gig): 38% with a partner (64 games), 100% without (2); partner-aware −5.5 pts; cutting one drops Low Gigs (min Gig) assembly odds by turn 4 70% → 59%; score with the stranding cost −4.4 pts |
| Nocturne OP55 N1 | -3.0 | -1.7 | no | not offered — Δ when drawn −3.0 pts; enabler for Programs as fuel (Blue): 42% with a partner (76 games), 31% without (13); partner-aware −1.7 pts; surplus piece: cutting one moves Programs as fuel (Blue) assembly odds by turn 4 only 59% → 59% |
| Over the Edge | -2.4 | -2.1 | no | not offered — Δ when drawn −2.4 pts; payoff for High Gigs (8+): 40% with a partner (47 games), 41% without (37); partner-aware −2.4 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 28% → 22%; score with the stranding cost −2.1 pts |
| Industrial Assembly | 3.3 | 2.6 | no | not offered — Δ when drawn +3.3 pts; both for High Gigs (8+): 40% with a partner (47 games), 47% without (19); partner-aware +1.9 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 28% → 14%; score with the stranding cost +2.6 pts |
| Floor It | 4.9 | 7.4 | no | not offered — Δ when drawn +4.9 pts; enabler for Programs as fuel (Blue): 47% with a partner (49 games), 27% without (11); partner-aware +7.4 pts; surplus piece: cutting one moves Programs as fuel (Blue) assembly odds by turn 4 only 59% → 59% |

Screened (partner-aware):
- -1 Chrome Reverie → +1 Peace Offering
- -1 We Gotta Live Together → +1 Peace Offering
- -1 Chrome Reverie → +1 Pepe Najarro: Working Doubles
- -1 Shattered Memories → +1 Peace Offering
- -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting

The plain ranking would have screened:
- -1 Chrome Reverie → +1 Peace Offering
- -1 We Gotta Live Together → +1 Peace Offering
- -1 Chrome Reverie → +1 Pepe Najarro: Working Doubles
- -1 Shattered Memories → +1 Peace Offering
- -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting | 50.9% | 9.8 | [2.4, 17.3] |
| -1 Chrome Reverie → +1 Pepe Najarro: Working Doubles | 49.1% | 8.0 | [1.9, 14.2] |
| -1 We Gotta Live Together → +1 Peace Offering | 43.8% | 2.7 | [-0.3, 5.7] |
| -1 Shattered Memories → +1 Peace Offering | 43.8% | 2.7 | [-0.3, 5.7] |
| -1 Chrome Reverie → +1 Peace Offering | 40.2% | -0.9 | [-2.6, 0.9] |

Confirmation of -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting (fresh paired games; screening +9.8 pts [+2.4, +17.3], 112 games): baseline 38.5% vs swap 41.6%; held-out paired gain +3.1 pts [+1.1, +5.2], 896 games (z 2.01, 4 stages) → **adopted**

Saved data\decks\custom\s3-06-counter-rbg.txt (previous version archived in data/decks/custom/history/).

Packages (built around, start → end): kept Lower, then swap, Spend, then punish.

Change ledger: appended 560 screening and 896 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 41.6% | -1 Chrome Reverie → +1 Johnny Silverhand: Never Stop Fighting (held-out +3.1 pts [+1.1, +5.2], 896 games) |