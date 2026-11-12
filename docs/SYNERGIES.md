# Synergy packages

Many cards are worth more together than alone. The synergy catalogue names those packages, and the synergy report measures how often each one is assembled and comes online in bot games and how games go when it does. The deck builders can keep, require, avoid, seed and move whole packages ("Using packages when building" below). This is [ROADMAP2.md](ROADMAP2.md) §1 steps 1–3. Nothing in the bots, the coach or the evaluation reads the catalogue yet (step 4).

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

## Using packages when building (`src/lib/deckPackages.ts`)

The deck builders change one card at a time and score cards one by one, so on their own they can cut one half of a pair, strand a payoff without its enabler, or never try a whole package. `src/lib/deckPackages.ts` is the shared, plain-data layer they all use (Node scripts and the browser). On the command line it is **opt-in**: with no package flag every script makes exactly the candidates, lists and reports it made before (pinned in `tests/deck-packages-defaults.test.ts`).

**The plan** (`PackagePlan`, plain data):

| Part | Meaning |
|---|---|
| `keep` | The package's pieces in the starting list may not be cut below its **working minimum**: its `builtAround` count when the list meets it, else the pieces it `needs` at all (both roles for a package whose pieces need each other). Cards beyond that minimum stay free to change. A kept package the list doesn't hold changes nothing. |
| `require` | The result must be built around it: a change may not move the list further away, and the tuners always try the moves that add or complete it. |
| `avoid` | The result must not be built around it: no new pieces while it is, and fillers never bring its pieces in. |
| `lockCards` | Card id → copies that may not be cut (a list holding fewer keeps what it has). |

`checkChange(before, after, plan)` says whether one candidate breaks the plan and why; `checkList(deck, plan)` checks a whole list (and the deck-construction rules). Every builder filters its candidates through them, so a candidate that breaks the plan is never played; the forge's log lists the swaps the plan kept out and why.

**Package moves** (`packageMoves`), beside the one-card swaps:
- **complete**: a package with pieces of one side only (a payoff without its enabler, or the reverse) gets the missing side, up to that role's built-around count;
- **add**: a package the list is not built around gets its minimum working set: members legal for the Legends' RAM, by role first, cards already in the list first, then the builder's card score;
- **swap**: a package the list holds for one it isn't built around, when the two moves are within 3 cards of each other in size;
- **remove**: every main-deck piece of a package, refilled with the best legal cards outside it. A package too big to cut whole (more than 10 copies, e.g. Programs as fuel, where every Program is an enabler) loses only the side that dissolves it: its payoffs, or its enablers when they are fewer.

The cards cut to make room go cheapest first: cards in no kept or required package before the rest, then cards in fewer of the list's built-around packages, then the lowest score. Legends never change. Every list a move makes passes `validateDeck`, keeps its size and respects the plan; one move changes at most 10 cards; with a limit, moves are taken in turn from each kind.

**Seeding** (`packageTriples`, `seedAround`, `packageCompatibility`): the Legend trios that can hold one or two packages at their built-around minimums (enough RAM in the members' colours), best first: Legends that are pieces themselves, the Legends' strength, two colours or fewer. The list is filled the way explorers are filled, then each package is topped up to its minimum. Two packages that no trio can hold are refused with the reason in plain words. With the current catalogue every pair has a trio (each Legend gives 2 RAM, and every package has enough low-RAM members), but three pairs pull opposite ways (Low Gigs with High Gigs, High Gigs with Lower then swap, Behind with Ahead on Street Cred) and get a plain warning that they will rarely be online together.

**Defaults.** A deck objective's `synergies` field is the default `keep` for that deck when the owner gives no plan: on the command line only once a package flag is on (`--keep-packages none` turns it off), in the Deck Lab always. In the Deck Lab a list without one keeps the packages it is built around.

### Command line

| Flag | Scripts | Meaning |
|---|---|---|
| `--keep-packages a,b` | forge, optimize, season, breed-preview | keep these (see above); `none` keeps nothing. In the breeder: a bred deck is built around a kept package when a parent was |
| `--require-packages a,b` | all four | the result must be built around these |
| `--avoid-packages a,b` | all four | the result must not be built around these |
| `--lock-cards id[:n],…` | forge, optimize | never cut these cards below n copies (no n = every copy) |
| `--package-moves` | forge, optimize, season (passed to its forge) | also try whole-package moves |
| `--package-cands N` | forge, optimize | package moves per round (default 3) |
| `--seed-packages a+b,c` | season, breed-preview | the explorer slots are built around these combinations of one or two packages, in turn (the season's forge then keeps them) |
| `--out DIR` | forge, optimize | write the forged list and the reports to DIR instead of the repository (for trials) |
| `--lists` | breed-preview | print each bred list and the packages it holds |

Ids are the catalogue ids (`min-gig`, `low-cred`, `program-fuel`, …). An unknown id, a package both kept and avoided, or a seed of two packages no Legend trio can hold exits with code 2, with the list of valid ids. Examples:

```
npx tsx scripts/forge.ts s1-01-mutant-rry --keep-packages high-cred --out <scratch dir>
npx tsx scripts/forge.ts meta-yyb-rogue-gear --package-moves --gens 1 --out <scratch dir>
npx tsx scripts/breed-preview.ts --seed-packages low-cred+program-fuel,arasaka --lists
```

**Provenance.** With package flags the forge writes a `// Packages:` line in the forged deck file (the plan, the built-around packages kept, added and removed, the package moves adopted), the plan and its effect in `reports/forge/<deck>.md`, and a `packages` field in its JSON; the optimizer's report and JSON name the plan and what the best list kept, added and removed; bred deck files get a `// Packages:` line, the season report names each new deck's packages and changes, and the season JSON's `bred` entries carry them. Every run manifest made with a plan has the optional `packages` field (`PackageProvenance`: the plan, seeds, the package moves tried and the catalogue version); the manifest schema stays 1.

### Deck Lab (`#/lab`)

- **Tune a deck → Synergies**: every package the submitted list holds, with a Keep box each. Default: the packages its game plan names (a library deck whose objective has `synergies`), else the ones it is built around; the caption says which. **Try package moves** is off by default (about 3 more tests per generation when on). Package moves are marked "package · kind" in the swap table; the result panel shows the packages the tuned list is built around, marked added (+) or removed (−), the plan and any package move adopted, and a saved list's notes repeat them. The run's manifest carries the plan.
- **Breed new decks → Build around synergies**: pick one or two packages. The explorers are then built around them; **Also build mutants, crossovers and counters around them** (on once a package is picked) fits every other deck to them too, and a deck that can't hold them is not bred (the panel says how many could be). The picker says how many Legend trios can hold the pick, or why not, and warns when two pull opposite ways. Each bred deck shows the packages it is built around and any package change made to fit.

The controls are native checkboxes and toggle buttons (`aria-pressed`) in labelled fieldsets, disabled while a run is going.
