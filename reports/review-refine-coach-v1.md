# Match review — refine-coach-v1 (60 games, 8 play-outs per candidate, coach checked on every decision)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 60/60. Review time 21.7 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) | 3001 | 85% | 0.18 | 9.8 | 7 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 1538 | 84% | 0.21 | 11.7 | 4 |
| Losing side | 1463 | 87% | 0.15 | 7.9 | 3 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| block | 46 | 57% | 0.56 | 21.7 | 0 |
| attack unit | 105 | 71% | 0.44 | 23.8 | 1 |
| attack gigs | 672 | 73% | 0.37 | 19.5 | 4 |
| unit | 538 | 81% | 0.24 | 14.5 | 1 |
| react: call | 54 | 83% | 0.13 | 9.3 | 0 |
| program | 178 | 89% | 0.12 | 5.6 | 0 |
| activate | 127 | 94% | 0.07 | 4.7 | 0 |
| sell | 710 | 94% | 0.05 | 3.0 | 1 |
| go solo | 83 | 92% | 0.04 | 2.4 | 0 |
| end turn | 144 | 96% | 0.04 | 2.1 | 0 |
| no reaction | 22 | 86% | 0.04 | 0.0 | 0 |
| call | 293 | 96% | 0.03 | 1.4 | 0 |
| gear | 22 | 91% | 0.02 | 0.0 | 0 |
| react: program | 7 | 100% | 0.00 | 0.0 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) · block | 46 | 57% | 0.56 | 21.7 | 0 |
| Deep (series bot) · attack unit | 105 | 71% | 0.44 | 23.8 | 1 |
| Deep (series bot) · attack gigs | 672 | 73% | 0.37 | 19.5 | 4 |
| Deep (series bot) · unit | 538 | 81% | 0.24 | 14.5 | 1 |
| Deep (series bot) · react: call | 54 | 83% | 0.13 | 9.3 | 0 |
| Deep (series bot) · program | 178 | 89% | 0.12 | 5.6 | 0 |
| Deep (series bot) · activate | 127 | 94% | 0.07 | 4.7 | 0 |
| Deep (series bot) · sell | 710 | 94% | 0.05 | 3.0 | 1 |
| Deep (series bot) · go solo | 83 | 92% | 0.04 | 2.4 | 0 |
| Deep (series bot) · end turn | 144 | 96% | 0.04 | 2.1 | 0 |
| Deep (series bot) · no reaction | 22 | 86% | 0.04 | 0.0 | 0 |
| Deep (series bot) · call | 293 | 96% | 0.03 | 1.4 | 0 |

## Coach vs oracle

The coach agreed with the oracle on **94%** of 3001 decisions (the bots that actually played: 85%). Average Gigs lost if you followed the coach: 0.04.

| Decision type | n | Coach accuracy | Coach Gigs lost | Bots' Gigs lost |
|---|---|---|---|---|
| block | 46 | 57% | 0.56 | 0.56 |
| react: call | 54 | 83% | 0.13 | 0.13 |
| attack unit | 105 | 93% | 0.06 | 0.44 |
| go solo | 83 | 96% | 0.05 | 0.04 |
| sell | 710 | 94% | 0.05 | 0.05 |
| no reaction | 22 | 86% | 0.04 | 0.04 |
| activate | 127 | 95% | 0.04 | 0.07 |
| attack gigs | 672 | 95% | 0.03 | 0.37 |
| unit | 538 | 96% | 0.03 | 0.24 |
| program | 178 | 94% | 0.02 | 0.12 |
| end turn | 144 | 97% | 0.02 | 0.04 |
| call | 293 | 96% | 0.01 | 0.03 |
| gear | 22 | 95% | 0.01 | 0.02 |
| react: program | 7 | 100% | 0.00 | 0.00 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. | 60 | 80% | 0.48 | 20.0 | 3 |
| S4-07 Explorer (RRB) | 74 | 74% | 0.35 | 21.6 | 0 |
| RRY Smasher Aggro | 75 | 84% | 0.34 | 14.7 | 0 |
| S1-03 Mutant (RRR) | 79 | 84% | 0.31 | 15.2 | 0 |
| NC-06 Metal Over Meat (YYY) | 95 | 80% | 0.25 | 14.7 | 0 |
| S3-04 Cross (RBG) | 131 | 82% | 0.23 | 12.2 | 0 |
| YYB Rogue Gear | 107 | 81% | 0.22 | 10.3 | 0 |
| S2-06 Cross (RGG) | 72 | 83% | 0.21 | 15.3 | 0 |
| S2-07 Explorer (RRB) | 60 | 87% | 0.18 | 8.3 | 0 |
| Running and Dancing | 71 | 83% | 0.17 | 8.5 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 10 | S5-06 Cross (RRB) (Deep (series bot)) | attack gigs | Attack with Swordwise Huscle (3) → Gig area | Go Solo: Royce: Psycho on the Edge (6 €$) | 3.00 |
| 12 | BBG Draw and Wipe (Deep (series bot)) | sell | Sell Peace Offering | Sell Towerfall | 3.00 |
| 13 | S3-08 Explorer (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Play Bonnie and Clyde (3 €$) | 3.00 |
| 13 | S3-08 Explorer (RRB) (Deep (series bot)) | unit | Play Placide: Voodoo Sentinel (8 €$) | Play Bonnie and Clyde (3 €$) | 3.00 |
| 12 | S5-03 Mutant (RGG) (Deep (series bot)) | program | Play Peace Offering (1 €$) | Play Memory Relapse (4 €$) | 3.00 |
| 14 | S5-03 Mutant (RGG) (Deep (series bot)) | attack gigs | Attack with Valentino Street Racer (3) → Gig area | Play MaxTac AV (5 €$) | 3.00 |
| 11 | NC-07 Braindance Burn (RRB) (Deep (series bot)) | attack gigs | Attack with Yorinobu Arasaka: Steel Dragon (9) → Gig area | Play Mantis Blades (1 €$) | 3.00 |
| 12 | S1-03 Mutant (RRR) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Play Carnage at the Colosseum (4 €$) | 3.00 |
| 12 | S1-03 Mutant (RRR) (Deep (series bot)) | call | Call a Legend (face-down slot 3) | Play Carnage at the Colosseum (4 €$) | 3.00 |
| 12 | S1-03 Mutant (RRR) (Deep (series bot)) | unit | Play Johnny Silverhand: Never Stop Fighting (6 €$) | Play Carnage at the Colosseum (4 €$) | 3.00 |
| 12 | S1-08 Explorer (RRG) (Deep (series bot)) | sell | Sell Over the Edge | Sell Bonnie and Clyde | 3.00 |
| 9 | NC-04 Chrome Rockers (YYR) (Deep (series bot)) | unit | Play Dexter DeShawn: One Last Chance (3 €$) | Play Gorilla Arms (4 €$) | 3.00 |
| 11 | BBG Cunningham Econ (Deep (series bot)) | block | Block with Lizzy Wizzy: Delicate Weapon | No (more) reactions | 3.00 |
| 12 | BBG Cunningham Econ (Deep (series bot)) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Attack with Pepe Najarro: Working Doubles (6) → Royce: Psycho on the Edge (4) | 3.00 |
| 12 | S4-03 Mutant (RRB) (Deep (series bot)) | attack gigs | Attack with Placide: Voodoo Sentinel (10) → Gig area | Call a Legend (face-down slot 2) | 3.00 |

## Calibration against real results

Over 60 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **42%** of the time.
Mistakes alone: each Gig of extra mistakes costs about -3.4 points of win chance.
Holding deck strength fixed (power ratings): each Gig of extra mistakes costs about **-3.4 points of win chance**; one point of rating gap is worth 3.8 points.
An average decision here (0.18 Gigs lost) therefore costs about -0.61 points of win chance.