// Backtest of the regionals forecast (docs/FORECAST.md "Backtest") on our own recorded events: each plain Swiss event of
// the pool is held out in turn, the ratings and head-to-heads are fitted WITHOUT it on the games the live model pools
// (public/data/h2h.json, scripts/build-h2h.ts: the other recorded events AND the rating runs of data/series, the newest
// sim version and bot, games on the library's current lists only: scripts/event-pool.ts currentListGate), that event's
// actual field and format are forecast (its entrants, each deck once; its Swiss rounds, best-of and top cut) and each
// deck's predicted chance of making the top cut is compared with whether it did. Scores: the Brier score against the
// baseline "every deck has the same chance, cut / entrants", a calibration table, and a 90% interval for the difference
// from a bootstrap that resamples decks (a deck's events together, since they share the deck). A check, not a target:
// nothing is tuned on it.
//
// Which games predict an event (no leakage of its own games either way):
//   - "all other games" (the headline): every pooled game except the held-out event's own, including events and runs
//     recorded after it. The simulator, the bot and the lists are fixed across the pool (one sim version and bot; the
//     list gate), so a game recorded later is another independent game of the same decks: it tells the fit about the
//     decks' strength, nothing about how the held-out event's pairings and dice went. This is what the live forecast
//     does for an event still to come: it reads every recorded game.
//   - "earlier games only": the events and runs dated before the held-out event, the stricter and smaller test (an
//     event with nothing earlier is not scored). Today's runs are dated after every plain event, so it reads events only.
// Held out: plain Swiss events only (a `config` with a top cut, no `setup`, not custom, not a rating run); the others
// (a round robin, hand-set pairings, runs) are left out of the held-out set, named, and still predict the rest.
//
//   npx tsx scripts/forecast-backtest.ts [--draws 100] [--trials 300] [--seed 1] [--out FILE [--force]]
//
// Prints a Markdown report; --out also writes it (refuses to overwrite without --force).
import fs from 'node:fs';
import { bool, cli, int, isRun, loadLibrary, readPooled, Refusal, runMain, str, type RecordedEvent } from './lib-node';
import { currentListGate, parsePoolFilter, selectEvents } from './event-pool';
import { eventRatedGames, type ListGate } from '../src/lib/ratingGames';
import { modelFromGames, runForecast, tournamentOf } from '../src/lib/forecast';
import { seededRandom } from '../src/lib/ratingModel';
import { FORECAST_WORDS } from '../src/lib/forecastWords';
import { entrantBase } from '../src/lib/eventFormats';

const { values: V } = cli(import.meta.url, {
  draws: int(100, { min: 1, max: 10_000 }),
  trials: int(300, { min: 1, max: 100_000 }),
  seed: int(1),
  out: str(),
  force: bool(),
});

interface Row {
  event: number | string;
  deck: string;
  p: number;
  /** the same forecast with the ratings fixed at their estimate (no parameter draws) */
  pFixed: number;
  base: number;
  y: 0 | 1;
}
interface EventScore {
  id: number | string;
  entrants: number;
  top: number;
  rounds: number;
  bestOf: number;
  trainGames: number;
  brier: number;
  brierFixed: number;
  base: number;
  hits: number;
}

/** Why an event is not held out (null: a plain Swiss event with a cut, which is). */
function notHeldOutWhy(e: RecordedEvent): string | null {
  if (isRun(e)) return 'a rating run, with no standings or cut';
  if (e.setup || e.custom) return 'not a plain Swiss event: another format, or pairings or seeds set by hand';
  const cfg = e.config as { rounds?: number; top?: number; bestOf?: number } | undefined;
  if (!cfg || !(cfg.top! > 0) || !(cfg.rounds! > 0)) return 'no top cut to predict';
  return null;
}

const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
const brierOf = (key: 'p' | 'pFixed' | 'base', rs: readonly Row[]) => mean(rs.map((r) => (r[key] - r.y) ** 2));

runMain(async () => {
  if (V.out && fs.existsSync(V.out) && !V.force) throw new Refusal(`${V.out} exists (use --force to overwrite it)`);
  const sel = selectEvents(readPooled(), parsePoolFilter({}));
  for (const w of sel.warnings) console.error(w);
  const pool = sel.kept;
  const gate: ListGate = currentListGate(loadLibrary());
  const gamesOf = new Map(pool.map((e) => [e, eventRatedGames(e, gate)]));
  const held = pool.filter((e) => notHeldOutWhy(e) === null);
  const skipped = pool.filter((e) => notHeldOutWhy(e) !== null).map((e) => ({ id: e.id, why: notHeldOutWhy(e)! }));
  if (held.length < 2) throw new Refusal('the backtest needs at least two plain Swiss events in the pool');
  const names = [...new Set([...gamesOf.values()].flatMap((gs) => gs.flatMap((g) => [g.a, g.b])))];
  const source = { simVersion: sel.simVersion === 'all' ? null : sel.simVersion, bot: sel.bot };
  // entrants whose stored list is not the library's current one: forecast as the deck, but the model rates its current list
  let staleEntrants = 0;

  const run = (train: readonly RecordedEvent[], ev: RecordedEvent, rows: Row[]): EventScore => {
    const games = train.flatMap((e) => gamesOf.get(e)!);
    const model = modelFromGames(games, { events: train.map((e) => e.id), ...source }, { names });
    const cfg = ev.config as { rounds: number; top: number; bestOf: number };
    const entrants = Object.keys(ev.decks);
    const idx = entrants.map((d) => {
      const k = names.indexOf(d);
      if (k < 0) throw new Refusal(`event ${ev.id}: ${d} has no pooled game on its current list`);
      return k;
    });
    const t = tournamentOf({ players: entrants.length, rounds: cfg.rounds, bestOf: cfg.bestOf as 1 | 3 | 5, top: cfg.top, playCut: false });
    const opts = { draws: V.draws, trials: V.trials, seed: V.seed + Number(ev.id) };
    const res = runForecast(model, { entrants: idx }, t, opts);
    const fixed = runForecast(model, { entrants: idx }, t, { ...opts, uncertainty: false });
    const made = new Set((ev.seeds ?? ev.standings.slice(0, t.top).map((s) => s.deck)) as string[]);
    const base = t.top / entrants.length;
    const mine: Row[] = [];
    for (const d of res.decks) {
      const pf = fixed.decks.find((x) => x.k === d.k)!.conversion.mean;
      mine.push({ event: ev.id, deck: d.name, p: d.conversion.mean, pFixed: pf, base, y: made.has(d.name) ? 1 : 0 });
    }
    rows.push(...mine);
    const top = [...res.decks].sort((x, y) => y.conversion.mean - x.conversion.mean).slice(0, t.top);
    return { id: ev.id, entrants: entrants.length, top: t.top, rounds: t.rounds, bestOf: t.bestOf, trainGames: games.length, brier: brierOf('p', mine), brierFixed: brierOf('pFixed', mine), base: brierOf('base', mine), hits: top.filter((d) => made.has(d.name)).length };
  };

  const started = Date.now();
  // headline: every pooled game but the held-out event's own
  const rows: Row[] = [];
  const perEvent: EventScore[] = [];
  for (const ev of held) {
    staleEntrants += Object.entries(ev.decks).filter(([n, l]) => !gate(entrantBase(ev.setup, n), l)).length;
    perEvent.push(run(pool.filter((e) => e !== ev), ev, rows));
  }
  // stricter: events and runs dated before the held-out event
  const earlyRows: Row[] = [];
  const earlyEvents: EventScore[] = [];
  const earlyNone: (number | string)[] = [];
  for (const ev of held) {
    const train = pool.filter((e) => e !== ev && (e.date ?? '') < (ev.date ?? ''));
    if (!train.some((e) => gamesOf.get(e)!.length)) earlyNone.push(ev.id);
    else earlyEvents.push(run(train, ev, earlyRows));
  }
  const secs = (Date.now() - started) / 1000;

  const B = brierOf('p', rows);
  const BF = brierOf('pFixed', rows);
  const B0 = brierOf('base', rows);
  // cluster bootstrap over decks
  const boot = (rs: readonly Row[], seed: number) => {
    const decks = [...new Set(rs.map((r) => r.deck))];
    const byDeck = new Map(decks.map((d) => [d, rs.filter((r) => r.deck === d)]));
    const rnd = seededRandom(seed);
    const diffs: number[] = [];
    const diffsFixed: number[] = [];
    for (let rep = 0; rep < 4000; rep++) {
      const sample: Row[] = [];
      for (let i = 0; i < decks.length; i++) sample.push(...byDeck.get(decks[Math.floor(rnd() * decks.length)]!)!);
      diffs.push(brierOf('p', sample) - brierOf('base', sample));
      diffsFixed.push(brierOf('p', sample) - brierOf('pFixed', sample));
    }
    return { decks: decks.length, diffs, diffsFixed };
  };
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
  // four decimals, a value that rounds to zero printed without its sign
  const f4 = (x: number) => (Math.abs(x) < 0.00005 ? '0.0000' : x.toFixed(4));
  const bt = boot(rows, V.seed * 7919 + 1);
  const lo = q(bt.diffs, 0.05);
  const hi = q(bt.diffs, 0.95);
  const EB = brierOf('p', earlyRows);
  const EB0 = brierOf('base', earlyRows);
  const ebt = earlyRows.length ? boot(earlyRows, V.seed * 7919 + 2) : null;
  const bins: [number, number][] = [
    [0, 0.02],
    [0.02, 0.05],
    [0.05, 0.1],
    [0.1, 0.2],
    [0.2, 0.35],
    [0.35, 0.5],
    [0.5, 1.000001],
  ];
  const f3 = (x: number) => x.toFixed(4);
  const p1 = (x: number) => `${(100 * x).toFixed(1)}%`;
  const verdictOf = (b: number, b0: number, l: number, h: number) =>
    h < 0
      ? `The forecast scores better than the baseline: its Brier score is lower by ${(-(b - b0)).toFixed(4)} (90% interval of the difference ${(-h).toFixed(4)} to ${(-l).toFixed(4)}), a Brier skill score of ${p1(1 - b / b0)}.`
      : l > 0
        ? `The forecast scores WORSE than the baseline: its Brier score is higher by ${(b - b0).toFixed(4)} (90% interval ${l.toFixed(4)} to ${h.toFixed(4)}).`
        : `The forecast is no better than the baseline on these events: the 90% interval of the Brier difference (${l.toFixed(4)} to ${h.toFixed(4)}) includes zero.`;
  const runIds = pool.filter(isRun).map((e) => e.id);
  const otherIds = pool.filter((e) => !isRun(e) && !held.includes(e)).map((e) => e.id);
  const tableOf = (es: readonly EventScore[], rs: readonly Row[]) => [
    `| Event | Entrants | Format | Games fitted | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top ${es[0]?.top ?? 8} that made the cut |`,
    '|---|---|---|---|---|---|---|---|',
    ...es.map((e) => `| ${e.id} | ${e.entrants} | Swiss ${e.rounds} Bo${e.bestOf}, top ${e.top} | ${e.trainGames.toLocaleString('en-US')} | ${f3(e.brier)} | ${f3(e.brierFixed)} | ${f3(e.base)} | ${e.hits} of ${e.top} |`),
    `| all | ${rs.length} deck-events | | | **${f3(brierOf('p', rs))}** | ${f3(brierOf('pFixed', rs))} | ${f3(brierOf('base', rs))} | ${es.reduce((s, e) => s + e.hits, 0)} of ${es.reduce((s, e) => s + e.top, 0)} |`,
  ];
  const md = [
    `# Regionals forecast: backtest on our recorded events`,
    '',
    `Each plain Swiss event of the current pool (sim v${sel.simVersion}, ${sel.bot} bot; held out in turn: events ${held.map((e) => e.id).join(', ')}) forecast from the ratings and head-to-heads fitted on the games the live forecast reads (public/data/h2h.json: the recorded events and rating runs of that version and bot, on the library's current lists), less the held-out event's own games, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. Pooled besides the held-out events: ${[...otherIds.map((id) => `event ${id}`), ...runIds].join(', ') || 'nothing'}.${skipped.length ? ` Not held out (their games still predict the others): ${skipped.map((s) => `${typeof s.id === 'number' ? `event ${s.id}` : s.id}, ${s.why}`).join('; ')}.` : ''} Entrants whose stored list is no longer the library's: ${staleEntrants}. ${V.draws} parameter draws × ${V.trials} tournaments per event (seed ${V.seed} + the event id); ${secs.toFixed(0)} s. Baseline: every deck has the same chance, cut / entrants.`,
    '',
    `**Result (every other pooled game).** ${verdictOf(B, B0, lo, hi)}`,
    '',
    ...tableOf(perEvent, rows),
    '',
    `Brier skill score against the baseline: ${p1(1 - B / B0)} (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the ${bt.decks} decks: ${lo.toFixed(4)} to ${hi.toFixed(4)}). With the ratings fixed at their estimate instead of drawn: Brier ${f3(BF)} (difference forecast minus fixed, 90% interval ${f4(q(bt.diffsFixed, 0.05))} to ${f4(q(bt.diffsFixed, 0.95))}).`,
    '',
    '**Calibration** (every deck-event, by the forecast chance):',
    '',
    '| Forecast chance | Deck-events | Mean forecast | Made the cut | Rate |',
    '|---|---|---|---|---|',
    ...bins.map(([a, b]) => {
      const rs = rows.filter((r) => r.p >= a && r.p < b);
      return `| ${p1(a)} to ${b > 1 ? '100%' : p1(b)} | ${rs.length} | ${rs.length ? p1(mean(rs.map((r) => r.p))) : '—'} | ${rs.reduce((s, r) => s + r.y, 0)} | ${rs.length ? p1(mean(rs.map((r) => r.y))) : '—'} |`;
    }),
    '',
    `**Earlier games only** (each held-out event forecast from the events and runs dated before it${earlyNone.length ? `; not scored, nothing earlier: event ${earlyNone.join(', ')}` : ''}). ${earlyRows.length && ebt ? verdictOf(EB, EB0, q(ebt.diffs, 0.05), q(ebt.diffs, 0.95)) : 'No event has earlier games.'}`,
    '',
    ...(earlyRows.length ? tableOf(earlyEvents, earlyRows) : []),
    '',
    `What this checks: whether ratings fitted on the other recorded games of the Hard bot playing these lists predict who reaches the top cut of a held-out event of the same bot and lists. It says nothing about human players. ${FORECAST_WORDS.ranges}`,
  ].join('\n');
  console.log(md);
  if (V.out) fs.writeFileSync(V.out, `${md}\n`);
});
