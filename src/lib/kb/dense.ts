// Knowledge pack: the dense ranker of docs/RAG_PLAN.md step 4.1 (rung 4 of rule M2). An index is one unit vector per
// record (a sentence embedding of the record's title and text, computed on the owner's machine by scripts/kb-dense.ts
// and kept under .cache/kb-dense/, never in a tracked file), scanned by a plain loop: the score is the dot product with
// the question's unit vector (cosine similarity), ties by id. No approximate index: a few thousand records scan in about
// a millisecond. Pure like the rest of src/lib/kb: the vectors come in as data.
import { byString, type KbRecord } from './types';

export interface DenseIndex {
  /** the model that made the vectors (a question must be embedded by the same one) */
  model: string;
  dims: number;
  /** record ids, sorted, one per vector */
  ids: string[];
  /** ids.length × dims unit vectors, row by row */
  vectors: Float32Array;
}

export interface DenseScored {
  id: string;
  /** cosine similarity (both vectors have unit length) */
  score: number;
}

/** The version of the text embedded for a record (bump when denseText changes: every vector is then remade). */
export const DENSE_TEXT_VERSION = 1;

/** The text embedded for a record: its title, a newline and its text (the tokenizer cuts it at 512 tokens). */
export const denseText = (r: Pick<KbRecord, 'title' | 'text'>): string => `${r.title}\n${r.text}`;

/** An index from parallel ids and vectors; throws when the sizes disagree or the ids are not sorted and distinct. */
export function denseIndex(model: string, dims: number, ids: readonly string[], vectors: Float32Array): DenseIndex {
  if (!Number.isInteger(dims) || dims < 1) throw new Error(`dense index: dims must be a positive whole number, got ${dims}`);
  if (vectors.length !== ids.length * dims) throw new Error(`dense index: ${ids.length} ids × ${dims} dims needs ${ids.length * dims} numbers, got ${vectors.length}`);
  for (let i = 1; i < ids.length; i++) if (byString(ids[i - 1]!, ids[i]!) >= 0) throw new Error(`dense index: ids must be sorted and distinct ("${ids[i - 1]}" before "${ids[i]}")`);
  return { model, dims, ids: [...ids], vectors };
}

/** The first `depth` records by dot product with `query` (a unit vector of the index's size), best first, ties by id. */
export function rankDense(index: DenseIndex, query: ArrayLike<number>, depth: number): DenseScored[] {
  const { dims, ids, vectors } = index;
  if (query.length !== dims) throw new Error(`dense query has ${query.length} dims, the index ${dims}`);
  const out: DenseScored[] = [];
  for (let i = 0; i < ids.length; i++) {
    let s = 0;
    const at = i * dims;
    for (let d = 0; d < dims; d++) s += vectors[at + d]! * query[d]!;
    out.push({ id: ids[i]!, score: s });
  }
  out.sort((a, b) => b.score - a.score || byString(a.id, b.id));
  return out.slice(0, Math.max(0, depth));
}

/**
 * The index cut to `ids` (the records of the current pack or scope), in sorted order. Vectors of records no longer in
 * the set are dropped; records with no vector are listed in `missing` (the dense list then cannot find them).
 */
export function alignDense(index: DenseIndex, ids: readonly string[]): { index: DenseIndex; missing: string[] } {
  const pos = new Map(index.ids.map((id, i) => [id, i]));
  const want = [...new Set(ids)].sort(byString);
  const keep = want.filter((id) => pos.has(id));
  const vectors = new Float32Array(keep.length * index.dims);
  keep.forEach((id, i) => vectors.set(index.vectors.subarray(pos.get(id)! * index.dims, (pos.get(id)! + 1) * index.dims), i * index.dims));
  return { index: { model: index.model, dims: index.dims, ids: keep, vectors }, missing: want.filter((id) => !pos.has(id)) };
}
