// The Search page (#/search, feature `search`; src/ui/pages/Search.tsx): off by default with no nav entry or link, on
// only with the flag; the empty page with its labelled box, status line and privacy sentence; a result of each kind with
// its label and link; draft, stale and "association, not value" marks; the "no match" state with example questions.
// Also the two small changes it brought: the glossary's own search no longer matches its JSON field names, and the
// Card stats page opens the view a link names (`?v=`). Rendered to static markup, as the other page tests are.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GLOSSARY } from '../src/content/glossary';
import { defaultSiteConfig, FEATURE_INFO, NAV_CATALOG, PAGE_FEATURES, pageOn, parseSiteConfig, siteConfigText, visibleNav } from '../src/lib/siteConfig';
import { buildIndex, search, type SearchResult } from '../src/lib/kb/search';
import { parseShard, SITE_EXAMPLES, SITE_SHARDS, siteShardFiles } from '../src/lib/kb/site';
import type { KbRecord } from '../src/lib/kb/types';
import { buildFromSources } from '../scripts/kb-sources';
import { SearchHit, SearchScreen, statusText, type SearchView } from '../src/ui/pages/Search';
import { termMatches } from '../src/ui/pages/Glossary';
import { InsightsPage } from '../src/ui/pages/Insights';

vi.mock('virtual:nct-kb-site', () => ({ default: { kind: 'nct-kb-site', schema: 1, pack: 'test', shards: [] } }));

const ROOT = path.resolve(__dirname, '..');
const files = siteShardFiles((await buildFromSources(ROOT, { raw: false })).records);
const records = files.flatMap((f) => parseShard(f.json, { name: f.name }));
const ix = buildIndex(records);
const rec = (id: string) => records.find((r) => r.id === id)!;
const first = (pred: (r: KbRecord) => boolean) => records.find(pred)!;
const done = (query: string, hits: KbRecord[], more: 'loading' | 'failed' | null = null): SearchView => ({
  status: 'done',
  query,
  more,
  result: { query, hits: hits.map((record) => ({ record, score: 1, ranks: {} })), noMatch: !hits.length, total: hits.length } satisfies SearchResult,
});
const html = (view: SearchView, q = view.status === 'idle' ? '' : view.query) => renderToStaticMarkup(<SearchScreen q={q} view={view} onQuery={() => {}} />);
const hitHtml = (r: KbRecord, q = 'x') => renderToStaticMarkup(<SearchHit r={r} query={q} />);

describe('the flag', () => {
  const on = () => {
    const o = JSON.parse(siteConfigText(defaultSiteConfig()));
    o.features.search = true;
    return parseSiteConfig(o).config;
  };

  it('starts off: no nav entry, the route is switched off', () => {
    expect(FEATURE_INFO.search.default).toBe(false);
    expect(PAGE_FEATURES.search).toEqual(['search']);
    const d = defaultSiteConfig();
    expect(d.features.search).toBe(false);
    expect(pageOn(d, 'search')).toBe(false);
    expect(visibleNav(d).flatMap((s) => s.pages.map((p) => p.path))).not.toContain('search');
    expect(visibleNav(d).flatMap((s) => s.routes)).not.toContain('search');
  });

  it('turned on, the page is Learn → Search', () => {
    const c = on();
    expect(pageOn(c, 'search')).toBe(true);
    const learn = visibleNav(c).find((s) => s.id === 'learn')!;
    expect(learn.pages.at(-1)).toEqual({ path: 'search', label: 'Search' });
    expect(NAV_CATALOG.find((s) => s.id === 'learn')!.pages).toContain('search');
  });

  it('the committed site config still parses to the defaults (search off) without naming it', () => {
    const text = fs.readFileSync(path.join(ROOT, 'public/site-config.json'), 'utf8');
    expect(text).not.toMatch(/"search"/);
    const p = parseSiteConfig(JSON.parse(text));
    expect(p.errors).toEqual([]);
    expect(p.config).toEqual(defaultSiteConfig());
  });

  it('nothing else on the site links to #/search', () => {
    const under = (dir: string): string[] =>
      fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? under(`${dir}/${e.name}`) : /\.(tsx?|json|html)$/.test(e.name) ? [`${dir}/${e.name}`] : []));
    const link = /href=\{?["'`]#\/search|<IfPage path="search"/;
    const hits = [...under('src'), 'index.html', 'public/site-config.json'].filter((f) => link.test(fs.readFileSync(path.join(ROOT, f), 'utf8')));
    expect(link.test('<a href="#/search">')).toBe(true);
    expect(hits).toEqual([]);
    // the route is registered like the other lazy pages, and the page is loaded only by it
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app).toContain("lazy(() => import('./ui/pages/Search')");
    expect(app).toContain("{ path: 'search', label: 'Search', el: () => <SearchPage /> }");
  });
});

describe('the page', () => {
  it('has a labelled search box, a status line read out as it changes, the privacy sentence and examples', () => {
    const h = html({ status: 'idle' });
    expect(h).toMatch(/<label for="([^"]+)-q"[^>]*>Your question<\/label>/);
    const id = /<label for="([^"]+)"/.exec(h)![1]!;
    expect(h).toContain(`id="${id}"`);
    expect(h).toMatch(/type="search"/);
    expect(h).toMatch(/role="status" aria-live="polite"/);
    expect(h).toContain('Your questions stay in this browser: the search runs here and sends them nowhere.');
    for (const x of SITE_EXAMPLES) expect(h).toContain(`>${x.replace(/'/g, '&#x27;')}</button>`);
    expect(h).toContain('<h1>Search</h1>');
  });

  it('says what is happening', () => {
    expect(statusText({ status: 'idle' })).toBe('');
    expect(statusText({ status: 'loading', query: 'q' })).toBe('Loading the search…');
    expect(statusText({ status: 'error', query: 'q' })).toMatch(/could not be loaded/);
    const card = rec('card:detonate');
    expect(statusText(done('q', [card]))).toBe('1 result.');
    expect(statusText(done('q', [card, card], 'loading'))).toBe('2 results, loading the statistics…');
    expect(statusText(done('q', [card], 'failed'))).toBe('1 result; the statistics could not be loaded.');
    expect(statusText(done('q', [], 'loading'))).toBe('Loading the statistics…');
    expect(statusText(done('q', []))).toBe('Nothing here answers that.');
  });

  it('"no match" says so plainly and offers example questions', () => {
    const q = 'xyzzy plugh frobnicate';
    const r = search(ix, q, { k: 8 });
    expect(r.noMatch).toBe(true);
    const h = html({ status: 'done', query: q, result: r, more: null });
    expect(h).toContain('Nothing here answers “xyzzy plugh frobnicate”.');
    expect(h).toContain('Try:');
    expect(h).not.toContain('kb-hits');
  });

  it('lists up to eight results, each in a list item, with the question in the list name', () => {
    const r = search(ix, 'Which decks play Detonate?', { k: 8 });
    expect(r.hits.length).toBeGreaterThan(0);
    expect(r.hits.length).toBeLessThanOrEqual(8);
    const h = html({ status: 'done', query: 'Which decks play Detonate?', result: r, more: null });
    expect(h).toContain('<ol class="panel kb-hits" aria-label="Results for Which decks play Detonate?">');
    expect(h.match(/<li class="kb-hit">/g)!.length).toBe(r.hits.length);
  });
});

describe('a result of each kind', () => {
  it('a card: its title opens the card (by id)', () => {
    const h = hitHtml(rec('card:detonate'));
    expect(h).toContain('<span class="tag">Card</span>');
    expect(h).toContain('Detonate');
    expect(h).toContain('Opens the card.');
    expect(h).not.toContain('<a href');
  });

  const page: [string, (r: KbRecord) => boolean, string, RegExp][] = [
    ['Deck', (r) => r.kind === 'deck', 'Deck profile', /href="#\/deck\?d=[^"]+\.txt"/],
    ['Game plan', (r) => r.kind === 'objective', 'Game plan on the deck profile', /href="#\/deck\?d=[^"]+\.txt"/],
    ['Synergy package', (r) => r.kind === 'package', 'Card stats: Synergies', /href="#\/insights\?v=synergies"/],
    ['Glossary', (r) => r.kind === 'term' && !r.fields?.vocabulary, 'Glossary', /href="#\/glossary\?q=[^"]+"/],
    ['Guide', (r) => r.kind === 'guide', 'Strategy guide', /href="#\/guides\?g=[^"]+"/],
    ['Event', (r) => r.kind === 'event', 'Event page', /href="#\/tournaments\?e=\d+"/],
    ['Round', (r) => r.kind === 'round', 'Event page', /href="#\/tournaments\?e=\d+"/],
    ['Rating', (r) => r.kind === 'rating', 'Power ratings', /href="#\/ratings"/],
    ['Matchup', (r) => r.kind === 'matchup', 'Matchups on the deck profile', /href="#\/deck\?d=[^"]+\.txt"/],
    ['Card statistics', (r) => r.kind === 'cardstat' && r.id.includes('/'), 'Card stats: Decisions', /href="#\/insights\?d=[^"&]+&amp;v=decisions"/],
    ['Card statistics', (r) => r.kind === 'cardstat' && !r.id.includes('/'), 'Card stats: Decisions', /href="#\/insights\?v=decisions"/],
    ['Package statistics', (r) => r.kind === 'pkgstat' && r.id.includes('/'), 'Synergies on the deck profile', /href="#\/deck\?d=[^"]+\.txt"/],
    ['Package statistics', (r) => r.kind === 'pkgstat' && !r.id.includes('/'), 'Card stats: Synergies', /href="#\/insights\?v=synergies"/],
  ];
  for (const [label, pick, where, href] of page)
    it(`${label}: links to ${where}`, () => {
      const r = first(pick);
      const h = hitHtml(r);
      expect(h).toContain(`<span class="tag">${label}</span>`);
      expect(h).toMatch(href);
      expect(h).toContain(`On the site: ${where}.`);
    });

  it('a signal or condition term has no page of its own and says so', () => {
    const h = hitHtml(first((r) => r.kind === 'term' && !!r.fields?.vocabulary));
    expect(h).toContain('<span class="tag">Glossary</span>');
    expect(h).toContain('Not on a page of its own on this site.');
    expect(h).not.toContain('<a href');
  });

  it('measured records say what they rest on; statistics keep their association wording; drafts and stale records are marked', () => {
    const ev = hitHtml(rec('event:7'));
    expect(ev).toMatch(/Measured from the \w+ bot&#x27;s games on sim version \d+, recorded \d{4}-\d{2}-\d{2}\./);
    const stat = hitHtml(first((r) => r.kind === 'cardstat'));
    expect(stat).toMatch(/associations, not the value of the card and not advice\./);
    const plan = hitHtml(first((r) => r.kind === 'objective' && r.status === 'draft'));
    expect(plan).toContain('>draft</span>');
    const m = first((r) => r.kind === 'matchup');
    expect(hitHtml(m)).not.toContain('stale');
    expect(hitHtml({ ...m, fields: { ...m.fields, stale: true } })).toContain('<span class="tag kb-stale" title="Measured on an older version of the simulator">stale</span>');
    expect(hitHtml(rec('card:detonate'))).not.toContain('Measured from');
  });

  it('shows a short excerpt near the question', () => {
    const r = first((x) => x.kind === 'cardstat');
    const h = hitHtml(r, 'late');
    const text = /<p class="kb-hit-text">([\s\S]*?)<\/p>/.exec(h)![1]!;
    expect(text.length).toBeLessThan(400);
  });
});

describe('two small changes on the way', () => {
  it('the glossary search reads the terms, not their JSON field names', () => {
    // every term has the fields "term", "group" and "def": those words no longer match every term
    for (const word of ['term', 'group', 'def']) expect(GLOSSARY.filter((t) => termMatches(t, word)).length, word).toBeLessThan(GLOSSARY.length);
    expect(GLOSSARY.filter((t) => termMatches(t, '"def"'))).toEqual([]);
    expect(GLOSSARY.filter((t) => termMatches(t, 'blocker')).map((t) => t.term)).toContain('Blocker');
    expect(GLOSSARY.filter((t) => termMatches(t, '')).length).toBe(GLOSSARY.length);
    const withBot = GLOSSARY.find((t) => t.bot)!;
    expect(termMatches(withBot, withBot.bot!.slice(0, 20))).toBe(true);
  });

  it('Card stats opens the view a link names', () => {
    const pressed = (h: string) => /aria-pressed="true"[^>]*>([^<]+)</.exec(h)?.[1];
    expect(pressed(renderToStaticMarkup(<InsightsPage />))).toContain('Draws');
    expect(pressed(renderToStaticMarkup(<InsightsPage view="synergies" />))).toBe('Synergies');
    expect(pressed(renderToStaticMarkup(<InsightsPage view="decisions" />))).toBe('Decisions');
    expect(pressed(renderToStaticMarkup(<InsightsPage view="nonsense" />))).toContain('Draws');
  });
});

// the shards every first search needs are the ones named in the plan
it('the plan of shards matches what the page loads first', () => {
  expect(SITE_SHARDS.filter((s) => !s.late).map((s) => s.name)).toEqual(['core', 'events']);
});
