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
2. **Sell first.** Sell once per turn until about 9 Eddies. Sell the card with the lowest keep value: a duplicate, something not castable soon, or Gear with no host.
3. **Main actions, 1-ply lookahead.**
   - For every legal action, clone the game, play the action out, and evaluate.
   - Inside the clone, sub-choices and the rival's reactions use the fast policy.
   - Each clone first hides what the bot can't see (`hideInfo`): the rival's hand is re-dealt from their unseen cards, both decks are shuffled, and the identities of face-down Legends the bot hasn't seen (its own not looked at, and all of the rival's) are shuffled among their slots.
   - Calls on unknown face-down Legends count as one option, valued as the average over the possible Legends. This holds in the main phase, in reactions and in deep rollouts.
   - Take the best action if it beats passing.
4. **Deep mode (turn rollout).** Re-score the top N actions by finishing our turn with a 1-ply bot, then letting a 1-ply rival play its whole next turn.
5. **Reactions.** For each reaction (Call, Blocker, Quick program or ability):
   - clone the game and apply the reaction;
   - play the attack out in the clone (no further reactions, sub-choices by the fast policy) and evaluate the result, so fight and steal effects the reaction arms count, such as Safety Override's "the next time a friendly Unit loses a fight, defeat the opposing Unit" or a Blocker's "when this blocks" trigger. Until SIM_VERSION 4 the bot projected the result statically (fight loser defeated, or N Gigs moved), which valued Safety Override as a lost card;
   - keep the reaction only if it beats letting the attack resolve (also played out) by 0.5.

   With `deepReactions: N` (Hard and the coach), each reaction is instead played out N times: the attack finishes, the attacker ends its turn, and the defender plays its next turn. The N random worlds (hidden-information deal, dice) are different from each other but shared by every candidate reaction, so only the reaction differs between them. Unknown Calls are collapsed into one averaged option, as in the main phase.
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

Head-to-head, **re-measured 2026-11-11** on SIM_VERSION 5 with the fresh baseline's `src/data/impact.json` (`scripts/botcheck.ts --per 10`: every ordered meta pairing, seats swapped, 420 games each, same seeds; the configs are the tiers' settings in `src/ai/tiers.ts`):

| Matchup | First bot wins (95%) |
|---|---|
| Easy vs Medium | 36.7% ±4.6 |
| Medium vs Hard | 43.8% ±4.7 |
| Hard vs Deep (the pre-tier `deep` setting: no card impact or reaction rollouts) | 54.8% ±4.8 |

Not re-measured (the old numbers predate the November 2026 fixes and were removed): Hard vs the first Hard (`hard-v1`) and the coach's deep 12 + card impact as a player. Easy is clearly weaker; Hard is now measurably stronger than Medium and the old Deep setting in bot-vs-bot play. Its blunder rate against the rollout oracle (16% vs 25% for Medium) is from before the fixes and is pending a re-run of `scripts/coach-eval.ts`.

**Tournaments** can run All Hard, a Hard + Medium mix (each seat of each game is Hard or Medium, decided by its seed, so a replay rebuilds the same bots), All Medium, or All Easy. Events recorded before the tiers used the Deep bot (`deep`); that setting and `hard-v1` are kept with their original search depth, impact and reactions, but they share every later fix to the bot's choices. So events recorded before the fixes no longer replay identically; they were wiped at the 2026-11-11 fresh baseline, and every recorded event now carries its `simVersion` (`SIM_VERSION` in `src/lib/tournament.ts`). A game replays identically from its seed with the same code and the same `src/data/impact.json` (`makeBot()`; Hard reads the impact table), and `tests/replay-events.test.ts` pins four recorded games.

## 7. Coach (`src/ai/coach.ts`)

In Play, coach mode asks an advisor bot for its move and explains it.

**What it shows**
- After each of your moves, a verdict in the middle of the board: ✓ coach agrees, ≈ close, or ! with what the coach preferred and the Gigs it measured you gave up.
- At game over, a scorecard: a grade (A–D), how many decisions matched the coach, and your three costliest differences.
- The move, highlighted on the board.
- Its value against passing, in Gigs.
- Up to three alternatives with their gap, scored on the same deep-rollout scale the decision used.
- Live warnings: steal threat against your ready blockers, rival blockers, 6-Gig alerts and overtime.
- A matchup plan. It comes from the archetype read, your deck's top cards by "Δ when drawn", its tempo stat, and this pairing's bot-test win rate.

**Advisor config** (`COACH_CONFIG`): `deep: 12` with the tuned profiles, `impact: 40`, `sellLookahead: 3` (compares the three most sellable cards by rollout) and `deepReactions: 3`. Card impact adds `40 × Δ when drawn` to sell and keep choices, and the advisor keeps hands that hold at least 2 high-impact cards.

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
- Quick Programs are mostly sold. They are the cheapest cards, so they have the lowest keep value (`cardValue` gives no credit for {Quick} or for Gear removal), and the bot spends its Eddies on its own turn, so even a held one is often unaffordable when the rival attacks. In the main phase a fight trick (Safety Override, Synapse Burnout, Reboot Optics) is scored right after it resolves, before the attack it is meant for, so the 1-ply screen never sees "trick, then attack". Crediting such a play with the attack it enables was tried and measured no gain (docs/DECISION_TELEMETRY.md, findings).
- The evaluation counts a Gear on the board at power × 1.2 + 1.5 against 3.6 for a card in hand, so a free Gear of power 2 or less is barely worth playing to it: River Ward's free-Gear ability goes mostly unused.
