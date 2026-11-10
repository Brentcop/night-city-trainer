#!/usr/bin/env bash
# Runs after a review: focused tests of the top 3 decks + optimizer on #1.
set -e
until grep -q "Saved reports/review" reports/review-deep.log 2>/dev/null; do sleep 5; done
TOP=$(node -e "const r=require('./src/data/review.json');console.log(r.decks.slice(0,3).map(d=>d.file).join(' '))")
echo "top3: $TOP"
for d in $TOP; do npx tsx scripts/simulate.ts test "$d" --field all --games 60 --bot deep > "reports/test-$d.log" 2>&1; done
FIRST=$(echo $TOP | cut -d' ' -f1)
npx tsx scripts/optimize.ts "$FIRST" --screen 84 --confirm 336 --candidates 40 > "reports/optimize-$FIRST.log" 2>&1
echo followup-done
