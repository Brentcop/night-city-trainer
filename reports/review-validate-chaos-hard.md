# Match review — validate-chaos-hard (24 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 24/24. Review time 26.5 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Hard | 1035 | 84% | 0.15 | 8.3 | 5 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 526 | 85% | 0.15 | 8.0 | 2 |
| Losing side | 509 | 84% | 0.15 | 8.6 | 3 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack unit | 28 | 75% | 0.37 | 17.9 | 1 |
| go solo | 19 | 74% | 0.27 | 15.8 | 0 |
| end turn | 80 | 78% | 0.23 | 12.5 | 1 |
| attack gigs | 177 | 82% | 0.23 | 11.9 | 1 |
| activate | 74 | 77% | 0.17 | 10.8 | 0 |
| unit | 192 | 83% | 0.17 | 10.9 | 2 |
| program | 81 | 77% | 0.13 | 3.7 | 0 |
| sell | 254 | 92% | 0.08 | 4.3 | 0 |
| gear | 17 | 82% | 0.07 | 5.9 | 0 |
| call | 113 | 94% | 0.03 | 2.7 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Hard · attack unit | 28 | 75% | 0.37 | 17.9 | 1 |
| Hard · go solo | 19 | 74% | 0.27 | 15.8 | 0 |
| Hard · end turn | 80 | 78% | 0.23 | 12.5 | 1 |
| Hard · attack gigs | 177 | 82% | 0.23 | 11.9 | 1 |
| Hard · activate | 74 | 77% | 0.17 | 10.8 | 0 |
| Hard · unit | 192 | 83% | 0.17 | 10.9 | 2 |
| Hard · program | 81 | 77% | 0.13 | 3.7 | 0 |
| Hard · sell | 254 | 92% | 0.08 | 4.3 | 0 |
| Hard · gear | 17 | 82% | 0.07 | 5.9 | 0 |
| Hard · call | 113 | 94% | 0.03 | 2.7 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| RRY Smasher Aggro | 158 | 80% | 0.22 | 13.3 | 1 |
| Rainbow Fixer Stuff | 93 | 77% | 0.18 | 10.8 | 0 |
| RRG Dexter Midrange | 76 | 84% | 0.17 | 7.9 | 0 |
| RRB Wakako Midrange | 212 | 88% | 0.16 | 7.5 | 2 |
| BBG Cunningham Econ | 202 | 84% | 0.12 | 7.9 | 0 |
| YYB Rogue Gear | 88 | 88% | 0.10 | 3.4 | 0 |
| GRY Trauma Team | 206 | 86% | 0.10 | 6.8 | 2 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 8 | RRB Wakako Midrange (Hard) | unit | Play 6th Street Recruits (4 €$) | Dexter DeShawn: Off the Grid: Increase a Gig by up to 2 | 3.00 |
| 10 | RRB Wakako Midrange (Hard) | unit | Play Meredith Stout: Stone Cold Corpo (4 €$) | Wakako Okada: Peace and Harmony: Decrease a Gig by up to 2 | 3.00 |
| 7 | BBG Cunningham Econ (Hard) | end turn | Pass turn | Play Les Élémens (5 €$) | 3.00 |
| 9 | RRY Smasher Aggro (Hard) | attack gigs | Attack with Royce: Don't Call Me Simon (4) → Gig area | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 12 | RRY Smasher Aggro (Hard) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 7 | GRY Trauma Team (Hard) | attack unit | Attack with Meredith Stout: Stone Cold Corpo (5) → Pepe Najarro: Working Doubles (6) | Attack with Meredith Stout: Stone Cold Corpo (5) → Gig area | 3.00 |
| 10 | YYB Rogue Gear (Hard) | end turn | Pass turn | Play Psycho Squad (4 €$) | 3.00 |
| 11 | RRB Wakako Midrange (Hard) | unit | Play Yorinobu Arasaka: Steel Dragon (7 €$) | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |
| 13 | RRB Wakako Midrange (Hard) | unit | Play Lizzy Wizzy: Delicate Weapon (5 €$) | Go Solo: Adam Smasher: Ender of Legends (9 €$) | 3.00 |
| 13 | RRB Wakako Midrange (Hard) | attack gigs | Attack with Psycho Squad (6) → Gig area | Attack with Yorinobu Arasaka: Steel Dragon (9) → Pepe Najarro: Working Doubles (6) | 3.00 |
| 10 | YYB Rogue Gear (Hard) | unit | Play Trauma Team Operatives (6 €$) | Go Solo: V: Corporate Exile (5 €$) | 2.98 |
| 9 | RRY Smasher Aggro (Hard) | program | Play Bonnie and Clyde (3 €$) | Attack with V: Streetkid (6) → 6th Street Recruits (6) | 2.82 |
| 12 | RRG Dexter Midrange (Hard) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Attack with Animals Wrecker (10) → Yorinobu Arasaka: Steel Dragon (9) | 2.81 |
| 12 | RRG Dexter Midrange (Hard) | sell | Sell Gunpoint Diplomacy | Pass turn | 2.80 |
| 8 | Rainbow Fixer Stuff (Hard) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Attack with 6th Street Recruits (6) → Royce: Don't Call Me Simon (4) | 2.79 |

## Calibration against real results

Over 24 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **50%** of the time.
Fitted: each Gig of extra mistakes costs about **0.3 points of win chance** (logistic slope 0.014 per Gig).
So an average decision here (0.15 Gigs lost) costs about 0.05 points of win chance.

## Validation: planted random moves

| | Moves | Avg Gigs lost | Flagged inaccurate (> noise) | Flagged blunder |
|---|---|---|---|---|
| Random moves (planted) | 170 | 0.38 | 39% | 18% |
| The bot's own moves | 865 | 0.10 | 11% | 6% |

Separation (AUC): a planted random move scores worse than a bot move **70%** of the time (50% = no better than chance).