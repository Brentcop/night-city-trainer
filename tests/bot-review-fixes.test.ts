// The bot review of 2026-11-13 (docs/REVIEW_2026-11-13.md, Bots; SIM_VERSION 8): each fix in a built position where the
// bot used to choose the wrong move. Measured by paired botcheck in docs/BOT_TOOLKIT.md §6.
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/engine';
import type { Action, CardInst, Decision, PlayerId } from '../src/engine/types';
import { DEFAULT_WEIGHTS, evaluate, stealableNextTurn } from '../src/ai/eval';
import { CALIBRATED_2026_11 } from '../src/ai/weightSets';
import { dominatedLegendPlay, HeuristicAgent } from '../src/ai/heuristic';
import { makeTierBot } from '../src/ai/tiers';
import { cardValue } from '../src/ai/knowledge';
import { CARDS } from '../src/engine/cards';
import { viewDecision } from '../src/net/view';
import { eddies, equip, gig, setup, spawn } from './engine-helpers';

const actionDecision = (g: Game, p: PlayerId = 0): Decision => {
  const actions = g.legalActions(p);
  return { player: p, kind: 'action', prompt: 'Choose an action', options: actions.map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
};
const chosen = async (bot: HeuristicAgent, g: Game, d: Decision): Promise<Action> => d.options[(await bot.decide(g, d))[0]].action as Action;
const isPlayOf = (a: Action, c: CardInst) => a.type === 'play' && a.uid === c.uid;
/** A Medium-like lookahead bot without noise, so the test reads the evaluation alone. */
const medium = () => new HeuristicAgent({ seed: 3 });

describe('BOT-A: a Legend that goes solo is not scored below the same Legend played with Lag', () => {
  it('the default weights give Go Solo no weight of its own; the fitted set keeps its fitted value', () => {
    expect(DEFAULT_WEIGHTS.goSolo).toBe(0);
    expect(CALIBRATED_2026_11.goSolo).toBe(-50.6);
  });

  it('Medium and Hard Go Solo rather than play the Legend to the field with Lag', async () => {
    for (const tier of ['medium', 'hard'] as const) {
      const { g } = setup();
      for (const u of [...g.P(0).legends]) g.move(u, 'removed');
      const v = spawn(g, 0, 'v_corporate_exile', 'legends'); // cost 5, power 8, Go Solo
      eddies(g, 0, 5);
      gig(g, 1, 4, 2);
      const d = actionDecision(g);
      expect(d.options.map((o) => (o.action as Action).type)).toEqual(expect.arrayContaining(['goSolo', 'playLegend']));
      const a = await chosen(makeTierBot(tier, 1), g, d);
      expect([tier, a.type, 'uid' in a && a.uid]).toEqual([tier, 'goSolo', v.uid]);
    }
  });

  it('the ordinary Legend play is dominated when Go Solo costs no more, and not when Go Solo is taxed', () => {
    for (const taxed of [false, true]) {
      const { g } = setup();
      for (const u of [...g.P(0).legends]) g.move(u, 'removed');
      const v = spawn(g, 0, 'v_corporate_exile', 'legends');
      eddies(g, 0, 7);
      if (taxed) equip(g, 1, 'riot_shield', spawn(g, 1, 'psycho_squad', 'field')); // Go Solo costs 7
      const actions = g.legalActions(0);
      const play = actions.find((a) => a.type === 'playLegend' && a.uid === v.uid)!;
      expect([taxed, dominatedLegendPlay(g, 0, play, actions)]).toEqual([taxed, !taxed]);
    }
  });
});

describe('BOT-B: power that lasts only this turn counts only where it can still matter', () => {
  it('a this-turn pump on a spent Unit that can no longer attack adds nothing; on a Unit that can attack it does', () => {
    const { g } = setup();
    gig(g, 1, 4, 2);
    const u = spawn(g, 0, 'psycho_squad', 'field', { spent: true });
    const before = evaluate(g, 0);
    g.givePower(u.uid, 3);
    expect(evaluate(g, 0)).toBe(before);
    u.spent = false; // ready: it can still attack the rival's Gigs this turn
    const ready = evaluate(g, 0);
    g.s.mods = g.s.mods.filter((m) => m.kind !== 'power');
    expect(ready).toBeGreaterThan(evaluate(g, 0));
  });

  it("the rival's next-turn steals ignore this turn's power", () => {
    const { g } = setup();
    gig(g, 0, 4, 2);
    gig(g, 0, 6, 3);
    const r = spawn(g, 1, 'psycho_squad', 'field'); // power 6: steals 1
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
    g.givePower(r.uid, 5); // 11 this turn only
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
    g.givePower(r.uid, 5, 'permanent');
    expect(stealableNextTurn(g, 1, 0)).toBe(2);
  });

  it('Medium weakens a rival Unit only when one of its Units can still fight it (Pyramid Song, seed 202 T12)', async () => {
    for (const ownReady of [false, true]) {
      const { g } = setup();
      eddies(g, 0, 5);
      gig(g, 1, 4, 2);
      spawn(g, 0, 'psycho_squad', 'field', { spent: !ownReady }); // power 6
      spawn(g, 1, 'animals_wrecker', 'field', { spent: true }); // power 10: beats it, unless weakened by 4
      const song = spawn(g, 0, 'pyramid_song', 'hand');
      const a = await chosen(medium(), g, actionDecision(g));
      expect([ownReady, isPlayOf(a, song)]).toEqual([ownReady, ownReady]);
    }
  });
});

describe("BOT-C: the next-turn steal estimate respects can't-attack locks", () => {
  it("a rival Unit that can't attack through its next turn steals nothing; a lock ending this turn doesn't count", () => {
    const { g } = setup();
    gig(g, 0, 4, 2);
    const r = spawn(g, 1, 'psycho_squad', 'field');
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
    g.addMod({ kind: 'cantAttack', target: r.uid, until: 'endOfTurn' });
    expect(stealableNextTurn(g, 1, 0)).toBe(1);
    g.addMod({ kind: 'cantAttack', target: r.uid, until: 'startOfTurn', untilPlayer: 0 }); // until our next turn (Chrome Reverie)
    expect(stealableNextTurn(g, 1, 0)).toBe(0);
  });
});

describe('BOT-D/E: Unit sub-choices', () => {
  const unitDecision = (p: PlayerId, cards: CardInst[], tag: string, intent: Decision['intent']): Decision => ({
    player: p,
    kind: 'unit',
    prompt: 'choose',
    tag,
    intent,
    min: 1,
    max: 1,
    options: cards.map((c) => ({ label: c.defId, uid: c.uid })),
  });

  it("while defending, a weakening effect goes on the rival's attacker rather than its biggest Unit", async () => {
    for (const bot of [medium(), makeTierBot('easy', 1)]) {
      const { g } = setup();
      g.s.active = 1;
      const big = spawn(g, 1, 'animals_wrecker', 'field'); // power 10, ready, not fighting
      const attacker = spawn(g, 1, 'psycho_squad', 'field', { spent: true });
      g.s.attack = { attacker: attacker.uid, attackerPlayer: 1, targetUnit: null, targetGigs: 0, step: 'react', ended: false };
      expect(await bot.decide(g, unitDecision(0, [big, attacker], 'power', 'harm'))).toEqual([1]);
    }
  });

  it('Unlikely Bond bottom-decks our least valuable ready Unit, not our best', async () => {
    const { g } = setup();
    const best = spawn(g, 0, 'animals_wrecker', 'field');
    const least = spawn(g, 0, 'psycho_squad', 'field');
    expect(await medium().decide(g, unitDecision(0, [best, least], 'bottomdeckOwn', 'neutral'))).toEqual([1]);
  });
});

describe('BOT-F: Easy does not play a Program that would do nothing', () => {
  it('Carnage at the Colosseum with no friendly Unit is held; with one stronger than a rival Unit it is played', async () => {
    for (const withUnit of [false, true]) {
      const { g } = setup();
      eddies(g, 0, 6);
      spawn(g, 1, 'psycho_squad', 'field'); // power 6
      if (withUnit) spawn(g, 0, 'animals_wrecker', 'field', { spent: true }); // power 10
      const carnage = spawn(g, 0, 'carnage_at_the_colosseum', 'hand');
      const a = await chosen(makeTierBot('easy', 1), g, actionDecision(g));
      expect([withUnit, isPlayOf(a, carnage)]).toEqual([withUnit, withUnit]);
    }
  });

  it('only Easy has the guard (the fast policy inside every lookahead is unchanged)', () => {
    expect(makeTierBot('easy', 1).opts.easyGuard).toBe(true);
    expect(makeTierBot('medium', 1).opts.easyGuard).toBe(false);
    expect(makeTierBot('hard', 1).opts.easyGuard).toBe(false);
    expect(new HeuristicAgent({ lookahead: false }).opts.easyGuard).toBe(false);
  });
});

describe('mode choices that used to give one answer whatever the position', () => {
  it("Misty names the card type most common in the bot's own deck", async () => {
    const { g } = setup(); // the filler deck is all Units
    const types = ['Unit', 'Gear', 'Program', 'Legend'];
    const d: Decision = { player: 0, kind: 'mode', prompt: 'Misty: choose a card type', tag: 'cardType', min: 1, max: 1, options: types.map((t, k) => ({ label: t, key: String(k) })) };
    expect(await medium().decide(g, d)).toEqual([0]);
    for (const u of g.P(0).deck.slice(0, 30)) g.c(u).defId = 'floor_it';
    expect(await medium().decide(g, d)).toEqual([2]);
  });

  it("Fool on the Hill: the rival trashes the revealed cards only when they are better than two unknown draws", async () => {
    const { g } = setup();
    const d: Decision = { player: 1, kind: 'mode', prompt: 'Fool on the Hill: rival reveals …', tag: 'foolOnTheHill', min: 1, max: 1, options: ['Add them to their hand', 'Trash them (they draw 2)'].map((l, k) => ({ label: l, key: String(k) })) };
    const top = g.P(0).deck.slice(0, 2);
    const byValue = CARDS.filter((c) => c.type !== 'Legend').sort((a, b) => cardValue(a.id) - cardValue(b.id));
    for (const u of top) g.c(u).defId = byValue[byValue.length - 1].id; // the best cards in the pool: trash them
    expect(await medium().decide(g, d)).toEqual([1]);
    for (const u of top) g.c(u).defId = byValue[0].id; // the worst: let them be added
    expect(await medium().decide(g, d)).toEqual([0]);
  });
});

describe('NET-3: card choices never name a face-down Legend the chooser does not know', () => {
  it('Kiroshi Optics labels the unknown face-down Legends by slot only, here and in the online view', async () => {
    const { g, agents } = setup();
    const names = g.faceDownLegends(0).map((c) => g.name(c));
    expect(names.length).toBeGreaterThan(1);
    const u = spawn(g, 0, 'psycho_squad', 'field');
    equip(g, 0, 'kiroshi_optics', u);
    gig(g, 1, 4, 2);
    await g.attack(0, u.uid, { unit: null, gigs: 1 });
    const d = agents[0].log.find((x) => x.tag === 'look')!;
    expect(d.options.map((o) => o.label)).toEqual(d.options.map((o) => `Face-down Legend (slot ${g.P(0).legends.indexOf(o.uid!) + 1})`));
    const text = JSON.stringify([d, viewDecision(g.s, d, 0)]);
    for (const n of names) expect(text).not.toContain(n);
  });

  it("a known face-down Legend is named to its controller only, never to the rival", async () => {
    const { g } = setup();
    const fd = g.faceDownLegends(1)[0];
    fd.known = true;
    const asked: Decision[] = [];
    g.agents[0] = { name: 'rec', decide: async (_g, d) => (asked.push(d), [0]) };
    g.agents[1] = { name: 'rec', decide: async (_g, d) => (asked.push(d), [0]) };
    await g.chooseUnit(0, [fd], 'pick', {});
    await g.chooseCard(0, [fd.uid], 'pick');
    await g.chooseCard(1, [fd.uid], 'pick');
    expect(asked.map((d) => d.options[0].label)).toEqual([`Rival Face-down Legend (slot ${g.P(1).legends.indexOf(fd.uid) + 1})`, `Rival Face-down Legend (slot ${g.P(1).legends.indexOf(fd.uid) + 1})`, g.name(fd)]);
  });
});
