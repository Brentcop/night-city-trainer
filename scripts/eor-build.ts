// Build a ready-to-register list with a 7-card sideboard from per-matchup optimizer reports.
//   npx tsx scripts/eor-build.ts <deck> --vs meta-bbg,meta-rrg [--force]
// Refuses to replace an existing <deck>-eor.txt unless --force.
// Reads reports/optimize-<deck>-vs-<opp>-latest.md; sideboard = best non-Legend "+1" cards (Δ ≥ 2) across matchups,
// topped up with the format's highest-impact legal removal. Writes data/decks/custom/<deck>-eor.txt.
import fs from 'node:fs';
import { CARDS, findCard } from '../src/engine/cards';
import { counts, exportChoom, ramLimits, validateDeck } from '../src/engine/deck';
import { ROLES, cardValue } from '../src/ai/knowledge';
import { bool, cli, resolveDeck, str } from './lib-node';

const { values: V, positionals } = cli(import.meta.url, { vs: str(''), force: bool() }, { minPositionals: 1, maxPositionals: 1 });
const base = resolveDeck(positionals[0]);
const opps = V.vs ? V.vs.split(',') : [];
if (!opps.length) {
  console.error('error: --vs <opponent,opponent…> is required');
  process.exit(2);
}
const slug = base.file.replace(/\.txt$/, '');
const OUT = `data/decks/custom/${slug}-eor.txt`;
if (fs.existsSync(OUT) && !V.force) {
  console.error(`error: ${OUT} already exists. Pass --force to rebuild it.`);
  process.exit(1);
}
const score = new Map<string, number>();
const notes: string[] = [];
for (const o of opps) {
  const opp = resolveDeck(o);
  const f = `reports/optimize-${slug}-vs-${opp.file.replace(/\.txt$/, '')}-latest.md`;
  if (!fs.existsSync(f)) continue;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\| -1 (.+?) \/ \+1 (.+?) \| [\d.]+% \| [\d.]+% \| ([+-][\d.]+) \|$/);
    if (!m || parseFloat(m[3]) < 2) continue;
    const add = findCard(m[2]);
    if (!add) continue;
    score.set(add.id, (score.get(add.id) ?? 0) + parseFloat(m[3]));
    notes.push(`vs ${opp.deck.name}: -1 ${m[1]} / +1 ${m[2]} (${m[3]})`);
  }
}
const deck = structuredClone(base.deck);
const lim = ramLimits(deck);
const inMain = counts(deck.main);
const side: string[] = [];
for (const [id] of [...score.entries()].sort((a, b) => b[1] - a[1])) {
  const room = 3 - (inMain.get(id) ?? 0);
  for (let k = 0; k < Math.min(room, 3) && side.length < 7; k++) side.push(id);
}
// top up with strong legal interaction not already maxed
const fillers = CARDS.filter((c) => c.type !== 'Legend' && c.ram <= lim[c.color] && (ROLES[c.id] ?? []).some((r) => r === 'removal' || r === 'protection'))
  .sort((a, b) => cardValue(b.id) - cardValue(a.id));
for (const c of fillers) {
  if (side.length >= 7) break;
  const used = (inMain.get(c.id) ?? 0) + side.filter((x) => x === c.id).length;
  for (let k = used; k < 3 && side.length < 7 && k < used + 2; k++) side.push(c.id);
}
deck.sideboard = side;
deck.name = `${base.deck.name} — EOR build`;
const v = validateDeck(deck);
fs.writeFileSync(
  OUT,
  `${exportChoom(deck)}\n\n// Idea: Ready-to-register list for EOR Chicago. Sideboard from per-matchup optimizer runs: ${notes.join('; ') || 'none above +2, topped up with the best legal interaction'}.\n`,
);
console.log(deck.name, v.length ? v : 'legal', deck.sideboard);
