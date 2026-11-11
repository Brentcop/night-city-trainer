// Direct tests for cards in the deck library (non-meta lists) that had none.
import { describe, expect, it } from 'vitest';
import { eddies, equip, gig, pickTag, play, setup, spawn } from './engine-helpers';

describe('library cards', () => {
  it('Goro Takemura (Vengeful Bodyguard): {Quick} gives Blocker (+1 with a value-pair); a friendly block lets you loot', async () => {
    const { g } = setup();
    const goro = spawn(g, 0, 'goro_takemura_vengeful_bodyguard', 'legends');
    eddies(g, 0, 1);
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 3);
    const u = spawn(g, 0, 'mox_inciters', 'field', { spent: true }); // cost 3, already a Blocker
    expect(g.listAbilities(0, true).some((a) => a.self.uid === goro.uid)).toBe(true);
    await g.activate(0, goro.uid, goro.uid, 0, true);
    expect(g.hasKw(u, 'blocker')).toBe(true);
    expect(g.power(u)).toBe(3);
    spawn(g, 0, 'floor_it', 'hand');
    g.emit('blockerUsed', { uid: u.uid });
    await g.resolvePending();
    expect(g.P(0).trash.some((x) => g.c(x).defId === 'floor_it')).toBe(true);
    expect(g.P(0).hand).toHaveLength(1);
  });

  it('Swordwise Huscle draws on {Attack} only with power 5+', async () => {
    for (const [pump, draws] of [[0, 0], [2, 1]] as const) {
      const { g } = setup();
      const s = spawn(g, 0, 'swordwise_huscle', 'field'); // power 3
      if (pump) g.givePower(s.uid, pump);
      gig(g, 1, 4, 2);
      await g.attack(0, s.uid, { unit: null, gigs: 1 });
      expect(g.P(0).hand).toHaveLength(draws);
    }
  });

  it('Evelyn Parker (Scheming Siren): {Attack} draws 1, then discards 1 with more cred', async () => {
    const { g } = setup();
    const e = spawn(g, 0, 'evelyn_parker_scheming_siren', 'field');
    gig(g, 0, 20, 15);
    gig(g, 1, 4, 2);
    await g.attack(0, e.uid, { unit: null, gigs: 1 });
    expect(g.P(0).hand).toHaveLength(0);
    expect(g.P(0).trash).toHaveLength(1);
  });

  it('Corpo Security cannot attack', () => {
    const { g } = setup();
    const c = spawn(g, 0, 'corpo_security', 'field');
    gig(g, 1, 4, 2);
    expect(g.attackTargets(c)).toEqual([]);
  });

  it('Sandevistan readies its Unit at the end of your turn', async () => {
    const { g } = setup();
    const u = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    equip(g, 0, 'sandevistan', u);
    await g.endPhase();
    expect(u.spent).toBe(false);
  });

  it('MaxTac AV may swap a friendly Gig with a rival Gig', async () => {
    const { g } = setup();
    eddies(g, 0, 10);
    const mine = gig(g, 0, 4, 1);
    const theirs = gig(g, 1, 20, 17);
    await play(g, 0, spawn(g, 0, 'maxtac_av', 'hand'));
    expect(g.gig(mine).controller).toBe(1);
    expect(g.gig(theirs).controller).toBe(0);
  });

  it('Take Control: a rival Unit steals 1 fewer Gig; draw if it is an AI, Drone or Vehicle', async () => {
    const { g } = setup();
    eddies(g, 0, 2);
    const drone = spawn(g, 1, 'secondhand_bombus', 'field'); // DRONE
    await play(g, 0, spawn(g, 0, 'take_control', 'hand'));
    expect(g.P(0).hand).toHaveLength(1);
    g.givePower(drone.uid, 6);
    expect(g.stealCount(drone)).toBe(0);
  });

  it('Kerry Eurodyne (The Last Rockerboy) draws 2 only with an 8+ Gig', async () => {
    const { g } = setup();
    const k = spawn(g, 0, 'kerry_eurodyne_the_last_rockerboy', 'field');
    // activatable without an 8+ Gig (FAQ Kerry Eurodyne: The Last Rockerboy #2), but then it draws nothing
    expect(g.listAbilities(0, false).some((a) => a.self.uid === k.uid)).toBe(true);
    await g.activate(0, k.uid, k.uid, 0);
    expect(g.P(0).hand).toHaveLength(0);
    g.ready(k.uid);
    gig(g, 0, 8, 8);
    await g.activate(0, k.uid, k.uid, 0);
    expect(g.P(0).hand).toHaveLength(2);
  });

  it('Unlikely Bond bottom-decks a ready friendly Unit, then a spent rival Unit', async () => {
    const { g } = setup();
    eddies(g, 0, 10);
    const mine = spawn(g, 0, 'mox_inciters', 'field');
    const theirs = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    await play(g, 0, spawn(g, 0, 'unlikely_bond', 'hand'));
    expect([mine.zone, theirs.zone]).toEqual(['deck', 'deck']);
  });

  it('T-Bug: Defeated lets you look at your face-down Legends and Call one for free', async () => {
    const { g } = setup([pickTag('call', 0), null]);
    const t = spawn(g, 0, 't_bug_amateur_philosopher', 'field');
    await g.defeat(t.uid);
    await g.resolvePending();
    expect(g.faceUpLegends(0)).toHaveLength(1);
    expect(g.faceDownLegends(0).every((c) => c.known)).toBe(true);
  });
  it('V (Streetkid): Call trashes 3 and adds a BRAINDANCE Program from the trash', async () => {
    const { g } = setup();
    const v = g.c(g.P(0).legends.find((u) => g.c(u).defId === 'v_streetkid')!);
    spawn(g, 0, 'psycho_squad', 'deck');
    const tno = spawn(g, 0, 'trust_no_one', 'deck'); // BRAINDANCE
    spawn(g, 0, 'floor_it', 'deck');
    await g.callLegend(0, v.uid, { free: true });
    await g.resolvePending();
    expect(g.P(0).hand).toEqual([tno.uid]);
  });

  it('Kiroshi Optics: {Attack} looks at a friendly face-down Legend', async () => {
    const { g } = setup();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'kiroshi_optics', u);
    gig(g, 1, 4, 2);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    expect(g.faceDownLegends(0).filter((c) => c.known)).toHaveLength(1);
  });

  it('Japantown Jonin: {Play} gives a friendly Unit +2 power this turn', async () => {
    const { g } = setup();
    eddies(g, 0, 2);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    await play(g, 0, spawn(g, 0, 'japantown_jonin', 'hand'));
    expect(g.power(u)).toBe(8);
  });

  it("Mox Inciters: {Play} a rival Unit must attack next turn: its controller can't pass while it can", async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    const r = spawn(g, 1, 'psycho_squad', 'field');
    gig(g, 0, 6, 3);
    await play(g, 0, spawn(g, 0, 'mox_inciters', 'hand'));
    g.s.active = 1;
    g.s.turn++;
    expect(g.legalActions(1).some((a) => a.type === 'pass')).toBe(false);
    await g.attack(1, r.uid, { unit: null, gigs: 0 });
    // once it has attacked it is spent and can't attack, so passing is allowed; the requirement itself lasts the turn
    // (readied again, it must attack again: Evelyn Parker: Beautiful Enigma FAQ, tests/faq/blue.test.ts)
    expect(g.legalActions(1).some((a) => a.type === 'pass')).toBe(true);
  });
});
