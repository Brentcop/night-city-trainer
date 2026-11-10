// Preview the next season's breeding without playing any games: which decks would be parents, which would be the
// "bosses" to counter, and the 8 decks the breeder would build from the current data.
//
//   npx tsx scripts/breed-preview.ts [--season 6]
import fs from 'node:fs';
import { breedSeason } from '../src/ai/breeder';
import { loadLibrary } from './lib-node';
import { loadDeckImpact, loadH2H, strengthOf } from './breed-data';

const i = process.argv.indexOf('--season');
const SEASON = i > 0 ? +process.argv[i + 1] : 0;
const PRIOR = 60;
const lib = loadLibrary();
const lb: Record<string, { name: string; metaW: number; metaG: number }> = fs.existsSync('data/seasons/leaderboard.json') ? JSON.parse(fs.readFileSync('data/seasons/leaderboard.json', 'utf8')) : {};
const strength = strengthOf(Object.fromEntries(Object.values(lb).filter((e) => e.metaG > 0).map((e) => [e.name, (e.metaW + 0.5 * PRIOR) / (e.metaG + PRIOR)])));
const ranked = Object.entries(strength)
  .filter(([n]) => lib.find((d) => d.deck.name === n))
  .sort((a, b) => b[1] - a[1])
  .map(([n, wr]) => ({ deck: lib.find((d) => d.deck.name === n)!.deck, wr }));
const h2h = loadH2H();
const deckImpact = loadDeckImpact();
const hasH2H = ranked.slice(0, 4).some((x) => ranked.some((y) => h2h(y.deck.name, x.deck.name).g > 0));
const impactFile = 'data/seasons/impact.json';
const pooled: Record<string, { s: number; n: number }> = fs.existsSync(impactFile) ? JSON.parse(fs.readFileSync(impactFile, 'utf8')) : {};
const impact = Object.fromEntries(Object.entries(pooled).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
const season = SEASON || 1 + Math.max(0, ...lib.map((d) => +(d.file.match(/^s(\d+)-/)?.[1] ?? 0)));

console.log(`Season ${season} preview`);
console.log(`  strongest parents: ${ranked.slice(0, 6).map((r) => `${r.deck.name} ${(r.wr * 100).toFixed(0)}%`).join(', ')}`);
console.log(`  per-deck card impact for ${Object.keys(deckImpact).length} decks; head-to-heads ${hasH2H ? 'available (counters on)' : 'not available yet (counters off)'}`);
const seen = new Set(lib.map((d) => [...d.deck.legends].sort().join('|')));
for (const b of breedSeason(season, { ranked, impact, seenTriples: seen, seed: 1000 + season * 77, deckImpact, h2h: hasH2H ? h2h : undefined }, 8))
  console.log(`\n  ${b.deck.name} [${b.method}]\n    ${b.idea}`);
