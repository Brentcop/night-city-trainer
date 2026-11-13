// Play board settings, kept per browser under one versioned localStorage key: how Eddies are paid, where the side
// panel (the game log and coach notes today, a chat later) sits and how it reads, the accent colours, and the board and
// Gig area backgrounds. Pure: defaults, validation and migration take plain values, and storage is passed in (blocked
// or missing storage means defaults). The React side is src/ui/useBoardSettings.ts; the dialog is
// src/ui/components/board/SettingsDialog.tsx.

export const BOARD_SETTINGS_KEY = 'nct.boardSettings.v1';
export const BOARD_SETTINGS_VERSION = 1;

/** How costs are paid: the game picks (today's rule), you pick the sources before playing, or right after. */
export const PAY_MODES = ['auto', 'before', 'after'] as const;
export type PayMode = (typeof PAY_MODES)[number];

/** Where the side panel sits on the full board (phones always use their bottom sheet, but honour 'hidden'). */
export const PANEL_POSITIONS = ['right', 'left', 'bottom', 'hidden'] as const;
export type PanelPosition = (typeof PANEL_POSITIONS)[number];
export const PANEL_DENSITIES = ['detailed', 'compact'] as const;
export type PanelDensity = (typeof PANEL_DENSITIES)[number];
export const TEXT_SIZES = ['small', 'medium', 'large'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const PANEL_ORDERS = ['newest-last', 'newest-first'] as const;
export type PanelOrder = (typeof PANEL_ORDERS)[number];

/** Accent colour sets (src/ui/themes.css, both themes). 'yellow' is the site's own signature. */
export const ACCENTS = ['yellow', 'cyan', 'magenta', 'green', 'amber', 'cb'] as const;
export type Accent = (typeof ACCENTS)[number];
export const BOARD_BACKGROUNDS = ['grid', 'plain', 'circuit', 'dots', 'scanlines', 'neon'] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];
export const GIG_BACKGROUNDS = ['panel', 'plain', 'stripes', 'dots', 'grid', 'glow'] as const;
export type GigBackground = (typeof GIG_BACKGROUNDS)[number];

/** The side panel: position and display. Belongs to the panel, not to the log, so a chat can share it. */
export interface SidePanelSettings {
  position: PanelPosition;
  density: PanelDensity;
  textSize: TextSize;
  order: PanelOrder;
  /** the "--- Turn N ---" lines between turns, and the turn number on each line in the detailed view */
  turnMarkers: boolean;
  /** open the panel when the rival's turn starts */
  autoOpenRivalTurn: boolean;
}

export interface BoardSettings {
  v: typeof BOARD_SETTINGS_VERSION;
  payMode: PayMode;
  panel: SidePanelSettings;
  accent: Accent;
  boardBg: BoardBackground;
  gigBg: GigBackground;
}

export const DEFAULT_BOARD_SETTINGS: Readonly<BoardSettings> = Object.freeze({
  v: BOARD_SETTINGS_VERSION,
  payMode: 'auto',
  panel: Object.freeze({
    position: 'right',
    density: 'detailed',
    textSize: 'medium',
    order: 'newest-last',
    turnMarkers: true,
    autoOpenRivalTurn: false,
  }) as SidePanelSettings,
  accent: 'yellow',
  boardBg: 'grid',
  gigBg: 'panel',
}) as BoardSettings;

/** A fresh, mutable copy of the defaults. */
export function defaultBoardSettings(): BoardSettings {
  return { ...DEFAULT_BOARD_SETTINGS, panel: { ...DEFAULT_BOARD_SETTINGS.panel } };
}

const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fallback);
const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Bring a stored object up to the current shape. There is one version so far; an object without a version is read as
 * version 1 (same fields), and one from a newer version keeps whatever fields this version knows.
 */
export function migrateBoardSettings(raw: unknown): Record<string, unknown> {
  if (!isObj(raw)) return {};
  return { ...raw, v: BOARD_SETTINGS_VERSION };
}

/** Validate a stored or edited value field by field: anything unknown or malformed falls back to its default. */
export function parseBoardSettings(raw: unknown): BoardSettings {
  const o = migrateBoardSettings(raw);
  const d = DEFAULT_BOARD_SETTINGS;
  const p = isObj(o.panel) ? o.panel : {};
  return {
    v: BOARD_SETTINGS_VERSION,
    payMode: pick(PAY_MODES, o.payMode, d.payMode),
    panel: {
      position: pick(PANEL_POSITIONS, p.position, d.panel.position),
      density: pick(PANEL_DENSITIES, p.density, d.panel.density),
      textSize: pick(TEXT_SIZES, p.textSize, d.panel.textSize),
      order: pick(PANEL_ORDERS, p.order, d.panel.order),
      turnMarkers: bool(p.turnMarkers, d.panel.turnMarkers),
      autoOpenRivalTurn: bool(p.autoOpenRivalTurn, d.panel.autoOpenRivalTurn),
    },
    accent: pick(ACCENTS, o.accent, d.accent),
    boardBg: pick(BOARD_BACKGROUNDS, o.boardBg, d.boardBg),
    gigBg: pick(GIG_BACKGROUNDS, o.gigBg, d.gigBg),
  };
}

/** A change to some settings (the panel's fields may be given one at a time). */
export type BoardSettingsPatch = Partial<Omit<BoardSettings, 'v' | 'panel'>> & { panel?: Partial<SidePanelSettings> };

export function applyPatch(s: BoardSettings, patch: BoardSettingsPatch): BoardSettings {
  return parseBoardSettings({ ...s, ...patch, panel: { ...s.panel, ...(patch.panel ?? {}) } });
}

type Store = Pick<Storage, 'getItem' | 'setItem'>;

/** localStorage, or null where it is missing or blocked. */
export function localStore(): Store | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function loadBoardSettings(store: Store | null = localStore()): BoardSettings {
  try {
    const text = store?.getItem(BOARD_SETTINGS_KEY);
    return parseBoardSettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultBoardSettings();
  }
}

export function saveBoardSettings(s: BoardSettings, store: Store | null = localStore()): void {
  try {
    store?.setItem(BOARD_SETTINGS_KEY, JSON.stringify(parseBoardSettings(s)));
  } catch {
    /* storage blocked or full: the settings still apply for this visit */
  }
}

/** Labels for the dialog (and anything else that names an option). */
export const PAY_MODE_LABEL: Record<PayMode, string> = {
  auto: 'Automatic',
  before: 'Choose before playing',
  after: 'Choose after playing',
};
export const PAY_MODE_HELP: Record<PayMode, string> = {
  auto: 'The game spends your Eddies for you. You are asked only when a Legend could pay instead.',
  before: 'Select what to spend first (tap your €$ pile or the "Pay with" row), then play the card.',
  after: 'Play the card, then pick what to spend. Cancel takes the play back.',
};
export const POSITION_LABEL: Record<PanelPosition, string> = { right: 'Right', left: 'Left', bottom: 'Bottom', hidden: 'Hidden' };
export const ACCENT_LABEL: Record<Accent, string> = {
  yellow: 'Yellow (default)',
  cyan: 'Cyan',
  magenta: 'Magenta',
  green: 'Green',
  amber: 'Amber',
  cb: 'Colour-blind safe (orange and blue)',
};
export const BOARD_BG_LABEL: Record<BoardBackground, string> = {
  grid: 'Grid (default)',
  plain: 'Plain',
  circuit: 'Circuit lines',
  dots: 'Dots',
  scanlines: 'Scanlines',
  neon: 'Neon glow',
};
export const GIG_BG_LABEL: Record<GigBackground, string> = {
  panel: 'Panel (default)',
  plain: 'Plain',
  stripes: 'Stripes',
  dots: 'Dots',
  grid: 'Fine grid',
  glow: 'Accent glow',
};
