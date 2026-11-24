// Preview the next season's breeding without playing any games: which decks would be parents, which would be the
// "bosses" to counter, and the 8 decks the breeder would build from the current data. Writes nothing.
//
//   npx tsx scripts/breed-preview.ts [--season 6] [--lists] [--bot hard] [--legend-scores]
//   --lists          also print each list and the synergy packages it holds (synergiesIn)
//   --bot            the bot the season would play with (default hard, as scripts/season.ts): the breeder reads one pair's
//                    card impact, that bot and the current simulator version when they have numbers, else the closest pair
//                    with a warning, through the season's own reader (loadImpactTables in scripts/breed-data.ts), and the
//                    preview says which pair it read
//   --legend-scores  also print every Legend's score both ways: by its marginal effect (src/ai/breeder.ts legendEffects,
//                    what the season and the Deck Lab use since 2026-11-24) and by the average strength of the decks using
//                    it (the breeder before), with how many ranked decks hold it
// The breeder's package flags work here too (scripts/season.ts --help; docs/SYNERGIES.md), e.g.
//   npx tsx scripts/breed-preview.ts --seed-packages low-cred+program-fuel --lists
// The breeding policy is the season's (src/ai/breeder.ts BREED_POLICY: Legends by marginal effect, two colours at most).
import { BREED_POLICY, breedSeason, legendEffects, legendScoresByAverage } from '../src/ai/breeder';
import { bool, cli, int, loadLibrary, oneOf, SIM_BOTS } from './lib-node';
import { expiredTriples, keptOutTriples, loadH2H, loadImpactTables, SEASON_BOT, strengthOf } from './breed-data';
import { impactTablesWords } from '../src/lib/breederImpact';
import { rankParents } from '../src/lib/parentStrength';
import { breederPackageFlags, exitOnPlanProblems, packagesOn, planFromFlags, seedsFromFlags } from './package-flags';
import { exportOfficial } from '../src/engine/deck';
import { CARD_BY_ID, CARDS, cardLabel } from '../src/engine/cards';
import { synergiesIn } from '../src/content/synergies';
import { describePlan, packageCompatibility, packageName } from '../src/lib/deckPackages';

const { values: V } = cli(import.meta.url, { season: int(0, { min: 0 }), lists: bool(), bot: oneOf(SIM_BOTS, SEASON_BOT), 'breed-count': int(0, { min: 0 }), 'legend-scores': bool(), ...breederPackageFlags() });
const SEASON = V.season;
const PACKAGES = packagesOn(V);
const PLAN = planFromFlags(V);
exitOnPlanProblems(PLAN);
const SEEDS = seedsFromFlags(V);
const lib = loadLibrary();
// parent strength: the power ratings alone (src/lib/parentStrength.ts), decks with 100 or more games on their list
const ranked = rankParents(strengthOf(), lib);
const h2h = loadH2H();
const hasH2H = ranked.slice(0, 4).some((x) => ranked.some((y) => h2h(y.deck.name, x.deck.name).g > 0));
// the season's own reader: one pair's card impact, this simulator version and the bot when they have numbers, else the
// closest pair with a warning
const tables = loadImpactTables(V.bot);
const { impact, deckImpact } = tables;
const season = SEASON || 1 + Math.max(0, ...lib.map((d) => +(d.file.match(/^s(\d+)-/)?.[1] ?? 0)));

console.log(`Season ${season} preview`);
for (const l of impactTablesWords(tables)) console.log(`  ${l}`);
console.log(`  strongest parents: ${ranked.slice(0, 6).map((r) => `${r.deck.name} ${(r.wr * 100).toFixed(0)}%`).join(', ')}`);
console.log(`  per-deck card impact for ${Object.keys(deckImpact).length} decks; head-to-heads ${hasH2H ? 'available (counters on)' : 'not available yet (counters off)'}`);
if (PACKAGES) {
  console.log(`  packages: ${describePlan(PLAN)}${SEEDS.length ? `; explorers seeded from ${SEEDS.map((c) => c.map(packageName).join(' + ')).join(', ')}` : ''}`);
  for (const c of SEEDS) {
    const k = packageCompatibility(c);
    if (k.ok) console.log(`    ${c.map(packageName).join(' + ')}: ${k.triples} legal Legend trios can hold ${c.length > 1 ? 'both' : 'it'}${k.warning ? `. Note: ${k.warning}` : ''}`);
  }
}
if (V['legend-scores']) {
  const avg = legendScoresByAverage(ranked);
  const { mean, effect, decks } = legendEffects(ranked);
  const rows = CARDS.filter((c) => c.type === 'Legend')
    .map((l) => ({ name: cardLabel(l), color: l.color, decks: decks.get(l.id) ?? 0, avg: avg(l.id), marginal: mean + (effect.get(l.id) ?? 0) }))
    .sort((a, b) => b.marginal - a.marginal || b.avg - a.avg);
  console.log(`  Legend scores over ${ranked.length} ranked decks (mean strength ${(mean * 100).toFixed(1)}): marginal effect, then the old average score`);
  for (const r of rows) console.log(`    ${(r.marginal * 100).toFixed(1).padStart(5)}  ${(r.avg * 100).toFixed(1).padStart(5)}  ${String(r.decks).padStart(2)} decks  ${r.color.padEnd(6)} ${r.name}`);
}
// the Legend trios of decks the gate kept out (or a season retired) in earlier seasons of this simulator version count as seen too
const seen = new Set([...lib.map((d) => [...d.deck.legends].sort().join('|')), ...keptOutTriples()]);
const expired = expiredTriples();
if (expired) console.log(`  ${expired} Legend trio${expired === 1 ? '' : 's'} closed by a season of another simulator version ${expired === 1 ? 'is' : 'are'} open again`);
const BREED_COUNT = V['breed-count'] || 0;
for (const b of breedSeason(season, { ranked, impact, seenTriples: seen, seed: 1000 + season * 77, deckImpact, h2h: hasH2H ? h2h : undefined, ...(PACKAGES ? { packages: { plan: PLAN, seeds: SEEDS } } : {}), ...BREED_POLICY }, 8, BREED_COUNT > 8 ? BREED_COUNT : undefined)) {
  console.log(`\n  ${b.deck.name} [${b.method}]\n    ${b.idea}`);
  console.log(`    Legends: ${b.deck.legends.map((l) => CARD_BY_ID[l]?.name ?? l).join(' / ')}`);
  if (b.packages) console.log(`    packages: built around ${b.packages.builtAround.map(packageName).join(', ') || 'none'}${b.packages.changes.length ? `; changes: ${b.packages.changes.join('; ')}` : ''}`);
  if (V.lists) {
    console.log(exportOfficial(b.deck).replace(/^/gm, '      '));
    for (const x of synergiesIn(b.deck))
      console.log(`      ~ ${x.synergy.name}${x.builtAround ? ' (built around)' : ''}: ${x.cards.map((c) => `${c.copies}× ${c.id}`).join(', ')}; odds by turn 2/4/6 ${x.odds.map((o) => `${Math.round(o.p * 100)}%`).join(' / ')}`);
  }
}
