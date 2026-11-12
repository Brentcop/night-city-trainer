// ROADMAP2 §1 step 5 in the Deck Lab: the tuner judges changes by the shared adoption rule (src/lib/evidence.ts) on
// fresh paired games, with three outcomes; depth combines the best screened swaps; the result panel shows the outcome
// word, the held-out paired gain with its interval and games, and the depth control shows the game estimate.
// Games are faked (a hash of the seed decides them), so the true gain of every list is known.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { CARDS } from '../src/engine/cards';
import type { DeckList } from '../src/engine/types';
import { partialTune, tuneDeck, tunePlan, type TuneLog, type TuneOptions } from '../src/lib/deckLab';
import type { GameJob, PlayGame } from '../src/lib/tournament';
import { ADOPTION_DEFAULTS } from '../src/lib/evidence';
import { LAB_GAME_BUDGET } from '../src/lib/deckSearch';
import { DepthControls, NomineeTable, OutcomeChip } from '../src/ui/components/LabEvidence';
import { DeckLabPage, evidenceNote, GenerationSummary } from '../src/ui/pages/DeckLab';
import { BUILTIN } from '../src/lib/browserLibrary';
import { setArtEnabled } from '../src/ui/art';

function anyDeck(name: string, colors: string[]): DeckList {
  const legends = CARDS.filter((c) => c.type === 'Legend' && colors.includes(c.color)).slice(0, 3).map((c) => c.id);
  const pool = CARDS.filter((c) => c.type !== 'Legend' && colors.includes(c.color) && c.ram <= 2);
  const main: string[] = [];
  for (const c of pool) for (let i = 0; i < 3 && main.length < 40; i++) main.push(c.id);
  return { name, legends, main, sideboard: [] };
}
const start = anyDeck('A', ['Red', 'Yellow']);
const field = [anyDeck('B', ['Blue', 'Green'])];
/** cards changed from the starting list */
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
/** A well-mixed number in [0, 1) from a string (FNV's top bits barely move between neighbouring seeds). */
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
/**
 * A fake game: the same uniform number per seed for every list (paired games), a win when it is below the list's win
 * probability: 50% for the starting list plus `perChange` per changed card. `noise` replaces that share of games by an
 * independent coin per list.
 */
const fake =
  (perChange: number, noise = 0): PlayGame =>
  async (j: GameJob) => {
    const key = j.a.main.join();
    const p = 0.5 + perChange * changes(j.a);
    const u = unit(`g:${j.seed}`);
    const win = unit(`n:${j.seed}:${key}`) < noise ? unit(`c:${j.seed}:${key}`) < 0.5 : u < p;
    return { seed: j.seed, first: j.first, turns: 5, reason: 'test', winner: win ? 0 : 1 };
  };
const OPTS: TuneOptions = { games: 112, gens: 1, cands: 3, bot: 'easy', minGain: 0.02, seedBase: 500_000 };

describe('Deck Lab tuner under the evidence rule', () => {
  it('adopts a clear gain and reports the held-out paired figure, not the screening one', async () => {
    const end = await tuneDeck(start, field, OPTS, fake(0.15), () => undefined, () => false);
    const l = end.logs[0]!;
    expect(l.adopted).not.toBeNull();
    expect(l.nominees?.[0]?.outcome).toBe('adopt');
    expect(l.adoptedGain!.games).toBeGreaterThanOrEqual(ADOPTION_DEFAULTS.minGames);
    expect(l.adoptedGain!.lower).toBeGreaterThan(0.01);
    // held out: the confirmation games are not the screening games
    expect(l.nominees![0]!.heldOut!.games).toBe(224);
    expect(l.confirm).toMatchObject({ outcome: 'adopt', label: l.adopted });
    expect(partialTune(end)?.adopted).toEqual([l.adopted]);
  });

  it('rejects a change that plays exactly like the list', async () => {
    const end = await tuneDeck(start, field, { ...OPTS, minGain: -1 }, fake(0), () => undefined, () => false);
    const l = end.logs[0]!;
    expect(l.adopted).toBeNull();
    expect(l.nominees?.[0]).toMatchObject({ outcome: 'reject' });
    expect(l.nominees![0]!.heldOut!.looks).toBe(1);
  });

  it('a noisy change with no real gain runs to the cap and is "could not tell", not adopted', async () => {
    const end = await tuneDeck(start, field, { ...OPTS, games: 20, minGain: -1 }, fake(0, 0.9), () => undefined, () => false);
    const l = end.logs[0]!;
    expect(l.adopted).toBeNull();
    const n = l.nominees![0]!;
    expect(n.outcome).toBe('inconclusive');
    expect(n.heldOut!.games).toBe(40 * ADOPTION_DEFAULTS.capStages);
    expect(partialTune(end)).toBeNull();
    expect(evidenceNote(end.logs)).toMatch(/^Could not tell \(not adopted\): /);
  });

  it('the legacy rule adopts the same change on any gain after one confirmation', async () => {
    const end = await tuneDeck(start, field, { ...OPTS, games: 20, minGain: -1, rule: { kind: 'any-gain' } }, fake(0.01, 0.9), () => undefined, () => false);
    const n = end.logs[0]!.nominees![0]!;
    expect(n.heldOut!.looks).toBe(1);
    expect(n.heldOut!.games).toBe(40);
    expect(['adopt', 'reject']).toContain(n.outcome);
  });

  it('depth 2 nominates and judges a two-card change built from the best screened swaps', async () => {
    const end = await tuneDeck(start, field, { ...OPTS, depth: { cardsPerChange: 2 } }, fake(0.1), () => undefined, () => false);
    const l = end.logs[0]!;
    expect(l.swaps.some((s) => s.combo)).toBe(true);
    // two changes beat one, so the combined change screens best and is the nominee
    expect(l.nominees![0]!.label).toContain(' + ');
    expect(l.nominees![0]!.package).toBe('combo-cards');
    expect(l.adopted).toBe(l.nominees![0]!.label);
    expect(changes(end.deck)).toBe(2);
  });

  it('the plan estimate grows with depth and the defaults stay under the budget', () => {
    const quick = tunePlan({ games: 56, gens: 1, cands: 4 });
    expect(quick.estimate).toMatchObject({ min: 56 * 5, max: 56 * 5 + 112 * 4 * 2 });
    const deep = tunePlan({ games: 168, gens: 3, cands: 6, depth: { cardsPerChange: 3 } });
    expect(deep.estimate.max).toBeGreaterThan(tunePlan({ games: 168, gens: 3, cands: 6 }).estimate.max);
    expect(tunePlan({ games: 168, gens: 3, cands: 6 }).estimate.max).toBeLessThanOrEqual(LAB_GAME_BUDGET);
  });
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, String(v)), removeItem: (k: string) => void m.delete(k), clear: () => m.clear() };
}

describe('Deck Lab result view', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', memoryStorage());
    setArtEnabled(false);
  });
  afterEach(() => vi.unstubAllGlobals());

  const log: TuneLog = {
    gen: 1,
    baseline: 0.48,
    swaps: [{ label: '-1 A → +1 B', wr: 0.55, gain: { mean: 0.07, lower: -0.01, upper: 0.15, games: 112 } }],
    nominees: [
      {
        label: '-1 A → +1 B',
        screen: { games: 112, mean: 0.07, lower: -0.01, upper: 0.15 },
        heldOut: { games: 896, mean: 0.021, lower: -0.012, upper: 0.054, z: 2.5, looks: 4, baseWr: 0.49, candWr: 0.511 },
        outcome: 'inconclusive',
      },
    ],
    confirm: { base: 0.49, swap: 0.511, label: '-1 A → +1 B', outcome: 'inconclusive' },
    adopted: null,
  };

  it('a "could not tell" generation says so and never calls the change a gain', () => {
    const html = renderToStaticMarkup(<GenerationSummary log={log} />);
    expect(html).toContain('could not tell');
    expect(html).toContain('list kept');
    expect(html).not.toContain('>adopted');
    const table = renderToStaticMarkup(<NomineeTable nominees={log.nominees!} minGames={200} />);
    expect(table).toContain('Held-out paired gain');
    expect(table).toMatch(/\+2\.1 pts.*\[−1\.2, \+5\.4\] · 896 games/);
    expect(table).toMatch(/class="verdict neu" title="[^"]*not adopted">could not tell/);
    // the screening sample (112 games, under the 200-game floor of the held-out column but over 20) is shown plainly;
    // a held-out sample under the floor is flagged
    const small = renderToStaticMarkup(<NomineeTable nominees={[{ ...log.nominees![0]!, heldOut: { ...log.nominees![0]!.heldOut!, games: 112 } }]} minGames={200} />);
    expect(small).toContain('(small sample)');
  });

  it('an adopted generation shows the held-out gain beside the change', () => {
    const adopted: TuneLog = { ...log, adopted: '-1 A → +1 B', adoptedGain: { mean: 0.06, lower: 0.02, upper: 0.1, games: 448, z: 2.5 }, nominees: [{ ...log.nominees![0]!, outcome: 'adopt' }] };
    const html = renderToStaticMarkup(<GenerationSummary log={adopted} />);
    expect(html).toContain('class="verdict pos">adopted');
    expect(html).toMatch(/held-out .*\+6\.0 pts/);
    expect(evidenceNote([adopted])).toBe('Deck Lab adopted: -1 A → +1 B (held-out +6.0 pts [+2.0, +10.0], 448 games).');
    expect(renderToStaticMarkup(<OutcomeChip outcome="reject" />)).toBe('<span class="verdict neg">rejected</span>');
  });

  it('the depth control shows the estimate and warns over the budget', () => {
    const p = tunePlan({ games: 56, gens: 1, cands: 4 });
    const props = { cards: 1, onCards: () => undefined, packages: 1, onPackages: () => undefined, packagesOn: false, budget: LAB_GAME_BUDGET, rule: p.rule, firstStage: p.firstStage };
    const html = renderToStaticMarkup(<DepthControls {...props} estimate={p.estimate} />);
    expect(html).toContain('<legend>Search depth</legend>');
    expect(html).toContain(`This run plays ${p.estimate.min}–${p.estimate.max.toLocaleString('en-US')} games.`);
    expect(html).toContain('clearly above 1 point');
    expect(html).not.toContain('budget');
    expect(html).toMatch(/<select disabled="">/); // packages per change needs package moves on
    expect(renderToStaticMarkup(<DepthControls {...props} estimate={{ min: 1000, max: 20_000 }} />)).toContain('over the lab&#x27;s budget of 12,000 games');
  });

  it('the Tune tab shows the depth control with the default estimate', () => {
    const lib = BUILTIN.find((d) => d.kind === 'meta')!;
    const html = renderToStaticMarkup(<DeckLabPage q={new URLSearchParams(`d=${lib.file}`)} />);
    expect(html).toContain('<legend>Search depth</legend>');
    const p = tunePlan({ games: 56, gens: 1, cands: 4, packageCands: 3 });
    expect(html).toContain(`This run plays ${p.estimate.min}–${p.estimate.max.toLocaleString('en-US')} games.`);
  });
});
