// The rating series' card impact (src/lib/seriesImpact.ts; docs/SERIES.md "The card table"): the counts folded as the
// games arrive give exactly analyzeAll's figures (the season's definition), the block reads back and refuses what is
// malformed, a run is added to each of the two tables once (a second pass adds nothing, a step stopped between the two
// writes is finished by the next), a table that counts a run under another run id is refused, and check:data's problems.
// Invented summaries only; nothing here plays a game.
import { describe, expect, it } from 'vitest';
import { analyzeAll } from '../src/analysis/analyze';
import type { PlayerSummary } from '../src/analysis/summarize';
import { CARD_BY_ID } from '../src/engine/cards';
import { addRunImpact, ImpactCounter, readRunImpact, RUN_IMPACT_KIND, seriesImpactProblems, type RunWithImpact } from '../src/lib/seriesImpact';
import { emptyCardImpact, parseCardImpact, sourceWords } from '../src/lib/seasonImpact';
import { emptyDeckImpact, parseDeckImpact } from '../src/lib/seasonDeckImpact';
import { seededRandom } from '../src/lib/ratingModel';

const LEGEND = 'alt_cunningham_soulkiller_architect';
const CARDS = ['floor_it', 'tetratronic_rippler', 'trust_no_one', 'dying_night_v_s_pistol', 'evelyn_parker_scheming_siren', 'jacked_in_voodoo_boy'];

/** A summary with every field analyzeAll reads, the deck's draws and result invented from `rnd`. */
function summary(deck: string, opp: string, first: boolean, result: 0 | 0.5 | 1, seen: string[]): PlayerSummary {
  return { deck, opp, first, result, mulligan: false, opening: seen.slice(0, 2), seen, played: {}, playCount: {}, sold: {}, calls: [], solos: [], legendPlays: [], attacksGigs: 0, attacksUnits: 0, firstAttackTurn: null, steals: {}, lost: {}, gigsAfterOwnTurn: [1], diffAfterOwnTurn: [0], turns: 10, overtime: false, reason: 'gigs' };
}
function games(n: number, seed: number): [PlayerSummary, PlayerSummary][] {
  const rnd = seededRandom(seed);
  const decks = ['Alpha', 'Beta', 'Gamma'];
  const out: [PlayerSummary, PlayerSummary][] = [];
  for (let k = 0; k < n; k++) {
    const a = decks[k % 3]!;
    const b = decks[(k + 1) % 3]!;
    const draw = () => [LEGEND, ...CARDS.filter(() => rnd() < 0.55)];
    const u = rnd();
    const r: 0 | 0.5 | 1 = u < 0.03 ? 0.5 : u < 0.52 ? 1 : 0;
    out.push([summary(a, b, k % 2 === 0, r, draw()), summary(b, a, k % 2 === 1, (1 - r) as 0 | 0.5 | 1, draw())]);
  }
  return out;
}
const isLegend = (id: string) => CARD_BY_ID[id]?.type === 'Legend';
const FP: Record<string, string> = { Alpha: 'aaaaaaaaaaaaaaaa', Beta: 'bbbbbbbbbbbbbbbb', Gamma: 'cccccccccccccccc' };

describe('the counts', () => {
  it('give exactly the figures analyzeAll gives for the same games (Legends left out, 8 games drawn and 8 not)', () => {
    const gs = games(300, 7);
    const c = new ImpactCounter(isLegend);
    for (const g of gs) c.add(g);
    const block = c.result((d) => FP[d]);
    expect(block).toMatchObject({ kind: RUN_IMPACT_KIND, schema: 1, games: 300 });
    const reps = analyzeAll(gs.flat());
    expect(block.decks.map((d) => d.deck)).toEqual(['Alpha', 'Beta', 'Gamma']);
    for (const d of block.decks) {
      const rep = reps.find((r) => r.deck === d.deck)!;
      expect(d.games).toBe(rep.games);
      const want = rep.cards.filter((x) => Number.isFinite(x.iwd)).map((x) => ({ id: x.id, iwd: x.iwd, seenGames: x.seenGames }));
      expect([...d.cards].sort((x, y) => x.id.localeCompare(y.id))).toEqual(want.sort((x, y) => x.id.localeCompare(y.id)));
      expect(d.cards.some((x) => x.id === LEGEND)).toBe(false);
      expect(d.id).toBe(FP[d.deck]);
    }
    // a deck whose list is unknown is left out
    expect(c.result((d) => (d === 'Beta' ? undefined : FP[d])).decks.map((d) => d.deck)).toEqual(['Alpha', 'Gamma']);
  });
  it('reads back; a malformed block is refused with a reason', () => {
    const c = new ImpactCounter(isLegend);
    for (const g of games(60, 3)) c.add(g);
    const block = JSON.parse(JSON.stringify(c.result((d) => FP[d])));
    expect(readRunImpact(block).impact).toEqual(block);
    expect(readRunImpact({ ...block, kind: 'x' }).problem).toMatch(/not a run card-impact block/);
    expect(readRunImpact({ ...block, decks: [{ ...block.decks[0], id: 'Alpha' }] }).problem).toMatch(/not a list fingerprint/);
    expect(readRunImpact({ ...block, decks: [block.decks[0], block.decks[0]] }).problem).toMatch(/twice/);
    expect(readRunImpact({ ...block, decks: [{ ...block.decks[0], cards: [{ id: 'floor_it', iwd: null, seenGames: 3 }] }] }).problem).toMatch(/malformed/);
  });
});

describe('the two tables', () => {
  const run = (id: string, runId = `series:${id}:2026-11-24T00:00:00.000Z`): RunWithImpact => {
    const c = new ImpactCounter(isLegend);
    for (const g of games(120, id.length + Number(id.slice(4)))) c.add(g);
    return { id, runId, simVersion: 9, bot: 'hard', impact: c.result((d) => FP[d]) };
  };
  it('a run is added once to each, under its own pair, with the run as the source; a second pass adds nothing', () => {
    const card = emptyCardImpact();
    const deck = emptyDeckImpact();
    const r2 = run('run-2');
    expect(addRunImpact(card, deck, r2)).toEqual({ card: true, deck: true });
    const snapshot = JSON.stringify([card, deck]);
    expect(addRunImpact(card, deck, r2)).toEqual({ card: false, deck: false });
    expect(JSON.stringify([card, deck])).toBe(snapshot);
    expect(card.entries).toHaveLength(1);
    expect(card.entries[0]).toMatchObject({ simVersion: 9, bot: 'hard', sources: [{ kind: 'series', run: 'run-2', runId: r2.runId }] });
    expect(Object.keys(deck.entries[0]!.lists).sort()).toEqual(Object.values(FP).sort());
    const n = Object.values(card.entries[0]!.cards).reduce((k, v) => k + v.n, 0);
    expect(n).toBe(r2.impact.decks.reduce((k, d) => k + d.cards.reduce((q, x) => q + x.seenGames, 0), 0));
    // the files still read, and the source has words
    expect(parseCardImpact(JSON.parse(JSON.stringify(card))).problem).toBeUndefined();
    expect(parseDeckImpact(JSON.parse(JSON.stringify(deck))).problem).toBeUndefined();
    expect(sourceWords(card.entries[0]!.sources[0]!)).toBe('rating run 2');
    expect(seriesImpactProblems(card, deck, [r2])).toEqual([]);
  });
  it('a step stopped between the two writes is finished by the next one, and adds to the other file only', () => {
    const card = emptyCardImpact();
    const deck = emptyDeckImpact();
    const r2 = run('run-2');
    addRunImpact(card, emptyDeckImpact(), r2);
    expect(seriesImpactProblems(card, deck, [r2])).toEqual(['rating run-2 carries card impact but data/seasons/deck-impact.json does not count it (run npx tsx scripts/series.ts impact)']);
    const before = JSON.stringify(card);
    expect(addRunImpact(card, deck, r2)).toEqual({ card: false, deck: true });
    expect(JSON.stringify(card)).toBe(before);
    expect(seriesImpactProblems(card, deck, [r2])).toEqual([]);
  });
  it('refuses a table that counts the run under another run id (a run file replaced), and check:data names it and an unrecorded run', () => {
    const card = emptyCardImpact();
    const deck = emptyDeckImpact();
    addRunImpact(card, deck, run('run-2'));
    const other = run('run-2', 'series:run-2:2026-11-25T00:00:00.000Z');
    expect(() => addRunImpact(card, deck, other)).toThrow(/counts rating run-2 as series:run-2:2026-11-24.* a run file replaced after it was counted/);
    expect(seriesImpactProblems(card, deck, [other])).toEqual([
      'data/seasons/impact.json counts rating run-2 as series:run-2:2026-11-24T00:00:00.000Z, but the run file is series:run-2:2026-11-25T00:00:00.000Z',
      'data/seasons/deck-impact.json counts rating run-2 as series:run-2:2026-11-24T00:00:00.000Z, but the run file is series:run-2:2026-11-25T00:00:00.000Z',
    ]);
    expect(seriesImpactProblems(card, deck, [])).toEqual([
      'data/seasons/impact.json counts rating run-2, which is not a recorded run that carries card impact',
      'data/seasons/deck-impact.json counts rating run-2, which is not a recorded run that carries card impact',
    ]);
  });
  it('a run counted in two entries is refused by the parser', () => {
    const card = emptyCardImpact();
    const deck = emptyDeckImpact();
    addRunImpact(card, deck, run('run-2'));
    const twice = JSON.parse(JSON.stringify(card));
    twice.entries.push({ ...twice.entries[0], bot: 'medium' });
    expect(parseCardImpact(twice).problem).toMatch(/counts rating run 2 in two entries/);
  });
});
