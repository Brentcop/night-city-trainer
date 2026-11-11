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
