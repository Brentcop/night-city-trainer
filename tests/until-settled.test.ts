// "Until settled" (docs/TUNING_STUDY_2026-11-13.md P4; docs/SYNERGIES.md "Until settled"): confirmStaged's `settle`
// option, the Deck Lab tuner's `untilSettled`, and the builders' flags. A confirmation still undecided at the cap goes on
// in further stages judged by the strict pooled rule, until adopted, rejected, out of reach, no gain, the run's limit or
// Stop; without the option nothing changes.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { ADOPTION_DEFAULTS, alwaysValidZ, confirmationWord, confirmStaged, DEFAULT_REACH, describeRule, judgePooled, lookZ, nomineeRecord, settleGamesFromSums, settleStages, settleWords, type PlayStage } from '../src/lib/evidence';
import { gamesToSettleSums } from '../src/lib/changeLedger';
import { SHORTLIST_DEFAULTS } from '../src/lib/shortlist';
import { settleExtra } from '../src/lib/deckSearch';
import { CARDS } from '../src/engine/cards';
import { listFingerprint } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { pooledTuneRecord, tuneDeck, tunePlan, type TuneOptions } from '../src/lib/deckLab';
import { SIM_VERSION, type GameJob, type PlayGame } from '../src/lib/tournament';
import { BrowserLedgerStore, memoryLedgerStorage } from '../src/lib/changeLedgerStore';
import { settleArgs, settleProblem, shortlistArgs, shortlistProblem } from '../scripts/evidence-flags';
import { settleNoteText } from '../src/ui/components/LabEvidence';
import { confirmOnce } from '../scripts/shortlist-sim';
import { rng as simRng, stageDraw, type Sums } from '../scripts/ledger-sim';

const RULE = ADOPTION_DEFAULTS;
const STAGE = 224;

/** One stage's paired differences: `plus` games +1, `minus` games −1, the rest the same game. */
const block = (games: number, plus: number, minus: number) => Array.from({ length: games }, (_, k) => (k < plus ? 1 : k < plus + minus ? -1 : 0));

/**
 * A scripted confirmation: `per(nominee, stage)` gives the [plus, minus] of each stage; the current list scores 0 every
 * game, a nominee its difference. Every call is kept.
 */
function scripted(per: (nominee: number, stage: number) => readonly [number, number]) {
  const calls: { stage: number; offset: number; games: number; active: number[] }[] = [];
  const play: PlayStage = async (o) => {
    calls.push({ ...o, active: [...o.active] });
    return { base: Array(o.games).fill(0), nominees: o.active.map((i) => block(o.games, ...per(i, o.stage))) };
  };
  return { play, calls };
}

/** +2.7 points a stage with SD about 0.30: undecided at the cap of 4 × 224, adopted by the pooled rule later. */
const GOOD = [13, 7] as const;
/** +1.3 points a stage: undecided at the cap, and far out of reach (it would need about 67,000 held-out games). */
const THIN = [10, 7] as const;

describe('confirmStaged until settled', () => {
  const settle = { reach: DEFAULT_REACH, maxStages: 100 };

  it('goes on after an undecided cap and adopts once all its held-out games settle it, judged as a later run would', async () => {
    const { play, calls } = scripted(() => GOOD);
    const off = await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => GOOD).play);
    expect(off.results[0]).toMatchObject({ outcome: 'inconclusive', looks: 4 });
    expect(off.results[0]!.settle).toBeUndefined();
    const on = await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, undefined, settle);
    const c = on.results[0]!;
    expect(c.outcome).toBe('adopt');
    // the same pooled look a later run would make: the first stage count at which judgePooled adopts
    const d = (k: number) => Array.from({ length: k }, () => block(STAGE, ...GOOD)).flat();
    let k = 5;
    while (judgePooled(d(k), Array(k * STAGE).fill(0), { alpha: RULE.alpha, nominees: 1, minGainPp: 1, minGames: RULE.minGames }).verdict !== 'adopt') k++;
    expect(c.looks).toBe(k);
    expect(c.settle).toEqual({ stages: k - 4, ended: 'adopt', reach: DEFAULT_REACH });
    expect(c.heldOut.games).toBe(k * STAGE);
    // the figure is the pooled always-valid interval over all its games, not the staged one
    expect(c.heldOut.z).toBeCloseTo(alwaysValidZ(k * STAGE, 0.025), 10);
    expect(c.heldOut.lower).toBeGreaterThan(0.01);
    // further stages follow on from the cap, never playing a seed twice
    expect(calls.map((x) => x.offset)).toEqual(Array.from({ length: k }, (_, s) => s * STAGE));
    expect(on.games).toBe(2 * k * STAGE);
    expect(confirmationWord(c)).toBe(`adopted (confirmed until settled: ${k - 4} more stages)`);
  });

  it('a change already out of reach at the cap plays nothing more and says what it would need', async () => {
    const { play, calls } = scripted(() => THIN);
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, undefined, settle)).results[0]!;
    expect(calls).toHaveLength(4);
    const n = 4 * STAGE;
    const need = settleGamesFromSums(n, 4 * 3, 4 * 17, { alpha: RULE.alpha, nominees: 1, minGainPp: 1, minGames: RULE.minGames });
    expect(need).toBeGreaterThan(DEFAULT_REACH);
    expect(c).toMatchObject({ outcome: 'inconclusive', looks: 4, settle: { stages: 0, ended: 'out-of-reach', toSettle: need } });
    // nothing more was played, so the figure is still the staged one
    expect(c.heldOut.z).toBeCloseTo(lookZ(RULE), 10);
    expect(settleWords(c.settle!, n)).toBe(`not continued: out of reach, it would need about ${need.toLocaleString('en-US')} held-out games in all (the reach is 10,000)`);
    // the ledger's gamesToSettle is the same computation
    expect(gamesToSettleSums(n, 12, 68, RULE)).toBe(need);
    // a mean barely above the bar would need hundreds of millions of games: the words stop at ten times the reach
    expect(settleWords({ stages: 0, ended: 'out-of-reach', toSettle: 419_638_967, reach: 10_000 }, n)).toBe('not continued: out of reach, it would need more than 100,000 held-out games in all (the reach is 10,000)');
    expect(settleWords({ stages: 3, ended: 'out-of-reach', toSettle: 100_000, reach: 10_000 }, n)).toBe('kept confirming for 3 more stages, then stopped: out of reach, it would need about 100,000 held-out games in all (the reach is 10,000)');
  });

  it('stops at the run’s limit and says how far it still is from settling', async () => {
    const { play, calls } = scripted(() => GOOD);
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, undefined, { reach: DEFAULT_REACH, maxStages: 3 })).results[0]!;
    expect(calls).toHaveLength(7);
    expect(c.outcome).toBe('inconclusive');
    expect(c.settle).toMatchObject({ stages: 3, ended: 'limit' });
    expect(c.settle!.toSettle).toBeGreaterThan(7 * STAGE);
    expect(c.heldOut.games).toBe(7 * STAGE);
    expect(confirmationWord(c)).toMatch(/^could not tell \(kept confirming for 3 more stages, up to this run's limit; about [\d,]+ more held-out games may settle it\)$/);
    // a limit of 0: nothing more is played, the record says so
    const none = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => GOOD).play, undefined, undefined, { reach: DEFAULT_REACH, maxStages: 0 })).results[0]!;
    expect(none.settle).toMatchObject({ stages: 0, ended: 'limit' });
  });

  it('rejects when a further stage puts the pooled upper bound below the bar', async () => {
    const { play } = scripted((_, s) => (s < 4 ? GOOD : [0, 150]));
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, undefined, settle)).results[0]!;
    expect(c).toMatchObject({ outcome: 'reject', looks: 5, settle: { stages: 1, ended: 'reject' } });
    expect(c.heldOut.upper).toBeLessThan(0.01);
    expect(c.stopped).toBeUndefined();
  });

  it('stops for no gain when the futility rule fires on the pooled mean', async () => {
    // after the cap a stage that brings the pooled mean to exactly 0, not low enough to reject
    const { play } = scripted((_, s) => (s < 4 ? GOOD : [0, 24]));
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, undefined, settle)).results[0]!;
    expect(c).toMatchObject({ outcome: 'inconclusive', looks: 5, stopped: 'futility', settle: { stages: 1, ended: 'futility' } });
    expect(c.heldOut.mean).toBe(0);
    expect(confirmationWord(c)).toBe('could not tell (kept confirming for 1 more stage, then stopped: no gain after 1,120 games)');
  });

  it('a pooled confirmation (earlier games) goes on the same way, its earlier games counted', async () => {
    const prior = { base: Array(448).fill(0), cand: [...block(224, ...GOOD), ...block(224, ...GOOD)] };
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => GOOD).play, undefined, [prior], settle)).results[0]!;
    expect(c.priorGames).toBe(448);
    expect(c.outcome).toBe('adopt');
    // the first confirmation needed k stages in all; with 448 earlier games it needs 2 fewer new ones
    const first = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => GOOD).play, undefined, undefined, settle)).results[0]!;
    expect(c.looks).toBe(first.looks - 2);
    expect(c.settle).toMatchObject({ ended: 'adopt', stages: first.looks - 2 - 4 });
    expect(c.heldOut.games).toBe(first.heldOut.games);
  });

  it('two nominees: the one decided goes no further; the undecided one goes on by itself, the list playing each stage once', async () => {
    // nominee 0 is adopted early (+8 points a stage), nominee 1 is GOOD, nominee 2 shows no gain and stops for futility
    const per = (i: number) => (i === 0 ? ([30, 12] as const) : i === 1 ? GOOD : ([5, 5] as const));
    const { play, calls } = scripted(per);
    const on = await confirmStaged(RULE, [{ minGainPp: 1 }, { minGainPp: 1 }, { minGainPp: 1 }], STAGE, play, undefined, undefined, settle);
    const off = await confirmStaged(RULE, [{ minGainPp: 1 }, { minGainPp: 1 }, { minGainPp: 1 }], STAGE, scripted(per).play);
    // the decided and the stopped ones are exactly as without the option
    expect(on.results[0]).toEqual(off.results[0]);
    expect(on.results[2]).toEqual(off.results[2]);
    expect(on.results[2]!.stopped).toBe('futility');
    expect(on.results[1]!.settle!.stages).toBeGreaterThan(0);
    // further stages are played for nominee 1 alone
    const further = calls.filter((x) => x.stage >= 4);
    expect(further.length).toBe(on.results[1]!.settle!.stages);
    for (const x of further) expect(x.active).toEqual([1]);
  });

  it('off equals now: no settle field, no further stage; and on, nothing changes for a nominee decided by the cap', async () => {
    const strong = await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => [30, 12]).play);
    const strongOn = await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => [30, 12]).play, undefined, undefined, settle);
    expect(strongOn).toEqual(strong);
    const { play, calls } = scripted(() => GOOD);
    const off = await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play);
    expect(calls).toHaveLength(4);
    expect(Object.keys(off.results[0]!)).not.toContain('settle');
    // under any-gain the option does nothing
    const legacy = await confirmStaged({ ...RULE, kind: 'any-gain', capStages: 1 }, [{ minGainPp: 0 }], STAGE, scripted(() => THIN).play, undefined, undefined, settle);
    expect(legacy.results[0]!.settle).toBeUndefined();
  });

  it('Stop: a nominee going on ends as stopped, with the stages it played', async () => {
    let stops = 0;
    const { play, calls } = scripted(() => GOOD);
    // Stop is asked before stages 2–4 and before each further stage: stop before the third further one
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, () => ++stops > 5, undefined, settle)).results[0]!;
    expect(calls).toHaveLength(6);
    expect(c).toMatchObject({ outcome: 'inconclusive', stopped: true, looks: 6, settle: { stages: 2, ended: 'stop' } });
    expect(confirmationWord(c)).toBe('could not tell (kept confirming for 2 more stages, then stopped)');
    // Stop at the cap, before any further stage: the nominee keeps its capped result and says why it did not go on
    let early = 0;
    const atCap = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => GOOD).play, () => ++early > 3, undefined, settle)).results[0]!;
    expect(atCap).toMatchObject({ outcome: 'inconclusive', looks: 4, settle: { stages: 0, ended: 'stop' } });
    expect(confirmationWord(atCap)).toBe('could not tell (not continued: the run was stopped)');
  });

  it('records: the nominee record carries it; the words wrap into a note for the Lab', async () => {
    const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, scripted(() => THIN).play, undefined, undefined, settle)).results[0]!;
    const rec = nomineeRecord('−1 A → +1 B', { games: 112, mean: 0.03, lower: -0.01, upper: 0.07, z: 1.96 }, c);
    expect(rec.settle).toEqual(c.settle);
    expect(settleNoteText(c.settle!, c.heldOut.games)).toMatch(/^Not continued: out of reach, it would need about [\d,]+ held-out games in all \(the reach is 10,000\)\.$/);
  });

  it('the rule line says it when on, and nothing changes when off', () => {
    const off = describeRule(RULE, { firstStage: 224 });
    expect(describeRule(RULE, { firstStage: 224, untilSettled: undefined })).toBe(off);
    expect(describeRule(RULE, { firstStage: 224, untilSettled: { reach: 10_000 } })).toMatch(new RegExp(`^${off.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}; until settled: .*10,000 held-out games in all`));
  });

  it('one reach for the shortlist and "until settled"; the further stages the seeds and the reach allow', () => {
    expect(SHORTLIST_DEFAULTS.reach).toBe(DEFAULT_REACH);
    // the Lab at Standard: 5,000 seeds a generation, stages of 224 → 22 stages, 18 after the cap
    expect(settleStages({ seedStages: Math.floor(5000 / 224) - 4, reach: DEFAULT_REACH, firstStage: 224, capStages: 4 })).toBe(18);
    // the forge default: the reach binds first, (10,000 − 1,120) / 280 + 1
    expect(settleStages({ seedStages: Math.floor(50_000 / 280) - 4, reach: DEFAULT_REACH, firstStage: 280, capStages: 4 })).toBe(32);
    expect(settleExtra({ gens: 2, firstStage: 280, stages: 32, nominees: 1 })).toBe(2 * 32 * 280 * 2);
  });
});

describe('a change exactly at the bar is not adopted more often than the strict rule allows', () => {
  /** mulberry32 */
  function rng(seed: number) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const draw =
    (r: () => number, mu: number, sd: number): PlayStage =>
    async ({ games, active }) => {
      const pNZ = sd * sd + mu * mu;
      const pPlus = (pNZ + mu) / 2 / pNZ;
      return { base: Array(games).fill(0), nominees: active.map(() => Array.from({ length: games }, () => (r() < pNZ ? (r() < pPlus ? 1 : -1) : 0))) };
    };
  it('true gain +1 point (the bar), SD 0.24, stages of 224: under α/2 for the first confirmation plus α/2 for every pooled look (5%)', async () => {
    const runs = 3000;
    let off = 0;
    let on = 0;
    const ro = rng(7);
    const rn = rng(7);
    for (let i = 0; i < runs; i++) {
      if ((await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, draw(ro, 0.01, 0.24))).results[0]!.outcome === 'adopt') off++;
      if ((await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, draw(rn, 0.01, 0.24), undefined, undefined, { reach: DEFAULT_REACH, maxStages: 1000 })).results[0]!.outcome === 'adopt') on++;
    }
    // the first confirmation alone stays under α/2 = 2.5%; with the pooled looks after it, under α = 5%
    expect(off / runs).toBeLessThan(0.025);
    expect(on / runs).toBeLessThan(0.05);
    expect(on).toBeGreaterThanOrEqual(off);
  }, 60_000);
});

describe('the simulation (scripts/shortlist-sim.ts)', () => {
  it('decides "until settled" as confirmStaged does on the same games, first and pooled confirmations', async () => {
    const limit = { reach: DEFAULT_REACH, maxStages: settleStages({ seedStages: Math.floor(50_000 / STAGE) - 4, reach: DEFAULT_REACH, firstStage: STAGE, capStages: 4 }) };
    const ends = new Set<string>();
    for (const [mu, sd, priorStages] of [
      [0.02, 0.24, 0],
      [0.015, 0.3, 0],
      [0.03, 0.35, 0],
      [0.02, 0.24, 2],
      [0.005, 0.24, 3],
    ] as const)
      for (let life = 0; life < 30; life++) {
        const r = simRng(1000 * life + Math.round(mu * 1e4) + priorStages);
        const next = stageDraw(r, STAGE, mu, sd);
        const prior: Sums[] = Array.from({ length: priorStages }, () => next());
        const priorSums = prior.reduce((a, s) => ({ n: a.n + s.n, sum: a.sum + s.sum, sq: a.sq + s.sq }), { n: 0, sum: 0, sq: 0 });
        const draws: Sums[] = [];
        const sim = confirmOnce(RULE, STAGE, priorSums, () => {
          const s = next();
          draws.push(s);
          return s;
        }, limit);
        // the same stages, game for game in any order (every look depends only on the count, Σd and Σd²)
        const expand = (s: Sums) => block(s.n, (s.sq + s.sum) / 2, (s.sq - s.sum) / 2);
        let i = 0;
        const play: PlayStage = async ({ games, active }) => {
          const s = draws[i++]!;
          return { base: Array(games).fill(0), nominees: active.map(() => expand(s)) };
        };
        const priorArr = prior.length ? [{ base: Array(priorSums.n).fill(0), cand: prior.flatMap(expand) }] : undefined;
        const c = (await confirmStaged(RULE, [{ minGainPp: 1 }], STAGE, play, undefined, priorArr, limit)).results[0]!;
        expect(c.outcome).toBe(sim.outcome);
        expect(i).toBe(draws.length);
        expect(c.settle?.ended).toBe(sim.settle?.ended);
        expect(c.settle?.stages).toBe(sim.settle?.stages);
        if (sim.settle) ends.add(sim.settle.ended);
      }
    // the cases go on and end both ways that matter most
    expect(ends.has('adopt') && ends.has('out-of-reach')).toBe(true);
  });
});

// ---------------------------------------------------------------- the Deck Lab tuner

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green']), anyDeck('C', ['Blue', 'Red'])];
const changes = (d: DeckList) => {
  const left = [...start.main];
  let n = 0;
  for (const id of d.main) {
    const i = left.indexOf(id);
    if (i >= 0) left.splice(i, 1);
    else n++;
  }
  return n;
};
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Paired fake games: one uniform number per game for every list; a win below 50% + perChange per changed card. */
const fake =
  (perChange: number): PlayGame =>
  async (j: GameJob) => {
    const u = unit(`g:${j.seed}:${j.b.name}:${j.first}`);
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: u < 0.5 + perChange * changes(j.a) ? 0 : 1 };
  };
const OPTS: TuneOptions = { games: 56, gens: 1, cands: 3, bot: 'easy', minGain: -1, seedBase: 500_000 };
const run = (o: TuneOptions, play: PlayGame) => tuneDeck(start, field, o, play, () => undefined, () => false);

describe('the tuner until settled', () => {
  it('a confirmation that goes on and settles: adopted, the log and saved record say so', async () => {
    const off = await run(OPTS, fake(0.02));
    expect(off.logs[0]!.nominees![0]).toMatchObject({ outcome: 'inconclusive', heldOut: { games: 448, looks: 4 } });
    const on = await run({ ...OPTS, untilSettled: {} }, fake(0.02));
    const l = on.logs[0]!;
    const n = l.nominees![0]!;
    expect(n.outcome).toBe('adopt');
    expect(n.settle).toMatchObject({ ended: 'adopt', reach: DEFAULT_REACH });
    expect(n.heldOut!.looks).toBe(4 + n.settle!.stages);
    expect(l.adopted).toBe(n.label);
    expect(l.adoptedSettle).toEqual(n.settle);
    const record = pooledTuneRecord({ original: start, final: on.deck, logs: on.logs, partial: false, gens: 1, rule: { rule: 'evidence', minGainPp: 1, packageMinGainPp: 1, alpha: 0.05, correction: 'obrien-fleming', capStages: 4, minGames: 200, firstStage: 112, nominees: 1, cardsPerChange: 1, packagesPerChange: 1, untilSettled: { reach: DEFAULT_REACH } }, manifest: null, bot: 'easy', fieldMode: 'test', fieldDeckIds: [], partnerAware: false, date: '2026-11-15' });
    expect(record.changes[0]!.heldOut!.settle).toEqual(n.settle);
    // without the option the record has no settle field (the record is tunedRecord's)
    expect(JSON.stringify(pooledTuneRecord({ original: start, final: off.deck, logs: off.logs, partial: false, gens: 1, rule: record.rule, manifest: null, bot: 'easy', fieldMode: 'test', fieldDeckIds: [], partnerAware: false, date: '2026-11-15' }))).not.toMatch(/settle/);
  });

  it('never plays a seed twice or reaches into the next generation’s seeds, and stops at its limit', async () => {
    const seen = new Map<string, number>();
    // +1.4 points: a changed list wins 3 seeds in every 210 that the list loses (from 515,000, the first confirmation
    // seed, on; an SD of 0.12): within reach of 10,000 held-out games (about 7,600 needed), more than one generation's seeds
    const special = (j: GameJob) => (j.seed + 130) % 210 < 3;
    const play: PlayGame = async (j) => {
      const u = unit(`g:${j.seed}:${j.b.name}:${j.first}`);
      const win = changes(j.a) ? u < 0.5 || special(j) : u < 0.5 && !special(j);
      return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: win ? 0 : 1 };
    };
    const gen1: number[] = [];
    const tracked: PlayGame = (j) => {
      const key = `${j.seed}|${j.a.main.join()}|${j.a.legends.join()}|${j.b.name}|${j.first}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (j.seed < 520_000) gen1.push(j.seed);
      return play(j);
    };
    const end = await tuneDeck(start, field, { ...OPTS, gens: 2, untilSettled: {} }, tracked, () => undefined, () => false);
    const n = end.logs[0]!.nominees![0]!;
    expect(n.settle).toMatchObject({ ended: 'limit', stages: Math.floor(5000 / 112) - 4 });
    expect([...seen.values()].every((x) => x === 1)).toBe(true);
    // generation 1 plays seeds 510,000 on, confirmation from 515,000, never 520,000 (generation 2's first seed) or past it
    expect(Math.max(...gen1)).toBeLessThan(520_000);
    expect(Math.max(...gen1)).toBe(515_000 + Math.floor(5000 / 112) * 112 - 1);
    // the progress total includes what "until settled" may add, so the bar never runs past the end
    expect(end.total).toBe(tunePlan({ ...OPTS, gens: 2, untilSettled: {} }).estimate.max + tunePlan({ ...OPTS, gens: 2, untilSettled: {} }).settle!.extra);
    expect(end.played).toBeLessThanOrEqual(end.total);
  });

  it('with earlier held-out games every further stage is recorded; a repeat decides the same way and adds nothing', async () => {
    const store = new BrowserLedgerStore(memoryLedgerStorage());
    const o: TuneOptions = { ...OPTS, untilSettled: {}, ledger: { store, run: 'r', date: '2026-11-15' } };
    const end = await run(o, fake(0.02));
    const n = end.logs[0]!.nominees![0]!;
    expect(end.ledger!.heldout.written).toBe(n.heldOut!.games);
    expect(n.heldOut!.games).toBeGreaterThan(448);
    expect((await store.counts(SIM_VERSION)).heldout).toBe(n.heldOut!.games);
    await store.load(listFingerprint(start));
    // the same run again: its own games (to the limit) are left out of the prior, so it decides alike and adds nothing
    const again = await run(o, fake(0.02));
    expect(again.logs).toEqual(end.logs);
    expect(again.ledger!.heldout.written).toBe(0);
  });

  it('refuses the option under any-gain', async () => {
    await expect(run({ ...OPTS, rule: { kind: 'any-gain' }, untilSettled: {} }, fake(0.02))).rejects.toThrow(/until settled/);
  });
});

// ---------------------------------------------------------------- the flags

describe('the flags (scripts/evidence-flags.ts)', () => {
  const ev = { kind: 'evidence' as const };
  it('--until-settled needs the evidence rule; --reach belongs to it and to the shortlist', () => {
    expect(settleProblem({ 'until-settled': true }, { rule: ev })).toBeNull();
    expect(settleProblem({ 'until-settled': true }, { rule: { kind: 'any-gain' } })).toMatch(/needs the evidence rule/);
    expect(settleProblem({}, { rule: { kind: 'any-gain' } })).toBeNull();
    // --reach without --pooled-ranking is fine with --until-settled, refused when neither is on
    expect(shortlistProblem({ reach: 9000, 'until-settled': true }, { ledger: false, rule: ev })).toBeNull();
    expect(shortlistProblem({ reach: 9000 }, { ledger: false, rule: ev })).toBe('--reach needs --pooled-ranking or --until-settled');
    expect(shortlistProblem({ carry: 3, reach: 9000, 'until-settled': true }, { ledger: true, rule: ev })).toBe('--carry needs --pooled-ranking');
    // the season passes them on, --reach once
    expect(settleArgs({})).toEqual([]);
    expect(settleArgs({ 'until-settled': true })).toEqual(['--until-settled']);
    expect(settleArgs({ 'until-settled': true, reach: 9000 })).toEqual(['--until-settled', '--reach', '9000']);
    expect([...shortlistArgs({ 'pooled-ranking': true, reach: 9000 }), ...settleArgs({ 'pooled-ranking': true, 'until-settled': true, reach: 9000 })]).toEqual(['--pooled-ranking', '--reach', '9000', '--until-settled']);
  });

  it('the forge exits 2 on --until-settled under --adopt any-gain; the optimizer on --reach alone; both list it in --help', () => {
    const forge = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/forge.ts', 's2-05', '--until-settled', '--adopt', 'any-gain'], { encoding: 'utf8' });
    expect(forge.status).toBe(2);
    expect(forge.stderr).toMatch(/--until-settled needs the evidence rule/);
    const opt = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/optimize.ts', 's2-05', '--reach', '5000'], { encoding: 'utf8' });
    expect(opt.status).toBe(2);
    expect(opt.stderr).toMatch(/--reach needs --until-settled/);
    for (const s of ['forge', 'optimize', 'season']) {
      const h = spawnSync(process.execPath, ['--import', 'tsx', `scripts/${s}.ts`, '--help'], { encoding: 'utf8' });
      expect(h.stdout).toMatch(/--until-settled/);
    }
  }, 120_000);
});

