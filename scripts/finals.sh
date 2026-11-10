#!/usr/bin/env bash
# Decisive large-sample test of the top contenders vs the meta field (deep bot), then regenerate the plan.
set -e
CANDS=$(node -e "
const r=require('./src/data/review.json'); const m=require('./src/data/meta.json').map(x=>x.title);
const score=d=>{let s=0,n=0;for(const o of m){if(o===d.name)continue;const v=r.matrix[d.name]?.[o];if(v===undefined)continue;s+=v;n++;}return n?s/n:0};
const byField=[...r.decks].sort((a,b)=>score(b)-score(a)).slice(0,6).map(d=>d.file);
const top=r.decks[0].file; console.log([...new Set([...byField, top])].join(' '));")
echo "finalists: $CANDS"
for d in $CANDS; do npx tsx scripts/simulate.ts test "$d" --field meta --games 60 --bot deep --seed 777 > "reports/finals-$d.log" 2>&1; echo "done $d"; done
npx tsx scripts/plan.ts > reports/plan-run.log 2>&1
echo finals-done
