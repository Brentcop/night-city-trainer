// Knowledge pack embeddings (docs/RAG_PLAN.md step 4.1): the Node side of the dense ranker (src/lib/kb/dense.ts). Used
// by `npm run kb -- embed | stats | search --rankers …,dense` and by `npm run kb:eval`; not run on its own.
// Everything lives in .cache/kb-dense/ (gitignored; another folder with the environment variable KB_DENSE_DIR):
//   tools/    a side npm folder holding @huggingface/transformers 4.3.2 (not in package.json)
//   models/   Xenova/bge-small-en-v1.5 at a pinned revision, int8 ONNX weights, loaded offline (no download, ever)
//   vectors/<model key>/vectors.f32 and index.json: one 384-dimension unit vector per record, little-endian float32,
//             with the ids, a hash of each record's embedded text, the model, revision, dtype, dimensions, query
//             prefix and text-template version. Rebuilt incrementally: only a record whose text hash changed is embedded
//             again. Local-only records are embedded too; their vectors stay here (rule M6).
// One text per model call: with the int8 weights a text's vector moved with the other texts of its batch (cosine 0.995
// between the two), so a question's vector depended on which questions ran with it. One at a time is also the fastest.
// When the tools or the model are missing, every entry point says exactly what is missing and what would have to be
// fetched, and does nothing else.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { alignDense, denseIndex, denseText, DENSE_TEXT_VERSION, type DenseIndex } from '../src/lib/kb/dense';
import { byString, hashText, type KbRecord } from '../src/lib/kb/types';

export const DENSE_DIR = '.cache/kb-dense';
export const LIBRARY = { name: '@huggingface/transformers', version: '4.3.2' } as const;
export const DENSE_MODEL = {
  id: 'Xenova/bge-small-en-v1.5',
  /** the folder under vectors/ */
  key: 'bge-small-en-v1.5-q8',
  revision: 'ea104dacec62c0de699686887e3f920caeb4f3e3',
  dtype: 'q8',
  dims: 384,
  pooling: 'cls',
  /** files under models/<id>/ and the weights' size in bytes */
  files: ['config.json', 'tokenizer.json', 'tokenizer_config.json', 'special_tokens_map.json', 'onnx/model_quantized.onnx'],
  weights: { file: 'onnx/model_quantized.onnx', bytes: 34_014_426 },
} as const;
/** bge's instruction for a question (and only a question; records are embedded as they are). */
export const QUERY_PREFIX = 'Represent this sentence for searching relevant passages: ';
/** Texts per model call: 1, so a vector depends on its text alone (see the header). */
export const EMBED_BATCH = 1;

export interface DensePaths {
  dir: string;
  tools: string;
  model: string;
  vectors: string;
}

/** Where the tools, the model and the vectors are (KB_DENSE_DIR, relative to `root`, replaces .cache/kb-dense). */
export function densePaths(root: string, dir: string = process.env.KB_DENSE_DIR || DENSE_DIR): DensePaths {
  const abs = path.resolve(root, dir);
  return { dir: abs, tools: path.join(abs, 'tools'), model: path.join(abs, 'models', ...DENSE_MODEL.id.split('/')), vectors: path.join(abs, 'vectors', DENSE_MODEL.key) };
}

export interface DenseStatus {
  /** the tools and the model are present (the vectors can be built) */
  ready: boolean;
  /** one line per missing piece: what is missing, then what would have to be fetched */
  missing: string[];
}

/** Whether the tools and the model are present. Reads only file names and sizes: never loads or fetches anything. */
export function denseStatus(p: DensePaths): DenseStatus {
  const missing: string[] = [];
  const lib = path.join(p.tools, 'node_modules', ...LIBRARY.name.split('/'), 'package.json');
  if (!fs.existsSync(path.join(p.tools, 'package.json')) || !fs.existsSync(lib))
    missing.push(`the embedding library ${LIBRARY.name} ${LIBRARY.version} in ${p.tools} (not found: ${fs.existsSync(p.tools) ? lib : p.tools}); it would be fetched with \`npm install ${LIBRARY.name}@${LIBRARY.version}\` run inside that folder, never into the repository's package.json`);
  const absent = DENSE_MODEL.files.filter((f) => !fs.existsSync(path.join(p.model, f)));
  const w = path.join(p.model, DENSE_MODEL.weights.file);
  if (absent.length) missing.push(`the model ${DENSE_MODEL.id} in ${p.model} (missing: ${absent.join(', ')}); they would be fetched from the Hugging Face hub repository ${DENSE_MODEL.id} at revision ${DENSE_MODEL.revision}`);
  else if (fs.statSync(w).size !== DENSE_MODEL.weights.bytes) missing.push(`the model weights ${w} are ${fs.statSync(w).size} bytes, not ${DENSE_MODEL.weights.bytes}: fetch ${DENSE_MODEL.weights.file} again from ${DENSE_MODEL.id} at revision ${DENSE_MODEL.revision}`);
  return { ready: !missing.length, missing };
}

/** The message for a dense request that cannot run. */
export const missingText = (s: DenseStatus): string => `the dense ranker is not ready. Missing:\n${s.missing.map((m) => `  - ${m}`).join('\n')}\nNothing was fetched or written.`;

/** Unit vectors for texts, one Float32Array per text, in order. */
export type Embed = (texts: readonly string[]) => Promise<Float32Array[]>;

interface Extractor {
  (texts: string[], o: { pooling: string; normalize: boolean }): Promise<{ dims: number[]; data: Float32Array }>;
}

/** Load the library and the model from disk with remote models switched off. Throws (with missingText) when absent. */
export async function loadEmbedder(p: DensePaths, batch = EMBED_BATCH): Promise<Embed> {
  const st = denseStatus(p);
  if (!st.ready) throw new Error(missingText(st));
  const req = createRequire(path.join(p.tools, 'package.json'));
  const mod = (await import(pathToFileURL(req.resolve(LIBRARY.name)).href)) as Record<string, unknown>;
  const tf = (mod.pipeline ? mod : mod.default) as { env: Record<string, unknown>; pipeline: (task: string, model: string, o: { dtype: string }) => Promise<Extractor> };
  tf.env.allowRemoteModels = false;
  tf.env.allowLocalModels = true;
  tf.env.localModelPath = path.join(p.dir, 'models');
  const extractor = await tf.pipeline('feature-extraction', DENSE_MODEL.id, { dtype: DENSE_MODEL.dtype });
  return async (texts) => {
    const out: Float32Array[] = [];
    for (let i = 0; i < texts.length; i += batch) {
      const t = await extractor(texts.slice(i, i + batch), { pooling: DENSE_MODEL.pooling, normalize: true });
      const n = t.dims[t.dims.length - 1]!;
      if (n !== DENSE_MODEL.dims) throw new Error(`the model gave ${n} dimensions, expected ${DENSE_MODEL.dims}`);
      for (let j = 0; j * n < t.data.length; j++) out.push(Float32Array.from(t.data.subarray(j * n, (j + 1) * n)));
    }
    return out;
  };
}

/** Question vectors: the bge query prefix, then the question. */
export const embedQueries = (embed: Embed, questions: readonly string[]): Promise<Float32Array[]> => embed(questions.map((q) => QUERY_PREFIX + q));

/** index.json of a vector cache. */
export interface VectorMeta {
  kind: 'nct-kb-vectors';
  schema: 1;
  model: string;
  revision: string;
  dtype: string;
  dims: number;
  pooling: string;
  queryPrefix: string;
  textVersion: number;
  /** texts per model call when the vectors were made */
  batch: number;
  /** sorted record ids, one per vector */
  ids: string[];
  /** hashText of each record's embedded text (denseText), in the order of ids */
  hashes: string[];
}

const META_OF = { kind: 'nct-kb-vectors', schema: 1, model: DENSE_MODEL.id, revision: DENSE_MODEL.revision, dtype: DENSE_MODEL.dtype, dims: DENSE_MODEL.dims, pooling: DENSE_MODEL.pooling, queryPrefix: QUERY_PREFIX, textVersion: DENSE_TEXT_VERSION, batch: EMBED_BATCH } as const;
const sameSetting = (m: Partial<VectorMeta>) => (Object.keys(META_OF) as (keyof typeof META_OF)[]).every((k) => m[k] === META_OF[k]);

/** The hash that decides whether a record is embedded again. */
export const textHash = (r: Pick<KbRecord, 'title' | 'text'>): string => hashText(denseText(r));

/** A vector cache on disk, or null when there is none, it is unreadable or it was made with other settings. */
export function readVectors(dir: string): { meta: VectorMeta; index: DenseIndex; bytes: number } | null {
  try {
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as VectorMeta;
    if (!sameSetting(meta) || !Array.isArray(meta.ids) || !Array.isArray(meta.hashes) || meta.ids.length !== meta.hashes.length) return null;
    const buf = fs.readFileSync(path.join(dir, 'vectors.f32'));
    if (buf.length !== meta.ids.length * meta.dims * 4) return null;
    const vectors = new Float32Array(new Uint8Array(buf).buffer);
    return { meta, index: denseIndex(meta.model, meta.dims, meta.ids, vectors), bytes: buf.length + fs.statSync(path.join(dir, 'index.json')).size };
  } catch {
    return null;
  }
}

/** How many records the cache on disk holds a current vector for (no model needed). */
export function vectorState(records: readonly KbRecord[], dir: string): { built: boolean; current: number; records: number; bytes: number } {
  const v = readVectors(dir);
  if (!v) return { built: false, current: 0, records: records.length, bytes: 0 };
  const have = new Map(v.meta.ids.map((id, i) => [id, v.meta.hashes[i]!]));
  return { built: true, current: records.filter((r) => have.get(r.id) === textHash(r)).length, records: records.length, bytes: v.bytes };
}

export interface Refresh {
  /** aligned to `records` (sorted by id) */
  index: DenseIndex;
  /** records embedded now (new or changed), reused from the cache, and cached vectors dropped (record gone) */
  embedded: number;
  reused: number;
  dropped: number;
  /** files written (false when nothing changed) */
  wrote: boolean;
  bytes: number;
}

/**
 * Bring the cache in `dir` up to date with `records`: reuse every vector whose record's text hash is unchanged, embed
 * the rest (in id order), drop the vectors of records that are gone, and write the files only when they change.
 */
export async function refreshVectors(records: readonly KbRecord[], embed: Embed, dir: string): Promise<Refresh> {
  const old = readVectors(dir);
  const sorted = [...records].sort((a, b) => byString(a.id, b.id));
  const hashes = sorted.map(textHash);
  const prev = new Map(old ? old.meta.ids.map((id, i) => [id, i]) : []);
  const dims = DENSE_MODEL.dims;
  const vectors = new Float32Array(sorted.length * dims);
  const todo: number[] = [];
  sorted.forEach((r, i) => {
    const j = prev.get(r.id);
    if (old && j !== undefined && old.meta.hashes[j] === hashes[i]) vectors.set(old.index.vectors.subarray(j * dims, (j + 1) * dims), i * dims);
    else todo.push(i);
  });
  const made = todo.length ? await embed(todo.map((i) => denseText(sorted[i]!))) : [];
  if (made.length !== todo.length) throw new Error(`the embedder returned ${made.length} vectors for ${todo.length} texts`);
  todo.forEach((i, m) => {
    const v = made[m]!;
    if (v.length !== dims) throw new Error(`a vector has ${v.length} dimensions, expected ${dims}`);
    vectors.set(v, i * dims);
  });
  const ids = sorted.map((r) => r.id);
  const keep = new Set(ids);
  const dropped = old ? old.meta.ids.filter((id) => !keep.has(id)).length : 0;
  const meta: VectorMeta = { ...META_OF, ids, hashes };
  const json = JSON.stringify(meta) + '\n';
  const bin = Buffer.from(vectors.buffer, vectors.byteOffset, vectors.byteLength);
  const jsonFile = path.join(dir, 'index.json');
  const binFile = path.join(dir, 'vectors.f32');
  const same = old && fs.readFileSync(jsonFile, 'utf8') === json && fs.readFileSync(binFile).equals(bin);
  if (!same) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(binFile, bin);
    fs.writeFileSync(jsonFile, json);
  }
  return { index: denseIndex(DENSE_MODEL.id, dims, ids, vectors), embedded: todo.length, reused: sorted.length - todo.length, dropped, wrote: !same, bytes: bin.length + Buffer.byteLength(json) };
}

/** The dense index cut to the records one search or scope runs over. */
export const denseFor = (index: DenseIndex, records: readonly Pick<KbRecord, 'id'>[]): DenseIndex => alignDense(index, records.map((r) => r.id)).index;
