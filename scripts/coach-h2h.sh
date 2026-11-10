#!/usr/bin/env bash
# Coach configs as players vs the in-app Deep bot (deep 3, tuned profiles), every meta pairing, same seeds.
B='{"profiles":"best","deep":3,"noise":0.15}'
for A in '{"profiles":"best","deep":12,"impact":40,"noise":0}' '{"profiles":"best","deep":5,"impact":40,"noise":0}' '{"profiles":"best","deep":12,"noise":0}'; do
  npx tsx scripts/botcheck.ts "$A" "$B" --per 4
done
