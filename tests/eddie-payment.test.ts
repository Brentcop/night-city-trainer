// Choosing what pays a cost on the Play board (src/lib/eddiePayment.ts, board settings "Choose before" / "Choose
// after"). A UI layer: the selection ends in the same engine action, and its 'pay' answers come from planAnswer. The
// selection the prompt starts from is what Automatic would spend, and paying with it leaves the game exactly as
// automatic payment does.
import { describe, expect, it } from 'vitest';
import type { Game } from '../src/engine/engine';
import type { Decision } from '../src/engine/types';
import {
  addEddie,
  automaticSelection,
  autoPayAnswer,
  clampSelection,
  costOfAnswer,
  EMPTY_SELECTION,
  optionCost,
  paySources,
  payStatus,
  planAnswer,
  readyEddies,
  tapEddie,
  toggleLegend,
  type PaySelection,
} from '../src/lib/eddiePayment';
import { eddies, FILLER, setup, spawn, type Hook } from './engine-helpers';

function actionDecision(g: Game): Decision {
  return { player: 0, kind: 'action', prompt: 'Choose an action', options: g.legalActions(0).map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
}

/**
 * Player 0's main phase with 4 Eddies, one ready face-down Legend and a cost-4 Unit in hand. `chooses`: the seat
 * answers 'pay' decisions (as the Play board's human seat does), from `plan.sel` when set.
 */
function scene(chooses: boolean) {
  const plan: { sel: PaySelection | null } = { sel: null };
  const hook: Hook = (d) => {
    if (d.kind !== 'pay' || !plan.sel) return undefined;
    const r = planAnswer(d, plan.sel);
    if (!r) return undefined;
    plan.sel = r.rest;
    return r.i;
  };
  const { g, agents } = setup([hook, null]);
  if (chooses) Object.assign(agents[0], { choosesPayment: true });
  eddies(g, 0, 4);
  const legend = g.c(g.P(0).legends[0]!);
  legend.spent = false;
  const card = spawn(g, 0, FILLER, 'hand');
  return { g, agent: agents[0], plan, legend, card };
}

describe('the cost of an option', () => {
  it('plays, Calls and Go Solo cost what the engine will ask; selling, attacking and passing cost nothing', () => {
    const { g, card } = scene(false);
    const d = actionDecision(g);
    const playI = d.options.findIndex((o) => o.action?.type === 'play' && o.action.uid === card.uid);
    expect(costOfAnswer(g, d, playI)).toEqual({ amount: 4, what: 'Play Psycho Squad', exclude: [], order: {} });
    const sellI = d.options.findIndex((o) => o.action?.type === 'sell');
    const passI = d.options.findIndex((o) => o.action?.type === 'pass');
    expect(costOfAnswer(g, d, sellI)).toBeNull();
    expect(costOfAnswer(g, d, passI)).toBeNull();
    const callI = d.options.findIndex((o) => o.action?.type === 'call');
    expect(callI).toBeGreaterThanOrEqual(0);
    expect(costOfAnswer(g, d, callI)?.amount).toBe(1);
    expect(optionCost(g, 0, undefined)).toBeNull();
    // only main-phase and reaction decisions are held back
    expect(costOfAnswer(g, { ...d, kind: 'card' }, playI)).toBeNull();
  });

  it("Go Solo: the Legend may pay for itself and automatic payment spends it first (the engine's own order)", () => {
    const { g } = setup();
    for (const u of [...g.P(0).legends]) g.move(u, 'removed');
    const v = spawn(g, 0, 'v_corporate_exile', 'legends');
    eddies(g, 0, 5);
    const d = actionDecision(g);
    const i = d.options.findIndex((o) => o.action?.type === 'goSolo');
    const cost = costOfAnswer(g, d, i)!;
    expect(cost.order).toEqual({ first: [v.uid] });
    const sources = paySources(g, 0, cost);
    expect(sources[0]).toMatchObject({ uid: v.uid, kind: 'legend' });
    expect(automaticSelection(sources, cost.amount)).toEqual({ eddies: 4, legends: [v.uid] });
  });
});

describe('selecting sources', () => {
  it('lists ready Eddies first, then Legends that could pay, by name or slot', () => {
    const { g, legend } = scene(false);
    const sources = paySources(g, 0);
    expect(sources.map((s) => s.kind)).toEqual(['eddie', 'eddie', 'eddie', 'eddie', 'legend']);
    expect(sources[4]).toEqual({ uid: legend.uid, kind: 'legend', label: 'Face-down Legend (slot 1)' });
    expect(readyEddies(sources)).toBe(4);
  });

  it('Eddies are a count (your first ready ones): tapping selects up to it, tapping a selected one keeps those before it', () => {
    let sel = EMPTY_SELECTION;
    sel = tapEddie(sel, 2, 4);
    expect(sel.eddies).toBe(3);
    sel = tapEddie(sel, 0, 4);
    expect(sel.eddies).toBe(0);
    sel = tapEddie(sel, 9, 4); // not a ready Eddie
    expect(sel.eddies).toBe(0);
    sel = addEddie(addEddie(sel, 2), 2);
    expect(sel.eddies).toBe(2);
    expect(addEddie(sel, 2).eddies).toBe(0); // all selected: the pile tap starts over
    expect(toggleLegend(toggleLegend(sel, 7), 7)).toEqual({ eddies: 2, legends: [] });
  });

  it('"Selected 2 of 3", and the selection kept to what can still pay', () => {
    expect(payStatus({ eddies: 2, legends: [] }, 3)).toEqual({ selected: 2, need: 3, exact: false, text: 'Selected 2 of 3: select 1 more' });
    expect(payStatus({ eddies: 2, legends: [5] }, 3).exact).toBe(true);
    expect(payStatus({ eddies: 4, legends: [] }, 3).text).toBe('Selected 4 of 3: remove 1');
    const { g, legend } = scene(false);
    const sel = { eddies: 6, legends: [legend.uid, 999] };
    expect(clampSelection(sel, paySources(g, 0))).toEqual({ eddies: 4, legends: [legend.uid] });
    legend.spent = true;
    expect(clampSelection(sel, paySources(g, 0))).toEqual({ eddies: 4, legends: [] });
    const ok = { eddies: 1, legends: [] };
    expect(clampSelection(ok, paySources(g, 0))).toBe(ok); // unchanged: the same object
  });
});

describe('paying with a confirmed selection (planAnswer)', () => {
  it('the selection Automatic would make leaves the game byte-identical to automatic payment', async () => {
    const auto = scene(false);
    await auto.g.playFromHand(0, auto.card.uid);
    const chosen = scene(true);
    const d = actionDecision(chosen.g);
    const i = d.options.findIndex((o) => o.action?.type === 'play' && o.action.uid === chosen.card.uid);
    const cost = costOfAnswer(chosen.g, d, i)!;
    chosen.plan.sel = automaticSelection(paySources(chosen.g, 0, cost), cost.amount);
    await chosen.g.playFromHand(0, chosen.card.uid);
    expect(chosen.agent.log.filter((x) => x.kind === 'pay').length).toBeGreaterThan(0); // a Legend was on offer: it asked
    expect(JSON.stringify(chosen.g.s)).toBe(JSON.stringify(auto.g.s));
  });

  it('a selected Legend is spent and exactly the rest in Eddies (your first ready ones)', async () => {
    const { g, plan, legend, card } = scene(true);
    plan.sel = { eddies: 3, legends: [legend.uid] };
    await g.playFromHand(0, card.uid);
    expect(card.zone).toBe('field');
    expect(legend.spent).toBe(true);
    expect(g.P(0).eddies.map((u) => g.c(u).spent)).toEqual([true, true, true, false]);
    // the Legend was the one real choice; with only Eddies left the engine spent them itself without asking
    expect(plan.sel).toEqual({ eddies: 3, legends: [] });
  });

  it('nothing to give for this decision, or not a payment decision: null (the player is asked as usual)', () => {
    const d: Decision = {
      player: 0,
      kind: 'pay',
      prompt: 'pay',
      min: 1,
      max: 1,
      options: [
        { label: 'an Eddie (2 ready)', uid: 1, key: 'eddie' },
        { label: 'Legend', uid: 2, key: 'legend' },
      ],
    };
    expect(planAnswer(d, { eddies: 0, legends: [] })).toBeNull();
    expect(planAnswer(d, { eddies: 0, legends: [3] })).toBeNull();
    expect(planAnswer(d, { eddies: 1, legends: [2] })).toEqual({ i: 1, rest: { eddies: 1, legends: [] } });
    expect(planAnswer(d, { eddies: 1, legends: [] })).toEqual({ i: 0, rest: { eddies: 0, legends: [] } });
    expect(planAnswer({ ...d, kind: 'card' }, { eddies: 1, legends: [] })).toBeNull();
  });
});

describe('Automatic payment never asks (UX-9)', () => {
  it("the seat is asked per €$ while a Legend could pay; Automatic answers each with option 0, which leaves the game exactly as the engine's automatic payment", async () => {
    const auto = scene(false);
    await auto.g.playFromHand(0, auto.card.uid);
    // the board's human seat chooses payments; in Automatic the board answers every 'pay' question itself
    const asked: Decision[] = [];
    const { g, agents } = setup([(d) => (d.kind === 'pay' ? (asked.push(d), autoPayAnswer(d, 'auto') ?? undefined) : undefined), null]);
    Object.assign(agents[0], { choosesPayment: true });
    eddies(g, 0, 4);
    g.c(g.P(0).legends[0]!).spent = false;
    const card = spawn(g, 0, FILLER, 'hand');
    await g.playFromHand(0, card.uid);
    expect(asked.length).toBeGreaterThan(0); // the engine did ask (a Legend was on offer) ...
    expect(asked.every((d) => d.options[0]?.key === 'eddie')).toBe(true); // ... and option 0 is the automatic pick
    expect(JSON.stringify(g.s)).toBe(JSON.stringify(auto.g.s));
  });

  it('only Automatic answers, and only payment questions', () => {
    const d: Decision = { player: 0, kind: 'pay', prompt: 'pay', min: 1, max: 1, options: [{ label: 'an Eddie (2 ready)', uid: 1, key: 'eddie' }, { label: 'Legend', uid: 2, key: 'legend' }] };
    expect(autoPayAnswer(d, 'auto')).toBe(0);
    expect(autoPayAnswer(d, 'before')).toBeNull();
    expect(autoPayAnswer(d, 'after')).toBeNull();
    expect(autoPayAnswer({ ...d, kind: 'card' }, 'auto')).toBeNull();
    expect(autoPayAnswer(null, 'auto')).toBeNull();
  });
});
