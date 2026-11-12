# Roadmap 2

Started 2026-11-11. [ROADMAP.md](ROADMAP.md) is complete apart from the items carried over in §3 below; it stays as the record of the first round. Section numbers in other files (`ROADMAP §5`, `§7`) refer to that file.

## 1. Synergy packages and evidence thresholds (requested 2026-11-11)

**Owner's point.** Many cards are worth more together than alone: shared types, cards that raise or lower Gig values, and cards built around wanting low or high Street Cred. The coach, the tuner and the breeder score cards one at a time today, so they can break a package apart, undervalue a card whose partner is missing, and report a card's impact without saying how often its combination was seen in play.

**Plan.**
1. **Name the packages.** A small, human-edited catalogue of synergies (`src/content/synergies/`, same style as the deck objectives): each has an id, the cards or card predicates in it (type, Gig-value raisers and lowerers, low or high Street Cred payoffs and enablers), what "online" means as an observable board condition, and whether the pieces need each other or only help. Start from card text and the guides; detection by predicate can propose candidates, a person confirms them.
2. **Measure them.** From decision telemetry: how often each package was assembled (pieces drawn, pieces in play together, condition met), by turn, and results with it online versus not, with sample counts and intervals. Report a card's impact split by "partner present" and "partner absent", and show how likely the combination is to appear at all in a list (copies and draw odds), so a strong but rarely seen combination is not read as a strong card.
3. **Use them in building.** The breeder and forge treat a chosen package as a unit: an option to lock a package (never cut below its minimum copies), to seed a deck around one, and to mutate by swapping whole packages. Deck Lab and the CLI let the owner pick which synergies to keep, require or try combining. A deck's objective note can name its packages.
4. **Use them in scoring.** The coach and evaluation credit progress toward a package the deck is built around (holding a piece for its partner, not selling it; keeping Street Cred low or high when the deck wants that), as weights the tuner can reach. Behaviour-changing, so it needs a `SIM_VERSION` bump and a re-recorded baseline.
5. **Thresholds.** Set the numeric bar for changing a list (minimum sample, interval lower bound, practical gain on held-out matched games) and apply it to forge adoption, which today adopts on any gain. Search depth is a setting: how many cards or packages may change at once, and how many combinations of packages are tried.

Steps 1 and 2 change no game results and come first; they also show which of the later steps are worth building.

**Done 2026-11-11 (steps 1 and 2; docs/SYNERGIES.md).**
- Step 1: `src/content/synergies/` holds 21 draft packages read off the card text and scripts: low Gigs (min Gig), high Gigs (8+), value-pairs, mixed Gig values, lower-then-swap, behind / ahead on Street Cred, even Street Cred, behind on Gigs, spend-then-punish, ARASAKA Units, Corpo and Ganger steals (Evelyn Parker), ROCKER Units, BRAINDANCE Programs, Blockers (Goro Takemura), Programs as fuel, Gear on Units, the Cyberware toolbox, Gear as fuel, face-up Legends and Units in the trash. Each has roles (enabler / payoff / both / piece), whether the pieces need or only help each other, the pieces it needs, a built-around minimum and an `online` condition over a 17-term vocabulary. Predicates propose members and every proposal is confirmed or rejected with a reason. `synergiesIn(deck)` gives a list's packages, copies per role, built-around and the exact draw odds by turns 2, 4 and 6. A deck objective may name its packages (optional `synergies` field). All entries are `draft` for the owner to correct.
- Step 2: optional board snapshots on the decision recorder (observe-only; same games on or off; clones never record), a per-game observation (pieces drawn, first round the pieces were held and the condition held, turns online, result, member uses with or without a partner) and a report per list and pooled, with 95% Wilson intervals and slices under 20 games not rated. `npm run sim -- analyze --synergies` / `--synergies-only` writes `reports/synergies-latest.*` and `public/data/synergies.json`, shown on Card stats → Synergies and on each deck profile ("Synergies in this list").
- First report: `npm run sim -- analyze --field all --bot deep --games 6 --seed 1 --threads 12 --synergies-only`, 4,446 deep-bot games (every pairing of the 39 active library decks, 228 games per list, SIM_VERSION 5), 1,247 s of games (21 min in all). 20 of the 21 packages appear (no list holds Evelyn Parker: Beautiful Enigma). Packages that come online in most games: min Gig (68% of player-games), value-pairs (73%), lower-then-swap (67%), high Gigs (63%), Programs as fuel (59%), ARASAKA Units (56%). Rarely: face-up Legends (10%), behind on Gigs (13%), Gear as fuel (16%), spend-then-punish (17%; never in the three bred RBG/BGY lists that hold it), ahead on Street Cred (17%). Clear online-versus-never differences, pooled: ROCKER Units +16 points (50% vs 34%, n=504 / 408), BRAINDANCE +7, value-pairs +7, ARASAKA +5; the other way, behind on Street Cred −25, face-up Legends −16, Blockers −14, spend-then-punish −13, Units in the trash −12, Gear as fuel −12, behind on Gigs −9. The negative ones mostly come online when the game is already going badly (behind, rebuilding from the trash), so they are not evidence against the packages. Per list, 228 games is enough for most "online" slices but not for "never online" in lists where a package is almost always online (min Gig and Programs as fuel in the Blue lists; marked not rated).
- Remaining: the owner's review of the catalogue (statuses are all `draft`); a meta-only run with more games per list; then steps 3–5. The report is association, not value: it says where to look, not what a package is worth.

## 2. Learning from recorded human games (owner will supply creator table-cam footage)

Table-cam video of two players is the hard case for automatic reading: cards are small, angled, sleeved and partly covered, and hands are hidden. Order of work:
1. **Replay-and-compare first.** A plain-text game record (who played what, attacks, blocks, Gigs, results) that the engine can replay, stopping at each human decision to compare it with what the coach and the bot would do. It can be typed by a person watching the video, and it is useful before any video reading exists.
2. **Assisted transcription.** A tool that steps through a video with the board state beside it, proposing the next action from the frame (card art matched against the card images) for a person to confirm. Hidden information stays unknown, as in the telemetry (`?`).
3. **Use.** Disagreements between strong players and the bot become review cases and test positions; decks and sequencing seen in play feed the synergy catalogue (§1). Not training data for automatic tuning until there are enough games to hold some out.

## 3. Carried over from the first roadmap

- **Decision value** (ROADMAP §5 step 3): compare each recorded decision with its alternatives from the same state and random worlds. Today's card stats are win rates when a card was used.
- **One shared value contract** (ROADMAP §5 step 5) for the coach, card-impact table, tuner and breeder. §1 of this file feeds it.
- **Telemetry gaps:** resolving effects as their own records, the human seat, slices by opponent strategy and by a deck's declared objective.
- **Coach re-measurement:** blunder rates and reviewer validation on the new baseline; grade mulligans, payments, target and mode choices, Gig selection and effect ordering.
- **More seasons**, and a re-measurement of the archived bred decks to decide whether any return.
- **Small leftovers:** `data/seasons/deck-impact.json` is keyed by deck name; an effect that does nothing yet is never offered when ordering pending effects; the policy numbers still fixed inside `src/ai/heuristic.ts`.
- **Visual checks** of the Play board, phone board and pages in both themes (ROADMAP §6).

## 4. Reported defects, not yet scheduled

- Two FAQ divergences on Jackie Welles: Mama's Favorite (needs simultaneous defeat).
- The evaluation undervalues Gear and "can't attack" effects; some of those cards are never played.
- Several evaluation weights change no decision (variants scored exactly 0.0 over matched games), which limits the tuner.
- The bot takes the first listed option every time on Gig roll-in and discard-for prompts.
- The forge adopts a change on any gain (covered by §1 step 5); the breeder can produce a deck with 12 Units.
- `tag-provenance.ts` drops the forge's dated line and reformats ladder files; the ratings report prints "93th".
- The two pool behaviours noted in WP-C4: the browser pool's give-up limit follows the workers still alive, and the Node pool's `close()` leaves running jobs unsettled.
