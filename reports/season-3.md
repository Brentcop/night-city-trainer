# Season 3

8 bred, 6 entered. 21 decks (7 meta, 8 incumbents, 6 new) × 24 games per pairing, hard bot, with telemetry. The new decks were forged (1 gen) before the round robin, so the round robin, the finals vs the meta (60 games per opponent) and the leaderboard all measure the forged lists.

Forge adoption rule: evidence: stages of 224 fresh paired games up to 896; adopt when the lower bound of the paired gain is above 1 point with at least 200 games, reject when the upper bound is below it, otherwise could not tell; a nominee with no gain after 2 stages (448 games) stops early as could not tell; α = 0.05 spent over 4 looks (O'Brien–Fleming-type, z = 4.33 / 2.96 / 2.36 / 2.01); change ledger on: a nominee with held-out games from earlier runs (same simulator version, bot and field) is judged on those games first, then on them and each new stage pooled, by an always-valid boundary (normal mixture, Howard et al. 2021, ρ = 250 games, one-sided 0.025 each: z = 3.32 at 448 games, 3.11 at 896, 3.04 at 1,792, 3.06 at 3,584); screened with the Medium bot, confirmed with the Hard bot. Each change it adopted, with its held-out paired gain, is in reports/forge/ and on the deck file's "// Forged" line; "could not tell" changes were not adopted.

## Gate: 8 bred, 6 entered

Gate rule: each bred deck plays the middle meta deck by strength, the same fixed bar for every bred deck, on the same games against the other meta decks, in stages of 20 double rounds (280 games with 7 opponents, 240 with 6), up to 5 stages with the Medium bot (z 4.88, 3.36, 2.68, 2.29, 2.03); a deck the Medium bot did not show worse then plays up to 2 stages with the Hard bot on its own seeds (z 2.96, 1.97). After each stage the paired difference is judged with α 0.05 spent over the looks by an O'Brien–Fleming-type boundary: shown worse when its upper bound is below 0, shown better when its lower bound is above 0, could not tell at the cap. A deck enters unless a bot shows it worse; could not tell enters.
A bred deck that is truly no worse than its reference is kept out about 2.5% of the time or less by each bot.
What it can detect: with 6 opponents (stages of 240 games) the Medium bot shows a deck worse 8 times in 10 when it is really 4.8 points worse, the Hard bot with its 2 stages when it is 7.7 points worse. It assumes a per-game spread of 0.59 with the Medium bot and 0.60 with the Hard bot for two different decks, measured on the recorded bred decks.
Cost: at most 2,400 Medium games and 960 Hard games a deck (deck and reference, 6 opponents), fewer when a deck is decided early or shares its reference.
Gate games are a selection step: they count for no rating, leaderboard, change ledger or evidence file.

- **S3-01 Mutant (RBG)**: kept out: shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) with the Hard bot (Medium: could not tell, −1.7 points [−5.3, +2.0] over 1,200 paired games (look 5 of 5); Hard: shown worse, −8.5 points [−14.1, −3.0] over 480 paired games (look 2 of 2))
- **S3-02 Mutant (RGY)**: entered: not shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) (Medium: shown better, +11.3 points [+1.8, +20.7] over 480 paired games (look 2 of 5); Hard: could not tell, +5.0 points [−0.6, +10.6] over 480 paired games (look 2 of 2))
- **S3-03 Cross (RRR)**: entered: not shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) (Medium: could not tell, +3.4 points [−0.3, +7.1] over 1,200 paired games (look 5 of 5); Hard: could not tell, +3.8 points [−1.8, +9.3] over 480 paired games (look 2 of 2))
- **S3-04 Cross (RBB)**: kept out: shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) with the Medium bot (Medium: shown worse, −6.6 points [−11.2, −1.9] over 960 paired games (look 4 of 5))
- **S3-05 Counter (RRG)**: entered: not shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) (Medium: shown better, +4.3 points [+0.6, +8.0] over 1,200 paired games (look 5 of 5); Hard: could not tell, +3.5 points [−2.0, +9.1] over 480 paired games (look 2 of 2))
- **S3-06 Counter (RBG)**: entered: not shown worse than YYB Rogue Gear (the middle meta deck, this run’s fixed bar for every bred deck) (Medium: could not tell, −2.8 points [−6.4, +0.7] over 1,200 paired games (look 5 of 5); Hard: could not tell, −2.5 points [−7.8, +2.8] over 480 paired games (look 2 of 2))
- **S3-07 Explorer (RRG)**: entered: not shown worse than YYB Rogue Gear (explorer: the middle meta deck) (Medium: shown better, +5.8 points [+1.3, +10.4] over 960 paired games (look 4 of 5); Hard: could not tell, +1.0 points [−4.6, +6.7] over 480 paired games (look 2 of 2))
- **S3-08 Explorer (RRB)**: entered: not shown worse than YYB Rogue Gear (explorer: the middle meta deck) (Medium: shown better, +6.7 points [+0.5, +12.8] over 720 paired games (look 3 of 5); Hard: could not tell, +2.1 points [−3.6, +7.8] over 480 paired games (look 2 of 2))

Spread seen: 0.62 per game with the Medium bot (median of 8 decks), 0.62 with the Hard bot (median of 7 decks).

## New decks
Package plan: no package plan; the forge kept each new deck's built-around packages.

- **S3-02 Mutant (RGY)** (mutant) — Mutant of S1-01 Mutant (RRY): Adam Smasher: Ender of Legends → Jackie Welles: Mama's Favorite; cards re-fitted to the new RAM limits, keeping the parent's best performers.
- **S3-03 Cross (RRR)** (crossover) — Crossover of Ladder: V / Smasher / Padre (RRG) × NC-07 Braindance Burn (RRB) (midrange): strongest Legends of both, cards ranked by format-wide impact.
- **S3-05 Counter (RRG)** (counter) — Counter to the top decks (RRG Dexter Midrange, Ladder: V / Smasher / Saburo (RRG), Smash the Curve): merges Ladder: V / Smasher / Saburo (RRG) (49% vs them) and Ladder: Jackie / Alt / Hanako (BBG) (41%), keeping the cards that win games for each. Topped up from 12 to 13 Units: -1 Detonate → +1 Saul Bright: Stormrider.
- **S3-06 Counter (RBG)** (counter) — Counter to the top decks (RRG Dexter Midrange, Ladder: V / Smasher / Saburo (RRG), Smash the Curve): merges Ladder: V / Smasher / Saburo (RRG) (49% vs them) and BBG Cunningham Econ (42%), keeping the cards that win games for each. Topped up from 12 to 13 Units: -1 Peace Offering → +1 Placide: Voodoo Sentinel.
- **S3-07 Explorer (RRG)** (explorer) — Explorer (midrange): untested Legends Hanako Arasaka / Johnny Silverhand / V, filled by role and curve templates from format-wide card impact.
- **S3-08 Explorer (RRB)** (explorer) — Explorer (aggro): untested Legends Adam Smasher / Sasha Yakovleva / Dexter DeShawn, filled by role and curve templates from format-wide card impact.

## Season standings (round robin)
| # | Deck | Win % | |
|---|---|---|---|
| 1 | RRG Dexter Midrange | 65.8% | meta |
| 2 | Ladder: V / Smasher / Saburo (RRG) | 61.9% | ladder |
| 3 | S1-01 Mutant (RRY) | 61.3% | original |
| 4 | Ladder: V / Smasher / Padre (RRG) | 58.3% | ladder |
| 5 | Smash the Curve | 58.1% | guide |
| 6 | BBG Cunningham Econ | 55.8% | meta |
| 7 | NC-07 Braindance Burn (RRB) | 55.2% | original |
| 8 | NC-08 Merc Contract (RRG) | 55.0% | original |
| 9 | Ladder: Jackie / Alt / Hanako (BBG) | 54.4% | ladder |
| 10 | RRY Smasher Aggro | 52.7% | meta |
| 11 | S2-02 Mutant (RGG) | 51.7% | original |
| 12 | S3-05 Counter (RRG) | 48.3% | NEW |
| 13 | S3-08 Explorer (RRB) | 45.2% | NEW |
| 14 | S3-03 Cross (RRR) | 45.0% | NEW |
| 15 | S3-02 Mutant (RGY) | 44.6% | NEW |
| 16 | YYB Rogue Gear | 43.8% | meta |
| 17 | S3-06 Counter (RBG) | 42.9% | NEW |
| 18 | S3-07 Explorer (RRG) | 41.3% | NEW |
| 19 | Rainbow Fixer Stuff | 38.3% | meta |
| 20 | GRY Trauma Team | 36.3% | meta |
| 21 | RRB Wakako Midrange | 34.2% | meta |

## All-time leaderboard (pooled win % vs the meta archetypes)
| # | Deck | Origin | vs meta (raw) | Rating | Games | Percentile |
|---|---|---|---|---|---|---|
| 1 | S2-07 Explorer (RRB) | S2 explorer | 74.7% | 72.4% | 588 | 100 |
| 2 | S2-03 Cross (RGY) | S2 crossover | 73.0% | 70.8% | 588 | 97 |
| 3 | S1-01 Mutant (RRY) | S1 mutant | 71.4% | 70.1% | 924 | 94 |
| 4 | RRG Dexter Midrange | meta | 70.6% | 69.9% | 1632 | 91 |
| 5 | S2-05 Counter (RRG) | S2 counter | 71.8% | 69.8% | 588 | 89 |
| 6 | S2-02 Mutant (RGG) | S2 mutant | 70.9% | 69.4% | 756 | 86 |
| 7 | S1-03 Mutant (RBG) | S1 mutant | 70.0% | 68.5% | 756 | 83 |
| 8 | Ladder: V / Smasher / Saburo (RRG) | ladder | 69.0% | 67.6% | 756 | 80 |
| 9 | S2-06 Counter (RGG) | S2 counter | 68.0% | 66.4% | 588 | 77 |
| 10 | Ladder: Jackie / Alt / Hanako (BBG) | ladder | 63.6% | 62.6% | 756 | 74 |
| 11 | NC-08 Merc Contract (RRG) | NC original | 62.7% | 61.8% | 756 | 71 |
| 12 | Ladder: V / Smasher / Padre (RRG) | ladder | 62.2% | 61.1% | 588 | 69 |
| 13 | Smash the Curve | guide | 59.8% | 59.1% | 756 | 66 |
| 14 | S1-04 Cross (RBG) | S1 crossover | 58.7% | 57.9% | 588 | 63 |
| 15 | YYB Rogue Gear | meta | 57.2% | 56.9% | 1632 | 60 |

Rating = win rate vs the meta archetypes, shrunk toward 50% by a 60-game prior, so decks need volume to rank high. Percentile is the rank among all measured decks.