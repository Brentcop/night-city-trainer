// The owner's switches for the rating series (docs/SERIES.md, docs/SITE_CONFIG.md): the `automation` section of the site
// config (parsed and checked field by field, defaults when the file does not name it), the admin editor's fieldset, and
// scripts/automation-switch.ts reading it for the workflow (features keep working exactly as before).
import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AUTOMATION_BOUNDS, AUTOMATION_INFO, AUTOMATION_KEYS, defaultSiteConfig, parseSiteConfig, parseSiteConfigText, siteConfigText } from '../src/lib/siteConfig';
import { automationSwitch } from '../scripts/automation-switch-run';

const parse = (automation: unknown) => parseSiteConfig({ kind: 'nct-site-config', schema: 1, automation });

describe('the automation section', () => {
  it('defaults: the series and arrivals on, width 4, at most 12,000 games a run, the matchup block on (16 decks, 100 games a pair); a file that does not name it reads them', () => {
    expect(defaultSiteConfig().automation).toEqual({ series: true, arrivals: true, width: 4, maxGamesPerRun: 12_000, matchups: true, matchupDecks: 16, matchupGames: 100 });
    const bare = parseSiteConfig({ kind: 'nct-site-config', schema: 1 });
    expect(bare.errors).toEqual([]);
    expect(bare.config.automation).toEqual(defaultSiteConfig().automation);
    const committed = parseSiteConfigText(fs.readFileSync('public/site-config.json', 'utf8'));
    expect(committed.errors).toEqual([]);
    expect(Object.keys(committed.config.automation).sort()).toEqual([...AUTOMATION_KEYS].sort());
  });
  it('reads what the owner set, and round-trips through the editor\'s text', () => {
    const p = parse({ series: false, arrivals: true, width: 5.5, maxGamesPerRun: 3000, matchups: false, matchupDecks: 12, matchupGames: 60 });
    expect(p.errors).toEqual([]);
    expect(p.config.automation).toEqual({ series: false, arrivals: true, width: 5.5, maxGamesPerRun: 3000, matchups: false, matchupDecks: 12, matchupGames: 60 });
    expect(parseSiteConfigText(siteConfigText(p.config)).config.automation).toEqual(p.config.automation);
  });
  it('refuses, field by field, a value out of bounds or of the wrong kind (the default is used, check:data fails)', () => {
    const [wLo, wHi] = AUTOMATION_BOUNDS.width;
    const [gLo, gHi] = AUTOMATION_BOUNDS.maxGamesPerRun;
    for (const width of [wLo - 0.5, wHi + 0.5, 4.25, '4', null]) {
      const p = parse({ width });
      expect(p.errors.map((e) => e.path)).toEqual(['automation.width']);
      expect(p.config.automation.width).toBe(4);
    }
    for (const maxGamesPerRun of [gLo - 1, gHi + 1, 1000.5, '12000']) expect(parse({ maxGamesPerRun }).errors.map((e) => e.path)).toEqual(['automation.maxGamesPerRun']);
    for (const k of ['matchupDecks', 'matchupGames'] as const) {
      const [lo, hi] = AUTOMATION_BOUNDS[k];
      for (const v of [lo - 1, hi + 1, lo + 0.5, String(lo)]) {
        const p = parse({ [k]: v });
        expect(p.errors.map((e) => e.path)).toEqual([`automation.${k}`]);
        expect(p.config.automation[k]).toBe(defaultSiteConfig().automation[k]);
      }
    }
    expect(parse({ matchups: 1 }).errors.map((e) => e.path)).toEqual(['automation.matchups']);
    expect(parse({ series: 'yes' }).errors.map((e) => e.path)).toEqual(['automation.series']);
    expect(parse({ unknownJob: true }).warnings.map((e) => e.path)).toEqual(['automation.unknownJob']);
    expect(parse('on').errors.map((e) => e.path)).toEqual(['automation']);
  });
  it('every setting has plain-language help: when it takes effect, what it costs, and the search budget below 4', () => {
    for (const k of AUTOMATION_KEYS) expect(AUTOMATION_INFO[k].label.length).toBeGreaterThan(0);
    expect(AUTOMATION_INFO.series.help).toContain('next scheduled run');
    expect(AUTOMATION_INFO.series.help).toContain('free minutes');
    expect(AUTOMATION_INFO.width.help).toContain('first-search budget');
  });
});

describe('the admin editor', () => {
  it('has the fieldset "Automatic jobs (GitHub Actions)" with every setting', async () => {
    const { AdminPage } = await import('../src/ui/pages/Admin');
    const html = renderToStaticMarkup(<AdminPage initial={defaultSiteConfig()} />);
    expect(html).toContain('Automatic jobs (GitHub Actions)');
    for (const k of AUTOMATION_KEYS) expect(html).toContain(AUTOMATION_INFO[k].label);
    expect(html).toContain('takes effect at the next scheduled run');
    expect(html).toContain('±3 points (breaks the search budget)');
  });
});

describe('scripts/automation-switch.ts reads the section', () => {
  const run = (argv: string[], files: Record<string, string>) => {
    const out: string[] = [];
    const err: string[] = [];
    const appended: Record<string, string> = {};
    const code = automationSwitch(argv, { out: (l) => out.push(l), err: (l) => err.push(l), read: (f) => files[f] ?? null, append: (f, t) => (appended[f] = (appended[f] ?? '') + t) });
    return { code, out: out.join('\n'), err: err.join('\n'), appended };
  };
  const file = (automation: unknown) => ({ 'c.json': JSON.stringify({ kind: 'nct-site-config', schema: 1, automation }) });
  it('a switch prints on or off (defaults when unnamed), a number its value, --json the whole section', () => {
    expect(run(['automation.series', '--config', 'c.json'], file(undefined)).out).toBe('on');
    const off = run(['automation.arrivals', '--config', 'c.json', '--github-output', 'o', '--summary', 's'], file({ arrivals: false }));
    expect(off).toMatchObject({ code: 0, out: 'off', appended: { o: 'on=false\n' } });
    expect(off.appended.s).toContain('Rate new decks on arrival: switched off');
    const w = run(['automation.width', '--config', 'c.json', '--github-output', 'o'], file({ width: 6 }));
    expect(w).toMatchObject({ code: 0, out: '6', appended: { o: 'value=6\n' } });
    expect(run(['automation.maxGamesPerRun', '--config', 'c.json'], file(undefined)).out).toBe('12000');
    expect(run(['automation.matchups', '--config', 'c.json'], file({ matchups: false })).out).toBe('off');
    expect(run(['automation.matchupDecks', '--config', 'c.json'], file(undefined)).out).toBe('16');
    expect(run(['automation.matchupGames', '--config', 'c.json', '--github-output', 'o'], file({ matchupGames: 50 }))).toMatchObject({ code: 0, out: '50', appended: { o: 'value=50\n' } });
    expect(JSON.parse(run(['--json', '--config', 'c.json'], file({ series: false })).out)).toEqual({ ...defaultSiteConfig().automation, series: false });
  });
  it('keeps the exit codes: 1 for a missing or broken file, 2 for an unknown setting or a bad command line; features as before', () => {
    expect(run(['automation.series'], {}).code).toBe(1);
    expect(run(['automation.width', '--config', 'c.json'], file({ width: 99 })).code).toBe(1);
    expect(run(['automation.nope', '--config', 'c.json'], file(undefined)).code).toBe(2);
    expect(run(['automation.series', '--json', '--config', 'c.json'], file(undefined)).code).toBe(2);
    expect(run([], {}).code).toBe(2);
    expect(run(['outsideMeta', '--config', 'c.json'], { 'c.json': JSON.stringify({ kind: 'nct-site-config', schema: 1, features: { outsideMeta: false } }) }).out).toBe('off');
  });
});
