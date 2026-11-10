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

## 6. Strength check

| Matchup (all meta pairings, seats swapped) | Result |
|---|---|
| Fast policy vs 1-ply lookahead | fast wins 38% |
| Tuned weights vs initial weights | see `reports/tune-run*.log` |
| Deep (rollout 3) vs 1-ply | see `docs/STRATEGY.md` |

## 7. Known blind spots

- No long-term planning beyond the rival's next turn, even in deep mode. The bot doesn't sandbag removal for a bigger threat on purpose.
- It doesn't bluff or play around specific Quick tricks, apart from its averaged view of the rival's hidden hand.
- High-skill control decks (BBG Econ) are under-played compared with expert humans, so treat their sim win rates as a lower bound.
