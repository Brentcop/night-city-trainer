# Match review — validate-chaos (24 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 24/24. Review time 26.6 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium | 1103 | 71% | 0.37 | 19.5 | 5 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 572 | 72% | 0.32 | 18.9 | 1 |
| Losing side | 531 | 70% | 0.43 | 20.2 | 4 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack unit | 31 | 52% | 1.00 | 41.9 | 2 |
| unit | 203 | 60% | 0.58 | 33.5 | 1 |
| gear | 17 | 65% | 0.57 | 23.5 | 0 |
| attack gigs | 259 | 58% | 0.56 | 32.0 | 0 |
| go solo | 14 | 79% | 0.55 | 21.4 | 0 |
| end turn | 54 | 72% | 0.35 | 13.0 | 2 |
| program | 78 | 63% | 0.22 | 11.5 | 0 |
| activate | 77 | 70% | 0.20 | 9.1 | 0 |
| sell | 252 | 90% | 0.13 | 6.0 | 0 |
| call | 118 | 89% | 0.12 | 5.1 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium · attack unit | 31 | 52% | 1.00 | 41.9 | 2 |
| Medium · unit | 203 | 60% | 0.58 | 33.5 | 1 |
| Medium · gear | 17 | 65% | 0.57 | 23.5 | 0 |
| Medium · attack gigs | 259 | 58% | 0.56 | 32.0 | 0 |
| Medium · end turn | 54 | 72% | 0.35 | 13.0 | 2 |
| Medium · program | 78 | 63% | 0.22 | 11.5 | 0 |
| Medium · activate | 77 | 70% | 0.20 | 9.1 | 0 |
| Medium · sell | 252 | 90% | 0.13 | 6.0 | 0 |
| Medium · call | 118 | 89% | 0.12 | 5.1 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 235 | 61% | 0.54 | 30.6 | 1 |
| RRB Wakako Midrange | 215 | 73% | 0.46 | 18.6 | 1 |
| RRY Smasher Aggro | 189 | 68% | 0.44 | 22.8 | 2 |
| RRG Dexter Midrange | 68 | 75% | 0.40 | 17.6 | 0 |
| Rainbow Fixer Stuff | 117 | 70% | 0.24 | 16.2 | 0 |
| BBG Cunningham Econ | 203 | 78% | 0.18 | 11.3 | 1 |
| YYB Rogue Gear | 76 | 82% | 0.14 | 7.9 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 7 | BBG Cunningham Econ (Medium) | end turn | Pass turn | Play Three Mouths, One Desire (2 €$) | 3.00 |
| 7 | RRY Smasher Aggro (Medium) | unit | Play Rockn' Rockerboy (5 €$) | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 10 | GRY Trauma Team (Medium) | sell | Sell Afterparty at Lizzie's | Pass turn | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack unit | Attack with Trauma Team Operatives (9) → Rockn' Rockerboy (8) | Pass turn | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Attack with 6th Street Recruits (6) → Royce: Don't Call Me Simon (4) | 3.00 |
| 10 | GRY Trauma Team (Medium) | go solo | Go Solo: V: Streetkid (5 €$) | Pass turn | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Animals Wrecker (6 €$) | Play Bonnie and Clyde (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | gear | Play Zetatech Faceplate (2 €$) | Attack with Screw: Lovelorn Fool (7) → Pepe Najarro: Working Doubles (6) | 3.00 |
| 11 | RRY Smasher Aggro (Medium) | end turn | Pass turn | Attack with V: Streetkid (6) → Valentino Street Racer (3) | 3.00 |
| 10 | Rainbow Fixer Stuff (Medium) | sell | Sell Memory Relapse | Pass turn | 3.00 |
| 10 | Rainbow Fixer Stuff (Medium) | attack gigs | Attack with Psycho Squad (6) → Gig area | Attack with 6th Street Recruits (6) → Royce: Don't Call Me Simon (4) | 3.00 |
| 10 | Rainbow Fixer Stuff (Medium) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Attack with 6th Street Recruits (6) → Royce: Don't Call Me Simon (4) | 3.00 |
| 10 | Rainbow Fixer Stuff (Medium) | attack gigs | Attack with Valentino Street Racer (3) → Gig area | Pass turn | 3.00 |
| 12 | GRY Trauma Team (Medium) | end turn | Pass turn | Attack with Johnny Silverhand: Never Stop Fighting (8) → V: Streetkid (6) | 3.00 |
| 10 | RRB Wakako Midrange (Medium) | sell | Sell Satori: Sword of Saburo | Pass turn | 3.00 |

## Validation: planted random moves

| | Moves | Avg Gigs lost | Flagged inaccurate (> noise) | Flagged blunder |
|---|---|---|---|---|
| Random moves (planted) | 192 | 0.42 | 41% | 21% |
| The bot's own moves | 911 | 0.36 | 26% | 19% |

Separation (AUC): a planted random move scores worse than a bot move **61%** of the time (50% = no better than chance).