// Knowledge pack: a dossier is one record plus its neighbours (one link away, either direction), grouped by link
// type and cut to a token budget. A reverse link is grouped by what the neighbour is ("ruling" for the rulings that
// name a card), except mentions, which stay "mentions".
import type { KbIndex } from './search';
import { byString, estimateTokens, KB_RELS, type KbKind, type KbRecord, type KbRel } from './types';

/** The group a reverse link goes in, by the linking record's kind. */
const REL_OF_KIND: Partial<Record<KbKind, KbRel>> = {
  card: 'card',
  ruling: 'ruling',
  faq: 'official',
  rule: 'rule',
  trule: 'rule',
  errata: 'official',
  deck: 'deck',
  objective: 'objective',
  package: 'package',
  term: 'term',
  guide: 'guide',
};

export interface DossierGroup {
  rel: KbRel;
  records: KbRecord[];
  /** neighbours left out to stay inside the budget */
  omitted: number;
}

export interface Dossier {
  record: KbRecord;
  groups: DossierGroup[];
  omitted: number;
}

/** Neighbours grouped by link type (in KB_RELS order), each group in id order, uncut. */
export function neighbours(ix: KbIndex, id: string): { rel: KbRel; records: KbRecord[] }[] {
  const groups = new Map<KbRel, Set<string>>();
  for (const e of ix.edges.get(id) ?? []) {
    const other = ix.byId.get(e.other);
    if (!other) continue;
    const rel = e.dir === 'out' || e.rel === 'mentions' ? e.rel : REL_OF_KIND[other.kind] ?? e.rel;
    const set = groups.get(rel) ?? new Set<string>();
    set.add(e.other);
    groups.set(rel, set);
  }
  return KB_RELS.filter((r) => groups.has(r)).map((rel) => ({
    rel,
    records: [...groups.get(rel)!].sort(byString).map((x) => ix.byId.get(x)!),
  }));
}

/**
 * One record and its neighbours, cut so that the record's own size (`baseTokens`), `groupTokens` per group and
 * `lineCost` per neighbour stay within `maxTokens`. Neighbours are taken round robin over the groups, so a card's many decks don't crowd out its rulings.
 */
export function dossier(
  ix: KbIndex,
  id: string,
  o: { maxTokens?: number; lineCost?: (r: KbRecord) => number; baseTokens?: (r: KbRecord) => number; groupTokens?: number } = {},
): Dossier | null {
  const record = ix.byId.get(id);
  if (!record) return null;
  const max = o.maxTokens ?? Infinity;
  const cost = o.lineCost ?? ((r: KbRecord) => estimateTokens(`${r.id}  ${r.title}`) + 1);
  const all = neighbours(ix, id);
  let used = (o.baseTokens ? o.baseTokens(record) : estimateTokens(record.text) + estimateTokens(record.title) + 20) + (o.groupTokens ?? 0) * all.length;
  const groups: DossierGroup[] = all.map((g) => ({ rel: g.rel, records: [], omitted: 0 }));
  const depth = Math.max(0, ...all.map((g) => g.records.length));
  for (let i = 0; i < depth; i++)
    all.forEach((g, gi) => {
      const r = g.records[i];
      if (!r) return;
      const c = cost(r);
      if (used + c > max) {
        groups[gi]!.omitted++;
        return;
      }
      used += c;
      groups[gi]!.records.push(r);
    });
  return { record, groups, omitted: groups.reduce((a, g) => a + g.omitted, 0) };
}
