#!/bin/bash
# P5 (the shortlist carried across runs) validated on real games, 2026-11-14 and 15, SIM_VERSION 9
# (docs/SYNERGIES.md "A shortlist carried across runs"). Eight forge runs in a row (seeds 1 to 8) on the study's two
# decks, four ways on the same seeds:
#   today                 no ledger
#   ledger                --ledger (P1 only)
#   shortlist             --ledger --pooled-ranking (P5, the shipped reach of 10,000)
#   shortlist-reach4500   the same with --reach 4500 (the first default)
# --out keeps the library untouched, so the base list is the same in every run; --cache plays a game shared between the
# ways once. Then every change any run nominated is played on 2,800 fresh paired games (p5-truth.ts), and
# p5-validate-analyze.cjs prints the summary (the recorded run's is p5-validate.txt).
#
#   bash reports/tuning-study-2026-11-13/p5-validate.sh [OUT]      (from the repository root; OUT defaults to .cache/p5-validate)
#
# About 90,000 Medium games for the runs (most of them shared between the ways) and 50,400 for the measurements.
OUT=${1:-.cache/p5-validate}
RUNS=${RUNS:-8}
DECKS="s2-05-counter-rrg s2-08-explorer-ggy"
for deck in $DECKS; do
  for arm in today ledger shortlist shortlist-reach4500; do
    D="$OUT/$deck/$arm"
    if [ -e "$D" ]; then echo "$D exists already: move it away first"; exit 1; fi
    mkdir -p "$D"
    case $arm in
      today) EXTRA="" ;;
      ledger) EXTRA="--ledger --ledger-dir $D/ledger" ;;
      shortlist) EXTRA="--ledger --ledger-dir $D/ledger --pooled-ranking" ;;
      shortlist-reach4500) EXTRA="--ledger --ledger-dir $D/ledger --pooled-ranking --reach 4500" ;;
    esac
    for seed in $(seq 1 "$RUNS"); do
      npx tsx scripts/forge.ts "$deck" --gens 1 --games 112 --cands 5 --bot medium --threads "${THREADS:-12}" --cache --seed "$seed" $EXTRA --out "$D/run-$seed" > "$D/run-$seed.log" 2>&1
      echo "$deck $arm seed $seed exit $?"
    done
  done
done
node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs "$OUT" $DECKS > /dev/null
for deck in $DECKS; do THREADS="${THREADS:-12}" npx tsx reports/tuning-study-2026-11-13/p5-truth.ts "$OUT" "$deck"; done
node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs "$OUT" $DECKS
