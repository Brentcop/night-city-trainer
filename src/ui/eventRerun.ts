// "Run this event again" on the Tournaments page: what a re-run of a recorded event in the runner (#/run) would be.
// The runner reproduces an event from its setup link (same code + same seed + same setup = same event), so this says
// whether the event can be opened as a setup link at all, the link's query, and whether a run from it plays the same
// games as the record, with the reasons when it does not. Pure: the page passes the library and the current version.
import type { LibraryDeck } from '../lib/library';
import { runnerPool } from '../lib/eventDraft';
import { runParamsQuery } from './runParams';

/** The parts of a recorded event file (public/tournaments/event-N.json) a re-run reads. */
export interface RecordedEvent {
  config?: { rounds: number; top: number; bestOf: number; bot: string; seed: number };
  simVersion?: number;
  decks: Record<string, { file?: string; legends: string[]; main: string[] }>;
  manifest?: { decks?: { file?: string; name: string }[] };
  /** set for an event in another format or arranged by hand */
  setup?: unknown;
}

/** Why an event cannot be opened as a setup link. */
export type RerunClosed =
  | 'no-config' // recorded before events kept their settings
  | 'arranged' // another format, pairings or seeds set by hand, or series rules: the link carries none of them
  | 'missing-deck' // a recorded deck is no longer in the runner's library under its file
  | 'bot' // a bot the runner does not offer
  | 'settings'; // rounds, top cut, best-of, seed or a deck entered twice: something the link cannot carry

export type Rerun =
  | { open: false; why: RerunClosed }
  | {
      open: true;
      /** the setup link's query (after `#/run?`) */
      query: string;
      /** a run plays the same games as the record */
      same: boolean;
      /** the event was recorded on another version of the bots (its version, or null when it has none) */
      otherVersion: number | null | false;
      /** decks whose list or name in the library differs from the record */
      changed: number;
    };

const SEED_MAX = 2 ** 31 - 1;
const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);

/**
 * What a re-run of a recorded event would be. `lib` is the whole library (the runner's own pool rule is applied here),
 * `bots` the bot keys the runner offers, `simVersion` the current simulator version.
 */
export function eventRerun(ev: RecordedEvent, lib: readonly LibraryDeck[], o: { bots: readonly string[]; simVersion: number }): Rerun {
  const cfg = ev.config;
  if (!cfg) return { open: false, why: 'no-config' };
  if (ev.setup) return { open: false, why: 'arranged' };
  // entrants in their recorded order: the manifest's, else the order the decks were written in
  const order = ev.manifest?.decks?.length ? ev.manifest.decks.map((d) => ({ name: d.name, file: d.file ?? ev.decks[d.name]?.file })) : Object.keys(ev.decks).map((name) => ({ name, file: ev.decks[name]?.file }));
  const pool = new Map(runnerPool(lib).map((d) => [d.file, d]));
  const files: string[] = [];
  let changed = 0;
  for (const { name, file } of order) {
    const rec = ev.decks[name];
    const d = file ? pool.get(file) : undefined;
    if (!rec || !file || !d) return { open: false, why: 'missing-deck' };
    // a second copy would be a different event (keyed seeds), and a file the link would misread cannot be carried
    if (files.includes(file) || file.includes(',') || /\*\d+$/.test(file)) return { open: false, why: 'settings' };
    files.push(file);
    // names matter too: the standings break their last tie by name
    if (d.deck.name !== name || !sameList(d.deck.legends, rec.legends) || !sameList(d.deck.main, rec.main)) changed++;
  }
  if (!o.bots.includes(cfg.bot)) return { open: false, why: 'bot' };
  const int = (x: number, min: number, max: number) => Number.isInteger(x) && x >= min && x <= max;
  if (!int(cfg.rounds, 1, 12) || ![0, 4, 8, 16].includes(cfg.top) || !(cfg.bestOf === 1 || cfg.bestOf === 3 || cfg.bestOf === 5) || !int(cfg.seed, 1, SEED_MAX) || files.length < 2)
    return { open: false, why: 'settings' };
  const query = runParamsQuery({ field: 'custom', decks: files, format: 'swiss', rounds: cfg.rounds, top: cfg.top, bestOf: cfg.bestOf, bot: cfg.bot, seed: cfg.seed }).toString();
  const otherVersion = ev.simVersion === o.simVersion ? false : (ev.simVersion ?? null);
  return { open: true, query, same: otherVersion === false && changed === 0, otherVersion, changed };
}

/** The muted line beside the button; `simVersion` is the current simulator version. */
export function rerunNote(r: Extract<Rerun, { open: true }>, simVersion: number): string {
  const opens = 'Opens the tournament runner with this event’s decks, settings and seed';
  if (r.same) return `${opens}: the run plays the same games as recorded here, stays in this browser and changes nothing recorded.`;
  const why: string[] = [];
  if (r.otherVersion !== false)
    why.push(r.otherVersion === null ? 'the event was recorded before events noted their simulator version' : `the event was recorded on simulator v${r.otherVersion}, and this site runs v${simVersion}`);
  if (r.changed > 0) why.push(`${r.changed} of its ${r.changed === 1 ? 'decks has' : 'decks have'} changed since`);
  return `${opens}. The run stays in this browser and changes nothing recorded, but its games will differ from these: ${why.join('; ')}.`;
}
