// The import-graph walker the guard tests share (tests/kb-guards.test.ts, tests/note-synergies.test.ts): it follows the
// relative imports of TypeScript files, never npm packages, by reading their text.
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(__dirname, '..');
/** A path relative to the repository root, with forward slashes. */
export const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

/** Every .ts / .tsx file under a folder of the repository (absolute paths; none when the folder does not exist). */
export function filesUnder(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [path.join(abs, e.name)] : []));
}

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
/** The file a relative import names (a `?query` dropped), or null for a package or a file that does not exist. */
export function resolveSpec(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return EXTS.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}

/** `import x from '…'`, `import '…'`, `export … from '…'`, not `import type` / `export type`. */
export const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
/** Any import, static or dynamic, type or not. */
export const ANY_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
/** `import('…')`: a dynamic import, which a bundler still puts in the build (as a chunk of its own). */
export const DYNAMIC_IMPORT = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

/** Every module reachable from `entries` through static imports (and dynamic ones too with `dynamic`). */
export function importGraph(entries: readonly string[], o: { dynamic?: boolean } = {}): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    const text = fs.readFileSync(file, 'utf8');
    const specs = [...text.matchAll(STATIC_IMPORT), ...(o.dynamic ? text.matchAll(DYNAMIC_IMPORT) : [])].map((m) => m[1]!);
    for (const spec of specs) {
      const hit = resolveSpec(file, spec);
      if (hit) walk(hit);
    }
  };
  for (const e of entries) walk(e);
  return seen;
}

/** Every module reachable from `entries` through static imports. */
export const staticGraph = (entries: readonly string[]): Set<string> => importGraph(entries);
