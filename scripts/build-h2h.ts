// Head-to-head records from the pooled tournament events, compacted for the website (public/data/h2h.json).
// The Deck Lab loads it lazily to breed "counter" decks, and deck profiles read their best and worst matchups from it.
// Rebuilt automatically after every tournament run (scripts/tournament.ts) and by `npm run refresh`; run directly with:
//   npx tsx scripts/build-h2h.ts [--sim-version latest|all|N] [--bot latest|all|NAME] [--loeo]
// Events are read in id order and the file is only rewritten (and "updated" only moves) when the records change.
// The manifest names the input events (ids, sim versions, run ids) and is derived from them alone, so it never moves
// on its own either.
// Which events are pooled (SIM-7): by default those with the sim version and bot of the newest recorded event; the
// flags pick another group or `all` (with a warning line). Left-out events are listed in the file's `pool` field.
// Besides the raw counts, the file carries the estimates the readers prefer (SIM-4, src/lib/h2hModel.ts): `model` (the
// power ratings fitted to the same games, the going-first term and the fitted shrinkage weight) and `shrunk` (each met
// pair's estimate: the ratings' prediction plus its own residual, shrunk). A pairing that never met gets the prediction.
// --loeo prints a leave-one-event-out check of the pair predictors (raw rate, the Lab's old 50% shrink, the ratings'
// prediction, the shrunk estimate) and writes nothing.
import fs from 'node:fs';
import { bool, cli, EVENTS_DIR, forEachGameOf, readEvents, str, writeJsonStamped } from './lib-node';
import { aggregateManifest, type RecordedEventInput, type RunManifest } from '../src/lib/runManifest';
import { checkSimVersionFlag, parsePoolFilter, poolEvents, poolRecord, selectEvents, type PoolFilter, type PoolRecord } from './event-pool';
import { h2hModelFields, leaveOneEventOut, LOEO_PREDICTORS, type H2HModelBlock } from '../src/lib/h2hModel';

export interface H2HFile {
  updated: string;
  /** events pooled (recorded events minus any listed in `pool.excluded`) */
  events: number;
  games: number;
  decks: string[];
  /** [i, j, wins of i vs j (ties = 0.5), games] for every pair that has met, i < j */
  pairs: [number, number, number, number][];
  /** the rating model behind `shrunk` (absent in files built before 2026-11-12) */
  model?: H2HModelBlock;
  /** the shrunk estimate of i beating j for each entry of `pairs`, same order (absent before 2026-11-12) */
  shrunk?: number[];
  /** events left out of the pool (SIM-7); absent when every recorded event was pooled */
  pool?: PoolRecord;
  /** absent in files built before manifests */
  manifest?: RunManifest;
}

export function buildH2H(dir = EVENTS_DIR, out = 'public/data/h2h.json', filter: PoolFilter = {}): H2HFile | null {
  if (!fs.existsSync(dir)) return null;
  const selection = selectEvents(readEvents(dir), filter);
  for (const w of selection.warnings) console.log(w);
  const events = selection.kept;
  const idx = new Map<string, number>();
  const id = (n: string) => (idx.has(n) ? idx.get(n)! : (idx.set(n, idx.size), idx.size - 1));
  const acc = new Map<string, { w: number; g: number }>();
  let games = 0;
  // every pooled event's games count, whatever its format or pairing method (custom events too); a deck entered twice
  // ("X #2") counts as X, and its games against its own copy are counted in `games` but not as a pairing
  forEachGameOf(events, ({ game: g, decks: [da, db] }) => {
    games++;
    if (da === db) return;
    const ia = id(da);
    const ib = id(db);
    const v = g.winner === 'tie' ? 0.5 : g.winner === 0 ? 1 : 0; // from seat A's side
    // store each pair once, lower index first
    const [lo, hi, w] = ia < ib ? [ia, ib, v] : [ib, ia, 1 - v];
    const k = `${lo}|${hi}`;
    const r = acc.get(k) ?? { w: 0, g: 0 };
    r.w += w;
    r.g++;
    acc.set(k, r);
  });
  const decks = [...idx.keys()];
  const pairs = [...acc.entries()].map(([k, r]) => {
    const [i, j] = k.split('|').map(Number);
    return [i, j, r.w, r.g] as [number, number, number, number];
  });
  const fitted = pairs.length ? h2hModelFields(decks, pairs, poolEvents(events).games) : null;
  const pool = poolRecord(selection);
  const data: H2HFile = {
    updated: '',
    events: events.length,
    games,
    decks,
    pairs,
    ...(fitted ? { model: fitted.model, shrunk: fitted.shrunk } : {}),
    ...(pool ? { pool } : {}),
    manifest: aggregateManifest('h2h', events as unknown as RecordedEventInput[], { games }),
  };
  writeJsonStamped(out, data as unknown as Record<string, unknown>);
  return JSON.parse(fs.readFileSync(out, 'utf8')) as H2HFile;
}

if (process.argv[1]?.endsWith('build-h2h.ts')) {
  const { values: V } = cli(import.meta.url, { 'sim-version': str('latest', checkSimVersionFlag), bot: str('latest'), loeo: bool() });
  const filter = parsePoolFilter(V);
  if (V.loeo) {
    const selection = selectEvents(readEvents(), filter);
    for (const w of selection.warnings) console.log(w);
    const per = selection.kept.map((e) => poolEvents([e]).games);
    const r = leaveOneEventOut(per, { thinMax: 3 });
    const row = (name: string, x: typeof r.all) =>
      `  ${name.padEnd(30)} ${String(x.games).padStart(5)} games  Brier ${LOEO_PREDICTORS.map((p) => `${p} ${x.brier[p].toFixed(4)}`).join(' · ')}\n${''.padEnd(45)}log loss ${LOEO_PREDICTORS.map((p) => `${p} ${x.logLoss[p].toFixed(4)}`).join(' · ')}`;
    console.log(`Leave-one-event-out over ${per.length} events (each event predicted from the others; pairs from a's side, seats averaged):`);
    console.log(row('every held-out game', r.all));
    console.log(row('pair met 1-3 times before', r.thin));
    console.log(row('pair never met before', r.unmet));
    console.log(`  fitted prior weight per fold (games): ${r.priorGames.map((x) => x.toFixed(0)).join(', ')}`);
  } else {
    const d = buildH2H(EVENTS_DIR, 'public/data/h2h.json', filter);
    console.log(
      d
        ? `h2h: ${d.decks.length} decks, ${d.pairs.length} pairings, ${d.games} games from ${d.events} events${d.model ? `; shrinkage weight ${d.model.priorGames} games (rho ${d.model.rho})` : ''} → public/data/h2h.json`
        : `no tournament data (${EVENTS_DIR}) yet`,
    );
  }
}
