# Game review: validity checks for REVIEW_2026-11-25 rows 5, 10 and 11 (2026-11-25)

Measured with `scripts/review-validity.ts` (worker `scripts/review-validity-worker.ts`) on SIM_VERSION 9, with the code of
this change as it stood before the R4 verdict (mulligans not rated, both seats rated by the oracle, Sharp and Inspired
confirmed on 16 fresh worlds; the last was removed after this measurement, and with it the script's `upgrades` step). At most 4
threads; the machine was shared with other bot measurements, so times are relative (each figure compares runs made
side by side).

## The rules, written before the games were played

**Data.** `--deals 120 --seed 1`: 120 deals of two meta decks (seed 920,000 + k, first player alternating), each played
twice, once by an Easy and once by a Hard player in seat 0, against Medium in seat 1 (bot seed + 5), recorded as a
practice game and reviewed by `runGameReview` with 8 play-outs and 16 confirmation worlds.

**R4, Sharp and Inspired (row 5).** Counted on the player's seat, confirmed ratings only.
- (A) Hard earns more Sharp + Inspired per game than Easy: the paired difference per deal (Hard − Easy) has a 90%
  bootstrap interval above 0.
- (B) Not mostly in won games: for Easy and for Hard separately, the rate per won game is at most 1.5 times the rate per
  lost game (point estimates).
- (C) Inspired alone: Hard's per game at least Easy's (point estimate).
- Verdict: (A) and (B) pass → keep both, unless (C) fails, then Inspired is dropped (shown as Sharp). (A) or (B) fails
  → both dropped (the move shows as Best).

**R2, Hard's overstated flags (row 10).** Flags = confirmed Mistake-or-worse ratings of main-phase actions and reactions
with a named better move: all of the Hard players' (up to 120), and random samples of 150 of Easy's and 100 of the Medium
opponent's. For each, the truth is the win rate of the review's better move minus the move made, both played to the end
of the game with Hard on both seats (the deciding seat's hidden cards re-dealt) on 24 paired worlds.
- Design (a): each costly flag played again over the oracle's horizon with Hard on both seats, 16 fresh worlds; kept
  when that gap is still at least 0.375 Gigs and outside 2 SE, else dropped. Design (a'): the same, applied only to
  seats with at most 2 such flags (a cost cap; other flags kept as they are).
- A design is adopted only if all hold: (1) the flags it keeps gain more than the ones it drops (kept − dropped, 90%
  bootstrap interval above 0); (2) of the flags whose own gain is clearly positive (gain − 1.645 SE > 0), it keeps more
  than half; (3) the review's time per game grows by at most 50% (median over the games, every costly flag of both
  seats priced at the measured time per Hard confirmation).
- If neither passes: ship (b), the wording: a lone costly flag (the seat's only Mistake or worse, the seat's other counted
  moves at accuracy 90 or more) is marked as uncertain, in words the measured gains allow.

**R6, late-game misses (row 11).** 150 random main-phase decisions at turn 10 or later from the reviewed games. At each,
the oracle's candidates (the move made, the quick screen's top 4, passing) are played over the oracle's horizon in a pool
of 64 worlds, each scored plainly and with the start-of-turn win (`rolloutWins`), and each played to the end with the
oracle's Medium-like bots on 24 worlds. Pairs: the pooled best against each other candidate. A true error is a pooled
gap of 0.375 to 1.5 Gigs, more than 2 pooled SE; about equal is a pooled gap under 0.15 Gigs. For each method the review
is simulated 200 times per pair on worlds drawn from the pool (screening, then confirmation on other worlds when
`confirmFlag` says so, rated by `rateOracle`):
today (8 + 16 worlds), more worlds (16 + 32 from turn 10), rolloutWins (8 + 16), both.
- A method is adopted if: detection of true errors (share rated Slip or worse) at least 15 points above today's; false
  alarms on about-equal pairs at most today's + 2 points (and at most 5%, or today's + 2 if that is higher); extra
  play-outs at most 50% of a review's (doubling the late play-outs costs their share); and the pairs it flags more often
  than today gain on average when played to the end (weighted by how much more often, point estimate above 0). Among
  those that pass, the one that detects most; a tie goes to the cheaper.

## Results

**The games** (`games --deals 120 --threads 4`, 559 s): 240 games reviewed, no decision failed; Easy won 29.2% against
Medium, Hard 70.8%. Review time median 7.1 s a game, 4 in parallel (Easy's games 7.3 s, Hard's 7.0 s). Every review
confirmed 7.4 moves a game on average; those confirmations were 11% of the screening play-outs.

### R4: Sharp and Inspired (row 5): dropped

Measured while the review confirmed them: a move the screening pass rated Sharp or Inspired had every candidate played
again on 16 fresh worlds (from the confirmation stream), and kept its rating only if those worlds showed it too.

| Player | games | nominated / game | confirmed Sharp / game | confirmed Inspired / game | both / game, won games | both / game, lost games |
|---|---|---|---|---|---|---|
| Easy (seat 0) | 120 | 0.33 | 0.15 | 0.10 | 0.37 (35 games) | 0.20 (85) |
| Hard (seat 0) | 120 | 0.84 | 0.57 | 0.16 | 0.74 (85) | 0.71 (35) |
| Medium (seat 1) | 240 | 0.02 | 0.02 | 0.00 | 0.02 (120) | 0.03 (120) |

- (A) Hard − Easy, Sharp + Inspired per game: +0.48 [90% 0.35, 0.62] over 120 deals: **pass**.
- (B) Easy: 0.37 a won game against 0.20 a lost one, ratio 1.86: **fail**; Hard: 0.74 against 0.71, ratio 1.04: pass.
- (C) Inspired: Hard 0.16 a game, Easy 0.10: pass.
- **Verdict: both dropped** (the rule: (A) and (B) must both pass). Confirmed, they now follow skill (Hard about three
  times Easy, Inspired too, unlike the review's unconfirmed figures), but for Easy they still come nearly twice as often
  in won games, so they say as much about the position as about the play. Easy's won games are few (35), so (B) is the
  less certain half; the rule was kept as written. Medium never earns them (its moves are the quick read's own picks).
- The confirmation kept 87% of Hard's nominations and 76% of Easy's. Dropping them also drops its cost (1.8% of the
  screening play-outs here).

### R2: Hard's overstated flags (row 10): design (a') adopted

`flags --threads 4` (2,150 s): of the confirmed Mistakes and Blunders of main-phase actions and reactions with a named
better move (Hard players' 105, Easy's 459, the Medium opponent's 712), all of Hard's and random samples of the others,
355 measured, 290 usable (65 skipped: the better move's label not found among the options, an unknown Call, or the same
move). Gain = the review's better move's win rate minus the move made's, played to the end with Hard on both seats, 24
paired worlds.

| Flags of | n | gain with Hard to the end (points) | lone flags: n, gain | other flags: gain |
|---|---|---|---|---|
| Hard player | 88 | 5.9 ± 1.8 | 33, 6.7 ± 2.3 | 5.5 ± 2.5 |
| Medium opponent | 79 | 4.9 ± 1.8 | 4, −2.1 ± 3.6 | 5.2 ± 1.9 |
| Easy player | 123 | 13.8 ± 1.9 | 3, 12.5 ± 11.0 | 13.8 ± 2.0 |

Flags rated under 1 Gig gained 3.6 points (55 flags), 1 Gig or more 10.2 (235): the review's finding (weaker players'
flags cost more, Hard's about +5) holds on these games.

| Design | kept (gain) | dropped (gain) | kept − dropped [90%] | clearly positive kept | review time, median a game | verdict |
|---|---|---|---|---|---|---|
| (a) every costly flag checked with Hard | 173 (14.1) | 117 (1.3) | 12.9 [9.7, 16.2] pass | 83.3% of 78 pass | +262% FAIL | not adopted |
| (a') only in seats with at most 2 costly flags | 247 (10.2) | 43 (1.8) | 8.3 [4.9, 12.0] pass | 94.9% of 78 pass | +49.5% pass | **adopted** |

- By player under (a'): Hard kept 52 of 88 (kept gain 8.7, dropped 2.0), Medium 74 of 79 (5.1, 0.8), Easy 121 of 123
  (13.9, 2.1). The flags it drops are mostly a strong player's, and they gain about nothing when played on.
- The Hard check costs 4.3 s a flag here (16 worlds, both options, 4 threads in parallel on a shared machine). The time
  rule is met with almost no margin (+49.5% against at most 50%); it was priced on the measured time per check and each
  game's count of checked flags, then measured directly below.
- (b), the wording for a lone flag, is not needed and its basis is weak: lone flags gained 6.3 points, the others 9.4,
  others − lone 3.1 [−0.8, 6.9].

### R6: late-game misses (row 11): nothing adopted

`late --threads 4`: 144 positions measured (6 skipped), 391 pairs; 57.5% of the play-outs from turn 10 end the game or
reach a decided start of turn. 30 pairs are true errors of 0.375 to 1.5 Gigs, 96 larger, 250 about equal.

| Method | detects true 0.375–1.5 Gig errors | over 1.5 Gigs | false alarms (about equal) | outcome gain of pairs it flags more than today |
|---|---|---|---|---|
| today (8 + 16 worlds) | 42.0% | 88.3% | 0.0% | — |
| more worlds (16 + 32) from turn 10 | 53.3% | 88.6% | 0.0% | −2.0 [−7.1, 1.8] |
| rolloutWins (8 + 16) | 25.5% | 81.3% | 0.4% | −23.0 [−29.8, 5.6] |
| both | 36.1% | 83.1% | 0.4% | −6.3 [−16.0, 2.2] |

- More worlds: +11.3 points of detection (the rule asked 15), at +35.7% of a review's play-outs, and the pairs it flags
  more often did not gain when played to the end (−2.0 points): not adopted.
- rolloutWins: detects fewer (−16.5 points) and the pairs it flags more often lose when played on: not adopted. (Its
  detection is judged against plain-scored truth, which favours plain scoring; the outcome check does not, and it is
  negative too.)
- Detection today is 42% for late errors of 0.375 to 1.5 Gigs, far better than the review's simulated 17% (computed for
  0.5 Gigs with 4% of worlds swinging by 15 Gigs), on only 30 true pairs; the false-alarm rate is 0 for every method.

### The adopted review, measured directly (time and stability)

`npx tsx scripts/game-review-check.ts --games 12 --seed 3 --threads 4` with the final code, `--hard 16` (as shipped)
and `--hard 0` (no Hard check), the same 12 Medium-vs-Hard games, each reviewed twice with two oracle seeds:

| | review time, median (max), 4 in parallel | same rating on the re-run | within one step | Mistake or worse kept | Blunder kept | accuracy moved, mean (max) | turning point the same |
|---|---|---|---|---|---|---|---|
| Hard check off | 10.7 s (17.1) | 90.2% | 98.7% | 91% (43/47) | 81% | 2.2 (10) | 10 of 12 |
| Hard check on | 15.3 s (19.8) | 90.0% | 98.7% | 89% (39/44) | 77% | 3.2 (35) | 9 of 12 |

The Hard check costs +43% of the median review here (within the +50% the task allowed). It drops a few of the strong
seat's flags (Hard rival: Mistakes 2 → 1, Blunders 7 → 6 over 12 games) and makes the costly ratings slightly less
stable on a re-run, because whether a seat has at most 2 of them, and the Hard check's own worlds, both move with the
oracle seed.

## Row 6: what a rating costs in win chance (2026-11-25)

Measured with the `coach` and `costs` steps of `scripts/review-validity.ts` on the same 240 games (`games --deals 120
--seed 1`, played again and reviewed with today's review: REVIEW_RULES and REVIEW_MEASURE 4, mulligans not rated, the
Hard check of a seat's 1 or 2 Mistakes and Blunders), SIM_VERSION 9, at most 4 threads.

### The rule, written before the measurements

**Data.** Costly ratings = every Slip, Mistake and Blunder of a main-phase action or a reaction with a named better
move, of both seats (the Easy and Hard players in seat 0, the Medium opponent in seat 1): by the Game review as stored,
and by the coach as the Play page grades a person's move (advice, the move scored, a costly or wide close grade
confirmed on 16 fresh worlds: `gradeFully`), asked at every such decision of both seats. A coach Mistake with a gap of 1
Gig or more is its Blunder (`verdictRating`). The truth of one rating: the recommended move's win rate minus the move
made's, both played to the end of the game with Hard on both seats (the deciding seat's hidden cards re-dealt) on paired
worlds (16 for new measurements; 24 where the `flags` step above already measured the same position and move, which is
reused). Samples: in each (instrument, band, player) stratum a random sample of up to 60 ratings (fewer when the games
have fewer).

**The figure.** A band's figure is the mean gain over every rating of that band in these games, estimated by strata
(player type, weighted by its share of the band's ratings), with the stratified standard error and a 90% interval
(±1.645 SE). Shown to players: the figure rounded to a whole point, as "about N% win chance on average", with the
measurement named (the Hard bot playing on to the end, the date); a band whose 90% interval includes 0 is shown as
"often costs nothing measurable" and no figure. The coach's bands and the review's are measured and shown apart. By
game stage (turns 1–4, 5–9, 10 on) the same estimate over Mistakes and Blunders together, for information only: a stage
is not given its own words unless every band is measured within ±3 points there.

### Results

`coach --threads 4` (240 games, both seats: 12,976 moves graded, 95.8 ms each on 4 threads; agree 3,614, Best 579, Close
call 533, No clear difference 6,155, Slip 57, Mistake 286, Blunder 1,163, not measured 589) and `costs --threads 4
--truth 16 --per-stratum 60 --reuse <the flags run>` (1,511 s): 2,734 costly ratings of actions and reactions with a
named better move (1,863 positions and moves), 549 sampled positions measured on 16 worlds, plus the `flags` step's
24-world measurements of those in the sample; 165 sampled positions could not be played both ways (all but 5 a Call of
a face-down Legend, as the move made or the better one), so the figures do not cover such ratings. The games are the
report's games (the same win rates); today's review gave 54 Slips, 199 Mistakes and 975 Blunders there, and an accuracy
of 65.5 (Easy), 75.9 (Medium, seat 1) and 95.3 (Hard) on average.

| Rated by | Band | ratings in the games | measured | mean rated gap (Gigs) | gain with Hard to the end (points) | 90% interval | by player: measured/all mean | shown as |
|---|---|---|---|---|---|---|---|---|
| coach | slip | 57 | 38 | 0.28 | 1.4 ± 1.2 | [-0.5, 3.3] | easy 12/22 -3.6, medium 24/32 5.3, hard 2/3 -3.1 | often costs nothing measurable |
| coach | mistake | 286 | 116 | 0.72 | 1.6 ± 1.3 | [-0.6, 3.8] | easy 38/91 7.4, medium 47/144 -0.8, hard 31/51 -1.9 | often costs nothing measurable |
| coach | blunder | 1163 | 143 | 3.93 | 8.4 ± 1.8 | [5.4, 11.5] | easy 45/406 9.5, medium 48/662 7.8, hard 50/95 8.5 | about 8 points |
| review | slip | 54 | 34 | 0.27 | 0.2 ± 1.3 | [-1.9, 2.4] | easy 12/26 -1.0, medium 17/21 1.8, hard 5/7 0.0 | often costs nothing measurable |
| review | mistake | 199 | 98 | 0.71 | 1.2 ± 1.7 | [-1.5, 4.0] | easy 44/76 2.4, medium 44/111 -0.9, hard 10/12 13.1 | often costs nothing measurable |
| review | blunder | 975 | 148 | 3.82 | 10.1 ± 1.7 | [7.3, 12.8] | easy 52/375 12.9, medium 53/548 8.3, hard 43/52 8.6 | about 10 points |

(± is the stratified standard error; "measured/all" the sampled ratings with a measurement against the ratings of that
player in the band.) By game stage, Mistakes and Blunders together:

| Rated by | stage | ratings | measured | gain (points) | 90% interval |
|---|---|---|---|---|---|
| coach | early (turns 1–4) | 193 | 42 | 3.7 ± 3.6 | [-2.2, 9.6] |
| coach | middle (5–9) | 910 | 164 | 5.5 ± 1.4 | [3.1, 7.8] |
| coach | late (10 on) | 346 | 53 | 6.1 ± 2.5 | [2.0, 10.1] |
| review | early | 164 | 39 | 10.5 ± 3.6 | [4.7, 16.4] |
| review | middle | 727 | 155 | 2.6 ± 1.4 | [0.3, 4.9] |
| review | late | 283 | 52 | 11.9 ± 3.3 | [6.5, 17.3] |

- **Only Blunders show a cost**: about 8 points of win chance for the coach's, 10 for the review's (90% intervals
  [5.4, 11.5] and [7.3, 12.8]). Slips and Mistakes, though clearly behind in the play-outs of a turn or so, cost nothing
  these samples can tell from 0 (the review's Mistakes 1.2 [−1.5, 4.0]); by the rule they are shown as "often costs
  nothing measurable", with no figure. Each band's 90% half-width is 1.9 to 3.1 points, near the ±3 asked; the Slip bands
  are small (54 and 57 in the games) and were measured nearly whole.
- The size within a band says little: the Mistake bands' gaps (0.7 Gigs on average) cost about 1 to 2 points, the
  Blunder bands' (3.8 to 3.9 Gigs, uncapped) 8 to 10, against the 4 points per Gig of REVIEW_2026-11-25 §2.
- By stage the figures do not settle within ±3 points (the rule's bar for words of their own), so no stage is worded
  apart. The review's middle game (2.6 [0.3, 4.9]) sits below its early and late games (10.5 and 11.9).
- **Shown** (`src/lib/ratingCost.ts`, pinned to this table by `tests/rating-cost.test.ts`): the coach's toast "Mistake:
  the coach preferred X (checked on 16 fresh play-outs; moves rated Mistake often cost nothing measurable)", "Blunder: …
  (…; moves rated Blunder cost about 8% win chance on average)"; the review's move line "The review preferred X. Moves
  the review rates Blunder cost about 10% win chance on average when the Hard bot played on from them to the end
  (measured 2026-11-25)."; the legend, the turning point, the scorecard's and Play-out details' notes the same. Before,
  each said the gap in Gigs ("about 0.9 Gigs better", "−0.6 ± 0.1 Gigs").
