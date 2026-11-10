#!/usr/bin/env bash
# Final data runs, after profile tuning: telemetry round robin (deep bot) + optimizer on the #1 deck.
set -e
while pgrep -f "tune-profiles.ts" >/dev/null 2>&1 || ! [ -f reports/tune-profiles.log ]; do sleep 10; done
npx tsx scripts/simulate.ts analyze --field all --games 40 --bot deep > reports/analysis-run.log 2>&1
cp src/data/review.json reports/review-final.json
FIRST=$(node -e "console.log(require('./src/data/review.json').decks[0].file)")
echo "top: $FIRST"
npx tsx scripts/optimize.ts "$FIRST" --screen 84 --confirm 336 --candidates 40 > "reports/optimize-run.log" 2>&1
echo final-done
