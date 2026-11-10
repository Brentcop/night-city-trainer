import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { resolveDeck } from './lib-node';
const [a, b, seed = '1'] = process.argv.slice(2);
const g = Game.create([resolveDeck(a).deck, resolveDeck(b).deck], [new HeuristicAgent(), new HeuristicAgent()], { seed: +seed });
const s = await g.run();
for (const l of s.log) console.log(`T${l.turn} ${l.player ?? '-'}: ${l.text}`);
