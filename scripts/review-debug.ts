// Debug one reviewed decision: replay the game to it and show every play-out of each candidate, world by world.
//   npx tsx scripts/review-debug.ts <review-file> <game-id> <seat> <decision-index> [--alt "<label substring>"]
import fs from 'node:fs';
import { Game } from '../src/engine/engine';
import { makeTierBot } from '../src/ai/tiers';
import { HeuristicAgent, hideInfo } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
import { evaluate } from '../src/ai/eval';
import { makeWorlds, playOut, type PlayOutStep } from '../src/ai/playOut';
import { gameDeck } from '../src/lib/tournament';
import { cli, str } from './lib-node';
import type { Action, Agent, Decision, PlayerId } from '../src/engine/types';

/** Where a play-out stopped, in this report's words. */
const STEP_TEXT: Record<PlayOutStep, string> = {
  move: 'action',
  restOfTurn: 'rest of my turn',
  endPhase: 'my end phase',
  nextStart: 'rival start',
  nextMain: 'rival main',
  nextEnd: 'rival end',
  done: 'done',
};

const { values: V, positionals } = cli(import.meta.url, { alt: str('Pass turn') }, { minPositionals: 4, maxPositionals: 4 });
const [file, id, seatS, idxS] = positionals;
if (!/^[01]$/.test(seatS) || !/^\d+$/.test(idxS) || !/^e\d+-/.test(id)) {
  console.error('error: usage: review-debug.ts <review-file> <game-id like e3-12345> <seat 0|1> <decision-index>');
  process.exit(2);
}
const seat = +seatS as PlayerId;
const target = +idxS;
const altLabel = V.alt;
const rec = (JSON.parse(fs.readFileSync(file, 'utf8')) as { id: string; review: { seed: number; first: PlayerId; names: [string, string] } }[]).find((x) => x.id === id)!;
const ev = JSON.parse(fs.readFileSync(`public/tournaments/event-${id.match(/^e(\d+)-/)![1]}.json`, 'utf8'));
const decks: [ReturnType<typeof gameDeck>, ReturnType<typeof gameDeck>] = [gameDeck({ name: rec.review.names[0], ...ev.decks[rec.review.names[0]] }), gameDeck({ name: rec.review.names[1], ...ev.decks[rec.review.names[1]] })];

class Stop extends Error {}
let k = 0;
class Probe implements Agent {
  name: string;
  constructor(
    public inner: Agent,
    public p: PlayerId,
  ) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision) {
    if (this.p === seat && d.kind === 'action' && d.options.length >= 2) {
      if (k === target) {
        await inspect(g, d);
        throw new Stop();
      }
      k++;
    }
    return this.inner.decide(g, d);
  }
}

async function inspect(g: Game, d: Decision) {
  const P = (p: PlayerId) => `${g.P(p).name}: gigs ${g.P(p).gigs.length}, hand ${g.P(p).hand.length}, units ${g.units(p).length}`;
  console.log(`Turn ${g.s.turn}, seat ${seat} to act. overtime=${g.s.overtime}\n  ${P(0)}\n  ${P(1)}`);
  const actions = d.options.map((o) => o.action as Action);
  const chosenI = (await makeTierBot('deep', 0).decide(g, d))[0];
  const altIdx = d.options.findIndex((o) => o.label.includes(altLabel));
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const worlds = makeWorlds(8, rnd);
  for (const i of [chosenI, altIdx]) {
    console.log(`\n== ${d.options[i].label}`);
    for (const w of worlds) {
      const mk = (seed: number) => new HeuristicAgent({ lookahead: true, maxCandidates: 14, profiles: BEST_PROFILES, seed });
      const cg = g.clone([mk(w.a), mk(w.b)]);
      cg.s.rng = w.rng;
      hideInfo(cg, seat);
      let phase = 'start';
      await playOut(cg, seat, { action: actions[i] }, (s) => (phase = STEP_TEXT[s]));
      console.log(`  eval ${evaluate(cg, seat).toFixed(1).padStart(8)} | stopped at: ${phase.padEnd(16)} | winner ${cg.s.winner} ${cg.s.winReason} | gigs ${cg.P(0).gigs.length}-${cg.P(1).gigs.length} turn ${cg.s.turn}`);
    }
  }
}

const g = Game.create(decks, [new Probe(makeTierBot('deep', rec.review.seed), 0), new Probe(makeTierBot('deep', rec.review.seed + 7777), 1)], { seed: rec.review.seed, first: rec.review.first, log: false });
g.run().catch((e) => {
  if (!(e instanceof Stop)) throw e;
});
