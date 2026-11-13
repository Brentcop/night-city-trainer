const r=require(__dirname+'/e3-candidates.json');
const m=a=>a.reduce((x,y)=>x+y,0)/a.length;const sd=a=>{const mu=m(a);return Math.sqrt(a.reduce((s,x)=>s+(x-mu)**2,0)/(a.length-1))};
const pear=(a,b)=>{const ma=m(a),mb=m(b);let s=0,sa=0,sb=0;for(let i=0;i<a.length;i++){s+=(a[i]-ma)*(b[i]-mb);sa+=(a[i]-ma)**2;sb+=(b[i]-mb)**2}return s/Math.sqrt(sa*sb)};
const rank=a=>{const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=[];s.forEach(([v,i],k)=>r[i]=k);return r};
for(const [name,f] of [['single cards',c=>!c.pkg],['package moves',c=>c.pkg]]){
 for(const deck of [null,...new Set(r.map(c=>c.deck))]){
  const x=r.filter(f).filter(c=>!deck||c.deck===deck);if(x.length<3)continue;
  const eff=x.map(c=>c.mean*100),se=x.map(c=>c.se*100),sds=x.map(c=>c.sd);
  const tau2=Math.max(0,sd(eff)**2-m(se.map(s=>s*s)));
  const scr=[],tru=[];for(const c of x)for(const s of c.screens){scr.push(s.delta);tru.push(c.mean*100)}
  console.log(`\n${name}${deck?' — '+deck:' — both decks'}: n=${x.length}; measured effect mean ${m(eff).toFixed(2)} pts, sd ${sd(eff).toFixed(2)} (true-effect sd after removing noise ≈ ${Math.sqrt(tau2).toFixed(2)}); median per-game sd ${sds.sort((a,b)=>a-b)[Math.floor(sds.length/2)].toFixed(3)} (range ${Math.min(...sds).toFixed(2)}–${Math.max(...sds).toFixed(2)})`);
  console.log(`  share with measured effect > +1: ${(eff.filter(e=>e>1).length/eff.length*100).toFixed(0)}%, > +2: ${(eff.filter(e=>e>2).length/eff.length*100).toFixed(0)}%, > +3: ${(eff.filter(e=>e>3).length/eff.length*100).toFixed(0)}%, < 0: ${(eff.filter(e=>e<0).length/eff.length*100).toFixed(0)}%; max ${Math.max(...eff).toFixed(1)}`);
  console.log(`  screen (112 or 56 games) vs large-sample effect: Pearson ${pear(scr,tru).toFixed(2)}, Spearman ${pear(rank(scr),rank(tru)).toFixed(2)} over ${scr.length} screenings; mean screen ${m(scr).toFixed(2)} vs mean effect ${m(tru).toFixed(2)}`);
 }}
