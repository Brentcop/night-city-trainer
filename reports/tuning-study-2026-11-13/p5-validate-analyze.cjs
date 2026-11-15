// Summary of the P5 validation (p5-validate.sh): from the forge JSON of every run, per deck and way, each run's
// candidates, nominee and outcome, how many candidates repeat from the run before, and the totals; then, when
// p5-truth.ts has measured them, what every nominated change is really worth and what each way did with it.
//
//   node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs OUT deck...
//
// Writes OUT/analysis.json (the nominees and adoptions per way, which p5-truth.ts reads). The recorded run's output is
// p5-validate.txt.
'use strict';
const fs = require('fs');
const path = require('path');
const [OUT, ...decks] = process.argv.slice(2);
if (!OUT || !decks.length) {
  console.error('usage: node p5-validate-analyze.cjs OUT deck...');
  process.exit(2);
}
const arms = ['today', 'ledger', 'shortlist', 'shortlist-reach4500'];
const pp = (x) => `${x >= 0 ? '+' : ''}${x.toFixed(1)}`;
const out = {};
for (const deck of decks) {
  out[deck] = {};
  for (const arm of arms) {
    const dir = path.join(OUT, deck, arm);
    if (!fs.existsSync(dir)) continue;
    const runs = fs.readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).map((f) => +f.slice(4)).sort((a, b) => a - b);
    let prev = null;
    let prevNom = null;
    const all = new Set();
    let overlap = 0;
    let overlapOf = 0;
    let games = 0;
    let sameNom = 0;
    let nomPairs = 0;
    const rows = [];
    const adopted = [];
    const noms = [];
    for (const seed of runs) {
      const f = path.join(dir, `run-${seed}`, 'forge', `${deck}.json`);
      if (!fs.existsSync(f)) {
        rows.push(`  run ${seed}: no report`);
        continue;
      }
      const j = JSON.parse(fs.readFileSync(f, 'utf8'));
      const g = j.gens[0];
      const cands = g.swaps.map((s) => s.swap);
      cands.forEach((c) => all.add(c));
      const same = prev ? cands.filter((c) => prev.includes(c)).length : 0;
      if (prev) {
        overlap += same;
        overlapOf += cands.length;
      }
      prev = cands;
      const n = (g.nominees || [])[0];
      games += j.manifest?.sample?.completedGames ?? 0;
      let nomText = 'nothing nominated';
      if (n) {
        const h = n.heldOut;
        nomText = `${n.label}: screening ${pp(n.screen.mean * 100)}${h ? `; held-out ${pp(h.mean * 100)} [${pp(h.lower * 100)}, ${pp(h.upper * 100)}], ${h.games} games${h.priorGames ? ` (${h.priorGames} from earlier runs)` : ''}, z ${h.z.toFixed(2)}` : ''} -> ${n.outcome === 'adopt' ? 'ADOPTED' : n.outcome === 'reject' ? 'rejected' : 'could not tell'}${n.stopped ? ` (${n.stopped})` : ''}`;
        noms.push(n.label);
        if (prevNom) {
          nomPairs++;
          if (prevNom === n.label) sameNom++;
        }
        prevNom = n.label;
        if (n.outcome === 'adopt') adopted.push({ seed, label: n.label, heldOut: h });
      }
      const sl = g.shortlist;
      const carried = sl ? `; carried ${sl.carried.length}${sl.carried.length ? ': ' + sl.carried.map((c) => `${c.label} (${pp(c.gain)} over ${c.games})`).join('; ') : ''}${sl.skipped.length ? `; skipped ${sl.skipped.length}: ${sl.skipped.map((s) => `${s.label} [${s.why}]`).join('; ')}` : ''}` : '';
      rows.push(`  run ${seed}: ${same} of ${cands.length} candidates the same as the run before${carried}\n         ${nomText}`);
    }
    console.log(`\n=== ${deck} / ${arm}: ${games.toLocaleString('en-US')} games`);
    for (const r of rows) console.log(r);
    console.log(`  -> different changes screened: ${all.size}; candidates the same as the run before: ${overlap} of ${overlapOf}; nominations that repeat the last one: ${sameNom} of ${nomPairs}; different nominees: ${new Set(noms).size} in ${noms.length} nominations`);
    console.log(`  -> adopted: ${adopted.length ? adopted.map((a) => `run ${a.seed} ${a.label} (${pp(a.heldOut.mean * 100)} [${pp(a.heldOut.lower * 100)}, ${pp(a.heldOut.upper * 100)}], ${a.heldOut.games} games)`).join(' | ') : 'nothing'}`);
    out[deck][arm] = { games, distinct: all.size, overlap, overlapOf, sameNom, nomPairs, nominees: [...new Set(noms)], adopted };
  }
}
fs.writeFileSync(path.join(OUT, 'analysis.json'), JSON.stringify(out, null, 1));

// what the nominated changes are really worth (p5-truth.ts), and what each way did with them
for (const deck of decks) {
  const f = path.join(OUT, `truth-${deck}.json`);
  if (!fs.existsSync(f)) continue;
  const truth = JSON.parse(fs.readFileSync(f, 'utf8'));
  console.log(`\n=== ${deck}: what each nominated change is really worth (${truth[0]?.games ?? '?'} fresh paired games each, plain 95% interval)`);
  const did = (arm, label) => {
    const a = out[deck][arm];
    if (!a) return '';
    const ad = a.adopted.filter((x) => x.label === label).map((x) => x.seed);
    return a.nominees.includes(label) ? (ad.length ? `adopted (run ${ad.join(', ')})` : 'nominated, not adopted') : '-';
  };
  for (const t of truth) {
    console.log(`  ${t.label.padEnd(72)} ${pp(t.mean * 100).padStart(5)} [${pp(t.lower * 100)}, ${pp(t.upper * 100)}]   today: ${did('today', t.label).padEnd(24)} shortlist: ${did('shortlist', t.label).padEnd(26)} shortlist at reach 4,500: ${did('shortlist-reach4500', t.label)}`);
  }
  for (const arm of ['today', 'shortlist', 'shortlist-reach4500']) {
    const a = out[deck][arm];
    if (!a) continue;
    const labels = [...new Set(a.adopted.map((x) => x.label))];
    const worth = labels.map((l) => truth.find((t) => t.label === l)).filter(Boolean);
    console.log(`  -> ${arm}: ${labels.length} change${labels.length === 1 ? '' : 's'} adopted, really worth ${worth.map((t) => pp(t.mean * 100)).join(', ') || '-'}`);
  }
}
