// Season runner: breed 8 new decks → tournament (telemetry round robin) → forge the new decks → finals vs meta →
// update the all-time leaderboard (pooled win rate vs the meta archetypes, with percentiles).
//
//   npx tsx scripts/season.ts --season 1 [--games 16] [--bot deep] [--finals 42] [--forge-gens 1]
//
// Outputs: data/decks/custom/s<N>-*.txt, reports/season-<N>.md, data/seasons/season-<N>.json,
//          data/seasons/leaderboard.json, src/data/seasons.json (site), data/seasons/impact.json.
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import { breedSeason } from '../src/ai/breeder';
import { exportOfficial, deckColors } from '../src/engine/deck';
import { analyzeAll, type DeckReport } from '../src/analysis/analyze';
import { classify } from '../src/ai/archetype';
import { loadLibrary } from './lib-node';
import { runJobs } from './simulate';
import type { MatchJob, MatchResult } from './worker';

const args = process.argv.slice(2);
const flag = (n: string, d: string) => {
  const i = args.indexOf(`--${n}`);
  return i >= 0 ? args[i + 1] : d;
};
const SEASON = +flag('season', '1');
const GAMES = +flag('games', '16');
const BOT = flag('bot', 'deep');
const FINALS = +flag('finals', '42');
const FORGE_GENS = +flag('forge-gens', '1');
const FORGE_GAMES = +flag('forge-games', '112');
const NL = String.fromCharCode(10);
fs.mkdirSync('data/seasons', { recursive: true });

// ---------------------------------------------------------------- leaderboard
interface Entry {
  name: string;
  file: string;
  kind: string;
  origin: string; // meta / guide / NC original / S<n> mutant|crossover|explorer / variant
  colors: string;
  arch: string;
  firstSeason: number;
  metaW: number; // wins (ties = 0.5) vs meta archetypes, pooled across seasons + finals
  metaG: number;
  seasons: Record<string, number>; // season -> round-robin win rate in that season
  finals?: number; // latest finals win rate vs meta
  idea?: string;
}
const LB_FILE = 'data/seasons/leaderboard.json';
const lib = loadLibrary();
const metaDecks = lib.filter((d) => d.kind === 'meta');
const metaNames = new Set(metaDecks.map((d) => d.deck.name));

function loadLB(): Record<string, Entry> {
  if (fs.existsSync(LB_FILE)) return JSON.parse(fs.readFileSync(LB_FILE, 'utf8'));
  // Season 0 seed: the 28-deck deep round robin (src/data/review.json) + finals reports
  const R = JSON.parse(fs.readFileSync('src/data/review.json', 'utf8'));
  const lb: Record<string, Entry> = {};
  for (const d of R.decks) {
    const L = lib.find((x) => x.deck.name === d.name);
    if (!L) continue;
    let W = 0;
    let G = 0;
    for (const m of metaNames) {
      if (m === d.name || R.matrix[d.name]?.[m] === undefined) continue;
      W += R.matrix[d.name][m] * R.games;
      G += R.games;
    }
    lb[d.name] = mkEntry(L, 0, L.kind === 'original' ? 'NC original' : L.kind === 'custom' ? 'variant' : L.kind);
    lb[d.name].metaW = W;
    lb[d.name].metaG = G;
    lb[d.name].seasons['0'] = d.winRate;
  }
  for (const L of lib) {
    const f = `reports/test-${L.file.replace(/\.txt$/, '')}-latest.json`;
    if (!fs.existsSync(f) || !lb[L.deck.name]) continue;
    addFinals(lb[L.deck.name], JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  return lb;
}
function mkEntry(L: (typeof lib)[number], season: number, origin: string): Entry {
  return {
    name: L.deck.name,
    file: L.file,
    kind: L.kind,
    origin,
    colors: deckColors(L.deck),
    arch: classify(L.deck.main).arch,
    firstSeason: season,
    metaW: 0,
    metaG: 0,
    seasons: {},
    idea: L.idea,
  };
}
function addFinals(e: Entry, t: { overall: number; rows: { b: string; aWins: number; ties: number; games: number }[] }) {
  let w = 0;
  let g = 0;
  for (const r of t.rows) {
    if (!metaNames.has(r.b)) continue;
    w += r.aWins + r.ties / 2;
    g += r.games;
  }
  e.metaW += w;
  e.metaG += g;
  e.finals = g ? w / g : e.finals;
}
const vsMeta = (e: Entry) => (e.metaG ? e.metaW / e.metaG : 0);
/** Ranking score: win rate vs meta shrunk toward 50% by a 60-game prior (small samples can't top the board). */
const PRIOR = 60;
const rating = (e: Entry) => (e.metaW + 0.5 * PRIOR) / (e.metaG + PRIOR);

function saveLB(lb: Record<string, Entry>) {
  const list = Object.values(lb).filter((e) => e.metaG > 0).sort((a, b) => rating(b) - rating(a));
  const n = list.length;
  const rows = list.map((e, i) => ({
    ...e,
    vsMeta: vsMeta(e),
    rating: rating(e),
    percentile: n > 1 ? Math.round((100 * (n - 1 - i)) / (n - 1)) : 100,
  }));
  fs.writeFileSync(LB_FILE, JSON.stringify(lb, null, 1));
  const seasons = fs
    .readdirSync('data/seasons')
    .filter((f) => /^season-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(`data/seasons/${f}`, 'utf8')))
    .sort((a, b) => a.season - b.season);
  fs.writeFileSync('src/data/seasons.json', JSON.stringify({ updated: new Date().toISOString(), leaderboard: rows, seasons }, null, 1));
  return rows;
}

// ---------------------------------------------------------------- card impact (pooled across runs)
function impactMap(extra: DeckReport[] = []): Record<string, number> {
  const IMPACT_FILE = 'data/seasons/impact.json';
  const acc: Record<string, { s: number; n: number }> = fs.existsSync(IMPACT_FILE) ? JSON.parse(fs.readFileSync(IMPACT_FILE, 'utf8')) : {};
  if (!fs.existsSync(IMPACT_FILE)) {
    for (const r of JSON.parse(fs.readFileSync('src/data/analysis.json', 'utf8')).decks as DeckReport[]) extra.push(r);
  }
  for (const r of extra)
    for (const c of r.cards) {
      if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd)) continue;
      acc[c.id] ??= { s: 0, n: 0 };
      acc[c.id].s += c.iwd * c.seenGames;
      acc[c.id].n += c.seenGames;
    }
  fs.writeFileSync(IMPACT_FILE, JSON.stringify(acc));
  return Object.fromEntries(Object.entries(acc).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
}

// ---------------------------------------------------------------- season
async function main() {
  const lb = loadLB();
  const impact = impactMap();
  // parents for breeding: every measured deck incl. meta archetypes, by shrunk rating
  const ranked = Object.values(lb)
    .filter((e) => e.metaG > 0 && lib.find((d) => d.deck.name === e.name))
    .sort((a, b) => rating(b) - rating(a))
    .map((e) => ({ deck: lib.find((d) => d.deck.name === e.name)!.deck, wr: rating(e) }));
  // 1. breed
  const seen = new Set(lib.map((d) => [...d.deck.legends].sort().join('|')));
  const bred = breedSeason(SEASON, { ranked, impact, seenTriples: seen, seed: 1000 + SEASON * 77 }, 8);
  const newFiles: string[] = [];
  for (const b of bred) {
    const slug = b.deck.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
    const file = `${slug}.txt`;
    fs.writeFileSync(`data/decks/custom/${file}`, `${exportOfficial(b.deck)}${NL}${NL}// Idea: ${b.idea}${NL}// Author: Night City Trainer breeder (season ${SEASON}, ${b.method})${NL}`);
    newFiles.push(file);
  }
  console.log(`Season ${SEASON}: bred ${bred.map((b) => b.deck.name).join(', ')}`);
  const lib2 = loadLibrary();
  // 2. field = meta + top 8 incumbents + the 8 new decks
  const incumbents = ranked.filter((r) => !metaNames.has(r.deck.name)).slice(0, 8).map((r) => lib2.find((d) => d.deck.name === r.deck.name)!).filter(Boolean);
  const newcomers = newFiles.map((f) => lib2.find((d) => d.file === f)!);
  const field = [...lib2.filter((d) => d.kind === 'meta'), ...incumbents, ...newcomers];
  for (const d of newcomers) lb[d.deck.name] = mkEntry(d, SEASON, `S${SEASON} ${bred.find((b) => b.deck.name === d.deck.name)!.method}`);
  console.log(`Field: ${field.length} decks × ${GAMES} games per pairing (${BOT})`);
  const jobs: MatchJob[] = [];
  let seed = SEASON * 1_000_000;
  for (let i = 0; i < field.length; i++)
    for (let j = i + 1; j < field.length; j++)
      for (let k = 0; k < GAMES; k++) jobs.push({ a: field[i].deck, b: field[j].deck, seed: seed++, first: (k % 2) as 0 | 1, bot: BOT, trace: true });
  const res: MatchResult[] = await runJobs(jobs);
  const reps = analyzeAll(res.flatMap((r) => r.summaries ?? []));
  impactMap(reps);
  // per-deck season win rate + pooled vs-meta record
  const tot: Record<string, { w: number; g: number }> = {};
  for (const r of res) {
    const s = r.winner === 0 ? 1 : r.winner === 'tie' ? 0.5 : 0;
    for (const [me, opp, v] of [
      [r.a, r.b, s],
      [r.b, r.a, 1 - s],
    ] as [string, string, number][]) {
      (tot[me] ??= { w: 0, g: 0 }), (tot[me].w += v), tot[me].g++;
      if (metaNames.has(opp) && lb[me]) {
        lb[me].metaW += v;
        lb[me].metaG++;
      }
    }
  }
  for (const [name, t] of Object.entries(tot)) if (lb[name]) lb[name].seasons[String(SEASON)] = t.w / t.g;
  saveLB(lb);
  // 3. forge the newcomers
  console.log('Forging newcomers…');
  execSync(`npx tsx scripts/forge.ts ${newFiles.map((f) => f.replace(/\.txt$/, '')).join(' ')} --gens ${FORGE_GENS} --games ${FORGE_GAMES} --cands 5 --bot lookahead`, { stdio: 'inherit' });
  // 4. finals vs meta for newcomers (post-forge) and any incumbent without finals
  const lib3 = loadLibrary();
  const finalists = [...newFiles.map((f) => lib3.find((d) => d.file === f)!), ...incumbents.filter((d) => lb[d.deck.name] && lb[d.deck.name].finals === undefined)];
  for (const d of finalists) {
    console.log(`Finals: ${d.deck.name}`);
    execSync(`npx tsx scripts/simulate.ts test "${d.file.replace(/\.txt$/, '')}" --field meta --games ${Math.ceil(FINALS)} --bot ${BOT} --seed ${SEASON * 9000}`, { stdio: 'ignore' });
    const f = `reports/test-${d.file.replace(/\.txt$/, '')}-latest.json`;
    if (fs.existsSync(f) && lb[d.deck.name]) addFinals(lb[d.deck.name], JSON.parse(fs.readFileSync(f, 'utf8')));
  }
  const board = saveLB(lb);
  // 5. season report
  const seasonRows = field
    .map((d) => ({ name: d.deck.name, file: d.file, kind: d.kind, wr: tot[d.deck.name] ? tot[d.deck.name].w / tot[d.deck.name].g : 0, isNew: newFiles.includes(d.file) }))
    .sort((a, b) => b.wr - a.wr);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const data = {
    season: SEASON,
    date: new Date().toISOString(),
    games: GAMES,
    bot: BOT,
    bred: bred.map((b) => ({ name: b.deck.name, method: b.method, parents: b.parents, idea: b.idea })),
    standings: seasonRows,
    leaderTop: board.slice(0, 12).map((e) => ({ name: e.name, vsMeta: e.vsMeta, percentile: e.percentile })),
  };
  fs.writeFileSync(`data/seasons/season-${SEASON}.json`, JSON.stringify(data, null, 1));
  saveLB(lb);
  const md = [
    `# Season ${SEASON}`,
    '',
    `${field.length} decks (7 meta, ${incumbents.length} incumbents, 8 new) × ${GAMES} games per pairing, ${BOT} bot, with telemetry. New decks were forged (${FORGE_GENS} gen) and then played the finals vs the meta (${FINALS} games per opponent).`,
    '',
    '## New decks',
    ...bred.map((b) => `- **${b.deck.name}** (${b.method}) — ${b.idea}`),
    '',
    '## Season standings (round robin)',
    '| # | Deck | Win % | |',
    '|---|---|---|---|',
    ...seasonRows.map((r, i) => `| ${i + 1} | ${r.name} | ${pct(r.wr)} | ${r.isNew ? 'NEW' : r.kind} |`),
    '',
    '## All-time leaderboard (pooled win % vs the meta archetypes)',
    '| # | Deck | Origin | vs meta (raw) | Rating | Games | Percentile |',
    '|---|---|---|---|---|---|---|',
    ...board.slice(0, 15).map((e, i) => `| ${i + 1} | ${e.name} | ${e.origin} | ${pct(e.vsMeta)} | ${pct(e.rating)} | ${e.metaG} | ${e.percentile} |`),
    '',
    'Rating = win rate vs the meta archetypes, shrunk toward 50% by a 60-game prior, so decks need volume to rank high. Percentile is the rank among all measured decks.',
  ].join(NL);
  fs.writeFileSync(`reports/season-${SEASON}.md`, md);
  console.log(NL + md);
}
main();
