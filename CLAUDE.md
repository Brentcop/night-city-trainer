# Night City Trainer — notes for contributors and agents

- **Stack:** TypeScript, React 18 and Vite 5, with Vitest for tests and tsx for scripts. No backend. The site is a static build for GitHub Pages (`base: './'`, hash routing).
- **Engine:** `src/engine/engine.ts` (Game class) implements the Comprehensive Rules saved in `data/raw/official_comprehensive_rules.txt`. Card behaviour lives in `src/engine/scripts/<color>.ts`, keyed by card id from `src/data/cards.json`.
  - Scripts use the `CardScript` hooks in `src/engine/types.ts`.
  - State must stay plain data, because bots `structuredClone` it. Never put functions in mods; player `costMod` filters are plain objects (see `costModMatches`).
  - "Next time … this turn" effects from Programs use `g.addDelayed(self, event, data)` together with a `delayed` handler on the script.
- **Card data:** `npm run build:data` regenerates `src/data/cards.json` from `data/raw/sim_catalog.json`.
- **Decks:** `data/decks/*.txt` (meta-*, guide lists) and `data/decks/custom/`. Parse and export them with `src/engine/deck.ts`. Choom.gg imports are refreshed with `scripts/import-meta.ts` and `scripts/import-guides.ts`.
- **Bots:** `src/ai/heuristic.ts` (1-ply lookahead; set `deep: N` for turn rollouts), `src/ai/eval.ts` (tuned weights), `src/ai/knowledge.ts` (roles, ratings, Gig plans). Docs are in `docs/BOT_TOOLKIT.md`.
- **Sims:** `npm run sim -- <catalog|show|vs|test|review|add>` runs games in worker threads (`scripts/worker.ts`, booted via `worker-boot.mjs`). Other scripts: `scripts/tune.ts` (weight tuning), `scripts/optimize.ts` (card-swap search), `scripts/botcheck.ts` (compare bot configs).
- **Before committing:** `npx tsc --noEmit && npx vitest run`.
