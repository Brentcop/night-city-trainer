// Rule M10 of docs/RAG_PLAN.md: the knowledge pack is kept away from play. Nothing under src/engine, src/ai or src/sim
// reaches src/lib/kb through static imports, the entry src/main.tsx does not reach it, and no file under those folders
// or src/ui imports it at all, except the site's Search page (docs/RAG_PLAN.md step 3), a lazy page whose own imports
// never reach the pack's builders, the number functions or anything that reaches the engine, the bots or the
// simulator. Also: the core stays pure (M7) and builds stay deterministic (M8).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(__dirname, '..');
const KB_DIR = path.join(ROOT, 'src', 'lib', 'kb') + path.sep;
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

function filesUnder(dir: string): string[] {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesUnder(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [path.join(abs, e.name)] : []));
}

const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
function resolveSpec(from: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null;
  const base = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return EXTS.map((e) => base + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
}

/** `import x from '…'`, `import '…'`, `export … from '…'`, not `import type` / `export type`. */
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
/** Any import, static or dynamic, type or not. */
const ANY_IMPORT = /(?:\bfrom\s+|\bimport\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;

/** Every module reachable from `entries` through static imports. */
function staticGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const hit = resolveSpec(file, m[1]!);
      if (hit) walk(hit);
    }
  };
  for (const e of entries) walk(e);
  return seen;
}

const inKb = (f: string) => f.startsWith(KB_DIR);

/** The only files under src/ui that may import src/lib/kb: the Search page and the type of its manifest module. */
const SEARCH_PAGE = path.join(ROOT, 'src', 'ui', 'pages', 'Search.tsx');
const UI_KB_ALLOWED = new Set([SEARCH_PAGE, path.join(ROOT, 'src', 'ui', 'kbSite.d.ts')]);

describe('M10: the pack is kept away from play', () => {
  it('nothing under src/engine, src/ai or src/sim reaches src/lib/kb through static imports', () => {
    const entries = ['src/engine', 'src/ai', 'src/sim'].flatMap(filesUnder);
    expect(entries.length).toBeGreaterThan(20);
    const graph = staticGraph(entries);
    expect([...graph].filter(inKb).map(rel)).toEqual([]);
  });

  it('the entry src/main.tsx does not reach src/lib/kb', () => {
    const graph = staticGraph([path.join(ROOT, 'src', 'main.tsx')]);
    expect(graph.size).toBeGreaterThan(10);
    expect([...graph].filter(inKb).map(rel)).toEqual([]);
  });

  it('no file under src/engine, src/ai, src/sim or src/ui imports src/lib/kb at all, even dynamically (but the Search page)', () => {
    const offenders: string[] = [];
    for (const f of ['src/engine', 'src/ai', 'src/sim', 'src/ui'].flatMap(filesUnder).filter((x) => !UI_KB_ALLOWED.has(x)))
      for (const m of fs.readFileSync(f, 'utf8').matchAll(ANY_IMPORT)) {
        const hit = resolveSpec(f, m[1]!);
        if ((hit && inKb(hit)) || /(^|\/)lib\/kb(\/|$)/.test(m[1]!)) offenders.push(`${rel(f)} → ${m[1]}`);
      }
    expect(offenders).toEqual([]);
  });

  it('the Search page is loaded only lazily: the entry does not reach it, and App imports it dynamically', () => {
    const graph = staticGraph([path.join(ROOT, 'src', 'main.tsx')]);
    expect(graph.has(SEARCH_PAGE)).toBe(false);
    expect(fs.readFileSync(path.join(ROOT, 'src', 'App.tsx'), 'utf8')).toContain("lazy(() => import('./ui/pages/Search')");
  });

  it('the Search page reaches the search core only: no builder, number function, engine, bot, simulator or script', () => {
    const graph = [...staticGraph([SEARCH_PAGE])].map(rel);
    expect(graph).toContain('src/lib/kb/search.ts');
    expect(graph).toContain('src/lib/kb/site.ts');
    const banned = /^(src\/lib\/kb\/build\/|src\/lib\/kb\/(facts|factNames|eval|dossier)\.ts$|src\/lib\/(eventFacts|cardFacts)\.ts$|src\/(engine|ai|sim|analysis)\/|scripts\/|tools\/|src\/data\/)/;
    expect(banned.test('src/lib/kb/build/pack.ts') && banned.test('src/engine/cards.ts') && !banned.test('src/lib/kb/search.ts')).toBe(true);
    expect(graph.filter((f) => banned.test(f))).toEqual([]);
    // and not dynamically either, from the page or the kb modules it reaches
    const dynamic: string[] = [];
    const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]/g;
    for (const f of graph.filter((x) => x.startsWith('src/lib/kb/') || x === 'src/ui/pages/Search.tsx'))
      for (const m of fs.readFileSync(path.join(ROOT, f), 'utf8').matchAll(DYNAMIC)) dynamic.push(`${f} → ${m[1]}`);
    expect(dynamic).toEqual([]);
  });

  it('the guard sees an import into src/lib/kb when there is one', () => {
    const graph = staticGraph([path.join(ROOT, 'scripts', 'kb.ts')]);
    expect([...graph].some(inKb)).toBe(true);
  });
});

describe('M7 and M8: a pure core and deterministic builds', () => {
  const core = filesUnder('src/lib/kb');
  const kbScripts = ['scripts/kb.ts', 'scripts/kb-sources.ts', 'scripts/kb-eval.ts', 'scripts/kb-dense.ts'].map((f) => path.join(ROOT, f));

  it('the dense core (step 4.1) is in src/lib/kb, and its Node side loads the embedding library only from the side folder', () => {
    expect(core.map(rel)).toContain('src/lib/kb/dense.ts');
    const src = fs.readFileSync(path.join(ROOT, 'scripts', 'kb-dense.ts'), 'utf8');
    // no static import of the library (it is not a dependency of the repository), and remote models stay off
    expect(src).not.toMatch(/from\s+['"]@huggingface/);
    expect(src).toContain('allowRemoteModels = false');
    expect(src).not.toMatch(/allowRemoteModels\s*=\s*true/);
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as Record<string, Record<string, string> | undefined>;
    expect(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })).not.toContain('@huggingface/transformers');
  });

  it('src/lib/kb imports no node: module, no UI and nothing outside src/', () => {
    expect(core.length).toBeGreaterThan(5);
    const bad: string[] = [];
    for (const f of core)
      for (const m of fs.readFileSync(f, 'utf8').matchAll(ANY_IMPORT)) {
        const spec = m[1]!;
        const hit = resolveSpec(f, spec);
        if (!spec.startsWith('.') || !hit || !rel(hit).startsWith('src/') || rel(hit).startsWith('src/ui/')) bad.push(`${rel(f)} → ${spec}`);
      }
    expect(bad).toEqual([]);
  });

  it('no locale-dependent formatting or wall clock in the core or the pack scripts', () => {
    const bad: string[] = [];
    for (const f of [...core, ...kbScripts]) {
      const src = fs.readFileSync(f, 'utf8');
      for (const re of [/\blocaleCompare\b/, /\btoLocale\w*\(/, /\bDate\.now\(/, /\bnew Date\(/, /\bIntl\./, /\bMath\.random\(/]) if (re.test(src)) bad.push(`${rel(f)}: ${re.source}`);
    }
    expect(bad).toEqual([]);
  });
});
