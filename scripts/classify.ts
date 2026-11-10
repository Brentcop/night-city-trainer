import { classify } from '../src/ai/archetype';
import { cli, loadLibrary } from './lib-node';
// Print each library deck's archetype classification.  npx tsx scripts/classify.ts
cli(import.meta.url, {});
for (const d of loadLibrary()) {
  const c = classify(d.deck.main);
  console.log(c.arch.padEnd(9), c.aggroScore.toFixed(2).padStart(6), `units ${(c.units * 100).toFixed(0)}% cost ${c.avgCost.toFixed(2)} inter ${(c.interaction * 100).toFixed(0)}% flow ${(c.cardFlow * 100).toFixed(0)}%`, d.deck.name.slice(0, 45));
}
