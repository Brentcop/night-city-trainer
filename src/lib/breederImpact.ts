// What the season breeder is handed from the two card-impact tables (data/seasons/impact.json, src/lib/seasonImpact.ts;
// data/seasons/deck-impact.json, src/lib/seasonDeckImpact.ts). Both files keep the games of each simulator version and
// bot apart, and the breeder reads the numbers of one pair only: two pairs are never summed.
//
// Which pair (`readImpactTables`, `choosePair`):
//   - exact: the current simulator version and the bot the season plays with, when they have numbers (a season entry,
//     or the review telemetry src/data/analysis.json when its manifest names that pair; the two add together, as they
//     are the same pair). Nothing else is read.
//   - otherwise the closest pair there is, with a warning: the current simulator version with another bot first; else
//     the highest other simulator version. Within one version the season's bot comes first, then the pair with the most
//     drawn-games. The per-list table follows the same pair as the pooled one.
//   - no numbers anywhere: empty tables (the breeder ranks cards by card value alone), with a warning.
// The other pairs are kept in the files, unread, and counted in the printed line. A season writes only to the entry of
// its own pair (scripts/breed-data.ts recordSeasonImpact), so the season after one played on the current version reads
// current numbers.
//
// Why read the closest numbers rather than none: the table is an input to the breeder's card choice, not a reported
// result, and when measured (docs/SYNERGIES.md, "The breeder's card impact": Season 4's 8 lists on Medium) which
// reasonably current table it read mattered little, while no numbers at all cost about 8.5 points per list (5.5 with
// the Hard bot).
//
// `readImpactTables` is the one reader the season (scripts/season.ts, also --gate-only), the preview
// (scripts/breed-preview.ts) and scripts/theorize-ladder.ts use, through `loadImpactTables` in scripts/breed-data.ts.
// `splitImpactFiles` is the one-off split of the pooled files of 2026-11-16 (scripts/migrate-season-impact.ts). Pure.
import { IMPACT_MIN_DECK_GAMES, IMPACT_MIN_POOLED_GAMES, type ImpactCard, type ImpactData, type ImpactDeck } from '../analysis/impactData';
import { addStats, cardMeans, cardTotals, CARD_IMPACT_KIND, CARD_IMPACT_SCHEMA, impactKey, keyWords, sameKey, sameSource, seasonCounted, sourceWords, type CardAcc, type CardImpactFile, type ImpactCardStat, type ImpactKey, type ImpactSource } from './seasonImpact';
import { addCards, breederDeckImpact, DECK_IMPACT_KIND, DECK_IMPACT_SCHEMA, type DeckImpactFile, type DeckImpactFileV1, type DeckImpactList } from './seasonDeckImpact';

/** The parts of src/data/analysis.json this reads. */
export interface AnalysisLike {
  manifest?: { simVersion?: unknown; bot?: unknown; runId?: unknown } | null;
  decks?: readonly { deck: string; id?: string; cards: readonly ImpactCardStat[] }[];
}

/** The simulator version and canonical bot an analysis file's manifest names, or null when it names none. */
export function analysisKey(a: AnalysisLike | null | undefined): ImpactKey | null {
  const m = a?.manifest;
  const level = m && typeof m.bot === 'object' && m.bot !== null ? (m.bot as { level?: unknown }).level : undefined;
  if (!m || typeof m.simVersion !== 'number' || typeof level !== 'string') return null;
  return impactKey(m.simVersion, level);
}

/** Which pair the breeder read: the one wanted, the same simulator version with another bot, another version, or none. */
export type ImpactMatch = 'exact' | 'other-bot' | 'other-version' | 'none';

export interface ImpactTables {
  /** the pair wanted: the current simulator version and the season's bot */
  wanted: ImpactKey;
  /** the pair read (null when nothing was read) */
  read: ImpactKey | null;
  match: ImpactMatch;
  /** card id → mean Δ when drawn, for cards drawn in at least `minPooled` games (breedSeason's `impact`) */
  impact: Record<string, number>;
  /** list fingerprint → card id → mean Δ when drawn, cards drawn in at least `minDeck` games (breedSeason's `deckImpact`) */
  deckImpact: Record<string, Record<string, number>>;
  /** the pair read: its pooled sums (with the review telemetry when it is that pair) and its lists, and their runs */
  pooled: { cards: number; usable: number; drawnGames: number; sources: ImpactSource[] };
  perList: { lists: number; withNumbers: number; sources: ImpactSource[] };
  /** the review telemetry: absent (no file), added (it is the pair read) or not added (another pair, or no manifest) */
  analysis: { state: 'none' } | { state: 'added'; runId: string | null } | { state: 'other'; key: ImpactKey | null };
  /** the other pairs either file holds: kept, not read */
  kept: ImpactKey[];
  minPooled: number;
  minDeck: number;
}

export interface ReadImpactInput {
  cardFile: CardImpactFile;
  deckFile: DeckImpactFile;
  analysis?: AnalysisLike | null;
  /** the current simulator version and the bot the season plays with (any name; read by its canonical name) */
  key: ImpactKey;
  minPooled?: number;
  minDeck?: number;
}

/** One pair's numbers, copied out of the files (the season entry, plus the review telemetry when it names the pair). */
interface PairNumbers {
  key: ImpactKey;
  cards: Record<string, CardAcc>;
  lists: Record<string, DeckImpactList>;
  cardSources: ImpactSource[];
  listSources: ImpactSource[];
  analysisAdded: boolean;
  /** drawn-games in the pooled sums, and in the per-list sums */
  drawnGames: number;
  listGames: number;
}

function pairNumbers(input: ReadImpactInput, key: ImpactKey): PairNumbers {
  const ce = input.cardFile.entries.find((e) => sameKey(e, key));
  const de = input.deckFile.entries.find((e) => sameKey(e, key));
  const cards: Record<string, CardAcc> = {};
  for (const [id, v] of Object.entries(ce?.cards ?? {})) cards[id] = { s: v.s, n: v.n };
  const lists: Record<string, DeckImpactList> = {};
  for (const [fp, l] of Object.entries(de?.lists ?? {})) lists[fp] = { name: l.name, cards: Object.fromEntries(Object.entries(l.cards).map(([id, v]) => [id, { s: v.s, n: v.n }])) };
  const ak = analysisKey(input.analysis);
  const analysisAdded = !!input.analysis && !!ak && sameKey(ak, key);
  if (analysisAdded)
    for (const r of input.analysis?.decks ?? []) {
      addStats(cards, r.cards);
      if (r.id) addCards(lists, r.id, r.deck, r.cards);
    }
  let listGames = 0;
  for (const l of Object.values(lists)) listGames += cardTotals(l.cards).drawnGames;
  return { key, cards, lists, cardSources: ce?.sources ?? [], listSources: de?.sources ?? [], analysisAdded, drawnGames: cardTotals(cards).drawnGames, listGames };
}

/** A pair that could be read, with how many drawn-games it holds (pooled, then per list). */
export interface PairCandidate {
  key: ImpactKey;
  drawnGames: number;
  listGames: number;
}

/**
 * The pair to read for `wanted`, among pairs that hold numbers: the pair itself; else the same simulator version with
 * another bot; else the highest other simulator version. Within one version the wanted bot first, then the most pooled
 * drawn-games, then the most per-list drawn-games, then the bot's name (so the choice never depends on file order).
 */
export function choosePair(wanted: ImpactKey, candidates: readonly PairCandidate[]): { key: ImpactKey; match: ImpactMatch } | null {
  const w = impactKey(wanted.simVersion, wanted.bot);
  const live = candidates.filter((c) => c.drawnGames > 0 || c.listGames > 0);
  const exact = live.find((c) => sameKey(c.key, w));
  if (exact) return { key: exact.key, match: 'exact' };
  const best = (pool: readonly PairCandidate[]) =>
    [...pool].sort((a, b) => Number(b.key.bot === w.bot) - Number(a.key.bot === w.bot) || b.drawnGames - a.drawnGames || b.listGames - a.listGames || a.key.bot.localeCompare(b.key.bot))[0];
  const sameVersion = best(live.filter((c) => c.key.simVersion === w.simVersion));
  if (sameVersion) return { key: sameVersion.key, match: 'other-bot' };
  const others = live.filter((c) => c.key.simVersion !== w.simVersion);
  if (!others.length) return null;
  const top = Math.max(...others.map((c) => c.key.simVersion));
  const pick = best(others.filter((c) => c.key.simVersion === top));
  return pick ? { key: pick.key, match: 'other-version' } : null;
}

const uniqueSources = (xs: readonly ImpactSource[]): ImpactSource[] => xs.filter((s, i) => xs.findIndex((t) => sameSource(s, t)) === i);

/** The pair `readImpactTables` reads for `input` (and so `impactDataOf`), with its numbers; never another pair's. */
function chosenPair(input: ReadImpactInput): { wanted: ImpactKey; chosen: { key: ImpactKey; match: ImpactMatch } | null; got: PairNumbers | undefined } {
  const wanted = impactKey(input.key.simVersion, input.key.bot);
  // every pair the files or the review telemetry hold, each with its own numbers (never another pair's)
  const pairs: ImpactKey[] = [];
  const ak = analysisKey(input.analysis);
  for (const k of [...input.cardFile.entries, ...input.deckFile.entries, ...(input.analysis && ak ? [ak] : [])]) if (!pairs.some((p) => sameKey(p, k))) pairs.push({ simVersion: k.simVersion, bot: k.bot });
  const numbers = pairs.map((k) => pairNumbers(input, k));
  const chosen = choosePair(wanted, numbers);
  return { wanted, chosen, got: chosen ? numbers.find((n) => sameKey(n.key, chosen.key)) : undefined };
}

/** The breeder's two tables: one pair's numbers only (see the header for which). Does not change the files. */
export function readImpactTables(input: ReadImpactInput): ImpactTables {
  const minPooled = input.minPooled ?? IMPACT_MIN_POOLED_GAMES;
  const minDeck = input.minDeck ?? IMPACT_MIN_DECK_GAMES;
  const { wanted, chosen, got } = chosenPair(input);
  const ak = analysisKey(input.analysis);
  const impact = got ? cardMeans(got.cards, minPooled) : {};
  const deckImpact = got ? breederDeckImpact(got.lists, minDeck) : {};
  const analysis: ImpactTables['analysis'] = !input.analysis
    ? { state: 'none' }
    : got?.analysisAdded
      ? { state: 'added', runId: typeof input.analysis.manifest?.runId === 'string' ? input.analysis.manifest.runId : null }
      : { state: 'other', key: ak };
  const kept: ImpactKey[] = [];
  for (const e of [...input.cardFile.entries, ...input.deckFile.entries]) if (!(got && sameKey(e, got.key)) && !kept.some((k) => sameKey(k, e))) kept.push({ simVersion: e.simVersion, bot: e.bot });
  return {
    wanted,
    read: got ? got.key : null,
    match: chosen?.match ?? 'none',
    impact,
    deckImpact,
    pooled: { cards: got ? Object.keys(got.cards).length : 0, usable: Object.keys(impact).length, drawnGames: got?.drawnGames ?? 0, sources: uniqueSources(got?.cardSources ?? []) },
    perList: { lists: got ? Object.keys(got.lists).length : 0, withNumbers: Object.values(deckImpact).filter((m) => Object.keys(m).length > 0).length, sources: uniqueSources(got?.listSources ?? []) },
    analysis,
    kept,
    minPooled,
    minDeck,
  };
}

const num = (n: number) => n.toLocaleString('en-US');
const plural = (n: number, one: string, many = `${one}s`) => `${num(n)} ${n === 1 ? one : many}`;

/** Whether the breeder gets no card numbers at all (it then ranks cards by card value alone). */
export const tablesEmpty = (t: ImpactTables): boolean => t.pooled.usable === 0 && t.perList.withNumbers === 0;

/** Where the plain-language reasons are. */
export const IMPACT_DOC = 'docs/SYNERGIES.md, "The breeder\'s card impact"';

/**
 * What the breeder reads, in plain lines. The first says which pair was read (simulator version, bot, cards,
 * drawn-games, lists, sources) and how many entries of other versions or bots are kept unread. When it is not the pair
 * wanted, or there are no numbers at all, the first line starts "Warning:", says so, and says what makes current
 * numbers. A second line says when the review telemetry was left out.
 */
export function impactTablesWords(t: ImpactTables): string[] {
  const kept = t.kept.length ? `Kept, not read: ${plural(t.kept.length, 'entry', 'entries')} of another simulator version or bot (${t.kept.map(keyWords).join('; ')}).` : 'No entries of another simulator version or bot.';
  const srcs = [...new Set([...t.pooled.sources, ...t.perList.sources].map(sourceWords))];
  if (t.analysis.state === 'added') srcs.push(`src/data/analysis.json${t.analysis.runId ? ` (${t.analysis.runId})` : ''}`);
  const what = `${plural(t.pooled.cards, 'card')} over ${plural(t.pooled.drawnGames, 'drawn-game')} (${num(t.pooled.usable)} drawn in ${t.minPooled}+ games), and per-list numbers for ${plural(t.perList.withNumbers, 'list')}; from ${srcs.join(', ') || 'no recorded run'}`;
  const remedy = `A season's round robin on ${keyWords(t.wanted)} records current numbers, which the next season reads (${IMPACT_DOC}).`;
  let first: string;
  if (t.match === 'exact' && t.read) first = `Card impact read for ${keyWords(t.read)}: ${what}. ${kept}`;
  else if (t.read)
    first = `Warning: no card-impact numbers for ${keyWords(t.wanted)} yet, so the breeder reads those of ${keyWords(t.read)} instead: ${what}. Numbers measured on another ${t.match === 'other-bot' ? 'bot' : 'simulator version'} can mislead. ${remedy} ${kept}`;
  else first = `Warning: no card-impact numbers for ${keyWords(t.wanted)} or any other simulator version or bot, so the breeder ranks cards by their card value alone, which bred clearly weaker lists when it was measured. ${remedy} ${kept}`;
  const out = [first];
  if (t.analysis.state === 'other') out.push(`src/data/analysis.json is not added: ${t.analysis.key ? `it was measured on ${keyWords(t.analysis.key)}` : 'its manifest names no simulator version and bot'}.`);
  return out;
}

// ---------------------------------------------------------------- the coach's and the Deck Lab's copy (src/data/impact.json)

/**
 * Decimals a mean "Δ when drawn" keeps in src/data/impact.json: 0.0001 is a hundredth of a win-rate point, far below the
 * table's noise (about 3.5 points a card), and the file is in every game worker, so its size counts.
 */
export const IMPACT_DATA_DECIMALS = 4;

/**
 * src/data/impact.json since 2026-11-24 (REVIEW_2026-11-24 B.2): the per-list sums of the pair the breeder reads
 * (`readImpactTables`: the season entry of the current simulator version and the season's bot, plus the review
 * telemetry src/data/analysis.json when its manifest names that pair), one entry per list with each card's mean and
 * drawn-games. The coach (src/ai/impact.ts) and the Deck Lab (src/lib/deckLab.ts) pool the lists into the format-wide
 * figure and use a list's own figure from IMPACT_MIN_DECK_GAMES on, so they read the breeder's numbers (to
 * IMPACT_DATA_DECIMALS): one table, not three. Until then the file was a slim copy of analysis.json alone.
 */
export interface ImpactDataFile extends ImpactData {
  /** the pair read (null when there were no numbers) */
  simVersion: number | null;
  bot: string | null;
  match: ImpactMatch;
  /** the runs behind the numbers, in words (`sourceWords`, and the review telemetry by its run id) */
  sources: string[];
}

const roundTo = (x: number, d: number) => {
  const f = 10 ** d;
  const r = Math.round(x * f) / f;
  return r === 0 ? 0 : r;
};

/**
 * The coach's and the Deck Lab's card table: every list of the pair `readImpactTables` reads for `input`, the review
 * telemetry's lists first in its order (under its deck names), then the others by fingerprint; each list's cards by mean,
 * best first. Pure.
 */
export function impactDataOf(input: ReadImpactInput): ImpactDataFile {
  const { chosen, got } = chosenPair(input);
  const lists = got?.lists ?? {};
  const names = new Map<string, string>();
  const order: string[] = [];
  if (got?.analysisAdded)
    for (const r of input.analysis?.decks ?? [])
      if (r.id && lists[r.id] && !names.has(r.id)) {
        names.set(r.id, r.deck);
        order.push(r.id);
      }
  for (const fp of Object.keys(lists).sort()) if (!names.has(fp)) order.push(fp);
  const decks: ImpactDeck[] = order.map((fp) => {
    const l = lists[fp]!;
    const cards = Object.entries(l.cards)
      .filter(([, v]) => v.n > 0)
      .map(([id, v]): ImpactCard => [id, roundTo(v.s / v.n, IMPACT_DATA_DECIMALS), v.n])
      .sort((a, b) => (b[1] as number) - (a[1] as number) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    return { deck: names.get(fp) ?? l.name, id: fp, cards };
  });
  const sources = got ? [...new Set(uniqueSources([...got.cardSources, ...got.listSources]).map(sourceWords))] : [];
  if (got?.analysisAdded) sources.push(`review telemetry (${typeof input.analysis?.manifest?.runId === 'string' ? input.analysis.manifest.runId : 'src/data/analysis.json'})`);
  return { simVersion: got?.key.simVersion ?? null, bot: got?.key.bot ?? null, match: chosen?.match ?? 'none', sources, decks };
}

/** The file's text, as committed (one line, as `sim analyze` always wrote it). */
export const impactDataText = (f: ImpactDataFile): string => JSON.stringify(f);

/**
 * Drawn-games in the pair's pooled sums that no list carries (0 when the lists add up to the pooled table, as every
 * season's do): the coach's format-wide figure, pooled from the lists, then equals the breeder's.
 */
export function pooledOutsideLists(t: Pick<ImpactTables, 'pooled'>, f: ImpactData): number {
  let n = 0;
  for (const d of f.decks) for (const c of d.cards) n += c[2];
  return t.pooled.drawnGames - n;
}

/** What src/data/impact.json holds, in plain lines (scripts/build-impact.ts, `sim analyze`); "Warning:" when it is not the pair wanted. */
export function impactDataWords(t: ImpactTables, f: ImpactDataFile): string[] {
  let n = 0;
  for (const d of f.decks) for (const c of d.cards) n += c[2];
  const what = `${plural(f.decks.length, 'list')}, ${plural(n, 'drawn-game')}; from ${f.sources.join(', ') || 'no recorded run'}`;
  const out: string[] = [];
  if (t.match === 'exact' && t.read) out.push(`Card table for the coach and the Deck Lab (src/data/impact.json): ${keyWords(t.read)}, the pair the breeder reads: ${what}.`);
  else if (t.read) out.push(`Warning: no card-impact numbers for ${keyWords(t.wanted)}, so the coach and the Deck Lab read those of ${keyWords(t.read)}, as the breeder does: ${what}.`);
  else out.push(`Warning: no card-impact numbers for ${keyWords(t.wanted)} or any other simulator version or bot, so the coach and the Deck Lab get no card figures.`);
  const outside = pooledOutsideLists(t, f);
  if (outside !== 0) out.push(`Note: ${plural(outside, 'drawn-game')} of the pooled table are in no list, so the coach's format-wide figure leaves them out and differs from the breeder's.`);
  return out;
}

// ---------------------------------------------------------------- a season already counted

/** Whether a season is already counted in the two files: in neither, in both, or in one only (a run stopped between the writes). */
export type SeasonCount = { state: 'neither' } | { state: 'both' } | { state: 'one'; has: 'impact.json' | 'deck-impact.json'; lacks: 'impact.json' | 'deck-impact.json' };

/** Is `season` counted in the pooled file, the per-list file, both or neither (under any pair)? Decided before a season plays. */
export function seasonCountIn(card: CardImpactFile, deck: DeckImpactFile, season: number): SeasonCount {
  const src: ImpactSource = { kind: 'season', season };
  const inCard = seasonCounted(card.entries, src);
  const inDeck = seasonCounted(deck.entries, src);
  if (inCard && inDeck) return { state: 'both' };
  if (inCard) return { state: 'one', has: 'impact.json', lacks: 'deck-impact.json' };
  if (inDeck) return { state: 'one', has: 'deck-impact.json', lacks: 'impact.json' };
  return { state: 'neither' };
}

/** The season's start line for a season already counted (both files), or its refusal (one file only); null for neither. */
export function seasonCountWords(season: number, c: SeasonCount): { line: string; refuse: boolean } | null {
  if (c.state === 'neither') return null;
  if (c.state === 'both') return { line: `Season ${season}'s round robin is already in the card-impact tables (data/seasons/impact.json and deck-impact.json): it will not be added again.`, refuse: false };
  return {
    line: `data/seasons/${c.has} counts season ${season} but data/seasons/${c.lacks} does not (a run stopped between the two writes); npm run check:data shows it. Put the two files back in step (from git history) before running season ${season}: nothing is guessed.`,
    refuse: true,
  };
}

// ---------------------------------------------------------------- check:data

/** A recorded season's round robin pair (data/seasons/season-N.json manifest; null when it names none). */
export interface SeasonPair {
  season: number;
  key: ImpactKey | null;
}

/**
 * Problems across the two parsed files (scripts/check-data.ts): every season is counted under the same pair in both
 * files, and under the pair its season file's manifest names. Each file's own shape is checked by its parser.
 */
export function impactFilesProblems(card: CardImpactFile, deck: DeckImpactFile, seasons: readonly SeasonPair[]): string[] {
  const out: string[] = [];
  const seasonsOf = (entries: readonly { simVersion: number; bot: string; sources: readonly ImpactSource[] }[]) =>
    new Map(entries.flatMap((e) => e.sources.flatMap((s) => (s.kind === 'season' ? [[s.season, e] as const] : []))));
  const inCard = seasonsOf(card.entries);
  const inDeck = seasonsOf(deck.entries);
  for (const [season, e] of inCard) {
    const d = inDeck.get(season);
    if (!d) out.push(`season ${season} is counted in data/seasons/impact.json but not in deck-impact.json`);
    else if (!sameKey(d, e)) out.push(`season ${season} is counted under ${keyWords(e)} in impact.json and ${keyWords(d)} in deck-impact.json`);
  }
  for (const season of inDeck.keys()) if (!inCard.has(season)) out.push(`season ${season} is counted in data/seasons/deck-impact.json but not in impact.json`);
  for (const s of seasons) {
    const e = inCard.get(s.season) ?? inDeck.get(s.season);
    if (e && s.key && !sameKey(e, s.key)) out.push(`season ${s.season} was played on ${keyWords(s.key)} (its manifest) but is counted under ${keyWords(e)}`);
  }
  return out;
}

/** One line per file for check:data's passed list. */
export function impactFileWords(file: { entries: readonly (ImpactKey & { sources: readonly ImpactSource[] })[] }, count: (i: number) => string): string {
  return `${plural(file.entries.length, 'entry', 'entries')}, one per simulator version and bot: ${file.entries.map((e, i) => `${keyWords(e)}, ${count(i)} from ${e.sources.map(sourceWords).join(', ') || 'no run'}`).join('; ') || 'none yet'}`;
}

// ---------------------------------------------------------------- the split of 2026-11-16 (one-off)

/** One part of the split: the pair its games were played on and the runs it holds. */
export interface SplitPart {
  key: ImpactKey;
  /** the runs in both files (the seasons) */
  sources: ImpactSource[];
  /** runs in the pooled file only, listed first: the review telemetry it was seeded from (the per-list file never stored it) */
  pooledOnly?: ImpactSource[];
}

/** The float d nearest to total − part for which part + d === total exactly, or null when there is none close by. */
export function exactDifference(total: number, part: number): number | null {
  const d = total - part;
  if (part + d === total) return d;
  const buf = new Float64Array(1);
  const bits = new BigInt64Array(buf.buffer);
  for (let k = 1n; k <= 64n; k++)
    for (const sign of [1n, -1n]) {
      buf[0] = d;
      bits[0]! += sign * k * (d >= 0 ? 1n : -1n);
      const c = buf[0]!;
      if (Number.isFinite(c) && part + c === total) return c;
    }
  return null;
}

/** later = now − before, card by card; problems for a card that lost games, vanished, or cannot be split exactly. */
function diffCards(before: Readonly<Record<string, CardAcc>>, now: Readonly<Record<string, CardAcc>>, what: string, problems: string[]): Record<string, CardAcc> {
  const out: Record<string, CardAcc> = {};
  for (const id of Object.keys(before)) if (!now[id]) problems.push(`${what}: card ${id} is in the earlier file but not the later one`);
  for (const [id, v] of Object.entries(now)) {
    const b = before[id] ?? { s: 0, n: 0 };
    const n = v.n - b.n;
    if (n < 0) problems.push(`${what}: card ${id} has fewer drawn-games than before (${v.n} < ${b.n})`);
    if (n === 0) {
      if (v.s !== b.s) problems.push(`${what}: card ${id} has the same drawn-games but another sum`);
      continue;
    }
    // when no float makes b + d equal the total (a total much smaller than its parts), the plain difference: off by one
    // rounding step, which checkSplit allows and counts
    out[id] = { s: exactDifference(v.s, b.s) ?? v.s - b.s, n };
  }
  return out;
}

/** How far a + b is from `total`, and whether that is within one rounding step of the larger part (else a real gap). */
export function addsUpTo(a: number, b: number, total: number): { exact: boolean; off: number; withinRounding: boolean } {
  const off = a + b - total;
  return { exact: off === 0, off, withinRounding: Math.abs(off) <= Number.EPSILON * Math.max(Math.abs(a), Math.abs(b), Math.abs(total)) };
}

/** Card sums of every list of a lists object, added card by card. */
export function sumLists(lists: Readonly<Record<string, { cards: Readonly<Record<string, CardAcc>> }>>): Record<string, CardAcc> {
  const out: Record<string, CardAcc> = {};
  for (const l of Object.values(lists))
    for (const [id, v] of Object.entries(l.cards)) {
      const a = (out[id] ??= { s: 0, n: 0 });
      a.s += v.s;
      a.n += v.n;
    }
  return out;
}

export interface SplitResult {
  card: CardImpactFile;
  deck: DeckImpactFile;
  problems: string[];
}

/**
 * Split the pooled files into an earlier entry (the `before` files exactly) and a later one (now − before, list by list
 * and card by card). Every later sum is chosen so that earlier + later equals the `now` file's number exactly where a
 * float can (drawn-games always can; a sum whose total is much smaller than its parts may be one rounding step off, which
 * checkSplit counts). Lists and cards the later share did not add to are left out of its entry.
 */
export function splitImpactFiles(input: { beforeCard: Record<string, CardAcc>; nowCard: Record<string, CardAcc>; beforeDeck: DeckImpactFileV1; nowDeck: DeckImpactFileV1; earlier: SplitPart; later: SplitPart }): SplitResult {
  const problems: string[] = [];
  const { earlier, later } = input;
  if (sameKey(earlier.key, later.key)) problems.push(`both parts are ${keyWords(earlier.key)}: nothing to split`);
  const ek = impactKey(earlier.key.simVersion, earlier.key.bot);
  const lk = impactKey(later.key.simVersion, later.key.bot);
  const laterCards = diffCards(input.beforeCard, input.nowCard, 'impact.json', problems);
  const card: CardImpactFile = {
    kind: CARD_IMPACT_KIND,
    schema: CARD_IMPACT_SCHEMA,
    entries: [
      { ...ek, sources: [...(earlier.pooledOnly ?? []), ...earlier.sources], cards: input.beforeCard },
      { ...lk, sources: [...(later.pooledOnly ?? []), ...later.sources], cards: laterCards },
    ],
  };
  const laterLists: Record<string, DeckImpactList> = {};
  for (const fp of Object.keys(input.beforeDeck.lists)) if (!input.nowDeck.lists[fp]) problems.push(`deck-impact.json: list ${fp} is in the earlier file but not the later one`);
  for (const [fp, l] of Object.entries(input.nowDeck.lists)) {
    const b = input.beforeDeck.lists[fp];
    if (b && b.name !== l.name) problems.push(`deck-impact.json: list ${fp} is named "${b.name}" before and "${l.name}" after`);
    const cards = diffCards(b?.cards ?? {}, l.cards, `deck-impact.json list ${fp}`, problems);
    if (Object.keys(cards).length) laterLists[fp] = { name: l.name, cards };
  }
  if (JSON.stringify(input.beforeDeck.unmatched ?? null) !== JSON.stringify(input.nowDeck.unmatched ?? null)) problems.push('deck-impact.json: the unmatched section changed between the two files');
  const deck: DeckImpactFile = {
    kind: DECK_IMPACT_KIND,
    schema: DECK_IMPACT_SCHEMA,
    keyedBy: 'listFingerprint',
    entries: [
      { ...ek, sources: earlier.sources, lists: input.beforeDeck.lists, ...(input.beforeDeck.unmatched ? { unmatched: input.beforeDeck.unmatched } : {}) },
      { ...lk, sources: later.sources, lists: laterLists },
    ],
  };
  return { card, deck, problems };
}

/**
 * The split's exactness: for every card and list, the earlier entry equals the `before` file bit for bit, the two
 * entries' drawn-games add up to the `now` file exactly and their sums exactly or (where no float can) within one rounding
 * step, and the later entry is the difference. `problems` lists what does not hold (empty when the split is right);
 * `rounded` names the sums that are one rounding step off, with how far.
 */
export function checkSplit(
  r: SplitResult,
  input: { beforeCard: Record<string, CardAcc>; nowCard: Record<string, CardAcc>; beforeDeck: DeckImpactFileV1; nowDeck: DeckImpactFileV1 },
): { problems: string[]; rounded: { what: string; off: number }[]; checked: number; cards: number; lists: number; laterCards: number; laterLists: number } {
  const problems: string[] = [];
  const rounded: { what: string; off: number }[] = [];
  let checked = 0;
  const [ce, cl] = r.card.entries;
  const [de, dl] = r.deck.entries;
  if (!ce || !cl || !de || !dl) return { problems: ['the split does not have two entries in each file'], rounded, checked, cards: 0, lists: 0, laterCards: 0, laterLists: 0 };
  const cmp = (what: string, before: Record<string, CardAcc>, now: Record<string, CardAcc>, early: Record<string, CardAcc>, late: Record<string, CardAcc>) => {
    for (const id of new Set([...Object.keys(before), ...Object.keys(now), ...Object.keys(early), ...Object.keys(late)])) {
      checked++;
      const b = before[id] ?? { s: 0, n: 0 };
      const n = now[id] ?? { s: 0, n: 0 };
      const e = early[id] ?? { s: 0, n: 0 };
      const l = late[id] ?? { s: 0, n: 0 };
      if (e.s !== b.s || e.n !== b.n || !!early[id] !== !!before[id]) problems.push(`${what} ${id}: the earlier entry is not the earlier file`);
      if (e.n + l.n !== n.n) problems.push(`${what} ${id}: the drawn-games do not add up to the later file`);
      if (l.n !== n.n - b.n) problems.push(`${what} ${id}: the later entry's drawn-games are not the difference`);
      if (late[id] && l.n <= 0) problems.push(`${what} ${id}: the later entry holds a card with no drawn-games`);
      const sum = addsUpTo(e.s, l.s, n.s);
      if (!sum.withinRounding) problems.push(`${what} ${id}: the sums do not add up to the later file (off by ${sum.off})`);
      else if (!sum.exact) rounded.push({ what: `${what} ${id}`, off: sum.off });
    }
  };
  cmp('impact.json card', input.beforeCard, input.nowCard, ce.cards, cl.cards);
  for (const fp of new Set([...Object.keys(input.beforeDeck.lists), ...Object.keys(input.nowDeck.lists)]))
    cmp(`deck-impact.json list ${fp} card`, input.beforeDeck.lists[fp]?.cards ?? {}, input.nowDeck.lists[fp]?.cards ?? {}, de.lists[fp]?.cards ?? {}, dl.lists[fp]?.cards ?? {});
  for (const fp of Object.keys(dl.lists)) if (!input.nowDeck.lists[fp]) problems.push(`deck-impact.json list ${fp}: in the later entry but not the later file`);
  return { problems, rounded, checked, cards: Object.keys(input.nowCard).length, lists: Object.keys(input.nowDeck.lists).length, laterCards: Object.keys(cl.cards).length, laterLists: Object.keys(dl.lists).length };
}
