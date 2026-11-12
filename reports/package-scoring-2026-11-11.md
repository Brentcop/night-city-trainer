# Package scoring: training and held-out measurement (2026-11-11)

ROADMAP2 §1 step 4. The package weights of `src/ai/eval.ts` (`pkgHold`, `pkgAssembly`, `pkgSteer`, `pkgProtect`; docs/BOT_TOOLKIT.md §3, docs/SYNERGIES.md "How scoring uses packages") measured with `scripts/package-scoring.ts` on SIM_VERSION 5. **Result: nothing passes the apply gate; every default stays 0, SIM_VERSION stays 5.**

## Setup

- Decks: all 39 active library decks (7 meta, 11 guides, 5 ladder, 8 NC, 8 S1), each built around 2 to 6 packages.
- Each deck plays each of the 7 meta decks as seat A, play/draw alternating; the opponent is the same bot with the weights off. The weights-off games are played on the same seeds, seats and opponents, so every game has a pair.
- Bot: `hard` (the tier the events use: deep 3, card impact 40, reaction rollouts 3, tuned profiles, noise 0.15). Deep was not run (time).
- Score per game: win 1, tie ½, loss 0. Gain = paired mean difference (weights on − off), 95% interval, in points.
- Gate (dispatcher's rule): apply only if the held-out overall lower bound is above +1 point and no deck with ≥ 300 held-out games has an upper bound below −1 point.
- Training: seeds 3,000,000–3,000,545, 546 games per config (14 per deck). Held-out: fresh seeds 3,500,000–3,501,091, 1,092 games (28 per deck).
- Game time: 1,248 s training + 676 s held-out on 12 threads (32 min), plus a 33 s smoke run.

## Training (546 paired games per config)

| Config | Gain, points [95%] | Games that changed | Decisions changed (80 shadowed games) |
|---|---|---|---|
| `pkgHold` 8 | −0.5 [−2.1, +1.0] | 97 | 47 of 3,414 (sells and other main actions 37, search 3, free plays 4, discard 2, trash 1) |
| `pkgAssembly` 6 | +1.1 [−0.9, +3.1] | 137 | 36 of 3,423 (main actions 35, reactions 1) |
| `pkgSteer` 6 | −2.0 [−4.4, +0.4] | 222 | 154 of 3,394 (roll-in die 76 of 320, main actions 35, steal 24 of 406, adjust 8, reactions 4, swap 4, set 2, Kerry reroll 1) |
| `pkgProtect` 3 | −0.4 [−2.1, +1.4] | 103 | 43 of 3,445 (main actions 40, reactions 3) |
| all four | +0.2 [−3.3, +3.7] | 340 | 274 of 3,476 |

"Decisions changed": at every one of seat A's decisions, the weights-off bot was asked in the same state with the same random stream; the count is how often it would have chosen otherwise. Every term changes decisions; `pkgSteer` changes the most (a quarter of the roll-in choices).

By family in training, `pkgSteer` was worst for gear (−5.6 [−10.6, −0.5], 126 games) and trash (−6.5 [−11.2, −1.8], 154); `pkgProtect` for legends (−9.5 [−18.5, −0.5], 42) and tempo (−4.8 [−9.3, −0.2], 84). No config's training lower bound was above 0, so none would be adopted under the tuner's training rule. The best training mean (`pkgAssembly` 6) went to the held-out check anyway, so that a held-out figure exists.

## Held-out: `pkgAssembly` 6 (1,092 paired games)

**Overall −1.6 [−3.2, +0.0] points.** Baseline 46.8%. 290 of 1,092 games changed. Gate: **not passed** (lower bound −3.2, not above +1). No deck reaches 300 held-out games (28 each), so the per-deck harm check cannot bind; it would need about 11× this run.

| Family | Gain [95%] | Games |
|---|---|---|
| gear | −4.8 [−8.4, −1.2] | 252 |
| gig-value | −1.6 [−3.4, +0.1] | 980 |
| legends | −3.6 [−7.6, +0.4] | 84 |
| program | −1.6 [−4.4, +1.1] | 364 |
| street-cred | −2.1 [−5.1, +0.9] | 336 |
| tempo | −3.0 [−7.2, +1.2] | 168 |
| trash | −0.6 [−3.8, +2.5] | 308 |
| type | −0.2 [−2.9, +2.4] | 448 |

A game counts in every family of its deck's packages.

| Package | Gain [95%] | Games |
|---|---|---|
| blockers | −3.6 [−12.2, +5.0] | 56 |
| braindance | −0.3 [−3.2, +2.6] | 364 |
| comeback | −1.2 [−6.4, +4.1] | 84 |
| cred-even | −1.4 [−6.3, +3.4] | 140 |
| cyberware | −5.0 [−10.0, −0.0] | 140 |
| gear-equipped | −5.4 [−9.4, −1.3] | 224 |
| gear-sacrifice | −7.1 [−17.0, +2.7] | 56 |
| gig-spread | −3.0 [−6.1, +0.1] | 336 |
| gig-swap | −4.5 [−9.7, +0.7] | 112 |
| high-cred | −1.8 [−7.3, +3.8] | 112 |
| high-gig | +0.2 [−2.4, +2.8] | 476 |
| legends-up | −3.6 [−7.6, +0.4] | 84 |
| low-cred | −3.6 [−8.8, +1.6] | 84 |
| min-gig | −3.1 [−6.5, +0.4] | 196 |
| program-fuel | −1.6 [−4.4, +1.1] | 364 |
| rocker | +6.0 [−0.1, +12.0] | 84 |
| spend-punish | −3.0 [−7.2, +1.2] | 168 |
| units-in-trash | −0.6 [−3.8, +2.5] | 308 |
| value-pair | −2.4 [−6.2, +1.4] | 252 |

Per deck (28 games each; every interval includes 0): lowest GGY Gear'n'Go, BBG Cunningham Econ and S1-02 Mutant RYY at −10.7; highest RBY Samurai, NC-01 Rockerboy Express and the RRY "fills up discard" guide at +7.1, then RRB Alt V Del, S1-01 Mutant RRY and S1-08 Explorer BGG at +3.6. The full table is in the run's JSON (scratch output).

## Scarce pieces sold or discarded while their partner was obtainable

A "scarce piece": a card whose hold credit is at least ¼ (at most 4 copies still obtainable do its job in a `requires` package, at most 2 in a `helps` one) and whose partner the player can still get. Training, 546 games per run:

| Run | Sells of such a piece | of sells where one was sellable | of all sells | Give-ups (discard, trash, bottom-deck from hand) of one |
|---|---|---|---|---|
| weights off | 321 | 55.0% (of 584) | 10.6% (of 3,040) | 40 of 230 |
| `pkgHold` 8 | 264 | 40.1% (of 659) | 8.7% (of 3,046) | 38 of 229 |
| all four | 260 | 40.7% (of 639) | 8.5% (of 3,066) | 43 of 226 |

`pkgHold` does what it is meant to (a piece is sold about a quarter less often, and kept pieces leave more sells with one in hand) without a measurable gain in games: −0.5 [−2.1, +1.0].

## Decision

Nothing applied. The four weights stay 0 in `DEFAULT_WEIGHTS`, the bots play exactly as before (golden replays unchanged), and the recorded events stay valid sim-5 records.
