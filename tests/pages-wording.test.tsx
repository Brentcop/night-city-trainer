// Pages and wording from the review of 2026-11-13 (UX-8, UX-13…24, APP-8, APP-12, APP-14): each headline number named
// for what it is; the next event has an end; page titles and a skip link; replays open at the first move; the trash
// pile shows no power; visiting #/admin stores nothing; owner-only commands kept out of player copy; worker budgets.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSiteConfig, documentTitle, nextEventPhase, parseSiteConfig, siteConfigText, type SiteConfig } from '../src/lib/siteConfig';
import { EVENT, withLiveCountdown } from '../src/content/event';
import { ordinal } from '../src/lib/playedRecord';
import { BUILTIN } from '../src/lib/browserLibrary';
import { deckReports } from '../src/data/deckReportsData';
import { SEASONS } from '../src/data/index';
import { setArtEnabled } from '../src/ui/art';
import { RecommendedHeroView } from '../src/ui/pages/Home';
import { DeckTile } from '../src/ui/components/DeckIdentity';
import { IfPage } from '../src/ui/components/SiteChrome';
import { previewDraft } from '../src/ui/useSiteConfig';
import { shouldStoreDraft } from '../src/ui/pages/Admin';
import { ReplayBoard } from '../src/ui/components/ReplayBoard';
import { recordReplay } from '../src/lib/replayFrames';
import { makeTierBot } from '../src/ai/tiers';
import { TOURNAMENT_PLAN } from '../src/content/tournamentPlan';
import { budgetProblems, WORKER_BUDGET_KB, workerName } from '../tools/size-budget';

const ROOT = path.resolve(__dirname, '..');
const src = (f: string) => fs.readFileSync(path.join(ROOT, f), 'utf8');
beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k) });
  setArtEnabled(false);
});
afterEach(() => vi.unstubAllGlobals());
const withC = (fn: (c: SiteConfig) => void): SiteConfig => {
  const c = defaultSiteConfig();
  fn(c);
  return c;
};

describe('UX-8: each headline number is named for its source', () => {
  const leader = SEASONS.leaderboard[0]!;
  const d = BUILTIN.find((x) => x.file === leader.file)!;
  it('Home calls the Seasons figure a season rating, never "All-time rating", with a proper ordinal', () => {
    const html = renderToStaticMarkup(<RecommendedHeroView d={d} lib={BUILTIN} rep={deckReports(d.file)} />);
    expect(html).not.toContain('All-time rating');
    expect(html).toContain('Season rating');
    expect(html).toContain('vs the meta decks in the breeding seasons');
    expect(html).toContain(`${ordinal(leader.percentile)} percentile`);
  });
  it('the gallery tile says which number is which', () => {
    const html = renderToStaticMarkup(<DeckTile d={d} />);
    expect(html).toContain('season rating ·');
    expect(html).not.toMatch(/vs meta · \d+th pct/);
    expect(html).toContain('Swiss win rate: the raw record');
  });
  it('ordinals: 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st, 81st', () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 81, 112].map(ordinal)).toEqual(['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '81st', '112th']);
  });
  it('the guide names each rate once and carries no owner commands', () => {
    expect(TOURNAMENT_PLAN).not.toContain('Expected-field score');
    expect(TOURNAMENT_PLAN).not.toMatch(/npm run|npx tsx|reports\//);
    const register = TOURNAMENT_PLAN.split('\n').filter((l) => /^- \*\*(Power rating|Meta-weighted score)/.test(l) || l.includes('**Power rating:'));
    expect(register.length).toBeGreaterThan(0);
  });
});

describe('UX-19: owner commands are kept out of player copy', () => {
  it('the Matchup Lab, round robin, tournament runner, Deck Lab and event list show none', () => {
    for (const f of ['src/ui/pages/Arena.tsx', 'src/ui/pages/Meta.tsx', 'src/ui/pages/TournamentRunner.tsx', 'src/ui/pages/DeckLab.tsx', 'src/ui/pages/Tournaments.tsx'])
      expect(src(f), f).not.toMatch(/<code>(npm run|npx tsx)/);
  });
});

describe('APP-12: the next event ends', () => {
  it('the default has an end, and the committed file carries it', () => {
    expect(defaultSiteConfig().home.nextEvent.end).toBe(EVENT.endText);
    expect(src('public/site-config.json')).toContain(`"end": "${EVENT.endText}"`);
  });
  it('upcoming, underway, then finished (Home hides the bar); with no end it stays underway', () => {
    const ev = defaultSiteConfig().home.nextEvent;
    expect(nextEventPhase(ev, Date.parse('2026-12-01T00:00:00-06:00'))).toBe('upcoming');
    expect(nextEventPhase(ev, Date.parse('2026-12-12T12:00:00-06:00'))).toBe('underway');
    expect(nextEventPhase(ev, Date.parse('2027-01-01T00:00:00Z'))).toBe('finished');
    expect(nextEventPhase({ ...ev, end: '' }, Date.parse('2027-01-01T00:00:00Z'))).toBe('underway');
  });
  it('the parser takes an end, refuses one before the start, and an empty one means none', () => {
    const parse = (end: unknown) => parseSiteConfig(JSON.parse(siteConfigText(withC((c) => void (c.home.nextEvent.end = end as string)))));
    expect(parse('2026-12-20').config.home.nextEvent.end).toBe('2026-12-20');
    expect(parse('').config.home.nextEvent.end).toBe('');
    const before = parse('2026-12-01');
    expect(before.config.home.nextEvent.end).toBe('');
    expect(before.errors.map((e) => e.path)).toEqual(['home.nextEvent.end']);
    const bad = parse('soon');
    expect(bad.errors.map((e) => e.path)).toEqual(['home.nextEvent.end']);
  });
  it("the plan's countdown says when it has finished", () => {
    const md = '## Practice schedule (31 days to Chicago)';
    expect(withLiveCountdown(md, new Date('2026-12-12T09:00:00-06:00'))).toContain('(the event is underway)');
    expect(withLiveCountdown(md, new Date('2026-12-14T09:00:00-06:00'))).toContain('(the event has finished)');
  });
});

describe('UX-20: page titles and a skip link', () => {
  it('"Page · Site", the site alone on Home, the nav label as configured, and not-found', () => {
    const c = defaultSiteConfig();
    expect(documentTitle(c, { path: 'home', label: 'Home' })).toBe(c.site.title);
    expect(documentTitle(c, { path: 'ratings', label: 'Power ratings' })).toBe(`Power ratings · ${c.site.title}`);
    expect(documentTitle(c, { path: 'deck', label: 'Deck' })).toBe(`Deck · ${c.site.title}`);
    expect(documentTitle(c, null)).toBe(`Page not found · ${c.site.title}`);
  });
  it('the app sets document.title and starts with a skip link to the main region', () => {
    const app = src('src/App.tsx');
    expect(app).toContain('document.title = title');
    expect(app).toMatch(/className="skip-link"/);
    expect(app).toMatch(/<main className="main" id="main" tabIndex=\{-1\}/);
  });
});

describe('UX-15: "Watch" opens a replay at its first move', () => {
  it('the replay starts at move 1', async () => {
    const [a, b] = BUILTIN;
    const data = await recordReplay([a!.deck, b!.deck], [makeTierBot('easy', 1), makeTierBot('easy', 2)], 17, 0);
    const html = renderToStaticMarkup(<ReplayBoard data={data} names={['A', 'B']} />);
    expect(html).toMatch(/Turn 1 \/ \d+ · move 1 \/ \d+/);
    expect(html).toMatch(/class="replay-scrub"[^>]*value="0"/);
  }, 60_000);
});

describe('UX-18 / UX-22: board text', () => {
  it('pile titles say "1 card", the trash shows no power badge, the opening hand has no trailing separator', () => {
    const zones = src('src/ui/components/board/Zones.tsx');
    expect(zones).not.toMatch(/\.length\} cards/);
    expect(zones).toMatch(/<TcgCard def=\{g\.def\(top\)\} size="xs" noPower \/>/);
    expect(src('src/ui/components/board/Overlays.tsx')).toContain(".join(' · ')");
  });
});

describe('UX-23: visiting #/admin stores nothing', () => {
  it('the draft is stored only once it differs from what the page opened with, then on every change', () => {
    expect(shouldStoreDraft('A', 'A')).toBe(false);
    expect(shouldStoreDraft('A', 'B')).toBe(true);
    expect(shouldStoreDraft(null, 'A')).toBe(true);
  });
});

describe('APP-8: links to pages the owner can turn off are gated', () => {
  it('IfPage hides its link when the page is off', () => {
    previewDraft(siteConfigText(withC((c) => ((c.features.tunedDecks = false), (c.features.deckLab = false)))));
    try {
      expect(renderToStaticMarkup(<IfPage path="tuned">TUNED</IfPage>)).toBe('');
      expect(renderToStaticMarkup(<IfPage path="lab">LAB</IfPage>)).toBe('');
    } finally {
      previewDraft(null);
    }
    expect(renderToStaticMarkup(<IfPage path="tuned">TUNED</IfPage>)).toBe('TUNED');
  });
  it('every #/lab and #/tuned link in Profile and Deck Lab sits inside IfPage', () => {
    for (const f of ['src/ui/pages/Profile.tsx', 'src/ui/pages/DeckLab.tsx']) {
      const lines = src(f).split('\n');
      lines.forEach((l, i) => {
        const m = /href="#\/(lab|tuned)"/.exec(l);
        if (!m) return;
        const before = lines.slice(Math.max(0, i - 3), i + 1).join('\n');
        expect(before, `${f}:${i + 1}`).toContain(`<IfPage path="${m[1]}">`);
      });
    }
  });
});

describe('APP-14: worker size budget', () => {
  it('every worker has a budget, and the check names one over it, one without a budget and one missing', () => {
    const workers = fs.readdirSync(path.join(ROOT, 'src/sim')).filter((f) => f.endsWith('.worker.ts')).map((f) => f.replace('.worker.ts', ''));
    expect(Object.keys(WORKER_BUDGET_KB).sort()).toEqual(workers.sort());
    expect(workerName('assets/game.worker-CqcC5VWM.js')).toBe('game');
    expect(workerName('index-C87C-GsY.js')).toBeNull();
    const ok = Object.entries(WORKER_BUDGET_KB).map(([w, kb]) => ({ name: `${w}.worker-abc.js`, bytes: kb * 1000 - 1 }));
    expect(budgetProblems(ok)).toEqual([]);
    const over = budgetProblems([...ok.slice(1), { name: 'game.worker-x.js', bytes: 400_000 }, { name: 'new.worker-y.js', bytes: 10 }]);
    expect(over.some((p) => p.startsWith('game.worker-x.js: 400.0 kB is over its budget'))).toBe(true);
    expect(over.some((p) => p.startsWith('new.worker-y.js: a worker with no size budget'))).toBe(true);
    expect(budgetProblems(ok.slice(1))).toEqual(['the game worker was not built; update WORKER_BUDGET_KB in tools/size-budget.ts']);
  });
  it('the build runs the check', () => {
    expect(src('vite.config.ts')).toMatch(/plugins: \[react\(\), siteConfigInline\(\), workerBudget\(\), kbSitePack\(\), kbOwnFoldText\(\)\]/);
  });
});
