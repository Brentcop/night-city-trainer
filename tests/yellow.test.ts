import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import { CARDS } from '../src/engine/cards';
import type { Agent, Decision, DeckList, PlayerId } from '../src/engine/types';

type Hook = (g: Game, d: Decision) => number[] | undefined;

/** Picks the first option (Yes / first card / first unit) unless a hook overrides. */
class Scripted implements Agent {
  name = 'Scripted';
  hook: Hook | null = null;
  async decide(g: Game, d: Decision): Promise<number[]> {
    const r = this.hook?.(g, d);
    return r ?? [0];
  }
}

const YELLOW_IDS = CARDS.filter((c) => c.color === 'Yellow' && c.type !== 'Legend').map((c) => c.id);

function deck(name: string): DeckList {
  const main: string[] = [];
  for (const id of YELLOW_IDS) main.push(id, id);
  return { name, legends: ['kerry_eurodyne_axe_attitude_audience', 'muamar_reyes_el_capitan', 'river_ward_detective_on_the_hunt'], main, sideboard: [] };
}

function setup() {
  const a = new Scripted();
  const b = new Scripted();
  const g = Game.create([deck('A'), deck('B')], [a, b], { seed: 7, first: 0, log: false });
  g.s.turn = 2;
  g.s.active = 0;
  g.s.phase = 'main';
  // clear hands into deck bottom
  for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).hand]) g.move(u, 'deck', { position: 'bottom' });
  return { g, a, b };
}

function get(g: Game, p: PlayerId, defId: string): number {
  const u = Object.values(g.s.cards).find((c) => c.owner === p && c.defId === defId && c.zone === 'deck');
  if (!u) throw new Error(`no ${defId} in deck of ${p}`);
  return u.uid;
}
const toHand = (g: Game, p: PlayerId, id: string) => {
  const u = get(g, p, id);
  g.move(u, 'hand');
  return u;
};
const toField = (g: Game, p: PlayerId, id: string) => {
  const u = get(g, p, id);
  g.move(u, 'field', { controller: p });
  g.c(u).enteredTurn = 1;
  return u;
};
const toTrash = (g: Game, p: PlayerId, id: string) => {
  const u = get(g, p, id);
  g.move(u, 'trash');
  return u;
};
function equip(g: Game, p: PlayerId, id: string, host: number) {
  const u = get(g, p, id);
  g.equip(u, host);
  return u;
}
function eddies(g: Game, p: PlayerId, n: number) {
  for (let i = 0; i < n; i++) g.move(g.P(p).deck[g.P(p).deck.length - 1], 'eddies', { controller: p, faceUp: false });
  for (const u of g.P(p).legends) g.c(u).spent = true; // don't pay with legends
}
function gigs(g: Game, p: PlayerId, vals: [number, number][]) {
  for (const [sides, value] of vals) {
    const gid = g.P(p).fixer.find((id) => g.gig(id).sides === sides)!;
    g.P(p).fixer = g.P(p).fixer.filter((x) => x !== gid);
    g.gig(gid).value = value;
    g.gig(gid).controller = p;
    g.P(p).gigs.push(gid);
  }
}
async function play(g: Game, p: PlayerId, uid: number) {
  await g.playFromHand(p, uid);
  await g.resolvePending();
}

describe('Yellow cards', () => {
  it('Adam Smasher: Metal Over Meat defeats all other Units', async () => {
    const { g } = setup();
    eddies(g, 0, 9);
    const mine = toField(g, 0, 'secondhand_bombus');
    const theirs = toField(g, 1, 'maelstrom_goons');
    const adam = toHand(g, 0, 'adam_smasher_metal_over_meat');
    await play(g, 0, adam);
    expect(g.c(adam).zone).toBe('field');
    expect(g.c(mine).zone).toBe('trash');
    expect(g.c(theirs).zone).toBe('trash');
  });

  it('Trauma Team Operatives costs 1 less per Unit in trash', () => {
    const { g } = setup();
    toTrash(g, 0, 'secondhand_bombus');
    toTrash(g, 0, 'maelstrom_goons');
    toTrash(g, 0, 'kiroshi_optics');
    const tt = toHand(g, 0, 'trauma_team_operatives');
    expect(g.playCost(tt, 0)).toBe(4);
  });

  it('MaxTac Suppression Team: rival Units cannot attack the turn they are played', () => {
    const { g } = setup();
    toField(g, 1, 'maxtac_suppression_team');
    gigs(g, 1, [[6, 3]]);
    const fresh = toField(g, 0, 'adam_smasher_metal_over_meat');
    g.c(fresh).enteredTurn = g.s.turn;
    const old = toField(g, 0, 'jackie_welles_ride_or_die_choom');
    expect(g.canAttackAtAll(g.c(fresh))).toBe(false);
    expect(g.canAttackAtAll(g.c(old))).toBe(true);
  });

  it('Caliber defeats a rival Unit with cost 2 or less on play; Defeated makes rival discard', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    const bomb = toField(g, 1, 'secondhand_bombus');
    const cal = toHand(g, 0, 'caliber_totentanz_s_top_dog');
    await play(g, 0, cal);
    expect(g.c(bomb).zone).toBe('trash');
    toHand(g, 1, 'gorilla_arms'); // cost 4
    toHand(g, 1, 'kiroshi_optics');
    gigs(g, 0, [[6, 4]]);
    await g.defeat(cal);
    await g.resolvePending();
    // first discard = gorilla arms (cost 4) equals friendly gig 4 -> discards 1 more
    expect(g.P(1).hand.length).toBe(0);
  });

  it('Adrenaline Converter grants Adrenaline when rival has 2+ more Gigs', () => {
    const { g } = setup();
    const u = toField(g, 0, 'maelstrom_goons');
    equip(g, 0, 'adrenaline_converter', u);
    gigs(g, 1, [[4, 2], [6, 3]]);
    expect(g.hasKw(u, 'adrenaline')).toBe(true);
    gigs(g, 0, [[4, 1]]);
    expect(g.hasKw(u, 'adrenaline')).toBe(false);
  });

  it('Safety Override: friendly Unit loses a fight -> opposing rival Unit is defeated', async () => {
    const { g } = setup();
    eddies(g, 0, 2);
    const weak = toField(g, 0, 'secondhand_bombus');
    g.c(weak).spent = false;
    const strong = toField(g, 1, 'jackie_welles_ride_or_die_choom');
    g.givePower(weak, 1);
    await play(g, 0, toHand(g, 0, 'safety_override'));
    await g.fight(strong, weak);
    await g.resolvePending();
    expect(g.c(weak).zone).toBe('trash');
    expect(g.c(strong).zone).toBe('trash');
    expect(g.s.mods.some((m) => m.kind === 'delayed')).toBe(false);
  });

  it('Cyberpsychosis: +3 per Gear, and the Unit is defeated at end of turn after fighting', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    const u = toField(g, 0, 'maelstrom_goons');
    equip(g, 0, 'kiroshi_optics', u);
    equip(g, 0, 'mandibular_upgrade', u);
    const before = g.power(u);
    await play(g, 0, toHand(g, 0, 'cyberpsychosis'));
    expect(g.power(u)).toBe(before + 6);
    const victim = toField(g, 1, 'secondhand_bombus');
    await g.fight(u, victim);
    await g.resolvePending();
    expect(g.c(u).zone).toBe('field');
    g.emit('turnEnd', { player: 0 });
    await g.resolvePending();
    expect(g.c(u).zone).toBe('trash');
  });

  it('Viktor Vektor: Drop Your Illusions discounts first Cyberware Gear each turn', async () => {
    const { g } = setup();
    eddies(g, 0, 10);
    toField(g, 0, 'viktor_vektor_drop_your_illusions');
    const ga = toHand(g, 0, 'gorilla_arms');
    const ac = toHand(g, 0, 'adrenaline_converter');
    expect(g.playCost(ga, 0)).toBe(1);
    await play(g, 0, ga);
    expect(g.playCost(ac, 0)).toBe(2);
  });

  it('The Relic: host defeated -> play a Unit from trash for free, bottom-deck the host', async () => {
    const { g } = setup();
    const host = toField(g, 0, 'maelstrom_goons');
    const relic = equip(g, 0, 'the_relic_experimental_biochip', host);
    const big = toTrash(g, 0, 'jackie_welles_ride_or_die_choom');
    await g.defeat(host);
    await g.resolvePending();
    expect(g.c(big).zone).toBe('field');
    expect(g.c(host).zone).toBe('deck');
    expect(g.P(0).deck[g.P(0).deck.length - 1] === host || g.P(0).deck.includes(host)).toBe(true);
    expect(g.c(relic).zone).toBe('deck');
  });

  it('Alt Cunningham: discard a card with cost equal to the Gig value to prevent a steal', async () => {
    const { g } = setup();
    toField(g, 0, 'alt_cunningham_mother_of_daemons');
    gigs(g, 0, [[6, 2]]);
    const c2 = toHand(g, 0, 'secondhand_bombus'); // cost 2
    const att = toField(g, 1, 'maelstrom_goons');
    await g.steal(att, 0);
    await g.resolvePending();
    expect(g.P(0).gigs.length).toBe(1);
    expect(g.c(c2).zone).toBe('trash');
  });

  it('Gorilla Arms: first steal each turn steals an extra Gig with an unshared value', async () => {
    const { g } = setup();
    const u = toField(g, 0, 'maelstrom_goons');
    equip(g, 0, 'gorilla_arms', u);
    gigs(g, 1, [[4, 3], [6, 5]]);
    gigs(g, 0, [[8, 3]]);
    await g.steal(u, 1); // power 6 -> steals 1 (the d4: 3)
    await g.resolvePending();
    expect(g.P(0).gigs.length).toBe(3);
    expect(g.P(1).gigs.length).toBe(0);
  });

  it('Live with the Aftermath: each player defeats one of their Units', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    const a = toField(g, 0, 'secondhand_bombus');
    const b = toField(g, 1, 'maelstrom_goons');
    const b2 = toField(g, 1, 'caliber_totentanz_s_top_dog');
    await play(g, 0, toHand(g, 0, 'live_with_the_aftermath'));
    expect(g.c(a).zone).toBe('trash');
    expect([g.c(b).zone, g.c(b2).zone].filter((z) => z === 'trash').length).toBe(1);
  });

  it('Off-Duty Malfini spends itself and a rival Unit', async () => {
    const { g } = setup();
    const r = toField(g, 1, 'maelstrom_goons');
    const m = toHand(g, 0, 'offduty_malfini');
    eddies(g, 0, 4);
    await play(g, 0, m);
    expect(g.c(m).spent).toBe(true);
    expect(g.c(r).spent).toBe(true);
  });

  it('Kerry Eurodyne: draws on a min/max roll-in', async () => {
    const { g, a } = setup();
    const kerry = g.P(0).legends.find((u) => g.c(u).defId === 'kerry_eurodyne_axe_attitude_audience')!;
    g.c(kerry).faceUp = true;
    a.hook = (_g, d) => (d.tag === 'kerryReroll' ? [1] : undefined); // decline reroll
    for (let i = 0; i < 5; i++) {
      const hand = g.P(0).hand.length;
      await g.rollIn(0);
      await g.resolvePending();
      const gig = g.gig(g.P(0).gigs[g.P(0).gigs.length - 1]);
      const expected = gig.value === 1 || gig.value === gig.sides ? (gig.sides === 20 ? 3 : 1) : 0;
      expect(g.P(0).hand.length - hand).toBe(expected);
    }
  });

  it('Muamar Call: chosen Unit cannot be defeated in a fight', async () => {
    const { g } = setup();
    const u = toField(g, 0, 'secondhand_bombus');
    const muamar = g.P(0).legends.find((x) => g.c(x).defId === 'muamar_reyes_el_capitan')!;
    g.c(muamar).spent = false;
    await g.callLegend(0, muamar, { free: true });
    await g.resolvePending();
    const r = toField(g, 1, 'jackie_welles_ride_or_die_choom');
    await g.fight(r, u);
    await g.resolvePending();
    expect(g.c(u).zone).toBe('field');
  });
});
