#!/usr/bin/env bash
# Measure the review-driven refinement (reports/review-refine-*.md, reports/refine-h2h.log).
npx tsx scripts/review.ts --from tiers --games 30 --threads 7 --name refine-tiers > reports/refine-tiers.log 2>&1
npx tsx scripts/review.ts --from tiers --tiers hard,hard-v1 --games 24 --threads 7 --name refine-hard > reports/refine-hard.log 2>&1
npx tsx scripts/review.ts --from events --games 60 --coach --seed 7 --threads 7 --name refine-coach > reports/refine-coach.log 2>&1
npx tsx scripts/review.ts --from events --games 60 --coach-v1 --seed 7 --threads 7 --name refine-coach-v1 > reports/refine-coach-v1.log 2>&1
echo refine-done
