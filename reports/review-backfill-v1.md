# Match review — backfill (200 games, 8 play-outs per candidate, coach checked on every decision)

Accuracy = decision within 4 eval points (0.10 Gigs) of the oracle's best. Blunder = more than 15 points (0.38 Gigs) lost.
Replays matching their recorded result: 200/200. Review time 32.1 s per game (single thread).

## By bot

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) | 9505 | 84% | 0.21 | 11.2 | 9 |

## Winners vs losers

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Winning side | 4878 | 84% | 0.20 | 11.3 | 4 |
| Losing side | 4627 | 84% | 0.23 | 11.1 | 5 |

## By decision type (costliest first)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| attack gigs | 2265 | 68% | 0.48 | 23.7 | 4 |
| attack unit | 413 | 82% | 0.31 | 16.5 | 2 |
| unit | 1727 | 83% | 0.20 | 12.2 | 2 |
| go solo | 297 | 85% | 0.20 | 9.4 | 0 |
| sell | 2329 | 91% | 0.12 | 5.6 | 0 |
| gear | 90 | 84% | 0.11 | 6.7 | 0 |
| program | 512 | 89% | 0.09 | 5.3 | 0 |
| end turn | 509 | 91% | 0.09 | 4.9 | 0 |
| activate | 428 | 93% | 0.08 | 4.0 | 1 |
| call | 935 | 97% | 0.02 | 1.8 | 0 |

## By bot and decision type (costliest 12)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| Deep (series bot) · attack gigs | 2265 | 68% | 0.48 | 23.7 | 4 |
| Deep (series bot) · attack unit | 413 | 82% | 0.31 | 16.5 | 2 |
| Deep (series bot) · unit | 1727 | 83% | 0.20 | 12.2 | 2 |
| Deep (series bot) · go solo | 297 | 85% | 0.20 | 9.4 | 0 |
| Deep (series bot) · sell | 2329 | 91% | 0.12 | 5.6 | 0 |
| Deep (series bot) · gear | 90 | 84% | 0.11 | 6.7 | 0 |
| Deep (series bot) · program | 512 | 89% | 0.09 | 5.3 | 0 |
| Deep (series bot) · end turn | 509 | 91% | 0.09 | 4.9 | 0 |
| Deep (series bot) · activate | 428 | 93% | 0.08 | 4.0 | 1 |
| Deep (series bot) · call | 935 | 97% | 0.02 | 1.8 | 0 |

## Coach vs oracle

The coach agreed with the oracle on **93%** of 9505 decisions (the bots that actually played: 84%). Average Gigs lost if you followed the coach: 0.09.

| Decision type | n | Coach accuracy | Coach Gigs lost | Bots' Gigs lost |
|---|---|---|---|---|
| attack gigs | 2265 | 90% | 0.18 | 0.48 |
| sell | 2329 | 91% | 0.12 | 0.12 |
| go solo | 297 | 94% | 0.09 | 0.20 |
| attack unit | 413 | 94% | 0.08 | 0.31 |
| unit | 1727 | 94% | 0.05 | 0.20 |
| end turn | 509 | 94% | 0.05 | 0.09 |
| activate | 428 | 95% | 0.04 | 0.08 |
| program | 512 | 96% | 0.03 | 0.09 |
| gear | 90 | 93% | 0.02 | 0.11 |
| call | 935 | 99% | 0.01 | 0.02 |

## Decks that misplay most (≥ 60 decisions)

| | Decisions | Accuracy | Avg Gigs lost / decision | Blunders / 100 | Game-losing |
|---|---|---|---|---|---|
| S5-05 Cross (RBG) | 131 | 76% | 0.41 | 22.1 | 0 |
| Rainbow Fixer Stuff | 219 | 74% | 0.41 | 21.5 | 0 |
| S5-01 Mutant (RBG) | 68 | 79% | 0.39 | 19.1 | 0 |
| Fills up Discard super quickly then heavily discounted Trauma Team Operatives and high power Rockerboys fill the board. | 100 | 75% | 0.35 | 17.0 | 0 |
| S4-05 Cross (RBG) | 99 | 74% | 0.34 | 19.2 | 0 |
| S3-07 Explorer (RRG) | 159 | 76% | 0.33 | 16.4 | 0 |
| S3-03 Mutant (RRB) | 168 | 82% | 0.32 | 16.1 | 0 |
| S1-07 Explorer (BBG) | 270 | 82% | 0.31 | 15.6 | 0 |
| S1-06 Cross (RGG) | 150 | 85% | 0.31 | 14.0 | 1 |
| S4-08 Explorer (RRY) | 124 | 77% | 0.29 | 15.3 | 1 |

## Costliest decisions

| Turn | Deck (bot) | Type | Played | Oracle preferred | Gigs lost |
|---|---|---|---|---|---|
| 7 | Samurai (Deep (series bot)) | attack gigs | Attack with Rita Wheeler: No Stupid Questions (4) → Gig area | Play Chrome Reverie (3 €$) | 3.00 |
| 11 | S2-08 Explorer (RRG) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Attack with Animals Wrecker (10) → Psycho Squad (6) | 3.00 |
| 10 | S3-05 Cross (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Play Carnage at the Colosseum (5 €$) | 3.00 |
| 9 | NC-03 Static Shock (BBR) (Deep (series bot)) | sell | Sell Three Mouths, One Desire | Pass turn | 3.00 |
| 9 | NC-03 Static Shock (BBR) (Deep (series bot)) | attack gigs | Attack with Westbrook Netrunner (5) → Gig area | Pass turn | 3.00 |
| 7 | S4-04 Cross (BBG) (Deep (series bot)) | attack gigs | Attack with Pepe Najarro: Working Doubles (6) → Gig area | Play Valentino Street Racer (3 €$) | 3.00 |
| 7 | S4-04 Cross (BBG) (Deep (series bot)) | go solo | Go Solo: Jackie Welles: Mama's Favorite (6 €$) | Play Valentino Street Racer (3 €$) | 3.00 |
| 9 | Addin' Trash (Deep (series bot)) | sell | Sell Cyberpsychosis | Pass turn | 3.00 |
| 9 | Addin' Trash (Deep (series bot)) | attack gigs | Attack with Trauma Team Operatives (10) → Gig area | Pass turn | 3.00 |
| 10 | S4-03 Mutant (RRB) (Deep (series bot)) | sell | Sell Floor It | Pass turn | 3.00 |
| 10 | S4-03 Mutant (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Pass turn | 3.00 |
| 10 | S4-03 Mutant (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Pass turn | 3.00 |
| 12 | S4-03 Mutant (RRB) (Deep (series bot)) | sell | Sell Nocturne OP55 N1 | Pass turn | 3.00 |
| 12 | S4-03 Mutant (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Pass turn | 3.00 |
| 12 | S4-03 Mutant (RRB) (Deep (series bot)) | attack gigs | Attack with Animals Wrecker (10) → Gig area | Pass turn | 3.00 |

## Calibration against real results

Over 200 reviewed games, the side the reviewer says lost fewer Gigs to mistakes won **52%** of the time.
Fitted: each Gig of extra mistakes costs about **0.5 points of win chance** (logistic slope 0.020 per Gig).
So an average decision here (0.21 Gigs lost) costs about 0.11 points of win chance.