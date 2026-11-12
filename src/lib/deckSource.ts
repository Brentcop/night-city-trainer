// Where a library deck comes from, as one key per deck: the gallery's source filter and its "Group by source" view.
// Built from LibraryDeck.kind (meta / guide / ladder / original / custom) and, where one kind covers two sources, the
// provenance header (Trainer originals vs bred season decks) or the browser record (tuned / Lab-bred / my decks).
import type { LibraryDeck } from './library';

export type SourceKey = 'meta' | 'guide' | 'nc' | 'ladder' | 'bred' | 'mine' | 'tuned' | 'lab';

export interface SourceInfo {
  key: SourceKey;
  /** the chip and section label */
  label: string;
  icon: string;
  /** one line on what the source is (section help, chip tooltip) */
  help: string;
  /** saved in this browser (not shipped with the site) */
  browser: boolean;
}

/** Every source, in the order the chips and grouped sections show them. */
export const SOURCES: readonly SourceInfo[] = [
  { key: 'meta', label: 'choom.gg meta', icon: '◆', help: 'The archetypes choom.gg tracks as the current meta, with their tier.', browser: false },
  { key: 'guide', label: 'choom.gg guides', icon: '✎', help: 'Lists from community strategy guides, credited to their authors.', browser: false },
  { key: 'nc', label: 'Trainer originals (NC)', icon: '⚙', help: 'Hand-built by this trainer around a single plan, then forged.', browser: false },
  {
    key: 'ladder',
    label: 'Sim ladder (owner imports)',
    icon: '▲',
    help: 'Legend trios seen at Master rank on cyberpunk-tcg-sim.online, imported by the owner. Only the Legends are public, so the main decks are theorized from our data, then forged.',
    browser: false,
  },
  { key: 'bred', label: 'Bred (seasons)', icon: '🧬', help: 'Bred by the automated breeding seasons and kept for doing well.', browser: false },
  { key: 'mine', label: 'My decks', icon: '★', help: 'Built or imported here and saved in this browser only.', browser: true },
  { key: 'tuned', label: 'Tuned in the Lab', icon: '🔧', help: 'Tuned in the Deck Lab and saved in this browser only.', browser: true },
  { key: 'lab', label: 'Bred in the Lab', icon: '🧪', help: 'Bred in the Deck Lab and saved in this browser only.', browser: true },
];

const BY_KEY = new Map(SOURCES.map((s) => [s.key, s]));
export const sourceInfo = (k: SourceKey): SourceInfo => BY_KEY.get(k) ?? (SOURCES[0] as SourceInfo);
export const isSourceKey = (s: string): s is SourceKey => BY_KEY.has(s as SourceKey);

/** A tuned list's saved name (src/lib/deckLab.ts tunedName): "… (tuned)", "… (tuned, partial)", "… (tuned, not shown better)". */
export const TUNED_NAME = / \(tuned(, partial)?(, not shown better)?\)$/;
/** A Lab-bred deck's name (src/lib/deckLab.ts breedInBrowser): "Lab-123-04 …". */
export const LAB_BRED_NAME = /^Lab-\d{3}-\d{2}\b/;

/** The source of a library deck. */
export function deckSource(d: Pick<LibraryDeck, 'kind' | 'prov' | 'deck' | 'tuned' | 'manifest'>): SourceKey {
  switch (d.kind) {
    case 'meta':
      return 'meta';
    case 'guide':
      return 'guide';
    case 'ladder':
      return 'ladder';
    case 'original':
      return (d.prov.origin ?? '').startsWith('Night City Trainer bred') ? 'bred' : 'nc';
    default:
      if (d.tuned || TUNED_NAME.test(d.deck.name)) return 'tuned';
      if (LAB_BRED_NAME.test(d.deck.name) || (d.manifest?.field.mode ?? '').startsWith('deck-lab-quick-test')) return 'lab';
      return 'mine';
  }
}
