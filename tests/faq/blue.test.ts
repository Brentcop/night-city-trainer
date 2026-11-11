// Official Rules FAQ conformance: Blue cards. Each test names the rulings it covers (faq:<id prefix>); the matrix
// entries are in tests/faq/entries/blue.ts.
import { describe, expect, it, vi } from 'vitest';
import type { Game } from '../../src/engine/engine';
import type { CardInst, PlayerId } from '../../src/engine/types';
import { makeTierBot } from '../../src/ai/tiers';
import {
  activate,
  answerYes,
  canActivate,
  canBlockWith,
  chooseCard,
  chooseMode,
  deckOf,
  eddies,
  emptyDeck,
  equip,
  gig,
  gigs,
  hooks,
  orderOffers,
  passTurn,
  play,
  playCard,
  reactStep,
  resolveFirst,
  scene,
  setGigTo,
  spawn,
  type Hook,
} from './faq-helpers';

const hand = (g: Game, p: PlayerId) => g.P(p).hand.length;
const spentEddies = (g: Game, p: PlayerId, n: number) => {
  eddies(g, p, n);
  for (const u of g.P(p).eddies.slice(-n)) g.c(u).spent = true;
};
const readyEddies = (g: Game, p: PlayerId) => g.P(p).eddies.filter((u) => !g.c(u).spent).length;
const hasPass = (g: Game, p: PlayerId) => g.legalActions(p).some((a) => a.type === 'pass');
/** Decisions of a kind/tag player p was asked. */
const tagged = (s: ReturnType<typeof scene>, p: PlayerId, tag: string) => s.asked(p, (d) => d.tag === tag);

// ---------------------------------------------------------------- Legends

describe('Alt Cunningham: Soulkiller Architect', () => {
  function altScene() {
    const s = scene();
    const alt = spawn(s.g, 0, 'alt_cunningham_soulkiller_architect', 'legends');
    return { ...s, alt };
  }

  it('faq:f6e95797 a Program played from the trash with her second ability is the "next Program": it gets the reduction and uses it up', async () => {
    const { g, alt } = altScene();
    gigs(g, 0, [
      [4, 1],
      [6, 1],
    ]);
    await activate(g, 0, alt, 0);
    const tf = spawn(g, 0, 'towerfall', 'trash'); // cost 6
    expect(g.playCost(tf.uid, 0)).toBe(4);
    g.ready(alt.uid);
    eddies(g, 0, 5); // 1 for the ability + 4 for Towerfall
    await activate(g, 0, alt, 1);
    expect(tf.zone).toBe('deck'); // played, then bottom-decked
    expect(g.available(0)).toBe(0);
    expect(g.playerMods('altNextProgram', 0)).toHaveLength(0);
  });

  it('faq:c2b026c3 resolving the first ability twice before the next Program stacks both reductions, to a minimum of 1 €$', async () => {
    const { g, alt } = altScene();
    gigs(g, 0, [
      [4, 1],
      [6, 1],
    ]);
    await activate(g, 0, alt, 0);
    g.ready(alt.uid);
    expect(canActivate(g, 0, alt, 0)).toBe(true);
    await activate(g, 0, alt, 0);
    const tf = spawn(g, 0, 'towerfall', 'hand');
    expect(g.playCost(tf.uid, 0)).toBe(2); // 6 - 2 - 2
    gig(g, 0, 8, 1);
    gig(g, 0, 10, 1);
    const big = spawn(g, 0, 'towerfall', 'hand');
    expect(g.playCost(big.uid, 0)).toBe(2); // the amounts were fixed when each resolved
    spawn(g, 0, 'psycho_squad', 'trash');
    eddies(g, 0, 2);
    await play(g, 0, tf);
    expect(g.available(0)).toBe(0);
    expect(g.playCost(big.uid, 0)).toBe(6); // used up by the Program just played
  });

  it('faq:dd4138dc the reduction is fixed when the ability resolves: min Gigs gained later do not add to it', async () => {
    const { g, alt } = altScene();
    gigs(g, 0, [
      [4, 1],
      [6, 1],
    ]);
    await activate(g, 0, alt, 0);
    gig(g, 0, 8, 1); // a third min Gig before the Program is played
    const tf = spawn(g, 0, 'towerfall', 'hand');
    expect(g.playCost(tf.uid, 0)).toBe(4); // -2, not -3
  });
});

describe('Evelyn Parker: Beautiful Enigma', () => {
  /** Player 0 uses Evelyn on a rival Unit, then it is player 1's turn. */
  async function forced() {
    const s = scene();
    const { g } = s;
    const ev = spawn(g, 0, 'evelyn_parker_beautiful_enigma', 'legends');
    const r = spawn(g, 1, 'psycho_squad', 'field');
    gigs(g, 0, [
      [6, 3],
      [8, 4],
      [10, 5],
    ]);
    eddies(g, 0, 1);
    await activate(g, 0, ev, 0);
    expect(g.hasMod('mustAttack', r.uid)).toBe(true);
    await passTurn(g);
    return { ...s, r };
  }

  it('faq:6f60b8fc a forced Unit that attacked and is readied again this turn must attack again if it can', async () => {
    const { g, r } = await forced();
    expect(hasPass(g, 1)).toBe(false);
    await g.attack(1, r.uid, { unit: null, gigs: 0 });
    expect(hasPass(g, 1)).toBe(true); // spent: it can't attack
    g.ready(r.uid);
    expect(g.attackTargets(r).length).toBeGreaterThan(0);
    expect(hasPass(g, 1)).toBe(false);
  });

  it('faq:99f345a2 the forced Unit need not attack first: other actions are allowed, only ending the turn is not', async () => {
    const { g, r } = await forced();
    const c = spawn(g, 1, 'psycho_squad', 'hand');
    eddies(g, 1, 4);
    const acts = g.legalActions(1);
    expect(acts.some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    expect(acts.some((a) => a.type === 'pass')).toBe(false);
    await g.doAction(1, { type: 'play', uid: c.uid });
    await g.resolvePending();
    expect(hasPass(g, 1)).toBe(false);
    await g.attack(1, r.uid, { unit: null, gigs: 0 });
    expect(hasPass(g, 1)).toBe(true);
  });
});

describe('Jackie Welles: Pour One Out For Me', () => {
  it('faq:763356ba a Blue Legend played to the field from the Legends area counts as the first Blue Unit played this turn', async () => {
    const s = scene();
    const { g } = s;
    const jackie = spawn(g, 0, 'jackie_welles_pour_one_out_for_me', 'legends');
    const v = spawn(g, 0, 'v_corporate_exile', 'legends'); // Blue, Go Solo
    const x = gig(g, 0, 6, 3);
    eddies(g, 0, 4);
    await g.doAction(0, { type: 'goSolo', uid: v.uid });
    await g.resolvePending();
    expect(v.zone).toBe('field');
    expect(s.asked(0, (d) => d.tag === 'adjust' && d.source === jackie.uid)).toHaveLength(1);
    expect(g.gig(x).value).toBeLessThan(3);
  });

  it('faq:c58d792f a Gig already at its minimum cannot be decreased, so no draw for it', async () => {
    const s = scene();
    const { g } = s;
    spawn(g, 0, 'jackie_welles_pour_one_out_for_me', 'legends');
    const x = gig(g, 0, 6, 1); // the only friendly Gig, already a min Gig
    await playCard(g, 0, 'psycho_squad'); // first Blue Unit this turn
    expect(g.gig(x).value).toBe(1);
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Judy Álvarez: Braindance Maestro', () => {
  function judyScene(h: Hook | null = null) {
    const s = scene({ hooks: [h, null] });
    spawn(s.g, 0, 'judy_alvarez_braindance_maestro', 'legends');
    const u = spawn(s.g, 0, 'psycho_squad', 'field');
    return { ...s, u };
  }

  it('faq:3dbd8dd8 a BRAINDANCE Program played from the trash (Lizzy Wizzy) triggers her', async () => {
    const s = judyScene();
    const { g, u } = s;
    s.agents[0].hook = chooseCard(u);
    const tno = spawn(g, 0, 'trust_no_one', 'trash'); // BRAINDANCE
    await playCard(g, 0, 'lizzy_wizzy_delicate_weapon');
    expect(tno.zone).toBe('deck');
    expect(tagged(s, 0, 'pump')).toHaveLength(1);
    expect(g.power(u)).toBe(7);
  });

  it('faq:179be304 faq:5822e4e8 she triggers for each BRAINDANCE Program, and the same Unit may be chosen again', async () => {
    const s = judyScene();
    const { g, u } = s;
    await playCard(g, 0, 'trust_no_one');
    await playCard(g, 0, 'trust_no_one');
    const pumps = tagged(s, 0, 'pump');
    expect(pumps).toHaveLength(2);
    expect(pumps[1].options.some((o) => o.uid === u.uid)).toBe(true);
    expect(g.power(u)).toBe(8);
  });

  it("faq:284c60bf a BRAINDANCE Program played during the rival's turn triggers her", async () => {
    const s = judyScene();
    const { g, u } = s;
    g.s.active = 1;
    const tno = spawn(g, 0, 'trust_no_one', 'hand');
    eddies(g, 0, 1);
    await play(g, 0, tno);
    expect(tagged(s, 0, 'pump')).toHaveLength(1);
    expect(g.power(u)).toBe(7);
  });
});

describe('Sasha Yakovleva: Won’t Let You Down', () => {
  it('faq:8b665720 with 0 power at the steal step she steals nothing', async () => {
    const { g } = scene();
    const sasha = spawn(g, 0, 'sasha_yakovleva_won_t_let_you_down', 'field', { goSolo: true });
    emptyDeck(g, 0); // her {Attack} reveals nothing, so she stays at 0 power
    const x = gig(g, 1, 6, 3);
    await g.attack(0, sasha.uid, { unit: null, gigs: 1 });
    expect(g.power(sasha)).toBe(0);
    expect(g.gig(x).controller).toBe(1);
  });

  it('faq:f548eacd her {Attack} needs a declared attack: with no valid target there is no attack and nothing is revealed', async () => {
    const { g } = scene();
    const sasha = spawn(g, 0, 'sasha_yakovleva_won_t_let_you_down', 'field', { goSolo: true });
    const top = g.P(0).deck[0];
    expect(g.attackTargets(sasha)).toEqual([]); // no rival Gigs, no spent rival Units
    expect(g.legalActions(0).some((a) => a.type === 'attack')).toBe(false);
    expect(g.P(0).deck[0]).toBe(top);
    // with a target, the {Attack} trigger resolves after the attack is declared at it
    gig(g, 1, 6, 5);
    let target: unknown = undefined;
    const orig = g.enqueue.bind(g);
    vi.spyOn(g, 'enqueue').mockImplementation((p, label, run, extra) => {
      if (label.includes('{Attack}')) target = g.s.attack?.targetGigs;
      return orig(p, label, run, extra);
    });
    await g.attack(0, sasha.uid, { unit: null, gigs: 1 });
    expect(target).toBe(1);
  });
});

describe('Wakako Okada: Peace and Harmony', () => {
  it('faq:ab2739ef her {Call} may choose "-2 power to a rival Unit" even with no rival Units', async () => {
    const s = scene({ hooks: [chooseMode('-2 power'), null] });
    const { g } = s;
    const w = spawn(g, 0, 'wakako_okada_peace_and_harmony', 'legends', { faceUp: false });
    await g.callLegend(0, w.uid, { free: true });
    await g.resolvePending();
    const modes = s.asked(0, (d) => d.kind === 'mode');
    expect(modes).toHaveLength(1);
    expect(modes[0].options.map((o) => o.label)).toEqual(['Give a rival Unit -2 power this turn', 'Draw 1']);
    expect(hand(g, 0)).toBe(0); // chose -2 with nothing to give it to
  });

  it('faq:8bbbcb97 her {Spend} may choose a min Gig (decrease by 0), even when every Gig is a min Gig', async () => {
    const { g } = scene();
    const w = spawn(g, 0, 'wakako_okada_peace_and_harmony', 'legends');
    const a = gig(g, 0, 4, 1);
    const b = gig(g, 1, 6, 1);
    expect(canActivate(g, 0, w, 0)).toBe(true);
    await activate(g, 0, w, 0);
    expect(w.spent).toBe(true);
    expect([g.gig(a).value, g.gig(b).value]).toEqual([1, 1]);
  });
});

describe('Westbrook Netrunner', () => {
  async function west() {
    const { g } = scene();
    const wb = await playCard(g, 0, 'westbrook_netrunner');
    gigs(g, 0, [
      [6, 3],
      [10, 9],
    ]);
    await passTurn(g);
    const v = spawn(g, 1, 'v_corporate_exile', 'legends'); // power 8
    eddies(g, 1, 4);
    await g.doAction(1, { type: 'goSolo', uid: v.uid });
    await g.resolvePending();
    return { g, wb, v };
  }
  const stealable = (g: Game, v: CardInst) => g.stealableGigs(v, 0).map((x) => x.value);

  it('faq:6a19fd88 a rival Legend played to the field after Westbrook still cannot steal a Gig below its power', async () => {
    const { g, v } = await west();
    expect(v.zone).toBe('field');
    expect(stealable(g, v)).toEqual([9]);
  });

  it('faq:5b17e2c5 the restriction stays after Westbrook is defeated during that rival turn', async () => {
    const { g, wb, v } = await west();
    await g.defeat(wb.uid);
    expect(wb.zone).toBe('trash');
    expect(stealable(g, v)).toEqual([9]);
  });
});

// ---------------------------------------------------------------- Programs

describe('Chrome Reverie', () => {
  it('faq:9caf46ed a rival Unit it locked cannot attack even when given leave to attack spent Units', async () => {
    const { g } = scene();
    const r = spawn(g, 1, 'psycho_squad', 'field');
    await playCard(g, 0, 'chrome_reverie');
    expect(g.hasMod('cantAttack', r.uid)).toBe(true);
    spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    gig(g, 0, 6, 3);
    await passTurn(g);
    g.addMod({ kind: 'lagAttack', target: r.uid, value: 'units', until: 'endOfTurn' });
    g.addMod({ kind: 'attackReady', target: r.uid, until: 'endOfTurn' });
    expect(g.attackTargets(r)).toEqual([]);
  });

  it('faq:5139f71f a min Gig is one showing 1: the free Call needs a Gig at 1', async () => {
    for (const [value, calls] of [
      [1, 1],
      [2, 0],
    ] as const) {
      const { g } = scene();
      gig(g, 0, 6, value);
      await playCard(g, 0, 'chrome_reverie');
      expect(g.s.stats.calls[0]).toBe(calls);
    }
  });

  it('faq:1dc8b307 declining the free Call does not make a later Call this turn free', async () => {
    const decline: Hook = (d) => (d.tag === 'call' ? d.options.findIndex((o) => o.key === 'none') : undefined);
    const { g } = scene({ hooks: [decline, null] });
    gig(g, 0, 6, 1);
    await playCard(g, 0, 'chrome_reverie');
    expect(g.s.stats.calls[0]).toBe(0);
    expect(g.callCost(0)).toBe(1);
    expect(g.legalActions(0).some((a) => a.type === 'call')).toBe(false); // no €$ left to pay for it
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'call')).toBe(true);
  });
});

describe('Floor It', () => {
  it('faq:2c3ac370 it can be played with no rival Units (you still draw 1)', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'floor_it', 'hand');
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await play(g, 0, c);
    expect(hand(g, 0)).toBe(1);
  });

  it('faq:cf31b32f a rival Unit with 0 power may be chosen', async () => {
    const s = scene();
    const { g } = s;
    const zero = spawn(g, 1, 'tyger_s_whisper', 'field'); // power 0
    s.agents[0].hook = chooseCard(zero);
    await playCard(g, 0, 'floor_it');
    expect(tagged(s, 0, 'weaken')[0].options.map((o) => o.uid)).toEqual([zero.uid]);
    expect(g.rawPower(zero)).toBe(-1);
  });
});

describe('Les Élémens', () => {
  it('faq:9a85bf8b with several lowest-power rival Units, the player who played it chooses which', async () => {
    const s = scene();
    const { g } = s;
    const a = spawn(g, 1, 'psycho_squad', 'field');
    const b = spawn(g, 1, 'psycho_squad', 'field');
    spawn(g, 1, 'animals_wrecker', 'field'); // power 10
    s.agents[0].hook = chooseCard(b);
    await playCard(g, 0, 'les_elemens');
    const asked = tagged(s, 0, 'bottomdeck');
    expect(asked).toHaveLength(1);
    expect(asked[0].options.map((o) => o.uid)).toEqual([a.uid, b.uid]);
    expect(s.asked(1)).toHaveLength(0);
    expect([a.zone, b.zone]).toEqual(['field', 'deck']);
  });

  it('faq:072482a5 it can be played with no rival Units', async () => {
    const { g } = scene();
    const c = spawn(g, 0, 'les_elemens', 'hand');
    eddies(g, 0, 5);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === c.uid)).toBe(true);
    await play(g, 0, c);
    expect(c.zone).toBe('trash');
  });
});

describe('Nocturne OP55 N1', () => {
  it('faq:d1fecc2d faq:0bba2dd4 the fixer area is empty once no die is left in it, and then it costs exactly 1 €$', async () => {
    const { g } = scene();
    const n = spawn(g, 0, 'nocturne_op55_n1', 'hand');
    for (const sides of [4, 6, 8, 10, 12]) gig(g, 0, sides, 2);
    expect(g.P(0).fixer).toHaveLength(1); // the d20 is still there
    expect(g.playCost(n.uid, 0)).toBe(3);
    gig(g, 0, 20, 2);
    expect(g.playCost(n.uid, 0)).toBe(1);
    eddies(g, 0, 3);
    await play(g, 0, n);
    expect(g.available(0)).toBe(2); // paid 1, not 3
  });

  it('faq:d9d3bf9e "A Unit can\'t attack until your next turn" may be chosen with no Units on the field', async () => {
    const s = scene({ hooks: [chooseMode("can't attack"), null] });
    const { g } = s;
    await playCard(g, 0, 'nocturne_op55_n1');
    const mode = s.asked(0, (d) => d.kind === 'mode')[0];
    expect(mode.options.some((o) => o.label.includes("can't attack"))).toBe(true);
    expect(g.s.mods.filter((m) => m.kind === 'cantAttack')).toHaveLength(0);
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Pyramid Song', () => {
  it('faq:29b8e233 with both effects there is no choice of order: -4 power first, then the bottom-deck', async () => {
    const s = scene();
    const { g } = s;
    gig(g, 0, 4, 1); // friendly d4 is a min Gig: both effects
    const cab = spawn(g, 1, 'delamain_cab', 'field'); // power 4
    await playCard(g, 0, 'pyramid_song');
    expect(s.asked(0, (d) => d.kind === 'mode')).toHaveLength(0);
    expect(cab.zone).toBe('deck'); // reduced to 0 by the first effect, then bottom-decked by the second
  });
});

describe('Reboot Optics', () => {
  it('faq:e18d31dd the protected Unit is not defeated but still loses the fight', async () => {
    const { g } = scene();
    const zealots = spawn(g, 0, 'maelstrom_zealots', 'field', { spent: true }); // power 0; "when this Unit loses a fight"
    const att = spawn(g, 1, 'psycho_squad', 'field');
    g.s.active = 1;
    const ro = spawn(g, 0, 'reboot_optics', 'hand');
    eddies(g, 0, 2);
    await play(g, 0, ro);
    await g.attack(1, att.uid, { unit: zealots.uid, gigs: null });
    expect(zealots.zone).toBe('field'); // not defeated
    expect(att.zone).toBe('trash'); // Zealots' "loses a fight" trigger fired
  });
});

describe('Three Mouths, One Desire', () => {
  it('faq:71b6fcd4 faq:1267e60c the searched cards still count as the deck, and with a min Gig the first card must still be taken', async () => {
    let deckAtChoice = -1;
    const s = scene({
      hooks: [
        (d, g) => {
          if (d.tag === 'search' && deckAtChoice < 0) deckAtChoice = g.P(0).deck.length;
          return undefined;
        },
        null,
      ],
    });
    const { g } = s;
    gig(g, 0, 4, 1);
    const before = g.P(0).deck.length;
    await playCard(g, 0, 'three_mouths_one_desire');
    expect(deckAtChoice).toBe(before);
    const picks = tagged(s, 0, 'search');
    expect(picks).toHaveLength(2);
    expect(picks[0].options.some((o) => o.key === 'none')).toBe(false); // the first card is mandatory
    expect(picks[1].options.some((o) => o.key === 'none')).toBe(true); // the extra one is optional
    expect(hand(g, 0)).toBe(2);
  });
});

describe('Towerfall', () => {
  it('faq:2a2fadce with Street Cred equal to the rival you choose one effect', async () => {
    const s = scene();
    const { g } = s;
    gig(g, 0, 6, 3);
    gig(g, 1, 4, 3);
    await playCard(g, 0, 'towerfall');
    expect(s.asked(0, (d) => d.kind === 'mode')).toHaveLength(1);
  });

  it('faq:cabf44d5 with both effects, -5 to all rival Units resolves before bottom-decking those at 0', async () => {
    const s = scene();
    const { g } = s;
    gig(g, 0, 6, 1);
    gig(g, 1, 4, 3);
    const five = spawn(g, 1, 'westbrook_netrunner', 'field'); // power 5
    const six = spawn(g, 1, 'psycho_squad', 'field'); // power 6
    await playCard(g, 0, 'towerfall');
    expect(s.asked(0, (d) => d.kind === 'mode')).toHaveLength(0);
    expect(five.zone).toBe('deck');
    expect(six.zone).toBe('field');
    expect(g.power(six)).toBe(1);
  });
});

describe('Trust No One', () => {
  it('faq:cc187a60 the min Gig that draws need not be the Gig it decreased', async () => {
    const s = scene();
    const { g } = s;
    gig(g, 0, 4, 1); // already a min Gig
    const r = gig(g, 1, 6, 5);
    s.agents[0].hook = setGigTo(r, 4); // decrease the rival's Gig, not the min Gig
    await playCard(g, 0, 'trust_no_one');
    expect(g.gig(r).value).toBe(4);
    expect(hand(g, 0)).toBe(1);
  });

  it('faq:d731ae05 it can be played with no Gigs to decrease', async () => {
    const { g } = scene();
    const tno = spawn(g, 0, 'trust_no_one', 'hand');
    eddies(g, 0, 1);
    expect(g.legalActions(0).some((a) => a.type === 'play' && a.uid === tno.uid)).toBe(true);
    await play(g, 0, tno);
    expect(tno.zone).toBe('trash');
    expect(hand(g, 0)).toBe(0);
  });
});

describe('Unlikely Bond', () => {
  it('faq:51314e7a with no spent rival Unit you must still bottom-deck a ready friendly Unit', async () => {
    const s = scene();
    const { g } = s;
    const mine = spawn(g, 0, 'psycho_squad', 'field');
    const theirs = spawn(g, 1, 'psycho_squad', 'field'); // ready
    await playCard(g, 0, 'unlikely_bond');
    expect(tagged(s, 0, 'bottomdeckOwn')[0].options.some((o) => o.key === 'none')).toBe(false);
    expect(mine.zone).toBe('deck');
    expect(theirs.zone).toBe('field');
  });
});

// ---------------------------------------------------------------- Gear

/** The two "when this Unit or Legend is spent" Gears and the log line their effect writes. */
const SPENT_GEAR: [string, RegExp][] = [
  ['netwatch_netdriver', /^draws 1$/],
  ['tetratronic_rippler', /^trashes /],
];
const trashYes = answerYes(true, 'trashTop');
const linesFrom = (g: Game, from: number) => g.s.log.slice(from).map((e) => e.text);

describe('NetWatch Netdriver and Tetratronic Rippler: "when this Unit or Legend is spent"', () => {
  const tags: Record<string, Record<string, string>> = {
    netwatch_netdriver: { react: 'faq:44cc0af1', order: 'faq:e7efa410', ability: 'faq:6a903897', program: 'faq:52e98457' },
    tetratronic_rippler: { react: 'faq:a241cffa', order: 'faq:07efe66d', ability: 'faq:b577753b', program: 'faq:0e2f7008' },
  };
  for (const [gear, line] of SPENT_GEAR) {
    const t = tags[gear];

    it(`${t.react} ${gear}: spent to attack, its effect resolves before the rival's React step`, async () => {
      let seen: string[] | null = null;
      let from = 0;
      const rival: Hook = (d, g) => {
        if (d.kind === 'reaction' && !seen) seen = linesFrom(g, from);
        return undefined;
      };
      const { g } = scene({ hooks: [trashYes, rival] });
      const att = spawn(g, 0, 'psycho_squad', 'field');
      equip(g, 0, gear, att);
      gig(g, 1, 6, 3);
      eddies(g, 1, 1); // the rival could Call a Legend: they get a React question
      from = g.s.log.length;
      await g.attack(0, att.uid, { unit: null, gigs: 1 });
      expect(seen).not.toBeNull();
      expect(seen!.some((l) => line.test(l))).toBe(true);
    });

    it(`${t.order} ${gear}: with an {Attack} trigger from the same attack, the player chooses which resolves first`, async () => {
      const s = scene({ hooks: [hooks(resolveFirst('{Attack}'), trashYes), null], order: [0] });
      const { g } = s;
      const siren = spawn(g, 0, 'evelyn_parker_scheming_siren', 'field'); // {Attack} Draw 1
      equip(g, 0, gear, siren);
      gig(g, 1, 6, 3);
      await g.attack(0, siren.uid, { unit: null, gigs: 1 });
      const offers = orderOffers(s.agents[0]);
      expect(offers).toHaveLength(1);
      expect(offers[0].some((l) => l.includes('{Attack}'))).toBe(true);
      expect(offers[0].some((l) => l.includes('when spent'))).toBe(true);
      expect(s.lines().some((l) => l.startsWith('resolves Evelyn Parker'))).toBe(true);
    });

    it(`${t.ability} ${gear}: spent to activate a {Spend} ability, its effect resolves only after that ability`, async () => {
      const s = scene({ hooks: [hooks(trashYes, answerYes(false, 'freePlay')), null], order: [0] });
      const { g } = s;
      const judy = spawn(g, 0, 'judy_alvarez_nothing_to_doubt', 'field');
      equip(g, 0, gear, judy);
      eddies(g, 0, 1);
      s.mark();
      await activate(g, 0, judy, 0);
      const lines = s.lines();
      const reveal = lines.findIndex((l) => l.startsWith('reveals'));
      const effect = lines.findIndex((l) => line.test(l));
      expect(reveal).toBeGreaterThanOrEqual(0);
      expect(effect).toBeGreaterThan(reveal);
      expect(orderOffers(s.agents[0])).toHaveLength(0); // never offered ahead of the ability
    });

    it(`${t.program} ${gear}: a face-up Legend spent to pay for a Program triggers it only after the Program resolves`, async () => {
      let atProgram: string[] | null = null;
      let from = 0;
      const watch: Hook = (d, g) => {
        if (d.kind === 'gigValue' && !atProgram) atProgram = linesFrom(g, from);
        return undefined;
      };
      const s = scene({ hooks: [hooks(watch, trashYes), null], order: [0] });
      const { g } = s;
      const alt = spawn(g, 0, 'alt_cunningham_soulkiller_architect', 'legends'); // face-up, can pay
      equip(g, 0, gear, alt);
      gig(g, 0, 6, 4);
      const tno = spawn(g, 0, 'trust_no_one', 'hand');
      from = g.s.log.length;
      await g.playFromHand(0, tno.uid);
      expect(alt.spent).toBe(true);
      expect(atProgram).not.toBeNull();
      expect(atProgram!.some((l) => line.test(l))).toBe(false);
      await g.resolvePending();
      expect(linesFrom(g, from).some((l) => line.test(l))).toBe(true);
    });
  }
});

describe('Tetratronic Rippler', () => {
  it('faq:5ecbb33e the card it searches is still part of the deck while you decide', async () => {
    let atChoice: { size: number; top: number } | null = null;
    const watch: Hook = (d, g) => {
      if (d.tag === 'trashTop') {
        atChoice = { size: g.P(0).deck.length, top: g.P(0).deck[0] };
        return 1; // keep it on top
      }
      return undefined;
    };
    const { g } = scene({ hooks: [watch, null] });
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'tetratronic_rippler', u);
    const [top] = deckOf(g, 0, ['floor_it']);
    const size = g.P(0).deck.length;
    g.spend(u.uid);
    await g.resolvePending();
    expect(atChoice).toEqual({ size, top: top.uid });
    expect(g.P(0).deck[0]).toBe(top.uid);
  });
});

describe('Dying Night: V’s Pistol', () => {
  it('faq:881c635b after its {Attack} resolved on V, V being defeated does not stop the 2 Eddies at the end of the turn', async () => {
    const { g } = scene();
    const v = spawn(g, 0, 'v_roamer_of_the_badlands', 'field'); // a Unit named V
    equip(g, 0, 'dying_night_v_s_pistol', v);
    gig(g, 1, 6, 3);
    spentEddies(g, 0, 2);
    await g.attack(0, v.uid, { unit: null, gigs: 1 });
    await g.defeat(v.uid);
    await g.resolvePending();
    expect(v.zone).toBe('trash');
    await g.endPhase();
    expect(readyEddies(g, 0)).toBe(2);
  });

  it("faq:043520f5 a Unit does not gain its Gear's tags", async () => {
    const { g } = scene();
    const u = spawn(g, 0, 'psycho_squad', 'field'); // NCPD
    equip(g, 0, 'dying_night_v_s_pistol', u); // Merc, Weapon
    expect(g.isTag(u, 'Merc')).toBe(false);
    expect(g.isTag(u, 'Weapon')).toBe(false);
    // behaviour: Yorinobu draws for an attacking ARASAKA Unit; a Unit carrying an ARASAKA Gear (Satori) is not one
    const s = scene();
    spawn(s.g, 0, 'yorinobu_arasaka_embracing_destruction', 'legends');
    const att = spawn(s.g, 0, 'psycho_squad', 'field');
    equip(s.g, 0, 'satori_sword_of_saburo', att);
    gig(s.g, 1, 6, 3);
    s.mark();
    await s.g.attack(0, att.uid, { unit: null, gigs: 1 });
    expect(s.lines().some((l) => l.startsWith('draws'))).toBe(false);
  });
});

// ---------------------------------------------------------------- Units

describe('Delamain Cab', () => {
  it('faq:59552a2f if it stole a Gig and was then defeated, no Eddie is readied at the end of the turn', async () => {
    for (const defeated of [false, true]) {
      const { g } = scene();
      const cab = spawn(g, 0, 'delamain_cab', 'field');
      gig(g, 1, 6, 3);
      spentEddies(g, 0, 1);
      await g.attack(0, cab.uid, { unit: null, gigs: 1 });
      expect(g.P(0).gigs).toHaveLength(1);
      if (defeated) await g.defeat(cab.uid);
      await g.endPhase();
      expect(readyEddies(g, 0)).toBe(defeated ? 0 : 1);
    }
  });
});

describe('Delamain: Rideshare AI', () => {
  it('faq:cdc01e4e its {Play} draws 2, with no choice', async () => {
    const s = scene();
    await playCard(s.g, 0, 'delamain_rideshare_ai');
    expect(hand(s.g, 0)).toBe(2);
    expect(s.asked(0)).toHaveLength(0);
  });
});

describe('Evelyn Parker: Scheming Siren', () => {
  it('faq:21199b77 her {Attack} draws 1, with no choice', async () => {
    const s = scene();
    const siren = spawn(s.g, 0, 'evelyn_parker_scheming_siren', 'field');
    gig(s.g, 1, 6, 3);
    await s.g.attack(0, siren.uid, { unit: null, gigs: 1 });
    expect(hand(s.g, 0)).toBe(1);
    expect(s.asked(0, (d) => d.kind === 'yesno')).toHaveLength(0);
  });
});

describe('Hacked Corpo', () => {
  it('faq:d7f37678 after trashing 3 you must add a Program from among them', async () => {
    const s = scene();
    const { g } = s;
    const [fi] = deckOf(g, 0, ['floor_it', 'psycho_squad', 'psycho_squad']);
    await playCard(g, 0, 'hacked_corpo');
    const choice = tagged(s, 0, 'search');
    expect(choice).toHaveLength(1);
    expect(choice[0].options.some((o) => o.key === 'none')).toBe(false);
    expect(fi.zone).toBe('hand');
  });
});

describe('Jacked-In Voodoo Boy', () => {
  it('faq:39c1b729 given Adrenaline on the turn it is played, it still cannot attack until you play a Program', async () => {
    const { g } = scene();
    gig(g, 1, 6, 3);
    const vb = await playCard(g, 0, 'jacked_in_voodoo_boy');
    g.giveKeyword(vb.uid, 'adrenaline');
    expect(g.lagPermission(vb)).toBe('any');
    expect(g.attackTargets(vb)).toEqual([]);
  });

  it('faq:2e7fbbd3 played with Adrenaline after you played a Program this turn, it can attack', async () => {
    const { g } = scene();
    gig(g, 1, 6, 3);
    await playCard(g, 0, 'floor_it');
    const vb = await playCard(g, 0, 'jacked_in_voodoo_boy');
    g.giveKeyword(vb.uid, 'adrenaline');
    expect(g.attackTargets(vb)).toEqual([{ unit: null, gigs: 1 }]);
  });
});

describe('Judy Álvarez: Nothing to Doubt', () => {
  it('faq:90d8581b her {Spend} ability can be activated with an empty deck (it then does nothing)', async () => {
    const { g } = scene();
    const judy = spawn(g, 0, 'judy_alvarez_nothing_to_doubt', 'field');
    emptyDeck(g, 0);
    eddies(g, 0, 1);
    expect(canActivate(g, 0, judy, 0)).toBe(true);
    await activate(g, 0, judy, 0);
    expect(judy.spent).toBe(true);
    expect(g.available(0)).toBe(0);
    expect(g.s.winner).toBeNull();
  });
});

describe('Lizzy Wizzy: Delicate Weapon', () => {
  it('faq:302a8e57 the Program she plays goes straight to the bottom of the deck, never through the trash', async () => {
    const { g } = scene();
    const tno = spawn(g, 0, 'trust_no_one', 'hand');
    const moves: string[] = [];
    const orig = g.move.bind(g);
    vi.spyOn(g, 'move').mockImplementation((uid, to, opts) => {
      if (uid === tno.uid) moves.push(`${to}:${opts?.position ?? ''}`);
      return orig(uid, to, opts);
    });
    await playCard(g, 0, 'lizzy_wizzy_delicate_weapon');
    expect(moves).toEqual(['deck:bottom']);
    expect(g.P(0).deck[g.P(0).deck.length - 1]).toBe(tno.uid);
  });

  it('faq:7160b6d5 resolving her {Play} first, the Program she plays resolves fully before the other pending effect', async () => {
    const s = scene({ hooks: [resolveFirst('Lizzy Wizzy'), null], order: [0] });
    const { g } = s;
    const jackie = spawn(g, 0, 'jackie_welles_pour_one_out_for_me', 'legends'); // pending on the same play
    gig(g, 0, 6, 4);
    const tno = spawn(g, 0, 'trust_no_one', 'trash');
    await playCard(g, 0, 'lizzy_wizzy_delicate_weapon');
    expect(orderOffers(s.agents[0])).toHaveLength(1);
    const adjusts = s.asked(0, (d) => d.kind === 'gigValue').map((d) => d.source);
    expect(adjusts).toEqual([tno.uid, jackie.uid]); // Trust No One (played by Lizzy) before Jackie's trigger
  });
});

describe('Maman Brigitte: Spirit of Death', () => {
  it('faq:9d6d9ce9 with only 1 Program in hand you cannot discard it for nothing', async () => {
    const s = scene();
    const { g } = s;
    const fi = spawn(g, 0, 'floor_it', 'hand');
    const r = spawn(g, 1, 'psycho_squad', 'field');
    await playCard(g, 0, 'maman_brigitte_spirit_of_death');
    expect(s.asked(0, (d) => d.tag === 'discardFor' || d.tag === 'discard')).toHaveLength(0);
    expect(fi.zone).toBe('hand');
    expect(r.zone).toBe('field');
  });
});

describe('Misty Olszewski: Mender of Broken Spirits', () => {
  it('faq:e82502be at the end of the turn, Legend may be chosen as the card type', async () => {
    const s = scene({ hooks: [chooseMode('Legend'), null] });
    const { g } = s;
    spawn(g, 0, 'misty_olszewski_mender_of_broken_spirits', 'field');
    const top = g.P(0).deck[0];
    await g.endPhase();
    const ask = tagged(s, 0, 'cardType');
    expect(ask).toHaveLength(1);
    expect(ask[0].options.map((o) => o.label)).toContain('Legend');
    expect(g.c(top).zone).toBe('trash'); // a Unit, not the chosen type
  });

  it('faq:9afdaa8c "must attack if it can" does not let her attack', () => {
    const { g } = scene();
    const misty = spawn(g, 0, 'misty_olszewski_mender_of_broken_spirits', 'field');
    gig(g, 1, 6, 3);
    g.addMod({ kind: 'mustAttack', target: misty.uid, until: 'endOfTurn' });
    expect(g.attackTargets(misty)).toEqual([]);
    expect(hasPass(g, 0)).toBe(true);
  });
});

describe('Modded Kusanagi', () => {
  it('faq:e6eaf7b6 its end-of-turn effect does nothing from the trash', async () => {
    const { g } = scene();
    const k = spawn(g, 0, 'modded_kusanagi', 'trash');
    const onField = spawn(g, 0, 'modded_kusanagi', 'field');
    await g.endPhase();
    expect(k.zone).toBe('trash');
    expect(onField.zone).toBe('hand');
  });

  it('faq:4b894ff4 under Cyberpsychosis, resolving its return-to-hand first avoids the Cyberpsychosis defeat', async () => {
    const s = scene({ hooks: [resolveFirst('Modded Kusanagi'), null], order: [0] });
    const { g } = s;
    const k = spawn(g, 0, 'modded_kusanagi', 'field');
    equip(g, 0, 'mantis_blades', k);
    await playCard(g, 0, 'cyberpsychosis');
    const r = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
    await g.attack(0, k.uid, { unit: r.uid, gigs: null }); // it fights: Cyberpsychosis will defeat it at end of turn
    expect(r.zone).toBe('trash');
    await g.endPhase();
    expect(orderOffers(s.agents[0])).toHaveLength(1);
    expect(k.zone).toBe('hand');
  });
});

describe('Modded Muramasa', () => {
  it('faq:d0a32e18 with less Street Cred than a rival it must ready at the end of the turn', async () => {
    const s = scene();
    const { g } = s;
    const m = spawn(g, 0, 'modded_muramasa', 'field', { spent: true });
    gig(g, 0, 4, 1);
    gig(g, 1, 6, 5);
    await g.endPhase();
    expect(m.spent).toBe(false);
    expect(s.asked(0, (d) => d.kind === 'yesno')).toHaveLength(0);
  });
});

describe('Mox Inciters', () => {
  it('faq:993d5dde forcing a rival Unit that "can\'t attack" does not let it attack', async () => {
    const { g } = scene();
    const cs = spawn(g, 1, 'corpo_security', 'field'); // This Unit can't attack
    await playCard(g, 0, 'mox_inciters');
    expect(g.hasMod('mustAttack', cs.uid)).toBe(true);
    gig(g, 0, 6, 3);
    await passTurn(g);
    expect(g.attackTargets(cs)).toEqual([]);
    expect(hasPass(g, 1)).toBe(true);
  });
});

describe('MT0D12 Flathead', () => {
  it('faq:b0b79c55 it can be sold although it is a Unit', () => {
    const { g } = scene();
    const f = spawn(g, 0, 'mt0d12_flathead', 'hand');
    expect(g.legalActions(0).some((a) => a.type === 'sell' && a.uid === f.uid)).toBe(true);
  });

  it('faq:4ab27f37 "can\'t be blocked" is checked again during the React step: once the cred condition fails, Blockers may block', () => {
    const { g } = scene();
    const f = spawn(g, 0, 'mt0d12_flathead', 'field');
    const blocker = spawn(g, 1, 'mox_inciters', 'field');
    const mine = gig(g, 0, 8, 1);
    gig(g, 1, 6, 5);
    reactStep(g, f, { gigs: 1 });
    expect(canBlockWith(g, 1, blocker)).toBe(false); // attacker has less cred
    g.gig(mine).value = 8; // during the React step the attacker no longer has less cred
    expect(canBlockWith(g, 1, blocker)).toBe(true);
  });
});

describe('Placide: Voodoo Sentinel', () => {
  it('faq:ae31fcd3 the optional Program discard is offered even with no rival Units (and may be taken)', async () => {
    const s = scene();
    const { g } = s;
    const prog = spawn(g, 0, 'floor_it', 'hand');
    await playCard(g, 0, 'placide_voodoo_sentinel');
    const asked = s.asked(0, (d) => d.kind === 'card' && d.options.some((o) => o.uid === prog.uid));
    expect(asked).toHaveLength(1);
    expect(asked[0].options.some((o) => o.key === 'none')).toBe(true); // still optional
    expect(prog.zone).toBe('trash'); // Scripted takes the first option: the Program
  });

  it('faq:ae31fcd3 bots decline that discard when there is no rival Unit', async () => {
    const { g } = scene();
    g.agents[0] = makeTierBot('medium', 1);
    const prog = spawn(g, 0, 'floor_it', 'hand');
    await playCard(g, 0, 'placide_voodoo_sentinel');
    expect(prog.zone).toBe('hand');
  });
});

describe('Rita Wheeler: No Stupid Questions', () => {
  it('faq:7b34456c with an empty deck her draw is still mandatory: its controller loses', async () => {
    const { g } = scene();
    const rita = spawn(g, 0, 'rita_wheeler_no_stupid_questions', 'field');
    emptyDeck(g, 0);
    g.spend(rita.uid);
    await expect(g.resolvePending()).rejects.toThrow();
    expect(g.s.winner).toBe(1);
  });
});

describe('Rogue Amendiares: Queen of the Afterlife', () => {
  /** Player 0 has two friendly Units (power 6) and two spent Eddies; the rival has Gigs 3 and 2. */
  function rogueScene() {
    const { g } = scene();
    const a = spawn(g, 0, 'psycho_squad', 'field');
    const b = spawn(g, 0, 'psycho_squad', 'field');
    const [x, y] = gigs(g, 1, [
      [6, 3],
      [8, 2],
    ]);
    spentEddies(g, 0, 2);
    const steal = async (u: CardInst, gid: number) => {
      g.stealGig(u.uid, gid, 0);
      await g.resolvePending();
    };
    return { g, a, b, x, y, steal };
  }

  it('faq:9ce8258b played during the rival\'s React step, its {Quick} {Spend} ability cannot be used that turn', () => {
    for (const lag of [true, false]) {
      const { g } = scene();
      const rogue = spawn(g, 0, 'rogue_amendiares_queen_of_the_afterlife', 'field', { lag });
      eddies(g, 0, 2);
      const att = spawn(g, 1, 'psycho_squad', 'field');
      gig(g, 0, 6, 3);
      reactStep(g, att, { gigs: 0 });
      expect(g.legalReactions(0).some((r) => r.type === 'activate' && r.host === rogue.uid)).toBe(!lag);
    }
  });

  it('faq:587d8011 a qualifying steal before it entered play counts as the first: a later one does not trigger it', async () => {
    const { g, a, b, x, y, steal } = rogueScene();
    await steal(a, x); // 3 < 6, no Rogue yet
    spawn(g, 0, 'rogue_amendiares_queen_of_the_afterlife', 'field');
    await steal(b, y);
    expect(readyEddies(g, 0)).toBe(0);
  });

  it('faq:30697bfe it triggers only once a turn', async () => {
    const { g, a, b, x, y, steal } = rogueScene();
    spawn(g, 0, 'rogue_amendiares_queen_of_the_afterlife', 'field');
    await steal(a, x);
    expect(readyEddies(g, 0)).toBe(2);
    for (const u of g.P(0).eddies) g.c(u).spent = true;
    await steal(b, y);
    expect(readyEddies(g, 0)).toBe(0);
  });

  it('faq:8d449d55 a second Rogue played after the first resolved this turn does not trigger either', async () => {
    const { g, a, b, x, y, steal } = rogueScene();
    spawn(g, 0, 'rogue_amendiares_queen_of_the_afterlife', 'field');
    await steal(a, x);
    for (const u of g.P(0).eddies) g.c(u).spent = true;
    spawn(g, 0, 'rogue_amendiares_queen_of_the_afterlife', 'field');
    await steal(b, y);
    expect(readyEddies(g, 0)).toBe(0);
  });
});
