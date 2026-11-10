// Build data/decks/meta-*.txt from choom.gg archetype pages (data/raw/choom_meta).
// Usage: npx tsx scripts/import-meta.ts
import fs from 'node:fs';
import { parseDeck, exportChoom, validateDeck } from '../src/engine/deck';

const dir = 'data/raw/choom_meta';
const meta: any[] = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt') && !x.includes('.deck.'))) {
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
  fs.writeFileSync(`data/decks/meta-${slug}.txt`, out + '\n');
  // long-form analysis text stays on choom.gg (we keep only the short tagline/summary and link to it)
  void read;
  void flex;
  meta.push({ slug, title, tier, power, complexity, tagline, summary, source, deckFile: `meta-${slug}.txt` });
  console.log(title, deck.legends.length, deck.main.length, deck.sideboard.length, errors.length ? 'UNPARSED ' + errors.join('/') : '', validateDeck(deck).join(' '));
}
fs.writeFileSync('src/data/meta.json', JSON.stringify(meta, null, 1));
