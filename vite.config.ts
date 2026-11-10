import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Pages load lazily, but the entry chunk (~820 kB) still holds Home's data: src/lib/deckStats.ts (used by Home and
  // DeckIdentity) bundles analysis.json (~330 KB), plus deckReports, cards, seasons and ratings. The limit sits just
  // above it so a new oversized chunk still warns.
  build: { outDir: 'dist', chunkSizeWarningLimit: 850 },
  // Agent worktrees under .claude/ hold full copies of the repo; never collect their tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
