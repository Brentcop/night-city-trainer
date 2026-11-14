// A seat's own Gig plan (planFor, src/ai/eval.ts) is the plan of its whole list: every card it owns, wherever the card
// is (deck, hand, field, Legends, Eddies, trash, removed, Gear attached to a card). So the live game, every copy of it
// (Game.clone, Undo's snapshot, the coach's snapshot) and every option of one decision are scored by the same plan, and
// a game continued from a copy plays out exactly as the game continued in place. Until 2026-11 the plan was cached on
// the player-state object at its first call and a copy computed its own from the cards then in deck, hand, field, trash
// and Legends, so a copy taken after a sale scored Gigs differently.
// The same holds for the archetypes the bots read (seatArchetype): both seats' are those of their whole lists, so the
// live bot, a fresh agent on a copy (its rollouts), the coach and the reviewer apply the same matchup profile. Until
// 2026-11 the live bot read them at its first decision and every fresh agent from the cards then in the zones.
import { describe, expect, it } from 'vitest';
import { Game } from '../src/engine/engine';
import type { Agent, Decision, DeckList, GameState, PlayerId } from '../src/engine/types';
import { planFor, seatArchetype } from '../src/ai/eval';
import { gigPlanOf } from '../src/ai/knowledge';
import { CARDS } from '../src/engine/cards';
import { HeuristicAgent } from '../src/ai/heuristic';
import { BEST_PROFILES, classify } from '../src/ai/archetype';
import { makeCoach } from '../src/ai/coach';
import { makeBot } from '../src/lib/tournament';
import { cloneBot } from '../src/lib/practiceSession';
import { stateHash } from '../src/lib/savedGames';
import { loadLibrary } from '../scripts/lib-node';

const lib = loadLibrary();
const deck = (file: string): DeckList => {
  const d = lib.find((x) => x.file === file);
  if (!d) throw new Error(`no library deck ${file}`);
  return d.deck;
};
const RRY = deck('RRY-fills-up-discard-super-quickly-then-heavily-discounted-traum.txt');
const NC06 = lib.find((x) => x.file.endsWith('nc-06-metal-over-meat-yyy.txt'))!.deck;
const YYB = deck('meta-yyb-rogue-gear.txt');
const listPlan = (d: DeckList) => gigPlanOf([...d.legends, ...d.main]);
const noAgent: Agent = { name: 'none', decide: async () => [0] };

/** Records every answer, and copies the game the way Undo does (state + cloneBot) at the first main-phase decision of each turn in `pauseAt`. */
class Recorder implements Agent {
  name: string;
  constructor(
    private seat: PlayerId,
    private bot: Agent,
    private answers: string[],
    private onAction?: (g: Game) => void,
  ) {
    this.name = bot.name;
  }
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (d.kind === 'action') this.onAction?.(g);
    const r = await this.bot.decide(g, d);
    this.answers.push(`${this.seat} t${g.s.turn} ${d.kind}/${d.tag ?? ''} ${r.join(',')}`);
    return r;
  }
}

interface Copy {
  turn: number;
  at: number;
  state: GameState;
  bots: HeuristicAgent[];
}

/** A Medium-vs-Medium game played in place, with copies taken at the first main-phase decision of the given turns. */
async function playWithCopies(a: DeckList, b: DeckList, seed: number, first: PlayerId, pauseAt: number[]) {
  const bots = [makeBot('medium', seed), makeBot('medium', seed + 7777)];
  const answers: string[] = [];
  const copies: Copy[] = [];
  const left = new Set(pauseAt);
  const onAction = (g: Game) => {
    if (!left.delete(g.s.turn)) return;
    copies.push({ turn: g.s.turn, at: answers.length, state: g.clone([noAgent, noAgent], { keepLog: true }).s, bots: bots.map((x) => cloneBot(x)) });
  };
  const g = Game.create([a, b], [new Recorder(0, bots[0], answers, onAction), new Recorder(1, bots[1], answers, onAction)], { seed, first, log: false });
  const end = await g.run();
  return { g, answers, copies, hash: stateHash(end) };
}

/** Continue a copy to the end, as Undo does (Game.resume). */
async function continueCopy(c: Copy) {
  const answers: string[] = [];
  const g = new Game(structuredClone(c.state), [new Recorder(0, c.bots[0], answers), new Recorder(1, c.bots[1], answers)]);
  g.logEnabled = false;
  const end = await g.resume();
  return { g, answers, hash: stateHash(end) };
}

describe('Gig plan: the plan of the seat’s whole list', () => {
  it('is the list’s plan on a fresh game', () => {
    expect(Object.values(listPlan(RRY)).some((v) => v > 0)).toBe(true); // the checks below mean something only for a deck with a plan
    const g = Game.create([RRY, YYB], [noAgent, noAgent], { seed: 5, first: 0, log: false });
    expect(planFor(g, 0, 0)).toEqual(listPlan(RRY));
    expect(planFor(g, 1, 1)).toEqual(listPlan(YYB));
  });

  it('does not change when cards are sold, trashed, played or attached as Gear, on the game or on a copy', () => {
    // RRY's list with one Gear in it
    const gearId = CARDS.find((c) => c.type === 'Gear')!.id;
    const list: DeckList = { ...RRY, main: [...RRY.main.slice(1), gearId] };
    const g = Game.create([list, YYB], [noAgent, noAgent], { seed: 5, first: 0, log: false });
    const before = planFor(g, 0, 0);
    const P = g.P(0);
    const cards = [...P.deck, ...P.hand];
    const unit = cards.find((u) => g.def(g.c(u)).type === 'Unit')!;
    const gear = cards.find((u) => g.def(g.c(u)).type === 'Gear')!;
    const others = cards.filter((u) => u !== unit && u !== gear);
    g.move(others[0], 'eddies'); // sold
    g.move(others[1], 'eddies');
    g.move(others[2], 'trash');
    g.move(unit, 'field');
    g.equip(gear, unit); // attached Gear is in no zone list
    expect(P.eddies.length).toBe(2);
    expect(g.c(gear).host).toBe(unit);
    const copy = g.clone([noAgent, noAgent]);
    for (const x of [g, copy, copy.clone([noAgent, noAgent])]) expect(planFor(x, 0, 0)).toEqual(before);
    expect(before).toEqual(listPlan(list));
  });

  it('is the same on a copy of a game in progress (the copy the coach and Undo work from)', async () => {
    const { copies } = await playWithCopies(RRY, YYB, 20261215, 1, [6]);
    const c = copies[0];
    expect(c.state.players[0].eddies.length + c.state.players[1].eddies.length).toBeGreaterThan(0); // cards have been sold by then
    const g = new Game(structuredClone(c.state), [noAgent, noAgent]);
    expect(planFor(g, 0, 0)).toEqual(listPlan(RRY));
    expect(planFor(g, 1, 1)).toEqual(listPlan(YYB));
  });

  it('a game continued from a copy (the way Undo copies it) plays out exactly as the game continued in place', async () => {
    // deals where the plan cached at the first call made the copies play differently (Medium bots)
    const deals: [DeckList, DeckList, number, PlayerId][] = [
      [RRY, YYB, 20261215, 1],
      [YYB, RRY, 20261215, 0],
      [RRY, YYB, 31337, 0],
    ];
    let compared = 0;
    for (const [a, b, seed, first] of deals) {
      const played = await playWithCopies(a, b, seed, first, [2, 4, 6, 9, 12]);
      for (const c of played.copies) {
        const cont = await continueCopy(c);
        expect(cont.answers, `copy at turn ${c.turn}, seed ${seed}`).toEqual(played.answers.slice(c.at));
        expect(cont.hash, `copy at turn ${c.turn}, seed ${seed}`).toBe(played.hash);
        compared++;
      }
    }
    expect(compared).toBeGreaterThanOrEqual(12);
  }, 60_000);
});

describe('archetype: read from the seat’s whole list', () => {
  const listArch = (d: DeckList) => classify([...d.legends, ...d.main]).arch;

  it('is the list’s archetype on a fresh game, after cards are sold, trashed, played or attached, and on copies', () => {
    const gearId = CARDS.find((c) => c.type === 'Gear')!.id;
    const list: DeckList = { ...RRY, main: [...RRY.main.slice(1), gearId] };
    const g = Game.create([list, YYB], [noAgent, noAgent], { seed: 5, first: 0, log: false });
    const P = g.P(0);
    const cards = [...P.deck, ...P.hand];
    const unit = cards.find((u) => g.def(g.c(u)).type === 'Unit')!;
    const gear = cards.find((u) => g.def(g.c(u)).type === 'Gear')!;
    const others = cards.filter((u) => u !== unit && u !== gear && g.def(g.c(u)).type === 'Unit');
    for (const u of others.slice(0, 6)) g.move(u, 'eddies'); // sold: the Units left in the zones are fewer
    g.move(unit, 'field');
    g.equip(gear, unit);
    const copy = g.clone([noAgent, noAgent]);
    for (const x of [g, copy, copy.clone([noAgent, noAgent])]) {
      expect(seatArchetype(x, 0)).toBe(listArch(list));
      expect(seatArchetype(x, 1)).toBe(listArch(YYB));
    }
  });

  it('a fresh agent on a copy (the rollouts), the coach and the live bot read the same pair at every copy', async () => {
    // a deal where the archetypes read from the cards in the zones drift as cards are sold (Medium bots)
    const played = await playWithCopies(YYB, NC06, 20261114, 0, [2, 4, 6, 9, 12]);
    expect(played.copies.length).toBeGreaterThanOrEqual(4);
    const want = (p: PlayerId) => (p === 0 ? { me: listArch(YYB), opp: listArch(NC06) } : { me: listArch(NC06), opp: listArch(YYB) });
    for (const c of played.copies)
      for (const p of [0, 1] as PlayerId[]) {
        const g = new Game(structuredClone(c.state), [noAgent, noAgent]);
        const live = c.bots[p].matchupRead(g, p); // the bot as copied by Undo (cloneBot)
        const fresh = new HeuristicAgent({ profiles: BEST_PROFILES }).matchupRead(g, p);
        const coach = makeCoach().matchupRead(new Game(structuredClone(c.state), [noAgent, noAgent]), p);
        expect(fresh, `turn ${c.turn}, seat ${p}`).toEqual(live);
        expect(coach, `turn ${c.turn}, seat ${p}`).toEqual(live);
        expect(live, `turn ${c.turn}, seat ${p}`).toEqual(want(p));
      }
  }, 60_000);
});
