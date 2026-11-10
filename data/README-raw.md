# data/raw (local only)

Saved copies of third-party sources used during research (choom.gg pages and guides, the official rules text, the
cyberpunk-tcg-sim.online and netdeck.gg card catalogs). They are excluded from the public repository (`.gitignore`).
To rebuild them: re-download the pages listed in docs/RESEARCH.md, then run `npm run build:data`,
`npx tsx scripts/import-meta.ts` and `npx tsx scripts/import-guides.ts`.
