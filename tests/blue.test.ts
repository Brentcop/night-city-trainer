import { describe, it, expect } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, PlayerId, Zone, CardInst } from '../src/engine/types';

/** Picks option 0 unless a custom chooser returns an index. */
class Scripted implements Agent {
  name = 'Scripted';
  log: Decision[] = [];
  constructor(public chooser?: (d: Decision) => number | undefined) {}
  async decide(_g: Game, d: Decision) {
    this.log.push(d);
    const i = this.chooser?.(d);
    return [i ?? 0];
  }
}

const filler: string[] = Array(40).fill('psycho_squad');
const deck = (name: string): DeckList => ({
  name,
  legends: ['v_corporate_exile', 'sasha_yakovleva_won_t_let_you_down', 'evelyn_parker_beautiful_enigma'],
  main: filler,
  sideboard: [],
});

function setup(a0?: (d: Decision) => number | undefined, a1?: (d: Decision) => number | undefined) {
  const agents: [Scripted, Scripted] = [new Scripted(a0), new Scripted(a1)];
  const g = Game.create([deck('A'), deck('B')], agents, { seed: 1, first: 0, log: false });
  g.s.turn = 3;
  g.s.active = 0;
  g.s.phase = 'main';
  return { g, agents };
}

function spawn(g: Game, defId: string, p: PlayerId, zone: Zone, opts: Partial<CardInst> = {}): CardInst {
  const uid = g.s.nextUid++;
  const c: CardInst = { uid, defId, owner: p, controller: p, zone, spent: false, faceUp: zone !== 'hand' && zone !== 'deck', lag: false, gear: [], host: null, enteredTurn: 0, goSolo: false, ...opts };
  g.s.cards[uid] = c;
  const ps = g.P(p);
  const list = { deck: ps.deck, hand: ps.hand, field: ps.field, legends: ps.legends, eddies: ps.eddies, trash: ps.trash, removed: ps.removed } as Record<string, number[]>;
  if (zone === 'deck') list.deck.unshift(uid);
  else list[zone].push(uid);
  return c;
}
function eddies(g: Game, p: PlayerId, n: number) {
  for (let i = 0; i < n; i++) spawn(g, 'psycho_squad', p, 'eddies');
}
/** Give player p a gig of given sides/value. */
function gig(g: Game, p: PlayerId, sides: number, value: number) {
  const ps = g.P(p);
  const id = ps.fixer.find((x) => g.s.gigs[x].sides === sides)!;
  ps.fixer = ps.fixer.filter((x) => x !== id);
  const gg = g.s.gigs[id];
  gg.value = value;
  gg.controller = p;
  ps.gigs.push(id);
  return gg;
}
async function play(g: Game, p: PlayerId, c: CardInst) {
  await g.playFromHand(p, c.uid);
  await g.resolvePending();
}

describe('Blue scripts', () => {
  it('Three Mouths, One Desire adds 1 + 1 per friendly min Gig, bottom-decks rest', async () => {
    const { g } = setup((d) => (d.tag === 'search' ? 0 : undefined));
    eddies(g, 0, 2);
    gig(g, 0, 4, 1);
    gig(g, 0, 6, 3);
    const tops = [spawn(g, 'floor_it', 0, 'deck'), spawn(g, 'trust_no_one', 0, 'deck'), spawn(g, 'towerfall', 0, 'deck')];
    const card = spawn(g, 'three_mouths_one_desire', 0, 'hand');
    const handBefore = g.P(0).hand.length;
    await play(g, 0, card);
    expect(g.P(0).hand.length).toBe(handBefore - 1 + 2);
    const deck = g.P(0).deck;
    const remaining = tops.filter((c) => c.zone === 'deck');
    expect(remaining.length).toBe(1);
    expect(deck[deck.length - 1] === remaining[0].uid || deck[deck.length - 2] === remaining[0].uid).toBe(true);
    expect(card.zone).toBe('trash');
  });

  it('Towerfall: behind on cred -> -5 all then bottom-deck all at 0', async () => {
    const { g } = setup();
    eddies(g, 0, 6);
    gig(g, 0, 4, 1);
    gig(g, 1, 20, 15);
    const small = spawn(g, 'delamain_cab', 1, 'field'); // 4
    const big = spawn(g, 'mt0d12_flathead', 1, 'field'); // 7
    await play(g, 0, spawn(g, 'towerfall', 0, 'hand'));
    expect(small.zone).toBe('deck');
    expect(big.zone).toBe('field');
    expect(g.power(big)).toBe(2);
  });

  it('Towerfall: ahead on cred -> choose one mode only', async () => {
    const { g } = setup(); // mode 0 (-5)
    eddies(g, 0, 6);
    gig(g, 0, 20, 15);
    gig(g, 1, 4, 1);
    const small = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'towerfall', 0, 'hand'));
    expect(small.zone).toBe('field');
    expect(g.power(small)).toBe(0);
  });

  it('Pyramid Song: friendly d4 at 1 -> -4 then bottom-deck a 0-power Unit', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    gig(g, 0, 4, 1);
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'pyramid_song', 0, 'hand'));
    expect(cab.zone).toBe('deck');
  });

  it('Pyramid Song: without min d4 only one mode', async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    gig(g, 0, 4, 2);
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'pyramid_song', 0, 'hand'));
    expect(cab.zone).toBe('field');
    expect(g.power(cab)).toBe(0);
  });

  it("Chrome Reverie locks a rival Unit and calls a Legend for free with a min Gig", async () => {
    const { g } = setup();
    eddies(g, 0, 3);
    gig(g, 0, 6, 1);
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'chrome_reverie', 0, 'hand'));
    expect(g.hasMod('cantAttack', cab.uid)).toBe(true);
    expect(g.faceUpLegends(0).length).toBe(1);
    expect(g.P(0).eddies.every((u) => g.c(u).spent)).toBe(true);
    // lock persists through rival's turn, removed at start of my next turn
    expect(g.s.mods.find((m) => m.kind === 'cantAttack')!.untilPlayer).toBe(0);
  });

  it('Les Elemens bottom-decks the lowest-power rival Unit', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    const a = spawn(g, 'mt0d12_flathead', 1, 'field');
    const b = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'les_elemens', 0, 'hand'));
    expect(b.zone).toBe('deck');
    expect(a.zone).toBe('field');
  });

  it('Nocturne costs 1 with empty fixer; Go Solo discount mode', async () => {
    const { g } = setup((d) => (d.kind === 'mode' ? 2 : undefined));
    const noc = spawn(g, 'nocturne_op55_n1', 0, 'hand');
    expect(g.playCost(noc.uid, 0)).toBe(3);
    g.P(0).fixer = [];
    expect(g.playCost(noc.uid, 0)).toBe(1);
    eddies(g, 0, 1);
    const v = g.c(g.P(0).legends.find((u) => g.c(u).defId === 'v_corporate_exile')!);
    v.faceUp = true;
    await play(g, 0, noc);
    expect(g.playCost(v.uid, 0, 'goSolo')).toBe(3);
  });

  it('Lizzy Wizzy plays a cheap Program from trash and bottom-decks it', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    const fi = spawn(g, 'floor_it', 0, 'trash');
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'lizzy_wizzy_delicate_weapon', 0, 'hand'));
    expect(g.power(cab)).toBe(3);
    expect(fi.zone).toBe('deck');
    expect(g.P(0).deck[g.P(0).deck.length - 1]).toBe(fi.uid);
  });

  it('Placide: discard a Program to bottom-deck a rival Unit', async () => {
    const { g } = setup();
    eddies(g, 0, 8);
    const prog = spawn(g, 'floor_it', 0, 'hand');
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'placide_voodoo_sentinel', 0, 'hand'));
    expect(prog.zone).toBe('trash');
    expect(cab.zone).toBe('deck');
  });

  it('Maman Brigitte: discard 2 Programs, bottom-deck unequipped rival', async () => {
    const { g } = setup();
    eddies(g, 0, 5);
    spawn(g, 'floor_it', 0, 'hand');
    spawn(g, 'trust_no_one', 0, 'hand');
    const cab = spawn(g, 'delamain_cab', 1, 'field');
    await play(g, 0, spawn(g, 'maman_brigitte_spirit_of_death', 0, 'hand'));
    expect(cab.zone).toBe('deck');
    expect(g.P(0).trash.length).toBe(2);
  });

  it('Alt Cunningham: next Program costs -1 per min Gig (min 1), consumed after a Program', async () => {
    const { g } = setup();
    const alt = spawn(g, 'alt_cunningham_soulkiller_architect', 0, 'legends', { faceUp: true });
    gig(g, 0, 4, 1);
    gig(g, 0, 6, 1);
    eddies(g, 0, 6);
    const tf = spawn(g, 'towerfall', 0, 'hand');
    await g.activate(0, alt.uid, alt.uid, 0);
    expect(g.playCost(tf.uid, 0)).toBe(4);
    await play(g, 0, tf);
    const fi = spawn(g, 'floor_it', 0, 'hand');
    expect(g.playCost(tf.uid, 0)).toBe(6);
    expect(g.playCost(fi.uid, 0)).toBe(1);
  });

  it('Alt Cunningham: play a Program from trash paying cost, then bottom-deck', async () => {
    const { g } = setup();
    const alt = spawn(g, 'alt_cunningham_soulkiller_architect', 0, 'legends', { faceUp: true });
    eddies(g, 0, 2);
    const fi = spawn(g, 'floor_it', 0, 'trash');
    const before = g.P(0).hand.length;
    await g.activate(0, alt.uid, alt.uid, 1);
    await g.resolvePending();
    expect(fi.zone).toBe('deck');
    expect(g.P(0).hand.length).toBe(before + 1); // Floor It drew 1
    expect(g.P(0).eddies.every((u) => g.c(u).spent)).toBe(true);
  });

  it('Westbrook: rival Legends cannot steal gigs below their power', async () => {
    const { g } = setup();
    eddies(g, 0, 4);
    const low = gig(g, 0, 4, 2);
    const high = gig(g, 0, 12, 10);
    await play(g, 0, spawn(g, 'westbrook_netrunner', 0, 'hand'));
    const v = spawn(g, 'v_corporate_exile', 1, 'field', { goSolo: true });
    // protection outlives Westbrook itself
    await g.defeat(g.units(0)[0].uid);
    await g.resolvePending();
    // V (power 8) steals: the d4 showing 2 is protected, the d12 showing 10 is not
    await g.steal(v.uid, 0);
    expect(low.controller).toBe(0);
    expect(high.controller).toBe(1);
  });

  it('Reboot Optics: the next rival fight does not defeat the friendly Unit', async () => {
    const { g } = setup();
    g.s.active = 1;
    eddies(g, 0, 2);
    const blocker = spawn(g, 'delamain_cab', 0, 'field', { spent: true }); // 4
    const att = spawn(g, 'mt0d12_flathead', 1, 'field'); // 7
    await play(g, 0, spawn(g, 'reboot_optics', 0, 'hand'));
    await g.attack(1, att.uid, { unit: blocker.uid, gigs: null });
    expect(blocker.zone).toBe('field');
    expect(g.s.mods.some((m) => m.kind === 'noDefeatOpp')).toBe(false);
  });

  it('Rita Wheeler draws and discards the first time she is spent', async () => {
    const { g } = setup();
    const rita = spawn(g, 'rita_wheeler_no_stupid_questions', 0, 'field');
    const before = g.P(0).hand.length;
    g.spend(rita.uid);
    await g.resolvePending();
    expect(g.P(0).hand.length).toBe(before);
    expect(g.P(0).trash.length).toBe(1);
    rita.spent = false;
    g.spend(rita.uid);
    await g.resolvePending();
    expect(g.P(0).trash.length).toBe(1);
  });

  it('Jackie Welles: first Blue Unit each turn lowers a friendly Gig and draws on min', async () => {
    const { g } = setup((d) => (d.tag === 'adjust' ? d.options.findIndex((o) => o.n === 1) : undefined));
    spawn(g, 'jackie_welles_pour_one_out_for_me', 0, 'legends', { faceUp: true });
    gig(g, 0, 6, 3);
    eddies(g, 0, 8);
    const before = g.P(0).hand.length;
    await play(g, 0, spawn(g, 'delamain_rideshare_ai', 0, 'hand')); // draws 2
    expect(g.gigsOf(0)[0].value).toBe(1);
    expect(g.P(0).hand.length).toBe(before + 2 + 1);
  });

  it('Modded Kusanagi returns to hand at end of turn; Muramasa readies when behind', async () => {
    const { g } = setup();
    const k = spawn(g, 'modded_kusanagi', 0, 'field');
    const m = spawn(g, 'modded_muramasa', 0, 'field', { spent: true });
    gig(g, 1, 6, 5);
    g.emit('turnEnd', { player: 0 });
    await g.resolvePending();
    expect(k.zone).toBe('hand');
    expect(m.spent).toBe(false);
  });

  it('Misty and Jacked-In Voodoo Boy attack restrictions', async () => {
    const { g } = setup();
    eddies(g, 0, 2);
    gig(g, 1, 6, 5);
    const misty = spawn(g, 'misty_olszewski_mender_of_broken_spirits', 0, 'field');
    const vb = spawn(g, 'jacked_in_voodoo_boy', 0, 'field');
    expect(g.attackTargets(misty).length).toBe(0);
    expect(g.attackTargets(vb).length).toBe(0);
    await play(g, 0, spawn(g, 'floor_it', 0, 'hand'));
    expect(g.attackTargets(vb).length).toBe(1);
  });

  it('Netwatch Netdriver draws when its host is spent; Delamain Cab readies an Eddie after stealing', async () => {
    const { g } = setup();
    const cab = spawn(g, 'delamain_cab', 0, 'field');
    const nd = spawn(g, 'netwatch_netdriver', 0, 'hand');
    g.equip(nd.uid, cab.uid);
    gig(g, 1, 6, 2);
    eddies(g, 0, 1);
    g.c(g.P(0).eddies[0]).spent = true;
    const before = g.P(0).hand.length;
    await g.attack(0, cab.uid, { unit: null, gigs: 1 });
    expect(g.P(0).gigs.length).toBe(1);
    expect(g.P(0).hand.length).toBe(before + 1);
    g.emit('turnEnd', { player: 0 });
    await g.resolvePending();
    expect(g.c(g.P(0).eddies[0]).spent).toBe(false);
  });

  it('Sasha: attack reveals top card and gains its cost as power', async () => {
    const { g } = setup();
    const sasha = spawn(g, 'sasha_yakovleva_won_t_let_you_down', 0, 'field', { goSolo: true });
    spawn(g, 'towerfall', 0, 'deck');
    gig(g, 1, 6, 2);
    let pw = -1;
    g.agents[1] = { name: 'spy', decide: async (gg, d) => { if (d.kind === 'reaction') pw = gg.power(sasha); return [0]; } };
    await g.attack(0, sasha.uid, { unit: null, gigs: 1 });
    expect(g.P(0).hand.some((u) => g.c(u).defId === 'towerfall')).toBe(true);
    expect(pw === -1 || pw === 6).toBe(true);
    expect(g.power(sasha)).toBe(6);
  });

  it('random games with Blue decks complete', async () => {
    const { RandomAgent } = await import('../src/ai/random');
    const { CARDS } = await import('../src/engine/cards');
    const blue = CARDS.filter((c) => c.color === 'Blue');
    const legends = blue.filter((c) => c.type === 'Legend').slice(0, 3).map((c) => c.id);
    const main: string[] = [];
    for (const c of blue.filter((c) => c.type !== 'Legend')) for (let i = 0; i < 2; i++) main.push(c.id);
    while (main.length < 50) main.push('floor_it');
    const legends2 = blue.filter((c) => c.type === 'Legend').slice(3, 6).map((c) => c.id);
    for (let s = 1; s <= 30; s++) {
      const g = Game.create(
        [
          { name: 'A', legends, main, sideboard: [] },
          { name: 'B', legends: legends2, main, sideboard: [] },
        ],
        [new RandomAgent(s), new RandomAgent(s + 7)],
        { seed: s, log: false },
      );
      const st = await g.run();
      expect(st.winner).not.toBeNull();
    }
  });
});
