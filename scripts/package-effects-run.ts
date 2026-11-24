// The logic of scripts/package-effects.ts (whose header is the usage): each synergy package of a library list measured
// in pairs, the list against the same list with the package taken out, on the same games (src/ai/packageEffect.ts;
// docs/SYNERGIES.md "The package's effect, measured in pairs"). The game runner, the output and the clock are handed in,
// so tests run it without playing a game.
import fs from 'node:fs';
import path from 'node:path';
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { CATALOGUE_VERSION, SYNERGY_BY_ID } from '../src/content/synergies';
import { cardValue } from '../src/ai/knowledge';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { PACKAGE_EFFECTS_KIND, PACKAGE_EFFECTS_PATH, PACKAGE_EFFECTS_SCHEMA, packageEffectsProblems, type PackageEffectFile, type PackageEffectRow, type PackageEffectSkip } from '../src/ai/packageEffect';
import { ledgerBot } from '../src/lib/changeLedger';
import { removePackage } from '../src/lib/deckPackages';
import { normalQuantile, scoreOf } from '../src/lib/evidence';
import type { LibraryDeck } from '../src/lib/library';
import { listPackages, type ListPackageSource } from '../src/lib/listPackages';
import { pairedGroup } from '../src/lib/pairedSplit';
import { gameRunManifest } from '../src/lib/runManifest';
import { SIM_VERSION } from '../src/lib/tournament';
import type { GameCache } from './game-cache';
import { ArgError, bool, int, loadLibrary, oneOf, parseArgs, resolveDeck, SIM_BOTS, str, threadsOpt, usageOf } from './lib-node';
import { remeasureJobs } from './remeasure-run';
import type { MatchJob, MatchResult } from './worker';

export const PACKAGE_EFFECTS_SCRIPT = 'scripts/package-effects.ts';
export const DEFAULT_GAMES = 1120;
/** Seeds 9,000,000 + k: apart from the forge's, the season's and remeasure's (5,000,000) blocks. */
export const DEFAULT_SEED = 9_000_000;
/** Two-sided error over a list's packages together (Bonferroni: each package gets ALPHA / family). */
export const ALPHA = 0.05;
/**
 * Seconds of one game on one thread, for the estimate (docs/BOT_TOOLKIT.md, "Faster bots, the same games", 2026-11-16:
 * Hard 1.10–1.56 s on the meta pairings, Medium 0.043–0.044 s; Easy about 0.01 s). A shared machine is slower.
 */
export const GAME_SECONDS: Readonly<Record<string, number>> = { easy: 0.01, medium: 0.044, hard: 1.3 };
/** The per-game spread of a package move assumed for the estimate's detectable effect (DEFAULT_SD / HARD_SD in src/lib/deckSearch.ts). */
export const PACKAGE_SD: Readonly<Record<string, number>> = { medium: 0.55, hard: 0.6 };

export const FLAGS = {
  bot: oneOf(SIM_BOTS, 'hard'),
  games: int(DEFAULT_GAMES, { min: 1 }),
  seed: int(DEFAULT_SEED, { min: 0 }),
  threads: threadsOpt(),
  cache: bool(),
  out: str(),
  'notes-only': bool(),
  estimate: bool(),
  force: bool(),
  'dry-run': bool(),
};

/** What the command reads from and writes to (the real ones in scripts/package-effects.ts, stubs in tests). */
export interface PackageEffectsIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** play the jobs, results in job order (runJobs) */
  play: (jobs: MatchJob[], o: { threads: number; cache?: GameCache }) => Promise<Pick<MatchResult, 'winner'>[]>;
  cache?: (on: boolean) => GameCache | undefined;
  now?: () => Date;
  /** the deck library (default: loadLibrary()) */
  library?: () => LibraryDeck[];
}

export class PackageEffectsRefusal extends Error {
  constructor(
    message: string,
    readonly code: 1 | 2 = 2,
  ) {
    super(message);
  }
}
const refuse = (message: string, code: 1 | 2 = 2): never => {
  throw new PackageEffectsRefusal(message, code);
};

// ---------------------------------------------------------------- what is measured

/** One package of a list and the list without it, or why it cannot be measured. */
export type PackagePlanItem = { pkg: string; without: DeckList; cardsOut: string[]; cardsIn: string[] } | { pkg: string; why: string };

export interface ListPlan {
  file: string;
  deck: DeckList;
  listId: string;
  /** where the packages came from (src/lib/listPackages.ts) */
  source: ListPackageSource;
  items: PackagePlanItem[];
}

export const measurable = (x: PackagePlanItem): x is Extract<PackagePlanItem, { without: DeckList }> => 'without' in x;

/**
 * The list's packages (listPackages, with the note of its file in hand) and, for each, the list without it:
 * removePackage with the hand-written card value as the score (bot-free, so the lists do not move when a telemetry
 * table is rebuilt) and the list's other packages kept, so only this package's own pieces go.
 */
export function listPlan(d: Pick<LibraryDeck, 'file' | 'deck'>): ListPlan {
  const found = listPackages(d.deck, { note: DECK_OBJECTIVES[d.file]?.synergies });
  const items = found.ids.map((pkg): PackagePlanItem => {
    const others = found.ids.filter((x) => x !== pkg);
    const m = removePackage(d.deck, pkg, { score: cardValue, plan: { keep: others }, ascii: true });
    if (!m) return { pkg, why: `no legal list without ${SYNERGY_BY_ID[pkg]?.name ?? pkg} keeps the list's other packages (${others.map((x) => SYNERGY_BY_ID[x]?.name ?? x).join(', ') || 'none'})` };
    return { pkg, without: m.deck, cardsOut: [...m.cardsOut].sort(), cardsIn: [...m.cardsIn].sort() };
  });
  return { file: d.file, deck: d.deck, listId: listFingerprint(d.deck), source: found.source, items };
}

/** The games of one list on the forge's layout (remeasureJobs: game k plays meta deck k mod n with seed + k). */
export const listJobs = (list: DeckList, field: readonly DeckList[], games: number, seed: number, bot: string): MatchJob[] => remeasureJobs(list, list, field, games, seed, bot).slice(0, games);

/** Games a plan plays: the list once, and each measurable package's list without it. */
export const planGames = (p: ListPlan, games: number) => (p.items.some(measurable) ? games * (1 + p.items.filter(measurable).length) : 0);

// ---------------------------------------------------------------- the numbers

/** z of the two-sided interval for one of `family` packages measured on one list (Bonferroni). */
export const familyZ = (family: number) => normalQuantile(1 - ALPHA / 2 / Math.max(1, family));

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** One package's row from the list's scores and the scores without it (same games, same order). */
export function effectRow(o: { plan: ListPlan; item: Extract<PackagePlanItem, { without: DeckList }>; withScores: readonly number[]; withoutScores: readonly number[]; family: number; bot: string; seed: number; opponents: string[]; date: string }): PackageEffectRow {
  const d = o.withScores.map((x, i) => x - o.withoutScores[i]!);
  const g = pairedGroup(d);
  const z = familyZ(o.family);
  const clamp = (x: number) => Math.max(-1, Math.min(1, x));
  return {
    listId: o.plan.listId,
    deck: o.plan.file,
    pkg: o.item.pkg,
    withoutListId: listFingerprint(o.item.without),
    cardsOut: o.item.cardsOut,
    cardsIn: o.item.cardsIn,
    bot: o.bot,
    simVersion: SIM_VERSION,
    games: d.length,
    seed: o.seed,
    opponents: o.opponents,
    mean: r6(g.mean),
    se: r6(g.se),
    sd: r6(g.sd),
    family: o.family,
    low: r6(clamp(g.mean - z * g.se)),
    high: r6(clamp(g.mean + z * g.se)),
    date: o.date,
  };
}

// ---------------------------------------------------------------- the file

const byKey = (a: { listId: string; pkg: string }, b: { listId: string; pkg: string }) => (a.listId < b.listId ? -1 : a.listId > b.listId ? 1 : a.pkg < b.pkg ? -1 : a.pkg > b.pkg ? 1 : 0);

/** The file's text: rows and skips sorted by list and package, one-space indent, a newline at the end. */
export function effectsText(f: PackageEffectFile): string {
  const doc: PackageEffectFile = { kind: f.kind, schema: f.schema, catalogueVersion: f.catalogueVersion, rows: [...f.rows].sort((a, b) => byKey(a, b) || (a.bot < b.bot ? -1 : a.bot > b.bot ? 1 : a.simVersion - b.simVersion)), skipped: [...f.skipped].sort(byKey), ...(f.manifest ? { manifest: f.manifest } : {}) };
  return `${JSON.stringify(doc, null, 1)}\n`;
}

/** The file with one list's new rows and skips: earlier rows of that list for the same bot and version replaced, the rest kept. */
export function mergeList(f: PackageEffectFile, listId: string, rows: readonly PackageEffectRow[], skipped: readonly PackageEffectSkip[], bot: string): PackageEffectFile {
  const same = (r: PackageEffectRow) => r.listId === listId && r.bot === bot && r.simVersion === SIM_VERSION;
  return { ...f, rows: [...f.rows.filter((r) => !same(r)), ...rows], skipped: [...f.skipped.filter((s) => s.listId !== listId), ...skipped] };
}

const emptyFile = (): PackageEffectFile => ({ kind: PACKAGE_EFFECTS_KIND, schema: PACKAGE_EFFECTS_SCHEMA, catalogueVersion: CATALOGUE_VERSION, rows: [], skipped: [] });

// ---------------------------------------------------------------- the command

const k = (n: number) => n.toLocaleString('en-US');
const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const hours = (s: number) => (s < 3600 ? `${Math.round(s / 60)} minutes` : `${(s / 3600).toFixed(1)} hours`);

/** The estimate's lines: games, machine time under Medium and Hard at `threads`, and the effect each could detect. */
export function estimateLines(plans: readonly ListPlan[], games: number, threads: number): string[] {
  const measuredLists = plans.filter((p) => p.items.some(measurable));
  const pkgs = plans.reduce((a, p) => a + p.items.filter(measurable).length, 0);
  const skipped = plans.reduce((a, p) => a + p.items.filter((x) => !measurable(x)).length, 0);
  const total = plans.reduce((a, p) => a + planGames(p, games), 0);
  const fam = measuredLists.length ? Math.max(...measuredLists.map((p) => p.items.filter(measurable).length)) : 1;
  const out = [
    `${k(plans.length)} lists, ${k(measuredLists.length)} with a package to measure: ${k(pkgs)} packages measured, ${k(skipped)} that cannot be (no legal list without them).`,
    `${k(games)} paired games a package, the list itself played once for all its packages: ${k(total)} games in all.`,
  ];
  for (const bot of ['medium', 'hard']) {
    const s = (total * GAME_SECONDS[bot]!) / threads;
    const sd = PACKAGE_SD[bot]!;
    const se = sd / Math.sqrt(games);
    // the effect found 80% of the time by a list with the most packages (its Bonferroni z), at the assumed spread
    const detect = (familyZ(fam) + 0.8416) * se;
    out.push(`${bot === 'hard' ? 'Hard' : 'Medium'}: about ${hours(s)} on ${threads} threads (${GAME_SECONDS[bot]} s a game a thread). At a spread of ${sd} a game, a package's corrected range is about ±${(familyZ(fam) * se * 100).toFixed(1)} points (${fam} packages on a list), and an effect of ${(detect * 100).toFixed(1)} points is found 80% of the time.`);
  }
  return out;
}

/** Run the command; returns its exit code (0, 1 or 2). */
export async function packageEffects(argv: string[], io: PackageEffectsIO): Promise<number> {
  try {
    return await run(argv, io);
  } catch (e) {
    if (e instanceof PackageEffectsRefusal) {
      io.err(`error: ${e.message}`);
      return e.code;
    }
    if (e instanceof ArgError) {
      io.err(`error: ${e.message}.`);
      return 2;
    }
    throw e;
  }
}

async function run(argv: string[], io: PackageEffectsIO): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./package-effects.ts', import.meta.url).href));
    return 0;
  }
  const { values: V, positionals } = parseArgs(FLAGS, argv, { maxPositionals: 200 });
  const today = (io.now ?? (() => new Date()))().toISOString().slice(0, 10);
  const lib = (io.library ?? (() => loadLibrary()))();
  const field = lib.filter((d) => d.kind === 'meta');
  const per = 2 * field.length;
  if (!field.length) refuse('the library has no meta decks to play against.');
  if (V.games % per !== 0) refuse(`--games must be a multiple of ${per} (${field.length} meta decks × 2 seats), so every opponent gets the same games on each seat; got ${k(V.games)}.`);
  const bot = ledgerBot(V.bot);
  if (!bot.bot) return refuse(`${(bot.problem ?? '').replace(/^the change ledger/, 'a package measurement')}.`);
  let targets: LibraryDeck[];
  try {
    targets = positionals.length ? positionals.map((q) => resolveDeck(q, lib)) : lib;
  } catch (e) {
    return refuse(`${(e as Error).message.replace(/\.? Try: .*$/, '')}: name library decks by file or name.`);
  }
  for (const t of targets) if (!lib.some((d) => d.file === t.file && listFingerprint(d.deck) === listFingerprint(t.deck))) refuse(`${t.file} is not a library deck.`);
  const plans = targets.map(listPlan).filter((p) => !V['notes-only'] || p.source !== 'built-around');

  io.out(`Package effects: each package of a list against the list without it, ${bot.bot} bot, simulator version ${SIM_VERSION}, against the ${field.length} meta decks (seeds ${k(V.seed)} + k).`);
  for (const l of estimateLines(plans, V.games, V.threads)) io.out(l);
  if (V.estimate) {
    io.out('');
    for (const p of plans) {
      const parts = p.items.map((x) => (measurable(x) ? `${x.pkg} (−${x.cardsOut.length} cards)` : `${x.pkg}: ${x.why}`));
      io.out(`  ${p.file} [${p.source}]: ${parts.join('; ') || 'no package'}`);
    }
    io.out('Nothing was played (--estimate).');
    return 0;
  }

  // the file: read before any game is played, refused when it is not one this code reads
  const out = V.out ?? path.join('public', PACKAGE_EFFECTS_PATH);
  let file = emptyFile();
  if (fs.existsSync(out)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(fs.readFileSync(out, 'utf8'));
    } catch {
      return refuse(`${out} is not JSON.`);
    }
    const problems = packageEffectsProblems(parsed, out);
    if (problems.length) return refuse(`${out} is not a package-effects file this code reads (${problems[0]}).`);
    file = parsed as PackageEffectFile;
    if (file.catalogueVersion !== CATALOGUE_VERSION) {
      if (!V.force) refuse(`${out} was measured with another package catalogue (${file.catalogueVersion}); pass --force to start the file again.`);
      file = emptyFile();
    }
  }
  const done = plans.filter((p) => file.rows.some((r) => r.listId === p.listId && r.bot === bot.bot && r.simVersion === SIM_VERSION));
  if (done.length && !V.force && !V['dry-run']) refuse(`${done.length} of these lists are already measured with this bot and simulator version (${done.slice(0, 3).map((p) => p.file).join(', ')}${done.length > 3 ? ', …' : ''}): pass --force to measure them again, or leave them out.`);

  const fieldLists = field.map((d) => d.deck);
  const opponents = field.map((d) => listFingerprint(d.deck));
  let played = 0;
  for (const p of plans) {
    const items = p.items.filter(measurable);
    const skipped: PackageEffectSkip[] = p.items.filter((x) => !measurable(x)).map((x) => ({ listId: p.listId, deck: p.file, pkg: x.pkg, why: (x as { why: string }).why }));
    let rows: PackageEffectRow[] = [];
    if (items.length) {
      const jobs = [p.deck, ...items.map((x) => x.without)].flatMap((l) => listJobs(l, fieldLists, V.games, V.seed, bot.bot));
      const results = await io.play(jobs, { threads: V.threads, cache: io.cache?.(V.cache) });
      if (results.length !== jobs.length) return refuse(`${k(jobs.length)} games were asked for and ${k(results.length)} came back.`, 1);
      played += jobs.length;
      const scores = results.map((r) => scoreOf(r.winner));
      const base = scores.slice(0, V.games);
      rows = items.map((item, i) => effectRow({ plan: p, item, withScores: base, withoutScores: scores.slice((i + 1) * V.games, (i + 2) * V.games), family: items.length, bot: bot.bot, seed: V.seed, opponents, date: today }));
    }
    io.out(`${p.file}: ${rows.map((r) => `${r.pkg} ${pts(r.mean)} (corrected range ${pts(r.low)} to ${pts(r.high)})${r.low > 0 ? ' named by the coach' : ''}`).join('; ') || 'nothing measured'}${skipped.length ? `; not measurable: ${skipped.map((s) => s.pkg).join(', ')}` : ''}`);
    if (!V['dry-run']) {
      file = mergeList(file, p.listId, rows, skipped, bot.bot);
      file.manifest = gameRunManifest({
        purpose: 'analysis',
        decks: [...plans.map((x) => ({ deck: x.deck, file: x.file })), ...field.map((d) => ({ deck: d.deck, file: d.file }))],
        fieldMode: 'meta',
        fieldDeckIds: opponents,
        bot: bot.bot,
        seedBase: V.seed,
        seatPolicy: 'alternate',
        plannedGames: plans.reduce((a, x) => a + planGames(x, V.games), 0),
        completedGames: played,
        gamesPerPair: null,
        simVersion: SIM_VERSION,
        createdAt: `${today}T00:00:00.000Z`,
        runId: `package-effects:${today}:${V.seed}:${bot.bot}`,
      });
      const problems = packageEffectsProblems(JSON.parse(effectsText(file)), out);
      if (problems.length) return refuse(`the file would not read back (${problems[0]}).`, 1);
      fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
      fs.writeFileSync(out, effectsText(file));
    }
  }
  io.out(V['dry-run'] ? `Played ${k(played)} games; nothing was written (--dry-run).` : `Played ${k(played)} games; wrote ${out}.`);
  return 0;
}
