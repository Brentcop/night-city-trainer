// The field a season tests and tunes bred decks against (docs/REVIEW_2026-11-24.md B.6, finding R1 and row 13): the 7 meta
// decks (every season until 2026-11-24, and still the default) or the meta decks plus the library's top N lists by
// rating, one entry per list (src/lib/distinctLists.ts's rule: two decks with the same Legends and main deck are one).
// "By rating" is parent strength's order (src/lib/parentStrength.ts: the power rating's estimate, decks with 100 or more
// games on their current list), so the field's top lists and the breeder's parents are ranked by one definition.
//
// One function for the season's screen and gate (scripts/season.ts --field-top N) and the forge (scripts/forge.ts
// --field-top N, which the season passes on). The change ledger keys an entry on the field's lists, so a forge run with
// another field starts new entries: games played against the 7 meta decks never pool with games against a wider field.
// Pure: the ranked list comes in.
import type { DeckList } from '../engine/types';
import type { SameList } from './distinctLists';
import { listOf } from './listTwin';

/** The default: the meta decks alone (top 0). */
export const DEFAULT_FIELD_TOP = 0;

export interface TuningField<L> {
  /** the meta decks (library order), then the top lists in rating order */
  field: L[];
  /** the top lists added to the meta decks */
  added: L[];
  /** decks passed over because their list was already in the field */
  left: SameList<L>[];
}

/**
 * The meta decks, then the first `top` decks of `ranked` (strongest first, as rankParents gives them) that are not meta
 * decks and whose list is not in the field yet, each looked up in `lib` by name. With `top` 0, the meta decks alone.
 */
export function tuningField<L extends { file: string; kind: string; deck: DeckList }>(lib: readonly L[], ranked: readonly { deck: Pick<DeckList, 'name'> }[], top: number = DEFAULT_FIELD_TOP): TuningField<L> {
  const meta = lib.filter((d) => d.kind === 'meta');
  const owner = new Map<string, L>();
  for (const d of meta) if (!owner.has(listOf(d.deck))) owner.set(listOf(d.deck), d);
  const added: L[] = [];
  const left: SameList<L>[] = [];
  if (top > 0) {
    const byName = new Map<string, L>();
    for (const d of lib) if (!byName.has(d.deck.name)) byName.set(d.deck.name, d);
    for (const r of ranked) {
      if (added.length >= top) break;
      const d = byName.get(r.deck.name);
      if (!d || d.kind === 'meta') continue;
      const first = owner.get(listOf(d.deck));
      if (first) {
        left.push({ deck: d, sameAs: first });
        continue;
      }
      owner.set(listOf(d.deck), d);
      added.push(d);
    }
  }
  return { field: [...meta, ...added], added, left };
}

/** "the 7 meta decks" or "the 7 meta decks and the library's top 8 lists by rating (one entry per list)". */
export function tuningFieldWords(f: Pick<TuningField<unknown>, 'field' | 'added'>): string {
  const meta = f.field.length - f.added.length;
  const base = `the ${meta} meta deck${meta === 1 ? '' : 's'}`;
  return f.added.length ? `${base} and the library's top ${f.added.length} list${f.added.length === 1 ? '' : 's'} by rating (one entry per list)` : base;
}
