// The Play board's settings dialog and the payment prompt: named, focusable dialogs (the focus wiring itself is
// useFocusTrap, tests/modal.test.tsx) with labelled controls showing the current settings, and the side panel's
// display options applied to the log. Server-rendered: there is no DOM here.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ACCENTS, applyPatch, BOARD_BACKGROUNDS, defaultBoardSettings, END_TURN_MODES, GIG_BACKGROUNDS, PAY_MODES } from '../src/lib/boardSettings';
import { END_TURN_NOTE, SettingsDialog, PAY_NOTE } from '../src/ui/components/board/SettingsDialog';
import { INTERCHANGEABLE_NOTE, PayPrompt, PaySelector } from '../src/ui/components/board/PayParts';
import { GameMenu } from '../src/ui/components/board/PhoneParts';
import { LogDrawer, visibleLines } from '../src/ui/components/board/LogDrawer';
import type { PaySource } from '../src/lib/eddiePayment';
import { setup } from './engine-helpers';

const noop = () => undefined;
const dialog = (html: string) => {
  expect(html).toMatch(/role="dialog"/);
  expect(html).toMatch(/aria-modal="true"/);
  expect(html).toMatch(/tabindex="-1"/);
  const id = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  expect(id).toBeTruthy();
  return id!;
};

describe('settings dialog', () => {
  const render = (s = defaultBoardSettings(), panels = false) =>
    renderToStaticMarkup(
      <SettingsDialog
        settings={s}
        onChange={noop}
        onReset={noop}
        speed={1200}
        setSpeed={noop}
        panels={panels ? { logOpen: true, setLogOpen: noop, allOpen: false, setAllOpen: noop } : undefined}
        onClose={noop}
      />,
    );

  it('is a dialog named "Settings" with a group per topic, Reset to defaults and Done', () => {
    const html = render();
    const id = dialog(html);
    expect(html).toMatch(new RegExp(`id="${id.replace(/:/g, '\\:')}"[^>]*>Settings<`));
    for (const legend of ['Paying costs', 'End of turn', 'Side panel (game log and coach)', 'Colours', 'Board background', 'Gig area background', 'Bot']) expect(html).toContain(`<legend>${legend}</legend>`);
    expect(html).toContain('Reset to defaults');
    expect(html).toContain('>Done<');
    // the honest line about Eddies
    expect(html).toContain(PAY_NOTE.replace(/'/g, '&#x27;'));
    // End turn: the default is to click it, and a change applies to the next game
    expect(html).toContain('Click End turn');
    expect(html).toContain('End automatically when nothing is left to do');
    expect(html).toContain(END_TURN_NOTE);
  });

  it('one radio per choice, the current one checked, every radio inside its label', () => {
    const s = applyPatch(defaultBoardSettings(), { payMode: 'after', endTurn: 'auto', accent: 'cb', boardBg: 'neon', gigBg: 'stripes' });
    const html = render(s);
    const radios = html.match(/<input type="radio"[^>]*>/g) ?? [];
    expect(radios.length).toBe(PAY_MODES.length + END_TURN_MODES.length + ACCENTS.length + BOARD_BACKGROUNDS.length + GIG_BACKGROUNDS.length);
    const checked = radios.filter((r) => r.includes('checked=""')).map((r) => r.match(/value="([^"]+)"/)?.[1]);
    expect(checked).toEqual(['after', 'auto', 'cb', 'neon', 'stripes']);
    expect((html.match(/<label class="pb-set-choice"><input type="radio"/g) ?? []).length).toBe(radios.length);
    // previews carry the attribute their CSS keys on
    expect(html).toContain('data-accent="cb"');
    expect(html).toContain('data-board-bg="circuit"');
    expect(html).toContain('data-gig-bg="dots"');
  });

  it('every select has a label pointing at it, showing the current value', () => {
    const s = applyPatch(defaultBoardSettings(), { panel: { position: 'bottom', textSize: 'large', order: 'newest-first', density: 'compact' } });
    const html = render(s);
    const ids = [...html.matchAll(/<select id="([^"]+)"/g)].map((m) => m[1]!);
    expect(ids.length).toBe(5); // position, lines, text size, newest line, bot speed
    for (const id of ids) expect(html).toContain(`for="${id}"`);
    for (const v of ['bottom', 'compact', 'large', 'newest-first', '1200']) expect(html).toMatch(new RegExp(`<option value="${v}" selected=""`));
  });

  it('during a game it also shows the panels kept open for the session', () => {
    expect(render()).not.toContain('Game log open now');
    const html = render(defaultBoardSettings(), true);
    expect(html).toContain('Game log open now');
    expect(html).toContain('All actions');
  });

  it('the phone ☰ menu has a Settings item when the board offers it', () => {
    const html = renderToStaticMarkup(<GameMenu speed={1200} setSpeed={noop} sortLabel="cost" onSort={noop} onSite={noop} onExit={noop} exitLabel="Exit game" onSettings={noop} onClose={noop} />);
    expect(html).toMatch(/role="menuitem"[^>]*>⚙ Settings…/);
  });
});

describe('payment prompt', () => {
  const sources: PaySource[] = [
    { uid: 1, kind: 'eddie', label: 'Eddie' },
    { uid: 2, kind: 'eddie', label: 'Eddie' },
    { uid: 3, kind: 'eddie', label: 'Eddie' },
    { uid: 9, kind: 'legend', label: 'Face-down Legend (slot 1)' },
  ];

  it('a named dialog with "Selected 2 of 3", Confirm off until it pays exactly, and Cancel', () => {
    const html = renderToStaticMarkup(<PayPrompt title="Pay 3 €$ for Play Psycho Squad" amount={3} sources={sources} sel={{ eddies: 2, legends: [] }} onChange={noop} onConfirm={noop} onCancel={noop} />);
    dialog(html);
    expect(html).toContain('Pay 3 €$ for Play Psycho Squad');
    expect(html).toContain('Selected 2 of 3: select 1 more');
    expect(html).toMatch(/<button type="button" class="primary pb-big" disabled="">Confirm<\/button>/);
    expect(html).toContain('>Cancel<');
    expect(html).not.toContain(INTERCHANGEABLE_NOTE); // a Legend is on offer: the choice can matter
    const ok = renderToStaticMarkup(<PayPrompt title="t" amount={3} sources={sources} sel={{ eddies: 2, legends: [9] }} onChange={noop} onConfirm={noop} onCancel={noop} />);
    expect(ok).toMatch(/<button type="button" class="primary pb-big">Confirm<\/button>/);
  });

  it('with only Eddies it says they are interchangeable', () => {
    const html = renderToStaticMarkup(<PayPrompt title="t" amount={1} sources={sources.slice(0, 3)} sel={{ eddies: 1, legends: [] }} onChange={noop} onConfirm={noop} onCancel={noop} />);
    expect(html).toContain(INTERCHANGEABLE_NOTE);
  });

  it('the "Pay with" row: one toggle per ready Eddie (your first ones pressed) and per Legend', () => {
    const html = renderToStaticMarkup(<PaySelector sources={sources} sel={{ eddies: 2, legends: [9] }} onChange={noop} />);
    expect(html).toMatch(/role="group" aria-label="Pay with"/);
    const pressed = [...html.matchAll(/aria-pressed="(true|false)"/g)].map((m) => m[1]);
    expect(pressed).toEqual(['true', 'true', 'false', 'true']);
    expect(html).toContain('3 selected');
  });
});

describe('side panel display', () => {
  it('order, turn markers and density reach the log; Hidden draws nothing', () => {
    const { g } = setup();
    g.log(0, '--- Turn 3 (A) ---');
    g.log(0, 'plays Psycho Squad');
    g.log(1, 'sells a card');
    const log = g.s.log;
    const view = { density: 'detailed' as const, order: 'newest-first' as const, turnMarkers: false };
    const lines = visibleLines(log, view).map((l) => l.text);
    expect(lines[0]).toBe('sells a card');
    expect(lines).not.toContain('--- Turn 3 (A) ---');
    const s = defaultBoardSettings();
    const html = renderToStaticMarkup(<LogDrawer log={log} n={log.length} open sheet={false} onClose={noop} panel={{ ...s.panel, position: 'left', textSize: 'large' }} />);
    expect(html).toMatch(/class="pb-drawer pb-panel-left pb-panel-detailed pb-panel-text-large"/);
    expect(html).toContain('<span class="pb-log-turn">T3</span>');
    expect(renderToStaticMarkup(<LogDrawer log={log} n={log.length} open sheet={false} onClose={noop} panel={{ ...s.panel, position: 'hidden' }} />)).toBe('');
  });
});
