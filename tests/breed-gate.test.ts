// A bred deck's test against its parent (src/lib/breedGate.ts; docs/SYNERGIES.md "A bred deck's test against its
// parent"), with a fake play function: no game is played here. The rule (a planted deficit is shown worse and kept out,
// an equal deck is "could not tell" and enters, a planted gain is shown better and stops early, the futility stop never
// fires), the references (best parent, explorers' middle meta deck), a shared reference played once, the confirming bot
// only for decks not shown worse, the seeds and slots; then by simulation the error rate with no real difference and
// the detect line's 8-in-10 figure against a Monte-Carlo of the rule itself. Last, the module stays light, out of the
// entry chunk with the bred decks' words (src/lib/bredDecks.ts), which the Seasons page reads without the gate's statistics.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { DeckList } from '../src/engine/types';
import { ADOPTION_DEFAULTS, confirmStaged, type PlayStage } from '../src/lib/evidence';
import {
  chooseReference,
  confirmBotOf,
  enteredWords,
  gateDetectable,
  gateDetectWords,
  gateField,
  gateGuaranteeWords,
  gateRule,
  gateRuleWords,
  gateSeeds,
  gateStageGames,
  gateWords,
  GATE_DEFAULTS,
  GATE_SD,
  gateSd,
  middleMeta,
  planGate,
  spreadAssumedWords,
  runGate,
  type GateEntry,
  type GateOptions,
  type GatePlay,
  type GatePlayRequest,
} from '../src/lib/breedGate';

const deck = (name: string, n: number): DeckList => ({ name, legends: [`legend_${n}`], main: [`card_${n}`, `card_${n}`], sideboard: [] });
const META = Array.from({ length: 7 }, (_, i) => deck(`Meta ${i + 1}`, i + 1));
/** strength order: Meta 3, Meta 1, Meta 7, Meta 5, Meta 2, Meta 6, Meta 4 (Meta 5 is the 4th) */
const RANKED = [3, 1, 7, 5, 2, 6, 4].map((i, k) => ({ deck: META[i - 1]!, wr: 0.7 - k * 0.02 }));

/** A deterministic number in [0, 1) from a string. */
function unit(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

/**
 * A fake play function. Every list wins game k when one common number for the deal (seed, opponent, seat) is below its
 * strength, so two lists differ only where that number falls between their strengths: the paired difference has mean
 * (deck strength − reference strength). "Alternating" lists win exactly the games their reference loses and lose the
 * ones it wins, by the parity of k, so every stage has mean difference exactly 0 with a spread of 1.
 */
function fakePlay(strength: (name: string, bot: string) => number, calls: GatePlayRequest[] = []): GatePlay {
  return async (r) => {
    calls.push(r);
    return Array.from({ length: r.games }, (_, k) => {
      const opp = r.field[k % r.field.length]!.name;
      const first = Math.floor(k / r.field.length) % 2;
      if (r.deck.name.startsWith('Alternating')) return k % 2;
      if (r.role === 'reference' && r.deck.name.startsWith('AltRef')) return 1 - (k % 2);
      return unit(`${r.seed0 + k}:${opp}:${first}:${r.bot}`) < strength(r.deck.name, r.bot) ? 1 : 0;
    });
  };
}

const OPTS: GateOptions = { bot: 'medium', confirmBot: 'hard', rounds: 20, stages: 5, confirmStages: 2, seeds: gateSeeds(3) };
const entry = (d: DeckList, ref: DeckList, why: GateEntry['referenceWhy'] = 'best-parent'): GateEntry => ({ deck: d, reference: ref, referenceWhy: why, parents: [ref.name], field: gateField(META, ref, d) });

describe('the rule, with a fake play function', () => {
  it('is the staged rule with the bar at 0, no futility stop, no minimum games, O’Brien–Fleming over five looks', () => {
    const r = gateRule(5);
    expect(r).toMatchObject({ kind: 'evidence', minGainPp: 0, packageMinGainPp: 0, alpha: 0.05, boundary: 'obrien-fleming', capStages: 5, minGames: 0, futilityAfterStages: 0 });
    expect(GATE_DEFAULTS).toEqual({ bot: 'medium', confirmBot: 'hard', rounds: 20, stages: 5, confirmStages: 2, alpha: 0.05 });
    expect(gateStageGames(20, 7)).toBe(280);
    expect(gateStageGames(20, 6)).toBe(240);
    expect(gateSeeds(3)).toEqual({ first: 3_700_000, confirm: 3_800_000 });
  });

  it('a planted deficit is shown worse and kept out; the confirming bot does not play for it', async () => {
    const calls: GatePlayRequest[] = [];
    const ref = META[0]!;
    const [r] = await runGate([entry(deck('Weak', 20), ref)], OPTS, fakePlay((n) => (n === 'Weak' ? 0.35 : 0.6), calls));
    expect(r!.first.verdict).toBe('shown-worse');
    expect(r!.first.judged.upper).toBeLessThan(0);
    expect(r!.entered).toBe(false);
    expect(r!.confirm).toBeNull();
    expect(r!.confirmSkipped).toBe('shown-worse');
    expect(calls.some((c) => c.bot === 'hard')).toBe(false);
    expect(gateWords(r!)).toMatch(/^kept out: shown worse than Meta 1 \(best parent\) with the Medium bot/);
  });

  it('an equal deck is "could not tell" by both bots, plays every stage (the futility stop never fires) and enters', async () => {
    const calls: GatePlayRequest[] = [];
    const ref = deck('AltRef', 30);
    const e: GateEntry = { deck: deck('Alternating', 31), reference: ref, referenceWhy: 'explorer', parents: [], field: META.slice(0, 7) };
    const [r] = await runGate([e], OPTS, fakePlay(() => 0.5, calls));
    expect(r!.first).toMatchObject({ verdict: 'could-not-tell', looks: 5 });
    expect(r!.first.judged.mean).toBe(0);
    expect(r!.first.judged.games).toBe(5 * 280);
    expect(r!.first.stopped).toBeUndefined();
    expect(r!.confirm).toMatchObject({ verdict: 'could-not-tell', looks: 2, bot: 'hard' });
    expect(r!.entered).toBe(true);
    // the words never say it is as good as its reference
    expect(gateWords(r!)).toMatch(/^entered: not shown worse than AltRef \(explorer: the middle meta deck\)/);
    expect(gateWords(r!)).not.toMatch(/as good|equal|no worse/);
    // the same games under the forge's default rule (futility after 2 stages at a mean of 0 or less) would have stopped
    const stage: PlayStage = async ({ games }) => ({ base: Array.from({ length: games }, (_, k) => 1 - (k % 2)), nominees: [Array.from({ length: games }, (_, k) => k % 2)] });
    const forgeRule = await confirmStaged({ ...ADOPTION_DEFAULTS, minGainPp: 0 }, [{ minGainPp: 0 }], 280, stage);
    expect(forgeRule.results[0]!.stopped).toBe('futility');
    expect(forgeRule.results[0]!.looks).toBe(2);
  });

  it('a planted gain is shown better and stops at the first look', async () => {
    const calls: GatePlayRequest[] = [];
    const [r] = await runGate([entry(deck('Strong', 21), META[0]!)], OPTS, fakePlay((n) => (n === 'Strong' ? 0.8 : 0.5), calls));
    expect(r!.first).toMatchObject({ verdict: 'shown-better', looks: 1 });
    expect(r!.first.judged.lower).toBeGreaterThan(0);
    expect(calls.filter((c) => c.bot === 'medium')).toHaveLength(2);
    expect(r!.confirm).toMatchObject({ verdict: 'shown-better', looks: 1 });
    expect(r!.entered).toBe(true);
  });

  it('a deck the confirming bot shows worse is kept out; one the first bot cannot tell about goes on to it', async () => {
    const strength = (n: string, bot: string) => (n === 'HardWeak' && bot === 'hard' ? 0.3 : 0.55);
    const [r] = await runGate([entry(deck('HardWeak', 22), META[0]!)], OPTS, fakePlay(strength));
    expect(r!.first.verdict).not.toBe('shown-worse');
    expect(r!.confirm!.verdict).toBe('shown-worse');
    expect(r!.entered).toBe(false);
    expect(gateWords(r!)).toMatch(/^kept out: shown worse than Meta 1 \(best parent\) with the Hard bot/);
  });

  it('the seeds and slots are the rule’s: stage k from seed + k · stage games, the field without the reference or the deck', async () => {
    const calls: GatePlayRequest[] = [];
    const ref = META[2]!;
    await runGate([entry(deck('Alternating', 40), ref)], { ...OPTS, rounds: 2 }, fakePlay(() => 0.5, calls));
    const field = META.filter((m) => m !== ref);
    expect(calls.every((c) => c.field.length === 6 && c.field.every((f, i) => f === field[i]))).toBe(true);
    const games = gateStageGames(2, 6);
    const first = calls.filter((c) => c.bot === 'medium');
    const conf = calls.filter((c) => c.bot === 'hard');
    expect([...new Set(first.map((c) => c.seed0))]).toEqual([0, 1, 2, 3, 4].map((k) => 3_700_000 + k * games));
    expect([...new Set(conf.map((c) => c.seed0))]).toEqual([0, 1].map((k) => 3_800_000 + k * games));
    expect(calls.every((c) => c.games === games)).toBe(true);
  });

  it('a reference shared by several decks plays each block once', async () => {
    const calls: GatePlayRequest[] = [];
    const ref = META[0]!;
    const out = await runGate([entry(deck('Alternating A', 50), ref), entry(deck('Alternating B', 51), ref), entry(deck('Alternating C', 52), META[1]!)], OPTS, fakePlay(() => 0.5, calls));
    expect(out.map((r) => r.reference.name)).toEqual(['Meta 1', 'Meta 1', 'Meta 2']);
    const refCalls = calls.filter((c) => c.role === 'reference');
    // 5 Medium stages and 2 Hard stages for each of the two references, each block once
    expect(refCalls).toHaveLength(2 * (5 + 2));
    const keys = refCalls.map((c) => `${c.deck.name}|${c.bot}|${c.seed0}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(calls.filter((c) => c.role === 'deck')).toHaveLength(3 * (5 + 2));
  });

  it('no confirming bot: none, or the first bot under another name', async () => {
    expect(confirmBotOf('medium', 'lookahead')).toBeNull();
    expect(confirmBotOf('medium', 'none')).toBeNull();
    expect(confirmBotOf('medium', null)).toBeNull();
    expect(confirmBotOf('medium', 'hard')).toBe('hard');
    for (const confirmBot of ['lookahead', null]) {
      const calls: GatePlayRequest[] = [];
      const [r] = await runGate([entry(deck('Alternating', 60), META[0]!)], { ...OPTS, confirmBot }, fakePlay(() => 0.5, calls));
      expect(calls.every((c) => c.bot === 'medium')).toBe(true);
      expect(r).toMatchObject({ confirm: null, confirmSkipped: 'none', entered: true });
    }
  });

  it('with every stage played, the verdict is still where the rule would have stopped', async () => {
    const calls: GatePlayRequest[] = [];
    const [r] = await runGate([entry(deck('Weak', 70), META[0]!)], { ...OPTS, fullStages: true }, fakePlay((n) => (n === 'Weak' ? 0.35 : 0.6), calls));
    expect(r!.first).toMatchObject({ verdict: 'shown-worse', looks: 1 });
    expect(r!.first.judged.games).toBe(240);
    expect(r!.first.played).toMatchObject({ stages: 5, games: 1200 });
    // the confirming bot played too, but does not count: the rule plays it only for a deck not shown worse
    expect(r!.confirm).toMatchObject({ bot: 'hard' });
    expect(r!.confirmSkipped).toBe('shown-worse');
    expect(r!.entered).toBe(false);
    expect(calls.filter((c) => c.role === 'deck')).toHaveLength(5 + 2);
    // the per-opponent figures cover every game played
    expect(r!.first.byOpp.reduce((s, o) => s + o.games, 0)).toBe(1200);
    expect(r!.first.byOpp).toHaveLength(6);
  });

  it('Stop before the rule decides: not entered, and said so', async () => {
    let n = 0;
    const [r] = await runGate([entry(deck('Alternating', 80), META[0]!)], { ...OPTS, stop: () => ++n > 1 }, fakePlay(() => 0.5));
    expect(r!.entered).toBe(false);
    expect(r!.stopped).toBe(true);
    expect(gateWords(r!)).toMatch(/^not entered: stopped before the test against Meta 1/);
  });
});

describe('references', () => {
  it('a bred deck’s reference is its parent ranked highest by strength', () => {
    const ranked = [{ deck: deck('P2', 92), wr: 0.6 }, { deck: deck('P1', 91), wr: 0.55 }, ...RANKED];
    expect(chooseReference(['P1', 'P2'], ranked, META)).toMatchObject({ deck: { name: 'P2' }, why: 'best-parent' });
    expect(chooseReference(['Meta 4', 'P1'], ranked, META)).toMatchObject({ deck: { name: 'P1' }, why: 'best-parent' });
  });

  it('an explorer’s is the middle meta deck by strength (the 4th of 7); a deck with no parent ranked is treated so, and said so', () => {
    expect(middleMeta(META, RANKED).name).toBe('Meta 5');
    expect(chooseReference([], RANKED, META)).toMatchObject({ deck: { name: 'Meta 5' }, why: 'explorer' });
    expect(chooseReference(['Gone'], RANKED, META)).toMatchObject({ deck: { name: 'Meta 5' }, why: 'no-parent-available' });
    const plan = planGate([{ deck: deck('E', 99), parents: [] }, { deck: deck('M', 98), parents: ['Meta 7'] }], RANKED, META);
    expect(plan.map((p) => [p.reference.name, p.field.length])).toEqual([
      ['Meta 5', 6],
      ['Meta 7', 6],
    ]);
    expect(plan[1]!.field.map((f) => f.name)).not.toContain('Meta 7');
  });

  it('with the reference mode "middle", every bred deck is tested against the middle meta deck; explorers keep their reason', () => {
    const bred = [
      { deck: deck('E', 99), parents: [] },
      { deck: deck('M', 98), parents: ['Meta 7'] },
      { deck: deck('G', 95), parents: ['Gone'] },
    ];
    const parent = planGate(bred, RANKED, META, 'parent');
    expect(parent.map((p) => [p.reference.name, p.referenceWhy])).toEqual([
      ['Meta 5', 'explorer'],
      ['Meta 7', 'best-parent'],
      ['Meta 5', 'no-parent-available'],
    ]);
    // the default is the parent: the rule as declared
    expect(planGate(bred, RANKED, META)).toEqual(parent);
    const middle = planGate(bred, RANKED, META, 'middle');
    expect(middle.map((p) => [p.reference.name, p.referenceWhy, p.field.length])).toEqual([
      ['Meta 5', 'explorer', 6],
      ['Meta 5', 'fixed-bar', 6],
      ['Meta 5', 'fixed-bar', 6],
    ]);
    expect(middle[1]!.field.map((f) => f.name)).not.toContain('Meta 5');
    expect(chooseReference(['Meta 7'], RANKED, META, 'middle')).toMatchObject({ deck: { name: 'Meta 5' }, why: 'fixed-bar' });
  });

  it('a bred deck whose parent is no meta deck plays all 7', () => {
    const p = deck('Parent', 97);
    const [e] = planGate([{ deck: deck('Child', 96), parents: ['Parent'] }], [{ deck: p, wr: 0.9 }, ...RANKED], META);
    expect(e!.field).toHaveLength(7);
  });
});

describe('the words', () => {
  it('say the rule, the guarantee and what it detects', () => {
    expect(gateRuleWords(OPTS)).toContain('up to 5 stages with the Medium bot (z 4.88, 3.36, 2.68, 2.29, 2.03)');
    expect(gateRuleWords(OPTS)).toContain('up to 2 stages with the Hard bot on its own seeds (z 2.96, 1.97)');
    expect(gateRuleWords(OPTS)).toContain('could not tell enters');
    expect(gateRuleWords(OPTS)).toContain('each bred deck plays its reference (its best parent; an explorer, the middle meta deck by strength) on the same games');
    expect(gateRuleWords({ ...OPTS, reference: 'middle' })).toContain('each bred deck plays the middle meta deck by strength, the same fixed bar for every bred deck (the reference an explorer gets; this run does not test against the parents) on the same games');
    expect(gateGuaranteeWords()).toBe('A bred deck that is truly no worse than its reference is kept out about 2.5% of the time or less by each bot.');
    const d = gateDetectWords({ ...OPTS, opponents: [7, 6, 7] });
    expect(d).toBe(
      'What it can detect: with 7 opponents (stages of 280 games) the Medium bot shows a deck worse 8 times in 10 when it is really 4.5 points worse, the Hard bot with its 2 stages when it is 7.1 points worse; ' +
        'with 6 opponents (stages of 240 games) the Medium bot shows a deck worse 8 times in 10 when it is really 4.8 points worse, the Hard bot with its 2 stages when it is 7.7 points worse. ' +
        'It assumes a per-game spread of 0.59 with the Medium bot and 0.60 with the Hard bot for two different decks, measured on the recorded bred decks.',
    );
    // without a confirming bot, only the first bot's spread is named
    expect(gateDetectWords({ ...OPTS, confirmBot: null, opponents: [7] })).toMatch(/It assumes a per-game spread of 0\.59 with the Medium bot for two different decks, measured on the recorded bred decks\.$/);
    expect(enteredWords(8, 5)).toBe('8 bred, 5 entered');
  });

  it('the spread is per bot, by canonical name; a bot that was not measured takes Hard\u2019s and is said so', () => {
    expect(GATE_SD).toEqual({ medium: 0.59, hard: 0.6, other: 0.6 });
    expect([gateSd('medium'), gateSd('lookahead'), gateSd('hard'), gateSd('easy'), gateSd('deep')]).toEqual([0.59, 0.59, 0.6, 0.6, 0.6]);
    expect(gateDetectable({ stageGames: 280, stages: 5, bot: 'lookahead' })).toBe(gateDetectable({ stageGames: 280, stages: 5, sd: 0.59 }));
    expect(gateDetectable({ stageGames: 280, stages: 2, bot: 'hard' })).toBe(gateDetectable({ stageGames: 280, stages: 2, sd: 0.6 }));
    expect(spreadAssumedWords(['medium', 'easy'])).toBe('It assumes a per-game spread of 0.59 with the Medium bot and 0.60 with the Easy bot for two different decks. The Medium bot\u2019s value was measured on the recorded bred decks; the Easy bot was not measured and takes the value measured with the Hard bot.');
    expect(spreadAssumedWords(['easy', 'random'])).toBe('It assumes a per-game spread of 0.60 with the Easy bot and 0.60 with the Random bot for two different decks. The Easy and Random bots were not measured and take the value measured with the Hard bot.');
  });
});

// ---------------------------------------------------------------- by simulation

/** Deterministic random numbers (mulberry32). */
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

/** Paired games whose difference (deck minus reference) is +1, 0 or −1 with mean `mu` and SD `sd`. */
function stage(r: () => number, mu: number, sd: number): PlayStage {
  const pNZ = sd * sd + mu * mu;
  const pPlus = (pNZ + mu) / 2 / pNZ;
  return async ({ games }) => {
    const base: number[] = [];
    const cand: number[] = [];
    for (let k = 0; k < games; k++) {
      base.push(0);
      cand.push(r() < pNZ ? (r() < pPlus ? 1 : -1) : 0);
    }
    return { base, nominees: [cand] };
  };
}

/** How often the gate's rule (one bot, `stages` looks of `games`) ends shown worse and shown better for a real difference `mu`. */
async function rates(mu: number, o: { games: number; stages: number; sd: number; runs: number; seed: number }): Promise<{ worse: number; better: number }> {
  const r = rng(o.seed);
  let worse = 0;
  let better = 0;
  const rule = gateRule(o.stages);
  for (let i = 0; i < o.runs; i++) {
    const c = (await confirmStaged(rule, [{ minGainPp: 0 }], o.games, stage(r, mu, o.sd))).results[0]!;
    if (c.outcome === 'reject') worse++;
    if (c.outcome === 'adopt') better++;
  }
  return { worse: worse / o.runs, better: better / o.runs };
}

describe('by simulation', () => {
  it('with no real difference, "shown worse" comes up about 2.5% of the time or less per bot (5 looks, and 2)', async () => {
    const five = await rates(0, { games: 280, stages: 5, sd: GATE_SD.medium, runs: 6000, seed: 11 });
    const two = await rates(0, { games: 280, stages: 2, sd: GATE_SD.hard, runs: 6000, seed: 12 });
    for (const x of [five, two]) {
      // 6,000 runs: the standard error at 2.5% is 0.2 points
      expect(x.worse).toBeLessThan(0.031);
      expect(x.worse).toBeGreaterThan(0.015);
      expect(x.better).toBeLessThan(0.031);
    }
  }, 60_000);

  it('the detect line’s deficit is shown worse 8 times in 10 by a Monte-Carlo of the rule (within 0.25 points)', async () => {
    for (const [stages, seed] of [
      [5, 21],
      [2, 23],
    ] as const) {
      const bot = stages === 5 ? 'medium' : 'hard';
      const sd = gateSd(bot);
      const d = gateDetectable({ stageGames: 280, stages, bot });
      expect(d).toBeGreaterThan(0.03);
      const smaller = await rates(-(d - 0.0025), { games: 280, stages, sd, runs: 2500, seed });
      const larger = await rates(-(d + 0.0025), { games: 280, stages, sd, runs: 2500, seed: seed + 1 });
      expect(smaller.worse).toBeLessThan(0.8);
      expect(larger.worse).toBeGreaterThan(0.8);
    }
  }, 60_000);

  it('with independent win/loss games at a 30% base rate (not 50%), "shown worse" still comes up about 2.5% of the time or less', async () => {
    // each list wins each game with chance 0.3 by itself: the difference is +1, 0 or −1 with spread √(2 · 0.3 · 0.7) ≈ 0.65
    const r = rng(31);
    const independent: PlayStage = async ({ games }) => {
      const base: number[] = [];
      const cand: number[] = [];
      for (let k = 0; k < games; k++) {
        base.push(r() < 0.3 ? 1 : 0);
        cand.push(r() < 0.3 ? 1 : 0);
      }
      return { base, nominees: [cand] };
    };
    let worse = 0;
    const runs = 10_000;
    for (let i = 0; i < runs; i++) if ((await confirmStaged(gateRule(5), [{ minGainPp: 0 }], 280, independent)).results[0]!.outcome === 'reject') worse++;
    // 10,000 runs: the standard error at 2.5% is 0.16 points
    expect(worse / runs).toBeLessThan(0.031);
    expect(worse / runs).toBeGreaterThan(0.015);
  }, 60_000);
});

// ---------------------------------------------------------------- light

const ROOT = path.resolve(__dirname, '..');
const EXTS = ['', '.ts', '.tsx', '/index.ts'];
const resolveSpec = (from: string, spec: string) => {
  if (!spec.startsWith('.')) return null;
  const b = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return EXTS.map((e) => b + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
};
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
function staticGraph(entries: readonly string[]): Set<string> {
  const seen = new Set<string>();
  const walk = (file: string) => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) return;
    for (const m of fs.readFileSync(file, 'utf8').matchAll(STATIC_IMPORT)) {
      const hit = resolveSpec(file, m[1]!);
      if (hit) walk(hit);
    }
  };
  for (const e of entries) walk(e);
  return seen;
}
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');

describe('the gate module stays light', () => {
  it('reaches no bot, simulator, script, game engine or file system', () => {
    const files = ['src/lib/breedGate.ts', 'src/lib/parentStrength.ts'].map((f) => path.join(ROOT, f));
    const graph = [...staticGraph(files)].map(rel);
    expect(graph.filter((f) => /^(src\/(ai|sim|analysis)\/|src\/engine\/engine\.ts|src\/lib\/tournament\.ts|scripts\/|tools\/)/.test(f))).toEqual([]);
    for (const f of graph.filter((x) => /\.tsx?$/.test(x))) expect(fs.readFileSync(path.join(ROOT, f), 'utf8')).not.toMatch(/from ['"]node:/);
    // parent strength is lighter still: only the simulator version's mirror
    expect([...staticGraph([files[1]!])].map(rel).sort()).toEqual(['src/lib/parentStrength.ts', 'src/lib/playedRecord.ts']);
  });

  it('the entry chunk does not import it', () => {
    const graph = [...staticGraph([path.join(ROOT, 'src', 'main.tsx')])].map(rel);
    expect(graph.length).toBeGreaterThan(10);
    expect(graph.filter((f) => /^src\/lib\/(breedGate|parentStrength|bredDecks)\.ts$|^src\/ui\/components\/LabBreedTest\.tsx$/.test(f))).toEqual([]);
  });

  it('the Seasons page reads the bred decks’ words without the gate’s statistics (src/lib/bredDecks.ts stays light)', () => {
    const words = [...staticGraph([path.join(ROOT, 'src', 'lib', 'bredDecks.ts')])].map(rel).sort();
    expect(words).toEqual(['src/lib/bredDecks.ts', 'src/lib/evidence.ts', 'src/lib/groupSequential.ts', 'src/lib/parentStrength.ts', 'src/lib/playedRecord.ts']);
    const page = [...staticGraph([path.join(ROOT, 'src', 'ui', 'pages', 'Seasons.tsx')])].map(rel);
    expect(page).toContain('src/lib/bredDecks.ts');
    expect(page.filter((f) => /^src\/lib\/(breedGate|deckSearch|deckPackages|changeLedger|changeLedgerRun|shortlist)\.ts$/.test(f))).toEqual([]);
  });
});
