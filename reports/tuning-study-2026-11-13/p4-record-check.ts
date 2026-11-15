// The until-settled validation runs (p4-validate.sh), checked from their ledger files with separate code: for every
// figure a run reported, the held-out games the ledger holds for that change are taken in the order they were recorded
// and cut at the run's game count; for a pooled figure (a nominee with earlier games, or one that went on past the cap)
// the mean, the always-valid interval, its z and the verdict are recomputed here, for a first confirmation the mean.
// It also checks that no held-out game of a change is one of that change's screening games.
//
//   npx tsx reports/tuning-study-2026-11-13/p4-record-check.ts OUT deck...     (from the repository root)
//
// The recorded output is the end of p4-validate.txt. The forge's JSON keeps four decimals, hence the tolerance.
import fs from 'node:fs';
import path from 'node:path';
import { readLedgerDir } from '../../scripts/ledger-store';

const RHO = 250;
const zStrict = (n: number, a: number) => Math.sqrt(2 * (1 + RHO / n) * Math.log(Math.sqrt(1 + n / RHO) / (2 * a) + 1));
const TOL = 6e-5;
const [OUT, ...decks] = process.argv.slice(2);
if (!OUT || !decks.length) {
  console.error('usage: npx tsx p4-record-check.ts OUT deck...');
  process.exit(2);
}
let checked = 0;
let bad = 0;
for (const deck of decks) {
  const dir = path.join(OUT, deck, 'shortlist-settled');
  const led = readLedgerDir(path.join(dir, 'ledger'));
  // held-out games per change label, in file order, each game once (seed + opponent + first)
  const held = new Map<string, { id: string; d: number }[]>();
  const screened = new Map<string, Set<string>>();
  let heldBatches = 0;
  for (const f of led.files)
    for (const b of f.batches) {
      const label = b.batch.label;
      const games = b.batch.games as unknown as { seed: number; opp: string; first: number; base: number; cand: number }[];
      if (b.batch.kind === 'screen') {
        const s = screened.get(label) ?? new Set<string>();
        for (const g of games) s.add(`${g.seed}|${g.opp}|${g.first}`);
        screened.set(label, s);
        continue;
      }
      heldBatches++;
      const list = held.get(label) ?? [];
      const seen = new Set(list.map((x) => x.id));
      for (const g of games) {
        const id = `${g.seed}|${g.opp}|${g.first}`;
        if (seen.has(id)) continue;
        seen.add(id);
        list.push({ id, d: g.cand - g.base });
      }
      held.set(label, list);
    }
  let both = 0;
  for (const [label, list] of held) {
    const s = screened.get(label);
    if (s) for (const g of list) if (s.has(g.id)) both++;
  }
  console.log(`\n${deck}: ${heldBatches} held-out batches, ${[...held.values()].reduce((a, l) => a + l.length, 0).toLocaleString('en-US')} held-out games over ${held.size} changes; held-out games that had screened the same change: ${both}`);
  if (both) bad++;
  const runs = fs.readdirSync(dir).filter((f) => /^run-\d+$/.test(f)).map((f) => +f.slice(4)).sort((a, b) => a - b);
  for (const seed of runs) {
    const j = JSON.parse(fs.readFileSync(path.join(dir, `run-${seed}`, 'forge', `${deck}.json`), 'utf8'));
    const n = (j.gens[0].nominees || [])[0];
    if (!n?.heldOut) continue;
    const pooled = !!n.heldOut.priorGames || (n.settle?.stages ?? 0) > 0;
    const list = held.get(n.label) ?? [];
    const ds = list.slice(0, n.heldOut.games).map((x) => x.d);
    if (ds.length !== n.heldOut.games) {
      console.log(`  run ${seed} ${n.label}: the ledger holds ${list.length} held-out games, the run reports ${n.heldOut.games}  <-- MISMATCH`);
      bad++;
      continue;
    }
    const sum = ds.reduce((a, b) => a + b, 0);
    const sq = ds.reduce((a, b) => a + b * b, 0);
    const mean = sum / ds.length;
    checked++;
    if (!pooled) {
      const ok = Math.abs(mean - n.heldOut.mean) < TOL;
      if (!ok) bad++;
      console.log(`  run ${seed} first confirmation, ${ds.length} games: mean ${(mean * 100).toFixed(2)}; reported ${(n.heldOut.mean * 100).toFixed(2)} ${ok ? 'ok' : '<-- MISMATCH'}`);
      continue;
    }
    // the guarded spread: two pseudo-games, +1 and −1
    const nn = ds.length + 2;
    const sd = Math.sqrt(Math.max(0, (sq + 2 - nn * (sum / nn) ** 2) / (nn - 1)));
    const z = zStrict(ds.length, 0.05 / 2);
    const lower = mean - z * (sd / Math.sqrt(ds.length));
    const upper = mean + z * (sd / Math.sqrt(ds.length));
    const verdict = lower > 0.01 && ds.length >= 200 ? 'adopt' : upper < 0.01 ? 'reject' : 'inconclusive';
    const ok = Math.abs(mean - n.heldOut.mean) < TOL && Math.abs(lower - n.heldOut.lower) < TOL && Math.abs(upper - n.heldOut.upper) < TOL && Math.abs(z - n.heldOut.z) < TOL && verdict === n.outcome;
    if (!ok) bad++;
    const from = `${n.heldOut.priorGames ? `, ${n.heldOut.priorGames} from earlier runs` : ''}${n.settle ? `, ${n.settle.stages} further stage${n.settle.stages === 1 ? '' : 's'} (ended ${n.settle.ended})` : ''}`;
    console.log(
      `  run ${seed} pooled, ${ds.length} games${from}: here ${(mean * 100).toFixed(2)} [${(lower * 100).toFixed(2)}, ${(upper * 100).toFixed(2)}] z ${z.toFixed(3)} ${verdict}; reported ${(n.heldOut.mean * 100).toFixed(2)} [${(n.heldOut.lower * 100).toFixed(2)}, ${(n.heldOut.upper * 100).toFixed(2)}] z ${n.heldOut.z.toFixed(3)} ${n.outcome} ${ok ? 'ok' : '<-- MISMATCH'}`,
    );
  }
}
console.log(bad ? `\nFAILED: ${bad} problem(s) in ${checked} figures` : `\nAll ${checked} reported figures match the ledger files.`);
process.exit(bad ? 1 : 0);
