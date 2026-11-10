// Verify recorded tournament games replay identically (same winner/turns) outside the worker.
import fs from 'node:fs';
import { Game } from '../src/engine/engine';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
const e = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mk = (bot: string, seed: number) =>
  bot === 'fast' ? new HeuristicAgent({ lookahead: false, seed }) : bot === 'deep' ? new HeuristicAgent({ seed, noise: 0.15, deep: 3, profiles: BEST_PROFILES }) : new HeuristicAgent({ seed, noise: 0.15, profiles: BEST_PROFILES });
let ok = 0, bad = 0;
for (const m of e.rounds[0].matches.slice(0, +(process.argv[3] ?? 4))) {
  if (!m.b) continue;
  for (const gm of m.games) {
    const A = e.decks[m.a], B = e.decks[m.b];
    const g = Game.create([{ name: m.a, legends: A.legends, main: A.main, sideboard: [] }, { name: m.b, legends: B.legends, main: B.main, sideboard: [] }], [mk(e.bot, gm.seed), mk(e.bot, gm.seed + 7777)], { seed: gm.seed, first: gm.first, log: false });
    const s = await g.run();
    const same = (s.winner ?? 'tie') === gm.winner && s.turn === gm.turns;
    same ? ok++ : bad++;
    if (!same) console.log('MISMATCH', m.a, m.b, gm, s.winner, s.turn);
  }
}
console.log(`replay check: ${ok} identical, ${bad} different`);
