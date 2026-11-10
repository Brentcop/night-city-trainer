#!/usr/bin/env bash
# After seasons 4-5: tournament series with every deck, power ratings, then refresh bundled reports + plan.
set -e
until grep -q "seasons45-done" reports/seasons45.log 2>/dev/null; do sleep 20; done
npx tsx scripts/tournament.ts --events 16 --bot deep > reports/series.log 2>&1
npx tsx scripts/ratings.ts > reports/ratings-run.log 2>&1
npx tsx scripts/bundle-reports.ts > reports/bundle-run.log 2>&1
npx tsx scripts/plan.ts > reports/plan-run.log 2>&1
echo series-done
