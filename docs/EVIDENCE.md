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
- Tests: `tests/findings.test.ts`, `tests/build-evidence.test.ts`.

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

1. **The change ledger** (`--ledger-dir`, default `data/ledger/`; what it holds today is below). For each change of the deck's list and each entry context (simulator version, bot, field), the pooled held-out games are judged exactly as the tools judge them: `judgePooled` under `ADOPTION_DEFAULTS`, one nominee, the card bar (1 point) for a one-card swap and the package bar otherwise. The finding's interval is that always-valid interval (`sequential: always-valid`); `p95` is the plain paired 95% interval for the strength rule. `detail` holds the verdict, the screening games' figure (`detail.screen`, always flagged `screening`: the screening winner reads 2 to 4 points too high), the runs that tested it, its status in the shortlist (`changeStatus`: live, or dropped and why, at the forge's 2-point nomination bar and `SHORTLIST_DEFAULTS`), the held-out games that would settle it (`gamesToSettle`), and per opponent and per seat figures.
2. **Recorded forge reports** (`reports/forge/*.json`). Season 2 reports hold nominees with a screening and a held-out figure: each held-out figure is a finding with the report's corrected interval (`sequential`: the report's correction), `p95` rebuilt from it as mean ± 1.96 standard errors (the standard error read from the corrected half-width), the outcome word, and the flags `first-look` (it stopped at its first look: likely optimistic) and `stopped-futility`. Season 1 reports used the any-gain rule and recorded win rates only, with no paired interval: they are runs, not findings.
3. **Re-measurements** (`data/evidence/*.json`, below): fixed-size paired measurements, plain 95% interval.

Every change carries its bot. A change measured only with Medium is flagged `medium-only` until the same question has a Hard measurement. `relation` says whether the change starts from the deck's current list, leads to it (the change that made this list, checked against the older lists in `data/decks/custom/history/`), or concerns another list.

**What the ledger holds today.** `data/ledger/` was started on 2026-11-15 with the games of the tuning validation runs (docs/SYNERGIES.md "Until settled, and what a run can detect"): eight forge runs in a row on S2-05 Counter (RRG) and on S2-08 Explorer (GGY), Medium, SIM_VERSION 9, with the shortlist and "until settled" on. 138 batches, 21,952 games, 354 kB. They are real forge games from the library's own lists, so they are the evidence the ledger is for: a later `forge --ledger` run on either deck pools with them. The changes they settled were never applied to the lists (every run started from the same list), so the page shows them as measured, not applied. To start the ledger empty instead, delete the two files and run `npm run evidence`.

**Open questions** (`open`): ledger changes still undecided and not dropped, with their held-out games, their pooled gain over screening and held-out games (`pooledGames`), and about how many more held-out games would settle them at their present mean and spread (null when the held-out mean is not above the bar, or there are none).

**Runs** (`<listId>.runs.json`, written only for a deck that has runs; the index gives its path and the number of runs): each recorded forge report for the deck (rule in words by `describeRule`, games, what it could detect at its stage sizes by `detect` at the study's per-game spreads, and its trials: label, card or package, screening figure, held-out figure, outcome, and the pooled ledger figure in the same context when there is one), and each run the ledger holds games of (its changes, screened or nominated).

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
      "date": "2026-11-13",
      "script": "reports/tuning-study-2026-11-13/e2-remeasure.ts",
      "record": "Medium v5 could not tell +1.5 [-0.3,+3.2] 896g, screen +5.4"
    }
  ]
}
```

- `mean` is candidate minus base per paired game; `se` its standard error.
- Optional: `legendCuts` and `legendAdds`; `sd` and `record`; `byOpp` rows, which may name `oppListId` instead of `opp`.
- Optional `opponents`: the field's list fingerprints. When a row has no per-opponent rows, the field fingerprint comes from them (`fieldFingerprint`, as the ledger computes it), so a re-measurement shares its `question` with the ledger entries of the same change.
- Ids are unique within a file. Never edit a row: append one, or add a file.
- The bot is named as the script named it; the builder maps it to the canonical name (`ledgerBot`: `lookahead` is Medium).
- The first file, `remeasure-2026-11-13-e2.json`, is experiment E2 of the tuning study: eight changes, 2,800 paired games each, Medium, SIM_VERSION 8.
- `remeasure-2026-11-15-p5.json` is the measured worth of every change the tuning validation runs nominated on S2-05 and S2-08: 16 changes, 2,800 fresh paired games each, Medium, SIM_VERSION 9 (`reports/tuning-study-2026-11-13/p5-truth.ts`). The script kept each plain 95% interval, so `se` is read back from it; there is no per-opponent split, so the rows name their `opponents`.

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

A finding measured under a simulator version other than the current `SIM_VERSION` is `stale`: flagged, never strong, and left out of the overview's lists. Today that is the forge reports (v5) and the E2 re-measurements (v8): 15 findings. A Medium-only change is flagged `medium-only`, not stale. Other flags:
- `few-direct-games`: a matchup with 1 to 5 direct games.
- `prediction-only`: a matchup with none.
- `spread-default`: the matchup interval's pair spread is the default, not measured.
- `depends-on-opponent`: χ² of the per-opponent means around the pooled mean, Wilson–Hilferty p < 0.05, groups of 20+ games.
- `first-look`, `stopped-futility`, `other-list`, `model-uncertainty-missing`.

## The index

`index.json` holds the current simulator version; each deck (file, name, list id, the path of its file, its deck-strength finding as `strength` so the overview can state it without the deck files, counts by strength, stale count, the number of its runs and the path of its runs file); the overview's lists (`effects`: strong or moderate changes, each question named once by its best-supported measurement, with `others` counting its other current measurements; `results` and `patterns`: results and associations that pass BH over their whole pool, at most 5 of a kind and 3 of one deck, a matchup counted once from the favoured side and an ending once from the side above the field's share; non-stale only; at most 15 each); tool health (per tool: nominees adopted, rejected and could not tell; mean screening minus held-out figure; mean held-out figure at adoption minus a later re-measurement; from the ledger, the share of repeated runs that nominated a change an earlier run had tested); the rules with their measured figures; the gaps; the inputs; and an aggregate manifest derived from the input events.

## Rebuilding and checks

- `npm run evidence` rebuilds `public/data/evidence/`. An unchanged rebuild is byte-identical (no build time is written). A deck file no longer built (a list changed) is removed.
- `npm run refresh` runs it last. `scripts/tournament.ts` runs it after each event, beside the head-to-heads (`--out DIR` writes `DIR/evidence`).
- `npm run evidence -- --check` compares a rebuild with the stored files and exits 1 on a difference. Structure must match exactly; numbers within 2e-6, so a one-digit flip in the sixth decimal of a large number such as a χ² cannot fail it.
- `npm run check:data` (read-only) fails when the stored files differ from a rebuild (it names `npm run evidence`), when a source file or field path does not exist, when an id or short id repeats, when the short-id lookup disagrees with the deck files, when an effect is not paired or has no ledger, forge-report or re-measurement source, when a stored strength is not the rule's, or when a re-measurement file does not read.
- `--adjusted FILE` adds the adjusted card estimate (`impact-adjusted-latest.json` from `npm run sim -- analyze --impact-adjusted --out DIR`). The index then names the file among its inputs, and `check:data` rebuilds with it, so the file must be in the checkout.
- Sizes today (65 files, 2.5 MB in all):
  - deck files: 47, from 44 to 78 kB each (median 48 kB), 2.4 MB in all. The largest are S2-05 and S2-08, which have ledger changes and re-measurements;
  - runs files: 16, from 1.6 to 19 kB (the two decks with ledger runs are the large ones);
  - the index: 42 kB; `ids.json`: 23 kB.

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

**The overview**, in order: what the page is and a key of the chips; "Open a finding"; the three lists of `index.top` apart (measured effects, results that stand out, patterns worth testing), each with its nature and the family line of its whole pool, opening with its first 5 and "Show all N", the patterns with the reason associations may mislead once above them; each row named by its short title (`shortTitleOf`: the change, "against X", the card or package, "Against the field") and its deck as a link; each tool's record (`index.health`) as sentences with their counts, a figure the record lacks left out; every deck on one line on a desktop (three short lines on a phone): its name, Sim tier, strength (`index.decks[].strength`: the chip, the value and its range) and its findings counted by strength word; the gaps, each with what would measure it; how to read the page (the strength rule, the family line, "older version", "Medium only", the matchup spread).

**A deck's page**: a header (the deck's name linking to its deck page, the simulator version, a link back), an at-a-glance strip (`glanceOf`: the deck's strength, its clearest good and bad matchup, the best current change measured to add, the open questions; each a link to its row), then five blocks:
1. How good is it, and how sure are we: the deck-strength finding and the Sim tier badge.
2. Where does it win and lose: the matchup strip (one button per opponent, worst first, named by opponent, win rate and strength word, opening that pairing's row; whole on a desktop, the 6 worst and 6 best with "Show all" under 720 px), the pairings (the clearest 6 first, three from each side of even where it can, then "Show all"), a meta pairing's direct measurement beside its ratings-based one, then the seat, game length with its three groups, and the endings (a deck with exactly two endings shows the one above the field's share, with the other in its Details: they are one fact told twice).
3. Cards and packages: the reasons associations may mislead, the family line, each card (a card mention by id) and package with its two win rates and games on its second line; each list opens with every row whose interval excludes no difference, at least 5 (`assocShown`), then "Show all N". A deck without card numbers shows its gap note.
4. What changed it, and did it hold: once at the top, how much higher screening has read than held-out games, per tool (`screenCurseWords`, from `index.health`); then one group per `question`: the change with its cards, one status sentence (`changeStatusWords`: the change that made the list, tried on this list and not applied, or where an unsettled one stands for later tuning runs), the drift line (two or more measurements), then one row per measurement in date order, named by how it was measured (held-out games kept across runs, a forge confirmation, a re-measurement on fresh games), the tools' verdict on its second line, and its screening figure as one greyed line ("Screening read +5.4 pts over 224 games: not the result."). A change with `depends-on-opponent` shows its per-opponent figures in the row; others keep them in Details.
5. Open questions: what each undecided change's games read so far and about how many more held-out games would settle it, or that it has only been screened.

Then the runs (fetched when opened) and what is not measured for the list.

**A run** shows its tool, date, bot and version (greyed when stale), its rule, games and what it could detect when recorded (one sentence when it recorded neither), and its trials as a table (stacked rows on a phone): the change, card or package, the screening figure (greyed, headed "not the result"), the held-out figure with its looks, the outcome, and, muted, all its games in every run, screening included (`TrialRecord.pooled`; a dash where there is none).

**A row.** Every number is a finding row (`FindingRow`), two lines on a desktop and three or four on a phone, so the number is said once:
- line 1: the strength chip (with a three-step meter that repeats the word), the nature chip where natures share a list, a short title, the number (`valueOf`: bold only when strong or moderate and current; muted when weak; "reads … so far", muted, for "not enough games"), the range bar (the interval as a band, the estimate as a mark, "no difference" as a tick, 120 px, one shared scale per list, labelled with the numbers), and Cite;
- line 2, small and muted: the rest of the sentence (`restOf`, built from the same pieces as `sentenceOf`: the range, the games, and what the strength word needs said, such as "the interval still includes no difference" or "from the ratings; 4–1 in 5 direct games"), any words the row adds (an association's two win rates, a change's verdict), the bot and version once, the flags as short words, then a "Details" button;
- Details: the sentence (`sentenceOf`), the stale line, the claim, method, family line, flags in words, sources, and the link to the row.
A stale row is greyed. Cite copies `citeLine(f, f.claim)` (= `citeOf(f)`), carried in the button's `data-cite`; without the clipboard API it uses the copy command, and failing that shows the line selected to copy; a polite live region says what happened.

**Words.** Every sentence the page shows is in `src/lib/findingWords.ts` (the page's section): `PAGE_INTRO`, `NATURE_HELP`, `METHOD_WORDS`, `measuredByWords`, `TITLE_WORDS`, `valueOf`, `restOf`, `rangeWords`, `botVersionWords`, `FLAG_SHORT`, `staleWords`, `staleBuildWords`, `VERDICT_WORDS`, `shortlistWords`, `RELATION_WORDS`, `NOT_APPLIED`, `changeStatusWords`, `driftWords`, `screenWords`, `screenCurseWords`, `openWords`, `healthWords`, `TOOL_WORDS`, `runDetectWords`, the trial words, `BLOCK_WORDS`, `GLANCE_WORDS`, `DECK_PAGE_WORDS`, `OVERVIEW_WORDS`, `RUN_WORDS`, `DECK_PANEL_WORDS`, `EVIDENCE_PROBLEMS` and the rest. `tests/evidence-ui.test.tsx` checks that no association row (on fixtures and on the real files) uses a causal word.

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
- Every change measured so far is Medium only (`no-hard-changes`); Season 1 confirmations have no paired interval (`season1-no-interval`).
- Only S2-05 and S2-08 have current-version effects, open questions and ledger runs: the ledger holds no other deck's games yet (`no-changes` on the other 45).
