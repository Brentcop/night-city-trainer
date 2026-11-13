// Play board settings, kept per browser under one versioned localStorage key: how Eddies are paid, where the side
// panel (the game log and coach notes today, a chat later) sits and how it reads, whether a dropped card asks before it
// acts, and the look: accent colours, the board
// and Gig area backgrounds, card backs, glow, HUD frames, the read-out numerals and motion (with presets that set the
// look in one click). The look fields are optional in storage: settings saved before they existed take their defaults.
// Pure: defaults, validation and migration take plain values, and storage is passed in (blocked
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
export const BOARD_BACKGROUNDS = ['grid', 'plain', 'circuit', 'dots', 'scanlines', 'neon', 'hex', 'rain', 'skyline', 'floor'] as const;
export type BoardBackground = (typeof BOARD_BACKGROUNDS)[number];
export const GIG_BACKGROUNDS = ['panel', 'plain', 'stripes', 'dots', 'grid', 'glow', 'hex', 'scan'] as const;
export type GigBackground = (typeof GIG_BACKGROUNDS)[number];
/** Card backs (face-down Legends, Eddies, deck piles): a pattern drawn in the accent colour. 'stripes' is the old back. */
export const CARD_BACKS = ['stripes', 'circuit', 'hex', 'scan'] as const;
export type CardBack = (typeof CARD_BACKS)[number];
/** Neon glow on card frames, the action marks, dice and the active side. */
export const GLOWS = ['off', 'soft', 'strong'] as const;
export type Glow = (typeof GLOWS)[number];
/** Panel frames: cut corners and corner brackets ('hud'), or plain rounded boxes as before. */
export const FRAMES = ['hud', 'plain'] as const;
export type Frame = (typeof FRAMES)[number];
/** The face for the numbers a player watches (€$, Gigs, turn, counts, stats): a monospaced read-out, or the text face. */
export const NUMERALS = ['readout', 'standard'] as const;
export type Numerals = (typeof NUMERALS)[number];
/**
 * Motion: 'system' follows the device's reduced-motion setting (and keeps always-running effects off on touch screens);
 * 'full' runs everything, 'reduced' keeps short fades but no looping or travelling effects, 'off' stops all of it.
 */
export const MOTIONS = ['system', 'full', 'reduced', 'off'] as const;
export type Motion = (typeof MOTIONS)[number];

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
  /**
   * Confirm before acting: a card dropped on the board asks "Play X?" before it acts (the default, as before). Off, a
   * drop that can mean only one thing is done at once; one that could mean two or more (Play or Go Solo) still asks
   * which. The human seat's UI only: the answers the game records are the same either way.
   */
  confirmActions: boolean;
  accent: Accent;
  boardBg: BoardBackground;
  gigBg: GigBackground;
  cardBack: CardBack;
  glow: Glow;
  frame: Frame;
  numerals: Numerals;
  motion: Motion;
}

/** The fields that make up the look (what a preset sets); motion and numerals are left to the player. */
export const LOOK_FIELDS = ['accent', 'boardBg', 'gigBg', 'cardBack', 'glow', 'frame'] as const;
export type Look = Pick<BoardSettings, (typeof LOOK_FIELDS)[number]>;
/** Fields added after the first release: absent in older saved settings, which then take the site's default for each. */
const LATER_FIELDS = ['endTurn', 'confirmActions', 'cardBack', 'glow', 'frame', 'numerals', 'motion'] as const;

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
  confirmActions: true,
  accent: 'yellow',
  boardBg: 'grid',
  gigBg: 'panel',
  cardBack: 'stripes',
  glow: 'soft',
  frame: 'hud',
  numerals: 'readout',
  motion: 'system',
}) as BoardSettings;

/** The site owner's defaults for new visitors (play.board in the site config, set by src/ui/useSiteConfig.ts). */
let siteDefaults: {
  accent?: Accent;
  boardBg?: BoardBackground;
  gigBg?: GigBackground;
  cardBack?: CardBack;
  glow?: Glow;
  frame?: Frame;
  numerals?: Numerals;
  payMode?: PayMode;
  endTurn?: EndTurnMode;
  confirmActions?: boolean;
  panelPosition?: PanelPosition;
} = {};
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
    confirmActions: bool(o.confirmActions, d.confirmActions),
    accent: pick(ACCENTS, o.accent, d.accent),
    boardBg: pick(BOARD_BACKGROUNDS, o.boardBg, d.boardBg),
    gigBg: pick(GIG_BACKGROUNDS, o.gigBg, d.gigBg),
    cardBack: pick(CARD_BACKS, o.cardBack, d.cardBack),
    glow: pick(GLOWS, o.glow, d.glow),
    frame: pick(FRAMES, o.frame, d.frame),
    numerals: pick(NUMERALS, o.numerals, d.numerals),
    motion: pick(MOTIONS, o.motion, d.motion),
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
    // settings saved before a choice existed (End turn, Confirm before acting, the look) take the site's default for it
    const site = defaultBoardSettings();
    for (const k of LATER_FIELDS) if (!isObj(raw) || raw[k] === undefined) (s as unknown as Record<string, unknown>)[k] = site[k];
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
export const CONFIRM_ACTIONS_LABEL = 'Confirm before acting';
export const CONFIRM_ACTIONS_HELP =
  'Ticked, a card you drag onto the board asks before it acts. Unticked, a drop that can mean only one thing happens at once; one that could mean more (Play or Go Solo) still asks which. Undo takes back a move in practice games; against a person there is no Undo.';
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
  hex: 'Hex grid',
  rain: 'Rain',
  skyline: 'Skyline',
  floor: 'Grid floor',
};
export const GIG_BG_LABEL: Record<GigBackground, string> = {
  panel: 'Panel (default)',
  plain: 'Plain',
  stripes: 'Stripes',
  dots: 'Dots',
  grid: 'Fine grid',
  glow: 'Accent glow',
  hex: 'Hex grid',
  scan: 'Scan bars',
};
export const CARD_BACK_LABEL: Record<CardBack, string> = {
  stripes: 'Stripes (default)',
  circuit: 'Circuit',
  hex: 'Hex mesh',
  scan: 'Scan bars',
};
export const GLOW_LABEL: Record<Glow, string> = { off: 'Off', soft: 'Soft (default)', strong: 'Strong' };
export const FRAME_LABEL: Record<Frame, string> = { hud: 'HUD corners (default)', plain: 'Plain' };
export const NUMERALS_LABEL: Record<Numerals, string> = { readout: 'Read-out (default)', standard: 'Standard' };
export const MOTION_LABEL: Record<Motion, string> = {
  system: 'Follow this device (default)',
  full: 'Full',
  reduced: 'Reduced',
  off: 'Off',
};
export const MOTION_HELP: Record<Motion, string> = {
  system: 'Full motion unless the device asks for less; effects that run all the time stay off on touch screens.',
  full: 'Everything, including the light round the active side, falling rain and the moving header line.',
  reduced: 'Short fades only: nothing loops, travels or shakes.',
  off: 'No animation at all.',
};

/** One-click looks: each sets the accent, both backgrounds, the card back, glow and frame together. */
export interface LookPreset {
  id: string;
  label: string;
  blurb: string;
  look: Look;
}
export const LOOK_PRESETS: readonly LookPreset[] = Object.freeze([
  { id: 'signal', label: 'Signal (default)', blurb: 'Yellow on the grid, soft glow, HUD corners.', look: { accent: 'yellow', boardBg: 'grid', gigBg: 'panel', cardBack: 'stripes', glow: 'soft', frame: 'hud' } },
  { id: 'classic', label: 'Classic', blurb: 'The board as it looked before: no glow, plain frames.', look: { accent: 'yellow', boardBg: 'grid', gigBg: 'panel', cardBack: 'stripes', glow: 'off', frame: 'plain' } },
  { id: 'neon-rain', label: 'Neon Rain', blurb: 'Cyan rain, circuit backs, strong glow.', look: { accent: 'cyan', boardBg: 'rain', gigBg: 'scan', cardBack: 'circuit', glow: 'strong', frame: 'hud' } },
  { id: 'skyline', label: 'Midnight Skyline', blurb: 'Magenta over a city horizon, hex backs.', look: { accent: 'magenta', boardBg: 'skyline', gigBg: 'glow', cardBack: 'hex', glow: 'soft', frame: 'hud' } },
  { id: 'grid-runner', label: 'Grid Runner', blurb: 'Green on a perspective floor, scan-bar backs.', look: { accent: 'green', boardBg: 'floor', gigBg: 'grid', cardBack: 'scan', glow: 'strong', frame: 'hud' } },
  { id: 'clear-signal', label: 'Clear Signal', blurb: 'Colour-blind safe orange and blue on hex.', look: { accent: 'cb', boardBg: 'hex', gigBg: 'hex', cardBack: 'hex', glow: 'soft', frame: 'hud' } },
] satisfies LookPreset[]);

/** The preset the settings' look matches, or null ("Custom"). */
export function matchingPreset(s: Look): LookPreset | null {
  return LOOK_PRESETS.find((p) => LOOK_FIELDS.every((k) => p.look[k] === s[k])) ?? null;
}
