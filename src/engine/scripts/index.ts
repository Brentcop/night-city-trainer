import type { CardScript } from '../types';
import { RED } from './red';
import { BLUE } from './blue';
import { GREEN } from './green';
import { YELLOW } from './yellow';

/** Card scripts keyed by card id (see src/data/cards.json). */
export const SCRIPTS: Record<string, CardScript> = { ...RED, ...BLUE, ...GREEN, ...YELLOW };
