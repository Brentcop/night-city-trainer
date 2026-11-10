// Extract deck lists from saved choom.gg guide pages (data/raw/choom_guides/*.txt) into data/decks/*.txt.
// Usage: npx tsx scripts/import-guides.ts
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck, exportChoom, validateDeck, deckColors } from '../src/engine/deck';

const dir = 'data/raw/choom_guides';
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt'))) {
  const txt = fs.readFileSync(path.join(dir, f), 'utf8');
  const title = (txt.match(/^# (.+)$/m) ?? [, f])[1]!.trim();
  const by = (txt.match(/^by ([^|]+)\|([^|]+)\|/m) ?? []) as string[];
  const start = txt.indexOf('## The Deck');
  const end = txt.indexOf('Type Distribution');
  if (start < 0 || end < 0) continue;
  const body = txt.slice(start, end).split('\n').filter((l) => !/^RAM \d/.test(l.trim()) && !/^## The Deck/.test(l)).join('\n');
  const { deck, errors } = parseDeck(body, title);
  deck.name = title;
  const slug = f.replace(/\.txt$/, '').replace(/-[0-9a-f]{6}$/, '').slice(0, 60);
  const header = [
    `// Source: https://choom.gg/guides/${f.replace(/\.txt$/, '')}`,
    by[1] ? `// Author: ${by[1].trim()} (${by[2].trim()})` : '',
  ].filter(Boolean);
  const out = exportChoom(deck).replace(/^\/\/ (.+)\n/, (m) => m + header.join('\n') + '\n');
  fs.writeFileSync(`data/decks/${deckColors(deck)}-${slug}.txt`, out + '\n');
  const v = validateDeck(deck);
  console.log(`${deckColors(deck)} ${title}: ${deck.main.length} main, ${deck.sideboard.length} side${errors.length ? ' | unparsed: ' + errors.join(' / ') : ''}${v.length ? ' | INVALID: ' + v.join(' ') : ''}`);
}
