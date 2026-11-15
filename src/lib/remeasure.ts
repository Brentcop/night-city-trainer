// Re-measurements of deck changes (docs/EVIDENCE.md "Re-measurements"): a tracked input under data/evidence/ that
// scripts/build-evidence.ts turns into change findings. Each row is one paired measurement of one change: the list
// before and after by fingerprint, the cards cut and added by id, the bot and simulator version, the games, the mean
// per-game difference (after minus before) and its standard error, optionally per opponent and per seat, the date and
// the script that produced it. Append a row (or add a file) for every new measurement; never edit an old one.
//
// Pure, Node and browser: parseRemeasureFile reads a file's parsed JSON strictly and returns the problems in words.
export const REMEASURE_KIND = 'nct-remeasure';
export const REMEASURE_SCHEMA = 1;

export interface RemeasureGroup {
  /** an opponent by deck name (or list fingerprint), or a seat */
  opp?: string;
  oppListId?: string;
  first?: 0 | 1;
  games: number;
  mean: number;
  se: number;
}

export interface Remeasurement {
  /** unique within data/evidence/ */
  id: string;
  /** the library deck file the change belongs to (data/decks or data/decks/custom) */
  deck: string;
  /** the change in words */
  label: string;
  /** list fingerprints before and after the change (the paired comparison is after minus before) */
  baseListId: string;
  candListId: string;
  /** main-deck and Legend cards cut and added, by card id, with repeats */
  cuts: string[];
  adds: string[];
  legendCuts?: string[];
  legendAdds?: string[];
  /** the bot as the script named it (e.g. "lookahead" is Medium) and the simulator version it ran under */
  bot: string;
  simVersion: number;
  /** paired games, mean difference (a fraction: 0.01 = one point), its standard error and the per-game SD */
  games: number;
  mean: number;
  se: number;
  sd?: number;
  byOpp?: RemeasureGroup[];
  bySeat?: RemeasureGroup[];
  /**
   * the field's list fingerprints (the opponents played), for the field fingerprint when there are no per-opponent rows:
   * with them a measurement shares its question with the ledger entries of the same change
   */
  opponents?: string[];
  /** YYYY-MM-DD */
  date: string;
  /** the script that produced it, from the repository root */
  script: string;
  /** what earlier record it re-measures, in words (optional) */
  record?: string;
}

export interface RemeasureFile {
  kind: typeof REMEASURE_KIND;
  schema: 1;
  note?: string;
  measurements: Remeasurement[];
}

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const FP = /^[0-9a-f]{16}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ID = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const CARD = /^[a-z0-9_]+$/;
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const str = (x: unknown, max = 500): x is string => typeof x === 'string' && x.length > 0 && x.length <= max;

function groupProblems(g: unknown, where: string, seat: boolean): string[] {
  if (!isObj(g)) return [`${where} is not an object`];
  const out: string[] = [];
  if (seat ? g.first !== 0 && g.first !== 1 : !str(g.opp, 200) && !(typeof g.oppListId === 'string' && FP.test(g.oppListId))) out.push(`${where} names no ${seat ? 'seat (first: 0 or 1)' : 'opponent (opp or oppListId)'}`);
  if (!(Number.isInteger(g.games) && (g.games as number) > 0)) out.push(`${where}.games must be a whole number above 0`);
  if (!num(g.mean) || Math.abs(g.mean) > 1) out.push(`${where}.mean must be a number from -1 to 1`);
  if (!num(g.se) || g.se < 0) out.push(`${where}.se must be a number of 0 or more`);
  return out;
}

/** Problems with one re-measurement row (empty when it reads). */
export function remeasureProblems(x: unknown, where: string): string[] {
  if (!isObj(x)) return [`${where} is not an object`];
  const out: string[] = [];
  if (!(typeof x.id === 'string' && ID.test(x.id))) out.push(`${where}.id must be lower-case letters, digits, dots, dashes or underscores`);
  if (!(str(x.deck, 200) && /\.txt$/.test(x.deck) && !x.deck.includes('..'))) out.push(`${where}.deck must be a deck file name (.txt)`);
  if (!str(x.label)) out.push(`${where}.label is missing`);
  for (const k of ['baseListId', 'candListId'] as const) if (!(typeof x[k] === 'string' && FP.test(x[k] as string))) out.push(`${where}.${k} must be a list fingerprint (16 hex digits)`);
  for (const k of ['cuts', 'adds', 'legendCuts', 'legendAdds'] as const) {
    const v = x[k];
    if (v === undefined && (k === 'legendCuts' || k === 'legendAdds')) continue;
    if (!Array.isArray(v) || !v.every((c) => typeof c === 'string' && CARD.test(c))) out.push(`${where}.${k} must be a list of card ids`);
  }
  if (Array.isArray(x.cuts) && Array.isArray(x.adds) && !x.cuts.length && !x.adds.length && !(x.legendCuts as unknown[] | undefined)?.length && !(x.legendAdds as unknown[] | undefined)?.length) out.push(`${where} changes no card`);
  if (!(typeof x.bot === 'string' && /^[a-z0-9-]{1,32}$/.test(x.bot))) out.push(`${where}.bot is missing`);
  if (!(Number.isInteger(x.simVersion) && (x.simVersion as number) >= 1)) out.push(`${where}.simVersion must be a whole number of 1 or more`);
  if (!(Number.isInteger(x.games) && (x.games as number) >= 2)) out.push(`${where}.games must be a whole number of 2 or more`);
  if (!num(x.mean) || Math.abs(x.mean) > 1) out.push(`${where}.mean must be a number from -1 to 1`);
  if (!num(x.se) || x.se <= 0) out.push(`${where}.se must be a number above 0`);
  if (x.sd !== undefined && !(num(x.sd) && x.sd >= 0)) out.push(`${where}.sd must be a number of 0 or more`);
  if (!(typeof x.date === 'string' && DATE.test(x.date))) out.push(`${where}.date must be YYYY-MM-DD`);
  if (!(str(x.script, 300) && !x.script.includes('..'))) out.push(`${where}.script must name the script that produced it`);
  if (x.record !== undefined && !str(x.record)) out.push(`${where}.record must be text`);
  if (x.opponents !== undefined && !(Array.isArray(x.opponents) && x.opponents.length > 0 && x.opponents.length <= 1000 && x.opponents.every((o) => typeof o === 'string' && FP.test(o)))) out.push(`${where}.opponents must be a non-empty list of list fingerprints`);
  for (const [k, seat] of [['byOpp', false], ['bySeat', true]] as const) {
    const v = x[k];
    if (v === undefined) continue;
    if (!Array.isArray(v)) out.push(`${where}.${k} must be a list`);
    else v.forEach((g, i) => out.push(...groupProblems(g, `${where}.${k}[${i}]`, seat)));
  }
  return out;
}

/** A parsed data/evidence/*.json file read strictly: the rows, or the problems in words. */
export function parseRemeasureFile(x: unknown, file: string): { file: RemeasureFile; problems: [] } | { file?: undefined; problems: string[] } {
  if (!isObj(x) || x.kind !== REMEASURE_KIND) return { problems: [`${file}: not a re-measurement file (kind "${REMEASURE_KIND}")`] };
  if (x.schema !== REMEASURE_SCHEMA) return { problems: [`${file}: schema ${JSON.stringify(x.schema)} is not one this code reads (${REMEASURE_SCHEMA})`] };
  if (!Array.isArray(x.measurements)) return { problems: [`${file}: no measurements list`] };
  const problems: string[] = [];
  x.measurements.forEach((m, i) => problems.push(...remeasureProblems(m, `${file}: measurements[${i}]`)));
  const ids = (x.measurements as { id?: unknown }[]).map((m) => m?.id);
  ids.forEach((id, i) => {
    if (ids.indexOf(id) !== i) problems.push(`${file}: the id ${String(id)} is used twice`);
  });
  return problems.length ? { problems } : { file: x as unknown as RemeasureFile, problems: [] };
}
