import fs from 'node:fs';
import path from 'node:path';
import { deckFromText, type LibraryDeck } from '../src/lib/library';
import { parseDeck } from '../src/engine/deck';

export function loadLibrary(dir = 'data/decks'): LibraryDeck[] {
  const out: LibraryDeck[] = [];
  for (const sub of ['', 'custom']) {
    const d = path.join(dir, sub);
    if (!fs.existsSync(d)) continue;
    for (const f of fs.readdirSync(d).filter((x) => x.endsWith('.txt')).sort())
      out.push(deckFromText(f, fs.readFileSync(path.join(d, f), 'utf8'), sub ? 'custom' : undefined));
  }
  return out;
}

/** Resolve a deck by file name fragment, deck name fragment, or a path to a deck text file. */
export function resolveDeck(q: string, lib = loadLibrary()): LibraryDeck {
  if (fs.existsSync(q) && fs.statSync(q).isFile()) {
    const txt = fs.readFileSync(q, 'utf8');
    return { file: path.basename(q), deck: parseDeck(txt, path.basename(q)).deck, kind: 'custom', prov: { origin: 'Custom (file)' } };
  }
  const ql = q.toLowerCase().replace(/.txt$/, '');
  const f = (d: LibraryDeck) => d.file.toLowerCase().replace(/\.txt$/, '');
  const hit =
    lib.find((d) => f(d) === ql || d.deck.name.toLowerCase() === ql) ??
    lib.find((d) => d.kind === 'meta' && (f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql))) ??
    lib.find((d) => d.kind === 'custom' && (f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql))) ??
    lib.find((d) => f(d).includes(ql) || d.deck.name.toLowerCase().includes(ql));
  if (!hit) throw new Error(`No deck matches "${q}". Try: npm run sim -- catalog`);
  return hit;
}
