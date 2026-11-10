# Archived scripts (unmaintained)

One-off scripts from earlier rounds of work, kept so the history of how the decks and data were made stays visible.
They are not maintained, are not run by anything, and may no longer match the current data or flags. Several of them
overwrite decks that have since been forged, or re-run seasons that are already recorded, so do not run them as they are.
The `.ts` files still typecheck (the project's `tsconfig.json` includes `scripts/`); the shell scripts assume Git Bash and
paths relative to the repository root.

| File | What it was |
|---|---|
| `new-decks.ts` | Wrote the 8 original hand-designed "NC" decks to `data/decks/custom/nc-*.txt`. Would overwrite the forged versions. |
| `variants.ts` | Wrote two optimizer-derived RRG variants (`rrg-v-*-optimized.txt`). Would overwrite them. |
| `tournament-build.ts` | Wrote the stock RRG list with a hand-picked sideboard as `rrg-eor-build.txt`. Superseded by `eor-build.ts`. |
| `diag.ts` | Ad-hoc win-reason breakdown for one matchup; a near-duplicate of `quick.ts`. |
| `bbg-plan.sh` | One run: RRG vs BBG head-to-head plus a sideboard optimizer pass. |
| `pick-followup.sh` | One run: head-to-heads, optimizer and EOR build for the `s2-08-explorer-rrg` pick, then the plan. |
| `refine-measure.sh` | One run: the reviews that measured the review-driven bot refinement. |
| `final.sh` | Waited for profile tuning (`pgrep`, absent in Git Bash), then an analysis round robin and optimizer. Polls forever if the log never appears. |
| `followup.sh` | Waited for a review log, then tested the top 3 decks and optimized #1. Polls a gitignored log forever. |
| `nc-chain.sh` | Waited for `final.sh`, then forged the NC decks, a round robin and the plan. Polls forever. |
| `series.sh` | Waited for seasons 4–5, then a 16-event tournament series, ratings, bundle and plan. Polls forever. |
| `seasons-45.sh` | Ran seasons 4 and 5 and re-tagged provenance. Re-running it now is refused (the seasons are recorded). |
| `seasons.sh` | Ran seasons 1–3, a grand final and the finals. Re-running it now is refused (the seasons are recorded); run `season.ts` (next season by default) instead. |
