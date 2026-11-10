# Tournament plan — EOR Chicago

> Generated 2026-11-10 from 19 decks × 24 games per pairing (deep bot) plus telemetry. Re-run `npm run sim -- analyze --field all --bot deep` and then `npx tsx scripts/plan.ts` to refresh.

## Register: S2-08 Explorer (RRG)
- **Finals: 72% over 420 deep-bot games vs the meta archetypes.** **Expected-field score: 75%**. This is the win rate against choom.gg's meta archetypes, weighted by their tier power. Overall round-robin win rate: 61%; worst meta matchup: 67%.
- **Why this one:** Chosen among 3 decks tied within 2 points in the finals (S1-07 Explorer (BBG), S3-04 Cross (RBG), S2-08 Explorer (RRG)) for robustness: worst meta matchup 67%, 61% against the whole field.
- **Why (from 432 telemetry games):**
  - **Seat:** 65% on the play vs 58% on the draw. When you choose (you lost the last game), choose to go **first**.
  - **Cards that win games:** Animals Wrecker (+17 pts when drawn), 6th Street Recruits (+6 pts when drawn), Johnny Silverhand: Never Stop Fighting (+4 pts when drawn), Swordwise Huscle (+4 pts when drawn). Keep these over everything when you sell or mulligan.
  - **Underperformers:** Memory Relapse (-16 pts), Zetatech Berserk (-16 pts), Satori: Sword of Saburo (-14 pts). Sell these first, and consider cutting them or moving them to the sideboard.
  - **Usual Eddie fodder:** Deadman Transmitter (sold in 94% of games it's drawn), Satori: Sword of Saburo (sold in 89% of games it's drawn), Take Control (sold in 86% of games it's drawn), Zetatech Berserk (sold in 85% of games it's drawn).
  - **Tempo check:** after your 4th turn you win 72% when ahead on Gigs and 40% when behind. Early Gig pressure decides this deck’s games, so prioritise attacking the Gig area early.
  - **Overtime:** 33% of games reach overtime, and you win 52% of those. You do worse in long games, so close it out before both players run out of dice.
  - **Mulligans:** 22% of hands are mulliganed, and those games are won 56% of the time (overall 61%).
  - **First Legend flipped:** Jackie Welles: Mama's Favorite 69% (151) · Yorinobu Arasaka: Embracing Destruction 58% (142) · Dexter DeShawn: Off the Grid 56% (138). You can't pick which face-down Legend you flip, but this shows which Legend's early effect matters most.
  - **Reactive Calls:** 15% of Legend Calls happen during the rival's attack, so keep 1 €$ open on the rival's turn.
  - **Best matchup:** Rainbow Fixer Stuff (88%). **Worst:** S1-04 Cross (RBG) (38%). Sideboard for the worst one first.
- **Ready-to-register list:** `s2-08-explorer-rrg-eor.txt` (Decks page → Custom & tournament builds): the list plus a data-chosen 7-card sideboard.
- **Backup / sideboard partner:** S1-05 Cross (RGY) (midrange, field score 72%). Practise it second, in case the room skews hard against control decks.

## Expected-field ranking
| # | Deck | Archetype | Finals vs meta (games) | Round-robin vs meta field | Overall | Worst meta matchup |
|---|---|---|---|---|---|---|
| 1 | S1-07 Explorer (BBG) | control | **73%** (420) | 73% | 57% | 58% |
| 2 | S3-04 Cross (RBG) | control | **72%** (420) | 71% | 62% | 46% |
| 3 | S2-08 Explorer (RRG) | control | **72%** (420) | 75% | 61% | 67% |
| 4 | S1-01 Mutant (RRB) | control | **70%** (420) | 68% | 63% | 54% |
| 5 | S1-05 Cross (RGY) | midrange | **69%** (420) | 72% | 58% | 50% |
| 6 | S1-08 Explorer (RRG) | control | **67%** (420) | 72% | 54% | 50% |
| 7 | S1-06 Cross (RGG) | control | — | 68% | 52% | 50% |
| 8 | S1-04 Cross (RBG) | control | — | 67% | 62% | 46% |

Ranking uses the **finals**: each contender played 360 deep-bot games against the six meta archetypes on the same seeds. That is more reliable than the round-robin estimate (24 games per pairing).

## Matchup plan with S2-08 Explorer (RRG)
| Opponent | Sim win % | Seat | Key cards | Plan |
|---|---|---|---|---|
| BBG Cunningham Econ (control) | **67%** | go first | Yorinobu Arasaka: Steel Dragon, Gunpoint Diplomacy | Card advantage and Eddies decide it; don’t fire sweepers into one Unit. |
| GRY Trauma Team (aggro) | **83%** | either | Sandayu Oda: Hanako's Guardian, Animals Wrecker | Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units. |
| Rainbow Fixer Stuff (aggro) | **88%** | go second | Swordwise Huscle, Johnny Silverhand: Never Stop Fighting | Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units. |
| RRB Wakako Midrange (midrange) | **83%** | go first | Memory Relapse, Deadman Transmitter | Trade removal for threats one-for-one; win with card advantage in the long game. |
| RRG Dexter Midrange (aggro) | **71%** | go first | Johnny Silverhand: Never Stop Fighting, Over the Edge | Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units. |
| RRY Smasher Aggro (aggro) | **67%** | go second | Animals Wrecker, 6th Street Recruits | Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units. |
| YYB Rogue Gear (aggro) | **71%** | go first | Bonnie and Clyde, Animals Wrecker | Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units. |

## List tuning
The optimizer found no single-card change that clearly beats the stock list, so register it as-is.

## Problem matchups
### vs BBG Cunningham Econ
Head-to-head: **63%** over 400 games (66% on the play, 60% on the draw). Plan: Card advantage and Eddies decide it; don’t fire sweepers into one Unit.
**Sideboard candidates for this matchup** (paired test, Δ vs stock list): -1 Memory Relapse / +1 Royce: Don't Call Me Simon (+3.3).
*Deck-choice note:* Jackie Welles: Mama's Favorite → Goro Takemura: Hands Unclean (+5.0). Legends can't be sideboarded, so this only matters if you expect a lot of this deck when you register.

### vs RRG Dexter Midrange
Head-to-head: **65%** over 400 games (64% on the play, 67% on the draw). Plan: Stabilise: blockers and removal first; Gigs come back once the rival runs out of Units.
No single-card swap clearly improved this matchup; win it with play, not sideboarding.
*Deck-choice note:* Dexter DeShawn: Off the Grid → Johnny Silverhand: Rocking Renegade (+6.7). Legends can't be sideboarded, so this only matters if you expect a lot of this deck when you register.


## Bo3 notes (tournament rules)
- The **loser of each game chooses who goes first**. Use the seat column above. Across all sim games, going first won 50%; choom.gg's human games show 57% for going first.
- Swiss rounds are 50 minutes for a Bo3. When time is called, each player gets one more turn, then the player with 7+ Gigs wins; otherwise the game is a draw. Average sim game length for this deck is 13.0 turns, so play at a steady pace.
- The sideboard is exactly 7 cards. Build it for your worst matchups first. Then test the post-board list in the Matchup Lab, or with `npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard`.

## Practice schedule (31 days to Chicago)
1. **This week:** 10+ games a day in **Play vs Bot** with S2-08 Explorer (RRG) on Deep, Coach on. Read every Coach line where you disagreed with it.
2. **Next week:** play the three worst matchups from the table above on both seats, and log the results (the Play page keeps a practice log).
3. **Final week:** best-of-3 sets against the top two meta decks; finalise the 7-card sideboard; refresh the meta data (choom.gg) and re-run the sims.

## Caveats
- The bots are strong heuristic players. Control decks (BBG Econ) gain the most from expert piloting, so treat their sim numbers as a floor.
- choom.gg's tier list is expert opinion. Where it disagrees with the sim (see the Meta page), test that matchup yourself.
