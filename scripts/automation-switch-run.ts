// The logic of scripts/automation-switch.ts: whether a site feature or an automation setting is on in the committed site
// config, read the way the site reads it (parseSiteConfigText, featureOn and the `automation` section,
// src/lib/siteConfig.ts; a key the file does not name takes its default). The file system is handed in, so the tests
// run it on invented files.
import { ArgError, bool, parseArgs, str, usageOf } from './lib-node';
import { AUTOMATION_INFO, AUTOMATION_KEYS, FEATURE_INFO, FEATURES, featureOn, issueLine, parseSiteConfigText, type AutomationKey, type FeatureName } from '../src/lib/siteConfig';

export interface SwitchIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** a file's text, or null when it does not exist */
  read: (file: string) => string | null;
  append: (file: string, text: string) => void;
}

export const SITE_CONFIG_FILE = 'public/site-config.json';
const FLAGS = { config: str(SITE_CONFIG_FILE), 'github-output': str(), summary: str(), json: bool() };

/** What a name asks for: a feature ("outsideMeta"), or an automation setting ("automation.series"). */
type Target = { kind: 'feature'; name: FeatureName } | { kind: 'automation'; name: AutomationKey };
const AUTOMATION_NAMES = AUTOMATION_KEYS.map((k) => `automation.${k}`);

function target(name: string): Target {
  if (!name.includes('.')) {
    if (!(FEATURES as readonly string[]).includes(name)) throw new ArgError(`no feature "${name}"; the features are ${FEATURES.join(', ')}`);
    return { kind: 'feature', name: name as FeatureName };
  }
  if (!AUTOMATION_NAMES.includes(name)) throw new ArgError(`no setting "${name}"; the automation settings are ${AUTOMATION_NAMES.join(', ')}`);
  return { kind: 'automation', name: name.slice('automation.'.length) as AutomationKey };
}

/**
 * Prints "on" or "off" for a feature or a switch of the automation section (automation.series, automation.arrivals),
 * the value for a number (automation.width, automation.maxGamesPerRun), or with --json the whole automation section as
 * one JSON object; exits 0. With --github-output FILE it also appends `on=true` / `on=false` (a switch) or `value=N` (a
 * number) to FILE (a GitHub Actions step output), and with --summary FILE a notice when a switch is off. Exits 1 when
 * the config file is missing or has an error (the site's own check, check:data, refuses it too: a person must look), 2
 * on a bad command line or a name the site does not have.
 */
export function automationSwitch(argv: string[], io: SwitchIO): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./automation-switch.ts', import.meta.url).href));
    return 0;
  }
  let t: Target | null = null;
  let V: { config: string; 'github-output': string | undefined; summary: string | undefined; json: boolean };
  try {
    const parsed = parseArgs(FLAGS, argv, { minPositionals: 0, maxPositionals: 1 });
    V = parsed.values;
    const name = parsed.positionals[0];
    if (V.json) {
      if (name !== undefined && name !== 'automation') throw new ArgError('--json prints the whole automation section; name no setting (or name "automation")');
    } else {
      if (name === undefined) throw new ArgError('name a feature (e.g. outsideMeta) or an automation setting (e.g. automation.series), or pass --json');
      t = target(name);
    }
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    io.err(`error: ${e.message}\nRun with --help for usage.`);
    return 2;
  }
  const what = t ? (t.kind === 'feature' ? t.name : `automation.${t.name}`) : 'the automation section';
  const text = io.read(V.config);
  if (text === null) {
    io.err(`error: ${V.config} does not exist, so whether ${what} is on cannot be read; nothing runs.`);
    return 1;
  }
  const parsed = parseSiteConfigText(text);
  if (parsed.errors.length) {
    io.err(`error: ${V.config} has ${parsed.errors.length === 1 ? 'an error' : `${parsed.errors.length} errors`} (${parsed.errors.slice(0, 3).map(issueLine).join('; ')}); nothing runs until it is fixed.`);
    return 1;
  }
  const auto = parsed.config.automation;
  if (!t) {
    io.out(JSON.stringify(auto));
    if (V['github-output']) io.append(V['github-output'], `automation=${JSON.stringify(auto)}\n`);
    return 0;
  }
  if (t.kind === 'automation' && typeof auto[t.name] === 'number') {
    const v = auto[t.name];
    io.out(String(v));
    if (V['github-output']) io.append(V['github-output'], `value=${v}\n`);
    return 0;
  }
  const on = t.kind === 'feature' ? featureOn(parsed.config, t.name) : auto[t.name as 'series' | 'arrivals' | 'matchups'];
  io.out(on ? 'on' : 'off');
  if (V['github-output']) io.append(V['github-output'], `on=${on}\n`);
  if (!on && V.summary) {
    if (t.kind === 'feature')
      io.append(V.summary, `### ${FEATURE_INFO[t.name].label}: switched off\n\n\`features.${t.name}\` is off in ${V.config}, so this run stopped before reading any other site. Tick “${FEATURE_INFO[t.name].label}” in #/admin and commit the file to turn it back on.\n\n`);
    else
      io.append(V.summary, `### ${AUTOMATION_INFO[t.name].label}: switched off\n\n\`automation.${t.name}\` is off in ${V.config}, so this run plays nothing. Tick “${AUTOMATION_INFO[t.name].label}” in #/admin (Automatic jobs) and commit the file to turn it back on.\n\n`);
  }
  return 0;
}
