# Regionals forecast: backtest on our recorded events

Each plain Swiss event of the current pool (sim v13, hard bot; held out in turn: events 26, 27, 28, 29, 30) forecast from the ratings and head-to-heads fitted on the games the live forecast reads (public/data/h2h.json: the recorded events and rating runs of that version and bot, on the library's current lists), less the held-out event's own games, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. Pooled besides the held-out events: run-5, run-6, run-7, run-8, run-9. Not held out (their games still predict the others): run-5, a rating run, with no standings or cut; run-6, a rating run, with no standings or cut; run-7, a rating run, with no standings or cut; run-8, a rating run, with no standings or cut; run-9, a rating run, with no standings or cut. Entrants whose stored list is no longer the library's: 0. 100 parameter draws × 300 tournaments per event (seed 1 + the event id); 42 s. Baseline: every deck has the same chance, cut / entrants.

**Result (every other pooled game).** The forecast scores better than the baseline: its Brier score is lower by 0.0174 (90% interval of the difference 0.0091 to 0.0268), a Brier skill score of 17.4%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 26 | 71 | Swiss 9 Bo3, top 8 | 34,239 | 0.0912 | 0.0914 | 0.1000 | 2 of 8 |
| 27 | 71 | Swiss 9 Bo3, top 8 | 34,229 | 0.0822 | 0.0820 | 0.1000 | 3 of 8 |
| 28 | 71 | Swiss 9 Bo3, top 8 | 34,230 | 0.0773 | 0.0772 | 0.1000 | 4 of 8 |
| 29 | 71 | Swiss 9 Bo3, top 8 | 34,246 | 0.0833 | 0.0833 | 0.1000 | 4 of 8 |
| 30 | 71 | Swiss 9 Bo3, top 8 | 34,230 | 0.0790 | 0.0789 | 0.1000 | 3 of 8 |
| all | 355 deck-events | | | **0.0826** | 0.0825 | 0.1000 | 16 of 40 |

Brier skill score against the baseline: 17.4% (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the 71 decks: -0.0268 to -0.0091). With the ratings fixed at their estimate instead of drawn: Brier 0.0825 (difference forecast minus fixed, 90% interval -0.0001 to 0.0003).

**Calibration** (every deck-event, by the forecast chance):

| Forecast chance | Deck-events | Mean forecast | Made the cut | Rate |
|---|---|---|---|---|
| 0.0% to 2.0% | 101 | 0.6% | 0 | 0.0% |
| 2.0% to 5.0% | 78 | 3.5% | 3 | 3.8% |
| 5.0% to 10.0% | 56 | 7.4% | 3 | 5.4% |
| 10.0% to 20.0% | 43 | 15.2% | 9 | 20.9% |
| 20.0% to 35.0% | 47 | 27.1% | 13 | 27.7% |
| 35.0% to 50.0% | 25 | 42.3% | 10 | 40.0% |
| 50.0% to 100% | 5 | 53.8% | 2 | 40.0% |

**Earlier games only** (each held-out event forecast from the events and runs dated before it). The forecast scores better than the baseline: its Brier score is lower by 0.0167 (90% interval of the difference 0.0085 to 0.0260), a Brier skill score of 16.7%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 26 | 71 | Swiss 9 Bo3, top 8 | 29,590 | 0.0938 | 0.0937 | 0.1000 | 2 of 8 |
| 27 | 71 | Swiss 9 Bo3, top 8 | 31,797 | 0.0822 | 0.0820 | 0.1000 | 3 of 8 |
| 28 | 71 | Swiss 9 Bo3, top 8 | 32,614 | 0.0775 | 0.0771 | 0.1000 | 3 of 8 |
| 29 | 71 | Swiss 9 Bo3, top 8 | 33,430 | 0.0836 | 0.0836 | 0.1000 | 3 of 8 |
| 30 | 71 | Swiss 9 Bo3, top 8 | 34,230 | 0.0790 | 0.0789 | 0.1000 | 3 of 8 |
| all | 355 deck-events | | | **0.0832** | 0.0831 | 0.1000 | 14 of 40 |

What this checks: whether ratings fitted on the other recorded games of the Hard bot playing these lists predict who reaches the top cut of a held-out event of the same bot and lists. It says nothing about human players. Each range is the 90% range across the parameter draws: what we do not know about the decks’ strength from the recorded games. It does not include model error (a matchup that differs from what the ratings and the head-to-head records say) or how people play compared with the Hard bot, so the real uncertainty is wider.
