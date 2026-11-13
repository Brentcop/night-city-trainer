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

/**
 * Ending your turn: you click End turn every turn (the default), or the turn ends by itself once nothing else is left
 * to do. A game keeps the mode it started with (its record says which), so a change applies to the next game.
 */
export const END_TURN_MODES = ['click', 'auto'] as const;
export type EndTurnMode = (typeof END_TURN_MODES)[number];

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
  endTurn: EndTurnMode;
  panel: SidePanelSettings;
  accent: Accent;
  boardBg: BoardBackground;
  gigBg: GigBackground;
}

export const DEFAULT_BOARD_SETTINGS: Readonly<BoardSettings> = Object.freeze({
  v: BOARD_SETTINGS_VERSION,
  payMode: 'auto',
  endTurn: 'click',
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

/** The site owner's defaults for new visitors (play.board in the site config, set by src/ui/useSiteConfig.ts). */
let siteDefaults: { accent?: Accent; boardBg?: BoardBackground; gigBg?: GigBackground; payMode?: PayMode; endTurn?: EndTurnMode; panelPosition?: PanelPosition } = {};
export function setSiteBoardDefaults(d: typeof siteDefaults): void {
  siteDefaults = { ...d };
}

/** A fresh, mutable copy of the defaults: the built-in ones with the site owner's choices on top. */
export function defaultBoardSettings(): BoardSettings {
  const { panelPosition, ...rest } = siteDefaults;
  return { ...DEFAULT_BOARD_SETTINGS, ...rest, panel: { ...DEFAULT_BOARD_SETTINGS.panel, ...(panelPosition ? { position: panelPosition } : {}) } };
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
    endTurn: pick(END_TURN_MODES, o.endTurn, d.endTurn),
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
    // nothing saved: the site's defaults (a visitor's own saved settings always win)
    if (!text) return defaultBoardSettings();
    const raw: unknown = JSON.parse(text);
    const s = parseBoardSettings(raw);
    // settings saved before the End turn choice existed take the site's default for it
    if (!isObj(raw) || raw.endTurn === undefined) s.endTurn = defaultBoardSettings().endTurn;
    return s;
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
  auto: 'The game pays every cost for you without asking: Eddies first, then the Legends that lose least by being spent. To pick what pays, choose before or after playing.',
  before: 'Select what to spend first (tap your €$ pile or the "Pay with" row), then play the card.',
  after: 'Play the card, then pick what to spend. Cancel takes the play back.',
};
export const END_TURN_LABEL: Record<EndTurnMode, string> = {
  click: 'Click End turn',
  auto: 'End automatically when nothing is left to do',
};
export const END_TURN_HELP: Record<EndTurnMode, string> = {
  click: 'Your turn ends only when you click End turn.',
  auto: 'When the only thing left is to end your turn, it ends by itself.',
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
