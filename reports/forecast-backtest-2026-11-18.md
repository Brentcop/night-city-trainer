# Regionals forecast: backtest on our recorded events

Each recorded event of the current pool (sim v9, hard bot: events 20, 21, 22, 23, 24) forecast from the ratings and head-to-heads fitted on the OTHER events only, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. 100 parameter draws × 300 tournaments per event (seed 1 + the event id); 44 s. Baseline: every deck has the same chance, cut / entrants.

**Result.** The forecast scores better than the baseline: its Brier score is lower by 0.0161 (90% interval of the difference 0.0043 to 0.0292), a Brier skill score of 16.1%.

| Event | Entrants | Format | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top 8 that made the cut |
|---|---|---|---|---|---|---|
| 20 | 71 | Swiss 9 Bo3, top 8 | 0.0945 | 0.0961 | 0.1000 | 3 of 8 |
| 21 | 71 | Swiss 9 Bo3, top 8 | 0.0589 | 0.0580 | 0.1000 | 6 of 8 |
| 22 | 71 | Swiss 9 Bo3, top 8 | 0.0714 | 0.0709 | 0.1000 | 5 of 8 |
| 23 | 71 | Swiss 9 Bo3, top 8 | 0.0963 | 0.0995 | 0.1000 | 3 of 8 |
| 24 | 71 | Swiss 9 Bo3, top 8 | 0.0986 | 0.1007 | 0.1000 | 2 of 8 |
| all | 355 deck-events | | **0.0839** | 0.0850 | 0.1000 | 19 of 40 |

Brier skill score against the baseline: 16.1% (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the 71 decks: -0.0292 to -0.0043). With the ratings fixed at their estimate instead of drawn: Brier 0.0850 (difference forecast minus fixed, 90% interval -0.0019 to -0.0004).

**Calibration** (every deck-event, by the forecast chance):

| Forecast chance | Deck-events | Mean forecast | Made the cut | Rate |
|---|---|---|---|---|
| 0.0% to 2.0% | 127 | 0.6% | 1 | 0.8% |
| 2.0% to 5.0% | 49 | 3.3% | 4 | 8.2% |
| 5.0% to 10.0% | 49 | 7.4% | 4 | 8.2% |
| 10.0% to 20.0% | 59 | 14.0% | 10 | 16.9% |
| 20.0% to 35.0% | 39 | 26.0% | 4 | 10.3% |
| 35.0% to 50.0% | 16 | 40.9% | 9 | 56.3% |
| 50.0% to 100% | 16 | 56.0% | 8 | 50.0% |

What this checks: whether ratings fitted on four events of the Hard bot playing these 71 lists predict who reaches the top cut of a fifth event of the same bot and lists. It says nothing about human players. Each range is the 90% range across the parameter draws: what we do not know about the decks’ strength from the recorded games. It does not include model error (a matchup that differs from what the ratings and the head-to-head records say) or how people play compared with the Hard bot, so the real uncertainty is wider.

## Reading (2026-11-18)

- **Better than the baseline, by a modest margin.** Over the 355 deck-events the forecast's Brier score is 0.0839 against 0.1000 for "every deck 8 in 71", a skill score of 16%, and the 90% interval of the difference (resampling decks) stays below zero. Its own top 8 held 19 of the 40 real top-8 places over the five events, where an equal chance would expect about 4.5; per event it ranged from 2 of 8 (event 24) to 6 of 8 (event 21), and events 20, 23 and 24 were close to the baseline. One Swiss event of 9 rounds is noisy: a deck the ratings rate best still misses the cut about half the time.
- **Calibration is reasonable at the ends and loose in the middle.** Decks given under 2% made the cut 1 time in 127; the 10% to 20% band made it at 17% (14% forecast). The 20% to 35% band made it 4 times in 39 against about 10 forecast (26%: about 2.2 binomial standard deviations low), and the 35% to 50% band 9 times in 16 against about 6.5 (1.3 high). With 16 to 127 deck-events a band, one band of seven at about two standard deviations is what chance often gives, so this does not show miscalibration, nor rule it out; no band was adjusted.
- **Drawing the ratings helps a little.** The same forecast with the ratings fixed at their estimate scores 0.0850; the difference is small (0.0004 to 0.0019 in favour of the draws) but its interval excludes zero, so averaging over the ratings' uncertainty makes the chances slightly better calibrated, not worse.
- **What it does not show.** The held-out event is the most favourable test there is: the same 71 lists, the same Hard bot and simulator, games independent of the training games. It says that the model's mechanics (ratings, Swiss, cut) are sound for predicting our own simulated events. It says nothing about how well the same numbers predict a regionals played by people with lists that differ from ours, which is the forecast page's real use; nothing here measures that.
- Nothing was tuned on these numbers: the model, the tournament rules and the run sizes were fixed before the backtest ran, and the script is a check.
