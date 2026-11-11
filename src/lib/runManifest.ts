import { CARDS } from '../engine/cards';
import { fingerprintText } from '../engine/deck';

export interface RunManifest {
  schema: 1;
  runId: string;
  createdAt: string;
  purpose: 'analysis' | 'matchup' | 'tuning' | 'forge' | 'season' | 'tournament' | 'browser';
  simVersion: number;
  rulesVersion: string | null;
  faqVersion: string | null;
  cardDataVersion: string;
  bot: { level: string; configHash?: string };
  decks: { id: string; name: string; file?: string }[];
  field: { mode: string; deckIds: string[]; weights?: Record<string, number> };
  sample: { plannedGames: number; completedGames: number; gamesPerPair: number | null };
  seedBase: number;
  seatPolicy: 'alternate' | 'seeded' | 'loser-starts';
  trace: boolean;
  parentRunId?: string;
}

export type RunManifestInput = Omit<RunManifest, 'schema' | 'cardDataVersion'>;

const cardDataVersion = `fnv1a64:${fingerprintText(JSON.stringify([...CARDS].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))))}`;

export function createRunManifest(input: RunManifestInput): RunManifest {
  return { schema: 1, ...input, cardDataVersion };
}
