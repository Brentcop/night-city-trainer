// A ledger entry (src/lib/runLedger.ts) from a finished tournament run, and the storage steps that take runs in: the
// runner records each finished run (`recordRun`), and the finished runs already saved in `nct.runs.v1` before the ledger
// existed are folded in once each (`foldSavedRuns`, `migrateSavedRuns`; that key is only read, never written).
//
// The games are the ones the recorded ratings read (`eventRatedGames`, src/lib/ratingGames.ts): every played game of
// every round and bracket match; a copy "X #2" plays as X and its games against X are left out; a tie is half a win.
// Then each deck is its list fingerprint, and a game between two entrants with the same list (a renamed copy against
// the original) counts for neither. Not in the entry chunk: deck tiles read the ledger, they never build entries.
import { listFingerprint } from '../engine/deck';
import { entrantBase } from './eventFormats';
import { eventRatedGames, type GamesEvent } from './ratingGames';
import { addRun, loadLedger, saveLedger, type Ledger, type LedgerGame, type LedgerRun } from './runLedger';

/** The runner's saved runs (src/ui/pages/TournamentRunner.tsx): read here, never written. */
export const SAVED_RUNS_KEY = 'nct.runs.v1';

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const strings = (x: unknown): x is string[] => Array.isArray(x) && x.every((s) => typeof s === 'string');

/** The matches of a round or bracket part, keeping only well-formed games. */
function cleanParts(x: unknown): GamesEvent['rounds'] {
  if (!Array.isArray(x)) return [];
  return x.filter(isObj).map((part) => ({
    matches: (Array.isArray(part.matches) ? part.matches : []).filter(isObj).flatMap((m) => {
      if (typeof m.a !== 'string' || (m.b !== null && typeof m.b !== 'string')) return [];
      const games = (Array.isArray(m.games) ? m.games : []).filter(
        (g): g is { first: 0 | 1; winner: 0 | 1 | 'tie' } => isObj(g) && (g.first === 0 || g.first === 1) && (g.winner === 0 || g.winner === 1 || g.winner === 'tie'),
      );
      return [{ a: m.a, b: m.b as string | null, games: games.map((g) => ({ first: g.first, winner: g.winner })) }];
    }),
  }));
}

/**
 * The ledger entry of a finished run (`phase: 'done'`), or null: a stopped or unfinished run, or something that is not a
 * run. Reads a TourneyEvent (src/lib/tournament.ts) defensively, so a malformed saved run is skipped, never thrown on.
 */
export function ledgerRunOf(ev: unknown): LedgerRun | null {
  if (!isObj(ev) || ev.phase !== 'done') return null;
  if ((typeof ev.id !== 'string' && typeof ev.id !== 'number') || typeof ev.date !== 'string' || Number.isNaN(Date.parse(ev.date)) || !isObj(ev.decks)) return null;
  const setupEntrants = isObj(ev.setup) && Array.isArray(ev.setup.entrants) ? ev.setup.entrants.filter(isObj) : [];
  const entrants = setupEntrants
    .filter((e) => typeof e.name === 'string')
    .map((e) => ({ name: e.name as string, ...(typeof e.copyOf === 'string' ? { copyOf: e.copyOf } : {}) }));
  const setup = entrants.length ? { entrants } : undefined;
  const base = (name: string) => entrantBase(setup ?? null, name);
  // each base name's list: from its own entry, else from one of its copies
  const lists = new Map<string, string>();
  for (const [name, d] of Object.entries(ev.decks)) {
    if (!isObj(d) || !strings(d.legends) || !strings(d.main)) continue;
    const b = base(name);
    if (b === name || !lists.has(b)) lists.set(b, listFingerprint({ legends: d.legends, main: d.main }));
  }
  const decks: LedgerRun['decks'] = [];
  const index = new Map<string, number>();
  const at = (name: string): number | undefined => {
    const list = lists.get(name);
    if (!list) return undefined;
    let i = index.get(name);
    if (i === undefined) {
      i = decks.length;
      decks.push({ name, list });
      index.set(name, i);
    }
    return i;
  };
  for (const name of lists.keys()) at(name);
  const games: LedgerGame[] = [];
  for (const g of eventRatedGames({ ...(setup ? { setup } : {}), rounds: cleanParts(ev.rounds), bracket: cleanParts(ev.bracket) })) {
    const a = at(g.a);
    const b = at(g.b);
    if (a === undefined || b === undefined || decks[a]!.list === decks[b]!.list) continue;
    games.push([a, b, g.first, g.s === 1 ? 1 : g.s === 0 ? 0 : 0.5]);
  }
  const champ = typeof ev.champion === 'string' ? at(base(ev.champion)) : undefined;
  return {
    id: String(ev.id),
    date: ev.date,
    simVersion: typeof ev.simVersion === 'number' && Number.isInteger(ev.simVersion) ? ev.simVersion : null,
    bot: typeof ev.bot === 'string' ? ev.bot : 'unknown',
    format: typeof ev.format === 'string' ? ev.format : '',
    ...(typeof ev.name === 'string' && ev.name ? { name: ev.name } : {}),
    decks,
    games,
    champion: champ ?? null,
  };
}

/**
 * Fold the finished runs saved in `nct.runs.v1` (its raw text) into the ledger, each once: a run whose id was taken in
 * before (recorded, folded, or cleared since) is skipped. A finished run that cannot be read is remembered as taken in,
 * so it is not read again; an unfinished one is not (it is recorded when it finishes).
 */
export function foldSavedRuns(l: Ledger, savedText: string | null): { ledger: Ledger; added: number; changed: boolean } {
  let saved: unknown;
  try {
    saved = JSON.parse(savedText ?? '[]');
  } catch {
    saved = [];
  }
  if (!Array.isArray(saved)) return { ledger: l, added: 0, changed: false };
  let ledger = l;
  let added = 0;
  let changed = false;
  // oldest first, so the ledger ends up newest first as if each had been recorded when it finished
  for (const ev of [...saved].reverse()) {
    if (!isObj(ev) || ev.phase !== 'done' || (typeof ev.id !== 'string' && typeof ev.id !== 'number')) continue;
    const id = String(ev.id);
    if (ledger.folded.includes(id)) continue;
    const run = ledgerRunOf(ev);
    if (run) {
      ledger = addRun(ledger, run);
      added++;
    } else ledger = { ...ledger, folded: [id, ...ledger.folded] };
    changed = true;
  }
  return { ledger, added, changed };
}

/** Read the saved runs' text (null when there are none or storage is blocked). */
function savedRunsText(): string | null {
  try {
    return localStorage.getItem(SAVED_RUNS_KEY);
  } catch {
    return null;
  }
}

/** Fold the saved runs into the stored ledger once each. Returns false only when a needed write was refused. */
export function migrateSavedRuns(): boolean {
  const text = savedRunsText();
  if (!text) return true;
  const { ledger, changed } = foldSavedRuns(loadLedger(), text);
  return changed ? saveLedger(ledger) : true;
}

/**
 * Add a finished run to the stored ledger (replacing an earlier copy of the same run). 'skipped' for a run that did not
 * finish; 'refused' when the browser would not store it (the run itself is still saved with the runner's runs).
 */
export function recordRun(ev: unknown): 'saved' | 'skipped' | 'refused' {
  const run = ledgerRunOf(ev);
  if (!run) return 'skipped';
  // take in the older saved runs first, so they keep their place behind this one
  const folded = foldSavedRuns(loadLedger(), savedRunsText()).ledger;
  return saveLedger(addRun(folded, run)) ? 'saved' : 'refused';
}
