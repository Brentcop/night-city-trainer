import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig, type Plugin } from 'vitest/config';
import react from '@vitejs/plugin-react';

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

// base './' makes the build work from any GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react(), siteConfigInline()],
  // Pages load lazily and the large data files have their own chunks (src/data/index.ts), so every chunk is under
  // Vite's default 500 kB warning limit; no override.
  build: { outDir: 'dist' },
  // Agent worktrees under .claude/ hold full copies of the repo; never collect their tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
