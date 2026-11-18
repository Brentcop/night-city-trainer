// Backtest of the regionals forecast (docs/FORECAST.md "Backtest") on our own recorded events: for each event, fit the
// ratings and head-to-heads WITHOUT it (the pattern of leaveOneEventOut in src/lib/h2hModel.ts), forecast that event's
// actual field and format (its entrants, each deck once; its Swiss rounds, best-of and top cut) and compare each deck's
// predicted chance of making the top cut with whether it did. Scores: the Brier score against the baseline "every deck
// has the same chance, cut / entrants", a calibration table, and a 90% interval for the difference from a bootstrap that
// resamples decks (a deck's events together, since they share the deck). A check, not a target: nothing is tuned on it.
//
//   npx tsx scripts/forecast-backtest.ts [--draws 100] [--trials 300] [--seed 1] [--out FILE [--force]]
//
// Reads the recorded events of the current pool (public/tournaments/, the sim version and bot of the newest event, as
// scripts/ratings.ts pools them). Prints a Markdown report; --out also writes it (refuses to overwrite without --force).
import fs from 'node:fs';
import { bool, cli, int, readEvents, Refusal, runMain, str } from './lib-node';
import { parsePoolFilter, selectEvents } from './event-pool';
import { eventRatedGames } from '../src/lib/ratingGames';
import { modelFromGames, runForecast, tournamentOf } from '../src/lib/forecast';
import { seededRandom } from '../src/lib/ratingModel';
import { FORECAST_WORDS } from '../src/lib/forecastWords';

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

runMain(async () => {
  if (V.out && fs.existsSync(V.out) && !V.force) throw new Refusal(`${V.out} exists (use --force to overwrite it)`);
  const sel = selectEvents(readEvents(), parsePoolFilter({}));
  const events = sel.kept;
  if (events.length < 2) throw new Refusal('the backtest needs at least two pooled events');
  const names = [...new Set(events.flatMap((e) => eventRatedGames(e).flatMap((g) => [g.a, g.b])))];
  const rows: Row[] = [];
  const perEvent: { id: number | string; entrants: number; top: number; rounds: number; bestOf: number; brier: number; brierFixed: number; base: number; hits: number }[] = [];
  const started = Date.now();
  for (const held of events) {
    const train = events.filter((e) => e !== held);
    const model = modelFromGames(
      train.flatMap((e) => eventRatedGames(e)),
      { events: train.map((e) => e.id), simVersion: sel.simVersion === 'all' ? null : sel.simVersion, bot: sel.bot },
      { names },
    );
    const cfg = held.config as { rounds: number; top: number; bestOf: number } | undefined;
    if (!cfg || held.setup) throw new Refusal(`event ${held.id} is not a plain Swiss event; the backtest reads plain events only`);
    const entrants = Object.keys(held.decks);
    const idx = entrants.map((d) => {
      const k = names.indexOf(d);
      if (k < 0) throw new Refusal(`event ${held.id}: ${d} has no game in the other events`);
      return k;
    });
    const t = tournamentOf({ players: entrants.length, rounds: cfg.rounds, bestOf: cfg.bestOf as 1 | 3 | 5, top: cfg.top, playCut: false });
    const opts = { draws: V.draws, trials: V.trials, seed: V.seed + Number(held.id) };
    const res = runForecast(model, { entrants: idx }, t, opts);
    const fixed = runForecast(model, { entrants: idx }, t, { ...opts, uncertainty: false });
    const made = new Set((held.seeds ?? held.standings.slice(0, t.top).map((s) => s.deck)) as string[]);
    const base = t.top / entrants.length;
    let b = 0;
    let bf = 0;
    let b0 = 0;
    for (const d of res.decks) {
      const y = made.has(d.name) ? 1 : 0;
      const pf = fixed.decks.find((x) => x.k === d.k)!.conversion.mean;
      rows.push({ event: held.id, deck: d.name, p: d.conversion.mean, pFixed: pf, base, y });
      b += (d.conversion.mean - y) ** 2;
      bf += (pf - y) ** 2;
      b0 += (base - y) ** 2;
    }
    const n = res.decks.length;
    const top = [...res.decks].sort((x, y) => y.conversion.mean - x.conversion.mean).slice(0, t.top);
    perEvent.push({ id: held.id, entrants: entrants.length, top: t.top, rounds: t.rounds, bestOf: t.bestOf, brier: b / n, brierFixed: bf / n, base: b0 / n, hits: top.filter((d) => made.has(d.name)).length });
  }
  const secs = (Date.now() - started) / 1000;
  const mean = (xs: number[]) => xs.reduce((a, x) => a + x, 0) / Math.max(1, xs.length);
  const brier = (key: 'p' | 'pFixed' | 'base', rs: Row[]) => mean(rs.map((r) => (r[key] - r.y) ** 2));
  const B = brier('p', rows);
  const BF = brier('pFixed', rows);
  const B0 = brier('base', rows);
  // cluster bootstrap over decks
  const decks = [...new Set(rows.map((r) => r.deck))];
  const byDeck = new Map(decks.map((d) => [d, rows.filter((r) => r.deck === d)]));
  const rnd = seededRandom(V.seed * 7919 + 1);
  const diffs: number[] = [];
  const diffsFixed: number[] = [];
  for (let rep = 0; rep < 4000; rep++) {
    const sample: Row[] = [];
    for (let i = 0; i < decks.length; i++) sample.push(...byDeck.get(decks[Math.floor(rnd() * decks.length)]!)!);
    diffs.push(brier('p', sample) - brier('base', sample));
    diffsFixed.push(brier('p', sample) - brier('pFixed', sample));
  }
  const q = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor(p * (xs.length - 1))]!;
  const lo = q(diffs, 0.05);
  const hi = q(diffs, 0.95);
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
  const verdict =
    hi < 0
      ? `The forecast scores better than the baseline: its Brier score is lower by ${(-(B - B0)).toFixed(4)} (90% interval of the difference ${(-hi).toFixed(4)} to ${(-lo).toFixed(4)}), a Brier skill score of ${p1(1 - B / B0)}.`
      : lo > 0
        ? `The forecast scores WORSE than the baseline: its Brier score is higher by ${(B - B0).toFixed(4)} (90% interval ${lo.toFixed(4)} to ${hi.toFixed(4)}).`
        : `The forecast is no better than the baseline on these events: the 90% interval of the Brier difference (${lo.toFixed(4)} to ${hi.toFixed(4)}) includes zero.`;
  const md = [
    `# Regionals forecast: backtest on our recorded events`,
    '',
    `Each recorded event of the current pool (sim v${sel.simVersion}, ${sel.bot} bot: events ${events.map((e) => e.id).join(', ')}) forecast from the ratings and head-to-heads fitted on the OTHER events only, on its own field (every entrant once) and format; the predicted chance of each deck to make the top cut is compared with whether it did. ${V.draws} parameter draws × ${V.trials} tournaments per event (seed ${V.seed} + the event id); ${secs.toFixed(0)} s. Baseline: every deck has the same chance, cut / entrants.`,
    '',
    `**Result.** ${verdict}`,
    '',
    `| Event | Entrants | Format | Brier (forecast) | Brier (ratings fixed) | Brier (baseline) | Forecast's top ${perEvent[0]?.top ?? 8} that made the cut |`,
    '|---|---|---|---|---|---|---|',
    ...perEvent.map((e) => `| ${e.id} | ${e.entrants} | Swiss ${e.rounds} Bo${e.bestOf}, top ${e.top} | ${f3(e.brier)} | ${f3(e.brierFixed)} | ${f3(e.base)} | ${e.hits} of ${e.top} |`),
    `| all | ${rows.length} deck-events | | **${f3(B)}** | ${f3(BF)} | ${f3(B0)} | ${perEvent.reduce((s, e) => s + e.hits, 0)} of ${perEvent.reduce((s, e) => s + e.top, 0)} |`,
    '',
    `Brier skill score against the baseline: ${p1(1 - B / B0)} (90% interval of the Brier difference, forecast minus baseline, from 4,000 resamples of the ${decks.length} decks: ${lo.toFixed(4)} to ${hi.toFixed(4)}). With the ratings fixed at their estimate instead of drawn: Brier ${f3(BF)} (difference forecast minus fixed, 90% interval ${q(diffsFixed, 0.05).toFixed(4)} to ${q(diffsFixed, 0.95).toFixed(4)}).`,
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
    `What this checks: whether ratings fitted on four events of the Hard bot playing these 71 lists predict who reaches the top cut of a fifth event of the same bot and lists. It says nothing about human players. ${FORECAST_WORDS.ranges}`,
  ].join('\n');
  console.log(md);
  if (V.out) fs.writeFileSync(V.out, `${md}\n`);
});
