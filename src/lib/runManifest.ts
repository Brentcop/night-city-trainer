// Run manifests: what a result was measured on (deck lists by fingerprint, simulator/bot version, field, seeds, seats,
// sample size), attached to every result file the scripts and the browser labs write. docs/ROADMAP.md §4 step 2.
import { CARDS } from '../engine/cards';
import { deckFingerprint, fingerprintText } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { RULES_VERSIONS } from './rulesVersions';
import type { PackageProvenance } from './deckPackages';

/**
 * What an aggregate (ratings, head-to-heads) was built from. Aggregates play no games: they pool recorded events, so
 * the manifest lists those events and makes a mix of simulator versions visible instead of hiding it.
 */
export interface RunInputs {
  kind: 'recorded-events';
  /** every input event in id order; simVersion/runId are null when the event predates them */
  events: { id: number | string; simVersion: number | null; runId: string | null }[];
  /** distinct input sim versions, ascending; null stands for events recorded before simVersion existed */
  simVersions: (number | null)[];
  /** true when the inputs span more than one sim version (events without one count as their own version) */
  mixedSimVersions: boolean;
}

/**
 * Schema 1. Fields added after the first manifests were written are optional, so every manifest already on disk still
 * reads as schema 1: `errataVersion` (absent = not recorded), `inputs` (aggregates only), `decisionTelemetry`, `packages`,
 * and the purposes 'optimize' and 'aggregate'.
 */
export interface RunManifest {
  schema: 1;
  runId: string;
  createdAt: string;
  purpose: 'analysis' | 'matchup' | 'tuning' | 'forge' | 'optimize' | 'season' | 'tournament' | 'browser' | 'aggregate';
  /** SIM_VERSION of the code that played the games. For an aggregate: the lowest input version, 0 if any input has none. */
  simVersion: number;
  rulesVersion: string | null;
  faqVersion: string | null;
  errataVersion?: string | null;
  cardDataVersion: string;
  bot: { level: string; configHash?: string };
  decks: { id: string; name: string; file?: string }[];
  field: { mode: string; deckIds: string[]; weights?: Record<string, number> };
  sample: { plannedGames: number; completedGames: number; gamesPerPair: number | null };
  seedBase: number;
  seatPolicy: 'alternate' | 'seeded' | 'loser-starts';
  trace: boolean;
  /** schema of the decision telemetry the run recorded (DECISION_TELEMETRY_SCHEMA, src/engine/telemetry.ts); absent = none */
  decisionTelemetry?: number;
  parentRunId?: string;
  inputs?: RunInputs;
  /** a deck builder's synergy-package plan, seeds and package moves (src/lib/deckPackages.ts); absent = none were used */
  packages?: PackageProvenance;
}

/** Manifest schemas this code can read (scripts/check-data.ts rejects anything else). */
export const KNOWN_MANIFEST_SCHEMAS: readonly number[] = [1];

/** Writers must state the errata version (null until it is known); readers treat it as optional. */
export type RunManifestInput = Omit<RunManifest, 'schema' | 'cardDataVersion' | 'errataVersion'> & { errataVersion: string | null };

// computed on first use: hashing the whole card list takes a moment, and pages that import this module may never need it
let cardDataVersion: string | undefined;
const cardData = () => (cardDataVersion ??= `fnv1a64:${fingerprintText(JSON.stringify([...CARDS].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))))}`);

export function createRunManifest(input: RunManifestInput): RunManifest {
  return { schema: 1, ...input, cardDataVersion: cardData() };
}

/** A deck as a run sees it: a library entry (`{ deck, file, deckId }`) or a bare list (optionally with its file). */
export type RunDeck = { deck: DeckList; file?: string; deckId?: string } | (Pick<DeckList, 'name' | 'legends' | 'main'> & { sideboard?: string[]; file?: string });

/** The manifest record of a deck: its fingerprint (the library deckId when known), name and file. */
export function manifestDeck(d: RunDeck): RunManifest['decks'][number] {
  if ('deck' in d) return { id: d.deckId ?? deckFingerprint(d.deck), name: d.deck.name, file: d.file };
  return { id: deckFingerprint({ legends: d.legends, main: d.main, sideboard: d.sideboard ?? [] }), name: d.name, file: d.file };
}

export interface GameRunOptions {
  purpose: RunManifest['purpose'];
  /** every deck the run played (the deck under test first, when there is one) */
  decks: RunDeck[];
  /** how the field was chosen (e.g. 'meta', 'head-to-head', 'season-6') */
  fieldMode: string;
  /** the field's deck ids, when they are not simply every deck in `decks` */
  fieldDeckIds?: string[];
  bot: string;
  botConfigHash?: string;
  seedBase: number;
  seatPolicy: RunManifest['seatPolicy'];
  plannedGames: number;
  /** defaults to plannedGames */
  completedGames?: number;
  gamesPerPair: number | null;
  trace?: boolean;
  /** the decision telemetry schema, when the run recorded decisions */
  decisionTelemetry?: number;
  simVersion: number;
  /** defaults to now */
  createdAt?: string;
  /** defaults to `<purpose>:<createdAt>:<seedBase>` */
  runId?: string;
  parentRunId?: string;
  /** the synergy-package plan the run built under (only when one was used) */
  packages?: PackageProvenance;
}

/**
 * Manifest for a run that plays games (CLI scripts and the browser labs). The rules, FAQ and errata versions are the
 * ones the engine is checked against (src/lib/rulesVersions.ts; errata stays null until the errata page carries a date).
 */
export function gameRunManifest(o: GameRunOptions): RunManifest {
  const createdAt = o.createdAt ?? new Date().toISOString();
  const decks = o.decks.map(manifestDeck);
  return createRunManifest({
    runId: o.runId ?? `${o.purpose}:${createdAt}:${o.seedBase}`,
    createdAt,
    purpose: o.purpose,
    simVersion: o.simVersion,
    ...RULES_VERSIONS,
    bot: o.botConfigHash ? { level: o.bot, configHash: o.botConfigHash } : { level: o.bot },
    decks,
    field: { mode: o.fieldMode, deckIds: o.fieldDeckIds ?? decks.map((d) => d.id) },
    sample: { plannedGames: o.plannedGames, completedGames: o.completedGames ?? o.plannedGames, gamesPerPair: o.gamesPerPair },
    seedBase: o.seedBase,
    seatPolicy: o.seatPolicy,
    trace: o.trace ?? false,
    ...(o.decisionTelemetry !== undefined ? { decisionTelemetry: o.decisionTelemetry } : {}),
    ...(o.parentRunId ? { parentRunId: o.parentRunId } : {}),
    ...(o.packages ? { packages: o.packages } : {}),
  });
}

/** The parts of a recorded tournament event an aggregate manifest reads (public/tournaments/event-N.json). */
export interface RecordedEventInput {
  id: number | string;
  date?: string;
  bot?: string;
  simVersion?: number;
  manifest?: { runId?: string };
  decks: Record<string, { id?: string; legends: string[]; main: string[]; sideboard?: string[] }>;
}

/** The fingerprint of a deck as an event stored it (its own id when it has one). */
export const storedDeckId = (d: RecordedEventInput['decks'][string]) => d.id ?? deckFingerprint({ legends: d.legends, main: d.main, sideboard: d.sideboard ?? [] });

/**
 * Manifest for a file aggregated from recorded events (scripts/ratings.ts, scripts/build-h2h.ts). It is derived only
 * from the inputs, never from the clock, so rebuilding unchanged data gives a byte-identical file:
 *   createdAt  the latest input event's date ('' with no events)
 *   runId      `aggregate:<builder>:<hash of the inputs>`
 *   simVersion the lowest input sim version, 0 when any input has none; `inputs` lists every event's version
 *   decks      every distinct (name, list) pair across the inputs, so a name that covered several lists shows up
 * Seeds and seats belong to the input events: seedBase is 0 and seatPolicy is the tournaments' 'loser-starts'.
 * Rules, FAQ and errata versions also belong to the input events (each one's own manifest), so they stay null here:
 * an aggregate can pool events played under different rules versions.
 */
export function aggregateManifest(builder: string, events: readonly RecordedEventInput[], o: { games: number }): RunManifest {
  const sorted = [...events].sort((a, b) => (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id).localeCompare(String(b.id))));
  const rows = sorted.map((e) => ({ id: e.id, simVersion: typeof e.simVersion === 'number' ? e.simVersion : null, runId: e.manifest?.runId ?? null }));
  const versions = [...new Set(rows.map((r) => r.simVersion))].sort((a, b) => (a ?? 0) - (b ?? 0));
  const inputs: RunInputs = { kind: 'recorded-events', events: rows, simVersions: versions, mixedSimVersions: versions.length > 1 };
  const seen = new Map<string, RunManifest['decks'][number]>();
  for (const e of sorted)
    for (const [name, d] of Object.entries(e.decks)) {
      const id = storedDeckId(d);
      if (!seen.has(`${name}\u0000${id}`)) seen.set(`${name}\u0000${id}`, { id, name });
    }
  const decks = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const bots = [...new Set(sorted.map((e) => e.bot ?? '?'))].sort();
  const dates = sorted.map((e) => e.date ?? '').sort();
  return createRunManifest({
    runId: `aggregate:${builder}:${fingerprintText(JSON.stringify(inputs))}`,
    createdAt: dates[dates.length - 1] ?? '',
    purpose: 'aggregate',
    simVersion: rows.length ? Math.min(...rows.map((r) => r.simVersion ?? 0)) : 0,
    rulesVersion: null,
    faqVersion: null,
    errataVersion: null,
    bot: { level: bots.join('+') },
    decks,
    field: { mode: `recorded-events:${builder}`, deckIds: [...new Set(decks.map((d) => d.id))].sort() },
    sample: { plannedGames: o.games, completedGames: o.games, gamesPerPair: null },
    seedBase: 0,
    seatPolicy: 'loser-starts',
    trace: false,
    inputs,
  });
}

/** One short line for the UI: "sim v3 · seed 10000 · 40/40 games · medium bot · decks 1a2b3c4d, 5e6f7a8b". */
export function runDetailsLine(m: RunManifest): string {
  const ids = m.decks.map((d) => d.id.slice(0, 8));
  const shown = ids.length > 6 ? [...ids.slice(0, 6), `+${ids.length - 6} more`] : ids;
  return `sim v${m.simVersion} · seed ${m.seedBase} · ${m.sample.completedGames}/${m.sample.plannedGames} games · ${m.bot.level} bot · decks ${shown.join(', ')}`;
}
