# Match review — validate-tiers (30 games, 8 play-outs per candidate)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 30/30. Review time 52.8 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Hard | 518 | 89% | 0.10 | 6.0 | 0 |
| Easy | 453 | 64% | 0.37 | 22.3 | 5 |
| Medium | 520 | 71% | 0.40 | 20.6 | 4 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 775 | 78% | 0.25 | 14.2 | 3 |
| Losing side | 716 | 73% | 0.32 | 18.0 | 6 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| unit | 291 | 63% | 0.49 | 26.5 | 1 |
| gear | 19 | 53% | 0.45 | 36.8 | 0 |
| go solo | 21 | 76% | 0.39 | 14.3 | 0 |
| attack gigs | 409 | 67% | 0.38 | 24.2 | 4 |
| activate | 80 | 84% | 0.35 | 13.8 | 2 |
| attack unit | 22 | 86% | 0.29 | 13.6 | 0 |
| program | 102 | 68% | 0.27 | 15.7 | 1 |
| end turn | 119 | 71% | 0.21 | 9.2 | 1 |
| sell | 328 | 93% | 0.05 | 2.7 | 0 |
| call | 100 | 93% | 0.04 | 3.0 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Medium · unit | 103 | 49% | 0.71 | 38.8 | 0 |
| Easy · unit | 99 | 57% | 0.63 | 32.3 | 1 |
| Medium · end turn | 24 | 75% | 0.60 | 25.0 | 1 |
| Medium · activate | 37 | 73% | 0.52 | 21.6 | 2 |
| Medium · attack gigs | 150 | 59% | 0.51 | 28.7 | 1 |
| Easy · program | 44 | 36% | 0.50 | 31.8 | 1 |
| Easy · attack gigs | 131 | 57% | 0.47 | 33.6 | 3 |
| Hard · activate | 43 | 93% | 0.21 | 7.0 | 0 |
| Hard · attack unit | 17 | 88% | 0.20 | 11.8 | 0 |
| Medium · program | 29 | 86% | 0.17 | 6.9 | 0 |
| Easy · end turn | 66 | 59% | 0.16 | 6.1 | 0 |
| Hard · attack gigs | 128 | 86% | 0.14 | 9.4 | 0 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| GRY Trauma Team | 318 | 72% | 0.44 | 20.4 | 6 |
| RRY Smasher Aggro | 249 | 67% | 0.39 | 22.1 | 2 |
| BBG Cunningham Econ | 217 | 77% | 0.25 | 14.3 | 0 |
| Rainbow Fixer Stuff | 204 | 74% | 0.24 | 15.2 | 0 |
| YYB Rogue Gear | 155 | 72% | 0.20 | 16.1 | 0 |
| RRB Wakako Midrange | 233 | 85% | 0.17 | 9.0 | 1 |
| RRG Dexter Midrange | 115 | 84% | 0.12 | 9.6 | 0 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 11 | BBG Cunningham Econ (Medium) | unit | Play Placide: Voodoo Sentinel (8 €$) | Play Mox Inciters (3 €$) | 3.00 |
| 7 | RRY Smasher Aggro (Easy) | unit | Play Royce: Don't Call Me Simon (5 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 11 | RRY Smasher Aggro (Easy) | unit | Play La Llorona: Ghost of the Past (3 €$) | Pass turn | 3.00 |
| 12 | GRY Trauma Team (Hard) | activate | Padre: Man of the Cross: Set a player's Gig to the value of another player's Gig | Attack with Augmented Negotiators (4) → La Llorona: Ghost of the Past (3) | 3.00 |
| 11 | RRY Smasher Aggro (Easy) | unit | Play La Llorona: Ghost of the Past (3 €$) | Go Solo: V: Streetkid (5 €$) | 3.00 |
| 8 | RRY Smasher Aggro (Medium) | unit | Play Screw: Lovelorn Fool (5 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | attack unit | Attack with Animals Wrecker (10) → V: Corporate Exile (8) | Play Royce: Don't Call Me Simon (5 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | attack gigs | Attack with Royce: Don't Call Me Simon (4) → Gig area | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 10 | RRY Smasher Aggro (Medium) | unit | Play 6th Street Recruits (4 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 12 | RRY Smasher Aggro (Medium) | unit | Play Rockn' Rockerboy (5 €$) | Play La Llorona: Ghost of the Past (3 €$) | 3.00 |
| 13 | GRY Trauma Team (Easy) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Pass turn | 3.00 |
| 13 | GRY Trauma Team (Easy) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Pass turn | 3.00 |
| 13 | GRY Trauma Team (Easy) | attack gigs | Attack with Augmented Negotiators (2) → Gig area | Pass turn | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack gigs | Attack with 6th Street Recruits (6) → Gig area | Attack with Johnny Silverhand: Never Stop Fighting (8) → Trauma Team Operatives (7) | 3.00 |
| 10 | GRY Trauma Team (Medium) | attack gigs | Attack with Johnny Silverhand: Never Stop Fighting (8) → Gig area | Go Solo: V: Streetkid (5 €$) | 3.00 |