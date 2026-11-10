# Match review — validate-chaos (24 games, 4 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 24/24. Review time 25.2 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium | 1103 | 57% | 0.43 | 25.7 | 12 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 572 | 56% | 0.38 | 26.4 | 2 |
| Losing side | 531 | 58% | 0.48 | 24.9 | 10 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack unit | 31 | 42% | 1.23 | 48.4 | 5 |
| unit | 203 | 44% | 0.72 | 41.9 | 3 |
| gear | 17 | 59% | 0.61 | 23.5 | 0 |
| attack gigs | 259 | 50% | 0.55 | 37.8 | 1 |
| end turn | 54 | 63% | 0.45 | 16.7 | 3 |
| activate | 77 | 52% | 0.37 | 24.7 | 0 |
| go solo | 14 | 71% | 0.36 | 14.3 | 0 |
| program | 78 | 49% | 0.29 | 16.7 | 0 |
| call | 118 | 69% | 0.21 | 13.6 | 0 |
| sell | 252 | 73% | 0.13 | 8.7 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium · attack unit | 31 | 42% | 1.23 | 48.4 | 5 |
| Medium · unit | 203 | 44% | 0.72 | 41.9 | 3 |
| Medium · gear | 17 | 59% | 0.61 | 23.5 | 0 |
| Medium · attack gigs | 259 | 50% | 0.55 | 37.8 | 1 |
| Medium · end turn | 54 | 63% | 0.45 | 16.7 | 3 |
| Medium · activate | 77 | 52% | 0.37 | 24.7 | 0 |
| Medium · program | 78 | 49% | 0.29 | 16.7 | 0 |
| Medium · call | 118 | 69% | 0.21 | 13.6 | 0 |
| Medium · sell | 252 | 73% | 0.13 | 8.7 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 235 | 49% | 0.57 | 34.5 | 2 |
| RRY Smasher Aggro | 189 | 55% | 0.57 | 30.7 | 6 |
| RRB Wakako Midrange | 215 | 57% | 0.52 | 26.5 | 3 |
| RRG Dexter Midrange | 68 | 56% | 0.37 | 27.9 | 0 |
| Rainbow Fixer Stuff | 117 | 59% | 0.26 | 20.5 | 0 |
| BBG Cunningham Econ | 203 | 66% | 0.26 | 17.2 | 1 |
| YYB Rogue Gear | 76 | 61% | 0.20 | 11.8 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 7 | BBG Cunningham Econ (Medium) | end turn | Pass turn | Attack with Maman Brigitte: Spirit of Death (3) → Gig area | 3.00 |
| 9 | BBG Cunningham Econ (Medium) | end turn | Pass turn | Play Jacked-In Voodoo Boy (2 €$) | 3.00 |
| 7 | RRG Dexter Midrange (Medium) | unit | Play Pepe Najarro: Working Doubles (4 €$) | Call a Legend (face-down slot 3) | 3.00 |
| 10 | BBG Cunningham Econ (Medium) | attack unit | Attack with Maman Brigitte: Spirit of Death (3) → Animals Wrecker (10) | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |
| 9 | RRY Smasher Aggro (Medium) | unit | Play Rockn' Rockerboy (5 €$) | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 6 | GRY Trauma Team (Medium) | unit | Play Trauma Team Operatives (3 €$) | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack unit | Attack with V: Streetkid (8) → Rockn' Rockerboy (8) | Padre: Man of the Cross: Set a player's Gig to the value of another player's Gig | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Play Bonnie and Clyde (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | end turn | Pass turn | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 11 | RRY Smasher Aggro (Medium) | end turn | Pass turn | Attack with V: Streetkid (6) → Valentino Street Racer (3) | 3.00 |
| 7 | GRY Trauma Team (Medium) | attack gigs | Attack with Meredith Stout: Stone Cold Corpo (5) → Gig area | Attack with Johnny Silverhand: Never Stop Fighting (8) → 6th Street Recruits (6) | 3.00 |
| 11 | GRY Trauma Team (Medium) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Attack with Johnny Silverhand: Never Stop Fighting (8) → 6th Street Recruits (6) | 3.00 |
| 12 | GRY Trauma Team (Medium) | end turn | Pass turn | Attack with Johnny Silverhand: Never Stop Fighting (8) → V: Streetkid (6) | 3.00 |
| 8 | RRB Wakako Midrange (Medium) | activate | Wakako Okada: Peace and Harmony: Decrease a Gig by up to 2 | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |

## Validation: planted random moves

| | Moves | Avg Gigs lost | Flagged inaccurate (> noise) | Flagged blunder |
|---|---|---|---|---|
| Random moves (planted) | 192 | 0.57 | 54% | 30% |
| The bot's own moves | 911 | 0.40 | 41% | 25% |

Separation (AUC): a planted random move scores worse than a bot move **59%** of the time (50% = no better than chance).