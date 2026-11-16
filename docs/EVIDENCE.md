# Evidence: findings

Every number the site reports about a deck is a **finding**: one plain-data record with an estimate, an interval and its level, the games behind it, a strength word given by a stated rule, a stable id, and its nature. This is package P2 of the tuning plan (docs/TUNING_STUDY_2026-11-13.md, "Proposed evidence view"). P3 is the page that shows them ("The page", below).

- Model and rule: `src/lib/findings.ts` (pure; Node and browser).
- Words (claims, chips, flags, why an association may mislead, gap notes): `src/lib/findingWords.ts`.
- Re-measurement input format: `src/lib/remeasure.ts`.
- Builder: `scripts/evidence-build.ts` (the kinds) and `scripts/build-evidence.ts` (reading, writing, checks, the command).
- Output in `public/data/evidence/`:
  - `index.json`;
  - one `<listId>.json` per library deck (findings, open questions, gaps);
  - `<listId>.runs.json` for each deck that has recorded runs;
  - `ids.json`, the short-id lookup.
- Tests: `tests/findings.test.ts`, `tests/build-evidence.test.ts` (the join of a recorded run and the ledger: "a recorded forge run whose games the ledger also keeps is shown once"), `tests/evidence-ui.test.tsx` (the page and its words).

## What a finding is

| Field | What it holds |
|---|---|
| `id`, `short`, `question` | A hash of what was measured (16 hex digits); its first 8; the same hash without bot, simulator version and method. |
| `kind`, `nature` | What was measured, and whether it is a `result`, an `effect` or an `association`. |
| `claim` | One line, without the numbers. |
| `subject` | The list (`listId` = `listFingerprint`), deck name and file; where relevant the card, the package, the opponent, the change (cuts and adds by card id, its key and label) or the ending. |
| `estimate`, `lower`, `upper`, `level` | The number and its interval. `level` is 0.9 or 0.95. |
| `sequential` | Set when `[lower, upper]` is a sequentially corrected interval: `always-valid`, `obrien-fleming` or `bonferroni`. |
| `p95` | The plain 95% interval, when `[lower, upper]` is not one. The strength rule reads it. |
| `baseline` | What "no difference" is: 0 for a difference, 0.5 for a win rate, the field's share for an ending. |
| `games`, `n` | The games behind it; the count the game minimums read (see the rule). |
| `method` | How it was measured (below). |
| `simVersion`, `bot`, `field` | What it was measured under. |
| `sources` | File and field path of every input number, e.g. `src/data/ratings.json` `decks[11].wrField`. |
| `family`, `corrected` | The family it was tested in (key, size, correction), and whether it passed the family's test. |
| `strength`, `flags` | The strength word, and flag codes a page turns into words (`FLAG_WORDS`). |
| `adjusted` | Card associations only, with `--adjusted`: the adjusted, shrunk estimate. |
| `detail` | Display numbers of the kind: the raw matchup record, the seat split, the length thirds, the screening figure of a change, and so on. |

Numbers are fractions: 0.01 is one point. Stored numbers are rounded to 6 decimals.

## Three natures, never mixed

- **result**: what the deck's recorded games show. Plain words: "expected win rate against the field".
- **effect**: a paired comparison of two lists on the same seeds, opponents and seats. Only effects may say "adds" or "costs", and only in the sentence (`sentenceOf`) of a strong or moderate one. The claim names what was measured: "<change> (a change to this list): paired win-rate difference for <deck>".
- **association**: games where a card was drawn or a package was online, against games where it was not. The claim is fixed: "games where X was drawn were won more often than games where it was not". It always carries the reason it may mislead (`MISLEAD`). A test checks that no association claim uses a causal word.

## The kinds

| Kind | Nature | Method | Number | Baseline | `n` | Family |
|---|---|---|---|---|---|---|
| `deck-strength` | result | `rating-model` | Expected win rate against the field, with its stored 90% range (full covariance), from `src/data/ratings.json`. | 0.5 | rated games | the 47 decks |
| `matchup` | result | `shrunk` | The shrunk head-to-head of `public/data/h2h.json` (`h2hFileLookup`), with the raw record in `detail.raw`. Interval below. | 0.5 | the fewer rated games of the two decks | the deck's matchups |
| `matchup` | result | `direct-games` | Meta decks only: the pairing's recorded win rate over its analysis games, Wilson interval. | 0.5 | the pairing's games | the deck's direct matchups |
| `seat` | result | `model-residual` | Result minus the ratings' prediction, going first minus going second (below). | 0 | the fewer games of the two seats | the 47 decks |
| `length` | result | `result-split` | Win rate in short games minus long games (below), Newcombe's interval (`gapOf`). | 0 | the fewer games of the two groups | the 47 decks |
| `ending` | result | `result-split` | Share of the deck's wins that ended this way (`endReasons`), Wilson interval. | the field's share | the deck's wins | the deck's endings |
| `card-assoc` | association | `association` | Won when drawn minus not drawn (`cardAnalysis`), Newcombe's interval. Meta decks only. | 0 | the fewer games of drawn and not drawn | the deck's cards |
| `package-assoc` | association | `association` | Won when online minus never online (`packageFact`, the lift of `src/ai/packageLift.ts`). | 0 | the fewer games of online and never | the deck's packages |
| `change` | effect | `paired-pooled`, `paired-staged`, `paired` | A change's paired gain (below). | 0 | paired games | its tool's own correction |

Every number comes from the function that already defines it: `src/lib/eventFacts.ts` (`firstPlayerSplit`, `endReasons`, `ratingsTable`), `src/lib/ratingGames.ts`, `src/lib/ratingModel.ts` (`predictPair`, `fitRatings`), `src/lib/h2hModel.ts`, `src/lib/cardFacts.ts`, `src/ai/packageLift.ts`, `src/lib/changeLedger.ts`, `src/lib/shortlist.ts`, `src/lib/evidence.ts`, `src/lib/deckSearch.ts`. `tests/build-evidence.test.ts` checks on the real data that each finding equals the number its function gives.

The recorded games are the pooled events, chosen as the ratings choose them (`selectEvents`: the simulator version and bot of the newest event). A deck entered twice plays as itself; mirror games are left out.

### The matchup interval

`h2h.json` stores each pairing's shrunk estimate p̂ = p₀ + (w − e)/(g + M), where p₀ is the ratings' prediction, w and e are the direct wins and expected wins, g the direct games and M the prior's weight in games. It stores no interval. The interval comes from the variance of (the pairing's true win rate − p̂):

    Var = (M / (M + g))² · (Var(p₀) + τ²)  +  g · p̂(1 − p̂) / (M + g)²

- **Var(p₀)** is the prediction's own uncertainty: the delta method on the full covariance of the rating fit, rebuilt from the same games as `scripts/build-h2h.ts` fits them. If the rebuilt ratings do not match the file's to 2·10⁻⁴, the term is left out and the finding is flagged `model-uncertainty-missing`.
- **τ²** is the pair spread: how far a pairing's true win rate sits from the ratings' prediction. The event records cannot measure it. The pairings have about 5 games each, too few to resolve it, which is why the h2h file's prior weight sits at its 1,000-game cap. So it is measured on the per-deck analysis' pairing table (`src/data/analysis.json`), where every pairing of the 7 meta decks has 200 games, 100 on each seat (`pairSpread`):
  - each pairing is taken once and expanded into games seat by seat; the table is refused when a seat's wins are not a whole number;
  - a Bradley–Terry fit with a going-first term (`fitRatings`) gives each game's expected score with its seat;
  - per pairing, w wins, e expected wins, v = Σp(1−p) and g games;
  - τ² = max(0, (P/(P − K)·Σ(w − e)² − Σv) / Σg(g − 1)), with P pairings and K decks.
  - It needs at least 15 pairings of 100+ games. Otherwise the default SD of 6 points is used, and every matchup finding is flagged `spread-default`.
- The second term is binomial noise in the direct games. When τ² = p(1−p)/(M + 1) the formula is the beta posterior of a prior worth M games.
- The 95% interval is drawn on the logit scale, so it stays inside 0–1. There is no widening factor.

**Measured on 2026-11-15:**

- **The spread.** On 21 meta pairings (4,200 games), the fit misses the records by χ² = 65.6 on 14 degrees of freedom. τ = 6.4 points.
  - It is measured with the Deep bot on the meta pairings only, and assumed for every other pairing.
  - Its own uncertainty is large: 21 pairings.
  - The h2h file's prior weight is unchanged, so the estimate itself is still the head-to-head file's.
- **The check (leave one event out).** For each recorded event, the ratings and the shrinkage are fitted on the other events (`h2hEstimator`). Each held-out game's chance is the training fit's prediction for its seat plus the pairing's shrunk residual. Scored over 2,399 held-out matches and 6,014 games:
  - **Calibration.** The logistic slope of the result on the logit of the chance is 0.916 ± 0.041. 1 is calibrated; below 1 the estimates are mildly over-confident, too far from even for lopsided pairings. The favoured deck scored 3,753 against 3,812 expected.
  - **Distance of the truth from the estimate.** Given the pairing's true rate, the residuals of games 1 and 2 of a match are independent, and both games are always played. So the mean of their product estimates the squared distance with no binomial correction. It is 0.0072 ± 0.0047: an SD of about 8.5 points, 95% from 0 to 12.8.
  - **What the interval claims.** The interval claims 0.0058 on average (SD 7.6 points). Without τ² it would claim 0.0018 (SD 4.3 points), too narrow.

Reproduce with `npm run evidence -- --matchup-check`. The builder computes the spread and the check on every build and stores them in `index.json` (`rules.matchup`).

**Direct matchups.** For the 7 meta decks, each pairing also has a second `matchup` finding with method `direct-games`:
- the recorded win rate over the pairing's 200 analysis games, with a Wilson 95% interval;
- bot and simulator version from the analysis manifest;
- family: the deck's direct matchups;
- minimums as for a result split: 20 games, strong from 200.

Both matchup findings of a pairing have the field label `pairing` (the opponent is the subject), so they share a `question`.

### The seat finding

How the first player is chosen in a recorded event (`firstPlayer`, `src/lib/eventFormats.ts`): game 1 of a match is a coin flip from the match seed, and after each game the loser goes first (after a tie, the other seat). So who goes first in games 2 and 3 depends on who lost the game before, and a raw first-versus-second split is confounded by the opponent: a deck that loses to strong decks goes first against them.

The finding therefore compares each game's result with the ratings' prediction for that game, seat included: P = σ(r_deck − r_opp ± h), with the ratings and the going-first term h = logit(0.5 + `firstPlayerEdge`) of `src/data/ratings.json`, through `predictPair`. The estimate is the mean residual going first minus the mean residual going second, with a two-sample 95% interval. Baseline 0 means "gains from going first as much as the field does". The raw split (wins of decided games each way, from `firstPlayerSplit`) is kept in `detail.first` and `detail.second` for display.

### The length finding

Turn counts are whole numbers and bunch up: about half the recorded games last 14 turns. Exact thirds do not exist, so the cut points are the pair (a, b) whose three groups (turns ≤ a, between, turns ≥ b) come closest to a third each, by least squares of the shares. Today that is **short ≤ 12 turns (20.0% of games), middle 13 (23.3%), long ≥ 14 (56.7%)**, over all pooled games. The finding is the deck's win rate (ties half) in short games minus long games; the three win rates with Wilson intervals are in `detail.thirds`. The cut points are in `index.json` (`rules.length`).

### Changes

A change finding is a paired comparison: the list with and without the change on the same seeds, opponents and seats. Three sources:

1. **The change ledger** (`--ledger-dir`, default `data/ledger/`; what it holds today is below). For each change of the deck's list and each entry context (simulator version, bot, field), the pooled held-out games are judged exactly as the tools judge them: `judgePooled` under `ADOPTION_DEFAULTS`, one nominee, the card bar (1 point) for a one-card swap and the package bar otherwise. The finding's interval is that always-valid interval (`sequential: always-valid`); `p95` is the plain paired 95% interval for the strength rule. `detail` holds the verdict, the screening games' figure (`detail.screen`, always flagged `screening`: the screening winner reads 2 to 4 points too high), the runs that tested it, its status in the shortlist (`changeStatus`: live, or dropped and why, at the forge's 2-point nomination bar and `SHORTLIST_DEFAULTS`), the held-out games that would settle it (`gamesToSettle`), and per opponent and per seat figures. A change screened by one bot and confirmed by another (docs/SYNERGIES.md "Confirming with another bot") sits in two entries, and games of two bots never pool: the finding is the confirming bot's held-out games; its `detail.screen` is the screening bot's games and names that bot (`detail.screen.bot`); the open question, if any, is the confirming bot's, with `screenBot` and the held-out games alone as its `pooled` figure; the screening bot's entry raises no open question while another bot holds held-out games of the change; and a run's trial has no `pooled` figure for such a change.
2. **Recorded forge reports** (`reports/forge/*.json`). Season 2 and Season 3 reports hold nominees with a screening and a held-out figure: each held-out figure is a finding with the report's corrected interval (`sequential`: the report's correction), `p95` rebuilt from it as mean ± 1.96 standard errors (the standard error read from the corrected half-width), the outcome word, and the flags `first-look` (it stopped at its first look: likely optimistic) and `stopped-futility`. Season 1 reports used the any-gain rule and recorded win rates only, with no paired interval: they are runs, not findings. Reports written from 2026-11-15 on also give each nominee its held-out games by opponent (list fingerprint) and by seat, and the χ² test across opponents (`NomineeRecord` plus `byOpp`, `bySeat` and `heterogeneity`, `SplitNomineeRecord` in `src/lib/pairedSplit.ts`; with earlier runs' games pooled in, over all the held-out games the figure covers). The finding takes them as `detail.byOpp`, `detail.bySeat` and `detail.heterogeneity`, flagged `depends-on-opponent` when the report's p-value is under 0.05; an older report has none of them, and its findings are as they were. A finding's bot is the bot that played its held-out games: the report's `adoption.confirmBot` when another bot than the run's confirmed (the forge's `--confirm-bot`, docs/SYNERGIES.md "Confirming with another bot"), else the run's bot; its screening figure is then the run's bot's and names it (`detail.screen.bot`, as a ledger finding's does); the run record names both (`RunRecord.confirmBot`, "Medium bot screening, Hard bot confirming"), and so does a ledger run whose held-out batches are under another bot than its screening ones. A report whose games the ledger also keeps gives no finding of its own for those nominees (below).
3. **Re-measurements** (`data/evidence/*.json`, below): fixed-size paired measurements, plain 95% interval.

**When a recorded run is also in the ledger.** A forge run with `--ledger` writes a report and appends the same games to the ledger, so sources 1 and 2 would show one measurement twice: two findings with one `question` and the same held-out games (a staged range and an always-valid one), and two runs for one forge process. Season 3 (2026-11-16) is the first recorded run of this kind. The builder joins them (`joinReports` in `scripts/evidence-build.ts`) and shows each once:
- **The join.** A report takes part only when it has a `ledger` record whose directory is the builder's ledger directory (compared in one spelling: `./data/ledger/` is `data/ledger`). Its candidates are the runs in the ledger file of its starting list (`manifest.decks[0].id`). From 2026-11-16 the forge writes the ledger's run label into the record (`ledger.run`, only with `--ledger`), and the report joins the run of that label. A report without the label (the six Season 3 reports) joins by content: every batch of the run in that file has the report's date, simulator version and ledger field, its screening batches the report's screening bot and its held-out batches the report's held-out bot (`ledger.heldoutBot`, else the same bot), and every change it holds is one of the report's trials by change key; the report must have exactly one such run. A (file, run) pair claimed by more than one report, by label or as a candidate, joins none of them: nothing is merged and nothing is hidden.
- **Findings.** A joined report's nominee gives no finding of its own when the deck's ledger file holds its change in the nominee's context (simulator version, held-out bot, field) with a finding (2 or more held-out games) and the joined run holds held-out games of it; the ledger's finding stays, because later runs pool into it. When every held-out game of that entry comes from the joined run and they are exactly the nominee's games, the ledger finding also carries the run's own verdict by its staged rule (`detail.confirmation`: outcome, the look it ended at of its cap, the stop, its corrected range and correction, the run's id), its `first-look` and `stopped-futility` flags, and the report as a second source. Otherwise (later runs added games) the run's verdict stays in its run record. A nominee whose games no ledger entry of the deck holds (a report with no `ledger` record, no join, or a change of another list) stays a finding of its own, as before.
- **Runs.** The report's run is listed (it has the rule, what it could detect and the trials) and names the ledger's label (`RunRecord.ledgerRun`); the ledger's run of the same process is not listed again. A ledger run with no recorded report stays as it is.
- **The tools' record** counts a joined run's nominees under the forge only (below, "The index").

On today's files: S3-05, S3-07 and S3-08 have one finding for their nominee (before: two each) and S3-02, S3-05, S3-07 and S3-08 one run each (before: two). S3-03 and S3-06 adopted their change, so their ledger games sit under the list before the forge (`8d775d3797c1b394`, `87348c7e0bd76a1f`), which is no library list: their report's finding stays the one finding, its run names the ledger label, and the tools' record counts them once.

Every change carries its bot. A change measured with Medium is flagged by what Hard says about the same question (the Hard measurement with the most games under the current simulator version):
- `medium-only`: no such Hard measurement;
- `hard-confirms`: Hard's own range excludes no difference, in the same direction;
- `hard-opposite`: it excludes no difference in the other direction;
- `hard-decides`: the Medium measurement has no direction of its own (its plain range includes no difference) and Hard's range excludes it;
- `hard-no-difference`: Hard finds no difference of a point or more;
- `hard-unsettled`: Hard was measured and its games do not settle it yet.

So a Medium finding never loses its caveat merely because a Hard run exists. `relation` says whether the change starts from the deck's current list, leads to it (the change that made this list, checked against the older lists in `data/decks/custom/history/`), or concerns another list.

**What the ledger holds today.** Eight files, 183 batches, 28,672 games, 464 kB:
- **The tuning validation runs** (two files, since 2026-11-15; docs/SYNERGIES.md "Until settled, and what a run can detect"): eight forge runs in a row on S2-05 Counter (RRG) (`d5bf540ca72f871a`, 78 batches, 12,992 games) and on S2-08 Explorer (GGY) (`957336d0f03542ad`, 60 batches, 8,960 games), Medium, SIM_VERSION 9, with the shortlist and "until settled" on: 138 batches, 21,952 games, 354 kB. They are real forge games from the library's own lists, so they are the evidence the ledger is for: a later `forge --ledger` run on either deck pools with them. The changes they settled were never applied to the lists (every run started from the same list), so the page shows them as measured, not applied. No report in `reports/forge/` belongs to them, so they are ledger runs on the page.
- **Season 3's forge** (six files, 2026-11-16, one forge process, run label `forge 2026-11-16T05:19:02.886Z seed 1`): one generation per deck, screened with Medium (5 changes × 112 games each, 3,360 games) and confirmed with Hard (3,360 held-out games), SIM_VERSION 9: 45 batches, 6,720 games, 110 kB. S3-02 Mutant (RGY) `62c5a3ea2d0c5007` (screening only, 560 games), S3-05 Counter (RRG) `080a9497aa8697ce` (1,008, 448 held-out), S3-07 Explorer (RRG) `3c8b6e839d55e071` (1,008, 448 held-out), S3-08 Explorer (RRB) `e0fad68dfe3df63f` (1,456, 896 held-out); and the lists S3-03 and S3-06 had before the forge adopted a change, `8d775d3797c1b394` (1,232, 672 held-out) and `87348c7e0bd76a1f` (1,456, 896 held-out), which no deck page reads. Each is joined to its recorded report (above).

To start the ledger empty instead, delete the files and run `npm run evidence`.

**Open questions** (`open`): ledger changes still undecided and not dropped, with their held-out games, their pooled gain over screening and held-out games (`pooledGames`), and about how many more held-out games would settle them at their present mean and spread (null when the held-out mean is not above the bar, or there are none).

**Runs** (`<listId>.runs.json`, written only for a deck that has runs; the index gives its path and the number of runs): each recorded forge report for the deck (rule in words by `describeRule`, games, what it could detect at its stage sizes by `detect` at the study's per-game spreads, and its trials: label, card or package, screening figure, held-out figure, outcome, and the pooled ledger figure in the same context when there is one; `ledgerRun` when the ledger also keeps its games), and each run the ledger holds games of (its changes, screened or nominated) that is not joined to one of those reports. One forge process is one run per deck.

## Re-measurements: the input format

`data/evidence/*.json`, read strictly by `parseRemeasureFile` (`src/lib/remeasure.ts`) and checked by `check:data`:

```json
{
  "kind": "nct-remeasure",
  "schema": 1,
  "note": "what the batch is",
  "measurements": [
    {
      "id": "e2-s2-05",
      "deck": "s2-05-counter-rrg.txt",
      "label": "S2-05 -1 We Gotta Live Together +1 Yorinobu: Steel Dragon (not adopted)",
      "baseListId": "d5bf540ca72f871a",
      "candListId": "de2140e4652193a1",
      "cuts": ["we_gotta_live_together"],
      "adds": ["yorinobu_arasaka_steel_dragon"],
      "bot": "lookahead",
      "simVersion": 8,
      "games": 2800,
      "mean": 0.022857,
      "se": 0.004324,
      "sd": 0.228809,
      "byOpp": [{ "opp": "BBG Cunningham Econ", "games": 400, "mean": 0.015, "se": 0.011169 }],
      "bySeat": [{ "first": 0, "games": 1400, "mean": 0.025714, "se": 0.006967 }],
      "seed": 2000000,
      "date": "2026-11-13",
      "script": "reports/tuning-study-2026-11-13/e2-remeasure.ts",
      "record": "Medium v5 could not tell +1.5 [-0.3,+3.2] 896g, screen +5.4"
    }
  ]
}
```

- `mean` is candidate minus base per paired game; `se` its standard error.
- Optional: `legendCuts` and `legendAdds`; `sd` and `record`; `byOpp` rows, which may name `oppListId` instead of `opp`.
- Optional `seed`: the first seed of the paired games (game k used `seed + k`), so the same measurement made again can be recognised; rows made before it existed have none.
- Optional `opponents`: the field's list fingerprints. When a row has no per-opponent rows, the field fingerprint comes from them (`fieldFingerprint`, as the ledger computes it), so a re-measurement shares its `question` with the ledger entries of the same change.
- Ids are unique within a file. Never edit a row: append one, or add a file.
- The bot is named as the script named it; the builder maps it to the canonical name (`ledgerBot`: `lookahead` is Medium).
- The first file, `remeasure-2026-11-13-e2.json`, is experiment E2 of the tuning study: eight changes, 2,800 paired games each, Medium, SIM_VERSION 8.
- `npm run remeasure` makes a row (below).
- `remeasure-2026-11-15-p5.json` is the measured worth of every change the tuning validation runs nominated on S2-05 and S2-08: 16 changes, 2,800 fresh paired games each, Medium, SIM_VERSION 9 (`reports/tuning-study-2026-11-13/p5-truth.ts`). The script kept each plain 95% interval, so `se` is read back from it; there is no per-opponent split, so the rows name their `opponents`.
- `remeasure-2026-11-15-p6.json` is plan P6's question, whether changes measured with Medium hold with Hard (`reports/tuning-study-2026-11-13/p6-hard.ts`, its plan fixed before any Hard game; the comparison is `p6-transfer.txt`): 13 changes with Hard (560 paired games each; the two that read highest with Medium on 2,800), and the seven recorded E2 changes again with Medium under SIM_VERSION 9 (2,800 each). Rows carry per-opponent and per-seat figures and their `seed`.

### Making one: `npm run remeasure`

`scripts/remeasure.ts` (logic in `scripts/remeasure-run.ts`) measures one change to a library deck on fresh paired games and appends the row:

```
npm run remeasure -- s2-05-counter-rrg --cut gunpoint_diplomacy --add yorinobu_arasaka_steel_dragon
npm run remeasure -- s2-08-explorer-ggy --change "-1 T-Bug: Amateur Philosopher → +1 Rockn' Rockerboy" --bot hard
npm run remeasure -- s2-06-counter-rgg --before data/decks/custom/history/s2-06-counter-rgg-2026-11-12.txt
```

- **The change**, one way: `--cut`/`--add` (cards by id or exact name, repeatable; Legends `--cut-legend`/`--add-legend`; a cut is replaced in place by the add at the same position, as the forge swaps a card), `--change` (a change of the deck's current list in the change ledger, by label or change key; `--ledger-dir`, default `data/ledger/`), or `--before FILE` (the list in that file against the library list: the change that made the list). The changed list must be legal (`validateDeck`). An unknown card, a cut the list does not hold, a label that matches no change or more than one, games that are not a multiple of 14, an unknown flag: one sentence, exit 2.
- **The games**: `--bot` (default `hard`, played under the ledger's canonical name; `hard-v1` refused), `--games` (default 1,120, a multiple of 14), `--seed` (default 5,000,000), `--field meta`, `--threads`, `--cache`. The layout is the forge's: game k plays meta deck `k mod 7` with seed `seed + k`, the list first when `floor(k / 7)` is even, and the list before and after the change play the same k. Jobs are plain `{ a, b, seed, first, bot }`, so games `reports/tuning-study-2026-11-13/p6-hard.ts` played are found in the game cache.
- **It prints** the paired difference with its plain 95% range, the per-game spread, the share of games that came out the same, both win rates, the figures per opponent and per seat, the interval stratified by opponent × seat (`stratifiedInterval`: the same mean, a standard error from the cells, for reading beside the plain one; no rule uses it), the χ² test across opponents, and what the number is: a paired comparison with that bot under the current simulator version.
- **It writes** one row to `--out FILE` (default `data/evidence/remeasure-<today>.json`, created with its header, `--note` for a new file's note): every field of the format, `byOpp` with `opp` (the name) and `oppListId`, `bySeat`, `sd`, `opponents`, `seed`, today's date and `script: "scripts/remeasure.ts"`; `--id` names it (default from the deck, the change and the bot), `--record` says what it re-measures. The row is appended in the text, so every earlier byte of the file is kept. A row whose id is already used in FILE's directory, or the same measurement (the same lists, bot, simulator version, games and seed), is refused unless `--force`, which adds it under a new id and replaces nothing. `--dry-run` plays and prints only. Then `npm run evidence`.

## The strength rule

The sentence a page shows (`sentenceOf`) follows the word:
- **strong or moderate:** the number and interval. An effect says "Adds +2.8 pts" or "Costs 2.8 pts" only when its own corrected interval also excludes no difference (`corrected`). A moderate effect that only the plain interval supports says "Reads +1.5 pts …; only the uncorrected interval excludes no difference".
- **weak:** "Reads +1.5 pts …; the interval still includes no difference".
- **no difference:** "No difference of a point or more: …".
- **not enough:** "Not enough games: reads +1.1 pts so far".

A sequentially corrected interval is named as one ("corrected 95% range"). A ratings-based matchup rests on the ratings, so its sentence tells its direct games apart: "Expected to win 82.5% (95% range 64.7% to 92.4%), from the ratings; 4–1 in 5 direct games", or "these decks have not met".

`strengthOf` reads only stored fields; `check:data` recomputes every stored word. effect = estimate − baseline; one point = 0.01; the interval is the plain 95% one (`p95` when stored).

| Step | Condition | Word |
|---|---|---|
| 1 | `n` below the minimum: 200 paired games; 20 rated games (both decks for a matchup); 20 games on each side of a split or an association | not-enough |
| 2 | the interval excludes the baseline, and all of: the family test passes; \|effect\| ≥ 1 point; `n` ≥ 1,000 paired / 200 rated / 200 split or association; current simulator version; not an association (unless an adjusted, shrunk estimate also clears the bar) | strong |
| 2 | the interval excludes the baseline, and one of those is missing | moderate |
| 3 | the interval includes the baseline, \|effect\| ≥ 1 point | weak |
| 3 | the interval includes the baseline, \|effect\| < 1 point, half-width ≤ 2 points | no-difference |
| 3 | the interval includes the baseline, \|effect\| < 1 point, half-width > 2 points | not-enough |

`no-difference` is a fifth word beside the study's four: it was measured, and there is no difference of a point or more.

An association clears the bar for strong only with `--adjusted`: its adjusted estimate's shrunk value must be a point or more, of the same sign, with a 95% posterior interval (normal prior N(0, τ²), τ the deck's own prior spread) that excludes 0.

## Families

- A deck's matchups are one family, its direct matchups one, its cards one, its packages one, its endings one.
- The 47 deck strengths are one family, the 47 seat findings one, and the 47 length findings one: the reader's question there is across decks ("which decks depend on the seat").
- Within a family, Benjamini–Hochberg at q = 0.10 decides `corrected`. Its p-values come from the plain 95% interval: the standard error is read from the half that faces the baseline, so "p < 0.05" and "the interval excludes the baseline" agree. This is exact for a normal interval and an approximation for Wilson, Newcombe and logit intervals.
- The family size is stored, so a page can say "ranked from 34 cards; about 2 of the ones whose interval excludes no difference are expected by chance" (`familyWords`).
- A change keeps the correction its tool applied (Bonferroni and the staged or always-valid boundary). No BH on top.
- The overview's lists count their whole candidate pool as the family (`top[].family.size`).

## Ids and the cite line

- `id` = a hash (`hash64`, `src/lib/stateHash.ts`) of kind, subject (list, card, package, opponent list, change key, ending), method, bot, simulator version and field. Never of the result: the same measurement with more games keeps its id.
- `question` = the same hash without bot, simulator version and method, so a page can link "same question, older measurement". A change measured by the forge (v5), a re-measurement (v8) and the ledger is one question.
- `short` = the id's first 8 hex digits. The builder stops on two ids with one short id; `check:data` checks both are unique.
- Cite line (`citeLine`, `citeOf`): `[F:<short id>] <claim> (<estimate> [<lo>, <hi>], <games> games, <bot> v<sim>)`. A ratings-based matchup rests on the ratings, so its line says "from the ratings, 2 direct games" in place of the games.
- The short-id lookup `ids.json` (`kind: 'nct-evidence-ids'`, schema 1) maps each deck's list id to the short ids of its findings, concatenated, 8 hex digits each, in the deck file's order (about 23 kB).
  - A page fetches it only when someone pastes a cite id such as `F:9f3a2c1d`. `shortIdDeck` finds the deck, and the deck file then has the finding.
  - `--check` and `check:data` cover it: every short id in a deck file is in the lookup, in order, and the lookup names no other deck.

## Stale and other flags

A finding measured under a simulator version other than the current `SIM_VERSION` is `stale`: flagged, never strong, and left out of the overview's lists. Today that is the Season 2 forge reports (v5) and the E2 re-measurements (v8): 15 findings. A change measured with Medium carries `medium-only` or one of the `hard-…` flags (see "Changes"), and is not stale for that. Other flags:
- `few-direct-games`: a matchup with 1 to 5 direct games.
- `prediction-only`: a matchup with none.
- `spread-default`: the matchup interval's pair spread is the default, not measured.
- `depends-on-opponent`: χ² of the per-opponent means around the pooled mean, Wilson–Hilferty p < 0.05, groups of 20+ games.
- `first-look`, `stopped-futility`, `other-list`, `model-uncertainty-missing`.

## The index

`index.json` holds the current simulator version; each deck (file, name, list id, the path of its file, its deck-strength finding as `strength` so the overview can state it without the deck files, counts by strength, stale count, the number of its runs and the path of its runs file); the overview's lists (`effects`: strong or moderate changes, each question named once, by its Hard measurement when that is strong or moderate (the recorded events are played by Hard) and else by its best-supported measurement, with `others` counting its other current measurements; `results` and `patterns`: results and associations that pass BH over their whole pool, at most 5 of a kind and 3 of one deck, a matchup counted once from the favoured side and an ending once from the side above the field's share; non-stale only; at most 15 each); tool health (`health`, below); the rules with their measured figures; the gaps; the inputs; and an aggregate manifest derived from the input events.

**Tool health.** One record per tool, simulator version and pair of bots (`simVersion`, `bot` the screening bot, `confirmBot` when another bot played the held-out games): figures of different simulator versions, or of runs screened and confirmed by one bot and runs confirmed by another, are never averaged together. Each nominee is counted once: a ledger run joined to a recorded report (above) is the forge's, and its batches are left out of the ledger's records. Per record: nominees adopted, rejected and could not tell; the mean screening figure minus the held-out figure (for a cross-bot record that gap is screening's optimism and the difference between the bots together, and the page says so); the mean held-out figure at adoption minus a later re-measurement of the same change with the same bot under the current simulator version (the one with the most games); from the ledger, the share of repeated runs on a list (same simulator version, field and screening bot) that nominated a change an earlier run had tested. Records are ordered tool by tool (forge, forge under any-gain, ledger runs), the newest version first. Today:

| Record | Nominees | Screening minus held-out | Adoption minus later |
|---|---|---|---|
| forge, v9, Medium screening, Hard held-out (Season 3) | 5: 2 adopted, 3 could not tell | +4.0 points (5) | none re-measured |
| forge, v5, Medium (Season 2) | 7: 3 adopted, 4 could not tell | +3.5 points (7) | +5.0 points (3, against Medium v9 re-measurements) |
| forge under any-gain, v5, Medium (Season 1) | 5: 3 adopted, 2 rejected | +3.9 points (5) | — |
| ledger runs, v9, Medium (the validation runs on S2-05 and S2-08) | 11 | +3.2 points (11) | — ; 3 of 10 later runs nominated a change tested before |

Before 2026-11-16 there was one forge record (12 nominees, Season 2 and Season 3 pooled across versions and bots) and the Season 3 nominees were counted again in the ledger's record (16); its adoption gap took the first re-measurement found of any bot or version (+5.5 points). Files built before then have no `simVersion` or `bot` on a record, and the page reads them as before.

## Rebuilding and checks

- `npm run evidence` rebuilds `public/data/evidence/`. An unchanged rebuild is byte-identical (no build time is written). A deck file no longer built (a list changed) is removed.
- `npm run refresh` runs it last. `scripts/tournament.ts` runs it after each event, beside the head-to-heads (`--out DIR` writes `DIR/evidence`).
- `npm run evidence -- --check` compares a rebuild with the stored files and exits 1 on a difference. Structure must match exactly; numbers within 2e-6, so a one-digit flip in the sixth decimal of a large number such as a χ² cannot fail it.
- `npm run check:data` (read-only) fails when the stored files differ from a rebuild (it names `npm run evidence`), when a source file or field path does not exist, when an id or short id repeats, when the short-id lookup disagrees with the deck files, when an effect is not paired or has no ledger, forge-report or re-measurement source, when a stored strength is not the rule's, or when a re-measurement file does not read.
- `--adjusted FILE` adds the adjusted card estimate (`impact-adjusted-latest.json` from `npm run sim -- analyze --impact-adjusted --out DIR`). The index then names the file among its inputs, and `check:data` rebuilds with it, so the file must be in the checkout.
- Sizes today (77 files, 2.7 MB in all):
  - deck files: 53, from 1 to 85 kB each (median 49 kB), 2.6 MB in all. The largest are S2-05 and S2-08, which have ledger changes and re-measurements; the smallest are Season 3's, which have no rating, card or package numbers yet;
  - runs files: 22, from 1.7 to 20 kB (the two decks with ledger runs are the large ones);
  - the index: 70 kB; `ids.json`: 24 kB.

## The page

Decks → Evidence (`#/evidence`, page `evidence` in the site config, on by default). The page is `src/ui/pages/Evidence.tsx` (lazy, styles in `src/ui/evidence.css`, tokens in `src/ui/themes.css`), its parts are in `src/ui/components/evidence/`, the files are fetched by `src/ui/evidenceData.ts`, and the view logic (routes, list order, the at-a-glance facts, which list hides a finding, the bars' shared scale, card names in a change) is `src/lib/evidenceView.ts` (pure). Tests: `tests/evidence-ui.test.tsx`.

**Routes.**

| Route | What it shows |
|---|---|
| `#/evidence` | The overview. |
| `#/evidence?f=<id>` | A cite id (`F:9f3a2c1d`, `[F:9f3a2c1d]`, the 8 or 16 hex digits, or a whole cite line) resolved through `ids.json`, then the finding on its deck's page. |
| `#/evidence?d=<deck file>` | That deck's page, found through the index, so a page that knows only the file can link here. |
| `#/evidence/<listId>` | One deck. `?f=<short id>` opens whatever hides the finding (the pairings past the clearest 6, the cards or packages past the first ones, the Details of the ending that holds the other), highlights the row, scrolls to it and moves focus to it. |
| `#/evidence/<listId>/run/<token>` | One recorded run. The token is `runToken(run.id)`: the first 8 hex digits of a hash of the run's id, so it does not move when runs are added. |

A finding's own link is `findingHref(listId, short)`; a run's is `runHref(listId, runId)`. An unknown list, finding, run or cite id, a missing file and a file of a newer schema each give one plain sentence (`EVIDENCE_PROBLEMS`).

**Loading.** Nothing is fetched until a view needs it: the index on the overview and beside a deck's page (opponent names, the tools' record of how high screening reads, the number of runs); a deck's file on its page; its runs file only when "Show the recorded runs" is opened, or on a run's page; `ids.json` only for a cite id. Each file is one cached promise; a file whose `kind` is wrong is missing, and a `schema` above 1 is "made by a newer version of the site". If the index was built for another simulator version than the site plays, a banner says so.

**The overview**, in order: what the page is and a key of the chips; "Open a finding"; the three lists of `index.top` apart (measured effects, results that stand out, patterns worth testing), each with its nature and the family line of its whole pool, opening with its first 5 and "Show all N", the patterns with the reason associations may mislead once above them; each row named by its short title (`shortTitleOf`: the change, "against X", the card or package, "Against the field") and its deck as a link; each tool record (`index.health`) headed by its tool, simulator version and bots (`healthTitleWords`, "The forge, simulator version 9: Medium bot screening, Hard bot confirming") with its sentences and counts, a figure the record lacks left out; every deck on one line on a desktop (three short lines on a phone): its name, Sim tier, strength (`index.decks[].strength`: the chip, the value and its range) and its findings counted by strength word; the gaps, each with what would measure it; how to read the page (the strength rule, the family line, "older version", "Medium only", the matchup spread).

**A deck's page**: a header (the deck's name linking to its deck page, the simulator version, a link back), an at-a-glance strip (`glanceOf`: the deck's strength, its clearest good and bad matchup, the best current change measured to add, the open questions; each a link to its row), then five blocks:
1. How good is it, and how sure are we: the deck-strength finding and the Sim tier badge.
2. Where does it win and lose: the matchup strip (one button per opponent, worst first, named by opponent, win rate and strength word, opening that pairing's row; whole on a desktop, the 6 worst and 6 best with "Show all" under 720 px), the pairings (the clearest 6 first, three from each side of even where it can, then "Show all"), a meta pairing's direct measurement beside its ratings-based one, then the seat, game length with its three groups, and the endings (a deck with exactly two endings shows the one above the field's share, with the other in its Details: they are one fact told twice).
3. Cards and packages: the reasons associations may mislead, the family line, each card (a card mention by id) and package with its two win rates and games on its second line; each list opens with every row whose interval excludes no difference, at least 5 (`assocShown`), then "Show all N". A deck without card numbers shows its gap note.
4. What changed it, and did it hold: once at the top, how much higher screening has read than held-out games, from the tool records of the simulator version and bots of the deck's own changes (`screenCurseRows`, `screenCurseWords`, from `index.health`; each record named by its version and bots, and a cross-bot one said to hold how the bots differ too); then one group per `question`: the change with its cards, one status sentence (`changeStatusWords`: the change that made the list, tried on this list and not applied, or where an unsettled one stands for later tuning runs), the drift line (two or more measurements), then one row per measurement in date order, named by how it was measured (held-out games kept across runs, a forge confirmation, a re-measurement on fresh games), the tools' verdict on its second line (for held-out games that all come from one recorded forge run, also that run's own verdict and look and why the row's range is wider, `confirmationWords`), and its screening figure as one greyed line ("Screening read +5.4 pts over 224 games: not the result.", "Screening with Medium read …" when another bot screened). A change set aside as out of reach says how many more held-out games adopting it would take, or that its held-out reading is not above the bar (`shortlistWords` with the finding's `toSettle`). A change with `depends-on-opponent` shows its per-opponent figures in the row; others keep them in Details. When a question's measurements were not all played by one bot, the drift line names each one's bot ("+2.9 on fresh games with Medium (2,800 games, version 9); +1.4 on fresh games with Hard (560 games, version 9)"), and one more sentence (`botsWords`) says what the Hard measurement shows about the Medium one (each bot's measurement with the most games under its newest simulator version), from their strength words and plain 95% ranges only: a direction only where a range excludes no difference ("Hard agrees with Medium on the direction", "Hard and Medium disagree on the direction"), a size only where the two ranges do not overlap ("Hard reads it lower than Medium"), "Hard finds no difference of a point or more … so it does not confirm Medium's …", "Hard's range still includes no difference … so it neither confirms nor contradicts Medium's …", "not enough games yet", and a note when the two were measured under different simulator versions.
5. Open questions: what each undecided change's games read so far and about how many more held-out games would settle it, or that it has only been screened.

Then the runs (fetched when opened) and what is not measured for the list.

**A run** shows its tool, date, bot and version (greyed when stale), its rule, games and what it could detect when recorded (one sentence when it recorded neither), and its trials as a table (stacked rows on a phone): the change, card or package, the screening figure (greyed, headed "not the result"), the held-out figure with its looks, the outcome, and, muted, all its games in every run, screening included (`TrialRecord.pooled`; a dash where there is none).

**A row.** Every number is a finding row (`FindingRow`), two lines on a desktop and three or four on a phone, so the number is said once:
- line 1: the strength chip (with a three-step meter that repeats the word), the nature chip where natures share a list, a short title, the number (`valueOf`: bold only when strong or moderate and current; muted when weak; "reads … so far", muted, for "not enough games"), the range bar (the interval as a band, the estimate as a mark, "no difference" as a tick, 120 px, one shared scale per list, labelled with the numbers), and Cite;
- line 2, small and muted: the rest of the sentence (`restOf`, built from the same pieces as `sentenceOf`: the range, the games, and what the strength word needs said, such as "the interval still includes no difference" or "from the ratings; 4–1 in 5 direct games"), any words the row adds (an association's two win rates, a change's verdict), the bot and version once, the flags as short words, then a "Details" button;
- Details: the sentence (`sentenceOf`), the stale line, the claim, method, family line, flags in words, sources, and the link to the row.
A stale row is greyed. Cite copies `citeLine(f, f.claim)` (= `citeOf(f)`), carried in the button's `data-cite`; without the clipboard API it uses the copy command, and failing that shows the line selected to copy; a polite live region says what happened.

**Words.** Every sentence the page shows is in `src/lib/findingWords.ts` (the page's section): `PAGE_INTRO`, `NATURE_HELP`, `METHOD_WORDS`, `measuredByWords`, `TITLE_WORDS`, `valueOf`, `restOf`, `rangeWords`, `botVersionWords`, `FLAG_SHORT`, `staleWords`, `staleBuildWords`, `VERDICT_WORDS`, `shortlistWords`, `RELATION_WORDS`, `NOT_APPLIED`, `changeStatusWords`, `driftWords`, `botsWords`, `screenWords`, `screenCurseWords`, `confirmationWords`, `openWords`, `healthTitleWords`, `healthWords`, `TOOL_WORDS`, `runDetectWords`, the trial words, `BLOCK_WORDS`, `GLANCE_WORDS`, `DECK_PAGE_WORDS`, `OVERVIEW_WORDS`, `RUN_WORDS`, `DECK_PANEL_WORDS`, `EVIDENCE_PROBLEMS` and the rest. `tests/evidence-ui.test.tsx` checks that no association row (on fixtures and on the real files) uses a causal word.

**The deck profile** has an "Evidence" link among its hero links and a panel with the deck's findings counted by strength word (from the index, fetched when the profile opens), for library decks the index has, both only while the page is on.

## Approximations

- The deck-strength 95% interval (`p95`) widens the stored 90% range on the logit scale by 1.96 / 1.645. The stored range is drawn on the rating scale through the expected win rate, so this is an approximation.
- BH p-values come from the plain interval (above).
- A forge finding's `p95` is rebuilt from its corrected interval, which the report clips to [−1, 1].
- The seat interval is a normal two-sample interval on per-game residuals.

## Not measured yet

Listed in `gaps` (per deck) and in the index, worded by `GAP_WORDS`:

- Card numbers exist for the 7 meta decks only (`no-card-data`); nothing adjusted is stored (`no-adjusted`), so no card association can be strong.
- No card or package ablation is stored (`no-ablations`): card and package numbers are associations only.
- No per-deck Medium-against-Hard measurement (`no-bot-transfer`) and no stored rank-stability figure (`no-rank-stability`): neither is invented here.
- Thin packages and cards (under 20 games a side) get no number (`thin-packages`, `thin-cards`).
- Changes measured with Medium only (`no-hard-changes`): today only S2-01 and S2-07, whose one change is a Season 2 forge confirmation. Hard measurements exist for 13 changes on 9 decks (`remeasure-2026-11-15-p6.json`, 560 paired games each) and for Season 3's five confirmations (Medium screening, Hard held-out games). Season 1 confirmations have no paired interval (`season1-no-interval`). Both notes name the command that measures it (`npm run remeasure`, above).
- The ledger holds games of S2-05 and S2-08 (the validation runs) and of Season 3's forge; 27 decks have no measured change and no run (`no-changes`). Open questions with held-out games: S2-05 only (2); S2-05, S2-08, S3-02, S3-05, S3-07 and S3-08 have changes that were only screened.
