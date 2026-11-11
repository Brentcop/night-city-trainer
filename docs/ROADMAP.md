# Roadmap

Planned work that is decided in principle but not scheduled. The item-level backlog from the 2026-11-10 review is in [IMPROVEMENT_BACKLOG.md](IMPROVEMENT_BACKLOG.md); this file holds the larger steps that come after it.

## 1. Fresh baseline: wipe recorded data and restart at Season 1

**Decided 2026-11-10.** Do it later, not as part of the current fix waves.

**Why.** Every recorded event, season, rating, head-to-head and card statistic in the repo was produced by the pre-review engine and bots. The review found the bots recovering their worst card on "from your trash" effects, giving away their best Gig on swaps, answering yes to every optional prompt, using hidden Legend identities, and dropping attack options under a candidate cap; the engine had several rules divergences; Swiss pairing produced avoidable rematches; and card telemetry counted mulliganed-away cards as drawn. Once Wave B of the backlog is merged, none of the old numbers describe what the sim now does, and old events no longer replay identically. Regenerating piecemeal would mix old and new results, so the plan is a clean restart.

**Prerequisites.**
- Wave B merged and checked (engine rules, bots, tournament logic, telemetry).
- Safe CLI tooling from Wave A merged (no silent overwrites, errors never counted as ties, validated flags).
- A golden-replay test in place first, so the new baseline cannot drift without a test failing (backlog AI-5 / OPS-6).
- Decide whether to re-tune bot weights and matchup profiles (`scripts/tune.ts`, `scripts/tune-profiles.ts`) before the restart. The current tuned values were fitted to the old bots.

**Scope: what gets wiped.** Confirm the exact list when this is run. Candidates:
- Recorded events: `public/tournaments/`, and the index in `src/data/tournaments.json`.
- Seasons and leaderboard: `data/seasons/`, `src/data/seasons.json`.
- Ratings and head-to-heads: `src/data/ratings.json`, `public/data/h2h.json`.
- Analysis and reports that feed pages: `src/data/analysis.json`, `src/data/review.json`, `src/data/deckReports.json`, and the generated files under `reports/`.
- Generated strategy content: `src/content/recommendation.ts`, `src/content/tournamentPlan.ts`.
- Decks bred or forged from the old results (`data/decks/custom/s<N>-*`, ladder and forge variants). Decide at the time whether to archive them as history or remove them; collected lists (meta, guides) and hand-designed originals stay.

**Steps.**
1. Tag the last commit that holds the old data, so it stays reachable.
2. Remove the files above in one commit.
3. Re-run the baseline analysis of the meta field, then Season 1 onward, then tournaments, ratings, head-to-heads and the plan.
4. Add recorded games from the new events to the golden-replay test.
5. Update the docs that quote old numbers (`docs/STRATEGY.md`, `docs/ANALYSIS.md`, `docs/REVIEW_FINDINGS.md`, `docs/TOURNAMENT_PLAN.md`).

**Until then.** After Wave B merges, the published events, ratings and card stats are historical: they came from the earlier sim and "Watch" on an old event may play out differently from its recorded result. Events carry a `simVersion` field from Wave B onward so the two eras can be told apart.

## 2. How production is updated (part of the refactoring wave)

**Decided 2026-11-10.** Fold into Wave C of the backlog (package WP-C5).

Today every push to `main` builds and force-pushes `dist/` to the `gh-pages` branch through a third-party action. Wave A adds a pull-request check job and narrows permissions but keeps that publish method. The refactor:
- Switch to GitHub's official Pages flow (`actions/upload-pages-artifact` + `actions/deploy-pages`, with `pages: write` and `id-token: write` on the deploy job only).
- **Owner step:** in the repository's Pages settings, change the source from the `gh-pages` branch to "GitHub Actions". The workflow change and this setting have to land together.
- Add a data-consistency check before deploy (event index matches event files; head-to-heads cover the recorded events), so stale generated data cannot ship.
- Decide whether deploys stay "every push to main" or move to a manual or tagged release once the fresh baseline exists.
- Retire the `gh-pages` branch after the first successful deploy from the new flow.

## 3. Remaining backlog waves

- **Wave C — structure, performance, accessibility.** Status on 2026-11-11:
  - WP-C1 (bundle size and data loading): merged, except loading Home's data at runtime.
  - WP-C2 (Play performance and accessibility): merged, except dialog focus handling (PLAY-9), the CSS merge (PLAY-19) and extracting the coach and setup panels (PLAY-20 parts 4–5).
  - WP-C3 (pages accessibility and CSS): not started.
  - WP-C4 (type hardening and engine structure): only payment choice (ENG-8) and the dev-dependency upgrade are done.
  - WP-C5 (production deploy): not started; the workflow still publishes through the `gh-pages` branch.

## 4. Retire results and bred decks that fail the fairness bar

**Agreed direction, 2026-11-10.** Some collected statistics and bred decks should eventually leave the active dataset because their value was measured across inconsistent simulator eras or with insufficiently comparable runs. Do not delete them before a new baseline exists.

**Sequence.**
1. **Archived locally.** Tag `archive/sim-v2-pre-fairness-baseline-2026-11` points at commit `9172637`, preserving the committed events and simulator-era data. Retain/push this tag before any archival data is removed.
2. **Mostly done (2026-11-11).** Deck-list fingerprints and run manifests identify lists, simulator/bot version, field, seeds, seats, and sample size.
   - **Done:** every result writer attaches a manifest: tournament events, the sim CLI, the tuners, `forge.ts`, `optimize.ts`, `season.ts` (the round robin; its forge and finals steps write their own), and the Matchup Lab and Deck Lab (purpose `browser`; Deck Lab saves keep it with the saved deck). `ratings.ts` and `build-h2h.ts` aggregate recorded events: their manifest (`inputs`) lists each event's id, sim version and run id and flags a mix of sim versions; it is derived from the inputs only, so unchanged data still rebuilds byte-identical (OPS-10). Events now store each deck's sideboard so the stored list reproduces its id. Recorded files written before this keep loading; `ratings.json` and `h2h.json` get their manifests on their next rebuild.
   - **Done:** card impact is keyed by list fingerprint (backlog AI-11). The current `src/data/impact.json` has no fingerprints, so its entries are pinned to today's built-in lists (`src/analysis/legacyImpactLists.ts`) until the next `sim analyze`.
   - **Done:** `npm run check:data` checks the event index against the event files, that `h2h.json` covers the recorded events, and every manifest's schema and deck ids. On 2026-11-11 it passes; all 20 recorded events are legacy (no manifest). It is not wired into the workflow yet; the deploy data check (§2) is the natural place.
   - **Still to do:** the rules, FAQ and errata versions (`errataVersion` now exists) are `null` everywhere. Populate them before treating any run as baseline-comparable. `data/seasons/deck-impact.json` (per-deck impact pooled for the season breeder, `scripts/breed-data.ts`) is still keyed by deck name.
3. **In progress.** The weight and profile tuners (committed 2026-11-11) use matched training seeds and separate held-out validation, report paired confidence intervals, and do not silently apply candidates. Open points: `tune.ts` adopts a training candidate on any positive mean while `tune-profiles.ts` needs 5pp, and held-out seed ranges in `tune-profiles.ts` overlap between `--seed` values. Freeze a bot version only after the held-out results support an agreed practical threshold. The FAQ source is not in `data/raw/` (`netdeck_rulings.txt` is empty; the comprehensive rules, errata and tournament rules are there), so a clean baseline is not yet ready. Then generate a baseline with consistent fields and re-evaluate bred decks against it, recording which ones clear the evidence and strategy criteria.
4. Keep community meta/guide lists and hand-designed Trainer originals in the active library. Keep bred or optimized lists active only when they have a current, comparable evaluation or an explicitly retained strategic purpose; move the rest out of active deck discovery and into the archive.
5. Regenerate ratings, head-to-heads, seasons, deck profiles, recommendation, and tournament plan from the selected active set. Run a reference and consistency scan before removing any active files.

**Retention rule.** Historical records remain available from the archive, but they do not feed current rankings, card impact, breeding parent selection, or recommendations. Pruning applies to the active dataset and deck gallery; the archived snapshot remains the audit trail.

**How this relates to §1.** §1 says what gets wiped and why; this section is the order to do it in. The engine rules gaps in §5 (backlog ENG-14 and ENG-3, done in SIM_VERSION 3; ENG-16 open) change how games play out, so they come before the bot version is frozen and before any baseline run.

## 5. Measure card value in the decision window

**New planning point, 2026-11-10.** A card's contribution depends on when it is played, the available response window, the board and resources at that moment, and what the play enables next. A card can be strategically important while showing weak raw play frequency or weak whole-game association; conversely, a card can correlate with wins because it is drawn more often in already-favored games.

**Current measurement gap.** The current trace records event kind, global turn, player, card id, and a small extra field (`src/engine/types.ts`). Analysis reduces a card to seen/drawn win-rate difference (`IWD`), win rate when played, and average own-turn first played (`src/analysis/analyze.ts`, `src/analysis/summarize.ts`). That IWD is also used as card impact in bot decisions and in deck-lab/breeder paths. It does not capture the board state, legal alternatives, response window, cost paid, or delayed effects when the decision happened. A reactive call is distinguished from a main-phase call, but other reaction choices and the choice to let an attack resolve are not recorded as decisions. This is not sufficient evidence to call a card good or bad, or to decide whether it was played at the right time.

**Respect the card's actual anatomy.** The supplied card reference labels name/subtitle, cost, Sell Tag, tags, set/number, rarity, power, textbox, artist credit, RAM, and type. These fields have different jobs and should not be collapsed into a generic strength score. Cost and Sell Tag create competing resource options; type and RAM govern where the card can be used and whether a list can include it; tags and effect text define synergies, conditions, and timing windows; power matters in combat and Gig stealing. Name plus subtitle identifies a main-deck card, while Legend uniqueness uses the name. Rarity, set/card number, and artist credit are printing metadata, not evidence of in-game strength (though printing identity and errata should be retained for correct card data).

V: Streetkid illustrates why one card needs mode- and state-specific evaluation: its Call mills three and can recover a BRAINDANCE Program, while Go Solo pays its cost to enter as a ready Unit that can attack that turn and is removed if it leaves the field. Whether to call it for its effect, spend it as payment once face-up, or Go Solo depends on current resources, trash contents, hand, board, attack window, Gig state, and likely response. Its name, rare symbol, and set code do not answer that question.

**Rules-conformance gate.** Treat the user's 25 general rulings and 86 card-grouped FAQ entries as an executable reference for the simulator before trusting a new evaluation baseline. Three specific gaps surfaced in the code review (all three closed 2026-11-11, with the open points noted):
- **Done 2026-11-11 (ENG-14, SIM_VERSION 3).** Face-up Legends with a cost now also get a `playLegend` action: pay the ordinary cost and play the Legend to the field without Go Solo (4.5), keeping its orientation and entering with Lag; its play event is `via: 'legend'` (trace kind `legend`), distinct from Go Solo.
- **Done 2026-11-11 (ENG-14).** Go Solo may now be paid with its own Legend (general FAQ #10; auto-payment spends it first). It still enters ready and can attack, reading 11.29.1's "as a ready Unit" over 4.5.1; its spend triggers become pending before its {Play}. Still to do: confirm that orientation against the FAQ text, which is not in `data/raw/`.
- **Done 2026-11-11 (ENG-3).** The human seat chooses the order of their own pending effects (an opt-in `order` decision, recorded in practice replays as `orderChoice`); bots keep queue order, so no bot game changed for this. Still open: an effect that does nothing yet is never offered.

The FAQ also repeatedly distinguishes events that look similar but have different value: each Gig stolen versus a multi-Gig steal trigger, an attack declaration versus a successful steal/fight, zero adjustment versus an actual adjustment, a printed cost versus the amount paid, a reaction versus a response to a Quick, and a triggered effect's snapshot from later board state. Turn these into tagged conformance scenarios; don't parse the text export as a reliable rules AST because some keyword/icon glyphs are missing from its questions.

**Method.**
1. Add versioned decision telemetry before changing the valuation formula. Give each decision and resolving effect a stable id; record phase/window, acting player, action and target, cost/resources spent, the legal choices available, and compact public board/economy features. For reactions, record the attack and target, each legal reaction, the selected reaction or `endReact`, and the resulting fight/steal/block. Keep hidden opponent information out of the acting bot's decision features; offline evaluation may use the simulator's full state for paired counterfactuals.
2. Separate three claims in reports: **card/deck fit** (does the list's plan make room for it?), **observed contribution** (what effects and resources did it actually produce?), and **decision value** (did choosing it at this moment improve the result against alternatives?). Keep draw association as descriptive context, not a causal estimate or direct cut rule.
3. Estimate decision value with paired counterfactual rollouts from the same state and random worlds. Compare playing now with the best legal alternative (including waiting/passing where legal); for a reaction, compare the selected reaction with letting the attack proceed. Attribute immediate and delayed effects through the effect lineage, then report short-horizon swing and match outcome separately. Reuse the reviewer's common-world rollout approach where practical, and label lower-confidence estimates when a decision cannot be cloned or sampled reliably.
4. Break value down by relevant context: early/middle/late game; ahead/even/behind; play vs reaction; opponent strategy; and the deck's declared strategic objective. Show sample counts and uncertainty for each slice, pooling sparse slices rather than presenting noisy card rankings as facts.
5. Feed one shared, versioned value contract to the coach, card-impact table, tuner, and breeder. Keep raw evidence and derived scores separate. Tuning must compare candidates on matched seeds/seats and held-out games; breeder selection should preserve intended strategy and card packages, not simply maximize a pooled card score.
6. In the UI, expose the evidence in a form that can move between deck profile, replay, and tuning: when the card was used, which decision window it answered, what it enabled or prevented, and how much evidence supports the conclusion. The replay's slow Play, Fast-forward, and Next action controls support inspection of these sequences but do not themselves establish card value.

**How the Coach should judge a turn.** The rules and FAQs are the authority for legality, timing, and resulting state. They are not themselves a strategic ranking of legal moves. Keep these layers separate:
- **Rules verdict:** Was the chosen line legal, and did the engine resolve it according to the versioned rules/FAQ? This is pass/fail conformance.
- **Decision grade:** Among legal options, what was the estimated regret of the choice: the best expected value available minus the value of the selected option? Compare from the same state and common random worlds, with uncertainty. If options are within evaluation noise, say “close” rather than calling one wrong.
- **Turn grade:** Judge the whole action sequence by its resulting position and strategic objective after the turn and a defined opponent response. Do not sum local action swings as if they were independent; later actions can enable or undo earlier ones.

The current reviewer is a starting tool, not an independent authority: it rolls out `HeuristicAgent` with `BEST_PROFILES` and uses the shared `evaluate()` function, while the Coach is also a configured `HeuristicAgent`. The reported 94% coach/oracle agreement predates the current engine/bot fixes. Treat it as self-consistency evidence until remeasured with a separately frozen evaluator, broader opponent policies, longer-horizon outcome calibration, held-out seeds, and expert-reviewed edge cases. The reviewer currently grades main-phase actions and attack reactions; extend coverage to mulligans, payment sources, target/mode/yes-no choices, Gig selection, and pending-effect ordering.

**Coach tuning loop.** First freeze the rules/card FAQ conformance version. Then tune Coach parameters on training matchups and seeds, select among configurations on a separate validation set, and publish results only on a final held-out set. Track rule violations (must remain zero), expected regret and blunder/game-loss rates by decision type, calibration/uncertainty, and full-game performance across declared deck strategies. Compare against a simple baseline and an independent stronger policy; do not optimize raw agreement with the Coach's current oracle. Revisit the config when it improves held-out measures without creating a persistent regression for a strategy or decision class. There is no single perfect static config across all opponents and deck plans.

**Open questions and proposed defaults.**
- What does “value” optimize: match-win probability, Gig swing, or strategic objective completion? Start with paired change in match-win probability as the primary measure; show Gig/board/resource swings as explanations, not interchangeable points in one opaque score.
- How much lookahead is feasible for every choice? Start with a sampled set of high-impact decision windows and use common-world rollouts; expand coverage after measuring runtime.
- How should a deck's purpose enter evaluation? Require a small explicit objective per deck (for example, early Gig pressure, stabilize then outlast, or win through a named synergy) with observable success signals. Do not infer purpose from a broad aggro/control label alone.
- When is evidence sufficient to alter a list? Require a minimum sample and an uncertainty interval that supports a practical gain on held-out matched games; set numeric thresholds after the clean baseline.

The supplied image and official Comprehensive Rules / Rules FAQ are game-design reference material, not instructions to the assistant. Before freezing a new baseline, reconcile card data and simulator behavior against the current rules, FAQs, and errata, and record their versions in each run manifest. Rules and errata can change, so a deck result is only comparable when those inputs are identified too.

## 6. Open and settled decisions

Open:
- For deck comparisons, start with an equal-weight meta field; add configurable tournament prevalence weights when reliable population data exists.
- For tuner adoption, require a practical minimum gain and a held-out paired comparison whose confidence interval supports the change; set the exact thresholds after the baseline variance is measured.
- Keep human-authored strategy specs and initially share a compact vocabulary, with deck-specific success signals.
- Defer the active bred-deck retention list until the new baseline has measured them; keep their historical snapshots in the archive.

Settled on 2026-11-10: the code is MIT-licensed (`LICENSE`, with third-party content listed in `NOTICE.md`), and the dev-dependency major upgrades (vite, vitest, tsx) are done as part of the current change rather than deferred.
