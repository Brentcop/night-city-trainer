// Knowledge pack builders: one record per card (src/data/cards.json). The card's short name and sub-name are aliases,
// so "Goro Takemura" finds all three Goros; the card data version is the run manifests' `cardDataVersion`.
import { byString, hashText, type KbRecord } from '../types';
import { finishRecord } from './record';

/** The fields of a card the pack reads (CardDef has them all). */
export interface CardInput {
  id: string;
  name: string;
  subname: string | null;
  displayName: string;
  color: string;
  type: string;
  cost: number | null;
  power: number | null;
  ram: number;
  rarity: string;
  tags: readonly string[];
  text: string;
  keywords: readonly string[];
  sellable: boolean;
  set: string;
  number: string;
}

/** The same value as a run manifest's `cardDataVersion` (src/lib/runManifest.ts). */
export function cardDataVersion(cards: readonly CardInput[]): string {
  return `fnv1a64:${hashText(JSON.stringify([...cards].sort((a, b) => byString(a.id, b.id))))}`;
}

export function cardText(c: CardInput): string {
  const stats = [c.cost !== null ? `cost ${c.cost} €$` : null, c.power !== null ? `power ${c.power}` : null, `RAM ${c.ram}`].filter(Boolean).join(', ');
  return [
    `${c.displayName}: a ${c.color} ${c.type} card (${stats}; ${c.rarity}).`,
    c.tags.length ? `Tags: ${c.tags.join(', ')}.` : null,
    c.keywords.length ? `Keywords: ${c.keywords.join(', ')}.` : null,
    c.sellable ? null : 'It cannot be sold.',
    c.text ? `Card text: ${c.text}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function buildCards(cards: readonly CardInput[], o: { file: string; cardDataVersion: string }): KbRecord[] {
  return cards.map((c, i) =>
    finishRecord({
      id: `card:${c.id}`,
      kind: 'card',
      title: c.displayName,
      aliases: [c.id, c.subname ? c.name : null, c.subname],
      text: cardText(c),
      fields: {
        color: c.color,
        type: c.type,
        cost: c.cost,
        power: c.power,
        ram: c.ram,
        rarity: c.rarity,
        tags: c.tags.join(', ') || undefined,
        keywords: c.keywords.join(', ') || undefined,
        sellable: c.sellable,
        set: c.set,
        number: c.number,
      },
      source: { file: o.file, at: `/${i}` },
      origin: 'imported',
      scope: 'public',
      stamps: { cardDataVersion: o.cardDataVersion },
    }),
  );
}
