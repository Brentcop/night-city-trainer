# Strategy report — finding the deck for EOR Chicago (Dec 11–13, 2026)

> **Fresh baseline, 2026-11-11; Season 2 and events 5–7 added 2026-11-12.** Every number below was measured on the current simulator (SIM_VERSION 5: the review fixes and the FAQ conformance pass) after all earlier results were wiped (`docs/ROADMAP.md` §1). The previous report (S2-08 Explorer, RRG Dexter Midrange's 65% finals, five breeding seasons) described the old simulator; it and its data are at the tag `archive/pre-season1-reset-2026-11-11`. The samples here are one baseline run, two seasons and seven events: read the ranges, not just the point estimates.

## Bottom line (provisional)
**The current pick is Ladder: Jackie / Alt / Hanako (BBG)**, one of the owner's five imported sim-ladder lists (Legend trio from the sim site's Master ladder, main deck theorized here). **RRG Dexter Midrange is the established-list backup, and the two are statistically level.**

| Evidence (deep bot unless noted) | Ladder: Jackie / Alt / Hanako (BBG) | RRG Dexter Midrange |
|---|---|---|
| Baseline round robin of the 7 meta decks (200 games per pairing) | not in it | **70.6%** over 1,200 games, #1 of 7 |
| Season 2 round robin (23 decks, 24 games per pairing) | 61.4%, #6 of 23 (528 games) | 63.4%, #5 (528 games) |
| Finals vs the 7 meta decks (60 per opponent) | **65.7%** over 420 games (Season 2) | — |
| Head-to-head in recorded events (hard bot) | 11 games, 5–6: too few to separate them | |
| Power rating, 7 events (hard bot) | **75.4%** expected vs the field (90% range 70–81%), 127 games, top 8 in 5 of 5, no title | 73.7% (68–79%), 150 games, 3 titles in 7 events, top 8 in 6 |

The two ranges overlap almost completely: the pick is the BBG list only because `scripts/plan.ts` takes the highest power rating, and its edge comes from the hard-bot events (9–0 in event 6's Swiss, 7–1 in event 5's); in the deep-bot season it was a little behind RRG. Before committing, run a head-to-head between the two (for example `npm run sim -- vs ladder-bbg-jackie-alt-hanako meta-rrg-dexter-midrange --games 400 --bot deep`) and play both by hand. Several Season 2 decks are close behind (S2-06 Counter (RGG) 72.1%, S2-03 Cross (RGY) 69.5%, on 71–87 games each).

**Caveat:** bred decks are selected by these bots against the choom.gg meta lists, so expect some regression against strong humans. The ladder lists' main decks were also built from bot data.

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

## Season 2 (8 new decks, 2026-11-12)
Parents came from every rated deck (the power ratings of events 1–4, blended with the season leaderboard where a deck has one), so the guides, Trainer originals and the owner's sim-ladder lists were eligible beside the meta and Season 1 decks. Settings: 23-deck round robin (7 meta, the 8 strongest other decks as incumbents, the 8 new decks), 24 games per pairing (6,072 games); one forge generation (lookahead bot, 112 games per test) under the evidence rule with the futility stop, keeping each deck's built-around packages, partner-aware cuts and package moves; explorers seeded from Rocker Units and Value-pairs; finals vs the meta (60 games per opponent, 420 per deck). The round robin was played before the forge, the finals after it.

| Deck | Method (parents) | Round robin (528 games) | Forge (held-out, paired) | Finals vs meta (420 games) |
|---|---|---|---|---|
| S2-03 Cross (RGY) | Smash the Curve × S1-07 Explorer (RYY) | 53.6% | adopted: Gear on Units → Arasaka Units, +15.6 pts [+6.9, +24.4], 224 games | **79.0%** |
| S2-02 Mutant (RGG) | RRG Dexter Midrange, Jackie: Mama's Favorite for Dexter | 63.8% | nothing nominated | **75.2%** |
| S2-07 Explorer (RRB) | Smasher / Johnny Silverhand / V: Corporate Exile, Rocker seed | 65.5% | could not tell (stopped early), −0.9 pts, 448 games | **73.8%** |
| S2-05 Counter (RRG) | S1-01 Mutant (RRY) × BBG Cunningham Econ | 65.7% | could not tell, +1.5 pts [−0.3, +3.2], 896 games | 71.2% |
| S2-06 Counter (RGG) | Ladder: V / Smasher / Saburo (RRG) × BBG Cunningham Econ | 57.8% | adopted: −1 Shattered Memories, +1 6th Street Recruits, +4.5 pts [+1.2, +7.8], 448 games | 69.3% |
| S2-04 Cross (RRG) | S1-01 Mutant (RRY) × Ladder: V / Smasher / Saburo (RRG) | 39.8% | adopted: Ahead on Street Cred → Even Street Cred, +8.9 pts [+2.8, +15.1], 224 games | 59.5% |
| S2-01 Mutant (RYY) | S1-01 Mutant (RRY), Rogue for Adam Smasher | 41.1% | could not tell, +3.6 pts [−0.2, +7.4], 896 games | 50.7% |
| S2-08 Explorer (GGY) | Goro / Muamar / Padre, Value-pairs seed | 35.2% | could not tell (stopped early), −0.2 pts, 448 games | 47.9% |

Incumbents that joined the leaderboard this season and played the same finals: Ladder: V / Smasher / Saburo (RRG) 69.0%, Ladder: Jackie / Alt / Hanako (BBG) 65.7%, NC-08 Merc Contract (RRG) 64.3%, Smash the Curve 61.7%, YYY Adam v1 54.3% (420 games each). The all-time leaderboard (Seasons page) now leads with S2-07 Explorer (RRB) at 74.7% raw vs the meta (588 games), S1-01 Mutant (RRY) 73.5% (756) and S2-02 Mutant (RGG) 73.6% (588). Details: `reports/season-2.md`, `reports/forge/`, `docs/ROADMAP2.md` "Season 2".

## Tournaments (7 events, hard bot)
| Event | Field | Games | Champion |
|---|---|---|---|
| #1 | 7 meta decks, Swiss 4 rounds Bo3 + top 4 | 37 | RRY Smasher Aggro |
| #2 | 7 meta decks, Swiss 4 rounds Bo3 + top 4 | 35 | RRG Dexter Midrange |
| #3 | all 39 active decks, Swiss 9 rounds Bo3 + top 8 | 435 | RRG Dexter Midrange |
| #4 | all 39 active decks, Swiss 9 rounds Bo3 + top 8 | 442 | S1-03 Mutant (RBG) |
| #5 | 7 meta + the 5 sim-ladder lists + the 8 Season 2 decks, Swiss 8 rounds Bo3 + top 8 | 212 | S2-07 Explorer (RRB) (final 2–1 over S2-06 Counter (RGG)) |
| #6 | all 47 active decks, Swiss 9 rounds Bo3 + top 8 | 530 | Smash the Curve (final 2–1 over Ladder: V / Smasher / Padre (RRG)) |
| #7 | all 47 active decks, Swiss 9 rounds Bo3 + top 8 | 530 | RRG Dexter Midrange (final 2–0 over S2-06 Counter (RGG)) |

The power ratings (Tournaments → Power ratings) fit all 2,221 games; each of the 47 decks has 62–150 games, so the 90% ranges are 11–19 points wide. The top ten: Ladder: Jackie / Alt / Hanako (BBG) 75.4%, RRG Dexter Midrange 73.7%, S2-06 Counter (RGG) 72.1%, Smash the Curve 70.0%, S2-03 Cross (RGY) 69.5%, S1-03 Mutant (RBG) 68.2%, S2-07 Explorer (RRB) 67.6%, S1-01 Mutant (RRY) 66.1%, S2-05 Counter (RRG) 64.5%, S2-02 Mutant (RGG) 61.8%. Going first was worth 1.8 points. Sim tiers (S ≥ 64%, A 55–64%, B 45–55%, C 36–45%, D < 36%): S 9, A 5, B 18, C 8, D 7 (was S 7, A 5, B 17, C 2, D 8 on 39 decks), none marked ±.

## What changed from the old report
- The decks bred, forged or optimised from the old results (seasons 1–5, the tournament builds and the RRG optimizer variants) left the active library for `data/decks/archive/`; they were not re-measured.
- The meta order is broadly the same at the top (RRG Dexter Midrange first, YYB second) but RRG's margin is larger on the current bots, and BBG Cunningham Econ sits mid-table (48.5%). Bots still under-play control decks, so treat BBG's number as a floor.

## Keeping it current
1. Refresh choom.gg data with `npx tsx scripts/import-meta.ts --force` and `npx tsx scripts/import-guides.ts --force`, then add any new lists with `npm run sim -- add`.
2. Run more seasons (`npx tsx scripts/season.ts`), more events (`npm run tournament`), then `npx tsx scripts/ratings.ts` and `npm run refresh`.
3. Re-running `npm run sim -- analyze` rewrites `src/data/impact.json`, which the Hard bot reads: do it before recording events, or bump `SIM_VERSION` (see `docs/ANALYSIS.md`).
