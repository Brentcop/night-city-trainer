// Core rules checks against the Comprehensive Rules (Oct 29 2026).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, PlayerId, Zone } from '../src/engine/types';

class FirstAgent implements Agent {
  name = 'First';
  async decide(_g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'reaction') return [d.options.findIndex((o) => (o.action as any)?.type === 'endReact')];
    if (d.kind === 'yesno') return [1]; // "no"
    return [0];
  }
}
const vanilla = 'psycho_squad'; // 4-cost 6-power, no text
function deck(name: string): DeckList {
  return { name, legends: ['dexter_deshawn_off_the_grid', 'v_streetkid', 'royce_psycho_on_the_edge'], main: Array(40).fill(vanilla), sideboard: [] };
}
function setup(first: PlayerId = 0) {
  const g = Game.create([deck('A'), deck('B')], [new FirstAgent(), new FirstAgent()], { seed: 3, first, log: false });
  return g;
}
function spawn(g: Game, p: PlayerId, defId: string, zone: Zone, opts: { lag?: boolean; spent?: boolean } = {}) {
  const uid = g.s.nextUid++;
  g.s.cards[uid] = { uid, defId, owner: p, controller: p, zone, spent: !!opts.spent, faceUp: true, lag: !!opts.lag, gear: [], host: null, enteredTurn: 0, goSolo: false };
  (g.P(p) as any)[zone].push(uid);
  return g.c(uid);
}
function giveGigs(g: Game, p: PlayerId, n: number) {
  for (const id of g.P(p).fixer.slice(0, n)) {
    const x = g.gig(id);
    x.controller = p;
    x.value = 2;
    g.P(p).fixer = g.P(p).fixer.filter((y) => y !== id);
    g.P(p).gigs.push(id);
  }
}

describe('core rules', () => {
  it('first player starts with two left-most Legends spent (7.7.4)', () => {
    const g = setup(0);
    expect(g.P(0).legends.filter((u) => g.c(u).spent)).toHaveLength(2);
    expect(g.P(1).legends.filter((u) => g.c(u).spent)).toHaveLength(0);
    expect(g.P(0).hand).toHaveLength(6);
  });

  it('steal count is floor(P/10)+1, power 0 steals nothing (9.20.1)', () => {
    const g = setup();
    const u = spawn(g, 0, vanilla, 'field');
    expect(g.stealCount(u)).toBe(1); // 6 power
    g.givePower(u.uid, 4);
    expect(g.stealCount(u)).toBe(2); // 10 power
    g.givePower(u.uid, 10);
    expect(g.stealCount(u)).toBe(3); // 20
    g.givePower(u.uid, -30);
    expect(g.power(u)).toBe(0); // negative treated as 0 (2.10.1)
    expect(g.stealCount(u)).toBe(0);
  });

  it('equal power: both lose and both are defeated; 0 power cannot defeat (11.4)', async () => {
    const g = setup();
    g.s.active = 0;
    const a = spawn(g, 0, vanilla, 'field');
    const b = spawn(g, 1, vanilla, 'field', { spent: true });
    await g.attack(0, a.uid, { unit: b.uid, gigs: null });
    expect(a.zone).toBe('trash');
    expect(b.zone).toBe('trash');
    const zero = spawn(g, 0, 'tyger_s_whisper', 'field'); // 0 power
    const c = spawn(g, 1, vanilla, 'field', { spent: true });
    await g.attack(0, zero.uid, { unit: c.uid, gigs: null });
    expect(zero.zone).toBe('trash');
    expect(c.zone).toBe('field');
  });

  it('lagging Units cannot attack; ready rival Units are not attack targets (9.3)', () => {
    const g = setup();
    g.s.active = 0;
    const lagging = spawn(g, 0, vanilla, 'field', { lag: true });
    const ok = spawn(g, 0, vanilla, 'field');
    spawn(g, 1, vanilla, 'field'); // ready rival unit
    expect(g.attackTargets(lagging)).toHaveLength(0);
    expect(g.attackTargets(ok)).toHaveLength(0); // no gigs, rival unit is ready
    giveGigs(g, 1, 1);
    expect(g.attackTargets(ok)).toEqual([{ unit: null, gigs: 1 }]);
  });

  it('sell and Call are once per turn each (8.11.1, 8.12.1)', async () => {
    const g = setup(1);
    g.s.turn = 2;
    g.s.active = 0;
    const p = 0;
    const sellable = spawn(g, p, 'floor_it', 'hand');
    spawn(g, p, 'detonate', 'hand');
    await g.doAction(p, { type: 'sell', uid: sellable.uid });
    expect(g.legalActions(p).some((a) => a.type === 'sell')).toBe(false);
    const leg = g.P(p).legends[0];
    await g.doAction(p, { type: 'call', uid: leg });
    expect(g.c(leg).faceUp).toBe(true);
    expect(g.legalActions(p).some((a) => a.type === 'call')).toBe(false);
  });

  it('7 Gigs at the start of your turn wins (1.10)', async () => {
    const g = setup(0);
    giveGigs(g, 1, 6);
    // steal one more from player 0
    const x = g.gig(g.P(0).fixer[0]);
    x.controller = 1;
    g.P(0).fixer = g.P(0).fixer.slice(1);
    g.P(1).gigs.push(x.id);
    g.s.active = 1;
    await expect(g.startPhase()).rejects.toThrow();
    expect(g.s.winner).toBe(1);
  });

  it('passive players reach overtime, then the safety turn limit ends the game', async () => {
    const g = setup(0);
    const st = await g.run();
    expect(st.overtime).toBe(true);
    expect(st.winner).toBe('tie');
  });
});
