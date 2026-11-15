// P1 (the change ledger) validated on real games, 2026-11-14, SIM_VERSION 9 (docs/SYNERGIES.md "Pooling held-out games
// across runs"): six changes the study measured as real are confirmed again and again, each run on fresh seeds
// (Medium, the 7 meta decks, the forge's layout, stages of 224 up to 896 a run), with an in-memory ledger pooling the
// held-out games by the strict rule. For comparison the same games are judged by (a) the plan's rule (z 2.01 at every
// pooled look) and (b) no ledger (each run's own games, the staged rule).
//
//   THREADS=12 npx tsx reports/tuning-study-2026-11-13/p1-validate.ts [runs] [only,ids]     (from the repository root)
//
// Output of the recorded run (10 runs at most, 68,096 games): p1-validate.txt and p1-validate.json. Unlike the other
// scripts in this folder it imports the repository by relative paths, so it runs in place.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLibrary, resolveDeck, runJobs } from '../../scripts/lib-node';
import { cliGameCache } from '../../scripts/game-cache';
import { blockSlots, scored } from '../../scripts/ledger-store';
import type { MatchJob } from '../../scripts/worker';
import { listFingerprint, parseDeck } from '../../src/engine/deck';
import type { DeckList } from '../../src/engine/types';
import { ADOPTION_DEFAULTS, confirmStaged, lookZs, pairedInterval, scoreOf, type Confirmation } from '../../src/lib/evidence';
import { addBatch, changeKey, entryKey, fieldFingerprint, gameIds, priorOf, type EntryId, type LedgerEntry, type LedgerGame } from '../../src/lib/changeLedger';
import { SIM_VERSION } from '../../src/lib/tournament';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const THREADS = Number(process.env.THREADS ?? 12);
const cache = cliGameCache(!process.env.NOCACHE);
const lib = loadLibrary();
const meta = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
const deck = (q: string): DeckList => resolveDeck(q, lib).deck;
const deckFile = (p: string): DeckList => parseDeck(fs.readFileSync(p, 'utf8'), p).deck;

/** games k = 0..n-1: opponent field[k % F], first = floor(k / F) % 2, seed seed0 + k (the forge's layout); scores per list */
async function playLists(lists: DeckList[], field: DeckList[], seed0: number, n: number, bot: string): Promise<number[][]> {
  const jobs: MatchJob[] = lists.flatMap((d) => Array.from({ length: n }, (_, k) => ({ a: d, b: field[k % field.length]!, seed: seed0 + k, first: (Math.floor(k / field.length) % 2) as 0 | 1, bot })));
  const res = await runJobs(jobs, { threads: THREADS, cache });
  return lists.map((_, i) => res.slice(i * n, (i + 1) * n).map((r) => scoreOf(r.winner)));
}

// My own implementation of the pooled interval, written from the rule and independent of src/lib/evidence.ts, to
// cross-check every pooled look: z(n) = sqrt(2 (1 + rho/n) ln(sqrt(1 + n/rho) / (2a) + 1)), rho 250; the spread from the
// sample variance with two pseudo-games (+1 and -1) added; clipped to [-1, 1].
function myPooledInterval(pairs: number[][], a: number) {
  const n = pairs.length;
  let sum = 0;
  let sq = 0;
  for (const [b, c] of pairs) {
    const d = c! - b!;
    sum += d;
    sq += d * d;
  }
  const mean = sum / n;
  const z = Math.sqrt(2 * (1 + 250 / n) * Math.log(Math.sqrt(1 + n / 250) / (2 * a) + 1));
  const nn = n + 2;
  const v = Math.max(0, (sq + 2 - nn * (sum / nn) ** 2) / (nn - 1));
  const margin = z * Math.sqrt(v / n);
  return { games: n, mean, lower: Math.max(-1, mean - margin), upper: Math.min(1, mean + margin), z };
}

const H = 'data/decks/custom/history/';
const swap = (d: DeckList, cut: string, add: string): DeckList => {
  const main = [...d.main];
  const i = main.indexOf(cut);
  if (i < 0) throw new Error('no ' + cut);
  main.splice(i, 1, add);
  return { ...d, main };
};
const RUNS = Number(process.argv[2] ?? 10);
const only = process.argv[3]?.split(',');
const STAGE = 224;
const RULE = ADOPTION_DEFAULTS;
const BOT = 'medium';
const OPP = meta.map((d) => listFingerprint(d));
const changes: { id: string; label: string; v8: string; before: DeckList; after: DeckList }[] = [
  { id: 's2-05', label: 'S2-05 -1 We Gotta Live Together +1 Yorinobu: Steel Dragon', v8: '+2.3 [+1.4, +3.1] (2,800 games)', before: deck('s2-05-counter-rrg'), after: swap(deck('s2-05-counter-rrg'), 'we_gotta_live_together', 'yorinobu_arasaka_steel_dragon') },
  { id: 'lad-padre', label: 'Ladder RRG Padre -1 Field Operator +1 MaxTac AV', v8: '+4.2 [+2.9, +5.5]', before: deckFile(H + 'ladder-rrg-v-smasher-padre-2026-11-10.txt'), after: deck('ladder-rrg-v-smasher-padre') },
  { id: 'lad-bbg', label: 'Ladder BBG -1 Peace Offering +1 MaxTac AV', v8: '+3.9 [+2.5, +5.4]', before: deckFile(H + 'ladder-bbg-jackie-alt-hanako-2026-11-10.txt'), after: deck('ladder-bbg-jackie-alt-hanako') },
  { id: 'lad-ryy', label: 'Ladder RYY -1 Alt: Mother of Daemons +1 Gorilla Arms', v8: '+2.1 [+0.9, +3.3]', before: deckFile(H + 'ladder-ryy-smasher-river-viktor-2026-11-10.txt'), after: deck('ladder-ryy-smasher-river-viktor') },
  { id: 'lad-rrb', label: 'Ladder RRB -1 Shattered Memories +1 Yorinobu: Steel Dragon', v8: '+1.7 [+0.4, +2.9]', before: deckFile(H + 'ladder-rrb-dexter-v-wakako-2026-11-10.txt'), after: deck('ladder-rrb-dexter-v-wakako') },
  { id: 's2-06', label: 'S2-06 -1 Shattered Memories +1 6th Street Recruits', v8: '+1.9 [+0.2, +3.6]', before: deckFile(H + 's2-06-counter-rgg-2026-11-12.txt'), after: deck('s2-06-counter-rgg') },
];
const pp = (x: number) => `${x >= 0 ? '+' : ''}${(x * 100).toFixed(1)}`;
const fmt = (iv: { mean: number; lower: number; upper: number; games: number }) => `${pp(iv.mean)} [${pp(iv.lower)}, ${pp(iv.upper)}] ${iv.games}g`;

(async () => {
  const out: unknown[] = [];
  for (const [index, c] of changes.entries()) {
    if (only && !only.includes(c.id)) continue;
    const ci = index + 1;
    const id: EntryId = { change: changeKey(c.before, c.after), simVersion: SIM_VERSION, bot: BOT, field: fieldFingerprint(OPP) };
    const entries = new Map<string, LedgerEntry>();
    console.log(`\n=== ${c.label}   (study, Medium v8: ${c.v8})\n    key ${id.change}`);
    const rows: unknown[] = [];
    let strictDone = '';
    let planDone = '';
    let noLedgerDone = '';
    // the plan's rule: every pooled look after run 1 at the last staged z (2.014)
    const zLast = lookZs(RULE, 1)[RULE.capStages - 1]!;
    const allBase: number[] = [];
    const allCand: number[] = [];
    let played = 0;
    for (let run = 1; run <= RUNS; run++) {
      const seed1 = 3_000_000 + ci * 200_000 + run * 10_000;
      const planned = gameIds(Array.from({ length: RULE.capStages }, (_, s) => blockSlots(seed1 + s * STAGE, STAGE, OPP)).flat());
      const prior = priorOf(entries.get(entryKey(id)), planned);
      const runBase: number[] = [];
      const runCand: number[] = [];
      let planLine = '';
      const conf = await confirmStaged(
        RULE,
        [{ minGainPp: RULE.minGainPp }],
        STAGE,
        async ({ offset, games }) => {
          const [cand, base] = (await playLists([c.after, c.before], meta, seed1 + offset, games, BOT)) as [number[], number[]];
          played += games * 2;
          const g: LedgerGame[] = scored(blockSlots(seed1 + offset, games, OPP), base, cand);
          addBatch(entries, { entry: id, kind: 'heldout', label: c.label, run: `run ${run}`, date: '2026-11-14', games: g });
          runBase.push(...base);
          runCand.push(...cand);
          allBase.push(...base);
          allCand.push(...cand);
          if (!planDone && run > 1) {
            const iv = pairedInterval(allCand, allBase, zLast);
            if (iv.lower > 0.01 && iv.games >= RULE.minGames) planDone = `adopt in run ${run} at ${iv.games} games (${fmt(iv)})`;
            else if (iv.upper < 0.01) planDone = `reject in run ${run} at ${iv.games} games (${fmt(iv)})`;
            planLine = fmt(iv);
          }
          return { base, nominees: [cand] };
        },
        undefined,
        strictDone ? undefined : [prior],
      );
      const r: Confirmation = conf.results[0]!;
      // no ledger: this run's own games under the staged rule, look by look
      let own = 'could not tell';
      const zs = lookZs(RULE, 1);
      for (let k = 1; k * STAGE <= runBase.length; k++) {
        const iv = pairedInterval(runCand.slice(0, k * STAGE), runBase.slice(0, k * STAGE), zs[k - 1]!);
        if (iv.lower > 0.01 && iv.games >= RULE.minGames) {
          own = `ADOPT at look ${k} (${fmt(iv)})`;
          break;
        }
        if (iv.upper < 0.01) {
          own = `reject at look ${k} (${fmt(iv)})`;
          break;
        }
        if (k >= 2 && k < RULE.capStages && iv.mean <= 0) {
          own = `could not tell (futility at look ${k}, ${fmt(iv)})`;
          break;
        }
        if (k === RULE.capStages) own = `could not tell (${fmt(iv)})`;
      }
      if (!noLedgerDone && own.startsWith('ADOPT')) noLedgerDone = `adopt in run ${run} on its own ${runBase.length} games`;
      let check = '';
      if (r.priorGames) {
        const e = entries.get(entryKey(id))!;
        const m = myPooledInterval(e.heldout.map((g) => [g.base, g.cand]), RULE.alpha / 2);
        const ok = Math.abs(m.lower - r.heldOut.lower) < 1e-12 && Math.abs(m.upper - r.heldOut.upper) < 1e-12 && m.games === r.heldOut.games;
        check = ok ? ' [my check: same]' : ` [MY CHECK DIFFERS: ${fmt(m)}]`;
      }
      const word = r.outcome === 'adopt' ? 'ADOPT' : r.outcome === 'reject' ? 'REJECT' : `could not tell${r.stopped ? ' (futility)' : ''}`;
      console.log(`  run ${String(run).padStart(2)}: strict ${word.padEnd(28)} ${fmt(r.heldOut)} z ${r.heldOut.z.toFixed(2)} looks ${r.looks}${r.priorGames ? ` prior ${r.priorGames}` : ' (first confirmation, staged rule)'}${check}   | this run alone: ${own}${planLine ? `   | plan's rule pooled: ${planLine}` : ''}`);
      rows.push({ run, outcome: r.outcome, stopped: r.stopped ?? null, looks: r.looks, priorGames: r.priorGames ?? 0, heldOut: r.heldOut, own });
      if (!strictDone && (r.outcome === 'adopt' || r.outcome === 'reject')) strictDone = `${r.outcome} in run ${run} at ${r.heldOut.games} pooled games (${fmt(r.heldOut)})`;
      if (strictDone && (planDone || run >= 3)) break;
    }
    const e = entries.get(entryKey(id))!;
    const all = pairedInterval(allCand, allBase, 1.96);
    console.log(`  -> strict: ${strictDone || `undecided after ${e.heldout.length} pooled games`}`);
    console.log(`  -> the plan's rule: ${planDone || 'undecided'}   | no ledger: ${noLedgerDone || 'never adopted in a single run'}`);
    console.log(`  -> all ${all.games} paired games, plain 95%: ${fmt(all)}   (ledger holds ${e.heldout.length}, conflicts ${e.conflicts.heldout}; games played ${played})`);
    out.push({ id: c.id, label: c.label, v8: c.v8, strict: strictDone, plan: planDone, noLedger: noLedgerDone, all, rows });
  }
  // a full run writes the record; a partial one (fewer runs, or only some changes) leaves it alone
  if (!only && RUNS >= 10) fs.writeFileSync(path.join(HERE, 'p1-validate.json'), JSON.stringify(out, null, 1));
  process.exit(0);
})();
