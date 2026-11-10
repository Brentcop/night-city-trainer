#!/usr/bin/env bash
# Three breeding seasons, then a grand final (meta + all-time top 12), finals for contenders, and the plan.
set -e
for S in 1 2 3; do
  npx tsx scripts/season.ts --season $S --games 16 --bot deep --finals 42 --forge-gens 1 > reports/season-$S.log 2>&1
  echo "season $S done"
done
npx tsx scripts/simulate.ts analyze --field leaderboard:12 --games 24 --bot deep > reports/grand-final.log 2>&1
echo "grand final done"
bash scripts/finals.sh > reports/finals-grand.log 2>&1
echo seasons-done
