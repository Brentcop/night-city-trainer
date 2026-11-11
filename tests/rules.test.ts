// Core rules checks against the Comprehensive Rules (Oct 29 2026).
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, PlayerId, Zone } from '../src/engine/types';
import { eddies as giveEddies, gig as giveGig, setup as scene, spawn as put } from './engine-helpers';

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

// ENG-13: more of the Comprehensive Rules. Pending order, replacement order and Gear following its Unit are in
// engine-fixes.test.ts; same-seed determinism is in smoke.test.ts.
describe('core rules (ENG-13)', () => {
  it('mulligan: the hand is shuffled back and 6 new cards drawn; declining keeps the hand', async () => {
    const yesFor0: Agent = { name: 'm', decide: async (_g, d) => [d.tag === 'mulligan' && d.player === 0 ? 0 : 1] };
    const g = Game.create([deck('A'), deck('B')], [yesFor0, yesFor0], { seed: 11, first: 0, log: false });
    const before0 = [...g.P(0).hand];
    const before1 = [...g.P(1).hand];
    await g.mulligans();
    expect(g.P(0).hand).toHaveLength(6);
    expect(g.P(0).deck).toHaveLength(34);
    expect(g.P(0).hand).not.toEqual(before0);
    expect(g.P(1).hand).toEqual(before1);
  });

  it('drawing from an empty deck loses the game (deck-out)', async () => {
    const { g } = scene();
    for (const u of [...g.P(0).deck]) g.move(u, 'trash');
    await expect(g.startPhase()).rejects.toThrow();
    expect(g.s.winner).toBe(1);
  });

  it('Go Solo: pay the cost (the Legend itself may help pay), it enters ready and may attack at once; leaving the field removes it', async () => {
    const { g } = scene();
    const v = put(g, 0, 'v_corporate_exile', 'legends'); // cost 5, power 8
    giveEddies(g, 0, 3);
    expect(g.legalActions(0).some((a) => a.type === 'goSolo')).toBe(false); // 3 Eddies + the Legend itself isn't enough
    giveEddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'goSolo')).toBe(true); // 4 Eddies + the Legend itself (general FAQ #10)
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(v.zone).toBe('field');
    expect(v.spent).toBe(false); // spent to pay, but Go Solo plays it "as a ready Unit"
    expect(g.available(0)).toBe(0);
    expect(g.lagPermission(v)).toBe('any');
    giveGig(g, 1, 4, 2);
    expect(g.attackTargets(v)).toEqual([{ unit: null, gigs: 1 }]);
    await g.defeat(v.uid);
    expect(v.zone).toBe('removed');
  });

  it('Call a Legend as a reaction costs 1 €$ and needs a payment source', async () => {
    const { g } = scene();
    g.s.active = 1;
    const att = put(g, 1, vanilla, 'field');
    g.s.attack = { attacker: att.uid, attackerPlayer: 1, targetUnit: null, targetGigs: 0, step: 'react', ended: false };
    expect(g.legalReactions(0).some((r) => r.type === 'call')).toBe(false);
    giveEddies(g, 0, 1);
    const call = g.legalReactions(0).find((r) => r.type === 'call');
    expect(call).toBeDefined();
    await g.doReaction(0, call!);
    expect(g.faceUpLegends(0)).toHaveLength(1);
    expect(g.available(0)).toBe(0);
    expect(g.legalReactions(0).some((r) => r.type === 'call')).toBe(false);
  });

  it('a Blocker redirects an attack on the Gig area into a fight; nothing is stolen', async () => {
    const block = (d: Decision) => (d.kind === 'reaction' ? d.options.findIndex((o) => (o.action as any)?.type === 'block') : undefined);
    const { g } = scene([null, block]);
    const att = put(g, 0, vanilla, 'field'); // power 6
    const blocker = put(g, 1, 'mox_inciters', 'field'); // Blocker, power 2
    const x = giveGig(g, 1, 4, 2);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(blocker.zone).toBe('trash');
    expect(att.zone).toBe('field');
    expect(g.gig(x).controller).toBe(1);
  });

  it('only {Quick} Programs can be played as reactions', async () => {
    const quick = (d: Decision) => {
      const i = d.kind === 'reaction' ? d.options.findIndex((o) => (o.action as any)?.type === 'play') : -1;
      return i >= 0 ? i : undefined;
    };
    const { g } = scene([null, quick]);
    giveEddies(g, 1, 2);
    const fi = put(g, 1, 'floor_it', 'hand'); // {Quick}: a rival Unit gets -1 power, draw 1
    const tno = put(g, 1, 'trust_no_one', 'hand');
    const att = put(g, 0, vanilla, 'field');
    giveGig(g, 1, 4, 2);
    g.s.attack = { attacker: att.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'react', ended: false };
    const plays = g.legalReactions(1).filter((r) => r.type === 'play').map((r) => (r as { uid: number }).uid);
    expect(plays).toEqual([fi.uid]);
    g.s.attack = null;
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(fi.zone).toBe('trash');
    expect(tno.zone).toBe('hand');
  });

  it('lag clears at the end of the turn; a lagging Unit cannot attack until then', async () => {
    const { g } = scene();
    giveEddies(g, 0, 4);
    const u = put(g, 0, vanilla, 'hand');
    await g.playFromHand(0, u.uid);
    giveGig(g, 1, 4, 2);
    expect(u.lag).toBe(true);
    expect(g.attackTargets(u)).toEqual([]);
    await g.endPhase();
    expect(u.lag).toBe(false);
    g.s.active = 0;
    expect(g.attackTargets(u)).toEqual([{ unit: null, gigs: 1 }]);
  });

  it('cost reductions stop at 1 €$; increases are not capped', () => {
    const { g } = scene();
    for (let i = 0; i < 9; i++) put(g, 0, vanilla, 'trash');
    const tto = put(g, 0, 'trauma_team_operatives', 'hand'); // cost 6, -1 per Unit in trash
    expect(g.playCost(tto.uid, 0)).toBe(1);
    const host = put(g, 0, vanilla, 'field');
    const shield = put(g, 0, 'riot_shield', 'hand');
    g.equip(shield.uid, host.uid); // rivals pay +2 to Go Solo
    const v = put(g, 1, 'v_corporate_exile', 'legends');
    expect(g.playCost(v.uid, 1, 'goSolo')).toBe(7);
  });
});
