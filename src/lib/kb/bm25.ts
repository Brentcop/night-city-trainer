// Knowledge pack: BM25 keyword ranking (k1 = 1.2, b = 0.75) over each record's title, aliases and text. Title and
// alias tokens count three times. Ties are broken by id, so a ranking is the same on every machine. Terms added to the
// question by the caller (the synonym table, synonyms.ts) count at a weight the caller gives.
import { tokenize } from './text';
import { byString } from './types';

export const BM25_K1 = 1.2;
export const BM25_B = 0.75;
/** How many times a title or alias token counts. */
export const TITLE_WEIGHT = 3;

export interface Bm25Doc {
  id: string;
  title: string;
  aliases?: readonly string[];
  text: string;
}

export interface Bm25Index {
  ids: string[];
  /** id → position in `ids` */
  pos: Map<string, number>;
  /** term frequencies per document (title and alias tokens weighted) */
  tf: Map<string, number>[];
  len: number[];
  avgLen: number;
  /** documents containing each term */
  df: Map<string, number>;
}

export interface Scored {
  id: string;
  score: number;
}

export function buildBm25(docs: readonly Bm25Doc[]): Bm25Index {
  const ids: string[] = [];
  const tf: Map<string, number>[] = [];
  const len: number[] = [];
  const df = new Map<string, number>();
  for (const d of docs) {
    const m = new Map<string, number>();
    const add = (t: string, w: number) => m.set(t, (m.get(t) ?? 0) + w);
    for (const t of tokenize([d.title, ...(d.aliases ?? [])].join(' '))) add(t, TITLE_WEIGHT);
    for (const t of tokenize(d.text)) add(t, 1);
    let n = 0;
    for (const [t, c] of m) {
      n += c;
      df.set(t, (df.get(t) ?? 0) + 1);
    }
    ids.push(d.id);
    tf.push(m);
    len.push(n);
  }
  const total = len.reduce((a, b) => a + b, 0);
  return { ids, pos: new Map(ids.map((id, i) => [id, i])), tf, len, avgLen: docs.length ? total / docs.length : 0, df };
}

export const idf = (ix: Bm25Index, term: string): number => {
  const n = ix.df.get(term) ?? 0;
  return Math.log(1 + (ix.ids.length - n + 0.5) / (n + 0.5));
};

/** Terms added to a query and the weight each counts at (1 = like a word of the query). */
export interface AddedTerms {
  terms: readonly string[];
  weight: number;
}

/**
 * Every document with a positive score for the query, best first (ties by id). `added`: more terms, each counted at
 * `added.weight` times its usual score; a term the query already holds is not counted twice.
 */
export function bm25Search(ix: Bm25Index, query: string, added?: AddedTerms): Scored[] {
  const own = [...new Set(tokenize(query))];
  const extra = added && added.weight > 0 ? [...new Set(added.terms)].filter((t) => !own.includes(t)) : [];
  const terms = [...own, ...extra].filter((t) => ix.df.has(t));
  if (!terms.length) return [];
  const weights = terms.map((t) => idf(ix, t) * (own.includes(t) ? 1 : added!.weight));
  const out: Scored[] = [];
  for (let i = 0; i < ix.ids.length; i++) {
    const m = ix.tf[i]!;
    let s = 0;
    for (let j = 0; j < terms.length; j++) {
      const f = m.get(terms[j]!);
      if (!f) continue;
      const norm = BM25_K1 * (1 - BM25_B + (BM25_B * ix.len[i]!) / (ix.avgLen || 1));
      s += weights[j]! * ((f * (BM25_K1 + 1)) / (f + norm));
    }
    if (s > 0) out.push({ id: ix.ids[i]!, score: s });
  }
  return out.sort((a, b) => b.score - a.score || byString(a.id, b.id));
}

/**
 * The share of the query's distinct tokens that a document contains (0 when the query has none). `alt`: other terms
 * that hold a token (the synonym table's expansions); the token counts as held when the document has one of them.
 */
export function coverage(ix: Bm25Index, id: string, query: string, alt?: ReadonlyMap<string, readonly string[]>): number {
  const terms = [...new Set(tokenize(query))];
  const m = ix.tf[ix.pos.get(id) ?? -1];
  if (!terms.length || !m) return 0;
  return terms.filter((t) => m.has(t) || (alt?.get(t) ?? []).some((a) => m.has(a))).length / terms.length;
}
