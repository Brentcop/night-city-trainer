// The season's round-robin field and its bred decks under the one-entry-per-list rule (src/lib/distinctLists.ts), kept
// apart from scripts/season.ts so the rule is tested without running a season (tests/distinct-lists.test.ts).
//
// A bred deck cannot be the same list as a library deck: the same list means the same three Legends, and the breeder
// (src/ai/breeder.ts breedSeason) never builds a Legend trio in `seenTriples`, which season.ts fills with every library
// deck's trio, and never builds one trio twice in a season. sameListBred is the guard that would keep such a deck out of
// a season slot all the same, without changing what breedSeason builds.
import type { LibraryDeck } from '../src/lib/library';
import type { DeckList } from '../src/engine/types';
import { distinctLists, type Listed, type SameList } from '../src/lib/distinctLists';
import { listOf } from '../src/lib/listTwin';

export interface SeasonField {
  /** the round robin's decks: the meta decks, the incumbents, the newcomers */
  field: LibraryDeck[];
  incumbents: LibraryDeck[];
  /** decks left out because their list was already in the field */
  left: SameList<LibraryDeck>[];
}

/**
 * The round robin's field: the meta decks, then the first `slots` incumbents read down `ranked` (the parents by strength,
 * meta decks taken out, each looked up in the library: undefined when it is not there, which uses a slot as it always
 * did), then the newcomers. One entry per list: an incumbent whose list is already in the field is passed over without
 * using a slot, and a newcomer whose list is already in it is left out; both are named in `left`. With allowSameLists,
 * the field as before the rule: the first `slots` of `ranked`.
 */
export function seasonField(o: { meta: readonly LibraryDeck[]; ranked: readonly (LibraryDeck | undefined)[]; newcomers: readonly LibraryDeck[]; slots: number; allowSameLists?: boolean }): SeasonField {
  if (o.allowSameLists) {
    const incumbents = o.ranked.slice(0, o.slots).filter((d): d is LibraryDeck => !!d);
    return { field: [...o.meta, ...incumbents, ...o.newcomers], incumbents, left: [] };
  }
  const owner = new Map<string, LibraryDeck>();
  for (const d of o.meta) if (!owner.has(listOf(d.deck))) owner.set(listOf(d.deck), d);
  const incumbents: LibraryDeck[] = [];
  const left: SameList<LibraryDeck>[] = [];
  let used = 0;
  for (const d of o.ranked) {
    if (used === o.slots) break;
    if (!d) {
      used++;
      continue;
    }
    const first = owner.get(listOf(d.deck));
    if (first) {
      left.push({ deck: d, sameAs: first });
      continue;
    }
    owner.set(listOf(d.deck), d);
    incumbents.push(d);
    used++;
  }
  const all = distinctLists([...o.meta, ...incumbents, ...o.newcomers]);
  return { field: all.kept, incumbents: incumbents.filter((d) => all.kept.includes(d)), left: [...left, ...all.left] };
}

/**
 * The bred decks a season keeps: each one whose list is no library deck's list (`library`: the decks already in it, in
 * library order) and no earlier bred deck's. `file` is the file each bred deck would be written to.
 */
export function sameListBred<B extends { deck: DeckList }>(bred: readonly B[], library: readonly Listed[], file: (d: DeckList) => string): { kept: B[]; left: SameList<Listed>[] } {
  const rows: (Listed & { bred?: B })[] = [...library, ...bred.map((b) => ({ file: file(b.deck), deck: b.deck, bred: b }))];
  const r = distinctLists(rows);
  return { kept: r.kept.flatMap((x) => (x.bred ? [x.bred] : [])), left: r.left.filter((s) => s.deck.bred) };
}
