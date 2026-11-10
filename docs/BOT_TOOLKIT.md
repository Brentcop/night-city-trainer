# Bot toolkit — how the practice bots think

This is the reference for what the bots know, which tools they have, and how they decide. Game terms are defined in the in-app **Glossary** (`src/content/glossary.ts`), with Comprehensive Rules references.

## 1. Perception (what a bot may look at)

| Information | Own | Rival |
|---|---|---|
| Hand | ✔ | count only. Lookahead clones re-deal the rival's hand at random from their unseen cards |
| Deck order | ✘ (clones shuffle it) | ✘ |
| Face-down Legends | ✘ unless revealed by an effect (`known`), e.g. Kiroshi Optics | ✘ |
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
  - `pay()` auto-pays in this order: Eddies, then Legends carrying spend-trigger Gear, then face-down Legends, then face-up Legends without {Spend} abilities.
- **Gig state:** `gigsOf`, `streetCred`, `lessCred` / `moreCred`, `valuePairs`, `distinctValues`.

## 3. Evaluation function (`src/ai/eval.ts`)

The evaluation scores a position from one player's view: ours minus the rival's.

| Term | Weight (tuned) | Why |
|---|---|---|
| Gig difference | 20 per Gig | Gigs are the win condition: 7 at the start of your turn wins |
| Near-win bonus | 45 per Gig above 5 | 6 Gigs means one steal from winning |
| Overtime | Gig difference counted twice | 7 Gigs wins instantly in overtime |
| Units on board | power×1.2 + cost×1.2 + 2, plus Blocker +2, Gear +1.5 each, 10+ power +6 | Board presence; at 10+ power a Unit steals 2 Gigs |
| Spent Units the rival can beat | ×(1 − 0.175) | Attacking leaves a Unit exposed to a counter-attack |
| Cards in hand | 3.6 each (counts up to 10) | Card advantage |
| Eddies | 2.6 each (counts up to 10) | Permanent mana |
| Face-up Legends | 3 each, plus 2 per Gear on a Legend | Unlocks abilities and passives |
| Gig plan | 1.5 × plan score | Rewards dice that match the deck's payoffs |
| Low deck | −8 per card under 4 | Deck-out avoidance |

The weights were tuned by self-play (`scripts/tune.ts`): each weight is tried at ×0.5 and ×1.6 against the baseline across every meta pairing, and a variant is adopted if it wins at least 54%.

## 4. Gig plan (`src/ai/knowledge.ts → gigPlanOf`)

The bot counts how many of its deck's cards reference each pattern:

- **high:** 8+, increase, max Gig. Mostly Red: Industrial Assembly, Carnage, Octant, V Roamer.
- **low:** min Gig, decrease. Mostly Blue: Trust No One, Three Mouths, Pyramid Song, Alt Cunningham.
- **pairs:** value-pair. Green Arasaka: Hanako, Pepe, Sandayu, Goro.
- **diverse / parity:** different values, even/odd. Yellow: Bootleg, Faceplate, Jackie Ride or Die.
- **d20:** Over the Edge, Kerry.

The plan drives which die to roll in, which Gig to steal, and every adjust, set or swap choice. For an adjust, the bot scores every `(die, new value)` pair as `planScore(mine) − planScore(rival)` and also considers "no change".

## 5. Decision procedures (`src/ai/heuristic.ts`)

1. **Mulligan.** Keep the hand only if it has a Unit costing ≤4, three cards costing ≤4, and something to sell.
2. **Sell first.** Sell once per turn until about 9 Eddies. Sell the card with the lowest keep value: a duplicate, something not castable soon, or Gear with no host.
3. **Main actions, 1-ply lookahead.**
   - For every legal action, clone the game, play the action out, and evaluate.
   - Inside the clone, sub-choices and the rival's reactions use the fast policy.
   - Calls on unknown face-down Legends are averaged over the possibilities.
   - Take the best action if it beats passing.
4. **Deep mode (turn rollout).** Re-score the top N actions by finishing our turn with a 1-ply bot, then letting a 1-ply rival play its whole next turn.
5. **Reactions.** For each reaction (Call, Blocker, Quick program or ability):
   - clone the game and apply the reaction;
   - project the attack's result (the fight loser is defeated, or N Gigs change hands);
   - keep the reaction only if it improves the projected evaluation.
6. **Targets** (driven by `intent` hints that every card script supplies):
   - "harm" picks the rival Unit with the highest threat;
   - "help" picks the friendly Unit in the current fight, or else the biggest ready Unit;
   - Gear with "when this Unit or Legend is spent" goes on a face-up Legend, which is spent to pay each turn.
7. **Modes.** Each mode is scored from its text: removal when targets exist, Draw N worth 3.5N, stun when the rival has ready Units, and so on. When the rival chooses for us (Gunpoint Diplomacy), the bot assumes they pick the weakest mode.
8. **Discard / search.** Uses `cardValue`: base stats, roles (removal, sweeper, draw, finisher), choom.gg card ratings, and whether the card is castable soon.

## 6. Difficulty tiers and strength check (`src/ai/tiers.ts`)

| Tier | Bot | What it does |
|---|---|---|
| **Easy** | Fast | Plays by simple rules, no lookahead |
| **Medium** | Lookahead | Scores every action one step ahead, with the tuned matchup profiles |
| **Hard** | Deep + card impact | Also rolls out the rest of its turn and your whole reply for its best 3 options, and values cards by how much they swing games for its deck |

Head-to-head (`scripts/bot-tiers.sh`, every meta pairing, seats swapped, 168 games each, about ±6 points of noise):

| Matchup | First bot wins |
|---|---|
| Easy vs Medium | 37.5% |
| Medium vs Deep (pre-tier Hard) | 49.4% |
| Hard vs Deep | 52.4% |
| Deep 12 + card impact vs Deep | 51.2% |

Easy is clearly weaker. Medium and Hard are close in bot-vs-bot play: both use the same evaluation, so their mistakes are similar. Hard's edge shows when it judges single decisions against the rollout oracle: it blunders about 16% of the time vs 25% for Medium. That matters more against a human, who makes different mistakes.

**Tournaments** can run All Hard, a Hard + Medium mix (each seat of each game is Hard or Medium, decided by its seed, so replays rebuild the same bots), All Medium, or All Easy. Events recorded before the tiers used the Deep bot (`deep`), and keep exactly those settings for replays.

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

**Advisor config:** `deep: 12` with the tuned profiles and `impact: 40`. Card impact adds `40 × Δ when drawn` to sell and keep choices, and the advisor keeps hands that hold at least 2 high-impact cards.

**How it was chosen:** `scripts/coach-eval.ts` scores sampled real decisions against a rollout oracle. The full numbers are in `reports/coach-eval-latest.md`.
- Blunders fell from 25% (the old 1-ply coach) to 7.5%.
- Agreement with the oracle rose from 58% to 73%.
- As a player it wins 51% against the in-app Deep bot (168 games), which is not a significant edge.
- So read it as better advice, not a stronger opponent.

Re-run after retuning: `npx tsx scripts/coach-eval.ts --samples 200 --rollouts 6 [--set deep]`, then `bash scripts/coach-h2h.sh`.

## 8. Match reviewer (`src/ai/reviewer.ts`)

The reviewer replays a game exactly (same seeds and bots, or a practice game's recorded choices). It scores each main-phase decision against an oracle: 8 play-outs per candidate, all sharing the same random worlds, each covering the rest of the turn plus the rival's reply. Scores are clamped to ±600, and positions that are already decided are not graded.

- **Validated:** exact replays, 94% verdict stability, planted mistakes detected (70% vs Hard's own moves), and game-losing flags that predict losses.
- **Not yet validated:** using per-move "Gigs lost" to predict who wins.

Full write-up and backlog: `docs/REVIEW_FINDINGS.md`.

## 9. Known blind spots

- No long-term planning beyond the rival's next turn, even in deep mode. The bot doesn't sandbag removal for a bigger threat on purpose.
- It doesn't bluff or play around specific Quick tricks, apart from its averaged view of the rival's hidden hand.
- High-skill control decks (BBG Econ) are under-played compared with expert humans, so treat their sim win rates as a lower bound.
