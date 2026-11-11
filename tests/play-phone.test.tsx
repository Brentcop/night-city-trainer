// Play board on phones (P1b): which layout a screen gets, the phone board's size budget, which prompt options are
// picked on the board and which show in the small right-edge panel, and the panel's open/tab/collapsed state.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import type { Decision } from '../src/engine/types';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import { buildInteraction, promptChoices } from '../src/ui/components/board/interaction';
import { compactFor, layoutMode, PHONE_FIXED, phoneLayout, phoneVars } from '../src/ui/components/board/layout';
import { PhonePanel, phonePanelState } from '../src/ui/components/board/PhoneParts';
import { fillerDeck, Scripted } from './engine-helpers';

const PHONES: [number, number][] = [
  [375, 812],
  [360, 640],
  [414, 896],
  [812, 375],
];

describe('layout mode (the single switch)', () => {
  it('phones get the phone board, portrait or landscape; desktops and portrait tablets the full board', () => {
    expect(layoutMode(375, 812, true)).toBe('phone');
    expect(layoutMode(360, 640, true)).toBe('phone');
    expect(layoutMode(414, 896, true)).toBe('phone');
    expect(layoutMode(812, 375, true)).toBe('phone-land');
    expect(layoutMode(932, 430, true)).toBe('phone-land');
    // short screens count without a touch pointer up to 1100px wide, at any width with one
    expect(layoutMode(1100, 500, false)).toBe('phone-land');
    expect(layoutMode(1300, 500, false)).toBe('full');
    expect(layoutMode(1300, 500, true)).toBe('phone-land');
    // a portrait tablet is not compact: the full board's two-rows-per-side variant
    expect(layoutMode(768, 1024, true)).toBe('full');
    for (const [w, h] of [
      [1280, 800],
      [1440, 900],
      [1920, 1080],
    ])
      expect(layoutMode(w, h, false)).toBe('full');
    expect(compactFor(720, 900, false)).toBe(true);
    expect(compactFor(721, 900, false)).toBe(false);
  });
});

describe('phone size budget', () => {
  for (const [w, h] of PHONES) {
    it(`${w}×${h}: everything fits the screen with room to spare, and the cards fit the width`, () => {
      const L = phoneLayout(w, h);
      expect(L.mode).toBe(w > h ? 'phone-land' : 'phone');
      expect(L.used + PHONE_FIXED.margin).toBeLessThanOrEqual(h);
      expect(L.spare).toBeGreaterThanOrEqual(PHONE_FIXED.margin);
      const c = L.cards;
      expect(c.field).toBeGreaterThanOrEqual(60);
      // the rival's side is compressed more than yours
      expect(c.rivalField).toBeLessThan(c.field);
      expect(c.rivalLegend).toBeLessThan(c.legend);
      expect(c.rivalDie).toBeLessThan(c.die);
      if (L.mode === 'phone') {
        // at least 3.5 field cards across, and seven hand cards each show 38px+ (≈ a 40px tap strip)
        expect(c.field * 3.5 + PHONE_FIXED.pad + PHONE_FIXED.fieldRow + 12).toBeLessThanOrEqual(w + 0.5);
        expect((w - PHONE_FIXED.pad - c.hand) / 6).toBeGreaterThanOrEqual(36);
        // the rows add up to what is used
        expect(Object.values(L.rows).reduce((a, b) => a + b, 0) + PHONE_FIXED.strip + PHONE_FIXED.pad + 5 * PHONE_FIXED.gap).toBeCloseTo(L.used, 0);
      } else {
        expect(L.handCol).toBeGreaterThan(c.hand);
        // seven hand cards stacked down the column each show at least ~24px
        expect((h - PHONE_FIXED.strip - PHONE_FIXED.pad - c.hand * (88 / 63)) / 6).toBeGreaterThanOrEqual(24);
      }
    });
  }

  it('the prompt panel is at most a third of the old prompt dock, and leaves the centre free', () => {
    for (const [w, h] of PHONES) {
      const L = phoneLayout(w, h);
      // the old dock: full width, up to 45% of the height in portrait and 60% in landscape
      const before = w * h * (w > h ? 0.6 : 0.45);
      expect(L.panel.w * L.panel.maxH).toBeLessThanOrEqual(before / 3);
      expect(L.panel.w).toBeLessThanOrEqual(w * 0.5); // never reaches the middle of the screen
    }
  });

  it('turns into CSS variables', () => {
    const v = phoneVars(phoneLayout(375, 812));
    expect(v['--pf']).toMatch(/^\d+(\.\d)?px$/);
    expect(v['--pb-strip-h']).toBe('44px');
    expect(v['--pb-side-right']).toBe('0px');
    expect(phoneVars(phoneLayout(812, 375))['--pb-side-right']).not.toBe('0px');
  });
});

function scene() {
  const g = Game.create([fillerDeck('A'), fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 1, first: 0 });
  const noop = () => undefined;
  const ctx = (pend: Decision): BoardCtx => ({ g, pend, ix: buildInteraction(g, pend), coach: null, targeting: null, narrow: true, menuUid: null, answer: noop, openMenu: noop, startTargeting: noop, cancelTargeting: noop, openTrash: noop, inspect: noop });
  return { g, ctx };
}

describe('prompt options: on the board or in the panel', () => {
  it('cards on the table are picked on the board, other cards and plain options go in the panel', () => {
    const { g } = scene();
    const hand = g.P(0).hand.slice(0, 2);
    const deck = g.P(0).deck.slice(0, 2);
    const d: Decision = {
      player: 0,
      kind: 'card',
      prompt: 'Choose',
      min: 1,
      max: 1,
      options: [...hand.map((uid) => ({ label: 'h', uid })), ...deck.map((uid) => ({ label: 'd', uid })), { label: 'Skip', key: 'none' }],
    };
    const ch = promptChoices(g, buildInteraction(g, d));
    expect(ch.board).toEqual([0, 1]);
    expect(ch.tray.map((t) => t.i)).toEqual([2, 3]);
    expect(ch.buttons).toEqual([4]);
  });

  it('a Gig roll is buttons in the panel; a hand-card choice is only the instruction', () => {
    const { g, ctx } = scene();
    const roll: Decision = { player: 0, kind: 'gig', prompt: 'Roll in a Gig from your fixer area', tag: 'rollIn', min: 1, max: 1, options: g.P(0).fixer.slice(0, 4).map((id) => ({ label: `d${g.gig(id).sides}`, gig: id })) };
    const noop = () => undefined;
    const html = renderToStaticMarkup(<PhonePanel ctx={ctx(roll)} state="open" onCollapse={noop} onExpand={noop} onPeek={noop} allActions={null} />);
    expect(html).toContain('pb-pp-btns');
    for (const o of roll.options) expect(html).toContain(`>${o.label}</button>`);
    const discard: Decision = { player: 0, kind: 'card', prompt: 'Discard a card', tag: 'discard', min: 1, max: 1, options: g.P(0).hand.map((uid) => ({ label: g.name(uid), uid })) };
    const h2 = renderToStaticMarkup(<PhonePanel ctx={ctx(discard)} state="open" onCollapse={noop} onExpand={noop} onPeek={noop} allActions={null} />);
    expect(h2).toContain('Discard a card');
    expect(h2).toContain('Tap a ◎ card on the board');
    expect(h2).not.toContain('pb-tray-item');
    expect(h2).not.toContain('pb-pp-btns');
    // collapsed: just the tab, which names the prompt and reopens it
    const tab = renderToStaticMarkup(<PhonePanel ctx={ctx(discard)} state="tab" onCollapse={noop} onExpand={noop} onPeek={noop} allActions={null} />);
    expect(tab).toContain('pb-pp-tab');
    expect(tab).toContain('Show the prompt: Discard a card');
    expect(tab).not.toContain('pb-pp-head');
    expect(renderToStaticMarkup(<PhonePanel ctx={ctx(discard)} state="none" onCollapse={noop} onExpand={noop} onPeek={noop} allActions={null} />)).toBe('');
  });
});

describe('phone prompt panel state', () => {
  const d = (kind: Decision['kind'], tag?: string): Decision => ({ player: 0, kind, prompt: 'p', tag, min: 1, max: 1, options: [{ label: 'a' }, { label: 'b' }] });
  const base = { targeting: null, over: false, allOpen: false, collapsed: false };
  it('nothing to decide, the mulligan and a finished game show no panel', () => {
    expect(phonePanelState({ ...base, pend: null })).toBe('none');
    expect(phonePanelState({ ...base, pend: d('yesno', 'mulligan') })).toBe('none');
    expect(phonePanelState({ ...base, pend: d('card'), over: true })).toBe('none');
  });
  it('a prompt opens it, and collapsing makes it a tab', () => {
    for (const k of ['card', 'gig', 'yesno', 'reaction', 'pay'] as const) {
      expect(phonePanelState({ ...base, pend: d(k) })).toBe('open');
      expect(phonePanelState({ ...base, pend: d(k), collapsed: true })).toBe('tab');
    }
  });
  it('in your main phase it carries All actions: open while that list is open, a tab otherwise', () => {
    expect(phonePanelState({ ...base, pend: d('action') })).toBe('tab');
    expect(phonePanelState({ ...base, pend: d('action'), allOpen: true })).toBe('open');
    expect(phonePanelState({ ...base, pend: d('action'), allOpen: true, collapsed: true })).toBe('tab');
    // choosing an attack target is a prompt
    expect(phonePanelState({ ...base, pend: d('action'), targeting: { attacker: 1, targets: [] } })).toBe('open');
  });
});
