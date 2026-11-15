// The logic of npm run remeasure (scripts/remeasure.ts, whose header is the usage): one change to a library deck measured
// on fresh paired games and appended as a re-measurement row (src/lib/remeasure.ts; docs/EVIDENCE.md "Re-measurements").
// The game runner, the output and the clock are handed in, so tests run it without playing a game.
import fs from 'node:fs';
import path from 'node:path';
import { CARD_BY_ID, CARDS, cardLabel } from '../src/engine/cards';
import { fingerprintText, listFingerprint, parseDeck, validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { changeKey, ledgerBot } from '../src/lib/changeLedger';
import { pairedInterval, scoreOf } from '../src/lib/evidence';
import { heterogeneity, pairedGroup, splitPaired, stratifiedInterval, type PairSlot } from '../src/lib/pairedSplit';
import { parseRemeasureFile, remeasureProblems, REMEASURE_KIND, REMEASURE_SCHEMA, type RemeasureFile, type Remeasurement } from '../src/lib/remeasure';
import type { LibraryDeck } from '../src/lib/library';
import { SIM_VERSION } from '../src/lib/tournament';
import { parseChangeKey } from './evidence-build';
import type { GameCache } from './game-cache';
import { LedgerStore } from './ledger-store';
import { ArgError, bool, int, loadLibrary, many, oneOf, parseArgs, resolveDeck, SIM_BOTS, str, threadsOpt, usageOf } from './lib-node';
import type { MatchJob, MatchResult } from './worker';

export const REMEASURE_SCRIPT = 'scripts/remeasure.ts';
export const DEFAULT_GAMES = 1120;
export const DEFAULT_SEED = 5_000_000;
export const DEFAULT_LEDGER_DIR = 'data/ledger';
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;

export const FLAGS = {
  cut: many(),
  add: many(),
  'cut-legend': many(),
  'add-legend': many(),
  change: str(),
  'ledger-dir': str(DEFAULT_LEDGER_DIR),
  before: str(),
  bot: oneOf(SIM_BOTS, 'hard'),
  games: int(DEFAULT_GAMES, { min: 1 }),
  seed: int(DEFAULT_SEED, { min: 0 }),
  field: oneOf(['meta'] as const, 'meta'),
  threads: threadsOpt(),
  cache: bool(),
  out: str(),
  note: str(),
  id: str(),
  record: str(),
  force: bool(),
  'dry-run': bool(),
};

/** What the command reads from and writes to (the real ones in scripts/remeasure.ts, stubs in tests). */
export interface RemeasureIO {
  out: (line: string) => void;
  err: (line: string) => void;
  /** play the jobs, results in job order (runJobs) */
  play: (jobs: MatchJob[], o: { threads: number; cache?: GameCache }) => Promise<Pick<MatchResult, 'winner'>[]>;
  /** the game cache for --cache (cliGameCache) */
  cache?: (on: boolean) => GameCache | undefined;
  now?: () => Date;
  /** the deck library (default: loadLibrary()) */
  library?: () => LibraryDeck[];
}

/** A refusal: one sentence, exit code 2 (a bad command line or a change that cannot be measured) or 1. */
export class RemeasureRefusal extends Error {
  constructor(
    message: string,
    readonly code: 1 | 2 = 2,
  ) {
    super(message);
  }
}
const refuse = (message: string, code: 1 | 2 = 2): never => {
  throw new RemeasureRefusal(message, code);
};

// ---------------------------------------------------------------- the change

/** A change by card id, main deck and Legends, with repeats. */
export interface CardChange {
  cuts: string[];
  adds: string[];
  legendCuts: string[];
  legendAdds: string[];
}

/** A card by id, or by its exact name ("Yorinobu Arasaka: Steel Dragon", or "Yorinobu Arasaka" when only one card has it). */
export function cardRef(q: string): string {
  if (CARD_BY_ID[q]) return q;
  const byLabel = [...new Set(CARDS.filter((c) => cardLabel(c) === q).map((c) => c.id))];
  const ids = byLabel.length ? byLabel : [...new Set(CARDS.filter((c) => c.name === q).map((c) => c.id))];
  if (ids.length === 1) return ids[0]!;
  if (ids.length > 1) return refuse(`"${q}" names more than one card (${ids.join(', ')}): give the card id or its full name.`);
  return refuse(`"${q}" is no card: give a card id (such as gunpoint_diplomacy) or a card's exact name.`);
}

const nameOf = (id: string) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id);

/**
 * Apply a change to a list. Each cut is paired with the add at the same position and replaced in place (the first copy
 * still there), as the forge swaps a card; cuts beyond the adds are removed and adds beyond the cuts go at the end.
 */
export function applyCardChange(list: DeckList, c: CardChange): DeckList {
  const section = (from: readonly string[], cuts: readonly string[], adds: readonly string[], what: string): string[] => {
    const out = [...from];
    cuts.forEach((id, i) => {
      const at = out.indexOf(id);
      if (at < 0) {
        const held = from.filter((x) => x === id).length;
        refuse(held ? `${list.name} holds only ${held} ${nameOf(id)} in its ${what}, and the change cuts ${cuts.filter((x) => x === id).length}.` : `${list.name} holds no ${nameOf(id)} in its ${what} to cut.`);
      }
      if (i < adds.length) out[at] = adds[i]!;
      else out.splice(at, 1);
    });
    out.push(...adds.slice(cuts.length));
    return out;
  };
  return { ...list, main: section(list.main, c.cuts, c.adds, 'main deck'), legends: section(list.legends, c.legendCuts, c.legendAdds, 'Legends') };
}

/** Multiset difference: what `a` has that `b` lacks (sorted, with repeats). */
function minus(a: readonly string[], b: readonly string[]): string[] {
  const left = [...b];
  const out: string[] = [];
  for (const id of a) {
    const i = left.indexOf(id);
    if (i < 0) out.push(id);
    else left.splice(i, 1);
  }
  return out.sort();
}

/** The change from one list to another, by card id. */
export function diffLists(base: Pick<DeckList, 'legends' | 'main'>, cand: Pick<DeckList, 'legends' | 'main'>): CardChange {
  return { cuts: minus(base.main, cand.main), adds: minus(cand.main, base.main), legendCuts: minus(base.legends, cand.legends), legendAdds: minus(cand.legends, base.legends) };
}

/** "-1 Gunpoint Diplomacy → +1 Yorinobu Arasaka: Steel Dragon" (the forge's words for a swap); Legends say "(Legend)". */
export function changeLabel(c: CardChange): string {
  const part = (sign: '-' | '+', ids: readonly string[], legend: boolean) => {
    const n = new Map<string, number>();
    for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
    return [...n].map(([id, k]) => `${sign}${k} ${nameOf(id)}${legend ? ' (Legend)' : ''}`);
  };
  const left = [...part('-', c.cuts, false), ...part('-', c.legendCuts, true)].join(', ');
  const right = [...part('+', c.adds, false), ...part('+', c.legendAdds, true)].join(', ');
  return left && right ? `${left} → ${right}` : left || right;
}

const norm = (s: string) => s.replace(/−/g, '-').replace(/\s+/g, ' ').trim().toLowerCase();

/** A change of the deck's list in the ledger, by its change key or its label (one change, or a refusal). */
export function ledgerChange(dir: string, listId: string, deckName: string, q: string): { key: string; label: string } {
  const entries = new LedgerStore(dir).entriesOf(listId);
  if (!entries.length) return refuse(`the change ledger in ${dir} holds no change to the current list of ${deckName} (${listId}).`);
  const latest = new Map<string, { label: string; date: string }>();
  for (const e of entries) {
    const had = latest.get(e.id.change);
    if (!had || e.lastDate >= had.date) latest.set(e.id.change, { label: e.label, date: e.lastDate });
  }
  const byKey = latest.get(q.trim());
  if (byKey) return { key: q.trim(), label: byKey.label };
  const hits = [...latest].filter(([, v]) => norm(v.label) === norm(q));
  if (hits.length === 1) return { key: hits[0]![0], label: hits[0]![1].label };
  if (hits.length > 1) return refuse(`"${q}" is the label of ${hits.length} changes of ${deckName} in the change ledger: give the change key instead (${hits.map(([k]) => `"${k}"`).join(' or ')}).`);
  return refuse(`no change of ${deckName} in the change ledger (${dir}) has the label or key "${q}".`);
}

// ---------------------------------------------------------------- the games

/**
 * The jobs, the forge's layout (so games already played this way are in the game cache): game k plays
 * field[k % field.length] with seed `seed + k`, the list first (first: 0) when floor(k / field.length) is even; the base
 * list's games first, then the changed list's on the same k.
 */
export function remeasureJobs(base: DeckList, cand: DeckList, field: readonly DeckList[], games: number, seed: number, bot: string): MatchJob[] {
  const n = field.length;
  return [base, cand].flatMap((a) => Array.from({ length: games }, (_, k): MatchJob => ({ a, b: field[k % n]!, seed: seed + k, first: (Math.floor(k / n) % 2) as 0 | 1, bot })));
}

/** Where game k sat (its opponent's list fingerprint and the seat). */
export const remeasureSlots = (fieldIds: readonly string[], games: number): PairSlot[] => Array.from({ length: games }, (_, k) => ({ opp: fieldIds[k % fieldIds.length]!, first: (Math.floor(k / fieldIds.length) % 2) as 0 | 1 }));

// ---------------------------------------------------------------- the file

const r6 = (x: number) => Math.round(x * 1e6) / 1e6;

/** The re-measurement files beside `file` (and it), parsed; unreadable other files are skipped. */
function rowsBeside(file: string): { file: string; rows: Remeasurement[] }[] {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir)) return [];
  const out: { file: string; rows: Remeasurement[] }[] = [];
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
    const full = path.join(dir, f);
    if (path.resolve(full) === path.resolve(file)) continue;
    try {
      const r = parseRemeasureFile(JSON.parse(fs.readFileSync(full, 'utf8')), f);
      if (r.file) out.push({ file: full, rows: r.file.measurements });
    } catch {
      /* not a re-measurement file */
    }
  }
  return out;
}

/** The row appended to a file's text, every earlier byte kept (null when the measurements list is not where it can be found). */
export function appendRowText(text: string, row: Remeasurement): string | null {
  const one = JSON.stringify(row, null, 1);
  const filled = /\n([ \t]*)\}(\s*)\n([ \t]*)\](\s*)\}(\s*)$/.exec(text);
  if (filled) {
    const indent = filled[1]!;
    const at = filled.index + 1 + indent.length + 1;
    const rowText = one
      .split('\n')
      .map((l) => indent + l)
      .join('\n');
    return `${text.slice(0, at)},\n${rowText}${text.slice(at)}`;
  }
  const empty = /\[\s*\](\s*)\}(\s*)$/.exec(text);
  if (empty) {
    const rowText = one
      .split('\n')
      .map((l) => `  ${l}`)
      .join('\n');
    return `${text.slice(0, empty.index)}[\n${rowText}\n ]${empty[1] ?? ''}}${empty[2] ?? ''}`;
  }
  return null;
}

/** A new file with one row (the format of the files in data/evidence/: one-space indent, a newline at the end). */
export function newFileText(row: Remeasurement, note?: string): string {
  const doc: RemeasureFile = { kind: REMEASURE_KIND, schema: REMEASURE_SCHEMA, ...(note ? { note } : {}), measurements: [row] };
  return `${JSON.stringify(doc, null, 1)}\n`;
}

// ---------------------------------------------------------------- the command

const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const k = (n: number) => n.toLocaleString('en-US');
const range = (lo: number, hi: number) => `95% range ${pts(lo)} to ${pts(hi)}`;

/** Run the command; returns its exit code (0, 1 or 2). */
export async function remeasure(argv: string[], io: RemeasureIO): Promise<number> {
  try {
    return await run(argv, io);
  } catch (e) {
    if (e instanceof RemeasureRefusal) {
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

async function run(argv: string[], io: RemeasureIO): Promise<number> {
  if (argv.includes('--help') || argv.includes('-h')) {
    io.out(usageOf(new URL('./remeasure.ts', import.meta.url).href));
    return 0;
  }
  const { values: V, positionals } = parseArgs(FLAGS, argv, { minPositionals: 1, maxPositionals: 1 });
  const now = (io.now ?? (() => new Date()))();
  const today = now.toISOString().slice(0, 10);
  const lib = (io.library ?? (() => loadLibrary()))();
  // the deck: a library deck (the evidence builder reads a row by its deck file)
  let target: LibraryDeck;
  try {
    target = resolveDeck(positionals[0]!, lib);
  } catch (e) {
    return refuse(`${(e as Error).message.replace(/\.? Try: .*$/, '')}: name a library deck by its file or name.`);
  }
  if (!lib.some((d) => d.file === target.file && listFingerprint(d.deck) === listFingerprint(target.deck))) refuse(`${positionals[0]} is not a library deck: name one by its file or name (data/decks or data/decks/custom).`);
  // exactly one way to name the change
  const cardFlags = V.cut.length + V.add.length + V['cut-legend'].length + V['add-legend'].length > 0;
  const ways = [cardFlags, V.change !== undefined, V.before !== undefined].filter(Boolean).length;
  if (ways !== 1) refuse(ways ? 'name the change one way only: --cut/--add, --change or --before.' : 'name the change: --cut and --add (cards by id or name), --change "<label or change key>" or --before <deck file>.');
  const field = lib.filter((d) => d.kind === 'meta');
  const per = 2 * field.length;
  if (V.games % per !== 0) refuse(`--games must be a multiple of ${per} (${field.length} meta decks × 2 seats), so every opponent gets the same games on each seat; got ${k(V.games)}.`);
  const bot = ledgerBot(V.bot);
  if (!bot.bot) return refuse(`${(bot.problem ?? '').replace(/^the change ledger/, 'a re-measurement')}.`);
  if (V.id !== undefined && !ID_RE.test(V.id)) refuse(`--id must be lower-case letters, digits, dots, dashes or underscores, at most 64 (got "${V.id}").`);

  // the lists before and after
  let base: DeckList;
  let cand: DeckList;
  let label: string;
  if (V.before !== undefined) {
    if (!fs.existsSync(V.before) || !fs.statSync(V.before).isFile()) return refuse(`there is no deck file ${V.before}.`);
    base = parseDeck(fs.readFileSync(V.before, 'utf8'), V.before).deck;
    cand = target.deck;
    if (listFingerprint(base) === listFingerprint(cand)) refuse(`the list in ${V.before} is the library list of ${target.deck.name}: there is no change to measure.`);
    label = changeLabel(diffLists(base, cand));
  } else if (V.change !== undefined) {
    const found = ledgerChange(V['ledger-dir'], listFingerprint(target.deck), target.deck.name, V.change);
    const p = parseChangeKey(found.key);
    base = target.deck;
    cand = applyCardChange(base, { cuts: p.cuts, adds: p.adds, legendCuts: p.legendCuts, legendAdds: p.legendAdds });
    label = found.label;
  } else {
    const c: CardChange = { cuts: V.cut.map(cardRef), adds: V.add.map(cardRef), legendCuts: V['cut-legend'].map(cardRef), legendAdds: V['add-legend'].map(cardRef) };
    base = target.deck;
    cand = applyCardChange(base, c);
    if (listFingerprint(base) === listFingerprint(cand)) refuse('the change leaves the list as it is.');
    label = changeLabel(diffLists(base, cand));
  }
  for (const [what, list] of [['list before the change', base], ['changed list', cand]] as const) {
    const errs = validateDeck(list);
    if (errs.length) refuse(`the ${what} is not a legal deck (${errs[0]!.replace(/\.$/, '')}).`);
  }
  const change = diffLists(base, cand);
  const key = changeKey(base, cand);
  const baseListId = listFingerprint(base);
  const candListId = listFingerprint(cand);
  const fieldIds = field.map((d) => listFingerprint(d.deck));

  // the file and the row's id, checked before any game is played
  const out = V.out ?? `data/evidence/remeasure-${today}.json`;
  let existing: string | null = null;
  let rows: Remeasurement[] = [];
  if (fs.existsSync(out)) {
    existing = fs.readFileSync(out, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(existing);
    } catch {
      return refuse(`${out} is not JSON, so no row can be appended to it.`);
    }
    const r = parseRemeasureFile(parsed, out);
    if (!r.file) return refuse(`${out} is not a re-measurement file this code reads (${r.problems[0]}).`);
    rows = r.file.measurements;
    if (V.note !== undefined) refuse(`--note sets the note of a new file, and ${out} already has one header.`);
  }
  const all = [...rows, ...rowsBeside(out).flatMap((f) => f.rows)];
  const deckSlug = target.file
    .replace(/\.txt$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  let id = V.id ?? `${deckSlug || 'deck'}-${fingerprintText(key).slice(0, 8)}-${bot.bot}`;
  const taken = new Set(all.map((m) => m.id));
  const same = all.find((m) => m.baseListId === baseListId && m.candListId === candListId && (m.bot === bot.bot || ledgerBot(m.bot).bot === bot.bot) && m.simVersion === SIM_VERSION && m.games === V.games && m.seed === V.seed);
  if (!V['dry-run']) {
    if (same && !V.force) refuse(`the same measurement is already recorded as ${same.id} (the same lists, bot, simulator version, games and seed): pass --force to add it again under a new id.`);
    if (taken.has(id) && !V.force) refuse(`the id ${id} is already in use${V.id ? '' : ' (the default for this deck, change and bot)'}: give another with --id, or pass --force to add the row under a new id.`);
    if (taken.has(id)) {
      const stem = id.slice(0, 60);
      let n = 2;
      while (taken.has(`${stem}-${n}`)) n++;
      id = `${stem}-${n}`;
    }
  }

  // the games
  const jobs = remeasureJobs(base, cand, field.map((d) => d.deck), V.games, V.seed, bot.bot);
  const results = await io.play(jobs, { threads: V.threads, cache: io.cache?.(V.cache) });
  if (results.length !== jobs.length) return refuse(`${k(jobs.length)} games were asked for and ${k(results.length)} came back.`, 1);
  const scores = results.map((r) => scoreOf(r.winner));
  const b = scores.slice(0, V.games);
  const c = scores.slice(V.games);
  const slots = remeasureSlots(fieldIds, V.games);
  const iv = pairedInterval(c, b, 1.96);
  const d = c.map((x, i) => x - b[i]!);
  const g = pairedGroup(d);
  const split = splitPaired(c, b, slots);
  const strat = stratifiedInterval(c, b, slots, 1.96);
  const het = heterogeneity(split.byOpp);
  const meanOf = (xs: readonly number[]) => xs.reduce((s, x) => s + x, 0) / Math.max(1, xs.length);
  const nameOfOpp = new Map(field.map((f, i) => [fieldIds[i]!, f.deck.name]));
  const byOpp = fieldIds.map((fp) => split.byOpp.find((o) => o.opp === fp)!).filter(Boolean);

  // what it prints
  const botWord = bot.bot.charAt(0).toUpperCase() + bot.bot.slice(1);
  io.out(`${target.deck.name}: ${label}`);
  io.out(`${botWord} bot, simulator version ${SIM_VERSION}: ${k(V.games)} paired games against the ${field.length} meta decks (seeds ${k(V.seed)} to ${k(V.seed + V.games - 1)}; each list goes first in half of them).`);
  io.out('');
  io.out(`Paired difference (after minus before): ${pts(iv.mean)} pts, ${range(iv.lower, iv.upper)} (plain), per-game spread (SD) ${g.sd.toFixed(3)}.`);
  io.out(`Games that came out the same for both lists: ${pct(d.filter((x) => x === 0).length / Math.max(1, d.length))}.`);
  io.out(`Win rates: before ${pct(meanOf(b))}, after ${pct(meanOf(c))}.`);
  io.out(`Stratified by opponent and seat (${strat.cells} cells): ${pts(strat.mean)} pts, ${range(strat.lower, strat.upper)} (standard error ${(strat.se * 100).toFixed(2)} pts, plain ${(g.se * 100).toFixed(2)}).`);
  io.out('By opponent:');
  const wide = Math.max(...byOpp.map((o) => (nameOfOpp.get(o.opp) ?? o.opp).length), 12);
  for (const o of byOpp) io.out(`  ${(nameOfOpp.get(o.opp) ?? o.opp).padEnd(wide)}  ${pts(o.mean).padStart(6)} pts, ${range(o.mean - 1.96 * o.se, o.mean + 1.96 * o.se)}, ${k(o.games)} games`);
  io.out('By seat:');
  for (const s of split.bySeat) io.out(`  ${(s.first ? 'going second' : 'going first').padEnd(wide)}  ${pts(s.mean).padStart(6)} pts, ${range(s.mean - 1.96 * s.se, s.mean + 1.96 * s.se)}, ${k(s.games)} games`);
  io.out(
    het
      ? `Across opponents: χ² ${het.chi2.toFixed(1)} on ${het.df} df, p ${het.p < 0.001 ? '< 0.001' : het.p.toFixed(3)}: ${het.p < 0.05 ? 'the per-opponent figures differ by more than chance, so the pooled number is an average over opponents that differ.' : 'no sign that the per-opponent figures differ by more than chance.'}`
      : 'Across opponents: not tested (it needs two or more opponents with 20 or more games and a spread).',
  );
  io.out('');
  const what = `This is a paired comparison with the ${botWord} bot under simulator version ${SIM_VERSION}: the list with and without the change on the same deals. It says nothing about another bot or simulator version.`;

  // the row
  const row: Remeasurement = {
    id,
    deck: target.file,
    label,
    baseListId,
    candListId,
    cuts: change.cuts,
    adds: change.adds,
    ...(change.legendCuts.length ? { legendCuts: change.legendCuts } : {}),
    ...(change.legendAdds.length ? { legendAdds: change.legendAdds } : {}),
    bot: bot.bot,
    simVersion: SIM_VERSION,
    games: V.games,
    mean: r6(iv.mean),
    se: r6(g.se),
    sd: r6(g.sd),
    byOpp: byOpp.map((o) => ({ opp: nameOfOpp.get(o.opp) ?? o.opp, oppListId: o.opp, games: o.games, mean: r6(o.mean), se: r6(o.se) })),
    bySeat: split.bySeat.map((s) => ({ first: s.first, games: s.games, mean: r6(s.mean), se: r6(s.se) })),
    opponents: fieldIds,
    seed: V.seed,
    date: today,
    script: REMEASURE_SCRIPT,
    ...(V.record ? { record: V.record } : {}),
  };
  if (V['dry-run']) {
    io.out(`${what} Nothing was written (--dry-run).`);
    return 0;
  }
  if (!(row.se > 0)) return refuse('every game came out the same for both lists, so there is no spread to give the difference a standard error: play more games.', 1);
  const problems = remeasureProblems(row, 'the row');
  if (problems.length) return refuse(`the row would not read back (${problems[0]}).`, 1);
  const text = existing === null ? newFileText(row, V.note) : appendRowText(existing, row);
  if (text === null) return refuse(`no row can be appended to ${out}: its measurements list is not the last thing in it. Write to another file with --out.`);
  const check = parseRemeasureFile(JSON.parse(text), out);
  if (!check.file || check.file.measurements.length !== rows.length + 1) return refuse(`the row could not be appended to ${out} so that the file still reads (${check.problems[0] ?? 'rows lost'}).`, 1);
  fs.mkdirSync(path.dirname(out) || '.', { recursive: true });
  fs.writeFileSync(out, text);
  io.out(`${what} Appended to ${out} as ${id}; run npm run evidence to rebuild the findings.`);
  return 0;
}
