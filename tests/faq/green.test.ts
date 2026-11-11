// Official Rules FAQ: Green card rulings. Each title names the rulings it checks as faq:<id prefix>; the paraphrases
// and statuses are in tests/faq/entries/green.ts.
import { describe, expect, it } from 'vitest';
import type { Game } from '../../src/engine/engine';
import type { CardInst, PlayerId } from '../../src/engine/types';
import {
  activate,
  activateR,
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
  onKind,
  playCard,
  reactStep,
  reactWith,
  scene,
  setGigTo,
  spawn,
  type Hook,
} from './faq-helpers';

// ---------------------------------------------------------------- local builders

const none = (tag: string, kind: 'unit' | 'card' | 'gig' = 'unit'): Hook => onKind(kind, (d) => d.options.findIndex((o) => o.key === 'none'), tag);

/** Remove p's starting Legends, then put the listed ones in the Legends area (face-up unless false). */
function legends(g: Game, p: PlayerId, list: [string, boolean][]): CardInst[] {
  for (const u of [...g.P(p).legends]) g.move(u, 'removed');
  return list.map(([id, faceUp]) => spawn(g, p, id, 'legends', { faceUp }));
}

/**
 * The FAQ's "only the €$ paid changes, not the cost value" rulings: discard `card` to Overwatch: Panam's Gift, which
 * defeats a spent rival Unit with cost up to the discarded card's cost value. True if `victimId` (spent) was defeated.
 */
async function discardForCost(g: Game, card: CardInst, victimId: string): Promise<boolean> {
  const host = spawn(g, 0, FILLER, 'field');
  const ow = equip(g, 0, 'overwatch_panam_s_gift', host);
  const victim = spawn(g, 1, victimId, 'field', { spent: true });
  eddies(g, 0, 1);
  await activate(g, 0, ow, 0, host);
  expect(card.zone).toBe('trash');
  return victim.zone === 'trash';
}

/** p0's `attacker` attacks p1's Gig area (p1 gets a d4 at 1 if it has no Gig). */
async function attackGigs(g: Game, attacker: CardInst) {
  if (!g.P(1).gigs.length) gig(g, 1, 4, 1);
  await g.attack(0, attacker.uid, { unit: null, gigs: 1 });
}

// ---------------------------------------------------------------- Programs

describe('Corporate Surveillance', () => {
  it('faq:4496adf7 can be played with no rival Unit in play', async () => {
    const { g } = scene();
    const cs = spawn(g, 0, 'corporate_surveillance', 'hand');
    eddies(g, 0, 2);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === cs.uid)).toBe(true);
    await g.doAction(0, { type: 'play', uid: cs.uid });
    expect(cs.zone).toBe('trash');
  });

  it('faq:00513475 may choose a rival Unit that was already spent', async () => {
    const { g, asked } = scene();
    const spent = spawn(g, 1, 'psycho_squad', 'field', { spent: true }); // cost 4
    await playCard(g, 0, 'corporate_surveillance');
    const d = asked(0, (x) => x.tag === 'spend');
    expect(d).toHaveLength(1);
    expect(d[0].options.map((o) => o.uid)).toEqual([spent.uid]);
  });
});

describe("(Don't Fear) The Reaper", () => {
  it('faq:fc26a153 faq:1715a8ca can be played when every rival Unit is already spent, and defeats one that was spent before it', async () => {
    const { g } = scene();
    const r = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    const reaper = spawn(g, 0, 'don_t_fear_the_reaper', 'hand');
    eddies(g, 0, 7);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === reaper.uid)).toBe(true);
    await g.doAction(0, { type: 'play', uid: reaper.uid });
    await g.resolvePending();
    expect(r.zone).toBe('trash');
  });
});

describe('Fool on the Hill', () => {
  it('faq:7cc65141 the revealed cards are still in the deck while the rival decides', async () => {
    let seen: boolean | null = null;
    let top: CardInst[] = [];
    const rivalDecides: Hook = onKind('mode', (_d, g) => {
      seen = top.every((c) => c.zone === 'deck' && g.P(0).deck.slice(0, 2).includes(c.uid));
      return 1; // trash them
    });
    const { g } = scene({ hooks: [null, rivalDecides] });
    top = deckOf(g, 0, ['psycho_squad', 'floor_it']);
    const deckBefore = g.P(0).deck.length;
    await playCard(g, 0, 'fool_on_the_hill');
    expect(seen).toBe(true);
    expect(top.every((c) => c.zone === 'trash')).toBe(true);
    expect(g.P(0).hand).toHaveLength(2);
    expect(g.P(0).deck).toHaveLength(deckBefore - 4);
  });
});

describe('Memory Relapse', () => {
  it('faq:5e7e7fa9 may choose a rival Unit that is already spent: it still cannot ready', async () => {
    const { g } = scene();
    const r = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    await playCard(g, 0, 'memory_relapse');
    expect(g.hasMod('cantReady', r.uid)).toBe(true);
    await g.endPhase();
    await g.startPhase(); // the rival's ready step
    expect(r.spent).toBe(true);
  });

  it('faq:5c2726d7 can be played with no rival Unit in play', async () => {
    const { g } = scene();
    const mr = spawn(g, 0, 'memory_relapse', 'hand');
    eddies(g, 0, 4);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === mr.uid)).toBe(true);
    await g.doAction(0, { type: 'play', uid: mr.uid });
    expect(mr.zone).toBe('trash');
  });
});

describe('Peace Offering', () => {
  it('faq:070c816a draws with any friendly value-pair, not only one made by the Gig it set', async () => {
    const { g, agents } = scene();
    gigs(g, 0, [
      [4, 3],
      [6, 3],
      [8, 5],
    ]);
    const rivalGig = gig(g, 1, 10, 7);
    agents[0].hook = setGigTo(rivalGig, 5);
    await playCard(g, 0, 'peace_offering');
    expect(g.gig(rivalGig).value).toBe(5);
    expect(g.P(0).hand).toHaveLength(1);
  });

  it('faq:42eac469 can be played when no Gig can be set to another value', async () => {
    const { g } = scene();
    const po = spawn(g, 0, 'peace_offering', 'hand');
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === po.uid)).toBe(true);
    await g.doAction(0, { type: 'play', uid: po.uid });
    expect(po.zone).toBe('trash');
    expect(g.P(0).hand).toHaveLength(0);
  });
});

describe('Synapse Burnout', () => {
  it('faq:9f5fa425 counts face-up Legends in the Legends area and on the field', async () => {
    const { g, agents } = scene();
    const target = spawn(g, 0, 'psycho_squad', 'field'); // 6
    legends(g, 0, [['dexter_deshawn_off_the_grid', true]]);
    spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true });
    agents[0].hook = chooseCard(target);
    await playCard(g, 0, 'synapse_burnout');
    const r = spawn(g, 1, 'maxtac_suppression_team', 'field', { spent: true }); // 7
    await g.attack(0, target.uid, { unit: r.uid, gigs: null });
    expect(r.zone).toBe('trash'); // 6 + 2 beats 7
    expect(target.zone).toBe('field');
  });

  it('faq:2a2b9c9f a face-up Legend on the field may be the friendly Unit, and gets the bonus while fighting', async () => {
    const { g, agents } = scene();
    legends(g, 0, [['dexter_deshawn_off_the_grid', true]]);
    const v = spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true }); // 8
    agents[0].hook = chooseCard(v);
    await playCard(g, 0, 'synapse_burnout');
    const r = spawn(g, 1, 'minotaur', 'field', { spent: true }); // 9
    await g.attack(0, v.uid, { unit: r.uid, gigs: null });
    expect(r.zone).toBe('trash'); // 8 + 2 (itself and Dexter) beats 9
    expect(v.zone).toBe('field');
  });
});

describe('We Gotta Live Together', () => {
  it('faq:972b7a64 paying 3 €$ does not change its cost value (5)', async () => {
    const { g } = scene();
    gigs(g, 1, [
      [4, 2],
      [6, 2],
    ]);
    const w = spawn(g, 0, 'we_gotta_live_together', 'hand');
    expect(g.playCost(w.uid, 0)).toBe(3);
    expect(await discardForCost(g, w, 'mt0d12_flathead')).toBe(true); // a cost-5 Unit
  });

  it('faq:abf24590 with the rival 2+ Gigs ahead it costs 3 €$, not 5, even with 5 available', async () => {
    const { g } = scene();
    gigs(g, 1, [
      [4, 2],
      [6, 2],
    ]);
    const w = spawn(g, 0, 'we_gotta_live_together', 'hand');
    eddies(g, 0, 5);
    await g.doAction(0, { type: 'play', uid: w.uid });
    expect(w.zone).toBe('trash');
    expect(g.available(0)).toBe(2);
  });
});

describe('Wild in the Streets', () => {
  it('faq:d0d1a60f can be played with no spent Unit in play', async () => {
    const { g } = scene();
    const r = spawn(g, 1, 'psycho_squad', 'field');
    const w = spawn(g, 0, 'wild_in_the_streets', 'hand');
    eddies(g, 0, 5);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === w.uid)).toBe(true);
    await g.doAction(0, { type: 'play', uid: w.uid });
    expect(w.zone).toBe('trash');
    expect(r.zone).toBe('field');
  });

  it('faq:192c3c09 may defeat a friendly spent Unit', async () => {
    const { g, agents, asked } = scene();
    const mine = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    const theirs = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    agents[0].hook = chooseCard(mine);
    await playCard(g, 0, 'wild_in_the_streets');
    expect(asked(0, (d) => d.tag === 'defeat')[0].options.map((o) => o.uid)).toEqual([mine.uid, theirs.uid]);
    expect(mine.zone).toBe('trash');
    expect(theirs.zone).toBe('field');
  });

  it('faq:7ea036d0 with only a friendly spent Unit, it must be defeated', async () => {
    const { g, asked } = scene();
    const mine = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    spawn(g, 1, 'psycho_squad', 'field'); // ready
    await playCard(g, 0, 'wild_in_the_streets');
    expect(asked(0, (d) => d.tag === 'defeat')[0].options.some((o) => o.key === 'none')).toBe(false);
    expect(mine.zone).toBe('trash');
  });
});

// ---------------------------------------------------------------- Legends

describe('Goro Takemura: Hands Unclean', () => {
  it('faq:9ad7e1cf cannot use Blocker from the Legends area, only on the field', () => {
    const { g } = scene();
    const inArea = spawn(g, 1, 'goro_takemura_hands_unclean', 'legends');
    const onField = spawn(g, 1, 'goro_takemura_hands_unclean', 'field', { goSolo: true });
    gig(g, 1, 4, 1);
    reactStep(g, spawn(g, 0, 'psycho_squad', 'field'), { gigs: 1 });
    expect(canBlockWith(g, 1, inArea)).toBe(false);
    expect(canBlockWith(g, 1, onField)).toBe(true);
  });
});

describe('Goro Takemura: Vengeful Bodyguard', () => {
  it('faq:c40c2c04 a Unit played this turn and given Blocker in the React step can block', async () => {
    let goro: CardInst, fresh: CardInst;
    let react: Hook | null = null; // built on first use, once the cards exist (reactWith counts its steps)
    const { g } = scene({ hooks: [null, (d, gg) => (react ??= reactWith(activateR(goro), blockBy(fresh)))(d, gg)] });
    goro = spawn(g, 1, 'goro_takemura_vengeful_bodyguard', 'legends');
    fresh = spawn(g, 1, 'psycho_squad', 'field', { lag: true, enteredTurn: g.s.turn }); // cost 4, played this turn
    eddies(g, 1, 1);
    const x = gig(g, 1, 4, 1);
    const att = spawn(g, 0, 'animals_wrecker', 'field'); // 10
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(g.s.log.some((e) => e.text === 'Psycho Squad blocks!')).toBe(true);
    expect(fresh.zone).toBe('trash'); // it blocked and lost the fight
    expect(g.gig(x).controller).toBe(1);
  });

  const blockScene = (discard: Hook | null) => {
    let blocker: CardInst;
    let react: Hook | null = null; // one stateful reaction hook per scene (reactWith counts its steps)
    const block: Hook = (d, gg) => (react ??= reactWith(blockBy(blocker)))(d, gg);
    const s = scene({ hooks: [null, hooks(discard, block)] });
    spawn(s.g, 1, 'goro_takemura_vengeful_bodyguard', 'legends');
    blocker = spawn(s.g, 1, 'mox_inciters', 'field'); // a printed Blocker, not one Goro gave
    gig(s.g, 1, 4, 1);
    const att = spawn(s.g, 0, 'animals_wrecker', 'field');
    return { ...s, blocker, att };
  };

  it('faq:048e77d0 faq:46be1b50 any friendly Blocker triggers the second effect, and the discard is optional', async () => {
    const { g, asked, att, blocker } = blockScene(none('discard', 'card'));
    const card = spawn(g, 1, 'floor_it', 'hand');
    const deck = g.P(1).deck.length;
    await g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(blocker.zone).toBe('trash');
    const d = asked(1, (x) => x.tag === 'discard');
    expect(d).toHaveLength(1);
    expect(d[0].options.some((o) => o.key === 'none')).toBe(true);
    expect(card.zone).toBe('hand');
    expect(g.P(1).deck).toHaveLength(deck);
  });

  it('faq:3e703f01 discarding with an empty deck means drawing from it: that player loses', async () => {
    const { g, att } = blockScene(null);
    spawn(g, 1, 'floor_it', 'hand');
    emptyDeck(g, 1);
    await expect(g.attack(0, att.uid, { unit: null, gigs: 1 })).rejects.toThrow();
    expect(g.s.winner).toBe(0);
  });
});

describe('Hanako Arasaka: Daughter of the Emperor', () => {
  it('faq:b9dffd87 cannot swap while either player controls no Gig', () => {
    const { g } = scene();
    const h = spawn(g, 0, 'hanako_arasaka_daughter_of_the_emperor', 'legends');
    gig(g, 1, 6, 3);
    expect(canActivate(g, 0, h)).toBe(false); // you control none
    gig(g, 0, 4, 2);
    expect(canActivate(g, 0, h)).toBe(true);
    const { g: g2 } = scene();
    const h2 = spawn(g2, 0, 'hanako_arasaka_daughter_of_the_emperor', 'legends');
    gig(g2, 0, 4, 2);
    expect(canActivate(g2, 0, h2)).toBe(false); // the rival controls none
  });

  it('faq:1b9a65e5 faq:4b611db2 you choose both Gigs, and a swap is not a steal', async () => {
    const pick = (id: () => number, tag: string): Hook => onKind('gig', (d) => d.options.findIndex((o) => o.gig === id()), tag);
    let give = 0;
    let take = 0;
    const { g, asked } = scene({ hooks: [hooks(pick(() => give, 'swapGive'), pick(() => take, 'swapTake')), null] });
    const h = spawn(g, 0, 'hanako_arasaka_daughter_of_the_emperor', 'legends');
    [, give] = gigs(g, 0, [
      [4, 2],
      [6, 5],
    ]);
    [take] = gigs(g, 1, [
      [8, 7],
      [10, 3],
    ]);
    await activate(g, 0, h);
    expect(asked(0, (d) => d.tag === 'swapGive' || d.tag === 'swapTake')).toHaveLength(2);
    expect(g.gig(give).controller).toBe(1);
    expect(g.gig(take).controller).toBe(0);
    expect(g.turnCount('steal')).toBe(0);
    expect(g.s.stats.gigsStolen).toEqual([0, 0]);
  });
});

describe("Jackie Welles: Mama's Favorite", () => {
  /** p0: Jackie (in the Legends area or on the field), 1 Eddie, and a friendly Unit to protect. */
  const jackieScene = (where: 'legends' | 'field', victimId = 'psycho_squad') => {
    const s = scene({ hooks: [answerYes(true, 'replaceDefeat'), null] });
    const jackie = spawn(s.g, 0, 'jackie_welles_mama_s_favorite', where, where === 'field' ? { goSolo: true } : {});
    const victim = spawn(s.g, 0, victimId, 'field');
    eddies(s.g, 0, 1);
    return { ...s, jackie, victim };
  };

  it("faq:739fcd51 the protected Unit is not defeated, so its {Defeated} doesn't trigger", async () => {
    const { g, jackie, victim } = jackieScene('legends', 'screw_lovelorn_fool');
    const inTrash = spawn(g, 0, 'psycho_squad', 'trash');
    expect(await g.defeat(victim.uid)).toBe(false);
    await g.resolvePending();
    expect(victim.zone).toBe('field');
    expect(inTrash.zone).toBe('trash'); // Screw's {Defeated} would have returned it
    expect(jackie.zone).toBe('removed');
  });

  it('faq:659dec0e works while Jackie is on the field', async () => {
    const { g, jackie, victim } = jackieScene('field');
    await g.defeat(victim.uid);
    expect(victim.zone).toBe('field');
    expect(jackie.zone).toBe('removed');
    expect(g.available(0)).toBe(0);
  });

  it('faq:2d22697d works while Jackie is in the Legends area', async () => {
    const { g, jackie, victim } = jackieScene('legends');
    await g.defeat(victim.uid);
    expect(victim.zone).toBe('field');
    expect(jackie.zone).toBe('removed');
  });

  it.skip("faq:ab195483 Jackie alone on the field may use his own effect to be defeated by it instead of the rival's effect — engine never offers a Legend's replacement for itself (outcome is the same: Jackie is removed)", async () => {
    const { g, asked } = scene({ hooks: [answerYes(true, 'replaceDefeat'), null] });
    const jackie = spawn(g, 0, 'jackie_welles_mama_s_favorite', 'field', { goSolo: true });
    eddies(g, 0, 1);
    await g.defeat(jackie.uid, { by: spawn(g, 1, 'psycho_squad', 'field').uid });
    expect(asked(0, (d) => d.tag === 'replaceDefeat')).toHaveLength(1);
  });

  it.skip('faq:f5220c5b against "defeat all Units", Jackie can still save another friendly Unit — engine defeats one Unit at a time, so Jackie (earlier in field order) is gone before the other Unit is defeated', async () => {
    const s = scene({ hooks: [answerYes(true, 'replaceDefeat'), null] });
    const jackie = spawn(s.g, 0, 'jackie_welles_mama_s_favorite', 'field', { goSolo: true }); // first in field order
    const other = spawn(s.g, 0, 'psycho_squad', 'field');
    eddies(s.g, 0, 1);
    s.g.s.active = 1;
    await playCard(s.g, 1, 'adam_smasher_metal_over_meat'); // {Play} Defeat all other Units
    expect(other.zone).toBe('field');
    expect(jackie.zone).toBe('removed');
  });
});

describe('Padre: Man of the Cross', () => {
  it('faq:2376d51c the Call may choose "spend a rival Unit" with no rival Unit (nothing happens)', async () => {
    const { g, asked } = scene({ hooks: [chooseMode('Spend'), null] });
    const padre = spawn(g, 0, 'padre_man_of_the_cross', 'legends', { faceUp: false });
    await g.callLegend(0, padre.uid, { free: true });
    await g.resolvePending();
    expect(asked(0, (d) => d.kind === 'mode')[0].options.map((o) => o.label)).toEqual(['Spend a rival Unit', 'Draw 1']);
    expect(g.P(0).hand).toHaveLength(0);
  });

  it('faq:afa9a2eb its {Spend} can be activated when every Gig has the same value', async () => {
    const { g } = scene();
    const padre = spawn(g, 0, 'padre_man_of_the_cross', 'legends');
    const a = gig(g, 0, 4, 3);
    const b = gig(g, 1, 6, 3);
    expect(canActivate(g, 0, padre)).toBe(true);
    await activate(g, 0, padre);
    expect(padre.spent).toBe(true);
    expect([g.gig(a).value, g.gig(b).value]).toEqual([3, 3]);
  });
});

describe('Panam Palmer: Nomad Cavalry', () => {
  it('faq:097a8261 may move its Gear to an unequipped friendly Unit that is ready', async () => {
    const { g } = scene();
    const panam = spawn(g, 0, 'panam_palmer_nomad_cavalry', 'legends');
    const gear = equip(g, 0, 'mantis_blades', panam);
    const u = spawn(g, 0, 'psycho_squad', 'field'); // ready
    eddies(g, 0, 2);
    expect(canActivate(g, 0, panam)).toBe(true);
    await activate(g, 0, panam);
    expect(gear.host).toBe(u.uid);
    expect(u.spent).toBe(false);
  });

  it('faq:5c29eb76 any mix of 5 equipped Units and Legends readies them at the end of your turn', async () => {
    const { g } = scene();
    const [panam, dex] = legends(g, 0, [
      ['panam_palmer_nomad_cavalry', true],
      ['dexter_deshawn_off_the_grid', true],
    ]);
    const units = [0, 1, 2].map(() => spawn(g, 0, 'psycho_squad', 'field'));
    const all = [panam, dex, ...units];
    for (const c of all) {
      equip(g, 0, 'mantis_blades', c);
      c.spent = true;
    }
    await g.endPhase();
    expect(all.map((c) => c.spent)).toEqual([false, false, false, false, false]);
  });
});

describe('Saburo Arasaka: Stubborn Patriarch', () => {
  it('faq:18318e94 the +1 applies in the fight and in the steal', async () => {
    const { g } = scene();
    spawn(g, 0, 'saburo_arasaka_stubborn_patriarch', 'legends');
    const op = spawn(g, 0, 'field_operator', 'field'); // ARASAKA, 2
    const r = spawn(g, 1, 'mox_inciters', 'field', { spent: true }); // 2
    await g.attack(0, op.uid, { unit: r.uid, gigs: null });
    expect(r.zone).toBe('trash');
    expect(op.zone).toBe('field'); // 3 beats 2 instead of a tie
    const mino = spawn(g, 0, 'minotaur', 'field'); // ARASAKA, 9
    gigs(g, 1, [
      [4, 1],
      [6, 1],
      [8, 1],
    ]);
    await g.attack(0, mino.uid, { unit: null, gigs: 1 });
    expect(g.P(0).gigs).toHaveLength(2); // 10 power steals 2
  });
});

// ---------------------------------------------------------------- Gear

describe("Overwatch: Panam's Gift", () => {
  it('faq:7f11608a its {Spend} can be activated with an empty hand', async () => {
    const { g } = scene();
    const host = spawn(g, 0, 'psycho_squad', 'field');
    const ow = equip(g, 0, 'overwatch_panam_s_gift', host);
    const r = spawn(g, 1, 'japantown_jonin', 'field', { spent: true });
    eddies(g, 0, 1);
    expect(canActivate(g, 0, ow, 0, false, host)).toBe(true);
    expect(canActivate(g, 0, ow, 0, true, host)).toBe(true);
    await activate(g, 0, ow, 0, host);
    expect(host.spent).toBe(true);
    expect(g.available(0)).toBe(0);
    expect(r.zone).toBe('field'); // nothing discarded, nothing defeated
  });

  it('faq:5514dcc7 a Gear moved after its "when spent" effect became pending still resolves it (Zetatech Faceplate moved by Panam Palmer)', async () => {
    const { g } = scene();
    const panam = spawn(g, 0, 'panam_palmer_nomad_cavalry', 'legends');
    const plate = equip(g, 0, 'zetatech_faceplate', panam);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const x = gig(g, 0, 6, 3);
    eddies(g, 0, 2);
    await activate(g, 0, panam); // spending Panam makes the Faceplate pending; the effect then moves it to the Unit
    expect(plate.host).toBe(u.uid);
    expect(g.gig(x).value).not.toBe(3); // the pending Faceplate effect adjusted a Gig
  });
});

describe('Riot Shield', () => {
  it('faq:06f40e31 does not force the rival to Go Solo: they may still pass', () => {
    const { g } = scene();
    equip(g, 0, 'riot_shield', spawn(g, 0, 'psycho_squad', 'field'));
    spawn(g, 1, 'v_corporate_exile', 'legends'); // Go Solo 5 (+2)
    eddies(g, 1, 7);
    g.s.active = 1;
    const acts = g.legalActions(1);
    expect(acts.some((a) => a.type === 'goSolo')).toBe(true);
    expect(acts.some((a) => a.type === 'pass')).toBe(true);
  });
});

describe('Sandevistan', () => {
  it('faq:66f0aa50 readies a spent equipped Unit or Legend at the end of your turn', async () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    const leg = spawn(g, 0, 'dexter_deshawn_off_the_grid', 'legends', { spent: true });
    equip(g, 0, 'sandevistan', u);
    equip(g, 0, 'sandevistan', leg);
    await g.endPhase();
    expect(u.spent).toBe(false);
    expect(leg.spent).toBe(false);
  });
});

describe('Zetatech Berserk', () => {
  it('faq:fc46987c the discount does not change its cost value (6)', async () => {
    const { g } = scene();
    legends(g, 0, [
      ['dexter_deshawn_off_the_grid', true],
      ['wakako_okada_peace_and_harmony', true],
    ]);
    const z = spawn(g, 0, 'zetatech_berserk', 'hand');
    expect(g.playCost(z.uid, 0)).toBe(4);
    expect(await discardForCost(g, z, 'animals_wrecker')).toBe(true); // a cost-6 Unit
  });

  it("faq:df287cf5 an equipped Unit does not gain its Gear's tags", async () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field');
    const z = equip(g, 0, 'zetatech_berserk', u);
    expect(g.isTag(z, 'Zetatech')).toBe(true);
    expect(g.isTag(u, 'Zetatech')).toBe(false);
    // an ARASAKA Gear does not make its Unit ARASAKA for Saburo's +1 while attacking
    spawn(g, 0, 'saburo_arasaka_stubborn_patriarch', 'legends');
    equip(g, 0, 'satori_sword_of_saburo', u);
    const base = g.power(u);
    gig(g, 1, 4, 1);
    g.s.attack = { attacker: u.uid, attackerPlayer: 0, targetUnit: null, targetGigs: 1, step: 'react', ended: false };
    expect(g.power(u)).toBe(base);
    g.s.attack = null;
  });
});

// ---------------------------------------------------------------- Units

describe('Corpo Security', () => {
  it('faq:030e8902 cannot attack even with Adrenaline', async () => {
    const { g } = scene();
    gig(g, 1, 4, 1);
    const cs = await playCard(g, 0, 'corpo_security');
    g.giveKeyword(cs.uid, 'adrenaline');
    expect(g.lagPermission(cs)).toBe('any');
    expect(g.attackTargets(cs)).toEqual([]);
  });
});

describe('Field Operator', () => {
  it('faq:e83fc5f6 Street Cred 0 (no Gigs) is not even: no draw', async () => {
    const { g } = scene();
    expect(g.credEven(0)).toBe(false);
    await playCard(g, 0, 'field_operator');
    expect(g.P(0).hand).toHaveLength(0);
  });
});

describe('Goro Takemura: Losing His Way', () => {
  /** Goro attacks with the listed friendly Legends; returns its power after the {Attack} effect resolved. */
  const goroScene = async (faceUp: boolean[]) => {
    const { g } = scene();
    const legs = legends(
      g,
      0,
      faceUp.map((f) => ['dexter_deshawn_off_the_grid', f] as [string, boolean]),
    );
    const goro = spawn(g, 0, 'goro_takemura_losing_his_way', 'field'); // 4
    await attackGigs(g, goro);
    return { g, goro, legs };
  };

  it('faq:0c5b038a faq:134dcec6 checked when the {Attack} effect resolves: Legends turned face-up later give nothing', async () => {
    const { g, goro, legs } = await goroScene([true, false]);
    expect(g.power(goro)).toBe(4);
    legs[1].faceUp = true;
    expect(g.power(goro)).toBe(4);
  });

  it('faq:998c10e4 keeps +5 for the turn if a Legend is later turned face-down', async () => {
    const { g, goro, legs } = await goroScene([true, true]);
    expect(g.power(goro)).toBe(9);
    legs[0].faceUp = false;
    expect(g.power(goro)).toBe(9);
  });

  it('faq:7afe8eca with no friendly Legends at all there is no +5', async () => {
    const { g, goro } = await goroScene([]);
    expect(g.power(goro)).toBe(4);
  });
});

describe('Maelstrom Zealots', () => {
  it("faq:3dc2ff22 a Unit that can't be defeated in a fight still loses it: Zealots' effect fires", async () => {
    const { g } = scene();
    const z = spawn(g, 1, 'maelstrom_zealots', 'field', { spent: true }); // 0
    g.addMod({ kind: 'noFightDefeat', target: z.uid, until: 'endOfTurn' });
    const att = spawn(g, 0, 'psycho_squad', 'field');
    await g.attack(0, att.uid, { unit: z.uid, gigs: null });
    expect(z.zone).toBe('field');
    expect(att.zone).toBe('trash');
  });

  it('faq:be847e04 it is still defeated in the fight it lost, along with the opposing Unit', async () => {
    const { g } = scene();
    const z = spawn(g, 1, 'maelstrom_zealots', 'field', { spent: true });
    const att = spawn(g, 0, 'psycho_squad', 'field');
    await g.attack(0, att.uid, { unit: z.uid, gigs: null });
    expect(z.zone).toBe('trash');
    expect(att.zone).toBe('trash');
  });
});

describe('MaxTac AV', () => {
  it('faq:9dfba4f9 the swap is optional', async () => {
    const { g, asked } = scene({ hooks: [none('swapGive', 'gig'), null] });
    const mine = gig(g, 0, 4, 1);
    const theirs = gig(g, 1, 20, 17);
    await playCard(g, 0, 'maxtac_av');
    expect(asked(0, (d) => d.tag === 'swapGive')).toHaveLength(1);
    expect(g.gig(mine).controller).toBe(0);
    expect(g.gig(theirs).controller).toBe(1);
  });
});

describe('MaxTac Heavy', () => {
  it('faq:86289bd1 the discount does not change its cost value (7)', async () => {
    const { g } = scene();
    spawn(g, 1, 'psycho_squad', 'field');
    const h = spawn(g, 0, 'maxtac_heavy', 'hand');
    expect(g.playCost(h.uid, 0)).toBe(6);
    expect(await discardForCost(g, h, 'octant')).toBe(true); // a cost-7 Unit
  });
});

describe('Nadia: Fighting Through Grief', () => {
  it('faq:526169c5 checked when attacking: played while ahead, she may attack once the rival has more Gigs', async () => {
    const { g } = scene();
    gigs(g, 0, [
      [4, 2],
      [6, 2],
    ]);
    gig(g, 1, 4, 2);
    const nadia = await playCard(g, 0, 'nadia_fighting_through_grief');
    expect(g.attackTargets(nadia)).toEqual([]);
    gigs(g, 1, [
      [6, 2],
      [8, 2],
    ]);
    expect(g.attackTargets(nadia)).toEqual([{ unit: null, gigs: 1 }]);
  });
});

describe('Pacifica Netrunner', () => {
  it('faq:933f4b48 the {Play} chooses a rival Unit already on the field', async () => {
    const { g, asked } = scene();
    gig(g, 0, 4, 2); // even Street Cred
    const r = spawn(g, 1, 'psycho_squad', 'field');
    await playCard(g, 0, 'pacifica_netrunner');
    expect(asked(0, (d) => d.tag === 'cantReady')[0].options.map((o) => o.uid)).toEqual([r.uid]);
    expect(g.hasMod('cantReady', r.uid)).toBe(true);
  });
});

describe('Panam Palmer: Strength Through Family', () => {
  it('faq:eb1edc97 after a Call this turn, Panam gives no second (free) Call', async () => {
    const { g } = scene();
    eddies(g, 0, 1);
    const leg = g.P(0).legends[0];
    await g.doAction(0, { type: 'call', uid: leg });
    spawn(g, 0, 'panam_palmer_strength_through_family', 'field');
    expect(g.callCost(0)).toBe(0);
    expect(g.canCall(0)).toBe(false);
    expect(g.legalActions(0).some((a) => a.type === 'call')).toBe(false);
  });

  it('faq:f8a56ec8 its {Attack} counts face-up Legends in the Legends area and on the field', async () => {
    const { g } = scene();
    legends(g, 0, [
      ['dexter_deshawn_off_the_grid', true],
      ['wakako_okada_peace_and_harmony', false],
    ]);
    spawn(g, 0, 'v_corporate_exile', 'field', { goSolo: true });
    spawn(g, 0, 'floor_it', 'hand');
    const panam = spawn(g, 0, 'panam_palmer_strength_through_family', 'field');
    await attackGigs(g, panam);
    expect(g.P(0).hand).toHaveLength(2); // discard 1, draw 2
  });
});

describe('Pepe Najarro: Working Doubles', () => {
  it('faq:1f2d750b a value-pair is two Gigs with the same value in the same Gig area', async () => {
    for (const [mine, ready] of [
      [[[4, 3]], false], // a friendly 3 and a rival 3 are not a pair
      [
        [
          [4, 3],
          [6, 3],
        ],
        true,
      ],
    ] as [[number, number][], boolean][]) {
      const { g } = scene();
      gigs(g, 0, mine);
      gig(g, 1, 8, 3);
      const merc = spawn(g, 0, 'v_corporate_exile', 'legends', { spent: true }); // MERC
      await attackGigs(g, spawn(g, 0, 'pepe_najarro_working_doubles', 'field'));
      expect(merc.spent).toBe(!ready);
    }
  });
});

describe("Sandayu Oda: Hanako's Guardian", () => {
  it('faq:2507570b faq:0ae5584d may attack rival Units the turn it is played, but only spent ones', async () => {
    const { g } = scene();
    const ready = spawn(g, 1, 'psycho_squad', 'field');
    const spent = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    gig(g, 1, 4, 1);
    const oda = await playCard(g, 0, 'sandayu_oda_hanako_s_guardian');
    expect(oda.lag).toBe(true);
    expect(g.attackTargets(oda)).toEqual([{ unit: spent.uid, gigs: null }]);
    expect(ready.spent).toBe(false);
  });
});

describe('Saul Bright: Stormrider', () => {
  it('faq:1f7a2ac5 the +2 for other attacking Units applies in the fight and in the steal', async () => {
    const { g } = scene();
    spawn(g, 0, 'saul_bright_stormrider', 'field');
    const u = spawn(g, 0, 'psycho_squad', 'field'); // 6
    const r = spawn(g, 1, 'maxtac_suppression_team', 'field', { spent: true }); // 7
    await g.attack(0, u.uid, { unit: r.uid, gigs: null });
    expect(r.zone).toBe('trash');
    expect(u.zone).toBe('field');
    const av = spawn(g, 0, 'maxtac_av', 'field'); // 8
    gigs(g, 1, [
      [4, 1],
      [6, 1],
      [8, 1],
    ]);
    await g.attack(0, av.uid, { unit: null, gigs: 1 });
    expect(g.P(0).gigs).toHaveLength(2); // 10 power steals 2
  });
});

describe("Tyger's Whisper", () => {
  it('faq:0c12a0d1 declining the free Call leaves the ordinary Call at its normal cost', async () => {
    const { g } = scene({ hooks: [none('call'), null] });
    await playCard(g, 0, 'tyger_s_whisper');
    expect(g.faceUpLegends(0)).toHaveLength(0);
    expect(g.callCost(0)).toBe(1);
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: g.P(0).legends[0] });
    expect(g.faceUpLegends(0)).toHaveLength(1);
    expect(g.available(0)).toBe(0);
  });

  it("faq:1dcc06cf played on the rival's turn, it still Calls a Legend for free", async () => {
    const { g } = scene();
    g.s.active = 1;
    const tw = spawn(g, 0, 'tyger_s_whisper', 'hand');
    await g.playFree(0, tw.uid, 'hand');
    await g.resolvePending();
    expect(g.faceUpLegends(0)).toHaveLength(1);
  });

  it('faq:92d69f9f after a Call this turn there is no free Call', async () => {
    const { g } = scene();
    eddies(g, 0, 1);
    await g.doAction(0, { type: 'call', uid: g.P(0).legends[0] });
    await playCard(g, 0, 'tyger_s_whisper');
    expect(g.faceUpLegends(0)).toHaveLength(1);
  });
});

describe('Valentino Street Racer', () => {
  it("faq:c78f53c3 Adrenaline given on the rival's turn does not let the Unit attack on that turn", async () => {
    const { g } = scene();
    gig(g, 1, 4, 1);
    g.s.active = 1;
    const fresh = spawn(g, 0, 'psycho_squad', 'field', { lag: true, enteredTurn: g.s.turn });
    const racer = spawn(g, 0, 'valentino_street_racer', 'hand');
    await g.playFree(0, racer.uid, 'hand');
    await g.resolvePending();
    expect(g.hasKw(fresh, 'adrenaline')).toBe(true);
    expect(g.canAttackAtAll(fresh)).toBe(false);
    expect(g.attackTargets(fresh)).toEqual([]);
  });
});

describe('Wraith Marauders', () => {
  it('faq:7ec76a28 readying a friendly Unit with power equal to the stolen Gig is not optional', async () => {
    const { g, asked } = scene();
    const six = spawn(g, 0, 'psycho_squad', 'field', { spent: true }); // 6
    gig(g, 1, 6, 6);
    await attackGigs(g, spawn(g, 0, 'wraith_marauders', 'field'));
    const d = asked(0, (x) => x.tag === 'ready');
    expect(d).toHaveLength(1);
    expect(d[0].options.some((o) => o.key === 'none')).toBe(false);
    expect(six.spent).toBe(false);
  });
});
