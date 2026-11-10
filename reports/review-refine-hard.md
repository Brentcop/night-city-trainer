# Match review — refine-hard (24 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 24/24. Review time 22.7 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Hard v1 (before refinement) | 637 | 89% | 0.09 | 6.0 | 3 |
| Hard | 611 | 87% | 0.11 | 6.9 | 0 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 634 | 88% | 0.09 | 6.2 | 0 |
| Losing side | 614 | 87% | 0.12 | 6.7 | 3 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| block | 38 | 50% | 0.29 | 15.8 | 0 |
| no reaction | 20 | 90% | 0.19 | 10.0 | 0 |
| attack gigs | 226 | 85% | 0.17 | 10.2 | 3 |
| sell | 284 | 87% | 0.10 | 6.3 | 0 |
| activate | 88 | 91% | 0.10 | 5.7 | 0 |
| react: call | 29 | 97% | 0.10 | 3.4 | 0 |
| program | 59 | 90% | 0.09 | 6.8 | 0 |
| unit | 218 | 89% | 0.08 | 6.4 | 0 |
| end turn | 106 | 88% | 0.05 | 4.7 | 0 |
| call | 110 | 93% | 0.03 | 1.8 | 0 |
| react: program | 3 | 100% | 0.01 | 0.0 | 0 |
| go solo | 21 | 95% | 0.01 | 0.0 | 0 |
| react: ability | 1 | 100% | 0.01 | 0.0 | 0 |
| gear | 13 | 100% | 0.00 | 0.0 | 0 |
| attack unit | 32 | 100% | 0.00 | 0.0 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Hard · block | 23 | 48% | 0.29 | 17.4 | 0 |
| Hard v1 (before refinement) · block | 15 | 53% | 0.29 | 13.3 | 0 |
| Hard · attack gigs | 102 | 84% | 0.17 | 9.8 | 0 |
| Hard v1 (before refinement) · attack gigs | 124 | 86% | 0.16 | 10.5 | 3 |
| Hard · sell | 142 | 87% | 0.13 | 7.0 | 0 |
| Hard v1 (before refinement) · activate | 57 | 91% | 0.12 | 5.3 | 0 |
| Hard v1 (before refinement) · program | 25 | 92% | 0.11 | 8.0 | 0 |
| Hard · unit | 106 | 90% | 0.09 | 7.5 | 0 |
| Hard · program | 34 | 88% | 0.09 | 5.9 | 0 |
| Hard v1 (before refinement) · sell | 142 | 86% | 0.08 | 5.6 | 0 |
| Hard v1 (before refinement) · unit | 112 | 88% | 0.07 | 5.4 | 0 |
| Hard · end turn | 59 | 83% | 0.06 | 5.1 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 243 | 86% | 0.14 | 7.8 | 0 |
| RRB Wakako Midrange | 217 | 90% | 0.13 | 6.5 | 2 |
| YYB Rogue Gear | 131 | 89% | 0.10 | 5.3 | 1 |
| RRG Dexter Midrange | 76 | 88% | 0.09 | 6.6 | 0 |
| Rainbow Fixer Stuff | 136 | 87% | 0.09 | 7.4 | 0 |
| RRY Smasher Aggro | 231 | 90% | 0.07 | 6.1 | 0 |
| BBG Cunningham Econ | 214 | 86% | 0.07 | 5.1 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 9 | GRY Trauma Team (Hard) | sell | Sell Zetatech Faceplate | Pass turn | 3.00 |
| 11 | GRY Trauma Team (Hard) | sell | Sell Memory Relapse | Pass turn | 3.00 |
| 13 | YYB Rogue Gear (Hard v1 (before refinement)) | attack gigs | Attack with Psycho Squad (6) → Gig area | Play Gorilla Arms (4 €$) | 3.00 |
| 13 | YYB Rogue Gear (Hard v1 (before refinement)) | attack gigs | Attack with Trauma Team Operatives (7) → Gig area | Play Gorilla Arms (4 €$) | 3.00 |
| 6 | Rainbow Fixer Stuff (Hard v1 (before refinement)) | activate | Padre: Man of the Cross: Set a player's Gig to the value of another player's Gig | Attack with 6th Street Recruits (6) → Gig area | 3.00 |
| 13 | RRB Wakako Midrange (Hard v1 (before refinement)) | attack gigs | Attack with Yorinobu Arasaka: Steel Dragon (9) → Gig area | Attack with Yorinobu Arasaka: Steel Dragon (9) → Jackie Welles: Ride or Die Choom (8) | 3.00 |
| 13 | RRB Wakako Midrange (Hard v1 (before refinement)) | attack gigs | Attack with Yorinobu Arasaka: Steel Dragon (9) → Gig area | Attack with Yorinobu Arasaka: Steel Dragon (9) → Jackie Welles: Ride or Die Choom (8) | 3.00 |
| 11 | GRY Trauma Team (Hard) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Play Trauma Team Operatives (4 €$) | 3.00 |
| 9 | RRB Wakako Midrange (Hard) | unit | Play Yorinobu Arasaka: Steel Dragon (7 €$) | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |
| 11 | RRB Wakako Midrange (Hard) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Play Lizzy Wizzy: Delicate Weapon (5 €$) | 3.00 |
| 10 | GRY Trauma Team (Hard) | sell | Sell All is Lost | Pass turn | 3.00 |
| 11 | GRY Trauma Team (Hard) | react: call | Call a Legend (face-down slot 2) | No (more) reactions | 2.70 |
| 8 | RRB Wakako Midrange (Hard) | attack gigs | Attack with Meredith Stout: Stone Cold Corpo (5) → Gig area | Call a Legend (face-down slot 3) | 2.43 |
| 9 | RRB Wakako Midrange (Hard v1 (before refinement)) | block | Block with Meredith Stout: Stone Cold Corpo | No (more) reactions | 2.29 |
| 11 | RRY Smasher Aggro (Hard v1 (before refinement)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Go Solo: V: Streetkid (5 €$) | 2.28 |

## Calibration against real results

Over 24 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **54%** of the time.
Mistakes alone: each Gig of extra mistakes costs about 3.7 points of win chance.
Holding deck strength fixed (power ratings): each Gig of extra mistakes costs about **3.5 points of win chance**; one point of rating gap is worth 6.8 points.
An average decision here (0.10 Gigs lost) therefore costs about 0.35 points of win chance.