const fs=require('fs');const path=require('path');const S=__dirname+'/e1';
const runs=fs.readdirSync(S).filter(d=>fs.statSync(path.join(S,d)).isDirectory()).sort();
const byCfg={};
for(const r of runs){const fd=path.join(S,r,'forge');if(!fs.existsSync(fd))continue;
 for(const f of fs.readdirSync(fd).filter(f=>f.endsWith('.json')&&f!=='summary.json')){const j=JSON.parse(fs.readFileSync(path.join(fd,f)));
  const cfg=r.replace(/-\d+$/,'');(byCfg[cfg]??=[]);
  for(const g of j.gens){const n=(g.nominees||[])[0];
   byCfg[cfg].push({run:r,baseline:g.baseline,cuts:(g.cuts||[]).filter(c=>c.offered).map(c=>c.card),cands:g.swaps.map(s=>[s.swap,s.delta]),nom:n?n.label:null,screen:n?n.screen.mean*100:null,held:n&&n.heldOut?[n.heldOut.mean*100,n.heldOut.lower*100,n.heldOut.upper*100,n.heldOut.games]:null,outcome:n?(n.outcome+(n.stopped?'('+n.stopped+')':'')):'none nominated'});
   console.log(`\n${r}: baseline ${g.baseline}% | cuts offered: ${(g.cuts||[]).filter(c=>c.offered).map(c=>c.card).join(', ')||'(plain ranking)'}`);
   for(const s of g.swaps) console.log(`   ${String(s.delta).padStart(6)}  ${s.swap.slice(0,110)}`);
   console.log(`   => nominee: ${n?n.label.slice(0,90):'-'} | screen ${n?(n.screen.mean*100).toFixed(1):'-'} | held-out ${n&&n.heldOut?`${(n.heldOut.mean*100).toFixed(1)} [${(n.heldOut.lower*100).toFixed(1)}, ${(n.heldOut.upper*100).toFixed(1)}] ${n.heldOut.games}g`:'-'} | ${n?n.outcome+(n.stopped?' ('+n.stopped+')':''):'nothing beat the list by 2+'}`);
  }}}
console.log('\n==== summary by config');
for(const [cfg,rs] of Object.entries(byCfg)){
 const all=new Map();for(const r of rs)for(const [c,d] of r.cands)(all.get(c)??all.set(c,[]).get(c)).push(d);
 console.log(`\n${cfg}: ${rs.length} runs; baselines ${rs.map(r=>r.baseline).join(', ')}; distinct candidates ${all.size}; candidates in every run ${[...all.values()].filter(v=>v.length===rs.length).length}`);
 console.log('  nominees: '+rs.map(r=>`${r.nom?r.nom.slice(0,50):'none'} → ${r.outcome}${r.held?` ${r.held[0].toFixed(1)} [${r.held[1].toFixed(1)},${r.held[2].toFixed(1)}] ${r.held[3]}g`:''}`).join('\n            '));
 for(const [c,v] of all) if(v.length>1) console.log(`  repeated: ${c.slice(0,80)}: screened ${v.join(', ')}`);
}
fs.writeFileSync(__dirname+'/e1-summary.json',JSON.stringify(byCfg,null,1));
