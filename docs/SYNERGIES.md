# Synergy packages

Many cards are worth more together than alone. The synergy catalogue names those packages, and the synergy report measures how often each one is assembled and comes online in bot games and how games go when it does. The deck builders can keep, require, avoid, seed and move whole packages ("Using packages when building" below). The bots' evaluation has package terms and the coach names packages in its advice ("How scoring uses packages" below). This is [ROADMAP2.md](ROADMAP2.md) §1 steps 1–4.

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

## How scoring uses packages (`src/ai/packages.ts`)

The bots and the coach score positions with `evaluate()` and a few rules (docs/BOT_TOOLKIT.md §3, §5). Package knowledge enters there for the player's **own** list only:

- **Which packages.** The deck objective's `synergies` when the owner named them for this exact list (matched by `listFingerprint`), else every package `synergiesIn(list)` marks built-around. Computed once per list fingerprint and cached in a module map, never in the game state (bots `structuredClone` it). Every list in the active library is built around at least one package (2 to 6).
- **Facts per position** (`packageFacts`): own copies of each package's members by role in hand, in play (Units, equipped Gear, face-up Legends), among the face-down Legends, in the trash and still in the deck. Only the player's own hand and deck contents and public cards are read; the rival's list and hidden cards never are, and inside lookahead clones the rival seat's bots get no package weights.
- **Terms** (weights in `EvalWeights`, all 0 by default): `pkgHold` (keep a piece whose partner can still be had; scaled down by how many copies do the same job, so the last payoff counts and one of twelve Programs barely does), `pkgAssembly` (both halves available), `pkgSteer` (own Gigs and Street Cred toward the condition of a package whose payoff is in hand, in play or a Legend; it also chooses the roll-in die and counts in steal, swap, adjust and reroll choices), `pkgProtect` (members in play of a `requires` package assembled in play).
- **What is not rewarded:** being "online" as such. Several packages come online mostly when the deck is already losing (Behind on Street Cred, Behind on Gigs, Units in the trash, Spend then punish), so no term credits the condition holding; `pkgSteer` credits only quantities the deck's own choices move, and only while a payoff is there to use them. Board, trash and tempo conditions are not steered.
- **The coach** names a package when it is the reason, in plain words with the catalogue's names: when advising a sell, "Keep Towerfall: it pairs with Jackie Welles: Pour One Out For Me in your deck (Behind on Street Cred)." (only scarce pieces: hold credit ¼ or more); on a Gig choice, "Your deck wants your Street Cred below the rival’s (Behind on Street Cred): d6 (5) would put your Street Cred at or above the rival’s."; and a live warning, "Your Street Cred (14) is not below the rival’s (6); your deck wants it lower (Behind on Street Cred)." These describe the position, so they show whatever the weights are.
- **Measuring** (`scripts/package-scoring.ts`): every library deck built around a package against every meta deck, weights on vs off on the same seeds, seats and opponents; paired gain overall, per family, per package and per deck; how many of the deck's decisions each weight changes (a weights-off shadow bot asked at every decision); and how often a scarce piece was sold or discarded while its partner was obtainable. First measurement (2026-11-11, Hard, `reports/package-scoring-2026-11-11.md`): every term changes decisions, none showed a gain (held-out `pkgAssembly` 6: −1.6 points [−3.2, +0.0] over 1,092 games), so all four stay 0.

## When a deck change is adopted (`src/lib/evidence.ts`, `src/lib/deckSearch.ts`)

Until 2026-11-11 the forge, the optimizer and the Deck Lab tuner adopted a change on any measured gain. Most of those gains were noise (for example 76.3% → 77.2% over 224 games). Every builder now uses one shared rule, the same discipline as the bot-weight tuners (ROADMAP §7).

**Screening only nominates.** Candidates are still screened cheaply on the baseline's own games (same seeds, opponents and seats). The best ones that beat the list by 2+ points become nominees (forge and Lab: 1, optimizer: 6 among those above the list). Screening never adopts anything, and its numbers are never reported as the gain.

**Confirmation is held out, paired and staged.** Each nominee then plays fresh seeds that screening never used, game for game against the current list (the same seed, opponent and seat for both). The evidence is the per-game difference in score, with an interval: not two win rates measured apart. The first stage is the builder's old confirmation size (forge 2 × `--games`, optimizer `--confirm`, Lab 2 × games per test). While the interval still straddles the bar, another stage of the same size is added, up to 4 stages.

**Three outcomes.**
- **adopted**: the lower bound of the held-out paired gain is above **1 point**, with at least **200** held-out games;
- **rejected**: the upper bound is below 1 point;
- **could not tell**: neither by the last stage. The change is **not** adopted, and reports say "could not tell" with the interval and the games played. It is never called a gain.

**The futility stop.** A change with no real gain can almost never be formally rejected at these sample sizes: the two lists play the same game about 90% of the time, so even at 896 games the interval is still about ±2.2 points around zero, and the nominee used to run to the cap and pay 4× the confirmation for nothing. So, after **2 stages**, a nominee that is neither adopted nor rejected and whose held-out paired mean gain is **0 points or less** stops there. It ends as **could not tell**, recorded with `stopped: 'futility'` and shown as "could not tell (stopped early: no gain after N games)"; its games and interval are the ones at that point. It never adopts anything, so it cannot raise the false-adopt rate, and the α split above is left as it is (the looks it saves are not spent back). With several nominees (the optimizer's 6, or `--nominees`) each one is stopped on its own; a later stage is played only while one is still live, the current list still plays it once, and every game played is the same game it was without the stop (same seeds). The legacy `any-gain` rule has no stop. On synthetic paired games (`tests/evidence.test.ts`, 1,000 runs each, off → on):

| Setting | Adopted | Mean games (both lists) | Stopped early |
|---|---|---|---|
| no gain, stages of 224, 90% same game | 0.1% → 0.1% | 1,684 → 1,238 | 57% |
| +1 point (at the bar), same | 1.0% → 1.0% | 1,765 → 1,588 | 21% |
| +5 points, same | 100% → 100% | 596 → 596 | 0% |
| no gain, stages of 140, 60% same game | 0.3% → 0.3% | 1,095 → 791 | 59% |
| +5 points, same | 37.8% → 37.7% | 997 → 970 | 5% |

The runs are coupled (the stop only skips later stages of the same random games), so every adoption with the stop is also an adoption without it.

**The correction for looking more than once.** Each look uses a wider interval: the error rate α = 0.05 is split evenly over the planned looks and the nominees (Bonferroni), so every look uses z = Φ⁻¹(1 − α / (2 × looks × nominees)): 2.50 for one nominee and 4 looks, 3.08 for the optimizer's 6. Whatever stage a decision stops at, the chance of adopting a change whose true gain is 1 point or less stays below α / 2 = 2.5%. Bonferroni is cruder than a Pocock or O'Brien–Fleming bound, but it needs no equal stage sizes or planned stopping pattern and is easy to check. When several nominees are confirmed, the adopted one is the one with the highest corrected lower bound, and its held-out figure is the one reported.

**Defaults and flags** (one object, `ADOPTION_DEFAULTS`; forge, optimizer and season take the flags, the season passing them to its forge):

| Setting | Default | Flag |
|---|---|---|
| Minimum practical gain | 1 point (the tuners' `DEFAULT_MIN_GAIN_PP`) | `--min-gain P` |
| Minimum gain for package moves | the same | `--package-min-gain P` |
| Games before any adoption | 200 | `--min-games N` |
| Confirmation stages (cap = stages × first stage) | 4 | `--confirm-cap K` |
| α, split over looks and nominees | 0.05 | `--alpha A` |
| Futility stop: after this many stages (0 = off) | 2 | `--futility-after N` |
| Futility stop: held-out mean gain at most | 0 points | `--futility-gain X` (negative as `--futility-gain=-1`) |
| The rule | `evidence` | `--adopt any-gain` restores the old rule, to reproduce old runs |

**Search depth** (flags on forge and optimizer, passed on by the season; Deck Lab → Tune → Search depth):

| Setting | Default | Flag | Cost |
|---|---|---|---|
| Cards per change | 1 | `--cards-per-change 2` or `3` | pairs (and triples) of the best 4 screened one-card swaps that beat the list: up to 6 (10) more screenings per generation |
| Packages per change | 1 | `--packages-per-change 2` | pairs of the best screened package moves ("swap A for B and complete C"): up to 6 more |
| Nominees confirmed per generation | forge and Lab 1, optimizer 6 | `--nominees N` | each one adds its own stages, and widens every interval |
| Singles combined | 4 | `--combine-from N` | |
| Generations | forge 2, season 1 | `--gens`, `--forge-gens` | |

A combined candidate is built only from screened changes, must be a legal list and must respect the package plan like every other candidate; it is screened on the same games and judged by the same rule.

**What it costs.** Before a run the forge and optimizer print the range of games it can play (screening only, up to every confirmation running to the cap) and refuse a run over `--budget` (12,000 games per deck) unless given `--force`; the season checks its forge step against `--forge-budget` before it starts. The Deck Lab shows the range under Search depth and asks before a run over 12,000 games. A default forge run (2 generations, 140 games per test, 6 swaps) plays 1,960 to 6,440 games per deck, against 1,960 to 3,080 before. The most is unchanged by the futility stop; a nominee whose true gain is near zero now stops after 2 stages about half the time (when its held-out mean is at or below zero) and otherwise still runs all 4, so expect somewhat less than the upper end when nothing much helps. The season's forge step (1 generation, 112 games, 5 swaps) is 672 to 2,464 games per new deck (was up to 1,120).

**Where it is recorded.** Forge logs and JSON (`adoption`, each generation's `nominees` with screening and held-out results, `verdict` adopted / rejected / inconclusive / kept), the forged deck file (`// Forged …` lists each adopted change with its held-out gain, interval and games, and `// Adoption:` states the rule), the optimizer report and JSON (`nominees`, `best`), the season report, the Deck Lab result panel and saved notes, and every builder's run manifest (optional `adoption` field: rule, numbers, correction, first stage, nominees, depth, and the futility stop's `futilityAfterStages` / `futilityMaxGainPp`, absent in runs recorded before it existed; schema stays 1). A nominee stopped early carries `stopped: 'futility'` in the `nominees` records, and every report says "stopped early: no gain after N games" beside "could not tell".
