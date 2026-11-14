---
name: kb
description: Look up this project's knowledge with `npm run kb` instead of reading whole files - cards, rulings, the game's rules, decks, deck notes, synergy packages, glossary terms, guides, recorded events, ratings, matchups, how the bot used each card and package, project docs and code file headers. Use it first when a question is about the game, a card, a deck, a ruling, a result, or where something lives in this repository.
---

# Knowledge pack (kb)

`npm run kb` searches typed, linked records built from the project's own tables and docs.
One answer is about 500 tokens; the files it stands in for are often tens of thousands.
Plan, method and status: `docs/RAG_PLAN.md`.

## When to use it

- Before opening a large doc (`CLAUDE.md`, anything in `docs/`) or a data file to answer a question.
- To find where something is implemented: code file headers are records.
- To check a card's text, its rulings, the packages it belongs to, or the decks that play it.
- To read a rule or an official ruling on this machine (local-only records, see the rules below).

- To get a tournament result, standings after a round, a round summary, a deck's rating and finishes, or
  a matchup: the `fact` command computes these from the recorded data.
- To get how the bot used a card (played, sold, attacked with, by stage and Gig standing, the gap when
  drawn) or how a synergy package did (assembled, online, lift, the coach's gate): `fact card` and
  `fact package`. One answer is about 760 tokens; the report files are 85 KB to 807 KB.

Skip it when you already know the file and line.

## Commands

```bash
npm run kb -- search "how are deck changes adopted"
```

```bash
npm run kb -- get "Detonate"
```

```bash
npm run kb -- related "Detonate"
```

```bash
npm run kb -- stats
```

Exact numbers from the recorded events, ratings and head-to-heads come from `fact`:

```bash
npm run kb -- fact champion --event 6
```

```bash
npm run kb -- fact standings --event 6 --round 5
```

```bash
npm run kb -- fact rating "RRG Dexter Midrange"
```

```bash
npm run kb -- fact matchup "RRG Dexter Midrange" vs "BBG Cunningham Econ"
```

Also `fact round --event N --round K` (a round summary), `fact finishes <deck>` and
`fact ratings --top 10` (the ratings table, which says when the ranges overlap). A deck is named by
file, by name or by list fingerprint. Add `--json` for data.

The bot's play statistics, from the decision, synergy and deck-analysis reports:

```bash
npm run kb -- fact card "Jacked-In Voodoo Boy" --deck meta-bbg-cunningham-econ
```

```bash
npm run kb -- fact package rocker
```

Without `--deck` the lists are pooled. Card statistics exist for the meta lists only (the reports cover
that field); package statistics for every library list. These are associations from the bot's own games:
report them as what the bot did, with the games and interval shown, never as what a card is worth.

- `search` returns the best five records. Flags: `--k 8`, `--kind card,ruling`, `--scope public|local|all`,
  `--max-tokens 800`, `--json`.
- `get` prints every record with that id, title or alias, in full. Names work in lower case and without
  a card's subtitle; two cards that share a name both come back.
- `related` prints a record's neighbours grouped by link type (rulings, decks, packages, guides).
- A question that names the kind of record it wants finds linked records: "rulings on Detonate",
  "decks that play Kiroshi Optics", "game plan for nc-01".
- A question that names two decks ("static shock against addin' trash") finds their matchup record
  first. Decks are found without their colour or set codes ("wakako midrange", "smasher aggro").

Running the script directly is about twice as fast (0.8 s against 1.9 s through npm) and is the form to
use in Windows PowerShell, where `npm run kb -- …` drops flags such as `--event`, `--k` and `--json`:

```bash
node --import tsx scripts/kb.ts fact champion --event 6
```

## Reading a result

Each hit shows its id, title, `[kind · origin · scope · status]`, its version stamps and its source as
`path#location`. Open the source at that location when the snippet is not enough.

- `draft` means an unreviewed note (every deck note and package is a draft today). Say so when you rely on one.
- A stamp such as `cardDataVersion` or `faqVersion` says which version the record was built from.
- "no match" means the pack has nothing for the question. Fall back to Grep and Read.

## Rules

1. A record labelled LOCAL-ONLY comes from `data/raw/` (official rules, official FAQ wording, tournament
   rules, errata). Never paste its text or its title into a tracked file, a test fixture, a commit message
   or a report. Paraphrase in your own words and cite the id, for example `rule:10.28` or `faq:2ae2b855`.
2. The pack is read-only knowledge for people and agents. Nothing under `src/engine`, `src/ai`, `src/sim`
   or the entry chunk may import `src/lib/kb` (`tests/kb-guards.test.ts`).
3. A change to ranking is kept only if `npm run kb:eval` shows it helps on the held-out questions
   (`docs/RAG_PLAN.md`, rule M9). Rerun `npm run kb:eval -- --out` in a commit that edits docs heavily.
4. The pack rebuilds itself when a source file changes. There is nothing to maintain by hand.

## What it cannot answer yet

- `search` reaches the card and package statistics records when a question names the card or package
  and asks how often, how it went (win rate, chance, help, worth, better), when (early, late), whether it
  came online or together, or whether the coach may name it; "stats" works too. A question that names
  only a deck, or asks what a card does, does not reach them. With a list named the way players name it
  ("wakako midrange") that list's record comes first; with none, the pooled record. About six in ten such
  questions find their record, so `fact card` / `fact package` remain the exact route.
- Take a number from `fact` or from a `measured` record, never from a doc passage: docs go stale. Every
  measured record names its bot and sim version; one marked stale was measured under an older version.
- "Top 8" has two meanings here. `fact` reports real top-cut appearances and the ratings file's count of
  Swiss finishes in the first eight places as two separate numbers; say which one you mean.
- Paraphrased questions are the weak spot (under half find their record in the first five). Add the
  thing's name when you know it. Words from other card games are understood: "tap", "graveyard",
  "creature", "opponent" and "kill" find records that say spend, trash, Unit, rival and defeat
  (`src/lib/kb/synonyms.ts`).
- The search is keywords, names and links. An embeddings ranker exists only as an opt-in experiment
  (`--rankers exact,linked,keyword,dense`, plan step 4.1): it was measured and did not earn a place in
  the default, and it needs tools in `.cache/kb-dense/` that `npm run kb -- stats` reports on.
