process.chdir('E:/OTHJ/CyberpunkTCG');
const R=require('E:/OTHJ/CyberpunkTCG/src/data/ratings.json');const L=require('E:/OTHJ/CyberpunkTCG/data/seasons/leaderboard.json');
const rat=Object.fromEntries(R.decks.map(d=>[d.name,d]));
const f=x=>x==null?'  -  ':(x*100).toFixed(1);
let rows=[];
for(const n of [1,2]){const s=require('E:/OTHJ/CyberpunkTCG/data/seasons/season-'+n+'.json');
 for(const b of s.bred){const r=rat[b.name];const lb=L[b.name];
  const ps=b.parents.map(p=>rat[p]);
  const pm=ps.filter(Boolean).map(p=>p.wrMeta);const pf=ps.filter(Boolean).map(p=>p.wrField);
  const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  rows.push({name:b.name,method:b.method,parents:b.parents.join(' x '),seasonMeta:lb?lb.metaW/lb.metaG:null,seasonG:lb?.metaG,hardField:r?.wrField,hardLo:r?.wrFieldLo,hardHi:r?.wrFieldHi,hardMeta:r?.wrMeta,games:r?.games,parField:avg(pf),parMeta:avg(pm),bestParField:pf.length?Math.max(...pf):null});
 }}
console.log('deck | method | parents | season vs-meta (deep v5, games) | Hard v8 vs field [90%] (games) | Hard v8 vs meta | parents mean vs field | best parent vs field | child-mean parent');
for(const r of rows) console.log([r.name,r.method,r.parents,f(r.seasonMeta)+' ('+r.seasonG+')',f(r.hardField)+' ['+f(r.hardLo)+','+f(r.hardHi)+'] ('+r.games+')',f(r.hardMeta),f(r.parField),f(r.bestParField),r.parField!=null?((r.hardField-r.parField)*100).toFixed(1):'-'].join(' | '));
const d=rows.filter(r=>r.parField!=null).map(r=>r.hardField-r.parField);
console.log('child - mean parent (vs field, Hard v8): mean',(d.reduce((a,b)=>a+b,0)/d.length*100).toFixed(1),'n',d.length,'children above mean parent',d.filter(x=>x>0).length);
const db=rows.filter(r=>r.bestParField!=null).map(r=>r.hardField-r.bestParField);
console.log('child - best parent: mean',(db.reduce((a,b)=>a+b,0)/db.length*100).toFixed(1),'above best parent',db.filter(x=>x>0).length,'of',db.length);
// season-vs-meta vs hard-vs-meta shrink
const sm=rows.filter(r=>r.seasonMeta!=null&&r.hardMeta!=null);
console.log('season vs-meta (deep v5) mean',(sm.reduce((a,r)=>a+r.seasonMeta,0)/sm.length*100).toFixed(1),' Hard v8 vs-meta mean',(sm.reduce((a,r)=>a+r.hardMeta,0)/sm.length*100).toFixed(1));
// field rank
const all=R.decks.slice().sort((a,b)=>b.wrField-a.wrField).map(d=>d.name);
console.log('ranks of bred decks among',all.length,':',rows.map(r=>r.name.split(' ')[0]+'#'+(all.indexOf(r.name)+1)).join(', '));
// spearman between season meta wr and hard field
function rank(a){const s=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]);const r=[];s.forEach(([v,i],k)=>r[i]=k);return r}
const a=rank(sm.map(r=>r.seasonMeta)),b=rank(sm.map(r=>r.hardMeta));const n=a.length;let dd=0;for(let i=0;i<n;i++)dd+=(a[i]-b[i])**2;console.log('spearman season-meta(deep v5) vs Hard v8 meta, bred decks n',n,(1-6*dd/(n*(n*n-1))).toFixed(2));
