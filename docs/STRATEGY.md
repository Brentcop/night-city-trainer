# Strategy report — finding the deck for EOR Chicago (Dec 11–13, 2026)

## Bottom line (updated after 3 breeding seasons)
**Register S2-08 Explorer (RRG).** The ready-to-play list is `data/decks/custom/s2-08-explorer-rrg-eor.txt`. It's an original, data-bred Red/Red/Green removal-midrange deck: Yorinobu: Embracing Destruction, Jackie: Mama's Favorite, and Dexter: Off the Grid as Legends.

| Evidence | Result |
|---|---|
| Finals vs the 7 meta archetypes (deep bot) | **72%** over 420 games; worst meta matchup 67% |
| vs RRG Dexter Midrange (previous #1) | **65%** over 400 games (64% on the play / 67% on the draw) |
| vs BBG Cunningham Econ (choom.gg S-tier) | **63%** over 400 games (66% on the play / 60% on the draw) |
| All-time leaderboard (pooled vs meta) | #2 of 54 decks, 98th percentile |
| Grand-final round robin (meta + all-time top 12) | 61%, #4 of 19 |

**Why it beats the established lists:** it keeps RRG's best threats (Animals Wrecker, Yorinobu: Steel Dragon, Pepe, 6th Street Recruits) but plays far more interaction: 3 Over the Edge, 3 Bonnie and Clyde, 3 Carnage, 2 Gunpoint and 2 Take Control. It also adds Valentino Street Racer for surprise same-turn attacks.

**Plan:**
- vs aggro and midrange: stabilise with removal, then turn the corner.
- vs BBG: card advantage and Eddies decide it; bring in 1 Royce: Don't Call Me Simon (+3.3 points).

**Backup:** RRG Dexter Midrange (`rrg-eor-build.txt`) is the safest established list if you'd rather play a deck with outside track record. **Alternatives to test by hand:** S1-07 Explorer (BBG control, 73% in the finals but expert to pilot) and S1-01 Mutant (RRB, best in the grand final at 63%).

**Caveat:** the bred decks were selected by these bots against the choom.gg meta lists. Expect some regression against strong humans. Play 10+ practice games with S2-08 before committing.

## Breeding seasons (3 × 8 new decks)
Each season: breed 8 decks (mutants of top decks, crossovers of two strong decks, explorers of untested Legend combos), then a telemetry round robin vs the meta and the incumbents, then forge, then finals vs the meta. Every game against the meta archetypes is pooled into the all-time leaderboard (rating shrunk toward 50% by a 60-game prior).

| Season | Best newcomer (vs meta, pooled) |
|---|---|
| S1 | S1-07 Explorer (BBG) 75.6% · S1-01 Mutant (RRB) 71.9% · S1-04 Cross (RBG) 70.6% |
| S2 | S2-08 Explorer (RRG) 73.2% · S2-04 Cross (RRG) 69.7% · S2-07 Explorer (RRB) 68.0% |
| S3 | S3-04 Cross (RBG) 68.5% · S3-06 Cross (RBG) 65.8% · S3-05 Cross (RRB) 65.5% |

- **Top 13 on the leaderboard:** all bred decks. The best established list, RRG Dexter Midrange, is #14 (63%).
- **Recurring winning traits:** Red removal density (Over the Edge, Bonnie, Carnage), Valentino Street Racer, Take Control, Blue bottom-deck removal (Les Élémens, Towerfall), and fewer low-impact Gear.
- **Diminishing returns:** season 3's best decks were weaker than seasons 1–2. The next gains will likely need new cards (set 2) or better bots, not more breeding.
- **Where to look:** the full leaderboard is on the Seasons page, per-season reports are in `reports/season-*.md`, and forge logs are in `reports/forge/`.

## History: before the seasons
### Original bottom line (RRG Dexter Midrange)
**Register RRG Dexter Midrange.** The ready-to-play list is `data/decks/custom/rrg-eor-build.txt`: the stock choom.gg list plus a data-chosen 7-card sideboard.

- **Finals:** 65% over 360 deep-bot games against the six other choom.gg meta archetypes, 7 points clear of the next contenders.
- **Every run agrees.** It was #1 in all four round robins: 72%, 72%, 71% and 68%, across 18–28 decks and three bot strengths.
- **No bad matchup** against the expected field. Its "worst", BBG Cunningham Econ, is **51% over 400 head-to-head games**.

## Method
| Step | What was run | Size |
|---|---|---|
| Field | 7 choom.gg meta archetypes + 11 choom.gg guide lists + 8 Trainer originals + 2 optimizer variants | 28 decks |
| Engine | Comprehensive Rules (29 Oct 2026), all 150 cards scripted (5 approximated) | 82 rules/card tests |
| Bots | Self-play-tuned evaluation. Deep mode plays out the rival's reply before choosing. Matchup-aware profiles adjust play per archetype pairing | Deep beats 1-ply 54%, profiles beat no profiles 55%, 1-ply beats rules-only 63% |
| Round robins | 1-ply (18 decks × 40), deep (18 × 40), deep + telemetry (18 × 40, 28 × 24) | ~27,000 games |
| Finals | Top 6 by expected-field score, each vs the meta archetypes | 2,400 deep games |
| Matchup work | RRG vs BBG head-to-head plus a BBG-specific swap search | 400 + ~5,000 games |
| Deck design | 8 original decks, 2 forge generations each | ~16,000 games |

## Finals (deep bot vs the meta archetypes)
| Deck | Win % | Games |
|---|---|---|
| **RRG Dexter Midrange** | **65.0%** | 360 |
| YYB Rogue Gear | 58.3% | 360 |
| NC-07 Braindance Burn (RRB) *(original)* | 58.1% | 420 |
| RRG Midrange: V + Dexter (optimizer variant) | 56.2% | 420 |
| NC-02 Stormrider Stampede (GGR) *(original)* | 55.5% | 420 |
| Smash the Curve (RRG community list) | 53.6% | 420 |

## Why RRG wins (telemetry)
- **Yorinobu Arasaka: Steel Dragon** (+13 points when drawn) and **Animals Wrecker** (+7) decide games. Both reach the 10-power breakpoint (with Saburo for Yorinobu), so they steal two Gigs per attack.
- **Tempo:** after your 4th turn you win 80% of games when ahead on Gigs, but only 46% when behind. Pressure the Gig area early.
- **Sell order:** Detonate, Synapse Burnout, Mantis Blades and Satori are sold in 83–95% of the games they're drawn. That's correct: they're the deck's Eddie fodder.
- **Seat:** even (68% on the play, 67% on the draw). Choose per matchup.

## Matchups and sideboard (EOR build)
| Opponent | Result | Plan | Sideboard |
|---|---|---|---|
| BBG Cunningham Econ | 51% (400 games) | Race: commit Units every turn before Towerfall and card advantage take over | −3 Bonnie and Clyde, +3 Royce: Don't Call Me Simon (+6.3 points in paired tests) |
| RRY Smasher Aggro / GRY Trauma Team / Rainbow Fixer | 67–80% | Mirror race: trade early, keep one blocker back once ahead | +2 Memory Relapse, +2 Deadman Transmitter for −2 Peace Offering, −2 Detonate |
| RRB Wakako Midrange | 83% | Be the beatdown before their bigger Units land | none |
| YYB Rogue Gear | ~54–68% | Kill the equipped Unit before it attacks; keep Detonate for Gear | none |

**Deck-choice note:** against BBG specifically, V: Streetkid in place of Adam Smasher scored +9 points. Across the whole field the V variants did worse (56%), so keep Adam Smasher unless the room is mostly BBG.

## The Trainer originals (designed + forged)
| Deck | 28-deck rank | Notes |
|---|---|---|
| NC-02 Stormrider Stampede (GGR) | **#2 (63.3%)** | Green go-wide. The forge swapped in a 3rd Sandayu Oda. |
| NC-05 Emperor's Guard (GGB) | **#5 (62.0%)** | Green pairs control. The forge cut MaxTac Heavy for 2 more Valentino Street Racer. |
| NC-08 Merc Contract (RRG) | #8 (60.0%) | MERC Go Solo engine. |
| NC-07 Braindance Burn (RRB) | #10 (59.9%) | 58% in the finals, joint 2nd. |
| NC-01 Rockerboy Express (RRY) | #13 (55.6%) | The forge swapped in Dexter DeShawn: One Last Chance. |
| NC-04 Chrome Rockers (YYR) | #14 (54.6%) | Gear aggro on big bodies. |
| NC-03 Static Shock (BBR) | #23 (37.2%) | Failed: the Red splash doesn't fix Blue's tempo problems. |
| NC-06 Metal Over Meat (YYY) | #24 (36.7%) | Failed: too slow against the Gig race. |

Two original designs placed in the top 5, ahead of choom.gg's S-tier BBG list in this sim. They are the best sources of new ideas for the coming meta.

## How confident is this?
- **Strong:** RRG's lead. It was #1 in every run, under every bot and every field.
- **Medium:** the ordering between #2 and #8. Those decks sit within 4–5 points of each other.
- **Weak:** control decks. Bots under-play them, so BBG Econ's real strength is likely higher than its sim numbers. Practise the BBG matchup by hand.
- **Overtime rule:** the engine follows the CR wording (overtime starts after both players' 7th turns), which gives the player going second the last turn before overtime. Rounds that reach time also use the tournament Round-End procedure, which the sim doesn't model.

## Keeping it current
1. Refresh choom.gg data with `npx tsx scripts/import-meta.ts --force` and `npx tsx scripts/import-guides.ts --force` (without `--force` they refuse to replace existing decks; with it, provenance headers are kept), then add any new lists with `npm run sim -- add`.
2. Run `npm run sim -- analyze --field all --bot deep`, then `bash scripts/finals.sh`. That command also regenerates the plan (`npx tsx scripts/plan.ts`).
3. Optionally, run `npx tsx scripts/forge.ts <deck>` to iterate a list.
