// Rewrite every deck file with a standard provenance header (where the list came from and who made it).
//   npx tsx scripts/tag-provenance.ts
//
// Header keys (all "// Key: value" lines, parsed by src/lib/library.ts):
//   Origin   – category (choom.gg meta archetype, choom.gg community guide, Night City Trainer original/bred/variant/build)
//   Author   – person or system that built the list
//   Source   – URL of the list
//   Via      – site it was collected from
//   Credits  – extra attribution (rating authors, analysis sources)
//   Parents  – decks it was derived from (bred decks, variants, builds)
//   Added    – date the list was published / created
//   Tier, Idea, Forged – kept from earlier tooling
import fs from 'node:fs';
import path from 'node:path';
import { exportChoom, parseDeck } from '../src/engine/deck';

const NL = String.fromCharCode(10);
const PRIMER = 'Troy Yamaguchi (Plus Two) — "The Cyberpunk Primer" video, 6 Sep 2026';
const META_AUTHORS: Record<string, { author: string; credits: string }> = {
  'meta-bbg-cunningham-econ.txt': { author: PRIMER, credits: 'Tier rating and summary: choom.gg editors' },
  'meta-rainbow-fixer-stuff.txt': { author: PRIMER, credits: 'Tier rating and summary: choom.gg editors' },
  'meta-rrb-wakako-midrange.txt': { author: PRIMER, credits: 'Tier rating and summary: choom.gg editors' },
  'meta-rrg-dexter-midrange.txt': { author: PRIMER, credits: 'Tier rating and summary: choom.gg editors' },
  'meta-gry-trauma-team.txt': { author: 'UltPotatoe (choom.gg public deck "RGY Rainbow Trauma Team")', credits: 'Archetype tier rating: choom.gg editors (with tcgcontender.com community data)' },
  'meta-rry-smasher-aggro.txt': { author: 'Armbarred (choom.gg public deck "RRY Aggro")', credits: 'Archetype tier rating: choom.gg editors (with tcgcontender.com community data)' },
  'meta-yyb-rogue-gear.txt': { author: 'MMantanza (choom.gg public deck "Gear Up")', credits: 'Archetype tier rating: choom.gg editors (with tcgcontender.com community data)' },
};
const MONTHS: Record<string, string> = { January: '01', February: '02', March: '03', April: '04', May: '05', June: '06', July: '07', August: '08', September: '09', October: '10', November: '11', December: '12' };

function header(text: string): Record<string, string> {
  const h: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\/\/ (Source|Author|Tier|Idea|Forged|Origin|Via|Credits|Parents|Added): (.*)$/);
    if (m) h[m[1]] = h[m[1]] ? `${h[m[1]]}; ${m[2]}` : m[2];
  }
  return h;
}

// season breeding records → parents per deck name
const parents: Record<string, { season: number; method: string; parents: string[]; date: string }> = {};
if (fs.existsSync('data/seasons'))
  for (const f of fs.readdirSync('data/seasons').filter((x) => /^season-\d+\.json$/.test(x))) {
    const s = JSON.parse(fs.readFileSync(`data/seasons/${f}`, 'utf8'));
    for (const b of s.bred) parents[b.name] = { season: s.season, method: b.method, parents: b.parents, date: s.date.slice(0, 10) };
  }

const files = [
  ...fs.readdirSync('data/decks').filter((f) => f.endsWith('.txt')).map((f) => path.join('data/decks', f)),
  ...fs.readdirSync('data/decks/custom').filter((f) => f.endsWith('.txt')).map((f) => path.join('data/decks/custom', f)),
];

const PRIMER_DECK_CREDIT = 'RRG Dexter Midrange (list: Troy Yamaguchi / The Cyberpunk Primer, via choom.gg)';
for (const file of files) {
  const base = path.basename(file);
  const text = fs.readFileSync(file, 'utf8');
  const old = header(text);
  const { deck } = parseDeck(text, base);
  const p: Record<string, string> = {};
  if (base.startsWith('meta-')) {
    p.Origin = 'choom.gg meta archetype';
    p.Author = META_AUTHORS[base]?.author ?? 'unknown';
    p.Source = old.Source ?? '';
    p.Via = 'choom.gg/meta (collected 2026-11-09)';
    p.Credits = META_AUTHORS[base]?.credits ?? 'choom.gg editors';
    p.Added = '2026-11-09';
    if (old.Tier) p.Tier = old.Tier;
  } else if (!file.includes('custom')) {
    const m = (old.Author ?? '').match(/^(.+?) \((\w+) (\d+), (\d{4})\)$/);
    p.Origin = 'choom.gg community guide';
    p.Author = m ? m[1] : old.Author ?? 'unknown';
    p.Source = old.Source ?? '';
    p.Via = 'choom.gg/guides (free portion, collected 2026-11-09)';
    p.Added = m ? `${m[4]}-${MONTHS[m[2]]}-${m[3].padStart(2, '0')}` : '';
  } else if (/^nc-/.test(base)) {
    p.Origin = 'Night City Trainer original (hand-designed, then forged)';
    p.Author = 'Night City Trainer — designed by Claude (Anthropic) for this project';
    p.Added = '2026-11-10';
  } else if (/^s\d+-/.test(base) && !base.endsWith('-eor.txt')) {
    const b = parents[deck.name];
    p.Origin = `Night City Trainer bred deck (season ${b?.season ?? '?'}, ${b?.method ?? '?'})`;
    p.Author = 'Night City Trainer breeder (automated, data-driven)';
    if (b?.parents.length) p.Parents = b.parents.join(' × ');
    p.Added = b?.date ?? '2026-11-10';
  } else if (base.startsWith('rrg-v-')) {
    p.Origin = 'Night City Trainer optimizer variant';
    p.Author = 'Night City Trainer optimizer';
    p.Parents = PRIMER_DECK_CREDIT;
    p.Source = 'https://choom.gg/meta/rrg-dexter-midrange';
    p.Added = '2026-11-10';
  } else if (base.endsWith('-eor.txt') || base === 'rrg-eor-build.txt') {
    p.Origin = 'Night City Trainer tournament build (list + data-chosen sideboard)';
    p.Author = 'Night City Trainer';
    p.Parents = base === 'rrg-eor-build.txt' ? PRIMER_DECK_CREDIT : deck.name.replace(/ — EOR build$/, '') + ' (Night City Trainer bred deck)';
    if (base === 'rrg-eor-build.txt') p.Credits = 'Sideboard ideas: Cacheira ("Smash the Curve" guide, choom.gg) + optimizer runs';
    p.Added = '2026-11-10';
  } else {
    p.Origin = 'Custom';
    p.Author = old.Author ?? 'unknown';
  }
  if (old.Idea) p.Idea = old.Idea;
  if (old.Forged) p.Forged = old.Forged;
  const order = ['Origin', 'Author', 'Source', 'Via', 'Credits', 'Parents', 'Added', 'Tier', 'Idea', 'Forged'];
  const block = order.filter((k) => p[k]).map((k) => `// ${k}: ${p[k]}`).join(NL);
  const body = exportChoom(deck).split(NL);
  // exportChoom starts with "// Name", "// Format: Constructed"
  const out = [body[0], block, ...body.slice(1)].join(NL) + NL;
  fs.writeFileSync(file, out);
  console.log(`${base.padEnd(52)} ${p.Origin} — ${p.Author}`);
}
