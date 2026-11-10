#!/usr/bin/env bash
set -e
npx tsx scripts/simulate.ts vs meta-rrg meta-bbg --games 400 --bot deep > reports/rrg-vs-bbg.log 2>&1
npx tsx scripts/optimize.ts meta-rrg --vs meta-bbg --screen 80 --confirm 300 --candidates 30 --bot lookahead > reports/rrg-vs-bbg-optimize.log 2>&1
echo bbg-done
