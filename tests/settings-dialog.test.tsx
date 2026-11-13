// The Play board's settings dialog and the payment prompt: named, focusable dialogs (the focus wiring itself is
// useFocusTrap, tests/modal.test.tsx) with labelled controls showing the current settings, and the side panel's
// display options applied to the log. Server-rendered: there is no DOM here.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  ACCENTS,
  applyPatch,
  BOARD_BACKGROUNDS,
  CARD_BACKS,
  defaultBoardSettings,
  END_TURN_MODES,
  FRAMES,
  GIG_BACKGROUNDS,
  GLOWS,
  LOOK_PRESETS,
  MOTIONS,
  NUMERALS,
  PAY_MODES,
  type BoardSettingsPatch,
} from '../src/lib/boardSettings';
import { END_TURN_NOTE, LookPreview, SettingsDialog, PAY_NOTE } from '../src/ui/components/board/SettingsDialog';
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
    for (const legend of ['Paying costs', 'End of turn', 'Side panel (game log and coach)', 'Bot', 'Presets', 'Colours', 'Board background', 'Gig area background', 'Card backs', 'Effects'])
      expect(html).toContain(`<legend>${legend}</legend>`);
    // two groups, Game first, then Look with its live preview
    expect(html.indexOf('>Game</h4>')).toBeGreaterThan(0);
    expect(html.indexOf('>Game</h4>')).toBeLessThan(html.indexOf('>Look</h4>'));
    expect(html.indexOf('>Look</h4>')).toBeLessThan(html.indexOf('pb-set-preview'));
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
    const s = applyPatch(defaultBoardSettings(), {
      payMode: 'after',
      endTurn: 'auto',
      accent: 'cb',
      boardBg: 'neon',
      gigBg: 'stripes',
      cardBack: 'scan',
      glow: 'strong',
      frame: 'plain',
      numerals: 'standard',
      motion: 'reduced',
    });
    const html = render(s);
    const radios = html.match(/<input type="radio"[^>]*>/g) ?? [];
    const presets = LOOK_PRESETS.length + 1; // and Custom
    const look = ACCENTS.length + BOARD_BACKGROUNDS.length + GIG_BACKGROUNDS.length + CARD_BACKS.length + GLOWS.length + FRAMES.length + NUMERALS.length + MOTIONS.length;
    expect(radios.length).toBe(PAY_MODES.length + END_TURN_MODES.length + presets + look);
    const checked = radios.filter((r) => r.includes('checked=""')).map((r) => r.match(/value="([^"]+)"/)?.[1]);
    // no preset has this mix, so the checked "preset" is Custom
    expect(checked).toEqual(['after', 'auto', 'custom', 'cb', 'neon', 'stripes', 'scan', 'strong', 'plain', 'standard', 'reduced']);
    expect((html.match(/<label class="pb-set-choice"><input type="radio"/g) ?? []).length).toBe(radios.length);
    // previews carry the attribute their CSS keys on
    expect(html).toContain('data-accent="cb"');
    expect(html).toContain('data-board-bg="circuit"');
    expect(html).toContain('data-gig-bg="dots"');
    expect(html).toContain('data-card-back="hex"');
  });

  it('presets: the matching one is checked and Custom is then unavailable; each thumbnail carries its look', () => {
    for (const p of LOOK_PRESETS) {
      const html = render(applyPatch(defaultBoardSettings(), p.look));
      const radios = html.match(/<input type="radio" name="[^"]*-preset"[^>]*>/g) ?? [];
      expect(radios.length).toBe(LOOK_PRESETS.length + 1);
      const on = radios.filter((r) => r.includes('checked=""')).map((r) => r.match(/value="([^"]+)"/)?.[1]);
      expect(on, p.id).toEqual([p.id]);
      expect(radios.find((r) => r.includes('value="custom"'))).toContain('disabled=""');
      expect(html).toContain(`data-accent="${p.look.accent}" data-board-bg="${p.look.boardBg}" data-card-back="${p.look.cardBack}"`);
    }
    // the defaults are the Signal preset
    const signal = (render().match(/<input type="radio" name="[^"]*-preset"[^>]*>/g) ?? []).find((r) => r.includes('value="signal"'));
    expect(signal).toContain('checked=""');
  });

  it('the live preview shows the current backgrounds, an active side with its light, marks and dice, hidden from screen readers', () => {
    const html = renderToStaticMarkup(<LookPreview settings={applyPatch(defaultBoardSettings(), { boardBg: 'rain', gigBg: 'hex' })} />);
    expect(html).toMatch(/^<div class="pb pb-set-preview" data-board-bg="rain" data-gig-bg="hex" aria-hidden="true">/);
    for (const part of ['class="pb-fx"', 'pb-side pb-me pb-active', 'pb-side-light', 'pb-st-play', 'pb-st-attack', 'die-me', 'tcg-back']) expect(html).toContain(part);
  });

  it('every option can be changed: each radio sends its own value', () => {
    const patches: BoardSettingsPatch[] = [];
    // call the dialog as a function inside a render, so its hooks run, and keep the element tree it returns
    let el: unknown = null;
    function Probe() {
      el = SettingsDialog({ settings: defaultBoardSettings(), onChange: (p) => patches.push(p), onReset: noop, speed: 1200, setSpeed: noop, onClose: noop });
      return null;
    }
    renderToStaticMarkup(<Probe />);
    // walk the element tree for the Choice elements (their onPick is what the radio's onChange calls)
    const picks: { value: string; onPick: () => void }[] = [];
    const walk = (n: unknown): void => {
      if (!n || typeof n !== 'object') return;
      if (Array.isArray(n)) return n.forEach(walk);
      const props = (n as { props?: Record<string, unknown> }).props ?? {};
      if (typeof props.onPick === 'function' && typeof props.value === 'string') picks.push(props as never);
      walk(props.children);
    };
    walk(el);
    for (const p of picks) if (p.value !== 'custom') p.onPick();
    const keys = new Set(patches.flatMap((p) => Object.keys(p)));
    for (const k of ['payMode', 'endTurn', 'accent', 'boardBg', 'gigBg', 'cardBack', 'glow', 'frame', 'numerals', 'motion']) expect(keys, k).toContain(k);
    expect(patches).toContainEqual({ motion: 'off' });
    expect(patches).toContainEqual({ glow: 'strong' });
    expect(patches).toContainEqual({ frame: 'plain' });
    expect(patches).toContainEqual({ ...LOOK_PRESETS.find((p) => p.id === 'neon-rain')!.look });
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
