// Partner-aware cut and add ranking (src/lib/cutRanking.ts, docs/SYNERGIES.md "Partner-aware ranking"): the partner
// split from a tuner's own summaries, the shrinkage, the stranding cost (exact draw odds), the add credit, and that the
// builders use it only when asked (the pinned default candidates are in tests/deck-packages-defaults.test.ts).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseDeck } from '../src/engine/deck';
import type { DeckList } from '../src/engine/types';
import type { PlayerSummary } from '../src/analysis/summarize';
import type { DeckReport } from '../src/analysis/analyze';
import { cardsSeenBy, holdOdds, roleMap, SYNERGY_BY_ID, zeroRoles, type RoleCounts } from '../src/content/synergies/index';
import { addCredits, cutReason, cutTableRows, MIN_SPLIT_GAMES, ODDS_ROUND, PARTNER_SHRINK_GAMES, partnerAwarePicks, partnerSplits, rankCuts, STRAND_VALUE, strandCosts } from '../src/lib/cutRanking';
import { candidateSwaps, swapsAndCuts } from '../src/lib/deckLab';
import { forgeSwaps, forgeSwapsExplained, optimizeCandidates } from '../scripts/builder-moves';
import { partnerAwareOn } from '../scripts/package-flags';

const deck = (file: string): DeckList => parseDeck(readFileSync(`data/decks/${file}`, 'utf8'), file).deck;
const BBG = deck('ladder-bbg-jackie-alt-hanako.txt');

/** A game summary with only what the ranking reads. */
function game(seen: string[], result: 1 | 0 | 0.5, calls: string[] = []): PlayerSummary {
  return { deck: BBG.name, seen, result, calls: calls.map((id) => ({ id, turn: 1, how: 'call' })), solos: [], legendPlays: [] } as unknown as PlayerSummary;
}

function mainRoles(d: DeckList, pkg: string): RoleCounts {
  const roles = roleMap(SYNERGY_BY_ID[pkg]!);
  const r = zeroRoles();
  for (const id of d.main) {
    const x = roles.get(id);
    if (x) r[x]++;
  }
  return r;
}

describe('the partner split', () => {
  // Towerfall is Behind on Street Cred's payoff; its enablers lower your own Gigs (Floor It, Three Mouths…), and Jackie
  // Welles: Pour One Out For Me (a Legend in this list) is one
  const lowCred = roleMap(SYNERGY_BY_ID['low-cred']!);
  const enabler = BBG.main.find((id) => lowCred.get(id) === 'enabler')!;
  const games = [
    ...Array.from({ length: 30 }, (_, i) => game(['towerfall', enabler], i < 18 ? 1 : 0)), // with a partner: 60%
    ...Array.from({ length: 10 }, (_, i) => game(['towerfall'], i < 2 ? 1 : 0)), // without: 20%
    ...Array.from({ length: 20 }, (_, i) => game(['psycho_squad'], i < 9 ? 1 : 0)), // not drawn: 45%
  ];

  it('splits a member card’s games by whether a partner piece was drawn in the same game', () => {
    expect(enabler).toBeTruthy();
    const sp = partnerSplits(BBG, games).get('towerfall')!.find((x) => x.pkg === 'low-cred')!;
    expect(sp.role).toBe('payoff');
    expect(sp.with).toEqual({ games: 30, wins: 18 });
    expect(sp.without).toEqual({ games: 10, wins: 2 });
    expect(sp.notSeen).toEqual({ games: 20, wins: 9 });
    // a partner Legend face-up (Called) counts as a partner present
    const jackie = BBG.legends.find((l) => lowCred.get(l))!;
    const viaLegend = partnerSplits(BBG, [game(['towerfall'], 1, [jackie])]).get('towerfall')!.find((x) => x.pkg === 'low-cred')!;
    expect(viaLegend.with.games).toBe(1);
    // another deck's games are not read
    expect(partnerSplits(BBG, games.map((g) => ({ ...g, deck: 'other' }))).get('towerfall')![0]!.notSeen.games).toBe(0);
  });

  it('judges the card by its partner-present games, shrunk toward the plain score, and keeps both numbers', () => {
    const plain = -0.1; // the plain "Δ when drawn" the tuner had: 50% drawn − 45% not drawn would be +5; any plain value works
    const row = rankCuts(BBG, { plain: (id) => (id === 'towerfall' ? plain : 0), sums: games }).find((r) => r.id === 'towerfall')!;
    expect(row.plain).toBe(plain);
    const p = row.partner!;
    expect(p.pkg).toBe('low-cred');
    expect(p.withWr).toBeCloseTo(0.6, 9);
    expect(p.withoutWr).toBeCloseTo(0.2, 9);
    expect(p.raw!).toBeCloseTo(0.6 - 0.45, 9);
    // (n·raw + K·plain) / (n + K): halfway at n = K
    expect(p.shrunk).toBeCloseTo((30 * 0.15 + PARTNER_SHRINK_GAMES * plain) / (30 + PARTNER_SHRINK_GAMES), 9);
    // the score adds the stranding penalty of every package the card is in
    expect(row.score).toBeCloseTo(p.shrunk + row.strand.reduce((a, s) => a + s.penalty, 0), 9);
    // with fewer than MIN_SPLIT_GAMES partner-present games there is no partner number: the plain score stands
    const few = rankCuts(BBG, { plain: () => plain, sums: games.slice(30 - (MIN_SPLIT_GAMES - 1)) }).find((r) => r.id === 'towerfall')!;
    expect(few.partner?.raw ?? null).toBeNull();
    expect(few.partner?.shrunk ?? plain).toBe(plain);
  });

  it('without summaries there is no partner number, only the stranding cost', () => {
    const row = rankCuts(BBG, { plain: () => 0 }).find((r) => r.id === 'towerfall')!;
    expect(row.partner).toBeUndefined();
    expect(row.strand.length).toBeGreaterThan(0);
  });
});

describe('the stranding cost and the add credit', () => {
  it('is the exact drop in assembly odds by your own turn 4, times the package value (½ for a "helps" package)', () => {
    const s = strandCosts(BBG, 'towerfall').find((x) => x.pkg === 'low-cred')!;
    const m = mainRoles(BBG, 'low-cred');
    const legends = zeroRoles();
    const before = holdOdds(m, legends, BBG.main.length, cardsSeenBy(ODDS_ROUND), SYNERGY_BY_ID['low-cred']!.needs);
    const after = holdOdds({ ...m, payoff: m.payoff - 1 }, legends, BBG.main.length, cardsSeenBy(ODDS_ROUND), SYNERGY_BY_ID['low-cred']!.needs);
    expect(s.before).toBeCloseTo(before, 12);
    expect(s.after).toBeCloseTo(after, 12);
    expect(s.before - s.after).toBeGreaterThan(0.1); // three Towerfalls are its only payoffs: cutting one costs a lot
    expect(s.penalty).toBeCloseTo((before - after) * STRAND_VALUE * 0.5, 12); // low-cred is a "helps" package
    // a surplus piece barely moves the odds, so it stays a fair cut: one of 26 Programs-as-fuel enablers
    const floorIt = strandCosts(BBG, 'floor_it').find((x) => x.pkg === 'program-fuel')!;
    expect(floorIt.before - floorIt.after).toBeLessThan(0.01);
    expect(cutReason({ ...rankCuts(BBG, { plain: () => 0 }).find((r) => r.id === 'floor_it')!, offered: true }, true)).toContain('surplus piece');
    // a card in no package the list holds costs nothing
    const loose = BBG.main.find((id) => !strandCosts(BBG, id).length);
    if (loose) expect(rankCuts(BBG, { plain: () => 0 }).find((r) => r.id === loose)!.score).toBe(0);
  });

  it('credits an add by the assembly odds it adds to a package the list is built around, and never for a dormant one', () => {
    const c = addCredits(BBG, 'towerfall').find((x) => x.pkg === 'low-cred');
    // BBG holds 3 Towerfalls already: the list can't add a 4th, but the credit is still the odds a 4th would add
    expect(c?.kind).toBe('deepens');
    expect(c!.after).toBeGreaterThan(c!.before);
    // an outside card in no package earns nothing
    expect(addCredits(BBG, 'psycho_squad')).toEqual([]);
    // dormant packages (Evelyn Parker: Beautiful Enigma's steals) never count
    const dormant = Object.values(SYNERGY_BY_ID).filter((s) => s.dormant).map((s) => s.id);
    expect(dormant.length).toBeGreaterThan(0);
    for (const id of BBG.main) for (const x of [...strandCosts(BBG, id), ...addCredits(BBG, id)]) expect(dormant).not.toContain(x.pkg);
  });
});

describe('the builders use it only when asked', () => {
  const rep = { deck: BBG.name, cards: [{ id: 'towerfall', iwd: -0.2, seenGames: 40 }, { id: 'floor_it', iwd: -0.15, seenGames: 40 }, { id: 'psycho_squad', iwd: -0.14, seenGames: 40 }], insights: [] } as unknown as DeckReport;
  const impact = { psycho_squad: 0.02, valentino_street_racer: 0.03 };

  it('without the option the forge, the Lab and the optimizer make exactly the candidates they made before', () => {
    expect(forgeSwapsExplained(BBG, rep, impact, 6).swaps).toEqual(forgeSwaps(BBG, rep, impact, 6));
    expect(forgeSwapsExplained(BBG, rep, impact, 6).cuts).toBeUndefined();
    expect(swapsAndCuts(BBG, rep, 6).swaps).toEqual(candidateSwaps(BBG, rep, 6));
    expect(optimizeCandidates(BBG, false, 40, {}, false)).toEqual(optimizeCandidates(BBG, false, 40));
  });

  it('with it, every cut is explained and a scarce payoff with strong partner games is moved up', () => {
    const lowCred = roleMap(SYNERGY_BY_ID['low-cred']!);
    const enabler = BBG.main.find((id) => lowCred.get(id) === 'enabler')!;
    const sums = [
      ...Array.from({ length: 40 }, (_, i) => game(['towerfall', enabler], i < 30 ? 1 : 0)),
      ...Array.from({ length: 20 }, (_, i) => game(['psycho_squad'], i < 9 ? 1 : 0)),
    ];
    const plainCuts = forgeSwaps(BBG, rep, impact, 6).map((m) => m.label);
    expect(plainCuts.some((l) => l.startsWith('-1 Towerfall'))).toBe(true);
    const ex = forgeSwapsExplained(BBG, rep, impact, 6, {}, { sums });
    const tower = ex.cuts!.find((r) => r.id === 'towerfall')!;
    expect(tower.plainOffered).toBe(true);
    expect(tower.offered).toBe(false);
    expect(tower.why).toMatch(/^not offered: the package view moved it up — Δ when drawn −20\.0 pts; payoff for Behind on Street Cred: 75% with a partner \(40 games\), never drawn without one; partner-aware .* pts; cutting one drops Behind on Street Cred assembly odds by turn 4 \d+% → \d+%/);
    expect(ex.swaps.some((m) => m.label.startsWith('-1 Towerfall'))).toBe(false);
    expect(cutTableRows(ex.cuts!).map((r) => r.id)).toContain('towerfall');
    // the Lab's version says the same
    const lab = swapsAndCuts(BBG, rep, 6, {}, { sums });
    expect(lab.cuts!.find((r) => r.id === 'towerfall')!.why).toBe(tower.why);
    // the picks are plain data (they travel in the Lab's progress messages)
    expect(() => structuredClone(partnerAwarePicks(BBG, { plain: () => 0, sums, own: () => 0, globalImpact: impact, outside: [] }))).not.toThrow();
  });

  it('the optimizer adds the stranding cost to its weakest-card picks', () => {
    expect(optimizeCandidates(BBG, false, 400, {}, true).length).toBeGreaterThan(0);
  });
});

describe('the command-line switch', () => {
  it('is off with no flags, on with --partner-aware or any package flag, and --plain-ranking turns it off', () => {
    expect(partnerAwareOn({})).toBe(false);
    expect(partnerAwareOn({ 'partner-aware': true })).toBe(true);
    expect(partnerAwareOn({ 'keep-packages': 'low-cred' })).toBe(true);
    expect(partnerAwareOn({ 'package-moves': true })).toBe(true);
    expect(partnerAwareOn({ 'keep-packages': 'low-cred', 'plain-ranking': true })).toBe(false);
  });
});
