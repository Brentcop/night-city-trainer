#!/usr/bin/env bash
# Candidate bot tiers head-to-head, every meta pairing, seats swapped, same seeds. Results → reports/bot-tiers.log
D3='{"profiles":"best","deep":3,"noise":0.15}'
run() { echo "## $1"; npx tsx scripts/botcheck.ts "$2" "$3" --per 4 --threads 5 2>/dev/null | grep "A wins"; }
run "1-ply vs deep 3"                 '{"profiles":"best","noise":0.15}' "$D3"
run "1-ply + impact vs 1-ply"         '{"profiles":"best","impact":40,"noise":0.15}' '{"profiles":"best","noise":0.15}'
run "deep 3 + impact vs deep 3"       '{"profiles":"best","deep":3,"impact":40,"noise":0.15}' "$D3"
run "fast vs 1-ply"                   '{"lookahead":false}' '{"profiles":"best","noise":0.15}'
echo tiers-done
