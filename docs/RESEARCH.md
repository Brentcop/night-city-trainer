# Research notes (collected 9–10 Nov 2026)

## The game
- **Cyberpunk Trading Card Game**, published by **WeirdCo** under licence from CD PROJEKT RED. It was Kickstarted for about $28M.
- **Set 1:** *Welcome to Night City* (WNC). Beta events ran 10–20 Sep 2026 and retail launched around 28–29 Oct 2026. There are also two starter decks: *The Heist* and *Embracing Power*.
- **Set 2:** *Edgerunners: Burn Bright* is announced for early or spring 2027.
- **Upcoming events:**
  - **Edgerunner Open Regional, Chicago:** Dec 11–13, 2026 ([cyberpunktcg.com/eor](https://cyberpunktcg.com/eor)).
  - **Warsaw:** Jan 30–31, 2027.
  - No sanctioned tournament results have been published yet.

## Primary sources saved in `data/raw/`

| File | Source |
|---|---|
| `official_comprehensive_rules.txt` | https://cyberpunktcg.com/comprehensive-rules (Oct 29 2026, 73 changes in that update) |
| `official_tournament_rules.txt` | https://api.netdeck.gg/api/cyberpunk/tournament-rules |
| `official_errata.txt` | https://cyberpunktcg.com/errata |
| `sim_catalog.json` | https://cyberpunk-tcg-sim.online/api/cards/catalog (150 cards, plus that simulator's per-card implementation notes) |
| `sim_notes.txt` | Extracted per-card rulings and implementation notes from that catalog |
| `netdeck/*.json` | https://api.netdeck.gg/api/cards/cyberpunk (152 cards, including 2 promos) |
| `choom_meta.*`, `choom_meta/*` | https://choom.gg/meta and its 7 archetype pages (tiers, reads, lists) |
| `choom_guides/*` | 12 community guides on https://choom.gg/guides (free portions only) |
| `choom_*` | Resources, tiers, blog and help pages |

## Tournament rules that matter for preparation
- **Swiss:** Bo3, 50 minutes. **Top cut:** Bo3, 75 minutes. Sideboarding between games takes 2 minutes. The **loser of the previous game chooses** who goes first.
- **Sideboard:** exactly **7** cards. It may only hold main-deck cards, never Legends, and the deck keeps the same size after sideboarding.
- **When time is called:**
  - finish the current turn;
  - each player then gets 1 more turn, of up to 5 minutes each;
  - after that, a player with 7+ Gigs wins; otherwise the game is a draw.
  - In top cut, play continues until one player has more Gigs than the other.
- **Legality:** Alpha Kit cards are not legal, except a029 Saburo, a030 Goro and a031 Yorinobu. Rebecca: Having a Moment is not legal yet.

## Community data points (choom.gg, 9 Nov 2026)
- **Hand-rated tiers:**
  - **S:** BBG Cunningham Econ (94), RRY Smasher Aggro (91).
  - **A:** RRG Dexter Midrange (85), YYB Rogue Gear (81), RRB Wakako Midrange (77).
  - **B:** GRY Trauma Team (68), Rainbow Fixer (64).
- **Choom Table (1,659 human games):**
  - going first wins 57%;
  - games average 12 turns;
  - 28% reach overtime.
- **Card ratings:**
  - **S:** Three Mouths, One Desire (96), Towerfall (90).
  - **A:** Adam Smasher: Ender of Legends (88), Carnage at the Colosseum (84), Gunpoint Diplomacy (78).
- **Community deckbuilder snapshot** (716 decks, Sep 2026, per gamertagmythras.com):
  - most-used Legends are River Ward, Judy, Alt Cunningham and Hanako;
  - Red/Yellow is the most common colour pair.

## Deck formats
- **choom.gg "text"** keeps printings and can be read back in:
  ```
  // Name
  // Format: Constructed
  // Legends
  1 Name — Sub (SET)
  // Main Deck
  ...
  // Sideboard
  ...
  ```
- **"Official"** is used by cyberpunktcg.com, ChoomBattler and cyberpunk-tcg-sim.online. It covers Legends and the main deck only:
  ```
  # Name
  // Legends (3)
  1 Name: Sub
  // Units (N)
  ...
  ```
- **cyberpunk-tcg-sim.online deck JSON:** `{ name, legendIds, cardQuantities, sideboardQuantities }` with snake_case card ids.

All three formats import and export in this trainer (`src/engine/deck.ts`, tested in `tests/deck.test.ts`).

## Open questions and caveats
- **Overtime timing.** The Comprehensive Rules say overtime begins after two consecutive turns that start with an empty fixer, and anyone at 7+ Gigs wins at once. Read literally, the player going second gets the last turn before overtime. Choom.gg's human data (57% going-first wins) suggests either that the first player's tempo usually decides games before then, or that other simulators time overtime differently. The engine follows the CR text.
- **Selling via card effects.** The CR contradicts itself (5.8.2.3 vs 11.12.2.2) on whether an effect-driven sell uses up the once-per-turn Sell. No current card sells from hand via an effect, so this doesn't matter yet.
- **Approximated cards.** Five cards are approximated; they are flagged on the Cards page.
