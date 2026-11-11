// Official Rules FAQ, Yellow cards: one test per ruling (or group), each naming its rulings as faq:<id prefix>.
// The matrix entries are in tests/faq/entries/yellow.ts.
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/engine/engine';
import type { CardInst, Decision, PlayerId } from '../../src/engine/types';
import {
  activate,
  answerYes,
  canActivate,
  canBlockWith,
  chooseCard,
  chooseMode,
  deckOf,
  eddies,
  equip,
  gig,
  gigs,
  noChange,
  onKind,
  orderOffers,
  playCard,
  reactWith,
  scene,
  setGigTo,
  spawn,
  type Hook,
} from './faq-helpers';

const hand = (g: Game, p: PlayerId) => g.P(p).hand.length;
const noneIndex = (d: Decision) => d.options.findIndex((o) => o.key === 'none');
/** A hook that defers to whatever `ref.h` is when the decision is asked (for hooks that need cards made later). */
const later =
  (ref: { h: Hook | null }): Hook =>
  (d, g) =>
    ref.h?.(d, g);
/** Decisions of this tag that offered a "None" option. */
const optional = (ds: Decision[]) => ds.filter((d) => noneIndex(d) >= 0);

describe('Adam Smasher: Metal Over Meat', () => {
  it("faq:a40401c6 played during the rival's turn (The Relic plays it from the trash), its {Play} still resolves", async () => {
    const { g } = scene();
    g.s.active = 1;
    const host = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'the_relic_experimental_biochip', host);
    const adam = spawn(g, 0, 'adam_smasher_metal_over_meat', 'trash');
    const theirs = spawn(g, 1, 'psycho_squad', 'field');
    await g.defeat(host.uid);
    await g.resolvePending();
    expect(adam.zone).toBe('field');
    expect(theirs.zone).toBe('trash');
  });
});

describe('Adrenaline Converter', () => {
  it('faq:fc82d674 Adrenaline is checked when the attack is declared: once the rival is only 1 Gig ahead, the Unit played this turn cannot attack', () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field', {
      lag: true,
      enteredTurn: 3,
    });
    equip(g, 0, 'adrenaline_converter', u);
    const [d4] = gigs(g, 1, [
      [4, 2],
      [6, 3],
    ]);
    expect(g.attackTargets(u)).toEqual([{ unit: null, gigs: 1 }]);
    g.moveGig(d4, 0); // another friendly Unit stole a Gig: the rival is now 1 ahead
    expect(g.hasKw(u, 'adrenaline')).toBe(false);
    expect(g.attackTargets(u)).toEqual([]);
  });

  it("faq:21a17dbf a Unit does not gain its Gear's tags (an ARASAKA Gear does not make it ARASAKA for Saburo)", () => {
    const { g } = scene();
    spawn(g, 0, 'saburo_arasaka_stubborn_patriarch', 'legends');
    const u = spawn(g, 0, 'psycho_squad', 'field'); // NCPD
    equip(g, 0, 'the_relic_experimental_biochip', u); // Arasaka / Cyberware, power 3
    const arasaka = spawn(g, 0, 'field_operator', 'field'); // Arasaka Unit, power 2
    expect(g.isTag(u, 'Arasaka')).toBe(false);
    expect(g.isTag(u, 'Cyberware')).toBe(false);
    const at = (c: CardInst) => {
      g.s.attack = {
        attacker: c.uid,
        attackerPlayer: 0,
        targetUnit: null,
        targetGigs: 1,
        step: 'react',
        ended: false,
      };
      const p = g.power(c);
      g.s.attack = null;
      return p;
    };
    expect(at(u)).toBe(9); // 6 + 3, no +1 while attacking
    expect(at(arasaka)).toBe(3); // a real ARASAKA Unit gets the +1
  });
});

describe("Afterparty at Lizzie's", () => {
  it('faq:e81b51a1 adjusting by 0 still draws when you control 2+ Gigs with different values', async () => {
    const { g } = scene({ hooks: [noChange, null] });
    gigs(g, 0, [
      [4, 2],
      [6, 5],
    ]);
    await playCard(g, 0, 'afterparty_at_lizzie_s');
    expect(g.gigsOf(0).map((x) => x.value)).toEqual([2, 5]);
    expect(hand(g, 0)).toBe(1);
  });

  it('faq:76dce69b it can be played with no Gigs in play at all', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'afterparty_at_lizzie_s', 'hand');
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await g.playFromHand(0, c.uid);
    await g.resolvePending();
    expect(c.zone).toBe('trash');
  });
});

describe('Alt Cunningham: Mother of Daemons', () => {
  it("faq:9c300537 both effects work on either player's turn", async () => {
    const { g } = scene();
    spawn(g, 0, 'alt_cunningham_mother_of_daemons', 'field');
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'mantis_blades', u);
    // first effect: on your turn, then on the rival's
    g.spend(u.uid);
    await g.resolvePending();
    expect(hand(g, 0)).toBe(1);
    u.spent = false;
    g.s.active = 1;
    g.spend(u.uid);
    await g.resolvePending();
    expect(hand(g, 0)).toBe(2);
    // second effect: a rival steal on the rival's turn, and one on your own turn
    for (const c of [...g.P(0).hand]) g.move(c, 'deck');
    const d6 = gig(g, 0, 6, 3);
    const d8 = gig(g, 0, 8, 3);
    spawn(g, 0, 'mox_inciters', 'hand'); // cost 3
    spawn(g, 0, 'la_llorona_ghost_of_the_past', 'hand'); // cost 3
    const att = spawn(g, 1, 'psycho_squad', 'field');
    await g.attack(1, att.uid, { unit: null, gigs: 0 });
    expect(g.gig(d6).controller).toBe(0);
    expect(hand(g, 0)).toBe(1);
    g.s.active = 0;
    await g.stealOne(1, att.uid);
    expect([g.gig(d6).controller, g.gig(d8).controller]).toEqual([0, 0]);
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Augmented Negotiators', () => {
  it('faq:1dc1d892 it may use Blocker even when the rival has no cards in hand', async () => {
    const { g } = scene({
      hooks: [reactWith((r) => r.type === 'block'), null],
    });
    const an = spawn(g, 0, 'augmented_negotiators', 'field');
    gig(g, 0, 6, 3);
    const att = spawn(g, 1, 'psycho_squad', 'field');
    expect(hand(g, 1)).toBe(0);
    g.s.active = 1;
    g.s.attack = {
      attacker: att.uid,
      attackerPlayer: 1,
      targetUnit: null,
      targetGigs: 0,
      step: 'react',
      ended: false,
    };
    expect(canBlockWith(g, 0, an)).toBe(true);
    g.s.attack = null;
    await g.attack(1, att.uid, { unit: null, gigs: 0 });
    expect(an.zone).toBe('trash'); // it blocked and lost the fight
    expect(g.gigsOf(0)).toHaveLength(1);
  });
});

describe('Bootleg Black Sapphire Show', () => {
  it('faq:63c9a5f8 faq:71cfd404 the top card is sold face down, unrevealed and unchecked: even a card without the sell tag', async () => {
    const { g, asked, lines, mark } = scene();
    const [top] = deckOf(g, 0, ['secondhand_bombus']); // a Unit with no sell tag
    expect(g.def(top).sellable).toBe(false);
    const before = g.P(0).eddies.length;
    const c = spawn(g, 0, 'bootleg_black_sapphire_show', 'hand');
    eddies(g, 0, 5);
    mark();
    await g.playFromHand(0, c.uid);
    await g.resolvePending();
    expect(top.zone).toBe('eddies');
    expect(top.faceUp).toBe(false);
    expect(g.P(0).eddies.length).toBe(before + 5 + 1);
    expect(lines().some((t) => t.includes(g.name(top)))).toBe(false);
    expect(asked(0)).toHaveLength(0);
  });

  it("faq:68737f4d faq:303bd280 it sells even after this turn's Sell action, and does not use up the Sell action", async () => {
    const { g } = scene();
    const sellable = spawn(g, 0, 'floor_it', 'hand');
    await g.doAction(0, { type: 'sell', uid: sellable.uid });
    const [top] = deckOf(g, 0, ['psycho_squad']);
    await playCard(g, 0, 'bootleg_black_sapphire_show');
    expect(top.zone).toBe('eddies');
    // and the other way round: the effect leaves the Sell action available
    const s2 = scene();
    await playCard(s2.g, 0, 'bootleg_black_sapphire_show');
    const more = spawn(s2.g, 0, 'floor_it', 'hand');
    expect(s2.g.legalActions(0).some((a) => a.type === 'sell' && a.uid === more.uid)).toBe(true);
  });
});

describe("Caliber: Totentanz's Top Dog", () => {
  it('faq:31c66530 its {Play} must defeat a rival Unit with cost 2 or less when there is one', async () => {
    const { g, asked } = scene();
    const small = spawn(g, 1, 'secondhand_bombus', 'field'); // cost 2
    const big = spawn(g, 1, 'psycho_squad', 'field'); // cost 4
    await playCard(g, 0, 'caliber_totentanz_s_top_dog');
    expect(small.zone).toBe('trash');
    expect(big.zone).toBe('field');
    const ds = asked(0, (d) => d.tag === 'defeat');
    expect(ds).toHaveLength(1);
    expect(optional(ds)).toHaveLength(0);
  });

  it('faq:03bc1552 {Defeated}: a matching cost on the second discard does not make the rival discard a third card', async () => {
    const { g } = scene();
    gigs(g, 0, [
      [4, 4],
      [6, 3],
    ]);
    const cal = spawn(g, 0, 'caliber_totentanz_s_top_dog', 'field');
    spawn(g, 1, 'gorilla_arms', 'hand'); // cost 4: matches the d4
    spawn(g, 1, 'mox_inciters', 'hand'); // cost 3: matches the d6
    const left = spawn(g, 1, 'kiroshi_optics', 'hand');
    await g.defeat(cal.uid);
    await g.resolvePending();
    expect(g.P(1).hand).toEqual([left.uid]);
  });
});

describe('Cyberpsychosis', () => {
  it('faq:b59cc194 it may choose an equipped rival Unit as well as an equipped friendly one', async () => {
    const ref: { h: Hook | null } = { h: null };
    const { g, asked } = scene({ hooks: [later(ref), null] });
    const mine = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'mantis_blades', mine);
    const theirs = spawn(g, 1, 'psycho_squad', 'field');
    equip(g, 1, 'mantis_blades', theirs);
    ref.h = chooseCard(theirs);
    await playCard(g, 0, 'cyberpsychosis');
    const d = asked(0, (x) => x.tag === 'pump')[0];
    expect(d.options.map((o) => o.uid).sort()).toEqual([mine.uid, theirs.uid].sort());
    expect(g.power(theirs)).toBe(6 + 2 + 3);
  });

  /** Player 1 attacks player 0's Gig area with an equipped Unit; player 0 answers with Cyberpsychosis on it. */
  async function psychoOnAttacker(o: { preventSteal: boolean }) {
    const { g } = scene({ hooks: [reactWith((r) => r.type === 'play'), null] });
    g.s.active = 1;
    const att = spawn(g, 1, 'psycho_squad', 'field');
    equip(g, 1, 'mantis_blades', att);
    gig(g, 0, 6, 5);
    spawn(g, 0, 'cyberpsychosis', 'hand');
    eddies(g, 0, 3);
    if (o.preventSteal) {
      spawn(g, 0, 'alt_cunningham_mother_of_daemons', 'field');
      spawn(g, 0, 'caliber_totentanz_s_top_dog', 'hand'); // cost 5: discarded to stop the steal of the 5
    }
    await g.attack(1, att.uid, { unit: null, gigs: 0 });
    await g.resolvePending();
    expect(g.power(att)).toBe(6 + 2 + 3);
    return { g, att };
  }

  it('faq:0f661d5c played on an attacking rival Unit in the React step: it steals, so it is defeated at the end of the turn', async () => {
    const { g, att } = await psychoOnAttacker({ preventSteal: false });
    expect(g.gigsOf(1)).toHaveLength(1);
    expect(att.zone).toBe('field');
    await g.endPhase();
    expect(att.zone).toBe('trash');
  });

  it('faq:0a4c62a0 a Unit that attacks but neither fights nor steals is not defeated at the end of the turn', async () => {
    const { g, att } = await psychoOnAttacker({ preventSteal: true });
    expect(g.gigsOf(1)).toHaveLength(0);
    await g.endPhase();
    expect(att.zone).toBe('field');
  });

  it('faq:9c061c73 stealing or fighting before Cyberpsychosis resolves does not count', async () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'mantis_blades', u);
    gig(g, 1, 6, 3);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    expect(g.gigsOf(0)).toHaveLength(1);
    await playCard(g, 0, 'cyberpsychosis');
    expect(g.power(u)).toBe(11);
    await g.endPhase();
    expect(u.zone).toBe('field');
  });
});

describe('Dexter DeShawn: One Last Chance', () => {
  it('faq:ac95df60 adjusting by 0 is not adjusting a Gig: a rival Meredith Stout does not trigger', async () => {
    const ref: { h: Hook | null } = { h: noChange };
    const { g } = scene({ hooks: [later(ref), null] });
    spawn(g, 1, 'meredith_stout_stone_cold_corpo', 'field');
    const back = spawn(g, 1, 'psycho_squad', 'trash');
    const d6 = gig(g, 1, 6, 3);
    await playCard(g, 0, 'dexter_deshawn_one_last_chance');
    expect(g.gig(d6).value).toBe(3);
    expect(back.zone).toBe('trash');
    // a real adjustment of the rival's Gig does trigger it
    ref.h = setGigTo(d6, 4);
    await playCard(g, 0, 'dexter_deshawn_one_last_chance');
    expect(g.gig(d6).value).toBe(4);
    expect(back.zone).toBe('hand');
  });
});

describe('Dum Dum: Maelstrom Triggerman', () => {
  it('faq:94144c1c fixed: its ability may target a friendly Unit with no Gear (+0 power)', async () => {
    const { g, asked } = scene();
    const dd = spawn(g, 0, 'dum_dum_maelstrom_triggerman', 'legends');
    const bare = spawn(g, 0, 'psycho_squad', 'field');
    eddies(g, 0, 1);
    expect(canActivate(g, 0, dd)).toBe(true);
    expect(canActivate(g, 0, dd, 0, true)).toBe(true); // {Quick}
    await activate(g, 0, dd);
    expect(asked(0, (d) => d.tag === 'pump')[0].options.map((o) => o.uid)).toEqual([bare.uid]);
    expect(dd.spent).toBe(true);
    expect(g.power(bare)).toBe(6);
  });

  it('faq:bfb1adc4 the +1 per Gear is fixed when it resolves: defeating the Gear later does not remove it', async () => {
    const { g } = scene();
    const dd = spawn(g, 0, 'dum_dum_maelstrom_triggerman', 'legends');
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const k = equip(g, 0, 'kiroshi_optics', u); // power 1
    eddies(g, 0, 1);
    await activate(g, 0, dd);
    expect(g.power(u)).toBe(6 + 1 + 1);
    g.defeatGear(k.uid);
    expect(g.power(u)).toBe(6 + 1);
  });
});

describe('Gilded Matón', () => {
  it('faq:db8d72b0 fixed: a friendly Gear may be defeated even with no rival Unit of cost 3 or less', async () => {
    const { g, asked } = scene({
      hooks: [onKind('card', 0, 'defeatGear'), null],
    });
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const k = equip(g, 0, 'kiroshi_optics', u);
    spawn(g, 1, 'psycho_squad', 'field'); // cost 4: not a target
    await playCard(g, 0, 'gilded_maton');
    expect(asked(0, (d) => d.tag === 'defeatGear')).toHaveLength(1);
    expect(k.zone).toBe('trash');
  });
});

describe('Gorilla Arms', () => {
  it("faq:978f0a21 its extra steal is the equipped Unit stealing: the Unit's own steal effect (Maelstrom Goons) triggers for it", async () => {
    const { g } = scene();
    const goons = spawn(g, 0, 'maelstrom_goons', 'field'); // 3 + 3 = 6 power: steals 1
    equip(g, 0, 'gorilla_arms', goons);
    gigs(g, 1, [
      [4, 2],
      [6, 5],
    ]);
    for (let i = 0; i < 3; i++) spawn(g, 1, 'psycho_squad', 'hand');
    await g.attack(0, goons.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(g.gigsOf(0)).toHaveLength(2);
    expect(hand(g, 1)).toBe(1); // one discard per Gig stolen
  });

  it('faq:cc4b6cc1 stealing 2 Gigs at once is one "first time": a single extra steal', async () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'gorilla_arms', u);
    g.givePower(u.uid, 1); // 6 + 3 + 1 = 10: steals 2
    gigs(g, 1, [
      [4, 1],
      [6, 2],
      [8, 3],
      [10, 4],
    ]);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(g.gigsOf(0)).toHaveLength(3);
    expect(g.gigsOf(1)).toHaveLength(1);
  });
});

describe('Heywood Ripperdoc', () => {
  it("faq:89eca244 it may defeat a Gear whose cost matches no friendly Gig (it just doesn't draw)", async () => {
    const { g } = scene();
    gig(g, 0, 6, 4);
    const r = spawn(g, 1, 'psycho_squad', 'field');
    const k = equip(g, 1, 'kiroshi_optics', r); // cost 1
    await playCard(g, 0, 'heywood_ripperdoc');
    expect(k.zone).toBe('trash');
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Jackie Welles: Ride or Die Choom', () => {
  it('faq:801aa9c8 faq:c61101be the {Attack} bonus is fixed when it resolves: later Gig changes neither remove nor add to it', async () => {
    const { g } = scene();
    const jackie = spawn(g, 0, 'jackie_welles_ride_or_die_choom', 'field'); // 8
    const [d4] = gigs(g, 0, [
      [4, 2],
      [6, 3],
    ]);
    gig(g, 1, 8, 1);
    await g.attack(0, jackie.uid, { unit: null, gigs: 1 });
    expect(g.power(jackie)).toBe(10); // one even Gig
    gig(g, 0, 10, 6); // another even friendly Gig
    expect(g.power(jackie)).toBe(10);
    g.gig(d4).value = 3; // the even Gig becomes odd
    expect(g.power(jackie)).toBe(10);
  });
});

describe('Kerry Eurodyne: Axe, Attitude, Audience', () => {
  async function rollMaxThenReroll(to: number) {
    const { g } = scene();
    spawn(g, 0, 'kerry_eurodyne_axe_attitude_audience', 'legends');
    const d6 = gig(g, 0, 6, 6); // rolled a max
    g.reroll = (gid: number) => void (g.gig(gid).value = to);
    g.emit('gigRolled', { gig: d6, player: 0, fromFixer: true });
    await g.resolvePending(); // Scripted answers yes to the reroll
    return { g, d6 };
  }

  it('faq:91ff465b rerolling a min/max roll into a middle value does not draw', async () => {
    const { g, d6 } = await rollMaxThenReroll(3);
    expect(g.gig(d6).value).toBe(3);
    expect(hand(g, 0)).toBe(0);
    const again = await rollMaxThenReroll(1); // a min on the reroll does
    expect(hand(again.g, 0)).toBe(1);
  });
});

describe('Kiroshi Optics', () => {
  it('faq:22d75516 its {Attack} must look at a friendly face-down Legend', async () => {
    const { g, asked } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'kiroshi_optics', u);
    gig(g, 1, 6, 3);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    const ds = asked(0, (d) => d.tag === 'look');
    expect(ds).toHaveLength(1);
    expect(optional(ds)).toHaveLength(0);
    expect(g.faceDownLegends(0).filter((c) => c.known)).toHaveLength(1);
  });
});

describe('Live with the Aftermath', () => {
  async function aftermath(friendly: boolean, rival: boolean) {
    const { g } = scene();
    const mine = friendly ? spawn(g, 0, 'psycho_squad', 'field') : null;
    const theirs = rival ? spawn(g, 1, 'psycho_squad', 'field') : null;
    const c = spawn(g, 0, 'live_with_the_aftermath', 'hand');
    eddies(g, 0, 3);
    const playable = g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid);
    await g.playFromHand(0, c.uid);
    await g.resolvePending();
    return { playable, c, mine, theirs };
  }

  it('faq:3c7f6d4d faq:a391a6fc faq:8ebfb418 playable with no friendly Units, no rival Units, or none at all; whoever has a Unit defeats one', async () => {
    const a = await aftermath(false, true);
    expect(a.playable).toBe(true);
    expect(a.theirs!.zone).toBe('trash');
    const b = await aftermath(true, false);
    expect(b.playable).toBe(true);
    expect(b.mine!.zone).toBe('trash');
    const c = await aftermath(false, false);
    expect(c.playable).toBe(true);
    expect(c.c.zone).toBe('trash');
  });
});

describe('Maelstrom Goons', () => {
  it('faq:bd1e1e2f equipped and stealing 2 Gigs in one Steal step: the rival discards once per Gig', async () => {
    const { g } = scene();
    const goons = spawn(g, 0, 'maelstrom_goons', 'field');
    equip(g, 0, 'mantis_blades', goons); // 3 + 2
    g.givePower(goons.uid, 5); // 10: steals 2
    gigs(g, 1, [
      [4, 1],
      [6, 2],
    ]);
    for (let i = 0; i < 3; i++) spawn(g, 1, 'psycho_squad', 'hand');
    await g.attack(0, goons.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(g.gigsOf(0)).toHaveLength(2);
    expect(hand(g, 1)).toBe(1);
  });
});

describe('MaxTac Suppression Team', () => {
  it('faq:00a253c5 a Legend that went solo this turn cannot attack while the rival has it', async () => {
    const { g } = scene();
    spawn(g, 1, 'maxtac_suppression_team', 'field');
    gig(g, 1, 6, 3);
    const v = spawn(g, 0, 'v_corporate_exile', 'legends');
    eddies(g, 0, 4);
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    expect(v.zone).toBe('field');
    expect(g.attackTargets(v)).toEqual([]);
  });

  it('faq:8923c8fb once it is defeated, a Unit with Adrenaline played earlier this turn can attack', async () => {
    const { g } = scene();
    const mst = spawn(g, 1, 'maxtac_suppression_team', 'field');
    gig(g, 1, 6, 3);
    const nomad = await playCard(g, 0, 'riding_nomad');
    expect(g.attackTargets(nomad)).toEqual([]);
    await g.defeat(mst.uid);
    expect(g.attackTargets(nomad)).toEqual([{ unit: null, gigs: 1 }]);
  });
});

describe('Muamar Reyes: El Capitán', () => {
  async function callMuamar(g: Game) {
    const m = spawn(g, 0, 'muamar_reyes_el_capitan', 'legends', {
      faceUp: false,
    });
    await g.callLegend(0, m.uid, { free: true });
    await g.resolvePending();
    return m;
  }

  it('faq:63f515ca the "can\'t be defeated in a fight" mode may be chosen with no friendly Units; it then does nothing', async () => {
    const { g, asked } = scene({
      hooks: [chooseMode("can't be defeated"), null],
    });
    await callMuamar(g);
    expect(asked(0, (d) => d.kind === 'mode')[0].options).toHaveLength(2);
    expect(hand(g, 0)).toBe(0);
    expect(g.s.mods.filter((m) => m.kind === 'noFightDefeat')).toHaveLength(0);
  });

  it('faq:329babc2 the protection holds for every fight that Unit has this turn', async () => {
    const { g } = scene({ hooks: [chooseMode("can't be defeated"), null] });
    const u = spawn(g, 0, 'secondhand_bombus', 'field');
    await callMuamar(g);
    for (let i = 0; i < 2; i++) {
      const big = spawn(g, 1, 'psycho_squad', 'field');
      await g.fight(big.uid, u.uid);
      await g.resolvePending();
    }
    expect(u.zone).toBe('field');
  });

  it("faq:c155d52c a Unit that can't be defeated in a fight still loses it (Safety Override sees the loss)", async () => {
    const { g } = scene({ hooks: [chooseMode("can't be defeated"), null] });
    const u = spawn(g, 0, 'secondhand_bombus', 'field');
    await callMuamar(g);
    await playCard(g, 0, 'safety_override');
    const big = spawn(g, 1, 'psycho_squad', 'field');
    expect(g.fightOutcome(big.uid, u.uid).b).toBe('lose');
    await g.fight(big.uid, u.uid);
    await g.resolvePending();
    expect(u.zone).toBe('field');
    expect(big.zone).toBe('trash');
  });

  it('faq:58c1eb56 it does not stop a defeat by an effect during the Fight step (Maelstrom Zealots)', async () => {
    const { g } = scene({ hooks: [chooseMode("can't be defeated"), null] });
    const u = spawn(g, 0, 'psycho_squad', 'field');
    await callMuamar(g);
    expect(g.hasMod('noFightDefeat', u.uid)).toBe(true);
    const zealots = spawn(g, 1, 'maelstrom_zealots', 'field', { spent: true });
    await g.attack(0, u.uid, { unit: zealots.uid, gigs: null });
    await g.resolvePending();
    expect(zealots.zone).toBe('trash');
    expect(u.zone).toBe('trash');
  });
});

describe('Offduty Malfini', () => {
  it('faq:b91fa741 its {Play} spends it even with no rival Unit', async () => {
    const { g } = scene();
    const m = await playCard(g, 0, 'offduty_malfini');
    expect(m.spent).toBe(true);
  });
});

describe('River Ward: Detective on the Hunt', () => {
  it('faq:88707f62 fixed: its ability can be activated with no Gear to play; it just spends River Ward', async () => {
    const { g } = scene();
    const rw = spawn(g, 0, 'river_ward_detective_on_the_hunt', 'legends');
    expect(canActivate(g, 0, rw)).toBe(true);
    expect(canActivate(g, 0, rw, 0, true)).toBe(true);
    await activate(g, 0, rw);
    expect(rw.spent).toBe(true);
  });

  it('faq:81489d83 the free Gear may go on any friendly Unit or face-up Legend, not only River Ward', async () => {
    const ref: { h: Hook | null } = { h: null };
    const { g, asked } = scene({ hooks: [later(ref), null] });
    const rw = spawn(g, 0, 'river_ward_detective_on_the_hunt', 'legends');
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const k = spawn(g, 0, 'kiroshi_optics', 'hand');
    ref.h = (d) => (d.tag === 'equip' ? d.options.findIndex((o) => o.uid === u.uid) : undefined);
    await activate(g, 0, rw);
    const hosts = asked(0, (d) => d.tag === 'equip')[0].options.map((o) => o.uid);
    expect(hosts).toContain(rw.uid);
    expect(hosts).toContain(u.uid);
    expect(k.host).toBe(u.uid);
  });

  it('faq:a6ed37cc faq:28a594b5 when a friendly equipped Unit is defeated, one of the top 2 must be trashed and the other stays on top', async () => {
    const { g, asked } = scene();
    spawn(g, 0, 'river_ward_detective_on_the_hunt', 'legends');
    const [first, second] = deckOf(g, 0, ['mox_inciters', 'kiroshi_optics']);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'mantis_blades', u);
    await g.defeat(u.uid);
    await g.resolvePending();
    const ds = asked(0, (d) => d.tag === 'trash');
    expect(ds).toHaveLength(1);
    expect(optional(ds)).toHaveLength(0);
    expect(first.zone).toBe('trash');
    expect(g.P(0).deck[0]).toBe(second.uid);
  });
});

describe('Rogue Amendiares: Preem Solo', () => {
  it('faq:e4837808 Rogue stealing a Gig herself (gone solo) triggers her steal effect', async () => {
    const { g } = scene();
    const rogue = spawn(g, 0, 'rogue_amendiares_preem_solo', 'legends');
    eddies(g, 0, 6);
    gig(g, 1, 4, 2); // even: draw 1
    await g.doAction(0, { type: 'goSolo', uid: rogue.uid });
    await g.attack(0, rogue.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(g.gigsOf(0)).toHaveLength(1);
    expect(hand(g, 0)).toBe(1);
  });

  it('faq:c66b9c47 face-up in the Legends area, she triggers when another friendly Legend steals', async () => {
    const { g } = scene();
    spawn(g, 0, 'rogue_amendiares_preem_solo', 'legends');
    const v = spawn(g, 0, 'v_corporate_exile', 'legends');
    eddies(g, 0, 4);
    gig(g, 1, 6, 3); // odd: a rival discards 1
    spawn(g, 1, 'psycho_squad', 'hand');
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    await g.attack(0, v.uid, { unit: null, gigs: 1 });
    await g.resolvePending();
    expect(g.gigsOf(0)).toHaveLength(1);
    expect(hand(g, 1)).toBe(0);
  });

  it("faq:b0f84fb0 a defeated Legend's Gear goes to the trash with it and stays there while the Legend is removed", async () => {
    const { g } = scene();
    const solo = spawn(g, 0, 'rogue_amendiares_preem_solo', 'field', {
      goSolo: true,
    });
    const k1 = equip(g, 0, 'kiroshi_optics', solo);
    await g.defeat(solo.uid);
    expect(solo.zone).toBe('removed');
    expect(k1.zone).toBe('trash');
    const up = spawn(g, 0, 'rogue_amendiares_preem_solo', 'legends');
    const k2 = equip(g, 0, 'kiroshi_optics', up);
    await g.defeat(up.uid);
    expect(up.zone).toBe('removed');
    expect(k2.zone).toBe('trash');
  });
});

describe('Safety Override', () => {
  it("faq:6b38d8b1 faq:b9a0ac9f fixed: it chooses a friendly Unit in the field; that Unit's lost fight defeats the opponent, and it is still defeated itself", async () => {
    const ref: { h: Hook | null } = { h: null };
    const { g, asked } = scene({ hooks: [later(ref), null] });
    const other = spawn(g, 0, 'secondhand_bombus', 'field');
    const chosen = spawn(g, 0, 'mox_inciters', 'field');
    spawn(g, 0, 'psycho_squad', 'hand'); // not in the field: not a choice
    ref.h = chooseCard(chosen);
    await playCard(g, 0, 'safety_override');
    expect(asked(0, (d) => d.tag === 'protect')[0].options.map((o) => o.uid)).toEqual([other.uid, chosen.uid]);
    const a = spawn(g, 1, 'psycho_squad', 'field');
    await g.fight(a.uid, other.uid); // another friendly Unit loses: nothing happens
    await g.resolvePending();
    expect(other.zone).toBe('trash');
    expect(a.zone).toBe('field');
    await g.fight(a.uid, chosen.uid);
    await g.resolvePending();
    expect(a.zone).toBe('trash');
    expect(chosen.zone).toBe('trash'); // it still lost the fight
  });

  it('faq:6b38d8b1 with no friendly Unit in the field it is still playable and does nothing', async () => {
    const { g } = scene();
    await playCard(g, 0, 'safety_override');
    expect(g.s.mods.filter((m) => m.kind === 'delayed')).toHaveLength(0);
  });
});

describe('Sketchy Ripper', () => {
  it('faq:9e6de445 its {Attack} may reveal nothing even with a Gear among the top 3; all 3 go to the bottom', async () => {
    const { g } = scene({ hooks: [onKind('card', noneIndex, 'search'), null] });
    const top = deckOf(g, 0, ['kiroshi_optics', 'mox_inciters', 'mox_inciters']);
    const s = spawn(g, 0, 'sketchy_ripper', 'field');
    gig(g, 1, 6, 3);
    await g.attack(0, s.uid, { unit: null, gigs: 1 });
    expect(hand(g, 0)).toBe(0);
    expect(new Set(g.P(0).deck.slice(-3))).toEqual(new Set(top.map((c) => c.uid)));
  });
});

describe('T-Bug: Amateur Philosopher', () => {
  it('faq:2110a5e9 faq:2a1bca2f its {Defeated} looks at every friendly face-down Legend, without revealing them', async () => {
    const { g, lines, mark } = scene({
      hooks: [onKind('unit', noneIndex, 'call'), null],
    });
    const t = spawn(g, 0, 't_bug_amateur_philosopher', 'field');
    const fd = g.faceDownLegends(0);
    expect(fd).toHaveLength(3);
    mark();
    await g.defeat(t.uid);
    await g.resolvePending();
    expect(fd.every((c) => c.known && !c.faceUp)).toBe(true);
    expect(lines().some((x) => fd.some((c) => x.includes(g.name(c))))).toBe(false);
  });
});

describe('The Heist', () => {
  it('faq:8151aa53 with a Gear among the trashed cards, one must be added to your hand', async () => {
    const { g, asked } = scene();
    const [k] = deckOf(g, 0, ['kiroshi_optics', 'mox_inciters', 'mox_inciters', 'mox_inciters']);
    await playCard(g, 0, 'the_heist');
    expect(optional(asked(0, (d) => d.tag === 'search'))).toHaveLength(0);
    expect(k.zone).toBe('hand');
  });

  it('faq:4f2133a0 a Gear whose cost matches a friendly Gig may still go to your hand instead of being played', async () => {
    const { g, asked } = scene({ hooks: [answerYes(false, 'playFree'), null] });
    gig(g, 0, 4, 1); // Kiroshi costs 1
    spawn(g, 0, 'psycho_squad', 'field');
    const [k] = deckOf(g, 0, ['kiroshi_optics', 'mox_inciters', 'mox_inciters', 'mox_inciters']);
    await playCard(g, 0, 'the_heist');
    expect(asked(0, (d) => d.tag === 'playFree')).toHaveLength(1);
    expect(k.zone).toBe('hand');
  });
});

describe('Trauma Team Operatives', () => {
  it('faq:b7e62adb its discount lowers the €$ paid, not its cost value (a cost-2-or-less effect still cannot hit it)', async () => {
    const { g } = scene();
    for (let i = 0; i < 5; i++) spawn(g, 0, 'psycho_squad', 'trash');
    const tto = spawn(g, 0, 'trauma_team_operatives', 'hand');
    expect(g.playCost(tto.uid, 0)).toBe(1);
    eddies(g, 0, 1);
    await g.playFromHand(0, tto.uid);
    expect(tto.zone).toBe('field');
    expect(g.def(tto).cost).toBe(6);
    await playCard(g, 1, 'caliber_totentanz_s_top_dog');
    expect(tto.zone).toBe('field');
  });
});

describe('Viktor Vektor: Drop Your Illusions', () => {
  it("faq:80577b2c faq:449ecd14 the -3 €$ applies on the rival's turn too, and is not optional", async () => {
    const { g, asked } = scene();
    spawn(g, 0, 'viktor_vektor_drop_your_illusions', 'field');
    spawn(g, 0, 'psycho_squad', 'field');
    const ga = spawn(g, 0, 'gorilla_arms', 'hand'); // Cyberware, cost 4
    g.s.active = 1;
    expect(g.playCost(ga.uid, 0)).toBe(1);
    g.s.active = 0;
    eddies(g, 0, 4);
    await g.playFromHand(0, ga.uid);
    await g.resolvePending();
    expect(ga.host).not.toBeNull();
    expect(g.P(0).eddies.filter((u) => !g.c(u).spent)).toHaveLength(3);
    expect(asked(0, (d) => d.kind === 'yesno' || d.kind === 'pay')).toHaveLength(0);
  });

  it("faq:9047f2f5 the reduction does not change the Gear's cost value (Heywood still matches its printed cost)", async () => {
    const { g } = scene();
    spawn(g, 0, 'viktor_vektor_drop_your_illusions', 'field');
    spawn(g, 0, 'psycho_squad', 'field');
    gig(g, 0, 6, 4);
    const ga = await playCard(g, 0, 'gorilla_arms'); // paid 1 €$
    expect(g.def(ga).cost).toBe(4);
    await playCard(g, 0, 'heywood_ripperdoc'); // defeats the first Gear offered: Gorilla Arms, cost 4 = the d6
    expect(ga.zone).toBe('trash');
    expect(hand(g, 0)).toBe(1);
  });
});

describe('Viktor Vektor: Sit Down and Relax', () => {
  it('faq:03d7a874 its {Call} may reveal nothing even with valid Gears; all 5 go to the bottom', async () => {
    const { g } = scene({ hooks: [onKind('card', noneIndex, 'search'), null] });
    const top = deckOf(g, 0, ['kiroshi_optics', 'mantis_blades', 'mox_inciters', 'mox_inciters', 'mox_inciters']);
    const vv = spawn(g, 0, 'viktor_vektor_sit_down_and_relax', 'legends', {
      faceUp: false,
    });
    await g.callLegend(0, vv.uid, { free: true });
    await g.resolvePending();
    expect(hand(g, 0)).toBe(0);
    expect(new Set(g.P(0).deck.slice(-5))).toEqual(new Set(top.map((c) => c.uid)));
  });
});

describe('Viktor Vektor: You Might Feel a Little Pinch', () => {
  it('faq:602f90aa its {Play} must play a Cyberware Gear (cost 2 or less) from the trash when there is one', async () => {
    const { g, asked } = scene();
    const other = spawn(g, 0, 'psycho_squad', 'field');
    const k = spawn(g, 0, 'kiroshi_optics', 'trash');
    await playCard(g, 0, 'viktor_vektor_you_might_feel_a_little_pinch');
    const ds = asked(0, (d) => d.tag === 'playFree');
    expect(ds).toHaveLength(1);
    expect(optional(ds)).toHaveLength(0);
    expect(k.host).toBe(other.uid);
  });
});

describe('Zetatech Faceplate', () => {
  it('faq:a4b85193 spent to declare an attack, its effect resolves before the React step', async () => {
    const seq: string[] = [];
    const rec =
      (p: PlayerId): Hook =>
      (d) =>
        void seq.push(`${p}:${d.kind}`);
    const { g } = scene({ hooks: [rec(0), rec(1)] });
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'zetatech_faceplate', u);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 4);
    spawn(g, 1, 'floor_it', 'hand'); // gives player 1 a reaction to consider
    eddies(g, 1, 1);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    expect(seq.indexOf('0:gigValue')).toBeGreaterThanOrEqual(0);
    expect(seq.indexOf('0:gigValue')).toBeLessThan(seq.indexOf('1:reaction'));
  });

  it('faq:9f87591e spent to attack with a Unit that has {Attack}: the player chooses which resolves first', async () => {
    const s = scene({ order: [0] });
    const { g, agents } = s;
    const u = spawn(g, 0, 'dexter_deshawn_one_last_chance', 'field');
    equip(g, 0, 'zetatech_faceplate', u);
    gig(g, 0, 6, 3);
    gig(g, 1, 8, 4);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    const offers = orderOffers(agents[0]);
    expect(offers.length).toBeGreaterThan(0);
    expect(offers[0].some((l) => l.includes('{Attack}'))).toBe(true);
    expect(offers[0].some((l) => l.includes('Zetatech Faceplate'))).toBe(true);
  });

  it('faq:9b281489 spent to activate a {Spend} ability: the ability resolves before the Faceplate', async () => {
    const s = scene({ order: [0] });
    const { g, lines, mark, agents } = s;
    const kerry = spawn(g, 0, 'kerry_eurodyne_the_last_rockerboy', 'field');
    equip(g, 0, 'zetatech_faceplate', kerry);
    gig(g, 0, 8, 8);
    mark();
    await activate(g, 0, kerry);
    const out = lines();
    const drew = out.findIndex((t) => t.startsWith('draws 2'));
    const adjusted = out.findIndex((t) => /creases friendly d8/.test(t));
    expect(drew).toBeGreaterThanOrEqual(0);
    expect(adjusted).toBeGreaterThan(drew);
    expect(orderOffers(agents[0])).toHaveLength(0);
  });

  it('faq:62c60c04 a face-up Legend wearing it spent to pay for a Program: the Program finishes first', async () => {
    const s = scene({ order: [0] });
    const { g, lines, mark } = s;
    const legend = spawn(g, 0, 'wakako_okada_peace_and_harmony', 'legends');
    equip(g, 0, 'zetatech_faceplate', legend);
    gig(g, 0, 6, 3);
    const fi = spawn(g, 0, 'floor_it', 'hand'); // 1 €$: draw 1
    expect(g.available(0)).toBe(1);
    mark();
    await g.playFromHand(0, fi.uid);
    await g.resolvePending();
    expect(legend.spent).toBe(true);
    const out = lines();
    const drew = out.findIndex((t) => t.startsWith('draws 1'));
    const adjusted = out.findIndex((t) => /creases friendly d6/.test(t));
    expect(drew).toBeGreaterThanOrEqual(0);
    expect(adjusted).toBeGreaterThan(drew);
  });
});
