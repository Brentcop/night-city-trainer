#!/usr/bin/env bash
set -e
for S in 4 5; do
  npx tsx scripts/season.ts --season $S --games 16 --bot deep --finals 42 --forge-gens 1 > reports/season-$S.log 2>&1
  echo "season $S done"
done
npx tsx scripts/tag-provenance.ts > reports/tag-run.log 2>&1
echo seasons45-done
