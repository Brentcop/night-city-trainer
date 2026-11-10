// Head-to-head records from every recorded tournament event, compacted for the website (public/data/h2h.json).
// The Deck Lab loads it lazily to breed "counter" decks. Rebuilt automatically after every tournament run
// (scripts/tournament.ts) and by `npm run refresh`; run directly with:  npx tsx scripts/build-h2h.ts
import fs from 'node:fs';

export interface H2HFile {
  updated: string;
  events: number;
  games: number;
  decks: string[];
  /** [i, j, wins of i vs j (ties = 0.5), games] for every pair that has met, i < j */
  pairs: [number, number, number, number][];
}

export function buildH2H(dir = 'data/tournaments', out = 'public/data/h2h.json'): H2HFile | null {
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => /^event-\d+\.json$/.test(f));
  const idx = new Map<string, number>();
  const id = (n: string) => (idx.has(n) ? idx.get(n)! : (idx.set(n, idx.size), idx.size - 1));
  const acc = new Map<string, { w: number; g: number }>();
  let games = 0;
  for (const f of files) {
    const e = JSON.parse(fs.readFileSync(`${dir}/${f}`, 'utf8'));
    for (const part of [...e.rounds, ...e.bracket])
      for (const m of part.matches) {
        if (!m.b) continue;
        const ia = id(m.a);
        const ib = id(m.b);
        for (const g of m.games) {
          const v = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0; // from m.a's side
          // store each pair once, lower index first
          const [lo, hi, w] = ia < ib ? [ia, ib, v] : [ib, ia, 1 - v];
          const k = `${lo}|${hi}`;
          const r = acc.get(k) ?? { w: 0, g: 0 };
          r.w += w;
          r.g++;
          acc.set(k, r);
          games++;
        }
      }
  }
  const data: H2HFile = {
    updated: new Date().toISOString(),
    events: files.length,
    games,
    decks: [...idx.keys()],
    pairs: [...acc.entries()].map(([k, r]) => {
      const [i, j] = k.split('|').map(Number);
      return [i, j, r.w, r.g];
    }),
  };
  fs.mkdirSync(out.replace(/\/[^/]+$/, ''), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(data));
  return data;
}

if (process.argv[1]?.endsWith('build-h2h.ts')) {
  const d = buildH2H();
  console.log(d ? `h2h: ${d.decks.length} decks, ${d.pairs.length} pairings, ${d.games} games from ${d.events} events → public/data/h2h.json` : 'no tournament data (data/tournaments) yet');
}
