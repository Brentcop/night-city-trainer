// E2: re-measure recorded forge changes (and one "could not tell") on a large fresh paired sample, under SIM v8.
import fs from 'node:fs';
import { playLists, meta, deck, deckFile, paired, pp, mean, type G } from './harness';
import type { DeckList } from 'E:/OTHJ/CyberpunkTCG/src/engine/types';
const H = 'E:/OTHJ/CyberpunkTCG/data/decks/custom/history/';
const swap = (d: DeckList, cut: string, add: string): DeckList => { const main = [...d.main]; const i = main.indexOf(cut); if (i < 0) throw new Error('no ' + cut); main.splice(i, 1, add); return { ...d, main }; };
const BOT = process.env.BOT ?? 'lookahead';
const N = Number(process.env.N ?? 2800);
const SEED = Number(process.env.SEED ?? 2_000_000);
const only = process.env.ONLY?.split(',');
const changes: { id: string; label: string; record: string; before: DeckList; after: DeckList }[] = [
  { id: 's2-03', label: 'S2-03 package swap Gear on Units -> Arasaka Units (8 cards)', record: 'Medium v5 held-out +15.6 [+6.9,+24.4] 224g, screen +23.2', before: deckFile(H + 's2-03-cross-rgy-2026-11-12.txt'), after: deck('s2-03-cross-rgy') },
  { id: 's2-04', label: 'S2-04 package swap Ahead -> Even Street Cred (2 cards)', record: 'Medium v5 held-out +8.9 [+2.8,+15.1] 224g, screen +8.9', before: deckFile(H + 's2-04-cross-rrg-2026-11-12.txt'), after: deck('s2-04-cross-rrg') },
  { id: 's2-06', label: 'S2-06 -1 Shattered Memories +1 6th Street Recruits', record: 'Medium v5 held-out +4.5 [+1.2,+7.8] 448g, screen +4.5', before: deckFile(H + 's2-06-counter-rgg-2026-11-12.txt'), after: deck('s2-06-counter-rgg') },
  { id: 's2-05', label: 'S2-05 -1 We Gotta Live Together +1 Yorinobu: Steel Dragon (not adopted)', record: 'Medium v5 could not tell +1.5 [-0.3,+3.2] 896g, screen +5.4', before: deck('s2-05-counter-rrg'), after: swap(deck('s2-05-counter-rrg'), 'we_gotta_live_together', 'yorinobu_arasaka_steel_dragon') },
  { id: 'lad-bbg', label: 'Ladder BBG -1 Peace Offering +1 MaxTac AV', record: 'forged 2026-11-10 (any-gain era, no held-out figure)', before: deckFile(H + 'ladder-bbg-jackie-alt-hanako-2026-11-10.txt'), after: deck('ladder-bbg-jackie-alt-hanako') },
  { id: 'lad-rrb', label: 'Ladder RRB -1 Shattered Memories +1 Yorinobu: Steel Dragon', record: 'forged 2026-11-10 (any-gain era)', before: deckFile(H + 'ladder-rrb-dexter-v-wakako-2026-11-10.txt'), after: deck('ladder-rrb-dexter-v-wakako') },
  { id: 'lad-padre', label: 'Ladder RRG Padre -1 Field Operator +1 MaxTac AV', record: 'forged 2026-11-10 (any-gain era)', before: deckFile(H + 'ladder-rrg-v-smasher-padre-2026-11-10.txt'), after: deck('ladder-rrg-v-smasher-padre') },
  { id: 'lad-ryy', label: 'Ladder RYY -1 Alt: Mother of Daemons +1 Gorilla Arms', record: 'forged 2026-11-10 (any-gain era)', before: deckFile(H + 'ladder-ryy-smasher-river-viktor-2026-11-10.txt'), after: deck('ladder-ryy-smasher-river-viktor') },
];
(async () => {
  const out: any[] = [];
  for (const c of changes.filter((c) => !only || only.includes(c.id))) {
    const t0 = Date.now();
    const [a, b] = await playLists([c.after, c.before], meta, SEED, N, BOT);
    const all = paired(a!, b!);
    const byOpp = meta.map((o) => { const ia = a!.filter((g) => g.opp === o.name); const ib = b!.filter((g) => g.opp === o.name); const p = paired(ia, ib); return { opp: o.name, n: p.n, mean: p.mean, se: p.se, base: mean(ib.map((g) => g.score)) }; });
    const bySeat = [0, 1].map((f) => { const ia = a!.filter((g) => g.first === f); const ib = b!.filter((g) => g.first === f); const p = paired(ia, ib); return { first: f, n: p.n, mean: p.mean, se: p.se }; });
    const blocks: number[] = []; for (let s = 0; s + 224 <= N; s += 224) blocks.push(paired(a!.slice(s, s + 224), b!.slice(s, s + 224)).mean);
    // heterogeneity across opponents: chi-square of per-opponent means around the pooled mean
    const chi = byOpp.reduce((t, o) => t + ((o.mean - all.mean) / (o.se || 1e9)) ** 2, 0);
    const r = { id: c.id, label: c.label, record: c.record, bot: BOT, n: all.n, mean: all.mean, se: all.se, sd: all.sd, same: all.same, baseWr: mean(b!.map((g) => g.score)), afterWr: mean(a!.map((g) => g.score)), byOpp, bySeat, blocks224: blocks, chiOpp: chi, secs: (Date.now() - t0) / 1000 };
    out.push(r);
    console.log(`\n${c.label} [${BOT}, ${all.n} paired games, ${r.secs}s]  record: ${c.record}`);
    console.log(`  pooled ${pp(all.mean)} pts [${pp(all.mean - 1.96 * all.se)}, ${pp(all.mean + 1.96 * all.se)}]  sd(diff) ${all.sd.toFixed(3)}  identical games ${(all.same * 100).toFixed(0)}%  base ${pp(r.baseWr)}% -> ${pp(r.afterWr)}%`);
    console.log('  by opponent: ' + byOpp.map((o) => `${o.opp.split(' ').slice(0, 2).join(' ')} ${pp(o.mean)}±${pp(1.96 * o.se)} (base ${pp(o.base)})`).join(' | '));
    console.log(`  heterogeneity chi2(6) = ${chi.toFixed(1)} (5% crit 12.6)`);
    console.log('  by seat: ' + bySeat.map((s) => `${s.first ? 'second' : 'first'} ${pp(s.mean)}±${pp(1.96 * s.se)}`).join(' | '));
    console.log(`  224-game blocks: ${blocks.map(pp).join(' ')}  (sd ${pp(Math.sqrt(blocks.reduce((t, x) => t + (x - mean(blocks)) ** 2, 0) / (blocks.length - 1)))})`);
  }
  fs.writeFileSync(`${__dirname}/e2-${BOT}-${only?.join('_') ?? 'all'}.json`, JSON.stringify(out, null, 1));
  process.exit(0);
})();
