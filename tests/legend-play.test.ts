// Legends to the field (ENG-14): the ordinary play by paying the cost (4.5) next to Go Solo (11.29), and a Legend
// helping pay for itself (general FAQ #10 for Go Solo; the FAQ text is not in the repo, see the engine comments).
import { describe, expect, it } from 'vitest';
import { HeuristicAgent } from '../src/ai/heuristic';
import { resolveDrop } from '../src/ui/components/board/drag';
import { buildInteraction } from '../src/ui/components/board/interaction';
import type { Decision } from '../src/engine/types';
import { eddies, equip, gig, setup, spawn } from './engine-helpers';

/** setup() with the three starting Legends out of the way and a face-up V: Corporate Exile (cost 5, power 8, Go Solo). */
function scene() {
  const s = setup();
  const { g } = s;
  for (const u of [...g.P(0).legends]) g.move(u, 'removed');
  g.s.trace = [];
  const v = spawn(g, 0, 'v_corporate_exile', 'legends');
  return { ...s, v };
}
const actionsFor = (g: ReturnType<typeof setup>['g'], uid: number) =>
  g
    .legalActions(0)
    .filter((a) => 'uid' in a && a.uid === uid)
    .map((a) => a.type);

describe('playing a Legend to the field by paying its cost (4.5)', () => {
  it('is offered next to Go Solo for a face-up Legend with a cost, never for a face-down or cost-null one', () => {
    const { g, v } = scene();
    const dexter = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends', { spent: true }); // cost null (4.5.3)
    const down = spawn(g, 0, 'royce_psycho_on_the_edge', 'legends', { faceUp: false, spent: true });
    eddies(g, 0, 3);
    expect(actionsFor(g, v.uid)).toEqual([]); // 3 Eddies + V itself < 5
    eddies(g, 0, 1);
    expect(actionsFor(g, v.uid)).toEqual(['goSolo', 'playLegend']);
    expect(actionsFor(g, dexter.uid)).toEqual([]);
    expect(actionsFor(g, down.uid).filter((t) => t !== 'call')).toEqual([]);
  });

  it("is a play, not Go Solo: Riot Shield's Go Solo tax and Nocturne's Go Solo discount don't touch its cost", () => {
    const { g, v } = scene();
    const host = spawn(g, 1, 'psycho_squad', 'field');
    equip(g, 1, 'riot_shield', host);
    eddies(g, 0, 4);
    expect(g.playCost(v.uid, 0, 'goSolo')).toBe(7);
    expect(g.playCost(v.uid, 0)).toBe(5);
    expect(actionsFor(g, v.uid)).toEqual(['playLegend']); // 4 Eddies + V itself: only the ordinary play
    // Nocturne's mode: "a friendly Legend may Go Solo for -2 €$ this turn"
    g.addMod({ kind: 'costMod', player: 0, amount: -2, until: 'endOfTurn', value: { kind: 'goSolo', uid: v.uid } });
    expect(g.playCost(v.uid, 0, 'goSolo')).toBe(5);
    expect(g.playCost(v.uid, 0)).toBe(5);
    expect(actionsFor(g, v.uid)).toEqual(['goSolo', 'playLegend']);
  });

  it('pays the cost, keeps its orientation (ready), enters with Lag and is not a Go Solo Unit: no attack this turn', async () => {
    const { g, v } = scene();
    eddies(g, 0, 5);
    gig(g, 1, 4, 2);
    await g.doAction(0, { type: 'playLegend', uid: v.uid });
    await g.resolvePending();
    expect(v.zone).toBe('field');
    expect(g.P(0).field).toContain(v.uid);
    expect(g.P(0).legends).not.toContain(v.uid);
    expect(v.spent).toBe(false);
    expect(v.lag).toBe(true);
    expect(v.goSolo).toBe(false);
    expect(g.available(0)).toBe(0); // 5 Eddies paid; V was not spent
    expect(g.lagPermission(v)).toBeNull();
    expect(g.attackTargets(v)).toEqual([]);
    expect(g.faceUpLegends(0).map((c) => c.uid)).toContain(v.uid); // still a Legend (4.2.1)
    // its play is told apart from Go Solo in the turn history, the trace and the stats
    expect(g.s.turnEvents!.at(-1)).toMatchObject({ k: 'play', uid: v.uid, type: 'Unit', via: 'legend' });
    expect(g.s.trace!.at(-1)).toMatchObject({ k: 'legend', id: 'v_corporate_exile' });
    expect(g.s.stats.cardsPlayed[0]).toBe(1);
    // Lag clears at the end of the turn; then it attacks like any Unit
    await g.endPhase();
    g.s.active = 0;
    expect(g.attackTargets(v)).toEqual([{ unit: null, gigs: 1 }]);
  });

  it('enters spent if it was spent, including when it helped pay its own cost (4.5.1)', async () => {
    const a = scene();
    eddies(a.g, 0, 4);
    expect(actionsFor(a.g, a.v.uid)).toContain('playLegend'); // 4 Eddies + V itself
    await a.g.doAction(0, { type: 'playLegend', uid: a.v.uid });
    expect(a.v.zone).toBe('field');
    expect(a.v.spent).toBe(true);
    expect(a.v.lag).toBe(true);

    const b = scene();
    b.v.spent = true; // e.g. spent to pay for something earlier this turn
    eddies(b.g, 0, 5);
    await b.g.doAction(0, { type: 'playLegend', uid: b.v.uid });
    expect(b.v.spent).toBe(true);
  });

  it('fires {Play}, keeps its Gear, and is removed from the game if it goes anywhere but the Legends area or field (4.4.1)', async () => {
    const { g } = scene();
    const adam = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends'); // cost 9, {Play} defeat a rival Unit
    const gear = equip(g, 0, 'netwatch_netdriver', adam);
    const rival = spawn(g, 1, 'psycho_squad', 'field');
    eddies(g, 0, 9);
    await g.doAction(0, { type: 'playLegend', uid: adam.uid });
    await g.resolvePending();
    expect(rival.zone).toBe('trash');
    expect(adam.gear).toEqual([gear.uid]);
    expect(gear.zone).toBe('field');
    await g.defeat(adam.uid);
    expect(adam.zone).toBe('removed');
    expect(gear.zone).toBe('trash'); // 4.12.2

    const v = spawn(g, 0, 'v_corporate_exile', 'field');
    g.returnToHand(v.uid);
    expect(v.zone).toBe('removed');
  });

  it('the Legends area is a valid area for it, but not for a Go Solo Legend (11.29.1)', () => {
    const { g } = scene();
    const plain = spawn(g, 0, 'v_corporate_exile', 'field');
    const solo = spawn(g, 0, 'v_streetkid', 'field', { goSolo: true });
    g.move(plain.uid, 'legends');
    g.move(solo.uid, 'legends');
    expect(plain.zone).toBe('legends');
    expect(solo.zone).toBe('removed');
  });
});

describe('Go Solo paying with the Legend itself (general FAQ #10)', () => {
  it('the Legend is spent to pay, still enters ready (11.29.1: "as a ready Unit") and can attack this turn', async () => {
    const { g, v } = scene();
    eddies(g, 0, 4);
    gig(g, 1, 4, 2);
    expect(actionsFor(g, v.uid)).toContain('goSolo');
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    await g.resolvePending();
    expect(v.zone).toBe('field');
    expect(v.spent).toBe(false);
    expect(v.goSolo).toBe(true);
    expect(g.P(0).eddies.every((u) => g.c(u).spent)).toBe(true);
    expect(g.attackTargets(v)).toEqual([{ unit: null, gigs: 1 }]);
    expect(g.s.turnEvents!.at(-1)).toMatchObject({ k: 'play', uid: v.uid, via: 'goSolo' });
    expect(g.s.trace!.at(-1)).toMatchObject({ k: 'solo', id: 'v_corporate_exile' });
  });

  it('automatic payment spends the Legend first (it costs nothing), so an Eddie is left over', async () => {
    const { g, v } = scene();
    eddies(g, 0, 5);
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(g.P(0).eddies.filter((u) => !g.c(u).spent)).toHaveLength(1);
  });

  it('its "when spent" Gear triggers fire, before its {Play}: they became pending while it paid', async () => {
    const { g } = scene();
    const adam = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends'); // Go Solo 9
    equip(g, 0, 'netwatch_netdriver', adam); // when this Unit or Legend is spent, draw 1
    spawn(g, 1, 'psycho_squad', 'field');
    for (let i = 0; i < 3; i++) spawn(g, 0, 'psycho_squad', 'deck');
    eddies(g, 0, 8);
    const hand = g.P(0).hand.length;
    const from = g.s.log.length;
    await g.doAction(0, { type: 'goSolo', uid: adam.uid });
    expect(g.pending.map((x) => x.label)).toEqual(['NetWatch Netdriver (on Adam Smasher: Ender of Legends): when spent', 'Adam Smasher: Ender of Legends {Play}']);
    await g.resolvePending();
    expect(g.P(0).hand.length).toBe(hand + 1);
    expect(adam.spent).toBe(false);
    const lines = g.s.log.slice(from).map((e) => e.text);
    const drew = lines.findIndex((t) => t.startsWith('draws 1'));
    const killed = lines.findIndex((t) => /is defeated/.test(t));
    expect(drew).toBeGreaterThanOrEqual(0);
    expect(killed).toBeGreaterThan(drew);
  });
});

describe('Legends to the field: bots and the Play board', () => {
  const actionDecision = (g: ReturnType<typeof setup>['g']): Decision => {
    const actions = g.legalActions(0);
    return { player: 0, kind: 'action', prompt: 'Choose an action', options: actions.map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
  };

  it('the Legend menu offers both plays, and dragging the Legend to the field asks which', () => {
    const { g, v } = scene();
    eddies(g, 0, 5);
    const d = actionDecision(g);
    const ix = buildInteraction(g, d);
    expect(ix.menus.get(v.uid)!.map((m) => [m.kind, m.label])).toEqual([
      ['goSolo', 'Go Solo (5 €$)'],
      ['playLegend', 'Play to the field (5 €$, with Lag)'],
    ]);
    expect(resolveDrop(g, ix, v.uid, { kind: 'play' }).map((c) => c.label)).toEqual(['Go Solo (5 €$)', 'Play to the field (5 €$, with Lag)']);
  });

  it('bots value both; with both on offer they Go Solo, and they play it by paying its cost when Go Solo is taxed', async () => {
    for (const lookahead of [false, true]) {
      const a = scene();
      eddies(a.g, 0, 5);
      const bot = new HeuristicAgent({ lookahead });
      const d = actionDecision(a.g);
      const pick = d.options[(await bot.decide(a.g, d))[0]].action!;
      expect(pick.type).toBe('goSolo');
      // already spent (e.g. it paid for something): Go Solo still wins, it enters ready where the ordinary play enters spent
      const c = scene();
      c.v.spent = true;
      eddies(c.g, 0, 5);
      const dc = actionDecision(c.g);
      expect(dc.options[(await bot.decide(c.g, dc))[0]].action!.type).toBe('goSolo');

      const b = scene();
      equip(b.g, 1, 'riot_shield', spawn(b.g, 1, 'psycho_squad', 'field')); // Go Solo costs 7
      eddies(b.g, 0, 5);
      const db = actionDecision(b.g);
      expect(db.options.map((o) => o.action!.type)).toContain('playLegend');
      expect(db.options.map((o) => o.action!.type)).not.toContain('goSolo');
      // the lookahead bot plays it out and takes it too: a body on the field beats keeping 5 €$ unspent
      expect(db.options[(await bot.decide(b.g, db))[0]].action!.type).toBe('playLegend');
    }
  });
});
