// PLAY-9: every Play board overlay is a named dialog (or menu) that can hold focus: role, aria-modal, a name, and
// tabIndex -1 so focus can rest on it when it opens. The focus wiring itself (useFocusTrap → attachModal) is tested in
// tests/modal.test.tsx; this checks each overlay is marked up to use it. Server-rendered: there is no DOM here.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Decision } from '../src/engine/types';
import type { BoardCtx } from '../src/ui/components/board/BoardCard';
import { GameOverOverlay, MulliganScreen, TrashModal } from '../src/ui/components/board/Overlays';
import { ConfirmPrompt } from '../src/ui/components/board/drag';
import { GameMenu } from '../src/ui/components/board/PhoneParts';
import { LogDrawer } from '../src/ui/components/board/LogDrawer';
import { FILLER, setup, spawn } from './engine-helpers';

const isModalDialog = (html: string) => {
  expect(html).toMatch(/role="dialog"/);
  expect(html).toMatch(/aria-modal="true"/);
  expect(html).toMatch(/tabindex="-1"/);
};
/** The dialog is named by an element that exists in it. */
const namedByHeading = (html: string, text: string) => {
  const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  expect(id).toBeTruthy();
  expect(html).toMatch(new RegExp(`id="${id!.replace(/[:]/g, '\\:')}"[^>]*>\\s*${text}`));
};

describe('board overlays are focusable, named dialogs', () => {
  it('trash viewer', () => {
    const { g } = setup();
    spawn(g, 0, FILLER, 'trash');
    const html = renderToStaticMarkup(<TrashModal g={g} p={0} onClose={() => undefined} />);
    isModalDialog(html);
    namedByHeading(html, 'Your trash');
  });

  it('opening-hand choice', () => {
    const { g } = setup();
    const pend: Decision = { player: 0, kind: 'yesno', tag: 'mulligan', prompt: 'Mulligan?', options: [{ label: 'Yes', key: 'yes' }, { label: 'No', key: 'no' }], min: 1, max: 1 };
    const ctx = { g, pend, coach: null, narrow: false, answer: () => undefined } as unknown as BoardCtx;
    const html = renderToStaticMarkup(<MulliganScreen ctx={ctx} />);
    isModalDialog(html);
    namedByHeading(html, 'Your opening hand');
  });

  it('result screen', () => {
    const { g } = setup();
    g.s.winner = 0;
    const html = renderToStaticMarkup(<GameOverOverlay g={g} onRematch={() => undefined} onNew={() => undefined} onHide={() => undefined} />);
    isModalDialog(html);
    namedByHeading(html, 'VICTORY');
  });

  it('drop confirmation', () => {
    const html = renderToStaticMarkup(<ConfirmPrompt p={{ uid: 1, title: 'Play Psycho Squad?', choices: [{ i: 0, label: 'Play' }] }} onPick={() => undefined} onCancel={() => undefined} />);
    isModalDialog(html);
    namedByHeading(html, 'Play Psycho Squad\\?');
  });

  it('phone game menu is a focusable menu of menu items', () => {
    const html = renderToStaticMarkup(
      <GameMenu speed={1200} setSpeed={() => undefined} sortLabel="cost" onSort={() => undefined} onSite={() => undefined} onExit={() => undefined} exitLabel="Exit game" onClose={() => undefined} />,
    );
    expect(html).toMatch(/role="menu"[^>]*aria-label="Game menu"[^>]*tabindex="-1"/);
    expect(html.match(/role="menuitem"/g)?.length).toBeGreaterThanOrEqual(3);
  });

  it('log drawer can hold focus (a labelled region)', () => {
    const { g } = setup();
    const html = renderToStaticMarkup(<LogDrawer log={g.s.log} n={g.s.log.length} open sheet={false} onClose={() => undefined} />);
    expect(html).toMatch(/<aside[^>]*aria-label="Game log"[^>]*tabindex="-1"/);
  });
});
