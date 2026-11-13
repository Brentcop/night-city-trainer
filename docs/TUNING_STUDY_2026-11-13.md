# Tuning and breeding: are they consistent and effective, and an at-a-glance evidence view

Study of 2026-11-13, made read-only by a reviewer agent at the owner's request ("both the tuning and breeders are not proving to result in consistent or effective results"). All games were played outside the recorded data, under SIM_VERSION 8 (≈ 168k Medium games and ≈ 3.5k Hard games, ≈ 45 min of wall time on 8–12 threads). The result files and the scripts that made them are in `reports/tuning-study-2026-11-13/` (the scripts were run from a scratch folder and import the repository by absolute path, so they are a record, not maintained tools; the two large raw logs were not kept). The build plan at the end is tracked in `docs/REVIEW_2026-11-13.md`.

## Summary

**Yes, the owner is right, for specific and fixable reasons.**

*The tuners are safe but nearly blind, and they forget everything between runs.*
- When the tuner adopts a change, the change is real: all 7 recorded adoptions re-measured positive on 2,800 fresh paired games, and none of them hurt.
- But the gains are about half the size claimed at adoption. S2-03's package swap claimed +15.6; re-measured it is +6.4. S2-06's swap claimed +4.5; re-measured it is +1.9.
- Runs disagree with each other because each one builds its shortlist from its own 112 games of card statistics, which are mostly noise. Five seeds on one deck screened 39 different changes out of 40, nominated 5 different changes, and adopted 2 different ones.
- Most real changes are smaller than one run can see. The forge's own single-card candidates are worth +1.0 points on average (SD 1.3; only 15% above +3), while one run adopts a change reliably only from about **+3.5 points (cards) and +6 (packages)**.
- So the typical honest answer is "could not tell", and every run starts again from zero.

*The breeders produce decks that look good under the bot of the day and then fall back.*
- The bred decks fell **15.1 points** from their season fitness (Deep, v5) to their Hard v8 rating vs the meta. Non-bred decks fell 1.4 points over the same change.
- 11 of 12 bred decks now rate below the mean of their parents (−11.5 points on average).
- Nothing tests a bred deck against its parent before it enters.

*Medium screening is a weak stand-in for Hard.* On Hard, the three changes re-checked kept about half their Medium gain in total (6.3 vs 12.9 points over the three; 560 paired games each), and one (+4.2 on Medium) showed +0.4 [−3.0, +3.7].

**The three numbers that matter most:**
1. **0 of 30** pairs of repeated runs on the same deck nominated the same single-card change, and only 1 pair nominated the same change of any kind.
2. **+1.0 vs +3.5**: what a typical candidate is worth, against the smallest gain a Standard run adopts 80% of the time.
3. **−15.1 vs −1.4 points**: how far the bred decks fell from their season fitness to Hard v8, against non-bred decks.

**The fix** is a persistent change ledger that pools held-out games across runs, keyed by list fingerprint, change and simulator version. Add a stable candidate shortlist taken from pooled (adjusted) card evidence instead of one run's noise, and runs sized and labelled by what they can detect. The same ledger feeds an evidence view in which every number is a citable *finding* with an interval, a game count, a strength word and a "measured vs association" label.

## How the tools work today

All four list tuners share one evidence rule (`src/lib/evidence.ts`, `ADOPTION_DEFAULTS`) and one budget model (`src/lib/deckSearch.ts`). They differ in how candidates are made and how many games screen them.

**Shared adoption rule** (`ADOPTION_DEFAULTS`): screening on shared seeds only nominates. Each nominee is confirmed on fresh seeds, paired game for game with the current list (same seed, opponent and seat), in stages of the builder's first-stage size, up to `capStages` = 4. α = 0.05 two-sided, nominees split by Bonferroni, looks by an O'Brien–Fleming-type spending function (`src/lib/groupSequential.ts`): z = 4.33 / 2.96 / 2.36 / 2.01 for one nominee. A nominee is adopted when the corrected lower bound is above `minGainPp` = 1 point with at least `minGames` = 200 games, and rejected when the upper bound is below 1 point. Otherwise the outcome is "could not tell", which is never adopted. The futility stop ends a nominee after 2 stages if its held-out mean is ≤ 0. Package moves use the same bar (`packageMinGainPp` = 1). Season 2 ran with the older Bonferroni split (z = 2.50 at every look).

**Candidate generation** (forge `scripts/builder-moves.ts` `forgeSwaps`, Lab `src/lib/deckLab.ts` `swapsAndCuts`, both alike):
- Each generation first plays the current list for `games` games with telemetry. From those games it computes each card's "Δ when drawn" (IWD) on that sample alone.
- Cuts are the 3 lowest-IWD cards, or with `--partner-aware` (`src/lib/cutRanking.ts`) the partner-present score plus a stranding cost.
- Adds are the list's own 2 best-IWD cards plus the 4 best legal cards by format-wide impact (`src/data/analysis.json`, which covers the 7 meta decks only).
- The tool forms cut × add pairs, keeps the top `cands` by prior (add score − cut score), and drops any that break the package plan.
- Package moves (complete / add / swap / remove, `tunerPackageMoves`) are added when switched on: 3 per generation.
- At search depth 2 or 3, pairs and triples of the best 4 screened singles are also built.
- The nominee is the best screened change if it beat the current list by ≥ 2 points on the shared screening games.

| Tool | Bot | Field | Screen games per candidate | Candidates per generation | Confirmation stages (cap) | Nominees | Default generations |
|---|---|---|---|---|---|---|---|
| Deck Lab tuner, Quick | Medium (or Hard by choice) | 7 meta (minus itself) | 56 | 4 (+3 package moves if on) | 112 (448) | 1 | 1 |
| Deck Lab tuner, Standard | 〃 | 〃 | 112 | 5 | 224 (896) | 1 | 2 |
| Deck Lab tuner, Thorough | 〃 | 〃 | 168 | 6 | 336 (1,344) | 1 | 3 |
| `scripts/forge.ts` default | `lookahead` = Medium | 7 meta (incl. itself) | 140 | 6 | 280 (1,120) | 1 | 2 |
| Season forge step (`season.ts` → forge) | Medium | 7 meta | 112 (`--forge-games`) | 5 + 3 package moves | 224 (896) | 1 | 1 |
| `scripts/optimize.ts` | Medium | 7 meta | 70 (`--screen`) | 40 (single-card and Legend swaps by `cardValue`) | 280 (1,120) | 6 | 1 (hill-climb) |

The Lab also adds a vs-original block of 4 × `games` per list after each adoption (`vsOriginalGames`). Confirmation always uses the screening bot (Medium by default), so the forge confirms on Medium and does not "confirm on Hard". In the Lab the user picks the bot; the default is Medium.

**Breeders.**
- *Season breeder* (`scripts/season.ts`, `src/ai/breeder.ts` `breedSeason`):
  - Parents come from `strengthOf` (`scripts/breed-data.ts`): the power rating halfway to its lower bound, blended 65/35 with the season leaderboard.
  - It breeds 8 decks: mutants (Legend swap plus a refit from per-deck impact), crossovers, counters (merges of the decks with the best head-to-heads against the "bosses") and explorers (a new Legend trio filled from format-wide impact).
  - No bred deck is filtered by games before it enters the season. All 8 play a round robin (24 games per pairing, Deep/Hard bot, with telemetry). The forge step then runs (1 generation, Medium). Finals are 60 games vs each meta deck, 420 games, Deep.
  - The leaderboard pools the round robin and the finals under one name, even when the forge changed the list between them (ROADMAP2 §7 "Remaining").
- *Lab breeder* (`breedInBrowser`): the same `breedSeason` on the browser library. Each bred deck gets a "quick test" of 56 Medium games vs meta at one fixed seed (`QUICK_TEST_SEED` 77,000), unpaired: a binomial 95% half-width of about ±13 points. That number is the only fitness the user sees before saving a deck.

**What carries over between runs:** nothing. Every forge, Lab or optimizer run re-measures the list from scratch (its own baseline, its own IWD, its own screening). The only carry-over is the game cache (`.cache/games/`), and it returns only the identical game for an identical job, so it adds no new evidence. A tuned record (`src/lib/tuneRecord.ts`) and the deck file's `// Forged` line store the outcome but not the per-game scores, so a later run cannot pool them.

## What the record says

Sources: `reports/forge/*.json` (Season 1, any-gain rule; Season 2, evidence rule; Medium bot, SIM v5), `data/seasons/{season-1,season-2,leaderboard}.json` (Deep bot, v5), `src/data/ratings.json` (Hard, 7 events, v8, re-recorded today), the deck files' `// Forged` lines, and `data/decks/custom/history/` (the pre-forge lists). Scripts: `forge-record.cjs` → `forge-record.txt`, `bred-record.cjs` → `bred-record.txt`.

**Everything except ratings.json predates today's SIM_VERSION 8.** The seasons and forge runs are v5. Three bot changes (v6, v7, v8) separate them from the current ratings, and each change moved 17–18 of 47 Sim-tier letters (IMPROVEMENT_BACKLOG Wave D).

### Forge outcomes on record
- **Season 1 (any-gain rule, 8 decks):**
  - 3 adopted on confirmation differences of +0.9, +0.4 and +4.9 points (224 games).
  - 2 rejected (−0.9, −2.2), 3 had nothing nominated.
  - No intervals were recorded. Under today's rule none of these would have been adopted.
- **Season 2 (evidence rule, 8 decks, 112 screening games, stages of 224 up to 896, Bonferroni z 2.50):**
  - 3 adopted: S2-03 package swap +15.6 [+6.9, +24.4] at 224 games; S2-04 package swap +8.9 [+2.8, +15.1] at 224; S2-06 single swap +4.5 [+1.2, +7.8] at 448.
  - 4 "could not tell": 2 at the cap (+1.5 [−0.3, +3.2] and +3.6 [−0.2, +7.4] over 896), 2 stopped for futility (−0.9 and −0.2 over 448).
  - 1 had nothing nominated. **0 rejected.**
  - So a confirmation ends adopted 3 of 7 times and could-not-tell 4 of 7, never rejected. The rule's reject arm (upper bound < +1) essentially never fires at these sizes.
- **Winner's curse (screen → held-out, the same nominees):**
  - Season 2: mean +8.2 → +4.7 over 7 nominees. Single cards alone +4.5 → +1.2.
  - E1 (this study, 13 nominees confirmed): single cards +4.4 → +2.6, packages +13.6 → +11.4.
  - Lab (ROADMAP2 §1, 14 nominees): +5.5 → +1.3.
  - Screening overstates the winning candidate by about 2–4 points every time.

### Do adopted changes hold up? (E2: each re-measured on 2,800 fresh paired games, Medium, v8, 400 per meta opponent, seats alternated)

| Change | Recorded at adoption (Medium v5) | Re-measured, Medium v8, 2,800 paired games | Ratio | Depends on the opponent? (χ²₆, crit 12.6) |
|---|---|---|---|---|
| S2-03 package swap Gear on Units → Arasaka Units (8 cards each way) | +15.6 [+6.9, +24.4], 224 g (screen +23.2) | **+6.4 [+4.2, +8.6]**, sd 0.61 | 0.41 | **yes, 29.7**: +18.8 vs BBG, +9.8 vs YYB, −2.5 vs RRY, +1.5 vs RRG |
| S2-04 package swap Ahead → Even Street Cred (2 cards) | +8.9 [+2.8, +15.1], 224 g | **+4.8 [+2.7, +6.8]**, sd 0.54 | 0.54 | no, 6.9 |
| S2-06 −1 Shattered Memories → +1 6th Street Recruits | +4.5 [+1.2, +7.8], 448 g | **+1.9 [+0.2, +3.6]**, sd 0.46 | 0.42 | **yes, 17.3**: +6.8 vs BBG, −4.0 vs YYB |
| S2-05 −1 We Gotta Live Together → +1 Yorinobu: Steel Dragon (not adopted, "could not tell") | +1.5 [−0.3, +3.2], 896 g (screen +5.4) | **+2.3 [+1.4, +3.1]**, sd 0.23 | — | no, 1.3 |
| Ladder BBG −1 Peace Offering → +1 MaxTac AV (forged 2026-11-10, any-gain) | not recorded | **+3.9 [+2.5, +5.4]**, sd 0.40 | — | borderline, 12.4 |
| Ladder RRB −1 Shattered Memories → +1 Yorinobu: Steel Dragon | not recorded | **+1.7 [+0.4, +2.9]**, sd 0.34 | — | no, 10.4 |
| Ladder RRG Padre −1 Field Operator → +1 MaxTac AV | not recorded | **+4.2 [+2.9, +5.5]**, sd 0.36 | — | no, 8.0 |
| Ladder RYY −1 Alt: Mother of Daemons → +1 Gorilla Arms | not recorded | **+2.1 [+0.9, +3.3]**, sd 0.33 | — | no, 7.6 |

Reading:
- **Every recorded adoption is still positive on Medium v8, but at 41–54% of the size claimed at adoption.** Two reasons: the curse of stopping at an early look (both package swaps were adopted at their first, 224-game look), and three bot changes since.
- The one "could not tell" re-measured here is a real +2.3 change that the rule could not see at 896 games.
- Seat made no difference beyond noise for any change (largest first − second gap 2.6 ± 2.6 points).

### How the bred and forged decks rate now (`bred-record.txt`)
- Against the field under Hard v8, the 12 bred decks with rated parents average **−11.5 points below the mean of their parents** (1 of 12 above) and **−15.5 below their best parent** (1 of 12 above, S1-01 Mutant at +0.2).
- Season fitness against the meta (Deep v5, 588–756 games per deck) averaged **59.8%** for the 16 bred decks. Their Hard v8 win rate against the meta averages **44.7%**: a drop of **15.1 points**. The 12 non-bred decks on the same leaderboard (meta, incumbents, ladder lists) dropped **1.4 points** on average under the same bot and version change.
  - So the bred decks' season numbers were inflated by something specific to them, not by the version change alone.
  - Candidates: selection on the Deep-v5 bot's own preferences (the breeder fills decks from impact measured by that bot); the leaderboard pooling pre- and post-forge lists; and a winner's curse in which decks are kept.
- Rank agreement between season fitness and Hard v8, over the 16 bred decks: Spearman ρ = 0.69.
- The forged Season 2 decks rate S2-03 45.9% [36.7, 55.4], S2-04 46.7% [37.4, 56.2] and S2-06 63.3% [54.6, 71.3] against the field, Hard v8. S2-03 reached 79.0% in the season finals (Deep v5, against the meta) and 41.8% against the meta now.

## Power

**How big real changes are (E3).** Every distinct candidate the forge screened in E1 was re-played on one fresh block of 1,120 paired games against the unchanged list: 54 single-card swaps and 29 package moves, on 2 decks, Medium v8, ≈ 95k games. Script `e3-candidates.ts` → `e3.txt`, `e3-candidates.json`; analysis `e3-analyze.cjs` → `e3-analysis.txt`.

| | Single-card swaps (n = 54) | Package moves (n = 29) |
|---|---|---|
| Mean measured effect | **+1.0 pts** | +0.6 pts |
| SD of true effects (noise removed) | **1.3 pts** | 5.0 pts |
| Share above +1 / +2 / +3 points | 35% / **20%** / **15%** | 38% / 28% / 21% |
| Share below 0 | 28% | 48% |
| Largest | +4.5 | +16.4 |
| Per-game SD of the paired difference | median **0.24** (0.04–0.30); 0.33–0.46 in E2's decks | median **0.49** (0.33–0.64) |
| Screening (56–112 games) vs truth | Pearson 0.40, Spearman 0.44 | Pearson 0.78, Spearman 0.62 |

The forge's own candidates are mostly worth less than 1 point. One in five beats +2, and none in this sample beats +5. Packages spread far wider: they are mostly harmful or useless, with a few large wins. Screening ranks packages reasonably and single cards poorly.

**What one run can detect.**
- Monte-Carlo of the exact staged rule: `ADOPTION_DEFAULTS`, the O'Brien–Fleming z's 4.33 / 2.96 / 2.36 / 2.01 from the repository's own `lookZs`, the futility stop and the 200-game minimum.
- Script `power.ts` → `power-empirical.txt`, `power-normal.txt`.

| Confirmation stages (cap) | Single card, sd 0.24: P(adopt) at +2 / +3; gain adopted 80% of the time | Package, sd 0.50: P(adopt) at +3 / +5; gain adopted 80% of the time |
|---|---|---|
| 112 (448) — Lab Quick | 14% / 40%; **+4.3** | 14% / 39%; **+7.8** |
| 224 (896) — Lab Standard, season | 24% / 69%; **+3.5** | 22% / 67%; **+5.8** |
| 280 (1,120) — forge default | 28% / 80%; **+3.2** | 26% / 74%; **+5.3** |
| 336 (1,344) — Lab Thorough | 32% / 86%; **+3.0** | 30% / 82%; **+5.0** |

At sd 0.35 (E2's single swaps) every single-card figure is about 1.4× larger (Quick ≈ +6).

**Reading.**
- The smallest gain a run reliably adopts (+3.0 to +4.3 for a card) is above 85% of the real single-card changes it generates.
- The whole pipeline, simulated with E3's measured effects as the truth (5 candidates per run, screen, nominate if ≥ +2, confirm):
  - Lab Quick adopts in 22% of runs, Standard 38%, Thorough 51%, forge default 48%.
  - The best of the candidates is worth +2.6 to +3.4. The screen picks it only 41–51% of the time and overstates its pick by 1.9–3.5 points.
  - When the pipeline adopts, the change is real (true gain under +1 in ≤ 1% of adoptions; mean +3.7). This agrees with E1 (6 adoptions in 15 runs) and E2 (every adoption re-measured positive).
- **So the rule is safe but nearly blind below +3.** "Could not tell" mostly means "a real +1 to +2 change the run was too small to see".

**Games needed** (one nominee, 80% power, paired, bar +1 point, z 2.0 at the last look): n ≈ ((2.0 + 0.84) · sd / (gain − 0.01))².

| True gain | sd 0.24 (typical card) | sd 0.35 | sd 0.50 (package) |
|---|---|---|---|
| +1.5 | 18,600 | 39,500 | 80,700 |
| +2 | 4,650 | 9,900 | 20,200 |
| +3 | 1,160 | 2,500 | 5,000 |
| +5 | 290 | 620 | 1,260 |

On Medium (≈ 200 games/s on 12 threads here), 4,650 paired games is 9,300 games ≈ 50 s. Settling a +2 card change is cheap on Medium, but not inside one 896-game confirmation. On Hard (≈ 4 games/s, with per-game SD about 1.3× Medium's, 0.31 vs 0.23 on the same swap) it is about 40 min per change. The +1 bar drives the cost: with a bar of +0.5 instead of +1, a +2 change needs about 2,100 games at sd 0.24.

## Consistency test (E1; all into the scratchpad, `--out`)

**Setup.**
- The forge with the Season 2 settings: `--gens 1 --games 112 --cands 5 --bot lookahead --keep-built-around --package-moves --adopt evidence` (partner-aware on, O'Brien–Fleming boundaries).
- Run on two decks with 5 different `--seed`s each. S2-05 Counter (RRG) is strong (≈ 57% vs meta on Medium). S2-08 Explorer (GGY) is weak (≈ 42%).
- Plus a Lab-Quick-like setting (`--games 56 --cands 4`, no packages) on S2-08, 5 seeds.
- 15 runs, ≈ 32k Medium games, v8. Script `e1-consistency.sh`, analysis `e1-analyze.cjs` → `e1-analysis.txt`, `e1-summary.json`.

| Deck / setting | Same list's screening win rate across seeds | Distinct candidates screened (of 5 × 8 or 5 × 4) | Candidates screened in every run | Nominees (5 runs) | Outcomes |
|---|---|---|---|---|---|
| S2-05, season setting | 52.7, 53.6, 56.3, 59.8, 62.5% | 39 of 40 | 0 | 5 different changes | 2 adopted, both different: package swap Behind on Gigs → Even Street Cred +5.1 [+1.9, +8.3]; −1 Swordwise Huscle → +1 Johnny Silverhand +2.9 [+1.1, +4.7]. 3 could not tell (+0.7, +1.6, +2.0 [+0.5, +3.6], all 896 games) |
| S2-08, season setting | 40.2, 40.2, 41.1, 42.9, 47.3% | 37 of 40 | 0 | 4 different changes, 1 run with none | 3 adopted: the package swap Face-up Legends → Blockers twice (+16.1 [+7.1, +25.0] at 448 games; +23.7 [+5.6, +41.7] at 224) and −1 Fool on the Hill → +1 Secondhand Bombus +4.0 [+1.3, +6.7]. 1 could not tell (+2.5 [+0.4, +4.5], 896) |
| S2-08, Lab-Quick-like | 39.3, 41.1, 41.1, 46.4, 48.2% | 18 of 20 | 0 | 4 different, 1 none | 1 adopted (−1 T-Bug → +1 Rockn' Rockerboy, +5.9 [+2.1, +9.9], 336). 3 could not tell (+1.1 to +2.0, 448) |

**Why the candidate sets differ.**
- The cuts are the 3 lowest "Δ when drawn" cards on that run's own 112 games. The 5 runs on S2-05 offered 9 different cut cards (Mantis Blades 3 times, We Gotta Live Together 3, Satori 2, Gunpoint 2, and five others once). On S2-08 they offered 10.
- At 112 games a card's Δ when drawn has a standard error of about ±10 points (seen in ≈ 65% of games: √(.25/73 + .25/39) ≈ 0.10). Even the associational Δ spreads only 3–4 points across cards (INFO-2), and real swap effects (E3) have an SD of 1.3 points. So the ranking that picks the cuts is mostly noise: reliability ≈ τ² / (τ² + se²) ≈ 0.1 at best.

**The reported intervals are honest; the problem is not hidden variance.** Each E2 change was split into twelve 224-game blocks (the size of one confirmation stage). The SD of the block estimates matches the SE the interval assumes:

| Change | Block SD (12 × 224 games) | SE the interval assumes at 224 games |
|---|---|---|
| S2-03 package | 4.7 | 4.0 |
| S2-04 package | 3.3 | 3.6 |
| S2-06 card | 3.7 | 3.0 |
| S2-05 card | 1.3 | 1.5 |
| BBG card | 1.7 | 2.6 |
| RRB card | 1.7 | 2.3 |
| Padre card | 3.1 | 2.4 |
| RYY card | 1.3 | 2.2 |

**Verdict.**
- Run to run, the tools agree on almost nothing: of the 30 pairs of runs on the same deck and setting, 1 nominated the same change, and 0 the same single-card change. They agree only when a change is large: the S2-08 package swap worth about +15 on Medium came up in 2 of 5 runs and was adopted both times.
- What a run adopts is usually real but small. What it does not adopt is mostly "could not tell", not "no effect". The three S2-05 could-not-tells at +0.7 to +2.0 are the size of real changes the rule cannot settle in 896 games.

## Causes, confirmed and ruled out

Ranked by how much each explains, with the evidence for each.

1. **CONFIRMED, the main cause of inconsistency: the candidate shortlist is drawn from one run's noise.**
   - Cuts come from "Δ when drawn" on that generation's own 112 screening games, where each card's SE is about ±10 points. Real single-card swaps have true effects with a mean of +1.0 and an SD of 1.3 points (E3).
   - Result: 37–39 distinct candidates out of 40 screened across 5 seeds, and 0 candidates common to all runs (E1). The forge is effectively sampling a random shortlist each run, so runs cannot agree.
2. **CONFIRMED, the main cause of "not effective": most real changes are below what a run can detect.**
   - E3 measured every candidate the forge screened, on 1,120 fresh paired games each. Single-card swaps average +1.0 points, only 20% exceed +2 and 15% exceed +3 (see Power). The detectable gain for one run is +3 to +4 points for a card and +6 to +8 for a package (80% power).
   - So the typical outcome is "could not tell", and adopted changes are the few large ones plus lucky draws of moderate ones.
3. **CONFIRMED: no evidence accumulates between runs.**
   - Every forge, Lab and optimizer run starts from zero (code: `tuneDeck`, `forge()`; the game cache only replays identical jobs).
   - The S2-05 swap −1 We Gotta Live Together → +1 Yorinobu was confirmed for 896 games in Season 2 (+1.5 [−0.3, +3.2], could not tell). It was screened again in E1 run 3 (+4.5, not the best). It measures +2.3 [+1.4, +3.1] on 2,800 games (E2) and +1.3 ± 1.2 on another 1,120 (E3): a real change of about +2 that no single run can settle, while the evidence for it is thrown away each time.
4. **CONFIRMED: screening's winner's curse plus stopping at the first look overstates adopted gains by about 2×.**
   - Screening reads 2–4 points above held-out for the winning candidate (Season 2, E1, Lab).
   - Adopted changes re-measured on 2,800 games are 41–54% of the held-out figure claimed at adoption (S2-03 15.6 → 6.4, S2-04 8.9 → 4.8, S2-06 4.5 → 1.9). Part of that drop is three bot versions.
   - The direction is right in all 7 adopted changes re-measured (all lower bounds ≥ 0.2 on Medium v8). So the rule does not adopt harmful changes; it reports them too large.
5. **CONFIRMED for decks, PARTLY for changes: the bot measuring is not the bot that counts, and the bot keeps changing.**
   - Decks: the bred decks fell 15.1 points from Deep v5 season fitness to Hard v8 ratings, against 1.4 points for non-bred decks (`bred-record.txt`). Rank stability Medium vs Hard was ρ 0.36 on the meta (v5) and 0.87 over all decks (v6).
   - Changes, Medium v8 → Hard v8 on the same seeds layout (E2 Hard, 560 paired games each):
     - S2-03 package +6.4 → **+4.8 [−0.5, +10.2]**
     - S2-05 swap +2.3 → **+1.1 [−1.5, +3.6]**
     - Ladder Padre −1 Field Operator → +1 MaxTac AV +4.2 [+2.9, +5.5] → **+0.4 [−3.0, +3.7]**
   - Summed, Hard shows about half the Medium gain: 6.3 against 12.9 points over the three.
   - For Padre the gap (3.8 ± 3.6 at 95%) is borderline evidence that a Medium-adopted single card does nothing on Hard.
   - So a Medium adoption is at best half-reliable as a Hard improvement. The S2-03 deck is 38.6% vs meta on Hard before its change and 43.4% after: the change helps a little, but the deck is weak under Hard whatever the forge does.
   - The paired SD per game is higher on Hard (0.31 vs 0.23 for the same swap; 0.65 vs 0.61 for the package), so Hard confirmation needs 1.1–1.8× the games for the same interval (0.41 vs 0.36 for Padre).
6. **CONFIRMED: changes that matter in one matchup are averaged away.**
   - 2 of 8 re-measured changes are significantly opponent-dependent (χ²₆ 29.7 and 17.3 against a critical value of 12.6). S2-03's swap is +18.8 against BBG Cunningham and −2.5 against RRY Smasher. S2-06's is +6.8 against BBG and −4.0 against YYB.
   - Today only the pooled number is reported. And the field is fixed to the 7 meta decks with equal weight (`forge.ts`: `kind === 'meta'`), while ratings are against all 47.
7. **CONFIRMED for the breeder: selection on noisy and stale fitness, with no test before entry.**
   - Season parents are ranked by `strengthOf`. Bred decks are never compared with their parent before they enter. The leaderboard pools a forged deck's pre-forge round robin with its post-forge finals.
   - The Lab breeder's only fitness is 56 unpaired Medium games (±13 points).
   - Result: 11 of 12 bred decks rate below the mean of their parents under Hard v8 (−11.5 points on average).
8. **RULED OUT as a main cause: dishonest intervals or hidden variance.** The SD of twelve 224-game block estimates matches the interval's SE for all 8 changes (Consistency test). The paired design works as intended: for single cards, 79–100% of paired games end with the same result.
9. **RULED OUT as a main cause: first-player variance.** The designs already balance seats (`first = floor(k / 7) % 2`), and no change showed a seat interaction beyond noise (largest first − second gap 2.6 ± 2.6 points).
10. **MINOR: multiple comparisons.**
    - Within a decision they are handled: Bonferroni across nominees and O'Brien–Fleming across looks. The synthetic false-adopt rate is ≤ 2.5% per decision.
    - Across repeated runs of the same deck nothing corrects. With 5 runs and 1–2 nominees each, the chance that some run adopts a change whose true gain is under 1 point is about 5–12%. E3 shows few candidates with a true gain just under the bar, so in practice this is small.
11. **MINOR: partner-aware ranking and package constraints steering the search.**
    - In E1 the plan bound rarely. The partner-aware score changes the order of cuts but is built from the same 112 games, so it inherits cause 1.
    - The package-move generator proposed "Block, then punish" in 7 of 10 season-setting runs. It measured −5.1 to −5.7 on S2-05 and +1.1 to +2.2 on S2-08 (E3), so the same move is repeatedly re-tested at full cost while the ledger that would remember it does not exist. The catalogue, not the deck, drives which package moves are tried (also noted in ROADMAP2 §7).
12. **NOT MEASURED directly: the bot piloting a newly added card badly** (so that a card's measured value is the bot's skill with it).
    - Indirect evidence: `cardValue` correlates weakly with measured impact (mean ρ 0.32; INFO-7), and ROADMAP2 §4 notes Gear and "can't attack" cards the bots never play.
    - A direct measurement would compare each added card's play rate and turn-played in the candidate's games against the same card in decks built around it, from telemetry (`trace: true` on the confirmation games). About 0 extra games, since it can be recorded in the next forge run.

## What would make them effective (ranked by expected benefit for cost)

1. **A persistent change ledger that pools held-out evidence across runs (P1).**
   - *What it fixes:* "could not tell" stops being a dead end. Today the S2-05 Yorinobu swap (about +2 real) ran 896 games in Season 2 and was screened again in E1, and every run started from nothing. Pooled within v8 only (the ledger must not mix versions), the 2,800 + 1,120 games measured in this study give +2.0 [+1.3, +2.7]. Its lower bound at z 2.01 is +1.3, so it would be adopted.
   - It also makes repeated runs converge on an answer instead of producing a different one each time.
   - *Needs:* per-game score pairs stored by change key and SIM_VERSION. Pooling only within the same version, bot and field.
   - *Cost:* no games. A small store, about 10 bytes per game.
   - *Won't fix:* the screen picking different candidates each run (that is #2), and Medium vs Hard (#5).
2. **Stable candidate generation from pooled, adjusted card evidence, not one run's 112 games (P5 + P2).**
   - *What it fixes:* the 37–39 distinct candidates in 40 screened per deck. With a fixed, better-informed shortlist, repeated runs test the same changes and the ledger accumulates.
   - *Needs:* the shrunk adjusted impact (`impactAdjusted.ts`), stored per list; else the ledger; else IWD pooled over all games of the list ever played.
   - *Cost:* about 600 Hard games per deck once (adjusted impact), or Medium at 1/17 of the cost.
   - *Won't fix:* association bias. Adjusted impact is still association; it only chooses what to test.
3. **Size runs by power, and say what a run can detect (P4).**
   - Today a Lab Quick run adopts a +3-point single-card change only 46% of the time (see Power), and a package move worth +5 only 40%. Most real single-card changes are smaller than that (E3).
   - *Change:* print the detectable gain before a run; make Standard the Lab default; add "until settled" (keep confirming one nominee up to `gamesToSettle`).
   - For a +2-point change at sd 0.30, 80% power against the +1 bar needs about (2.0 + 0.84)² × 0.30² / 0.01² ≈ 7,300 paired games. At sd 0.23, about 4,300. That is affordable on Medium (≈ 1 minute) but not inside one 896-game confirmation.
   - *Cost:* none to build; more games per run by choice.
4. **Report per matchup and per seat; stratify the interval (P6).**
   - 2 of 8 re-measured changes were significantly matchup-dependent (S2-03: +18.8 vs BBG, −2.5 vs RRY; S2-06: +6.8 vs BBG, −4.0 vs YYB). The pooled average hides a counter-change.
   - The design is already balanced (each opponent × seat equally often), so a stratified interval narrows little. The benefit is the explanation, not power.
   - *Cost:* none; the per-game vectors already exist inside each run.
5. **Confirm on Hard what Medium screens, at least for package moves (P6 flag).**
   - The rank-stability figures say Medium and Hard disagree on decks (ρ 0.36 on the meta in v5, 0.87 across all decks in v6), and the bred decks fell 15 points from Deep v5 to Hard v8.
   - Whether a *change* transfers is what the Hard check in this study measures (see Causes).
   - *Cost:* Hard is 17× Medium per game, so confirm only the single nominee, about 1,100 Hard games ≈ 4 min.
6. **Breeder: gate bred decks by a paired test against the parent before they take a slot, and stop pooling pre- and post-forge lists (P7).**
   - Bred decks rate 11.5 points below their parents' mean under Hard v8. Nothing in breeding tests a deck before it is entered.
7. **Futility earlier, confirmation longer.**
   - The futility stop (mean ≤ 0 after 2 stages) never fires on the real changes measured here: they are mostly +1 to +3, so they run to the cap and end "could not tell".
   - A conditional-power futility rule ("even at the cap, the chance to clear +1 is below 10%") would stop the hopeless ones sooner and give the saved games to the live nominee.
   - Smaller benefit than #1–#3, because the main waste is not the futile nominees but the starting from nothing.
8. **Test packages, not cards, when single cards are below the detectable size.**
   - Package-sized changes in the record are 2–3× larger than single cards: E2 package swaps +6.4 and +4.8 against single cards +1.7 to +4.2; in E3 packages range from −5.7 to +16.4 while single cards top out at +4.5. Their SD per game is also higher (0.54–0.61 against 0.23–0.46).
   - Package moves therefore pay off only when the package is real, and that is what the catalogue is for.
   - *Won't fix:* the catalogue's draft quality. ROADMAP2 §7 notes the move generator proposes the same two packages for five of eight decks.

Not recommended: a lower adoption bar or the any-gain rule. The intervals are honest (block SDs match), and the false-adopt rate is low. The problem is power and starting from zero, not the bar.

## Inventory of existing statistics

"v8" means re-recorded on 2026-11-13 under SIM_VERSION 8. Everything marked v5 predates three bot changes (v6 fitted weights, v7 sell lookahead, v8 review fixes). Each of those changes moved 17–18 of 47 Sim-tier letters.

| # | Statistic | Computed in | Stored (file → field) | Unit | Uncertainty given | Sample / freshness | Shown on the site |
|---|---|---|---|---|---|---|---|
| 1 | Power rating, expected win rate vs field and vs meta | `scripts/ratings.ts`, `src/lib/ratingModel.ts` | `src/data/ratings.json` → `decks[].rating, se, wrField, wrFieldLo, wrFieldHi, wrMeta`, `firstPlayerEdge` | logit; win % | 90% range, full covariance | Hard, 7 events, 2,264 games, 61–153 per deck; v8 | Ratings page, deck profile header, tier badges |
| 2 | Sim tier | `src/lib/simTier.ts` (read time) | derived from #1 | letter S–D, ± | ± when the 90% range reaches 2 bands; unrated under 20 games | as #1 | tiles, pickers, profile, Ratings, standings |
| 3 | Swiss / top-cut records, titles, top 8s | `scripts/tournament.ts`, `scripts/event-pool.ts` | `public/tournaments/event-N.json` → `standings, bracket, champion`; `ratings.json → titles, top8, matches, gamesRecord` | W–L | counts only | Hard, Bo3; v8 | Tournaments page, DeckRecord panel |
| 4 | Head-to-heads, raw and shrunk | `scripts/build-h2h.ts`, `src/lib/h2hModel.ts` | `public/data/h2h.json` → `pairs [i,j,wins,games]`, `model.ratings`, `shrunk[]` | win % | raw counts; shrunk estimate (no interval in the file) | Hard events; v8; 1–11 games per pair typical | Deck profile "Head-to-heads", Lab breeder counters |
| 5 | Seat split (first/second) | `src/analysis/analyze.ts` | `src/data/analysis.json` → `decks[].wrFirst, wrSecond`, `matchups[].wrFirst/wrSecond`; `review.json → firstPlayerWinRate`; `ratings.json → firstPlayerEdge` | win % | none (n given) | Deep(=Hard), 7 meta decks × 1,200 games; v8 | Insights page, guides |
| 6 | Card impact "Δ when drawn" (IWD) | `src/analysis/analyze.ts` | `analysis.json → decks[].cards[] {seenGames, wrSeen, wrNotSeen, iwd, playedGames, wrPlayed, avgPlayTurn, soldRate, wrOpening}`; `src/data/impact.json → decks[].cards [id, iwd, seenGames]` | points | none | 7 meta decks only, 1,200 games each; v8 | Insights, Cards, coach tips, Lab cut table |
| 7 | Adjusted impact (landmark, opponent × seat, shrunk) and kept-vs-sold | `src/analysis/impactAdjusted.ts` | only in an `--out` dir (`impact-adjusted-latest.json`); nothing committed | points | 95% CI, shrinkage | last run v6-era scratch (INFO-2: 2,100 games, median half-width 7.7 pts) | not shown |
| 8 | Decision telemetry: card use by mode, stage, Gig standing; calibration | `src/engine/telemetry.ts`, `src/analysis/decisions.ts` | `public/data/decisions.json` → `decks[].cards[].modes[].{all,stage,standing}.{uses,games,winRate,low95,high95,thin}`, `calibration` | win % when used | Wilson 95%; `thin` flag | 7 meta decks, 4,200 games; v8 | Card stats (DecisionStats) |
| 9 | Synergy packages: assembled / online rates by round, expected draw odds, win online vs never | `src/analysis/synergies*`, `src/content/synergies/` | `public/data/synergies.json` → `decks[].synergies[] {assembledRate, byRound[].{assembled,online,expected}, assembled.winRate…}`, `pooled` | rate; win % | Wilson 95%; slices < 20 games not rated | 47 decks, ~276 games each; v8 | Card stats → Synergies, deck profile "Synergies in this list" |
| 10 | Package lift (online vs never) | `src/ai/packageLift.ts` | from #9 | points | interval; named only when above 0 | as #9 | coach wording only |
| 11 | Draw odds of a package in a list | `synergiesIn(deck)` | computed live | probability by turns 2/4/6 | exact | always current | deck profile |
| 12 | Forge screening deltas, nominee screen and held-out gains, outcome | `scripts/forge.ts`, `src/lib/evidence.ts` | `reports/forge/<deck>.json` → `gens[].swaps[].delta`, `gens[].nominees[].{screen,heldOut,outcome,stopped}`, `cuts[]`; deck file `// Forged`, `// Adoption` lines | points | screen: plain 95%; held-out: corrected z | Season 1 (any-gain) and 2 (evidence); Medium v5 | Deck profile "Forge history" (bundled) |
| 13 | Lab tuner log: screening, nominees, held-out gain, vs-original trajectory | `src/lib/deckLab.ts` `tuneDeck`, `src/lib/tuneRecord.ts` | browser only: `StoredDeck.tuned` (localStorage); manifest `tune` field | points | paired interval + games | per run; whatever bot version ran it | Lab result panel, `TuneTrajectory`, `#/tuned` |
| 14 | Optimizer stage-1/2 results | `scripts/optimize.ts` | `reports/optimize-*-latest.json` | points | interval per nominee | old runs | Deck profile "Optimizer suggestions" |
| 15 | Breeder fitness: `strengthOf`, season leaderboard | `scripts/breed-data.ts`, `scripts/season.ts` | `data/seasons/leaderboard.json → metaW, metaG, seasons{}`; `season-N.json → standings[].wr`; `src/data/seasons.json` | win % vs meta | none | Deep v5, 588–756 games per bred deck | Seasons page, deck profile "Season results" |
| 16 | Lab breeder quick test | `DeckLab.tsx` BreedPanel | browser state only | win % | none (±13 pts at 56 games) | per click | Lab breed tab |
| 17 | Rank stability Medium vs Hard | `scripts/rank-stability.ts`, `src/lib/rankStability.ts` | `--out` only; numbers in docs/BOT_TOOLKIT.md §11 | Spearman ρ | bootstrap 95% | v5 (meta ρ 0.36), v6 (all ρ 0.867) | not shown |
| 18 | Tempo, game length, overtime, win reasons, Gig-diff curve | `analyze.ts` | `analysis.json → decks[].tempo[], avgTurns, overtimeRate, overtimeWr, winReasons, diffCurve, matchups[].{wr,avgTurns,topCards}` | win %; turns | n only | 7 meta decks; v8 | Insights page, guides |
| 19 | Package scoring (bot weights) | `scripts/package-scoring.ts` | `reports/package-scoring-2026-11-11.md` | points | paired interval | v5 | not shown |
| 20 | Season card impact | `scripts/breed-data.ts` | `data/seasons/impact.json`, `deck-impact.json` (keyed by deck name) | points | none | v5 | breeder input only |
| 21 | Game review / coach scorecard | `src/lib/gameReview.ts`, `src/ai/coach.ts` | browser (`nct.gameReviews.v1`, practice log) | rating per move; Gigs | paired SE | per user game | Profile, Game review |

**Gaps that matter for "why":**
- Card-level numbers exist only for the 7 meta decks (#6, #8). Card-level adjusted numbers (#7) are never stored.
- No per-change ledger: every tuning measurement (#12, #13) is kept as a summary, never as per-game scores, so runs cannot be pooled.
- Nothing records a change's effect per matchup or per seat. All the per-matchup data are per-deck win rates (#4, #5, #18).
- Season fitness (#15) is v5 and pooled across forged and unforged lists.

## Proposed evidence view

### The common building block: a *finding*

Every number on the three screens is a **finding**: one record, plain data, with a stable id. The site never shows a bare number. It shows a finding.

```ts
// src/lib/findings.ts (new, pure; Node and browser)
interface Finding {
  id: string;            // stable, content-addressed: `${kind}:${subject}:${hash(measurement key)}`, e.g. "chg:9f3a…:+yorinobu_steel_dragon/-we_gotta_live_together"
  kind: 'deck-strength' | 'matchup' | 'seat' | 'length' | 'card-assoc' | 'card-ablation' | 'package-assoc' | 'package-ablation'
      | 'change' | 'run' | 'bot-transfer';
  subject: { listId: string; deck: string; card?: string; package?: string; opponentListId?: string; change?: ChangeKey };
  estimate: number;      // points (or win rate for deck-strength)
  lower: number; upper: number; level: 0.9 | 0.95; // interval and its level, stated
  games: number;         // effective games behind it
  method: 'paired-ablation' | 'paired-ablation-pooled' | 'rating-model' | 'association' | 'association-adjusted' | 'shrunk';
  causal: boolean;       // true only for paired ablations (the list with vs without the change, same seeds)
  strength: 'strong' | 'moderate' | 'weak' | 'not-enough';   // from the rule in "Honesty rules"
  simVersion: number; bot: string; field: string;            // what it was measured under
  sources: { file: string; field: string }[];                // provenance, e.g. ratings.json#decks[12].wrField
  family?: { size: number; correction: 'bh' | 'bonferroni' | 'none' }; // multiple-comparison context
  stale?: string;        // "measured under v5; the bot changed 3 times since" when simVersion < current
}
```

How a finding gets a stable reference:
- The id is a hash of *what was measured*, never of the result: list fingerprint, change key (sorted adds and cuts by card id), opponent list id, bot and SIM_VERSION. The same measurement re-run with more games keeps its id, and its numbers update. A different bot or version gets a new id, and the view links the two as "same question, older measurement".
- Link: `#/evidence/<listId>?f=<findingId>` scrolls to and highlights the finding. `#/evidence/run/<runId>` opens a run. `#/evidence?f=<id>` resolves any finding.
- The "cite" button copies `[F:<short id>] <one-line claim> (<estimate> [<lo>, <hi>], <games> games, <bot> v<sim>)`, for example `[F:9f3a2c] −1 We Gotta Live Together → +1 Yorinobu: Steel Dragon: +1.2 pts [−0.1, +2.5], 6,112 games, Medium v8`.

### (a) Per-deck evidence view (`#/evidence/<listId>`, a tab on the deck profile)

The view answers five questions, in this order. Each question is one block. Its first line is a sentence, followed by a compact table of findings.

1. **How good is it, and how sure are we?**
   - Sentence: "Expected 63% against the field (90% range 55–71%, 75 Hard games, v8); tier A, could be B or S."
   - Feeds: #1 and #2 of the inventory.
   - Beside it, a *bot-transfer* finding when one exists: the Medium vs Hard win rate on the same deals (from rank-stability runs), with the warning "Medium rates this deck 12 points higher than Hard".
   - Data that exist: ratings.json. The bot-transfer line needs a per-deck Medium-vs-Hard measurement: about 700 games per deck per bot (cost: 47 decks × 700 × 2 ≈ 66k games, of which Hard ≈ 33k ≈ 2 h on 16 threads).
2. **Where does it win and lose?**
   - A matchup strip: one cell per opponent, shrunk h2h estimate (#4) with games, coloured by a strength word, sorted worst first.
   - Seat: first vs second (#5).
   - Game length: win rate by game-length tercile; how losses end (#18 `winReasons`).
   - Data that exist: h2h.json (shrunk) for all 47 decks. Seat, length and win reasons exist for the 7 meta decks only. For other decks they need an `analyze` run with `--deck` (about 600 Hard games per deck), or reading recorded event games, which already hold seat and turns.
3. **What carries it, and what is dead weight?**
   - Two lists of cards, each card with one finding. The ablation is shown when one exists. Otherwise the adjusted association, labelled "association".
   - Package rows: assembled and online rates by turn (#9), online-vs-never lift (#10) labelled as association, and draw odds (#11).
   - "Dead weight" is shown only for an ablation finding: the list without the card (cut for a neutral filler or a basic land equivalent) is not worse, with an interval. Association can only say "looks weak; not measured".
   - Data that exist: adjusted impact (#7), but only if it is stored (build package 2). Ablations need new games, sized in the build plan: about 1,700 paired games per card at sd 0.22 for ±1 point. Do it only for the 6–8 cards the association marks as extremes, about 12k Medium games per deck.
4. **What changed it, and did it hold?**
   - The deck's change history from the ledger. One line per change: the screen estimate (greyed, "screening, optimistic"), the held-out estimate, any later re-measurements, and the events since.
   - An arrow shows drift, for example "+15.6 at adoption (224 games, v5) → +6.4 now (2,800 games, v8)".
   - Data that exist: forge JSON (#12) and deck-file lines. The re-measurements are new (the ledger, build package 1).
5. **Open questions.**
   - The changes tried that could not be told apart, with the games needed to settle each at the current pooled variance.
   - This is what a person would run next. It is generated from the ledger.

Data shape behind the page: `public/data/evidence/<listId>.json` = `{ listId, deck, simVersion, findings: Finding[], changes: LedgerSummary[], open: OpenQuestion[] }`, built by `scripts/build-evidence.ts` from ratings, h2h, analysis, synergies, the ledger and adjusted impact. It is lazy-loaded like h2h.

### (b) Per-run view (`#/evidence/run/<runId>`; also the Lab's result panel and the forge's markdown)

- **Header:** deck, field, bot, SIM_VERSION, rule (`describeRule`), games played, seed base. Then **what this run could detect**: "with these budgets, a single-card change is adopted 80% of the time only if it is worth ≥ +3.2 points (Standard), and a package move only if it is worth ≥ +6.0". This comes from `detectable()` (build package 3), at the run's own measured paired SD.
- **Trials table:** one row per candidate.
  - Columns: label, kind (card / package / combo); why it was a candidate (cut reason from `cutRanking`, the add's source); screen estimate ± interval and games, greyed and marked "screening, optimistic by about +2–3 pts for the winner"; held-out estimate ± corrected interval and games, with the looks used; the outcome word; the pooled estimate from the ledger across all runs, if any (this is the column that makes runs add up); and a per-matchup sparkline of the held-out difference with a heterogeneity flag (χ² across opponents).
  - Rows not nominated show why: "screened below +2", "not the best", "the plan forbids it".
- **Decision line:** "Adopted X: +4.5 [+1.2, +7.8], 448 games; the rest were not adopted because …"
- **Ledger delta:** what this run added to the pooled evidence for each change.
- Data shape: the existing `NomineeRecord` plus the per-game score vectors appended to the ledger, and `RunRecord = { runId, manifest, rule, depth, detectable, trials: TrialRecord[] }`, where `TrialRecord = { changeKey, label, kind, why, screen, heldOut?, outcome?, byOpp?: {opp, mean, se, n}[] }`.

### (c) Cross-deck overview (`#/evidence`)

- **Top findings:** the 10–15 strongest, best-supported findings across the library. Sort by strength, then by |estimate| / SE.
  - Causal findings (ablations, adopted changes re-measured) come first.
  - Association findings appear in a separate panel titled "Patterns worth testing (association)".
- **Tool health:** for each tool (Lab, forge, season, optimizer), the share of nominees adopted, rejected and could-not-tell; the mean screen minus held-out gap (the winner's curse, measured); the mean held-out at adoption minus the later re-measurement (regression); and run-to-run agreement (the share of repeated runs that nominate the same change). This is the screen that answers the owner's question directly, and it is built from the ledger.
- **Bot and version drift:** the rank-stability ρ (Medium vs Hard) and, per SIM_VERSION change, how many tier letters moved. Every finding older than the current version is marked stale.
- Data shape: `public/data/evidence/index.json` = `{ top: Finding[], health: ToolHealth[], drift: {...}, simVersion }`.

### What exists today versus what needs measuring

| Block | From data that exist | Needs a new measurement (cost) |
|---|---|---|
| a1 strength | ratings.json, simTier | bot-transfer per deck: about 700 games per deck per bot (optional) |
| a2 matchups, seat, length | h2h shrunk (47 decks); analysis.json seat/length (7 meta decks) | seat and length for the other 40 decks from the recorded event games (no new games; the event JSON has seat and turns) |
| a3 cards and packages | synergies.json (47 decks); IWD and decisions (7 meta decks) | store adjusted impact: one Hard `analyze --impact-adjusted` per deck, about 600 games each, ≈ 28k Hard games for 47 decks (≈ 1.8 h); ablations for 6–8 cards per deck ≈ 12k Medium games per deck (≈ 3 min) |
| a4 changes | forge JSON, deck-file lines, tuned records | the ledger (no games); re-measurements on demand, about 2,800 paired games per change (≈ 1 min Medium) |
| b run view | NomineeRecord, TuneLog | per-matchup splits (no games: compute from the per-game vectors the run already plays) |
| c overview | all of the above | the tool-health numbers need the ledger to accumulate runs |

## Honesty rules for the view

1. **Two kinds of number, never mixed in one column.**
   - *Measured effect* (`causal: true`): a paired ablation, meaning the same list with and without the change on the same seeds, opponents and seats. Only these may use the words "adds", "costs", "worth" or "dead weight".
   - *Association* (`causal: false`): IWD, adjusted impact, kept vs sold, decision telemetry, package online-vs-never. Wording is fixed: "games where X was drawn/used were won N points more often". Each one carries a grey "association" chip and a one-line reason it may mislead (drawn more in long games; the bot sells what looks bad; packages come online when already ahead or behind). The overview keeps associations in their own panel titled "Patterns worth testing".
2. **Strength word, by a stated rule** (`strengthOf(finding)`, pure, unit-tested). Use the interval at the family-corrected level:
   - *strong*: the corrected 95% interval excludes 0 **and** the effect is at least 1 point **and** games ≥ 1,000 (paired) or ≥ 200 (rating model). For associations, the bar is also cleared by the adjusted, shrunk estimate.
   - *moderate*: the plain 95% interval excludes 0, but the corrected one does not, or games fall below the strong threshold.
   - *weak*: the point estimate is ≥ 1 point but the interval includes 0.
   - *not enough*: |estimate| < 1 point with an interval wider than ±2, or games below the minimum (paired < 200, association slices < 20, ratings < 20). These are shown as "not enough games: N more would settle it" (from `gamesToSettle`), never as a number in bold.
3. **Multiple comparisons.** A per-deck card table is a family of about 20–40 tests, and a run's trials are a family too. Inside each family:
   - Use Benjamini–Hochberg at q = 0.10 for the strength word.
   - Show the family size beside the table ("ranked from 34 cards; about 2 of the 'moderate' ones are expected by chance").
   - The cross-deck overview counts its whole candidate pool as the family.
   - Adoption keeps its own Bonferroni and O'Brien–Fleming correction (unchanged).
4. **Screening numbers are labelled optimistic.**
   - A screening estimate is never shown without "screening; the best of N reads about +X too high". X is the measured curse from the ledger: today +1.8 pts for single cards and +2.2 for packages in the E1 runs; +5.5 → +1.3 in the Lab's 14 nominees.
   - A held-out estimate from a stage that stopped at its first look is marked "stopped early: likely optimistic". Sequential stopping inflates the estimate: S2-03 read +15.6 at a 224-game first look, and +6.4 on 2,800 games.
5. **Small samples.** An interval is always shown. Below the minimums the number is replaced by "not enough games". Head-to-heads use the shrunk estimate, with the raw count beside it.
6. **Older simulator versions.**
   - A finding measured under a SIM_VERSION or bot other than the current one is shown with a "measured under v5 (Medium); not re-measured" chip and greyed.
   - It is excluded from the overview's top findings and from "strong".
   - The ledger never pools across versions. A re-measurement under the new version creates a linked finding, and the view shows the drift.
7. **Bot dependence.** Every finding names its bot. A Medium-measured change carries "Medium only; Hard not measured" until a Hard confirmation exists. Rank-stability ρ (Medium vs Hard) is printed in the overview.
8. **Matchup-specific effects.** When the per-opponent χ² flags heterogeneity (p < 0.05), the pooled number is shown with "depends on the opponent" and the per-opponent strip. A pooled average is never called "the effect" in that case.

## Build plan

The packages are ordered so that each one is useful on its own. P1–P3 change no game result and need no SIM_VERSION bump. P4–P6 change what the builders adopt, not how games play. None of them touches the bots.

### P1 — Change ledger (persistent, pooled evidence). Highest value.
- **Files:**
  - New `src/lib/changeLedger.ts` (pure, Node and browser): `ChangeKey` = list fingerprint + sorted cut ids + sorted add ids (+ Legend slot changes). `LedgerEntry = { key, simVersion, bot, field: fieldFingerprint, games: [{ seed, opp, first, base, cand }] }`, stored as compact score pairs, not summaries. Functions: `pool(entries)` (paired mean / SE / per-opponent / per-seat, only within one simVersion + bot + field), `gamesToSettle(entry, minGainPp, z)`.
  - New `scripts/ledger-store.ts`: Node store under `data/ledger/<listId>.jsonl`, committed and small (each game is 2 small numbers and a seed). Browser store: IndexedDB `nct.ledger.v1`, plus export/import as `kind: 'nct-change-ledger'`, schema 1.
  - Wire `scripts/forge.ts`, `scripts/optimize.ts`, `season.ts` (via forge) and `src/lib/deckLab.ts` `tuneDeck` to append every screening and confirmation pair they play.
  - `confirmStaged` gains an optional `prior: PairedScores`. The ledger's held-out pairs from earlier runs count as stage 0 when (and only when) the seeds are disjoint and the version, bot and field match. Screening pairs are stored but never pooled into the confirmation, to avoid the winner's curse.
  - The O'Brien–Fleming looks keep their α. Prior pairs are information that was already spent, so treat the pooled look as the next look index. Document this choice.
- **Tests:** `tests/change-ledger.test.ts`.
  - Key stability (order-free; the same change on a renamed list keeps its key).
  - Pooling refuses mixed versions.
  - Synthetic: pooling two 896-game runs of a true +2 change adopts about 80% of the time, against about 27% for one run.
  - Pins: with an empty ledger every builder makes exactly what it made before (`tests/deck-packages-defaults.test.ts` unchanged).
- **Games:** none to build. Validation: re-run E1's S2-05 setting with the ledger on, 5 seeds (≈ 14k Medium games, 4 min). The Yorinobu swap (+2.3 measured) should be adopted once it has been nominated twice.

### P2 — Findings model and evidence data files. No games needed; one optional run.
- **Files:**
  - New `src/lib/findings.ts`: the `Finding` type, `strengthOf`, BH within families, stable ids, stale marking against `SIM_VERSION`.
  - New `scripts/build-evidence.ts`: reads ratings.json, h2h.json (shrunk), analysis.json, decisions.json, synergies.json, the event JSONs (seat, length and end reason for all 47 decks from recorded games), forge reports, the ledger, and an optional `--adjusted DIR`. Writes `public/data/evidence/<listId>.json` and `public/data/evidence/index.json` with an aggregate manifest.
  - Hook it into `npm run refresh`, and have `check:data` verify it (every finding's sources exist, ids are unique, no causal finding without a paired source).
  - Store the adjusted card impact: `sim analyze --impact-adjusted --out DIR` already exists. Add `--write-adjusted` to write `public/data/impact-adjusted.json` (observe-only; no bot reads it).
- **Tests:** `tests/findings.test.ts` (strength rule table-driven; association never gets a causal word; a stale version is never 'strong'; id stability); `tests/build-evidence.test.ts` (built from fixtures; byte-identical on re-run).
- **Games:** optional adjusted impact for all 47 decks: `analyze --field all --bot hard --games 13 --impact-adjusted` ≈ 600 games per deck, ≈ 28k Hard games ≈ 1.8 h on 16 threads. The meta decks alone take ≈ 4 min.

### P3 — Evidence view UI.
- **Files:**
  - New `src/ui/pages/Evidence.tsx` (lazy; `#/evidence`, `#/evidence/<listId>`, `#/evidence/run/<runId>`).
  - Components `src/ui/components/evidence/{FindingRow,StrengthChip,MatchupStrip,RunTrials,ToolHealth}.tsx`.
  - A tab on `DeckProfile.tsx` that links to it.
  - A "cite" button (copies the `[F:id] …` line).
  - A `NAV_CATALOG` entry and an `IfPage` gate (site config).
  - It must not be imported by Home (entry chunk); the data are lazy-fetched.
- **Tests:** `tests/evidence-ui.test.tsx` (renders a fixture; association rows carry the chip; stale rows are greyed; the link highlights the finding; `#/evidence?f=` resolves).
- **Games:** none.

### P4 — Power-aware runs: say what a run can detect, and size it so it can.
- **Files:**
  - `src/lib/deckSearch.ts`: `detectable({ firstStage, capStages, sd, rule, nominees })` (closed-form normal approximation, checked against the Monte-Carlo in tests) and `gamesFor({ targetGainPp, power, sd })`.
  - The Lab "Search depth" fieldset and forge/optimizer output print "smallest gain this run adopts 80% of the time: +X (cards), +Y (packages)" using the ledger's pooled SD for the list, or the defaults 0.30 (card) / 0.55 (package) measured here.
  - Raise the Lab default to the Standard budget. Add an "until settled" mode that keeps confirming a single nominee in stages until adopt / reject or `gamesToSettle` exceeds a cap.
- **Tests:** `tests/detectable.test.ts`.
- **Games:** none.

### P5 — Candidate generation from pooled evidence, not from 112 fresh games.
- **Files:**
  - `scripts/builder-moves.ts` and `src/lib/deckLab.ts` `swapsAndCuts`: rank cuts by a pooled score. Use the shrunk adjusted impact for this list (P2) when present, else the ledger's per-card ablation results, else IWD pooled over all games of this list ever played (ledger + telemetry). Do not use this generation's 112 games alone.
  - Keep the candidate set fixed across generations and runs, so repeated runs accumulate evidence on the same changes.
  - Opt-in flag `--pooled-ranking`, default on in the Lab once measured.
- **Tests:** pinned-default test unchanged without the flag; with the flag, the same seeds give the same candidates across runs.
- **Games:** validation is E1 again with the flag. Success means the same 5 candidates in ≥ 4 of 5 runs and ≥ 50% agreement on the nominee. About 14k Medium games.

### P6 — Matchup- and seat-stratified reporting, and Hard confirmation of Medium screens.
- **Files:**
  - `src/lib/evidence.ts`: `stratifiedInterval(pairs, by)` (inverse-variance across opponents × seat cells) and `heterogeneity(pairs)` (χ² across opponents).
  - `NomineeRecord.byOpp`.
  - Forge and Lab flag `--confirm-bot hard` (screen on Medium, confirm on Hard). Default stays Medium until the transfer rate is measured (see the Hard check in this report). Then switch the Lab default for package moves.
- **Tests:** `tests/evidence-stratified.test.ts` (with balanced designs it equals the pooled paired mean; a planted one-matchup effect is flagged).
- **Games:** measure Medium→Hard transfer on the 6 recorded changes plus E1's adoptions: 560 paired Hard games each ≈ 13k Hard games ≈ 50 min.

### P7 — Breeder: test before entering, and track the drift.
- **Files:**
  - `scripts/season.ts`: play the round robin after the forge, or record the forged list under its own leaderboard entry (open since Season 2).
  - Gate each bred deck with a paired comparison against its best parent on the same seeds (1,400 Medium games, with Hard confirmation for those that pass) before it takes a season slot.
  - Lab breeder quick test: same seeds for every bred deck and for the parent, reported as paired against the parent, with an interval.
  - `strengthOf` uses only the current SIM_VERSION ratings (it already does), but marks leaderboard entries from older versions as stale instead of blending them 35%.
- **Tests:** season dry-run test (`--out`) that a bred deck below its parent's lower bound is not entered.
- **Games:** about 8 × 1,400 × 2 ≈ 22k Medium games per season, plus up to 8 × 560 × 2 Hard ≈ 9k (≈ 35 min).

## Files in `reports/tuning-study-2026-11-13/`
- `harness.ts`: paired game runner (forge job layout) used by the scripts below.
- `forge-record.cjs` → `forge-record.txt`: every recorded forge generation (Season 1–2).
- `bred-record.cjs` → `bred-record.txt`: bred decks vs parents, season fitness vs Hard v8 ratings.
- `e1-consistency.sh`, `e1/` (15 forge runs with `--out`), `e1-analyze.cjs` → `e1-analysis.txt`, `e1-summary.json`.
- `e2-remeasure.ts` → `e2-medium.txt`, `e2-lookahead-all.json` (8 changes × 2,800 paired games, Medium v8); `e2-hard.txt`, `e2-hard-s2-03_s2-05_lad-padre.json` (3 changes × 560 paired games, Hard v8).
- `e3-candidates.ts` → `e3.txt`, `e3-candidates.json` (83 candidates × 1,120 paired games); `e3-analyze.cjs` → `e3-analysis.txt`.
- `power.ts` → `power-empirical.txt`, `power-normal.txt`.
- The games are also in the gitignored `.cache/games/0f4a4bfbf31c9959-v8/` (they replay instantly with `--cache` until a game-worker file changes).
