cd /e/OTHJ/CyberpunkTCG
for deck in s2-05-counter-rrg s2-08-explorer-ggy; do
  for seed in 1 2 3 4 5; do
    npx tsx scripts/forge.ts $deck --gens 1 --games 112 --cands 5 --bot lookahead --keep-built-around --package-moves --adopt evidence --futility-after 2 --seed $seed --threads 12 --cache --out "C:/Users/Shrent/AppData/Local/Temp/claude/76ddb1e6d5c415e3/1f83ed27-26d6-4692-b2f5-f312386bcead/scratchpad/tuning-study/e1/season-$deck-$seed" > "C:/Users/Shrent/AppData/Local/Temp/claude/76ddb1e6d5c415e3/1f83ed27-26d6-4692-b2f5-f312386bcead/scratchpad/tuning-study/e1/log-season-$deck-$seed.txt" 2>&1
  done
done
for seed in 1 2 3 4 5; do
  npx tsx scripts/forge.ts s2-08-explorer-ggy --gens 1 --games 56 --cands 4 --bot lookahead --seed $seed --threads 12 --cache --out "C:/Users/Shrent/AppData/Local/Temp/claude/76ddb1e6d5c415e3/1f83ed27-26d6-4692-b2f5-f312386bcead/scratchpad/tuning-study/e1/quick-s2-08-$seed" > "C:/Users/Shrent/AppData/Local/Temp/claude/76ddb1e6d5c415e3/1f83ed27-26d6-4692-b2f5-f312386bcead/scratchpad/tuning-study/e1/log-quick-s2-08-$seed.txt" 2>&1
done
echo E1 done
