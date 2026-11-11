// Head-to-head records from every recorded tournament event, compacted for the website (public/data/h2h.json).
// The Deck Lab loads it lazily to breed "counter" decks. Rebuilt automatically after every tournament run
// (scripts/tournament.ts) and by `npm run refresh`; run directly with:  npx tsx scripts/build-h2h.ts
// Events are read in id order and the file is only rewritten (and "updated" only moves) when the records change.
// The manifest names the input events (ids, sim versions, run ids) and is derived from them alone, so it never moves
// on its own either.
import fs from 'node:fs';
import { cli, eventFiles, EVENTS_DIR, forEachRecordedGame, readEvents, writeJsonStamped } from './lib-node';
import { aggregateManifest, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';

export interface H2HFile {
  updated: string;
  events: number;
  games: number;
  decks: string[];
  /** [i, j, wins of i vs j (ties = 0.5), games] for every pair that has met, i < j */
  pairs: [number, number, number, number][];
  /** absent in files built before manifests */
  manifest?: RunManifest;
}

export function buildH2H(dir = EVENTS_DIR, out = 'public/data/h2h.json'): H2HFile | null {
  if (!fs.existsSync(dir)) return null;
  const idx = new Map<string, number>();
  const id = (n: string) => (idx.has(n) ? idx.get(n)! : (idx.set(n, idx.size), idx.size - 1));
  const acc = new Map<string, { w: number; g: number }>();
  let games = 0;
  forEachRecordedGame(({ match: m, game: g }) => {
    const ia = id(m.a);
    const ib = id(m.b);
    const v = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0; // from m.a's side
    // store each pair once, lower index first
    const [lo, hi, w] = ia < ib ? [ia, ib, v] : [ib, ia, 1 - v];
    const k = `${lo}|${hi}`;
    const r = acc.get(k) ?? { w: 0, g: 0 };
    r.w += w;
    r.g++;
    acc.set(k, r);
    games++;
  }, dir);
  const data: H2HFile = {
    updated: '',
    events: eventFiles(dir).length,
    games,
    decks: [...idx.keys()],
    pairs: [...acc.entries()].map(([k, r]) => {
      const [i, j] = k.split('|').map(Number);
      return [i, j, r.w, r.g];
    }),
    manifest: aggregateManifest('h2h', readEvents(dir) as unknown as RecordedEventInput[], { games }),
  };
  writeJsonStamped(out, data as unknown as Record<string, unknown>);
  return JSON.parse(fs.readFileSync(out, 'utf8')) as H2HFile;
}

if (process.argv[1]?.endsWith('build-h2h.ts')) {
  cli(import.meta.url, {});
  const d = buildH2H();
  console.log(d ? `h2h: ${d.decks.length} decks, ${d.pairs.length} pairings, ${d.games} games from ${d.events} events → public/data/h2h.json` : `no tournament data (${EVENTS_DIR}) yet`);
}
