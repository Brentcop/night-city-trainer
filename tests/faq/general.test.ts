// Official Rules FAQ conformance: the general rulings (scope "game"). Each test names the rulings it covers
// (faq:<id prefix>); the matrix entries are in tests/faq/entries/general.ts.
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/engine/engine';
import type { CardInst, PlayerId } from '../../src/engine/types';
import {
  blockBy,
  canActivate,
  canBlockWith,
  eddies,
  equip,
  gig,
  noChange,
  orderOffers,
  passTurn,
  playCard,
  playR,
  reactStep,
  reactWith,
  scene,
  setGigTo,
  spawn,
} from './faq-helpers';

const VANILLA = 'psycho_squad'; // Unit, cost 4, power 6, no text
const actionTypes = (g: Game, p: PlayerId, c: CardInst) => g.legalActions(p).filter((a) => 'uid' in a && a.uid === c.uid).map((a) => a.type);
/** Clear the three starting Legends out of player p's Legends area. */
const noLegends = (g: Game, p: PlayerId) => {
  for (const u of [...g.P(p).legends]) g.move(u, 'removed');
};

describe('Spend abilities and Lag', () => {
  it('faq:24fbf142 faq:3783e495 a Unit cannot use its {Spend} ability the turn it is played, even with Adrenaline', async () => {
    const { g } = scene();
    gig(g, 1, 6, 3);
    const kerry = await playCard(g, 0, 'kerry_eurodyne_the_last_rockerboy'); // {Spend} If you control an 8+ Gig, draw 2
    expect(kerry.lag).toBe(true);
    expect(canActivate(g, 0, kerry)).toBe(false);
    g.giveKeyword(kerry.uid, 'adrenaline');
    expect(g.attackTargets(kerry)).toEqual([{ unit: null, gigs: 1 }]); // Adrenaline lets it attack...
    expect(canActivate(g, 0, kerry)).toBe(false); // ...but not use {Spend}
    await passTurn(g); // rival's turn: lag is gone
    await passTurn(g); // back to player 0
    expect(canActivate(g, 0, kerry)).toBe(true);
  });

  it('faq:312c580c {Quick} does not let a Unit use its {Spend} ability the turn it is played, in or out of an attack', async () => {
    const { g } = scene();
    const rogue = await playCard(g, 0, 'rogue_amendiares_queen_of_the_afterlife'); // {Quick} 2 €$, {Spend}
    eddies(g, 0, 2);
    spawn(g, 1, VANILLA, 'field');
    expect(canActivate(g, 0, rogue, 0, false)).toBe(false);
    expect(canActivate(g, 0, rogue, 0, true)).toBe(false);
    rogue.lag = false; // a turn later
    expect(canActivate(g, 0, rogue, 0, false)).toBe(true);
    expect(canActivate(g, 0, rogue, 0, true)).toBe(true);
  });

  it('faq:89f8938c a Legend can use its {Spend} ability the turn it is called', async () => {
    const { g } = scene();
    const dexter = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends', { faceUp: false }); // {Spend}: increase a Gig by up to 2
    gig(g, 0, 6, 3);
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: dexter.uid });
    await g.resolvePending();
    expect(dexter.faceUp).toBe(true);
    expect(canActivate(g, 0, dexter)).toBe(true);
  });

  it('faq:0e18028c a Legend on the field cannot use a {Spend} ability the turn it was played there', async () => {
    const { g } = scene();
    noLegends(g, 0);
    const v = spawn(g, 0, 'v_corporate_exile', 'legends'); // Go Solo 5
    equip(g, 0, 'overwatch_panam_s_gift', v); // {Quick} 1 €$, {Spend} on its Unit or Legend
    spawn(g, 0, 'floor_it', 'hand');
    eddies(g, 0, 6);
    expect(canActivate(g, 0, g.c(v.gear[0]), 0, false, v)).toBe(true); // in the Legends area it could
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    await g.resolvePending();
    expect(v.zone).toBe('field');
    expect(g.available(0)).toBeGreaterThan(0);
    expect(canActivate(g, 0, g.c(v.gear[0]), 0, false, v)).toBe(false);
    v.lag = false; // a turn later
    expect(canActivate(g, 0, g.c(v.gear[0]), 0, false, v)).toBe(true);
  });
});

describe('Blocker', () => {
  it('faq:5ca60092 a Unit can use {Blocker} the turn it is played', async () => {
    const { g } = scene();
    const mox = spawn(g, 1, 'mox_inciters', 'field', { lag: true, enteredTurn: 3 }); // {Blocker}, power 2
    const att = spawn(g, 0, VANILLA, 'field');
    gig(g, 1, 6, 3);
    reactStep(g, att, { gigs: 1 });
    expect(canBlockWith(g, 1, mox)).toBe(true);
  });

  it('faq:c3602a95 after one Blocker redirected the attack, another Blocker may redirect it again', async () => {
    const { g, agents } = scene();
    const mox = spawn(g, 1, 'mox_inciters', 'field'); // power 2
    const rita = spawn(g, 1, 'rita_wheeler_no_stupid_questions', 'field'); // {Blocker}, power 4
    agents[1].hook = reactWith(blockBy(mox), blockBy(rita));
    const att = spawn(g, 0, VANILLA, 'field'); // power 6
    const x = gig(g, 1, 6, 3);
    for (let i = 0; i < 3; i++) spawn(g, 1, VANILLA, 'deck');
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(mox.zone).toBe('field'); // blocked first, then the attack moved on to Rita
    expect(mox.spent).toBe(true);
    expect(rita.zone).toBe('trash'); // Rita fought the attacker
    expect(g.gig(x).controller).toBe(1);
  });

  it('faq:7f3b28ce a ready Blocker that is itself the attack target cannot use {Blocker}; another one can', () => {
    const { g } = scene();
    const mox = spawn(g, 1, 'mox_inciters', 'field'); // ready
    const rita = spawn(g, 1, 'rita_wheeler_no_stupid_questions', 'field');
    const att = spawn(g, 0, VANILLA, 'field');
    g.addMod({ kind: 'attackReady', target: att.uid, until: 'endOfTurn' });
    reactStep(g, att, { unit: mox });
    expect(canBlockWith(g, 1, mox)).toBe(false);
    expect(canBlockWith(g, 1, rita)).toBe(true);
  });

  it('faq:e945f6ca faq:24be8b8e {Blocker} can be used against an attack on the Gig area and against an attack on another Unit', () => {
    const { g } = scene();
    const mox = spawn(g, 1, 'mox_inciters', 'field');
    const victim = spawn(g, 1, VANILLA, 'field', { spent: true });
    const att = spawn(g, 0, VANILLA, 'field');
    gig(g, 1, 6, 3);
    reactStep(g, att, { gigs: 1 });
    expect(canBlockWith(g, 1, mox)).toBe(true);
    reactStep(g, att, { unit: victim });
    expect(canBlockWith(g, 1, mox)).toBe(true);
  });

  it("faq:84df4181 a Legend's {Blocker} works only on the field, not from the Legends area", () => {
    const { g } = scene();
    const goro = spawn(g, 1, 'goro_takemura_hands_unclean', 'legends'); // face-up, {Blocker}
    const att = spawn(g, 0, VANILLA, 'field');
    gig(g, 1, 6, 3);
    reactStep(g, att, { gigs: 1 });
    expect(canBlockWith(g, 1, goro)).toBe(false);
    expect(g.legalReactions(1).some((r) => r.type === 'block')).toBe(false);
    const onField = spawn(g, 1, 'goro_takemura_hands_unclean', 'field');
    expect(canBlockWith(g, 1, onField)).toBe(true);
  });
});

describe('Go Solo and Legends played to the field', () => {
  /** Player 0 with only a V: Corporate Exile (cost 5, power 8, Go Solo) in the Legends area. */
  function vScene(opts: Partial<CardInst> = {}) {
    const s = scene();
    noLegends(s.g, 0);
    const v = spawn(s.g, 0, 'v_corporate_exile', 'legends', opts);
    return { ...s, v };
  }

  it('faq:3783f3cd a Legend may Go Solo the turn it is called', async () => {
    const { g, v } = vScene({ faceUp: false });
    eddies(g, 0, 5);
    await g.doAction(0, { type: 'call', uid: v.uid });
    await g.resolvePending();
    expect(actionTypes(g, 0, v)).toContain('goSolo'); // 4 Eddies left + V itself
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(v.zone).toBe('field');
  });

  it('faq:d623c586 a spent Legend may Go Solo, and enters as a ready Unit', async () => {
    const { g, v } = vScene({ spent: true });
    eddies(g, 0, 5);
    expect(actionTypes(g, 0, v)).toContain('goSolo');
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(v.zone).toBe('field');
    expect(v.spent).toBe(false);
  });

  it('faq:76cbd585 faq:67f85db0 a Legend with a cost may be played to the field without Go Solo: with Lag, in its orientation; a cost-null Legend may not', async () => {
    const { g, v } = vScene({ spent: true });
    const dexter = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends'); // cost null
    eddies(g, 0, 5);
    gig(g, 1, 6, 3);
    expect(actionTypes(g, 0, v)).toEqual(['goSolo', 'playLegend']);
    expect(actionTypes(g, 0, dexter).filter((t) => t === 'goSolo' || t === 'playLegend')).toEqual([]); // its {Spend} ability is still on offer
    await g.doAction(0, { type: 'playLegend', uid: v.uid });
    await g.resolvePending();
    expect(v.zone).toBe('field');
    expect(v.goSolo).toBe(false);
    expect(v.lag).toBe(true);
    expect(v.spent).toBe(true); // it was spent in the Legends area
    v.spent = false;
    expect(g.attackTargets(v)).toEqual([]); // Lag: no attack this turn
  });

  it('faq:0b681b30 a Legend that went solo is still a Legend', async () => {
    const { g, v } = vScene();
    eddies(g, 0, 5);
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(g.isLegend(v)).toBe(true);
    expect(g.faceUpLegends(0).map((c) => c.uid)).toContain(v.uid);
    expect(g.units(0).map((c) => c.uid)).toContain(v.uid); // and a Unit too
  });
});

describe('Quick', () => {
  it('faq:50377773 {Quick} cards and abilities can be used during your own turn', () => {
    const { g } = scene();
    const fi = spawn(g, 0, 'floor_it', 'hand'); // {Quick} Program
    const dumdum = spawn(g, 0, 'dum_dum_maelstrom_triggerman', 'legends'); // {Quick} 1 €$, {Spend}
    spawn(g, 0, VANILLA, 'field');
    spawn(g, 1, VANILLA, 'field');
    eddies(g, 0, 2);
    expect(actionTypes(g, 0, fi)).toContain('play');
    expect(canActivate(g, 0, dumdum)).toBe(true);
  });

  it('faq:30222dcc more than one {Quick} can be played during one rival attack', async () => {
    const { g, agents } = scene();
    const a = spawn(g, 1, 'floor_it', 'hand');
    const b = spawn(g, 1, 'floor_it', 'hand');
    agents[1].hook = reactWith(playR(a), playR(b));
    eddies(g, 1, 2);
    for (let i = 0; i < 4; i++) spawn(g, 1, VANILLA, 'deck');
    const att = spawn(g, 0, VANILLA, 'field'); // power 6
    gig(g, 1, 6, 3);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(a.zone).toBe('trash');
    expect(b.zone).toBe('trash');
    expect(g.s.log.filter((e) => e.text === 'plays Floor It')).toHaveLength(2);
  });

  it("faq:a80e4bdc a player cannot answer the rival's {Quick} with a {Quick}", async () => {
    const s = scene();
    const { g, agents } = s;
    const theirs = spawn(g, 1, 'floor_it', 'hand');
    agents[1].hook = reactWith(playR(theirs));
    eddies(g, 1, 1);
    const mine = spawn(g, 0, 'floor_it', 'hand');
    eddies(g, 0, 1);
    for (let i = 0; i < 4; i++) spawn(g, 1, VANILLA, 'deck');
    const att = spawn(g, 0, VANILLA, 'field');
    gig(g, 1, 6, 3);
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(theirs.zone).toBe('trash');
    expect(mine.zone).toBe('hand');
    expect(agents[0].log.some((d) => d.kind === 'reaction')).toBe(false); // the attacker is never offered a response
  });
});

describe('Ordering pending effects (10.12)', () => {
  it('faq:3bfca564 two {Attack} effects that become pending together can be resolved in either order', async () => {
    const { g, agents } = scene({ order: [0] });
    const jackie = spawn(g, 0, 'jackie_welles_ride_or_die_choom', 'field'); // {Attack} +2 per friendly even Gig
    equip(g, 0, 'dying_night_v_s_pistol', jackie); // {Attack} decrease a Gig by up to 2
    gig(g, 0, 4, 2);
    gig(g, 1, 6, 5);
    await g.attack(0, jackie.uid, { unit: null, gigs: 1 });
    const offers = orderOffers(agents[0]);
    expect(offers).toHaveLength(1);
    expect(offers[0].some((l) => l.includes('Jackie Welles') && l.endsWith('{Attack}') && !l.includes('Dying Night'))).toBe(true);
    expect(offers[0].some((l) => l.startsWith('Dying Night') && l.endsWith('{Attack}'))).toBe(true);
  });

  it('faq:1d2ed684 an {Attack} effect and a "when a friendly Unit attacks, draw" effect can be resolved in either order', async () => {
    const { g, agents } = scene({ order: [0] });
    for (const u of g.P(0).legends) g.c(u).faceUp = true;
    spawn(g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends'); // first ARASAKA attack each turn: draw 1
    const goro = spawn(g, 0, 'goro_takemura_losing_his_way', 'field'); // ARASAKA, {Attack} +5 if all friendly Legends are face-up
    gig(g, 1, 6, 5);
    await g.attack(0, goro.uid, { unit: null, gigs: 1 });
    const offers = orderOffers(agents[0]);
    expect(offers).toHaveLength(1);
    expect(offers[0].some((l) => l.startsWith('Goro Takemura') && l.endsWith('{Attack}'))).toBe(true);
    expect(offers[0].some((l) => l.startsWith('Yorinobu Arasaka'))).toBe(true);
  });

  it('faq:3d7dd7c9 a {Play} effect and a "when a friendly Legend is spent, draw" effect can be resolved in either order', async () => {
    const { g, agents } = scene({ order: [0] });
    const dexter = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends'); // ready, face-up: a payment source
    equip(g, 0, 'netwatch_netdriver', dexter); // when this Unit or Legend is spent, draw 1
    eddies(g, 0, 1);
    const jonin = spawn(g, 0, 'japantown_jonin', 'hand'); // cost 2, {Play} give a friendly Unit +2 power
    await g.playFromHand(0, jonin.uid); // pays with the Eddie and Dexter
    await g.resolvePending();
    expect(dexter.spent).toBe(true);
    const offers = orderOffers(agents[0]);
    expect(offers).toHaveLength(1);
    expect(offers[0].some((l) => l === 'Japantown Jonin {Play}')).toBe(true);
    expect(offers[0].some((l) => l.startsWith('NetWatch Netdriver') && l.endsWith('when spent'))).toBe(true);
  });
});

describe('Prevented defeats', () => {
  it('faq:d05760ef a Unit whose defeat is prevented does not get its {Defeated} effect', async () => {
    const { g } = scene();
    const screw = spawn(g, 0, 'screw_lovelorn_fool', 'field'); // {Defeated} add another Unit from your trash to hand
    const dm = equip(g, 0, 'deadman_transmitter', screw); // defeated instead of its Unit
    spawn(g, 0, VANILLA, 'trash');
    expect(await g.defeat(screw.uid)).toBe(false);
    expect(g.pending).toHaveLength(0);
    await g.resolvePending();
    expect(screw.zone).toBe('field');
    expect(dm.zone).toBe('trash');
    expect(g.P(0).hand).toHaveLength(0);
    // a defeat that is not prevented does trigger it
    expect(await g.defeat(screw.uid)).toBe(true);
    await g.resolvePending();
    expect(g.P(0).hand).toHaveLength(1);
  });
});

describe('Adjusting a Gig by up to X', () => {
  it('faq:51e197ed choosing 0 is allowed but is not adjusting a Gig: "when a Gig is adjusted" effects do not trigger', async () => {
    const run = async (adjust: boolean) => {
      const s = scene();
      const { g, agents } = s;
      spawn(g, 1, 'meredith_stout_stone_cold_corpo', 'field'); // when a Rival adjusts a friendly Gig, add a card from your trash
      spawn(g, 1, VANILLA, 'trash');
      const x = gig(g, 1, 6, 3);
      agents[0].hook = adjust ? setGigTo(x, 4) : noChange;
      await playCard(g, 0, 'afterparty_at_lizzie_s'); // adjust a Gig by up to 1
      const asked = s.asked(0, (d) => d.kind === 'gigValue');
      return { g, x, asked };
    };
    const zero = await run(false);
    expect(zero.asked[0].options.some((o) => o.key === 'none')).toBe(true); // 0 is a legal choice
    expect(zero.g.gig(zero.x).value).toBe(3);
    expect(zero.g.P(1).hand).toHaveLength(0); // Meredith did not trigger
    const one = await run(true);
    expect(one.g.gig(one.x).value).toBe(4);
    expect(one.g.P(1).hand).toHaveLength(1); // a real adjustment does trigger her
  });
});
