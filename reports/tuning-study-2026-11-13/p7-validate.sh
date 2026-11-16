#!/bin/bash
# P7: the breeder's gate at full size on the 16 recorded bred decks (plan: p7-plan.txt; record: p7-validate.txt).
# Run from the repository root:
#   bash reports/tuning-study-2026-11-13/p7-validate.sh <out dir> [threads]
#   node reports/tuning-study-2026-11-13/p7-analyze.cjs <out dir>
# Every stage is played (--no-early-stop), so the full-size figures and the staged verdicts both come out.
#   <out dir>/ref  each deck against the reference the rule gives it: its best parent by the ratings of 2026-11-15
#                  (p7-pairs.json), or for an explorer the middle meta deck
#   <out dir>/bar  the eleven decks whose reference is another deck, against the fixed bar (the middle meta deck)
# Games are read from .cache/games when it holds them (--cache). Nothing is written outside <out dir> and the cache:
# gate games count for no rating, leaderboard, change ledger or evidence file.
OUT="$1"; THREADS="${2:-12}"
if [ -z "$OUT" ]; then echo "usage: bash reports/tuning-study-2026-11-13/p7-validate.sh <out dir> [threads]"; exit 2; fi
mkdir -p "$OUT/ref" "$OUT/bar" "$OUT/logs"
t0=$(date +%s)
while read -r deck ref; do
  [ -z "$deck" ] && continue
  npm run gate --silent -- "$deck" --ref "$ref" --no-early-stop --cache --threads "$THREADS" --out "$OUT/ref" > "$OUT/logs/ref-$deck.log" 2>&1
  echo "ref $deck exit $? at $(( $(date +%s) - t0 )) s"
done <<'PAIRS'
s1-01-mutant-rry meta-rrg-dexter-midrange
s1-02-mutant-ryy meta-yyb-rogue-gear
s1-03-mutant-rbg meta-rainbow-fixer-stuff
s1-04-cross-rbg meta-rrg-dexter-midrange
s1-05-cross-rbb meta-bbg-cunningham-econ
s1-06-cross-bgy meta-bbg-cunningham-econ
s1-07-explorer-ryy meta-yyb-rogue-gear
s1-08-explorer-bgg meta-yyb-rogue-gear
s2-01-mutant-ryy s1-01-mutant-rry
s2-02-mutant-rgg meta-rrg-dexter-midrange
s2-03-cross-rgy RRG-smash-the-curve
s2-04-cross-rrg ladder-rrg-v-smasher-saburo
s2-05-counter-rrg s1-01-mutant-rry
s2-06-counter-rgg ladder-rrg-v-smasher-saburo
s2-07-explorer-rrb meta-yyb-rogue-gear
s2-08-explorer-ggy meta-yyb-rogue-gear
PAIRS
for deck in s1-01-mutant-rry s1-03-mutant-rbg s1-04-cross-rbg s1-05-cross-rbb s1-06-cross-bgy s2-01-mutant-ryy s2-02-mutant-rgg s2-03-cross-rgy s2-04-cross-rrg s2-05-counter-rrg s2-06-counter-rgg; do
  npm run gate --silent -- "$deck" --ref meta-yyb-rogue-gear --no-early-stop --cache --threads "$THREADS" --out "$OUT/bar" > "$OUT/logs/bar-$deck.log" 2>&1
  echo "bar $deck exit $? at $(( $(date +%s) - t0 )) s"
done
echo "done in $(( $(date +%s) - t0 )) s"
