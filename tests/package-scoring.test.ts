// Package scoring (docs/ROADMAP2.md §1 step 4, src/ai/packages.ts): a seat's packages come from its own list and are
// cached outside the state; each evaluation term on hand-built positions; all package weights 0 = the bots play exactly
// as before; a list built around no package plays the same games with the weights on; the coach names the package in
// plain words; the rival's hidden cards never move a package term; the state stays plain data.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { listFingerprint, parseDeck } from '../src/engine/deck';
import type { Decision, DeckList, PlayerId } from '../src/engine/types';
import { DEFAULT_WEIGHTS, evaluate, packageTerms, PACKAGE_WEIGHTS, usesPackages, withoutPackages, type EvalWeights } from '../src/ai/eval';
import {
  activeSteer,
  assembled,
  assemblyCredit,
  holdCredit,
  packageFacts,
  packagesForList,
  partnerObtainable,
  protectCredit,
  seatPackages,
  steerCredit,
  steerOf,
  steerValue,
  type PackageFacts,
  type SeatPackage,
} from '../src/ai/packages';
import { HeuristicAgent } from '../src/ai/heuristic';
import { boardWarnings, packageNotes, packageWarnings } from '../src/ai/coach';
import { SYNERGY_BY_ID, roleMap, zeroRoles } from '../src/content/synergies/index';
import { BEST_PROFILES } from '../src/ai/archetype';
import { fillerDeck, gig, Scripted } from './engine-helpers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const BBG = deck('meta-bbg-cunningham-econ.txt');
/** A list built around no package: archived S4-03 Mutant with its 3 Over the Edge (a High Gigs payoff since the
 *  2026-11-12 review) swapped for 3 Japantown Jonin. */
function builtAroundNothing(): DeckList {
  const d = deck('archive/s4-03-mutant-rrb.txt');
  return { ...d, main: d.main.map((id) => (id === 'over_the_edge' ? 'japantown_jonin' : id)) };
}

/** A BBG Cunningham Econ game (seat 0) in seat 0's main phase on turn 3, with both hands put back in the decks. */
function bbgGame(): Game {
  const g = Game.create([BBG, fillerDeck('B')], [new Scripted(), new Scripted()], { seed: 5, first: 0 });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).hand]) g.move(u, 'deck');
  return g;
}
/** Move one copy of a card from p's deck to a zone. */
function take(g: Game, p: PlayerId, id: string, zone: 'hand' | 'field' | 'trash') {
  const u = g.P(p).deck.find((x) => g.c(x).defId === id);
  if (u === undefined) throw new Error(`no ${id} left in the deck`);
  g.move(u, zone);
  return g.c(u);
}
const facts = (g: Game, p: PlayerId = 0) => packageFacts(g, p);
const factOf = (g: Game, id: string, p: PlayerId = 0) => facts(g, p).find((f) => f.pkg.id === id)!;

describe('package context', () => {
  it('comes from the list: the packages it is built around, with the steerable quantities, cached by fingerprint', () => {
    const pk = packagesForList(BBG);
    const ids = pk.map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(['program-fuel', 'min-gig', 'low-cred']));
    expect(pk.every((x) => x.source === 'built-around')).toBe(true);
    expect(pk.find((x) => x.id === 'min-gig')!.steer).toEqual(['min-gig']);
    expect(pk.find((x) => x.id === 'low-cred')!.steer).toEqual(['cred-low']);
    expect(pk.find((x) => x.id === 'program-fuel')!.steer).toEqual([]);
    expect(packagesForList(BBG)).toBe(pk);
    const g = bbgGame();
    expect(seatPackages(g, 0)).toBe(pk);
    // a clone (as every lookahead makes) finds the same cached entry through PlayerState.listId
    expect(seatPackages(g.clone([new Scripted(), new Scripted()]), 0)).toBe(pk);
    // and the package list for a seat never depends on what is where
    take(g, 0, 'trust_no_one', 'trash');
    expect(seatPackages(g, 0)).toBe(pk);
  });
  it('reads the steerable quantities off the online condition', () => {
    expect(steerOf(SYNERGY_BY_ID['value-pair'].online)).toEqual(['value-pair']);
    expect(steerOf(SYNERGY_BY_ID['gig-spread'].online)).toEqual(['gig-spread']);
    expect(steerOf(SYNERGY_BY_ID['high-cred'].online)).toEqual(['cred-high']);
    expect(steerOf(SYNERGY_BY_ID['gig-swap'].online)).toEqual(['min-gig']);
    expect(steerOf(SYNERGY_BY_ID['comeback'].online)).toEqual([]);
    expect(steerOf(SYNERGY_BY_ID['units-in-trash'].online)).toEqual([]);
    expect(steerOf(SYNERGY_BY_ID['cred-20'].online)).toEqual(['cred-20']);
    // a hand-dependent or trash condition is not steered
    expect(steerOf(SYNERGY_BY_ID['cost-match'].online)).toEqual([]);
    expect(steerOf(SYNERGY_BY_ID['relic-loop'].online)).toEqual([]);
  });
  it('counts own pieces by zone and role from the seat’s own view', () => {
    const g = bbgGame();
    take(g, 0, 'trust_no_one', 'hand');
    take(g, 0, 'three_mouths_one_desire', 'trash');
    const f = factOf(g, 'min-gig');
    expect(f.hand.both).toBe(1); // Trust No One
    expect(f.trash.payoff).toBe(1); // Three Mouths
    expect(f.deck.both).toBe(2);
    expect(f.deck.payoff).toBe(8); // 2 Three Mouths + 3 Chrome Reverie + 3 Pyramid Song
    // Alt Cunningham (payoff) and Jackie (both) are face-down Legends
    expect(f.legendsDown).toEqual({ ...zeroRoles(), payoff: 1, both: 1 });
  });
  it('a list built around nothing has no package context', () => {
    const none = builtAroundNothing();
    expect(packagesForList(none)).toEqual([]);
  });
});

/** Hand-built facts for one package. */
function mk(id: string, f: Partial<Omit<PackageFacts, 'pkg'>>): PackageFacts {
  const s = SYNERGY_BY_ID[id];
  const pkg: SeatPackage = { id, name: s.name, family: s.family, bond: s.bond, needs: s.needs, roles: roleMap(s), steer: steerOf(s.online), source: 'built-around' };
  return { pkg, hand: zeroRoles(), play: zeroRoles(), legendsDown: zeroRoles(), trash: zeroRoles(), deck: zeroRoles(), ...f };
}

describe('the terms on hand-built positions', () => {
  it('pkgHold: the last payoff whose enabler is still in the deck counts fully; with no partner left, nothing', () => {
    // min-gig (requires): Three Mouths is a payoff; one in hand, the only enabler still in the deck
    const lastPayoff = mk('min-gig', { hand: { ...zeroRoles(), payoff: 1 }, deck: { ...zeroRoles(), enabler: 1 } });
    expect(partnerObtainable(lastPayoff, 'payoff')).toBe(true);
    expect(holdCredit([lastPayoff], 'three_mouths_one_desire')).toBe(1);
    // one of two payoffs: half
    expect(holdCredit([mk('min-gig', { hand: { ...zeroRoles(), payoff: 2 }, deck: { ...zeroRoles(), enabler: 1 } })], 'three_mouths_one_desire')).toBe(0.5);
    // every enabler gone: no partner, no credit
    const stranded = mk('min-gig', { hand: { ...zeroRoles(), payoff: 1 }, trash: { ...zeroRoles(), enabler: 3 } });
    expect(partnerObtainable(stranded, 'payoff')).toBe(false);
    expect(holdCredit([stranded], 'three_mouths_one_desire')).toBe(0);
    // a card in no package
    expect(holdCredit([lastPayoff], 'psycho_squad')).toBe(0);
    // a `helps` package counts half
    expect(holdCredit([mk('low-cred', { hand: { ...zeroRoles(), payoff: 1 }, deck: { ...zeroRoles(), enabler: 1 } })], 'towerfall')).toBe(0.5);
  });
  it('pkgAssembly: enabler and payoff available together (requires 1, helps ½)', () => {
    expect(assemblyCredit([mk('min-gig', { hand: { ...zeroRoles(), payoff: 1 }, deck: { ...zeroRoles(), enabler: 3 } })])).toBe(0);
    const both = mk('min-gig', { hand: { ...zeroRoles(), payoff: 1 }, legendsDown: { ...zeroRoles(), both: 1 } });
    expect(assembled(both)).toBe(true);
    expect(assemblyCredit([both])).toBe(1);
    expect(assemblyCredit([both, mk('low-cred', { hand: { ...zeroRoles(), payoff: 1, enabler: 1 } })])).toBe(1.5);
  });
  it('pkgProtect: only a `requires` package assembled in play, per member in play (at most 3)', () => {
    expect(protectCredit([mk('min-gig', { play: { ...zeroRoles(), payoff: 1, enabler: 1 } })])).toBe(2);
    expect(protectCredit([mk('min-gig', { play: { ...zeroRoles(), payoff: 3, enabler: 2 } })])).toBe(3);
    expect(protectCredit([mk('min-gig', { play: { ...zeroRoles(), payoff: 2 } })])).toBe(0);
    expect(protectCredit([mk('low-cred', { play: { ...zeroRoles(), payoff: 1, enabler: 1 } })])).toBe(0); // helps
  });
  it('pkgSteer: toward the condition, only while a payoff is available', () => {
    const d = (sides: number, value: number) => ({ sides, value });
    expect(steerValue('cred-low', [d(6, 2)], [d(8, 8)])).toBe(1);
    expect(steerValue('cred-low', [d(8, 8)], [d(6, 5)])).toBeCloseTo(-0.5);
    expect(steerValue('cred-low', [], [d(4, 1)])).toBeCloseTo(1 / 6); // Null is the lowest
    expect(steerValue('cred-high', [d(12, 12)], [d(4, 3)])).toBe(1);
    expect(steerValue('cred-20', [d(12, 12), d(8, 8)], [d(20, 20)])).toBeCloseTo(1 / 6); // 20: just there, whatever the rival holds
    expect(steerValue('cred-20', [d(12, 12), d(8, 7)], [])).toBe(0);
    expect(steerValue('cred-even', [d(4, 3), d(6, 3)], [])).toBe(1);
    expect(steerValue('min-gig', [d(4, 1), d(6, 2)], [])).toBeCloseTo(0.625);
    expect(steerValue('high-gig', [d(4, 4), d(10, 9)], [])).toBe(1);
    expect(steerValue('value-pair', [d(4, 3), d(6, 3)], [])).toBe(0.5);
    expect(steerValue('gig-spread', [d(4, 1), d(6, 2)], [])).toBe(1);
    expect(steerCredit(['cred-low', 'min-gig'], [d(4, 1)], [d(6, 6)])).toBeCloseTo(5 / 6 + 0.5);
    // no payoff available: nothing to steer for
    expect(activeSteer([mk('low-cred', { deck: { ...zeroRoles(), payoff: 3 } })])).toEqual([]);
    expect(activeSteer([mk('low-cred', { hand: { ...zeroRoles(), payoff: 1 } })])).toEqual(['cred-low']);
  });
  it('evaluate() adds exactly the weighted terms, for the evaluating seat only', () => {
    const g = bbgGame();
    take(g, 0, 'three_mouths_one_desire', 'hand');
    take(g, 0, 'towerfall', 'hand');
    gig(g, 0, 4, 1);
    gig(g, 1, 6, 5);
    const w: EvalWeights = { ...DEFAULT_WEIGHTS, pkgAssembly: 5, pkgSteer: 3, pkgProtect: 2 };
    const f = facts(g);
    const expected = 5 * assemblyCredit(f) + 2 * protectCredit(f) + 3 * steerCredit(activeSteer(f), g.gigsOf(0), g.gigsOf(1));
    expect(expected).toBeGreaterThan(0);
    expect(evaluate(g, 0, w) - evaluate(g, 0, DEFAULT_WEIGHTS)).toBeCloseTo(expected, 9);
    expect(packageTerms(g, 0, w)).toBeCloseTo(expected, 9);
    // the filler deck is built around nothing: seat 1's evaluation has no package part
    expect(evaluate(g, 1, w) - evaluate(g, 1, DEFAULT_WEIGHTS)).toBeCloseTo(-0, 9);
  });
  it('the rival’s hidden cards never move a package term', () => {
    const g = bbgGame();
    gig(g, 0, 4, 1);
    const w: EvalWeights = { ...DEFAULT_WEIGHTS, pkgAssembly: 5, pkgSteer: 3, pkgProtect: 2 };
    const before = packageTerms(g, 0, w);
    // shuffle the rival's hand and deck
    for (const u of g.P(1).deck.slice(0, 5)) g.move(u, 'hand');
    expect(packageTerms(g, 0, w)).toBe(before);
  });
});

describe('zero package weights are today’s bot', () => {
  it('the defaults are 0, and withoutPackages leaves them as the same object', () => {
    for (const k of PACKAGE_WEIGHTS) expect(DEFAULT_WEIGHTS[k]).toBe(0);
    expect(usesPackages(DEFAULT_WEIGHTS)).toBe(false);
    expect(withoutPackages(DEFAULT_WEIGHTS)).toBe(DEFAULT_WEIGHTS);
    const w = { ...DEFAULT_WEIGHTS, pkgHold: 4 };
    expect(withoutPackages(w)).toEqual(DEFAULT_WEIGHTS);
  });

  /** One Medium game: winner, turns and the full log text. */
  async function medium(a: DeckList, b: DeckList, weights: EvalWeights | undefined, seed: number) {
    const mkA = new HeuristicAgent({ seed, noise: 0.15, profiles: BEST_PROFILES, weights });
    const mkB = new HeuristicAgent({ seed: seed + 7777, noise: 0.15, profiles: BEST_PROFILES });
    const s = await Game.create([a, b], [mkA, mkB], { seed, first: 0 }).run();
    return { winner: s.winner, turns: s.turn, log: s.log.map((e) => e.text).join('\n') };
  }
  const ON: EvalWeights = { ...DEFAULT_WEIGHTS, pkgHold: 8, pkgAssembly: 6, pkgSteer: 6, pkgProtect: 3 };

  it('weights spelled out as 0 play the same game as the defaults', async () => {
    const zero = { ...DEFAULT_WEIGHTS, pkgHold: 0, pkgAssembly: 0, pkgSteer: 0, pkgProtect: 0 };
    expect(await medium(BBG, deck('meta-rrg-dexter-midrange.txt'), zero, 11)).toEqual(await medium(BBG, deck('meta-rrg-dexter-midrange.txt'), undefined, 11));
  }, 60_000);
  it('a list built around no package plays the same game with the weights on', async () => {
    const none = builtAroundNothing();
    const opp = deck('meta-yyb-rogue-gear.txt');
    expect(await medium(none, opp, ON, 12)).toEqual(await medium(none, opp, undefined, 12));
  }, 60_000);
  it('with the weights on, a package list does play differently (the terms are reachable)', async () => {
    const opp = deck('meta-rrg-dexter-midrange.txt');
    const outs = await Promise.all([21, 22, 23].map(async (s) => [await medium(BBG, opp, ON, s), await medium(BBG, opp, undefined, s)]));
    expect(outs.some(([a, b]) => a.log !== b.log)).toBe(true);
  }, 120_000);
});

describe('plain data', () => {
  it('evaluating with package weights adds nothing to the state, which still structuredClones', () => {
    const g = bbgGame();
    const before = JSON.stringify(g.s);
    evaluate(g, 0, { ...DEFAULT_WEIGHTS, pkgAssembly: 5, pkgSteer: 3, pkgProtect: 2 });
    expect(JSON.stringify(g.s)).toBe(before);
    expect(() => structuredClone(g.s)).not.toThrow();
    expect(g.P(0).listId).toBe(listFingerprint(BBG));
  });
});

describe('coach wording', () => {
  it('names the piece kept and its partner when advising a sell', () => {
    const g = bbgGame();
    // the last Towerfall (Behind on Street Cred's only payoff in this list) in hand, the other two in the trash; Jackie
    // (a Gig lowerer) is a face-down Legend. A plain Unit to sell beside it.
    take(g, 0, 'towerfall', 'trash');
    take(g, 0, 'towerfall', 'trash');
    const keep = take(g, 0, 'towerfall', 'hand');
    const sell = take(g, 0, 'psycho_squad', 'hand');
    const d: Decision = { player: 0, kind: 'action', prompt: '', min: 1, max: 1, options: [{ label: `Sell ${g.name(sell.uid)}`, action: { type: 'sell', uid: sell.uid } }, { label: `Sell ${g.name(keep.uid)}`, action: { type: 'sell', uid: keep.uid } }] };
    expect(packageNotes(g, d, 0)).toEqual(['Keep Towerfall: it pairs with Jackie Welles: Pour One Out For Me in your deck (Behind on Street Cred).']);
    // advising to sell the piece itself adds no "keep" note about it; one of eleven min-Gig payoffs is not scarce enough to name
    expect(packageNotes(g, d, 1)).toEqual([]);
    take(g, 0, 'three_mouths_one_desire', 'hand');
    expect(packageNotes(g, d, 0).some((n) => n.includes('Three Mouths'))).toBe(false);
  });
  it('explains a Gig choice for a Street Cred package, and warns when Street Cred is on the wrong side', () => {
    const g = bbgGame();
    take(g, 0, 'towerfall', 'hand');
    const mine = gig(g, 0, 4, 2);
    gig(g, 1, 6, 5);
    // an adjust: keep our d4 at 2 (Street Cred 2 < 5) or raise it to 4 (still below), or set it to 4 on... use the rival's Gig too
    const d: Decision = {
      player: 0,
      kind: 'gigValue',
      prompt: '',
      min: 1,
      max: 1,
      options: [
        { label: 'd4 → 1', gig: mine, n: 1 },
        { label: 'd4 → 4', gig: mine, n: 4 },
      ],
    };
    // raising to 4 still leaves Street Cred below the rival's 5: cred-low has nothing to say; min-gig does
    expect(packageNotes(g, d, 0)).toContain('Your deck wants a Gig at its lowest value (Low Gigs (min Gig), Lower, then swap): d4 → 4 would move away from that.');
    const steal: Decision = { player: 0, kind: 'gig', tag: 'steal', prompt: '', min: 1, max: 1, options: g.gigsOf(1).map((x) => ({ label: `d${x.sides} (${x.value})`, gig: x.id })) };
    gig(g, 1, 4, 1);
    steal.options = g.gigsOf(1).map((x) => ({ label: `d${x.sides} (${x.value})`, gig: x.id }));
    // stealing the 1 keeps Street Cred (3) below the rival's (5); stealing the 5 puts it at 7 against 1
    const i1 = steal.options.findIndex((o) => o.label === 'd4 (1)');
    expect(packageNotes(g, steal, i1)).toContain('Your deck wants your Street Cred below the rival’s (Behind on Street Cred): d6 (5) would put your Street Cred at or above the rival’s.');
    expect(packageWarnings(g, 0)).toEqual([]);
    gig(g, 0, 12, 12);
    expect(packageWarnings(g, 0)).toEqual(['Your Street Cred (14) is not below the rival’s (6); your deck wants it lower (Behind on Street Cred).']);
    expect(boardWarnings(g, 0)).toContain(packageWarnings(g, 0)[0]);
  });
});
