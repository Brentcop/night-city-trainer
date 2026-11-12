// ROADMAP2 §1 step 3: synergy packages in deck building (src/lib/deckPackages.ts). The plan checker (keep with roles
// respected, require, avoid, locks), each package move kind (legal lists, plan and roles respected), seeding and the
// colour check, the breeder's package option, and the CLI flag parsing. Default behaviour without packages is pinned in
// tests/deck-packages-defaults.test.ts.
import { describe, expect, it } from 'vitest';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import { validateDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import { covers, membersOf, SYNERGY_BY_ID, synergiesIn } from '../src/content/synergies';
import {
  addPackage,
  builtAroundIds,
  canCut,
  checkChange,
  checkList,
  defaultKeep,
  describeChanges,
  fitToPlan,
  holdsPackage,
  isBuiltAround,
  packageChanges,
  packageCompatibility,
  packageCopies,
  packageMoves,
  packageTriples,
  parseLockCards,
  parsePackageList,
  parseSeedCombos,
  planProblems,
  pullsApart,
  removePackage,
  seedAround,
  swapPackage,
  tunerPackageMoves,
  type PackagePlan,
} from '../src/lib/deckPackages';
import { breedSeason, fill } from '../src/ai/breeder';
import { cardValue } from '../src/ai/knowledge';
import { BUILTIN } from '../src/lib/browserLibrary';
import { ArgError, parseArgs } from '../scripts/lib-node';
import { breederPackageFlags, packagesOn, planArgs, planFromFlags, tunerPackageFlags } from '../scripts/package-flags';
import { forgeSwaps, optimizeCandidates } from '../scripts/builder-moves';
import { synthBreedInput, synthReport, SYNTH_IMPACT } from './builder-fixtures';

// Low Gigs (min-gig): pieces need each other; built around = 6 pieces with 2 enablers and 2 payoffs
const E = 'dying_night_v_s_pistol'; // enabler, Blue Gear
const P1 = 'chrome_reverie'; // payoff
const P2 = 'three_mouths_one_desire'; // payoff
const BLUE = ['judy_alvarez_braindance_maestro', 'sasha_yakovleva_won_t_let_you_down', 'v_corporate_exile']; // no Low Gigs Legends
const BBR = ['judy_alvarez_braindance_maestro', 'sasha_yakovleva_won_t_let_you_down', 'royce_psycho_on_the_edge'];

/** Legal fillers for the Legends that belong to no package of the catalogue's Gig or Street Cred families. */
function fillers(legends: string[], n: number, not: string[] = []): string[] {
  const deny = new Set([...not, ...membersOf(SYNERGY_BY_ID['min-gig']!).map((m) => m.id), ...membersOf(SYNERGY_BY_ID['high-gig']!).map((m) => m.id), ...membersOf(SYNERGY_BY_ID['low-cred']!).map((m) => m.id)]);
  const colors = new Set(legends.map((l) => CARD_BY_ID[l]!.color));
  const out: string[] = [];
  for (const c of CARDS.filter((x) => x.type !== 'Legend' && colors.has(x.color) && x.ram <= 2 && !deny.has(x.id)).sort((a, b) => (a.id < b.id ? -1 : 1)))
    for (let k = 0; k < 3 && out.length < n; k++) out.push(c.id);
  return out;
}
function deck(core: string[], legends = BLUE, name = 'Test'): DeckList {
  const d = { name, legends, main: [...core, ...fillers(legends, 40 - core.length)], sideboard: [] };
  expect(validateDeck(d)).toEqual([]);
  return d;
}
const cut = (d: DeckList, id: string, n = 1): DeckList => {
  const main = [...d.main];
  for (let i = 0; i < n; i++) main.splice(main.indexOf(id), 1);
  const f = fillers(d.legends, 40, main);
  return { ...d, main: [...main, ...f.filter((x) => !main.includes(x)).slice(0, n)] };
};

describe('package plan: checks', () => {
  const around = deck([E, E, P1, P1, P1, P2, P2]); // 2 enablers, 5 payoffs: built around, one payoff to spare

  it('keep protects the working minimum and respects roles, but never freezes cards beyond it', () => {
    expect(isBuiltAround('min-gig', around)).toBe(true);
    const plan: PackagePlan = { keep: ['min-gig'] };
    // the enablers are at their minimum: cutting one breaks the package
    const v = checkChange(around, cut(around, E), plan);
    expect(v).toHaveLength(1);
    expect(v[0]!.rule).toBe('keep');
    expect(v[0]!.text).toMatch(/kept package Low Gigs/);
    expect(canCut(around, E, plan)).toBe(false);
    // a spare payoff can go; the next one can't (6 pieces in all)
    expect(checkChange(around, cut(around, P1), plan)).toEqual([]);
    expect(checkChange(around, cut(around, P1, 2), plan)[0]?.rule).toBe('keep');
    expect(canCut(around, P1, plan)).toBe(true);
    // a kept package the list doesn't hold constrains nothing
    expect(checkChange(around, cut(around, E), { keep: ['arasaka'] })).toEqual([]);
  });

  it('a list holding only the needed pieces keeps both roles of a package whose pieces need each other', () => {
    const half = deck([E, P1, P1]);
    expect(isBuiltAround('min-gig', half)).toBe(false);
    expect(holdsPackage('min-gig', half)).toBe(true);
    expect(checkChange(half, cut(half, E), { keep: ['min-gig'] })[0]?.text).toMatch(/working pieces/);
    expect(checkChange(half, cut(half, P1), { keep: ['min-gig'] })).toEqual([]);
    expect(checkChange(half, cut(half, P1, 2), { keep: ['min-gig'] })).toHaveLength(1);
  });

  it('require: no move away from the package; avoid: no new pieces while built around it; locks hold', () => {
    const half = deck([E, P1, P1]);
    expect(checkChange(half, cut(half, P1), { require: ['min-gig'] })[0]?.rule).toBe('require');
    const more = { ...half, main: [...half.main.slice(0, -1), E] };
    expect(checkChange(half, more, { require: ['min-gig'] })).toEqual([]);
    // avoid: adding a piece is fine while the list is not built around it, refused once it is
    expect(checkChange(half, more, { avoid: ['min-gig'] })).toEqual([]);
    const plus = { ...around, main: [...around.main.slice(0, -1), 'trust_no_one'] };
    expect(checkChange(around, plus, { avoid: ['min-gig'] })[0]?.rule).toBe('avoid');
    // locks: 3 copies locked at 2
    expect(checkChange(around, cut(around, P1), { lockCards: { [P1]: 2 } })).toEqual([]);
    expect(checkChange(around, cut(around, P1, 2), { lockCards: { [P1]: 2 } })[0]?.rule).toBe('lock');
  });

  it('checkList: kept and required packages built around, avoided not, locks held, the deck legal', () => {
    expect(checkList(around, { keep: ['min-gig'], require: ['min-gig'], lockCards: { [E]: 2 } })).toEqual([]);
    expect(checkList(around, { avoid: ['min-gig'] }).map((v) => v.rule)).toEqual(['avoid']);
    expect(checkList(deck([E, P1]), { require: ['min-gig'] }).map((v) => v.rule)).toEqual(['require']);
    expect(checkList({ ...around, main: around.main.slice(0, 30) }, {}).map((v) => v.rule)).toEqual(['deck']);
  });

  it('planProblems names unknown ids, contradictions and bad locks', () => {
    expect(planProblems({ keep: ['min-gig'], require: ['nope'], avoid: ['min-gig'], lockCards: { [E]: 4, jackie_welles_pour_one_out_for_me: 1 } })).toEqual([
      'require: unknown package "nope"',
      '"min-gig" is both kept and avoided',
      `lock: ${E} needs 1–3 copies, got 4`,
      'lock: Jackie Welles: Pour One Out For Me is a Legend (package changes never touch Legends)',
    ]);
    expect(planProblems({ keep: ['min-gig'], lockCards: { [E]: 2 } })).toEqual([]);
  });
});

/** Every move is a legal 40-card list that the plan allows. */
function expectLegal(before: DeckList, after: DeckList, plan: PackagePlan) {
  expect(validateDeck(after)).toEqual([]);
  expect(after.main).toHaveLength(before.main.length);
  expect(after.legends).toEqual(before.legends);
  expect(checkChange(before, after, plan)).toEqual([]);
}

describe('package moves', () => {
  it('complete: a payoff without its enabler gets the missing side', () => {
    const d = deck([P1, P1, P2, P2]);
    expect(holdsPackage('min-gig', d)).toBe(false);
    const m = packageMoves(d, { kinds: ['complete'], packages: ['min-gig'], score: cardValue })[0]!;
    expect(m.kind).toBe('complete');
    expect(m.added).toBe('min-gig');
    expectLegal(d, m.deck, {});
    const c = packageCopies(SYNERGY_BY_ID['min-gig']!, m.deck).copies;
    expect(covers(c, SYNERGY_BY_ID['min-gig']!.needs)).toBe(true);
    // the missing role is filled to its built-around count (2 enablers), never by cutting the payoffs
    expect(c.enabler + c.both).toBeGreaterThanOrEqual(2);
    expect(m.cardsOut.some((id) => id === P1 || id === P2)).toBe(false);
  });

  it('add: the minimum working set, cutting cards outside the kept packages first', () => {
    const d = deck([E, E, P1, P1, P1, P2, P2], BBR);
    expect(isBuiltAround('high-gig', d)).toBe(false);
    const plan: PackagePlan = { keep: ['min-gig'] };
    const m = addPackage(d, 'high-gig', { plan, score: cardValue })!;
    expect(m.kind).toBe('add');
    expectLegal(d, m.deck, plan);
    expect(isBuiltAround('high-gig', m.deck)).toBe(true);
    expect(isBuiltAround('min-gig', m.deck)).toBe(true);
    const keepIds = new Set(membersOf(SYNERGY_BY_ID['min-gig']!).map((x) => x.id));
    expect(m.cardsOut.filter((id) => keepIds.has(id))).toEqual([]);
    // only as many cards as the minimum needs (6 pieces: 2 enablers, 2 payoffs)
    expect(m.cardsIn.length).toBeLessThanOrEqual(6);
  });

  it('remove: the package goes whole, refilled from outside it; a kept package is never removed', () => {
    const d = deck([E, E, P1, P1, P2, P2]);
    const m = removePackage(d, 'min-gig', { score: cardValue })!;
    expect(m.kind).toBe('remove');
    expectLegal(d, m.deck, {});
    expect(holdsPackage('min-gig', m.deck)).toBe(false);
    expect(removePackage(d, 'min-gig', { score: cardValue, plan: { keep: ['min-gig'] } })).toBeNull();
    expect(packageMoves(d, { plan: { keep: ['min-gig'] }, score: cardValue }).some((x) => x.removed === 'min-gig')).toBe(false);
  });

  it('swap: one package for another of similar size, when the Legends can hold it', () => {
    const d = deck([E, E, P1, P1, P2, P2], BBR);
    const m = swapPackage(d, 'min-gig', 'high-gig', { score: cardValue })!;
    expect(m.kind).toBe('swap');
    expect(m.removed).toBe('min-gig');
    expect(m.added).toBe('high-gig');
    expectLegal(d, m.deck, {});
    expect(isBuiltAround('high-gig', m.deck)).toBe(true);
    expect(holdsPackage('min-gig', m.deck)).toBe(false);
    // three Blue Legends have no Red RAM for High Gigs
    expect(swapPackage(deck([E, E, P1, P1, P2, P2]), 'min-gig', 'high-gig', { score: cardValue })).toBeNull();
  });

  it('on every library deck, with its built-around packages kept, every move is legal and keeps them', () => {
    for (const lib of BUILTIN.filter((x) => x.kind === 'meta')) {
      const keep = builtAroundIds(lib.deck);
      const plan: PackagePlan = { keep, avoid: ['comeback'].filter((x) => !keep.includes(x)) };
      const moves = packageMoves(lib.deck, { plan, score: cardValue });
      expect(moves.length).toBeGreaterThan(0);
      for (const m of moves) {
        expectLegal(lib.deck, m.deck, plan);
        for (const id of keep) expect(isBuiltAround(id, m.deck)).toBe(true);
        expect(m.added).not.toBe('comeback');
      }
      // limit takes every kind in turn
      const four = packageMoves(lib.deck, { plan, score: cardValue, limit: 4 });
      expect(new Set(four.map((m) => m.kind)).size).toBe(Math.min(4, new Set(moves.map((m) => m.kind)).size));
    }
  });

  it('tuner rounds: required packages the list lacks are always tried; swaps under a plan never break it', () => {
    const d = deck([P1, P1, P2, P2], BBR);
    const ms = tunerPackageMoves(d, { require: ['high-gig'] }, { moves: false, n: 3, score: cardValue });
    expect(ms.length).toBeGreaterThan(0);
    expect(ms.every((m) => m.added === 'high-gig')).toBe(true);
    const around = deck([E, E, P1, P1, P2, P2]);
    const plan: PackagePlan = { keep: ['min-gig'], lockCards: { [P1]: 2 } };
    const rep = synthReport(around);
    for (const s of forgeSwaps(around, rep, SYNTH_IMPACT, 20, plan)) expect(checkChange(around, s.deck, plan)).toEqual([]);
    for (const s of optimizeCandidates(around, false, 200, plan)) expect(checkChange(around, s.deck, plan)).toEqual([]);
    // without the plan the same builders do cut those pieces
    expect(optimizeCandidates(around, false, 200).some((s) => checkChange(around, s.deck, plan).length > 0)).toBe(true);
  });

  it('packageChanges says what was kept, added and removed', () => {
    const d = deck([E, E, P1, P1, P2, P2], BBR);
    const m = swapPackage(d, 'min-gig', 'high-gig', { score: cardValue })!;
    const c = packageChanges(d, m.deck);
    expect(c.added).toContain('high-gig');
    expect(c.removed).toContain('min-gig');
    expect(describeChanges(c)).toMatch(/added .*High Gigs/);
  });
});

describe('seeding around packages', () => {
  it('finds Legend trios that hold both packages and builds a list around them', () => {
    const ids = ['low-cred', 'program-fuel'];
    const trios = packageTriples(ids);
    expect(trios.length).toBeGreaterThan(0);
    const best = trios[0]!;
    const s = seedAround(ids, best.legends, (l) => fill(l, new Map(), SYNTH_IMPACT, 'midrange', 'Seeded'), { score: cardValue });
    expect(s.violations).toEqual([]);
    for (const id of ids) expect(isBuiltAround(id, s.deck)).toBe(true);
    expect(synergiesIn(s.deck).filter((x) => x.builtAround).map((x) => x.synergy.id)).toEqual(expect.arrayContaining(ids));
  });

  it('says plainly when packages cannot share a deck, and warns when they pull opposite ways', () => {
    const red = ['dexter_deshawn_off_the_grid', 'johnny_silverhand_rocking_renegade', 'royce_psycho_on_the_edge'];
    const c = packageCompatibility(['low-cred'], { within: red });
    expect(c.ok).toBe(false);
    if (!c.ok) expect(c.reason).toMatch(/Behind on Street Cred \(all Blue\).*not enough RAM/);
    const two = packageCompatibility(['low-cred', 'high-gig'], { within: red });
    expect(two.ok).toBe(false);
    if (!two.ok) expect(two.reason).toMatch(/can't share this deck/);
    const w = packageCompatibility(['low-cred', 'high-cred']);
    expect(w.ok).toBe(true);
    if (w.ok) expect(w.warning).toBe(pullsApart('low-cred', 'high-cred'));
    expect(pullsApart('low-cred', 'program-fuel')).toBeUndefined();
  });

  it('the breeder builds explorers around seed packages and fits every deck to a required package', () => {
    const seeded = breedSeason(1, { ...synthBreedInput(false), packages: { seeds: [['low-cred', 'program-fuel']] } }, 8);
    const explorers = seeded.filter((b) => b.method === 'explorer');
    expect(explorers.length).toBeGreaterThan(0);
    for (const b of explorers) {
      expect(b.packages?.seeded).toEqual(['low-cred', 'program-fuel']);
      expect(isBuiltAround('low-cred', b.deck) && isBuiltAround('program-fuel', b.deck)).toBe(true);
    }
    const req = breedSeason(1, { ...synthBreedInput(false), packages: { plan: { require: ['arasaka'] } } }, 8);
    expect(req.length).toBeGreaterThan(0);
    for (const b of req) {
      expect(validateDeck(b.deck)).toEqual([]);
      expect(isBuiltAround('arasaka', b.deck)).toBe(true);
      expect(b.idea).toMatch(/Package plan: require Arasaka Units/);
    }
  });

  it('fitToPlan adds required packages and takes avoided ones out, or says why not', () => {
    const d = deck([E, E, P1, P1, P2, P2], BBR);
    const f = fitToPlan(d, { require: ['high-gig'], avoid: ['min-gig'] }, { score: cardValue });
    expect('deck' in f).toBe(true);
    if ('deck' in f) {
      expect(isBuiltAround('high-gig', f.deck) && !isBuiltAround('min-gig', f.deck)).toBe(true);
      expect(f.changes).toHaveLength(2);
    }
    expect('error' in fitToPlan(deck([P1]), { require: ['high-gig'] }, { score: cardValue })).toBe(true);
  });

  it('default keep: the objective packages when named, else the built-around ones', () => {
    const d = deck([E, E, P1, P1, P2, P2]);
    expect(defaultKeep(d)).toEqual(builtAroundIds(d));
    expect(defaultKeep(d, ['arasaka', 'nope'])).toEqual(['arasaka']);
  });
});

describe('package flags (scripts/package-flags.ts)', () => {
  const spec = { ...tunerPackageFlags(), ...breederPackageFlags() };
  const parse = (argv: string[]) => parseArgs(spec, argv).values;

  it('no package flag: nothing is on and the plan is empty', () => {
    const v = parse([]);
    expect(packagesOn(v)).toBe(false);
    expect(planFromFlags(v, ['min-gig'])).toEqual({});
    expect(planArgs(v)).toEqual([]);
  });

  it('parses lists, seeds and locks; the objective is the default keep only when a package flag is on', () => {
    const v = parse(['--package-moves', '--avoid-packages', 'comeback', '--lock-cards', `${P1}:2,${E}`]);
    expect(packagesOn(v)).toBe(true);
    expect(planFromFlags(v, ['min-gig', 'comeback'])).toEqual({ keep: ['min-gig'], avoid: ['comeback'], lockCards: { [P1]: 2, [E]: 3 } });
    expect(planFromFlags(parse(['--keep-packages', 'none', '--package-moves']), ['min-gig'])).toEqual({});
    expect(planFromFlags(parse(['--keep-packages', 'arasaka,rocker']), ['min-gig'])).toEqual({ keep: ['arasaka', 'rocker'] });
    expect(planArgs(parse(['--keep-packages', 'arasaka', '--package-moves']))).toEqual(['--keep-packages', 'arasaka', '--package-moves']);
    expect(parseSeedCombos('low-cred+program-fuel, arasaka').combos).toEqual([['low-cred', 'program-fuel'], ['arasaka']]);
  });

  it('unknown ids and bad values are refused with the valid ids (exit 2 in the scripts)', () => {
    expect(() => parse(['--keep-packages', 'min-gig,bogus'])).toThrow(ArgError);
    expect(() => parse(['--keep-packages', 'bogus'])).toThrow(/unknown package id "bogus"\. Valid ids: min-gig, high-gig/);
    expect(() => parse(['--seed-packages', 'a+b+c'])).toThrow(ArgError);
    expect(parseSeedCombos('low-cred+high-cred+arasaka').error).toMatch(/one or two packages/);
    expect(() => parse(['--lock-cards', 'not a card'])).toThrow(ArgError);
    expect(parseLockCards('jackie_welles_pour_one_out_for_me').error).toMatch(/is a Legend/);
    expect(() => parse(['--package-cands', '0'])).toThrow(ArgError);
    expect(parsePackageList('none')).toEqual({ ids: [] });
  });
});
