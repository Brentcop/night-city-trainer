// How a deck imported from a shared link is recognised (docs/DECK_IMPORT.md): its provenance Origin starts "Imported
// from" (src/lib/deckImport.ts importOrigin writes it). The library gives such a file the kind `shared`
// (src/lib/library.ts), and the deck notes count it as one the owner writes (src/content/deckObjectives isOwnerImport).
// No imports, so the deck notes (read by the bots' package terms, src/ai/packages.ts) can use it without pulling the
// library into the game workers.

/** How the Origin of a deck imported from a shared link starts. */
export const IMPORT_ORIGIN = 'Imported from ';

/** The Author line of an imported deck whose page named no author. */
export const IMPORT_NO_AUTHOR = 'unknown (the page names no author)';

/** Whether a provenance Origin is that of a deck imported from a shared link: the one test of it. */
export const isImportedOrigin = (origin: string | undefined): boolean => (origin ?? '').startsWith(IMPORT_ORIGIN);

/** The site an imported deck's Origin names ("cyberpunk-tcg-sim.online"), or '' when it names none. */
export function importedSite(origin: string | undefined): string {
  if (!origin || !isImportedOrigin(origin)) return '';
  const site = origin.slice(IMPORT_ORIGIN.length).replace(/ \(.*$/, '').trim();
  return site === 'a shared link' ? '' : site;
}
