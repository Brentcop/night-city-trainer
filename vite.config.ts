import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  // Agent worktrees under .claude/ hold full copies of the repo; never collect their tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
