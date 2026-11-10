// Build data/decks/meta-*.txt from choom.gg archetype pages (data/raw/choom_meta).
// Usage: npx tsx scripts/import-meta.ts [--force]
// Refuses to replace existing deck files unless --force. When it does replace one, the provenance header written by
// scripts/tag-provenance.ts (Origin, Author, Credits, Added…) is kept; only the list and the Tier line are refreshed.
import fs from 'node:fs';
import { parseDeck, exportChoom, validateDeck } from '../src/engine/deck';
import { bool, cli, existing, mergeProvenance } from './lib-node';

const { values: V } = cli(import.meta.url, { force: bool() });
const dir = 'data/raw/choom_meta';
if (!fs.existsSync(dir)) {
  console.error(`error: ${dir} not found (the saved choom.gg pages are local only)`);
  process.exit(1);
}
const sources = fs.readdirSync(dir).filter((x) => x.endsWith('.txt') && !x.includes('.deck.')).sort();
const targets = sources.map((f) => `data/decks/meta-${f.replace('.txt', '')}.txt`);
const clash = existing(targets);
if (clash.length && !V.force) {
  console.error(`error: ${clash.length} deck file(s) already exist (${clash.slice(0, 3).join(', ')}${clash.length > 3 ? ', …' : ''}). Pass --force to refresh them; their provenance headers are kept.`);
  process.exit(1);
}
const meta: any[] = [];
for (const f of sources) {
  const slug = f.replace('.txt', '');
  const txt = fs.readFileSync(`${dir}/${f}`, 'utf8');
  const title = txt.match(/^# (.+)$/m)![1].trim();
  const tier = txt.match(/Tier\s*\n\s*([SABCDF])\s*\n/)?.[1];
  const power = +(txt.match(/Power\s*\n\s*(\d+)/)?.[1] ?? 0);
  const complexity = txt.match(/Complexity\s*\n\s*\S+\s*\n\s*([A-Za-z-]+)/)?.[1];
  const tagline = txt.split('\n')[txt.split('\n').findIndex((l) => l.startsWith('# ')) + 1];
  const read = (txt.match(/## The read\n([\s\S]+?)\n## /) ?? [])[1]?.trim();
  const flex = (txt.match(/## Flex slots\n([\s\S]+?)\n(Decklist and read|## )/) ?? [])[1]?.trim();
  const summary = txt.match(/Public decks running these Legends\n(.+)\n/)?.[1];
  let listText: string;
  let source = `https://choom.gg/meta/${slug}`;
  if (txt.includes('## Decklist')) listText = txt.slice(txt.indexOf('## Decklist') + 12, txt.indexOf('## Flex'));
  else {
    const deckTxt = fs.readFileSync(`${dir}/${slug}.deck.txt`, 'utf8');
    listText = deckTxt.slice(deckTxt.indexOf('#### Legends'), deckTxt.indexOf('#### Stats')).split('\n').filter((l) => !/^RAM \d/.test(l)).join('\n');
    const id = fs.readFileSync(`${dir}/${slug}.deck.html`, 'utf8').match(/decks\/([0-9a-f-]{36})/)?.[1];
    if (id) source += ` (reference list https://choom.gg/decks/${id})`;
  }
  const { deck, errors } = parseDeck(listText, title);
  deck.name = title;
  const out = exportChoom(deck).replace(/^\/\/ (.+)\n/, (m) => `${m}// Source: ${source}\n// Tier: ${tier} (${power}/100), complexity ${complexity}\n`);
  const file = `data/decks/meta-${slug}.txt`;
  const prev = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  fs.writeFileSync(file, mergeProvenance(out, prev, ['Tier']) + '\n');
  // long-form analysis text stays on choom.gg (we keep only the short tagline/summary and link to it)
  void read;
  void flex;
  meta.push({ slug, title, tier, power, complexity, tagline, summary, source, deckFile: `meta-${slug}.txt` });
  console.log(title, deck.legends.length, deck.main.length, deck.sideboard.length, errors.length ? 'UNPARSED ' + errors.join('/') : '', validateDeck(deck).join(' '));
}
fs.writeFileSync('src/data/meta.json', JSON.stringify(meta, null, 1));
