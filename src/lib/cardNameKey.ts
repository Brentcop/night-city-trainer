// A card name for matching, the one rule the deck import (src/lib/deckImport.ts resolveRef) and the outside meta's
// Legend matching (src/lib/outsideMeta.ts) share. Pure and tiny: it imports nothing, so a page can match names without
// pulling the card data in.

/** A card name for matching: accents, case, apostrophes and the separator between name and subname set aside. */
export function nameKey(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’‘`´']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
