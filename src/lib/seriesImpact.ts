// The rating series' card impact (2026-11-24, docs/REVIEW_2026-11-24.md B.2 and R3; docs/SERIES.md "The card table"):
// a series run traces its Hard games and carries each deck's "Δ when drawn" per card in the run file (`impact`), and
// `npx tsx scripts/series.ts impact` adds every run that carries it to the season breeder's two tables
// (data/seasons/impact.json and deck-impact.json, src/lib/seasonImpact.ts and src/lib/seasonDeckImpact.ts), in the entry
// of the run's simulator version and bot, with the run as the source ({ kind: 'series', run: 'run-N', runId }).
//
// One definition per number: a deck's card figures are what src/analysis/analyze.ts `analyzeAll` gives for the run's
// games (the season's round robin is recorded from it): a card drawn in at least 8 of the deck's games and missing from
// at least 8 has iwd = win rate when drawn − win rate when not (Legends left out). `ImpactCounter` folds the games'
// summaries into counts as they arrive, so a run of 12,000 games keeps a few counts per card instead of every summary;
// the results are 0, ½ or 1, so the sums are exact and the figures equal analyzeAll's bit for bit
// (tests/series-impact.test.ts compares them).
//
// Never counted twice: a source is counted at most once in each file (`sameSource`: a series run by its id), the step
// adds a run to a file only when that file does not count it yet (so a step stopped between the two writes is finished
// by the next one), refuses a file that counts a run under another manifest run id (a run file replaced after it was
// counted), and check:data (`seriesImpactProblems`) fails when a run that carries card impact is not counted in both
// files under its own pair, or a file counts a series run that is not recorded. A run refused before it is committed is
// never counted: the tables are rebuilt from the committed run files only. Pure: the scripts read and write the files.
import { addToCardImpact, impactKey, isObj, keyWords, sameKey, type CardImpactFile, type ImpactCardStat, type ImpactKey, type ImpactSource } from './seasonImpact';
import { addToDeckImpact, FINGERPRINT_RE, type DeckImpactFile } from './seasonDeckImpact';

export const RUN_IMPACT_KIND = 'nct-run-card-impact';
export const RUN_IMPACT_SCHEMA = 1;
/** analyze.ts cardStats' minimum: a card drawn in fewer games, or missing from fewer, has no figure. */
export const RUN_IMPACT_MIN_N = 8;

/** One deck's figures in one run (its list fingerprint, its games, each card's Δ when drawn and the games it was drawn in). */
export interface RunImpactDeck {
  deck: string;
  id: string;
  games: number;
  cards: ImpactCardStat[];
}
/** The block a run file carries as `impact`. */
export interface RunImpact {
  kind: typeof RUN_IMPACT_KIND;
  schema: typeof RUN_IMPACT_SCHEMA;
  /** the games traced: every game of the run */
  games: number;
  decks: RunImpactDeck[];
}

/** The parts of a game summary (src/analysis/summarize.ts PlayerSummary) the count reads. */
export interface SummaryLike {
  deck: string;
  result: number;
  seen: readonly string[];
}

/** Counts per deck and card, folded from game summaries as they arrive. */
export class ImpactCounter {
  private decks = new Map<string, { n: number; w: number; cards: Map<string, { s: number; ws: number }> }>();
  games = 0;
  /** `skip`: cards with no figure (Legends) */
  constructor(private skip: (cardId: string) => boolean) {}
  /** one game: both seats' summaries */
  add(summaries: readonly SummaryLike[]) {
    this.games++;
    for (const g of summaries) {
      let d = this.decks.get(g.deck);
      if (!d) this.decks.set(g.deck, (d = { n: 0, w: 0, cards: new Map() }));
      d.n++;
      d.w += g.result;
      for (const id of g.seen) {
        if (this.skip(id)) continue;
        let c = d.cards.get(id);
        if (!c) d.cards.set(id, (c = { s: 0, ws: 0 }));
        c.s++;
        c.ws += g.result;
      }
    }
  }
  /** The run's block: decks by name, cards by id, only decks whose list fingerprint is known and cards with a figure. */
  result(fingerprintOf: (deck: string) => string | undefined): RunImpact {
    const decks: RunImpactDeck[] = [];
    for (const name of [...this.decks.keys()].sort()) {
      const d = this.decks.get(name)!;
      const id = fingerprintOf(name);
      if (!id) continue;
      const cards: ImpactCardStat[] = [];
      for (const cid of [...d.cards.keys()].sort()) {
        const c = d.cards.get(cid)!;
        const not = d.n - c.s;
        if (c.s < RUN_IMPACT_MIN_N || not < RUN_IMPACT_MIN_N) continue;
        cards.push({ id: cid, iwd: c.ws / c.s - (d.w - c.ws) / not, seenGames: c.s });
      }
      decks.push({ deck: name, id, games: d.n, cards });
    }
    return { kind: RUN_IMPACT_KIND, schema: RUN_IMPACT_SCHEMA, games: this.games, decks };
  }
}

const isCount = (x: unknown) => typeof x === 'number' && Number.isInteger(x) && x >= 0;

/** Read a run file's `impact` block (already JSON-parsed): the block, or why it is malformed. */
export function readRunImpact(raw: unknown): { impact: RunImpact; problem?: undefined } | { impact?: undefined; problem: string } {
  if (!isObj(raw) || raw.kind !== RUN_IMPACT_KIND) return { problem: `is not a run card-impact block (kind "${RUN_IMPACT_KIND}")` };
  if (raw.schema !== RUN_IMPACT_SCHEMA) return { problem: `has schema ${String(raw.schema)}; this code reads schema ${RUN_IMPACT_SCHEMA}` };
  if (!isCount(raw.games)) return { problem: 'needs the number of games traced' };
  if (!Array.isArray(raw.decks)) return { problem: 'has no decks' };
  const names = new Set<string>();
  for (const d of raw.decks as unknown[]) {
    if (!isObj(d) || typeof d.deck !== 'string' || !d.deck) return { problem: 'has a deck without a name' };
    if (names.has(d.deck)) return { problem: `has "${d.deck}" twice` };
    names.add(d.deck);
    if (typeof d.id !== 'string' || !FINGERPRINT_RE.test(d.id)) return { problem: `"${d.deck}": its id is not a list fingerprint` };
    if (!isCount(d.games) || !Array.isArray(d.cards)) return { problem: `"${d.deck}": needs games and cards` };
    for (const c of d.cards as unknown[])
      if (!isObj(c) || typeof c.id !== 'string' || !c.id || typeof c.iwd !== 'number' || !Number.isFinite(c.iwd) || Math.abs(c.iwd) > 1 || !isCount(c.seenGames) || !(c.seenGames as number) || (c.seenGames as number) > (d.games as number))
        return { problem: `"${d.deck}": a card is malformed (${JSON.stringify(c)})` };
  }
  return { impact: raw as unknown as RunImpact };
}

/** What the step and the check read of a run file. */
export interface RunWithImpact {
  /** run-N */
  id: string;
  /** the manifest's run id (series:run-N:<date>) */
  runId: string;
  simVersion: number;
  bot: string;
  impact: RunImpact;
}

export const seriesSource = (r: Pick<RunWithImpact, 'id' | 'runId'>): ImpactSource => ({ kind: 'series', run: r.id, runId: r.runId });

/** The series source for run `id` in a file (whatever its run id), with its entry's pair, or null. */
function countedAs(entries: readonly (ImpactKey & { sources: readonly ImpactSource[] })[], id: string): { key: ImpactKey; runId: string } | null {
  for (const e of entries)
    for (const s of e.sources) if (s.kind === 'series' && s.run === id) return { key: { simVersion: e.simVersion, bot: e.bot }, runId: s.runId };
  return null;
}

/**
 * Add one run to the two tables, each only when it does not count the run yet. Returns which file it was added to.
 * Throws (nothing is changed in that file) when a file counts the run under another manifest run id or another pair.
 */
export function addRunImpact(card: CardImpactFile, deck: DeckImpactFile, run: RunWithImpact): { card: boolean; deck: boolean } {
  const key = impactKey(run.simVersion, run.bot);
  const added = { card: false, deck: false };
  for (const [what, file] of [
    ['data/seasons/impact.json', card],
    ['data/seasons/deck-impact.json', deck],
  ] as const) {
    const c = countedAs(file.entries, run.id);
    if (c && (c.runId !== run.runId || !sameKey(c.key, key)))
      throw new Error(`${what} counts rating ${run.id} as ${c.runId} under ${keyWords(c.key)}, but data/series/${run.id}.json is ${run.runId} under ${keyWords(key)}: a run file replaced after it was counted. Put the file back in step (from git history); nothing is guessed.`);
  }
  if (!countedAs(card.entries, run.id)) {
    addToCardImpact(card, key, seriesSource(run), run.impact.decks);
    added.card = true;
  }
  if (!countedAs(deck.entries, run.id)) {
    const ids = new Map(run.impact.decks.map((d) => [d.deck, d.id]));
    addToDeckImpact(deck, key, seriesSource(run), run.impact.decks, (name) => ids.get(name));
    added.deck = true;
  }
  return added;
}

/**
 * check:data: every recorded run that carries card impact is counted in both files, under its own pair and run id, and
 * every series run a file counts is a recorded run that carries card impact.
 */
export function seriesImpactProblems(card: CardImpactFile, deck: DeckImpactFile, runs: readonly RunWithImpact[]): string[] {
  const out: string[] = [];
  const byId = new Map(runs.map((r) => [r.id, r]));
  for (const [what, file] of [
    ['impact.json', card],
    ['deck-impact.json', deck],
  ] as const) {
    for (const r of runs) {
      const c = countedAs(file.entries, r.id);
      if (!c) out.push(`rating ${r.id} carries card impact but data/seasons/${what} does not count it (run npx tsx scripts/series.ts impact)`);
      else if (c.runId !== r.runId) out.push(`data/seasons/${what} counts rating ${r.id} as ${c.runId}, but the run file is ${r.runId}`);
      else if (!sameKey(c.key, impactKey(r.simVersion, r.bot))) out.push(`data/seasons/${what} counts rating ${r.id} under ${keyWords(c.key)}, but it was played on ${keyWords(impactKey(r.simVersion, r.bot))}`);
    }
    for (const e of file.entries) for (const s of e.sources) if (s.kind === 'series' && !byId.has(s.run)) out.push(`data/seasons/${what} counts rating ${s.run}, which is not a recorded run that carries card impact`);
  }
  return out;
}
