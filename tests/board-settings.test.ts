// Board settings (src/lib/boardSettings.ts): defaults, validation, migration and storage under one versioned key, and
// the accent colour sets in src/ui/themes.css checked for text contrast (WCAG AA) in both themes.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ACCENTS,
  applyPatch,
  BOARD_BACKGROUNDS,
  BOARD_SETTINGS_KEY,
  DEFAULT_BOARD_SETTINGS,
  defaultBoardSettings,
  GIG_BACKGROUNDS,
  loadBoardSettings,
  migrateBoardSettings,
  parseBoardSettings,
  saveBoardSettings,
} from '../src/lib/boardSettings';

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), m };
}

describe('board settings store', () => {
  it('defaults: automatic payment, the panel on the right as today, the yellow accent and the grid board', () => {
    expect(BOARD_SETTINGS_KEY).toBe('nct.boardSettings.v1');
    expect(defaultBoardSettings()).toEqual({
      v: 1,
      payMode: 'auto',
      panel: { position: 'right', density: 'detailed', textSize: 'medium', order: 'newest-last', turnMarkers: true, autoOpenRivalTurn: false },
      accent: 'yellow',
      boardBg: 'grid',
      gigBg: 'panel',
    });
    // a fresh copy each time: editing it never touches the defaults
    const d = defaultBoardSettings();
    d.panel.position = 'left';
    expect(DEFAULT_BOARD_SETTINGS.panel.position).toBe('right');
  });

  it('enough choices: six accents, six board and six Gig backgrounds, each with a plain option', () => {
    expect(ACCENTS.length).toBeGreaterThanOrEqual(5);
    expect(BOARD_BACKGROUNDS.length).toBeGreaterThanOrEqual(5);
    expect(GIG_BACKGROUNDS.length).toBeGreaterThanOrEqual(5);
    expect(BOARD_BACKGROUNDS).toContain('plain');
    expect(GIG_BACKGROUNDS).toContain('plain');
    expect(ACCENTS).toContain('cb');
  });

  it('parse validates field by field: junk falls back to the default, good fields are kept', () => {
    for (const junk of [null, undefined, 3, 'x', [], [1, 2]]) expect(parseBoardSettings(junk)).toEqual(defaultBoardSettings());
    const s = parseBoardSettings({ v: 1, payMode: 'after', accent: 'teal', boardBg: 'neon', gigBg: 7, panel: { position: 'left', textSize: 'huge', turnMarkers: 'yes', autoOpenRivalTurn: true } });
    expect(s.payMode).toBe('after');
    expect(s.accent).toBe('yellow');
    expect(s.boardBg).toBe('neon');
    expect(s.gigBg).toBe('panel');
    expect(s.panel).toEqual({ ...DEFAULT_BOARD_SETTINGS.panel, position: 'left', autoOpenRivalTurn: true });
  });

  it('migrate: no version reads as version 1; a newer version keeps the fields this one knows', () => {
    expect(migrateBoardSettings({ payMode: 'before' })).toEqual({ payMode: 'before', v: 1 });
    expect(parseBoardSettings({ payMode: 'before' }).payMode).toBe('before');
    const future = parseBoardSettings({ v: 9, payMode: 'after', somethingNew: true, panel: { position: 'bottom', chatTabs: 3 } });
    expect(future.v).toBe(1);
    expect(future.payMode).toBe('after');
    expect(future.panel.position).toBe('bottom');
    expect(future).not.toHaveProperty('somethingNew');
  });

  it('applyPatch changes panel fields one at a time and keeps the rest', () => {
    const s = applyPatch(defaultBoardSettings(), { panel: { order: 'newest-first' }, accent: 'cb' });
    expect(s.panel).toEqual({ ...DEFAULT_BOARD_SETTINGS.panel, order: 'newest-first' });
    expect(s.accent).toBe('cb');
    expect(applyPatch(s, { panel: { textSize: 'large' } }).panel.order).toBe('newest-first');
  });

  it('load and save round-trip through one key; bad JSON or blocked storage give the defaults', () => {
    const store = memStore();
    expect(loadBoardSettings(store)).toEqual(defaultBoardSettings());
    const s = applyPatch(defaultBoardSettings(), { payMode: 'before', gigBg: 'stripes', panel: { position: 'hidden' } });
    saveBoardSettings(s, store);
    expect([...store.m.keys()]).toEqual([BOARD_SETTINGS_KEY]);
    expect(loadBoardSettings(store)).toEqual(s);
    store.setItem(BOARD_SETTINGS_KEY, '{not json');
    expect(loadBoardSettings(store)).toEqual(defaultBoardSettings());
    expect(loadBoardSettings(null)).toEqual(defaultBoardSettings());
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(loadBoardSettings(blocked)).toEqual(defaultBoardSettings());
    expect(() => saveBoardSettings(s, blocked)).not.toThrow();
  });
});

// ---- contrast ----
const lum = (hex: string) => {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? [...h].map((c) => c + c).join('') : h;
  const ch = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
};
const contrast = (a: string, b: string) => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hexVars = (body: string) => Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g)].map((m) => [m[1]!, m[2]!]));

function baseTokens(): { light: Record<string, string>; dark: Record<string, string> } {
  const css = readFileSync(new URL('../src/ui/styles.css', import.meta.url), 'utf8');
  const light = css.match(/^:root \{([^}]*)\}/m)?.[1];
  const dark = css.match(/^:root\[data-theme='dark'\] \{([^}]*)\}/m)?.[1];
  expect(light && dark).toBeTruthy();
  return { light: hexVars(light!), dark: hexVars(dark!) };
}

/** Per accent, the tokens its rules set in each theme (themes.css). */
function accentTokens(): Map<string, { light: Record<string, string>; dark: Record<string, string> }> {
  const css = readFileSync(new URL('../src/ui/themes.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const out = new Map<string, { light: Record<string, string>; dark: Record<string, string> }>();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const sel = m[1]!;
    const accent = sel.match(/:root(?:\[data-theme='dark'\])?\[data-accent='(\w+)'\]/)?.[1];
    if (!accent) continue;
    const e = out.get(accent) ?? { light: {}, dark: {} };
    Object.assign(sel.includes("data-theme='dark'") ? e.dark : e.light, hexVars(m[2]!));
    out.set(accent, e);
  }
  return out;
}

describe('accent colour sets (themes.css)', () => {
  const base = baseTokens();
  const sets = accentTokens();
  const TEXT = ['--text', '--muted', '--accent', '--cyan', '--magenta', '--red', '--green', '--blue'];
  const SURFACES = ['--bg', '--panel', '--panel-2'];

  it('every accent has rules for both themes, setting the same tokens', () => {
    for (const a of ACCENTS) {
      const e = sets.get(a);
      expect(e, a).toBeTruthy();
      expect(Object.keys(e!.light).sort(), a).toEqual(Object.keys(e!.dark).sort());
      for (const k of ['--accent', '--accent-bg', '--accent-ink']) expect(e!.light[k], `${a} ${k}`).toBeTruthy();
    }
  });

  it('the default set matches styles.css, so choosing yellow looks like no choice', () => {
    const y = sets.get('yellow')!;
    for (const k of ['--accent', '--accent-bg', '--accent-ink']) {
      expect(y.light[k]).toBe(base.light[k]);
      expect(y.dark[k]).toBe(base.dark[k]);
    }
  });

  for (const theme of ['light', 'dark'] as const) {
    it(`${theme}: text tokens reach 4.5:1 on the page and panel surfaces, and the ink on the accent fill too`, () => {
      for (const a of ACCENTS) {
        const t = { ...base[theme], ...sets.get(a)![theme] };
        for (const fg of TEXT) {
          for (const bg of SURFACES) expect(contrast(t[fg]!, t[bg]!), `${a} ${theme}: ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
        }
        expect(contrast(t['--accent-ink']!, t['--accent-bg']!), `${a} ${theme}: ink on fill`).toBeGreaterThanOrEqual(4.5);
        // board.css puts #0b0b12 on the accent fill (the "your turn" tag)
        expect(contrast('#0b0b12', t['--accent-bg']!), `${a} ${theme}: tag text on fill`).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
