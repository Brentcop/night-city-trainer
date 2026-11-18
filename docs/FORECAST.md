# The regionals forecast

ROADMAP2 §13 goal 5, last bullet: "the expected field, each deck's chance to make a top cut of a given size, and the matchups that decide it, each number with its range and its source". Built 2026-11-18.

- Engine: `src/lib/forecast.ts` (pure, seeded; no engine, bot or sim code). Field input: `src/lib/forecastField.ts`. Sentences: `src/lib/forecastWords.ts`.
- Page: `#/forecast`, Tournaments → Regionals forecast (`src/ui/pages/Forecast.tsx`, lazy), behind the feature `forecast`, **off by default** (docs/SITE_CONFIG.md).
- Command line: `npx tsx scripts/forecast.ts [--players 128] [--rounds N] [--best-of 3] [--top 8] [--field uniform|outside[:id]|FILE] [--trials 300] [--draws 100] [--seed 1] [--json]`. It writes nothing.
- Backtest: `npx tsx scripts/forecast-backtest.ts [--out FILE]`; the run of 2026-11-18 is `reports/forecast-backtest-2026-11-18.md`.
- Tests: `tests/forecast.test.ts` (the Swiss port, the match maths, the model, the limits), `tests/forecast-field.test.ts`, `tests/forecast-ui.test.tsx`.

**What it is, in one sentence:** a forecast from our simulated ratings under the Hard bot and the field you chose, not a prediction of human results.

## The model in plain words

1. **How strong each deck is** comes from the power ratings and head-to-heads of the recorded events (today events 20 to 24, 4,084 games, simulator v9, Hard bot), read from `public/data/h2h.json`, the file the deck pages and the Deck Lab read. A deck's chance to win one game against another is the head-to-head estimate: what the ratings predict for the pairing (both seats averaged), plus the pair's own record shrunk toward that prediction (`src/lib/h2hModel.ts`, the same number `h2hFileLookup` gives). A pairing that never met gets the prediction alone. On today's file the pairs spread no more than chance around the ratings, so the shrinkage weight is at its ceiling (1,000 games) and a pairing's estimate is, in practice, the ratings' prediction.
2. **A match**: game 1's seat is a coin flip and the loser of a game goes first in the next, as in our events. The seat-averaged chance is split into a chance on the play and on the draw with the fitted going-first term (worth about 7.8 points of win probability). Games are independent; game ties are not modelled.
3. **The field**: each of the N players draws a deck from the field's weights, independently (so a deck weighing 2% is played by 2% of the players on average, and sometimes by none).
4. **The tournament** is played the way our events are: Swiss rounds with 3 points a match win and a bye counted as a win, players paired within their point group in a random order with no avoidable rematch (the same backtracking search as `swissPairings`), the bye to the lowest-ranked player without one; standings by points, then opponents' match-win % (each floored at a third, byes left out), then game-win % (floored at a third). The top K make the cut and play it out as single elimination, seeded 1 v K, for a title chance. The port was checked against the recorded events: every pairing, bye and standings row of events 20 to 24 replays exactly (`tests/forecast.test.ts`). The one difference: inside a point group the simulation shuffles the players instead of sorting them by a random key; both give a uniformly random order, so they agree in distribution, and the test uses the original rule.
5. **Each number** is counted over many such tournaments: the chance a single player with the deck makes the cut ("conversion"), the chance at least one does, the deck's expected share of the cut's seats, and its title chance.

Defaults (all parameters): 128 players, ⌈log₂ N⌉ Swiss rounds (7 for 128: enough for one undefeated player; a regionals may run more), best of 3, top 8, 100 parameter draws × 300 tournaments, seed 1. The page answers a default forecast in about 3 to 4 seconds and can be stopped; the command line takes about 3 seconds.

## What the ranges mean

Each figure carries a 90% range. The run draws the ratings and the going-first term 100 times from a normal with the full covariance of the rating fit (the same covariance behind the power ratings' 90% ranges), recomputes every pairing's estimate from each draw, adds each pair's own deviation from its beta-binomial posterior, and plays 300 tournaments under each draw. The central figure is the mean over the draws; the range runs from the 5th to the 95th percentile of the per-draw figures.

- **It is parameter uncertainty**: what the recorded games leave unknown about the decks' strength.
- **It includes a little sampling noise** of the 300 tournaments a draw (the page and the command line say how much: on the default forecast about 12% of the spread, median over decks), so it is slightly wider than parameter uncertainty alone, never narrower.
- **It does not include model error**: a matchup that really differs from what the ratings and records say, lists that change, or anything the Bradley–Terry picture misses.
- **It does not include how people play.** Every number is about the Hard bot playing these lists. Human players misplay, pilot some decks better than others, and bring lists we do not have.

So the real uncertainty about a regionals is wider than any range shown, by an amount nothing here measures.

## The field

Always an input, never a hidden assumption; the page and the command line name it, its source and how much of it was left out.

- **Uniform** (the default): every rated library deck equally often. Labelled "assumed (no information about what people play)".
- **Your field**: `deck name: weight` lines (the weight after the last colon, since deck names hold colons; `=` or a tab also work; `%` allowed; weights are relative), in the page's box or a text file; or JSON on the command line (`{ "weights": { "<deck>": 3 } }`, the object alone, or `[{ "deck": "<deck>", "weight": 3 }]`, with an optional `label` and `source`). Decks not named weigh 0. A name that is not a rated deck is listed as left out with its share.
- **An outside source's shares**, only when `src/data/outsideMeta.json` is in the build (it is not committed today, ROADMAP2 §13 goal 4): each library deck weighs its Legend trio's share split equally among our decks of that trio (`outsideFieldShares`, an assumption: the sites count trios, not lists). Trios we do not play, the part of the source's field it does not break down by trio, and library decks without a rating are left out. Tested on invented data only.

**Left out means left out.** We have no rating for a deck we never recorded, so the forecast does not invent a stand-in "average" deck for the unplaced players; it renormalises the placed part. Reading the result that way assumes the left-out players do not change whom the placed decks meet. With a large left-out share, read every number as conditional on that.

## What decides it

For each deck, the opponents whose share of the field moves its conversion most, worst first, each with the deck's chance to win a match against it and that chance's 90% range. The figure is a first-order estimate, not a re-run: +5 points of an opponent's share adds meetings with it in proportion to how often the deck meets it in the Swiss rounds (measured in the simulation, so strong decks meeting strong decks at the top tables counts), each extra meeting replaces one with the deck's average other opponent, and a match win is worth what the simulation says one more match win is worth for making the cut. With today's ratings, where pairings follow the ratings (point 1 above), the opponents that decide a strong deck's cut are simply the other strong decks it meets at the top tables; a real counter-matchup would show only once the head-to-head records spread beyond chance.

## Backtest (2026-11-18)

Each of events 20 to 24 was forecast from ratings and head-to-heads fitted on the other four only, on its own field (71 entrants, each once) and format (Swiss 9 rounds, best of 3, top 8); the predicted chance of each deck to make the top 8 was compared with whether it did. Full tables: `reports/forecast-backtest-2026-11-18.md`.

- Brier score 0.0839 over 355 deck-events against 0.1000 for "every deck 8 in 71": a skill score of 16%; the 90% interval of the difference (resampling decks) is 0.004 to 0.029 in the forecast's favour. Per event the forecast scored between 0.059 (event 21) and 0.099 (event 24, about the baseline).
- The forecast's own top 8 held 19 of the 40 real top-8 places (an equal chance would give about 4.5).
- Calibration: decks given under 2% made the cut 1 time in 127; the 20% to 35% band made it 4 times in 39 against about 10 expected, the 35% to 50% band 9 in 16 against about 6.5: one band of seven about two standard deviations off, which chance often gives.
- Drawing the ratings instead of fixing them at their estimate improved the score slightly (0.0839 against 0.0850; interval of the difference excludes zero).
- What it shows: the mechanics work for predicting our own simulated events, in the most favourable test there is (same lists, same bot, same simulator). It does not show anything about a regionals played by people. Nothing was tuned on it.

## Limits and what is not modelled

- Human play, human lists and sideboards; decks we have not rated.
- Game ties, intentional draws, drops, a player who plays more than once (each player is independent).
- Pair-specific matchups beyond what the shrunk head-to-heads hold (today: essentially none).
- Rounds and cut: the format is yours to set; a regionals with day-2 cuts or different tie-breaks would need its own rules.
- The field: we do not have a measured picture of what people play (the sim site's shares are not in the repository; choom.gg gives no shares). Every forecast is conditional on the field it names.
- The ranges for decks with few players in the field (say under one expected player) rest on few player-events per draw and carry more sampling noise; the noise share says so.
