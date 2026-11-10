// Extract deck lists from saved choom.gg guide pages (data/raw/choom_guides/*.txt) into data/decks/*.txt.
// Usage: npx tsx scripts/import-guides.ts [--force]
// Refuses to replace existing deck files unless --force. When it does replace one, the provenance header written by
// scripts/tag-provenance.ts (Origin, Author, Via, Added…) is kept; only the list is refreshed.
import fs from 'node:fs';
import path from 'node:path';
import { parseDeck, exportChoom, validateDeck, deckColors } from '../src/engine/deck';
import { bool, cli, mergeProvenance } from './lib-node';

const { values: V } = cli(import.meta.url, { force: bool() });
const dir = 'data/raw/choom_guides';
if (!fs.existsSync(dir)) {
  console.error(`error: ${dir} not found (the saved choom.gg pages are local only)`);
  process.exit(1);
}
const outputs: { file: string; text: string; log: string }[] = [];
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.txt')).sort()) {
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
  const v = validateDeck(deck);
  outputs.push({
    file: `data/decks/${deckColors(deck)}-${slug}.txt`,
    text: out,
    log: `${deckColors(deck)} ${title}: ${deck.main.length} main, ${deck.sideboard.length} side${errors.length ? ' | unparsed: ' + errors.join(' / ') : ''}${v.length ? ' | INVALID: ' + v.join(' ') : ''}`,
  });
}
// check every target before writing any
const clash = outputs.filter((o) => fs.existsSync(o.file)).map((o) => o.file);
if (clash.length && !V.force) {
  console.error(`error: ${clash.length} deck file(s) already exist (${clash.slice(0, 3).join(', ')}${clash.length > 3 ? ', …' : ''}). Pass --force to refresh them; their provenance headers are kept.`);
  process.exit(1);
}
for (const o of outputs) {
  const prev = fs.existsSync(o.file) ? fs.readFileSync(o.file, 'utf8') : null;
  fs.writeFileSync(o.file, mergeProvenance(o.text, prev) + '\n');
  console.log(o.log);
}
