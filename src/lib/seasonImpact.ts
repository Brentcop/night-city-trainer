// data/seasons/impact.json: the season breeder's pooled card impact ("Δ when drawn" by card, summed over the season
// round robins), kept apart by simulator version and bot. Each entry holds the sums of the games of one (simulator
// version, bot) pair and the runs they came from; entries are kept, never pooled, and the breeder reads one pair's
// numbers: the current simulator version and the bot the season plays with when they have any, else the closest pair,
// with a warning (src/lib/breederImpact.ts).
//
// Until 2026-11-16 the file was one plain object `{ cardId: { s, n } }` with no simulator version or bot, so Season 3's
// Hard games on simulator version 9 were added to the sums of the `deep` bot on version 5. `parseCardImpact` refuses that
// shape with a sentence naming the migration (scripts/migrate-season-impact.ts, which split the committed file exactly).
// The per-list file beside it (data/seasons/deck-impact.json, src/lib/seasonDeckImpact.ts) is kept the same way and
// shares the types here. Pure: the scripts read and write the files.
import { ledgerBot } from './changeLedger';

/** Σ (Δ when drawn × games the card was drawn) and Σ games drawn, for one card. */
export interface CardAcc {
  s: number;
  n: number;
}
/** A card statistic as the analysis reports carry it (src/analysis/analyze.ts CardStat). */
export interface ImpactCardStat {
  id: string;
  iwd: number;
  seenGames: number;
}
/** Which games an entry holds: one simulator version and one bot (its canonical name, `impactBot`). */
export interface ImpactKey {
  simVersion: number;
  bot: string;
}
/**
 * Where an entry's games came from: a season's round robin (its number and the round robin manifest's run id), the
 * review telemetry (src/data/analysis.json, by its manifest's run id), which seeded the pooled table when it was started,
 * or a rating-series run (data/series/run-N.json, by its id and its manifest's run id; since 2026-11-24 a run traces its
 * Hard games and carries their card impact, src/lib/seriesImpact.ts). Each source is counted once in a file.
 */
export type ImpactSource = { kind: 'season'; season: number; runId?: string } | { kind: 'analysis'; runId: string } | { kind: 'series'; run: string; runId: string };

/**
 * The canonical name of a bot for these tables, the change ledger's (`ledgerBot`): lookahead and best are Medium, fast is
 * Easy. A name the ledger refuses or does not know is kept as it is (hard-v1 is its own bot here).
 */
export const impactBot = (name: string): string => ledgerBot(name).bot ?? name;
export const impactKey = (simVersion: number, bot: string): ImpactKey => ({ simVersion, bot: impactBot(bot) });
export const sameKey = (a: ImpactKey, b: ImpactKey): boolean => a.simVersion === b.simVersion && impactBot(a.bot) === impactBot(b.bot);
export const keyWords = (k: ImpactKey): string => `simulator version ${k.simVersion}, ${k.bot} bot`;
export const sourceWords = (s: ImpactSource): string => (s.kind === 'season' ? `season ${s.season}` : s.kind === 'series' ? `rating ${s.run.replace('-', ' ')}` : `review telemetry (${s.runId})`);
/** The same run: a season by its number, a rating-series run by its id (run-N; its runId is checked apart), telemetry by its run id. */
export const sameSource = (a: ImpactSource, b: ImpactSource): boolean =>
  a.kind === 'season' && b.kind === 'season' ? a.season === b.season : a.kind === 'series' && b.kind === 'series' ? a.run === b.run : a.kind === 'analysis' && b.kind === 'analysis' ? a.runId === b.runId : false;

// ---------------------------------------------------------------- shared checks
export const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
export const isAcc = (x: unknown): x is CardAcc => isObj(x) && typeof x.s === 'number' && Number.isFinite(x.s) && typeof x.n === 'number' && Number.isFinite(x.n) && x.n >= 0;
export const isCards = (x: unknown): x is Record<string, CardAcc> => isObj(x) && Object.values(x).every(isAcc);

/** Why an entry's key or sources are malformed, or null. `what` names the entry in the sentence. */
export function entryHeaderProblem(e: Record<string, unknown>, what: string): string | null {
  if (typeof e.simVersion !== 'number' || !Number.isInteger(e.simVersion) || e.simVersion < 1) return `${what}: needs a simulator version (a whole number from 1)`;
  if (typeof e.bot !== 'string' || !e.bot) return `${what}: needs a bot`;
  if (impactBot(e.bot) !== e.bot) return `${what}: bot "${e.bot}" is not the canonical name ("${impactBot(e.bot)}")`;
  if (!Array.isArray(e.sources)) return `${what}: needs a list of sources`;
  for (const s of e.sources as unknown[]) {
    const ok =
      isObj(s) &&
      ((s.kind === 'season' && typeof s.season === 'number' && Number.isInteger(s.season) && s.season >= 1 && (s.runId === undefined || typeof s.runId === 'string')) ||
        (s.kind === 'analysis' && typeof s.runId === 'string' && !!s.runId) ||
        (s.kind === 'series' && typeof s.run === 'string' && /^run-[1-9]\d*$/.test(s.run) && typeof s.runId === 'string' && !!s.runId));
    if (!ok) return `${what}: a source is malformed (${JSON.stringify(s)})`;
  }
  const srcs = e.sources as ImpactSource[];
  if (srcs.some((s, i) => srcs.findIndex((t) => sameSource(s, t)) !== i)) return `${what}: a source is listed twice`;
  return null;
}

/** Why a list of entries is not one entry per key and one entry per season, or null. */
export function entriesProblem(entries: readonly { simVersion: number; bot: string; sources: readonly ImpactSource[] }[]): string | null {
  for (let i = 0; i < entries.length; i++) {
    const e = entries[i]!;
    if (entries.findIndex((x) => sameKey(x, e)) !== i) return `has two entries for ${keyWords(e)}`;
    for (const s of e.sources) {
      const other = entries.findIndex((x, j) => j !== i && x.sources.some((t) => sameSource(s, t)));
      if (other >= 0 && s.kind !== 'analysis') return `counts ${sourceWords(s)} in two entries (${keyWords(e)} and ${keyWords(entries[other]!)})`;
    }
  }
  return null;
}

/** Add report card numbers to card sums (a card with no finite Δ or no drawn games adds nothing). */
export function addStats(cards: Record<string, CardAcc>, stats: readonly ImpactCardStat[]) {
  for (const c of stats) {
    if (typeof c.iwd !== 'number' || !Number.isFinite(c.iwd) || !c.seenGames) continue;
    const a = (cards[c.id] ??= { s: 0, n: 0 });
    a.s += c.iwd * c.seenGames;
    a.n += c.seenGames;
  }
}

/** Card id → mean Δ when drawn, for cards drawn in at least `min` games. */
export const cardMeans = (cards: Readonly<Record<string, CardAcc>>, min: number): Record<string, number> =>
  Object.fromEntries(
    Object.entries(cards)
      .filter(([, v]) => v.n >= min)
      .map(([id, v]) => [id, v.s / v.n]),
  );

// ---------------------------------------------------------------- the pooled card table (data/seasons/impact.json)
export const CARD_IMPACT_KIND = 'nct-card-impact';
export const CARD_IMPACT_SCHEMA = 1;
export const SEASON_IMPACT_MIGRATION = 'npx tsx scripts/migrate-season-impact.ts';

export interface CardImpactEntry extends ImpactKey {
  sources: ImpactSource[];
  cards: Record<string, CardAcc>;
}
export interface CardImpactFile {
  kind: typeof CARD_IMPACT_KIND;
  schema: typeof CARD_IMPACT_SCHEMA;
  entries: CardImpactEntry[];
}
export const emptyCardImpact = (): CardImpactFile => ({ kind: CARD_IMPACT_KIND, schema: CARD_IMPACT_SCHEMA, entries: [] });

/** The old file: card id → {s, n}, with no `kind`, no simulator version and no bot. */
export function isLegacyCardImpact(raw: unknown): raw is Record<string, CardAcc> {
  return isObj(raw) && !('kind' in raw) && Object.values(raw).every(isAcc);
}
export const LEGACY_CARD_IMPACT = `is the old pooled file with no simulator version or bot; split it by simulator version and bot with ${SEASON_IMPACT_MIGRATION} (see its header)`;

/** Read the pooled file (already JSON-parsed). The old shape and anything malformed are refused with a reason. */
export function parseCardImpact(raw: unknown): { file: CardImpactFile; problem?: undefined } | { file?: undefined; problem: string } {
  if (isLegacyCardImpact(raw)) return { problem: LEGACY_CARD_IMPACT };
  if (!isObj(raw) || raw.kind !== CARD_IMPACT_KIND) return { problem: `is not a card-impact file (kind "${CARD_IMPACT_KIND}")` };
  if (raw.schema !== CARD_IMPACT_SCHEMA) return { problem: `has schema ${String(raw.schema)}; this code reads schema ${CARD_IMPACT_SCHEMA}` };
  if (!Array.isArray(raw.entries)) return { problem: 'has no entries' };
  for (const [i, e] of (raw.entries as unknown[]).entries()) {
    if (!isObj(e)) return { problem: `entry ${i + 1} is not an object` };
    const p = entryHeaderProblem(e, `entry ${i + 1}`);
    if (p) return { problem: p };
    if (!isCards(e.cards)) return { problem: `entry ${i + 1}: needs cards of {s, n} with finite numbers` };
  }
  const file = raw as unknown as CardImpactFile;
  const p = entriesProblem(file.entries);
  if (p) return { problem: p };
  return { file };
}

/** The entry for `key` (created, at the end, when the file has none). */
export function cardEntry(file: CardImpactFile, key: ImpactKey): CardImpactEntry {
  const k = impactKey(key.simVersion, key.bot);
  let e = file.entries.find((x) => sameKey(x, k));
  if (!e) file.entries.push((e = { ...k, sources: [], cards: {} }));
  return e;
}

/** A season source already counted anywhere in a file: a season is counted once. */
export function seasonCounted(entries: readonly { sources: readonly ImpactSource[] }[], source: ImpactSource): boolean {
  return entries.some((e) => e.sources.some((s) => sameSource(s, source)));
}

/** Add one run's reports to the pooled entry for `key`, recording the source. Throws when the source is already counted. */
export function addToCardImpact(file: CardImpactFile, key: ImpactKey, source: ImpactSource, reports: readonly { cards: readonly ImpactCardStat[] }[]) {
  if (seasonCounted(file.entries, source)) throw new Error(`data/seasons/impact.json already counts ${sourceWords(source)}`);
  const e = cardEntry(file, key);
  e.sources.push(source);
  for (const r of reports) addStats(e.cards, r.cards);
}

/** Cards and drawn-games of a card-sum table. */
export function cardTotals(cards: Readonly<Record<string, CardAcc>>): { cards: number; drawnGames: number } {
  let n = 0;
  for (const v of Object.values(cards)) n += v.n;
  return { cards: Object.keys(cards).length, drawnGames: n };
}
