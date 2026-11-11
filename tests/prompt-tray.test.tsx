// Cards that are on the table (including your hand) are picked on the board, where they are marked, on every layout:
// the prompt never repeats them. Since P1b the phone's hand is always visible, so hand choices stay on the board there
// too (PLAY-8's tray for hand cards is gone). Cards that aren't on the table still show in the prompt's tray.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Game } from '../src/engine/engine';
import { buildInteraction } from '../src/ui/components/board/interaction';
import { PromptPanel } from '../src/ui/components/board/PromptPanel';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import type { Decision } from '../src/engine/types';
import { fillerDeck, Scripted } from './engine-helpers';

function ctxFor(narrow: boolean, from: 'hand' | 'deck' = 'hand'): BoardCtx {
  const g = Game.create([fillerDeck('A'), fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 1, first: 0 });
  const uids = from === 'hand' ? g.P(0).hand : g.P(0).deck.slice(0, 3);
  const pend: Decision = { player: 0, kind: 'card', prompt: 'Choose a card', tag: 'pick', min: 1, max: 1, options: uids.map((uid) => ({ label: g.name(uid), uid })) };
  const noop = () => undefined;
  return { g, pend, ix: buildInteraction(g, pend), coach: null, targeting: null, narrow, menuUid: null, answer: noop, openMenu: noop, startTargeting: noop, cancelTargeting: noop, openTrash: noop };
}

const trayItems = (html: string) => html.split('pb-tray-item').length - 1;

describe('prompt tray', () => {
  for (const narrow of [false, true]) {
    it(`leaves hand choices on the table (${narrow ? 'phone' : 'wide'} layout)`, () => {
      const html = renderToStaticMarkup(<PromptPanel ctx={ctxFor(narrow)} />);
      expect(trayItems(html)).toBe(0);
      expect(html).toContain('Click a glowing card on the table');
    });
  }
  it('shows cards that are not on the table (here: from the deck) in the tray', () => {
    const html = renderToStaticMarkup(<PromptPanel ctx={ctxFor(false, 'deck')} />);
    expect(trayItems(html)).toBe(3);
    expect(html).not.toContain('Click a glowing card on the table');
  });
});
