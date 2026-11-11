// Regression tests for the WP-B1 engine and card-script fixes (2026-11-10 review). Each scenario is the reviewer's repro.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { eddies, equip, gig, play, setup, spawn } from './engine-helpers';

const hand = (g: Game, p: 0 | 1) => g.P(p).hand.length;

describe('ENG-1 replacement effects: mandatory before optional (10.28)', () => {
  it('Deadman Transmitter applies before Jackie Welles is offered, whatever the board order', async () => {
    const { g, agents } = setup();
    eddies(g, 0, 2);
    const jackie = spawn(g, 0, 'jackie_welles_mama_s_favorite', 'field', { goSolo: true }); // earlier in field order
    const victim = spawn(g, 0, 'psycho_squad', 'field');
    const dm = equip(g, 0, 'deadman_transmitter', victim);
    expect(await g.defeat(victim.uid)).toBe(false);
    await g.resolvePending();
    expect(victim.zone).toBe('field');
    expect(dm.zone).toBe('trash');
    expect(jackie.zone).toBe('field');
    expect(agents[0].log.some((d) => d.tag === 'replaceDefeat')).toBe(false);
  });

  it('Deadman Transmitter does not protect a Legend in the Legends area', async () => {
    const { g } = setup();
    eddies(g, 0, 1);
    const jackie = spawn(g, 0, 'jackie_welles_mama_s_favorite', 'legends');
    const dm = equip(g, 0, 'deadman_transmitter', jackie);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    await g.defeat(u.uid); // Jackie: "yes, pay 1 and defeat Jackie instead"
    await g.resolvePending();
    expect(u.zone).toBe('field');
    expect(jackie.zone).toBe('removed');
    expect(dm.zone).toBe('trash'); // 4.12.2: the Gear stays in the trash
  });
});

describe('ENG-2 effect steals obey steal restrictions (11.5.1.3)', () => {
  // FAQ Chrome Fang #5: a Unit with "when this Unit steals a Gig, steal an additional Gig" still can't take a Gig with a
  // value higher than its power after Chrome Fang's {Play}.
  it("Chrome Fang's ban applies to stealOne", async () => {
    const { g } = setup();
    const att = spawn(g, 0, 'psycho_squad', 'field'); // power 6
    const big = gig(g, 1, 20, 15);
    const small = gig(g, 1, 4, 3);
    g.addMod({ kind: 'stealBan', player: 1, value: { cmp: 'gt' }, until: 'startOfTurn', untilPlayer: 1 });
    expect(g.stealableGigs(att, 1).map((x) => x.id)).toEqual([small]);
    await g.stealOne(0, att.uid);
    expect(g.gig(big).controller).toBe(1);
    expect(g.gig(small).controller).toBe(0);
  });

  it("Westbrook Netrunner's ban applies to a Legend's effect steal", async () => {
    const { g } = setup();
    const v = spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true }); // power 8
    const low = gig(g, 1, 6, 5);
    g.addMod({ kind: 'stealBan', player: 1, value: { cmp: 'lt', legendsOnly: true }, until: 'startOfTurn', untilPlayer: 1 });
    await g.stealOne(0, v.uid);
    expect(g.gig(low).controller).toBe(1);
  });

  it('Take Control ("steals 1 fewer Gig") cancels an effect steal', async () => {
    const { g } = setup();
    const att = spawn(g, 0, 'psycho_squad', 'field');
    const x = gig(g, 1, 6, 2);
    g.addMod({ kind: 'stealMod', target: att.uid, amount: -1, until: 'endOfTurn' });
    await g.stealOne(0, att.uid);
    expect(g.gig(x).controller).toBe(1);
  });

  // Official rules FAQ (2026-11-09), Take Control #1: "When a rival Unit attempts to steal a Gig through an effect, it
  // steals 1 fewer Gig this turn while under the effect of Take Control." — Yes. Confirms the reading of 11.5.1.3.
  it('FAQ Take Control #1: an effect steal (Gorilla Arms) also steals 1 fewer', async () => {
    const { g } = setup();
    const att = spawn(g, 0, 'psycho_squad', 'field'); // power 6
    equip(g, 0, 'gorilla_arms', att); // +3 → 9
    g.addMod({ kind: 'power', target: att.uid, amount: 1, until: 'endOfTurn' }); // 10: the attack steals 2
    g.addMod({ kind: 'stealMod', target: att.uid, amount: -1, until: 'endOfTurn' }); // Take Control
    gig(g, 0, 6, 1); // a friendly value, so Gorilla Arms has rival Gigs it could take
    const gigs = [gig(g, 1, 6, 2), gig(g, 1, 8, 3), gig(g, 1, 10, 4)];
    expect(g.stealCount(att)).toBe(1);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    // the attack steals 2 − 1 = 1; Gorilla Arms triggers and its effect steal of 1 becomes 0
    expect(gigs.filter((x) => g.gig(x).controller === 0)).toHaveLength(1);
  });

  // FAQ Take Control #2: a Gorilla Arms Unit at 9 power that can steal 0 Gigs because of Take Control does not trigger
  // Gorilla Arms.
  it('FAQ Take Control #2: a 9-power Gorilla Arms Unit reduced to 0 steals does not trigger it', async () => {
    const { g } = setup();
    const att = spawn(g, 0, 'psycho_squad', 'field'); // 6 + 3 = 9: steals 1
    equip(g, 0, 'gorilla_arms', att);
    g.addMod({ kind: 'stealMod', target: att.uid, amount: -1, until: 'endOfTurn' });
    const gigs = [gig(g, 1, 6, 2), gig(g, 1, 8, 3)];
    expect(g.stealCount(att)).toBe(0);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(gigs.every((x) => g.gig(x).controller === 1)).toBe(true);
  });

  it('Appetite for Destruction cannot take a Gig Chrome Fang protects', async () => {
    const { g } = setup();
    const big = gig(g, 1, 20, 15);
    eddies(g, 0, 5);
    const att = spawn(g, 0, 'royce_don_t_call_me_simon', 'field'); // power 4
    const tgt = spawn(g, 1, 'japantown_jonin', 'field', { spent: true }); // power 0
    g.addMod({ kind: 'stealBan', player: 1, value: { cmp: 'gt' }, until: 'startOfTurn', untilPlayer: 1 });
    await play(g, 0, spawn(g, 0, 'appetite_for_destruction', 'hand'));
    await g.attack(0, att.uid, { unit: tgt.uid, gigs: null });
    await g.resolvePending();
    expect(tgt.zone).toBe('trash');
    expect(g.gig(big).controller).toBe(1);
  });
});

// No current card readies a Unit while it is being attacked, so these build the situation directly: the defender's
// reaction readies the target (as a future "ready a friendly Unit" Quick effect would).
describe('ENG-7 an attack ends when its Unit target stops being a valid target (9.21.3)', () => {
  const readyTargetOnReact = (target: () => number) => (d: { kind: string; options: { action?: unknown }[] }, g: Game) => {
    if (d.kind !== 'reaction') return undefined;
    g.ready(target());
    return d.options.findIndex((o) => (o.action as { type: string }).type === 'endReact');
  };

  it('a spent target readied during the attack: the attack ends, no fight', async () => {
    let tgt = -1;
    const { g } = setup([null, readyTargetOnReact(() => tgt) as never]);
    const att = spawn(g, 0, 'psycho_squad', 'field'); // 6
    const t = spawn(g, 1, 'royce_don_t_call_me_simon', 'field', { spent: true }); // 4: would lose the fight
    tgt = t.uid;
    spawn(g, 1, 'psycho_squad', 'field', { spent: true }); // a second Unit, so the defender is asked to react
    eddies(g, 1, 1);
    spawn(g, 1, 'detonate', 'hand'); // a legal reaction, so the window opens
    await g.attack(0, att.uid, { unit: t.uid, gigs: null });
    await g.resolvePending();
    expect(t.zone).toBe('field');
    expect(t.spent).toBe(false);
    expect(g.s.attack).toBeNull();
    expect(g.s.log.some((e) => /fights|is defeated/.test(e.text))).toBe(false);
  });

  it('with a permission to attack ready Units (used up at declaration) the attack goes on', async () => {
    let tgt = -1;
    const { g } = setup([null, readyTargetOnReact(() => tgt) as never]);
    const att = spawn(g, 0, 'psycho_squad', 'field');
    const t = spawn(g, 1, 'royce_don_t_call_me_simon', 'field', { spent: true });
    tgt = t.uid;
    eddies(g, 1, 1);
    spawn(g, 1, 'detonate', 'hand');
    g.addMod({ kind: 'attackReady', target: att.uid, value: 'once', until: 'endOfTurn' });
    await g.attack(0, att.uid, { unit: t.uid, gigs: null });
    await g.resolvePending();
    expect(g.hasMod('attackReady', att.uid)).toBe(false); // used up
    expect(t.zone).toBe('trash'); // the fight happened
  });
});

describe('ENG-3 pending order (10.13, 10.14.1)', () => {
  it('the turn player resolves first; the resolving player finishes their new effects before the rival', async () => {
    const { g } = setup();
    const order: string[] = [];
    g.enqueue(1, 'X', async () => void order.push('X(rival)'));
    g.enqueue(0, 'Y', async () => void order.push('Y(turn player)'));
    await g.resolvePending();
    expect(order).toEqual(['Y(turn player)', 'X(rival)']);

    order.length = 0;
    g.enqueue(1, 'E1', async () => {
      order.push('E1');
      g.enqueue(0, 'A', async () => void order.push('A(turn player, new)'));
      g.enqueue(1, 'B', async () => void order.push('B(rival, new)'));
    });
    g.enqueue(1, 'E2', async () => void order.push('E2'));
    await g.resolvePending();
    expect(order).toEqual(['E1', 'E2', 'B(rival, new)', 'A(turn player, new)']);
  });
});

describe('BY-1, BY-2, RG-8 "the first time ... each turn" counts the whole turn', () => {
  it('Jackie Welles (Pour One Out) does not trigger on the second Blue Unit after being Called', async () => {
    const { g, agents } = setup();
    const j = spawn(g, 0, 'jackie_welles_pour_one_out_for_me', 'legends', { faceUp: false });
    gig(g, 0, 6, 3);
    eddies(g, 0, 10);
    await play(g, 0, spawn(g, 0, 'psycho_squad', 'hand')); // first Blue Unit, Jackie face-down
    await g.callLegend(0, j.uid, { free: true });
    await g.resolvePending();
    await play(g, 0, spawn(g, 0, 'mox_inciters', 'hand')); // second Blue Unit
    expect(agents[0].log.some((d) => d.tag === 'adjust')).toBe(false);
    expect(g.gigsOf(0)[0].value).toBe(3);
  });

  it('Viktor Vektor (Drop Your Illusions) does not discount a second Cyberware Gear played after him', async () => {
    const { g } = setup();
    eddies(g, 0, 20);
    spawn(g, 0, 'psycho_squad', 'field');
    await play(g, 0, spawn(g, 0, 'kiroshi_optics', 'hand')); // the turn's first Cyberware Gear
    await play(g, 0, spawn(g, 0, 'viktor_vektor_drop_your_illusions', 'hand'));
    const ga = spawn(g, 0, 'gorilla_arms', 'hand');
    expect(g.playCost(ga.uid, 0)).toBe(4);
    expect(g.script(spawn(g, 0, 'viktor_vektor_drop_your_illusions', 'hand')).partial).toBeUndefined();
  });

  it('Yorinobu (Embracing Destruction) does not draw for the second Arasaka attack after being Called', async () => {
    const { g } = setup();
    const yor = spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends', { faceUp: false });
    gig(g, 0, 20, 20);
    gig(g, 0, 12, 12);
    const m1 = spawn(g, 0, 'minotaur', 'field');
    const m2 = spawn(g, 0, 'minotaur', 'field');
    gig(g, 1, 4, 2);
    await g.attack(0, m1.uid, { unit: null, gigs: 1 });
    yor.faceUp = true;
    gig(g, 1, 6, 2);
    const before = hand(g, 0);
    await g.attack(0, m2.uid, { unit: null, gigs: 1 });
    expect(hand(g, 0) - before).toBe(0);
  });

  it('Yorinobu (Embracing Destruction) draws for the first Arasaka attack', async () => {
    const { g } = setup();
    spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends');
    gig(g, 0, 20, 20);
    const m1 = spawn(g, 0, 'minotaur', 'field');
    gig(g, 1, 4, 2);
    const before = hand(g, 0);
    await g.attack(0, m1.uid, { unit: null, gigs: 1 });
    expect(hand(g, 0) - before).toBe(1);
  });

  it('Yorinobu (Steel Dragon) does not draw if an Arasaka Unit was already defeated this turn', async () => {
    const { g } = setup();
    const a = spawn(g, 1, 'field_operator', 'field'); // ARASAKA
    await g.defeat(a.uid);
    spawn(g, 0, 'yorinobu_arasaka_steel_dragon', 'field');
    const b = spawn(g, 1, 'field_operator', 'field');
    const before = hand(g, 0);
    await g.defeat(b.uid);
    await g.resolvePending();
    expect(hand(g, 0) - before).toBe(0);
  });

  it('Gorilla Arms equipped after its Unit already stole this turn does not trigger', async () => {
    const { g } = setup();
    const host = spawn(g, 0, 'psycho_squad', 'field');
    gig(g, 1, 4, 3);
    gig(g, 1, 6, 5);
    gig(g, 1, 8, 7);
    await g.steal(host.uid, 1);
    equip(g, 0, 'gorilla_arms', host);
    await g.steal(host.uid, 1);
    await g.resolvePending();
    expect(g.P(0).gigs).toHaveLength(2);
  });

  it('per-turn history is cleared at the start of each turn', async () => {
    const { g } = setup();
    await play(g, 0, spawn(g, 0, 'psycho_squad', 'hand', {}));
    expect(g.turnCount('play')).toBe(0); // not paid: no Eddies
    eddies(g, 0, 4);
    await play(g, 0, spawn(g, 0, 'psycho_squad', 'hand'));
    expect(g.turnCount('play')).toBe(1);
    g.s.active = 1;
    await g.startPhase();
    expect(g.s.turnEvents).toEqual([]);
    expect(Object.values(g.s.once).every((t) => t === g.s.turn)).toBe(true);
  });
});

describe('BY-4 Reboot Optics', () => {
  it('covers a rival Unit that enters play after it resolves, once', async () => {
    const { g } = setup();
    eddies(g, 0, 2);
    await play(g, 0, spawn(g, 0, 'reboot_optics', 'hand'));
    const mine = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    const theirs = spawn(g, 1, 'animals_wrecker', 'field'); // power 10, entered after Reboot Optics
    g.s.active = 1;
    await g.attack(1, theirs.uid, { unit: mine.uid, gigs: null });
    expect(mine.zone).toBe('field');
    expect(g.s.mods.some((m) => m.kind === 'noDefeatOpp')).toBe(false);
    theirs.spent = false;
    await g.attack(1, theirs.uid, { unit: mine.uid, gigs: null });
    expect(mine.zone).toBe('trash');
    expect(g.script(theirs).partial).toBeUndefined();
  });
});

describe('BY-5 "No change" only for "up to" adjustments', () => {
  it('Muamar Reyes must adjust a Gig by exactly 1; Afterparty may choose no change', async () => {
    const { g, agents } = setup();
    const m = spawn(g, 0, 'muamar_reyes_el_capitan', 'legends');
    const x = gig(g, 0, 6, 3);
    await g.activate(0, m.uid, m.uid, 0);
    const d = agents[0].log.find((y) => y.tag === 'adjust')!;
    expect(d.options.some((o) => o.key === 'none')).toBe(false);
    expect(g.gig(x).value).not.toBe(3);
    eddies(g, 0, 1);
    await play(g, 0, spawn(g, 0, 'afterparty_at_lizzie_s', 'hand'));
    const d2 = agents[0].log.filter((y) => y.tag === 'adjust')[1];
    expect(d2.options.some((o) => o.key === 'none')).toBe(true);
  });
});

describe('RG-7 MaxTac Squadron', () => {
  it('"if this Unit is spent" is checked when the end of turn begins, so Saul Bright readying it first does not stop it', async () => {
    const { g } = setup();
    const saul = spawn(g, 0, 'saul_bright_stormrider', 'field', { spent: true });
    const mt = spawn(g, 0, 'maxtac_squadron', 'field', { spent: true });
    const leg = g.c(g.P(0).legends[0]);
    leg.faceUp = true;
    leg.spent = true;
    await g.endPhase();
    expect(saul.spent).toBe(false);
    expect(mt.spent).toBe(false);
    expect(leg.spent).toBe(false);
  });

  it('does nothing if it was ready at the end of turn', async () => {
    const { g } = setup();
    spawn(g, 0, 'maxtac_squadron', 'field');
    const leg = g.c(g.P(0).legends[0]);
    leg.faceUp = true;
    leg.spent = true;
    await g.endPhase();
    expect(leg.spent).toBe(true);
  });
});

describe('RG-9 Panam Palmer: Strength Through Family', () => {
  it('makes the normal Call free during your turn only', async () => {
    const { g } = setup();
    spawn(g, 0, 'panam_palmer_strength_through_family', 'field');
    expect(g.available(0)).toBe(0);
    const call = g.legalActions(0).find((a) => a.type === 'call');
    expect(call).toBeDefined();
    await g.doAction(0, call!);
    expect(g.faceUpLegends(0).length).toBe(1);
    expect(g.legalActions(0).some((a) => a.type === 'call')).toBe(false); // still one Call per turn
    g.s.active = 1;
    expect(g.callCost(0)).toBe(1);
    expect(g.callCost(1)).toBe(1);
  });
});

describe('ENG-6 Gear follows its Unit (4.12)', () => {
  it('to the removed zone, and stays in the trash when a Legend is removed', async () => {
    const { g } = setup();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const mb = equip(g, 0, 'mantis_blades', u);
    g.move(u.uid, 'removed');
    expect(mb.zone).toBe('removed');
    const v = spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true });
    const k = equip(g, 0, 'kiroshi_optics', v);
    await g.defeat(v.uid);
    expect(v.zone).toBe('removed');
    expect(k.zone).toBe('trash');
  });

  it('an equipped Unit and its Gear are bottom-decked in a random order', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 16; seed++) {
      const { g } = setup([null, null], seed);
      const u = spawn(g, 0, 'psycho_squad', 'field');
      const mb = equip(g, 0, 'mantis_blades', u);
      g.bottomDeck(u.uid);
      const tail = g.P(0).deck.slice(-2);
      expect([...tail].sort()).toEqual([u.uid, mb.uid].sort());
      expect(mb.zone).toBe('deck');
      orders.add(tail[0] === u.uid ? 'unit-first' : 'gear-first');
    }
    expect(orders.size).toBe(2);
  });
});

describe('ENG-7 an attack ends when its target is no longer valid (9.21.3)', () => {
  it('a new restriction on the attacker ends the attack before the steal', async () => {
    for (const restricted of [false, true]) {
      const { g } = setup();
      const att = spawn(g, 0, 'psycho_squad', 'field', { enteredTurn: restricted ? 3 : 0, spent: true });
      const x = gig(g, 1, 4, 2);
      g.s.attack = { attacker: att.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'declare', ended: false };
      spawn(g, 1, 'maxtac_suppression_team', 'field'); // rival Units can't attack the turn they're played
      await g.attackRest(att.uid);
      expect(g.gig(x).controller).toBe(restricted ? 1 : 0);
      expect(g.s.attack).toBeNull();
    }
  });
});

describe('ENG-4, ENG-5, ENG-10 clone and pending guards', () => {
  it('clone() leaves the log and trace out unless keepLog is set', () => {
    const { g, agents } = setup();
    g.s.trace = [{ t: 1, p: 0, k: 'draw' }];
    g.log(0, 'hello');
    expect(g.s.log.length).toBeGreaterThan(0);
    const a = g.clone(agents);
    expect(a.s.log).toEqual([]);
    expect(a.s.trace).toBeUndefined();
    expect(g.s.log.length).toBeGreaterThan(0); // the original keeps its log
    expect(g.s.trace).toHaveLength(1);
    const b = g.clone(agents, { keepLog: true });
    expect(b.s.log).toEqual(g.s.log);
    b.s.log[0].text = 'changed';
    expect(g.s.log[0].text).not.toBe('changed');
    expect(b.logEnabled).toBe(false);
  });

  it('clone() and resume() refuse to drop pending effects', async () => {
    const { g, agents } = setup();
    g.enqueue(0, 'pending thing', async () => {});
    expect(() => g.clone(agents)).toThrow(/pending/);
    await expect(g.resume()).rejects.toThrow(/pending/);
    await g.resolvePending();
    expect(() => g.clone(agents)).not.toThrow();
  });

  it('non-clonable state fails loudly instead of being dropped', () => {
    const { g, agents } = setup();
    // @ts-expect-error a function filter is what the Mod type forbids; this checks the runtime guard as well
    g.addMod({ kind: 'costMod', player: 0, amount: -1, until: 'endOfTurn', value: () => true });
    expect(() => g.clone(agents)).toThrow();
  });

  it('an endless chain of pending effects throws', async () => {
    const { g } = setup();
    const loop = (): void => g.enqueue(0, 'loop', async () => loop());
    loop();
    await expect(g.resolvePending()).rejects.toThrow(/500/);
    expect(g.pending).toHaveLength(0);
  });
});

describe('RG-4 support', () => {
  it("Johnny Silverhand: Rocking Renegade's unit choice is tagged 'lagAttack'", async () => {
    const { g, agents } = setup();
    const j = spawn(g, 0, 'johnny_silverhand_rocking_renegade', 'legends');
    gig(g, 0, 8, 8);
    gig(g, 0, 10, 9); // two 8+ Gigs: the ability costs 0
    const u = spawn(g, 0, 'psycho_squad', 'field', { lag: true });
    await g.activate(0, j.uid, j.uid, 0);
    expect(agents[0].log.find((d) => d.kind === 'unit')?.tag).toBe('lagAttack');
    expect(g.lagPermission(u)).toBe('units');
  });
});

