# Statistics pipeline: bot games → insights → guides and bot play

```
Game (trace: true) ──► TraceEvent[] ──► summarize() ──► PlayerSummary
                                                        │
             npm run sim -- analyze / Matchup Lab ──────┘
                                                        ▼
                     analyzeAll() ──► DeckReport (cards, tempo, matchups, insights)
                                                        │
        reports/analysis-latest.{md,json}  ◄────────────┤
        src/data/analysis.json ─► Insights page, "Data-driven insights" in each guide
```

## 1. Telemetry (`src/engine/engine.ts`, opt-in `GameOptions.trace`)
Each game records these events, each tagged with turn, player and card id:
- opening hand and mulligan;
- draws;
- plays (and from which zone);
- sells;
- Calls (main phase, reaction, or free);
- Go Solo;
- attacks (on Units or on Gigs);
- steals (attacker and Gig value);
- defeats (in a fight or by an effect);
- activated abilities;
- Gig counts at the end of every turn.

Lookahead clones never record telemetry.

## 2. Per-game summary (`src/analysis/summarize.ts`)
For each player in each game, the summary records:
- cards seen;
- the first turn each card was played;
- what was sold;
- the order of Calls and how each was made;
- first attack turn;
- Gigs stolen per attacker;
- Gig differential after each of the player's own turns;
- the result, seat and overtime flag.

## 3. Aggregation (`src/analysis/analyze.ts`)
- **Card impact:**
  - win rate when seen and when not seen, and the difference (IWD);
  - win rate when played and average turn played;
  - sell rate and win rate in the opening hand;
  - Gigs stolen per game.
- **Tempo:** P(win | ahead / even / behind after own turn N), and the average Gig differential in wins vs losses.
- **Seat and mulligan:** win rate on the play vs on the draw; mulligan rate and win rate after a mulligan.
- **Legends:** win rate by first Legend flipped, and the share of Calls made as reactions.
- **Matchups:** win rate per opponent, play/draw split, game length, overtime rate, and the cards with the highest IWD in that matchup.
- **Insights:** rule-based sentences generated from the numbers, with minimum-sample guards: seat choice, cards to keep or sell or cut, tempo advice, overtime plan, and which matchup to sideboard for.

## 4. Matchup-aware AI (`src/ai/archetype.ts`)
- **classify(deck):** returns aggro, midrange or control.
- **Profiles:** each (mine > rival) archetype pair has evaluation-weight multipliers. They start from TCG theory ("who's the beatdown") and are tuned by self-play:
  - `scripts/tune-profiles.ts` measures variant vs current on identical seeds and deck pairings;
  - in training it adopts a change only when the lower bound of the paired 95% interval is above zero, and with `--apply` it writes the result only when the held-out lower bound clears 1 point (`scripts/tuning.ts`);
  - the result is saved to `src/ai/profiles.tuned.json` (`BEST_PROFILES`). The re-tune for the fresh baseline (2026-11-11, `--seed 1`, 160 games per measurement) adopted nothing in training; the held-out check was +0.00 points over 800 games, so the profiles are unchanged (report `reports/tune-profiles-1-2026-11-11T21-18-27-022Z.json`).
- **Plan text:** `PLAN_TEXT` gives a short plain-language plan per pairing. It appears in the Insights matchup tables and in Play vs Bot ("Matchup read").

## Current data
The bundled `analysis.json`, `impact.json` and `review.json` come from the 2026-11-11 baseline: `npm run sim -- analyze --field meta --bot deep --decisions --games 200 --seed 1` (the 7 meta archetypes, 21 pairings × 200 games = 4,200 games, SIM_VERSION 5). Every deck report carries the fingerprint of the list it measured. The Hard bot and the coach read `impact.json`, so re-running analyze changes Hard games: record new events only after it, and bump `SIM_VERSION` if events were already recorded with the old table.

## Commands
```bash
npm run sim -- analyze --field all --games 40          # whole library
npm run sim -- analyze --deck "Smash the Curve" --games 100   # one deck vs the meta field
npx tsx scripts/tune-profiles.ts --games 200           # refine matchup profiles
```
In the browser, the Matchup Lab's "collect telemetry & analyze deck A" box produces the same report for any deck, including your custom builds.
