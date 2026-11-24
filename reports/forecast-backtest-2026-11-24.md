# Regionals forecast: backtest on our recorded events

Each plain Swiss event of the current pool (sim v9, hard bot; held out in turn: events 20, 21, 22, 23, 24) forecast from the ratings and head-to-heads fitted on the games the live forecast reads (public/data/h2h.json: the recorded events and rating runs of that version and bot, on the library's current lists), less the held-out event's own games, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. Pooled besides the held-out events: event 25, run-1. Not held out (their games still predict the others): event 25, not a plain Swiss event: another format, or pairings or seeds set by hand; run-1, a rating run, with no standings or cut. Entrants whose stored list is no longer the library's: 0. 100 parameter draws × 300 tournaments per event (seed 1 + the event id); 40 s. Baseline: every deck has the same chance, cut / entrants.

**Result (every other pooled game).** The forecast scores better than the baseline: its Brier score is lower by 0.0178 (90% interval of the difference 0.0061 to 0.0309), a Brier skill score of 17.8%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 20 | 71 | Swiss 9 Bo3, top 8 | 13,274 | 0.0933 | 0.0939 | 0.1000 | 3 of 8 |
| 21 | 71 | Swiss 9 Bo3, top 8 | 13,273 | 0.0599 | 0.0593 | 0.1000 | 6 of 8 |
| 22 | 71 | Swiss 9 Bo3, top 8 | 13,276 | 0.0695 | 0.0695 | 0.1000 | 5 of 8 |
| 23 | 71 | Swiss 9 Bo3, top 8 | 13,266 | 0.0815 | 0.0824 | 0.1000 | 3 of 8 |
| 24 | 71 | Swiss 9 Bo3, top 8 | 13,277 | 0.1066 | 0.1073 | 0.1000 | 2 of 8 |
| all | 355 deck-events | | | **0.0822** | 0.0825 | 0.1000 | 19 of 40 |

Brier skill score against the baseline: 17.8% (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the 71 decks: -0.0309 to -0.0061). With the ratings fixed at their estimate instead of drawn: Brier 0.0825 (difference forecast minus fixed, 90% interval -0.0006 to 0.0000).

**Calibration** (every deck-event, by the forecast chance):

| Forecast chance | Deck-events | Mean forecast | Made the cut | Rate |
|---|---|---|---|---|
| 0.0% to 2.0% | 101 | 0.5% | 0 | 0.0% |
| 2.0% to 5.0% | 60 | 3.5% | 5 | 8.3% |
| 5.0% to 10.0% | 63 | 6.5% | 8 | 12.7% |
| 10.0% to 20.0% | 53 | 14.6% | 2 | 3.8% |
| 20.0% to 35.0% | 51 | 25.3% | 9 | 17.6% |
| 35.0% to 50.0% | 22 | 41.4% | 13 | 59.1% |
| 50.0% to 100% | 5 | 69.4% | 3 | 60.0% |

**Earlier games only** (each held-out event forecast from the events and runs dated before it; not scored, nothing earlier: event 20). The forecast scores better than the baseline: its Brier score is lower by 0.0155 (90% interval of the difference 0.0024 to 0.0310), a Brier skill score of 15.5%.

| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|---|
| 21 | 71 | Swiss 9 Bo3, top 8 | 816 | 0.0725 | 0.0765 | 0.1000 | 4 of 8 |
| 22 | 71 | Swiss 9 Bo3, top 8 | 1,633 | 0.0621 | 0.0617 | 0.1000 | 5 of 8 |
| 23 | 71 | Swiss 9 Bo3, top 8 | 2,447 | 0.1048 | 0.1094 | 0.1000 | 2 of 8 |
| 24 | 71 | Swiss 9 Bo3, top 8 | 3,271 | 0.0986 | 0.1007 | 0.1000 | 2 of 8 |
| all | 284 deck-events | | | **0.0845** | 0.0871 | 0.1000 | 13 of 32 |

What this checks: whether ratings fitted on the other recorded games of the Hard bot playing these lists predict who reaches the top cut of a held-out event of the same bot and lists. It says nothing about human players. Each range is the 90% range across the parameter draws: what we do not know about the decks’ strength from the recorded games. It does not include model error (a matchup that differs from what the ratings and the head-to-head records say) or how people play compared with the Hard bot, so the real uncertainty is wider.

## Reading (2026-11-24)

- **Why this run replaces the one of 2026-11-18.** That backtest fitted each fold on the other events alone (about 3,270 games), with no list gate, while the page's model reads `public/data/h2h.json`, which since 2026-11-22 also pools rating run 1 (9,900 of its 14,090 games) and counts games on the library's current lists only (docs/REVIEW_2026-11-24.md L7). It also stopped on event 25, a round robin. This run reads the same pool as the page (the gate drops no game today: every recorded list is current), holds out the five plain Swiss events and lets event 25 and run 1 predict them. The old report stays as it was.
- **The headline is a little better than before, within the noise.** Brier 0.0822 over 355 deck-events against 0.1000 for "every deck 8 in 71": a skill score of 17.8% (16.1% on 2026-11-18, Brier 0.0839), with the 90% interval of the difference 0.006 to 0.031 in the forecast's favour. Per event it ran from 0.060 (event 21) to 0.107 (event 24, a little worse than the baseline). Its own top 8 held 19 of the 40 real top-8 places, as before.
- **Games recorded after a held-out event are used, on purpose.** The simulator, the bot and the lists are the same across the pool, so a later game is another independent game of the same decks: it tells the fit how strong the decks are, nothing about how the held-out event's pairings and dice went, and it is what the page does for an event still to come. The stricter version, each event from the games dated before it, cannot score event 20 and fits events 21 to 24 on 816 to 3,271 games (run 1 is dated after all of them): Brier 0.0845 over 284 deck-events against 0.1000, a skill score of 15.5%, interval 0.002 to 0.031. Both say the same thing: the ratings beat the equal-chance baseline by roughly a sixth.
- **Drawing the ratings now barely matters.** With four times the games per fold the parameter uncertainty is small: drawn 0.0822, fixed at the estimate 0.0825 (interval of the difference −0.0006 to 0.0000). On the smaller earlier-games folds the draws help more (0.0845 against 0.0871).
- **Calibration is loose in the middle, in both directions.** Decks given 2% to 10% made the cut 13 times in 123 against about 6 forecast, those given 10% to 35% 11 times in 104 against about 21, and those given 35% to 50% 13 times in 22 against about 9: 2.8, 2.4 and 1.7 binomial standard deviations from the forecast. A deck's five events are not independent (the same deck, the same rating), so these deviations are weaker evidence than they look, but they fit the review's finding that the ranges leave out real matchup spread and that held-out predictions are overconfident (L1, L11). No band was adjusted.
- **What it does not show.** As before, the held-out event is the most favourable test there is: the same lists, the same Hard bot and simulator. It says the model's mechanics are sound for our own simulated events and nothing about a regionals played by people.
- Nothing was tuned on these numbers: the model, the tournament rules and the run sizes are those of 2026-11-18.
