// Optimizer-derived variants of the top deck.
import fs from 'node:fs';
import { exportOfficial, parseDeck, validateDeck } from '../src/engine/deck';
const base = fs.readFileSync('data/decks/meta-rrg-dexter-midrange.txt', 'utf8');
const variants: [string, string, string, string][] = [
  ['rrg-v-smasher-optimized', 'RRG Midrange: V + Smasher (optimized)', 'Dexter DeShawn: Off the Grid', 'Optimizer: Dexter -> V: Streetkid was +4.2 pts over 336 paired games (choom.gg flex note agrees).'],
  ['rrg-v-dexter-optimized', 'RRG Midrange: V + Dexter (optimized)', 'Adam Smasher: Ender of Legends', 'Optimizer: Adam Smasher -> V: Streetkid was +5.1 pts over 336 paired games.'],
];
for (const [slug, name, out, idea] of variants) {
  const { deck } = parseDeck(base);
  deck.name = name;
  deck.legends = deck.legends.map((id) => (id === parseDeck(`1 ${out}`).deck.legends[0] ? 'v_streetkid' : id));
  const v = validateDeck(deck);
  fs.writeFileSync(`data/decks/custom/${slug}.txt`, `${exportOfficial(deck)}\n\n// Idea: ${idea}\n// Source: derived from https://choom.gg/meta/rrg-dexter-midrange\n`);
  console.log(name, deck.legends, v.length ? v : 'legal');
}
