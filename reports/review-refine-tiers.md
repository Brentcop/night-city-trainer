# Match review — refine-tiers (30 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 30/30. Review time 36.3 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium | 550 | 72% | 0.38 | 19.8 | 4 |
| Hard | 559 | 88% | 0.10 | 6.1 | 2 |
| Easy | 509 | 67% | 0.33 | 19.4 | 3 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 833 | 79% | 0.21 | 12.5 | 4 |
| Losing side | 785 | 73% | 0.33 | 17.6 | 5 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| unit | 296 | 65% | 0.48 | 26.4 | 1 |
| go solo | 21 | 76% | 0.43 | 19.0 | 0 |
| attack gigs | 407 | 68% | 0.39 | 23.1 | 4 |
| attack unit | 26 | 85% | 0.37 | 15.4 | 0 |
| gear | 19 | 63% | 0.36 | 31.6 | 0 |
| react: call | 53 | 68% | 0.28 | 11.3 | 0 |
| activate | 81 | 86% | 0.26 | 11.1 | 3 |
| program | 98 | 69% | 0.24 | 14.3 | 0 |
| end turn | 119 | 72% | 0.22 | 10.1 | 1 |
| block | 49 | 78% | 0.17 | 10.2 | 0 |
| sell | 330 | 93% | 0.04 | 2.1 | 0 |
| call | 100 | 93% | 0.04 | 3.0 | 0 |
| no reaction | 16 | 100% | 0.01 | 0.0 | 0 |
| react: ability | 2 | 100% | 0.00 | 0.0 | 0 |
| react: program | 1 | 100% | 0.00 | 0.0 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium · unit | 103 | 50% | 0.68 | 37.9 | 0 |
| Medium · end turn | 24 | 75% | 0.60 | 25.0 | 1 |
| Easy · unit | 100 | 60% | 0.59 | 32.0 | 0 |
| Medium · attack gigs | 147 | 56% | 0.55 | 30.6 | 1 |
| Easy · attack gigs | 132 | 62% | 0.44 | 28.8 | 3 |
| Easy · program | 44 | 41% | 0.43 | 27.3 | 0 |
| Medium · activate | 36 | 78% | 0.42 | 16.7 | 2 |
| Easy · react: call | 37 | 62% | 0.37 | 13.5 | 0 |
| Hard · attack unit | 21 | 86% | 0.31 | 14.3 | 0 |
| Hard · block | 17 | 65% | 0.24 | 11.8 | 0 |
| Medium · program | 28 | 89% | 0.17 | 7.1 | 0 |
| Medium · block | 21 | 86% | 0.17 | 9.5 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 347 | 75% | 0.39 | 17.9 | 6 |
| RRY Smasher Aggro | 264 | 67% | 0.37 | 21.2 | 0 |
| BBG Cunningham Econ | 240 | 77% | 0.25 | 13.8 | 0 |
| Rainbow Fixer Stuff | 228 | 75% | 0.23 | 13.6 | 1 |
| RRB Wakako Midrange | 242 | 84% | 0.20 | 10.7 | 2 |
| YYB Rogue Gear | 172 | 74% | 0.19 | 15.7 | 0 |
| RRG Dexter Midrange | 125 | 86% | 0.08 | 5.6 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 9 | BBG Cunningham Econ (Easy) | react: call | Call a Legend (face-down slot 1) | Call a Legend (face-down slot 2) | 3.00 |
| 11 | BBG Cunningham Econ (Medium) | unit | Play Placide: Voodoo Sentinel (8 €$) | Play Mox Inciters (3 €$) | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Screw: Lovelorn Fool (5 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | attack unit | Attack with Animals Wrecker (10) → V: Corporate Exile (8) | Play Royce: Don't Call Me Simon (5 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | attack gigs | Attack with Royce: Don't Call Me Simon (4) → Gig area | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | unit | Play 6th Street Recruits (4 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 12 | RRY Smasher Aggro (Medium) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 12 | RRY Smasher Aggro (Medium) | unit | Play Rockn' Rockerboy (5 €$) | Play Meredith Stout: Stone Cold Corpo (4 €$) | 3.00 |
| 7 | RRY Smasher Aggro (Easy) | unit | Play Royce: Don't Call Me Simon (5 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 11 | RRY Smasher Aggro (Easy) | unit | Play La Llorona: Ghost of the Past (3 €$) | Pass turn | 3.00 |
| 12 | RRY Smasher Aggro (Easy) | react: call | Call a Legend (face-down slot 3) | No (more) reactions | 3.00 |
| 7 | BBG Cunningham Econ (Easy) | unit | Play Pepe Najarro: Working Doubles (4 €$) | Play Mox Inciters (3 €$) | 3.00 |
| 9 | RRB Wakako Midrange (Medium) | unit | Play Placide: Voodoo Sentinel (8 €$) | Play Bonnie and Clyde (3 €$) | 3.00 |
| 11 | RRB Wakako Midrange (Medium) | attack gigs | Attack with Placide: Voodoo Sentinel (10) → Gig area | Attack with 6th Street Recruits (6) → Gig area | 3.00 |
| 13 | GRY Trauma Team (Easy) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Pass turn | 3.00 |

## Calibration against real results

Over 30 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **60%** of the time.
Mistakes alone: each Gig of extra mistakes costs about 1.9 points of win chance.
Holding deck strength fixed (power ratings): each Gig of extra mistakes costs about **1.8 points of win chance**; one point of rating gap is worth 5.9 points.
An average decision here (0.27 Gigs lost) therefore costs about 0.48 points of win chance.