// The Regionals forecast page (#/forecast, feature `forecast`; src/ui/pages/Forecast.tsx): on by default (the owner, 2026-11-18), Tournaments →
// after Power ratings when on; lazy, out of the entry chunk; the engine reaches no engine, bot or sim code; the result
// view names every source and carries the table semantics (caption, row headers, sortable column headers).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultSiteConfig, FEATURE_INFO, PAGE_FEATURES, pageOn, parseSiteConfig, siteConfigText, visibleNav } from '../src/lib/siteConfig';
import { modelFromH2HFile, runForecast, tournamentOf } from '../src/lib/forecast';
import { uniformField, userField } from '../src/lib/forecastField';
import { FORECAST_WORDS, forecastVersionNote, sourceWords } from '../src/lib/forecastWords';
import { CURRENT_SIM_VERSION } from '../src/lib/playedRecord';
import { ForecastPage, ForecastResults } from '../src/ui/pages/Forecast';
import { importGraph, rel, ROOT } from './importGraph';

const h2h = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/h2h.json'), 'utf8'));

describe('the flag', () => {
  it('is on by default (the owner turned it on on 2026-11-18): the nav entry shows, and switched off in the editor it goes and the route is switched off', () => {
    expect(FEATURE_INFO.forecast.default).toBe(true);
    expect(PAGE_FEATURES.forecast).toEqual(['forecast']);
    const d = defaultSiteConfig();
    expect(pageOn(d, 'forecast')).toBe(true);
    expect(visibleNav(d).flatMap((s) => s.pages.map((p) => p.path))).toContain('forecast');
    const o = JSON.parse(siteConfigText(d));
    o.features.forecast = false;
    const off = parseSiteConfig(o).config;
    expect(pageOn(off, 'forecast')).toBe(false);
    expect(visibleNav(off).flatMap((s) => s.pages.map((p) => p.path))).not.toContain('forecast');
  });
  it('the page is Tournaments → Regionals forecast, after Power ratings', () => {
    const t = visibleNav(defaultSiteConfig()).find((s) => s.id === 'tournaments')!;
    const paths = t.pages.map((p) => p.path);
    expect(paths[paths.indexOf('ratings') + 1]).toBe('forecast');
    expect(t.pages.find((p) => p.path === 'forecast')!.label).toBe('Regionals forecast');
  });
  it('the committed site config leaves the forecast on', () => {
    const p = parseSiteConfig(JSON.parse(fs.readFileSync(path.join(ROOT, 'public/site-config.json'), 'utf8')));
    expect(p.errors).toEqual([]);
    expect(p.config.features.forecast).toBe(true);
  });
});

describe('where the code goes', () => {
  it('the page is lazy and out of the entry chunk', () => {
    const app = fs.readFileSync(path.join(ROOT, 'src/App.tsx'), 'utf8');
    expect(app).toContain("lazy(() => import('./ui/pages/Forecast')");
    const entry = [...importGraph([path.join(ROOT, 'src', 'main.tsx')])].map(rel);
    expect(entry).toContain('src/ui/pages/Home.tsx'); // the walk reached the entry's pages
    expect(entry).not.toContain('src/ui/pages/Forecast.tsx');
    expect(entry).not.toContain('src/lib/forecast.ts');
    expect(entry).not.toContain('src/lib/forecastField.ts');
  });
  it('the forecast reaches no engine, bot, sim or knowledge-pack code', () => {
    const graph = [...importGraph(['forecast.ts', 'forecastField.ts', 'forecastWords.ts'].map((f) => path.join(ROOT, 'src', 'lib', f)))].map(rel);
    expect(graph).toContain('src/lib/eventFormats.ts'); // the walk followed the imports
    expect(graph.filter((f) => /^src\/(engine|ai|sim|lib\/kb)\//.test(f))).toEqual([]);
  });
});

describe('the source line', () => {
  const src = (events: (number | string)[]) => ({ events, games: 4084, simVersion: 9, bot: 'hard', from: 'h2h-file' as const });
  it('names the events as a range, a list or one event, and rating runs apart', () => {
    expect(sourceWords(src([20, 21, 22, 23, 24]))).toBe('power ratings and head-to-heads of events 20 to 24 (4,084 games), simulator v9, the Hard bot');
    expect(sourceWords(src([20, 22]))).toContain('of events 20, 22 (');
    expect(sourceWords(src([20]))).toContain('of event 20 (');
    expect(sourceWords(src([20, 21, 22, 'run-1', 'run-2', 'run-3']))).toContain('of events 20 to 22 and rating runs 1 to 3 (');
    expect(sourceWords(src([20, 21, 22, 'run-4']))).toContain('of events 20 to 22 and rating run 4 (');
  });
});

describe('the page', () => {
  it('says what it is before anything loads', () => {
    const html = renderToStaticMarkup(<ForecastPage />);
    expect(html).toContain('Regionals forecast');
    expect(html).toContain(FORECAST_WORDS.what);
    expect(html).toContain('Loading the ratings');
  });
  const model = modelFromH2HFile(h2h);
  it('the result view names the tournament, the ratings, the field and the run; every range; a sortable table', () => {
    const field = uniformField(model.names);
    const res = runForecast(model, { weights: field.weights }, tournamentOf({ players: 32, top: 8 }), { draws: 3, trials: 10, seed: 1 });
    const html = renderToStaticMarkup(<ForecastResults result={res} field={field} names={model.names} />);
    expect(html).toContain('32 players, 5 Swiss rounds best of 3, top 8 played as single elimination');
    // the source line names what h2h.json pooled (sourceWords' own wording is pinned on fixtures below)
    expect(html).toContain(sourceWords(model.source));
    expect(html).toContain(`simulator v${h2h.manifest.simVersion}, the ${h2h.manifest.bot.level === 'hard' ? 'Hard' : h2h.manifest.bot.level} bot`);
    expect(html).toContain('assumed (no information about what people play)');
    expect(html).toContain('3 parameter draws × 10 tournaments each');
    expect(html).toContain('<caption class="sr-only">');
    expect(html).toContain('aria-sort="descending"');
    expect(html.match(/<th scope="row"/g)).toHaveLength(model.names.length);
    expect(html).toContain('href="#/deck?d=');
  });
  it('a model fitted on another simulator version is flagged; the current one adds nothing', () => {
    expect(forecastVersionNote({ simVersion: CURRENT_SIM_VERSION })).toBeNull();
    expect(forecastVersionNote({ simVersion: CURRENT_SIM_VERSION - 1 })).toBe(`The ratings behind this forecast were fitted on simulator v${CURRENT_SIM_VERSION - 1}, not the current v${CURRENT_SIM_VERSION}, so the forecast is historical.`);
    expect(forecastVersionNote({ simVersion: null })).toMatch(/an unversioned simulator/);
    const field = uniformField(model.names);
    const res = runForecast(model, { weights: field.weights }, tournamentOf({ players: 16, top: 4 }), { draws: 2, trials: 5, seed: 1 });
    const html = renderToStaticMarkup(<ForecastResults result={res} field={field} names={model.names} />);
    if (h2h.manifest.simVersion === CURRENT_SIM_VERSION) expect(html).not.toContain('so the forecast is historical');
    const old = { ...res, source: { ...res.source, simVersion: CURRENT_SIM_VERSION - 1 } };
    expect(renderToStaticMarkup(<ForecastResults result={old} field={field} names={model.names} />)).toContain(`fitted on simulator v${CURRENT_SIM_VERSION - 1}, not the current`);
  });
  it('a field with names it cannot place says how much was left out', () => {
    const field = userField(model.names, `${model.names[0]}: 3\nA deck we never rated: 1`);
    const res = runForecast(model, { weights: field.weights }, tournamentOf({ players: 16, top: 4 }), { draws: 2, trials: 5, seed: 1 });
    const html = renderToStaticMarkup(<ForecastResults result={res} field={field} names={model.names} />);
    expect(html).toContain('Left out: 25.0% of it.');
    expect(html).toContain('A deck we never rated: 25.0% of the field, not a rated library deck');
  });
});
