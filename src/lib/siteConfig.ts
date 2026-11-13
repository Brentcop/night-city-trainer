// The owner's site configuration: public/site-config.json, edited by hand or with the editor at #/admin, committed and
// deployed with the site. Visitors cannot change it. This module is pure: the schema, the defaults (today's site), a
// parser that checks every field on its own and falls back to the default for anything wrong, and the rules that read
// it (which pages are on, the nav, the banner's dates). The React side is src/ui/useSiteConfig.ts; the reference is
// docs/SITE_CONFIG.md. Every string is plain text (React renders it as text, never HTML) and capped in length; links
// are same-site hash routes (#/…) or https addresses.
import {
  ACCENTS,
  BOARD_BACKGROUNDS,
  CARD_BACKS,
  END_TURN_MODES,
  FRAMES,
  GIG_BACKGROUNDS,
  GLOWS,
  NUMERALS,
  PANEL_POSITIONS,
  PAY_MODES,
  type Accent,
  type BoardBackground,
  type CardBack,
  type EndTurnMode,
  type Frame,
  type GigBackground,
  type Glow,
  type Numerals,
  type PanelPosition,
  type PayMode,
} from './boardSettings';
import { SORTS, type GallerySort } from './galleryView';
import { SOURCES, type SourceKey } from './deckSource';
import { EVENT } from '../content/event';

export const SITE_CONFIG_KIND = 'nct-site-config';
export const SITE_CONFIG_SCHEMA = 1;
/** The file the site fetches (under the site's base) and the build inlines into index.html. */
export const SITE_CONFIG_FILE = 'site-config.json';

// ---------------------------------------------------------------- features

export const FEATURES = ['coach', 'gameReview', 'savedGames', 'profile', 'profileSharing', 'deckLab', 'tournamentRunner', 'tunedDecks', 'cardArtToggle', 'multiplayer', 'multiDayGames', 'chat'] as const;
export type FeatureName = (typeof FEATURES)[number];
export const FEATURE_INFO: Record<FeatureName, { label: string; help: string; default: boolean }> = {
  coach: { label: 'Coach', help: 'The coach in Play: suggested moves, warnings and the move grades.', default: true },
  gameReview: { label: 'Game review', help: 'Reviewing finished practice games (Play, Profile).', default: true },
  savedGames: { label: 'Saved games', help: 'Resume game, named saves and save files in Play.', default: true },
  profile: { label: 'Profile', help: 'The Profile tab and its pages.', default: true },
  profileSharing: { label: 'Profile sharing', help: 'Share links and files, and opening a shared profile (#/u).', default: true },
  deckLab: { label: 'Deck Lab', help: 'Tuning and breeding decks in the browser (#/lab).', default: true },
  tournamentRunner: { label: 'Tournament runner', help: 'Running a tournament in the browser (#/run).', default: true },
  tunedDecks: { label: 'Tuned decks page', help: 'The list of decks tuned in the Lab (#/tuned).', default: true },
  cardArtToggle: { label: 'Card art switch', help: 'The Art / Text button in the header.', default: true },
  multiplayer: { label: 'Play online', help: 'Play another person online (Play → Play online): a direct browser-to-browser link set up with invite codes.', default: true },
  multiDayGames: {
    label: 'Multi-day games',
    help: 'Games that last days (Play): a bot game kept until it is finished, and a game against a person by sending turn packets. Without a server, clocks are kept by each device.',
    default: true,
  },
  chat: { label: 'Chat', help: 'The text chat between the two players of an online game.', default: true },
};

// ---------------------------------------------------------------- navigation catalogue

export const SECTION_IDS = ['home', 'decks', 'play', 'tournaments', 'learn', 'profile'] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** Every top tab with its pages: `pages` are the ones the owner orders and labels (the sub-menu when `subnav`), `extra`
 *  are pages reached by links that follow their tab (a deck's profile, a shared profile). */
export const NAV_CATALOG: readonly { id: SectionId; label: string; icon: string; pages: readonly string[]; extra: readonly string[]; subnav: boolean }[] = [
  { id: 'home', label: 'Home', icon: '⌂', pages: ['home'], extra: [], subnav: false },
  { id: 'decks', label: 'Decks', icon: '▤', pages: ['decks', 'tuned', 'lab'], extra: ['deck'], subnav: true },
  { id: 'play', label: 'Play', icon: '▶', pages: ['play'], extra: [], subnav: false },
  { id: 'tournaments', label: 'Tournaments', icon: '🏆', pages: ['tournaments', 'run', 'ratings', 'seasons', 'meta', 'arena'], extra: [], subnav: true },
  { id: 'learn', label: 'Learn', icon: '♟', pages: ['guides', 'cards', 'glossary', 'insights', 'credits'], extra: [], subnav: true },
  { id: 'profile', label: 'Profile', icon: '◉', pages: ['profile'], extra: ['u'], subnav: false },
];

/** Each page's default label (the sub-menu text). */
export const PAGE_LABEL: Readonly<Record<string, string>> = {
  home: 'Home',
  decks: 'All decks',
  tuned: 'Tuned decks',
  lab: 'Deck Lab',
  deck: 'Deck',
  play: 'Play vs Bot',
  tournaments: 'Events',
  run: 'Run a tournament',
  ratings: 'Power ratings',
  seasons: 'Breeding seasons',
  meta: 'choom.gg meta',
  arena: 'Matchup Lab',
  guides: 'Strategy',
  cards: 'Cards',
  glossary: 'Glossary',
  insights: 'Card stats',
  credits: 'Credits',
  profile: 'Profile',
  u: 'Shared profile',
};

/** Pages that need features on: every one listed must be on. */
export const PAGE_FEATURES: Readonly<Record<string, readonly FeatureName[]>> = {
  lab: ['deckLab'],
  run: ['tournamentRunner'],
  tuned: ['tunedDecks'],
  profile: ['profile'],
  u: ['profile', 'profileSharing'],
};

// ---------------------------------------------------------------- other option lists

export const HOME_SECTIONS = ['nextEvent', 'featuredDeck', 'quickActions', 'featuredEvent', 'topDecks'] as const;
export type HomeSectionId = (typeof HOME_SECTIONS)[number];
export const HOME_SECTION_LABEL: Record<HomeSectionId, string> = {
  nextEvent: 'Next event bar',
  featuredDeck: 'Featured deck',
  quickActions: 'Quick links (Practice, Browse decks, Tournaments)',
  featuredEvent: 'Featured event (shows only when one is set)',
  topDecks: 'Top 5 decks',
};
/** The bot tiers (src/ai/tiers.ts `Tier`, repeated here so this module stays out of the bot code). */
export const TIER_KEYS = ['easy', 'medium', 'hard'] as const;
export type TierKey = (typeof TIER_KEYS)[number];
export const BANNER_LEVELS = ['info', 'warning'] as const;
export type BannerLevel = (typeof BANNER_LEVELS)[number];

/** Turn timer choices for online games, in seconds per decision (0 = no timer). */
export const TURN_TIMERS = [0, 30, 60, 90, 120, 300] as const;
export type TurnTimer = (typeof TURN_TIMERS)[number];
/** A STUN server address: stun: or stuns:, a host name, an optional port (no TURN: its credentials would be public). */
export const STUN_URL = /^stuns?:[A-Za-z0-9.-]+(:\d{1,5})?$/;
export const MAX_ICE_SERVERS = 5;
export const DEFAULT_ICE_SERVERS = ['stun:stun.l.google.com:19302'];
/** A TURN server address: turn: or turns:, a host name (or IPv4), an optional port and `?transport=udp|tcp`. */
export const TURN_URL = /^turns?:[A-Za-z0-9.-]+(:\d{1,5})?(\?transport=(udp|tcp))?$/;
/** TURN servers at most, addresses per server at most, and the length caps of a server's fields. */
export const TURN_LIMITS = { servers: 3, urls: 4, url: 200, username: 256, credential: 512 } as const;
/**
 * A TURN relay for "Private connection" (relay only). `username` / `credential` are the TURN long-term credentials
 * ('' = none). Written in public site-config.json they are public: anyone can use the relay with them.
 */
export interface TurnServer {
  urls: string[];
  username: string;
  credential: string;
}
/** An https address (or http on this computer, for development): where short-lived TURN credentials come from. */
export function isCredentialsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'https:' || (u.protocol === 'http:' && isLocalHost(u.hostname));
  } catch {
    return false;
  }
}
/** A relay server address: wss:, or ws: on this computer (development). */
export function isRelayUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return (u.protocol === 'wss:' || (u.protocol === 'ws:' && isLocalHost(u.hostname))) && !u.username && !u.password && !u.hash;
  } catch {
    return false;
  }
}
const isLocalHost = (h: string) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
// eslint-disable-next-line no-control-regex
const TURN_TEXT = /^[^\u0000-\u001F\u007F]*$/;

/**
 * TURN servers read from untrusted JSON (the site config, or a credentials endpoint's answer): each `{ urls, username?,
 * credential? }` with `urls` one address or a list of turn:/turns: addresses; anything else is left out and said why.
 * `path` names the list in the problems.
 */
export function parseTurnServers(v: unknown, path: string): { servers: TurnServer[]; problems: ConfigIssue[] } {
  const problems: ConfigIssue[] = [];
  const servers: TurnServer[] = [];
  if (v === undefined) return { servers, problems };
  const list = Array.isArray(v) ? v : isObj(v) ? [v] : null;
  if (!list) return { servers, problems: [{ path, message: 'must be a list of TURN servers; none is used' }] };
  list.forEach((x: unknown, i: number) => {
    const at = `${path}[${i}]`;
    if (!isObj(x)) return void problems.push({ path: at, message: 'must be an object { urls, username, credential }; it is left out' });
    if (servers.length >= TURN_LIMITS.servers) return void problems.push({ path: at, message: `only ${TURN_LIMITS.servers} TURN servers are used; it is left out` });
    const rawUrls = typeof x.urls === 'string' ? [x.urls] : Array.isArray(x.urls) ? x.urls : null;
    if (!rawUrls) return void problems.push({ path: `${at}.urls`, message: 'must be a turn: or turns: address or a list of them; the server is left out' });
    const urls: string[] = [];
    rawUrls.forEach((u: unknown, j: number) => {
      if (typeof u !== 'string' || u.length > TURN_LIMITS.url || !TURN_URL.test(u)) problems.push({ path: `${at}.urls[${j}]`, message: `${JSON.stringify(u)?.slice(0, 60)} is not a TURN address such as turns:turn.example.com:5349; it is left out` });
      else if (urls.length >= TURN_LIMITS.urls) problems.push({ path: `${at}.urls[${j}]`, message: `only ${TURN_LIMITS.urls} addresses per server are used; it is left out` });
      else if (!urls.includes(u)) urls.push(u);
    });
    if (!urls.length) return void problems.push({ path: `${at}.urls`, message: 'has no usable TURN address; the server is left out' });
    const field = (f: 'username' | 'credential'): string | null => {
      const val = x[f];
      if (val === undefined) return '';
      if (typeof val !== 'string' || val.length > TURN_LIMITS[f] || !TURN_TEXT.test(val)) {
        problems.push({ path: `${at}.${f}`, message: `must be text of at most ${TURN_LIMITS[f]} characters on one line; the server is left out` });
        return null;
      }
      return val;
    };
    const username = field('username');
    const credential = field('credential');
    if (username === null || credential === null) return;
    for (const k of Object.keys(x)) if (k !== 'urls' && k !== 'username' && k !== 'credential' && k !== 'credentialType') problems.push({ path: `${at}.${k}`, message: 'is not a TURN server field; it is ignored' });
    servers.push({ urls, username, credential });
  });
  return { servers, problems };
}
/** Bounds for the multi-day game settings (whole days; the ongoing-game cap). */
export const MULTI_DAY_BOUNDS = { days: [1, 60], ongoing: [1, 20] } as const;

/** Length caps, in characters. */
export const LIMITS = {
  title: 60,
  tagline: 200,
  footer: 400,
  navLabel: 30,
  bannerText: 300,
  link: 500,
  linkText: 60,
  eventName: 100,
  eventDetail: 80,
  deckFile: 200,
  eventId: 40,
  hiddenDecks: 500,
  maintenance: 1000,
  iceServer: 200,
} as const;

// ---------------------------------------------------------------- the schema

export interface NavPageConfig {
  path: string;
  label: string;
  hidden: boolean;
}
export interface NavSectionConfig {
  id: SectionId;
  label: string;
  hidden: boolean;
  pages: NavPageConfig[];
}
export interface BannerConfig {
  text: string;
  /** '' = no link */
  link: string;
  /** '' = "Read more" */
  linkText: string;
  level: BannerLevel;
  /** YYYY-MM-DD (from that day's start, local time) or an ISO date-time; '' = no start */
  start: string;
  /** YYYY-MM-DD (to that day's end, local time) or an ISO date-time; '' = no end */
  end: string;
  dismissible: boolean;
}
export interface SiteConfig {
  kind: typeof SITE_CONFIG_KIND;
  schema: typeof SITE_CONFIG_SCHEMA;
  site: { title: string; tagline: string; footer: string };
  nav: { sections: NavSectionConfig[] };
  features: Record<FeatureName, boolean>;
  banner: BannerConfig;
  home: {
    sections: { id: HomeSectionId; hidden: boolean }[];
    /** a library deck file; '' = the generated recommendation */
    featuredDeck: string;
    /** a recorded event id; '' = none */
    featuredEvent: string;
    /** `end`: when the event is over (YYYY-MM-DD lasts to the end of that day); '' = no end (it stays "underway") */
    nextEvent: { name: string; start: string; end: string; detail: string };
  };
  play: {
    defaultTier: TierKey;
    tiers: TierKey[];
    /** board settings for visitors who have not saved their own */
    board: {
      accent: Accent;
      boardBg: BoardBackground;
      gigBg: GigBackground;
      cardBack: CardBack;
      glow: Glow;
      frame: Frame;
      numerals: Numerals;
      payMode: PayMode;
      endTurn: EndTurnMode;
      /** Confirm before acting: a dropped card asks before it acts */
      confirmActions: boolean;
      panelPosition: PanelPosition;
    };
  };
  decks: {
    /** library deck files hidden for everyone by default (a visitor can unhide one for themselves) */
    hidden: string[];
    /** the deck sources the gallery shows */
    sources: SourceKey[];
    defaultSort: GallerySort;
  };
  maintenance: { on: boolean; message: string; allowPlay: boolean };
  /** online games (features.multiplayer) */
  multiplayer: {
    /** STUN servers that tell each browser its public address; empty = same-network play only */
    iceServers: string[];
    /** the turn timer the host's lobby starts on, in seconds (0 = off) */
    turnTimer: TurnTimer;
    /** invite and reply codes (online and multi-day) start locked with a phrase; players can still make unlocked ones */
    lockCodes: boolean;
    /**
     * TURN relays for "Private connection" (relay only: neither player sees the other's address). Empty with no
     * `turnCredentialsUrl`: the mode is shown but unavailable. Credentials written here are public.
     */
    turnServers: TurnServer[];
    /** an https endpoint that answers with short-lived TURN credentials (TURN_CREDENTIALS in src/net/turn.ts); '' = none */
    turnCredentialsUrl: string;
    /** a relay server (docs/RELAY_PROTOCOL.md, wss:) for "Play through the relay"; '' = off and not shown */
    relayUrl: string;
  };
  /** multi-day games (features.multiDayGames): the game lengths offered, in whole days, and how many may be ongoing */
  multiDay: {
    minDays: number;
    maxDays: number;
    defaultDays: number;
    /** ongoing multi-day games (bot and person together) kept in one browser */
    maxOngoing: number;
  };
}

const DEFAULT_FOOTER =
  'Unofficial fan-made practice tool — not affiliated with CD PROJEKT RED, WeirdCo, choom.gg or cyberpunk-tcg-sim.online. Every deck is tagged with its origin and author — see [Credits](#/credits).';

/** A fresh copy of the defaults: today's site, exactly. */
export function defaultSiteConfig(): SiteConfig {
  return {
    kind: SITE_CONFIG_KIND,
    schema: SITE_CONFIG_SCHEMA,
    site: {
      title: 'Night City Trainer',
      tagline: 'Unofficial Cyberpunk TCG practice simulator: deck builder, meta, guides, bot battles and matchup lab.',
      footer: DEFAULT_FOOTER,
    },
    nav: { sections: NAV_CATALOG.map((s) => ({ id: s.id, label: s.label, hidden: false, pages: s.pages.map((p) => ({ path: p, label: PAGE_LABEL[p] ?? p, hidden: false })) })) },
    features: Object.fromEntries(FEATURES.map((f) => [f, FEATURE_INFO[f].default])) as Record<FeatureName, boolean>,
    banner: { text: '', link: '', linkText: '', level: 'info', start: '', end: '', dismissible: true },
    home: {
      sections: HOME_SECTIONS.map((id) => ({ id, hidden: false })),
      featuredDeck: '',
      featuredEvent: '',
      nextEvent: { name: EVENT.name, start: EVENT.startText, end: EVENT.endText, detail: EVENT.detail },
    },
    play: { defaultTier: 'hard', tiers: [...TIER_KEYS], board: { accent: 'yellow', boardBg: 'grid', gigBg: 'panel', cardBack: 'stripes', glow: 'soft', frame: 'hud', numerals: 'readout', payMode: 'auto', endTurn: 'click', confirmActions: true, panelPosition: 'right' } },
    decks: { hidden: [], sources: SOURCES.map((s) => s.key), defaultSort: 'rating' },
    maintenance: { on: false, message: 'The site is down for maintenance. Please check back soon.', allowPlay: true },
    multiplayer: { iceServers: [...DEFAULT_ICE_SERVERS], turnTimer: 0, lockCodes: true, turnServers: [], turnCredentialsUrl: '', relayUrl: '' },
    multiDay: { minDays: 3, maxDays: 20, defaultDays: 7, maxOngoing: 8 },
  };
}

// ---------------------------------------------------------------- checks on single values

/** A problem with one field: `path` names it (e.g. "banner.link"). */
export interface ConfigIssue {
  path: string;
  message: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Plain text: control characters removed; one line unless `multiline`. */
export function cleanText(s: string, multiline = false): string {
  const t = s.replace(CONTROL, '');
  return multiline ? t.replace(/\r\n?/g, '\n') : t.replace(/[\r\n\t]+/g, ' ');
}

const ROUTE_LINK = /^#\/[A-Za-z0-9_\-./?=&%,:~+]*$/;
/** A link the site may show: a same-site hash route (#/…) or an https address. */
export function isSafeLink(s: string): boolean {
  if (ROUTE_LINK.test(s)) return true;
  if (!/^https:\/\/\S+$/i.test(s)) return false;
  try {
    return new URL(s).protocol === 'https:';
  } catch {
    return false;
  }
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?$/;
/** A date as the config writes it: YYYY-MM-DD or an ISO date-time. */
export function isConfigDate(s: string): boolean {
  const m = s.match(DATE_ONLY);
  if (m) {
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return d.getMonth() === Number(m[2]) - 1 && d.getDate() === Number(m[3]);
  }
  return DATE_TIME.test(s) && Number.isFinite(Date.parse(s));
}
/** When a config date starts (`edge` 'start') or ends ('end': a date-only value lasts to the end of that day, local time). */
export function configTime(s: string, edge: 'start' | 'end'): number | null {
  if (!s || !isConfigDate(s)) return null;
  const m = s.match(DATE_ONLY);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + (edge === 'end' ? 1 : 0)).getTime();
  return Date.parse(s);
}

const DECK_FILE = /^[A-Za-z0-9_.-]+\.txt$/;
const EVENT_ID = /^[A-Za-z0-9_-]+$/;

/** Reads one config object field by field, collecting problems. */
class Reader {
  constructor(
    readonly errors: ConfigIssue[],
    readonly warnings: ConfigIssue[],
  ) {}
  err(path: string, message: string) {
    this.errors.push({ path, message });
  }
  /** an object at `path` (missing = {}); keys outside `known` are warned about and ignored */
  obj(v: unknown, path: string, known: readonly string[]): Record<string, unknown> {
    if (v === undefined) return {};
    if (!isObj(v)) {
      this.err(path, 'must be an object; the defaults are used');
      return {};
    }
    for (const k of Object.keys(v)) if (!known.includes(k)) this.warnings.push({ path: path ? `${path}.${k}` : k, message: 'is not a setting this version knows; it is ignored' });
    return v;
  }
  text(v: unknown, path: string, fallback: string, max: number, o: { multiline?: boolean; required?: boolean } = {}): string {
    if (v === undefined) return fallback;
    if (typeof v !== 'string') {
      this.err(path, 'must be text; the default is used');
      return fallback;
    }
    let t = cleanText(v, o.multiline);
    if (!o.multiline) t = t.trim();
    if (o.required && !t.trim()) {
      this.err(path, 'cannot be empty; the default is used');
      return fallback;
    }
    if (t.length > max) {
      this.err(path, `is ${t.length} characters long; the limit is ${max} (the rest is cut off)`);
      t = t.slice(0, max);
    }
    return t;
  }
  bool(v: unknown, path: string, fallback: boolean): boolean {
    if (v === undefined) return fallback;
    if (typeof v !== 'boolean') {
      this.err(path, 'must be true or false; the default is used');
      return fallback;
    }
    return v;
  }
  pick<T extends string>(v: unknown, path: string, list: readonly T[], fallback: T): T {
    if (v === undefined) return fallback;
    if (typeof v === 'string' && (list as readonly string[]).includes(v)) return v as T;
    this.err(path, `must be one of ${list.join(', ')}; the default (${fallback}) is used`);
    return fallback;
  }
  link(v: unknown, path: string): string {
    const t = this.text(v, path, '', LIMITS.link);
    if (t && !isSafeLink(t)) {
      this.err(path, 'must be a page of this site (starting #/) or an https:// address; the link is left out');
      return '';
    }
    return t;
  }
  date(v: unknown, path: string, fallback: string): string {
    const t = this.text(v, path, fallback, 40);
    if (t && !isConfigDate(t)) {
      this.err(path, 'must be a date (YYYY-MM-DD) or an ISO date-time such as 2026-12-11T09:00:00-06:00; it is left out');
      return fallback;
    }
    return t;
  }
  /** a list of known values, each once (order kept) */
  list<T extends string>(v: unknown, path: string, all: readonly T[], fallback: T[], o: { nonEmpty?: boolean } = {}): T[] {
    if (v === undefined) return fallback;
    if (!Array.isArray(v)) {
      this.err(path, 'must be a list; the default is used');
      return fallback;
    }
    const out: T[] = [];
    v.forEach((x, i) => {
      if (typeof x === 'string' && (all as readonly string[]).includes(x)) {
        if (!out.includes(x as T)) out.push(x as T);
      } else this.err(`${path}[${i}]`, `${JSON.stringify(x)} is not one of ${all.join(', ')}; it is left out`);
    });
    if (o.nonEmpty && !out.length) {
      this.err(path, 'cannot be empty; the default is used');
      return fallback;
    }
    return out;
  }
}

// ---------------------------------------------------------------- the parser

export interface ParsedSiteConfig {
  config: SiteConfig;
  /** fields that were wrong and fell back (check:data fails on any) */
  errors: ConfigIssue[];
  /** unknown keys, ignored */
  warnings: ConfigIssue[];
}

/** Read a site config (already JSON-parsed). Every field is checked on its own; anything wrong falls back to its default. */
export function parseSiteConfig(raw: unknown): ParsedSiteConfig {
  const errors: ConfigIssue[] = [];
  const warnings: ConfigIssue[] = [];
  const d = defaultSiteConfig();
  const r = new Reader(errors, warnings);
  if (!isObj(raw)) return { config: d, errors: [{ path: '', message: 'the file is not a JSON object; the defaults are used' }], warnings };
  if (raw.kind !== SITE_CONFIG_KIND) return { config: d, errors: [{ path: 'kind', message: `must be "${SITE_CONFIG_KIND}"; this is not a site config file, so the defaults are used` }], warnings };
  if (raw.schema !== SITE_CONFIG_SCHEMA)
    return { config: d, errors: [{ path: 'schema', message: `must be ${SITE_CONFIG_SCHEMA} (this site reads schema ${SITE_CONFIG_SCHEMA} only); the defaults are used` }], warnings };
  const o = r.obj(raw, '', ['kind', 'schema', 'site', 'nav', 'features', 'banner', 'home', 'play', 'decks', 'maintenance', 'multiplayer', 'multiDay']);

  const site = r.obj(o.site, 'site', ['title', 'tagline', 'footer']);
  const cfgSite = {
    title: r.text(site.title, 'site.title', d.site.title, LIMITS.title, { required: true }),
    tagline: r.text(site.tagline, 'site.tagline', d.site.tagline, LIMITS.tagline),
    footer: r.text(site.footer, 'site.footer', d.site.footer, LIMITS.footer),
  };
  for (const s of linkSegments(cfgSite.footer)) if (s.bad) r.err('site.footer', `the link "${s.text}" must point to a page of this site (#/…) or an https:// address; it shows as plain text`);

  const nav = parseNav(r, o.nav, d);

  const fRaw = r.obj(o.features, 'features', FEATURES);
  const features = Object.fromEntries(FEATURES.map((f) => [f, r.bool(fRaw[f], `features.${f}`, d.features[f])])) as Record<FeatureName, boolean>;

  const b = r.obj(o.banner, 'banner', ['text', 'link', 'linkText', 'level', 'start', 'end', 'dismissible']);
  const banner: BannerConfig = {
    text: r.text(b.text, 'banner.text', d.banner.text, LIMITS.bannerText),
    link: r.link(b.link, 'banner.link'),
    linkText: r.text(b.linkText, 'banner.linkText', d.banner.linkText, LIMITS.linkText),
    level: r.pick(b.level, 'banner.level', BANNER_LEVELS, d.banner.level),
    start: r.date(b.start, 'banner.start', ''),
    end: r.date(b.end, 'banner.end', ''),
    dismissible: r.bool(b.dismissible, 'banner.dismissible', d.banner.dismissible),
  };
  const bs = configTime(banner.start, 'start');
  const be = configTime(banner.end, 'end');
  if (bs !== null && be !== null && be <= bs) r.err('banner.end', 'is before the start, so the banner would never show');

  const h = r.obj(o.home, 'home', ['sections', 'featuredDeck', 'featuredEvent', 'nextEvent']);
  const homeSections = parseOrdered(r, h.sections, 'home.sections', HOME_SECTIONS, d.home.sections);
  let featuredDeck = r.text(h.featuredDeck, 'home.featuredDeck', '', LIMITS.deckFile);
  if (featuredDeck && !DECK_FILE.test(featuredDeck)) {
    r.err('home.featuredDeck', 'must be a library deck file name such as meta-rrg-dexter-midrange.txt; the recommendation is used');
    featuredDeck = '';
  }
  let featuredEvent = typeof h.featuredEvent === 'number' && Number.isInteger(h.featuredEvent) ? String(h.featuredEvent) : r.text(h.featuredEvent, 'home.featuredEvent', '', LIMITS.eventId);
  if (featuredEvent && !EVENT_ID.test(featuredEvent)) {
    r.err('home.featuredEvent', 'must be an event id (letters, digits, - and _); none is shown');
    featuredEvent = '';
  }
  const ne = r.obj(h.nextEvent, 'home.nextEvent', ['name', 'start', 'end', 'detail']);
  let neStart = r.text(ne.start, 'home.nextEvent.start', d.home.nextEvent.start, 40, { required: true });
  if (!isConfigDate(neStart)) {
    r.err('home.nextEvent.start', 'must be a date (YYYY-MM-DD) or an ISO date-time such as 2026-12-11T09:00:00-06:00; the default is used');
    neStart = d.home.nextEvent.start;
  }
  // absent: the default end; "" (or a bad date): no end
  let neEnd = r.date(ne.end, 'home.nextEvent.end', ne.end === undefined ? d.home.nextEvent.end : '');
  const nes = configTime(neStart, 'start');
  const nee = configTime(neEnd, 'end');
  if (nes !== null && nee !== null && nee <= nes) {
    r.err('home.nextEvent.end', 'is before the start, so the event would end before it began; it is left out');
    neEnd = '';
  }
  const home: SiteConfig['home'] = {
    sections: homeSections,
    featuredDeck,
    featuredEvent,
    nextEvent: {
      name: r.text(ne.name, 'home.nextEvent.name', d.home.nextEvent.name, LIMITS.eventName, { required: true }),
      start: neStart,
      end: neEnd,
      detail: r.text(ne.detail, 'home.nextEvent.detail', d.home.nextEvent.detail, LIMITS.eventDetail),
    },
  };

  const p = r.obj(o.play, 'play', ['defaultTier', 'tiers', 'board']);
  const tiersRaw = r.list(p.tiers, 'play.tiers', TIER_KEYS, d.play.tiers, { nonEmpty: true });
  const tiers = TIER_KEYS.filter((t) => tiersRaw.includes(t));
  let defaultTier = r.pick(p.defaultTier, 'play.defaultTier', TIER_KEYS, d.play.defaultTier);
  if (!tiers.includes(defaultTier)) {
    const fb = tiers.includes(d.play.defaultTier) ? d.play.defaultTier : (tiers[tiers.length - 1] as TierKey);
    r.err('play.defaultTier', `${defaultTier} is not one of the offered tiers; ${fb} is used`);
    defaultTier = fb;
  }
  const pb = r.obj(p.board, 'play.board', ['accent', 'boardBg', 'gigBg', 'cardBack', 'glow', 'frame', 'numerals', 'payMode', 'endTurn', 'confirmActions', 'panelPosition']);
  const play: SiteConfig['play'] = {
    defaultTier,
    tiers,
    board: {
      accent: r.pick(pb.accent, 'play.board.accent', ACCENTS, d.play.board.accent),
      boardBg: r.pick(pb.boardBg, 'play.board.boardBg', BOARD_BACKGROUNDS, d.play.board.boardBg),
      gigBg: r.pick(pb.gigBg, 'play.board.gigBg', GIG_BACKGROUNDS, d.play.board.gigBg),
      cardBack: r.pick(pb.cardBack, 'play.board.cardBack', CARD_BACKS, d.play.board.cardBack),
      glow: r.pick(pb.glow, 'play.board.glow', GLOWS, d.play.board.glow),
      frame: r.pick(pb.frame, 'play.board.frame', FRAMES, d.play.board.frame),
      numerals: r.pick(pb.numerals, 'play.board.numerals', NUMERALS, d.play.board.numerals),
      payMode: r.pick(pb.payMode, 'play.board.payMode', PAY_MODES, d.play.board.payMode),
      endTurn: r.pick(pb.endTurn, 'play.board.endTurn', END_TURN_MODES, d.play.board.endTurn),
      confirmActions: r.bool(pb.confirmActions, 'play.board.confirmActions', d.play.board.confirmActions),
      panelPosition: r.pick(pb.panelPosition, 'play.board.panelPosition', PANEL_POSITIONS, d.play.board.panelPosition),
    },
  };

  const dk = r.obj(o.decks, 'decks', ['hidden', 'sources', 'defaultSort']);
  const hidden: string[] = [];
  if (dk.hidden !== undefined && !Array.isArray(dk.hidden)) r.err('decks.hidden', 'must be a list of deck file names; nothing is hidden');
  else
    (dk.hidden ?? []).forEach((x: unknown, i: number) => {
      if (typeof x !== 'string' || !DECK_FILE.test(x) || x.length > LIMITS.deckFile) r.err(`decks.hidden[${i}]`, `${JSON.stringify(x)} is not a library deck file name; it is left out`);
      else if (!hidden.includes(x)) hidden.push(x);
    });
  if (hidden.length > LIMITS.hiddenDecks) {
    r.err('decks.hidden', `lists ${hidden.length} decks; the limit is ${LIMITS.hiddenDecks}`);
    hidden.length = LIMITS.hiddenDecks;
  }
  const decks: SiteConfig['decks'] = {
    hidden,
    sources: r.list(
      dk.sources,
      'decks.sources',
      SOURCES.map((s) => s.key),
      d.decks.sources,
      { nonEmpty: true },
    ),
    defaultSort: r.pick(dk.defaultSort, 'decks.defaultSort', SORTS, d.decks.defaultSort),
  };

  const m = r.obj(o.maintenance, 'maintenance', ['on', 'message', 'allowPlay']);
  const maintenance = {
    on: r.bool(m.on, 'maintenance.on', d.maintenance.on),
    message: r.text(m.message, 'maintenance.message', d.maintenance.message, LIMITS.maintenance, { multiline: true, required: true }),
    allowPlay: r.bool(m.allowPlay, 'maintenance.allowPlay', d.maintenance.allowPlay),
  };

  const mp = r.obj(o.multiplayer, 'multiplayer', ['iceServers', 'turnTimer', 'lockCodes', 'turnServers', 'turnCredentialsUrl', 'relayUrl']);
  const iceServers: string[] = [];
  if (mp.iceServers === undefined) iceServers.push(...d.multiplayer.iceServers);
  else if (!Array.isArray(mp.iceServers)) {
    r.err('multiplayer.iceServers', 'must be a list of STUN addresses; the default is used');
    iceServers.push(...d.multiplayer.iceServers);
  } else
    mp.iceServers.forEach((x: unknown, i: number) => {
      if (typeof x !== 'string' || x.length > LIMITS.iceServer || !STUN_URL.test(x)) r.err(`multiplayer.iceServers[${i}]`, `${JSON.stringify(x)?.slice(0, 60)} is not a STUN address such as stun:stun.example.com:3478; it is left out`);
      else if (iceServers.length >= MAX_ICE_SERVERS) r.err(`multiplayer.iceServers[${i}]`, `only ${MAX_ICE_SERVERS} servers are used; it is left out`);
      else if (!iceServers.includes(x)) iceServers.push(x);
    });
  let turnTimer: TurnTimer = d.multiplayer.turnTimer;
  if (mp.turnTimer !== undefined) {
    if (typeof mp.turnTimer === 'number' && (TURN_TIMERS as readonly number[]).includes(mp.turnTimer)) turnTimer = mp.turnTimer as TurnTimer;
    else r.err('multiplayer.turnTimer', `must be one of ${TURN_TIMERS.join(', ')} (seconds; 0 = off); the default is used`);
  }
  const turn = parseTurnServers(mp.turnServers, 'multiplayer.turnServers');
  for (const e of turn.problems) r.err(e.path, e.message);
  let turnCredentialsUrl = r.text(mp.turnCredentialsUrl, 'multiplayer.turnCredentialsUrl', '', LIMITS.link);
  if (turnCredentialsUrl && !isCredentialsUrl(turnCredentialsUrl)) {
    r.err('multiplayer.turnCredentialsUrl', 'must be an https:// address (http:// only on localhost); none is used');
    turnCredentialsUrl = '';
  }
  let relayUrl = r.text(mp.relayUrl, 'multiplayer.relayUrl', '', LIMITS.link);
  if (relayUrl && !isRelayUrl(relayUrl)) {
    r.err('multiplayer.relayUrl', 'must be a wss:// address (ws:// only on localhost); the relay is off');
    relayUrl = '';
  }
  const multiplayer = {
    iceServers,
    turnTimer,
    lockCodes: r.bool(mp.lockCodes, 'multiplayer.lockCodes', d.multiplayer.lockCodes),
    turnServers: turn.servers,
    turnCredentialsUrl,
    relayUrl,
  };

  const md = r.obj(o.multiDay, 'multiDay', ['minDays', 'maxDays', 'defaultDays', 'maxOngoing']);
  const [dLo, dHi] = MULTI_DAY_BOUNDS.days;
  const whole = (v: unknown, path: string, fallback: number, lo: number, hi: number): number => {
    if (v === undefined) return fallback;
    if (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi) return v;
    r.err(path, `must be a whole number from ${lo} to ${hi}; the default (${fallback}) is used`);
    return fallback;
  };
  let minDays = whole(md.minDays, 'multiDay.minDays', d.multiDay.minDays, dLo, dHi);
  let maxDays = whole(md.maxDays, 'multiDay.maxDays', d.multiDay.maxDays, dLo, dHi);
  if (minDays > maxDays) {
    r.err('multiDay.maxDays', `is shorter than multiDay.minDays (${minDays}); the defaults are used for both`);
    minDays = d.multiDay.minDays;
    maxDays = d.multiDay.maxDays;
  }
  let defaultDays = whole(md.defaultDays, 'multiDay.defaultDays', d.multiDay.defaultDays, dLo, dHi);
  if (defaultDays < minDays || defaultDays > maxDays) {
    const fb = Math.min(maxDays, Math.max(minDays, d.multiDay.defaultDays));
    r.err('multiDay.defaultDays', `${defaultDays} is outside ${minDays}–${maxDays} days; ${fb} is used`);
    defaultDays = fb;
  }
  const maxOngoing = whole(md.maxOngoing, 'multiDay.maxOngoing', d.multiDay.maxOngoing, MULTI_DAY_BOUNDS.ongoing[0], MULTI_DAY_BOUNDS.ongoing[1]);
  const multiDay = { minDays, maxDays, defaultDays, maxOngoing };

  const config: SiteConfig = { kind: SITE_CONFIG_KIND, schema: SITE_CONFIG_SCHEMA, site: cfgSite, nav, features, banner, home, play, decks, maintenance, multiplayer, multiDay };
  // Home and Play cannot both be off: a visitor would land on nothing useful
  if (!pageOn(config, 'home') && !pageOn(config, 'play')) {
    r.err('nav', 'Home and Play cannot both be hidden; Play is shown');
    const sec = config.nav.sections.find((s) => s.id === 'play');
    if (sec) {
      sec.hidden = false;
      for (const pg of sec.pages) pg.hidden = false;
    }
  }
  return { config, errors, warnings };
}

/** A list of { id, hidden } in the owner's order: unknown or repeated ids are dropped, missing ones added at the end. */
function parseOrdered<T extends string>(r: Reader, v: unknown, path: string, all: readonly T[], fallback: { id: T; hidden: boolean }[]): { id: T; hidden: boolean }[] {
  if (v === undefined) return fallback;
  if (!Array.isArray(v)) {
    r.err(path, 'must be a list; the default is used');
    return fallback;
  }
  const out: { id: T; hidden: boolean }[] = [];
  v.forEach((x, i) => {
    const o = r.obj(x, `${path}[${i}]`, ['id', 'hidden']);
    if (typeof o.id !== 'string' || !(all as readonly string[]).includes(o.id)) return r.err(`${path}[${i}].id`, `${JSON.stringify(o.id)} is not one of ${all.join(', ')}; it is left out`);
    if (out.some((y) => y.id === o.id)) return r.err(`${path}[${i}].id`, `${o.id} is listed twice; the second is left out`);
    out.push({ id: o.id as T, hidden: r.bool(o.hidden, `${path}[${i}].hidden`, false) });
  });
  for (const id of all) if (!out.some((y) => y.id === id)) out.push({ id, hidden: false });
  return out;
}

function parseNav(r: Reader, v: unknown, d: SiteConfig): SiteConfig['nav'] {
  const o = r.obj(v, 'nav', ['sections']);
  if (o.sections === undefined) return d.nav;
  if (!Array.isArray(o.sections)) {
    r.err('nav.sections', 'must be a list; the default is used');
    return d.nav;
  }
  const out: NavSectionConfig[] = [];
  o.sections.forEach((x: unknown, i: number) => {
    const path = `nav.sections[${i}]`;
    const s = r.obj(x, path, ['id', 'label', 'hidden', 'pages']);
    const cat = NAV_CATALOG.find((c) => c.id === s.id);
    if (!cat) return r.err(`${path}.id`, `${JSON.stringify(s.id)} is not one of ${SECTION_IDS.join(', ')}; it is left out`);
    if (out.some((y) => y.id === cat.id)) return r.err(`${path}.id`, `${cat.id} is listed twice; the second is left out`);
    const pages: NavPageConfig[] = [];
    if (s.pages !== undefined && !Array.isArray(s.pages)) r.err(`${path}.pages`, 'must be a list; the default is used');
    else
      ((s.pages as unknown[] | undefined) ?? []).forEach((y, j) => {
        const pp = `${path}.pages[${j}]`;
        const pg = r.obj(y, pp, ['path', 'label', 'hidden']);
        if (typeof pg.path !== 'string' || !cat.pages.includes(pg.path)) return r.err(`${pp}.path`, `${JSON.stringify(pg.path)} is not a page of ${cat.id} (${cat.pages.join(', ')}); it is left out`);
        if (pages.some((z) => z.path === pg.path)) return r.err(`${pp}.path`, `${pg.path} is listed twice; the second is left out`);
        pages.push({ path: pg.path, label: r.text(pg.label, `${pp}.label`, PAGE_LABEL[pg.path] ?? pg.path, LIMITS.navLabel, { required: true }), hidden: r.bool(pg.hidden, `${pp}.hidden`, false) });
      });
    for (const p of cat.pages) if (!pages.some((z) => z.path === p)) pages.push({ path: p, label: PAGE_LABEL[p] ?? p, hidden: false });
    out.push({ id: cat.id, label: r.text(s.label, `${path}.label`, cat.label, LIMITS.navLabel, { required: true }), hidden: r.bool(s.hidden, `${path}.hidden`, false), pages });
  });
  for (const c of NAV_CATALOG) if (!out.some((y) => y.id === c.id)) out.push(defaultSiteConfig().nav.sections.find((s) => s.id === c.id)!);
  return { sections: out };
}

/** Parse the file's text (JSON); a JSON syntax error is one error and the defaults. */
export function parseSiteConfigText(text: string): ParsedSiteConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    return { config: defaultSiteConfig(), errors: [{ path: '', message: `the file is not valid JSON (${(e as Error).message}); the defaults are used` }], warnings: [] };
  }
  return parseSiteConfig(raw);
}

/** The file's text for a config (what the editor downloads and copies). */
export function siteConfigText(c: SiteConfig): string {
  return `${JSON.stringify(c, null, 2)}\n`;
}

/** An issue as one line ("banner.link: must be …"). */
export const issueLine = (i: ConfigIssue) => (i.path ? `${i.path}: ${i.message}` : i.message);

// ---------------------------------------------------------------- reading the config

export const featureOn = (c: SiteConfig, f: FeatureName): boolean => c.features[f];

/** The catalogue section a route belongs to (its own pages or the extra ones). */
export function catalogSectionOf(path: string) {
  return NAV_CATALOG.find((s) => s.pages.includes(path) || s.extra.includes(path));
}

/** Whether a route is on: its tab is shown, the page itself is shown (extra pages follow their tab) and its features are on.
 *  Routes outside the catalogue (#/admin, unknown ones) are not gated here. */
export function pageOn(c: SiteConfig, path: string): boolean {
  const cat = catalogSectionOf(path);
  if (!cat) return true;
  const sec = c.nav.sections.find((s) => s.id === cat.id);
  if (!sec || sec.hidden) return false;
  if ((PAGE_FEATURES[path] ?? []).some((f) => !c.features[f])) return false;
  if (cat.pages.includes(path)) return !sec.pages.find((p) => p.path === path)?.hidden;
  // an extra page is on while its tab shows any page
  return sec.pages.some((p) => !p.hidden && (PAGE_FEATURES[p.path] ?? []).every((f) => c.features[f]));
}

export interface NavSection {
  id: SectionId;
  label: string;
  icon: string;
  /** the tab's link: its first shown page */
  landing: string;
  /** the shown pages in the owner's order, with their labels */
  pages: { path: string; label: string }[];
  /** every route that counts as this tab (shown pages and the extra pages) */
  routes: string[];
  subnav: boolean;
}

/** The nav as visitors see it: shown tabs in order, each with its shown pages; a tab with no page on is left out. */
export function visibleNav(c: SiteConfig): NavSection[] {
  const out: NavSection[] = [];
  for (const s of c.nav.sections) {
    const cat = NAV_CATALOG.find((x) => x.id === s.id);
    if (!cat || s.hidden) continue;
    const pages = s.pages.filter((p) => pageOn(c, p.path)).map((p) => ({ path: p.path, label: p.label }));
    if (!pages.length) continue;
    out.push({ id: s.id, label: s.label, icon: cat.icon, landing: pages[0]!.path, pages, routes: [...pages.map((p) => p.path), ...cat.extra.filter((e) => pageOn(c, e))], subnav: cat.subnav });
  }
  return out;
}

/**
 * Where the next event stands at `now`: before its start, between start and end, or over (only with an end date; with
 * none it stays underway until the config is edited). Home shows a countdown, "Event underway", or nothing.
 */
export function nextEventPhase(ev: { start: string; end: string }, now: number): 'upcoming' | 'underway' | 'finished' {
  const start = configTime(ev.start, 'start');
  const end = configTime(ev.end, 'end');
  if (end !== null && now >= end) return 'finished';
  return start !== null && now < start ? 'upcoming' : 'underway';
}

/** Where '#/' goes: Home when it is on, else the first shown tab's page. */
export function landingPage(c: SiteConfig): string {
  if (pageOn(c, 'home')) return 'home';
  return visibleNav(c)[0]?.landing ?? 'play';
}

/** A page's label as configured (the catalogue default for pages outside the nav lists). */
export function pageLabel(c: SiteConfig, path: string): string {
  for (const s of c.nav.sections) {
    const p = s.pages.find((x) => x.path === path);
    if (p) return p.label;
  }
  return PAGE_LABEL[path] ?? path;
}

/**
 * The browser tab's title for a page (UX-20): "Page · Site", its label as the nav shows it (the route's own name for
 * pages outside the nav); the site title alone on Home; "Page not found · Site" for an unknown route (`page` null).
 */
export function documentTitle(c: SiteConfig, page: { path: string; label: string } | null): string {
  const site = c.site.title;
  if (!page) return `Page not found · ${site}`;
  if (page.path === 'home') return site;
  const inNav = c.nav.sections.some((s) => s.pages.some((p) => p.path === page.path));
  return `${inNav ? pageLabel(c, page.path) : page.label} · ${site}`;
}

/** Text with [label](link) links, split into parts; a link that is not safe stays plain text (`bad`). */
export function linkSegments(text: string): { text: string; href?: string; bad?: boolean }[] {
  const out: { text: string; href?: string; bad?: boolean }[] = [];
  const re = /\[([^\]\n]{1,80})\]\(([^)\s]{1,500})\)/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    const i = m.index ?? 0;
    if (i > at) out.push({ text: text.slice(at, i) });
    if (isSafeLink(m[2]!)) out.push({ text: m[1]!, href: m[2]! });
    else out.push({ text: m[0], bad: true });
    at = i + m[0].length;
  }
  if (at < text.length) out.push({ text: text.slice(at) });
  return out;
}

// ---------------------------------------------------------------- the banner

/** Whether the banner shows at `now`: it has text and `now` is inside its start and end. */
export function bannerActive(b: BannerConfig, now: number = Date.now()): boolean {
  if (!b.text.trim()) return false;
  const s = configTime(b.start, 'start');
  const e = configTime(b.end, 'end');
  if (s !== null && now < s) return false;
  if (e !== null && now >= e) return false;
  return true;
}

/** A short hash of a text (FNV-1a, 32 bits, hex): a dismissed banner is remembered by its text. */
export function textHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const BANNER_DISMISS_KEY = 'nct.banner.dismissed.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;

function dismissedList(store: Store | null): string[] {
  try {
    const v: unknown = JSON.parse(store?.getItem(BANNER_DISMISS_KEY) ?? '[]');
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
/** Whether this browser dismissed a banner with this text (a changed text shows again). */
export function bannerDismissed(b: BannerConfig, store: Store | null): boolean {
  return b.dismissible && dismissedList(store).includes(textHash(b.text));
}
/** Remember the dismissal (the last 20 texts). */
export function dismissBanner(b: BannerConfig, store: Store | null): void {
  const h = textHash(b.text);
  const list = [...dismissedList(store).filter((x) => x !== h), h].slice(-20);
  try {
    store?.setItem(BANNER_DISMISS_KEY, JSON.stringify(list));
  } catch {
    /* storage blocked: dismissed for this visit only */
  }
}
