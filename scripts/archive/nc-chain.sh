#!/usr/bin/env bash
# After the final meta run: forge the NC decks, then a full 26-deck telemetry round robin, then regenerate the plan.
set -e
until grep -q "final-done" reports/final.log 2>/dev/null; do sleep 15; done
npx tsx scripts/forge.ts --nc --gens 2 --games 112 --cands 5 > reports/forge-run.log 2>&1
npx tsx scripts/simulate.ts analyze --field all --games 24 --bot deep > reports/analysis-all-run.log 2>&1
npx tsx scripts/plan.ts > reports/plan-run.log 2>&1
echo nc-chain-done
