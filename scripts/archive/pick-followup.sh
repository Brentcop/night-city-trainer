#!/usr/bin/env bash
set -e
P=s2-08-explorer-rrg
npx tsx scripts/simulate.ts vs $P meta-rrg --games 400 --bot deep > reports/pick-vs-rrg.log 2>&1
npx tsx scripts/simulate.ts vs $P meta-bbg --games 400 --bot deep > reports/pick-vs-bbg.log 2>&1
npx tsx scripts/optimize.ts $P --vs meta-bbg --screen 80 --confirm 300 --candidates 30 --bot lookahead > reports/pick-opt-bbg.log 2>&1
npx tsx scripts/optimize.ts $P --vs meta-rrg --screen 80 --confirm 300 --candidates 30 --bot lookahead > reports/pick-opt-rrg.log 2>&1
npx tsx scripts/eor-build.ts $P --vs meta-bbg,meta-rrg > reports/pick-eor.log 2>&1
npx tsx scripts/plan.ts > reports/plan-run.log 2>&1
echo pick-done
