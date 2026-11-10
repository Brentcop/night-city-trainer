// PLAY-8: on a phone the prompt dock covers the hand, so a choice of hand cards (e.g. a discard) is offered in the
// dock's tray; on a wide screen the glowing hand cards themselves are the choice.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { buildInteraction } from '../src/ui/components/board/interaction';
import { PromptPanel } from '../src/ui/components/board/PromptPanel';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import type { Decision } from '../src/engine/types';
import { fillerDeck, Scripted } from './engine-helpers';

function ctxFor(narrow: boolean): BoardCtx {
  const g = Game.create([fillerDeck('A'), fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 1, first: 0 });
  const hand = g.P(0).hand;
  const pend: Decision = { player: 0, kind: 'card', prompt: 'Discard a card', tag: 'discard', min: 1, max: 1, options: hand.map((uid) => ({ label: g.name(uid), uid })) };
  const noop = () => undefined;
  return { g, pend, ix: buildInteraction(g, pend), coach: null, targeting: null, narrow, menuUid: null, answer: noop, openMenu: noop, startTargeting: noop, cancelTargeting: noop, openTrash: noop };
}

const trayItems = (html: string) => html.split('pb-tray-item').length - 1;

describe('prompt tray', () => {
  it('lists hand choices in the tray on the compact layout', () => {
    const ctx = ctxFor(true);
    const html = renderToStaticMarkup(<PromptPanel ctx={ctx} />);
    expect(trayItems(html)).toBe(ctx.g.P(0).hand.length);
    expect(html).not.toContain('Click a glowing card on the table');
  });
  it('leaves hand choices on the table on a wide screen', () => {
    const html = renderToStaticMarkup(<PromptPanel ctx={ctxFor(false)} />);
    expect(trayItems(html)).toBe(0);
    expect(html).toContain('Click a glowing card on the table');
  });
});
