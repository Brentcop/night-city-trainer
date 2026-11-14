// Your tournaments: a compact ledger of the finished tournaments run in this browser (the runner, #/run), so they count
// toward what this visitor's deck tiles and deck pages show: a record per list and, for a list with no recorded rating,
// a provisional rating (src/lib/yourStats.ts, src/lib/anchoredRating.ts). Kept apart from the recorded results, in this
// browser only; nothing leaves it. This module is small on purpose (deck tiles are in the entry chunk): the document,
// its defensive reader, the add / replace / cap rules, the record per list, and the storage helpers. Building an entry
// from a finished event is src/lib/runLedgerEntry.ts.
//
//   - One entry per finished run (phase 'done'), keyed by the run's id: adding a run again replaces it.
//   - Decks are identified by list fingerprint (listFingerprint in src/engine/deck.ts), never by name: a renamed copy
//     shares its record, an edited list starts afresh.
//   - Only entries recorded on the current simulator (`CURRENT_SIM_VERSION`) count; older ones are kept, not counted.
//   - `folded` remembers every run id already taken in (recorded here, or folded in from the saved runs `nct.runs.v1`),
//     so a run is taken in once, and clearing the ledger does not bring the saved runs back.
//   - Size: at most LEDGER_MAX_RUNS runs and LEDGER_MAX_CHARS characters of JSON, oldest runs dropped first (see below).
import { CURRENT_SIM_VERSION } from './playedRecord';

export const LEDGER_KEY = 'nct.yourTournaments.v1';
export const LEDGER_KIND = 'nct-tournament-ledger';
/** Fired (on window) after this tab changes the ledger; other tabs see the `storage` event (src/ui/useYourStats.ts). */
export const LEDGER_CHANGED = 'nct:ledger-changed';

/**
 * The cap. A recorded event of 47 decks (Swiss and a top 8, about 530 games) takes about 9,200 characters here (a game
 * is four numbers, about 16 characters; measured on events 8 and 14), so 500,000 characters hold some fifty events of
 * that size: about a tenth of the 5 MB a browser usually gives a site, leaving the rest for saved games and decks. 100
 * runs is more than anyone runs by hand and keeps the work per page view small. The oldest runs go first.
 */
export const LEDGER_MAX_RUNS = 100;
export const LEDGER_MAX_CHARS = 500_000;
/** Run ids remembered as taken in (only the runner's last 6 saved runs can come back, so a few hundred is plenty). */
export const LEDGER_MAX_FOLDED = 300;

/** One game: deck a, deck b (indices into the run's decks), who went first (0 = a), a's score (1, ½ for a tie, 0). */
export type LedgerGame = [a: number, b: number, first: 0 | 1, s: 0 | 0.5 | 1];

export interface LedgerRun {
  /** the run's id (as a string) */
  id: string;
  /** when it finished (ISO) */
  date: string;
  /** SIM_VERSION it ran on (null: unknown, never counted) */
  simVersion: number | null;
  /** the bots: 'hard', 'mixed', 'medium', 'easy' (the runner's choices) */
  bot: string;
  /** the event's format text, e.g. "Swiss + top 8 · Bo3" */
  format: string;
  name?: string;
  /** the decks as they played (copies "X #2" play as X): name, and list fingerprint */
  decks: { name: string; list: string }[];
  /** every rated game (src/lib/ratingGames.ts): games between two copies of one list are left out */
  games: LedgerGame[];
  /** the champion (index into decks), if the run crowned one */
  champion: number | null;
}

export interface Ledger {
  kind: typeof LEDGER_KIND;
  schema: 1;
  /** newest first */
  runs: LedgerRun[];
  /** ids of runs already taken in (recorded, or folded in from nct.runs.v1) */
  folded: string[];
}

export const emptyLedger = (): Ledger => ({ kind: LEDGER_KIND, schema: 1, runs: [], folded: [] });

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const str = (x: unknown, max: number): string | null => (typeof x === 'string' && x.length <= max ? x : null);
const FP = /^[0-9a-z]{1,32}$/;

/** A stored run, checked field by field; null when it is not one. */
export function parseRun(x: unknown): LedgerRun | null {
  if (!isObj(x)) return null;
  const id = str(x.id, 200);
  const date = str(x.date, 40);
  const bot = str(x.bot, 40);
  const format = str(x.format, 200);
  if (!id || !date || Number.isNaN(Date.parse(date)) || !bot || format === null || !Array.isArray(x.decks) || !Array.isArray(x.games)) return null;
  const simVersion = typeof x.simVersion === 'number' && Number.isInteger(x.simVersion) && x.simVersion >= 0 ? x.simVersion : null;
  const decks: LedgerRun['decks'] = [];
  for (const d of x.decks) {
    const name = isObj(d) ? str(d.name, 300) : null;
    const list = isObj(d) ? str(d.list, 32) : null;
    if (name === null || !list || !FP.test(list)) return null;
    decks.push({ name, list });
  }
  const n = decks.length;
  const games: LedgerGame[] = [];
  for (const g of x.games) {
    if (!Array.isArray(g) || g.length !== 4) return null;
    const [a, b, first, s] = g as unknown[];
    if (!Number.isInteger(a) || !Number.isInteger(b) || (a as number) < 0 || (b as number) < 0 || (a as number) >= n || (b as number) >= n || a === b) return null;
    if ((first !== 0 && first !== 1) || (s !== 0 && s !== 0.5 && s !== 1)) return null;
    games.push([a as number, b as number, first, s]);
  }
  const champion = Number.isInteger(x.champion) && (x.champion as number) >= 0 && (x.champion as number) < n ? (x.champion as number) : null;
  const name = str(x.name, 300);
  return { id, date, simVersion, bot, format, ...(name ? { name } : {}), decks, games, champion };
}

/** The stored ledger: malformed runs are dropped, anything that is not a ledger reads as an empty one. Never throws. */
export function parseLedger(raw: string | null | undefined): Ledger {
  if (!raw) return emptyLedger();
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return emptyLedger();
  }
  if (!isObj(v) || v.kind !== LEDGER_KIND || v.schema !== 1) return emptyLedger();
  const runs = (Array.isArray(v.runs) ? v.runs : []).map(parseRun).filter((r): r is LedgerRun => r !== null);
  const seen = new Set<string>();
  const unique = runs.filter((r) => !seen.has(r.id) && (seen.add(r.id), true));
  const folded = (Array.isArray(v.folded) ? v.folded : []).filter((f): f is string => typeof f === 'string' && f.length <= 200).slice(0, LEDGER_MAX_FOLDED);
  return { kind: LEDGER_KIND, schema: 1, runs: unique, folded };
}

/** Drop the oldest runs until the ledger fits LEDGER_MAX_RUNS and LEDGER_MAX_CHARS (a lone run larger than that is dropped too). */
export function capLedger(l: Ledger, o: { maxRuns?: number; maxChars?: number } = {}): Ledger {
  const maxRuns = o.maxRuns ?? LEDGER_MAX_RUNS;
  const maxChars = o.maxChars ?? LEDGER_MAX_CHARS;
  let runs = l.runs.slice(0, maxRuns);
  const size = (rs: LedgerRun[]) => JSON.stringify({ ...l, runs: rs }).length;
  while (runs.length && size(runs) > maxChars) runs = runs.slice(0, -1);
  return { ...l, runs, folded: l.folded.slice(0, LEDGER_MAX_FOLDED) };
}

/** Add a run; a run with the same id is replaced. Runs stay newest first (by date). Remembered as taken in. Capped. */
export function addRun(l: Ledger, run: LedgerRun, o?: { maxRuns?: number; maxChars?: number }): Ledger {
  const folded = [run.id, ...l.folded.filter((f) => f !== run.id)];
  const runs = [run, ...l.runs.filter((r) => r.id !== run.id)].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  return capLedger({ ...l, runs, folded }, o);
}

/** Every run removed; the ids taken in are kept, so the saved runs are not folded in again. */
export const clearedLedger = (l: Ledger): Ledger => ({ ...emptyLedger(), folded: [...l.folded] });

/** The runs that count (recorded on `simVersion`), and how many are kept but left out (another simulator). */
export function countedRuns(l: Ledger, simVersion = CURRENT_SIM_VERSION): { counted: LedgerRun[]; older: number } {
  const counted = l.runs.filter((r) => r.simVersion === simVersion);
  return { counted, older: l.runs.length - counted.length };
}

export interface WinLoss {
  games: number;
  wins: number;
  losses: number;
  ties: number;
}
export interface YourRecord extends WinLoss {
  list: string;
  /** (wins + ties / 2) / games */
  wr: number;
  /** by the bots that played, in the runner's order (hard, mixed, medium, easy, then anything else) */
  byBot: { bot: string; rec: WinLoss }[];
  /** your tournaments this list played in, and how many it won */
  runs: number;
  won: number;
  /** the name it played under most recently */
  name: string;
}

const BOT_ORDER = ['hard', 'mixed', 'medium', 'easy'];
/** The runner's bot choices as it names them (TOURNEY_BOTS in src/ai/tiers.ts, repeated so tiles never load the bots). */
export const BOT_LABEL: Readonly<Record<string, string>> = { hard: 'All Hard', mixed: 'Hard + Medium', medium: 'All Medium', easy: 'All Easy' };
export const winRate = (r: WinLoss): number => (r.games ? (r.wins + r.ties / 2) / r.games : 0);

/** Every list's record over the counted runs (current simulator), by list fingerprint. */
export function yourRecords(l: Ledger, simVersion = CURRENT_SIM_VERSION): Map<string, YourRecord> {
  const out = new Map<string, YourRecord & { bots: Map<string, WinLoss> }>();
  const get = (list: string, name: string) => {
    let r = out.get(list);
    if (!r) out.set(list, (r = { list, games: 0, wins: 0, losses: 0, ties: 0, wr: 0, byBot: [], bots: new Map(), runs: 0, won: 0, name }));
    return r;
  };
  // runs are newest first, so the first name seen is the latest
  for (const run of countedRuns(l, simVersion).counted) {
    const lists = new Set(run.decks.map((d) => d.list));
    for (const d of run.decks) get(d.list, d.name);
    for (const list of lists) get(list, '').runs++;
    const champ = run.champion === null ? undefined : run.decks[run.champion];
    if (champ) get(champ.list, champ.name).won++;
    for (const [a, b, , s] of run.games) {
      const da = run.decks[a];
      const db = run.decks[b];
      if (!da || !db || da.list === db.list) continue;
      for (const [d, score] of [
        [da, s],
        [db, 1 - s],
      ] as const) {
        const r = get(d.list, d.name);
        let bb = r.bots.get(run.bot);
        if (!bb) r.bots.set(run.bot, (bb = { games: 0, wins: 0, losses: 0, ties: 0 }));
        for (const t of [r, bb]) {
          t.games++;
          if (score === 1) t.wins++;
          else if (score === 0) t.losses++;
          else t.ties++;
        }
      }
    }
  }
  const rank = (b: string) => (BOT_ORDER.includes(b) ? BOT_ORDER.indexOf(b) : BOT_ORDER.length);
  const res = new Map<string, YourRecord>();
  for (const [list, { bots, ...r }] of out)
    res.set(list, { ...r, wr: winRate(r), byBot: [...bots].sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)).map(([bot, rec]) => ({ bot, rec })) });
  return res;
}

/** What counts, in one line's numbers: tournaments and games counted, of them with All Hard bots, and runs left out. */
export function ledgerSummary(l: Ledger, simVersion = CURRENT_SIM_VERSION): { runs: number; games: number; hardRuns: number; hardGames: number; older: number } {
  const { counted, older } = countedRuns(l, simVersion);
  const hard = counted.filter((r) => r.bot === 'hard');
  const games = (rs: LedgerRun[]) => rs.reduce((s, r) => s + r.games.filter(([a, b]) => r.decks[a]?.list !== r.decks[b]?.list).length, 0);
  return { runs: counted.length, games: games(counted), hardRuns: hard.length, hardGames: games(hard), older };
}

// ---------------------------------------------------------------- storage (this browser)

/** The stored text (null when there is none or storage is blocked). */
export function readLedgerText(): string | null {
  try {
    return localStorage.getItem(LEDGER_KEY);
  } catch {
    return null;
  }
}

export const loadLedger = (): Ledger => parseLedger(readLedgerText());

export function notifyLedgerChanged() {
  try {
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof Event === 'function') window.dispatchEvent(new Event(LEDGER_CHANGED));
  } catch {
    /* no window (tests, scripts) */
  }
}

/** Store the ledger. Returns false when the browser refused (storage blocked or full); nothing else is touched. */
export function saveLedger(l: Ledger): boolean {
  try {
    localStorage.setItem(LEDGER_KEY, JSON.stringify(capLedger(l)));
  } catch {
    return false;
  }
  notifyLedgerChanged();
  return true;
}

/** Clear your tournaments (the runs; the ids taken in stay). Returns false when the browser refused. */
export const clearLedger = (): boolean => saveLedger(clearedLedger(loadLedger()));
