import raw from '../data/cards.json';
import type { CardDef } from './types';

export const CARDS: CardDef[] = raw as CardDef[];
export const CARD_BY_ID: Record<string, CardDef> = Object.fromEntries(CARDS.map((c) => [c.id, c]));

/** Normalize a card name for fuzzy matching across sites ("Name: Sub", "Name — Sub", "Name - Sub"). */
function normName(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’'`"“”]/g, '')
    .replace(/\s*[—–:|]\s*/g, ' ')
    .replace(/\s+-\s+/g, ' ')
    .replace(/[^a-z0-9& ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BY_NORM = new Map<string, CardDef>();
const BY_BASE = new Map<string, CardDef[]>();
for (const c of CARDS) {
  BY_NORM.set(normName(c.displayName), c);
  BY_NORM.set(normName(c.subname ? `${c.name} ${c.subname}` : c.name), c);
  BY_NORM.set(c.id, c);
  const base = normName(c.name);
  BY_BASE.set(base, [...(BY_BASE.get(base) ?? []), c]);
}

/** Look up a card by id, display name, "Name: Subname", etc. */
export function findCard(query: string, prefer?: 'Legend' | 'nonLegend'): CardDef | null {
  const q = query.trim();
  if (CARD_BY_ID[q]) return CARD_BY_ID[q];
  const n = normName(q);
  if (BY_NORM.has(n)) return BY_NORM.get(n)!;
  const base = BY_BASE.get(n);
  if (base && base.length === 1) return base[0];
  if (base && prefer) {
    const f = base.filter((c) => (prefer === 'Legend') === (c.type === 'Legend'));
    if (f.length === 1) return f[0];
  }
  // prefix match on display names (handles truncated subtitles)
  const hits = CARDS.filter((c) => normName(c.displayName).startsWith(n));
  if (hits.length === 1) return hits[0];
  if (prefer) {
    const f = hits.filter((c) => (prefer === 'Legend') === (c.type === 'Legend'));
    if (f.length === 1) return f[0];
  }
  return null;
}

export function cardLabel(c: CardDef): string {
  return c.subname ? `${c.name}: ${c.subname}` : c.name;
}
