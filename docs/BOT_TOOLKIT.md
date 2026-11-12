# Bot toolkit — how the practice bots think

This is the reference for what the bots know, which tools they have, and how they decide. Game terms are defined in the in-app **Glossary** (`src/content/glossary.ts`), with Comprehensive Rules references.

## 1. Perception (what a bot may look at)

| Information | Own | Rival |
|---|---|---|
| Hand | ✔ | count only. Lookahead clones re-deal the rival's hand at random from their unseen cards |
| Deck order | ✘ (clones shuffle it) | ✘ |
| Face-down Legends | ✘ unless revealed by an effect (`known`), e.g. Kiroshi Optics. Clones shuffle the identities of the ones not looked at | ✘. Clones shuffle their identities |
| Field, Gigs, fixer dice, Eddies, trash, face-up Legends | ✔ | ✔ |
| Own deck list (for the Gig plan) | ✔ | Only the public cards: field, trash and face-up Legends |

## 2. Tools (engine API the bots and cards share)

Everything goes through `Game` (`src/engine/engine.ts`):

- **Turn actions:**
  - `legalActions(p)` returns sell, call, play, goSolo, activate, attack and pass.
  - `legalReactions(p)` returns call, block, quick program, quick ability and endReact.
- **Simulation:**
  - `clone(agents)` makes a deep copy of the state for lookahead.
  - `doAction`, `doReaction`, `resolvePending`, `mainLoop`, `endPhase` and `startPhase` let the bot play out part of a turn or a whole turn inside a clone.
- **Combat math:**
  - `power(c)` includes Gear, auras, mods and "while attacking" effects.
  - `fightOutcome(a, b)` applies win/lose overrides such as Johnny vs CORPO.
  - `stealCount(att)` is floor(P/10)+1, adjusted by Take Control, Gorilla Arms and similar.
  - `attackTargets(c)` covers Lag, Adrenaline, Go Solo, ready-unit permissions, and bans such as Ruthless Lowlife and MaxTac Suppression.
- **Economy:**
  - `playCost(uid)` returns the cost after discounts (min 1) and taxes such as Riot Shield.
  - `available(p)` counts ready Eddies plus ready Legends.
  - `pay()` auto-pays in this order: Eddies, then Legends carrying spend-trigger Gear, then face-down Legends, then face-up Legends without {Spend} abilities. A Legend paying for its own Go Solo is spent first (it enters ready anyway); one paying for its own ordinary play (`playLegend`) is spent last (it would enter spent).
- **Gig state:** `gigsOf`, `streetCred`, `lessCred` / `moreCred`, `valuePairs`, `distinctValues`.

## 3. Evaluation function (`src/ai/eval.ts`)

The evaluation scores a position from one player's view: ours minus the rival's.

| Term | Weight (tuned) | Why |
|---|---|---|
| Gig difference | 20 per Gig | Gigs are the win condition: 7 at the start of your turn wins |
| Near-win bonus | 45 per Gig above 5 | 6 Gigs means one steal from winning |
| Overtime | Gig difference counted twice | 7 Gigs wins instantly in overtime |
| Units on board | power×1.2 + cost×1.2 + 2, plus Blocker +2, Go Solo +2, Gear +1.5 each, 10+ power +6 | Board presence; at 10+ power a Unit steals 2 Gigs |
| Spent Units the rival can beat | ×(1 − 0.087), for the player whose turn it is | Attacking leaves a Unit exposed to a counter-attack |
| Cards in hand | 3.6 each (counts up to 10) | Card advantage |
| Eddies | 2.6 each (counts up to 10) | Permanent mana |
| Face-up Legends | 4.8 each, plus 2 per Gear on any Legend | Unlocks abilities and passives |
| Gig plan | 1.5 × plan score | Rewards dice that match the deck's payoffs |
| Low deck | −8 per card under 4 | Deck-out avoidance |

The weights were tuned by self-play (`scripts/tune.ts`): each weight is tried at ×0.5 and ×1.6 against the baseline across every meta pairing. Two early rounds (before the November 2026 fixes, when a variant was adopted at a 54% win rate) halved the Gig, unit-power and spent-risk weights, then raised face-up Legends and halved spent risk again. Since 2026-11-11 a variant is adopted in training only when the lower bound of its paired 95% interval is above zero, and a candidate is applied only when its held-out lower bound clears 1 point (`scripts/tuning.ts`). The re-tune for the fresh baseline (2026-11-11, `--seed 1`, defaults: 168 games per evaluation) adopted unitPower ×1.6 in training, but the held-out check gave +0.6 points [−3.3, +4.5] over 168 games, so nothing was applied (report `reports/tune-weights-1-2026-11-11T21-15-00-176Z.json`). The values above are `DEFAULT_WEIGHTS` in `src/ai/eval.ts`; the per-Gig, Gear, Blocker and low-deck numbers are fixed in the code, not tuned.

### Package terms (`src/ai/packages.ts`, docs/SYNERGIES.md "How scoring uses packages")

Four more weights credit the synergy packages the player's **own** list is built around (the deck objective's `synergies` when named for that exact list, else every package `synergiesIn` marks built-around; computed once per list fingerprint and cached outside the state). They are **0 by default**: with all four at 0 the bots play exactly as before (the golden replays, and `tests/package-scoring.test.ts`). They are not in `TUNED_WEIGHTS`; `scripts/package-scoring.ts` measures them.

| Weight | Where it counts | What it credits |
|---|---|---|
| `pkgHold` | sell ranking, card choices (discard/trash/bottom-deck own cards, search and free-play picks), Maman Brigitte's discard | a piece in hand whose partner the player can still get (hand, play, Legends, deck): 1 per `requires` package (½ `helps`), divided by the copies still obtainable that do the same job, at most 2 |
| `pkgAssembly` | `evaluate()` | per package, enabler and payoff (or two members) available together in hand, play or the Legends: 1 (`helps` ½) |
| `pkgSteer` | `evaluate()`, and the Gig choices: roll-in die, steal, swap, adjust/set value, Kerry's reroll | for each steerable quantity of a package with a payoff available (Street Cred below / above the rival's, even Street Cred, min Gig, 8+ Gig, value-pair, mixed values), how far the own Gigs are toward it, in [−1, 1] |
| `pkgProtect` | `evaluate()` | per member in play (at most 3) of a `requires` package assembled in play: losing one costs this |

Only the deciding player's own packages count: inside lookahead clones the rival seat's bots get no package weights (`withoutPackages`), since the bot does not know the rival's list. The roll-in die choice (always the first option before) and Maman Brigitte's discard (`yesno/discardFor`) go through the package terms only when their weight is set. `mode/mode` is unchanged: no package gives a clear reason to pick a mode differently.

**How to measure one.** `npx tsx scripts/package-scoring.ts --out <scratch dir> --configs "name:pkgHold=8;…" [--phase train|heldout] [--per N] [--shadow-games M] [--bot hard|deep]` plays every library deck built around a package against every meta deck, weights on vs off on the same seeds, seats and opponents (opponent: the same bot, weights off). It prints the paired gain overall, per family, package and deck, the apply gate, how many of the deck's decisions the weights change (`--shadow-games`: a weights-off shadow bot is asked at every decision in the same state and random stream), and how often a scarce package piece was sold or discarded while its partner was obtainable. A weight that changes no decision is not worth measuring further.

**Measured 2026-11-11 (SIM_VERSION 5, Hard; `reports/package-scoring-2026-11-11.md`):** in training (546 paired games each) `pkgHold` 8 −0.5 points [−2.1, +1.0], `pkgAssembly` 6 +1.1 [−0.9, +3.1], `pkgSteer` 6 −2.0 [−4.4, +0.4], `pkgProtect` 3 −0.4 [−2.1, +1.4], all four +0.2 [−3.3, +3.7]. Each changes decisions (47, 36, 154 and 43 of about 3,400 in 80 shadowed games; `pkgSteer` changes a quarter of the roll-in choices). Held-out, `pkgAssembly` 6 gave −1.6 [−3.2, +0.0] over 1,092 games, so nothing was applied and every package weight stays 0. `pkgHold` 8 cuts sells of a scarce piece whose partner is obtainable from 55% to 40% of the sells where one was in hand, with no measurable gain.

### Next-turn terms (BOT-3, `nextTurnTerms` in `src/ai/eval.ts`)

The rest of the evaluation is static: it can't see what the next turn will do. Three more weights look one turn ahead from public information. They are **0 by default** (with all three at 0 `evaluate()` never computes them, and every game plays as before) and are not in `TUNED_WEIGHTS`; set them in a `botcheck` / worker `AgentSpec` with `"weights": {...}`.

How the next turn works (engine): a player's Units ready only at that player's start, and lag ends with every turn, so every Unit a player has on the field now can attack on its next turn (unless an attack restriction bans it, or a "can't ready" outlasts that start keeps a spent one spent), while the defender's Units stay as they are now: only Units that are ready now and have Blocker can block, each one attack. An unblocked attack on the Gig area steals ⌊power/10⌋+1 Gigs. 7+ Gigs at the start of your own turn wins.

Whose turn is next (`nextTurnSeat`): the other seat during a turn (the 1-ply screen evaluates in our own main phase; a reaction in the rival's), the active seat once an end phase has run (the end of a deep play-out, where our turn is next).

| Weight | When | What it counts |
|---|---|---|
| `exposed` | the rival's turn is next | − `exposed` × the Gig swing (the gig, near-win and overtime terms of `evaluate()`) of the Gigs the rival can steal (`stealableNextTurn`: each rival Unit's steals, minus the biggest one per ready Blocker of ours, capped at our Gigs) |
| `threat` | our turn is next | + `threat` × the Gig swing of the Gigs we can steal, the same estimate the other way round (so `exposed` = `threat` keeps the evaluation zero-sum) |
| `rivalLethal` | the rival's turn is next and it holds 7+ Gigs (not in overtime, where 7 ends the game at once) | − `rivalLethal` points when our turn is over, or when it isn't but our Units that can attack the rival's Gigs now can't steal it below 7 past its ready Blockers |

Being a share of the Gig swing, `exposed` and `threat` are on the evaluation's own scale: 0.5 counts an open steal as half of a stolen Gig. The estimate ignores Units still to be played (they lag), unblockable attackers, steal modifiers, attacks on spent Units (that is `spentRisk`) and this turn's power changes. Measured: see docs/IMPROVEMENT_BACKLOG.md WP-D1 (status 2026-11-12, BOT-3/BOT-4).

## 4. Gig plan (`src/ai/knowledge.ts → gigPlanOf`)

The bot counts how many of its deck's cards reference each pattern:

- **high:** 8+, increase, max Gig. Mostly Red: Industrial Assembly, Carnage, Octant, V Roamer.
- **low:** min Gig, decrease. Mostly Blue: Trust No One, Three Mouths, Pyramid Song, Alt Cunningham.
- **pairs:** value-pair. Green Arasaka: Hanako, Pepe, Sandayu, Goro.
- **diverse / parity:** different values, even/odd. Yellow: Bootleg, Faceplate, Jackie Ride or Die.
- **d20:** Over the Edge, Kerry.

The plan drives which die to roll in, which Gig to steal, and every adjust, set or swap choice. For an adjust, the bot scores every `(die, new value)` pair as `planScore(mine) − planScore(rival)` and also considers "no change".

## 5. Decision procedures (`src/ai/heuristic.ts`)

1. **Mulligan.** Keep the hand only if it has a Unit costing ≤4, three cards costing ≤4, and something to sell. The mulligan costs nothing (a new hand of 6), so a deck's mulligan rate is just the chance its opening hand fails the rule: from about 6% (Rainbow Fixer Stuff) to 27% (RRY Smasher Aggro) for the meta decks (1,200 games each in the 2026-11-11 baseline), almost all of it from having no Unit costing ≤4. BBG Cunningham Econ is at 22%: it has 9 such Units in 40 cards, the fewest.
   - With card impact (Hard, the coach) the bot also keeps a hand holding 2+ high-impact cards (Δ when drawn ≥ 0.05) and 2+ cards costing ≤4, which brings Hard's mulligan rate to 10.5% over the meta decks (plain rule 16.6%).
   - **Measured (BOT-6, 2026-11-12, `scripts/mulligan-check.ts`).** Every deal is played twice, the studied seat forced to keep and forced to mulligan, so both outcomes of every opening hand are known and any rule can be scored offline on the same hands. Hard vs Hard, meta decks, 4,200 hands: in the hands Hard keeps, mulliganing gains +0.2 points [−1.8, 2.2]; in those it mulligans, +4.3 [−1.4, 10.0]. So the rule's main split is right. The exception is the card-impact keep: on the 254 hands it keeps and the plain rule would mulligan, mulliganing was worth **+11.0 points [3.6, 18.5]** (BBG, RRB Wakako and RRG Dexter account for most of them). No other class of hands showed a consistent gain across decks (by count of Units ≤4, cards ≤2 or ≤4, cards 5+).
   - `mulligan: 'plain'` (off by default and in every tier) drops the card-impact keep; `'rule'` (default) is the rule above exactly. Paired `botcheck` against Hard: meta decks `--per 20` 50.7% [49.9, 51.5]; all decks `--per 1` 50.2% [49.9, 50.5]. Small (about +0.6 points expected on meta decks), not switched on.
2. **Sell first.** Sell once per turn until about 9 Eddies. Sell the card with the lowest keep value: a duplicate, something not castable soon, or Gear with no host.
   - `sellLookahead: N` (the coach uses 3; every tier 0): which card to sell is chosen among the N lowest keep values by rollout (deep) or 1-ply; whether to sell stays the rule. With `deep` and `deepWorlds` > 1 (only the coach) the sells are compared in shared worlds on the main-phase deep scale (rollout mean + 5% of the 1-ply value, `valueMain`), so a sell can be compared with any other move.
   - `sellSearch: true` (BOT-4, off by default and in every tier; needs `deep`): when the rule would sell, "don't sell this turn" and the two lowest keep values are rolled out like deep candidates (in shared worlds when `deepWorlds` > 1) and the best is taken, a sell on ties. The "don't sell" play-out starts with the rest of our main phase (`playOut` move `{ rest: true }`), our clone bot barred from selling that turn (`noSellTurn`); after choosing not to sell the bot doesn't sell again that turn. Costs three rollouts on each turn the rule would sell. It takes precedence over `sellLookahead`. Measured 2026-11-12 against Hard: 25% (it under-sells, as a two-turn rollout can't see what an Eddie is worth later); `sellLookahead: 3` on Hard 50.2%, no gain (docs/IMPROVEMENT_BACKLOG.md WP-D1).
3. **Main actions, 1-ply lookahead.**
   - For every legal action, clone the game, play the action out, and evaluate.
   - Inside the clone, sub-choices and the rival's reactions use the fast policy.
   - Each clone first hides what the bot can't see (`hideInfo`): the rival's hand is re-dealt from their unseen cards, both decks are shuffled, and the identities of face-down Legends the bot hasn't seen (its own not looked at, and all of the rival's) are shuffled among their slots.
   - Calls on unknown face-down Legends count as one option, valued as the average over the possible Legends. This holds in the main phase, in reactions and in deep rollouts.
   - Take the best action if it beats passing.
   - **`turnPlan: N` (BOT-5, off by default and in every tier).** Each candidate is valued by the best sequence of our own actions for the rest of this turn that starts with it, up to N actions long (`src/ai/turnPlan.ts`), instead of by the position right after it, so a first step that looks weak alone (a fight trick before the attack it arms) is credited with what it enables. The search runs in the 1-ply screen's own world (one `hideInfo` re-deal; sub-choices and the rival's reactions by the fast policy) and scores positions with `evaluate()` and the weights in force, in our main phase (so `exposed` and `rivalLethal` apply when set). Every first action is played (its value is exactly the 1-ply value), every resulting position is expanded once, and deeper levels expand a beam of the `turnPlanBeam` (3) best positions. Below the root it never sells, calls or passes. Positions reached by different orders are merged (`positionKey`: zones with hand, field and Eddies sorted, card states, Gigs, mods without ids, once-per-turn keys; the RNG, uids and this turn's history are left out, so a "first time each turn" trigger can be merged away), and a position's value is the best evaluation reachable from it (stopping is always allowed). The budget is `turnPlanNodes` (120) nodes per decision, one node being a clone plus one action; it is a count, not a clock, so games still replay from their seed. A candidate's value is then 0.95 × the plan's + 0.05 × its own 1-ply value: several first actions often lead to the same best line (merged positions), and the 5% breaks that tie toward the step that is best on its own (without it the plan changed the 1-ply pick in 36% of decisions, almost all reorderings of one line; with it 8%); a candidate with no better line than itself keeps exactly its 1-ply value. With `deep` the top few are rolled out as before. The bot plays the first action and plans again at its next decision. `lastPlan` holds the best line. 0 or 1 = the 1-ply screen, exactly as before. Measured 2026-11-12 (`turnPlan: 3`, paired `botcheck`, meta decks, 840 pairs): Hard + turnPlan vs Hard **47.9% [46.2, 49.6]**, Medium + turnPlan vs Medium 48.9% [47.3, 50.4]: it plays worse. A likely reason is that a maximum over many mid-turn evaluations favours the lines `evaluate()` over-rates (the same selection bias as any search on a static evaluation), so it is not to be switched on as it is (docs/IMPROVEMENT_BACKLOG.md WP-D1).
4. **Deep mode (turn rollout).** Re-score the top N actions by finishing our turn with a 1-ply bot, then letting a 1-ply rival play its whole next turn.
5. **Reactions.** For each reaction (Call, Blocker, Quick program or ability):
   - clone the game and apply the reaction;
   - play the attack out in the clone (no further reactions, sub-choices by the fast policy) and evaluate the result, so fight and steal effects the reaction arms count, such as Safety Override's "the next time a friendly Unit loses a fight, defeat the opposing Unit" or a Blocker's "when this blocks" trigger. Until SIM_VERSION 4 the bot projected the result statically (fight loser defeated, or N Gigs moved), which valued Safety Override as a lost card;
   - keep the reaction only if it beats letting the attack resolve (also played out) by 0.5.

   With `deepReactions: N` (Hard and the coach), each reaction is instead played out N times: the attack finishes, the attacker ends its turn, and the defender plays its next turn. The N random worlds (hidden-information deal, dice) are different from each other but shared by every candidate reaction, so only the reaction differs between them. Unknown Calls are collapsed into one averaged option, as in the main phase.

   **Play-out options, off by default (BOT-1 and BOT-2, 2026-11-12).** Two `HeuristicOptions` change how deep play-outs are scored. Both are off in every tier, so with default options every game plays exactly as before; both can be set in a `botcheck` / worker `AgentSpec` (`scripts/worker.ts`) to be measured.
   - `rolloutWins: true` — a play-out stops after an end phase, just before the next start-of-turn check, so the 7-Gig win of the seat about to start its turn was never seen (after a main-phase action that is our own win after the rival's turn; after a reaction, the attacker's). With the option, `playOutValue` (`src/ai/playOut.ts`) scores that check as the game result it is: `nextStartResult` gives the winner (or a tie past the turn limit, which the engine checks first; overtime needs no case, as 7 Gigs ends the game at once there). It also clamps main-phase rollouts to ±`playOutClamp` (600), as reaction play-outs always were. The clamp makes a win in 1 of 3 worlds count as a third of a game instead of swamping the average, and keeps a won world at or above every ordinary position. It is not quite "win above everything": in 200 Medium games 0.65% of positions evaluated beyond ±600 (largest 717, 6.4% beyond ±400), so a crushing lead already ties with a win. Those are positions that are close to decided, so this was kept as it is for reactions and the reviewer rather than tuned. Deep reactions use the same win scoring when the option is on. The reviewer can use it too (`ReviewOptions.rolloutWins`, off by default; `scripts/review-debug.ts` prints both values per world).
   - `deepWorlds: N` — score every rolled-out main-phase candidate as the mean over N random worlds (`makeWorlds`: the clone's RNG and the play-out bots' seeds) shared by all candidates, as `deepReactions` does; unknown Calls are averaged over their slots in each world. 0 or 1 is the old single rollout in the game's own random state, drawing nothing from the bot's random stream. With N > 1 each entry of `lastAlternatives` also carries `se` (standard error of its mean) and `seDiff` (paired standard error of its difference to the chosen move, over the same worlds), used by the coach's "close call" (§7). Costs about N× the rollout time.

   **What the bot thought (observe-only, 2026-11-12).** After every main-phase lookahead, sell comparison and reaction the bot keeps `lastScores` (`DecisionScores`): every option it valued on the scale it chose on, the 1-ply screen of a deep decision, and the shared worlds with each option's per-world value. Nothing in play reads it. Decision telemetry records a compact copy (`decisionScores()`, docs/DECISION_TELEMETRY.md), and the coach grades your move with it. `valueMain` / `valueReaction` value any option the deep way in given worlds (the coach's on-demand score of a move it did not roll out).
6. **Targets** (driven by `intent` hints that every card script supplies):
   - "harm" picks the rival Unit with the highest threat;
   - "help" picks the friendly Unit in the current fight, or else the biggest ready Unit;
   - Gear with "when this Unit or Legend is spent" goes on a face-up Legend, which is spent to pay each turn.
   - "May attack this turn" permissions (Adrenaline, Lag attacks) go to a ready, lagging Unit that couldn't otherwise attack, the strongest first.
7. **Modes.** Each mode is scored from its text: removal when targets exist, Draw N worth 3.5N, stun when the rival has ready Units, and so on. When the rival chooses for us (Gunpoint Diplomacy), the bot assumes they pick the weakest mode.
8. **Card choices and yes/no prompts.** Decided by the decision's tag, never by the prompt text.
   - Card choices follow `CARD_TAG_POLICY`: take the best card (search, play from trash, free plays, moving Gear), give up the worst (discard, trash, bottom-deck), pick blind (looking at an unknown face-down Legend), or target the rival's best card (Detonate, Gear removal). Cards are valued with `cardValue`: base stats, roles (removal, sweeper, draw, finisher), choom.gg card ratings, card impact, and whether the card is castable soon.
   - Yes/no prompts have a rule per tag (`yesNo`): mulligan, Kerry's reroll, Jackie's replacement, trashing the top card, drawing (not when the deck is too short), discarding for Maman Brigitte, paying for El Sombrerón. Pure gains are always yes.
   - Gig swaps (Hanako, MaxTac AV) score every (give, take) pair by the Gig plan, and decline an optional swap that gains nothing.
9. **Candidate cap.** When there are more actions than `maxCandidates`, the best attack of every attacker is kept first, then the rest by the fast policy's score (`capCandidates`), so no attacker is dropped unseen.

## 6. Difficulty tiers and strength check (`src/ai/tiers.ts`)

| Tier | Bot | What it does |
|---|---|---|
| **Easy** | Fast | Plays by simple rules, no lookahead |
| **Medium** | Lookahead | Scores every action one step ahead, with the tuned matchup profiles |
| **Hard** | Deep + card impact + reaction rollouts | Also rolls out the rest of its turn and your whole reply for its best 3 options, plays out each block / reaction, and values cards by how much they swing games for its deck |

Head-to-head, **re-measured 2026-11-11** on SIM_VERSION 5 with the fresh baseline's `src/data/impact.json` (`scripts/botcheck.ts --per 10` as it was then: every ordered meta pairing, 420 games each, one game per seed with the first bot always in seat 0, plain binomial interval; the configs are the tiers' settings in `src/ai/tiers.ts`):

| Matchup | First bot wins (95%) |
|---|---|
| Easy vs Medium | 36.7% ±4.6 |
| Medium vs Hard | 43.8% ±4.7 |
| Hard vs Deep (the pre-tier `deep` setting: no card impact or reaction rollouts) | 54.8% ±4.8 |

**How `botcheck` compares two configs (since 2026-11-12).** `npx tsx scripts/botcheck.ts '<A json>' '<B json>' [--per N] [--decks meta|all|<file prefix>] [--seed S] [--threads T]` uses the duplicate format: every ordered pairing of the chosen decks gets `--per` deals, and every deal is played twice with the same decks, seed and first player, once with A piloting the seat-0 deck against B and once with B piloting it against A (each seat's bot keeps the seat's random stream). A's win rate comes with the paired 95% interval (`duplicateSummary` in `src/lib/evidence.ts`, built on `pairedInterval`), so what the deal favours cancels out. It also prints the pairs split (the same deck won both games: the pilots made no difference) and swept, the per-pair SD of the difference (about 0.71 if the two games of a pair were unrelated) and the plain binomial half-width on the same games. A config against itself is exactly 50% with every pair split, because the two games are the same game. On Medium vs Hard (`--per 3`, 126 pairs) the per-pair SD was 0.63, so the paired interval was ±5.5 against ±6.2 unpaired: between bots this far apart the deal matters less than in the deck builders' comparisons, and the gain should grow as the configs get closer (not yet measured). A pair with a game that throws is left out, and the exit code is 1.

Not re-measured (the old numbers predate the November 2026 fixes and were removed): Hard vs the first Hard (`hard-v1`) and the coach's deep 12 + card impact as a player. Easy is clearly weaker; Hard is now measurably stronger than Medium and the old Deep setting in bot-vs-bot play. Its blunder rate against the rollout oracle (16% vs 25% for Medium) is from before the fixes and is pending a re-run of `scripts/coach-eval.ts`.

**Tournaments** can run All Hard, a Hard + Medium mix (each seat of each game is Hard or Medium, decided by its seed, so a replay rebuilds the same bots), All Medium, or All Easy. Events recorded before the tiers used the Deep bot (`deep`); that setting and `hard-v1` are kept with their original search depth, impact and reactions, but they share every later fix to the bot's choices. So events recorded before the fixes no longer replay identically; they were wiped at the 2026-11-11 fresh baseline, and every recorded event now carries its `simVersion` (`SIM_VERSION` in `src/lib/tournament.ts`). A game replays identically from its seed with the same code and the same `src/data/impact.json` (`makeBot()`; Hard reads the impact table), and `tests/replay-events.test.ts` pins four recorded games.

## 7. Coach (`src/ai/coach.ts`)

In Play, coach mode asks an advisor bot for its move and explains it.

**What it shows**
- After each of your moves, a verdict in the middle of the board, by value (INFO-1, 2026-11-12): ✓ coach agrees (its pick, or a move it values as high), ≈ close call, ! inaccuracy or !! mistake, with what the coach preferred and the Gigs given up ± the paired standard error; "Checking your move…" while a move it did not value is scored.
- At game over, a scorecard: a grade (A–D) from how many measured moves were fine (close calls count as fine), the close calls and the choices it can't measure (targets, modes, the mulligan) said apart, and your three costliest moves.

**How a move is graded** (`gradeMove`). The coach values every candidate in `COACH_WORLDS` (6) shared worlds, and its sells and reactions too. Your move is valued in the same worlds: straight from the advice when the coach valued it, otherwise afterwards, off the board's thread (`scoreMoveRequest`, queued in the coach worker behind advice; about 44 ms mean, p90 80 ms in Node). The gap is the coach pick's value minus yours, in Gigs, with the paired standard error over the worlds. Best: you are not behind; close call: under 0.15 Gigs (`CLOSE_GIGS`) or within 2 standard errors; mistake: 0.375 Gigs or more (`MISTAKE_GIGS`, the reviewer's blunder line); otherwise an inaccuracy. Effect choices (targets, modes, Gig picks) and the mulligan are decided by rules, so a different choice there is "not measured".
- The move, highlighted on the board.
- Its value against passing, in Gigs.
- Up to three alternatives with their gap ± its spread, scored on the same deep-rollout scale and worlds the decision used ("≈ close call" when within the noise); for sells, the other sells it compared; for reactions, the other reactions.
- Live warnings: steal threat against your ready blockers, rival blockers, 6-Gig alerts and overtime.
- A matchup plan. It comes from the archetype read, your deck's top cards by "Δ when drawn", its tempo stat, and this pairing's bot-test win rate.

**Advisor config** (`COACH_CONFIG`): `deep: 6` over `deepWorlds: 6` shared worlds with the tuned profiles, `impact: 40`, `sellLookahead: 3` (compares the three most sellable cards by rollout, in the same kind of shared worlds) and `deepReactions: 6`. Until 2026-11-12 it was `deep: 12` with one rollout per candidate and `deepReactions: 3`; the worlds cost time, so the candidates were cut (one thread in Node: 29 ms mean per advice before, 126 ms mean, p90 287 ms after). Card impact adds `40 × Δ when drawn` to sell and keep choices, and the advisor keeps hands that hold at least 2 high-impact cards.

**How it was chosen:** `scripts/coach-eval.ts` scores sampled real decisions against a rollout oracle. The numbers below were measured before the November 2026 fixes, with the earlier config (`COACH_CONFIG_V1`: no sell lookahead or reaction rollouts). The write-up with the full numbers is `reports/coach-eval-latest.md` (the raw table from the deep set is `reports/coach-eval-depth-run.md`).
- Blunders fell from 25% (the old 1-ply coach) to 7.5%.
- Agreement with the oracle rose from 58% to 73%.
- As a player it wins 51% against the in-app Deep bot (168 games), which is not a significant edge.
- So read it as better advice, not a stronger opponent.

Re-run after retuning: `npx tsx scripts/coach-eval.ts --samples 200 --rollouts 6 [--set deep]`, then `bash scripts/coach-h2h.sh`. The script defaults to 120 samples and 8 rollouts, and writes its table to `reports/coach-eval-<set>-latest.md` (`base` or `deep`); the write-up above was made with 6 rollouts.

## 8. Match reviewer (`src/ai/reviewer.ts`)

The reviewer replays a game exactly with the code it was played on (same seeds and bots, or a practice game's recorded choices). It scores each main-phase decision against an oracle: 8 play-outs per candidate, all sharing the same random worlds, each covering the rest of the turn plus the rival's reply. Scores are clamped to ±600, and positions that are already decided are not graded.

- **Candidates:** the move made, the screen bot's top alternatives, and passing. After a sell it also grades the best non-sell move ("don't sell now") and other cards that could have been sold.
- **Reactions:** every option is graded (blocks, reaction Calls and programs, or letting the attack through); unknown Calls collapse into one.

- **Validated** (before the November 2026 fixes; see `docs/REVIEW_FINDINGS.md`): exact replays, 94% verdict stability, planted mistakes detected (70% vs Hard's own moves), and game-losing flags that predict losses.
- **Not yet validated:** using per-move "Gigs lost" to predict who wins.

Full write-up and backlog: `docs/REVIEW_FINDINGS.md`.

## 9. Known blind spots

- No long-term planning beyond the rival's next turn, even in deep mode. The bot doesn't sandbag removal for a bigger threat on purpose.
- It doesn't bluff or play around specific Quick tricks, apart from its averaged view of the rival's hidden hand.
- High-skill control decks (BBG Econ) are under-played compared with expert humans, so treat their sim win rates as a lower bound.
- Quick Programs are mostly sold. They are the cheapest cards, so they have the lowest keep value (`cardValue` gives no credit for {Quick} or for Gear removal), and the bot spends its Eddies on its own turn, so even a held one is often unaffordable when the rival attacks. In the main phase a fight trick (Safety Override, Synapse Burnout, Reboot Optics) is scored right after it resolves, before the attack it is meant for, so the 1-ply screen never sees "trick, then attack". Crediting such a play with the attack it enables was tried and measured no gain (docs/DECISION_TELEMETRY.md, findings). `turnPlan` (§5, BOT-5) searches whole-turn sequences and does find such lines, but measured worse than the 1-ply screen (Hard 47.9%), so the default bots still have this blind spot.
- The evaluation counts a Gear on the board at power × 1.2 + 1.5 against 3.6 for a card in hand, so a free Gear of power 2 or less is barely worth playing to it: River Ward's free-Gear ability goes mostly unused.

## 10. Position benchmark (INFO-5: `scripts/benchmark.ts`, `src/ai/benchmark.ts`)

A fixed set of decision positions, each labelled by an oracle that does not use `evaluate()`, so any bot (or any bot option) can be scored on the same positions in seconds.

**The suite** (`data/benchmark/suite.json`, built by `scripts/benchmark-build.ts`). Positions are sampled from seeded Hard-vs-Hard games across the whole library, stratified by decision type (`mulligan`; `main`; `sell` = a main-phase decision with a sell among its options; `react`; `effect` = a choice inside an effect: targets, modes, Gigs, yes/no) and by stage (opening = the mulligan; early turns 1–4; mid 5–9; late 10+), at most 3 per game. Kept only: one-of choices with 2+ distinct options (copies of a card in hand, and Calls of own face-down Legends not looked at, are one option: `optionGroups`), at most 12 distinct options, and no option naming a card in a deck or the rival's hand (the re-deal would move it). A position is stored as the game's decks, seed, first player and the answers given before it; `pauseAt` replays those answers with a scripted agent (no bot thinks, about 1 ms) and pauses the game at the decision, so the file stays small, survives changes to the bots, and a bot is asked in the real game state, pending effects and all. The replay depends on the engine: an engine change that alters the game breaks it (`tests/benchmark.test.ts` rebuilds positions and checks the options), and the suite is then rebuilt with `--force`.

**The oracle** (`oracleOutcome`). At the paused decision: set the engine's random state to the world's, re-deal what the decider can't see (`hideInfo`, the bots' own rule), play the option, and finish the game with two Medium bots seeded by the world. The label is the decider's win rate over the worlds, every option of a position in the same worlds (common random numbers), so a regret (best option's win rate minus this one's) has a paired standard error. Why Medium: it costs about 0.1 s per whole game (Hard about 0.45 s), so a few hundred thousand play-outs fit in half an hour; its bias as a continuation policy is shared by every option of a position; and the outcome is a game result, not a maximum over evaluations, so it does not inherit `evaluate()`'s scale or its over-rated positions (it is not fully independent: Medium's own choices are 1-ply on `evaluate()`). Labelling: every option in 150 worlds, then the best and the options within 3 paired SE of it (at most 4) up to 480 worlds. An option is "among the best" unless it is below the best by more than 2 paired SE; a position where every option is among the best is **indifferent**: counted, but left out of the regret means. The regret of the best by its own sample is biased up (the maximum of noisy win rates), by at most about one SE.

**Scoring a bot.** `npx tsx scripts/benchmark.ts <bot> [<bot 2>] [--reps N] [--out DIR]`. A bot is a tier name, `coach`, an `AgentSpec` JSON (as `botcheck` takes) or a tier plus overrides (`'hard+{"mulligan":"plain"}'`). It reports mean regret in win-rate points with a 95% interval over the non-indifferent positions, by decision type and stage, and the share of picks among the oracle's best; with two bots, the paired difference position by position. A fresh bot is made per position (seeded per position), so plans carried between decisions (a Gig swap's give then take) are not seen. The stats are in `src/lib/benchmarkStats.ts`.

**Built and measured 2026-11-12 — it does not work yet as a yardstick.** Suite: 261 positions from 151 of 200 Hard games over all 47 library decks (31 mulligan, 68 main, 47 sell, 42 react, 73 effect; early/mid/late about equal), 4.8 distinct options on average, 426,660 play-outs in 30 minutes on 15 threads, 348 KB. On the 128 positions that are not indifferent the best-vs-second paired SE is 1.5 points (median; p90 4.1); 133 (51%) are indifferent (react 30 of 42, effect 49 of 73). Mean regret (win-rate points, 95% interval, 128 positions, `--reps 3`), and the paired difference against Hard:

| Bot | Regret | Oracle-best pick | vs Hard |
|---|---|---|---|
| Easy | 5.3 [3.7, 6.9] | 61% | −0.5 [−2.0, 1.1] |
| Medium | 5.1 [3.5, 6.7] | 60% | −0.7 [−2.2, 0.8] |
| Hard | 5.8 [3.8, 7.8] | 64% | — |
| Coach | 6.1 [4.0, 8.2] | 63% | +0.4 [−0.5, 1.2] |
| Hard + exposed/threat 0.5, rivalLethal 400 | 4.9 [3.0, 6.7] | 69% | −0.9 [−1.8, −0.0] |
| Hard + `mulligan: 'plain'` | 5.9 [3.9, 7.9] | 63% | +0.2 [−0.3, 0.6] |
| Hard + `turnPlan: 3` | 5.8 [3.8, 7.8] | 63% | 0.0 [−0.5, 0.5] |
| Hard + `sellSearch` | 5.6 [3.7, 7.5] | 64% | −0.1 [−0.8, 0.5] |

Easy does not score worse than Hard, so the sanity check fails. Two reasons, both measured: (1) the label depends on the continuation bot: re-labelling the 32 non-indifferent positions where Easy and Hard pick differently with Hard finishing the games (40 worlds) gave the same sign of the Easy-minus-Hard difference at only 12 of 32 (mean +1.2 points with Medium, +0.9 with Hard: neither oracle prefers Hard's picks); (2) the signal per decision is tiny: Easy loses about 13 points of win rate per game to Medium over about 40 of its own decisions, a third of a point per decision, while the labels' noise is 1.5 points and every bot shares the rule-decided effect and most sell choices (identical regret on those rows). Not to be used to accept or reject a bot change. What it would need: a continuation as strong as the bots being judged (Hard both seats: 4–5× the cost), positions where the bots disagree (sample where Easy, Medium and Hard pick differently), and far more worlds per option there.

## 11. Rank stability across bots (SIM-3: `scripts/rank-stability.ts`)

`npx tsx scripts/rank-stability.ts [--bots medium,hard] [--decks meta|all|<prefix>] [--per 50] [--seed S] [--out DIR]` plays the same round robin (every ordered pairing, `--per` deals, first player alternating) once per bot on the same deals, and prints each deck's win rate against the field with its rank and Sim-tier band (`src/lib/simTier.ts`) under each bot, Spearman's rank correlation between every two bots with a 95% interval from a paired bootstrap (deals resampled within each pairing, the same deals for every bot), and the decks that moved beyond the noise: rank (the bootstrap interval of the rank change excludes 0) or band (the letter differs and the win-rate change exceeds 1.96 paired SE). The maths is in `src/lib/rankStability.ts`.

**Measured 2026-11-12, Medium vs Hard.** Meta decks, `--per 50` (2,100 deals per bot, 600 games per deck, ±3.4–4.0 points): Spearman rho **0.36 [0.32, 0.76]**; 5 of 7 decks changed win rate beyond the noise (mean |change| 8.3 points). YYB Rogue Gear goes from last under Medium (35.2%, D) to second under Hard (56.2%, A), RRY Smasher Aggro from 66.5% (S) to 52.7% (B), Rainbow from 3rd to 5th; RRG Dexter is first under both. All 47 library decks, `--per 2` (4,324 deals per bot, 184 games per deck, ±7 points; Hard 465 s, Medium 42 s on 15 threads): rho **0.75 [0.71, 0.80]**; the band letter differs for 30 of 47 decks (13 beyond the noise), 19 ranks moved beyond the noise, largest change 28.5 places. The direction is systematic: Medium overrates fast red decks (Red Chrome, Smash the Curve, RRY Smasher, RRG ladder lists, S2-04 Cross) and underrates the slower ones that need decisions to pay off (YYB Rogue Gear +27.7 points under Hard, S2-02 Mutant +21.2, BBG Cunningham Econ +14.1, RRB Wakako +13.0, BBG Draw and Wipe +12.0). So a ranking or a nomination made with Medium is not a reliable stand-in for Hard: across varied decks it agrees broadly (rho 0.75) but not within the strongest field, and its errors line up with deck style, so a Medium screen would systematically nominate aggressive changes and miss control ones.
