# Synergy packages

Many cards are worth more together than alone. The synergy catalogue names those packages, and the synergy report measures how often each one is assembled and comes online in bot games and how games go when it does. This is [ROADMAP2.md](ROADMAP2.md) §1 steps 1 and 2. Nothing in the bots, the coach, the tuner or the breeder reads either yet (steps 3 and 4).

## The catalogue (`src/content/synergies/`)

- `vocabulary.ts`: the types and the condition vocabulary (`CONDITION_TERMS`).
- `catalogue.ts`: the entries (`SYNERGY_LIST`), read off the card text and the card scripts. Every entry is `status: 'draft'`.
- `index.ts`: resolving members, `synergiesIn(deck)` (which packages a list holds, copies per role, built-around, draw odds), `holdOdds` (the hypergeometric odds) and `conditionHolds` (the `online` evaluator).

An entry:

| Field | Meaning |
|---|---|
| `id` | stable kebab-case id; reports are keyed by it, so never reuse one for a different package |
| `name`, `description` | a short name and one line in plain words (paraphrase; never the card or rules wording) |
| `family` | gig-value, street-cred, type, gear, program, trash, legends or tempo (grouping only) |
| `bond` | `requires`: the payoffs do little without the enablers; `helps`: every piece works alone, together better |
| `members` | explicit card ids with a role and a short note |
| `groups` | members by class, only when a payoff's own text names the class exactly ("a friendly ARASAKA Unit", "a BRAINDANCE Program"); `except` drops cards of the class that can't do the job (power 0, can't attack) |
| `propose`, `rejected` | predicates that propose candidates (e.g. text mentions "min Gig"). Every card a proposal matches must be a member or be in `rejected` with the reason, so a new card that fits is noticed by the tests |
| `needs` | the pieces that make it work at all (`enabler`, `payoff`, `any`); what "assembled" and the draw odds count |
| `builtAround` | the minimum copies (per role and in total) for a list to count as built around it; a Legend counts one |
| `online`, `onlineText` | what "online" means, as plain data over the condition vocabulary, and the same in words |

Roles: `enabler` makes the condition happen, `payoff` is rewarded by it, `both` does both (it fills either role, one at a time), `piece` is for a package with no such split. In a condition, a role filter of `payoff` or `enabler` also matches `both` cards.

Condition terms (definitions in `CONDITION_TERMS`): `all`, `any`, `in-play` (Units on the field, equipped Gear, face-up Legends), `used` (played, Called, gone solo, Legend play, ability, attack or reaction this turn; selling is not a use, and cards an effect plays for free are not seen), `min-gig`, `high-gig`, `max-gig`, `value-pair`, `distinct-values`, `even-and-odd`, `cred-even`, `cred-vs-rival`, `cred-at-least`, `gigs-behind`, `equipped`, `legends-up`, `trash`. Add a term only when a condition can't be phrased with these, with its definition and its case in `conditionHolds`.

**How the owner edits it.** Change an entry in `catalogue.ts` (members, roles, notes, minimums, the condition), then set `status: 'owner'`. `npx vitest run tests/synergies.test.ts` checks that every id is a real card, ids are unique, every term is defined, every proposal is confirmed or rejected, and every active library deck's packages compute. Editing the catalogue changes its fingerprint (`CATALOGUE_VERSION`); the site then says the published report was measured with an earlier catalogue until it is re-run. A deck objective may name the packages its deck is built around in the optional `synergies` field (`src/content/deckObjectives/vocabulary.ts`); the deck profile marks those "in the game plan".

**Draw odds.** `holdOdds` is the exact multivariate hypergeometric chance of holding the needed pieces after seeing the opening 6 plus one card per turn (the engine draws every turn, the first player's first included, so it is the same on the play and on the draw). Legends in the list count as held from the start, although a face-down one still has to be Called. Mulligans, extra draws and searches are not modelled; the measured rates include them.

## Measurement (`src/analysis/synergies.ts`)

`npm run sim -- analyze --synergies` (with `--decisions` if wanted) observes every game; `--synergies-only` writes only the synergy outputs and nothing else (no analysis, review, impact or decisions file). Outputs: `reports/synergies-latest.{json,md}` and, for a whole-field run without `--out`, `public/data/synergies.json` (compact, rates to 4 decimals). None of them is replaced without `--force`, and `--out DIR` keeps them all in DIR. The run manifest is in the report.

How it observes: the decision recorder gets an option, `new DecisionRecorder({ boards: true })`, which also keeps a board snapshot of each player's own view before every decision and at the end of every main phase (`BoardSnapshot` in `src/engine/telemetry.ts`: their Units, equipped Gear, face-up Legends, Gigs, both Street Creds, trash counts), and the first sighting of each of their main-deck cards in hand or play from turn 1 on (`CardSighting`). The engine calls the recorder at the end of each main phase (`turnEnd`), behind the same single `if` as the other hooks. It only reads; clones never record; the same seed plays identically with it on or off (`tests/decision-telemetry.test.ts`). The decision record schema is unchanged (still 1); the snapshots are a separate, optional output, and a snapshot holds only public cards plus the player's own sightings.

Per game, per seat and per package its list holds (`observeSynergies`): member copies drawn by role, the first round the needed pieces were all held, the first round the `online` condition held (at any snapshot that turn, with that turn's uses), how many turns it held, own turns played, the result, and every member use with whether a partner piece was held then (another member of the complementary role drawn by that turn, or a partner Legend face-up). Workers aggregate per game; the main thread merges.

## Reading the report

Per list and package: games; **pieces held** (share of games with the needed pieces at some point); **by turn 2 / 4 / 6**: the share with the pieces held, the draw odds in brackets, and the share online so far (out of the games that reached that turn); **online** (share of games it came online at all); **median turn** it first came online; **won when online** versus **won when never online**, each with its game count and 95% Wilson interval; and per member card, the win rate in games it was used with a partner present and with none. "All lists pooled" mixes every list holding a package (more games, different decks, no odds).

Slices under 20 games (`MIN_SLICE_GAMES`, as in the decisions report) show only their size and are not rated.

**Association, not causal value.** A package that comes online mostly in games already going well looks good for that reason alone, and a package that only comes online when behind (e.g. Behind on Gigs) looks bad for the same reason. "Online versus never" is not what the package is worth; it says where to look. Observed "held by turn N" is usually above the odds because of extra draws and searches.
