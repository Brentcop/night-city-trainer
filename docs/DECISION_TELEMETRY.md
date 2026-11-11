# Decision telemetry

Opt-in recording of every decision a bot (or any agent) is asked to make, and a report that breaks card use down by how, when and in what position it was used. This is ROADMAP §5 Method step 1 and a first cut of step 4 (package P3 in §6).

**What it is not.** Every rate in the report is descriptive association: the win rate in games where something happened. It is not the value of a card or of a choice. A card that is mostly played while already ahead will show a high win rate for that reason alone. Estimating what a choice was worth needs paired counterfactual rollouts from the same state (ROADMAP §5 step 3) and one shared value contract (step 5); neither exists yet. The report and its field names never say "value" or "impact", and nothing in the bots, the tuner or the breeder reads it. It is kept apart from the IWD numbers in `src/data/analysis.json` / `impact.json`, which are unchanged.

## How to run it

```
npm run sim -- analyze --decisions [--decision-samples N] [--out DIR] [--force]   (plus the usual --field, --games, --bot, --deck, --seed, --threads)
```

- `--decisions` records decisions in every game (off by default). Each worker aggregates its game and sends back only counts, folded into a running total as games finish.
- Output, next to the analysis output: `reports/decisions-latest.json` and `reports/decisions-latest.md`; for a whole-field run (no `--deck`) also `public/data/decisions.json`, the compact copy the Card stats page reads. The site copy is recorded data, so an existing one is only replaced with `--force`, and the check runs before any game is played.
- `--decision-samples N` also writes the raw records of the first N games to `reports/decisions-samples-latest.json`, for inspection. It needs `--decisions` (exit 2 otherwise).
- `--out DIR` writes every analyze output (the analysis reports, `review.json`, `analysis.json`, `impact.json` and the decision files) into DIR instead of `reports/` and `src/data/`, and writes no site copy. Existing files in DIR are only replaced with `--force`. Use it for trial runs that must not touch recorded data.
- The run manifest (`src/lib/runManifest.ts`) in the report carries `decisionTelemetry: <schema>`; the report also has `telemetrySchema` and `measurements` (records per game, bytes per game raw and aggregated, the merged size, seconds).

In code: `g.telemetry = new DecisionRecorder()` on a game before `run()`, then `recorder.finish(g)` for the records; `aggregateGame` / `mergeAggregates` / `decisionReport` / `decisionMarkdown` in `src/analysis/decisions.ts` turn them into the report.

Measured on 126 lookahead-bot games of the 7 meta decks (2026-11-11): about 107 records per game, about 70 KB of raw records per game against 12.5 KB aggregated, 112 KB for the merged aggregate of the whole run; the run took about 3% longer with telemetry on, and every game ended exactly as with it off.

## Where it hooks in, and why

The recorder is set on one `Game` object (`g.telemetry`), not in its state. The engine calls it from `ask()` (before the agent answers, to take the features, and after, to note the choice), from `pay()` (the sources actually spent) and from the attack (declared; ended). Each call sits behind one `if`, so with telemetry off a game does nothing extra.

This was chosen over a recording agent wrapper (like `RecordingAgent` in `src/lib/practiceSession.ts`) because the things the record needs are inside the engine: bots never answer a payment question (the engine picks their sources), attack outcomes and the revealed identity of a Called Legend are engine events, and a wrapper would have to infer them by diffing state. It also keeps the lookahead safe by construction: `Game.clone()` and effect probes build new `Game` objects from the state alone, so they never carry a recorder, and a bot that cloned with the real game's agents could not leak records into it either.

The recorder only reads: it draws no random numbers, asks no agent and changes no state. `tests/decision-telemetry.test.ts` plays the same seeds for the easy, medium and hard bots with telemetry on and off and checks the winner, turns, log hash, RNG state and stats are identical, that one record is written per decision the real game asked (none from clones), and `tests/replay.test.ts` goldens are unchanged.

## Record schema (version 1)

`DECISION_TELEMETRY_SCHEMA = 1` in `src/engine/telemetry.ts`. Adding an optional field keeps the version; changing or removing one bumps it.

| Field | Meaning |
|---|---|
| `i` | index of the decision in the game, from 0 (same code + seed → same index) |
| `t` | global turn (0 during the mulligan) |
| `p` | acting player |
| `kind`, `tag` | the engine's decision kind and tag (`action`, `reaction`, `yesno`/`mulligan`, `unit`/`equip`, `gig`/`rollIn`, `pay`, `order`, ...) |
| `w` | window: `main` (main-phase action), `react` (defender's reaction window), `mulligan`, `pay` (which source pays one €$), `order` (which own pending effect resolves next), `effect` (a choice inside an effect or cost: yes/no, target, mode, Gig, Gig value) |
| `src` | the card asking, when the engine names one and the acting player can see it |
| `o` | the distinct option codes, first-listed order, at most 40 (`more` counts the rest) |
| `n` | how many options were offered (with repeats: three copies of a card are three options) |
| `c`, `ch` | chosen indices into the full option list (0 = first-listed, the engine's default), and their codes |
| `f` | public features: `me` and `op` sides (Gigs, Street Cred, Units, total power, ready Units, ready / total Eddies, payable €$, hand, deck, face-up Legends), `lead` (my Gigs − theirs), `active` (acting player is the turn player) |
| `atk` | the attack in progress, or declared by this main-phase choice: `{ n, attacker, target }` (`target` is `gigs` or the Unit's id) |
| `pay` | €$ this decision paid and what paid it: `{ amount, eddies, faceDown, legends: [ids] }` (a Legend paying toward its own Go Solo or ordinary play is in `legends`) |
| `res` | filled in afterwards: `revealed` (the Legend a chosen Call flipped) and `attack` (`{ end: fizzled \| fight \| steal, blocked, stolen, attackerGone, targetGone }`) |

Option codes: `pass`, `endReact`, `sell:ID`, `play:ID`, `call:ID`, `solo:ID` (Go Solo), `legend:ID` (ordinary Legend play, rule 4.5), `ability:ID#k`, `attack:ID>gigs`, `attack:ID>TARGET`, `block:ID`; for other kinds `yes`, `no`, `none`, `mode:k`, `card:ID`, `unit:ID`, `gig:WHERE:dS=V` (WHERE is own, rival, fixer or rivalFixer), `effect:ID` (pending order), `pay:eddie` / `pay:fd` / `pay:ID`, `n:K`, `key:K`, `#k`.

Payments are credited to the payer's latest decision of the same turn that is not itself a `pay` pick: the main-phase action or reaction that caused it, or the yes/no that agreed to a "pay to ..." effect. An engine-forced payment with no decision behind it would land on that player's previous decision of the turn; none is known today.

The engine has no separate "response to a Quick" window: Quick Programs are played as reactions in the attack's reaction window, so they appear as `react` decisions. `pay` and `order` decisions are only asked of agents that opt in (`choosesPayment`, `choosesOrder`: the human seat); bots never get them, so bot runs record their payments in `pay` on the deciding record instead.

## Hidden information

A record is written from the acting player's point of view, following what `hideInfo` (`src/ai/heuristic.ts`) re-deals for the bots. A card id appears only when the acting player can see the card: public zones (field, trash, removed, a Program resolving), their own hand, deck (only offered when an effect shows it) and Eddies, and Legends that are face-up or that they have looked at (`known`). The rival's hand, the rival's deck and face-down Legends the player hasn't seen are written `?` (a Call is `call:?`; a face-down Legend paying is counted in `faceDown`). The features are public counts only. A Called Legend is face-up straight after the Call, so its id is added afterwards in `res.revealed`, never among the options. `tests/decision-telemetry.test.ts` builds a position with a known rival hand and face-down Legends on both sides and checks none of their ids reach a record.

## The report

`src/analysis/decisions.ts`, keyed by deck list fingerprint (`PlayerState.listId`) and card id, with every list pooled per card as well (`pooled`: more games per slice, different decks mixed, counted per player-game).

- **Per card, by use:** played (from hand, main phase), sold, called, Go Solo, Legend play (4.5), ability, attacked, reaction (Call, Block, Quick Program or quick ability in the reaction window). Each has its use count, the games with at least one such use and the deck's win rate in them, and the same split by stage and by Gig standing at the moment of the decision. `selfPaid` counts Go Solo / Legend plays the Legend helped pay for; attack uses also count how the attacks ended and Gigs stolen.
- **Availability vs use:** decisions in which the use was legal (`offered`) and taken (`chosen`), and the turns (attacks, for reactions) in which it was legal (`windows`) and taken at least once (`windowsUsed`); `notChosenRate` = 1 − windowsUsed / windows. A face-down Legend's Call is counted for the card only once it is revealed.
- **Per decision type** (the window, or kind/tag inside effects): decisions, how often the first-listed option was taken (pass, no more reactions, Yes, the automatic payment source, queue order), and the option-count distribution (1, 2, 3–5, 6–10, 11–20, 21+).
- **Reaction window:** attacks the deck was asked to react to, reacted vs let resolve (with win rates), how those attacks ended (fizzled, stole, stole nothing, attacker gone, target gone, both, neither), and the reaction choices by kind.

**Stages** are by round, round = ceil(turn / 2): early rounds 1–2 (turns 1–4), middle rounds 3–4 (turns 5–8), late round 5 on (turn 9+); the mulligan counts as early. Bot games last about 13 turns, so the three stages cover similar stretches of a typical game. `STAGE_ROUNDS` in `src/analysis/decisions.ts` is the single definition.

**Ahead / even / behind** compares the acting player's Gig count with the rival's when the decision was made (`f.lead`).

**Samples and intervals.** A game counts once per slice however many uses it had, so the sample is games, which are independent; ties count half. Rates come with a 95% Wilson score interval (a single proportion; it stays inside 0–1 and behaves at small n). A slice backed by fewer than `MIN_SLICE_GAMES` = 20 games (the site's `SMALL_SAMPLE`) gets no rate: it is flagged `thin` and shows only its size, in the markdown as `n=12 (thin)` and on the site with the dotted `.num.thin` underline.

**On the site:** Card stats → Decisions (`src/ui/components/DecisionStats.tsx`, loaded only when opened) reads `public/data/decisions.json` if there is one, and otherwise says how to make it. No report is bundled with the site.

## Deliberately left out

- Counterfactual decision value, regret and turn grades (ROADMAP §5 steps 3 and 5, and "How the Coach should judge a turn"): the next work. The records carry what that needs (the legal options, the choice, the position), and the stable decision index lets a rollout tool find the same decision again from the same seed.
- Raw records for every game: only per-game counts leave the workers; raw records are dumped for `--decision-samples N` games.
- Opponent strategy and the deck's declared objective as slices (§5 step 4 lists them): the report is keyed by list, and decks have no declared objective yet.
- Effect lineage (which later effects a play caused) and resolving effects as their own records: only decisions are recorded. Bots never get `pay` or `order` decisions, so those windows only fill from human-seat play, which is not recorded yet.
- Any change to bots, evaluation weights, the IWD numbers or `impact.json`.
