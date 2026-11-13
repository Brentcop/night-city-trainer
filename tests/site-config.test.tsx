// The owner's site config (src/lib/siteConfig.ts, public/site-config.json, docs/SITE_CONFIG.md): the parser and its
// fallbacks, feature gating, the nav, the banner's dates and dismissal, the hooks into hidden decks and board defaults,
// and the editor at #/admin (its file reads back to the same config). Server-rendered: there is no DOM here.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  bannerActive,
  bannerDismissed,
  cleanText,
  defaultSiteConfig,
  dismissBanner,
  FEATURES,
  isSafeLink,
  landingPage,
  LIMITS,
  linkSegments,
  pageOn,
  parseSiteConfig,
  parseSiteConfigText,
  siteConfigText,
  textHash,
  visibleNav,
  type SiteConfig,
} from '../src/lib/siteConfig';
import { EVENT } from '../src/content/event';
import { loadHidden, setHidden, setSiteHiddenDecks, SHOWN_KEY } from '../src/lib/hiddenDecks';
import { defaultBoardSettings, loadBoardSettings, setSiteBoardDefaults } from '../src/lib/boardSettings';
import { featureEnabled, previewDraft, siteConfig } from '../src/ui/useSiteConfig';
import { MaintenancePage, PageOff, SiteBanner } from '../src/ui/components/SiteChrome';
import { AdminPage, draftFileText, draftIssues, moveItem } from '../src/ui/pages/Admin';

const ROOT = path.resolve(__dirname, '..');
function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
  setSiteHiddenDecks([]);
  setSiteBoardDefaults({});
});

/** The defaults with a change applied. */
const withC = (fn: (c: SiteConfig) => void): SiteConfig => {
  const c = defaultSiteConfig();
  fn(c);
  return c;
};
const parseObj = (fn: (o: Record<string, unknown> & SiteConfig) => void) => {
  const o = JSON.parse(siteConfigText(defaultSiteConfig()));
  fn(o);
  return parseSiteConfig(o);
};

describe('the committed file', () => {
  it('public/site-config.json parses to exactly the defaults, with no problem', () => {
    const p = parseSiteConfigText(fs.readFileSync(path.join(ROOT, 'public/site-config.json'), 'utf8'));
    expect(p.errors).toEqual([]);
    expect(p.warnings).toEqual([]);
    expect(p.config).toEqual(defaultSiteConfig());
  });
  it('is LF and the defaults keep the next event of src/content/event.ts', () => {
    expect(fs.readFileSync(path.join(ROOT, 'public/site-config.json'), 'utf8')).not.toMatch(/\r/);
    const ne = defaultSiteConfig().home.nextEvent;
    expect(ne.name).toBe(EVENT.name);
    expect(new Date(ne.start).getTime()).toBe(EVENT.start.getTime());
  });
});

describe('parser', () => {
  it('a file that is not a site config gives the defaults and one error', () => {
    for (const raw of [null, [], 'x', { kind: 'other', schema: 1 }, { kind: 'nct-site-config', schema: 2 }]) {
      const p = parseSiteConfig(raw);
      expect(p.config).toEqual(defaultSiteConfig());
      expect(p.errors).toHaveLength(1);
    }
    expect(parseSiteConfigText('{nope').errors[0]!.message).toMatch(/not valid JSON/);
  });
  it('missing keys take their defaults silently; unknown keys are warned about and ignored', () => {
    const p = parseSiteConfig({ kind: 'nct-site-config', schema: 1, extra: 1, site: { title: 'X', colour: 'red' } });
    expect(p.errors).toEqual([]);
    expect(p.warnings.map((w) => w.path)).toEqual(['extra', 'site.colour']);
    expect(p.config).toEqual(withC((c) => (c.site.title = 'X')));
  });
  it('checks each field on its own and falls back for that field only', () => {
    const p = parseObj((o) => {
      o.site.title = 5 as unknown as string;
      o.features.coach = 'no' as unknown as boolean;
      o.features.chat = true;
      o.banner.level = 'loud' as 'info';
      o.play.board.accent = 'purple' as 'yellow';
      o.decks.defaultSort = 'size' as 'rating';
    });
    expect(p.errors.map((e) => e.path).sort()).toEqual(['banner.level', 'decks.defaultSort', 'features.coach', 'play.board.accent', 'site.title']);
    expect(p.config).toEqual(withC((c) => (c.features.chat = true)));
  });
  it('caps text, strips control characters, keeps it plain text', () => {
    const p = parseObj((o) => {
      o.site.title = 'A'.repeat(LIMITS.title + 5);
      o.banner.text = 'Hi\u0007 <b>there</b>\nnow';
      o.maintenance.message = 'Line 1\r\nLine 2';
    });
    expect(p.config.site.title).toHaveLength(LIMITS.title);
    expect(p.errors.map((e) => e.path)).toEqual(['site.title']);
    expect(p.config.banner.text).toBe('Hi <b>there</b> now'); // text, rendered escaped
    expect(p.config.maintenance.message).toBe('Line 1\nLine 2');
    expect(cleanText('a\u0000b\tc')).toBe('ab c');
    const html = renderToStaticMarkup(<SiteBanner banner={p.config.banner} preview />);
    expect(html).toContain('&lt;b&gt;there&lt;/b&gt;');
    expect(html).not.toContain('<b>there');
  });
  it('a required text left empty takes its default', () => {
    const p = parseObj((o) => (o.site.title = '   '));
    expect(p.config.site.title).toBe('Night City Trainer');
    expect(p.errors[0]!.path).toBe('site.title');
  });
  it('links: hash routes and https only', () => {
    for (const ok of ['#/play', '#/decks?src=meta,ladder&sort=rating', 'https://example.com/a?b=1']) expect(isSafeLink(ok)).toBe(true);
    for (const bad of ['javascript:alert(1)', 'http://example.com', '//evil.com', '#/a"b', 'https://', 'data:text/html,x', '#/<x>', 'https://a b.com']) expect(isSafeLink(bad)).toBe(false);
    const p = parseObj((o) => (o.banner.link = 'javascript:alert(1)'));
    expect(p.config.banner.link).toBe('');
    expect(p.errors[0]!.path).toBe('banner.link');
  });
  it('footer links: [label](link), an unsafe one stays plain text and is reported', () => {
    expect(linkSegments('see [Credits](#/credits).')).toEqual([{ text: 'see ' }, { text: 'Credits', href: '#/credits' }, { text: '.' }]);
    expect(linkSegments('[x](javascript:1)')).toEqual([{ text: '[x](javascript:1)', bad: true }]);
    expect(parseObj((o) => (o.site.footer = 'a [x](http://e.com)')).errors[0]!.path).toBe('site.footer');
  });
  it('dates: YYYY-MM-DD or ISO date-time; a bad one is left out, an end before the start is reported', () => {
    expect(parseObj((o) => (o.banner.start = '2026-02-30')).errors[0]!.path).toBe('banner.start');
    expect(parseObj((o) => (o.banner.start = 'tomorrow')).config.banner.start).toBe('');
    expect(parseObj((o) => (o.banner.start = '2026-12-01T10:00:00Z')).errors).toEqual([]);
    expect(parseObj((o) => ((o.banner.start = '2026-12-05'), (o.banner.end = '2026-12-01'))).errors[0]!.path).toBe('banner.end');
    const ne = parseObj((o) => (o.home.nextEvent.start = 'soon'));
    expect(ne.config.home.nextEvent.start).toBe(defaultSiteConfig().home.nextEvent.start);
  });
  it('tiers: known ones in their own order, never empty; the default tier must be offered', () => {
    expect(parseObj((o) => (o.play.tiers = ['hard', 'easy', 'hard', 'mega' as 'hard'])).config.play.tiers).toEqual(['easy', 'hard']);
    const empty = parseObj((o) => (o.play.tiers = []));
    expect(empty.config.play.tiers).toEqual(['easy', 'medium', 'hard']);
    const notOffered = parseObj((o) => ((o.play.tiers = ['easy', 'medium']), (o.play.defaultTier = 'hard')));
    expect(notOffered.config.play.defaultTier).toBe('medium');
    expect(notOffered.errors.map((e) => e.path)).toEqual(['play.defaultTier']);
  });
  it('decks: file names only for hidden decks and the featured deck; known sources, never none', () => {
    const p = parseObj((o) => {
      o.decks.hidden = ['meta-a.txt', 'meta-a.txt', 'custom:Mine', '../x.txt', 7 as unknown as string];
      o.decks.sources = ['meta', 'web' as 'meta'];
      o.home.featuredDeck = '<script>';
      (o.home as Record<string, unknown>).featuredEvent = 3;
    });
    expect(p.config.decks.hidden).toEqual(['meta-a.txt']);
    expect(p.config.decks.sources).toEqual(['meta']);
    expect(p.config.home.featuredDeck).toBe('');
    expect(p.config.home.featuredEvent).toBe('3');
    expect(p.errors.map((e) => e.path)).toEqual(['home.featuredDeck', 'decks.hidden[2]', 'decks.hidden[3]', 'decks.hidden[4]', 'decks.sources[1]']);
    expect(parseObj((o) => (o.decks.sources = [])).config.decks.sources).toEqual(defaultSiteConfig().decks.sources);
  });
  it('nav: the owner order wins; unknown and repeated entries drop out, missing ones come back at the end', () => {
    const p = parseObj((o) => {
      const s = o.nav.sections;
      o.nav.sections = [s[2]!, { ...s[0]!, label: 'Start' }, s[2]!, { id: 'shop' } as never, { ...s[3]!, pages: [{ path: 'ratings', label: 'Ratings', hidden: false }, { path: 'home', label: 'x', hidden: false }] }];
    });
    expect(p.config.nav.sections.map((s) => s.id)).toEqual(['play', 'home', 'tournaments', 'decks', 'learn', 'profile']);
    expect(p.config.nav.sections[1]!.label).toBe('Start');
    expect(p.config.nav.sections[2]!.pages.map((x) => x.path)).toEqual(['ratings', 'tournaments', 'run', 'seasons', 'meta', 'arena']);
    expect(p.errors.map((e) => e.path)).toEqual(['nav.sections[2].id', 'nav.sections[3].id', 'nav.sections[4].pages[1].path']);
  });
  it('Home and Play cannot both be hidden (Play comes back)', () => {
    const p = parseObj((o) => {
      o.nav.sections.find((s) => s.id === 'home')!.hidden = true;
      o.nav.sections.find((s) => s.id === 'play')!.pages[0]!.hidden = true;
    });
    expect(p.errors.map((e) => e.path)).toEqual(['nav']);
    expect(pageOn(p.config, 'play')).toBe(true);
    expect(pageOn(p.config, 'home')).toBe(false);
    // one of them hidden is fine
    expect(parseObj((o) => (o.nav.sections.find((s) => s.id === 'home')!.hidden = true)).errors).toEqual([]);
  });
});

describe('features and pages', () => {
  it('every feature has a default, and every one is on', () => {
    const d = defaultSiteConfig();
    expect(Object.keys(d.features).sort()).toEqual([...FEATURES].sort());
    expect(FEATURES.filter((f) => !d.features[f])).toEqual([]);
  });
  it('multi-day games: whole days within bounds, min ≤ default ≤ max, and a cap on ongoing games', () => {
    expect(defaultSiteConfig().multiDay).toEqual({ minDays: 3, maxDays: 20, defaultDays: 7, maxOngoing: 8 });
    const ok = parseObj((o) => (o.multiDay = { minDays: 1, maxDays: 30, defaultDays: 10, maxOngoing: 3 }));
    expect(ok.errors).toEqual([]);
    expect(ok.config.multiDay).toEqual({ minDays: 1, maxDays: 30, defaultDays: 10, maxOngoing: 3 });
    const bad = parseObj((o) => (o.multiDay = { minDays: 2.5, maxDays: 99, defaultDays: 7, maxOngoing: 0 }));
    expect(bad.config.multiDay).toEqual({ minDays: 3, maxDays: 20, defaultDays: 7, maxOngoing: 8 });
    expect(bad.errors.map((e) => e.path)).toEqual(['multiDay.minDays', 'multiDay.maxDays', 'multiDay.maxOngoing']);
    const swapped = parseObj((o) => (o.multiDay = { minDays: 10, maxDays: 5, defaultDays: 7, maxOngoing: 8 }));
    expect(swapped.config.multiDay).toMatchObject({ minDays: 3, maxDays: 20 });
    const outside = parseObj((o) => (o.multiDay = { minDays: 3, maxDays: 5, defaultDays: 9, maxOngoing: 8 }));
    expect(outside.config.multiDay.defaultDays).toBe(5);
    expect(outside.errors.map((e) => e.path)).toEqual(['multiDay.defaultDays']);
  });
  it('multiplayer: STUN servers checked one by one (empty = same network only), the turn timer from a fixed list', () => {
    expect(defaultSiteConfig().multiplayer).toEqual({ iceServers: ['stun:stun.l.google.com:19302'], turnTimer: 0 });
    const p = parseObj((o) => {
      o.multiplayer = { iceServers: ['stun:a.example.com:3478', 'turn:x.example.com', 'stuns:b.example.com', 'stun:a.example.com:3478', 5 as unknown as string], turnTimer: 45 as 0 };
    });
    expect(p.config.multiplayer).toEqual({ iceServers: ['stun:a.example.com:3478', 'stuns:b.example.com'], turnTimer: 0 });
    expect(p.errors.map((e) => e.path)).toEqual(['multiplayer.iceServers[1]', 'multiplayer.iceServers[4]', 'multiplayer.turnTimer']);
    const none = parseObj((o) => (o.multiplayer = { iceServers: [], turnTimer: 60 }));
    expect(none.errors).toEqual([]);
    expect(none.config.multiplayer).toEqual({ iceServers: [], turnTimer: 60 });
  });
  it('a feature that is off turns its pages off', () => {
    const d = defaultSiteConfig();
    for (const p of ['home', 'lab', 'run', 'tuned', 'profile', 'u', 'deck', 'admin', 'nowhere']) expect(pageOn(d, p)).toBe(true);
    const c = withC((x) => ((x.features.deckLab = false), (x.features.tournamentRunner = false), (x.features.tunedDecks = false), (x.features.profileSharing = false)));
    expect(['lab', 'run', 'tuned', 'u'].map((p) => pageOn(c, p))).toEqual([false, false, false, false]);
    expect(pageOn(c, 'profile')).toBe(true);
    const noProfile = withC((x) => (x.features.profile = false));
    expect([pageOn(noProfile, 'profile'), pageOn(noProfile, 'u')]).toEqual([false, false]);
  });
  it('featureEnabled reads the config in effect (here: a previewed draft, then the published one)', () => {
    expect(featureEnabled('coach')).toBe(true);
    expect(featureEnabled('multiDayGames')).toBe(true);
    previewDraft(siteConfigText(withC((c) => ((c.features.coach = false), (c.features.multiDayGames = false)))));
    expect([featureEnabled('coach'), featureEnabled('multiDayGames')]).toEqual([false, false]);
    previewDraft(null);
    expect([featureEnabled('coach'), featureEnabled('multiDayGames')]).toEqual([true, true]);
    expect(siteConfig()).toEqual(defaultSiteConfig());
  });
});

describe('nav', () => {
  it('the defaults are today’s tabs and sub-menus', () => {
    const nav = visibleNav(defaultSiteConfig());
    expect(nav.map((s) => `${s.icon} ${s.label} → ${s.landing}`)).toEqual(['⌂ Home → home', '▤ Decks → decks', '▶ Play → play', '🏆 Tournaments → tournaments', '♟ Learn → guides', '◉ Profile → profile']);
    expect(nav[1]!.pages.map((p) => p.label)).toEqual(['All decks', 'Tuned decks', 'Deck Lab']);
    expect(nav[1]!.routes).toContain('deck');
    expect(nav.filter((s) => s.subnav).map((s) => s.id)).toEqual(['decks', 'tournaments', 'learn']);
  });
  it('hidden tabs, hidden pages and pages of features that are off leave the nav; a tab with nothing left goes', () => {
    const c = withC((x) => {
      x.nav.sections.find((s) => s.id === 'learn')!.hidden = true;
      const decks = x.nav.sections.find((s) => s.id === 'decks')!;
      decks.pages[0]!.hidden = true; // the gallery
      decks.pages[1]!.label = 'My tuned';
      x.features.deckLab = false;
      x.features.profile = false;
    });
    const nav = visibleNav(c);
    expect(nav.map((s) => s.id)).toEqual(['home', 'decks', 'play', 'tournaments']);
    const decks = nav[1]!;
    expect(decks.landing).toBe('tuned');
    expect(decks.pages).toEqual([{ path: 'tuned', label: 'My tuned' }]);
    expect(pageOn(c, 'decks')).toBe(false);
    expect(pageOn(c, 'deck')).toBe(true); // a deck's profile follows its tab
    expect(pageOn(c, 'glossary')).toBe(false);
  });
  it('the start page is Home, else the first tab shown', () => {
    expect(landingPage(defaultSiteConfig())).toBe('home');
    expect(landingPage(withC((x) => (x.nav.sections.find((s) => s.id === 'home')!.hidden = true)))).toBe('decks');
  });
  it('a page turned off shows a plain notice', () => {
    const html = renderToStaticMarkup(<PageOff home="play" />);
    expect(html).toContain('This page is turned off');
    expect(html).toContain('href="#/play"');
  });
  it('maintenance shows the message, and the Play link only when Play stays open', () => {
    const c = withC((x) => ((x.maintenance.on = true), (x.maintenance.message = 'Back at 6.')));
    expect(renderToStaticMarkup(<MaintenancePage config={c} />)).toContain('Play against the bot');
    const closed = renderToStaticMarkup(<MaintenancePage config={withC((x) => ((x.maintenance.on = true), (x.maintenance.allowPlay = false)))} />);
    expect(closed).not.toContain('#/play');
    expect(renderToStaticMarkup(<MaintenancePage config={c} />)).toContain('Back at 6.');
  });
});

describe('banner', () => {
  const b = { ...defaultSiteConfig().banner, text: 'Store championship on Saturday', start: '2026-12-01', end: '2026-12-03' };
  it('shows inside its dates only (a date-only end lasts to the end of that day, local time)', () => {
    expect(bannerActive(b, new Date(2026, 10, 30, 23, 59).getTime())).toBe(false);
    expect(bannerActive(b, new Date(2026, 11, 1, 0, 0).getTime())).toBe(true);
    expect(bannerActive(b, new Date(2026, 11, 3, 23, 59).getTime())).toBe(true);
    expect(bannerActive(b, new Date(2026, 11, 4, 0, 0).getTime())).toBe(false);
    expect(bannerActive({ ...b, start: '', end: '' }, 0)).toBe(true);
    expect(bannerActive({ ...b, text: '  ' }, new Date(2026, 11, 2).getTime())).toBe(false);
    expect(bannerActive({ ...b, start: '2026-12-01T12:00:00Z', end: '' }, Date.parse('2026-12-01T11:59:00Z'))).toBe(false);
  });
  it('a dismissal is remembered by the text: a new text shows again', () => {
    const st = memoryStorage();
    expect(bannerDismissed(b, st)).toBe(false);
    dismissBanner(b, st);
    expect(bannerDismissed(b, st)).toBe(true);
    expect(bannerDismissed({ ...b, text: 'Another notice' }, st)).toBe(false);
    expect(bannerDismissed({ ...b, dismissible: false }, st)).toBe(false);
    expect(st.getItem('nct.banner.dismissed.v1')).toBe(JSON.stringify([textHash(b.text)]));
    expect(textHash('a')).toMatch(/^[0-9a-f]{8}$/);
    expect(textHash('a')).not.toBe(textHash('b'));
  });
  it('renders its text, link and level; none when it is not showing', () => {
    const html = renderToStaticMarkup(<SiteBanner banner={{ ...b, link: 'https://example.com', linkText: 'Details', level: 'warning' }} now={new Date(2026, 11, 2).getTime()} />);
    expect(html).toContain('site-banner-warning');
    expect(html).toContain('role="alert"');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('Dismiss this notice');
    expect(renderToStaticMarkup(<SiteBanner banner={b} now={new Date(2027, 0, 1).getTime()} />)).toBe('');
  });
});

describe('decks and board defaults', () => {
  it('decks the site hides are hidden by default; a visitor can unhide one, and hide it again', () => {
    setSiteHiddenDecks(['meta-a.txt', 'meta-b.txt']);
    expect([...loadHidden()].sort()).toEqual(['meta-a.txt', 'meta-b.txt']);
    expect(setHidden(['meta-a.txt'], false)).toBe(true);
    expect([...loadHidden()]).toEqual(['meta-b.txt']);
    expect(localStorage.getItem(SHOWN_KEY)).toBe('["meta-a.txt"]');
    setHidden(['meta-c.txt'], true); // the visitor's own hiding works as before
    expect([...loadHidden()].sort()).toEqual(['meta-b.txt', 'meta-c.txt']);
    setHidden(['meta-a.txt'], true);
    expect([...loadHidden()].sort()).toEqual(['meta-a.txt', 'meta-b.txt', 'meta-c.txt']);
    expect(localStorage.getItem(SHOWN_KEY)).toBeNull();
    setSiteHiddenDecks([]);
    expect([...loadHidden()].sort()).toEqual(['meta-a.txt', 'meta-c.txt']);
  });
  it('board defaults apply to visitors with nothing saved; saved settings win', () => {
    setSiteBoardDefaults({ accent: 'cyan', boardBg: 'plain', gigBg: 'dots', payMode: 'before', endTurn: 'auto', panelPosition: 'left' });
    const st = memoryStorage();
    const fresh = loadBoardSettings(st);
    expect([fresh.accent, fresh.boardBg, fresh.gigBg, fresh.payMode, fresh.endTurn, fresh.panel.position]).toEqual(['cyan', 'plain', 'dots', 'before', 'auto', 'left']);
    expect(defaultBoardSettings().accent).toBe('cyan');
    st.setItem('nct.boardSettings.v1', JSON.stringify({ v: 1, accent: 'green' }));
    expect(loadBoardSettings(st).accent).toBe('green');
    // settings saved before the End turn choice existed take the site's default for it; a saved choice wins
    expect(loadBoardSettings(st).endTurn).toBe('auto');
    st.setItem('nct.boardSettings.v1', JSON.stringify({ v: 1, endTurn: 'click' }));
    expect(loadBoardSettings(st).endTurn).toBe('click');
  });
});

describe('the editor (#/admin)', () => {
  it('renders every group, the security note, the actions and the instructions', () => {
    const html = renderToStaticMarkup(<AdminPage />);
    for (const t of ['Site config editor', 'not a security boundary', 'Load current', 'Reset to defaults', 'Download site-config.json', 'Copy JSON', 'Preview this draft in this browser only', 'Commit and push to main'])
      expect(html).toContain(t);
    for (const g of ['Site', 'Navigation', 'Features', 'Announcement banner', 'Home page', 'Play', 'Decks', 'Maintenance']) expect(html).toContain(`<legend>${g}</legend>`);
    expect(html).not.toContain('Problems');
  });
  it('shows validation messages for a draft with problems, and holds back the download', () => {
    const html = renderToStaticMarkup(<AdminPage initial={withC((c) => ((c.site.title = 'T'.repeat(80)), (c.banner.link = 'http://x.com')))} />);
    expect(html).toContain('banner.link: must be a page of this site');
    expect(html).toContain('site.title: is 80 characters long; the limit is 60');
    expect(html).toMatch(/<button type="button" class="primary" disabled="">Download site-config.json/);
  });
  it('its file reads back to exactly the draft', () => {
    const draft = withC((c) => {
      c.site.title = 'Arasaka Trainer';
      c.banner = { text: 'Hello', link: '#/play', linkText: 'Play', level: 'warning', start: '2026-12-01', end: '2026-12-24T18:00:00+01:00', dismissible: false };
      c.nav.sections = moveItem(c.nav.sections, 0, 1);
      c.nav.sections[0]!.pages = moveItem(c.nav.sections[0]!.pages, 2, -1);
      c.home.sections = moveItem(c.home.sections, 4, -1);
      c.home.featuredDeck = 'meta-rrg-dexter-midrange.txt';
      c.play = { defaultTier: 'medium', tiers: ['easy', 'medium'], board: { accent: 'amber', boardBg: 'neon', gigBg: 'glow', payMode: 'after', endTurn: 'auto', panelPosition: 'bottom' } };
      c.decks = { hidden: ['meta-a.txt'], sources: ['meta', 'nc'], defaultSort: 'name' };
      c.features.chat = true;
      c.maintenance = { on: true, message: 'Two\nlines', allowPlay: false };
    });
    expect(draftIssues(draft)).toEqual({ errors: [], warnings: [] });
    const back = parseSiteConfigText(draftFileText(draft));
    expect(back.errors).toEqual([]);
    expect(back.config).toEqual(draft);
    expect(moveItem([1, 2, 3], 0, -1)).toEqual([1, 2, 3]);
  });
});
