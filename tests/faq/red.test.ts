// Official FAQ conformance: Red card rulings (matrix: tests/faq/entries/red.ts). Each title names the ruling(s) it
// covers as faq:<first 8 characters of the ruling id>.
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/engine/engine';
import type { CardInst, Decision, PlayerId } from '../../src/engine/types';
import type { Scripted } from '../engine-helpers';
import {
  activate,
  answerYes,
  blockBy,
  canActivate,
  canBlockWith,
  chooseCard,
  chooseMode,
  deckOf,
  eddies,
  emptyDeck,
  equip,
  FILLER,
  gig,
  gigs,
  hooks,
  noChange,
  onKind,
  orderOffers,
  passTurn,
  playCard,
  reactStep,
  reactWith,
  resolveFirst,
  scene,
  setGigTo,
  spawn,
  type Hook,
} from './faq-helpers';

// ---------------------------------------------------------------- local builders

/** Declare an attack with `a` (its controller must be the active player) and run it to the end. */
const atk = (g: Game, a: CardInst, t: { unit?: CardInst; gigs?: PlayerId }) =>
  g.attack(a.controller, a.uid, { unit: t.unit?.uid ?? null, gigs: t.unit ? null : (t.gigs ?? ((1 - a.controller) as PlayerId)) });

const hand = (g: Game, p: PlayerId) => g.P(p).hand.length;
/** Replace player p's decision hook mid-scene (once the cards it answers about exist). */
const setHook = (g: Game, p: PlayerId, hook: Hook) => void ((g.agents[p] as Scripted).hook = hook);
const hasNone = (d: Decision) => d.options.some((o) => o.key === 'none');

/** A Gig of p's that the rival now controls (as if stolen earlier). */
function rivalHolds(g: Game, p: PlayerId, sides: number, value: number) {
  const id = gig(g, p, sides, value);
  g.moveGig(id, (1 - p) as PlayerId);
  return id;
}

/** Remove p's starting Legends, so a test controls exactly which Legends p has. */
function noLegends(g: Game, p: PlayerId) {
  for (const u of [...g.P(p).legends]) g.move(u, 'removed');
}

/** Player 1 resolves Chrome Fang's {Play} on their turn; then it is player 0's turn. */
async function chromeFangLastTurn(g: Game, o: { defeatIt?: boolean } = {}) {
  g.s.active = 1;
  const fang = await playCard(g, 1, 'chrome_fang');
  if (o.defeatIt) {
    await g.defeat(fang.uid);
    await g.resolvePending();
  }
  await passTurn(g);
  return fang;
}

// ---------------------------------------------------------------- tests

describe('6th Street Recruits', () => {
  it('faq:ed0b637f triggers once for each d6 when a Unit steals two d6 at once', async () => {
    const { g, asked } = scene();
    const rec = spawn(g, 0, '6th_street_recruits', 'field');
    const att = spawn(g, 0, 'animals_wrecker', 'field'); // 10 power: steals 2
    const a = gig(g, 1, 6, 3);
    const b = rivalHolds(g, 0, 6, 4); // the rival also holds player 0's d6
    await atk(g, att, { gigs: 1 });
    expect([g.gig(a).controller, g.gig(b).controller]).toEqual([0, 0]);
    expect(asked(0, (d) => d.kind === 'gigValue' && d.source === rec.uid)).toHaveLength(2);
  });
});

describe('Adam Smasher: Ender of Legends', () => {
  it('faq:4dc5a7cb Calling it (turning it face-up) does not trigger its {Play}', async () => {
    const { g } = scene();
    noLegends(g, 0);
    const adam = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends', { faceUp: false });
    const r = spawn(g, 1, FILLER, 'field');
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: adam.uid });
    await g.resolvePending();
    expect(adam.faceUp).toBe(true);
    expect(r.zone).toBe('field');
  });

  it('faq:89104f80 sent to an invalid area (hand, deck) it is removed from the game', () => {
    const { g } = scene();
    const solo = spawn(g, 0, 'adam_smasher_ender_of_legends', 'field', { goSolo: true });
    g.returnToHand(solo.uid);
    expect(solo.zone).toBe('removed');
    const area = spawn(g, 0, 'adam_smasher_ender_of_legends', 'legends');
    g.move(area.uid, 'deck', { position: 'bottom' });
    expect(area.zone).toBe('removed');
  });
});

describe('All is Lost', () => {
  it('faq:6f7d6a80 must add a Unit from among the trashed cards when there is one', async () => {
    const { g, asked } = scene();
    const [unit] = deckOf(g, 0, ['psycho_squad', 'floor_it', 'detonate']);
    await playCard(g, 0, 'all_is_lost');
    const d = asked(0, (x) => x.kind === 'card' && x.tag === 'search');
    expect(d).toHaveLength(1);
    expect(hasNone(d[0])).toBe(false);
    expect(unit.zone).toBe('hand');
  });

  it('faq:086fb943 trashing no Unit adds nothing, not even a Unit already in the trash', async () => {
    const { g } = scene();
    const old = spawn(g, 0, 'psycho_squad', 'trash');
    deckOf(g, 0, ['floor_it', 'detonate', 'trust_no_one']);
    await playCard(g, 0, 'all_is_lost');
    expect(old.zone).toBe('trash');
    expect(hand(g, 0)).toBe(0);
  });

  it('faq:8227301d with two cards in the deck it trashes both (and the game goes on)', async () => {
    const { g } = scene();
    emptyDeck(g, 0);
    const two = deckOf(g, 0, ['floor_it', 'detonate']);
    await playCard(g, 0, 'all_is_lost');
    expect(two.map((c) => c.zone)).toEqual(['trash', 'trash']);
    expect(g.P(0).deck).toHaveLength(0);
    expect(g.s.winner).toBeNull();
  });
});

describe('Appetite for Destruction', () => {
  it('faq:f7e7ce23 faq:dd350a6e a friendly Unit on the field is chosen on resolution; that Unit itself steals the Gig', async () => {
    const { g, asked } = scene();
    const chosen = spawn(g, 0, 'animals_wrecker', 'field'); // 10
    gigs(g, 1, [
      [4, 2],
      [6, 3],
    ]);
    await playCard(g, 0, 'appetite_for_destruction');
    expect(asked(0, (d) => d.kind === 'unit' && d.prompt.startsWith('Appetite')).map((d) => d.options.map((o) => o.uid))).toEqual([[chosen.uid]]);
    const later = spawn(g, 0, 'animals_wrecker', 'field'); // not on the field when it resolved
    await atk(g, later, { unit: spawn(g, 1, FILLER, 'field', { spent: true }) }); // wins 10 vs 6
    expect(g.P(0).gigs).toHaveLength(0);
    await atk(g, chosen, { unit: spawn(g, 1, FILLER, 'field', { spent: true }) });
    expect(g.P(0).gigs).toHaveLength(1);
    expect(g.s.turnEvents!.filter((e) => e.k === 'steal').map((e) => e.uid)).toEqual([chosen.uid]);
  });

  it('faq:82802953 still steals when the losing Unit cannot be defeated in a fight', async () => {
    const { g } = scene();
    const a = spawn(g, 0, 'animals_wrecker', 'field');
    gig(g, 1, 4, 2);
    await playCard(g, 0, 'appetite_for_destruction');
    const t = spawn(g, 1, FILLER, 'field', { spent: true });
    g.addMod({ kind: 'noFightDefeat', target: t.uid, until: 'endOfTurn' });
    await atk(g, a, { unit: t });
    expect(t.zone).toBe('field');
    expect(g.P(0).gigs).toHaveLength(1);
  });
});

describe('Arasaka Emergency Radioport', () => {
  it("faq:d3587386 its 'when spent' effect and the {Attack} trigger are pending together; it may resolve fully (Calling a Legend) first", async () => {
    const { g, agents, lines } = scene({ order: [0], hooks: [null, null] });
    noLegends(g, 0);
    const yori = spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends', { faceUp: false });
    agents[0].hook = hooks(resolveFirst('Radioport'), chooseCard(yori));
    const hus = spawn(g, 0, 'swordwise_huscle', 'field');
    g.givePower(hus.uid, 2); // 5 power: its {Attack} draws 1
    equip(g, 0, 'arasaka_emergency_radioport', hus);
    gig(g, 1, 4, 2);
    await atk(g, hus, { gigs: 1 });
    const offers = orderOffers(agents[0]);
    expect(offers).toHaveLength(1);
    expect(offers[0].some((l) => l.includes('Radioport'))).toBe(true);
    expect(offers[0].some((l) => l.includes('{Attack}'))).toBe(true);
    const log = lines();
    expect(yori.faceUp).toBe(true);
    expect(log.findIndex((t) => t.startsWith('calls'))).toBeLessThan(log.findIndex((t) => t.startsWith('draws')));
  });
});

describe('Gear tags (Arasaka Emergency Radioport, Deadman Transmitter, Mantis Blades)', () => {
  it("faq:7ea458e4 faq:fa2a899b faq:dd7abf4b an equipped Unit does not gain its Gear's tags", async () => {
    const { g } = scene();
    noLegends(g, 0);
    spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends'); // draws for the first ARASAKA attack
    const host = spawn(g, 0, FILLER, 'field');
    equip(g, 0, 'arasaka_emergency_radioport', host); // Arasaka/Cyberware
    equip(g, 0, 'deadman_transmitter', host); // Cyberware/Trauma Team
    equip(g, 0, 'mantis_blades', host); // Cyberware
    for (const tag of ['Arasaka', 'Cyberware', 'Trauma Team']) expect(g.isTag(host, tag)).toBe(false);
    gig(g, 1, 4, 2);
    await atk(g, host, { gigs: 1 });
    expect(hand(g, 0)).toBe(0); // not an ARASAKA attack: Yorinobu did not draw
  });
});

describe('Bonnie and Clyde', () => {
  it('faq:b3bcae3f with the rival 2+ Gigs ahead, defeating only one Unit is allowed', async () => {
    const none: Hook = (d) => (d.kind === 'unit' && d.prompt.includes('second') ? d.options.findIndex((o) => o.key === 'none') : undefined);
    const { g } = scene({ hooks: [none, null] });
    gigs(g, 1, [
      [4, 2],
      [6, 3],
    ]);
    const a = spawn(g, 1, 'japantown_jonin', 'field');
    const b = spawn(g, 1, 'ruthless_lowlife', 'field');
    await playCard(g, 0, 'bonnie_and_clyde');
    expect([a.zone, b.zone].sort()).toEqual(['field', 'trash']);
  });

  it('faq:e4f428d9 can be played with no rival Units', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'bonnie_and_clyde', 'hand');
    eddies(g, 0, 3);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await g.playFromHand(0, c.uid);
    expect(c.zone).toBe('trash');
  });
});

describe('Carnage at the Colosseum, Octant: cost reductions', () => {
  it('faq:31ed50ec Carnage played for less still has cost 6 (Lizzy Wizzy cannot play it as a cost-3 Program)', async () => {
    const { g, asked } = scene();
    gigs(g, 0, [
      [8, 8],
      [10, 9],
      [12, 10],
      [20, 15],
    ]);
    const carnage = spawn(g, 0, 'carnage_at_the_colosseum', 'hand');
    const cheap = spawn(g, 0, 'floor_it', 'hand');
    expect(g.playCost(carnage.uid, 0)).toBe(2);
    expect(g.def(carnage).cost).toBe(6);
    await playCard(g, 0, 'lizzy_wizzy_delicate_weapon');
    const offered = asked(0, (d) => d.tag === 'freePlay').flatMap((d) => d.options.map((o) => o.uid));
    expect(offered).toContain(cheap.uid);
    expect(offered).not.toContain(carnage.uid);
  });

  it('faq:79a2970c Octant played for less still has cost 7 (Yorinobu cannot play it as a cost-4 Unit)', async () => {
    const { g, asked } = scene();
    gigs(g, 0, [
      [8, 8],
      [10, 9],
      [12, 10],
      [20, 15],
    ]);
    const octant = spawn(g, 0, 'octant', 'hand');
    const cheap = spawn(g, 0, 'psycho_squad', 'hand');
    expect(g.playCost(octant.uid, 0)).toBe(3);
    expect(g.def(octant).cost).toBe(7);
    await playCard(g, 0, 'yorinobu_arasaka_steel_dragon');
    const offered = asked(0, (d) => d.tag === 'playFree').flatMap((d) => d.options.map((o) => o.uid));
    expect(offered).toContain(cheap.uid);
    expect(offered).not.toContain(octant.uid);
  });
});

describe('Chrome Fang', () => {
  it("faq:42c38a1d resolved on the rival's last turn, it stops my Adrenaline Unit stealing a Gig above its power", async () => {
    const { g } = scene();
    const high = gig(g, 1, 10, 10);
    const low = gig(g, 1, 4, 2);
    await chromeFangLastTurn(g);
    expect(g.s.active).toBe(0);
    const k = await playCard(g, 0, 'modded_kusanagi'); // Adrenaline, 8 power
    await atk(g, k, { gigs: 1 });
    expect(g.gig(high).controller).toBe(1);
    expect(g.gig(low).controller).toBe(0);
  });

  it("faq:eb37dc38 the effect lasts until its controller's next turn even if Chrome Fang is defeated", async () => {
    const { g } = scene();
    const high = gig(g, 1, 10, 10);
    const fang = await chromeFangLastTurn(g, { defeatIt: true });
    expect(fang.zone).toBe('trash');
    const att = spawn(g, 0, FILLER, 'field'); // 6
    await atk(g, att, { gigs: 1 });
    expect(g.gig(high).controller).toBe(1);
  });

  it('faq:28a0d1ab a Gig whose value equals the attacker power can still be stolen', async () => {
    const { g } = scene();
    const same = gig(g, 1, 6, 6);
    await chromeFangLastTurn(g);
    const att = spawn(g, 0, FILLER, 'field'); // 6
    await atk(g, att, { gigs: 1 });
    expect(g.gig(same).controller).toBe(0);
  });

  it('faq:18a0c359 the Gig area can still be attacked when every Gig is above the attacker power', async () => {
    const { g } = scene();
    const high = gig(g, 1, 10, 10);
    await chromeFangLastTurn(g);
    const att = spawn(g, 0, FILLER, 'field');
    expect(g.attackTargets(att)).toEqual([{ unit: null, gigs: 1 }]);
    await atk(g, att, { gigs: 1 });
    expect(g.gig(high).controller).toBe(1);
    expect(g.s.stats.attacks[0]).toBe(1);
  });

  it('faq:fa5d28f5 an extra steal from an effect (Gorilla Arms) also cannot take a Gig above the Unit power', async () => {
    const { g } = scene();
    const low = gig(g, 1, 4, 2);
    const high1 = gig(g, 1, 10, 10);
    const high2 = gig(g, 1, 12, 11);
    await chromeFangLastTurn(g);
    const unit = spawn(g, 0, FILLER, 'field');
    equip(g, 0, 'gorilla_arms', unit); // 6 + 3 = 9: steals the d4, then Gorilla Arms tries for one more
    await atk(g, unit, { gigs: 1 });
    expect(g.gig(low).controller).toBe(0);
    expect([g.gig(high1).controller, g.gig(high2).controller]).toEqual([1, 1]);
  });
});

describe('Deadman Transmitter', () => {
  it('faq:307b211e with two equipped, only one is defeated instead of the Unit', async () => {
    const { g } = scene();
    const u = spawn(g, 0, FILLER, 'field');
    const d1 = equip(g, 0, 'deadman_transmitter', u);
    const d2 = equip(g, 0, 'deadman_transmitter', u);
    await g.defeat(u.uid);
    expect(u.zone).toBe('field');
    expect([d1.zone, d2.zone].sort()).toEqual(['field', 'trash']);
    expect(u.gear).toHaveLength(1);
  });

  it('faq:4b85693e saved by it in a fight, the Unit still lost the fight (Maelstrom Zealots defeats its opponent)', async () => {
    const { g } = scene();
    const att = spawn(g, 0, FILLER, 'field'); // 6
    const z = spawn(g, 1, 'maelstrom_zealots', 'field', { spent: true }); // 0 + 1
    const dm = equip(g, 1, 'deadman_transmitter', z);
    await atk(g, att, { unit: z });
    expect(z.zone).toBe('field');
    expect(dm.zone).toBe('trash');
    expect(att.zone).toBe('trash'); // "when this Unit loses a fight, defeat the opposing rival Unit"
  });
});

describe('Detonate', () => {
  it('faq:2ae2b855 may defeat a Gear on a face-up Legend in the Legends area or on the field', async () => {
    const { g, asked } = scene();
    const inArea = spawn(g, 1, 'royce_psycho_on_the_edge', 'legends');
    const onField = spawn(g, 1, 'v_corporate_exile', 'field', { goSolo: true });
    const g1 = equip(g, 1, 'mantis_blades', inArea);
    const g2 = equip(g, 1, 'satori_sword_of_saburo', onField);
    setHook(g, 0, chooseCard(g1));
    await playCard(g, 0, 'detonate');
    const offered = asked(0, (d) => d.prompt.startsWith('Detonate')).flatMap((d) => d.options.map((o) => o.uid));
    expect(offered).toEqual(expect.arrayContaining([g1.uid, g2.uid]));
    expect(g1.zone).toBe('trash');
    expect(g2.zone).toBe('field');
  });

  it('faq:c459acd1 can be played (also as a reaction) with no rival Gear', () => {
    const { g } = scene();
    const det = spawn(g, 1, 'detonate', 'hand');
    eddies(g, 1, 1);
    g.s.active = 1;
    expect(g.legalActions(1).some((a) => a.type === 'play' && a.uid === det.uid)).toBe(true);
    reactStep(g, spawn(g, 0, FILLER, 'field'), { gigs: 1 });
    expect(g.legalReactions(1).some((r) => r.type === 'play' && r.uid === det.uid)).toBe(true);
  });
});

describe('Dexter DeShawn: Off the Grid', () => {
  it('faq:47feaf18 the +2 power effect may be chosen with no friendly Unit (it then does nothing)', async () => {
    const { g, asked } = scene({ hooks: [chooseMode('+2'), null] });
    noLegends(g, 0);
    const dex = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends', { faceUp: false });
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: dex.uid });
    await g.resolvePending();
    const modes = asked(0, (d) => d.kind === 'mode');
    expect(modes).toHaveLength(1);
    expect(modes[0].options.map((o) => o.label)).toEqual(['Give a friendly Unit +2 power this turn', 'Draw 1']);
    expect(hand(g, 0)).toBe(0);
  });

  it('faq:f868fe18 a {Quick} card drawn by its {Call} in the React step can be played in that same React step', async () => {
    const { g } = scene();
    noLegends(g, 1);
    spawn(g, 1, 'dexter_deshawn_off_the_grid', 'legends', { faceUp: false });
    const fi = deckOf(g, 1, ['floor_it'])[0];
    eddies(g, 1, 2);
    setHook(g, 1, hooks(reactWith((r) => r.type === 'call', (r) => r.type === 'play'), chooseMode('Draw')));
    gig(g, 1, 4, 2);
    const att = spawn(g, 0, FILLER, 'field');
    await atk(g, att, { gigs: 1 });
    expect(fi.zone).toBe('trash');
    expect(g.power(att)).toBe(5);
  });

  it('faq:2a8619f2 its {Spend} ability may increase a friendly or a rival Gig', async () => {
    const { g, asked } = scene();
    const dex = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends');
    gig(g, 0, 4, 1);
    const rg = gig(g, 1, 6, 1);
    setHook(g, 0, setGigTo(rg, 3));
    await activate(g, 0, dex);
    const labels = asked(0, (d) => d.kind === 'gigValue').flatMap((d) => d.options.map((o) => o.label));
    expect(labels.some((l) => l.startsWith('Friendly'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Rival'))).toBe(true);
    expect(g.gig(rg).value).toBe(3);
  });
});

describe('El Sombrerón: La Venganza Lenta', () => {
  async function sombreron(hook: Hook) {
    const { g, asked } = scene({ hooks: [hook, null] });
    const el = spawn(g, 0, 'el_sombreron_la_venganza_lenta', 'field'); // 4
    const d4 = gig(g, 0, 4, 4);
    const d6 = gig(g, 0, 6, 6);
    eddies(g, 0, 2);
    await atk(g, el, { unit: spawn(g, 1, FILLER, 'field', { spent: true }) });
    return { g, asked, el, d4, d6 };
  }

  it('faq:2984e648 with several max Gigs, any of them may be chosen', async () => {
    let d4id = -1;
    const pickD4: Hook = (d) => (d.tag === 'maxGig' ? d.options.findIndex((o) => o.gig === d4id) : undefined);
    const { g } = scene();
    d4id = gig(g, 0, 4, 4);
    gig(g, 0, 6, 6);
    setHook(g, 0, pickD4);
    const el = spawn(g, 0, 'el_sombreron_la_venganza_lenta', 'field');
    eddies(g, 0, 2);
    await atk(g, el, { unit: spawn(g, 1, 'japantown_jonin', 'field', { spent: true }) });
    expect(g.power(el)).toBe(8); // 4 + the d4's 4
  });

  it('faq:71386fef the power gained does not follow later changes to that Gig', async () => {
    const { g, el, d6 } = await sombreron(onKind('gig', (d) => d.options.findIndex((o) => o.label.includes('d6')), 'maxGig'));
    expect(g.power(el)).toBe(10);
    g.setGigValue(d6, 2, 0);
    expect(g.power(el)).toBe(10);
  });

  it('faq:a51b1f00 paying the 2 €$ may be declined even when it could be paid', async () => {
    const { g, el, asked } = await sombreron(answerYes(false, 'pay'));
    expect(asked(0, (d) => d.tag === 'pay')).toHaveLength(1);
    expect(g.available(0)).toBe(2);
    expect(el.zone).toBe('trash'); // 4 against 6: it lost
  });
});

describe('Gunpoint Diplomacy', () => {
  it('faq:2a901389 both effects are given in the printed order; no choice of order is offered', async () => {
    const { g, asked } = scene();
    const u = spawn(g, 0, FILLER, 'field');
    await playCard(g, 0, 'gunpoint_diplomacy');
    expect(asked(0, (d) => d.kind === 'mode' || d.kind === 'order')).toHaveLength(0);
    const ready = g.s.mods.find((m) => m.kind === 'attackReady' && m.target === u.uid)!;
    const power = g.s.mods.find((m) => m.kind === 'power' && m.target === u.uid)!;
    expect(ready.id).toBeLessThan(power.id);
  });

  it('faq:e4e22bef when the rival chooses the effect, the player still chooses the Unit', async () => {
    const { g, asked } = scene({ hooks: [null, chooseMode('+3')] });
    gig(g, 1, 4, 2); // player 0 has less Street Cred
    const u = spawn(g, 0, FILLER, 'field');
    spawn(g, 0, 'psycho_squad', 'field');
    await playCard(g, 0, 'gunpoint_diplomacy');
    expect(asked(0, (d) => d.kind === 'unit')).toHaveLength(1);
    expect(asked(1, (d) => d.kind === 'unit')).toHaveLength(0);
    expect(asked(1, (d) => d.kind === 'mode')).toHaveLength(1);
    expect(g.power(u)).toBe(9);
    expect(g.hasMod('attackReady', u.uid)).toBe(false);
  });
});

describe('Industrial Assembly', () => {
  it('faq:ad3b75f8 may increase a Gig by 0', async () => {
    const { g } = scene({ hooks: [noChange, null] });
    const x = gig(g, 0, 6, 2);
    await playCard(g, 0, 'industrial_assembly');
    expect(g.gig(x).value).toBe(2);
  });

  it("faq:2f4ce47f may increase a rival's Gig", async () => {
    const { g } = scene();
    gig(g, 0, 6, 2);
    const r = gig(g, 1, 8, 2);
    setHook(g, 0, setGigTo(r, 6));
    await playCard(g, 0, 'industrial_assembly');
    expect(g.gig(r).value).toBe(6);
  });

  it('faq:8f2d9cb3 can be played with no Gigs to increase', async () => {
    const { g, asked } = scene();
    const c = spawn(g, 0, 'industrial_assembly', 'hand');
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await g.playFromHand(0, c.uid);
    expect(c.zone).toBe('trash');
    expect(asked(0, (d) => d.kind === 'gigValue')).toHaveLength(0);
  });
});

describe('Japantown Jonin', () => {
  it('faq:cce96f5d its {Play} may give itself +2 power', async () => {
    const { g, asked } = scene();
    const j = await playCard(g, 0, 'japantown_jonin');
    expect(asked(0, (d) => d.kind === 'unit')[0].options.map((o) => o.uid)).toEqual([j.uid]);
    expect(g.power(j)).toBe(2);
  });
});

describe('Johnny Silverhand: Never Stop Fighting', () => {
  it('faq:3cfb42c3 it wins every fight against a CORPO Unit, whatever their power', async () => {
    const { g } = scene();
    const j = spawn(g, 0, 'johnny_silverhand_never_stop_fighting', 'field'); // 8
    const m = spawn(g, 1, 'meredith_stout_stone_cold_corpo', 'field', { spent: true }); // Corpo, 5
    g.givePower(m.uid, 10);
    await atk(g, j, { unit: m });
    expect(m.zone).toBe('trash');
    expect(j.zone).toBe('field');
  });

  it("faq:e512816e its first win on the rival's turn readies it", async () => {
    const { g } = scene();
    const j = spawn(g, 0, 'johnny_silverhand_never_stop_fighting', 'field', { spent: true });
    g.s.active = 1;
    const att = spawn(g, 1, FILLER, 'field'); // 6
    await atk(g, att, { unit: j });
    expect(att.zone).toBe('trash');
    expect(j.spent).toBe(false);
  });

  it('faq:d33a4200 a first win while already ready uses up the trigger: a second win that turn does not ready it', async () => {
    const { g } = scene();
    const j = spawn(g, 0, 'johnny_silverhand_never_stop_fighting', 'field'); // ready
    g.s.active = 1;
    const a = spawn(g, 1, FILLER, 'field');
    g.addMod({ kind: 'attackReady', target: a.uid, until: 'endOfTurn' });
    await atk(g, a, { unit: j });
    expect(a.zone).toBe('trash');
    g.spend(j.uid);
    await g.resolvePending();
    const b = spawn(g, 1, FILLER, 'field');
    await atk(g, b, { unit: j });
    expect(b.zone).toBe('trash');
    expect(j.spent).toBe(true);
  });

  it('faq:69794180 at 0 power it does not defeat the CORPO Unit it fights', async () => {
    const { g } = scene();
    const j = spawn(g, 0, 'johnny_silverhand_never_stop_fighting', 'field');
    g.givePower(j.uid, -8);
    const c = spawn(g, 1, 'corpo_security', 'field', { spent: true }); // Corpo, 2
    await atk(g, j, { unit: c });
    expect(c.zone).toBe('field');
    expect(j.zone).toBe('field');
  });
});

describe('Johnny Silverhand: Rocking Renegade', () => {
  const johnny = (g: Game) => spawn(g, 0, 'johnny_silverhand_rocking_renegade', 'legends');

  it('faq:97a58f36 with two friendly 8+ Gigs it can be activated for 0 €$', async () => {
    const { g } = scene();
    const jo = johnny(g);
    gigs(g, 0, [
      [8, 8],
      [10, 9],
    ]);
    const u = spawn(g, 0, FILLER, 'field');
    expect(g.payables(0).filter((c) => c.uid !== jo.uid)).toHaveLength(0); // nothing to pay with but Johnny himself
    expect(canActivate(g, 0, jo)).toBe(true);
    await activate(g, 0, jo);
    expect(jo.spent).toBe(true);
    expect(g.modsFor('lagAttack', u.uid)).toHaveLength(1);
  });

  it('faq:7af4302f faq:e403c866 a Unit from an earlier turn may be chosen, and it can still attack the Gig area', async () => {
    const { g, asked } = scene();
    const jo = johnny(g);
    eddies(g, 0, 2);
    const old = spawn(g, 0, FILLER, 'field'); // no Lag: played on an earlier turn
    gig(g, 1, 4, 2);
    await activate(g, 0, jo);
    expect(asked(0, (d) => d.tag === 'lagAttack')[0].options.map((o) => o.uid)).toEqual([old.uid]);
    expect(g.attackTargets(old)).toEqual([{ unit: null, gigs: 1 }]);
  });

  it('faq:2e51228f faq:2ffc8e87 a Unit played this turn with its effect and "may attack ready Units" can attack a ready rival Unit', async () => {
    const { g } = scene();
    const jo = johnny(g);
    const kerry = await playCard(g, 0, 'kerry_eurodyne_the_last_rockerboy'); // ROCKER, 5, Lag
    setHook(g, 0, chooseCard(kerry));
    const ready = spawn(g, 1, FILLER, 'field');
    const spent = spawn(g, 1, FILLER, 'field', { spent: true });
    eddies(g, 0, 2);
    await activate(g, 0, jo);
    expect(g.attackTargets(kerry)).toEqual([{ unit: spent.uid, gigs: null }]);
    await playCard(g, 0, 'gunpoint_diplomacy'); // the next time it attacks this turn it may attack ready Units, +3
    expect(g.attackTargets(kerry).map((t) => t.unit)).toEqual([ready.uid, spent.uid]);
    await atk(g, kerry, { unit: ready }); // 5 + 2 + 3 = 10 vs 6
    expect(ready.zone).toBe('trash');
  });
});

describe('Kerry Eurodyne: The Last Rockerboy', () => {
  it('faq:d23941b5 its {Spend} ability cannot be used the turn it is played', async () => {
    const { g } = scene();
    gig(g, 0, 8, 8);
    const k = await playCard(g, 0, 'kerry_eurodyne_the_last_rockerboy');
    expect(canActivate(g, 0, k)).toBe(false);
  });

  it('faq:1da9b201 it can be activated without an 8+ Gig, and then draws nothing', async () => {
    const { g } = scene();
    gig(g, 0, 6, 5);
    const k = spawn(g, 0, 'kerry_eurodyne_the_last_rockerboy', 'field');
    expect(canActivate(g, 0, k)).toBe(true);
    await activate(g, 0, k);
    expect(k.spent).toBe(true);
    expect(hand(g, 0)).toBe(0);
  });

  it('faq:498e223a readied after using it, it can be activated again that turn', async () => {
    const { g } = scene();
    gig(g, 0, 8, 8);
    const k = spawn(g, 0, 'kerry_eurodyne_the_last_rockerboy', 'field');
    await activate(g, 0, k);
    expect(hand(g, 0)).toBe(2);
    g.ready(k.uid);
    expect(canActivate(g, 0, k)).toBe(true);
    await activate(g, 0, k);
    expect(hand(g, 0)).toBe(4);
  });
});

describe('La Llorona: Ghost of the Past', () => {
  it('faq:7cf45f7a the Gig is increased when she blocks, before the fight', async () => {
    const { g, lines } = scene();
    const ll = spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field');
    setHook(g, 1, reactWith(blockBy(ll)));
    gig(g, 1, 6, 2);
    await atk(g, spawn(g, 0, FILLER, 'field'), { gigs: 1 });
    const log = lines();
    const up = log.findIndex((t) => t.startsWith('increases'));
    expect(up).toBeGreaterThanOrEqual(0);
    expect(up).toBeLessThan(log.findIndex((t) => t.startsWith('fight:')));
  });

  it('faq:10236d8a after another Unit has blocked, she can block the same attack again in that React step', async () => {
    const { g, lines } = scene();
    const sec = spawn(g, 1, 'corpo_security', 'field');
    const ll = spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field');
    setHook(g, 1, reactWith(blockBy(sec), blockBy(ll)));
    gig(g, 1, 6, 2);
    await atk(g, spawn(g, 0, FILLER, 'field'), { gigs: 1 });
    expect(sec.spent).toBe(true);
    expect(sec.zone).toBe('field');
    expect(ll.zone).toBe('trash'); // she took the fight: 3 against 6
    expect(lines().some((t) => t.startsWith('fight:') && t.includes('La Llorona'))).toBe(true);
  });

  it('faq:287826c0 "up to 3" offers 0, 1, 2 or 3', async () => {
    const { g, asked } = scene();
    const ll = spawn(g, 1, 'la_llorona_ghost_of_the_past', 'field');
    setHook(g, 1, reactWith(blockBy(ll)));
    const x = gig(g, 1, 6, 2);
    await atk(g, spawn(g, 0, FILLER, 'field'), { gigs: 1 });
    const d = asked(1, (q) => q.kind === 'gigValue')[0];
    expect(d.options.filter((o) => o.gig === x).map((o) => o.n)).toEqual([3, 4, 5]);
    expect(hasNone(d)).toBe(true);
  });
});

describe('Meredith Stout: Stone Cold Corpo', () => {
  it('faq:ae3bd50b a rival swap that moves Gigs on both sides triggers it once', async () => {
    const { g, asked } = scene();
    spawn(g, 0, 'meredith_stout_stone_cold_corpo', 'field');
    spawn(g, 0, FILLER, 'trash');
    const mine = gig(g, 0, 6, 3);
    const theirs = gig(g, 1, 8, 5);
    g.swapGigs(theirs, mine, 1);
    await g.resolvePending();
    expect(asked(0, (d) => d.prompt.startsWith('Meredith'))).toHaveLength(1);
  });
});

describe('Minotaur', () => {
  it('faq:1528eec2 its {Play} must defeat a rival Unit when there is a valid one', async () => {
    const { g, asked } = scene();
    gig(g, 0, 6, 5); // more Street Cred
    const r = spawn(g, 1, 'ruthless_lowlife', 'field'); // 4
    await playCard(g, 0, 'minotaur');
    expect(hasNone(asked(0, (d) => d.tag === 'defeat')[0])).toBe(false);
    expect(r.zone).toBe('trash');
  });
});

describe('Over the Edge', () => {
  it('faq:3aec4fa6 faq:995ef005 without a friendly d20 (one in the fixer area does not count) it defeats nothing, not even a 0-power Unit', async () => {
    const { g } = scene();
    expect(g.P(0).fixer.some((id) => g.gig(id).sides === 20)).toBe(true);
    expect(g.gigsOf(0).some((x) => x.sides === 20)).toBe(false);
    const j = spawn(g, 1, 'japantown_jonin', 'field'); // 0 power
    await playCard(g, 0, 'over_the_edge');
    expect(j.zone).toBe('field');
  });

  it('faq:6b61f796 it may defeat a friendly Unit', async () => {
    const { g, asked } = scene();
    gig(g, 0, 20, 5);
    const mine = spawn(g, 0, 'ruthless_lowlife', 'field'); // 4
    setHook(g, 0, chooseCard(mine));
    await playCard(g, 0, 'over_the_edge');
    expect(asked(0, (d) => d.tag === 'defeat')[0].options.map((o) => o.uid)).toContain(mine.uid);
    expect(mine.zone).toBe('trash');
  });

  it('faq:00b41165 it can be played without a friendly d20', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'over_the_edge', 'hand');
    eddies(g, 0, 3);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
  });
});

describe("Royce: Don't Call Me Simon", () => {
  it('faq:506cd2e9 its {Play} must defeat a rival Unit when there is a valid one', async () => {
    const { g, asked } = scene();
    const r = spawn(g, 1, 'japantown_jonin', 'field');
    await playCard(g, 0, 'royce_don_t_call_me_simon');
    expect(hasNone(asked(0, (d) => d.tag === 'defeat')[0])).toBe(false);
    expect(r.zone).toBe('trash');
  });

  it('faq:3ae8916f a 4-power Unit lowered to 2 is a valid target', async () => {
    const { g } = scene();
    const r = spawn(g, 1, 'ruthless_lowlife', 'field'); // 4
    g.givePower(r.uid, -2);
    await playCard(g, 0, 'royce_don_t_call_me_simon');
    expect(r.zone).toBe('trash');
  });
});

describe('Royce: Psycho on the Edge', () => {
  it('faq:4c90424e faq:46c436af Gear can be equipped to him face-up in the Legends area, where he has +2 per Gear during your turn', async () => {
    const { g } = scene();
    const royce = spawn(g, 0, 'royce_psycho_on_the_edge', 'legends'); // 6
    expect(g.gearHosts(0).map((c) => c.uid)).toContain(royce.uid);
    setHook(g, 0, chooseCard(royce));
    const blades = await playCard(g, 0, 'mantis_blades'); // +2 power
    expect(blades.host).toBe(royce.uid);
    expect(g.power(royce)).toBe(10); // 6 + 2 (Gear) + 2 (per Gear, your turn)
    g.s.active = 1;
    expect(g.power(royce)).toBe(8);
  });

  it('faq:903ccbd0 defeated with Gear, he is removed from the game and the Gear stays in the trash', async () => {
    const { g } = scene();
    const royce = spawn(g, 0, 'royce_psycho_on_the_edge', 'legends');
    const blades = equip(g, 0, 'mantis_blades', royce);
    await g.defeat(royce.uid);
    expect(royce.zone).toBe('removed');
    expect(blades.zone).toBe('trash');
  });
});

describe('Ruthless Lowlife', () => {
  it('faq:76746ab1 under "must attack if it can" with no rival Units it cannot attack the Gig area (and you may pass)', () => {
    const { g } = scene();
    const lo = spawn(g, 0, 'ruthless_lowlife', 'field');
    g.addMod({ kind: 'mustAttack', target: lo.uid, until: 'endOfTurn' });
    gig(g, 1, 4, 2);
    expect(g.attackTargets(lo)).toEqual([]);
    expect(g.legalActions(0).some((a) => a.type === 'pass')).toBe(true);
  });
});

describe('Satori: Sword of Saburo', () => {
  it('faq:d9ad00b9 when both Units lose (equal power) it does not draw', async () => {
    const { g } = scene();
    const u = spawn(g, 0, FILLER, 'field');
    equip(g, 0, 'satori_sword_of_saburo', u); // 6 + 2
    const r = spawn(g, 1, FILLER, 'field', { spent: true });
    g.givePower(r.uid, 2); // 8
    await atk(g, u, { unit: r });
    expect([u.zone, r.zone]).toEqual(['trash', 'trash']);
    expect(hand(g, 0)).toBe(0);
  });

  it("faq:8ba81187 winning a fight when attacked on the rival's turn draws 1", async () => {
    const { g } = scene();
    const u = spawn(g, 0, FILLER, 'field', { spent: true });
    equip(g, 0, 'satori_sword_of_saburo', u); // 8
    g.s.active = 1;
    await atk(g, spawn(g, 1, FILLER, 'field'), { unit: u });
    expect(u.zone).toBe('field');
    expect(hand(g, 0)).toBe(1);
  });
});

describe('Screw: Lovelorn Fool', () => {
  it('faq:461379b1 faq:0db0dbe4 {Defeated} must add another Unit from the trash, and another Screw counts', async () => {
    const { g, asked } = scene();
    const screw = spawn(g, 0, 'screw_lovelorn_fool', 'field');
    const other = spawn(g, 0, 'screw_lovelorn_fool', 'trash');
    await g.defeat(screw.uid);
    await g.resolvePending();
    const d = asked(0, (x) => x.prompt.startsWith('Screw'))[0];
    expect(hasNone(d)).toBe(false);
    expect(d.options.map((o) => o.uid)).toEqual([other.uid]);
    expect(other.zone).toBe('hand');
    expect(screw.zone).toBe('trash');
  });
});

describe('Shattered Memories', () => {
  it('faq:0d03437c can be played when a player has no cards in hand', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'shattered_memories', 'hand');
    eddies(g, 0, 4);
    expect(g.P(1).hand).toHaveLength(0);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await g.playFromHand(0, c.uid);
    await g.resolvePending();
    expect([hand(g, 0), hand(g, 1)]).toEqual([5, 5]);
  });
});

describe('Swordwise Huscle', () => {
  it('faq:c41cdb0c its {Attack} checks power when it resolves: reaching 5 later in the attack draws nothing', async () => {
    const { g } = scene();
    const hus = spawn(g, 0, 'swordwise_huscle', 'field'); // 3
    spawn(g, 1, 'floor_it', 'hand');
    eddies(g, 1, 1); // so player 1 is asked to react
    let pumped = false;
    setHook(g, 1, (d, gg) => {
      if (d.kind !== 'reaction') return undefined;
      if (!pumped) gg.givePower(hus.uid, 2); // the attacker gains power during the attack, after its {Attack} resolved
      pumped = true;
      return d.options.findIndex((o) => (o.action as { type: string }).type === 'endReact');
    });
    gig(g, 1, 4, 2);
    await atk(g, hus, { gigs: 1 });
    expect(pumped).toBe(true);
    expect(g.power(hus)).toBe(5);
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Valentino Guerrera', () => {
  it('faq:fbe43ae0 a ready Blocker it attacks cannot use Blocker itself', () => {
    const { g } = scene();
    gig(g, 0, 6, 5);
    gig(g, 1, 4, 2); // more Street Cred
    const v = spawn(g, 0, 'valentino_guerrera', 'field');
    const mox = spawn(g, 1, 'mox_inciters', 'field'); // ready, Blocker
    const sec = spawn(g, 1, 'corpo_security', 'field'); // ready, Blocker
    expect(g.attackTargets(v).map((t) => t.unit)).toContain(mox.uid);
    reactStep(g, v, { unit: mox });
    expect(canBlockWith(g, 1, mox)).toBe(false);
    expect(canBlockWith(g, 1, sec)).toBe(true);
  });
});

describe('V: Roamer of the Badlands', () => {
  it('faq:9eee394b stealing two Gigs in one attack triggers its first effect for each', async () => {
    const { g, asked } = scene();
    const v = spawn(g, 0, 'v_roamer_of_the_badlands', 'field'); // 6
    g.givePower(v.uid, 4); // 10: steals 2
    gigs(g, 1, [
      [4, 1],
      [6, 1],
    ]);
    await atk(g, v, { gigs: 1 });
    expect(g.P(0).gigs).toHaveLength(2);
    expect(asked(0, (d) => d.kind === 'gigValue' && d.source === v.uid)).toHaveLength(2);
  });
});

describe('V: Streetkid', () => {
  async function callV(g: Game) {
    noLegends(g, 0);
    const v = spawn(g, 0, 'v_streetkid', 'legends', { faceUp: false });
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: v.uid });
    await g.resolvePending();
  }

  it('faq:1dd664ff after trashing 3 it must add a BRAINDANCE Program when there is one', async () => {
    const { g, asked } = scene();
    const [tno] = deckOf(g, 0, ['trust_no_one', 'psycho_squad', 'psycho_squad']);
    await callV(g);
    expect(hasNone(asked(0, (d) => d.prompt.startsWith('V:'))[0])).toBe(false);
    expect(tno.zone).toBe('hand');
  });

  it('faq:ba7d3b2f with two cards left it trashes both (and the game goes on)', async () => {
    const { g } = scene();
    emptyDeck(g, 0);
    const two = deckOf(g, 0, ['psycho_squad', 'floor_it']);
    await callV(g);
    expect(two.map((c) => c.zone)).toEqual(['trash', 'trash']);
    expect(g.s.winner).toBeNull();
  });

  it('faq:15ebfd43 adds only one BRAINDANCE Program however many were trashed', async () => {
    const { g } = scene();
    deckOf(g, 0, ['trust_no_one', 'peace_offering', 'industrial_assembly']);
    await callV(g);
    expect(hand(g, 0)).toBe(1);
  });
});

describe('Yorinobu Arasaka: Embracing Destruction', () => {
  it('faq:05b95e35 a second friendly ARASAKA attack the same turn does not trigger it again', async () => {
    const { g, lines } = scene();
    noLegends(g, 0);
    spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends');
    gigs(g, 1, [
      [4, 2],
      [6, 3],
      [8, 4],
    ]);
    deckOf(g, 0, ['psycho_squad', 'psycho_squad']);
    await atk(g, spawn(g, 0, 'field_operator', 'field'), { gigs: 1 }); // ARASAKA
    await atk(g, spawn(g, 0, 'goro_takemura_losing_his_way', 'field'), { gigs: 1 }); // ARASAKA
    expect(lines().filter((t) => t === 'draws 1')).toHaveLength(1);
  });
});

describe('Yorinobu Arasaka: Steel Dragon', () => {
  it('faq:16ff9b92 a Unit it plays that has Adrenaline can attack the rival Gig area that turn', async () => {
    const { g } = scene();
    gigs(g, 1, [
      [4, 2],
      [6, 3],
    ]); // the rival controls 2+ more Gigs
    const sq = spawn(g, 0, 'psycho_squad', 'hand');
    await playCard(g, 0, 'yorinobu_arasaka_steel_dragon');
    expect(sq.zone).toBe('field');
    expect(g.attackTargets(sq)).toEqual([]); // only rival Units, and there are none
    equip(g, 0, 'adrenaline_converter', sq); // Adrenaline while the rival has 2+ more Gigs
    expect(g.attackTargets(sq)).toEqual([{ unit: null, gigs: 1 }]);
  });

  it('faq:6e649617 its own defeat, as the first ARASAKA defeat of the turn, draws 1', async () => {
    const { g } = scene();
    const y = spawn(g, 0, 'yorinobu_arasaka_steel_dragon', 'field');
    await g.defeat(y.uid);
    await g.resolvePending();
    expect(hand(g, 0)).toBe(1);
    // a second ARASAKA defeat that turn: no other copy in play, nothing more
    const y2 = spawn(g, 0, 'yorinobu_arasaka_steel_dragon', 'field');
    await g.defeat(y2.uid);
    await g.resolvePending();
    expect(hand(g, 0)).toBe(1);
  });

  it('faq:e9b2a0af "can attack rival Units this turn" still needs a spent rival Unit as the target', async () => {
    const { g } = scene();
    const ready = spawn(g, 1, FILLER, 'field');
    const spent = spawn(g, 1, FILLER, 'field', { spent: true });
    const sq = spawn(g, 0, 'psycho_squad', 'hand');
    await playCard(g, 0, 'yorinobu_arasaka_steel_dragon');
    expect(sq.zone).toBe('field');
    expect(g.attackTargets(sq)).toEqual([{ unit: spent.uid, gigs: null }]);
    expect(ready.zone).toBe('field');
  });
});
