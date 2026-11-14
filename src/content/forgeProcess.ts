export const FORGE_PROCESS = `
## The deck-building loop
This is the process used for the eight **NC** decks. Reuse it for any idea.

1. **Hypothesis.** Start from a gap in the data. Examples: "no meta deck uses Green's 8-power 5-drops", "BBG's early turns are soft", "1-RAM fatties make splashes cheap". Write it in the deck file as \`// Idea:\`.
2. **Build legally.** Use the Decks page or \`npm run sim -- add\`. RAM limits are checked live.
3. **Baseline vs the meta.** \`npm run sim -- analyze --deck <name> --games 100\`, or the Matchup Lab with telemetry, gives:
   - the win rate against each meta deck;
   - **Δ when drawn** for every card;
   - tempo, seat and mulligan stats.
4. **Forge.** \`npx tsx scripts/forge.ts <deck> --gens 2\` repeats this cycle:
   - **cut** the lowest-impact cards;
   - **try adding** the deck's own best cards and the format's highest-impact legal cards;
   - **test** every swap on identical seeds (this only nominates);
   - **confirm** the nominee on fresh seeds, paired with the list, in stages: it is adopted only when the gain is clearly above 1 point, rejected when it is clearly below, and otherwise reported as "could not tell" and not adopted. A nominee that shows no gain after two stages stops there ("could not tell", stopped early) instead of playing to the cap.

   The old list is archived and the reasoning is logged in \`reports/forge/<deck>.md\`.
5. **Sideboard.** \`npx tsx scripts/optimize.ts <deck> --vs <opponent> --sideboard\` finds the swaps worth bringing in for your worst matchups.
6. **Re-rank.** \`npm run sim -- analyze --field all --bot deep\` then \`npx tsx scripts/plan.ts\` refreshes the rankings, the Insights page and the Tournament plan.
7. **Human check.** Play 10+ games with the deck in **Play vs Bot** with Coach on. Bots don't bluff, so confirm the deck's plan survives a thinking opponent.

## Seasons: automated breeding
\`npx tsx scripts/season.ts --season N\` runs a full design cycle with no manual input:
1. **Breed 8 decks** from everything earlier runs measured:
   - **Parent strength:** power ratings from the tournament series (discounted by their uncertainty), blended with the vs-meta leaderboard.
   - **Card choice:** format-wide "Δ when drawn" plus each parent's own card impact (matched by the parent's exact list, so a changed list starts fresh). Cards that won games in the parent are kept; cards that lost games there are not carried over.
   - **Unit floor:** a bred deck never has fewer than 13 Units, the fewest in any hand-built list in the library; one that would is topped up by swapping its weakest non-Units for the best Units its Legends allow (within any package plan), or not bred.
   - **Legend strength:** the average strength of decks using the Legend, pulled toward 50% when few decks have tried it.
   - **2 mutants:** a top deck with one Legend swapped, cards re-fitted to the new RAM limits;
   - **2 crossovers:** two strong decks merged;
   - **2 counters:** the decks with the best tournament head-to-heads against the current top 4, merged to target them;
   - **2 explorers:** untested two-colour Legend combinations built from role and curve templates.
   (Before any tournament data exists, the counter slots go to mutants and crossovers. On the website, **Decks → Deck Lab → Breed** uses the same methods, counters included. It reads the head-to-heads from \`public/data/h2h.json\`, which every tournament run rebuilds; \`npm run build-h2h\` rebuilds it by hand.)
2. **Tournament:** a telemetry round robin of the meta archetypes, the 8 best incumbents and the newcomers.
3. **Forge** the newcomers against the meta.
4. **Finals:** every newcomer plays the meta archetypes.
5. **Leaderboard:** every game against the meta archetypes is pooled per deck. Ranking uses a rating shrunk toward 50% by a 60-game prior, plus a percentile across all decks ever measured (see the **Seasons** page).

Each season is one run of \`npx tsx scripts/season.ts --season <next number>\`. The script refuses to re-run a season that already exists, so the leaderboard is never counted twice.

## Reading the numbers
- **±3 points is noise** at ~300 games. The forge requires +2 points on the paired test to nominate a change, and a held-out paired gain whose corrected lower bound is above 1 point (at least 200 fresh games) to adopt it. Changes forged before 2026-11-11 were adopted on any gain on the fresh seeds, so many of them were noise.
- **Δ when drawn** measures impact, not quality. A cheap card you always sell can score low and still be right to run as Eddie fodder.
- Bots under-play complex control decks, so treat a control deck's numbers as a floor.
`;
