// The per-deck sensitivity report (scripts/deck-sensitivity.ts): its statistics (src/lib/deckSensitivity.ts) and the
// script's configuration reader, jobs and report lines (scripts/deck-sensitivity-run.ts).
import { describe, expect, it } from 'vitest';
import { CARD_BY_ID } from '../src/engine/cards';
import { compareGroup, deckFeatures, deckSensitivity, decksBeyond, FAMILIES, isReactionCall, permutationP, TWO_SE_TAIL, type SensitivityDeck } from '../src/lib/deckSensitivity';
import { lcg, type Deal } from '../src/lib/rankStability';
import { jobsFor, parseConfig, reportLines, roundRobinDeals } from '../scripts/deck-sensitivity-run';
import { TIER_SPECS } from '../scripts/agent-spec';
import type { DeckList } from '../src/engine/types';

const rep = (id: string, n: number) => Array.from({ length: n }, () => id);

describe('list features', () => {
  it('counts card types, Blockers, Quick cards and rival-turn Legends with copies', () => {
    const f = deckFeatures({
      legends: ['wakako_okada_peace_and_harmony', 'goro_takemura_vengeful_bodyguard', 'v_streetkid'],
      main: [...rep('mox_inciters', 3), ...rep('jacked_in_voodoo_boy', 2), ...rep('floor_it', 2), ...rep('trust_no_one', 1), ...rep('overwatch_panam_s_gift', 2), ...rep('tetratronic_rippler', 1)],
    });
    expect(f).toMatchObject({ units: 5, blockers: 3, programs: 3, quickPrograms: 2, gear: 3, redLegends: 1, combo: 'RBG' });
    // Floor It ×2 and Overwatch ×2 (Quick), Wakako (reaction Call) and Goro (a Quick ability); V's Call is not a reaction
    expect(f.rivalTurn).toBe(6);
    expect(['aggro', 'midrange', 'control']).toContain(f.archetype);
  });

  it('a reaction Call acts on a Unit this turn; a draw or tutor Call does not', () => {
    const call = (id: string) => isReactionCall(CARD_BY_ID[id]!.text);
    expect(['wakako_okada_peace_and_harmony', 'padre_man_of_the_cross', 'dexter_deshawn_off_the_grid', 'muamar_reyes_el_capitan'].map(call)).toEqual([true, true, true, true]);
    expect(['v_streetkid', 'dum_dum_maelstrom_triggerman', 'viktor_vektor_sit_down_and_relax', 'alt_cunningham_soulkiller_architect'].map(call)).toEqual([false, false, false, false]);
  });

  it('families name their rule and test it', () => {
    const deck = (file: string, source: string, legends: string[]): SensitivityDeck => ({ file, name: file, source, legends, main: [] });
    const fam = (d: SensitivityDeck) => FAMILIES.filter((f) => f.test(d, deckFeatures(d))).map((f) => f.key);
    expect(fam(deck('meta-bbg.txt', 'meta', ['alt_cunningham_soulkiller_architect', 'jackie_welles_pour_one_out_for_me', 'hanako_arasaka_daughter_of_the_emperor']))).toEqual(['bbg']);
    expect(fam(deck('s3-x.txt', 'bred', ['v_streetkid', 'adam_smasher_ender_of_legends', 'padre_man_of_the_cross']))).toEqual(['v-smasher', 'two-red', 'bred']);
    expect(fam(deck('import-x.txt', 'shared', ['adam_smasher_ender_of_legends', 'river_ward_detective_on_the_hunt', 'viktor_vektor_sit_down_and_relax']))).toEqual(['imported']);
    for (const f of FAMILIES) expect(f.rule.length).toBeGreaterThan(5);
  });
});

// four decks, every ordered pairing four times; under the base deck 0 wins everything, under the change deck 3 does
const D = 4;
const deals: Deal[] = [];
for (let a = 0; a < D; a++) for (let b = 0; b < D; b++) if (a !== b) for (let k = 0; k < 4; k++) deals.push({ a, b });
const winner = (best: number) => (d: Deal) => (d.a === best ? 1 : d.b === best ? 0 : d.a < d.b ? 1 : 0);
const base = deals.map(winner(0));
const change = deals.map(winner(3));
const decks: SensitivityDeck[] = Array.from({ length: D }, (_, i) => ({ file: `d${i}.txt`, name: `Deck ${i}`, source: i < 2 ? 'meta' : 'bred', legends: [], main: rep('mox_inciters', i) }));

describe('the report', () => {
  it('the same games under both: no change, the same order, every result the same', () => {
    const r = deckSensitivity(deals, base, base, decks, { boot: 100, perms: 100 });
    expect(r.rows.every((x) => x.diff === 0)).toBe(true);
    expect(r.summary).toMatchObject({ beyond2: 0, beyond3: 0, sameWinner: 1, meanAbsChange: 0 });
    expect(r.summary.spearman.rho).toBeCloseTo(1, 12);
    expect(r.summary.chance2).toBeCloseTo(D * TWO_SE_TAIL, 12);
  });

  it('per deck: win rates, paired change (change minus base), ranks and the decks beyond 2 SE', () => {
    const r = deckSensitivity(deals, base, change, decks, { boot: 200, perms: 200, seed: 3 });
    const [d0, , , d3] = r.rows;
    expect(d0!.base.wr).toBe(1);
    expect(d0!.change.wr).toBeCloseTo(2 / 3, 12);
    expect(d0!.diff).toBeCloseTo(-1 / 3, 12);
    expect(d3!.base.wr).toBe(0);
    expect(d3!.change.wr).toBe(1);
    expect(d3!.diff).toBe(1);
    expect(d0!.base.rank).toBe(1);
    expect(d3!.change.rank).toBe(1);
    expect(d3!.rankShift).toBe(-3); // from 4th to 1st
    expect(d0!.base.games).toBe(2 * (D - 1) * 4);
    // deck 3 changed in every game the same way: SE 0, so it is beyond any multiple
    expect(decksBeyond(r.rows, 2)[0]!.name).toBe('Deck 3');
    expect(r.summary.sameWinner).toBeCloseTo(deals.filter((_, i) => base[i] === change[i]).length / deals.length, 12);
    expect(r.summary.meanAbsChange).toBeCloseTo(r.rows.reduce((s, x) => s + Math.abs(x.diff), 0) / D, 12);
    // the change goes with the Blocker count here (deck i has i Blockers): deck 3 gains most
    const bl = r.summary.features.find((f) => f.key === 'blockers')!;
    expect(bl.pearson).toBeGreaterThan(0.5);
    const bred = r.summary.families.find((f) => f.key === 'bred')!;
    expect(bred).toMatchObject({ n: 2, restN: 2 });
    expect(bred.diff).toBeCloseTo((r.rows[2]!.diff + r.rows[3]!.diff) / 2 - (r.rows[0]!.diff + r.rows[1]!.diff) / 2, 12);
    expect(r.summary.bySource.map((g) => g.value)).toEqual(['bred', 'meta']);
  });

  it('refuses scores that do not cover the deals', () => {
    expect(() => deckSensitivity(deals, base, change.slice(1), decks)).toThrow(/every deal/);
  });

  it('a group comparison: means, Welch SE and a permutation p', () => {
    const g = compareGroup([1, 2, 3, 10, 11, 12], [false, false, false, true, true, true], 500, lcg(7));
    expect(g).toMatchObject({ n: 3, restN: 3, mean: 11, restMean: 2, diff: 9 });
    expect(g.se).toBeCloseTo(Math.sqrt(1 / 3 + 1 / 3), 12);
    // 2 of the 20 labellings are as extreme as the observed one
    expect(g.p).toBeGreaterThan(0.03);
    expect(g.p).toBeLessThan(0.25);
    expect(permutationP([1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], 500, lcg(1))).toBeLessThan(0.01);
  });
});

describe('the script: configurations, deals, jobs and the report', () => {
  it('reads a bot name, a JSON spec, and a name with overrides', () => {
    expect(parseConfig('Medium')).toEqual({ label: 'medium', bot: 'medium' });
    expect(parseConfig('hard-main')).toEqual({ label: 'hard-main', bot: 'hard-main' });
    expect(parseConfig('{"deep":3}')).toEqual({ label: '{"deep":3}', spec: { deep: 3 } });
    expect(parseConfig('medium+{"weights":{"blocker":-3.7}}')).toEqual({ label: 'medium+{"weights":{"blocker":-3.7}}', spec: { ...TIER_SPECS.medium, weights: { blocker: -3.7 } } });
    expect(() => parseConfig('nightmare')).toThrow(/unknown configuration/);
    expect(() => parseConfig('{deep:3}')).toThrow(/not valid JSON/);
    expect(() => parseConfig('[1]')).toThrow(/unknown configuration/);
    expect(() => parseConfig('nope+{"deep":1}')).toThrow(/before the \+/);
  });

  it('deals: every ordered pairing, per deals each, seeds in order, first player alternating (rank-stability’s layout)', () => {
    const ds = roundRobinDeals(3, 2, 100);
    expect(ds).toHaveLength(3 * 2 * 2);
    expect(ds.slice(0, 3)).toEqual([
      { a: 0, b: 1, seed: 100, first: 0 },
      { a: 0, b: 1, seed: 101, first: 1 },
      { a: 0, b: 2, seed: 102, first: 0 },
    ]);
    expect(new Set(ds.map((d) => d.seed)).size).toBe(ds.length);
  });

  it('jobs: a bot name plays as the worker’s bot, a spec pilots both seats', () => {
    const lists = [{ name: 'x' }, { name: 'y' }] as unknown as DeckList[];
    const d = roundRobinDeals(2, 1, 5);
    expect(jobsFor({ label: 'medium', bot: 'medium' }, d, lists)[0]).toEqual({ a: lists[0], b: lists[1], seed: 5, first: 0, bot: 'medium' });
    const spec = { deep: 1 };
    const j = jobsFor({ label: 's', spec }, d, lists)[1]!;
    expect(j).toMatchObject({ a: lists[1], b: lists[0], seed: 6, agentA: spec, agentB: spec });
  });

  it('the console report names the chance expectation and lists the decks beyond 2 SE in a table', () => {
    const r = deckSensitivity(deals, base, change, decks, { boot: 100, perms: 100 });
    const lines = reportLines(r, { base: 'medium', change: 'x' });
    const text = lines.join('\n');
    expect(text).toMatch(/beyond 2 SE: \d+ of 4 \(chance: about 0\.2/);
    expect(text).toContain('| Deck 3 | bred |');
    expect(text).toMatch(/Spearman of the two deck orders/);
    expect(text).toMatch(/Same result on the same deal/);
    expect(text).toContain('BBG control family');
    expect(text).toMatch(/no deck of this field/);
  });
});
