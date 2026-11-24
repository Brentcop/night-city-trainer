// The Node side of the gate (src/lib/breedGate.ts; docs/SYNERGIES.md "A bred deck's test against its parent"): the game
// jobs in the forge's layout, a play function over runJobs, the gate's flags (shared with scripts/season.ts), the record
// and the words both write, and npm run gate (scripts/gate.ts, whose header is the usage). The game runner and the
// output are handed in, so tests run the command without playing a game.
import fs from 'node:fs';
import path from 'node:path';
import { exportOfficial, listFingerprint, parseDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { botWord, scoreOf } from '../src/lib/evidence';
import {
  confirmBotOf,
  gateCost,
  gateDetectWords,
  gateField,
  gateGuaranteeWords,
  gateRuleWords,
  gateStageGames,
  gateWords,
  GATE_CLI_SEEDS,
  GATE_DEFAULTS,
  KEEP_OUT_RULES,
  REFERENCE_MODES,
  runGate,
  spreadSeen,
  spreadSeenWords,
  stepWords,
  type GateEntry,
  type GateFigure,
  type GateOptions,
  type GateOutcome,
  type GatePlay,
  type GatePlayRequest,
  type ReferenceMode,
  type GateStep,
  type KeepOutRule,
} from '../src/lib/breedGate';
import type { LibraryDeck } from '../src/lib/library';
import { SIM_VERSION } from '../src/lib/tournament';
import type { GameCache } from './game-cache';
import { ArgError, bool, int, loadLibrary, oneOf, parseArgs, resolveDeck, SIM_BOTS, slugify, str, threadsOpt, usageOf } from './lib-node';
import type { MatchJob, MatchResult } from './worker';

// ---------------------------------------------------------------- the games

/** The jobs of one block, the forge's layout: game k plays field[k % n] with seed seed0 + k, the deck first when floor(k / n) is even. */
export function gateJobs(r: Pick<GatePlayRequest, 'deck' | 'field' | 'seed0' | 'games' | 'bot'>): MatchJob[] {
  const n = r.field.length;
  return Array.from({ length: r.games }, (_, k): MatchJob => ({ a: r.deck, b: r.field[k % n]!, seed: r.seed0 + k, first: (Math.floor(k / n) % 2) as 0 | 1, bot: r.bot }));
}

/**
 * A list in the order its deck file reads back (exportOfficial, then parseDeck). The order of a list's cards changes the
 * games a seed deals it (the shuffle starts from that order; the list fingerprint does not see it), and the export
 * regroups the cards by type and cost. The season gates every bred list in this order, so the gate's games are exactly
 * the games anyone replays from the recorded list or from the deck file it becomes.
 */
export function asWritten(deck: DeckList): DeckList {
  const r = parseDeck(exportOfficial(deck), deck.name);
  if (r.errors.length || r.deck.name !== deck.name || listFingerprint(r.deck) !== listFingerprint(deck)) throw new Error(`${deck.name} does not read back as the same list${r.errors.length ? ` (${r.errors.join('; ')})` : ''}`);
  return { ...r.deck, sideboard: [...deck.sideboard] };
}

/** A play function over a job runner (runJobs), quiet: the gate prints its own progress. */
export function gatePlayOver(run: (jobs: MatchJob[], o: { threads: number; cache?: GameCache; quiet?: boolean }) => Promise<Pick<MatchResult, 'winner'>[]>, o: { threads: number; cache?: GameCache }): GatePlay {
  return async (r) => {
    const jobs = gateJobs(r);
    const res = await run(jobs, { threads: o.threads, ...(o.cache ? { cache: o.cache } : {}), quiet: true });
    if (res.length !== jobs.length) throw new Error(`${jobs.length} gate games were asked for and ${res.length} came back`);
    return res.map((x) => scoreOf(x.winner));
  };
}

// ---------------------------------------------------------------- the flags (npm run gate and the season)

export const CONFIRM_BOTS = [...SIM_BOTS, 'none'] as const;

/** The season's gate flags (scripts/season.ts). */
export const seasonGateFlags = () => ({
  gate: oneOf(['on', 'off'] as const, 'on'),
  'gate-only': bool(),
  'gate-bot': oneOf(SIM_BOTS, GATE_DEFAULTS.bot as 'medium'),
  'gate-confirm-bot': oneOf(CONFIRM_BOTS, GATE_DEFAULTS.confirmBot as 'hard'),
  'gate-rounds': int(GATE_DEFAULTS.rounds, { min: 1, max: 1000 }),
  'gate-stages': int(GATE_DEFAULTS.stages, { min: 1, max: 16 }),
  'gate-confirm-stages': int(GATE_DEFAULTS.confirmStages, { min: 1, max: 16 }),
  // the owner's choice of 2026-11-15: a season tests against the fixed bar (planGate's own default stays 'parent')
  'gate-reference': oneOf(REFERENCE_MODES, 'middle'),
  // since 2026-11-24: only the confirming bot can keep a deck out (GATE_DEFAULTS.keepOut); 'either' is the rule of 2026-11-15
  'gate-keep-out': oneOf(KEEP_OUT_RULES, GATE_DEFAULTS.keepOut),
  out: str(),
});

/**
 * Why two seed blocks of a gate would be a problem: the first bot's block reaching into the confirming bot's (or the
 * other way round), or either reaching `limit` (the next season's seeds). Null when they are apart.
 */
export function seedProblem(o: { first: number; confirm: number; firstGames: number; confirmGames: number; limit?: number }): string | null {
  const a = [o.first, o.first + o.firstGames] as const;
  const b = [o.confirm, o.confirm + o.confirmGames] as const;
  if (o.confirmGames > 0 && a[0] < b[1] && b[0] < a[1]) return `the first bot's seeds (${a[0]} to ${a[1] - 1}) and the confirming bot's (${b[0]} to ${b[1] - 1}) overlap: use fewer rounds or stages, or seeds further apart`;
  if (o.limit !== undefined && (a[1] > o.limit || (o.confirmGames > 0 && b[1] > o.limit))) return `the gate's seeds would reach ${o.limit}, the next season's: use fewer rounds or stages`;
  return null;
}

// ---------------------------------------------------------------- the record

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
const roundFigure = (f: GateFigure): GateFigure => ({ games: f.games, mean: r6(f.mean), lower: r6(f.lower), upper: r6(f.upper), z: r6(f.z), sd: r6(f.sd), deckWr: r6(f.deckWr), refWr: r6(f.refWr) });
/** A step with its numbers rounded to six places (the JSON files). */
export function roundStep(s: GateStep): GateStep {
  return {
    ...s,
    judged: roundFigure(s.judged),
    ...(s.played ? { played: { ...roundFigure(s.played), stages: s.played.stages } } : {}),
    byOpp: s.byOpp.map((g) => ({ ...g, mean: r6(g.mean), se: r6(g.se) })),
    bySeat: s.bySeat.map((g) => ({ ...g, mean: r6(g.mean), se: r6(g.se) })),
    ...(s.heterogeneity ? { heterogeneity: { chi2: r6(s.heterogeneity.chi2), df: s.heterogeneity.df, p: Number(s.heterogeneity.p.toPrecision(4)) } } : {}),
  };
}

/** The settings a record keeps. */
export interface GateSettings {
  bot: string;
  /** null: no confirming bot (none, or the first bot under another name) */
  confirmBot: string | null;
  rounds: number;
  stages: number;
  confirmStages: number;
  alpha: number;
  seeds: { first: number; confirm: number };
  /** a season's reference mode (absent for npm run gate, which names its reference) */
  reference?: ReferenceMode;
  /** which bot could keep a deck out (since 2026-11-24; a record without it ran 'either') */
  keepOut: KeepOutRule;
  /** the field: the meta decks, or the meta decks and the library's top N lists (`fieldTop`, a season's --field-top) */
  fieldTop?: number;
  /** every stage was played (no early stop) */
  fullStages?: true;
}

export const gateSettings = (o: GateOptions, extra: { fieldTop?: number } = {}): GateSettings => ({
  bot: o.bot,
  confirmBot: confirmBotOf(o.bot, o.confirmBot),
  rounds: o.rounds,
  stages: o.stages,
  confirmStages: o.confirmStages,
  alpha: o.alpha ?? GATE_DEFAULTS.alpha,
  seeds: { ...o.seeds },
  ...(o.reference ? { reference: o.reference } : {}),
  keepOut: o.keepOut ?? GATE_DEFAULTS.keepOut,
  ...(extra.fieldTop ? { fieldTop: extra.fieldTop } : {}),
  ...(o.fullStages ? { fullStages: true as const } : {}),
});

/** One deck's entry in a record: the outcome (rounded), its words, and its list as official export text. */
export interface GateDeckRecord extends GateOutcome {
  words: string;
  list: string;
  legends: string[];
}

export function gateDeckRecord(r: GateOutcome, deck: DeckList, extra: Record<string, unknown> = {}): GateDeckRecord & Record<string, unknown> {
  return {
    ...extra,
    ...r,
    first: roundStep(r.first),
    confirm: r.confirm ? roundStep(r.confirm) : null,
    words: gateWords(r),
    list: exportOfficial(deck),
    legends: [...deck.legends],
  };
}

/** The gate's words before it plays: the rule, what it guarantees, what it can detect and what it may cost. */
export function gateHeaderLines(o: GateOptions, opponents: readonly number[]): string[] {
  const c = confirmBotOf(o.bot, o.confirmBot);
  const most = Math.max(...opponents, 0);
  const cost = gateCost(o, most);
  const same = o.confirmBot && o.confirmBot !== 'none' && !c ? [`The confirming bot ${o.confirmBot} is the ${botWord(o.bot)} bot under another name, so it plays nothing more.`] : [];
  return [
    `Gate rule: ${gateRuleWords({ ...o, opponents })}.`,
    ...same,
    gateGuaranteeWords(o),
    gateDetectWords({ ...o, opponents }),
    `Cost: at most ${cost.first.toLocaleString('en-US')} ${botWord(o.bot)} games${c ? ` and ${cost.confirm.toLocaleString('en-US')} ${botWord(c)} games` : ''} a deck (deck and reference, ${most} opponents), fewer when a deck is decided early or shares its reference.`,
    'Gate games are a selection step: they count for no rating, leaderboard, change ledger or evidence file.',
  ];
}

/** The record's words after the games: the spread seen. */
export const gateFooterLines = (outcomes: readonly GateOutcome[]): string[] => [spreadSeenWords(outcomes)];

/** Per-opponent and per-seat lines of a step (every game it played). */
export function splitLines(s: GateStep): string[] {
  const all = s.played ?? s.judged;
  const wide = Math.max(12, ...s.byOpp.map((o) => o.opp.length));
  const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
  // a difference of two game scores lies in [−1, 1]: the range is clipped there, as pairedInterval clips
  const range = (m: number, se: number) => `95% range ${pts(Math.max(-1, m - 1.96 * se))} to ${pts(Math.min(1, m + 1.96 * se))}`;
  const out = [`${botWord(s.bot)}, by opponent (all ${all.games.toLocaleString('en-US')} games played; deck minus reference):`];
  for (const o of s.byOpp) out.push(`  ${o.opp.padEnd(wide)}  ${pts(o.mean).padStart(6)} pts, ${range(o.mean, o.se)}, ${o.games} games`);
  for (const t of s.bySeat) out.push(`  ${(t.first ? 'going second' : 'going first').padEnd(wide)}  ${pts(t.mean).padStart(6)} pts, ${range(t.mean, t.se)}, ${t.games} games`);
  const het = s.heterogeneity;
  out.push(het ? `  across opponents: χ² ${het.chi2.toFixed(1)} on ${het.df} df, p ${het.p < 0.001 ? '< 0.001' : het.p.toFixed(3)}${het.p < 0.05 ? ': the per-opponent figures differ by more than chance' : ''}` : '  across opponents: not tested (it needs two or more opponents with 20 or more games and a spread)');
  return out;
}

// ---------------------------------------------------------------- npm run gate

export const GATE_FLAGS = {
  ref: str(),
  bot: oneOf(SIM_BOTS, GATE_DEFAULTS.bot as 'medium'),
  'confirm-bot': oneOf(CONFIRM_BOTS, GATE_DEFAULTS.confirmBot as 'hard'),
  rounds: int(GATE_DEFAULTS.rounds, { min: 1, max: 1000 }),
  stages: int(GATE_DEFAULTS.stages, { min: 1, max: 16 }),
  'confirm-stages': int(GATE_DEFAULTS.confirmStages, { min: 1, max: 16 }),
  seed: int(GATE_CLI_SEEDS.first, { min: 0 }),
  'confirm-seed': int(GATE_CLI_SEEDS.confirm, { min: 0 }),
  'keep-out': oneOf(KEEP_OUT_RULES, GATE_DEFAULTS.keepOut),
  'no-early-stop': bool(),
  threads: threadsOpt(),
  cache: bool(),
  json: bool(),
  out: str(),
};

export interface GateIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** play the jobs, results in job order (runJobs) */
  play: (jobs: MatchJob[], o: { threads: number; cache?: GameCache; quiet?: boolean }) => Promise<Pick<MatchResult, 'winner'>[]>;
  cache?: (on: boolean) => GameCache | undefined;
  now?: () => Date;
  library?: () => LibraryDeck[];
}

class GateRefusal extends Error {}
const refuse = (m: string): never => {
  throw new GateRefusal(m);
};

/** Run npm run gate; returns its exit code (0, or 2 for a bad command line). */
export async function gateCommand(argv: string[], io: GateIO): Promise<number> {
  try {
    return await run(argv, io);
  } catch (e) {
    if (e instanceof GateRefusal || e instanceof ArgError) {
      io.err(`error: ${e.message.replace(/\.$/, '')}.`);
      return 2;
    }
    throw e;
  }
}

async function run(argv: string[], io: GateIO): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./gate.ts', import.meta.url).href));
    return 0;
  }
  const { values: V, positionals } = parseArgs(GATE_FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
  const lib = (io.library ?? (() => loadLibrary()))();
  if (V.ref === undefined) refuse('name the reference deck with --ref <deck>');
  const find = (q: string, what: string): LibraryDeck => {
    try {
      return resolveDeck(q, lib);
    } catch {
      return refuse(`no library deck matches "${q}" (${what}): name one by its file or name`);
    }
  };
  const target = find(positionals[0]!, 'the deck');
  const ref = find(V.ref!, 'the reference');
  if (listFingerprint(target.deck) === listFingerprint(ref.deck)) refuse(`${target.deck.name} and ${ref.deck.name} are the same list: there is nothing to compare`);
  const meta = lib.filter((d) => d.kind === 'meta').map((d) => d.deck);
  const field = gateField(meta, ref.deck, target.deck);
  if (!field.length) refuse('there is no meta deck left to play against');
  const o: GateOptions = {
    bot: V.bot,
    confirmBot: V['confirm-bot'] === 'none' ? null : V['confirm-bot'],
    rounds: V.rounds,
    stages: V.stages,
    confirmStages: V['confirm-stages'],
    seeds: { first: V.seed, confirm: V['confirm-seed'] },
    keepOut: V['keep-out'],
    ...(V['no-early-stop'] ? { fullStages: true } : {}),
  };
  const games = gateStageGames(o.rounds, field.length);
  const conf = confirmBotOf(o.bot, o.confirmBot);
  const sp = seedProblem({ first: o.seeds.first, confirm: o.seeds.confirm, firstGames: games * o.stages, confirmGames: conf ? games * o.confirmStages : 0 });
  if (sp) refuse(sp);
  const outDir = V.out;
  const stem = `gate-${slugify(target.file.replace(/\.txt$/, ''), 40)}-vs-${slugify(ref.file.replace(/\.txt$/, ''), 40)}`;
  if (outDir && fs.existsSync(outDir) && !fs.statSync(outDir).isDirectory()) refuse(`--out ${outDir} is a file, not a folder`);

  const lines: string[] = [];
  const say = (l: string) => {
    lines.push(l);
    if (!V.json) io.out(l);
  };
  say(`${target.deck.name} against ${ref.deck.name}, simulator version ${SIM_VERSION}; field: ${field.map((f) => f.name).join(', ')}.`);
  for (const l of gateHeaderLines(o, [field.length])) say(l);
  if (o.fullStages) say('Every stage is played (--no-early-stop); the verdict is still where the staged rule would have stopped.');
  say('');
  const entry: GateEntry = { deck: target.deck, reference: ref.deck, referenceWhy: 'named', parents: [], field };
  const cache = io.cache?.(V.cache);
  const play = gatePlayOver(io.play, { threads: V.threads, ...(cache ? { cache } : {}) });
  const [r] = await runGate([entry], { ...o, onStep: ({ step }) => !V.json && io.err(`  ${stepWords(step)}`) }, play);
  const outcome = r!;
  const words = gateWords(outcome);
  say(words.charAt(0).toUpperCase() + words.slice(1));
  say('');
  for (const s of [outcome.first, outcome.confirm]) if (s) for (const l of splitLines(s)) say(l);
  say('');
  for (const l of gateFooterLines([outcome])) say(l);
  const doc = {
    kind: 'nct-breed-gate',
    schema: 1,
    date: (io.now ?? (() => new Date()))().toISOString(),
    simVersion: SIM_VERSION,
    settings: gateSettings(o),
    words: { rule: gateRuleWords({ ...o, opponents: [field.length] }), guarantee: gateGuaranteeWords(o), detect: gateDetectWords({ ...o, opponents: [field.length] }), spread: spreadSeenWords([outcome]) },
    spreadSeen: spreadSeen([outcome]),
    decks: [gateDeckRecord(outcome, target.deck, { file: target.file, referenceFile: ref.file })],
  };
  if (V.json) io.out(JSON.stringify(doc, null, 1));
  if (outDir) {
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, `${stem}.json`), `${JSON.stringify(doc, null, 1)}\n`);
    fs.writeFileSync(path.join(outDir, `${stem}.md`), `# Gate: ${target.deck.name} against ${ref.deck.name}\n\n${lines.join('\n')}\n`);
    if (!V.json) io.out(`Written: ${path.join(outDir, `${stem}.json`)} and .md`);
  }
  return 0;
}

