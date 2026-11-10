// Theorize main decks for Legend trios seen on the cyberpunk-tcg-sim.online ladder (only the Legends are public there).
// For each trio: seed card choices from our decks sharing 2–3 of its Legends (weighted by overlap and by how each card
// performed in that deck), pick the play style those decks share, and fill a legal 40 with the breeder's builder.
// Then tune with the forge:  npx tsx scripts/forge.ts ladder-<name> --gens 2 --field meta
//
//   npx tsx scripts/theorize-ladder.ts
import fs from 'node:fs';
import { CARD_BY_ID } from '../src/engine/cards';
import { exportOfficial, validateDeck } from '../src/engine/deck';
import { fill, seedsOf } from '../src/ai/breeder';
import { classify, type Archetype } from '../src/ai/archetype';
import { loadLibrary } from './lib-node';
import { loadDeckImpact } from './breed-data';

interface Trio {
  slug: string;
  name: string;
  legends: string[];
  seen: string; // ladder evidence
}
// From a Master-rank ladder screenshot of cyberpunk-tcg-sim.online (2026-11-10). LP and games per entry.
const TRIOS: Trio[] = [
  {
    slug: 'ladder-bbg-jackie-alt-hanako',
    name: 'Ladder: Jackie / Alt / Hanako (BBG)',
    legends: ['jackie_welles_pour_one_out_for_me', 'alt_cunningham_soulkiller_architect', 'hanako_arasaka_daughter_of_the_emperor'],
    seen: '4 Master entries: 855 LP (85 games), 750 LP (35), 733 LP (108), 491 LP (67)',
  },
  {
    slug: 'ladder-ryy-smasher-river-viktor',
    name: 'Ladder: Smasher / River / Viktor (RYY)',
    legends: ['adam_smasher_ender_of_legends', 'river_ward_detective_on_the_hunt', 'viktor_vektor_sit_down_and_relax'],
    seen: 'Master 1058 LP (39 games), the highest LP in the sample',
  },
  {
    slug: 'ladder-rrg-v-smasher-saburo',
    name: 'Ladder: V / Smasher / Saburo (RRG)',
    legends: ['v_streetkid', 'adam_smasher_ender_of_legends', 'saburo_arasaka_stubborn_patriarch'],
    seen: 'Master 604 LP (54 games)',
  },
  {
    slug: 'ladder-rrg-v-smasher-padre',
    name: 'Ladder: V / Smasher / Padre (RRG)',
    legends: ['v_streetkid', 'adam_smasher_ender_of_legends', 'padre_man_of_the_cross'],
    seen: 'Master 690 LP (37 games)',
  },
  {
    slug: 'ladder-rrb-dexter-v-wakako',
    name: 'Ladder: Dexter / V / Wakako (RRB)',
    legends: ['dexter_deshawn_off_the_grid', 'v_streetkid', 'wakako_okada_peace_and_harmony'],
    seen: 'Master 656 LP (56 games)',
  },
];

const lib = loadLibrary().filter((d) => !d.file.startsWith('ladder-'));
const deckImpact = loadDeckImpact();
const pooled: Record<string, { s: number; n: number }> = fs.existsSync('data/seasons/impact.json') ? JSON.parse(fs.readFileSync('data/seasons/impact.json', 'utf8')) : {};
const impact = Object.fromEntries(Object.entries(pooled).filter(([, v]) => v.n >= 40).map(([k, v]) => [k, v.s / v.n]));
const lb: Record<string, { name: string; metaW: number; metaG: number }> = fs.existsSync('data/seasons/leaderboard.json') ? JSON.parse(fs.readFileSync('data/seasons/leaderboard.json', 'utf8')) : {};
const strength = (name: string) => {
  const e = Object.values(lb).find((x) => x.name === name);
  return e ? (e.metaW + 30) / (e.metaG + 60) : 0.5;
};

for (const t of TRIOS) {
  const rel = lib
    .map((d) => ({ d, n: d.deck.legends.filter((l) => t.legends.includes(l)).length }))
    .filter((x) => x.n >= 2)
    .sort((a, b) => b.n - a.n || strength(b.d.deck.name) - strength(a.d.deck.name))
    .slice(0, 6);
  // seeds: exact-trio decks count fully, 2-Legend overlaps at 60%, stronger decks a little more
  const seeds = new Map<string, number>();
  for (const { d, n } of rel) {
    const w = (n === 3 ? 1 : 0.6) * (0.8 + strength(d.deck.name) * 0.4);
    for (const [id, v] of seedsOf([d.deck], deckImpact)) seeds.set(id, Math.max(seeds.get(id) ?? 0, v * w));
  }
  // style: what the related decks play like (exact-trio decks vote double)
  const votes: Record<Archetype, number> = { aggro: 0, midrange: 0, control: 0 };
  for (const { d, n } of rel) votes[classify(d.deck.main).arch] += n === 3 ? 2 : 1;
  const style = (Object.entries(votes).sort((a, b) => b[1] - a[1])[0]?.[0] as Archetype) ?? 'midrange';
  const deck = fill(t.legends, seeds, impact, style, t.name);
  const errs = validateDeck({ ...deck, sideboard: [] });
  if (errs.length) {
    console.log(`${t.name}: INVALID — ${errs.join('; ')}`);
    continue;
  }
  const parents = rel.map((x) => `${x.d.deck.name} (${x.n}/3 Legends)`).join(', ');
  const header = [
    '// Origin: cyberpunk-tcg-sim.online Master ladder (Legend trio) — main deck theorized by Night City Trainer',
    "// Author: Night City Trainer (theorized from bot-match data; the ladder players' own 40-card lists are not public)",
    '// Source: https://cyberpunk-tcg-sim.online/',
    `// Credits: Legend trio seen on the Master ladder — ${t.seen} (screenshot shared by the user, 2026-11-10)`,
    `// Parents: ${parents || 'none (built from format-wide card impact)'}`,
    '// Added: 2026-11-10',
    `// Idea: ${style} build for the ${t.legends.map((l) => CARD_BY_ID[l].name).join(' / ')} trio. Cards seeded from our decks that share its Legends, weighted by how each card performed there, then filled by role and curve and tuned by the forge.`,
  ].join('\n');
  fs.writeFileSync(`data/decks/${t.slug}.txt`, `${exportOfficial(deck)}\n\n${header}\n`);
  console.log(`${t.name} [${style}] ← ${parents || '—'}`);
}
