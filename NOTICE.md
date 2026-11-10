# Third-party content notice

Night City Trainer is an unofficial, fan-made tool. It is not affiliated with or endorsed by CD PROJEKT RED, WeirdCo, choom.gg, cyberpunk-tcg-sim.online or netdeck.gg.

## What the MIT licence covers

The [LICENSE](LICENSE) applies to the original source code and documentation written for this project: the rules engine, card scripts, bots, simulation and analysis scripts, the web app, and the decks designed, bred or forged here.

## What it does not cover

The following material comes from other parties and stays under its owners' rights. It is included or referenced here for practice and analysis, with credit, and is not relicensed by this repository.

| Material | Where it is in this repo | Source |
|---|---|---|
| Card names, rules text, stats and other card data for the Cyberpunk Trading Card Game | `src/data/cards.json` | The public card catalog of cyberpunk-tcg-sim.online (sourced from netdeck.gg / the official card database). The game and its content belong to CD PROJEKT RED and WeirdCo. |
| Card artwork | Not stored in this repository. The app requests images at runtime from `api.netdeck.gg` when art is turned on. | netdeck.gg / the official card database. |
| Official rules | Not stored in this repository (`data/raw/` is local-only). The app and docs paraphrase the Comprehensive Rules and Tournament Rules and cite rule numbers. | WeirdCo, cyberpunktcg.com. |
| Meta tiers, archetype lists, community guide lists and Choom Table statistics | `data/decks/meta-*.txt`, the guide lists in `data/decks/`, `src/data/meta.json`, `src/content/choomTable.ts` | choom.gg and the deck authors credited in each file's provenance header and on the in-app Credits page. |

Each deck file carries a provenance header (`// Origin:`, `// Author:`, `// Source:`, `// Via:`, `// Credits:`) naming where it came from. The in-app Credits page (`#/credits`) lists every source and author.

"Cyberpunk", "Cyberpunk 2077" and related names are trademarks of their respective owners.

If you are a rights holder and want something credited differently or removed, please open an issue on the repository.
