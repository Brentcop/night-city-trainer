// Knowledge pack: the index over a set of records and the retrieval ladder of docs/RAG_PLAN.md rule M2. Cheapest
// first: (1) exact id or name, (2) records one link away from those, (3) BM25 keywords; later rankers add one entry to
// RANKERS. The ranked lists are merged by reciprocal rank fusion: score = sum of weight / (60 + rank). A neighbour of a
// kind the question asks for by name ("rulings on X", "decks that play X") also joins the exact list (KIND_CUES; kept
// after the step 1.4 question set showed it helps on held-out questions). Measured records (events, rounds, ratings,
// matchups; step 2.2) are named inside a question like decks are, and join the keyword and linked lists only when the
// question asks for their kind (CUE_ONLY_KINDS): kept after the number questions showed it helps on held-out questions.
// The evidence cells (cardstat, pkgstat; step 2.4) are gated the same way, cued only by "stats", "statistics" and
// "telemetry".
// A question with no exact hit whose best keyword hit holds under half of its words is "no match", not the nearest noise.
// Rung 4, `dense` (step 4.1, dense.ts), runs only when the caller passes a dense index and the question's vector; it is
// gated like the keyword list and can only lift a "no match" when its best similarity reaches `denseFloor`.
// The synonym table (step 4.6, synonyms.ts) adds this game's terms to the keyword list's question at `synonymWeight`
// (0: off) and, with `synonymCoverage`, lets them hold a question word for the floor; the linked list's order and the
// exact names never use it.
import { bm25Search, buildBm25, coverage, type Bm25Index, type Scored } from './bm25';
import { rankDense, type DenseIndex } from './dense';
import { buildNameIndex, findNameHits, lookupName, type NameHit, type NameIndex } from './names';
import { expandQuestion } from './synonyms';
import { stem as stemWord, STEM_MODES, words, type StemMode } from './text';
import { byString, type KbKind, type KbRecord, type KbRel, type KbScope } from './types';

export const RANKERS = ['exact', 'linked', 'keyword', 'dense'] as const;
export type Ranker = (typeof RANKERS)[number];
/** The rankers a search runs when the caller names none: the lexical ladder (dense is opt-in, step 4.1). */
export const DEFAULT_RANKERS: readonly Ranker[] = ['exact', 'linked', 'keyword'];

/** Fusion weights (tuned only on the question set's `dev` split, docs/RAG_PLAN.md step 1.4); dense: SearchTuning.denseWeight. */
export const RANK_WEIGHTS: Readonly<Record<Ranker, number>> = { exact: 2, linked: 1, keyword: 1, dense: 1 };
/** The reciprocal-rank constant. */
export const RRF_K = 60;
/** Without an exact hit, the best keyword hit must hold at least this share of the question's words. */
export const MATCH_FLOOR = 0.5;
/** How deep each ranker's list goes before fusion. */
export const RANK_DEPTH = 100;
/** Kinds a part of a question may name (doc and code titles are headings and paths, not names people use). */
export const PHRASE_KINDS: readonly KbKind[] = ['card', 'deck', 'package', 'term', 'rule', 'trule', 'objective', 'event', 'round', 'rating', 'matchup'];

/**
 * Settings of the ladder that the step 1.6 experiments vary (docs/RAG_PLAN.md rule M9). SEARCH_TUNING is the default
 * search; `scripts/kb-eval.ts --tune` runs another setting over the question set. A setting is changed here only after
 * it helped on the held-out questions. Measured in step 1.6 (held-out `test` split, paired bootstrap), none kept:
 * floor 0.34 found no more answers and refused 1 of 5 unanswerable public questions instead of 4; no links from
 * one-word term hits changed nothing for rules questions; the deck-pair matchup found 2 more number questions, none
 * lost, but its interval reached zero (recall at 5 +3.7 points [0, +9.3]): could not tell.
 * Step 4.1 (dense): denseWeight 0.5 and denseFloor 0.75 were chosen on `dev` from 0.5, 1, 2 and 0.72, 0.75, 1; the
 * dense ranker stays opt-in (DEFAULT_RANKERS) until a measurement keeps it.
 * Step 4.6 (synonym table): synonymWeight 1 with synonymCoverage on was chosen on `dev` from 0.5 and 1, coverage on and
 * off, and kept after one look at `test` (answerable questions, paired bootstrap): MRR at 10 +0.027 [+0.005, +0.058]
 * with all records, +0.037 [+0.006, +0.078] public only; recall at 5 +4.5 points [0, +10.6]; paraphrase questions
 * MRR +0.082 [+0.018, +0.159]; no other type moved; unanswerable questions refused unchanged.
 * Step 4.7a (word forms, text.ts StemMode): `porter` was chosen on `dev` over `light` (both +2 to +3 points recall at
 * 5 there; porter kept the unanswerable refusals that light lost one of) and not kept after one look at `test`
 * (answerable questions, paired bootstrap): recall at 5 ±0 [−4.8, +4.8] points and MRR at 10 −0.002 [−0.043, +0.041]
 * with all records; public only +2.9 [0, +7.4] and −0.002 [−0.049, +0.047]. Could not tell: `stem` stays `s`, and
 * `light` and `porter` stay available for `--tune stem=…`.
 */
export interface SearchTuning {
  /** the "no match" floor: without an exact hit, the share of the question's words a keyword hit must hold (MATCH_FLOOR) */
  floor: number;
  /** the floor is met by any of the first `floorHits` keyword hits (1: the best hit only) */
  floorHits: number;
  /** expand links from a glossary term named by a single word of the question (the hit still counts as exact) */
  singleWordTermLinks: boolean;
  /** when the question names two different decks, their matchup record (if there is one) joins the exact list */
  deckPairMatchup: boolean;
  /** the dense list's weight in the fusion (used only when a dense index is passed) */
  denseWeight: number;
  /** without an exact hit or a keyword hit over the floor, a best dense similarity at least this high still answers */
  denseFloor: number;
  /** the weight of the terms the synonym table adds to the keyword ranker's question (synonyms.ts; 0: the table is off) */
  synonymWeight: number;
  /** for the floor, a question word with an expansion is held by a hit that holds the word or one of its expansions */
  synonymCoverage: boolean;
  /**
   * how the keyword ranker folds word forms (text.ts StemMode). It belongs to the index: buildIndex takes it, and a
   * search whose tuning names another mode than its index's is refused.
   */
  stem: StemMode;
}

export const SEARCH_TUNING: Readonly<SearchTuning> = { floor: MATCH_FLOOR, floorHits: 1, singleWordTermLinks: true, deckPairMatchup: false, denseWeight: 0.5, denseFloor: 0.75, synonymWeight: 1, synonymCoverage: true, stem: 's' };

/** A link as the index sees it: both directions. `dir: 'in'` means `other` links to this record. */
export interface Edge {
  rel: KbRel;
  other: string;
  dir: 'out' | 'in';
}

export interface KbIndex {
  records: readonly KbRecord[];
  byId: Map<string, KbRecord>;
  names: NameIndex;
  bm25: Bm25Index;
  edges: Map<string, Edge[]>;
}

/**
 * Build the index. Links to records that are not in the set are left out of `edges`. `stem`: how the keyword ranker
 * folds word forms (default SEARCH_TUNING.stem); names are never stemmed.
 */
export function buildIndex(records: readonly KbRecord[], o: { stem?: StemMode } = {}): KbIndex {
  const mode = o.stem ?? SEARCH_TUNING.stem;
  if (!STEM_MODES.includes(mode)) throw new Error(`unknown stem mode ${String(mode)}`);
  const sorted = [...records].sort((a, b) => byString(a.id, b.id));
  const byId = new Map(sorted.map((r) => [r.id, r]));
  const edges = new Map<string, Edge[]>(sorted.map((r) => [r.id, []]));
  for (const r of sorted)
    for (const l of r.links) {
      if (!byId.has(l.to)) continue;
      edges.get(r.id)!.push({ rel: l.rel, other: l.to, dir: 'out' });
      edges.get(l.to)!.push({ rel: l.rel, other: r.id, dir: 'in' });
    }
  const kindOf = new Map(sorted.map((r) => [r.id, r.kind]));
  const inStats = (d: { id: string }) => !STATS_FREE_KINDS.includes(kindOf.get(d.id)!);
  return { records: sorted, byId, names: buildNameIndex(sorted), bm25: buildBm25(sorted, mode, { inStats }), edges };
}

/** The records named `q` exactly (id, title or alias). */
export const lookup = (ix: KbIndex, q: string): KbRecord[] => lookupName(ix.names, q).map((id) => ix.byId.get(id)!);

export interface SearchOptions {
  /** results wanted (default 5) */
  k?: number;
  /** only these kinds in the results */
  kinds?: readonly KbKind[];
  /** 'all' (default) or one scope */
  scope?: KbScope | 'all';
  /** which rankers run (default DEFAULT_RANKERS); `dense` runs only with `dense` below */
  rankers?: readonly Ranker[];
  /** experiments only: settings other than SEARCH_TUNING */
  tuning?: Partial<SearchTuning>;
  /** the dense index (aligned to this index's records) and the question's unit vector from the same model */
  dense?: { index: DenseIndex; query: ArrayLike<number> };
}

export interface SearchHit {
  record: KbRecord;
  /** fused score */
  score: number;
  /** the rank in each list that found it (1 = first) */
  ranks: Partial<Record<Ranker, number>>;
}

export interface SearchResult {
  query: string;
  hits: SearchHit[];
  /** true when nothing passed the floor (hits is then empty) */
  noMatch: boolean;
  /** how many records passed the filters before the cut to k */
  total: number;
}

/** Merge ranked id lists by reciprocal rank fusion; ties by id. A weight not given is RANK_WEIGHTS'. */
export function fuse(lists: Partial<Record<Ranker, readonly string[]>>, given: Readonly<Partial<Record<Ranker, number>>> = RANK_WEIGHTS): { id: string; score: number; ranks: Partial<Record<Ranker, number>> }[] {
  const weights = { ...RANK_WEIGHTS, ...given };
  const acc = new Map<string, { score: number; ranks: Partial<Record<Ranker, number>> }>();
  for (const r of RANKERS) {
    const list = lists[r];
    if (!list) continue;
    list.forEach((id, i) => {
      const e = acc.get(id) ?? { score: 0, ranks: {} };
      if (e.ranks[r] !== undefined) return;
      e.score += weights[r] / (RRF_K + i + 1);
      e.ranks[r] = i + 1;
      acc.set(id, e);
    });
  }
  return [...acc].map(([id, e]) => ({ id, ...e })).sort((a, b) => b.score - a.score || byString(a.id, b.id));
}

/** Records named in the question: ranker 1. */
export function rankExact(ix: KbIndex, q: string): string[] {
  return rankExactHits(ix, q).map((h) => h.id);
}

/** rankExact, with how many words of the question named each record. */
export function rankExactHits(ix: KbIndex, q: string): NameHit[] {
  return findNameHits(ix.names, q, (id) => PHRASE_KINDS.includes(ix.byId.get(id)!.kind));
}

/** The matchup records of every two different decks among `ids` (in the order the decks were named), when there is one. */
export function deckPairMatchups(ix: KbIndex, ids: readonly string[]): string[] {
  const decks = ids.filter((id) => ix.byId.get(id)?.kind === 'deck');
  const out: string[] = [];
  for (let i = 0; i < decks.length; i++)
    for (let j = i + 1; j < decks.length; j++) {
      const id = `matchup:${[decks[i]!, decks[j]!].map((d) => d.slice(d.indexOf(':') + 1)).sort(byString).join('~')}`;
      if (ix.byId.has(id) && !out.includes(id)) out.push(id);
    }
  return out;
}

/**
 * Words that ask for a kind of record ("rulings on …", "packages with …", "decks that play …", "the game plan for …").
 * Matched against the question's tokens (plurals already stripped).
 */
export const KIND_CUES: Readonly<Record<string, readonly KbKind[]>> = {
  ruling: ['ruling', 'faq'],
  faq: ['faq', 'ruling'],
  package: ['package'],
  synergy: ['package'],
  deck: ['deck'],
  list: ['deck'],
  plan: ['objective'],
  note: ['objective'],
  guide: ['guide'],
  pilot: ['guide'],
  piloted: ['guide'],
  // measured records (plan step 2.2)
  event: ['event'],
  tournament: ['event'],
  champion: ['event'],
  won: ['event'],
  winner: ['event'],
  entered: ['event'],
  round: ['round'],
  final: ['round'],
  semifinal: ['round'],
  quarterfinal: ['round'],
  standing: ['round'],
  leading: ['round'],
  leader: ['round'],
  sweep: ['round'],
  bye: ['round'],
  rating: ['rating'],
  tier: ['rating'],
  strong: ['rating'],
  // step 1.6: the superlative asks for the ratings table (the tokenizer strips only a plural "s")
  strongest: ['rating'],
  rank: ['rating'],
  ranking: ['rating'],
  title: ['rating'],
  cut: ['rating'],
  matchup: ['matchup'],
  vs: ['matchup'],
  versus: ['matchup'],
  head: ['matchup'],
  // step 2.4: the evidence cells, only by words that no earlier question uses for anything else ("stats" and
  // "statistics" reach these keys with their plural stripped). Broader words ("played", "sold", "rate") would be a
  // ranking change, to be measured on questions written blind.
  stat: ['cardstat', 'pkgstat'],
  statistic: ['cardstat', 'pkgstat'],
  telemetry: ['cardstat', 'pkgstat'],
};

/**
 * Measured kinds that are many and look alike (a matchup or round record per pairing or round): they join the keyword
 * and linked lists only when the question asks for their kind (KIND_CUES); named exactly, they are always found.
 */
export const CUE_ONLY_KINDS: readonly KbKind[] = ['round', 'matchup', 'event', 'rating', 'cardstat', 'pkgstat'];

/**
 * Kinds left out of the keyword ranker's corpus statistics (document count, document frequencies, mean length): they
 * are still scored, against the statistics of the other records, so adding them moves no other record's score. The
 * evidence cells (step 2.4) are many, long and full of the words every question uses ("games", "won", card names);
 * counted, they moved the earlier questions' rankings although they never appear unless asked for. The older measured
 * kinds stay counted: leaving them out too would be a ranking change, to be measured first (rule M9).
 */
export const STATS_FREE_KINDS: readonly KbKind[] = ['cardstat', 'pkgstat'];

/** The kinds a question asks for by name (read from the plain, mode `s` tokens whatever the index's stem mode). */
export function cuedKinds(q: string): Set<KbKind> {
  return new Set(words(q).map((w) => stemWord(w, 's')).flatMap((t) => (Object.prototype.hasOwnProperty.call(KIND_CUES, t) ? [...KIND_CUES[t]!] : [])));
}

/**
 * Records one link away from the exact hits, either direction: ranker 2. For each exact hit, its neighbours of a kind
 * the question asks for come first; then by keyword score, then by id. `from` limits which exact hits are expanded
 * (default all); every exact hit is still left out of the list.
 */
export function rankLinked(ix: KbIndex, exact: readonly string[], keyword: readonly Scored[], cued: ReadonlySet<KbKind> = new Set(), from: readonly string[] = exact): string[] {
  const score = new Map(keyword.map((s) => [s.id, s.score]));
  const seen = new Set(exact);
  const out: string[] = [];
  const cue = (id: string) => (cued.has(ix.byId.get(id)!.kind) ? 1 : 0);
  for (const id of from) {
    const near = [...new Set((ix.edges.get(id) ?? []).map((e) => e.other))].filter((o) => !seen.has(o));
    near.sort((a, b) => cue(b) - cue(a) || (score.get(b) ?? 0) - (score.get(a) ?? 0) || byString(a, b));
    for (const o of near) {
      seen.add(o);
      out.push(o);
    }
  }
  return out;
}

export function search(ix: KbIndex, query: string, o: SearchOptions = {}): SearchResult {
  const k = o.k ?? 5;
  if (o.tuning?.stem !== undefined && o.tuning.stem !== ix.bm25.stem) throw new Error(`this index folds word forms with stem mode ${ix.bm25.stem}, not ${o.tuning.stem}: build one with buildIndex(records, { stem: '${o.tuning.stem}' })`);
  const t: SearchTuning = { ...SEARCH_TUNING, ...o.tuning, stem: ix.bm25.stem };
  const use = new Set<Ranker>(o.rankers ?? DEFAULT_RANKERS);
  const cued = cuedKinds(query);
  const gated = (id: string) => CUE_ONLY_KINDS.includes(ix.byId.get(id)!.kind) && !cued.has(ix.byId.get(id)!.kind);
  const plain = use.has('keyword') || use.has('linked') ? bm25Search(ix.bm25, query).filter((s) => !gated(s.id)) : [];
  // the synonym table (step 4.6): only the keyword list and the floor read it
  // phrases are matched on the plain tokens; the terms and the words they hold are in the index's stem mode
  const raw = t.synonymWeight > 0 || t.synonymCoverage ? words(query) : [];
  const syn = t.synonymWeight > 0 || t.synonymCoverage ? expandQuestion(raw.map((w) => stemWord(w, 's')), t.stem, raw.map((w) => stemWord(w, t.stem))) : undefined;
  const keyword = use.has('keyword') && syn?.terms.length && t.synonymWeight > 0 ? bm25Search(ix.bm25, query, { terms: syn.terms, weight: t.synonymWeight }).filter((s) => !gated(s.id)) : plain;
  const exactHits = use.has('exact') || use.has('linked') ? rankExactHits(ix, query) : [];
  const exact = exactHits.map((h) => h.id);
  const from = t.singleWordTermLinks ? exact : exactHits.filter((h) => !(h.words === 1 && ix.byId.get(h.id)!.kind === 'term')).map((h) => h.id);
  const lists: Partial<Record<Ranker, string[]>> = {};
  const linked = use.has('linked') ? rankLinked(ix, exact, plain, cued, from).filter((id) => !gated(id)) : [];
  // a neighbour of a kind the question asks for ("rulings on X") is named by the question too: it joins the exact list
  // after the exact hits (with the linked ranker only). Measured in docs/RAG_PLAN.md step 1.4: test MRR at 10 +0.08.
  const asked = linked.filter((id) => cued.has(ix.byId.get(id)!.kind));
  const pairs = t.deckPairMatchup ? deckPairMatchups(ix, exact) : [];
  if (use.has('exact')) lists.exact = [...exact, ...pairs, ...asked].slice(0, RANK_DEPTH);
  if (use.has('linked')) lists.linked = linked.slice(0, RANK_DEPTH);
  if (use.has('keyword')) lists.keyword = keyword.slice(0, RANK_DEPTH).map((s) => s.id);
  // the dense list scans every vector; gated kinds are left out before the cut to RANK_DEPTH, as in the keyword list
  const dense = use.has('dense') && o.dense ? rankDense(o.dense.index, o.dense.query, Infinity).filter((s) => ix.byId.has(s.id) && !gated(s.id)).slice(0, RANK_DEPTH) : [];
  if (dense.length) lists.dense = dense.map((s) => s.id);
  const held = t.synonymCoverage ? syn?.held : undefined;
  const floorMet = keyword.slice(0, Math.max(1, t.floorHits)).some((s) => coverage(ix.bm25, s.id, query, held) >= t.floor);
  const denseMet = (dense[0]?.score ?? -Infinity) >= t.denseFloor;
  const noMatch = !exact.length && !floorMet && !denseMet;
  if (noMatch) return { query, hits: [], noMatch: true, total: 0 };
  const scope = o.scope ?? 'all';
  const keep = (r: KbRecord) => (scope === 'all' || r.scope === scope) && (!o.kinds?.length || o.kinds.includes(r.kind));
  const fused = fuse(lists, { dense: t.denseWeight })
    .map((f) => ({ record: ix.byId.get(f.id)!, score: f.score, ranks: f.ranks }))
    .filter((h) => keep(h.record));
  return { query, hits: fused.slice(0, k), noMatch: fused.length === 0, total: fused.length };
}
