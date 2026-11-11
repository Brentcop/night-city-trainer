// Direct tests for cards played in the meta decks that had none (RG-10 / BY gaps).
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/engine';
import type { Decision, PlayerId } from '../src/engine/types';
import { eddies, equip, gig, optionIndex, pickTag, play, setup, spawn, type Hook } from './engine-helpers';

const hand = (g: Game, p: PlayerId) => g.P(p).hand.length;
const legendOf = (g: Game, p: PlayerId, defId: string) => g.c(g.P(p).legends.find((u) => g.c(u).defId === defId)!);
/** Pick the gig-value option that leaves the highest / lowest value. */
const extreme = (dir: 'max' | 'min'): Hook => (d) => {
  if (d.kind !== 'gigValue') return undefined;
  let best = 0;
  d.options.forEach((o, i) => {
    if (o.n === undefined) return;
    const b = d.options[best].n;
    if (b === undefined || (dir === 'max' ? o.n > b : o.n < b)) best = i;
  });
  return best;
};
const both = (...hs: Hook[]): Hook => (d, g) => {
  for (const h of hs) {
    const r = h(d, g);
    if (r !== undefined) return r;
  }
  return undefined;
};
const blockWith: Hook = (d: Decision) => {
  if (d.kind !== 'reaction') return undefined;
  const i = d.options.findIndex((o) => (o.action as any)?.type === 'block');
  return i >= 0 ? i : undefined;
};

describe('Yellow meta cards', () => {
  it('Zetatech Faceplate: when its Unit is spent, adjust a Gig by up to 1, then draw with 3+ different values', async () => {
    const { g } = setup([pickTag('adjust', (d) => optionIndex(d, (l) => l.includes('d4: 2 → 1'))), null]);
    const u = spawn(g, 0, 'mox_inciters', 'field');
    equip(g, 0, 'zetatech_faceplate', u);
    const d4 = gig(g, 0, 4, 2);
    gig(g, 0, 6, 3);
    gig(g, 0, 8, 3);
    const h = hand(g, 0);
    g.spend(u.uid);
    await g.resolvePending();
    expect(g.gig(d4).value).toBe(1); // values 1, 3, 3: only 2 different
    expect(hand(g, 0) - h).toBe(0);

    const { g: g2 } = setup([pickTag('adjust', (d) => optionIndex(d, (l) => l.includes('d4: 2 → 1'))), null]);
    const u2 = spawn(g2, 0, 'mox_inciters', 'field');
    equip(g2, 0, 'zetatech_faceplate', u2);
    gig(g2, 0, 4, 2);
    gig(g2, 0, 6, 3);
    gig(g2, 0, 8, 5);
    gig(g2, 1, 10, 4);
    const h2 = hand(g2, 0);
    await g2.attack(0, u2.uid, { unit: null, gigs: 1 }); // attacking spends it
    expect(hand(g2, 0) - h2).toBe(1); // values 1, 3, 5
  });

  it('The Heist: trash 4, take a Gear; play it free if its cost matches a friendly Gig', async () => {
    for (const value of [2, 3]) {
      const { g } = setup();
      eddies(g, 0, 2);
      gig(g, 0, 4, value);
      const host = spawn(g, 0, 'mox_inciters', 'field');
      for (let i = 0; i < 3; i++) spawn(g, 0, 'psycho_squad', 'deck');
      const dn = spawn(g, 0, 'dying_night_v_s_pistol', 'deck'); // cost 2, on top
      await play(g, 0, spawn(g, 0, 'the_heist', 'hand'));
      if (value === 2) {
        expect(dn.zone).toBe('field');
        expect(dn.host).toBe(host.uid);
      } else expect(dn.zone).toBe('hand');
      expect(g.P(0).trash.filter((u) => g.c(u).defId === 'psycho_squad')).toHaveLength(3);
    }
  });

  it('Dexter DeShawn (One Last Chance): adjusts a Gig on play; Defeated draws 2 when cred differs by 10+', async () => {
    const { g, agents } = setup();
    eddies(g, 0, 3);
    gig(g, 0, 20, 15);
    gig(g, 1, 4, 2);
    await play(g, 0, spawn(g, 0, 'dexter_deshawn_one_last_chance', 'hand'));
    expect(agents[0].log.some((d) => d.tag === 'adjust' && d.options.some((o) => o.key === 'none'))).toBe(true);
    const cred = Math.abs(g.streetCred(0)! - g.streetCred(1)!);
    expect(cred).toBeGreaterThanOrEqual(10);
    const dex = spawn(g, 0, 'dexter_deshawn_one_last_chance', 'field');
    const h = hand(g, 0);
    await g.defeat(dex.uid);
    await g.resolvePending();
    expect(hand(g, 0) - h).toBe(2);

    const { g: g2 } = setup();
    gig(g2, 0, 6, 5);
    gig(g2, 1, 4, 2);
    const dex2 = spawn(g2, 0, 'dexter_deshawn_one_last_chance', 'field');
    await g2.defeat(dex2.uid);
    await g2.resolvePending();
    expect(hand(g2, 0)).toBe(0);
  });

  it('Dum Dum: Call may defeat a friendly Gear to draw 2 (else 1); ability gives +1 per Gear', async () => {
    const { g } = setup();
    const dd = spawn(g, 0, 'dum_dum_maelstrom_triggerman', 'legends', { faceUp: false });
    const u = spawn(g, 0, 'mox_inciters', 'field');
    const k = equip(g, 0, 'kiroshi_optics', u);
    equip(g, 0, 'mantis_blades', u);
    await g.callLegend(0, dd.uid, { free: true });
    await g.resolvePending();
    expect(k.zone).toBe('trash');
    expect(hand(g, 0)).toBe(2);
    eddies(g, 0, 1);
    const before = g.power(u);
    await g.activate(0, dd.uid, dd.uid, 0);
    expect(g.power(u)).toBe(before + 1);
  });

  it('Viktor Vektor (Sit Down and Relax): Call adds up to 2 Gears with cost 2 or less from the top 5', async () => {
    const { g } = setup();
    const vv = spawn(g, 0, 'viktor_vektor_sit_down_and_relax', 'legends', { faceUp: false });
    const ga = spawn(g, 0, 'gorilla_arms', 'deck'); // cost 4: not eligible
    const mb = spawn(g, 0, 'mantis_blades', 'deck');
    spawn(g, 0, 'psycho_squad', 'deck');
    const ko = spawn(g, 0, 'kiroshi_optics', 'deck');
    spawn(g, 0, 'psycho_squad', 'deck');
    await g.callLegend(0, vv.uid, { free: true });
    await g.resolvePending();
    expect(g.P(0).hand.sort()).toEqual([mb.uid, ko.uid].sort());
    expect(ga.zone).toBe('deck');
    expect(g.P(0).deck.slice(-3)).toContain(ga.uid); // the rest go to the bottom
  });

  it('Viktor Vektor (A Little Pinch): play a Cyberware Gear (cost 2 or less) from the trash onto another Unit', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    const other = spawn(g, 0, 'psycho_squad', 'field');
    const mb = spawn(g, 0, 'mantis_blades', 'trash');
    const vv = spawn(g, 0, 'viktor_vektor_you_might_feel_a_little_pinch', 'hand');
    await play(g, 0, vv);
    expect(mb.host).toBe(other.uid);
    expect(vv.gear).toEqual([]);
  });

  it('Augmented Negotiators: using Blocker makes the rival discard 1', async () => {
    const { g } = setup([null, blockWith]);
    const card = spawn(g, 0, 'floor_it', 'hand');
    const att = spawn(g, 0, 'psycho_squad', 'field');
    spawn(g, 1, 'augmented_negotiators', 'field');
    gig(g, 1, 6, 2);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(card.zone).toBe('trash');
  });
});

describe('Blue meta cards', () => {
  it('Wakako Okada: Call gives a rival Unit -2 (or draws 1); ability decreases a Gig by up to 2', async () => {
    const { g } = setup([extreme('min'), null]);
    const w = spawn(g, 0, 'wakako_okada_peace_and_harmony', 'legends', { faceUp: false });
    const r = spawn(g, 1, 'psycho_squad', 'field');
    await g.callLegend(0, w.uid, { free: true });
    await g.resolvePending();
    expect(g.power(r)).toBe(4);
    const x = gig(g, 1, 6, 5);
    await g.activate(0, w.uid, w.uid, 0);
    expect(g.gig(x).value).toBe(3);

    // with no rival Unit both modes are still offered (FAQ); choose Draw 1
    const { g: g2 } = setup([(d) => (d.kind === 'mode' ? optionIndex(d, (l) => l === 'Draw 1') : undefined), null]);
    const w2 = spawn(g2, 0, 'wakako_okada_peace_and_harmony', 'legends', { faceUp: false });
    await g2.callLegend(0, w2.uid, { free: true });
    await g2.resolvePending();
    expect(hand(g2, 0)).toBe(1);
  });

  it('Trust No One: decrease a Gig by up to 3, then draw if you control a min Gig', async () => {
    for (const [target, draws] of [[1, 1], [3, 0]] as const) {
      const { g } = setup([pickTag('adjust', (d) => optionIndex(d, (l) => l.endsWith(`4 → ${target}`))), null]);
      eddies(g, 0, 1);
      const x = gig(g, 0, 6, 4);
      await play(g, 0, spawn(g, 0, 'trust_no_one', 'hand'));
      expect(g.gig(x).value).toBe(target);
      expect(hand(g, 0)).toBe(draws);
    }
  });

  it("Dying Night: {Attack} decreases a Gig by up to 2; on a Unit named V it readies 2 Eddies at end of turn", async () => {
    const { g } = setup([pickTag('adjust', (d) => optionIndex(d, (l) => l.includes('d8: 6 → 4'))), null]);
    const v = spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true });
    equip(g, 0, 'dying_night_v_s_pistol', v);
    const x = gig(g, 1, 8, 6);
    gig(g, 1, 4, 4);
    eddies(g, 0, 2);
    for (const u of g.P(0).eddies) g.c(u).spent = true;
    await g.attack(0, v.uid, { unit: null, gigs: 1 });
    expect(g.gig(x).value).toBe(4);
    await g.endPhase();
    expect(g.P(0).eddies.every((u) => !g.c(u).spent)).toBe(true);
  });
});

describe('Red meta cards', () => {
  it('Dexter DeShawn (Off the Grid): Call gives +2 or draws 1; ability increases a Gig by up to 2', async () => {
    const { g } = setup([extreme('max'), null]);
    const dex = legendOf(g, 0, 'dexter_deshawn_off_the_grid');
    const u = spawn(g, 0, 'psycho_squad', 'field');
    await g.callLegend(0, dex.uid, { free: true });
    await g.resolvePending();
    expect(g.power(u)).toBe(8);
    dex.spent = false;
    const x = gig(g, 0, 6, 2);
    await g.activate(0, dex.uid, dex.uid, 0);
    expect(g.gig(x).value).toBe(4);

    const { g: g2 } = setup([pickTag('mode', 1), null]);
    spawn(g2, 0, 'psycho_squad', 'field');
    await g2.callLegend(0, legendOf(g2, 0, 'dexter_deshawn_off_the_grid').uid, { free: true });
    await g2.resolvePending();
    expect(hand(g2, 0)).toBe(1);
  });

  it('All Is Lost: trash 3 and add a Unit from among them', async () => {
    const { g } = setup();
    eddies(g, 0, 1);
    const a = spawn(g, 0, 'trust_no_one', 'deck');
    const unit = spawn(g, 0, 'psycho_squad', 'deck');
    const b = spawn(g, 0, 'floor_it', 'deck');
    await play(g, 0, spawn(g, 0, 'all_is_lost', 'hand'));
    expect(g.P(0).hand).toEqual([unit.uid]);
    expect([a.zone, b.zone]).toEqual(['trash', 'trash']);
  });

  it('Gunpoint Diplomacy: both effects normally; the rival picks one when you have less cred', async () => {
    const { g } = setup();
    eddies(g, 0, 4);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const ready = spawn(g, 1, 'psycho_squad', 'field');
    expect(g.attackTargets(u)).toEqual([]);
    await play(g, 0, spawn(g, 0, 'gunpoint_diplomacy', 'hand'));
    expect(g.power(u)).toBe(9);
    expect(g.attackTargets(u)).toEqual([{ unit: ready.uid, gigs: null }]);

    const { g: g2, agents } = setup([null, pickTag('rivalChoice', 1)]);
    eddies(g2, 0, 4);
    gig(g2, 1, 4, 2); // the rival has more cred
    const u2 = spawn(g2, 0, 'psycho_squad', 'field');
    spawn(g2, 1, 'psycho_squad', 'field');
    await play(g2, 0, spawn(g2, 0, 'gunpoint_diplomacy', 'hand'));
    expect(agents[1].log.some((d) => d.tag === 'rivalChoice')).toBe(true);
    expect(g2.power(u2)).toBe(9);
    expect(g2.attackTargets(u2).some((t) => t.unit !== null)).toBe(false);
  });

  it('Satori: draws when its Unit wins a fight against a rival Unit', async () => {
    for (const [rival, draws] of [['psycho_squad', 1], ['animals_wrecker', 0]] as const) {
      const { g } = setup();
      const u = spawn(g, 0, 'psycho_squad', 'field'); // 6 + 2
      equip(g, 0, 'satori_sword_of_saburo', u);
      const r = spawn(g, 1, rival, 'field', { spent: true });
      await g.attack(0, u.uid, { unit: r.uid, gigs: null });
      expect(hand(g, 0)).toBe(draws);
    }
  });

  it('La Llorona: using Blocker increases a Gig by up to 3', async () => {
    const { g } = setup([null, both(blockWith, extreme('max'))]);
    const att = spawn(g, 0, 'psycho_squad', 'field');
    spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field');
    const x = gig(g, 1, 6, 2);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(g.gig(x).value).toBe(5);
    expect(g.gig(x).controller).toBe(1);
  });

  it('Shattered Memories: both discard and may draw 5; draw 2 more if the discards match a friendly Gig', async () => {
    const { g } = setup();
    eddies(g, 0, 4);
    for (let i = 0; i < 3; i++) spawn(g, 0, 'psycho_squad', 'hand');
    for (let i = 0; i < 2; i++) spawn(g, 1, 'psycho_squad', 'hand');
    gig(g, 0, 6, 5);
    await play(g, 0, spawn(g, 0, 'shattered_memories', 'hand'));
    expect(hand(g, 0)).toBe(7);
    expect(hand(g, 1)).toBe(5);
  });

  it('Screw: Defeated adds another Unit from the trash to hand', async () => {
    const { g } = setup();
    const s = spawn(g, 0, 'screw_lovelorn_fool', 'field');
    const j = spawn(g, 0, 'japantown_jonin', 'trash');
    spawn(g, 0, 'floor_it', 'trash');
    await g.defeat(s.uid);
    await g.resolvePending();
    expect(g.P(0).hand).toEqual([j.uid]);
  });
});

describe('Green meta cards', () => {
  it('Padre: Call spends a rival Unit (or draws); ability sets a Gig to another player’s Gig value', async () => {
    const { g } = setup([pickTag('setGig', (d) => optionIndex(d, (l) => l.startsWith('Friendly d8: 2 → 5'))), null]);
    const padre = spawn(g, 0, 'padre_man_of_the_cross', 'legends', { faceUp: false });
    const r = spawn(g, 1, 'psycho_squad', 'field');
    await g.callLegend(0, padre.uid, { free: true });
    await g.resolvePending();
    expect(r.spent).toBe(true);
    const mine = gig(g, 0, 8, 2);
    gig(g, 1, 6, 5);
    await g.activate(0, padre.uid, padre.uid, 0);
    expect(g.gig(mine).value).toBe(5);
  });

  it('Field Operator: draws on play only with even Street Cred', async () => {
    for (const [value, draws] of [[2, 1], [3, 0]] as const) {
      const { g } = setup();
      eddies(g, 0, 3);
      gig(g, 0, 4, value);
      await play(g, 0, spawn(g, 0, 'field_operator', 'hand'));
      expect(hand(g, 0)).toBe(draws);
    }
  });

  it('Pepe Najarro: {Attack} with a value-pair readies up to 2 MERC Legends', async () => {
    const { g } = setup();
    const v = spawn(g, 0, 'v_corporate_exile', 'legends', { spent: true });
    const j = spawn(g, 0, 'jackie_welles_mama_s_favorite', 'legends', { spent: true });
    gig(g, 0, 4, 3);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 2);
    const pepe = spawn(g, 0, 'pepe_najarro_working_doubles', 'field');
    await g.attack(0, pepe.uid, { unit: null, gigs: 1 });
    expect([v.spent, j.spent]).toEqual([false, false]);
  });

  it('Valentino (Street Racer): gives another friendly Unit (cost 5 or less) Adrenaline', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    const u = spawn(g, 0, 'psycho_squad', 'field', { lag: true });
    await play(g, 0, spawn(g, 0, 'valentino_street_racer', 'hand'));
    expect(g.lagPermission(u)).toBe('any');
  });
});
