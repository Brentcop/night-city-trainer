# Regionals forecast: backtest on our recorded events

Each plain Swiss event of the current pool (sim v9, hard bot; held out in turn: events 20, 21, 22, 23, 24) forecast from the ratings and head-to-heads fitted on the games the live forecast reads (public/data/h2h.json: the recorded events and rating runs of that version and bot, on the library's current lists), less the held-out event's own games, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. Pooled besides the held-out events: event 25, run-1. Not held out (their games still predict the others): event 25, not a plain Swiss event: another format, or pairings or seeds set by hand; run-1, a rating run, with no standings or cut. Entrants whose stored list is no longer the library's: 0. 100 parameter draws × 300 tournaments per event (seed 1 + the event id); 76 s. Baseline: every deck has the same chance, cut / entrants.

**Result (every other pooled game).** The forecast scores better than the baseline: its Brier score is lower by 0.0179 (90% interval of the difference 0.0062 to 0.0308), a Brier skill score of 17.9%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 20 | 71 | Swiss 9 Bo3, top 8 | 13,274 | 0.0927 | 0.0932 | 0.1000 | 3 of 8 |
| 21 | 71 | Swiss 9 Bo3, top 8 | 13,273 | 0.0606 | 0.0604 | 0.1000 | 6 of 8 |
| 22 | 71 | Swiss 9 Bo3, top 8 | 13,276 | 0.0698 | 0.0699 | 0.1000 | 5 of 8 |
| 23 | 71 | Swiss 9 Bo3, top 8 | 13,266 | 0.0818 | 0.0821 | 0.1000 | 3 of 8 |
| 24 | 71 | Swiss 9 Bo3, top 8 | 13,277 | 0.1056 | 0.1064 | 0.1000 | 2 of 8 |
| all | 355 deck-events | | | **0.0821** | 0.0824 | 0.1000 | 19 of 40 |

Brier skill score against the baseline: 17.9% (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the 71 decks: -0.0308 to -0.0062). With the ratings fixed at their estimate instead of drawn: Brier 0.0824 (difference forecast minus fixed, 90% interval -0.0006 to 0.0000).

**Calibration** (every deck-event, by the forecast chance):

| Forecast chance | Deck-events | Mean forecast | Made the cut | Rate |
|---|---|---|---|---|
| 0.0% to 2.0% | 98 | 0.6% | 0 | 0.0% |
| 2.0% to 5.0% | 57 | 3.5% | 2 | 3.5% |
| 5.0% to 10.0% | 67 | 6.5% | 10 | 14.9% |
| 10.0% to 20.0% | 56 | 14.7% | 3 | 5.4% |
| 20.0% to 35.0% | 50 | 25.2% | 9 | 18.0% |
| 35.0% to 50.0% | 22 | 40.4% | 13 | 59.1% |
| 50.0% to 100% | 5 | 67.2% | 3 | 60.0% |

**Earlier games only** (each held-out event forecast from the events and runs dated before it; not scored, nothing earlier: event 20). The forecast scores better than the baseline: its Brier score is lower by 0.0170 (90% interval of the difference 0.0050 to 0.0309), a Brier skill score of 17.0%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 21 | 71 | Swiss 9 Bo3, top 8 | 816 | 0.0721 | 0.0723 | 0.1000 | 4 of 8 |
| 22 | 71 | Swiss 9 Bo3, top 8 | 1,633 | 0.0629 | 0.0616 | 0.1000 | 5 of 8 |
| 23 | 71 | Swiss 9 Bo3, top 8 | 2,447 | 0.1010 | 0.1043 | 0.1000 | 2 of 8 |
| 24 | 71 | Swiss 9 Bo3, top 8 | 3,271 | 0.0961 | 0.0978 | 0.1000 | 2 of 8 |
| all | 284 deck-events | | | **0.0830** | 0.0840 | 0.1000 | 13 of 32 |

What this checks: whether ratings fitted on the other recorded games of the Hard bot playing these lists predict who reaches the top cut of a held-out event of the same bot and lists. It says nothing about human players. Each range is the 90% range across the parameter draws: what we do not know about the decks’ strength from the recorded games. It does not include model error (a matchup that differs from what the ratings and the head-to-head records say) or how people play compared with the Hard bot, so the real uncertainty is wider.
