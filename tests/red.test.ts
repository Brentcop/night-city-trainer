import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, PlayerId, Zone } from '../src/engine/types';

/** Deterministic agent: yes / first option; max increase for gig adjustments. */
class FirstAgent implements Agent {
  name = 'First';
  async decide(_g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'gigValue') {
      let best = 0;
      let bestN = -1;
      d.options.forEach((o, i) => {
        if (o.n !== undefined && o.n > bestN) {
          bestN = o.n;
          best = i;
        }
      });
      return [best];
    }
    if (d.kind === 'reaction' || d.kind === 'action') return [0];
    return [0];
  }
}

const filler = 'animals_wrecker';
function deck(name: string): DeckList {
  return { name, legends: ['dexter_deshawn_off_the_grid', 'v_streetkid', 'royce_psycho_on_the_edge'], main: Array(30).fill(filler), sideboard: [] };
}

function setup(): Game {
  const g = Game.create([deck('A'), deck('B')], [new FirstAgent(), new FirstAgent()], { seed: 1, first: 0, log: false });
  g.s.turn = 2;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) {
    for (const u of [...g.P(p).hand]) g.move(u, 'deck');
    for (const u of g.P(p).legends) g.c(u).spent = true; // keep legends out of payments
  }
  return g;
}

function spawn(g: Game, p: PlayerId, defId: string, zone: Zone, opts: { lag?: boolean; spent?: boolean } = {}): number {
  const uid = g.s.nextUid++;
  g.s.cards[uid] = { uid, defId, owner: p, controller: p, zone, spent: !!opts.spent, faceUp: zone !== 'hand' && zone !== 'deck', lag: !!opts.lag, gear: [], host: null, enteredTurn: 0, goSolo: false };
  const ps = g.P(p);
  const list = { field: ps.field, hand: ps.hand, trash: ps.trash, eddies: ps.eddies, deck: ps.deck, legends: ps.legends } as any;
  list[zone].push(uid);
  return uid;
}
function eddies(g: Game, p: PlayerId, n: number) {
  for (let i = 0; i < n; i++) spawn(g, p, filler, 'eddies');
}
function equip(g: Game, p: PlayerId, defId: string, host: number) {
  const u = spawn(g, p, defId, 'trash');
  g.equip(u, host);
  return u;
}
/** Give player p a gig of given sides with value. */
function gig(g: Game, p: PlayerId, sides: number, value: number) {
  const id = g.P(p).fixer.find((x) => g.gig(x).sides === sides)!;
  g.P(p).fixer = g.P(p).fixer.filter((x) => x !== id);
  const gg = g.gig(id);
  gg.value = value;
  gg.controller = p;
  g.P(p).gigs.push(id);
  return id;
}
async function play(g: Game, p: PlayerId, uid: number) {
  await g.playFromHand(p, uid);
  await g.resolvePending();
}

describe('Red cards', () => {
  it('Adam Smasher Ender of Legends defeats a rival Unit when going solo', async () => {
    const g = setup();
    const adam = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends');
    g.c(adam).spent = false;
    eddies(g, 0, 9);
    const r = spawn(g, 1, 'animals_wrecker', 'field');
    await g.goSolo(0, adam);
    await g.resolvePending();
    expect(g.c(adam).zone).toBe('field');
    expect(g.c(r).zone).toBe('trash');
  });

  it('Bonnie and Clyde defeats one, or two when the rival has 2+ more Gigs', async () => {
    const g = setup();
    eddies(g, 0, 6);
    const a = spawn(g, 1, 'japantown_jonin', 'field');
    const b = spawn(g, 1, 'ruthless_lowlife', 'field');
    const big = spawn(g, 1, 'animals_wrecker', 'field');
    const bc = spawn(g, 0, 'bonnie_and_clyde', 'hand');
    await play(g, 0, bc);
    expect([g.c(a).zone, g.c(b).zone, g.c(big).zone]).toEqual(['trash', 'field', 'field']);
    gig(g, 1, 4, 2);
    gig(g, 1, 6, 2);
    const bc2 = spawn(g, 0, 'bonnie_and_clyde', 'hand');
    const c = spawn(g, 1, 'japantown_jonin', 'field');
    await play(g, 0, bc2);
    expect(g.c(b).zone).toBe('trash');
    expect(g.c(c).zone).toBe('trash');
    expect(g.c(big).zone).toBe('field');
  });

  it('Carnage at the Colosseum costs less with 8+ Gigs and defeats a weaker rival Unit', async () => {
    const g = setup();
    gig(g, 0, 8, 8);
    gig(g, 0, 10, 9);
    const carn = spawn(g, 0, 'carnage_at_the_colosseum', 'hand');
    expect(g.playCost(carn, 0)).toBe(4);
    eddies(g, 0, 4);
    spawn(g, 0, 'ruthless_lowlife', 'field'); // 4 power
    const strong = spawn(g, 1, 'animals_wrecker', 'field');
    const weak = spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field'); // 3
    await play(g, 0, carn);
    expect(g.c(weak).zone).toBe('trash');
    expect(g.c(strong).zone).toBe('field');
    expect(g.P(0).eddies.every((u) => g.c(u).spent)).toBe(true);
  });

  it('6th Street Recruits increases a Gig when a friendly Unit steals a d6', async () => {
    const g = setup();
    spawn(g, 0, '6th_street_recruits', 'field', { spent: true });
    const att = spawn(g, 0, 'ruthless_lowlife', 'field');
    // Ruthless Lowlife can't attack gigs; use a vanilla attacker instead
    expect(g.attackTargets(g.c(att)).some((t) => t.gigs !== null)).toBe(false);
    const att2 = spawn(g, 0, 'animals_wrecker', 'field');
    const d6 = gig(g, 1, 6, 2);
    await g.attack(0, att2, { unit: null, gigs: 1 });
    expect(g.gig(d6).controller).toBe(0);
    // 6th Street increases by up to 6: best is d6 -> 6
    expect(g.gig(d6).value).toBe(6);
  });

  it('Meredith Stout recovers a card when a rival adjusts a friendly Gig, and has +2 vs Legends', async () => {
    const g = setup();
    const mer = spawn(g, 0, 'meredith_stout_stone_cold_corpo', 'field');
    const junk = spawn(g, 0, 'mantis_blades', 'trash');
    const id = gig(g, 0, 10, 5);
    g.setGigValue(id, 4, 1, 'adjust');
    await g.resolvePending();
    expect(g.c(junk).zone).toBe('hand');
    // fighting a Legend
    g.s.active = 1;
    const leg = spawn(g, 1, 'royce_psycho_on_the_edge', 'field');
    g.c(leg).goSolo = true;
    g.c(mer).spent = true;
    expect(g.power(mer)).toBe(5);
    g.s.attack = { attacker: leg, attackerPlayer: 1, targetUnit: mer, targetGigs: null, step: 'fight', ended: false };
    expect(g.power(mer)).toBe(7);
    g.s.attack = null;
  });

  it('Yorinobu Steel Dragon plays a cost<=4 Unit from trash that can attack rival Units', async () => {
    const g = setup();
    eddies(g, 0, 7);
    const lr = spawn(g, 0, 'ruthless_lowlife', 'trash');
    const rv = spawn(g, 1, 'japantown_jonin', 'field', { spent: true });
    const yor = spawn(g, 0, 'yorinobu_arasaka_steel_dragon', 'hand');
    await play(g, 0, yor);
    expect(g.c(lr).zone).toBe('field');
    expect(g.attackTargets(g.c(lr)).some((t) => t.unit === rv)).toBe(true);
    // Arasaka defeated -> draw 1 (once per turn)
    const before = g.P(0).hand.length;
    const m1 = spawn(g, 1, 'minotaur', 'field');
    const m2 = spawn(g, 1, 'minotaur', 'field');
    await g.defeat(m1);
    await g.defeat(m2);
    await g.resolvePending();
    expect(g.P(0).hand.length).toBe(before + 1);
  });

  it('Industrial Assembly increases a Gig by 4 and draws with an 8+ Gig', async () => {
    const g = setup();
    eddies(g, 0, 1);
    const id = gig(g, 0, 10, 4);
    const ia = spawn(g, 0, 'industrial_assembly', 'hand');
    await play(g, 0, ia);
    expect(g.gig(id).value).toBe(8);
    expect(g.P(0).hand.length).toBe(1);
    expect(g.c(ia).zone).toBe('trash');
  });

  it('Appetite for Destruction steals a Gig after a 3+ power fight win', async () => {
    const g = setup();
    eddies(g, 0, 3);
    const att = spawn(g, 0, 'animals_wrecker', 'field'); // 10
    const tgt = spawn(g, 1, 'japantown_jonin', 'field', { spent: true }); // 0
    const rg = gig(g, 1, 8, 3);
    const app = spawn(g, 0, 'appetite_for_destruction', 'hand');
    await play(g, 0, app);
    await g.attack(0, att, { unit: tgt, gigs: null });
    expect(g.c(tgt).zone).toBe('trash');
    expect(g.gig(rg).controller).toBe(0);
    expect(g.s.mods.some((m) => m.kind === 'delayed')).toBe(false);
  });

  it('Deadman Transmitter is defeated instead of its Unit', async () => {
    const g = setup();
    const u = spawn(g, 0, 'animals_wrecker', 'field');
    const dm = equip(g, 0, 'deadman_transmitter', u);
    await g.defeat(u);
    expect(g.c(u).zone).toBe('field');
    expect(g.c(dm).zone).toBe('trash');
    await g.defeat(u);
    expect(g.c(u).zone).toBe('trash');
  });

  it('Johnny Never Stop Fighting beats Corpo Units and readies after first win', async () => {
    const g = setup();
    const j = spawn(g, 0, 'johnny_silverhand_never_stop_fighting', 'field'); // 8
    const yor = spawn(g, 1, 'yorinobu_arasaka_steel_dragon', 'field', { spent: true }); // 9 corpo
    await g.attack(0, j, { unit: yor, gigs: null });
    expect(g.c(yor).zone).toBe('trash');
    expect(g.c(j).zone).toBe('field');
    expect(g.c(j).spent).toBe(false);
  });

  it('Chrome Fang prevents stealing Gigs above the attacker power', async () => {
    const g = setup();
    eddies(g, 0, 5);
    const cf = spawn(g, 0, 'chrome_fang', 'hand');
    await play(g, 0, cf);
    const hi = gig(g, 0, 12, 10);
    const lo = gig(g, 0, 4, 3);
    g.s.active = 1;
    const att = spawn(g, 1, 'ruthless_lowlife', 'field'); // 4 power, but can't attack gigs; use stealBan directly via steal()
    await g.steal(att, 0);
    expect(g.gig(lo).controller).toBe(1);
    expect(g.gig(hi).controller).toBe(0);
  });

  it('Over the Edge uses the friendly d20 value', async () => {
    const g = setup();
    eddies(g, 0, 3);
    gig(g, 0, 20, 10);
    const big = spawn(g, 1, 'animals_wrecker', 'field');
    const ote = spawn(g, 0, 'over_the_edge', 'hand');
    await play(g, 0, ote);
    expect(g.c(big).zone).toBe('trash');
  });

  it('Royce (Simon) defeats power 3 only with more Street Cred; Minotaur needs more cred', async () => {
    const g = setup();
    eddies(g, 0, 12);
    const ll = spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field'); // 3
    const r1 = spawn(g, 0, 'royce_don_t_call_me_simon', 'hand');
    await play(g, 0, r1);
    expect(g.c(ll).zone).toBe('field');
    gig(g, 0, 6, 4);
    const r2 = spawn(g, 0, 'royce_don_t_call_me_simon', 'hand');
    await play(g, 0, r2);
    expect(g.c(ll).zone).toBe('trash');
  });

  it('Detonate defeats a rival Gear with power 2 or less', async () => {
    const g = setup();
    eddies(g, 0, 1);
    const u = spawn(g, 1, 'animals_wrecker', 'field');
    const mb = equip(g, 1, 'mantis_blades', u);
    const d = spawn(g, 0, 'detonate', 'hand');
    await play(g, 0, d);
    expect(g.c(mb).zone).toBe('trash');
    expect(g.c(u).gear.length).toBe(0);
  });

  it('Royce Psycho gets +2 per Gear on its controller turn', async () => {
    const g = setup();
    const r = spawn(g, 0, 'royce_psycho_on_the_edge', 'legends');
    equip(g, 0, 'mantis_blades', r);
    expect(g.power(r)).toBe(6 + 2 + 2);
    g.s.active = 1;
    expect(g.power(r)).toBe(8);
  });
});
