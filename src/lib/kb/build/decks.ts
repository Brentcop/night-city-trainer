// Knowledge pack builders: one record per library deck (data/decks/*.txt and custom/, by the library rules in
// src/lib/library.ts) and one per deck note (src/content/deckObjectives/). A deck's list fingerprint is in its stamps
// and among its aliases; a note carries the fingerprint it was written for and says whether the list still matches.
import type { KbLink, KbOrigin, KbRecord } from '../types';
import type { MentionLinker } from './mentions';
import { finishRecord, linksTo } from './record';

export interface DeckInput {
  /** file name, e.g. "meta-rrg-dexter-midrange.txt" */
  file: string;
  /** path from the repository root */
  path: string;
  name: string;
  kind: string;
  legends: readonly string[];
  main: readonly string[];
  sideboard: readonly string[];
  prov: { origin?: string; author?: string; source?: string; added?: string; forged?: string; parents?: string };
  tier?: string;
  idea?: string;
  listId: string;
  deckId: string;
  /** Legend colour letters, e.g. "RRG" */
  colors: string;
  /** synergy package ids the list is built around */
  packages: readonly string[];
}

export const deckStem = (file: string): string => file.replace(/\.txt$/, '');
export const deckRecordId = (file: string): string => `deck:${deckStem(file)}`;

const KIND_WORDS: Record<string, string> = {
  meta: 'a choom.gg meta archetype',
  guide: 'a choom.gg community guide list',
  ladder: 'a sim-ladder list',
  original: 'a Night City Trainer original',
  custom: 'a custom list',
};

function deckOrigin(d: DeckInput): KbOrigin {
  if (d.kind === 'meta' || d.kind === 'guide' || d.kind === 'ladder') return 'imported';
  return /bred|optimizer|tournament/i.test(d.prov.origin ?? '') ? 'generated' : 'authored';
}

/** "3 Name, 2 Other" in list order. */
function countList(ids: readonly string[], name: (id: string) => string): string {
  const n = new Map<string, number>();
  for (const id of ids) n.set(id, (n.get(id) ?? 0) + 1);
  return [...n].map(([id, k]) => `${k} ${name(id)}`).join(', ');
}

export function buildDecks(decks: readonly DeckInput[], o: { cardName: (id: string) => string | undefined; packageName: (id: string) => string | undefined }): KbRecord[] {
  const name = (id: string) => o.cardName(id) ?? id;
  return decks.map((d) => {
    const text = [
      `${d.name} (${d.colors}): a library deck, ${KIND_WORDS[d.kind] ?? d.kind}.`,
      d.prov.origin ? `Origin: ${d.prov.origin}.` : null,
      d.prov.author ? `Author: ${d.prov.author}.` : null,
      d.tier ? `choom.gg tier: ${d.tier}.` : null,
      d.idea ? `Idea: ${d.idea}` : null,
      `Legends: ${d.legends.map(name).join(', ')}.`,
      `Main deck (${d.main.length} cards): ${countList(d.main, name)}.`,
      d.sideboard.length ? `Sideboard (${d.sideboard.length}): ${countList(d.sideboard, name)}.` : null,
      d.packages.length ? `Built around: ${d.packages.map((p) => o.packageName(p) ?? p).join(', ')}.` : null,
    ]
      .filter(Boolean)
      .join('\n');
    return finishRecord({
      id: deckRecordId(d.file),
      kind: 'deck',
      title: d.name,
      aliases: [d.file, deckStem(d.file), d.listId, d.deckId],
      text,
      fields: { file: d.file, kind: d.kind, colors: d.colors, tier: d.tier, author: d.prov.author, origin: d.prov.origin, added: d.prov.added, cards: d.main.length, deckId: d.deckId },
      links: [...linksTo('card', [...d.legends, ...d.main, ...d.sideboard].map((id) => `card:${id}`)), ...linksTo('package', d.packages.map((p) => `pkg:${p}`))],
      source: { file: d.path },
      origin: deckOrigin(d),
      scope: 'public',
      stamps: { listId: d.listId },
    });
  });
}

/** The fields of a deck note the pack reads (DeckObjective in src/content/deckObjectives/vocabulary.ts). */
export interface ObjectiveInput {
  listId: string;
  objective: string;
  plan: readonly { phase: string; text: string }[];
  keyCards: readonly { id: string; role: string }[];
  signals: readonly { text: string; terms: readonly string[] }[];
  risks: readonly string[];
  source: string;
  status: string;
  guide?: { title: string; author: string; site: string; url?: string };
  basedOn?: readonly string[];
  placeholder?: boolean;
  synergies?: readonly string[];
}

export interface ObjectiveDeck {
  name: string;
  listId: string;
  cards: readonly string[];
}

/**
 * Notes for decks in the library (others are skipped and counted). A note links to its deck, key cards, signal terms,
 * packages and the parent decks it builds on (those still in the library), and to cards its prose names; a name that
 * several cards share is resolved against the deck's own list.
 */
export function buildObjectives(
  notes: Readonly<Record<string, ObjectiveInput>>,
  o: { decks: ReadonlyMap<string, ObjectiveDeck>; cardName: (id: string) => string | undefined; linker: MentionLinker; file: (deckFile: string) => string; skipped: Record<string, number> },
): KbRecord[] {
  const out: KbRecord[] = [];
  const name = (id: string) => o.cardName(id) ?? id;
  for (const file of Object.keys(notes).sort()) {
    const n = notes[file]!;
    const deck = o.decks.get(file);
    if (!deck) {
      o.skipped['objective: deck not in the library'] = (o.skipped['objective: deck not in the library'] ?? 0) + 1;
      continue;
    }
    const current = n.listId === deck.listId;
    const prose = [n.objective, ...n.plan.map((p) => p.text), ...n.keyCards.map((k) => k.role), ...n.signals.map((s) => s.text), ...n.risks];
    const text = [
      `Game plan for ${deck.name} (deck note, ${n.status}${n.placeholder ? ', placeholder' : ''}${current ? '' : ', written for an older list'}): ${n.objective}`,
      n.plan.length ? `Plan: ${n.plan.map((p) => `${p.phase}: ${p.text}`).join(' ')}` : null,
      n.keyCards.length ? `Key cards: ${n.keyCards.map((k) => `${name(k.id)} (${k.role})`).join('; ')}` : null,
      n.signals.length ? `Success signals: ${n.signals.map((s) => s.text).join('; ')}.` : null,
      n.risks.length ? `Risks: ${n.risks.join(' ')}` : null,
      `Source: ${n.source}${n.guide ? `, "${n.guide.title}" by ${n.guide.author} (${n.guide.site})` : ''}.`,
    ]
      .filter(Boolean)
      .join('\n');
    const parents = (n.basedOn ?? []).filter((f) => o.decks.has(f));
    const links: KbLink[] = [
      { rel: 'deck', to: deckRecordId(file) },
      ...linksTo('deck', parents.map(deckRecordId)),
      ...linksTo('card', n.keyCards.map((k) => `card:${k.id}`)),
      ...linksTo('term', n.signals.flatMap((s) => s.terms.map((t) => `term:signal/${t}`))),
      ...linksTo('package', (n.synergies ?? []).map((s) => `pkg:${s}`)),
    ];
    const keyIds = new Set(n.keyCards.map((k) => k.id));
    const mentioned = o.linker.cardsIn(prose.join('\n'), deck.cards).filter((id) => !keyIds.has(id));
    links.push(...linksTo('mentions', mentioned.map((id) => `card:${id}`)));
    out.push(
      finishRecord({
        id: `objective:${deckStem(file)}`,
        kind: 'objective',
        title: `${deck.name} game plan`,
        text,
        fields: { deck: file, noteStatus: n.status, source: n.source, current, placeholder: n.placeholder, basedOn: n.basedOn?.join(', ') || undefined },
        links,
        source: { file: o.file(file), at: file },
        origin: 'authored',
        scope: 'public',
        status: n.status === 'owner' ? 'owner' : 'draft',
        stamps: { listId: n.listId },
      }),
    );
  }
  return out;
}
