# Match review — validate-chaos (24 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 24/24. Review time 41.5 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium | 1103 | 73% | 0.34 | 18.2 | 11 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 572 | 74% | 0.27 | 17.0 | 1 |
| Losing side | 531 | 71% | 0.42 | 19.6 | 10 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack unit | 31 | 45% | 1.18 | 48.4 | 5 |
| unit | 203 | 59% | 0.61 | 34.5 | 3 |
| gear | 17 | 65% | 0.57 | 23.5 | 0 |
| attack gigs | 259 | 63% | 0.45 | 27.8 | 0 |
| end turn | 54 | 70% | 0.41 | 14.8 | 3 |
| go solo | 14 | 86% | 0.33 | 14.3 | 0 |
| program | 78 | 64% | 0.21 | 10.3 | 0 |
| activate | 77 | 71% | 0.20 | 9.1 | 0 |
| call | 118 | 89% | 0.12 | 5.1 | 0 |
| sell | 252 | 93% | 0.07 | 3.6 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium · attack unit | 31 | 45% | 1.18 | 48.4 | 5 |
| Medium · unit | 203 | 59% | 0.61 | 34.5 | 3 |
| Medium · gear | 17 | 65% | 0.57 | 23.5 | 0 |
| Medium · attack gigs | 259 | 63% | 0.45 | 27.8 | 0 |
| Medium · end turn | 54 | 70% | 0.41 | 14.8 | 3 |
| Medium · program | 78 | 64% | 0.21 | 10.3 | 0 |
| Medium · activate | 77 | 71% | 0.20 | 9.1 | 0 |
| Medium · call | 118 | 89% | 0.12 | 5.1 | 0 |
| Medium · sell | 252 | 93% | 0.07 | 3.6 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 235 | 63% | 0.50 | 29.4 | 2 |
| RRY Smasher Aggro | 189 | 67% | 0.49 | 24.3 | 6 |
| RRB Wakako Midrange | 215 | 75% | 0.43 | 17.2 | 2 |
| RRG Dexter Midrange | 68 | 82% | 0.18 | 10.3 | 0 |
| BBG Cunningham Econ | 203 | 78% | 0.18 | 11.3 | 1 |
| YYB Rogue Gear | 76 | 82% | 0.14 | 7.9 | 0 |
| Rainbow Fixer Stuff | 117 | 78% | 0.13 | 11.1 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 7 | BBG Cunningham Econ (Medium) | end turn | Pass turn | Play Three Mouths, One Desire (2 €$) | 3.00 |
| 9 | BBG Cunningham Econ (Medium) | end turn | Pass turn | Hanako Arasaka: Daughter of the Emperor: Swap a friendly Gig with a rival Gig | 3.00 |
| 7 | RRY Smasher Aggro (Medium) | unit | Play Rockn' Rockerboy (5 €$) | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack unit | Attack with V: Streetkid (8) → Rockn' Rockerboy (8) | Padre: Man of the Cross: Set a player's Gig to the value of another player's Gig | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Play Bonnie and Clyde (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | gear | Play Zetatech Faceplate (2 €$) | Attack with Screw: Lovelorn Fool (7) → Pepe Najarro: Working Doubles (6) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | end turn | Pass turn | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 11 | RRY Smasher Aggro (Medium) | end turn | Pass turn | Attack with V: Streetkid (6) → Valentino Street Racer (3) | 3.00 |
| 12 | GRY Trauma Team (Medium) | end turn | Pass turn | Attack with Johnny Silverhand: Never Stop Fighting (8) → V: Streetkid (6) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | attack unit | Attack with Animals Wrecker (10) → Pepe Najarro: Working Doubles (6) | Sell Bonnie and Clyde | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 8 | GRY Trauma Team (Medium) | program | Play Afterparty at Lizzie's (1 €$) | Pass turn | 3.00 |
| 9 | RRB Wakako Midrange (Medium) | attack gigs | Attack with Meredith Stout: Stone Cold Corpo (5) → Gig area | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |
| 9 | RRB Wakako Midrange (Medium) | unit | Play Yorinobu Arasaka: Steel Dragon (7 €$) | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |

## Validation: planted random moves

| | Moves | Avg Gigs lost | Flagged inaccurate (> noise) | Flagged blunder |
|---|---|---|---|---|
| Random moves (planted) | 192 | 0.47 | 42% | 22% |
| The bot's own moves | 911 | 0.31 | 24% | 17% |

Separation (AUC): a planted random move scores worse than a bot move **64%** of the time (50% = no better than chance).