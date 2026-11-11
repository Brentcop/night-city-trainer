# Strategy report — finding the deck for EOR Chicago (Dec 11–13, 2026)

> **Fresh baseline, 2026-11-11.** Every number below was measured on the current simulator (SIM_VERSION 5: the review fixes and the FAQ conformance pass) after all earlier results were wiped (`docs/ROADMAP.md` §1). The previous report (S2-08 Explorer, RRG Dexter Midrange's 65% finals, five breeding seasons) described the old simulator; it and its data are at the tag `archive/pre-season1-reset-2026-11-11`. The samples here are one baseline run, one season and four events: read the ranges, not just the point estimates.

## Bottom line (provisional)
**The current pick is S1-01 Mutant (RRY)**, a Season 1 mutant of RRG Dexter Midrange (Dum Dum: Maelstrom Triggerman in Saburo's seat, forged once: −1 Appetite for Destruction, +1 Rockn' Rockerboy). **RRG Dexter Midrange is the established-list alternative and is statistically level with it.**

| Evidence (deep bot unless noted) | S1-01 Mutant (RRY) | RRG Dexter Midrange |
|---|---|---|
| Baseline round robin of the 7 meta decks (200 games per pairing) | not in it | **70.6%** over 1,200 games, #1 of 7 |
| Season 1 round robin (15 decks, 24 games per pairing) | **76.2%**, #1 of 15 (336 games) | 64.6%, #3 (336 games) |
| Finals vs the 7 meta decks (60 per opponent) | **72.1%** over 420 games | — |
| Head-to-head in the Season 1 round robin | 24 games, too few to separate them | |
| Power rating, 4 events (hard bot) | 75.8% expected vs the field (90% range 67–83%), 54 games, top 8 in 2 of 2 | 73.3% (65–80%), 77 games, 2 titles in 4 events |

The two ranges overlap almost completely: the pick is S1-01 only because `scripts/plan.ts` takes the highest power rating. Before committing, run larger finals and a head-to-head between the two (for example `npm run sim -- vs s1-01-mutant-rry meta-rrg-dexter-midrange --games 400 --bot deep`) and play both by hand.

**Caveat:** bred decks are selected by these bots against the choom.gg meta lists, so expect some regression against strong humans.

## Baseline: the meta field (4,200 games)
`npm run sim -- analyze --field meta --bot deep --decisions --games 200 --seed 1`: every pairing of the 7 choom.gg meta archetypes, 200 games each (half on the play). Going first won 50.1% of games; games last about 12.7 turns.

| # | Deck | Win % (1,200 games) | On the play / draw | Mulligan rate |
|---|---|---|---|---|
| 1 | RRG Dexter Midrange | **70.6%** | 73.8% / 67.3% | 14% |
| 2 | YYB Rogue Gear | 58.3% | 59.2% / 57.5% | 18% |
| 3 | Rainbow Fixer Stuff | 50.1% | 48.3% / 51.8% | 6% |
| 4 | RRY Smasher Aggro | 49.8% | 50.5% / 49.2% | 27% |
| 5 | BBG Cunningham Econ | 48.5% | 45.8% / 51.2% | 22% |
| 6 | RRB Wakako Midrange | 40.3% | 44.5% / 36.2% | 17% |
| 7 | GRY Trauma Team | 32.3% | 28.7% / 36.0% | 11% |

Each pairing has 200 games, so a single matchup is ±7 points (95%). RRG Dexter Midrange wins every matchup; its closest is BBG Cunningham Econ at 59%. The full matrix is on the Meta page and in `src/data/review.json`; card telemetry is on Card stats, including the decision report (`public/data/decisions.json`, `docs/DECISION_TELEMETRY.md`).

## Season 1 (8 new decks)
Bred from the baseline (the leaderboard starts with only the 7 meta decks, so every parent was a meta list and there were no incumbents), then a 15-deck round robin with 24 games per pairing, one forge generation (lookahead bot, 112 games per test) and finals vs the meta (60 games per opponent, 420 per deck).

| Deck | Method | Round robin | Finals vs meta (420 games) | Forge |
|---|---|---|---|---|
| S1-01 Mutant (RRY) | mutant of RRG Dexter Midrange | 76.2% | **72.1%** | −1 Appetite for Destruction, +1 Rockn' Rockerboy |
| S1-03 Mutant (RBG) | mutant of Rainbow Fixer Stuff | 70.8% | **68.8%** | kept |
| S1-04 Cross (RBG) | Rainbow Fixer Stuff × RRG Dexter Midrange | 54.2% | 58.1% | −1 Nadia, +1 Over the Edge |
| S1-05 Cross (RBB) | GRY Trauma Team × BBG Cunningham Econ | 53.0% | 56.7% | kept |
| S1-08 Explorer (BGG) | Saburo / Judy / Hanako | 49.4% | 55.0% | kept |
| S1-07 Explorer (RYY) | River Ward / Johnny Silverhand / Kerry | 58.3% | 53.8% | kept |
| S1-02 Mutant (RYY) | mutant of YYB Rogue Gear | 36.3% | 43.6% | kept |
| S1-06 Cross (BGY) | BBG Cunningham Econ × GRY Trauma Team | 22.9% | 27.6% | −1 Zetatech Berserk, +1 Placide |

A finals rate over 420 games is about ±4.5 points (95%). Round-robin rates are over 336 games each. The all-time leaderboard (Seasons page) pools every game against the meta decks: S1-01 leads at 73.0% raw (588 games), then RRG Dexter Midrange 70.7% (1,344) and S1-03 69.7% (588).

## Tournaments (4 events, hard bot)
| Event | Field | Games | Champion |
|---|---|---|---|
| #1 | 7 meta decks, Swiss 4 rounds Bo3 + top 4 | 37 | RRY Smasher Aggro |
| #2 | 7 meta decks, Swiss 4 rounds Bo3 + top 4 | 35 | RRG Dexter Midrange |
| #3 | all 39 active decks, Swiss 9 rounds Bo3 + top 8 | 435 | RRG Dexter Midrange |
| #4 | all 39 active decks, Swiss 9 rounds Bo3 + top 8 | 442 | S1-03 Mutant (RBG) |

The power ratings (Tournaments → Power ratings) fit all 949 games; each of the 39 decks has 36–78 games, so the 90% ranges are 15–24 points wide. The top five: S1-01 Mutant (RRY) 75.8%, RRG Dexter Midrange 73.3%, the sim-ladder BBG Jackie / Alt / Hanako list 71.3%, Smash the Curve 69.5%, S1-03 Mutant (RBG) 69.2%. Going first was worth 2.5 points.

## What changed from the old report
- The decks bred, forged or optimised from the old results (seasons 1–5, the tournament builds and the RRG optimizer variants) left the active library for `data/decks/archive/`; they were not re-measured.
- The meta order is broadly the same at the top (RRG Dexter Midrange first, YYB second) but RRG's margin is larger on the current bots, and BBG Cunningham Econ sits mid-table (48.5%). Bots still under-play control decks, so treat BBG's number as a floor.

## Keeping it current
1. Refresh choom.gg data with `npx tsx scripts/import-meta.ts --force` and `npx tsx scripts/import-guides.ts --force`, then add any new lists with `npm run sim -- add`.
2. Run more seasons (`npx tsx scripts/season.ts`), more events (`npm run tournament`), then `npx tsx scripts/ratings.ts` and `npm run refresh`.
3. Re-running `npm run sim -- analyze` rewrites `src/data/impact.json`, which the Hard bot reads: do it before recording events, or bump `SIM_VERSION` (see `docs/ANALYSIS.md`).
