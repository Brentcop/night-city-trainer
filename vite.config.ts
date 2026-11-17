import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { budgetProblems, isKbFile, isSearchChunk, kbPartName, searchBudgetProblems } from './tools/size-budget.ts';

/**
 * Puts the owner's site config (public/site-config.json, src/lib/siteConfig.ts) into index.html as a JSON script and
 * sets the page title from it, so the first paint already has the right nav, title, banner and default accent (no flash).
 * The app still fetches the file at runtime (src/ui/useSiteConfig.ts). An unreadable file inlines nothing: the app then
 * uses its bundled defaults, and `npm run check:data` reports the problem.
 */
function siteConfigInline(): Plugin {
  return {
    name: 'nct-site-config-inline',
    transformIndexHtml(html) {
      let cfg: unknown;
      try {
        cfg = JSON.parse(fs.readFileSync(fileURLToPath(new URL('./public/site-config.json', import.meta.url)), 'utf8'));
      } catch {
        return html;
      }
      // JSON in a <script> must not be able to close it
      const json = JSON.stringify(cfg).replace(/</g, '\\u003c');
      const site = (cfg as { site?: { title?: unknown } })?.site;
      const title = typeof site?.title === 'string' && site.title.trim() ? site.title.trim().slice(0, 60) : null;
      const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return {
        html: title ? html.replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`) : html,
        tags: [{ tag: 'script', attrs: { type: 'application/json', id: 'nct-site-config' }, children: json, injectTo: 'head-prepend' }],
      };
    },
  };
}

/** Fails the build when a Web Worker bundle (APP-14) grows past its budget (tools/size-budget.ts). */
function workerBudget(): Plugin {
  let outDir = 'dist';
  return {
    name: 'nct-worker-budget',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    closeBundle() {
      const dir = `${outDir}/assets`;
      if (!fs.existsSync(dir)) return;
      const files = fs.readdirSync(dir).map((name) => ({ name, bytes: fs.statSync(`${dir}/${name}`).size }));
      const problems = budgetProblems(files);
      if (problems.length) throw new Error(['Worker size budget:', ...problems].join('\n'));
    },
  };
}

/**
 * The site's knowledge pack (docs/RAG_PLAN.md step 3, tools/kb-site.ts, src/lib/kb/site.ts). The search page imports
 * `virtual:nct-kb-site`, the manifest of the part files. Building, the parts are emitted as
 * assets/kb-<group>-<part>-<content hash>.json and the manifest (inside the page's own hashed chunk) names them, so a
 * deploy never mixes versions; once written, the build fails when a part passes the per-file cap, the first-search parts
 * together pass their budget, a planned group built no part, a kb file is not one the plan knows, or the page chunk
 * passes its budget (tools/size-budget.ts). In the dev server the same files are served from memory and rebuilt when an
 * input file changes. The pack is built from the repository at build time (never from data/raw, never committed), so
 * a content edit can never leave a stale pack behind. tools/kb-site.ts is loaded through tsx only when the manifest is
 * first asked for, so the config itself stays light (Vitest loads it too).
 */
function kbSitePack(): Plugin {
  const VIRTUAL = 'virtual:nct-kb-site';
  const RESOLVED = `\0${VIRTUAL}`;
  const root = fileURLToPath(new URL('.', import.meta.url));
  type KbSite = typeof import('./tools/kb-site.ts');
  let site: Promise<{ m: KbSite; pack: Awaited<ReturnType<KbSite['buildSitePack']>> }> | null = null;
  let inputs = new Set<string>();
  let command: 'build' | 'serve' = 'serve';
  let outDir = 'dist';
  const load = () =>
    (site ??= (async () => {
      const { tsImport } = await import('tsx/esm/api');
      const m = (await tsImport('./tools/kb-site.ts', import.meta.url)) as KbSite;
      const pack = await m.buildSitePack(root);
      inputs = new Set(pack.inputs);
      return { m, pack };
    })());
  const url = (m: KbSite, f: Parameters<KbSite['shardFileName']>[0]) => `assets/${m.shardFileName(f)}`;
  return {
    name: 'nct-kb-site',
    configResolved(c) {
      command = c.command;
      outDir = c.build.outDir;
    },
    resolveId(id) {
      return id === VIRTUAL ? RESOLVED : null;
    },
    async load(id) {
      if (id !== RESOLVED) return null;
      const { m, pack } = await load();
      if (command === 'build') for (const f of pack.files) this.emitFile({ type: 'asset', fileName: url(m, f), source: f.json });
      return `export default ${JSON.stringify(m.siteManifest(pack.files, (f) => url(m, f)))};`;
    },
    async closeBundle() {
      if (command !== 'build') return;
      const dir = `${outDir}/assets`;
      if (!fs.existsSync(dir)) return;
      const { m } = await load();
      // the site search's part files and page chunk, by gzip size
      const files = fs
        .readdirSync(dir)
        .filter((name) => isKbFile(name) || isSearchChunk(name))
        .sort()
        .map((name) => ({ name, gzipBytes: gzipSync(fs.readFileSync(`${dir}/${name}`), { level: 9 }).length }));
      const late = new Map(m.SITE_GROUPS.map((g) => [g.name, g.late]));
      let first = 0;
      for (const f of files) {
        const g = kbPartName(f.name)?.group;
        const when = g === undefined ? '' : late.get(g) ? ' late' : ' first search';
        if (g !== undefined && late.get(g) === false) first += f.gzipBytes;
        console.log(`search ${f.name} ${(f.gzipBytes / 1000).toFixed(1)} kB gzip${when}`);
      }
      console.log(`search first-search parts ${(first / 1000).toFixed(1)} kB gzip together`);
      const over = searchBudgetProblems(files, m.SITE_GROUPS);
      if (over.length) throw new Error(['Search size budget:', ...over].join('\n'));
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // any knowledge-pack file name: a part this pack has is served, any other (an older name) is a 404
        const name = /^\/assets\/(kb-[\w-]+\.json)(?:\?.*)?$/.exec(req.url ?? '')?.[1];
        if (!name) return next();
        load().then(
          ({ m, pack }) => {
            const f = pack.files.find((x) => m.shardFileName(x) === name);
            if (!f) {
              // an older part or shard name (the pack was rebuilt since the page loaded): gone, as after a deploy
              res.statusCode = 404;
              res.end();
              return;
            }
            res.setHeader('Content-Type', 'application/json');
            res.end(f.json);
          },
          (e: unknown) => next(e),
        );
      });
      // an edited input drops the pack; the next request for the manifest rebuilds it
      server.watcher?.on('change', (file) => {
        const rel = path.relative(root, file).split(path.sep).join('/');
        if (!site || !inputs.has(rel)) return;
        site = null;
        const mod = server.moduleGraph.getModuleById(RESOLVED);
        if (mod) server.moduleGraph.invalidateModule(mod);
      });
    },
  };
}

/**
 * The search core (src/lib/kb/text.ts and render.ts) folds text with the card-name matcher's foldText
 * (src/lib/cardMentions.ts). Shared by the Search page and the card-mention runtime, that module would become a chunk of
 * its own, and every page that shows card names would make one more request even with the search switched off. So
 * the build gives the search core its own copy of the same file (a module id with a query; same source, nothing
 * duplicated in the repository), and the card-mention chunk stays as it was.
 */
function kbOwnFoldText(): Plugin {
  const kbDir = fileURLToPath(new URL('./src/lib/kb/', import.meta.url));
  const matcher = fileURLToPath(new URL('./src/lib/cardMentions.ts', import.meta.url));
  return {
    name: 'nct-kb-own-foldtext',
    apply: 'build',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !/^(\.\.\/)+cardMentions$/.test(source)) return null;
      const from = path.resolve(importer.replace(/\?.*$/, ''));
      if (path.dirname(from) !== path.resolve(kbDir)) return null;
      return path.resolve(path.dirname(from), source) === path.resolve(matcher.replace(/\.ts$/, '')) ? `${matcher}?kb` : null;
    },
  };
}

// base './' makes the build work from any GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), siteConfigInline(), workerBudget(), kbSitePack(), kbOwnFoldText()],
  // Pages load lazily and the large data files have their own chunks (src/data/index.ts), so every chunk is under
  // Vite's default 500 kB warning limit; no override.
  build: { outDir: 'dist' },
  // Agent worktrees under .claude/ hold full copies of the repo; never collect their tests.
  // testTimeout: the seeded-game tests assert the same game, not a speed. Alone they take about 2 s, but in a full run
  // with every core busy (and tests that spawn the forge beside them) several sat at 4 to 5 s against the default 5 s
  // and one tipped over. Tests that need longer still name their own timeout.
  test: { exclude: [...configDefaults.exclude, '.claude/**'], testTimeout: 15_000 },
});
