// Card-type breakdown of a main deck (Unit / Gear / Program), shared by the deck profile and the gallery tiles.
import { CARD_BY_ID } from '../engine/cards';
import type { CardDef } from '../engine/types';

export type MainType = Extract<CardDef['type'], 'Unit' | 'Gear' | 'Program'>;
export const MAIN_TYPES: MainType[] = ['Unit', 'Gear', 'Program'];

export interface TypeSplit {
  /** Counts per type, in MAIN_TYPES order. */
  types: [MainType, number][];
  /** Known cards in the list (unknown ids are skipped). */
  total: number;
}

/** Count the Units, Gear and Programs in a list of card ids. */
export function typeSplit(main: readonly string[], byId: Record<string, Pick<CardDef, 'type'>> = CARD_BY_ID): TypeSplit {
  const n: Record<MainType, number> = { Unit: 0, Gear: 0, Program: 0 };
  let total = 0;
  for (const id of main) {
    const t = byId[id]?.type;
    if (!t) continue;
    total++;
    if (t in n) n[t as MainType]++;
  }
  return { types: MAIN_TYPES.map((t) => [t, n[t]]), total };
}

const PLURAL: Record<MainType, string> = { Unit: 'Units', Gear: 'Gear', Program: 'Programs' };

/** "24 Units, 9 Gear, 7 Programs" */
export function typeSplitText(s: TypeSplit): string {
  return s.types.map(([t, c]) => `${c} ${c === 1 ? t : PLURAL[t]}`).join(', ');
}
