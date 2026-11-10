# Night City Trainer — Cyberpunk TCG practice simulator

An unofficial, local-first simulator for the **Cyberpunk Trading Card Game** (WeirdCo / CD PROJEKT RED, set 1 *Welcome to Night City*), built to find the strongest deck for the **Edgerunner Open Regional — Chicago (Dec 11–13, 2026)** and practice it.

It combines what two community sites do:

- **[cyberpunk-tcg-sim.online](https://cyberpunk-tcg-sim.online/):** a full rules engine, a deck builder, and play against AI.
- **[choom.gg](https://choom.gg/):** meta tiers, guides, deck lists, and import/export.

On top of that it adds a **matchup lab** that runs thousands of bot-vs-bot games and writes reports, plus **strategy guides** built from those results.

> Not affiliated with CD PROJEKT RED, WeirdCo, choom.gg or cyberpunk-tcg-sim.online. Card data comes from the public catalog of cyberpunk-tcg-sim.online (sourced from netdeck.gg). Meta ratings and deck lists from choom.gg are credited per deck.

## What's inside

| Area | Where | What it does |
|---|---|---|
| Rules engine | `src/engine/` | Implements the Comprehensive Rules (Oct 29 2026): setup and mulligans, economy (Eddies, selling, Legends as money), Call a Legend (also as a reaction), Go Solo, Lag, attack / react / fight / steal, Blocker, Quick, pending-effect order, replacement effects, overtime, and win/deck-out checks. |
| Card scripts | `src/engine/scripts/{red,blue,green,yellow}.ts` | All 150 legal cards. A handful are approximated; they are flagged `partial` and shown as "sim: approximated" on the Cards page. |
| Bots | `src/ai/` | The lookahead bot clones the game, plays each candidate action out, and scores the result. Reactions are scored by projecting the attack's outcome. Sub-choices (targets, dice, discards, modes) use a card-knowledge base and each deck's "Gig plan". |
| Deck formats | `src/engine/deck.ts` | Imports choom.gg text, the "Official" format (cyberpunktcg.com / ChoomBattler / the Sim), Sim deck JSON, and loose lists. Exports all three. Validates RAM limits, copies, size and sideboard. |
| Deck library | `data/decks/` | Choom.gg meta archetypes (`meta-*.txt`), choom.gg guide lists, and your own decks in `data/decks/custom/`. |
| Web app | `src/ui/`, `src/App.tsx` | Home, Meta, Strategy guides, Decks (builder + import/export), Play vs Bot (with coach), Matchup Lab, Cards, Glossary. |
| Matchup scripts | `scripts/simulate.ts` | Multi-threaded deck testing from the CLI (see below). |
| Research | `data/raw/`, `docs/` | Saved copies of the rules, errata, tournament rules, choom.gg meta pages and guides, and the research notes. |

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

## Matchup scripts

```bash
npm run sim -- catalog                              # list decks (match by file or name fragment)
npm run sim -- show rrg                             # print a deck + legality check
npm run sim -- vs meta-rrg meta-bbg --games 400     # head-to-head
npm run sim -- test "Smash the Curve" --games 200   # one deck vs every meta deck  (--field all for every deck)
npm run sim -- review --field all --games 60        # full round robin, rankings + matrix
npm run sim -- add my-list.txt --name "My RRG"      # add a deck (choom.gg / official / sim JSON / plain list)
npx tsx scripts/tune.ts --per 8                     # self-play tuning of the bot's evaluation weights
npm run sim -- analyze --field all --bot deep       # telemetry round robin -> Insights page, rankings, reports/analysis-latest.md
npx tsx scripts/plan.ts                             # regenerate the Tournament plan + Home recommendation from the data
npx tsx scripts/forge.ts --nc --gens 2              # data-driven iteration of the Trainer-original decks (or pass any deck)
npx tsx scripts/optimize.ts <deck> --vs <opp> --sideboard   # Bo3 sideboard swaps for one matchup
npx tsx scripts/tune-profiles.ts                    # tune matchup-aware bot profiles
npx tsx scripts/season.ts --season 4                # breed 8 new decks, tournament, forge, finals, leaderboard
bash scripts/seasons.sh                             # 3 seasons + grand final + finals + plan
```

### Data-driven deck building
Eight original decks (`data/decks/custom/nc-*.txt`, "Trainer originals" on the site) were designed from gaps in the meta, then refined with the **forge** loop: baseline vs the meta with telemetry, then cut the lowest-impact cards, test adds on identical seeds, and confirm on fresh seeds. Earlier versions are archived in `data/decks/custom/history/`, and the reasoning is in `reports/forge/`. The full process is on the Strategy page → "How decks are built here", and in `docs/ANALYSIS.md`.

Reports go to `reports/` (`*-latest.md` plus timestamped copies). `review` also refreshes `src/data/review.json`, which feeds the Meta and Home pages.

## Adding decks

- **In the browser:** go to Decks → Import, paste a list, then Save to My decks. Decks are stored in your browser's localStorage.
- **For the CLI and the bundled site:** run `npm run sim -- add file.txt`, or drop a `.txt` file into `data/decks/custom/`. Any supported format works.
- **Refreshing the choom.gg data:** re-download the pages into `data/raw/`, then run `npx tsx scripts/import-meta.ts` and `npx tsx scripts/import-guides.ts`.

## Deploying to GitHub Pages
The app is fully static: hash routing, relative `base`, and no server. On every push to `main`, `.github/workflows/pages.yml` typechecks, tests, builds, and publishes `dist/` to the `gh-pages` branch. GitHub Pages serves that branch at `https://<user>.github.io/<repo>/`.

## Sources and credits
Every deck file carries a provenance header (`// Origin:`, `// Author:`, `// Source:`, `// Via:`, `// Credits:`, `// Parents:`, `// Added:`). These headers are shown on the Decks, Strategy, Seasons and **Credits** pages. Collected lists credit their authors and link back to choom.gg. Saved copies of third-party pages used during research stay local in `data/raw/` and are not published.

## Tests

```bash
npm test             # engine smoke test, per-colour card tests, deck format round-trips
npm run typecheck
```

## Known limits

- The bots are strong heuristic players, not perfect ones. They favour proactive decks over high-skill control decks such as BBG Econ, so treat sim win rates as a floor for those decks. See `docs/STRATEGY.md`.
- Hidden information is respected: bots don't see your hand or deck order, and nobody knows which face-down Legend is which. However, the lookahead clones the rival's real hand for reaction modelling.
- Approximated cards are listed on the Cards page; search "approximated".
