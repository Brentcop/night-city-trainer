// C.1's intended-effect tracer (scripts/cred-trace.ts, botcheck --cred-trace): observe-only, the groups it reports, the
// paired ratio.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { DeckList } from '../src/engine/types';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES } from '../src/ai/archetype';
import { stateHash } from '../src/lib/savedGames';
import { credGroup, emptyCredEnds, pairedRatio, traceCred } from '../scripts/cred-trace';
import { loadLibrary } from '../scripts/lib-node';

const lib = loadLibrary();
const deck = (file: string): DeckList => lib.find((d) => d.file.endsWith(file))!.deck;
const GRY = deck('meta-gry-trauma-team.txt');
const YYB = deck('meta-yyb-rogue-gear.txt');
const medium = (seed: number) => new HeuristicAgent({ noise: 0.15, profiles: BEST_PROFILES, seed });

async function play(seed: number, trace: boolean) {
  const answers: string[] = [];
  const rec = (a: HeuristicAgent) => ({ name: a.name, decide: async (g: Game, d: Parameters<HeuristicAgent['decide']>[1]) => { const r = await a.decide(g, d); answers.push(`${d.kind}/${d.tag ?? ''} ${r}`); return r; } });
  const g = Game.create([GRY, YYB], [rec(medium(seed)), rec(medium(seed + 7777))], { seed, first: 0, log: false });
  const ends = emptyCredEnds();
  if (trace) traceCred(g, ends);
  const end = await g.run();
  return { hash: stateHash(end), answers, ends, turns: end.turn };
}

describe('the C.1 tracer', () => {
  it('only observes: a traced game is the same game', async () => {
    const a = await play(9101, false);
    const b = await play(9101, true);
    expect(b.hash).toBe(a.hash);
    // every end phase counted once for each seat: its own turn ends and the rival's add up to the turns played (give or take the last)
    const total = b.ends[0].own.ends + b.ends[0].rival.ends;
    expect(total).toBe(b.ends[1].own.ends + b.ends[1].rival.ends);
    expect(Math.abs(total - b.turns)).toBeLessThanOrEqual(1);
    for (const s of b.ends) for (const c of [s.own, s.rival]) expect(c.even + c.odd + c.nul).toBe(c.ends);
  }, 30_000);

  it('groups: 11 decks built around an even Street Cred, others with a Street Cred card, Gig parity decks', () => {
    const groups = lib.map((d) => credGroup(d.deck));
    expect(groups.filter((x) => x === 'built').length).toBe(11);
    expect(groups.filter((x) => x === 'some').length).toBeGreaterThan(0);
    expect(groups.filter((x) => x === 'gigParity').length).toBeGreaterThan(0);
    expect(credGroup(GRY)).toBe('built');
    expect(credGroup(YYB)).toBe('gigParity');
  });

  it('the paired ratio: pooled per config, the difference with a cluster interval', () => {
    const r = pairedRatio([
      { aNum: 3, aDen: 4, bNum: 1, bDen: 4 },
      { aNum: 2, aDen: 4, bNum: 2, bDen: 4 },
      { aNum: 4, aDen: 4, bNum: 1, bDen: 4 },
    ]);
    expect(r.a).toBeCloseTo(9 / 12, 12);
    expect(r.b).toBeCloseTo(4 / 12, 12);
    expect(r.diff).toBeCloseTo(5 / 12, 12);
    expect(r.lo).toBeLessThan(r.diff);
    expect(r.hi).toBeGreaterThan(r.diff);
    expect(r.hi - r.diff).toBeCloseTo(r.diff - r.lo, 12);
  });
});
