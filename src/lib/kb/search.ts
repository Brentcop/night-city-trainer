// Knowledge pack: the index over a set of records and the retrieval ladder of docs/RAG_PLAN.md rule M2. Cheapest
// first: (1) exact id or name, (2) records one link away from those, (3) BM25 keywords; later rankers add one entry to
// RANKERS. The ranked lists are merged by reciprocal rank fusion: score = sum of weight / (60 + rank). A neighbour of a
// kind the question asks for by name ("rulings on X", "decks that play X") also joins the exact list (KIND_CUES; kept
// after the step 1.4 question set showed it helps on held-out questions). Measured records (events, rounds, ratings,
// matchups; step 2.2) are named inside a question like decks are, and join the keyword and linked lists only when the
// question asks for their kind (CUE_ONLY_KINDS): kept after the number questions showed it helps on held-out questions.
// A question with no exact hit whose best keyword hit holds under half of its words is "no match", not the nearest noise.
import { bm25Search, buildBm25, coverage, type Bm25Index, type Scored } from './bm25';
import { buildNameIndex, findNames, lookupName, type NameIndex } from './names';
import { tokenize } from './text';
import { byString, type KbKind, type KbRecord, type KbRel, type KbScope } from './types';

export const RANKERS = ['exact', 'linked', 'keyword'] as const;
export type Ranker = (typeof RANKERS)[number];

/** Fusion weights (tuned only on the question set's `dev` split, docs/RAG_PLAN.md step 1.4). */
export const RANK_WEIGHTS: Readonly<Record<Ranker, number>> = { exact: 2, linked: 1, keyword: 1 };
/** The reciprocal-rank constant. */
export const RRF_K = 60;
/** Without an exact hit, the best keyword hit must hold at least this share of the question's words. */
export const MATCH_FLOOR = 0.5;
/** How deep each ranker's list goes before fusion. */
export const RANK_DEPTH = 100;
/** Kinds a part of a question may name (doc and code titles are headings and paths, not names people use). */
export const PHRASE_KINDS: readonly KbKind[] = ['card', 'deck', 'package', 'term', 'rule', 'trule', 'objective', 'event', 'round', 'rating', 'matchup'];

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

/** Build the index. Links to records that are not in the set are left out of `edges`. */
export function buildIndex(records: readonly KbRecord[]): KbIndex {
  const sorted = [...records].sort((a, b) => byString(a.id, b.id));
  const byId = new Map(sorted.map((r) => [r.id, r]));
  const edges = new Map<string, Edge[]>(sorted.map((r) => [r.id, []]));
  for (const r of sorted)
    for (const l of r.links) {
      if (!byId.has(l.to)) continue;
      edges.get(r.id)!.push({ rel: l.rel, other: l.to, dir: 'out' });
      edges.get(l.to)!.push({ rel: l.rel, other: r.id, dir: 'in' });
    }
  return { records: sorted, byId, names: buildNameIndex(sorted), bm25: buildBm25(sorted), edges };
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
  /** which rankers run (default all) */
  rankers?: readonly Ranker[];
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

/** Merge ranked id lists by reciprocal rank fusion; ties by id. */
export function fuse(lists: Partial<Record<Ranker, readonly string[]>>, weights: Readonly<Record<Ranker, number>> = RANK_WEIGHTS): { id: string; score: number; ranks: Partial<Record<Ranker, number>> }[] {
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
  return findNames(ix.names, q, (id) => PHRASE_KINDS.includes(ix.byId.get(id)!.kind));
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
  rank: ['rating'],
  ranking: ['rating'],
  title: ['rating'],
  cut: ['rating'],
  matchup: ['matchup'],
  vs: ['matchup'],
  versus: ['matchup'],
  head: ['matchup'],
};

/**
 * Measured kinds that are many and look alike (a matchup or round record per pairing or round): they join the keyword
 * and linked lists only when the question asks for their kind (KIND_CUES); named exactly, they are always found.
 */
export const CUE_ONLY_KINDS: readonly KbKind[] = ['round', 'matchup', 'event', 'rating'];

/** The kinds a question asks for by name. */
export function cuedKinds(q: string): Set<KbKind> {
  return new Set(tokenize(q).flatMap((t) => (Object.prototype.hasOwnProperty.call(KIND_CUES, t) ? [...KIND_CUES[t]!] : [])));
}

/**
 * Records one link away from the exact hits, either direction: ranker 2. For each exact hit, its neighbours of a kind
 * the question asks for come first; then by keyword score, then by id.
 */
export function rankLinked(ix: KbIndex, exact: readonly string[], keyword: readonly Scored[], cued: ReadonlySet<KbKind> = new Set()): string[] {
  const score = new Map(keyword.map((s) => [s.id, s.score]));
  const seen = new Set(exact);
  const out: string[] = [];
  const cue = (id: string) => (cued.has(ix.byId.get(id)!.kind) ? 1 : 0);
  for (const id of exact) {
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
  const use = new Set<Ranker>(o.rankers ?? RANKERS);
  const cued = cuedKinds(query);
  const gated = (id: string) => CUE_ONLY_KINDS.includes(ix.byId.get(id)!.kind) && !cued.has(ix.byId.get(id)!.kind);
  const keyword = use.has('keyword') || use.has('linked') ? bm25Search(ix.bm25, query).filter((s) => !gated(s.id)) : [];
  const exact = use.has('exact') || use.has('linked') ? rankExact(ix, query) : [];
  const lists: Partial<Record<Ranker, string[]>> = {};
  const linked = use.has('linked') ? rankLinked(ix, exact, keyword, cued).filter((id) => !gated(id)) : [];
  // a neighbour of a kind the question asks for ("rulings on X") is named by the question too: it joins the exact list
  // after the exact hits (with the linked ranker only). Measured in docs/RAG_PLAN.md step 1.4: test MRR at 10 +0.08.
  const asked = linked.filter((id) => cued.has(ix.byId.get(id)!.kind));
  if (use.has('exact')) lists.exact = [...exact, ...asked].slice(0, RANK_DEPTH);
  if (use.has('linked')) lists.linked = linked.slice(0, RANK_DEPTH);
  if (use.has('keyword')) lists.keyword = keyword.slice(0, RANK_DEPTH).map((s) => s.id);
  const best = keyword[0];
  const noMatch = !exact.length && (!best || coverage(ix.bm25, best.id, query) < MATCH_FLOOR);
  if (noMatch) return { query, hits: [], noMatch: true, total: 0 };
  const scope = o.scope ?? 'all';
  const keep = (r: KbRecord) => (scope === 'all' || r.scope === scope) && (!o.kinds?.length || o.kinds.includes(r.kind));
  const fused = fuse(lists)
    .map((f) => ({ record: ix.byId.get(f.id)!, score: f.score, ranks: f.ranks }))
    .filter((h) => keep(h.record));
  return { query, hits: fused.slice(0, k), noMatch: fused.length === 0, total: fused.length };
}
