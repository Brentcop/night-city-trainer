import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { resolveDeck } from './lib-node';
const [a, b, n = '4'] = process.argv.slice(2);
const A = resolveDeck(a).deck, B = resolveDeck(b).deck;
let w = [0, 0, 0]; const t0 = Date.now();
for (let i = 0; i < +n; i++) {
  const g = Game.create([A, B], [new HeuristicAgent({ seed: i }), new HeuristicAgent({ seed: i + 50 })], { seed: 1000 + i, first: (i % 2) as 0 | 1 });
  const s = await g.run();
  w[s.winner === 'tie' ? 2 : (s.winner as number)]++;
  console.log(`game ${i}: winner ${s.winner} (${s.winReason}) turns ${s.turn} gigs ${s.players[0].gigs.length}-${s.players[1].gigs.length}`);
}
console.log(A.name, w[0], '-', w[1], B.name, 'ties', w[2], `${((Date.now() - t0) / +n / 1000).toFixed(2)}s/game`);
