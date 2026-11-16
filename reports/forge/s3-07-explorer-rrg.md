# Forge log — S3-07 Explorer (RRG)

Field: BBG Cunningham Econ, GRY Trauma Team, Rainbow Fixer Stuff, RRB Wakako Midrange, RRG Dexter Midrange, RRY Smasher Aggro, YYB Rogue Gear · bot lookahead · 112 games per test

Adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot.
A first confirmation with the Hard bot here adopts a real gain of +4.2 points 8 times in 10 (+6.7 for a package move). It assumes a per-game spread of 0.34 for a one-card swap and 0.60 for a package move (measured with the Hard bot on 2026-11-15: 11 one-card swaps, 2 package swaps). A gain measured with Medium showed at about 0.75 of its size with Hard (± 0.19, 13 changes).

Change ledger: data/ledger (bot medium, held-out games under bot hard, simulator version 9, field 1fde7831c1fc4e59).

Packages: keep High Gigs (8+), Behind on Gigs, Braindance Programs; package moves off.

Cut ranking: partner-aware (a package card is judged by its games with a partner piece; a cut that lowers a package’s assembly odds costs in proportion; an add that completes or deepens one earns the odds it adds).

## Generation 1 — baseline 55.4%

- **Seat:** in 112 games, this list won 61% on the play and 50% on the draw.
- **Cards most associated with wins:** Animals Wrecker (+43 points, drawn in 80 games), Yorinobu Arasaka: Steel Dragon (+22 points, drawn in 65 games), Swordwise Huscle (+20 points, drawn in 48 games), Pepe Najarro: Working Doubles (+15 points, drawn in 87 games). Games where each was drawn were won that many points more often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Cards most associated with losses:** Nadia: Fighting Through Grief (-26 points, drawn in 39 games), Carnage at the Colosseum (-13 points, drawn in 94 games), Valentino Street Racer (-7 points, drawn in 89 games). Games where each was drawn were won that many points less often than games where it was not, over 112 games. This is an association, not proof of value: cards are drawn more in long games, and the bot sells what looks weak.
- **Usual Eddie fodder:** Deadman Transmitter (sold in 100% of the 40 games it was drawn), We Gotta Live Together (sold in 98% of the 61 games it was drawn), Arasaka Emergency Radioport (sold in 97% of the 64 games it was drawn), Industrial Assembly (sold in 91% of the 68 games it was drawn). These are the cards the bot sold most often.

Cut ranking (partner-aware; plain = "Δ when drawn", lower is cut first):

| Card | Plain | Partner-aware score | Offered | Why |
|---|---|---|---|---|
| Nadia: Fighting Through Grief | -25.9 | -25.3 | yes | offered as a cut — Δ when drawn −25.9 pts; piece for Behind on Gigs: 39% with a partner (36 games), 33% without (3); partner-aware −25.6 pts; cutting one drops Behind on Gigs assembly odds by turn 4 85% → 78%; score with the stranding cost −25.3 pts |
| Carnage at the Colosseum | -13.5 | -12.9 | yes | offered as a cut — Δ when drawn −13.5 pts; enabler for Braindance Programs: 54% with a partner (91 games), 33% without (3); partner-aware −12.9 pts; surplus piece: cutting one moves High Gigs (8+) assembly odds by turn 4 only 78% → 78% |
| Valentino Street Racer | -6.9 | -6.9 | yes | offered as a cut — Δ when drawn −6.9 pts |
| Shattered Memories | -4.5 | -3.8 | no | not offered — Δ when drawn −4.5 pts; enabler for Braindance Programs: 55% with a partner (66 games), 33% without (3); partner-aware −3.8 pts; surplus piece: cutting one moves Braindance Programs assembly odds by turn 4 only 98% → 98% |
| Bonnie and Clyde | -3.8 | -6.9 | no | not offered — Δ when drawn −3.8 pts; piece for Behind on Gigs: 50% with a partner (62 games), 65% without (26); partner-aware −7.2 pts; cutting one drops Behind on Gigs assembly odds by turn 4 85% → 78%; score with the stranding cost −6.9 pts |
| 6th Street Recruits | -2.2 | -1.8 | no | not offered — Δ when drawn −2.2 pts; enabler for High Gigs (8+): 55% with a partner (91 games), never drawn without one; partner-aware −2.2 pts; cutting one drops High Gigs (8+) assembly odds by turn 4 78% → 70%; score with the stranding cost −1.8 pts |

Screened (partner-aware):
- -1 Nadia: Fighting Through Grief → +1 Yorinobu Arasaka: Steel Dragon
- -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle
- -1 Nadia: Fighting Through Grief → +1 Johnny Silverhand: Never Stop Fighting
- -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon
- -1 Carnage at the Colosseum → +1 Swordwise Huscle

The plain ranking would have screened:
- -1 Nadia: Fighting Through Grief → +1 Yorinobu Arasaka: Steel Dragon
- -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle
- -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon
- -1 Nadia: Fighting Through Grief → +1 Johnny Silverhand: Never Stop Fighting
- -1 Carnage at the Colosseum → +1 Swordwise Huscle

| Swap | Win % | Δ vs baseline | Paired 95% (screening) |
|---|---|---|---|
| -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle | 58.0% | 2.7 | [-2.6, 7.9] |
| -1 Nadia: Fighting Through Grief → +1 Johnny Silverhand: Never Stop Fighting | 57.1% | 1.8 | [-0.7, 4.2] |
| -1 Carnage at the Colosseum → +1 Yorinobu Arasaka: Steel Dragon | 57.1% | 1.8 | [-3.8, 7.3] |
| -1 Nadia: Fighting Through Grief → +1 Yorinobu Arasaka: Steel Dragon | 56.3% | 0.9 | [-3.0, 4.8] |
| -1 Carnage at the Colosseum → +1 Swordwise Huscle | 54.5% | -0.9 | [-4.8, 3.0] |

Confirmation of -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle (fresh paired games; screening +2.7 pts [−2.6, +7.9], 112 games): baseline 47.3% vs swap 46.2%; held-out paired gain −1.1 pts [−5.2, +3.0], 448 games (z 2.96, 2 stages) → **could not tell (stopped early: no gain after 448 games)**


Packages (built around, start → end): kept High Gigs (8+), Behind on Gigs, Braindance Programs.

Change ledger: appended 560 screening and 448 held-out games to data/ledger (0 already on record).

## Summary

Win % is the held-out win rate of the list after the generation (the baseline when nothing was adopted); gains are paired, on fresh games.

| Gen | Win % | Change |
|---|---|---|
| 1 | 47.3% | kept (could not tell: -1 Nadia: Fighting Through Grief → +1 Swordwise Huscle, −1.1 pts [−5.2, +3.0], 448 games; stopped early: no gain after 448 games) |