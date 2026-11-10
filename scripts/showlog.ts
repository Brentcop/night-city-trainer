import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { cli, resolveDeck } from './lib-node';
// Print the full log of one game.  npx tsx scripts/showlog.ts <deckA> <deckB> [seed]
const { positionals } = cli(import.meta.url, {}, { minPositionals: 2, maxPositionals: 3 });
const [a, b, seed = '1'] = positionals;
if (!/^\d+$/.test(seed)) {
  console.error(`error: seed must be a whole number, got "${seed}"`);
  process.exit(2);
}
const g = Game.create([resolveDeck(a).deck, resolveDeck(b).deck], [new HeuristicAgent(), new HeuristicAgent()], { seed: +seed });
const s = await g.run();
for (const l of s.log) console.log(`T${l.turn} ${l.player ?? '-'}: ${l.text}`);
