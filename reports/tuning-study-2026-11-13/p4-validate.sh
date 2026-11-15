#!/bin/bash
# P4 ("until settled") validated on real games, 2026-11-15, SIM_VERSION 9 (docs/SYNERGIES.md "Until settled, and what a
# run can detect"). It adds one way to the P5 validation's folder (p5-validate.sh, run first: the same decks, seeds and
# sizes, so the ways compare game for game and the measured worth of each nominee is reused):
#   shortlist-settled     --ledger --pooled-ranking --until-settled (P4 and P5 as shipped, the reach of 10,000)
# Eight forge runs in a row (seeds 1 to 8) on each deck, every run from the same list (--out keeps the library
# untouched). Then any change it nominated that was not measured yet is played on 2,800 fresh paired games
# (p5-truth.ts), p5-validate-analyze.cjs prints the summary of all the ways, and p4-record-check.ts recomputes every
# reported figure from the ledger files with separate code. The recorded output is p4-validate.txt.
#
#   bash reports/tuning-study-2026-11-13/p4-validate.sh [OUT]      (from the repository root; OUT defaults to .cache/p5-validate)
#
# About 36,700 Medium games (many of them the P5 ways' own, read from the game cache with --cache).
OUT=${1:-.cache/p5-validate}
RUNS=${RUNS:-8}
DECKS="s2-05-counter-rrg s2-08-explorer-ggy"
for deck in $DECKS; do
  D="$OUT/$deck/shortlist-settled"
  if [ -e "$D" ]; then echo "$D exists already: move it away first"; exit 1; fi
  mkdir -p "$D"
  for seed in $(seq 1 "$RUNS"); do
    npx tsx scripts/forge.ts "$deck" --gens 1 --games 112 --cands 5 --bot medium --threads "${THREADS:-12}" --cache --seed "$seed" --ledger --ledger-dir "$D/ledger" --pooled-ranking --until-settled --out "$D/run-$seed" > "$D/run-$seed.log" 2>&1
    echo "$deck shortlist-settled seed $seed exit $?"
  done
done
node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs "$OUT" $DECKS > /dev/null
for deck in $DECKS; do THREADS="${THREADS:-12}" npx tsx reports/tuning-study-2026-11-13/p5-truth.ts "$OUT" "$deck"; done
node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs "$OUT" $DECKS
npx tsx reports/tuning-study-2026-11-13/p4-record-check.ts "$OUT" $DECKS
