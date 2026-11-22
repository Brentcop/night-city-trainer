// The regionals forecast's engine (src/lib/forecast.ts; docs/FORECAST.md): the Swiss pairing and standings port against
// the events' own rules (tournament.ts / eventFormats.ts) and against every recorded standard Swiss event round by round;
// the match maths; the model built from h2h.json against the model fitted from the games it pooled (the events and rating
// runs its manifest names, on the library's current lists, as scripts/build-h2h.ts pools them); and the forecast's limits (an
// even field converts K/N, every cut seat is counted once, a stronger deck converts more, the seed reproduces the run).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  defaultRounds,
  ForecastRun,
  matchOutcomes,
  modelCov,
  modelFromGames,
  modelFromH2HFile,
  modelFromParts,
  normaliseWeights,
  pairProbabilities,
  portStandings,
  portSwissPairings,
  runForecast,
  seatSplit,
  tournamentOf,
  type ForecastModel,
} from '../src/lib/forecast';
import { computeStandings, pairingRng, swissPairings, type StandingRow } from '../src/lib/tournament';
import { ratedGamesOf } from '../src/lib/ratingGames';
import { seededRandom } from '../src/lib/ratingModel';
import { currentListGate } from '../scripts/event-pool';
import { loadLibrary, SERIES_DIR } from '../scripts/lib-node';

const ROOT = path.resolve(__dirname, '..');
// every recorded standard Swiss event (a custom event or a rating run is not paired by the Swiss rules), whatever is recorded
const EVENT_IDS = fs
  .readdirSync(path.join(ROOT, 'public/tournaments'))
  .map((f) => /^event-(\d+)\.json$/.exec(f)?.[1])
  .filter((x): x is string => !!x)
  .map(Number)
  .sort((a, b) => a - b)
  .filter((id) => {
    const e = JSON.parse(fs.readFileSync(path.join(ROOT, `public/tournaments/event-${id}.json`), 'utf8'));
    return !e.custom && !e.setup && !!e.config;
  });
type Ev = {
  id: number;
  config: { seed: number; rounds: number; top: number; bestOf: number };
  decks: Record<string, unknown>;
  rounds: { round: number; matches: { a: string; b: string | null; score: [number, number]; winner: string }[] }[];
  standings: { deck: string; mp: number; omw: number; gwp: number }[];
  seeds: string[];
  simVersion: number;
};
const events: Ev[] = EVENT_IDS.map((id) => JSON.parse(fs.readFileSync(path.join(ROOT, `public/tournaments/event-${id}.json`), 'utf8')));
const h2h = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/h2h.json'), 'utf8'));

/** A model where every game is a coin flip: no ratings, no seat edge, no uncertainty, no pair effect. */
function evenModel(n: number): ForecastModel {
  const names = Array.from({ length: n }, (_, k) => `D${String(k).padStart(2, '0')}`);
  const cov = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(0));
  return modelFromParts({ names, r: names.map(() => 0), h: 0, cov, priorGames: Infinity, source: { events: [], games: 0, simVersion: null, bot: 'none', from: 'games' } });
}
/** A model with fixed ratings and a little uncertainty. */
function ratedModel(r: number[], sd = 0): ForecastModel {
  const n = r.length;
  const names = r.map((_, k) => `R${k}`);
  const cov = Array.from({ length: n + 1 }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (i === j && i < n ? sd * sd : 0)));
  return modelFromParts({ names, r, h: 0.3, cov, priorGames: Infinity, source: { events: [], games: 0, simVersion: null, bot: 'none', from: 'games' } });
}

describe('the Swiss port replays the recorded events exactly', () => {
  for (const ev of events)
    it(`event ${ev.id}: every round's pairings and bye, the final standings and the top-8 seeds`, () => {
      const names = Object.keys(ev.decks);
      const idx = new Map(names.map((n, k) => [n, k]));
      const rows = names.map(() => ({ mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [] as number[] }));
      // the original, run beside the port on its own copy of the same random stream
      const st = new Map<string, StandingRow>(names.map((d) => [d, { deck: d, mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [], omw: 0, gwp: 0, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 }]));
      const rPort = pairingRng(ev.config.seed);
      const rOrig = pairingRng(ev.config.seed);
      for (const round of ev.rounds) {
        const port = portSwissPairings(rows, rPort);
        const orig = swissPairings(st, rOrig);
        const recorded = round.matches.filter((m) => m.b).map((m) => [m.a, m.b] as [string, string]);
        const recordedBye = round.matches.find((m) => !m.b)?.a ?? null;
        expect(port.pairs.map(([a, b]) => [names[a], names[b]])).toEqual(recorded);
        expect(port.bye === null ? null : names[port.bye]).toBe(recordedBye);
        expect(orig.pairs).toEqual(recorded);
        // the recorded results, as tournament.ts records them
        for (const m of round.matches) {
          const a = idx.get(m.a)!;
          const A = st.get(m.a)!;
          if (!m.b) {
            rows[a]!.mp += 3;
            rows[a]!.mw++;
            rows[a]!.opps.push(-1);
            A.mp += 3;
            A.mw++;
            A.opps.push('BYE');
            continue;
          }
          const b = idx.get(m.b)!;
          const B = st.get(m.b)!;
          const aWon = m.winner === m.a;
          for (const [x, y, X, Y, sx, sy, won] of [
            [a, b, A, B, m.score[0], m.score[1], aWon],
            [b, a, B, A, m.score[1], m.score[0], !aWon],
          ] as const) {
            rows[x]!.opps.push(y);
            rows[x]!.gw += sx;
            rows[x]!.gl += sy;
            rows[x]!.mp += won ? 3 : 0;
            rows[x]![won ? 'mw' : 'ml']++;
            X.opps.push(Y.deck);
            X.gw += sx;
            X.gl += sy;
            X.mp += won ? 3 : 0;
            X[won ? 'mw' : 'ml']++;
          }
        }
      }
      const rank = [...names].map((n, p) => ({ n, p })).sort((x, y) => x.n.localeCompare(y.n));
      const nameRank = new Array<number>(names.length);
      rank.forEach((x, i) => (nameRank[x.p] = i));
      const port = portStandings(rows, nameRank);
      expect(port.order.map((p) => names[p])).toEqual(ev.standings.map((s) => s.deck));
      port.order.forEach((p, i) => {
        expect(port.omw[p]).toBe(ev.standings[i]!.omw);
        expect(port.gwp[p]).toBe(ev.standings[i]!.gwp);
      });
      expect(computeStandings(st).map((s) => s.deck)).toEqual(ev.standings.map((s) => s.deck));
      expect(port.order.slice(0, 8).map((p) => names[p])).toEqual(ev.seeds);
    });
});

describe('the Swiss port against swissPairings on made-up rounds', () => {
  it('pairs exactly as the original on small fields played deep (rematches forced, byes, the fallback search)', () => {
    let fallbacks = 0;
    for (let seed = 1; seed <= 300; seed++) {
      const rnd = seededRandom(seed);
      const P = 4 + Math.floor(rnd() * 9); // 4..12 players
      const R = 2 + Math.floor(rnd() * (P + 1)); // up to past the point where rematches are forced
      const rows = Array.from({ length: P }, () => ({ mp: 0, opps: [] as number[] }));
      const rP = pairingRng(seed);
      const rO = pairingRng(seed);
      for (let round = 0; round < R; round++) {
        const st = new Map(rows.map((x, p) => [`p${p}`, { deck: `p${p}`, mp: x.mp, opps: x.opps.map((o) => (o < 0 ? 'BYE' : `p${o}`)) }]));
        const port = portSwissPairings(rows, rP);
        const orig = swissPairings(st, rO);
        expect(port.pairs.map(([a, b]) => [`p${a}`, `p${b}`])).toEqual(orig.pairs);
        expect(port.bye === null ? null : `p${port.bye}`).toBe(orig.bye);
        if (orig.pairs.some(([a, b]) => st.get(a)!.opps.includes(b))) fallbacks++;
        for (const [a, b] of port.pairs) {
          const aWins = rnd() < 0.5;
          rows[a]!.opps.push(b);
          rows[b]!.opps.push(a);
          rows[aWins ? a : b]!.mp += 3;
        }
        if (port.bye !== null) {
          rows[port.bye]!.opps.push(-1);
          rows[port.bye]!.mp += 3;
        }
      }
    }
    expect(fallbacks).toBeGreaterThan(0); // the rematch fallback was exercised
  });

  it('ranks exactly as computeStandings, ties included', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rnd = seededRandom(1000 + seed);
      const P = 3 + Math.floor(rnd() * 14);
      const names = Array.from({ length: P }, (_, p) => `Deck ${String.fromCharCode(65 + ((p * 7) % 26))}${p}`);
      const rows = names.map(() => ({ mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [] as number[] }));
      const st = new Map<string, StandingRow>(names.map((d) => [d, { deck: d, mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [], omw: 0, gwp: 0, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 }]));
      const rounds = 1 + Math.floor(rnd() * 5);
      for (let r = 0; r < rounds; r++) {
        const order = names.map((_, p) => p).sort(() => rnd() - 0.5);
        for (let i = 0; i + 1 < order.length; i += 2) {
          const [a, b] = [order[i]!, order[i + 1]!];
          const sa = rnd() < 0.5 ? 2 : Math.floor(rnd() * 2);
          const sb = sa === 2 ? Math.floor(rnd() * 2) : 2;
          for (const [x, y, gx, gy] of [
            [a, b, sa, sb],
            [b, a, sb, sa],
          ] as const) {
            const won = gx > gy;
            rows[x]!.opps.push(y);
            rows[x]!.gw += gx;
            rows[x]!.gl += gy;
            rows[x]!.mp += won ? 3 : 0;
            rows[x]![won ? 'mw' : 'ml']++;
            const X = st.get(names[x]!)!;
            X.opps.push(names[y]!);
            X.gw += gx;
            X.gl += gy;
            X.mp += won ? 3 : 0;
            X[won ? 'mw' : 'ml']++;
          }
        }
        if (order.length % 2) {
          const p = order[order.length - 1]!;
          rows[p]!.mp += 3;
          rows[p]!.mw++;
          rows[p]!.opps.push(-1);
          const X = st.get(names[p]!)!;
          X.mp += 3;
          X.mw++;
          X.opps.push('BYE');
        }
      }
      const nameRank = names.map((n) => [...names].sort((x, y) => x.localeCompare(y)).indexOf(n));
      expect(portStandings(rows, nameRank).order.map((p) => names[p])).toEqual(computeStandings(st).map((s) => s.deck));
    }
  });
});

describe('match maths', () => {
  it('a best-of-3 without a seat edge is p²(3 − 2p); best-of-1 is p; the chances sum to 1', () => {
    for (const p of [0.1, 0.35, 0.5, 0.72]) {
      const bo3 = matchOutcomes(p, p, 3);
      expect(bo3.map((o) => `${o.a}-${o.b}`)).toEqual(['2-0', '2-1', '1-2', '0-2']);
      expect(bo3.reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 12);
      expect(bo3.filter((o) => o.a > o.b).reduce((s, o) => s + o.p, 0)).toBeCloseTo(p * p * (3 - 2 * p), 12);
      expect(matchOutcomes(p, p, 1)[0]!.p).toBeCloseTo(p, 12);
      expect(matchOutcomes(p, p, 5).reduce((s, o) => s + o.p, 0)).toBeCloseTo(1, 12);
    }
  });
  it('the seat split keeps the seat-averaged chance, and loser-goes-first is enumerated by hand', () => {
    for (const p of [0.2, 0.5, 0.8]) {
      const [f, s] = seatSplit(p, 0.31);
      expect((f + s) / 2).toBeCloseTo(p, 10);
      expect(f).toBeGreaterThan(s);
    }
    const [f, s] = [0.7, 0.4];
    // A first in game 1 (½): W then (B first) W → 2-0; W, L, (A first) W → 2-1; L, (A first) W, (B first) W → 2-1 …
    const firstA20 = f * s;
    const firstA21 = f * (1 - s) * f + (1 - f) * f * s;
    const secondA20 = s * s;
    const secondA21 = s * (1 - s) * f + (1 - s) * f * s;
    const out = matchOutcomes(f, s, 3);
    expect(out[0]!.p).toBeCloseTo((firstA20 + secondA20) / 2, 12);
    expect(out[1]!.p).toBeCloseTo((firstA21 + secondA21) / 2, 12);
  });
});

describe('the model from h2h.json', () => {
  // what the file pooled, as its manifest names it: recorded events (numbers) and rating runs ("run-N")
  const pooledIds: (number | string)[] = h2h.manifest.inputs.events.map((e: { id: number | string }) => e.id);
  const pooled = pooledIds.map((id) =>
    JSON.parse(fs.readFileSync(path.join(ROOT, typeof id === 'number' ? `public/tournaments/event-${id}.json` : `${SERIES_DIR}/${id}.json`), 'utf8')),
  );
  const games = ratedGamesOf(pooled as never, currentListGate(loadLibrary(path.join(ROOT, 'data/decks'))));
  const simVersion: number = h2h.manifest.simVersion;
  const bot: string = h2h.manifest.bot.level;
  const fromFile = modelFromH2HFile(h2h);
  const fromGames = modelFromGames(games, { events: pooledIds, simVersion, bot }, { names: h2h.decks });
  it('names its source: the events, the simulator version and the bot', () => {
    expect(pooledIds.length).toBeGreaterThan(0);
    expect(fromFile.source).toMatchObject({ events: pooledIds, simVersion, bot, from: 'h2h-file', games: h2h.games });
  });
  it('has the fitted ratings, and per-pair estimates within 0.002 of the file and of the games fit', () => {
    fromFile.r.forEach((x, k) => expect(Math.abs(x - fromGames.r[k]!)).toBeLessThan(1e-4));
    const pf = pairProbabilities(fromFile, fromFile.r, fromFile.h);
    const pg = pairProbabilities(fromGames, fromGames.r, fromGames.h);
    const n = h2h.decks.length;
    h2h.pairs.forEach(([i, j]: number[], q: number) => expect(Math.abs(pf[i! * n + j!]! - h2h.shrunk[q])).toBeLessThan(2e-3));
    for (let q = 0; q < pf.length; q++) expect(Math.abs(pf[q]! - pg[q]!)).toBeLessThan(2e-3);
  });
  it('rebuilds the covariance of the fit closely (every rating variance within 5%, no entry off by more than 0.003)', () => {
    const a = modelCov(fromFile);
    const b = modelCov(fromGames);
    const n = h2h.decks.length;
    for (let i = 0; i <= n; i++) {
      if (i < n) expect(Math.abs(a[i]![i]! - b[i]![i]!) / b[i]![i]!).toBeLessThan(0.05);
      for (let j = 0; j <= n; j++) expect(Math.abs(a[i]![j]! - b[i]![j]!)).toBeLessThan(0.003);
    }
  });
});

describe('the forecast', () => {
  it('an even field: every player makes a cut of K with chance K/N; each draw counts K seats exactly', () => {
    const m = evenModel(12);
    const t = tournamentOf({ players: 32, rounds: 5, bestOf: 3, top: 8 });
    const res = runForecast(m, { weights: m.names.map(() => 1) }, t, { draws: 4, trials: 1500, seed: 7, uncertainty: false });
    const share = res.decks.reduce((s, d) => s + d.cutShare.mean, 0);
    expect(share).toBeCloseTo(1, 12);
    for (const d of res.decks) {
      // about 4,000 player-events per deck: K/N = 0.25 with a standard error near 0.007
      expect(Math.abs(d.conversion.mean - 0.25)).toBeLessThan(0.035);
      expect(d.expectedPlayers).toBeCloseTo(32 / 12, 12);
    }
  });
  it('fixed entrants, each deck once: the conversions add up to K and the titles to 1 in every draw (deterministic)', () => {
    const m = evenModel(16);
    const t = tournamentOf({ players: 16, rounds: 4, bestOf: 1, top: 4 });
    const run = new ForecastRun(m, { entrants: m.names.map((_, k) => k) }, t, { draws: 3, trials: 97, seed: 3, uncertainty: false });
    while (run.step());
    const res = run.result();
    // every per-draw figure is a whole count over 97, and they add up exactly
    const conv = res.decks.reduce((s, d) => s + d.conversion.mean, 0);
    expect(conv).toBeCloseTo(4, 10);
    expect(res.decks.reduce((s, d) => s + d.title!.mean, 0)).toBeCloseTo(1, 10);
    for (const d of res.decks) expect(d.anyInCut.mean).toBeCloseTo(d.conversion.mean, 12);
  });
  it('a stronger deck converts more (ratings spread out, fixed entrants)', () => {
    const r = [-1, -0.5, 0, 0.5, 1, 1.5];
    const m = ratedModel(r);
    const res = runForecast(m, { entrants: [0, 1, 2, 3, 4, 5, 0, 1, 2, 3, 4, 5] }, tournamentOf({ players: 12, rounds: 4, top: 4 }), { draws: 2, trials: 3000, seed: 11, uncertainty: false });
    const conv = res.decks.map((d) => d.conversion.mean);
    for (let k = 1; k < conv.length; k++) expect(conv[k]!).toBeGreaterThan(conv[k - 1]!);
  });
  it('the seed reproduces the run, sliced or not; another seed gives other numbers', () => {
    const m = ratedModel([0.2, -0.1, 0.4, -0.5, 0.0], 0.15);
    const t = tournamentOf({ players: 24, top: 4 });
    const a = runForecast(m, { weights: [1, 2, 3, 1, 1] }, t, { draws: 6, trials: 40, seed: 5 });
    const run = new ForecastRun(m, { weights: [1, 2, 3, 1, 1] }, t, { draws: 6, trials: 40, seed: 5 });
    let slices = 0;
    while (run.step()) slices++;
    expect(slices).toBe(5);
    expect(run.result()).toEqual(a);
    const c = runForecast(m, { weights: [1, 2, 3, 1, 1] }, t, { draws: 6, trials: 40, seed: 6 });
    expect(c.decks.map((d) => d.conversion.mean)).not.toEqual(a.decks.map((d) => d.conversion.mean));
  });
  it('field weights are normalised; a deck weighing 0 is not in the field', () => {
    expect(normaliseWeights([2, 2, 0, 4])).toEqual([0.25, 0.25, 0, 0.5]);
    expect(normaliseWeights([1, -3, Number.NaN])).toEqual([1, 0, 0]);
    expect(() => normaliseWeights([0, 0])).toThrow();
    const m = ratedModel([0, 0.3, -0.3, 0.1]);
    const res = runForecast(m, { weights: [5, 5, 0, 10] }, tournamentOf({ players: 16, top: 4 }), { draws: 2, trials: 20, seed: 1, uncertainty: false });
    expect(res.decks.map((d) => d.name)).toEqual(['R0', 'R1', 'R3']);
    expect(res.decks.map((d) => d.weight)).toEqual([0.25, 0.25, 0.5]);
    expect(res.decks.map((d) => d.expectedPlayers)).toEqual([4, 4, 8]);
  });
  it('parameter uncertainty widens the ranges; without it they are sampling noise only', () => {
    const m = ratedModel([0.6, 0.2, 0, -0.2, -0.6], 0.25);
    const t = tournamentOf({ players: 20, top: 4 });
    const fixed = runForecast(m, { weights: [1, 1, 1, 1, 1] }, t, { draws: 30, trials: 200, seed: 2, uncertainty: false });
    const unsure = runForecast(m, { weights: [1, 1, 1, 1, 1] }, t, { draws: 30, trials: 200, seed: 2 });
    const w = (r: typeof fixed) => r.decks.reduce((s, d) => s + d.conversion.hi - d.conversion.lo, 0);
    expect(w(unsure)).toBeGreaterThan(1.5 * w(fixed));
    expect(fixed.decks.every((d) => d.noiseShare > 0.5)).toBe(true);
  });
  it('the defaults: rounds ⌈log₂ N⌉, the cut rounded down to a power of two that fits', () => {
    expect(defaultRounds(128)).toBe(7);
    expect(defaultRounds(129)).toBe(8);
    expect(defaultRounds(71)).toBe(7);
    expect(tournamentOf({ players: 128 })).toEqual({ players: 128, rounds: 7, bestOf: 3, top: 8, playCut: true });
    expect(tournamentOf({ players: 20, top: 12 }).top).toBe(8);
    expect(() => tournamentOf({ players: 1 })).toThrow();
  });
  it('what decides it: the costliest opponents of a deck are the ones it is likely to meet and does worst against', () => {
    // deck 0 is strong, deck 1 counters it, deck 2 is weak
    const n = 3;
    const names = ['Strong', 'Counter', 'Weak'];
    const cov = Array.from({ length: n + 1 }, () => new Array<number>(n + 1).fill(0));
    // ratings put Strong above both; the pair record says Counter beats Strong far more than the ratings predict
    const m = modelFromParts({ names, r: [0.8, 0, -0.8], h: 0, cov, priorGames: 5, pairs: [{ a: 'Strong', b: 'Counter', w: 5, g: 40 }], source: { events: [], games: 40, simVersion: null, bot: 'none', from: 'games' } });
    const res = runForecast(m, { weights: [1, 1, 1] }, tournamentOf({ players: 24, top: 4 }), { draws: 2, trials: 400, seed: 9, uncertainty: false });
    const strong = res.decks.find((d) => d.name === 'Strong')!;
    expect(strong.decides[0]!.name).toBe('Counter');
    expect(strong.decides[0]!.matchWin.mean).toBeLessThan(0.5);
    expect(strong.decides[0]!.perShare).toBeLessThan(0);
    expect(strong.decides.some((d) => d.name === 'Weak')).toBe(false);
  });
});
