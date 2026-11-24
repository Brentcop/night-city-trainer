// The rating series' rule (src/lib/seriesPlan.ts; docs/SERIES.md): which decks need games and why, widest first, the
// expectation, the run loop and its budget, the seeds; and a seeded simulation that pins what the study measured: when
// the rule stops, the 90% ranges hold their truth about 90% of the time, in about the games the rule needs. Invented
// decks only: nothing here depends on the recorded data.
import { describe, expect, it } from 'vitest';
import { blockDecks, blockPairs, decide, expectedGames, firstsOf, meetings, planBlockPicks, planPicks, reached, runSeries, RUN_SEED_SPAN, seriesFit, seriesSeed, SERIES_BATCH, type SeriesJob, type SeriesSwitches } from '../src/lib/seriesPlan';
import { expectedVs, fieldInterval, seededRandom, type RatedGame } from '../src/lib/ratingModel';

const σ = (x: number) => 1 / (1 + Math.exp(-x));
const H = 0.3;

/** `n` invented decks with ratings N(0, 0.6²), and `start` games each against random opponents, from `seed`. */
function world(seed: number, n = 20, start = 20) {
  const rnd = seededRandom(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const r = Array.from({ length: n }, () => 0.6 * gauss());
  const names = r.map((_, k) => `D${String(k).padStart(2, '0')}`);
  const games: RatedGame[] = [];
  for (let k = 0; k < n; k++)
    for (let g = 0; g < start / 2; g++) {
      let j = Math.floor(rnd() * (n - 1));
      if (j >= k) j++;
      const first = (g % 2) as 0 | 1;
      games.push({ a: names[k]!, b: names[j]!, first, s: rnd() < σ(r[k]! - r[j]! + (first === 0 ? H : -H)) ? 1 : 0 });
    }
  /** a stub player: each game drawn from the truth with the game's own seed */
  const play = async (jobs: readonly SeriesJob[]) =>
    jobs.map((j) => {
      const pr = seededRandom(j.seed);
      const i = names.indexOf(j.a);
      const k = names.indexOf(j.b);
      return { winner: (pr() < σ(r[i]! - r[k]! + (j.first === 0 ? H : -H)) ? 0 : 1) as 0 | 1, turns: 10, reason: 'stub' };
    });
  return { r, names, games, play };
}
const SW: SeriesSwitches = { series: true, arrivals: true, width: 6 };

describe('the decision', () => {
  // 40 decks: the fit's prior sd is fitted to the games (2026-11-24), and with 20 decks of 20 games it can collapse toward
  // 0 (3 of 40 invented worlds, this seed's among them: 0.07), which would make every range narrow before any game
  const w = world(1, 40);
  it('series on: needed while any deck is wider than the width, every deck eligible at that width; why says so', () => {
    const d = decide({ games: w.games, field: w.names, switches: SW });
    expect(d.needed).toBe(true);
    expect(d.eligible.map((e) => e.deck)).toEqual(w.names);
    expect(d.eligible.every((e) => e.target === 6)).toBe(true);
    expect(d.widest!.hw).toBeGreaterThan(6);
    expect(d.why.join(' ')).toContain('wider than ±6.0');
    // a width the data already meets
    const easy = decide({ games: w.games, field: w.names, switches: { ...SW, width: 30 } });
    expect(easy.needed).toBe(false);
    expect(easy.why.join(' ')).toContain('nothing to play');
  });
  it('an unrated deck (no game on its current list) is named; arrivals alone play it to the widest range of the others', () => {
    const field = [...w.names, 'Newcomer'];
    const d = decide({ games: w.games, field, switches: { ...SW, series: false } });
    expect(d.unrated).toEqual(['Newcomer']);
    expect(d.eligible.map((e) => e.deck)).toEqual(['Newcomer']);
    const othersWidest = Math.max(...d.ranges.filter((x) => x.deck !== 'Newcomer').map((x) => x.hw));
    expect(d.target).toBeCloseTo(othersWidest, 12);
    expect(d.why.join(' ')).toContain('Arrivals');
    // the series on covers it, and names it too
    const s = decide({ games: w.games, field, switches: SW });
    expect(s.unrated).toEqual(['Newcomer']);
    expect(s.why.join(' ')).toContain('Newcomer');
    // with every deck rated and the series off, nothing to do
    expect(decide({ games: w.games, field: w.names, switches: { ...SW, series: false } }).needed).toBe(false);
  });
  it('both switches off: nothing is needed, and why says so', () => {
    const d = decide({ games: w.games, field: w.names, switches: { ...SW, series: false, arrivals: false } });
    expect(d).toMatchObject({ needed: false, eligible: [] });
    expect(d.why.join(' ')).toContain('switched off');
  });
});

describe('the picks', () => {
  const w = world(2);
  const fit = seriesFit(w.games, w.names);
  const met = meetings(w.games);
  it('widest first, against the field deck met least; the same inputs give the same plan', () => {
    const plan = (seed: number) => planPicks({ fit, field: w.names, eligible: w.names, met, budget: 300, rnd: seededRandom(seed) });
    const a = plan(5);
    expect(a).toEqual(plan(5));
    expect(a).toHaveLength(300 / SERIES_BATCH);
    expect(a.every((p) => p.games === SERIES_BATCH && p.a !== p.b && w.names.includes(p.b))).toBe(true);
    // the first pick is the deck whose range is widest now, against an opponent it has met least
    const d = decide({ games: w.games, field: w.names, switches: SW }, fit);
    expect(a[0]!.a).toBe(d.widest!.deck);
    const metA = (b: string) => met.get(a[0]!.a < b ? `${a[0]!.a}\u0000${b}` : `${b}\u0000${a[0]!.a}`) ?? 0;
    const least = Math.min(...w.names.filter((x) => x !== a[0]!.a).map(metA));
    expect(metA(a[0]!.b)).toBe(least);
  });
  it('never pairs against a deck outside the field (a retired list), and only eligible decks take the picks', () => {
    const games = [...w.games, { a: 'Retired', b: w.names[0]!, first: 0 as const, s: 1 }];
    const f2 = seriesFit(games, w.names);
    const p = planPicks({ fit: f2, field: w.names, eligible: [w.names[3]!], met: meetings(games), budget: 100, rnd: seededRandom(1) });
    expect(p.every((x) => x.a === w.names[3] && x.b !== 'Retired')).toBe(true);
  });
  it('the expectation: zero when nothing is needed, the same number for the same inputs, and close to what a run plays', async () => {
    const d = decide({ games: w.games, field: w.names, switches: SW }, fit);
    const e = expectedGames({ fit, decision: d, field: w.names, met, seed: 3 });
    expect(e).toBe(expectedGames({ fit, decision: d, field: w.names, met, seed: 3 }));
    expect(e).toBeGreaterThan(0);
    expect(expectedGames({ fit, decision: decide({ games: w.games, field: w.names, switches: { ...SW, width: 30 } }, fit), field: w.names, met })).toBe(0);
    const run = await runSeries({ run: 1, input: { games: w.games, field: w.names, switches: SW }, maxGames: 50_000, play: w.play });
    expect(Math.abs(run.games.length - e)).toBeLessThanOrEqual(Math.max(600, 0.5 * e));
  });
});

describe('the run', () => {
  it('stops at its game budget and says so; the seeds are the run\'s own range', async () => {
    const w = world(3);
    const out = await runSeries({ run: 7, input: { games: w.games, field: w.names, switches: SW }, maxGames: 120, play: w.play, chunk: 60 });
    expect(out.stopped).toBe('budget');
    expect(out.games).toHaveLength(120);
    expect(out.games.map((g) => g.seed)).toEqual(out.games.map((_, k) => seriesSeed(7, k)));
    expect(out.games.every((g, k) => g.first === k % 2)).toBe(true);
  });
  it('stops when its clock says so, before the next chunk', async () => {
    const w = world(3);
    let calls = 0;
    const out = await runSeries({ run: 1, input: { games: w.games, field: w.names, switches: SW }, maxGames: 50_000, play: w.play, chunk: 60, outOfTime: () => ++calls > 2 });
    expect(out.stopped).toBe('budget');
    expect(out.games).toHaveLength(120);
  });
  it('plays nothing when nothing is needed', async () => {
    const w = world(4);
    const out = await runSeries({ run: 1, input: { games: w.games, field: w.names, switches: { ...SW, width: 30 } }, maxGames: 1000, play: w.play });
    expect(out).toMatchObject({ stopped: 'nothing-needed', games: [] });
  });
  it('arrivals alone: plays the newcomer until its range is as narrow as the widest of the others at the start', async () => {
    const w = world(5);
    const field = [...w.names, 'D99'];
    const truthR = [...w.r, 0.4];
    const play = async (jobs: readonly SeriesJob[]) =>
      jobs.map((j) => {
        const pr = seededRandom(j.seed);
        const i = field.indexOf(j.a);
        const k = field.indexOf(j.b);
        return { winner: (pr() < σ(truthR[i]! - truthR[k]! + (j.first === 0 ? H : -H)) ? 0 : 1) as 0 | 1, turns: 10, reason: 'stub' };
      });
    const out = await runSeries({ run: 1, input: { games: w.games, field, switches: { ...SW, series: false } }, maxGames: 5000, play });
    expect(out.stopped).toBe('reached');
    expect(out.games.every((g) => g.a === 'D99')).toBe(true);
    expect(reached(out.before, out.after)).toBe(true);
    expect(out.after.unrated).toEqual([]);
  });
  it('the same run twice is the same run (seeds, picks, results)', async () => {
    const w = world(6);
    const go = () => runSeries({ run: 2, input: { games: w.games, field: w.names, switches: SW }, maxGames: 600, play: w.play });
    expect(await go()).toEqual(await go());
  });
  it('seeds: 1,000,000,000 + run × 100,000 + k, below 2^31 up to run 11,473', () => {
    expect(seriesSeed(1, 0)).toBe(1_000_100_000);
    expect(seriesSeed(3, 99_999)).toBe(1_000_399_999);
    expect(seriesSeed(11_473, RUN_SEED_SPAN - 1)).toBeLessThan(2 ** 31);
    expect(seriesSeed(11_474, RUN_SEED_SPAN - 1)).toBeGreaterThanOrEqual(2 ** 31);
  });
});

describe('a seeded simulation of the rule (docs/SERIES.md E1, E2)', () => {
  it('when the rule stops, the 90% ranges hold the true win rate about 90% of the time, in the games the rule needs', async () => {
    let hit = 0;
    let cells = 0;
    const games: number[] = [];
    for (let rep = 0; rep < 60; rep++) {
      const w = world(100 + rep);
      const out = await runSeries({ run: rep + 1, input: { games: w.games, field: w.names, switches: SW }, maxGames: 50_000, play: w.play });
      expect(out.stopped).toBe('reached');
      games.push(out.games.length);
      const all = [...w.games, ...out.games.map((g) => ({ a: g.a, b: g.b, first: g.first, s: g.winner === 0 ? 1 : g.winner === 1 ? 0 : 0.5 }))];
      const fit = seriesFit(all, w.names);
      const pool = w.names.map((_, k) => k);
      const mean = w.r.reduce((a, x) => a + x, 0) / w.r.length;
      const centred = w.r.map((x) => x - mean);
      w.names.forEach((_, k) => {
        const iv = fieldInterval(fit, k, pool, { z: 1.645 });
        const truth = expectedVs(centred, k, centred[k]!, pool);
        if (truth >= iv.lo && truth <= iv.hi) hit++;
        cells++;
      });
    }
    // 1,200 deck-ranges: measured 0.897 on these seeds; a rule that read its own noise would fall below 0.86
    expect(hit / cells).toBeGreaterThan(0.86);
    expect(hit / cells).toBeLessThan(0.95);
    // 20 decks from 20 games each to ±6: 1,500 to 1,800 games on these seeds
    games.sort((a, b) => a - b);
    const median = games[games.length >> 1]!;
    expect(median).toBeGreaterThanOrEqual(1200);
    expect(median).toBeLessThanOrEqual(2400);
  });
});

describe('the matchup block (2026-11-24)', () => {
  const BLOCK: SeriesSwitches = { series: true, arrivals: true, width: 30, matchups: true, matchupDecks: 6, matchupGames: 20 };
  it('the decision: with the width met, the pairs among the best-rated decks until each has its games', () => {
    const w = world(11);
    const fit = seriesFit(w.games, w.names);
    const d = decide({ games: w.games, field: w.names, switches: BLOCK }, fit);
    const top = blockDecks(fit, w.names, 6);
    expect(top).toHaveLength(6);
    const at = (n: string) => fit.r[fit.names.indexOf(n)]!;
    expect(top.every((n, k) => k === 0 || at(top[k - 1]!) >= at(n))).toBe(true);
    expect(w.names.filter((n) => !top.includes(n)).every((n) => at(n) <= at(top[5]!))).toBe(true);
    expect(d.eligible).toEqual([]);
    expect(d.needed).toBe(true);
    expect(d.block).toMatchObject({ decks: top, target: 20, pairs: 15 });
    expect(d.block!.games).toBe(blockPairs(top, meetings(w.games)).reduce((s, p) => s + Math.max(0, 20 - p.games), 0));
    expect(d.why.join(' ')).toContain('Matchup block: the 6 best-rated decks, 15 pairs, 20 games a pair');
    expect(d.why.join(' ')).not.toContain('nothing to play');
    // only with the series on and the block switched on
    expect(decide({ games: w.games, field: w.names, switches: { ...BLOCK, series: false } }, fit)).toMatchObject({ needed: false, block: null });
    expect(decide({ games: w.games, field: w.names, switches: { ...BLOCK, matchups: false } }, fit)).toMatchObject({ needed: false, block: null });
  });
  it('the picks: fewest-played pair first, never past the target, the decks going first equally often', () => {
    const decks = ['A', 'B', 'C', 'D'];
    const met = new Map([['A\u0000B', 7]]);
    const firsts = new Map([
      ['A\u0000B\u0000A', 5],
      ['A\u0000B\u0000B', 2],
    ]);
    const picks = planBlockPicks({ decks, target: 20, met, firsts, budget: 10_000, rnd: seededRandom(1) });
    expect(picks.reduce((s, p) => s + p.games, 0)).toBe(6 * 20 - 7);
    expect(picks.every((p) => p.games <= SERIES_BATCH && p.firsts!.length === p.games)).toBe(true);
    // the pair that had games waits until the others have caught up
    expect(picks.slice(0, 5).every((p) => !(p.a === 'A' && p.b === 'B'))).toBe(true);
    const tally = new Map<string, [number, number]>();
    for (const p of picks) {
      const t = tally.get(`${p.a}|${p.b}`) ?? [0, 0];
      for (const f of p.firsts!) t[f]++;
      tally.set(`${p.a}|${p.b}`, t);
    }
    // A had gone first 5 times of 7 against B: of the 13 new games A goes first 5, B 8 (10 and 10 in all)
    expect(tally.get('A|B')).toEqual([5, 8]);
    for (const [k, t] of tally) if (k !== 'A|B') expect(t).toEqual([10, 10]);
    // a budget cuts the picks exactly; the same inputs give the same picks
    const cut = planBlockPicks({ decks, target: 20, met, firsts, budget: 25, rnd: seededRandom(1) });
    expect(cut.reduce((s, p) => s + p.games, 0)).toBe(25);
    expect(cut).toEqual(planBlockPicks({ decks, target: 20, met, firsts, budget: 25, rnd: seededRandom(1) }));
    expect(firstsOf([{ a: 'B', b: 'A', first: 0, s: 1 }, { a: 'A', b: 'B', first: 1, s: 0 }]).get('A\u0000B\u0000B')).toBe(2);
  });
  it('the run: the width first, then the block on the decks fixed when it starts, to the target, and it says so', async () => {
    const w = world(12);
    const sw = { ...BLOCK, width: 7 };
    const out = await runSeries({ run: 3, input: { games: w.games, field: w.names, switches: sw }, maxGames: 50_000, play: w.play });
    expect(out.stopped).toBe('reached');
    expect(out.before.eligible.length).toBeGreaterThan(0);
    expect(reached(out.before, out.after)).toBe(true);
    expect(out.block!.end).toMatchObject({ games: 0, done: 15 });
    const top = out.block!.start.decks;
    const all = [...w.games, ...out.games.map((g) => ({ a: g.a, b: g.b, first: g.first, s: g.winner === 0 ? 1 : 0 }))];
    for (const p of blockPairs(top, meetings(all))) expect(p.games).toBeGreaterThanOrEqual(20);
    // the block's games come last, and every one of them is a block pair
    const firstBlock = out.games.length - out.block!.start.games;
    expect(firstBlock).toBeGreaterThan(0);
    expect(out.games.slice(firstBlock).every((g) => top.includes(g.a) && top.includes(g.b))).toBe(true);
    expect(out.games.map((g) => g.seed)).toEqual(out.games.map((_, k) => seriesSeed(3, k)));
    // the same run twice is the same run; a game budget stops it in the block
    const again = await runSeries({ run: 3, input: { games: w.games, field: w.names, switches: sw }, maxGames: 50_000, play: w.play });
    expect(again).toEqual(out);
    const short = await runSeries({ run: 3, input: { games: w.games, field: w.names, switches: sw }, maxGames: firstBlock + 30, play: w.play, chunk: 30 });
    expect(short.stopped).toBe('budget');
    expect(short.games).toHaveLength(firstBlock + 30);
    expect(short.block!.end.games).toBeGreaterThan(0);
    expect(short.block!.end.games).toBeLessThan(short.block!.start.games);
  });
});
