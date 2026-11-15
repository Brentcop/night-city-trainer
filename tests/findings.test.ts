// The findings model (src/lib/findings.ts, docs/EVIDENCE.md): the strength rule row by row, Benjamini–Hochberg on a
// family worked by hand, stable ids, the short-id check, the wording rules of the three natures, the cite line, and a
// guard that the model and its words stay light (no engine, bots, simulator or knowledge pack; not in the entry chunk).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { bhPass, citeLine, findingIds, GAME_THRESHOLDS, idProblems, pValueOf, strengthOf, strengthStep, type AdjustedEstimate, type Finding, type MeasurementKey, type StrengthInput } from '../src/lib/findings';
import { CAUSAL_WORDS, citeOf, claimOf, MISLEAD, sentenceOf as sentenceOfFinding } from '../src/lib/findingWords';

const CUR = 9;
/** A paired finding that clears every bar for 'strong'; each row changes one thing. */
const base: StrengthInput = { estimate: 0.02, lower: 0.005, upper: 0.035, baseline: 0, n: 1000, method: 'paired-pooled', nature: 'effect', corrected: true, simVersion: CUR };
const s = (o: Partial<StrengthInput>) => strengthOf({ ...base, ...o }, CUR);
const adj = (o: Partial<AdjustedEstimate> = {}): AdjustedEstimate => ({ method: 'landmark-stratified-shrunk', estimate: 0.03, lower: 0.01, upper: 0.05, shrunk: 0.025, shrunkLower: 0.006, shrunkUpper: 0.044, simVersion: CUR, bot: 'hard', source: { file: 'x.json', path: 'decks[0]' }, ...o });

describe('the strength rule', () => {
  it('reads the game minimums by method class, on both sides of each', () => {
    expect(GAME_THRESHOLDS).toEqual({ paired: { min: 200, strong: 1000 }, model: { min: 20, strong: 200 }, split: { min: 20, strong: 200 }, association: { min: 20, strong: 200 } });
    expect(s({ n: 199 })).toBe('not-enough');
    expect(s({ n: 200 })).toBe('moderate');
    for (const method of ['rating-model', 'shrunk'] as const) {
      expect(s({ method, nature: 'result', n: 19 })).toBe('not-enough');
      expect(s({ method, nature: 'result', n: 20 })).toBe('moderate');
    }
    for (const method of ['model-residual', 'result-split'] as const) {
      expect(s({ method, nature: 'result', n: 19 })).toBe('not-enough');
      expect(s({ method, nature: 'result', n: 20 })).toBe('moderate');
    }
    expect(s({ method: 'association', nature: 'association', n: 19 })).toBe('not-enough');
    expect(s({ method: 'association', nature: 'association', n: 20 })).toBe('moderate');
    // under the minimum even a decisive interval says not enough
    expect(s({ n: 150, lower: 0.1, upper: 0.2, estimate: 0.15 })).toBe('not-enough');
  });

  it('strong needs every condition; missing any one gives moderate', () => {
    expect(s({})).toBe('strong');
    expect(strengthStep({ ...base }, CUR)).toBe('excludes-strong');
    expect(s({ n: 999 })).toBe('moderate');
    expect(s({ corrected: false })).toBe('moderate');
    expect(s({ estimate: 0.0099, lower: 0.002, upper: 0.0178 })).toBe('moderate');
    expect(s({ estimate: 0.01, lower: 0.002, upper: 0.018 })).toBe('strong');
    expect(s({ estimate: -0.02, lower: -0.035, upper: -0.005 })).toBe('strong');
    // the strong game thresholds of the other classes
    expect(s({ method: 'shrunk', nature: 'result', n: 199 })).toBe('moderate');
    expect(s({ method: 'shrunk', nature: 'result', n: 200 })).toBe('strong');
    expect(s({ method: 'result-split', nature: 'result', n: 199 })).toBe('moderate');
    expect(s({ method: 'result-split', nature: 'result', n: 200 })).toBe('strong');
  });

  it('a finding under another simulator version is never strong', () => {
    expect(s({ simVersion: 8 })).toBe('moderate');
    expect(s({ simVersion: 10 })).toBe('moderate');
    expect(strengthOf({ ...base, simVersion: 8 }, 8)).toBe('strong');
    expect(s({ simVersion: 5, n: 100_000, estimate: 0.2, lower: 0.19, upper: 0.21 })).toBe('moderate');
  });

  it('an association is never strong without an adjusted estimate that clears the bar too', () => {
    const a = { method: 'association' as const, nature: 'association' as const, n: 400 };
    expect(s(a)).toBe('moderate');
    expect(s({ ...a, adjusted: adj() })).toBe('strong');
    expect(s({ ...a, adjusted: adj({ shrunkLower: -0.001 }) })).toBe('moderate');
    expect(s({ ...a, adjusted: adj({ shrunk: 0.009, shrunkLower: 0.001, shrunkUpper: 0.017 }) })).toBe('moderate');
    expect(s({ ...a, adjusted: adj({ shrunk: -0.025, shrunkLower: -0.044, shrunkUpper: -0.006 }) })).toBe('moderate');
    expect(s({ ...a, adjusted: adj(), corrected: false })).toBe('moderate');
  });

  it('an interval that includes the baseline: weak, no difference or not enough', () => {
    expect(s({ estimate: 0.015, lower: -0.005, upper: 0.035 })).toBe('weak');
    expect(s({ estimate: 0.01, lower: -0.01, upper: 0.03 })).toBe('weak');
    expect(s({ estimate: -0.01, lower: -0.03, upper: 0.01 })).toBe('weak');
    expect(s({ estimate: 0.005, lower: -0.015, upper: 0.025 })).toBe('no-difference');
    expect(s({ estimate: 0.005, lower: -0.0151, upper: 0.0251 })).toBe('not-enough');
    expect(strengthStep({ ...base, estimate: 0.005, lower: -0.0151, upper: 0.0251 }, CUR)).toBe('includes-not-enough');
    expect(s({ estimate: 0, lower: -0.02, upper: 0.02 })).toBe('no-difference');
  });

  it('reads the baseline (a win rate against 0.5, a share against the field) and the plain 95% interval when stored', () => {
    const rate = { method: 'rating-model' as const, nature: 'result' as const, baseline: 0.5, n: 300 };
    expect(s({ ...rate, estimate: 0.53, lower: 0.51, upper: 0.55 })).toBe('strong');
    expect(s({ ...rate, estimate: 0.505, lower: 0.49, upper: 0.52 })).toBe('no-difference');
    // a 90% range that excludes 0.5 while the plain 95% one does not: the rule reads p95
    expect(s({ ...rate, estimate: 0.53, lower: 0.505, upper: 0.555, p95: [0.499, 0.561] })).toBe('weak');
    expect(s({ method: 'result-split', nature: 'result', baseline: 0.58, estimate: 0.66, lower: 0.6, upper: 0.72, n: 250 })).toBe('strong');
  });
});

describe('families: Benjamini–Hochberg at q = 0.10', () => {
  it('works a family by hand (step-up: a p above its own line still passes when a larger one passes)', () => {
    // m = 5, lines k·q/m: .02 .04 .06 .08 .10; sorted .005 .01 .03 .04 | .2 → the largest k under its line is 4
    expect(bhPass([0.01, 0.04, 0.03, 0.005, 0.2])).toEqual([true, true, true, true, false]);
    // m = 3, lines .033 .067 .1: .05 is above the first line, but .07 ≤ .1, so all three pass
    expect(bhPass([0.05, 0.06, 0.07])).toEqual([true, true, true]);
    expect(bhPass([0.07, 0.074, 0.2])).toEqual([false, false, false]);
    expect(bhPass([0.04, 0.5])).toEqual([true, false]);
    expect(bhPass([])).toEqual([]);
    expect(bhPass([0.06], 0.1)).toEqual([true]);
  });

  it('a p-value below 0.05 exactly when the plain 95% interval excludes the baseline', () => {
    const f = (estimate: number, lower: number, upper: number) => pValueOf({ estimate, lower, upper, baseline: 0 });
    expect(f(0.02, 0.001, 0.039)).toBeLessThan(0.05);
    expect(f(0.02, -0.001, 0.041)).toBeGreaterThan(0.05);
    expect(f(0.02, 0, 0.04)).toBeCloseTo(0.05, 4);
    expect(f(0, -0.01, 0.01)).toBe(1);
  });
});

describe('ids', () => {
  const key: MeasurementKey = { kind: 'change', subject: { listId: 'aaaaaaaaaaaaaaaa', change: { key: 'aaaaaaaaaaaaaaaa -main:x +main:y', base: 'aaaaaaaaaaaaaaaa', cuts: ['x'], adds: ['y'], label: 'swap', relation: 'from-this-list' } }, method: 'paired-pooled', bot: 'medium', simVersion: 9, field: 'ffffffffffffffff' };

  it('hash what was measured, never the result: the same measurement keeps its id', () => {
    const a = findingIds(key);
    expect(a.id).toMatch(/^[0-9a-f]{16}$/);
    expect(a.short).toBe(a.id.slice(0, 8));
    // another label (presentation) or relation does not move it; the change key does
    expect(findingIds({ ...key, subject: { ...key.subject, change: { ...key.subject.change!, label: 'other words', relation: 'other-list' } } })).toEqual(a);
    expect(findingIds({ ...key, subject: { ...key.subject, change: { ...key.subject.change!, key: 'aaaaaaaaaaaaaaaa -main:x +main:z' } } }).id).not.toBe(a.id);
  });

  it('another bot or simulator version is another id with the same question', () => {
    const a = findingIds(key);
    const hard = findingIds({ ...key, bot: 'hard' });
    const v8 = findingIds({ ...key, simVersion: 8 });
    expect(hard.id).not.toBe(a.id);
    expect(v8.id).not.toBe(a.id);
    expect(hard.question).toBe(a.question);
    expect(v8.question).toBe(a.question);
    // the method too: a forge report, the ledger and a re-measurement of one change are one question
    expect(findingIds({ ...key, method: 'paired' }).question).toBe(a.question);
    expect(findingIds({ ...key, field: '0000000000000000' }).question).not.toBe(a.question);
  });

  it('a short id shared by two ids, or a repeated id, is refused', () => {
    expect(idProblems([{ id: '0123456789abcdef', short: '01234567' }, { id: 'fedcba9876543210', short: 'fedcba98' }])).toEqual([]);
    expect(idProblems([{ id: '0123456789abcdef', short: '01234567' }, { id: '01234567ffffffff', short: '01234567' }])).toEqual(['short id 01234567 is shared by 0123456789abcdef and 01234567ffffffff']);
    expect(idProblems([{ id: '0123456789abcdef', short: '01234567' }, { id: '0123456789abcdef', short: '01234567' }])).toEqual(['id 0123456789abcdef is used 2 times']);
    expect(idProblems([{ id: '0123456789abcdef', short: '0123' }])).toEqual(['short id 0123 is not the start of 0123456789abcdef']);
  });
});

describe('words', () => {
  const subject = { listId: 'aaaaaaaaaaaaaaaa', deck: 'Deck', file: 'deck.txt', card: { id: 'c', name: 'Some Card' }, package: { id: 'p', name: 'Some Package' } };
  const hasCausal = (text: string) => CAUSAL_WORDS.filter((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));

  it('an association never uses a causal word, whatever its sign; its "why it may mislead" neither', () => {
    for (const kind of ['card-assoc', 'package-assoc'] as const)
      for (const estimate of [0.12, -0.08, 0]) {
        const claim = claimOf({ kind, subject, estimate, baseline: 0 });
        expect(hasCausal(claim), claim).toEqual([]);
        expect(claim).toMatch(/were won (more|less) often/);
      }
    for (const line of Object.values(MISLEAD)) expect(hasCausal(line), line).toEqual([]);
  });

  it('a result says what the games show, without causal words', () => {
    for (const kind of ['deck-strength', 'matchup', 'seat', 'length', 'ending'] as const) {
      const claim = claimOf({ kind, subject: { ...subject, opponent: { listId: 'b', deck: 'Other' }, ending: 'reached 7 Gigs in overtime' }, estimate: 0.6, baseline: 0.5 });
      expect(hasCausal(claim), claim).toEqual([]);
    }
  });

  it('a change claim names what was measured, never an effect by itself', () => {
    const change = { key: 'k', base: 'b', cuts: ['x'], adds: ['y'], label: '-1 X → +1 Y', relation: 'from-this-list' as const };
    expect(claimOf({ kind: 'change', subject: { ...subject, change }, estimate: 0.02, baseline: 0 })).toBe('-1 X → +1 Y (a change to this list): paired win-rate difference for Deck');
    expect(claimOf({ kind: 'change', subject: { ...subject, change: { ...change, relation: 'to-this-list' } }, estimate: -0.02, baseline: 0 })).toBe('-1 X → +1 Y (the change that made this list): paired win-rate difference for Deck');
    for (const estimate of [0.02, -0.02]) expect(hasCausal(claimOf({ kind: 'change', subject: { ...subject, change }, estimate, baseline: 0 }))).toEqual([]);
  });

  it('the sentence follows the strength word: only a strong or moderate effect says adds or costs', () => {
    const base = { id: '9f3a2c1d00000000', short: '9f3a2c1d', question: 'q', claim: 'c', subject, level: 0.95 as const, baseline: 0, n: 2000, field: 'f', sources: [], family: { key: 'k', size: 1, correction: 'none' as const }, corrected: true, flags: [], simVersion: 9, bot: 'medium' };
    const eff = { ...base, kind: 'change' as const, nature: 'effect' as const, method: 'paired' as const, games: 2000 };
    // the literals below carry a whole finding's fields; a sentence reads only some of them
    const sentenceOf = (f: object) => sentenceOfFinding(f as Finding);
    expect(sentenceOf({ ...eff, estimate: 0.028, lower: 0.012, upper: 0.044, strength: 'moderate' })).toBe('Adds +2.8 pts (95% range +1.2 pts to +4.4 pts, 2,000 paired games).');
    expect(sentenceOf({ ...eff, estimate: -0.028, lower: -0.044, upper: -0.012, strength: 'strong' })).toBe('Costs 2.8 pts (95% range −4.4 pts to −1.2 pts, 2,000 paired games).');
    const weak = sentenceOf({ ...eff, estimate: 0.015, lower: -0.005, upper: 0.035, strength: 'weak' });
    expect(weak).toBe('Reads +1.5 pts (95% range −0.5 pts to +3.5 pts, 2,000 paired games); the interval still includes no difference.');
    const none = sentenceOf({ ...eff, estimate: 0.004, lower: -0.012, upper: 0.02, strength: 'no-difference' });
    expect(none).toBe('No difference of a point or more: +0.4 pts (95% range −1.2 pts to +2.0 pts, 2,000 paired games).');
    const few = sentenceOf({ ...eff, estimate: 0.011, lower: -0.05, upper: 0.07, games: 150, n: 150, strength: 'not-enough' });
    expect(few).toBe('Not enough games: reads +1.1 pts so far (150 paired games).');
    // moderate only on the uncorrected interval (a staged confirmation that could not tell): the number, not "Adds"
    const staged = sentenceOf({ ...eff, method: 'paired-staged', sequential: 'obrien-fleming', estimate: 0.015, lower: -0.003, upper: 0.032, p95: [0.001, 0.029], games: 896, n: 896, corrected: false, strength: 'moderate' });
    expect(staged).toBe('Reads +1.5 pts (corrected 95% range −0.3 pts to +3.2 pts, 896 paired games); only the uncorrected interval excludes no difference.');
    // a pooled change the always-valid interval settles says so, and names its interval
    expect(sentenceOf({ ...eff, method: 'paired-pooled', sequential: 'always-valid', estimate: 0.028, lower: 0.012, upper: 0.043, p95: [0.018, 0.038], games: 2240, n: 2240, strength: 'strong' })).toBe(
      'Adds +2.8 pts (corrected 95% range +1.2 pts to +4.3 pts, 2,240 paired games).',
    );
    for (const t of [weak, none, few, staged]) expect(hasCausal(t), t).toEqual([]);
    // a ratings-based matchup rests on the ratings: its direct games are told apart, and a pairing that never met says so
    const rated = { ...base, kind: 'matchup' as const, nature: 'result' as const, method: 'shrunk' as const, baseline: 0.5, estimate: 0.825, lower: 0.647, upper: 0.924 };
    expect(sentenceOf({ ...rated, games: 5, detail: { raw: { wins: 4, games: 5 } }, strength: 'strong' })).toBe('Expected to win 82.5% (95% range 64.7% to 92.4%), from the ratings; 4–1 in 5 direct games.');
    expect(sentenceOf({ ...rated, estimate: 0.619, lower: 0.462, upper: 0.754, games: 0, detail: { raw: { wins: 0, games: 0 } }, strength: 'weak' })).toBe(
      'Expected to win 61.9% (95% range 46.2% to 75.4%), from the ratings; these decks have not met; the interval still includes no difference.',
    );
    expect(sentenceOf({ ...rated, method: 'direct-games', estimate: 0.645, lower: 0.577, upper: 0.708, games: 200, n: 200, detail: { raw: { wins: 129, games: 200 } }, strength: 'strong' })).toBe('Won 64.5% (95% range 57.7% to 70.8%, 200 games).');
    // an association never says adds or costs, whatever its strength
    const assoc = { ...base, kind: 'card-assoc' as const, nature: 'association' as const, method: 'association' as const, games: 1200 };
    for (const strength of ['strong', 'moderate', 'weak', 'no-difference', 'not-enough'] as const)
      for (const estimate of [0.05, -0.05]) {
        const t = sentenceOf({ ...assoc, estimate, lower: estimate - 0.02, upper: estimate + 0.02, strength });
        expect(hasCausal(t), t).toEqual([]);
      }
  });

  it('the cite line', () => {
    const f = { short: '9f3a2c1d', kind: 'change' as const, estimate: 0.012, lower: -0.001, upper: 0.025, games: 6112, bot: 'medium', simVersion: 8 };
    expect(citeLine(f, '-1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon adds to S2-05 Counter (RRG)')).toBe(
      '[F:9f3a2c1d] -1 We Gotta Live Together → +1 Yorinobu Arasaka: Steel Dragon adds to S2-05 Counter (RRG) (+1.2 pts [−0.1, +2.5], 6,112 games, Medium v8)',
    );
    expect(citeLine({ ...f, kind: 'deck-strength', estimate: 0.63, lower: 0.55, upper: 0.71, games: 75, bot: 'hard', simVersion: 9 }, 'X: expected win rate against the field')).toBe(
      '[F:9f3a2c1d] X: expected win rate against the field (63.0% [55.0%, 71.0%], 75 games, Hard v9)',
    );
    const whole = { ...f, id: '9f3a2c1d00000000', question: 'q', nature: 'effect', claim: 'c', subject, level: 0.95, baseline: 0, n: 6112, method: 'paired', field: 'f', sources: [], family: { key: 'k', size: 1, correction: 'none' }, corrected: true, strength: 'moderate', flags: [] } as Finding;
    expect(citeOf(whole)).toBe('[F:9f3a2c1d] c (+1.2 pts [−0.1, +2.5], 6,112 games, Medium v8)');
    // a ratings-based matchup rests on the ratings: its games are the direct ones, and the line says so
    expect(citeLine({ ...f, kind: 'matchup', method: 'shrunk', estimate: 0.489, lower: 0.344, upper: 0.637, games: 2, bot: 'hard', simVersion: 9 }, 'A against B: expected win rate')).toBe(
      '[F:9f3a2c1d] A against B: expected win rate (48.9% [34.4%, 63.7%], from the ratings, 2 direct games, Hard v9)',
    );
    expect(citeLine({ ...f, kind: 'matchup', method: 'direct-games', estimate: 0.645, lower: 0.577, upper: 0.708, games: 200, bot: 'deep', simVersion: 9 }, 'A against B: win rate in their direct games')).toBe(
      '[F:9f3a2c1d] A against B: win rate in their direct games (64.5% [57.7%, 70.8%], 200 games, Deep v9)',
    );
    expect(sentenceOfFinding({ ...whole, strength: 'weak' })).toBe('Reads +1.2 pts (95% range −0.1 pts to +2.5 pts, 6,112 paired games); the interval still includes no difference.');
  });
});

// ---------------------------------------------------------------- the guard (like tests/kb-guards.test.ts)

const ROOT = path.resolve(__dirname, '..');
const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const EXTS = ['', '.ts', '.tsx', '/index.ts', '/index.tsx'];
const resolveSpec = (from: string, spec: string) => {
  if (!spec.startsWith('.')) return null;
  const b = path.resolve(path.dirname(from), spec.replace(/\?.*$/, ''));
  return EXTS.map((e) => b + e).find((p) => fs.existsSync(p) && fs.statSync(p).isFile()) ?? null;
};
const STATIC_IMPORT = /^\s*(?:import|export)\s+(?!type\b)(?:[^'";]*?\sfrom\s+)?['"]([^'"]+)['"]/gm;
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]/g;
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
const MODEL = ['src/lib/findings.ts', 'src/lib/findingWords.ts'].map((f) => path.join(ROOT, f));

describe('the model stays light', () => {
  it('findings.ts and findingWords.ts reach no engine, bot, simulator, analysis, knowledge pack, script or data file, and nothing large', () => {
    const graph = [...staticGraph(MODEL)].map(rel).sort();
    expect(graph.filter((f) => /^(src\/(engine|ai|sim|analysis|data)\/|src\/lib\/kb\/|scripts\/|tools\/)/.test(f))).toEqual([]);
    // exactly these small, pure modules
    expect(graph).toEqual(['src/lib/evidence.ts', 'src/lib/findingWords.ts', 'src/lib/findings.ts', 'src/lib/groupSequential.ts', 'src/lib/playedRecord.ts', 'src/lib/stateHash.ts']);
    const dynamic = MODEL.flatMap((f) => [...fs.readFileSync(f, 'utf8').matchAll(DYNAMIC)].map((m) => m[1]));
    expect(dynamic).toEqual([]);
    for (const f of MODEL) expect(fs.readFileSync(f, 'utf8')).not.toMatch(/from ['"]node:/);
  });

  it('the entry chunk does not import them', () => {
    const graph = staticGraph([path.join(ROOT, 'src', 'main.tsx')]);
    expect(graph.size).toBeGreaterThan(10);
    expect([...graph].map(rel).filter((f) => /^src\/lib\/(findings|findingWords|remeasure)\.ts$/.test(f))).toEqual([]);
  });
});
