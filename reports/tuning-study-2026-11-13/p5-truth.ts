// What are the changes the P5 validation runs nominated really worth? Every distinct nominee of the today and shortlist
// ways (OUT/analysis.json, written by p5-validate-analyze.cjs) is played on 2,800 fresh paired games (Medium, the 7 meta
// decks, the forge's layout, seeds from 5,000,000 that no run used), and OUT/truth-<deck>.json keeps the plain 95%
// interval of each.
//
//   THREADS=12 npx tsx reports/tuning-study-2026-11-13/p5-truth.ts OUT <deck> [games]     (from the repository root)
import fs from 'node:fs';
import path from 'node:path';
import { loadLibrary, resolveDeck, runJobs } from '../../scripts/lib-node';
import { readLedgerDir } from '../../scripts/ledger-store';
import type { MatchJob } from '../../scripts/worker';
import type { DeckList } from '../../src/engine/types';
import { pairedInterval, scoreOf } from '../../src/lib/evidence';
import { rebuildSwap } from '../../src/lib/shortlist';

const OUT = process.argv[2];
const deckName = process.argv[3];
if (!OUT || !deckName) {
  console.error('usage: npx tsx p5-truth.ts OUT <deck> [games]');
  process.exit(2);
}
const N = Number(process.argv[4] ?? 2800);
const THREADS = Number(process.env.THREADS ?? 12);
const lib = loadLibrary();
const meta = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
const base = resolveDeck(deckName, lib).deck;
const analysis = JSON.parse(fs.readFileSync(path.join(OUT, 'analysis.json'), 'utf8'))[deckName] as Record<string, { nominees: string[] } | undefined>;
const WAYS = ['today', 'shortlist', 'shortlist-reach4500'];
// label -> change key, from the ledgers of the ways that kept one (every screened change is in them)
const keyOf = new Map<string, string>();
for (const way of ['ledger', 'shortlist', 'shortlist-reach4500'])
  for (const f of readLedgerDir(path.join(OUT, deckName, way, 'ledger')).files) for (const b of f.batches) if (!keyOf.has(b.batch.label)) keyOf.set(b.batch.label, b.batch.entry.change);
const labels = [...new Set(WAYS.flatMap((w) => analysis[w]?.nominees ?? []))];

void (async () => {
  const lists: { label: string; deck: DeckList }[] = [];
  for (const label of labels) {
    const key = keyOf.get(label);
    const d = key ? rebuildSwap(base, key) : null;
    if (!d) console.log(`could not rebuild ${label}`);
    else lists.push({ label, deck: d });
  }
  const SEED = 5_000_000;
  const all = [base, ...lists.map((l) => l.deck)];
  const jobs: MatchJob[] = all.flatMap((d) => Array.from({ length: N }, (_, k) => ({ a: d, b: meta[k % meta.length]!, seed: SEED + k, first: (Math.floor(k / meta.length) % 2) as 0 | 1, bot: 'medium' })));
  const res = await runJobs(jobs, { threads: THREADS });
  const scores = all.map((_, i) => res.slice(i * N, (i + 1) * N).map((r) => scoreOf(r.winner)));
  const out = lists.map((l, i) => {
    const iv = pairedInterval(scores[i + 1]!, scores[0]!, 1.96);
    return { label: l.label, mean: iv.mean, lower: iv.lower, upper: iv.upper, games: iv.games };
  });
  fs.writeFileSync(path.join(OUT, `truth-${deckName}.json`), JSON.stringify(out, null, 1));
  console.log(`${deckName}: ${out.length} nominated changes measured on ${N} fresh paired games each`);
  process.exit(0);
})();
