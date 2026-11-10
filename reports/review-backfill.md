# Match review — backfill (200 games, 8 play-outs per candidate, coach checked on every decision)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 200/200. Review time 30.0 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) | 9294 | 86% | 0.16 | 9.5 | 19 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 4763 | 84% | 0.17 | 10.1 | 3 |
| Losing side | 4531 | 87% | 0.15 | 8.9 | 16 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack gigs | 2179 | 72% | 0.33 | 18.7 | 11 |
| attack unit | 392 | 79% | 0.29 | 17.6 | 2 |
| unit | 1706 | 84% | 0.20 | 12.6 | 3 |
| program | 518 | 86% | 0.12 | 7.1 | 0 |
| activate | 442 | 91% | 0.09 | 5.7 | 1 |
| gear | 66 | 91% | 0.08 | 6.1 | 0 |
| go solo | 279 | 90% | 0.06 | 4.7 | 0 |
| sell | 2272 | 93% | 0.05 | 3.4 | 2 |
| end turn | 477 | 94% | 0.04 | 2.7 | 0 |
| call | 963 | 96% | 0.03 | 2.2 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) · attack gigs | 2179 | 72% | 0.33 | 18.7 | 11 |
| Deep (series bot) · attack unit | 392 | 79% | 0.29 | 17.6 | 2 |
| Deep (series bot) · unit | 1706 | 84% | 0.20 | 12.6 | 3 |
| Deep (series bot) · program | 518 | 86% | 0.12 | 7.1 | 0 |
| Deep (series bot) · activate | 442 | 91% | 0.09 | 5.7 | 1 |
| Deep (series bot) · gear | 66 | 91% | 0.08 | 6.1 | 0 |
| Deep (series bot) · go solo | 279 | 90% | 0.06 | 4.7 | 0 |
| Deep (series bot) · sell | 2272 | 93% | 0.05 | 3.4 | 2 |
| Deep (series bot) · end turn | 477 | 94% | 0.04 | 2.7 | 0 |
| Deep (series bot) · call | 963 | 96% | 0.03 | 2.2 | 0 |

## Coach vs oracle

The coach agreed with the oracle on **94%** of 9294 decisions (the bots that actually played: 86%). Average Gigs lost if you followed the coach: 0.04.

| Decision type | n | Coach accuracy | Coach Gigs lost | Bots' Gigs lost |
|---|---|---|---|---|
| sell | 2272 | 93% | 0.06 | 0.05 |
| attack unit | 392 | 94% | 0.06 | 0.29 |
| program | 518 | 93% | 0.04 | 0.12 |
| activate | 442 | 95% | 0.04 | 0.09 |
| attack gigs | 2179 | 94% | 0.03 | 0.33 |
| unit | 1706 | 95% | 0.03 | 0.20 |
| go solo | 279 | 95% | 0.03 | 0.06 |
| end turn | 477 | 96% | 0.02 | 0.04 |
| gear | 66 | 97% | 0.01 | 0.08 |
| call | 963 | 97% | 0.01 | 0.03 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Rainbow Fixer Stuff | 216 | 78% | 0.32 | 17.1 | 1 |
| NC-06 Metal Over Meat (YYY) | 93 | 83% | 0.31 | 14.0 | 0 |
| Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. | 150 | 78% | 0.29 | 17.3 | 0 |
| S1-05 Cross (RGY) | 162 | 80% | 0.26 | 11.7 | 0 |
| S5-06 Cross (RRB) | 219 | 82% | 0.25 | 15.1 | 2 |
| GRY Trauma Team | 110 | 85% | 0.25 | 12.7 | 0 |
| S5-05 Cross (RBG) | 220 | 80% | 0.25 | 16.8 | 0 |
| S3-02 Mutant (RRG) | 84 | 80% | 0.23 | 13.1 | 1 |
| YYB Rogue Gear | 77 | 88% | 0.22 | 10.4 | 0 |
| BBG Cunningham Econ | 136 | 81% | 0.22 | 14.7 | 3 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 10 | RRB Wakako Midrange (Deep (series bot)) | attack unit | Attack with Yorinobu Arasaka: Steel Dragon (9) → Psycho Squad (6) | Call a Legend (face-down slot 3) | 3.00 |
| 9 | Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. (Deep (series bot)) | attack gigs | Attack with Jackie Welles: Ride or Die Choom (8) → Gig area | Call a Legend (face-down slot 3) | 3.00 |
| 9 | Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. (Deep (series bot)) | attack unit | Attack with Trauma Team Operatives (7) → V: Streetkid (6) | Call a Legend (face-down slot 3) | 3.00 |
| 7 | NC-06 Metal Over Meat (YYY) (Deep (series bot)) | attack gigs | Attack with Rockn' Rockerboy (8) → Gig area | Play Secondhand Bombus (2 €$) | 3.00 |
| 7 | NC-06 Metal Over Meat (YYY) (Deep (series bot)) | unit | Play Jackie Welles: Ride or Die Choom (6 €$) | Play Secondhand Bombus (2 €$) | 3.00 |
| 11 | NC-06 Metal Over Meat (YYY) (Deep (series bot)) | attack gigs | Attack with MaxTac Suppression Team (7) → Gig area | Play Dexter DeShawn: One Last Chance (3 €$) | 3.00 |
| 11 | NC-06 Metal Over Meat (YYY) (Deep (series bot)) | unit | Play MaxTac Suppression Team (5 €$) | Play Dexter DeShawn: One Last Chance (3 €$) | 3.00 |
| 8 | BBG Draw and Wipe (Deep (series bot)) | unit | Play Jacked-In Voodoo Boy (2 €$) | Play Chrome Reverie (3 €$) | 3.00 |
| 10 | BBG Draw and Wipe (Deep (series bot)) | unit | Play Placide: Voodoo Sentinel (8 €$) | Play Les Élémens (5 €$) | 3.00 |
| 10 | NC-02 Stormrider Stampede (GGR) (Deep (series bot)) | attack gigs | Attack with MaxTac Heavy (8) → Gig area | Attack with MaxTac AV (8) → MaxTac Suppression Team (7) | 3.00 |
| 10 | NC-02 Stormrider Stampede (GGR) (Deep (series bot)) | attack gigs | Attack with MaxTac AV (8) → Gig area | Attack with MaxTac AV (8) → MaxTac Suppression Team (7) | 3.00 |
| 8 | S1-05 Cross (RGY) (Deep (series bot)) | attack unit | Attack with MaxTac AV (10) → 6th Street Recruits (6) | Play Memory Relapse (4 €$) | 3.00 |
| 11 | S5-06 Cross (RRB) (Deep (series bot)) | attack gigs | Attack with V: Corporate Exile (8) → Gig area | Attack with V: Corporate Exile (8) → Pepe Najarro: Working Doubles (6) | 3.00 |
| 11 | NC-05 Emperor's Guard (GGB) (Deep (series bot)) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Attack with Sandayu Oda: Hanako's Guardian (8) → V: Corporate Exile (8) | 3.00 |
| 11 | NC-05 Emperor's Guard (GGB) (Deep (series bot)) | attack gigs | Attack with MaxTac AV (8) → Gig area | Attack with Sandayu Oda: Hanako's Guardian (8) → V: Corporate Exile (8) | 3.00 |

## Calibration against real results

Over 200 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **44%** of the time.
Mistakes alone: each Gig of extra mistakes costs about -1.3 points of win chance.
Holding deck strength fixed (power ratings): each Gig of extra mistakes costs about **-1.6 points of win chance**; one point of rating gap is worth 28.2 points.
An average decision here (0.16 Gigs lost) therefore costs about -0.24 points of win chance.