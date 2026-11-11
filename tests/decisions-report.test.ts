// Aggregating decision records (src/analysis/decisions.ts): counts per card and use, availability vs use, stage and
// Gig-standing slices counted once per game, decision types, the reaction window, thin slices and Wilson intervals.
import { describe, expect, it } from 'vitest';
import {
  aggregateDecisions,
  aggregateGame,
  decisionMarkdown,
  decisionReport,
  mergeAggregates,
  MIN_SLICE_GAMES,
  optionBucket,
  stageOf,
  wilson,
  type GameDecisions,
} from '../src/analysis/decisions';
import type { AttackOutcome, DecisionRecord, DecisionWindow, SideFeatures } from '../src/engine/telemetry';
import type { DecisionKind, PlayerId } from '../src/engine/types';

const side = (): SideFeatures => ({ gigs: 0, cred: 0, units: 0, power: 0, ready: 0, eddies: 0, eddiesTotal: 0, payable: 0, hand: 0, deck: 0, legendsUp: 0 });
const KIND: Record<DecisionWindow, DecisionKind> = { main: 'action', react: 'reaction', mulligan: 'yesno', pay: 'pay', order: 'order', effect: 'yesno' };
let seq = 0;
function rec(p: PlayerId, t: number, w: DecisionWindow, o: string[], ch: string, x: { lead?: number; atk?: number; attack?: AttackOutcome; tag?: string } = {}): DecisionRecord {
  const r: DecisionRecord = { i: seq++, t, p, kind: KIND[w], w, o, n: o.length, c: [o.indexOf(ch)], ch: [ch], f: { me: side(), op: side(), lead: x.lead ?? 0, active: w === 'main' } };
  if (x.tag) r.tag = x.tag;
  if (x.atk !== undefined) r.atk = { n: x.atk, attacker: 'raider', target: 'gigs' };
  if (x.attack) r.res = { attack: x.attack };
  return r;
}
const players = [
  { listId: 'L0', name: 'Deck Zero' },
  { listId: 'L1', name: 'Deck One' },
] as const;
const blockedBoth: AttackOutcome = { end: 'fight', blocked: true, stolen: 0, attackerGone: true, targetGone: true };
const stoleOne: AttackOutcome = { end: 'steal', blocked: false, stolen: 1, attackerGone: false, targetGone: false };

const G1: GameDecisions = {
  winner: 0,
  players,
  records: [
    rec(0, 1, 'main', ['pass', 'play:alpha', 'sell:alpha'], 'play:alpha'),
    rec(0, 1, 'main', ['pass', 'sell:beta'], 'pass'),
    rec(1, 2, 'react', ['endReact', 'block:gamma'], 'block:gamma', { lead: -1, atk: 0, attack: blockedBoth }),
    rec(1, 2, 'main', ['pass'], 'pass'),
    rec(0, 3, 'main', ['pass', 'play:alpha'], 'play:alpha', { lead: 1 }),
  ],
};
const G2: GameDecisions = {
  winner: 1,
  players,
  records: [
    rec(0, 9, 'main', ['pass', 'play:alpha'], 'play:alpha', { lead: -1 }),
    rec(0, 9, 'main', ['pass', 'sell:beta'], 'sell:beta', { lead: -1 }),
    rec(1, 10, 'react', ['endReact', 'block:gamma'], 'endReact', { atk: 0, attack: stoleOne }),
  ],
};
const G3: GameDecisions = {
  winner: 'tie',
  players,
  records: [rec(0, 5, 'main', ['pass', 'play:alpha'], 'pass'), rec(0, 5, 'effect', ['yes', 'no'], 'yes', { tag: 'kerry' })],
};

describe('aggregateGame / mergeAggregates', () => {
  const agg = aggregateDecisions([G1, G2, G3]);
  const L0 = agg.decks.L0;
  const L1 = agg.decks.L1;

  it('counts games, wins (a tie is half) and decisions per deck list', () => {
    expect(agg.games).toBe(3);
    expect(agg.records).toBe(10);
    expect(L0).toMatchObject({ name: 'Deck Zero', games: 3, wins: 1.5, decisions: 7 });
    expect(L1).toMatchObject({ name: 'Deck One', games: 3, wins: 1.5, decisions: 3 });
  });

  it('per card and use: uses, games once per slice, stage and standing splits', () => {
    const play = L0.cards.alpha.play!;
    expect(play.all).toEqual({ uses: 3, games: 2, wins: 1 });
    expect(play.stage).toEqual({ early: { uses: 2, games: 1, wins: 1 }, late: { uses: 1, games: 1, wins: 0 } });
    expect(play.standing).toEqual({ even: { uses: 1, games: 1, wins: 1 }, ahead: { uses: 1, games: 1, wins: 1 }, behind: { uses: 1, games: 1, wins: 0 } });
    expect(L0.cards.beta.sell!.all).toEqual({ uses: 1, games: 1, wins: 0 });
  });

  it('availability: offered in decisions and turns, and how often it was taken', () => {
    expect(L0.cards.alpha.play).toMatchObject({ offered: 4, chosen: 3, windows: 4, windowsUsed: 3 });
    expect(L0.cards.alpha.sell).toMatchObject({ offered: 1, chosen: 0, windows: 1, windowsUsed: 0, all: { uses: 0, games: 0, wins: 0 } });
    expect(L0.cards.beta.sell).toMatchObject({ offered: 2, chosen: 1, windows: 2, windowsUsed: 1 });
    // reactions count attack windows
    expect(L1.cards.gamma.react).toMatchObject({ offered: 2, chosen: 1, windows: 2, windowsUsed: 1, all: { uses: 1, games: 1, wins: 0 } });
  });

  it('per decision type: counts, first-listed option taken, option-count distribution', () => {
    expect(L0.kinds.main).toEqual({ decisions: 6, firstChosen: 2, options: { '3-5': 1, '2': 5 } });
    expect(L0.kinds['yesno/kerry']).toEqual({ decisions: 1, firstChosen: 1, options: { '2': 1 } });
    expect(L1.kinds.react).toEqual({ decisions: 2, firstChosen: 1, options: { '2': 2 } });
    expect(L1.kinds.main).toEqual({ decisions: 1, firstChosen: 1, options: { '1': 1 } });
  });

  it('reactions: react vs let it resolve, with how the attack ended', () => {
    expect(L1.reactions).toEqual({
      windows: 2,
      reacted: { uses: 1, games: 1, wins: 0 },
      letResolve: { uses: 1, games: 1, wins: 1 },
      outcomes: { reacted: { bothGone: 1 }, letResolve: { stole: 1 } },
      choices: { block: 1, endReact: 1 },
    });
  });

  it('merging is order-free and equals aggregating all games at once', () => {
    const [a, b, c] = [G1, G2, G3].map(aggregateGame);
    expect(mergeAggregates(mergeAggregates(a, b), c)).toEqual(agg);
    expect(mergeAggregates(a, mergeAggregates(b, c))).toEqual(agg);
    expect(JSON.parse(JSON.stringify(agg))).toEqual(agg); // plain data: it crosses the worker boundary as is
  });

  it('a mirror match counts both seats as games of the one list', () => {
    const m = aggregateGame({ ...G1, players: [players[0], players[0]] });
    expect(Object.keys(m.decks)).toEqual(['L0']);
    expect(m.decks.L0).toMatchObject({ games: 2, wins: 1, decisions: 5 });
  });
});

describe('decisionReport', () => {
  const agg = aggregateDecisions([G1, G2, G3]);

  it('flags slices under the minimum sample instead of giving a rate', () => {
    expect(MIN_SLICE_GAMES).toBe(20);
    const r = decisionReport(agg);
    const play = r.decks.find((d) => d.listId === 'L0')!.cards.find((c) => c.id === 'alpha')!.modes.find((m) => m.mode === 'play')!;
    expect(play.all).toEqual({ uses: 3, games: 2, winRate: null, low95: null, high95: null, thin: true });
    expect(play.notChosenRate).toBeCloseTo(0.25);
  });

  it('gives a rate and a Wilson interval once a slice has enough games', () => {
    const r = decisionReport(agg, { minGames: 2 });
    const d0 = r.decks.find((d) => d.listId === 'L0')!;
    const play = d0.cards.find((c) => c.id === 'alpha')!.modes.find((m) => m.mode === 'play')!;
    const w = wilson(1, 2);
    expect(play.all).toEqual({ uses: 3, games: 2, winRate: 0.5, low95: w.low, high95: w.high, thin: false });
    expect(play.stage.early.thin).toBe(true);
    expect(play.stage.middle).toEqual({ uses: 0, games: 0, winRate: null, low95: null, high95: null, thin: true });
    expect(d0.decisionTypes[0]).toMatchObject({ type: 'main', decisions: 6, firstChosen: 2, firstChosenRate: 2 / 6 });
    // pooled over lists: alpha is only in L0, so the pooled row is the same
    expect(r.pooled.find((c) => c.id === 'alpha')!.modes.find((m) => m.mode === 'play')!.all).toEqual(play.all);
    expect(r).toMatchObject({ kind: 'decision-telemetry', reportSchema: 1, telemetrySchema: 1, games: 3, records: 10, minSliceGames: 2 });
  });

  it('names nothing "value" or "impact": it describes association', () => {
    const keys = new Set<string>();
    const walk = (x: unknown) => {
      if (Array.isArray(x)) x.forEach(walk);
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) {
          keys.add(k);
          walk(v);
        }
    };
    const r = decisionReport(agg, { minGames: 1 });
    walk(r);
    expect([...keys].filter((k) => /value|impact/i.test(k))).toEqual([]);
    const md = decisionMarkdown(r);
    expect(md).toContain('Descriptive association only');
    expect(md).toContain('| alpha | played | 3 |');
    expect(md).toContain('Reaction windows: 2 attacks');
  });
});

describe('helpers', () => {
  it('Wilson interval', () => {
    const a = wilson(5, 10);
    expect(a.low).toBeCloseTo(0.2366, 3);
    expect(a.high).toBeCloseTo(0.7634, 3);
    const b = wilson(0, 10);
    expect(b.low).toBe(0);
    expect(b.high).toBeCloseTo(0.2775, 3);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });

  it('stages by round and option buckets', () => {
    expect([0, 1, 2, 3, 4, 5, 8, 9, 30].map(stageOf)).toEqual(['early', 'early', 'early', 'early', 'early', 'middle', 'middle', 'late', 'late']);
    expect([1, 2, 3, 5, 6, 10, 11, 20, 21].map(optionBucket)).toEqual(['1', '2', '3-5', '3-5', '6-10', '6-10', '11-20', '11-20', '21+']);
  });
});
