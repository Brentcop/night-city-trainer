// Summary of the P5 and P4 validations (p5-validate.sh, p4-validate.sh): from the forge JSON of every run, per deck and
// way, each run's candidates, nominee and outcome, how many candidates repeat from the run before, and the totals;
// then, when p5-truth.ts has measured them, what every nominated change is really worth, what each way did with it,
// and how each way's nominations ended for the changes measured clearly above the bar and for the others.
//
//   node reports/tuning-study-2026-11-13/p5-validate-analyze.cjs OUT deck...
//
// Writes OUT/analysis.json (the nominees and adoptions per way, which p5-truth.ts reads). The recorded outputs are
// p5-validate.txt (the four P5 ways, before P4 existed) and p4-validate.txt (all five ways).
'use strict';
const fs = require('fs');
const path = require('path');
const [OUT, ...decks] = process.argv.slice(2);
if (!OUT || !decks.length) {
  console.error('usage: node p5-validate-analyze.cjs OUT deck...');
  process.exit(2);
}
// 'shortlist-settled' is P4's way (p4-validate.sh): the shortlist with --until-settled
const arms = ['today', 'ledger', 'shortlist', 'shortlist-reach4500', 'shortlist-settled'];
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
    const nominations = [];
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
        const st = n.settle ? `; until settled: ${n.settle.stages} further stage${n.settle.stages === 1 ? '' : 's'}, ended ${n.settle.ended}${n.settle.toSettle ? ` (would need ${Math.round(n.settle.toSettle).toLocaleString('en-US')} in all)` : ''}` : '';
        nomText = `${n.label}: screening ${pp(n.screen.mean * 100)}${h ? `; held-out ${pp(h.mean * 100)} [${pp(h.lower * 100)}, ${pp(h.upper * 100)}], ${h.games} games${h.priorGames ? ` (${h.priorGames} from earlier runs)` : ''}, z ${h.z.toFixed(2)}` : ''}${st} -> ${n.outcome === 'adopt' ? 'ADOPTED' : n.outcome === 'reject' ? 'rejected' : 'could not tell'}${n.stopped ? ` (${n.stopped})` : ''}`;
        noms.push(n.label);
        nominations.push({ seed, label: n.label, outcome: n.outcome, games: h ? h.games : 0, further: n.settle ? n.settle.stages : 0 });
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
    out[deck][arm] = { games, distinct: all.size, overlap, overlapOf, sameNom, nomPairs, nominees: [...new Set(noms)], adopted, nominations };
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
    console.log(`  ${t.label.padEnd(72)} ${pp(t.mean * 100).padStart(5)} [${pp(t.lower * 100)}, ${pp(t.upper * 100)}]   today: ${did('today', t.label).padEnd(24)} shortlist: ${did('shortlist', t.label).padEnd(26)} shortlist at reach 4,500: ${did('shortlist-reach4500', t.label).padEnd(24)}${out[deck]['shortlist-settled'] ? ` shortlist until settled: ${did('shortlist-settled', t.label)}` : ''}`);
  }
  for (const arm of ['today', 'shortlist', 'shortlist-reach4500', 'shortlist-settled']) {
    const a = out[deck][arm];
    if (!a) continue;
    const labels = [...new Set(a.adopted.map((x) => x.label))];
    const worth = labels.map((l) => truth.find((t) => t.label === l)).filter(Boolean);
    console.log(`  -> ${arm}: ${labels.length} change${labels.length === 1 ? '' : 's'} adopted, really worth ${worth.map((t) => pp(t.mean * 100)).join(', ') || '-'}; ${a.games.toLocaleString('en-US')} games`);
  }
}

// how each way's nominations ended: a change counts as clearly above the bar when the 95% interval of its 2,800-game
// measurement lies above +1 point
const BAR = 0.01;
const tally = {};
for (const deck of decks) {
  const f = path.join(OUT, `truth-${deck}.json`);
  if (!fs.existsSync(f)) continue;
  const truth = JSON.parse(fs.readFileSync(f, 'utf8'));
  for (const arm of ['today', 'shortlist', 'shortlist-reach4500', 'shortlist-settled']) {
    const a = out[deck][arm];
    if (!a) continue;
    const t = (tally[arm] ??= { games: 0, real: { n: 0, adopt: 0, open: 0, reject: 0 }, other: { n: 0, adopt: 0, open: 0, reject: 0 }, unmeasured: 0, further: 0 });
    t.games += a.games;
    for (const nm of a.nominations) {
      const tr = truth.find((x) => x.label === nm.label);
      if (!tr) {
        t.unmeasured++;
        continue;
      }
      const k = tr.lower > BAR ? t.real : t.other;
      k.n++;
      k[nm.outcome === 'adopt' ? 'adopt' : nm.outcome === 'reject' ? 'reject' : 'open']++;
      t.further += nm.further;
    }
  }
}
if (Object.keys(tally).length) {
  console.log(`
=== ${decks.length === 1 ? decks[0] : 'All decks'}: how the nominations ended (a change is "clearly above the bar" when the 95% interval of its measurement lies above +1 point)`);
  for (const [arm, t] of Object.entries(tally)) {
    const line = (k) => `${k.n} nomination${k.n === 1 ? '' : 's'}: ${k.adopt} adopted, ${k.open} could not tell, ${k.reject} rejected`;
    console.log(`  ${arm.padEnd(20)} ${t.games.toLocaleString('en-US').padStart(7)} games; clearly above the bar, ${line(t.real)}; the others, ${line(t.other)}${t.further ? `; ${t.further} further stage${t.further === 1 ? '' : 's'}` : ''}${t.unmeasured ? `; ${t.unmeasured} not measured` : ''}`);
  }
}
