// Decision telemetry (src/engine/telemetry.ts, docs/DECISION_TELEMETRY.md): it only observes (same games on or off),
// lookahead clones never write, records carry the options / choice / payment / attack outcome, and no hidden card
// reaches a record.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import { parseDeck } from '../src/engine/deck';
import { makeTierBot } from '../src/ai/tiers';
import { DECISION_TELEMETRY_SCHEMA, DecisionRecorder, MAX_OPTION_CODES, parseOption, type DecisionRecord } from '../src/engine/telemetry';
import { aggregateGame } from '../src/analysis/decisions';
import type { Agent, Decision, PlayerId } from '../src/engine/types';
import { eddies, gig, setup, spawn, type Hook } from './engine-helpers';

const deck = (f: string) => parseDeck(readFileSync(`data/decks/${f}`, 'utf8'), f).deck;
const A = deck('meta-rrb-wakako-midrange.txt');
const B = deck('meta-gry-trauma-team.txt');

/** FNV-1a over the final log, as tests/replay.test.ts hashes it. */
function hashLog(log: { turn: number; player: number | null; text: string }[]): string {
  let h = 0x811c9dc5;
  for (const e of log) {
    const s = `${e.turn}|${e.player}|${e.text}\n`;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** Counts the decisions the main game asks of each seat (clones get the bots' own agents, not this wrapper). */
class Counting implements Agent {
  name: string;
  asked = 0;
  constructor(public inner: Agent) {
    this.name = inner.name;
  }
  decide(g: Game, d: Decision) {
    this.asked++;
    return this.inner.decide(g, d);
  }
}

async function playTier(level: string, seed: number, first: PlayerId, telemetry: boolean, boards = false) {
  const agents: [Counting, Counting] = [new Counting(makeTierBot(level, seed)), new Counting(makeTierBot(level, seed + 7777))];
  const g = Game.create([A, B], agents, { seed, first });
  const rec = telemetry ? new DecisionRecorder({ boards }) : null;
  g.telemetry = rec;
  const s = await g.run();
  return { out: { winner: s.winner, turns: s.turn, log: hashLog(s.log), rng: s.rng, stats: s.stats }, records: rec?.finish(g) ?? [], asked: agents[0].asked + agents[1].asked, rec };
}

describe('decision telemetry only observes', () => {
  for (const [level, seed, first] of [
    ['easy', 101, 0],
    ['medium', 201, 0],
    ['hard', 302, 1],
  ] as const) {
    it(`${level}: the same seed gives the same game with telemetry on and off, and clones write nothing`, async () => {
      const off = await playTier(level, seed, first, false);
      const on = await playTier(level, seed, first, true);
      expect(on.out).toEqual(off.out);
      expect(on.asked).toBe(off.asked);
      // one record per decision the main game asked: lookahead clones (medium and hard look ahead) added none
      expect(on.records.length).toBe(on.asked);
      expect(on.records.map((r) => r.i)).toEqual(on.records.map((_, k) => k));
      expect(on.records.some((r) => r.w === 'main')).toBe(true);
      expect(on.records.every((r) => r.o.length <= MAX_OPTION_CODES && r.ch.length === r.c.length)).toBe(true);
    }, 60_000);
  }

  it('board snapshots (the synergy observer) only observe too: the same game, one snapshot per turn at least', async () => {
    const off = await playTier('hard', 404, 0, false);
    const on = await playTier('hard', 404, 0, true, true);
    expect(on.out).toEqual(off.out);
    expect(on.asked).toBe(off.asked);
    const rec = on.rec!;
    for (let t = 1; t <= on.out.turns; t++) for (const p of [0, 1] as PlayerId[]) expect(rec.boards.some((b) => b.t === t && b.p === p), `turn ${t}, player ${p}`).toBe(true);
    // every own main-deck card is sighted at most once, never before turn 1
    expect(rec.sightings.every((x) => x.t >= 1)).toBe(true);
    expect(rec.sightings.filter((x) => x.p === 0).length).toBeLessThanOrEqual(A.main.length);
    // the plain recorder keeps none
    const plain = await playTier('easy', 101, 0, true);
    expect(plain.rec!.boards).toEqual([]);
    expect(plain.rec!.sightings).toEqual([]);
  }, 60_000);

  it('a clone never carries the recorder, and playing on a clone writes no record', async () => {
    const { g } = scene();
    spawn(g, 0, 'psycho_squad', 'hand');
    eddies(g, 0, 4);
    const before = g.telemetry!.records.length;
    const c = g.clone([makeTierBot('easy', 1), makeTierBot('easy', 2)]);
    expect(c.telemetry).toBeNull();
    await c.mainLoop();
    expect(g.telemetry!.records.length).toBe(before);
  });
});

/** setup() with a recorder on the game (board snapshots on, so the hidden-information check covers them too). */
function scene(hooks: [Hook | null, Hook | null] = [null, null]) {
  const s = setup(hooks);
  const rec = new DecisionRecorder({ boards: true });
  s.g.telemetry = rec;
  return { ...s, rec };
}
/** Hook: on the first main-phase decision pick the action matching `pred`, then pass. */
function once(pred: (a: { type: string; targetGigs?: unknown }) => boolean): Hook {
  let done = false;
  return (d) => {
    if (d.kind !== 'action') return undefined;
    if (done) return d.options.findIndex((o) => o.action?.type === 'pass');
    done = true;
    return d.options.findIndex((o) => o.action && pred(o.action as { type: string }));
  };
}

describe('decision records', () => {
  it('a main-phase action: legal options, the choice, the €$ paid and the public features', async () => {
    const { g, rec } = scene([once((a) => a.type === 'play'), null]);
    spawn(g, 0, 'psycho_squad', 'hand');
    eddies(g, 0, 5); // one left after paying 4, so a Call is still legal and the pass is a real choice
    gig(g, 1, 6, 3);
    await g.mainLoop();
    const [play, pass] = rec.records;
    expect(play).toMatchObject({ i: 0, t: 3, p: 0, kind: 'action', w: 'main', ch: ['play:psycho_squad'] });
    // `c` indexes the full option list (three face-down Legends are three call options); `o` lists each code once
    const d = (g.agents[0] as unknown as { log: Decision[] }).log.find((x) => x.kind === 'action')!;
    expect(d.options[play.c[0]].action).toMatchObject({ type: 'play' });
    expect(play.n).toBe(d.options.length);
    expect(play.o).toEqual(expect.arrayContaining(['pass', 'play:psycho_squad', 'call:?']));
    expect(play.n).toBeGreaterThanOrEqual(play.o.length);
    expect(play.pay).toEqual({ amount: 4, eddies: 4, faceDown: 0, legends: [] });
    expect(play.f.me).toMatchObject({ hand: 1, units: 0, eddies: 5, eddiesTotal: 5, payable: 5, gigs: 0 });
    expect(play.f.op).toMatchObject({ gigs: 1, cred: 3 });
    expect(play.f).toMatchObject({ lead: -1, active: true });
    expect(pass).toMatchObject({ w: 'main', ch: ['pass'], c: [0] });
    expect(pass.f.me).toMatchObject({ hand: 0, units: 1, power: 6, ready: 1, eddies: 1, eddiesTotal: 5 });
    expect(pass.pay).toBeUndefined();
  });

  it('a reaction, with the attack it answered and how the attack ended', async () => {
    const block: Hook = (d) => (d.kind === 'reaction' ? d.options.findIndex((o) => o.action?.type === 'block') : undefined);
    const { g, rec } = scene([once((a) => a.type === 'attack' && a.targetGigs === 1), block]);
    spawn(g, 0, 'psycho_squad', 'field');
    const blocker = spawn(g, 1, 'psycho_squad', 'field');
    g.giveKeyword(blocker.uid, 'blocker', 'permanent');
    gig(g, 1, 4, 2);
    await g.mainLoop();
    const atk = rec.records.find((r) => r.w === 'main' && r.ch[0].startsWith('attack:'))!;
    const rx = rec.records.find((r) => r.w === 'react')!;
    expect(atk.ch).toEqual(['attack:psycho_squad>gigs']);
    expect(rx).toMatchObject({ p: 1, kind: 'reaction', o: ['endReact', 'block:psycho_squad'], ch: ['block:psycho_squad'], c: [1] });
    expect(rx.atk).toEqual({ n: 0, attacker: 'psycho_squad', target: 'gigs' });
    expect(atk.atk).toEqual(rx.atk);
    // 6 power vs 6 power: both Units lose the fight and are defeated; nothing is stolen
    const outcome = { end: 'fight', blocked: true, stolen: 0, attackerGone: true, targetGone: true };
    expect(rx.res?.attack).toEqual(outcome);
    expect(atk.res?.attack).toEqual(outcome);
  });

  it('an attack the defender lets resolve: a steal', async () => {
    const { g, rec } = scene([once((a) => a.type === 'attack' && a.targetGigs === 1), null]);
    spawn(g, 0, 'psycho_squad', 'field');
    gig(g, 1, 4, 2);
    // the defender could Call (a ready face-down Legend and 1 €$), so it is asked, and lets the attack resolve
    eddies(g, 1, 1);
    g.c(g.P(1).legends[0]).spent = false;
    await g.mainLoop();
    const rx = rec.records.find((r) => r.w === 'react')!;
    expect(rx.o).toEqual(['endReact', 'call:?']);
    expect(rx.ch).toEqual(['endReact']);
    expect(rx.res?.attack).toEqual({ end: 'steal', blocked: false, stolen: 1, attackerGone: false, targetGone: false });
  });

  it('a payment choice (agents that choose payment) and the action it paid for', async () => {
    const pickLegend: Hook = (d) => (d.kind === 'pay' ? d.options.findIndex((o) => o.key === 'legend') : undefined);
    let played = false;
    const hook: Hook = (d, g) => pickLegend(d, g) ?? (d.kind === 'action' ? (played ? 0 : ((played = true), d.options.findIndex((o) => o.action?.type === 'play'))) : undefined);
    const { g, agents, rec } = scene([hook, null]);
    Object.assign(agents[0], { choosesPayment: true });
    spawn(g, 0, 'psycho_squad', 'hand');
    eddies(g, 0, 4);
    g.c(g.P(0).legends[1]).spent = false; // a ready face-down Legend can pay too
    await g.mainLoop();
    const play = rec.records.find((r) => r.ch[0] === 'play:psycho_squad')!;
    const pay = rec.records.find((r) => r.w === 'pay')!;
    expect(pay).toMatchObject({ kind: 'pay', p: 0, o: ['pay:eddie', 'pay:fd'], ch: ['pay:fd'], c: [1] });
    expect(pay.i).toBe(play.i + 1);
    expect(play.pay).toEqual({ amount: 4, eddies: 3, faceDown: 1, legends: [] });
    expect(pay.pay).toBeUndefined();
  });

  it("an order choice (agents that order their own effects)", async () => {
    const last: Hook = (d) => (d.kind === 'order' ? d.options.length - 1 : undefined);
    const { g, agents, rec } = scene([last, null]);
    Object.assign(agents[0], { choosesOrder: true });
    const a = spawn(g, 0, 'psycho_squad', 'field');
    const b = spawn(g, 0, 'v_corporate_exile', 'field');
    const out: string[] = [];
    g.enqueue(0, 'A', async () => void out.push('A'), { source: a.uid });
    g.enqueue(0, 'B', async () => void out.push('B'), { source: b.uid });
    await g.resolvePending();
    expect(out).toEqual(['B', 'A']);
    expect(rec.records).toHaveLength(1);
    expect(rec.records[0]).toMatchObject({ w: 'order', kind: 'order', tag: 'order', o: ['effect:psycho_squad', 'effect:v_corporate_exile'], c: [1], ch: ['effect:v_corporate_exile'] });
  });

  /** setup() with only a face-up V: Corporate Exile (cost 5, Go Solo) in player 0's Legends area. */
  function legendScene(pick: 'goSolo' | 'playLegend', eddieCount: number) {
    const s = scene([once((a) => a.type === pick), null]);
    for (const u of [...s.g.P(0).legends]) s.g.move(u, 'removed');
    spawn(s.g, 0, 'v_corporate_exile', 'legends');
    eddies(s.g, 0, eddieCount);
    return s;
  }

  it('an ordinary Legend play (4.5): offered next to Go Solo, paid with Eddies', async () => {
    const { g, rec } = legendScene('playLegend', 5);
    await g.mainLoop();
    const r = rec.records[0];
    expect(r.o).toEqual(expect.arrayContaining(['solo:v_corporate_exile', 'legend:v_corporate_exile']));
    expect(r.ch).toEqual(['legend:v_corporate_exile']);
    expect(r.pay).toEqual({ amount: 5, eddies: 5, faceDown: 0, legends: [] });
    expect(r.f.me.legendsUp).toBe(1);
  });

  it('a Go Solo the Legend helps pay for: its own id is among the sources spent', async () => {
    const { g, rec } = legendScene('goSolo', 4);
    await g.mainLoop();
    const r = rec.records[0];
    expect(r.o).toContain('solo:v_corporate_exile');
    expect(r.o).toContain('legend:v_corporate_exile'); // the ordinary play too: V may pay for it, and enters spent
    expect(r.ch).toEqual(['solo:v_corporate_exile']);
    expect(r.pay).toEqual({ amount: 5, eddies: 4, faceDown: 0, legends: ['v_corporate_exile'] });
    const agg = aggregateGame({ records: rec.records, players: [g.P(0), g.P(1)], winner: 0 });
    expect(agg.decks[g.P(0).listId!].cards.v_corporate_exile.solo).toMatchObject({ chosen: 1, selfPaid: 1 });
  });

  it('a Call records the Legend it revealed afterwards, never among the options', async () => {
    const { g, rec } = scene([once((a) => a.type === 'call'), null]);
    eddies(g, 0, 1);
    g.c(g.P(0).legends[0]).spent = false;
    await g.mainLoop();
    const r = rec.records[0];
    expect(r.ch).toEqual(['call:?']);
    rec.finish(g);
    const flipped = g.P(0).legends.map((u) => g.c(u)).find((c) => c.faceUp)!;
    expect(r.res?.revealed).toBe(flipped.defId);
    expect(r.o.every((o) => parseOption(o).id === undefined || parseOption(o).id === '?')).toBe(true);
  });
});

describe('no hidden information in a record', () => {
  it("rival hand cards and face-down Legends never appear; the player's own hand does", async () => {
    const { g, rec } = scene([once((a) => a.type === 'attack' && a.targetGigs === 1), null]);
    // distinct ids everywhere, so a leak can't hide behind a shared id
    for (const p of [0, 1] as PlayerId[]) for (const u of [...g.P(p).legends]) g.move(u, 'removed');
    const down = (p: PlayerId, id: string) => spawn(g, p, id, 'legends', { faceUp: false });
    const hidden = [down(0, 'judy_alvarez_braindance_maestro'), down(0, 'padre_man_of_the_cross'), down(1, 'panam_palmer_nomad_cavalry'), down(1, 'hanako_arasaka_daughter_of_the_emperor')];
    const rivalHand = ['floor_it', 'synapse_burnout', 'take_control'];
    for (const id of rivalHand) spawn(g, 1, id, 'hand');
    spawn(g, 0, 'psycho_squad', 'hand');
    spawn(g, 0, 'psycho_squad', 'field');
    eddies(g, 0, 2);
    eddies(g, 1, 3);
    gig(g, 1, 4, 2);
    gig(g, 0, 6, 3);
    await g.mainLoop();
    await g.endPhase();
    await g.startPhase(); // player 1's turn: Scripted passes, so nothing is called or played
    await g.mainLoop();
    const records = rec.finish(g);
    expect(records.some((r) => r.p === 0 && r.w === 'main')).toBe(true);
    expect(records.some((r) => r.p === 1 && r.w === 'react')).toBe(true);
    expect(records.some((r) => r.p === 1 && r.w === 'main')).toBe(true);
    for (const r of records) {
      const text = JSON.stringify(r);
      for (const c of hidden) expect(text, `record ${r.i} names face-down ${c.defId}`).not.toContain(c.defId);
      if (r.p === 0) for (const id of rivalHand) expect(text, `player 0's record ${r.i} names rival hand card ${id}`).not.toContain(id);
    }
    // board snapshots hold public cards only; sightings are each player's own cards
    expect(rec.boards.length).toBeGreaterThan(0);
    for (const b of rec.boards) {
      const text = JSON.stringify(b);
      for (const c of hidden) expect(text, `board of player ${b.p} at turn ${b.t} names face-down ${c.defId}`).not.toContain(c.defId);
      for (const id of rivalHand) expect(text, `board of player ${b.p} names hand card ${id}`).not.toContain(id);
    }
    for (const x of rec.sightings) if (x.p === 0) expect(rivalHand).not.toContain(x.id);
    // player 1 sees their own hand: its Quick Program is a reaction option, and its cards are main-phase options
    const own = records.filter((r) => r.p === 1).map((r) => JSON.stringify(r)).join('');
    expect(rivalHand.some((id) => own.includes(id))).toBe(true);
    expect(records.filter((r) => r.o.includes('call:?')).length).toBeGreaterThan(0);
  });
});

describe('schema', () => {
  it('is versioned', () => {
    expect(DECISION_TELEMETRY_SCHEMA).toBe(1);
    const r: Partial<DecisionRecord> = { i: 0 };
    expect(r.i).toBe(0);
  });
});
