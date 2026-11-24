# A rating series the site runs by itself

Design study for ROADMAP2 §13 goal 5, bullets 1 to 3 (a field weighted by the outside meta, a series with a stopping
rule, new decks rated on arrival), written 2026-11-18. Every number below was measured or simulated on that day; the
ones marked *estimate* were not measured. The commands that reproduce each table are at the end.

**Status.** Stages 0 and 1 are built (2026-11-18, the first chunk; "Run files" and "Pooled by list" under The design
say how, and what changed from the plan): run files are read beside the events, games count only on the library's
current lists, `check:data` validates run files, and the test suite no longer pins recorded figures (checked with a
10,000-game run added in a scratch checkout). Stages 2 and 3 are built (the same day, the second chunk: "The command"
and "The owner's switches" under The design, with "What the workflow needs from it"). Stage 4, the scheduled workflow,
is built ("Running by itself", the third chunk) and has not yet run on GitHub; the owner's decisions of 2026-11-18 (relayed by the dispatcher): width ±4,
switches on by default once they exist, pool by list. The real-field column and the runner's weighted match list
(stages 5 and 6) are not in this build.

## The recommendation

1. **The rule.** The series plays until **every deck's 90% range on its expected win rate against our field is at
   most ±4 points** (the widest half-width of `wrFieldLo`–`wrFieldHi` in `src/data/ratings.json`, over the decks of
   the series field), then stops and says how many games it took. ±4 is the widest round width at which a range can
   never touch three Sim-tier letters (the bands are 9 and 10 points wide), so a letter is right or one band off.
2. **The games.** "Widest first": the deck whose expected range is widest takes the next 10 games (best of one,
   seats alternating) against the opponent it has met least, ties broken by a seeded random draw; the expected
   ranges are updated after every pick and the ratings refitted every 300 games. The opponent is never chosen by
   rating. In simulation this kept the 90% ranges at 89.9 to 90.8% coverage when the rule stopped, the same as full
   Swiss events, for 9% fewer games than Swiss events and 10% more than the existing greedy planner, whose ranges
   covered 87.8 to 89.4% at ±4 because it pairs by the estimated ratings.
3. **New decks need no mechanism of their own.** A deck with no games has the widest range of all, so the same rule
   plays it first: about 130 of its own games bring it to ±7 (today's ranges are ±4.9 to ±7.4) and 250 to ±5. "Needs rating"
   is read off the data, never off how the deck arrived: no pooled game on the current simulator version and bot,
   or a range wider than the target.
4. **The record.** A run's games go into a file of a new kind, `data/series/run-<n>.json` (the event shape of a match
   list, not served), which ratings, head-to-heads and the evidence builder pool beside the events; it is not an
   event, so the Tournaments page, the events index and the search pack's event records do not grow. One event per
   run would push the site search past its 300 kB budget before ±4 is reached (measured: 310.7 kB).
5. **Unattended.** A scheduled GitHub Actions workflow (daily, plus a button) reads the owner's switch in
   `public/site-config.json`, decides in a minute or two whether anything is needed, checks that the code still
   plays the recorded games, plays within a time budget, rebuilds ratings, head-to-heads and evidence, runs every
   check the deploy runs, and only then commits to `main` and starts the deploy. A run that stops at its budget
   says so; the next run continues, because the decision is always recomputed from the committed data.

The five numbers that matter most:

| | |
| --- | --- |
| Today's widest 90% half-width (71 decks, events 20 to 24, 4,084 games) | **7.44 points** (median 7.07, narrowest 4.90) |
| Games from today to ±4 under the recommended rule (simulation, median of 10) | **9,600** (±5: 4,500; ±3: 20,100) |
| Coverage of the 90% ranges when the rule stops at ±4 (simulation, 90 runs, three truths) | **90.0 to 90.8%** |
| Hard games per second, this machine, 4 worker threads (measured) | **5.8** (4 vCPU runner: 1.5 to 3.5, *estimate*) |
| Site search first-search files after ±4 with run files (measured on a synthetic 10,000-game series, 2026-11-18) | **286.2 of 300 kB** (±3: about 329, *estimate*, over) |

## What "under a chosen width" means (Q1)

- **The figure.** The 90% range that `ratings.json` already stores for each deck: its expected win rate against our
  field (every library list once, the Hard bot, the current simulator version), drawn from the full covariance of
  the fit (`fieldInterval` in `src/lib/ratingModel.ts`). Half-width = (`wrFieldHi` − `wrFieldLo`) / 2.
- **The target.** The widest half-width over every deck of the series field. The mean hides the worst deck; a
  tier-weighted target ("settle the letters near a boundary", the planner's default `--target tiers`) never got
  every deck under ±4 within 45,000 games in simulation (it keeps spending on the decks near a boundary), and its
  own aim ("every range under W or clear of every boundary") took 11,700 games at ±4, against 9,600 for widest
  first and 8,700 for the width planner aiming at the plain widest range.
- **The default width: ±4.** The Sim-tier bands are S ≥ 64, A 55–64, B 45–55, C 36–45, D below (9, 10 and 9 points
  wide). A range of total width 8 cannot reach a third band; at ±5 (total 10) it can. Below ±4, each point costs a
  lot more: ±5 needs 4,500 more games, ±4 9,600, ±3 20,100 (and ±3 breaks the search budget, see Q4).
- **What the rule guarantees.** That when the series says "done", every deck's 90% range is at most ±W wide. That is
  all: it is a precision rule, not a test, so stopping on it does not bias the estimates (the width depends on how
  many games were played and against whom, hardly on who won), and the simulated ranges kept their coverage at the
  stop (next section). **It does not guarantee** that every range holds its deck's true figure: each range is a 90%
  range on its own, so on average about 7 of 71 decks sit outside theirs at any time (6.5 to 7.4 in simulation, up
  to 16 in one run). The model has no matchup term: a pairing's true win rate sits about 6.4 points (SD) from the
  ratings' prediction (`npm run evidence -- --matchup-check`), which widens a deck's honest range against the
  whole field by only about ±1.3 points in quadrature (7.07 → 7.17 today) but would matter more for a narrow field
  (Q6). And the figure is the Hard bot's play on the current simulator version against our library: not human play,
  not the regionals field.

## Evidence

All simulations use the fitted ratings of events 20 to 24 as the truth (71 decks, h = 0.314 on the logit scale),
the same model as `scripts/ratings.ts` (a copy of `fitRatings` on aggregated cells, checked equal to it to 2e-16),
and draw every game from that truth. "Perturbed truths": **posterior** (the ratings redrawn from the fit's
covariance), **spread13** (every rating × 1.3), **pair26** (an antisymmetric matchup effect of SD 0.26 on the
logit scale added to every pairing, about the 6.4-point pair spread measured above; the model does not know it).

### E1. Games from today to each width (Q1, Q2)

Start: the 4,084 recorded games. Extra games until the widest half-width is at most 5 / 4 / 3 points; median (range)
over 10 runs (5 for the perturbed truths). Batch = games between refits.

| Allocation | ≤5 | ≤4 | ≤3 |
| --- | --- | --- | --- |
| **Widest first, one pick at a time, least-met opponent, random ties** (recommended) | 4,500 (4,500–4,800) | 9,600 (9,300–9,600) | 20,100 (20,100–20,400) |
| Widest first, batch of 30 picks, least-met opponent, random ties | 4,800 | 9,600 (9,600–9,900) | 20,100 (20,100–20,700) |
| Widest first, least-met opponent, nearest rating breaks ties | 4,500 (4,200–4,500) | 9,450 (9,300–9,600) | 20,100 (19,800–20,400) |
| Greedy planner `planExtraGames` target width, batch 100 | 4,150 | 8,600 | 18,450 |
| Greedy planner target width, batch 300 | 4,200 | 8,700 | 18,600 |
| Greedy planner target width, batch 800 | 4,800 | 8,800 | 19,200 |
| Greedy planner target tiers (today's default), batch 300 | 36,150 | not reached by 45,000 | not reached |
| Full-field Swiss events (9 rounds Bo3 + top 8, about 815 games each) | 5,688 (4,889–5,708) | 10,573 (10,551–10,603) | 21,527 (21,098–21,974) |
| Random pairings, 10 games each | 8,100 (7,500–10,200) | 14,850 (13,200–16,500) | 28,200 (25,200–32,100) |
| Greedy planner, width, batch 300, posterior / spread13 / pair26 truth | 4,200 / 4,200 / 4,200 | 9,000 / 8,400 / 8,700 | 18,600 / 17,400 / 18,600 |
| Swiss events, posterior / spread13 / pair26 truth | 5,641 / 4,835 / 5,669 | 10,525 / 9,697 / 10,519 | 21,047 / 20,931 / 21,913 |

The planner's tiers target weighs each deck by how close it sits to a boundary in its own standard deviations
(`npx tsx scripts/rating-plan.ts --target tiers` prints the weights): today most decks weigh 0.96 to 1.00, but a deck
far from every boundary weighs almost nothing and is never narrowed, so "every deck under ±4" is never reached. For
the width target the planner's own comparison shows how little it gains over an even spread: the even spread needs
9% more games than its plan of 400 (444; 23% more for the tiers target).

### E2. Coverage when the rule stops (Q2)

The start is the recorded pairings of events 20 to 24 with every outcome redrawn from the truth, so the start agrees
with the truth; then each allocation plays until the widest half-width is ≤5, ≤4, ≤3. Coverage = the share of the
71 decks whose 90% range holds its true expected win rate; mean over 30 runs per cell, and the same 30 starts for
every allocation (paired).

| Allocation | truth | at the start | stop at ≤5 | ≤4 | ≤3 |
| --- | --- | --- | --- | --- | --- |
| Widest first, one pick at a time (recommended) | fit | 90.1% | 90.8% | 90.8% | 90.7% |
| | posterior | 91.5% | 90.7% | 90.0% | 89.9% |
| | pair26 | 89.8% | 90.3% | 90.0% | 90.1% |
| Swiss events | fit | 90.1% | 90.5% | 89.6% | 89.2% |
| | posterior | 91.5% | 91.1% | 91.5% | 90.4% |
| | pair26 | 89.8% | 89.6% | 89.3% | 88.6% |
| Greedy planner, width, batch 300 | fit | 90.1% | 88.8% | 89.4% | 90.0% |
| | posterior | 91.5% | 89.0% | 89.1% | 89.4% |
| | pair26 | 89.8% | 87.9% | 87.8% | 87.3% |
| Widest first, nearest rating breaks ties | fit / posterior / pair26 | | 89.4 / 90.3 / 88.0% | 89.2 / 90.6 / 89.5% | 89.5 / 91.1 / 89.3% |

Paired differences over the 90 runs (points of coverage, ± one standard error):

| | ≤5 | ≤4 | ≤3 |
| --- | --- | --- | --- |
| widest first − Swiss | +0.19 ± 0.51 | +0.14 ± 0.54 | +0.83 ± 0.56 |
| widest first − greedy planner | +1.99 ± 0.51 | +1.52 ± 0.57 | +1.28 ± 0.55 |
| greedy planner − Swiss | −1.80 ± 0.53 | −1.38 ± 0.59 | −0.45 ± 0.52 |

Decks outside their range when the rule stops at ±4: 6.5 to 7.1 on average with widest first (at most 11 in a
run), 7.4 with Swiss events (at most 16), 7.5 with the planner (at most 14). At small samples: a newcomer's range at its first
20 games is about ±15.5 points and held its true figure in 80 to 98% of 40 runs per design (E4).

The greedy planner's shortfall comes from choosing pairs by the estimated ratings (an adaptive design reads its own
noise). The widest-first rule reads the ratings only to rank the ranges, and its opponent choice reads none: with
"nearest rating breaks ties" its coverage fell to 72 to 83% from a cold start (E3), and with random ties it held.

### E3. After a simulator-version bump (Q7)

Ratings pool only the newest simulator version and bot, so a bump starts from no games. From an empty pool, games
until the widest half-width is ≤7 / 6 / 5 / 4, and the coverage at each stop; median of 20 runs.

| Allocation | truth | games to ≤7 / ≤6 / ≤5 / ≤4 | coverage at ≤7 / ≤6 / ≤5 / ≤4 |
| --- | --- | --- | --- |
| **Widest first, one pick at a time** | fit | 4,800 / 6,300 / 9,000 / 13,800 | 91.3 / 90.3 / 90.7 / 90.8% |
| | pair26 | 4,800 / 6,300 / 9,000 / 13,800 | 88.7 / 87.8 / 87.8 / 88.7% |
| Swiss events only | fit | 4,887 / 6,523 / 9,749 / 14,633 | 88.9 / 89.4 / 90.7 / 89.6% |
| | pair26 | 4,862 / 6,507 / 9,733 / 14,592 | 89.9 / 88.7 / 89.2 / 89.4% |
| 4 Swiss events, then widest first (nearest-rating ties) | fit / pair26 | 4,458 / 5,955 / 8,379 / 13,727 | 89.2 / 87.3 / 88.7 / 89.2% and 87.0 / 86.5 / 87.3 / 89.2% |
| Greedy planner only | fit | 4,500 / 5,700 / 8,400 / 12,900 | 84.6 / 83.6 / 86.1 / 86.9% |
| 2 Swiss events, then the greedy planner | fit / pair26 | 4,330 / 5,819 / 8,237 / 12,743 | 86.3 / 87.3 / 87.5 / 89.6% and 84.2 / 82.9 / 83.2 / 84.5% |
| Widest first, nearest-rating ties (batch) | fit / pair26 | 5,100 / 6,300 / 8,700 / 13,500 | 79.0 / 78.4 / 83.2 / 87.0% and 72.5 / 71.6 / 76.5 / 84.9% |

So the series needs no separate bootstrap: the same rule from an empty pool reaches ±7 (today's state) in about
4,800 games and ±4 in about 13,800, with its ranges as honest as Swiss events'. Time: 13,800 games is 40 minutes on
this machine at 4 threads and 1.1 to 2.6 hours on a 4 vCPU runner (*estimate*, E5), so one or two scheduled runs.

### E4. A new deck (Q3)

The 71 decks keep their recorded games; a 72nd deck with a true rating drawn from N(0, 0.6²) (the spread of today's
ratings) arrives with none. 40 runs per design and truth (no pair effect / pair26). "Its games" = the newcomer's;
"total" = every game played.

| Design | its games to ≤7 / ≤5 / ≤4 | total games | opponents met by ≤5 | its range held the truth at ≤7 / ≤5 / ≤4 | others' Sim-tier letters moved by ≤5 (median, range) |
| --- | --- | --- | --- | --- | --- |
| Targeted: greedy on its own variance, its pairings only | 120 / 240 / 380 | the same | 24 | 85–88 / 85–95 / 90–95% | 4 (1–8) |
| Nearest-rated opponents, least met first | 120–130 / 250 / 395–400 | the same | 19–20 | 90–93 / 88–93 / 90–93% | 3 (0–8) |
| Ten opponents across the rating range, 2 games each a round | 130–140 / 260 / 400 | the same | 64 | 85–90 / 88–93 / 90% | 4–5 (0–8) |
| **Widest first over every deck** (the series rule) | 130 / 250 / 380–385 | 400 / 3,900–4,050 / 8,050–8,150 | 25 | 83–90 / 85–90 / 85–88% | 11–12 (5–20) |
| Enter it in full-field Swiss events | 122 / 240–244 / 378–380 | 4,184 / 8,774–9,112 / 13,352–13,415 | 52 | 88–93 / 88 / 83–93% | 11.5–12 (5–21) |

- **Cheapest reliable way:** any design that plays the newcomer alone needs about 120 to 140 of its games to reach
  ±7 (today's widest range) and 240 to 260 to reach ±5. Targeting its own variance saves 10 to 20 games over the
  simplest spread; no design is meaningfully better. Under the series rule a newcomer is the widest deck and takes
  pick after pick: 130 of the first 400 games went to it, after which it is one deck among the rest.
- **Disturbance:** the fit is joint, so the newcomer's games move its opponents' ratings and the field changes from
  71 to 72 decks. With the newcomer alone played to ±5, a median of 4 of the 71 letters changed (1 to 8) and the
  others' expected win rates moved 0.41 points on average. Measured against the old 71-deck field (the refit alone),
  3.1 to 4.0 letters moved on average against 3.5 to 4.3 with the new field, so the refit does most of it and the
  field change adds under one letter; the letters that move sit on a boundary. Under the series rule the other decks
  get games too, and 11 to 12 letters moved, which is the series doing its job.
- **When it shows as rated:** keep `SMALL_SAMPLE` (20 games). At 20 games a newcomer's range is about ±15.5 points
  (median of 40 runs per design) and held its truth in 80 to 98% of runs. The job never commits that state: the run
  that finds the deck plays it to the field's widest range (about 130 games) before it writes anything.
- **The anchored provisional rating** (`src/lib/anchoredRating.ts`, the other decks held fixed) gave ±4.7 to ±4.9
  where the joint fit gave ±5, with coverage 85 to 95%: close enough for a visitor's own decks, but the series uses
  the joint fit, as `ratings.ts` does.
- **"Needs rating", whatever the arrival:** a deck of the series field (the library, each list once, the decks
  `npm run tournament -- --field all` enters) needs games when it has no pooled game on the current simulator
  version and bot, or its range is wider than the target. With the series switched off and arrivals on, the target
  for a deck that needs games is the widest range among the other decks (today ±7.4).

### E5. Throughput, wall time and what a run costs (Q5)

Measured on this machine (AMD Ryzen 7 5700X3D, 8 cores / 16 threads, shared with another agent's work):

| Run | threads | games | seconds (event `createdAt` to the file's write) | games / second |
| --- | --- | --- | --- | --- |
| Full-field Swiss event, 71 decks, 9 rounds Bo3 + top 8 | 8 | 824 | 98.0 | 8.4 |
| Match list, 40 pairings × 10 Bo1 games | 4 | 400 | 68.8 | 5.8 (1.45 a thread) |
| Match list, 20 pairings × 10 Bo1 games | 2 | 200 | 65.5 | 3.1 (1.53 a thread) |
| `rating-plan.ts --play`, 400 games | 8 | 400 | about 78 | about 5.2 (under load) |
| Events 20 to 24 on the owner's 16 threads (gaps between `createdAt` stamps) | 16 | about 815 each | 79 to 96 | about 8.5 to 10 |

A game takes about 0.65 to 0.7 seconds of one core here. A GitHub-hosted Linux runner for a public repository has 4
vCPUs (2 cores with SMT on current hosts, *not verified*), clocked lower: **1.5 to 3.5 games a second, 5,400 to
12,600 an hour (*estimate*)**. The first scheduled run measures it and every run reports it.

| Target from today | games | this machine, 4 threads | 4 vCPU runner (*estimate*) |
| --- | --- | --- | --- |
| ±5 | 4,500 | 13 min | 21 to 50 min |
| ±4 | 9,600 | 28 min | 46 to 107 min |
| ±3 | 20,100 | 58 min | 1.6 to 3.7 h |
| ±4 from an empty pool (after a version bump) | 13,800 | 40 min | 1.1 to 2.6 h |
| A new deck to the field's widest range | about 130 of its own | under a minute | 1 to 2 min |

Other steps on the runner (*estimates*): `npm ci` about 1 minute; typecheck, the 208 test files (72 s with 6 workers
here), lint, `check:data` and the build about 10 to 15 minutes together; the decision alone (install, read, fit) 2
minutes. The guard tests are cheap: `tests/game-corpus.test.ts` and `tests/replay-events.test.ts` together took 6 s.

### E6. What recording costs (Q4)

**One real run recorded as a custom match-list event** (400 Hard games, the planner's 40 pairings, recorded in a
scratch clone with `scripts/tournament.ts --format matches`, then `ratings.ts` and `build-evidence.ts`):

| Changed | files | before → after (bytes) | new blobs, zlib | pack growth (*estimate*: xz delta against the old file) |
| --- | --- | --- | --- | --- |
| `public/tournaments/event-25.json` | 1 | new, 210,789 | 17.8 kB | 14.0 kB |
| `src/data/tournaments.json` (the index) | 1 | 42,297 → 48,171 | 4.9 kB | 0.6 kB |
| `src/data/ratings.json` | 1 | 45,495 → 45,619 | 9.9 kB | 4.1 kB |
| `public/data/h2h.json` | 1 | 32,203 → 33,048 | 10.8 kB | 3.2 kB |
| `public/data/evidence/*` | 72 | 5,270,534 → 5,269,617 | 633.1 kB | 117.8 kB |
| `reports/ratings-latest.md` | 1 | 7,733 → 7,734 | 2.6 kB | 0.6 kB |
| **All** | 77 | | 679.2 kB | **140.3 kB** |

- **The site search** (`npx tsx tools/kb-site.ts` in the clone, the build's own cut): first-search files 247.3 →
  251.0 kB gzip (the events part 81.0 → 83.1: one event and one round record; the ratings part 62.0 → 63.6: 24 more
  pairings reached the 6 games a matchup record needs). The build passed.
- **A whole series as events** (*size experiment only*: 29 match-list events of 300 games each, 8,700 games, results
  drawn from the fitted ratings, not played; never committed): first-search files **310.7 kB, over the 300 kB budget**
  (events group 81.0 → 110.3 kB in two parts, 1.0 kB an event; ratings group 62.0 → 96.2 kB in two parts, 551 more
  matchup records at about 0.062 kB each); the index 42.3 → 213.0 kB (the deck page imports it); 29 more rows on the
  Tournaments page, each "Match list: 300 matches" with no champion; the event files 5.0 MB (461 kB zlib).
- **The same series in run files** (*estimate* from the measurement above): the events group and the index do not
  change; the matchup records still come (they are built from `h2h.json`): about 247.3 + 34.2 = 281 kB estimated,
  and **286.2 kB measured** once run files were built (a scratch checkout with one real 400-game run and three
  synthetic runs, 10,000 games in all, which brought the widest range to ±3.83: the events group unchanged at 81.0 kB,
  the ratings group 62.0 → 100.9 kB in two parts, 1,098 pairings with 6 games or more against 145 today). To ±3 the
  series meets about 2,150 pairings 6 times or more (simulation): about +82 kB more than today's ratings group,
  **about 329 kB** (*estimate*), over the budget whatever the storage. (The study first counted 328 such pairings today:
  it added wins to games; the right count is 145.)
- **`check:data`** passed on the trial once the evidence was rebuilt after the ratings. `scripts/tournament.ts`
  rebuilds `h2h.json` and the evidence but not `ratings.json`; after `ratings.ts` the stored evidence differed from a
  rebuild in 1,401 numbers until `npm run evidence` ran again. The job must run: record → `ratings.ts` →
  `build-h2h.ts` → `build-evidence.ts` → checks.
- **The full test suite on the trial clone:** 8 tests in 5 files failed (3,191 passed) because they assume every
  recorded event is a standard event, or that the pool is events 20 to 24:
  - `tests/event-facts.test.ts` (2): every event has a champion and a bracket;
  - `tests/event-rerun.test.tsx` (1): every recorded event can be run again from the runner ("cannot be opened:
    arranged");
  - `tests/kb-build.test.ts` (1): every event record links to its champion's deck;
  - `tests/forecast.test.ts` (3) and `tests/forecast-ui.test.tsx` (1): the event list 20 to 24 is written into the
    tests. **These four fail on any new recorded event, Swiss included**, so today an owner who records event 25 also
    has to edit them.
  With run files instead of events, only the forecast tests are touched, and they should read the list from
  `h2h.json` (below).

**Why not one rolling event:** a single growing file rewritten each run (5 MB by ±4) churns more than all the other
files together, breaks "an event's id is its seed" and the immutability the replay tests and Watch rely on.

### E7. The real field (Q6)

The shares file does not exist yet, so the numbers use **invented** shares of the shape `outsideFieldShares` gives
(20 library decks with weights summing to 65%, 35% of the field uncovered), three seeds. The figure is "expected win
rate against the real field" = Σ_j w_j σ(r_k − r_j) / Σ_{j≠k} w_j from the same fit, no extra games; its range by the
same delta method with the weighted gradient, and optionally the pair spread added (6.4 points × √Σw²/Σw).

| | invented field 1 | 2 | 3 |
| --- | --- | --- | --- |
| Real-field figure − today's figure, median / largest (points) | 1.6 / 3.4 | 1.1 / 2.1 | 1.3 / 2.5 |
| Decks whose letter would differ on the real-field figure | 15 of 71 | 10 | 9 |
| Half-width, median (largest) | 7.46 (7.83) | 7.50 (7.93) | 7.32 (7.75) |
| … with the pair spread added | 8.22 (8.55) | 8.07 (8.50) | 7.96 (8.34) |

Aiming the games at the real-field figure (the planner's gradient weighted by the shares) brought the widest
real-field range to ±4 in 9,900 games against 10,200 when aimed at today's figure (3% fewer), and cost 11% more
games for today's figure (9,300 against 8,400; both runs with the greedy planner). The pair-spread term does not
shrink with more rating games: with 20 decks sharing the field equally it is about ±2.4 points on its own (more with
unequal shares), and only games of those exact pairings would narrow it (about 60 games of a pairing to halve its
variance, the shrinkage prior that a 6.4-point spread implies). So:

- keep today's figure and its letter unchanged ("against our field, each list once");
- add the real-field figure as a second column with its own range (pair spread included), its source, collected date
  and covered share named, and **no letter** (10 to 15 letters in 71 would disagree with the Sim tier);
- the series stays aimed at today's figure; no extra games for the real field;
- for "how often a deck is met follows how much it is played" in a played event (the runner or the CLI), offer a
  match-list generator that draws each deck's opponents with probability proportional to their shares (never
  duplicate entries); its games count for ratings like any custom event. It adds nothing the model figure lacks,
  except a raw record against the real field, and it plays mostly the same few pairings.

### E8. The forecast on a rebuilt file (Q9)

`src/lib/forecast.ts` reads `public/data/h2h.json` only (`modelFromH2HFile`), so it follows the ratings with no change.
On the trial clone (event 25 added, `h2h.json` rebuilt) the page's text read "power ratings and head-to-heads of
events 20 to 25 (4,484 games)". Its tests failed only because they name events 20 to 24 (E6). With the model section
of `tests/forecast.test.ts` reading the event ids from `h2h.json`'s manifest (the Swiss replays stay on 20 to 24) and
the UI test expecting the rebuilt range, `tests/forecast.test.ts`, `tests/forecast-ui.test.tsx` and
`tests/forecast-field.test.ts` passed: 36 of 36. With run files the source line should name them ("events 20 to 24
and rating runs 1 to 3").

## Rejected alternatives

- **Repeated full-field Swiss events as the series.** Honest (coverage 89 to 91.5%) but 10% more games to ±4, and
  each one is an event: about 8 kB of the search's first-search budget an event, so the budget runs out about six
  events from now (ROADMAP2 §13), before ±4.
- **The greedy planner (`planExtraGames`) as the engine.** 9% fewer games than widest first, but 1.3 to 2.0 points less
  coverage (2.3 to 3.9 standard errors, paired), and 84.6 to 86.9% from a cold start. It stays a planning tool.
- **The planner's tiers target.** Never reaches every deck under ±4 within 45,000 games; its own "settled" aim cost
  11,700 games against 8,700.
- **A mean width or a share of decks as the target.** Hides the decks that need games most (the mean reaches ±4
  600 games before the widest deck does).
- **A separate arrival engine.** The series rule already plays a newcomer first; a targeted design saves 10 to 20 of
  its games. Arrivals are a switch on the same job, with the field's widest range as the target.
- **One custom event per run.** Over the search budget by ±4 (310.7 kB measured), 5.9 kB more index a run, a row on
  the Tournaments page per run, and four tests to rewrite.
- **One rolling event.** See E6.
- **A bootstrap of Swiss events after a version bump.** Not needed: widest first from nothing is as honest and
  6% cheaper to ±4.
- **Aiming the series at the real field.** 3% fewer games for that figure, 11% more for ours, and its matchup term does
  not shrink anyway.
- **Opponents chosen by nearest rating.** Saves nothing from today and broke coverage from a cold start (72 to 83%).

## The design

### Run files (built 2026-11-18, chunk 1)

`data/series/run-<n>.json`, ids never reused, tracked, not served (no `import.meta.glob` and nothing under `public/`
reaches the folder, so the build and its size budgets do not move). A run file is a played match-list event exactly
as `runTournament` returns it with a `matches` setup (`decks` with their lists, `rounds[0].matches` of Bo1 games with
seed, first, winner, turns, reason, `setup`, `simVersion`, `bot`, its run manifest), with three fields in front
(`toRatingRun` in `scripts/lib-node.ts`):

    "kind": "nct-rating-run", "schema": 1, "id": "run-3",

The series (chunk 2) adds its own fields beside them, all optional for the readers:

    "rule": { "target": "widest-half-width", "width": 4, "level": 0.9 },
    "why": ["3 decks have no game on sim v9 hard", "widest range ±7.4 > ±4"],
    "before": { "widest": 7.44, "over": 70 }, "after": { "widest": 5.1, "over": 22 },
    "stopped": "budget" | "reached",
    "rate": { "games": 6200, "seconds": 2400, "threads": 4 }

**Changed from the plan:** the manifest keeps `purpose: 'tournament'` (the run is played by the tournament runner)
and its `runId` reads `tournament:run-3:<date>`. A new purpose would have meant editing `src/lib/runManifest.ts`,
which the game cache's code hash covers (an edit there discards every cached game); `aggregateManifest` already takes
string ids, so the aggregate files name the runs in `inputs.events` (`{ "id": "run-3", … }`) with no change to it.

The event shape costs about 0.53 kB a game raw (17.8 kB zlib for 400); by ±4 about 5 MB raw in a folder the site
never serves. It is chosen so `forEachGameOf`, `eventRatedGames` and the evidence pool read run files unchanged; a
compact shape (about a tenth) is possible later.

**Seeds (checked 2026-11-18).** The engine keeps its random state as a 32-bit integer (`src/engine/rng.ts`: mulberry32,
`(state + 0x6d2b79f5) | 0`), so a seed is read modulo 2³²; the bots' own generator (`src/ai/heuristic.ts`,
`(rng · 1664525 + 1013904223) >>> 0`) stays exact in doubles for seeds below about 5.4 × 10⁹. Seat B plays seed + 7,777.
The ranges in use: table-scheme Swiss events `id × 1,000,000 + round × 10,000 + table × 10` (top cut + 900,000), so
under 10⁹ while event ids stay under 1,000; keyed-scheme matches (match lists, arranged events, played events)
`matchSeedBase` = 10 to 999,999,900, always under 10⁹; the breeder's gate `season × 1,000,000 + 700,000 / 800,000`;
the forge and optimizer from their `--seed` (default 1) in blocks of 50,000 a generation, the optimizer 424,242 and
777,777, re-measurements from 5,000,000, the game corpus 7,200,000, the runner's random event seeds 100,000 to 999,999.
`1,000,000,000 + run × 100,000 + k` collides with none of them, stays below 2³¹ (signed, so the recorded seed is the
engine's state exactly) up to run 11,473, and allows 100,000 games a run. **A catch for chunk 2:** a run played through
`runTournament` with a `matches` setup gets keyed seeds from `matchSeedBase(eventSeed, key)`, not the planned range,
because that scheme hashes the event seed into 10 to 999,999,900. Those seeds can coincide with another event's (a hash
of 10⁸ bases), which is harmless for ratings (a coinciding seed with other decks is another game) but means the series
should either play its games itself with the planned seeds or accept keyed seeds; the run files of chunk 1's tests use
`runTournament` (keyed seeds) and the event seed `1,000,000,000 + run × 100,000`.

**Readers.** Pooling the **games** (events then runs, `readPooled` in `scripts/lib-node.ts`): `scripts/event-pool.ts`
(`selectEvents` over both; with a run in the pool the newest is the newest by date, so a run recorded on a newer
simulator version moves the pool, and an events-only pool is ordered by id exactly as before; `poolEvents` gives runs
games and no results and counts them as `runs`, not as custom events), `scripts/ratings.ts` (`runs` in
`ratings.json`, absent when none), `scripts/build-h2h.ts` and `h2hOf` (`runs` in `h2h.json`, absent when none),
`scripts/evidence-build.ts` (`eventPool`; sources name `data/series/run-…json`), `scripts/build-evidence.ts`,
`scripts/rating-plan.ts`, the breeder's head-to-heads (`loadH2H` in `scripts/breed-data.ts`), `scripts/check-data.ts`.
Experiments that write events to their own directory (`tournament.ts --out`) pool that directory alone. Readers that
list **events** do not read runs: the events index, the Tournaments page, the knowledge pack's event and round records
(its rating and matchup records come from `ratings.json` and `h2h.json` and say "5 recorded events and 1 rating run"),
`eventUpsets` (its yardstick stays the earlier events; runs could count as "earlier" later), `event-rerun`, Watch.
The forecast reads `h2h.json` and names runs apart ("events 20 to 24 and rating runs 1 to 3"); the Power ratings page
says "5 events and 1 rating run".

### Pooled by list (built 2026-11-18, the owner's rule)

A game counts for ratings, head-to-heads, the evidence pool and its matchup check, the rating planner and the
breeder's head-to-heads only when both seats played the library's **current** list of their deck (`currentListGate`
in `scripts/event-pool.ts`: the `listFingerprint` of the list the event or run stored for the seat, Legends and main
deck, whatever the card order or sideboard, against the library deck of that name). A deck whose list was edited is
therefore unrated until the series plays it; a deck no longer in the library (a retired list) keeps its games; a stored
list that is missing counts, as before. The evidence keeps its gap "other-list-events", now worded "they are left out"
(no finding is measured on another list any more, so the flag `other-list` no longer marks event findings).
`check:data` counts `h2h.json`'s games the same way and lists a run whose list is no longer current as information.
On 2026-11-18 every list the five recorded events stored is the library's current list, and a rebuild of
`ratings.json`, `h2h.json`, `reports/ratings-latest.md` and the 72 evidence files with the rule in place left every
byte unchanged.

### Checked when chunk 1 was built (2026-11-18)

In scratch checkouts, never committed:

| What was added | Ratings, h2h, evidence, `check:data` | The rest | Whole test suite |
| --- | --- | --- | --- |
| One run of 400 real Hard games (the study's match list, played by `scripts/tournament.ts --format matches`, turned into `run-1.json` by `toRatingRun`) | 4,484 games, `runs: 1`, the same ratings as when those games were recorded as event 25; evidence `--check` and `check:data` pass | events index byte-identical; search events part unchanged (299 records, 81.0 kB), ratings part 62.0 → 63.6 kB, first search 248.9 kB | 1 failure, `tests/event-upsets.test.ts` (it fitted the events alone; fixed) |
| The same plus three synthetic runs of 3,200 games (results drawn from the fitted ratings), 10,000 run games, widest range ±3.83 | 14,084 games, `runs: 4`; `check:data` passes | first search 286.2 kB of 300; `npx vite build` passes its budgets | the same single failure, nothing else |
| The real run, with one library list edited (one card) | the edited deck drops out of the ratings (70 decks, 4,389 games), its evidence shows the gap; `check:data` passes | | 3 failures, all from the edit itself, not from the rule: `tests/deck-objectives.test.ts` (a note's `listId` must follow its list), `tests/kb-build.test.ts` and `tests/kb-eval.test.ts` (the card-statistics reports are keyed by list) |

The forecast tests (stage 0) now read what `h2h.json` pooled from its manifest and replay every recorded standard Swiss
event, so they follow the data; `tests/rating-runs.test.ts` builds its own events and runs.

### The command (`scripts/series.ts`, built 2026-11-18, chunk 2)

The rule is `src/lib/seriesPlan.ts` (pure: `decide`, `planPicks`, `expectedGames`, `runSeries` with the player handed
in, `seriesSeed`); the command's logic is `scripts/series-run.ts` (`seriesCommand` with its I/O handed in: the tests
run it on the repository's data with a stub player); `scripts/series.ts` wires the worker pool and the replay. Neither
module is loaded by the game worker: `scripts/game-cache.ts codeHash` read `430adf86…c9bd` before and after.

- **The pool it works in:** every event and rating run of this code's `SIM_VERSION` and the Hard bot (a version bump
  starts afresh: every deck is then unrated), games on the library's current lists only; the field is the library,
  each list once (`fieldPool` + `distinctLists`, the decks `--field all` enters).
- **`status [--json] [--config FILE]`:** whether a run is needed and why, the widest range and the target, how many
  decks are over it, the unrated decks (no game on their current list: new, or edited), the games the rule expects
  (`expectedGames`: the picks the run would make with the covariance updated by each pick's expected information,
  nothing played, no refit) and the minutes at the last recorded run's rate (else 1.5 games a second, the low end of
  the runner estimate), and the switches as the committed config reads them (a key it does not name takes its
  default). On the data of 2026-11-18 it expects 9,600 games to ±4, the number the study simulated.
- **`run [--minutes 240] [--max-games N] [--threads 4] [--dry-run] [--replay 4] [--out DIR] [--config FILE]`:**
  1. both switches off, or nothing needed: says why, plays nothing, exits 0;
  2. plays the newest recorded games of this version again (`--replay N`, default 4: the last games of the newest run
     and of the newest event) through Watch's own replay (`playWatchGame` in `src/lib/watchGame.ts`), and refuses
     with exit 4, naming the game, when one ends differently;
  3. plays chunks of 300 games by the rule through the worker pool, refitting between chunks, until every deck it
     plays for is at its target, or the budget is spent: `--max-games` (at most `automation.maxGamesPerRun`) or
     `--minutes`, checked before each chunk (a chunk already started finishes: about 2 to 3 minutes on the runner);
  4. writes ONE file, `data/series/run-N.json` (or into `--out DIR`), and nothing else; `--dry-run` plays for real
     and prints what it would write. Rebuilding is the next step: `npx tsx scripts/ratings.ts`,
     `npx tsx scripts/build-h2h.ts`, `npx tsx scripts/build-evidence.ts`, then the checks.
- **Seeds (changed from chunk 1's catch):** the series plays its own seeds, `seriesSeed(n, k) = 1,000,000,000 +
  n × 100,000 + k` for game k of run n, never `runTournament`'s keyed seeds; a run never plays more than 100,000 games,
  and the command refuses a run whose last seed would reach 2³¹ (run 11,474 and later; "up to run 11,474" in chunk 1's
  text was one too many). `check:data` now fails when two pooled games share an identity (simulator version, bot,
  both seats' list fingerprints in seat order, seed, first player), because a pool would count such a game twice.
- **The run file** is a match list of best-of-one games (one match a game, one line of the setup a pick), with
  `rule` (target, width, level, the switches), `why`, `before` and `after` (widest, its deck, decks over target,
  unrated decks), `stopped` ("reached" or "budget") and `rate` (games, seconds, threads). Its manifest has purpose
  `analysis`, field mode `rating-series` and run id `series:run-N:<date>`. About 0.43 kB a game (130 kB for 300).
- **Measured 2026-11-18:** `npx tsx scripts/series.ts run --dry-run --max-games 300 --threads 8` replayed 4 recorded
  games of event 24, then played 300 Hard games in 37 s (8.16 games a second on this machine, shared with other work),
  moved the widest range from ±7.44 to ±7.10 and exited 3 (stopped at its budget), writing nothing. In a scratch
  checkout, `run --max-games 600 --threads 8` played 600 Hard games in 57 s (10.6 games a second), wrote `run-1.json`
  (230 kB) and exited 3; after `ratings.ts`, `build-h2h.ts` and `build-evidence.ts`, `check:data`, `evidence --check`,
  the production build (first search 250.3 kB) and the whole suite passed (after one test of chunk 2's own new
  check:data line was corrected), and `status` then expected 8,700 more games, 14 minutes at that run's rate.

### What the workflow needs from it (chunk 3)

| Step | Command | Reads | Gives |
| --- | --- | --- | --- |
| Decide | `npx tsx scripts/series.ts status --json` | `public/site-config.json`, `data/decks`, `public/tournaments`, `data/series` | one JSON object: `needed`, `why` (sentences for the summary), `switches`, `simVersion`, `bot`, `games`, `decks`, `widest` {deck, hw}, `target`, `over`, `unrated`, `expectedGames`, `minutes` {estimate, gamesPerSecond, from}, `nextRun`; exit 0, 1 when the config is missing or broken (run nothing, go red), 2 on a bad command line |
| Play | `npx tsx scripts/series.ts run --minutes 240 --threads 4` | the same | one new file `data/series/run-N.json`; exit **0** the rule holds (or nothing was needed, or both switches are off: then no file), **3** stopped at its budget (a file is written with `stopped: "budget"`; commit it, the next run carries on), **4** a recorded game no longer replays (no file; go red: the code changed play without a `SIM_VERSION` bump), **1** an error (a game threw, the config broke; no file), **2** a bad command line |
| Verify (finalize) | `npx tsx scripts/series.ts verify data/series/run-N.json [--replay 4]` | the run file | exit 0: its simulator version is the code's and its first, last and two middle games replay as recorded; **4**: refused, naming the version or the game; 1: not a rating run |
| Rebuild | `npx tsx scripts/ratings.ts`, `npx tsx scripts/build-h2h.ts`, `npx tsx scripts/build-evidence.ts`, in that order | the new run file | `src/data/ratings.json`, `reports/ratings-latest.md`, `public/data/h2h.json`, `public/data/evidence/*` |
| Check | typecheck, the whole suite, the Python tests, lint, `check:data`, `npx vite build` | the candidate tree | nothing is committed unless all pass |
| Switch alone | `npx tsx scripts/automation-switch.ts automation.series` (or `--json`) | the config | "on"/"off" (a number for `automation.width` and `automation.maxGamesPerRun`); `--github-output FILE` appends `on=…` / `value=…` / `automation={…}`; exit 1 / 2 as for the features |

The files a run commit touches: the new run file, `src/data/ratings.json`, `reports/ratings-latest.md`,
`public/data/h2h.json` and the evidence files; never the events index, an event file or anything under `src/`.

### Running by itself (`.github/workflows/series.yml`, built 2026-11-18, chunk 3)

The workflow "Rating series" runs every day at **03:17 UTC**, and on demand. No AI assistant takes part: GitHub runs
the repository's scripts. Every job is skipped in a fork. One run at a time (concurrency group `series`).

| Job | Permissions | What it does |
| --- | --- | --- |
| `decide` (15 min) | read | `npx tsx scripts/series.ts status`: the switches, the widest range, the unrated decks, the games and minutes the rule expects, written to the job summary. Nothing needed (both switches off, or every range within the width): a green run that says why, and nothing else runs. A broken site config: red. |
| `play` (up to 5 h) | read | First the guard tests (`tests/game-corpus.test.ts`, `tests/replay-events.test.ts`: the code and `SIM_VERSION` still agree), then `series.ts run --minutes 240 --threads $(nproc)` (it replays the newest recorded games first). Exit 3 (stopped at its budget) is fine: the run is kept and committed and the next day's run carries on. Exit 4 (a recorded game no longer replays): red, with the sentence naming the game. The run file is uploaded at once as the artifact `series-run` (kept 14 days), then ratings, head-to-heads and evidence are rebuilt on that tree and `check:data` and `evidence --check` run, so a bad run fails here rather than after the finalize. |
| `finalize-1` (90 min) | read | On the main it will be pushed onto (main moves during hours of play): `npm ci --ignore-scripts`, then `scripts/series-finalize.ts` fetches main, places the run file (it must be run N+1 on that main), runs `series.ts verify` (the run's simulator version is the code's and 4 of its own games replay), rebuilds, runs every check of pages.yml's `check` job plus `evidence --check`, refuses any changed path outside the list (the run file, `src/data/ratings.json`, `public/data/h2h.json`, `reports/ratings-latest.md`, `public/data/evidence/*.json`), commits as github-actions[bot] and hands the commit over as a bundle (artifact `series-commit-1`, kept a day). |
| `push-1` (15 min) | contents: write, actions: write | Node alone (no npm install): `scripts/series-push.mjs` reads main into a fresh repository with git's global and system configuration ignored and no hooks, and pushes the commit only if main is still its parent and it touches only the listed paths; then `gh workflow run pages.yml --ref main` (a push made with GITHUB_TOKEN starts no workflow; a dispatch does). The token is in the environment of that one step only. |
| `finalize-2`, `push-2`, `finalize-3`, `push-3` | as above | Only when the previous push found main moved or was refused: the commit is prepared again on the new main. After the third: red, nothing pushed; the run file stays in the artifact for 14 days and the next day's run plays again from the new main. |

**Changed from the plan (and why).** The plan had one finalize job that both ran the checks and pushed with the
token in its last step's environment. A dependency installed in that job (npm runs code from a hundred packages in the
checks) could still reach the token at push time without a hook: by writing `url.<…>.insteadOf` or a credential helper
into git's global configuration, or, with the runner's passwordless sudo, by replacing `git` itself. So the commit is
prepared in a job that holds no write permission, and pushed by a separate job on a fresh machine that installs
nothing and reads no configuration but its own; the retry loop is unrolled into three prepare-and-push pairs, each
attempt on the fresh main. `npm ci --ignore-scripts` works for every check: the only install scripts in the tree are
esbuild's (it checks its platform binary, which npm installs as an optional dependency anyway) and fsevents' (macOS
only); in a clean checkout installed that way, `tsx`, typecheck, lint, the series tests, the production build and 30
real Hard games through the worker pool all ran (Windows; the runner is Linux).

**Run it now:** GitHub → Actions → Rating series → Run workflow. `dry_run` plays 600 games (or `max_games`), says in
the summary what it would write, and stops green with nothing uploaded or committed; `max_games` caps the games
(empty: `automation.maxGamesPerRun` from the site config); `minutes` is the play budget (default 240).

**Switch it off:** untick "Rating series" and "Rate new decks on arrival" in `#/admin` (Automatic jobs) and commit the
file: the next run's `decide` stops green. Or disable the workflow in GitHub (Actions → Rating series → ⋯ → Disable
workflow). GitHub also disables scheduled workflows of a public repository after 60 days without a commit.

**When it fails** the run is red; GitHub mails the account that last changed the workflow's schedule; the summary of
each job says what happened in sentences (the decision, the run, the finalize's refusal and why, the push); the run
file is kept 14 days as the artifact `series-run` (it can be committed by hand: put it in `data/series/`, run the three
rebuilds and the checks). Nothing reaches main unless every check passed on the exact main it was pushed onto.

**A successful commit** reads "Series run N: G games, widest ±a to ±b (reached|budget)" by github-actions[bot], and
touches `data/series/run-N.json`, `src/data/ratings.json`, `public/data/h2h.json`, `reports/ratings-latest.md` and
`public/data/evidence/*.json`, nothing else; pages.yml then checks and deploys main.

**How long** (*estimates*, the runner was not measured): `decide` 2 to 3 minutes; `play` up to the 240-minute budget
plus 5 to 10 minutes (install, guard tests, rebuild and checks): from today's ratings about 9,600 games, 46 to 107
minutes at 1.5 to 3.5 games a second; each `finalize` 15 to 25 minutes (install, verify, rebuild, the whole suite, the
build); each `push` under 2 minutes. The first run that finds every range within ±4 ends at `decide`.

**Not tested on GitHub** (neither the dispatcher nor this agent can run Actions): the runner's speed and the worker pool
on Linux with `$(nproc)` threads; the hand-over of the two artifacts between jobs; the anonymous `git fetch` of the
public repository with `persist-credentials: false`; the push with the token in the URL; `gh workflow run pages.yml`
with `actions: write`; `npm ci --ignore-scripts` on Linux; the job summaries' rendering. What was tested: the finalize
and push scripts against a local bare repository (a clean run, a push race won on the second attempt, three refused
pushes, a run of another simulator version, a path outside the list, a failed check, a run number already taken, a
commit tampered with between the jobs: `tests/series-finalize.test.ts`), `series.ts verify` and the outputs the
workflow reads (`tests/series-cli.test.ts`), and the workflow file read as text (`tests/series-workflow.test.ts`).
End to end on this machine (2026-11-18, a clean checkout installed with `npm ci --ignore-scripts`): `series.ts run`
played 300 Hard games (9.4 a second on 8 threads) into a scratch folder; `series-finalize.ts` with its real verify (4
of the run's games replayed) and rebuild and the checks as pages.yml runs them (the whole suite, 215 files, on the
candidate tree) prepared the commit in 169 s, "Series run 1: 300 games, widest ±7.44 to ±7.10 (budget)", 76 files;
`series-push.mjs` without a push address accepted it (the run file and 75 derived files on its parent).

### The owner's switches (built 2026-11-18, chunk 2)

The section `automation` of `public/site-config.json` (`src/lib/siteConfig.ts`: `AUTOMATION_KEYS`, `AUTOMATION_INFO`,
`AUTOMATION_BOUNDS`), edited in `#/admin` under "Automatic jobs (GitHub Actions)"; the committed file need not name it
(a missing key takes its default). Defaults are **on**, by the owner's decision of 2026-11-18 ("build it and turn it
on for now, as a setting in admin mode to toggle"):

| Key | Default | What it does |
| --- | --- | --- |
| `automation.series` | `true` | The scheduled job plays until every deck's range is at most ±`width`. |
| `automation.arrivals` | `true` | With the series off: a deck with no game on its current list is played to the widest range of the other decks. |
| `automation.width` | `4` | ± points, 3 to 8 (one decimal at most). 3 breaks the search budget (measured 286.2 of 300 kB at ±3.83). |
| `automation.maxGamesPerRun` | `12000` | 300 (one chunk) to 50,000 (about the most a 4 vCPU runner plays in a run's 4 hours at its fastest, so a higher cap would never bind). |

The job reads the committed file at its next scheduled run; a change in a preview does nothing. Turning both
switches off stops the next run at its decision; a run in progress finishes. `scripts/automation-switch.ts` reads the
section for the workflow (a name without a dot is still a feature, exactly as the outside-meta workflow calls it).

## Staged build plan

| Stage | What | Files | Tests | Verify | Effort |
| --- | --- | --- | --- | --- | --- |
| 0 | Prerequisites (**built** 2026-11-18; the site-config test had already changed on main) | `tests/forecast.test.ts`, `tests/forecast-ui.test.tsx` (event ids from `h2h.json`); `tests/site-config.test.tsx` (the committed file parses without a problem; the defaults pinned on `defaultSiteConfig()`); `docs/SITE_CONFIG.md` | the same files | record a scratch event in a clone: the suite passes | 0.5 day |
| 1 | Run files read beside events, and pooled by list (**built** 2026-11-18) | `scripts/lib-node.ts` (`SERIES_DIR`, `readRuns`, `maxRunId`), `scripts/event-pool.ts`, `scripts/ratings.ts`, `scripts/build-h2h.ts`, `scripts/evidence-build.ts`, `scripts/build-evidence.ts`, `src/lib/runManifest.ts`, `scripts/check-data.ts` (schema, version, manifest, deck ids, coverage counts), `src/lib/forecast.ts` and `src/ui/pages/Forecast.tsx` (source line), `src/lib/kb/build/events.ts` (rating record wording), `scripts/kb-sources.ts` (inputs), `src/ui/pages/Ratings.tsx` (source line) | new `tests/rating-runs.test.ts`; `tests/check-data.test.ts`, `tests/ratings-page.test.tsx`, `tests/event-pool-filter.test.ts`, `tests/kb-build.test.ts` | a hand-made run file in a clone: ratings, h2h, evidence and `check:data` agree; the Tournaments page and the search's events group unchanged | 1.5–2 days |
| 2 | The rule and the CLI (**built** 2026-11-18, chunk 2) | new `src/lib/seriesPlan.ts` (pure: needs-rating, widest first, the stop rule, the expected games), new `scripts/series.ts` (`status`, `run`) | new `tests/series-plan.test.ts` (the rule; a seeded simulation pinning coverage near 90% and the games of E1 within a tolerance), `tests/series-cli.test.ts` (a tiny run with a stub player) | `series.ts run --max-games 600 --threads 4` in a clone, then the stage-1 checks | 2 days |
| 3 | Switches (**built** 2026-11-18, chunk 2) | `src/lib/siteConfig.ts` (`automation`), `src/ui/pages/Admin.tsx`, `docs/SITE_CONFIG.md`, `scripts/check-data.ts` | `tests/site-config.test.tsx` | the admin editor round-trips the section; `series.ts status` reads it | 1 day |
| 4 | The workflow (**built** 2026-11-18, chunk 3; on GitHub since 2026-11-19: red 11-19 to 11-21 on a forecast test's tolerance, green since 11-22, when it played run 1) | `.github/workflows/series.yml` | the workflow's own dry run | `workflow_dispatch` with `dry_run: true` (plays 600 games, runs every check, pushes nothing), then one real run watched | 1 day + one supervised run (about 2 h) |
| 5 | The real field | `src/lib/ratingModel.ts` (`weightedFieldInterval`, pair-spread term), `scripts/ratings.ts` (optional `wrReal*` fields when `outsideMeta.json` exists), `src/ui/pages/Ratings.tsx` and the deck page (a column, no letter) | `tests/rating-model.test.ts`, `tests/ratings-page.test.tsx` | invented shares in a test; real ones when the file exists | 1–1.5 days |
| 6 (optional) | Runner pairing by shares | `src/lib/eventDraft.ts`, `src/lib/eventFormats.ts` (a match list drawn by shares), the runner form | `tests/event-formats.test.ts` | a weighted match list replays from its seed | 1 day |

`src/lib/ratingModel.ts` and the new `seriesPlan.ts` are not loaded by the game worker; no stage edits `src/engine`,
`src/ai`, `src/sim` or `SIM_VERSION`.

## Risks and their guards (Q8)

| Risk | Guard |
| --- | --- |
| Another session commits to `main` while a run plays | Derived files are rebuilt on the new `main`, never merged; the run file is new and cannot conflict; the run is dropped (kept as an artifact) if `SIM_VERSION` or a played list changed upstream; three tries, then red. |
| A flaky test (timeouts under load) | Tests run after the games, on an idle runner, with the 15 s timeout; a failure is red and commits nothing. No automatic retry: a retry would hide a real failure. |
| The engine or a bot changed without a `SIM_VERSION` bump | `tests/game-corpus.test.ts` and `tests/replay-events.test.ts` before playing, and a replay of the newest pooled games; any difference stops the run red. |
| A deck's list edited under the same name | Ratings pool by name (today too); the decision step lists decks whose current list differs from the lists their pooled games used and refuses to run until the owner decides (open decision below). |
| Runaway growth | `maxGamesPerRun`; the stop rule; one commit per run; run files outside the served site; the search budget check in the build stops a commit before it ships (±3 would hit it). |
| Branch protection on `main` | Not known here; a protected branch refuses the push and the run goes red with the artifact kept. |
| GitHub disables schedules in a public repository after 60 days without activity | The run summary says when the job last ran; the button still works. |
| The ranges are read as more than they are | The page's words: 90% per deck, about 7 of 71 outside at any time; Hard bot, our field, this simulator version. |

## Open decisions for the owner

Decided 2026-11-18 (relayed by the dispatcher for the owner, who asked for the best approach, built and switchable):
the width is ±4 (configurable 3 to 8 in the editor, built); the switches start on (built); games are pooled by list (built,
see "Pooled by list"); the committed site config may differ from the defaults (changed on main the same day). Left:

1. **±3 or narrower.** Needs 20,100 games from today and a search decision (raise the budget, raise the 6-game
   matchup threshold, or load matchup records only for matchup questions, which needs a held-out kb evaluation under
   RAG_PLAN M9): at ±3.83 the first-search files measured 286.2 of 300 kB.
2. **The upset yardstick** (`src/lib/eventUpsets.ts`) still fits the earlier events alone, by name, as they were
   played; whether rating runs before an event should count as "earlier", and whether the list rule should apply to
   a historical yardstick, is open.
3. **Standard events** are no longer needed for ratings; they stay for titles and the Tournaments page, run by hand.
4. **The real-field column**, once `outsideMeta.json` exists: show it, without a letter. Recommendation: yes.

## What was not verified

- The GitHub runner's speed (1.5 to 3.5 games a second is an estimate from this machine's per-core rate), its core
  count with SMT, the job's total minutes, and whether `main` is protected.
- The workflow itself: no YAML was written or run; `gh workflow run` from a job and the push with `GITHUB_TOKEN` are
  from GitHub's documentation, not tried here.
- The search pack at ±3 (329 kB) scales the measured matchup growth (286.2 kB at ±3.83) by the simulated count of
  pairings; it was not built.
- The pack growth per commit (140 kB) is an xz-delta proxy for git's delta compression, not a `git gc` measurement.
- Simulations assume Bradley-Terry with a seat term, or that plus a random matchup effect; real matchup structure
  (rock-paper-scissors cycles, list-specific effects) is wider than either.
- The real-field numbers use invented shares.
- Throughput was measured while another agent shared the machine; the 8-thread figures are the least reliable.

## Reproducing

Repository commands (from the repository root; the ones that write go to a scratch directory or a scratch clone):

    npx tsx scripts/tournament.ts --events 1 --field all --rounds 9 --top 8 --bo 3 --bot hard --threads 8 --out <dir>   # E5, Swiss row
    npx tsx scripts/rating-plan.ts --budget 400 --batch 10 --target width --play --threads 8 --seed 91001              # E5; tiers weights in E1
    npx tsx scripts/build-evidence.ts --matchup-check                                                                  # the 6.4-point pair spread
    npx tsx tools/kb-site.ts                                                                                           # search parts (also in a clone)
    npx vitest run tests/game-corpus.test.ts tests/replay-events.test.ts                                               # guard time

Scratch scripts (not in the repository; in the session's scratch folder `scratchpad/series/`, run with the
repository's `tsx`, at most 7 processes at a time):

    tsx check.mts                                         # today's widths; fitAgg = fitRatings
    tsx project.mts <allocation> <truth> <reps> <seed> real|resim|empty <cap>   # E1 (real, seed 1), E2 (resim, seed 7), E3 (empty, seed 11, WS=7,6,5,4)
        allocations: widestx-300 (recommended), widestr-300, widest-300, plan-width-100|300|800, plan-tiers-300, swiss, random-300, hybrid-2, hybridw-4
        truths: fit, posterior, spread13, pair26
    tsx arrival.mts <targeted|nearest|spread|widestx|swiss|series> <0|0.26> 40 1   # E4
    tsx q6.mts                                            # E7
    tsx make-matches.mts 400 matches400.json              # the trial's match list
    bash trial-matches.sh                                 # E5 4-thread row and E6 (a scratch clone `root`)
    bash trial-2threads.sh                                # E5 2-thread row (clone `root2`)
    bash synth-steps.sh                                   # E6 size experiment (synthetic results, clone `root2`)
    tsx churn.mts <clone> ; python -I deltacost.py <clone>   # E6 file changes and pack-growth proxy
    tsx summarize.mts                                     # the tables from res/*.jsonl
