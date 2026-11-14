// Re-key data/seasons/deck-impact.json (the season breeder's per-list card impact) from deck names to list fingerprints.
//
//   npx tsx scripts/migrate-deck-impact.ts [--write] [--file data/seasons/deck-impact.json]
//
// Each old entry is matched by name to the current library (loadLibrary: data/decks and data/decks/custom). A name that
// exactly one library list has is re-keyed to that list's listFingerprint, with `keyedFrom: 'name'` (its games may
// include ones recorded under that name before a forge change to the list). A name with no list, several lists, or a
// list another name already took goes to the file's `unmatched` section with the reason: kept, never read, never
// given a guessed fingerprint. Numbers and order are kept exactly, so the breeder computes what it computed before.
// Without --write it only prints what it would do. A file already keyed by fingerprint is left alone.
import fs from 'node:fs';
import { bool, cli, loadLibrary, str } from './lib-node';
import { listFingerprint } from '../src/engine/deck';
import { isLegacyDeckImpact, migrateDeckImpact, parseDeckImpact } from '../src/lib/seasonDeckImpact';

const { values: V } = cli(import.meta.url, { write: bool(), file: str('data/seasons/deck-impact.json') });
if (!fs.existsSync(V.file)) {
  console.log(`${V.file} does not exist; nothing to migrate`);
  process.exit(0);
}
const raw: unknown = JSON.parse(fs.readFileSync(V.file, 'utf8'));
if (!isLegacyDeckImpact(raw)) {
  const r = parseDeckImpact(raw);
  if (r.file) console.log(`${V.file} is already keyed by list fingerprint (${Object.keys(r.file.lists).length} lists); nothing to do`);
  else console.error(`error: ${V.file} ${r.problem}`);
  process.exit(r.file ? 0 : 1);
}
const lists = loadLibrary().map((d) => ({ name: d.deck.name, fingerprint: listFingerprint(d.deck), file: d.file }));
const m = migrateDeckImpact(raw, lists);
for (const x of m.matched) console.log(`  ${x.fingerprint}  ${x.name}${x.file ? `  (${x.file})` : ''}`);
for (const x of m.unmatched) console.log(`  unmatched         ${x.name}: ${x.why}`);
console.log(`${m.matched.length} entries re-keyed by list fingerprint, ${m.unmatched.length} kept apart as unmatched`);
if (V.write) {
  fs.writeFileSync(V.file, JSON.stringify(m.file));
  console.log(`wrote ${V.file}`);
} else console.log('dry run: pass --write to rewrite the file');
