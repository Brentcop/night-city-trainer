// Power ratings: a Bradley–Terry model (with a going-first term) fitted to every game of every tournament event.
//
//   npx tsx scripts/ratings.ts
//
// P(A beats B | A on the play) = σ(rA − rB + h·[A first] − h·[B first]); ties count half a win for each side.
// A weak Gaussian prior (sd 1) keeps decks with few games near average. Standard errors come from the inverse of
// the (diagonal) Fisher information; 90% intervals are ±1.645 SE. Each deck also gets:
//   • expected win rate vs the whole field (average over every other deck) and vs the choom.gg meta archetypes;
//   • tournament results: events played, titles, top-8s, average Swiss finish percentile, match record.
// Output: src/data/ratings.json (site) and reports/ratings-latest.md.
import fs from 'node:fs';
import { cli, loadLibrary, readEvents, writeJsonStamped } from './lib-node';

cli(import.meta.url, {});

const σ = (x: number) => 1 / (1 + Math.exp(-x));
const lib = loadLibrary();
const metaNames = new Set(lib.filter((d) => d.kind === 'meta').map((d) => d.deck.name));

interface G {
  a: string;
  b: string;
  first: 0 | 1;
  s: number; // score for a: 1, 0.5, 0
}
const games: G[] = [];
const results: Record<string, { events: number; titles: number; top8: number; finishes: number[]; mw: number; ml: number; gw: number; gl: number }> = {};
const events = readEvents();
for (const e of events) {
  const n = e.standings.length;
  e.standings.forEach((s: any, i: number) => {
    const r = (results[s.deck] ??= { events: 0, titles: 0, top8: 0, finishes: [], mw: 0, ml: 0, gw: 0, gl: 0 });
    r.events++;
    r.finishes.push(1 - i / Math.max(1, n - 1));
    if (i < 8) r.top8++;
    r.mw += s.mw;
    r.ml += s.ml;
    r.gw += s.gw;
    r.gl += s.gl;
  });
  if (results[e.champion]) results[e.champion].titles++;
  for (const part of [...e.rounds, ...e.bracket])
    for (const m of part.matches) {
      if (!m.b) continue;
      for (const g of m.games) games.push({ a: m.a, b: m.b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 });
    }
}
if (!games.length) {
  console.log('No tournament games yet (run scripts/tournament.ts).');
  process.exit(0);
}

const names = [...new Set(games.flatMap((g) => [g.a, g.b]))];
const idx = new Map(names.map((n, i) => [n, i]));
const r = new Float64Array(names.length);
let h = 0;
const PRIOR = 1; // sd of the prior on ratings
for (let it = 0; it < 400; it++) {
  const grad = new Float64Array(names.length);
  const hess = new Float64Array(names.length);
  let gh = 0;
  let hh = 0;
  for (const g of games) {
    const i = idx.get(g.a)!;
    const j = idx.get(g.b)!;
    const adv = g.first === 0 ? h : -h;
    const p = σ(r[i] - r[j] + adv);
    const d = g.s - p;
    const w = p * (1 - p);
    grad[i] += d;
    grad[j] -= d;
    hess[i] += w;
    hess[j] += w;
    gh += g.first === 0 ? d : -d;
    hh += w;
  }
  let maxStep = 0;
  for (let k = 0; k < names.length; k++) {
    const step = (grad[k] - r[k] / PRIOR ** 2) / (hess[k] + 1 / PRIOR ** 2);
    r[k] += step;
    maxStep = Math.max(maxStep, Math.abs(step));
  }
  h += gh / Math.max(1e-9, hh);
  // centre ratings
  const mean = r.reduce((a, x) => a + x, 0) / r.length;
  for (let k = 0; k < r.length; k++) r[k] -= mean;
  if (maxStep < 1e-7) break;
}
// standard errors from the diagonal information at the optimum
const info = new Float64Array(names.length).fill(1 / PRIOR ** 2);
const played = new Float64Array(names.length);
for (const g of games) {
  const i = idx.get(g.a)!;
  const j = idx.get(g.b)!;
  const p = σ(r[i] - r[j] + (g.first === 0 ? h : -h));
  info[i] += p * (1 - p);
  info[j] += p * (1 - p);
  played[i]++;
  played[j]++;
}
const expVs = (k: number, rk: number, pool: number[]) => pool.filter((j) => j !== k).reduce((a, j) => a + σ(rk - r[j]), 0) / Math.max(1, pool.filter((j) => j !== k).length);
const all = names.map((_, k) => k);
const metaIdx = names.map((n, k) => (metaNames.has(n) ? k : -1)).filter((k) => k >= 0);
const rows = names
  .map((n, k) => {
    const se = Math.sqrt(1 / info[k]);
    const L = lib.find((d) => d.deck.name === n);
    const res = results[n];
    return {
      name: n,
      file: L?.file ?? '',
      origin: L?.prov.origin ?? '',
      rating: r[k],
      se,
      games: played[k],
      wrField: expVs(k, r[k], all),
      wrFieldLo: expVs(k, r[k] - 1.645 * se, all),
      wrFieldHi: expVs(k, r[k] + 1.645 * se, all),
      wrMeta: metaIdx.length ? expVs(k, r[k], metaIdx) : null,
      events: res?.events ?? 0,
      titles: res?.titles ?? 0,
      top8: res?.top8 ?? 0,
      avgFinish: res ? res.finishes.reduce((a, x) => a + x, 0) / res.finishes.length : null,
      matches: res ? `${res.mw}-${res.ml}` : '',
      gamesRecord: res ? `${res.gw}-${res.gl}` : '',
    };
  })
  .sort((a, b) => b.rating - a.rating);
const out = { updated: '', events: events.length, games: games.length, firstPlayerEdge: σ(h) - 0.5, decks: rows };
writeJsonStamped('src/data/ratings.json', out, { indent: 1 });
const pct = (x: number | null) => (x === null ? '—' : `${(x * 100).toFixed(1)}%`);
const md = [
  `# Power ratings (${events.length} events, ${games.length} games)`,
  '',
  `Bradley–Terry fit over every tournament game. Going first adds ${(100 * (σ(h) - 0.5)).toFixed(1)} points of win probability.`,
  '',
  '| # | Deck | Exp. win % vs field (90% CI) | vs meta | Titles | Top 8 | Avg finish | Matches | Games |',
  '|---|---|---|---|---|---|---|---|---|',
  ...rows.map((x, i) => `| ${i + 1} | ${x.name} | ${pct(x.wrField)} (${pct(x.wrFieldLo)}–${pct(x.wrFieldHi)}) | ${pct(x.wrMeta)} | ${x.titles} | ${x.top8}/${x.events} | ${x.avgFinish === null ? '—' : Math.round(x.avgFinish * 100) + 'th pct'} | ${x.matches} | ${x.games} |`),
].join('\n');
fs.writeFileSync('reports/ratings-latest.md', md);
console.log(md.split('\n').slice(0, 25).join('\n'));
