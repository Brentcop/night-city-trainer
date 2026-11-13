const fs=require('fs');const path=require('path');
const dir='E:/OTHJ/CyberpunkTCG/reports/forge';
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.json'))){
  const r=JSON.parse(fs.readFileSync(path.join(dir,f)));
  console.log(`\n## ${r.deck} (${r.file}) seed ${r.seed} rule ${r.adoption?.rule??'any-gain/none'} ${r.field?.slice(-40)}`);
  for(const g of r.gens){
    const deltas=g.swaps.map(s=>s.delta);
    console.log(` gen ${g.gen} baseline ${g.baseline} verdict ${g.verdict} screened ${g.swaps.length}: deltas ${deltas.join(', ')}`);
    for(const n of g.nominees??[]) console.log(`   nominee ${n.label.slice(0,70)} | screen ${(n.screen.mean*100).toFixed(1)} [${(n.screen.lower*100).toFixed(1)},${(n.screen.upper*100).toFixed(1)}] n${n.screen.games} | heldOut ${n.heldOut?(n.heldOut.mean*100).toFixed(1)+' ['+(n.heldOut.lower*100).toFixed(1)+','+(n.heldOut.upper*100).toFixed(1)+'] n'+n.heldOut.games+' looks'+n.heldOut.looks+' base '+n.heldOut.baseWr+' cand '+n.heldOut.candWr:'-'} | ${n.outcome} ${n.stopped??''}`);
    if(!g.nominees && g.confirm) console.log('   confirm:',g.confirm);
  }
}
