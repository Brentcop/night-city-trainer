// P6: how much of a gain measured with the Medium bot shows with the Hard bot? Reads the stages of p6-hard.ts (OUT/p6-a.json,
// p6-b.json, p6-c.json) and the Medium figures of the six S2-05 and S2-08 changes under SIM_VERSION 9
// (data/evidence/remeasure-2026-11-15-p5.json), and prints the comparison. The analysis below was fixed before any Hard
// result was read:
//
//   1. per change: the Medium figure and the Hard figure, each with its plain 95% interval (fixed-size paired samples)
//   2. transfer, three ways over the changes of stage a:
//        the ratio of the summed gains (Hard / Medium), with a standard error from the measurements' own errors (delta
//        method) and a bootstrap over the changes;
//        the slope of Hard on Medium through the origin, each change weighted by 1 / SE(Hard)², with the same slope
//        corrected for the error in the Medium figures;
//        how many Hard figures agree in sign with Medium, and how many Hard intervals exclude zero
//   3. whether the changes differ in how much transfers: χ² of the Hard figures around slope × Medium
//   4. the two changes measured on 2,800 Hard games (stage b), each against the tools' 1-point bar
//   5. the per-game spread and the share of identical games with each bot, and what they mean for the games a Hard
//      confirmation needs
//
//   npx tsx reports/tuning-study-2026-11-13/p6-transfer.ts OUT      (from the repository root)
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2];
if (!OUT) {
  console.error('usage: npx tsx reports/tuning-study-2026-11-13/p6-transfer.ts OUT');
  process.exit(2);
}
interface Row {
  id: string;
  deck: string;
  label: string;
  baseListId: string;
  candListId: string;
  bot: string;
  simVersion: number;
  games: number;
  mean: number;
  se: number;
  sd?: number;
  same?: number;
  byOpp?: { opp: string; games: number; mean: number; se: number }[];
}
const read = (f: string): Row[] => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : []);
const a = read(path.join(OUT, 'p6-a.json'));
const b = read(path.join(OUT, 'p6-b.json'));
const c = read(path.join(OUT, 'p6-c.json'));
const p5: Row[] = JSON.parse(fs.readFileSync('data/evidence/remeasure-2026-11-15-p5.json', 'utf8')).measurements;
const pp = (x: number, d = 1) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(d)}`;
const iv = (r: Pick<Row, 'mean' | 'se'>) => `${pp(r.mean)} [${pp(r.mean - 1.96 * r.se)}, ${pp(r.mean + 1.96 * r.se)}]`;
const key = (r: Pick<Row, 'baseListId' | 'candListId'>) => `${r.baseListId}>${r.candListId}`;

// the Medium figure of each stage-a change under SIM_VERSION 9: stage c for the E2 seven, p5 for the S2 six
const medium = new Map<string, Row>();
for (const r of p5) if (r.simVersion === 9 && r.bot === 'medium') medium.set(key(r), r);
for (const r of c) medium.set(key(r), r);

console.log(`P6: Medium against Hard, SIM_VERSION 9, the 7 meta decks, paired games on the same seeds (${a.length} changes at ${a[0]?.games ?? '?'} Hard games; ${b.length} at ${b[0]?.games ?? '?'}; ${c.length} Medium re-measurements at ${c[0]?.games ?? '?'})\n`);
console.log('1. Each change (points, plain 95% interval)\n');
console.log(`${'change'.padEnd(74)} ${'Medium'.padEnd(26)} ${'Hard'.padEnd(26)} games M / H`);
const pairs: { id: string; label: string; m: Row; h: Row }[] = [];
for (const h of a) {
  const m = medium.get(key(h));
  console.log(`${h.label.slice(0, 73).padEnd(74)} ${(m ? iv(m) : 'not measured').padEnd(26)} ${iv(h).padEnd(26)} ${m ? m.games : '—'} / ${h.games}`);
  if (m) pairs.push({ id: h.id, label: h.label, m, h });
}
if (pairs.length < a.length) console.log(`\n(${a.length - pairs.length} change(s) have no Medium figure under version 9 yet: run stage c)`);

if (pairs.length >= 3) {
  const n = pairs.length;
  const sm = pairs.reduce((t, p) => t + p.m.mean, 0);
  const sh = pairs.reduce((t, p) => t + p.h.mean, 0);
  const ratio = sh / sm;
  // delta method: Var(H/M) ≈ (Var H + ratio² Var M) / M², the measurements independent
  const vh = pairs.reduce((t, p) => t + p.h.se ** 2, 0);
  const vm = pairs.reduce((t, p) => t + p.m.se ** 2, 0);
  const seRatio = Math.sqrt(vh + ratio * ratio * vm) / Math.abs(sm);
  // bootstrap over the changes (which changes were tried is itself a sample)
  let seed = 20261115;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const boots: number[] = [];
  for (let i = 0; i < 4000; i++) {
    let m = 0;
    let h = 0;
    for (let k = 0; k < n; k++) {
      const p = pairs[Math.floor(rnd() * n)]!;
      m += p.m.mean;
      h += p.h.mean;
    }
    if (m > 0) boots.push(h / m);
  }
  boots.sort((x, y) => x - y);
  const q = (p: number) => boots[Math.min(boots.length - 1, Math.floor(p * boots.length))]!;
  // slope of Hard on Medium through the origin, weights 1 / SE(Hard)²
  const w = pairs.map((p) => 1 / p.h.se ** 2);
  const sxx = pairs.reduce((t, p, i) => t + w[i]! * p.m.mean ** 2, 0);
  const sxy = pairs.reduce((t, p, i) => t + w[i]! * p.m.mean * p.h.mean, 0);
  const slope = sxy / sxx;
  const seSlope = Math.sqrt(1 / sxx);
  // the Medium figures carry error too: their squared size overstates the true squared size by their error variance
  const sxxTrue = pairs.reduce((t, p, i) => t + w[i]! * (p.m.mean ** 2 - p.m.se ** 2), 0);
  const slopeCorrected = sxy / sxxTrue;
  const chi2 = pairs.reduce((t, p) => t + (p.h.mean - slope * p.m.mean) ** 2 / (p.h.se ** 2 + slope ** 2 * p.m.se ** 2), 0);
  const sameSign = pairs.filter((p) => Math.sign(p.h.mean) === Math.sign(p.m.mean)).length;
  const hardClear = pairs.filter((p) => Math.abs(p.h.mean) > 1.96 * p.h.se).length;
  const mediumClear = pairs.filter((p) => Math.abs(p.m.mean) > 1.96 * p.m.se).length;
  console.log('\n2. Transfer over these changes\n');
  console.log(`  mean gain: Medium ${pp(sm / n, 2)} points, Hard ${pp(sh / n, 2)} points over ${n} changes`);
  console.log(`  ratio of the summed gains (Hard / Medium): ${ratio.toFixed(2)} ± ${seRatio.toFixed(2)} from the measurements' own errors; bootstrap over the changes, 95% from ${q(0.025).toFixed(2)} to ${q(0.975).toFixed(2)}`);
  console.log(`  slope of Hard on Medium through the origin: ${slope.toFixed(2)} ± ${seSlope.toFixed(2)}; corrected for the error in the Medium figures: ${slopeCorrected.toFixed(2)}`);
  console.log(`  same sign as Medium: ${sameSign} of ${n}; interval excludes zero: Hard ${hardClear} of ${n}, Medium ${mediumClear} of ${n}`);
  console.log(`\n3. Do the changes differ in how much transfers? χ² of the Hard figures around slope × Medium: ${chi2.toFixed(1)} on ${n - 1} degrees of freedom (5% point about ${(n - 1 + 1.645 * Math.sqrt(2 * (n - 1))).toFixed(1)})`);
  const cards = pairs.filter((p) => !/package/.test(p.label));
  const pkgs = pairs.filter((p) => /package/.test(p.label));
  const part = (ps: typeof pairs) => (ps.length ? `${(ps.reduce((t, p) => t + p.h.mean, 0) / ps.reduce((t, p) => t + p.m.mean, 0)).toFixed(2)} over ${ps.length}` : 'none');
  console.log(`  ratio for one-card swaps: ${part(cards)}; for package swaps: ${part(pkgs)}`);
}

if (b.length) {
  console.log('\n4. The two changes measured on 2,800 Hard games, against the 1-point bar the tools adopt at\n');
  for (const h of b) {
    const m = medium.get(key(h));
    const lo = h.mean - 1.96 * h.se;
    const hi = h.mean + 1.96 * h.se;
    const says = lo > 0.01 ? 'clears the 1-point bar' : lo > 0 ? 'a gain, not shown to clear the 1-point bar' : hi < 0.01 ? 'under the 1-point bar' : 'not settled';
    console.log(`  ${h.label}: Hard ${iv(h)} over ${h.games} games (${says}); Medium ${m ? `${iv(m)} over ${m.games}` : 'not measured'}`);
    if (h.byOpp) console.log(`    by opponent: ${h.byOpp.map((o) => `${o.opp.split(' ').slice(0, 2).join(' ')} ${pp(o.mean)}±${(196 * o.se).toFixed(1)}`).join(' | ')}`);
  }
}

const spread = (rows: Row[]) => rows.filter((r) => typeof r.sd === 'number').map((r) => r.sd!);
const med = (xs: number[]) => (xs.length ? [...xs].sort((x, y) => x - y)[Math.floor(xs.length / 2)]! : NaN);
const hs = spread(a.filter((r) => !/package/.test(r.label)));
const ms = spread(c.filter((r) => !/package/.test(r.label)));
console.log('\n5. Per-game spread of the paired difference (one-card swaps, median)\n');
console.log(`  Hard ${med(hs).toFixed(3)} over ${hs.length} changes${ms.length ? `; Medium ${med(ms).toFixed(3)} over ${ms.length} changes` : ''}`);
if (hs.length) {
  const sd = med(hs);
  // games for a plain 95% interval of ±1 point, and for the staged rule's first look to see +3 points (z 4.33 at stage 1)
  console.log(`  at that spread a plain 95% interval of ±1 point takes about ${Math.round(((1.96 * sd) / 0.01) ** 2).toLocaleString('en-US')} Hard paired games`);
  const same = a.filter((r) => typeof r.same === 'number').map((r) => r.same!);
  console.log(`  share of games that came out the same with and without the change: Hard median ${(100 * med(same)).toFixed(0)}%`);
}
