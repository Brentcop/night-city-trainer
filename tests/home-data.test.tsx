// WP-C1 (LIB-2, LIB-3, OPS-15, APP-21): the Home page's entry chunk carries only what its first paint needs. The large
// data files are reached only through dynamic imports from the entry, Home's hero keeps a placeholder for the numbers
// it loads at runtime, the tournament plan's day count is computed when shown, and allDecks() is cached.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadDeckReports, RecommendedHeroView } from '../src/ui/pages/Home';
import { allDecks, BUILTIN, CUSTOM_KEY, upsertCustom } from '../src/lib/browserLibrary';
import { daysUntil, EVENT, withLiveCountdown } from '../src/content/event';
import { RATINGS, REVIEW, SEASONS } from '../src/data/index';
import { DECK_REPORTS, deckReports } from '../src/data/deckReportsData';
import { ANALYSIS, telemetryReport } from '../src/data/analysisData';
import { TOURNAMENT_INDEX } from '../src/data/tournamentIndex';
import { recordedEventCount } from '../src/lib/deckLab';
import { setArtEnabled } from '../src/ui/art';

const ROOT = path.resolve(__dirname, '..');

/** Modules reachable from `entry` through static imports only (dynamic `import()` and `import type` don't count). */
function staticGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const exts = ['', '.ts', '.tsx', '/index.ts'];
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    const src = fs.readFileSync(file, 'utf8');
    // `import x from '…'`, `import '…'`, `export … from '…'`, but not `import type` / `export type`
    const re = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
    for (const m of src.matchAll(re)) {
      const spec = m[1];
      if (!spec.startsWith('.')) continue;
      const base = path.resolve(path.dirname(file), spec.replace(/\?.*$/, ''));
      const hit = exts.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
      if (hit) walk(hit);
    }
  };
  walk(path.join(ROOT, entry));
  return seen;
}

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}
beforeEach(() => {
  vi.stubGlobal('localStorage', memoryStorage());
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('entry chunk', () => {
  const graph = [...staticGraph('src/main.tsx')].map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
  it('reaches Home and its small data statically', () => {
    expect(graph).toContain('src/ui/pages/Home.tsx');
    expect(graph).toContain('src/data/ratings.json');
    expect(graph).toContain('src/data/seasons.json');
  });
  it('does not reach the large data files statically', () => {
    for (const big of ['src/data/analysis.json', 'src/data/deckReports.json', 'src/data/tournaments.json']) expect(graph).not.toContain(big);
  });
  it('(control) the walker does see them from a page that imports them', () => {
    const profile = [...staticGraph('src/ui/pages/DeckProfile.tsx')].map((f) => path.relative(ROOT, f).replace(/\\/g, '/'));
    for (const big of ['src/data/analysis.json', 'src/data/deckReports.json', 'src/data/tournaments.json']) expect(profile).toContain(big);
  });
});

describe('Home data at runtime', () => {
  const pick = BUILTIN.find((d) => DECK_REPORTS[d.file]?.finals) ?? BUILTIN[0];
  it('loads the deck reports on demand, once', async () => {
    const a = loadDeckReports();
    expect(loadDeckReports()).toBe(a);
    const m = await a;
    expect(m?.deckReports(pick.file)).toEqual(deckReports(pick.file));
  });
  it('the hero keeps a placeholder for the finals tile while they load, then shows the number', () => {
    setArtEnabled(false);
    const loading = renderToStaticMarkup(<RecommendedHeroView d={pick} lib={BUILTIN} rep={undefined} />);
    expect(loading).toContain('dp-tile is-loading');
    expect(loading).toContain('Finals vs meta');
    expect(loading).toContain(pick.deck.name);
    const done = renderToStaticMarkup(<RecommendedHeroView d={pick} lib={BUILTIN} rep={deckReports(pick.file)} />);
    expect(done).not.toContain('is-loading');
    expect(done).toContain('Finals vs meta');
  });
});

describe('typed data views', () => {
  it('read the bundled files', () => {
    expect(RATINGS.decks.length).toBeGreaterThan(0);
    expect(SEASONS.leaderboard.length).toBeGreaterThan(0);
    expect(REVIEW.decks.length).toBeGreaterThan(0);
    expect(ANALYSIS.decks.length).toBeGreaterThan(0);
    expect(telemetryReport(ANALYSIS.decks[0].deck)).toBe(ANALYSIS.decks[0]);
    expect(deckReports(undefined)).toEqual({});
  });
  it('Deck Lab counts recorded events without importing the index up front', async () => {
    expect(await recordedEventCount()).toBe(TOURNAMENT_INDEX.events.length);
  });
});

describe('tournament plan countdown', () => {
  const start = new Date('2026-12-11T09:00:00-06:00');
  it('counts days from now, not from when the plan was generated', () => {
    const md = '## Practice schedule (31 days to Chicago)\n1. Play.';
    expect(withLiveCountdown(md, new Date('2026-11-11T09:00:00-06:00'), start)).toBe('## Practice schedule (30 days to Chicago)\n1. Play.');
    expect(withLiveCountdown(md, new Date('2026-12-10T09:00:00-06:00'), start)).toContain('(1 day to Chicago)');
    expect(withLiveCountdown(md, new Date('2026-12-12T09:00:00-06:00'), start)).toContain('(the event is underway)');
    expect(withLiveCountdown('no heading', new Date(), start)).toBe('no heading');
  });
  it('uses the one event date', () => {
    expect(EVENT.start.getTime()).toBe(start.getTime());
    expect(daysUntil(start, new Date('2026-12-01T09:00:00-06:00'))).toBe(10);
  });
});

describe('deck library cache (APP-21)', () => {
  it('returns the same list while storage is unchanged, and a new one after a save', () => {
    const a = allDecks();
    expect(allDecks()).toBe(a);
    expect(upsertCustom({ name: 'Cached?', legends: [], main: [], sideboard: [] })).toBe(true);
    const b = allDecks();
    expect(b).not.toBe(a);
    expect(b.some((d) => d.file === 'custom:Cached?')).toBe(true);
    // a change made elsewhere (another tab, by hand) is picked up too
    localStorage.setItem(CUSTOM_KEY, '[]');
    expect(allDecks().some((d) => d.file === 'custom:Cached?')).toBe(false);
  });
});
