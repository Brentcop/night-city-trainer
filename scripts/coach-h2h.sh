#!/usr/bin/env bash
# Coach configs as players vs the in-app Deep bot (deep 3, tuned profiles), every meta pairing, same seeds.
# These are the older deep-12 / deep-5 candidates. The shipped coach (makeCoach: deep 6 over 6 shared worlds,
# sellLookahead 3, deepReactions 6, plain mulligan) is not a JSON spec: measure it with scripts/coach-eval.ts --set shipped,
# or on the position benchmark with scripts/benchmark.ts coach.
B='{"profiles":"best","deep":3,"noise":0.15}'
for A in '{"profiles":"best","deep":12,"impact":40,"noise":0}' '{"profiles":"best","deep":5,"impact":40,"noise":0}' '{"profiles":"best","deep":12,"noise":0}'; do
  npx tsx scripts/botcheck.ts "$A" "$B" --per 4
done
