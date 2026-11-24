// The forge's opt-in screening flags and budget (REVIEW_2026-11-24 §3 T3, T6, T7; scripts/forge.ts): successive halving
// (--screen-rounds) plays its rounds on a block of seeds of its own, each round paired with its own baseline, and
// nominates from the last round only; --per-deck-adds reads the season bot's per-list table and says which table it read
// (a "Warning:" line for another bot or version); "until settled"'s further stages stay within --budget. A small run with
// the Easy bot (about 400 games) into a temporary folder.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseBatchLine } from '../src/lib/changeLedger';
import { adoptionRule } from '../src/lib/evidence';
import { DEPTH_DEFAULTS, estimateGames, settleExtra, settleStagesWithin } from '../src/lib/deckSearch';
import { halvingArgs, halvingProblem, settleExtraWithin } from '../scripts/evidence-flags';
import { PER_DECK_MISSING, perDeckAddsWords } from '../scripts/builder-moves';
import type { ImpactTables } from '../src/lib/breederImpact';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nct-forge-halving-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

const RULE = adoptionRule({ kind: 'evidence' });

describe('successive halving: the estimate, the flags', () => {
  it('with a block of its own every round plays its own baseline, beside the telemetry baseline’s full block', () => {
    const o = { gens: 1, screenGames: 14, singles: 2, packageMoves: 0, depth: DEPTH_DEFAULTS, firstStage: 28, rule: RULE, screenRounds: 2, initialCands: 4 };
    // the Lab's layout (round 0 reuses the telemetry baseline): 7 × (1 + 4) + 7 × (1 + 2)
    expect(estimateGames(o).screen).toBe(7 * 5 + 7 * 3);
    // the forge's: the telemetry baseline's 14, then 7 × (1 + 4) + 7 × (1 + 2)
    expect(estimateGames({ ...o, ownHalvingBlock: true }).screen).toBe(14 + 7 * 5 + 7 * 3);
    // without halving the option changes nothing
    expect(estimateGames({ ...o, screenRounds: 1, ownHalvingBlock: true })).toEqual(estimateGames({ ...o, screenRounds: 1 }));
  });

  it('refuses a round with no games and --per-deck-bot without --per-deck-adds; passes the flags on', () => {
    expect(halvingProblem({}, 140)).toBeNull();
    expect(halvingProblem({ 'screen-rounds': 4 }, 5)).toBe('--screen-rounds 4 leaves the last round no games of 5; raise --games or lower --screen-rounds');
    expect(halvingProblem({ 'screen-rounds': 2 }, 14)).toBeNull();
    expect(halvingProblem({ 'per-deck-bot': 'hard' }, 140)).toBe('--per-deck-bot needs --per-deck-adds');
    expect(halvingProblem({ 'per-deck-bot': 'hard', 'per-deck-adds': true }, 140)).toBeNull();
    expect(halvingArgs({ 'screen-rounds': 1 })).toEqual([]);
    expect(halvingArgs({ 'per-deck-adds': true, 'per-deck-bot': 'lookahead' })).toEqual(['--per-deck-adds', '--per-deck-bot', 'lookahead']);
  });
});

describe('until settled within the budget', () => {
  it('caps the further stages at what the budget leaves after the usual most', () => {
    // 12,000 − 6,440 leaves 5,560; a further stage costs 280 × 2 a generation, 2 generations: 4 stages
    expect(settleStagesWithin({ budget: 12_000, max: 6_440, gens: 2, firstStage: 280, nominees: 1, stages: 31 })).toBe(4);
    // never more than the seeds and the reach allow
    expect(settleStagesWithin({ budget: 1e9, max: 6_440, gens: 2, firstStage: 280, nominees: 1, stages: 31 })).toBe(31);
    // nothing left: no further stage
    expect(settleStagesWithin({ budget: 6_000, max: 6_440, gens: 2, firstStage: 280, nominees: 1, stages: 31 })).toBe(0);
    expect(settleExtra({ gens: 2, firstStage: 280, stages: 4, nominees: 1 })).toBeLessThanOrEqual(12_000 - 6_440);
    // the season's line (its extra before the cap): within the budget, unless --force
    expect(settleExtraWithin(18_368, { max: 2_464 }, 12_000, false)).toBe(12_000 - 2_464);
    expect(settleExtraWithin(18_368, { max: 2_464 }, 12_000, true)).toBe(18_368);
    expect(settleExtraWithin(500, { max: 2_464 }, 12_000, false)).toBe(500);
  });
});

describe('what --per-deck-adds read, in words', () => {
  const t = (match: ImpactTables['match'], read: ImpactTables['read'], lists = 21): Pick<ImpactTables, 'wanted' | 'read' | 'match' | 'perList'> => ({
    wanted: { simVersion: 9, bot: 'hard' },
    read,
    match,
    perList: { lists, withNumbers: lists, sources: [{ kind: 'season', season: 3 }] },
  });
  it('names the pair, and warns when it is not the one wanted or there is none', () => {
    expect(perDeckAddsWords(t('exact', { simVersion: 9, bot: 'hard' }))).toEqual(['Per-deck additions read card impact for simulator version 9, hard bot: per-list numbers for 21 lists (from season 3).']);
    expect(perDeckAddsWords({ ...t('other-bot', { simVersion: 9, bot: 'hard' }), wanted: { simVersion: 9, bot: 'medium' } })[0]).toBe(
      "Warning: no card-impact numbers for simulator version 9, medium bot, so --per-deck-adds reads those of simulator version 9, hard bot instead: per-list numbers for 21 lists (from season 3). Numbers measured on another bot can mislead. A season's round robin on simulator version 9, medium bot records them for the lists it plays.",
    );
    expect(perDeckAddsWords(t('none', null, 0))[0]).toMatch(/^Warning: no card-impact numbers for simulator version 9, hard bot or any other simulator version or bot, so --per-deck-adds changes nothing/);
  });
});

/** a run's ledger batches */
const batches = (out: string) => {
  const dir = path.join(tmp, out, 'ledger');
  return fs.readdirSync(dir).flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => parseBatchLine(l).batch!));
};

describe('the forge with --screen-rounds 2, --per-deck-adds and --until-settled under a budget', () => {
  it('screens on its own block, pairs each round with its own baseline, nominates from the last round, stays within the budget', { timeout: 300_000 }, () => {
    const args = ['s2-08-explorer-ggy', '--gens', '1', '--games', '14', '--cands', '2', '--initial-cands', '4', '--screen-rounds', '2', '--bot', 'easy', '--seed', '3', '--threads', '2', '--ledger', '--per-deck-adds', '--until-settled', '--budget', '500'];
    const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/forge.ts', ...args, '--out', path.join(tmp, 'halving')], { encoding: 'utf8' });
    expect(r.status, r.stderr).toBe(0);
    // the table it read, as the season says it
    expect(r.stdout).toMatch(/^(Per-deck additions read card impact for simulator version \d+, hard bot|Warning: no card-impact numbers for simulator version \d+, hard bot)/m);
    // and, for a list the table has no entry for, that its additions are the plain ones
    const md = fs.readFileSync(path.join(tmp, 'halving', 'forge', 's2-08-explorer-ggy.md'), 'utf8');
    if (r.stdout.includes(PER_DECK_MISSING)) expect(md).toContain('Per-deck additions: no per-list numbers for this list');
    expect(md).toContain('Successive halving: 4 one-card swaps screened in 2 rounds on a block of 14 seeds of their own');
    // the rounds: 4 candidates on 7 games, then 2 on 7, each with its own baseline
    expect(r.stdout).toMatch(/halving round 1\/2: 4 candidates, 7 games \(baseline [\d.]+%\)/);
    expect(r.stdout).toMatch(/halving round 2\/2: 2 candidates, 7 games \(baseline [\d.]+%\)/);
    // the budget: the usual most is 14 + 35 + 21 + 4 × 28 × 2 = 294; 500 leaves 206, three further stages of 56
    expect(r.stdout).toContain('Game budget (forge, 1 generation): ');
    expect(r.stdout).toContain('"Until settled" may add up to 168 more (capped so the run stays within the budget).');
    const json = JSON.parse(fs.readFileSync(path.join(tmp, 'halving', 'forge', 's2-08-explorer-ggy.json'), 'utf8'));
    expect(json.untilSettled).toEqual({ reach: 10_000, maxStages: 3, maxExtraGames: 168 });
    expect(json.manifest.sample.plannedGames).toBe(294);
    expect(json.manifest.sample.completedGames).toBeLessThanOrEqual(294 + 168);
    // nominating figures are the last round's two
    expect(json.gens[0].swaps).toHaveLength(2);
    // the screening games: none on the telemetry baseline's block, every one on the rounds' block after it
    const all = batches('halving');
    const held = all.filter((b) => b.kind === 'heldout').flatMap((b) => b.games.map((g) => g.seed));
    const screen = all.filter((b) => b.kind === 'screen');
    expect(screen.map((b) => b.games.length).sort()).toEqual([7, 7, 7, 7, 7, 7]);
    // the generation's first seed, as the forge draws it from --seed 3 (its seed stream)
    const seed0 = 100_000 + ((((3 * 2654435761) >>> 0) * 1664525 + 1013904223) >>> 0) % 90_000;
    if (held.length) expect(Math.min(...held)).toBe(seed0 + 50_000);
    // round 1 on the block's first 7 seeds, round 2 on its next 7: seed0 + 14 … seed0 + 27, never the baseline's own
    const seeds = screen.flatMap((b) => b.games.map((g) => g.seed));
    expect(new Set(seeds)).toEqual(new Set(Array.from({ length: 14 }, (_, k) => seed0 + 14 + k)));
  });
});
