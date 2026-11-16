// Preview the next season's breeding without playing any games: which decks would be parents, which would be the
// "bosses" to counter, and the 8 decks the breeder would build from the current data. Writes nothing.
//
//   npx tsx scripts/breed-preview.ts [--season 6] [--lists]
//   --lists   also print each list and the synergy packages it holds (synergiesIn)
// The breeder's package flags work here too (scripts/season.ts --help; docs/SYNERGIES.md), e.g.
//   npx tsx scripts/breed-preview.ts --seed-packages low-cred+program-fuel --lists
import fs from 'node:fs';
import { breedSeason } from '../src/ai/breeder';
import { bool, cli, int, loadLibrary } from './lib-node';
import { keptOutTriples, leaderStrength, loadDeckImpact, loadH2H, seasonVersionsOnDisk, strengthOf } from './breed-data';
import { rankParents } from '../src/lib/parentStrength';
import { breederPackageFlags, exitOnPlanProblems, packagesOn, planFromFlags, seedsFromFlags } from './package-flags';
import { exportOfficial } from '../src/engine/deck';
import { synergiesIn } from '../src/content/synergies';
import { describePlan, packageCompatibility, packageName } from '../src/lib/deckPackages';

const { values: V } = cli(import.meta.url, { season: int(0, { min: 0 }), lists: bool(), ...breederPackageFlags() });
const SEASON = V.season;
const PACKAGES = packagesOn(V);
const PLAN = planFromFlags(V);
exitOnPlanProblems(PLAN);
const SEEDS = seedsFromFlags(V);
const PRIOR = 60;
const lib = loadLibrary();
const lb: Record<string, { name: string; metaW: number; metaG: number; seasons?: Record<string, number> }> = fs.existsSync('data/seasons/leaderboard.json') ? JSON.parse(fs.readFileSync('data/seasons/leaderboard.json', 'utf8')) : {};
// a leaderboard entry counts only when every season behind it ran under the current simulator version (src/lib/parentStrength.ts)
const versions = seasonVersionsOnDisk();
const strength = strengthOf(Object.values(lb).filter((e) => e.metaG > 0).map((e) => leaderStrength(e, (e.metaW + 0.5 * PRIOR) / (e.metaG + PRIOR), versions)));
const ranked = rankParents(strength, lib);
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
if (PACKAGES) {
  console.log(`  packages: ${describePlan(PLAN)}${SEEDS.length ? `; explorers seeded from ${SEEDS.map((c) => c.map(packageName).join(' + ')).join(', ')}` : ''}`);
  for (const c of SEEDS) {
    const k = packageCompatibility(c);
    if (k.ok) console.log(`    ${c.map(packageName).join(' + ')}: ${k.triples} legal Legend trios can hold ${c.length > 1 ? 'both' : 'it'}${k.warning ? `. Note: ${k.warning}` : ''}`);
  }
}
// the Legend trios of decks the gate kept out in earlier seasons count as seen too
const seen = new Set([...lib.map((d) => [...d.deck.legends].sort().join('|')), ...keptOutTriples()]);
for (const b of breedSeason(season, { ranked, impact, seenTriples: seen, seed: 1000 + season * 77, deckImpact, h2h: hasH2H ? h2h : undefined, ...(PACKAGES ? { packages: { plan: PLAN, seeds: SEEDS } } : {}) }, 8)) {
  console.log(`\n  ${b.deck.name} [${b.method}]\n    ${b.idea}`);
  if (b.packages) console.log(`    packages: built around ${b.packages.builtAround.map(packageName).join(', ') || 'none'}${b.packages.changes.length ? `; changes: ${b.packages.changes.join('; ')}` : ''}`);
  if (V.lists) {
    console.log(exportOfficial(b.deck).replace(/^/gm, '      '));
    for (const x of synergiesIn(b.deck))
      console.log(`      ~ ${x.synergy.name}${x.builtAround ? ' (built around)' : ''}: ${x.cards.map((c) => `${c.copies}× ${c.id}`).join(', ')}; odds by turn 2/4/6 ${x.odds.map((o) => `${Math.round(o.p * 100)}%`).join(' / ')}`);
  }
}
