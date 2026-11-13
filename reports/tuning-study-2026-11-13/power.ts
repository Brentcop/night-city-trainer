// Power of the adoption rule and of the whole screen -> nominate -> confirm pipeline, normal approximation of paired
// per-game differences with SD sigma (measured: E2/E3). Uses the repository's own lookZs (O'Brien-Fleming-type).
import fs from 'node:fs';
import { lookZs, ADOPTION_DEFAULTS } from 'E:/OTHJ/CyberpunkTCG/src/lib/evidence';
let s = 12345;
const u = () => ((s = (s * 1664525 + 1013904223) >>> 0) + 0.5) / 4294967296;
const gauss = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
const SIG_CARD = Number(process.env.SIG_CARD ?? 0.22), SIG_PKG = Number(process.env.SIG_PKG ?? 0.5);
interface Cfg { name: string; screen: number; stage: number; cands: number; nominees: number; minScreen: number }
const CFGS: Cfg[] = [
  { name: 'Lab Quick (56 screen, stages 112 to 448, 4 cands)', screen: 56, stage: 112, cands: 4, nominees: 1, minScreen: 0.02 },
  { name: 'Lab Standard (112, 224 to 896, 5 cands)', screen: 112, stage: 224, cands: 5, nominees: 1, minScreen: 0.02 },
  { name: 'Lab Thorough (168, 336 to 1344, 6 cands)', screen: 168, stage: 336, cands: 6, nominees: 1, minScreen: 0.02 },
  { name: 'Season forge step (112, 224 to 896, 5 cands + 3 pkg)', screen: 112, stage: 224, cands: 8, nominees: 1, minScreen: 0.02 },
  { name: 'Forge default (140, 280 to 1120, 6 cands)', screen: 140, stage: 280, cands: 6, nominees: 1, minScreen: 0.02 },
];
/** one staged confirmation of a nominee with true gain d, SD sig: returns 'adopt'|'reject'|'inconclusive' and games */
function confirm(d: number, sig: number, stage: number, zs: number[]) {
  const rule = ADOPTION_DEFAULTS;
  let sum = 0, n = 0;
  for (let k = 0; k < rule.capStages; k++) {
    sum += d * stage + gauss() * sig * Math.sqrt(stage); n += stage;
    const m = sum / n, se = sig / Math.sqrt(n), z = zs[k]!;
    if (m - z * se > rule.minGainPp / 100 && n >= rule.minGames) return { o: 'adopt', n };
    if (m + z * se < rule.minGainPp / 100) return { o: 'reject', n };
    if (k + 1 >= rule.futilityAfterStages && k + 1 < rule.capStages && m <= 0) return { o: 'inconclusive', n };
  }
  return { o: 'inconclusive', n };
}
const zs1 = lookZs(ADOPTION_DEFAULTS, 1);
const lines: string[] = [];
const log = (x: string) => { console.log(x); lines.push(x); };
log(`z per look (1 nominee): ${zs1.map((z) => z.toFixed(2)).join(' / ')}`);
// 1. confirmation alone: smallest true gain adopted 50% / 80% of the time
log('\n1. Confirmation alone (one nominee): P(adopt) by true gain, and the gain adopted 80% of the time');
for (const [label, sig] of [['single card (sd ' + SIG_CARD + ')', SIG_CARD], ['package move (sd ' + SIG_PKG + ')', SIG_PKG]] as const) {
  for (const stage of [112, 224, 280, 336]) {
    const row: string[] = []; let d80 = NaN, d50 = NaN;
    for (let d = 0; d <= 0.15; d += 0.0025) {
      let a = 0; const R = 4000; for (let r = 0; r < R; r++) if (confirm(d, sig, stage, zs1).o === 'adopt') a++;
      const p = a / R;
      if (isNaN(d50) && p >= 0.5) d50 = d; if (isNaN(d80) && p >= 0.8) d80 = d;
      if ([0, 0.01, 0.02, 0.03, 0.05].some((x) => Math.abs(x - d) < 1e-9)) row.push(`+${(d * 100).toFixed(0)}: ${(p * 100).toFixed(0)}%`);
    }
    log(`  ${label}, stages of ${stage} up to ${stage * 4}: ${row.join('  ')} | 50% at +${(d50 * 100).toFixed(1)}, 80% at +${(d80 * 100).toFixed(1)} pts`);
  }
}
// 2. full pipeline with true effects drawn from an empirical or normal distribution
const effects: number[] = fs.existsSync(__dirname + '/e3-candidates.json') ? JSON.parse(fs.readFileSync(__dirname + '/e3-candidates.json', 'utf8')).filter((c: any) => !c.pkg).map((c: any) => c.mean) : [];
const MU = Number(process.env.MU ?? -0.01), TAU = Number(process.env.TAU ?? 0.02);
const draw = () => (process.env.EMPIRICAL && effects.length ? effects[Math.floor(u() * effects.length)]! : MU + TAU * gauss());
log(`\n2. Whole pipeline, true single-card effects ${process.env.EMPIRICAL && effects.length ? `resampled from E3 (${effects.length} measured candidates)` : `~ N(${MU * 100}, ${TAU * 100}) pts`}; screen SD ${SIG_CARD}`);
for (const c of CFGS) {
  const R = 20000; let nom = 0, adopt = 0, falseAdopt = 0, gainAdopted = 0, curse = 0, best = 0, bestAdopted = 0, games = 0, bestTrue = 0;
  for (let r = 0; r < R; r++) {
    const t = Array.from({ length: c.cands }, draw);
    const se = SIG_CARD / Math.sqrt(c.screen);
    const scr = t.map((x) => x + se * gauss());
    let i = 0; scr.forEach((x, k) => { if (x > scr[i]!) i = k; });
    const ib = t.indexOf(Math.max(...t)); bestTrue += t[ib]!;
    games += c.screen * (1 + c.cands);
    if (i === ib) best++;
    if (scr[i]! < c.minScreen) continue;
    nom++; curse += scr[i]! - t[i]!;
    const cf = confirm(t[i]!, SIG_CARD, c.stage, zs1); games += cf.n * 2;
    if (cf.o === 'adopt') { adopt++; gainAdopted += t[i]!; if (t[i]! < 0.01) falseAdopt++; if (i === ib) bestAdopted++; }
  }
  log(`  ${c.name}: nominated ${(nom / R * 100).toFixed(0)}% of runs, screening overstates the nominee by ${(curse / nom * 100).toFixed(1)} pts; adopted ${(adopt / R * 100).toFixed(1)}%, of those true gain < 1 pt ${adopt ? (falseAdopt / adopt * 100).toFixed(0) : '-'}%, mean true gain adopted ${adopt ? (gainAdopted / adopt * 100).toFixed(1) : '-'} pts; screen picks the truly best candidate ${(best / R * 100).toFixed(0)}%; best candidate's true gain averages ${(bestTrue / R * 100).toFixed(1)} pts; ~${Math.round(games / R)} games per run`);
}
fs.writeFileSync(__dirname + `/power-${process.env.EMPIRICAL ? 'empirical' : 'normal'}.txt`, lines.join('\n'));
