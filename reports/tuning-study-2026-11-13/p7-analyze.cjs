// P7: read the gate records p7-validate.sh wrote and answer the plan's questions (p7-plan.txt); the record is
// p7-validate.txt. Run from the repository root: node reports/tuning-study-2026-11-13/p7-analyze.cjs <out dir>
// It reads <out dir>/ref and <out dir>/bar (npm run gate records, every stage played) and p7-pairs.json beside this
// file (the pairs and the ratings as they were read before any gate game), and writes <out dir>/p7-rows.json.
const fs = require('node:fs');
const path = require('node:path');
const out = process.argv[2];
if (!out) {
  console.error('usage: node reports/tuning-study-2026-11-13/p7-analyze.cjs <out dir>');
  process.exit(2);
}
const P = JSON.parse(fs.readFileSync(path.join(__dirname, 'p7-pairs.json'), 'utf8'));
const read = (dir) =>
  fs.existsSync(path.join(out, dir))
    ? fs.readdirSync(path.join(out, dir)).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(fs.readFileSync(path.join(out, dir, f), 'utf8')).decks[0])
    : [];
const pct = (x) => `${x >= 0 ? '+' : '-'}${Math.abs(x * 100).toFixed(1)}`;
const full = (step) => step.played || step.judged;
const plain = (step) => {
  const f = full(step);
  const se = f.sd / Math.sqrt(f.games);
  return { mean: f.mean, lo: f.mean - 1.959964 * se, hi: f.mean + 1.959964 * se, se, sd: f.sd, games: f.games };
};
const range = (p) => `${pct(p.mean)} [${pct(p.lo)}, ${pct(p.hi)}]`;
const verdict = (s) => `${s.verdict.replace(/-/g, ' ')}${s.verdict === 'could-not-tell' ? '' : `, look ${s.looks}`}`;
const gateOf = (m, h) => (m.verdict === 'shown-worse' ? 'kept out by Medium' : h.verdict === 'shown-worse' ? 'kept out by Hard' : 'enters');
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const sdOf = (xs) => Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const i = Math.floor(s.length / 2);
  return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
};
const ranks = (xs) => {
  const idx = xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length; ) {
    let j = i;
    while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
    for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
    i = j + 1;
  }
  return r;
};
const pearson = (a, b) => {
  const ma = mean(a);
  const mb = mean(b);
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < a.length; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb);
};
const spearman = (a, b) => pearson(ranks(a), ranks(b));
const sameSign = (a, b) => a.filter((x, i) => Math.sign(x) === Math.sign(b[i])).length;
const names = (rs) => rs.map((r) => r.name.split(' (')[0]).join(', ') || 'none';

// ---------------------------------------------------------------- each deck against the reference the rule gives it
const ref = read('ref');
const rows = [];
for (const p of P.pairs) {
  const d = ref.find((x) => x.name === p.name);
  if (!d) {
    console.log(`MISSING in ref: ${p.name}`);
    continue;
  }
  rows.push({ name: p.name, reference: d.reference.name, opponents: d.field.length, ratings: p.rating - p.referenceRating, m: d.first, h: d.confirm, pm: plain(d.first), ph: plain(d.confirm), gate: gateOf(d.first, d.confirm) });
}
console.log(`Each deck against the reference the rule gives it (${rows.length} pairs)`);
for (const r of rows) console.log(`  ${r.name.padEnd(21)} ${r.reference.padEnd(34)} ratings ${pct(r.ratings).padStart(6)}  Medium ${range(r.pm).padEnd(22)} ${verdict(r.m).padEnd(21)} Hard ${range(r.ph).padEnd(22)} ${verdict(r.h).padEnd(21)} ${r.gate}`);
const outM = rows.filter((r) => r.m.verdict === 'shown-worse');
const rest = rows.filter((r) => r.m.verdict !== 'shown-worse');
const outH = rest.filter((r) => r.h.verdict === 'shown-worse');
const enters = rows.filter((r) => r.gate === 'enters');
console.log('');
console.log(`Q1  kept out by Medium: ${outM.length} of ${rows.length}; by Hard among the other ${rest.length}: ${outH.length} (${names(outH)}); entering: ${enters.length} (${names(enters)})`);
console.log(`    shown better: Medium ${names(rows.filter((r) => r.m.verdict === 'shown-better'))}; Hard ${names(rows.filter((r) => r.h.verdict === 'shown-better'))}`);
const rat = rows.map((r) => r.ratings);
const med = rows.map((r) => r.pm.mean);
const hard = rows.map((r) => r.ph.mean);
console.log(`Q2  against the ratings: Medium same sign ${sameSign(med, rat)} of ${rows.length}, Spearman ${spearman(med, rat).toFixed(2)}, Pearson ${pearson(med, rat).toFixed(2)}; Hard same sign ${sameSign(hard, rat)}, Spearman ${spearman(hard, rat).toFixed(2)}, Pearson ${pearson(hard, rat).toFixed(2)}`);
const low = rows.filter((r) => r.ratings <= -0.1);
const near = rows.filter((r) => Math.abs(r.ratings) <= 0.05);
console.log(`    rated 10 or more points below the reference: ${low.length}, of them kept out ${low.filter((r) => r.gate !== 'enters').length}; rated within 5 points: ${near.length} (${names(near)}), of them kept out: ${names(near.filter((r) => r.gate !== 'enters'))}`);
const mx = mean(med);
const my = mean(hard);
let sxy = 0;
let sxx = 0;
for (let i = 0; i < med.length; i++) {
  sxy += (med[i] - mx) * (hard[i] - my);
  sxx += (med[i] - mx) ** 2;
}
console.log(`Q3  Medium against Hard: same sign ${sameSign(med, hard)} of ${rows.length}, Pearson ${pearson(med, hard).toFixed(2)}, Spearman ${spearman(med, hard).toFixed(2)}; Hard = ${pct(my - (sxy / sxx) * mx)} + ${(sxy / sxx).toFixed(2)} x Medium; mean Medium ${pct(mx)}, mean Hard ${pct(my)}`);
console.log(`    shown worse by Medium with the Hard plain 95% range entirely above zero: ${names(outM.filter((r) => r.ph.lo > 0))}; plain ranges on opposite sides of zero: ${names(rows.filter((r) => (r.pm.hi < 0 && r.ph.lo > 0) || (r.pm.lo > 0 && r.ph.hi < 0)))}`);
console.log(`    shown worse by both: ${rows.filter((r) => r.m.verdict === 'shown-worse' && r.h.verdict === 'shown-worse').length}; by Medium only: ${names(rows.filter((r) => r.m.verdict === 'shown-worse' && r.h.verdict !== 'shown-worse'))}; by Hard only: ${names(rows.filter((r) => r.m.verdict !== 'shown-worse' && r.h.verdict === 'shown-worse'))}`);
const diff = rows.map((r) => r.ph.mean - r.pm.mean);
const noise = Math.sqrt(mean(rows.map((r) => r.ph.se ** 2 + r.pm.se ** 2)));
console.log(`    Hard minus Medium, deck by deck: mean ${pct(mean(diff))} (standard error ${(100 * sdOf(diff) / Math.sqrt(diff.length)).toFixed(1)}), standard deviation ${(100 * sdOf(diff)).toFixed(1)}, where game noise alone gives ${(100 * noise).toFixed(1)}; beyond noise about ${(100 * Math.sqrt(Math.max(0, sdOf(diff) ** 2 - noise ** 2))).toFixed(1)}`);
const sdM = rows.map((r) => r.pm.sd);
const sdH = rows.map((r) => r.ph.sd);
console.log(`Q4  per-game spread: Medium median ${median(sdM).toFixed(3)} (${Math.min(...sdM).toFixed(2)} to ${Math.max(...sdM).toFixed(2)}); Hard median ${median(sdH).toFixed(3)} (${Math.min(...sdH).toFixed(2)} to ${Math.max(...sdH).toFixed(2)})`);
const sum = (rs, f) => rs.reduce((s, r) => s + f(r), 0);
console.log(`Q5  paired games: Medium ${sum(rows, (r) => r.m.judged.games)} with the staged looks against ${sum(rows, (r) => r.pm.games)} at full size; Hard ${sum(rest, (r) => r.h.judged.games)} for the ${rest.length} decks Medium did not show worse, against ${sum(rows, (r) => r.ph.games)} if every deck played Hard in full`);

// ---------------------------------------------------------------- every deck against the fixed bar
const barDecks = new Map();
for (const d of ref) if (d.reference.name === P.bar.name) barDecks.set(d.name, d);
for (const d of read('bar')) barDecks.set(d.name, d);
const bar = [];
for (const p of P.pairs) {
  const d = barDecks.get(p.name);
  if (!d) continue;
  bar.push({ name: p.name, rating: p.rating, vsBar: p.rating - P.bar.rating, m: d.first, h: d.confirm, pm: plain(d.first), ph: plain(d.confirm), gate: gateOf(d.first, d.confirm) });
}
if (bar.length) {
  console.log('');
  console.log(`Every deck against the fixed bar, ${P.bar.name} (rated ${(P.bar.rating * 100).toFixed(1)}%; ${bar.length} decks)`);
  for (const r of bar) console.log(`  ${r.name.padEnd(21)} ${`${(r.rating * 100).toFixed(1)}% (${pct(r.vsBar)})`.padEnd(15)} Medium ${range(r.pm).padEnd(22)} ${verdict(r.m).padEnd(21)} Hard ${range(r.ph).padEnd(22)} ${verdict(r.h).padEnd(21)} ${r.gate}`);
  const in2 = bar.filter((r) => r.gate === 'enters');
  const above = bar.filter((r) => r.vsBar >= 0);
  const below = bar.filter((r) => r.vsBar <= -0.05);
  console.log('');
  console.log(`    entering: ${in2.length} of ${bar.length} (${names(in2)}); kept out by Medium ${bar.filter((r) => r.gate === 'kept out by Medium').length}, by Hard ${bar.filter((r) => r.gate === 'kept out by Hard').length} (${names(bar.filter((r) => r.gate !== 'enters'))})`);
  console.log(`    rated at or above the bar: ${above.length}, of them entering ${above.filter((r) => r.gate === 'enters').length}; rated 5 or more points below it: ${below.length}, of them entering: ${names(below.filter((r) => r.gate === 'enters'))}`);
  const d2 = bar.map((r) => r.ph.mean - r.pm.mean);
  const n2 = Math.sqrt(mean(bar.map((r) => r.ph.se ** 2 + r.pm.se ** 2)));
  console.log(`    Medium against Hard: same sign ${sameSign(bar.map((r) => r.pm.mean), bar.map((r) => r.ph.mean))} of ${bar.length}; Hard minus Medium mean ${pct(mean(d2))}, standard deviation ${(100 * sdOf(d2)).toFixed(1)}, where game noise alone gives ${(100 * n2).toFixed(1)}`);
  console.log(`    Hard alone, with its two stages, would let in ${bar.filter((r) => r.h.verdict !== 'shown-worse').length}: ${names(bar.filter((r) => r.h.verdict !== 'shown-worse'))}`);
}
const slim = (r) => ({ medium: { verdict: r.m.verdict, look: r.m.looks, judgedGames: r.m.judged.games, mean: r.pm.mean, lo: r.pm.lo, hi: r.pm.hi, sd: r.pm.sd, games: r.pm.games }, hard: { verdict: r.h.verdict, look: r.h.looks, judgedGames: r.h.judged.games, mean: r.ph.mean, lo: r.ph.lo, hi: r.ph.hi, sd: r.ph.sd, games: r.ph.games }, gate: r.gate });
const r6 = (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e6) / 1e6 : v);
fs.writeFileSync(path.join(out, 'p7-rows.json'), `${JSON.stringify({ reference: rows.map((r) => ({ name: r.name, reference: r.reference, opponents: r.opponents, ratings: r.ratings, ...slim(r) })), bar: bar.map((r) => ({ name: r.name, rating: r.rating, vsBar: r.vsBar, ...slim(r) })) }, r6, 1)}\n`);
