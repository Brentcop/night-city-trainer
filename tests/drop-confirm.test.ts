// "Confirm before acting" (board setting confirmActions) on the drag-to-act path (src/ui/components/board/drag.tsx,
// planDrop): on (the default), every drop that acts asks first, exactly as before; off, a drop that can mean only one
// thing answers the decision at once with the option index the question's single button would have given, and a drop
// that could mean two or more things still asks which. Refusals and empty drops are the same either way.
import { describe, expect, it } from 'vitest';
import { planDrop, resolveDrop, type DropTarget } from '../src/ui/components/board/drag';
import { buildInteraction } from '../src/ui/components/board/interaction';
import type { Decision } from '../src/engine/types';
import { eddies, FILLER, setup, spawn } from './engine-helpers';

type G = ReturnType<typeof setup>['g'];
const actionDecision = (g: G): Decision => {
  const actions = g.legalActions(0);
  return { player: 0, kind: 'action', prompt: 'Choose an action', options: actions.map((a) => ({ label: g.describeAction(a), action: a })), min: 1, max: 1 };
};

/** A Unit in hand with its cost in Eddies (one way to play it), and a face-up V: Corporate Exile (two: Go Solo or play). */
function scene() {
  const s = setup();
  const { g } = s;
  for (const u of [...g.P(0).legends]) g.move(u, 'removed');
  const unit = spawn(g, 0, FILLER, 'hand');
  const v = spawn(g, 0, 'v_corporate_exile', 'legends');
  eddies(g, 0, 5);
  const d = actionDecision(g);
  return { g, d, ix: buildInteraction(g, d), unit, v };
}

describe('Confirm before acting: dropping a card', () => {
  it('on (the default): a one-way drop asks, with one button, as before', () => {
    const { g, ix, unit } = scene();
    const play: DropTarget = { kind: 'play' };
    const plan = planDrop(g, ix, unit.uid, play);
    expect(plan).toEqual(planDrop(g, ix, unit.uid, play, true));
    expect(plan.kind).toBe('ask');
    if (plan.kind !== 'ask') return;
    expect(plan.p.title).toBe(`Play ${g.name(unit.uid)}?`);
    expect(plan.p.choices).toEqual(resolveDrop(g, ix, unit.uid, play));
    expect(plan.p.choices.length).toBe(1);
  });

  it('off: a one-way drop answers at once, with the same option the prompt would have answered', () => {
    const { g, d, ix, unit } = scene();
    const asked = planDrop(g, ix, unit.uid, { kind: 'play' }, true);
    const done = planDrop(g, ix, unit.uid, { kind: 'play' }, false);
    expect(asked.kind).toBe('ask');
    expect(done.kind).toBe('act');
    if (asked.kind !== 'ask' || done.kind !== 'act') return;
    // the board passes this index to the same answerFor the prompt's button calls: the recorded answer is identical
    expect(done.i).toBe(asked.p.choices[0]!.i);
    const action = d.options[done.i]!.action as { type: string; uid: number };
    expect([action.type, action.uid]).toEqual(['play', unit.uid]);
  });

  it('off: a drop that could mean two things (Go Solo or play the Legend) still asks which', () => {
    const { g, ix, v } = scene();
    for (const confirm of [true, false]) {
      const plan = planDrop(g, ix, v.uid, { kind: 'play' }, confirm);
      expect(plan.kind).toBe('ask');
      if (plan.kind === 'ask') expect(plan.p.choices.map((c) => c.label)).toEqual(['Go Solo (5 €$)', 'Play to the field (5 €$, with Lag)']);
    }
  });

  it('refusals and empty drops are the same whatever the setting', () => {
    const { g, ix, unit } = scene();
    for (const confirm of [true, false]) {
      expect(planDrop(g, ix, unit.uid, null, confirm)).toEqual({ kind: 'none' });
      expect(planDrop(g, ix, unit.uid, { kind: 'gigs' }, confirm)).toEqual({ kind: 'refuse', message: `${g.name(unit.uid)} can't attack there right now.` });
    }
  });
});
