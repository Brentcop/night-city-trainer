import { Game } from '../../src/engine/engine';
import { HeuristicAgent } from '../../src/ai/heuristic';
import { resolveDeck } from '../lib-node';
const [a, b, n = '100'] = process.argv.slice(2);
const A = resolveDeck(a).deck, B = resolveDeck(b).deck;
const reasons: Record<string, number> = {};
for (let i = 0; i < +n; i++) {
  const g = Game.create([A, B], [new HeuristicAgent({ seed: i }), new HeuristicAgent({ seed: i + 50 })], { seed: 500 + i, first: 0 });
  const s = await g.run();
  const kk = `${s.winner === 0 ? 'FIRST' : 'SECOND'}: ${s.winReason.replace(/.*empty deck/, 'deckout')} ${s.turn <= 14 ? '<=14' : '>14'}`;
  reasons[kk] = (reasons[kk] ?? 0) + 1;
}
console.log(reasons);
