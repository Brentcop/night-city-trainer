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

- **Wave C — structure, performance, accessibility.** Bundle size and data loading (WP-C1), Play performance and accessibility (WP-C2), pages accessibility and CSS (WP-C3), type hardening and engine structure (WP-C4), production deploy (WP-C5).

## Open decisions

- **Licence.** The repository has no LICENSE file. Needs the owner's choice for the code, plus a third-party notice for card data and collected deck lists.
- **Dev-dependency major upgrades** (vite, vitest, tsx): six advisories affecting the dev server and test runner only; production dependencies are clean.
