// The logic of scripts/automation-switch.ts: whether a site feature is on in the committed site config, read the way
// the site reads it (parseSiteConfigText and featureOn, src/lib/siteConfig.ts; a feature the file does not name takes
// its default). The file system is handed in, so the tests run it on invented files.
import { ArgError, parseArgs, str, usageOf } from './lib-node';
import { FEATURE_INFO, FEATURES, featureOn, issueLine, parseSiteConfigText, type FeatureName } from '../src/lib/siteConfig';

export interface SwitchIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** a file's text, or null when it does not exist */
  read: (file: string) => string | null;
  append: (file: string, text: string) => void;
}

export const SITE_CONFIG_FILE = 'public/site-config.json';
const FLAGS = { config: str(SITE_CONFIG_FILE), 'github-output': str(), summary: str() };

/**
 * Prints "on" or "off" for one feature and exits 0; with --github-output FILE also appends `on=true` or `on=false` to
 * FILE (a GitHub Actions step output), and with --summary FILE a notice when it is off. Exits 1 when the config file is
 * missing or has an error (the site's own check, check:data, refuses it too: a person must look), 2 on a bad command
 * line or a feature the site does not have.
 */
export function automationSwitch(argv: string[], io: SwitchIO): number {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./automation-switch.ts', import.meta.url).href));
    return 0;
  }
  let feature: FeatureName;
  let V: { config: string; 'github-output': string | undefined; summary: string | undefined };
  try {
    const parsed = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
    V = parsed.values;
    const name = parsed.positionals[0]!;
    if (!(FEATURES as readonly string[]).includes(name)) throw new ArgError(`no feature "${name}"; the features are ${FEATURES.join(', ')}`);
    feature = name as FeatureName;
  } catch (e) {
    if (!(e instanceof ArgError)) throw e;
    io.err(`error: ${e.message}\nRun with --help for usage.`);
    return 2;
  }
  const text = io.read(V.config);
  if (text === null) {
    io.err(`error: ${V.config} does not exist, so whether ${feature} is on cannot be read; nothing runs.`);
    return 1;
  }
  const parsed = parseSiteConfigText(text);
  if (parsed.errors.length) {
    io.err(`error: ${V.config} has ${parsed.errors.length === 1 ? 'an error' : `${parsed.errors.length} errors`} (${parsed.errors.slice(0, 3).map(issueLine).join('; ')}); nothing runs until it is fixed.`);
    return 1;
  }
  const on = featureOn(parsed.config, feature);
  io.out(on ? 'on' : 'off');
  if (V['github-output']) io.append(V['github-output'], `on=${on}\n`);
  if (!on && V.summary)
    io.append(V.summary, `### ${FEATURE_INFO[feature].label}: switched off\n\n\`features.${feature}\` is off in ${V.config}, so this run stopped before reading any other site. Tick “${FEATURE_INFO[feature].label}” in #/admin and commit the file to turn it back on.\n\n`);
  return 0;
}
