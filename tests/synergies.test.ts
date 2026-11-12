// Synergy catalogue (src/content/synergies) and its measurement (src/analysis/synergies.ts): every member is a real
// card, ids are unique, every condition term is defined, proposals are confirmed or rejected, every active library deck's
// packages compute, the draw odds are exact, and one game's observation (assembled, online, partner present) is right.
import { describe, expect, it } from 'vitest';
import { BUILTIN } from '../src/lib/browserLibrary';
import { CARD_BY_ID, CARDS } from '../src/engine/cards';
import {
  ACTIVE_SYNERGIES,
  CATALOGUE_VERSION,
  conditionCardIds,
  CONDITION_TERM_NAMES,
  CONDITION_TERMS,
  conditionHolds,
  covers,
  holdOdds,
  matchesPredicate,
  membersOf,
  ODDS_ROUNDS,
  roleMap,
  SYNERGIES,
  SYNERGY_BY_ID,
  SYNERGY_ROLES,
  synergiesIn,
  termsOf,
  zeroRoles,
  type SynergyView,
} from '../src/content/synergies';
import { DECK_OBJECTIVES } from '../src/content/deckObjectives';
import { aggregateSynergyGame, mergeSynergyAggregates, observeSynergies, synergyMarkdown, synergyReport, type SynergyGame } from '../src/analysis/synergies';
import { MIN_SLICE_GAMES } from '../src/analysis/decisions';
import type { BoardSnapshot, DecisionRecord } from '../src/engine/telemetry';
import type { PlayerId } from '../src/engine/types';

describe('synergy catalogue', () => {
  it('has unique kebab-case ids and names, and every entry is filled in', () => {
    const ids = SYNERGIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(SYNERGIES.map((s) => s.name)).size).toBe(ids.length);
    for (const s of SYNERGIES) {
      expect(s.id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(s.description.trim().length, s.id).toBeGreaterThan(20);
      expect(s.onlineText.trim().length, s.id).toBeGreaterThan(10);
      expect(['draft', 'owner']).toContain(s.status);
      expect(['requires', 'helps']).toContain(s.bond);
    }
  });

  it('names only real cards: members, group exceptions and rejected proposals', () => {
    const missing: string[] = [];
    for (const s of SYNERGIES) {
      for (const id of [...s.members.map((m) => m.id), ...(s.groups ?? []).flatMap((g) => (g.except ?? []).map((e) => e.id)), ...(s.rejected ?? []).map((r) => r.id)])
        if (!CARD_BY_ID[id]) missing.push(`${s.id}: ${id}`);
      for (const m of membersOf(s)) if (!CARD_BY_ID[m.id]) missing.push(`${s.id}: ${m.id}`);
    }
    expect(missing).toEqual([]);
  });

  it('lists each card once per package, with a valid role, and needs pieces the members can supply', () => {
    for (const s of SYNERGIES) {
      const explicit = s.members.map((m) => m.id);
      expect(new Set(explicit).size, s.id).toBe(explicit.length);
      const all = membersOf(s);
      expect(new Set(all.map((m) => m.id)).size, s.id).toBe(all.length);
      for (const m of all) expect(SYNERGY_ROLES, `${s.id}: ${m.id}`).toContain(m.role);
      const have = zeroRoles();
      for (const m of all) have[m.role] += 4;
      expect(covers(have, s.needs), s.id).toBe(true);
      // a rejected card is not also a member
      for (const r of s.rejected ?? []) expect(all.map((m) => m.id), `${s.id}: ${r.id}`).not.toContain(r.id);
      for (const r of s.rejected ?? []) expect(r.why.trim().length).toBeGreaterThan(5);
    }
  });

  it('uses only defined condition terms, each with a definition, and names only real cards in them', () => {
    for (const t of CONDITION_TERM_NAMES) expect(CONDITION_TERMS[t].length).toBeGreaterThan(10);
    const bad = SYNERGIES.flatMap((s) => termsOf(s.online).filter((t) => !(t in CONDITION_TERMS)).map((t) => `${s.id}: ${t}`));
    expect(bad).toEqual([]);
    const unknown = SYNERGIES.flatMap((s) => conditionCardIds(s.online).filter((id) => !CARD_BY_ID[id]).map((id) => `${s.id}: ${id}`));
    expect(unknown).toEqual([]);
  });

  it('confirms every proposal: each card a proposal predicate matches is a member or rejected with a reason', () => {
    const unconfirmed: string[] = [];
    for (const s of SYNERGIES) {
      const members = new Set(membersOf(s).map((m) => m.id));
      const rejected = new Set((s.rejected ?? []).map((r) => r.id));
      for (const c of CARDS) if ((s.propose ?? []).some((p) => matchesPredicate(c, p)) && !members.has(c.id) && !rejected.has(c.id)) unconfirmed.push(`${s.id}: ${c.id}`);
    }
    expect(unconfirmed).toEqual([]);
  });

  it('resolves classes from the cards’ own data (ARASAKA Units, BRAINDANCE Programs)', () => {
    const arasaka = membersOf(SYNERGIES.find((s) => s.id === 'arasaka')!);
    expect(arasaka.find((m) => m.id === 'minotaur')?.role).toBe('enabler');
    expect(arasaka.find((m) => m.id === 'adam_smasher_ender_of_legends')?.role).toBe('enabler'); // a Go Solo Legend
    expect(arasaka.find((m) => m.id === 'yorinobu_arasaka_steel_dragon')?.role).toBe('both'); // the explicit entry wins
    expect(arasaka.find((m) => m.id === 'satori_sword_of_saburo')).toBeUndefined(); // ARASAKA Gear is not a Unit
    const corpo = membersOf(SYNERGIES.find((s) => s.id === 'corpo-ganger-steals')!).map((m) => m.id);
    expect(corpo).not.toContain('corpo_security');
    expect(corpo).not.toContain('sketchy_ripper'); // power 0
    const bd = membersOf(SYNERGIES.find((s) => s.id === 'braindance')!).filter((m) => m.role === 'enabler');
    expect(bd.every((m) => CARD_BY_ID[m.id]!.type === 'Program' && CARD_BY_ID[m.id]!.tags.includes('Braindance'))).toBe(true);
  });

  it('every active library deck’s packages compute, with odds rising by round', () => {
    expect(BUILTIN.length).toBeGreaterThan(25);
    let builtAround = 0;
    for (const d of BUILTIN) {
      const found = synergiesIn(d.deck);
      for (const x of found) {
        expect(x.odds.map((o) => o.round)).toEqual([...ODDS_ROUNDS]);
        for (const o of x.odds) expect(o.p).toBeGreaterThanOrEqual(0), expect(o.p).toBeLessThanOrEqual(1 + 1e-9);
        for (let k = 1; k < x.odds.length; k++) expect(x.odds[k]!.p).toBeGreaterThanOrEqual(x.odds[k - 1]!.p - 1e-9);
        expect(x.cards.reduce((a, c) => a + c.copies, 0)).toBe(x.copies.enabler + x.copies.payoff + x.copies.both + x.copies.piece);
        if (x.builtAround) builtAround++;
      }
    }
    expect(builtAround).toBeGreaterThan(10);
  });

  it('a deck objective names only real synergies', () => {
    for (const [f, n] of Object.entries(DECK_OBJECTIVES)) for (const id of n.synergies ?? []) expect(SYNERGIES.map((s) => s.id), `${f}: ${id}`).toContain(id);
  });

  it('a dormant package says why, is never built around, and is left out of the active list', () => {
    const dormant = SYNERGIES.filter((s) => s.dormant);
    expect(dormant.map((s) => s.id)).toEqual(['corpo-ganger-steals']);
    for (const s of dormant) expect(s.dormant!.reason.trim().length).toBeGreaterThan(20);
    expect(ACTIVE_SYNERGIES.map((s) => s.id)).not.toContain('corpo-ganger-steals');
    expect(CARD_BY_ID.evelyn_parker_beautiful_enigma?.displayName).toBe('Evelyn Parker: Beautiful Enigma');
    // a list meeting its built-around count still lists it (it holds the pieces), but never as built around
    const s = SYNERGY_BY_ID['corpo-ganger-steals']!;
    const units = membersOf(s)
      .filter((m) => m.role === 'enabler' && CARD_BY_ID[m.id]!.type !== 'Legend')
      .map((m) => m.id);
    const deck = { legends: ['evelyn_parker_beautiful_enigma', 'v_corporate_exile', 'goro_takemura_hands_unclean'], main: units.slice(0, 14).flatMap((id) => [id, id, id]).slice(0, 40) };
    const x = synergiesIn(deck).find((y) => y.synergy.id === 'corpo-ganger-steals');
    expect(x).toBeDefined();
    expect(x!.builtAround).toBe(false);
    // no active library deck holds it
    for (const d of BUILTIN) expect(synergiesIn(d.deck).map((y) => y.synergy.id), d.file).not.toContain('corpo-ganger-steals');
  });

  it('Programs as fuel: the engines define it; Programs alone, or a few engine copies among them, are not built around it', () => {
    const roles = roleMap(SYNERGY_BY_ID['program-fuel']!);
    expect(roles.get('jacked_in_voodoo_boy')).toBeUndefined(); // a drawback, not an engine
    expect(roles.get('trust_no_one')).toBe('enabler'); // a Program is fuel
    const fuel = ['trust_no_one', 'floor_it', 'chrome_reverie', 'pyramid_song', 'three_mouths_one_desire', 'towerfall'].flatMap((id) => [id, id, id]); // 18 Programs
    const fill = (main: string[]) => [...main, ...Array(40 - main.length).fill('psycho_squad')];
    const legends = ['jackie_welles_pour_one_out_for_me', 'wakako_okada_peace_and_harmony', 'v_corporate_exile'];
    const pf = (main: string[]) => synergiesIn({ legends, main: fill(main) }).find((x) => x.synergy.id === 'program-fuel');
    expect(pf(fuel)).toBeUndefined(); // only Programs: not even held
    const placide3 = ['placide_voodoo_sentinel', 'placide_voodoo_sentinel', 'placide_voodoo_sentinel'];
    expect(pf([...fuel, ...placide3])!.builtAround).toBe(false); // 3 engine copies among 18 Programs
    const engines4 = ['placide_voodoo_sentinel', 'placide_voodoo_sentinel', 'lizzy_wizzy_delicate_weapon', 'lizzy_wizzy_delicate_weapon'];
    expect(pf([...fuel, ...engines4])!.builtAround).toBe(true); // 4 engine copies and 8+ Programs
    expect(pf([...fuel.slice(0, 6), ...engines4])!.builtAround).toBe(false); // 4 engines but only 6 Programs
  });

  it('owner review 2026-11-12: Yorinobu wants 20 Street Cred of its own; forced attacks count as spending', () => {
    expect(roleMap(SYNERGY_BY_ID['high-cred']!).has('yorinobu_arasaka_embracing_destruction')).toBe(false);
    expect(roleMap(SYNERGY_BY_ID['cred-20']!).get('yorinobu_arasaka_embracing_destruction')).toBe('payoff');
    expect(termsOf(SYNERGY_BY_ID['cred-20']!.online)).toContain('cred-at-least');
    const sp = roleMap(SYNERGY_BY_ID['spend-punish']!);
    expect(sp.get('mox_inciters')).toBe('enabler');
    expect(sp.get('evelyn_parker_beautiful_enigma')).toBe('enabler');
  });
});

describe('draw odds', () => {
  const choose = (n: number, k: number): number => (k < 0 || k > n ? 0 : k === 0 ? 1 : (choose(n - 1, k - 1) * n) / k);
  it('matches the single-group hypergeometric', () => {
    // 4 payoffs in 40, at least 1 among 8 seen
    const main = { ...zeroRoles(), payoff: 4 };
    expect(holdOdds(main, zeroRoles(), 40, 8, { payoff: 1 })).toBeCloseTo(1 - choose(36, 8) / choose(40, 8), 10);
    // at least 2 of 6 among 10 seen
    const p2 = 1 - (choose(34, 10) + 6 * choose(34, 9)) / choose(40, 10);
    expect(holdOdds({ ...zeroRoles(), piece: 6 }, zeroRoles(), 40, 10, { any: 2 })).toBeCloseTo(p2, 10);
  });
  it('two groups at once, Legends held from the start, and `both` cards fill either role', () => {
    const e = { ...zeroRoles(), enabler: 4, payoff: 4 };
    const pBoth = holdOdds(e, zeroRoles(), 40, 8, { enabler: 1, payoff: 1 });
    const pE = 1 - choose(36, 8) / choose(40, 8);
    expect(pBoth).toBeLessThan(pE);
    expect(pBoth).toBeGreaterThan(pE * pE - 0.05);
    expect(holdOdds(e, { ...zeroRoles(), payoff: 1 }, 40, 8, { enabler: 1, payoff: 1 })).toBeCloseTo(pE, 10);
    expect(holdOdds(zeroRoles(), { ...zeroRoles(), both: 1, payoff: 1 }, 40, 8, { enabler: 1, payoff: 1 })).toBe(1);
    expect(holdOdds(zeroRoles(), { ...zeroRoles(), both: 1 }, 40, 8, { enabler: 1, payoff: 1 })).toBe(0);
    expect(covers({ enabler: 0, payoff: 0, both: 2, piece: 0 }, { enabler: 1, payoff: 1 })).toBe(true);
    expect(covers({ enabler: 0, payoff: 1, both: 0, piece: 3 }, { enabler: 1, payoff: 1 })).toBe(false);
  });
});

describe('online conditions', () => {
  const s = SYNERGIES.find((x) => x.id === 'min-gig')!;
  const roles = roleMap(s);
  const view = (x: Partial<SynergyView>): SynergyView => ({ inPlay: [], used: [], gigs: [], cred: null, opCred: null, gigCount: 0, opGigCount: 0, equipped: 0, legendsUp: 0, trash: {}, ...x });
  it('min Gig with a payoff in play or used', () => {
    expect(conditionHolds(s.online, view({ gigs: [[4, 1]], inPlay: ['alt_cunningham_soulkiller_architect'] }), roles)).toBe(true);
    expect(conditionHolds(s.online, view({ gigs: [[4, 1]], used: ['three_mouths_one_desire'] }), roles)).toBe(true);
    expect(conditionHolds(s.online, view({ gigs: [[4, 2]], inPlay: ['alt_cunningham_soulkiller_architect'] }), roles)).toBe(false);
    expect(conditionHolds(s.online, view({ gigs: [[4, 1]], inPlay: ['wakako_okada_peace_and_harmony'] }), roles)).toBe(false); // an enabler is no payoff
  });
  it('the Gig and Street Cred terms', () => {
    const r = new Map();
    expect(conditionHolds({ term: 'value-pair', min: 1 }, view({ gigs: [[6, 3], [8, 3], [10, 3]] }), r)).toBe(true);
    expect(conditionHolds({ term: 'value-pair', min: 2 }, view({ gigs: [[6, 3], [8, 3], [10, 3]] }), r)).toBe(false); // a Gig counts in one pair
    expect(conditionHolds({ term: 'max-gig', min: 1 }, view({ gigs: [[6, 6]] }), r)).toBe(true);
    expect(conditionHolds({ term: 'even-and-odd' }, view({ gigs: [[6, 2], [8, 5]] }), r)).toBe(true);
    expect(conditionHolds({ term: 'cred-vs-rival', cmp: 'less' }, view({ cred: null, opCred: 4 }), r)).toBe(true); // Null is lowest
    expect(conditionHolds({ term: 'cred-vs-rival', cmp: 'more' }, view({ cred: 5, opCred: null }), r)).toBe(true);
    expect(conditionHolds({ term: 'cred-even' }, view({ cred: null }), r)).toBe(false);
    expect(conditionHolds({ term: 'gigs-behind', by: 2 }, view({ gigCount: 1, opGigCount: 3 }), r)).toBe(true);
    expect(conditionHolds({ term: 'trash', type: 'Unit', min: 3 }, view({ trash: { Unit: 3 } }), r)).toBe(true);
    expect(conditionHolds({ term: 'cred-at-least', value: 20 }, view({ cred: 20 }), r)).toBe(true);
    expect(conditionHolds({ term: 'cred-at-least', value: 20 }, view({ cred: 19 }), r)).toBe(false);
  });
  it('a Gig matching a cost in your own hand (gig-cost-match)', () => {
    const r = new Map();
    const c = { term: 'gig-cost-match', min: 1 } as const;
    expect(conditionHolds(c, view({ gigs: [[6, 4], [8, 7]], handCosts: [2, 4, 5] }), r)).toBe(true);
    expect(conditionHolds(c, view({ gigs: [[6, 4], [8, 7]], handCosts: [2, 5] }), r)).toBe(false);
    expect(conditionHolds({ term: 'gig-cost-match', min: 2 }, view({ gigs: [[6, 4], [8, 4]], handCosts: [4] }), r)).toBe(true); // two Gigs, one card
    expect(conditionHolds(c, view({ gigs: [[6, 4]] }), r)).toBe(false); // an older snapshot without hand costs
    const cm = SYNERGY_BY_ID['cost-match']!;
    const roles = roleMap(cm);
    expect(conditionHolds(cm.online, view({ gigs: [[6, 2]], handCosts: [2], used: ['the_heist'] }), roles)).toBe(true);
    expect(conditionHolds(cm.online, view({ gigs: [[6, 2]], handCosts: [2], used: ['muamar_reyes_el_capitan'] }), roles)).toBe(false); // an enabler is no payoff
  });
  it('named cards in your trash (in-trash): the Relic loop', () => {
    const s = SYNERGY_BY_ID['relic-loop']!;
    const roles = roleMap(s);
    const relic = { inPlay: ['the_relic_experimental_biochip'] };
    expect(conditionHolds(s.online, view({ ...relic, trashCards: ['adam_smasher_metal_over_meat'] }), roles)).toBe(true);
    expect(conditionHolds(s.online, view({ ...relic, trashCards: ['psycho_squad'] }), roles)).toBe(false);
    expect(conditionHolds(s.online, view({ trashCards: ['adam_smasher_metal_over_meat'] }), roles)).toBe(false);
  });
  it('Programs as fuel comes online only when an engine is used, not when it is merely face-up', () => {
    const s = SYNERGY_BY_ID['program-fuel']!;
    const roles = roleMap(s);
    expect(conditionHolds(s.online, view({ inPlay: ['alt_cunningham_soulkiller_architect'], used: ['trust_no_one'] }), roles)).toBe(false);
    expect(conditionHolds(s.online, view({ inPlay: ['alt_cunningham_soulkiller_architect'], used: ['alt_cunningham_soulkiller_architect'], trash: { Program: 2 } }), roles)).toBe(true);
    expect(conditionHolds(s.online, view({ used: ['lizzy_wizzy_delicate_weapon', 'trust_no_one'] }), roles)).toBe(true);
  });
});

// ------------------------------------------------------------------ one game's observation

const FILL = Array(34).fill('psycho_squad') as string[];
const P0 = {
  listId: 'L0',
  name: 'Min Gig',
  legends: ['jackie_welles_pour_one_out_for_me', 'alt_cunningham_soulkiller_architect', 'wakako_okada_peace_and_harmony'],
  main: [...Array(3).fill('trust_no_one'), ...Array(3).fill('three_mouths_one_desire'), ...FILL] as string[],
};
const P1 = { listId: 'L1', name: 'Plain', legends: ['v_corporate_exile', 'rogue_amendiares_preem_solo', 'sasha_yakovleva_won_t_let_you_down'], main: Array(40).fill('psycho_squad') as string[] };

function board(t: number, p: PlayerId, x: Partial<BoardSnapshot> = {}): BoardSnapshot {
  return { t, p, at: 'end', units: [], gear: [], equipped: 0, legends: [], legendsUp: 0, gigs: [], cred: null, opCred: null, opGigs: 0, opUnits: 0, trash: {}, ...x };
}
function play(t: number, id: string): DecisionRecord {
  const side = { gigs: 0, cred: 0, units: 0, power: 0, ready: 0, eddies: 0, eddiesTotal: 0, payable: 0, hand: 0, deck: 0, legendsUp: 0 };
  return { i: 0, t, p: 0, kind: 'action', w: 'main', o: ['pass', `play:${id}`], n: 2, c: [1], ch: [`play:${id}`], f: { me: side, op: side, lead: 0, active: true } };
}
const GAME: SynergyGame = {
  players: [P0, P1],
  first: 0,
  turns: 6,
  winner: 0,
  records: [play(1, 'three_mouths_one_desire'), play(3, 'three_mouths_one_desire')],
  sightings: [
    { p: 0, t: 1, id: 'three_mouths_one_desire' },
    { p: 0, t: 3, id: 'trust_no_one' },
    { p: 1, t: 2, id: 'psycho_squad' },
  ],
  boards: [
    board(1, 0, { gigs: [[4, 3]] }),
    board(3, 0, { gigs: [[4, 1]], legends: ['alt_cunningham_soulkiller_architect'], legendsUp: 1 }),
    board(4, 0, { gigs: [[4, 2]], legends: ['alt_cunningham_soulkiller_architect'], legendsUp: 1 }),
    board(5, 0, { gigs: [[4, 1], [6, 2]], legends: ['alt_cunningham_soulkiller_architect'], legendsUp: 1 }),
    board(2, 1, { gigs: [[4, 1]] }),
  ],
};

describe('synergy observation', () => {
  const [mine, theirs] = observeSynergies(GAME);
  const minGig = mine.find((o) => o.id === 'min-gig')!;
  it('observes only the packages each list holds', () => {
    expect(mine.map((o) => o.id)).toContain('min-gig');
    expect(theirs).toEqual([]);
  });
  it('pieces drawn, the round they were all held, the round it came online and the turns it held', () => {
    // Jackie (both) + Wakako (enabler) + Alt (payoff) are held from the start; one Three Mouths and one Trust No One were seen
    expect(minGig.drawn).toEqual({ enabler: 1, payoff: 2, both: 2, piece: 0 });
    expect(minGig.assembledRound).toBe(1);
    expect(minGig.onlineRound).toBe(2); // turn 3 is round 2
    expect(minGig.onlineTurns).toBe(2); // turns 3 and 5 (turn 4's Gig is back at 2)
    expect(minGig.rounds).toBe(3);
    expect(minGig.result).toBe(1);
  });
  it('splits each member use by partner present or absent', () => {
    // turn 1: no enabler drawn and none face-up; turn 3: Trust No One was drawn
    expect(minGig.uses).toEqual([
      { id: 'three_mouths_one_desire', t: 1, partner: false },
      { id: 'three_mouths_one_desire', t: 3, partner: true },
    ]);
  });
  it('aggregates, merges in any order and reports thin slices without a rate', () => {
    const one = aggregateSynergyGame(GAME);
    const two = aggregateSynergyGame({ ...GAME, winner: 1 });
    const ab = mergeSynergyAggregates(one, two);
    const ba = mergeSynergyAggregates(two, one);
    expect(ab).toEqual(ba);
    const a = ab.decks.L0!.synergies['min-gig']!;
    expect(a.games).toBe(2);
    expect(a.online).toEqual({ uses: 0, games: 2, wins: 1 });
    expect(a.byRound['2']).toEqual({ reached: 2, assembled: 2, online: 2 });
    expect(a.byRound['6']).toEqual({ reached: 0, assembled: 0, online: 0 });
    expect(a.cards.three_mouths_one_desire).toEqual({ present: { uses: 2, games: 2, wins: 1 }, absent: { uses: 2, games: 2, wins: 1 } });
    expect(ab.catalogue).toBe(CATALOGUE_VERSION);
    const r = synergyReport(ab);
    const row = r.decks.find((d) => d.listId === 'L0')!.synergies.find((s) => s.id === 'min-gig')!;
    expect(row.online.thin).toBe(true);
    expect(row.online.winRate).toBeNull();
    expect(row.byRound[0]!.expected).toBe(1);
    expect(row.medianRound).toBe(2);
    expect(r.note).toMatch(/Association, not causal value/);
    expect(synergyMarkdown(r)).toContain('(thin)');
    // enough games: a rate with its interval
    const many = mergeSynergyAggregates(...Array.from({ length: MIN_SLICE_GAMES }, (_, k) => aggregateSynergyGame({ ...GAME, winner: (k % 2) as PlayerId })));
    const big = synergyReport(many).decks.find((d) => d.listId === 'L0')!.synergies.find((s) => s.id === 'min-gig')!;
    expect(big.online.thin).toBe(false);
    expect(big.online.winRate).toBeCloseTo(0.5);
    expect(big.online.low95!).toBeLessThan(0.5);
  });
  it('keeps dormant packages out of the tables and lists them apart', () => {
    const r = synergyReport(aggregateSynergyGame(GAME));
    expect(r.pooled.map((x) => x.id)).not.toContain('corpo-ganger-steals');
    expect(r.dormant?.map((d) => d.id)).toEqual(['corpo-ganger-steals']);
    expect(synergyMarkdown(r)).toContain('## Dormant packages (not in any library deck)');
  });
  it('refuses to merge aggregates from another catalogue', () => {
    const other = { ...aggregateSynergyGame(GAME), catalogue: 'fnv1a64:other' };
    expect(() => mergeSynergyAggregates(other)).toThrow(/catalogue/);
  });
});
