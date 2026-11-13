// E3: every distinct candidate the forge screened across E1's seeds, measured on one large fresh paired block.
// Tells (a) how big real single-card / package changes are, (b) whether a 112-game screen predicts them.
import fs from 'node:fs';
import path from 'node:path';
import { playLists, meta, deck, deckFile, paired, pp } from './harness';
import type { DeckList } from 'E:/OTHJ/CyberpunkTCG/src/engine/types';
import { CARDS, cardLabel } from 'E:/OTHJ/CyberpunkTCG/src/engine/cards';
const N = Number(process.env.N ?? 1120);
const SEED = Number(process.env.SEED ?? 3_000_000);
const E1 = path.join(__dirname, 'e1');
(async () => {
  const out: any[] = [];
  for (const target of ['s2-05-counter-rrg', 's2-08-explorer-ggy']) {
    const base = deck(target);
    // the forge JSON does not hold the candidate lists, so rebuild them from labels: parse "−1 X → +1 Y" and package lines
    const cands = new Map<string, { label: string; screens: { run: string; delta: number }[] }>();
    for (const run of fs.readdirSync(E1).filter((d) => (d.includes(target) || (target.startsWith('s2-08') && d.startsWith('quick-s2-08'))) && fs.statSync(path.join(E1, d)).isDirectory())) {
      const fd = path.join(E1, run, 'forge');
      for (const f of fs.readdirSync(fd).filter((f) => f.endsWith('.json') && f !== 'summary.json')) {
        const j = JSON.parse(fs.readFileSync(path.join(fd, f), 'utf8'));
        for (const g of j.gens) for (const s of g.swaps) (cands.get(s.swap) ?? cands.set(s.swap, { label: s.swap, screens: [] }).get(s.swap)!).screens.push({ run, delta: s.delta });
      }
    }

    const idOf = (name: string) => { const c = CARDS.find((c: any) => cardLabel(c) === name.trim()); if (!c) throw new Error('card ' + name); return c.id; };
    const build = (label: string): DeckList | null => {
      const m = label.match(/^[-−]1 (.+) → \+1 (.+)$/);
      if (m) { const main = [...base.main]; const i = main.indexOf(idOf(m[1]!)); if (i < 0) return null; main.splice(i, 1, idOf(m[2]!)); return { ...base, main }; }
      const p = label.match(/: (.+?) \/ (.+)$/); // package move "...: +3 A, +2 B / -2 C, -1 D"
      if (p) {
        const main = [...base.main];
        const adds = p[1]!.split(/, (?=\+)/).map((x) => x.match(/^\+(\d+) (.+)$/)!).map((x) => [Number(x[1]), idOf(x[2]!)] as const);
        const cuts = p[2]!.split(/, (?=-)/).map((x) => x.match(/^-(\d+) (.+)$/)!).map((x) => [Number(x[1]), idOf(x[2]!)] as const);
        for (const [k, id] of cuts) for (let i = 0; i < k; i++) { const at = main.indexOf(id); if (at < 0) return null; main.splice(at, 1); }
        for (const [k, id] of adds) for (let i = 0; i < k; i++) main.push(id);
        return { ...base, main };
      }
      return null;
    };
    const list = [...cands.values()].map((c) => ({ ...c, deck: build(c.label) })).filter((c) => c.deck);
    console.log(`\n${base.name}: ${cands.size} distinct candidates, ${list.length} rebuilt; ${N} paired games each`);
    const t0 = Date.now();
    const res = await playLists([base, ...list.map((c) => c.deck!)], meta, SEED, N, 'lookahead');
    for (const [i, c] of list.entries()) {
      const p = paired(res[i + 1]!, res[0]!);
      const r = { deck: base.name, label: c.label, pkg: !/^[-−]1 /.test(c.label), n: p.n, mean: p.mean, se: p.se, sd: p.sd, same: p.same, screens: c.screens };
      out.push(r);
      console.log(`  ${pp(p.mean).padStart(6)} ±${pp(1.96 * p.se)}  sd ${p.sd.toFixed(3)} same ${(p.same * 100).toFixed(0)}% | screened ${c.screens.map((s) => s.delta).join(', ')} | ${c.label.slice(0, 90)}`);
    }
    console.log(`  (${(Date.now() - t0) / 1000}s)`);
  }
  fs.writeFileSync(path.join(__dirname, 'e3-candidates.json'), JSON.stringify(out, null, 1));
  process.exit(0);
})();
