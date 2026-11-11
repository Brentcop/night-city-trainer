import { configDefaults, defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// base './' makes the build work from any GitHub Pages sub-path (https://<user>.github.io/<repo>/).
export default defineConfig({
  base: './',
  plugins: [react()],
  // Pages load lazily and the large data files have their own chunks (src/data/index.ts), so every chunk is under
  // Vite's default 500 kB warning limit; no override.
  build: { outDir: 'dist' },
  // Agent worktrees under .claude/ hold full copies of the repo; never collect their tests.
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
