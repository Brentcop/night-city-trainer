// Scenario builders shared by the FAQ conformance tests (tests/faq/*.test.ts). Not a test file. Builds on
// tests/engine-helpers.ts: setup() gives player 0's main phase on turn 3 with empty hands and spent starting Legends.
import type { Game } from '../../src/engine/engine';
import type { CardInst, Decision, DecisionKind, PlayerId, Reaction } from '../../src/engine/types';
import { eddies, gig, setup, spawn, type Hook, type Scripted } from '../engine-helpers';

export { eddies, equip, FILLER, gig, optionIndex, pickTag, play, setup, spawn, type Hook } from '../engine-helpers';

// ---------------------------------------------------------------- scenes

export interface Scene {
  g: Game;
  agents: [Scripted, Scripted];
  /** decisions player p was asked, optionally only those matching */
  asked: (p: PlayerId, pred?: (d: Decision) => boolean) => Decision[];
  /** log lines written since the scene was built (or since `mark()`) */
  lines: () => string[];
  mark: () => void;
}

/**
 * setup() plus conveniences. `order`: the players who choose the order of their own pending effects (10.12); bots
 * never do, so only an agent with `choosesOrder` is ever asked an 'order' decision.
 */
export function scene(o: { hooks?: [Hook | null, Hook | null]; order?: PlayerId[]; seed?: number } = {}): Scene {
  const { g, agents } = setup(o.hooks ?? [null, null], o.seed ?? 1);
  for (const p of o.order ?? []) Object.assign(agents[p], { choosesOrder: true });
  let from = g.s.log.length;
  return {
    g,
    agents,
    asked: (p, pred) => agents[p].log.filter((d) => !pred || pred(d)),
    lines: () => g.s.log.slice(from).map((e) => e.text),
    mark: () => void (from = g.s.log.length),
  };
}

/** Give each player the Gigs listed as [sides, value] (each die size at most once per player). */
export function gigs(g: Game, p: PlayerId, list: [number, number][]): number[] {
  return list.map(([sides, value]) => gig(g, p, sides, value));
}

/** n filler cards on top of p's deck (setup() already leaves ~40 in each deck). */
export function deckOf(g: Game, p: PlayerId, defIds: string[]): CardInst[] {
  // spawn() puts each card on top, so spawn in reverse to keep the listed order from the top
  return [...defIds].reverse().map((id) => spawn(g, p, id, 'deck')).reverse();
}

/** Empty p's deck (cards go to the removed zone so they count nowhere). */
export function emptyDeck(g: Game, p: PlayerId) {
  for (const u of [...g.P(p).deck]) g.move(u, 'removed');
}

/** Spawn a card in p's hand, give p exactly enough Eddies to pay its current cost, play it and resolve its effects. */
export async function playCard(g: Game, p: PlayerId, defId: string): Promise<CardInst> {
  const c = spawn(g, p, defId, 'hand');
  eddies(g, p, g.playCost(c.uid, p));
  await g.playFromHand(p, c.uid);
  await g.resolvePending();
  return c;
}

/** Move to the other player's main phase: end this turn (end-of-turn effects resolve) and run their start phase. */
export async function passTurn(g: Game) {
  await g.endPhase();
  await g.startPhase();
  g.s.phase = 'main';
}

// ---------------------------------------------------------------- attacks

/**
 * Freeze an attack in its React step without running it, to inspect `legalReactions` (the attacker is spent as
 * declaring an attack would). Clear it with `g.s.attack = null`.
 */
export function reactStep(g: Game, attacker: CardInst, target: { unit?: CardInst; gigs?: PlayerId }) {
  attacker.spent = true;
  g.s.active = attacker.controller;
  g.s.attack = {
    attacker: attacker.uid,
    attackerPlayer: attacker.controller,
    targetUnit: target.unit?.uid ?? null,
    targetGigs: target.unit ? null : (target.gigs ?? (1 - attacker.controller) as PlayerId),
    step: 'react',
    ended: false,
  };
}

/** The reactions player p may take now. */
export const reactions = (g: Game, p: PlayerId): Reaction[] => g.legalReactions(p);
export const canBlockWith = (g: Game, p: PlayerId, c: CardInst) => g.legalReactions(p).some((r) => r.type === 'block' && r.uid === c.uid);

/**
 * A reaction hook that takes the listed reactions in order, one per React-step question, then ends reacting. Each
 * entry picks a reaction (e.g. `r => r.type === 'block' && r.uid === x.uid`); a step whose reaction is not on offer ends.
 */
export function reactWith(...steps: ((r: Reaction, g: Game) => boolean)[]): Hook {
  let k = 0;
  return (d, g) => {
    if (d.kind !== 'reaction') return undefined;
    const end = d.options.findIndex((o) => (o.action as Reaction).type === 'endReact');
    if (k >= steps.length) return end;
    const i = d.options.findIndex((o) => steps[k]((o.action as Reaction), g));
    k++;
    return i >= 0 ? i : end;
  };
}
export const blockBy = (c: CardInst) => (r: Reaction) => r.type === 'block' && r.uid === c.uid;
export const playR = (c: CardInst) => (r: Reaction) => r.type === 'play' && r.uid === c.uid;
export const activateR = (host: CardInst, index = 0) => (r: Reaction) => r.type === 'activate' && r.host === host.uid && r.index === index;

// ---------------------------------------------------------------- decisions

/** The first hook that answers wins. */
export const hooks =
  (...hs: (Hook | null | undefined)[]): Hook =>
  (d, g) => {
    for (const h of hs) {
      const r = h?.(d, g);
      if (r !== undefined) return r;
    }
    return undefined;
  };

/** Answer every decision of a kind (optionally only for one tag). */
export const onKind =
  (kind: DecisionKind, answer: number | ((d: Decision, g: Game) => number | undefined), tag?: string): Hook =>
  (d, g) =>
    d.kind === kind && (tag === undefined || d.tag === tag) ? (typeof answer === 'number' ? answer : answer(d, g)) : undefined;

/** In unit/card decisions that offer this card, choose it. */
export const chooseCard =
  (c: CardInst | number): Hook =>
  (d) => {
    const uid = typeof c === 'number' ? c : c.uid;
    const i = d.options.findIndex((o) => o.uid === uid);
    return i >= 0 && (d.kind === 'unit' || d.kind === 'card') ? i : undefined;
  };

/** Answer yes/no questions (all, or one tag). */
export const answerYes = (yes: boolean, tag?: string): Hook => (d) => (d.kind === 'yesno' && (tag === undefined || d.tag === tag) ? (yes ? 0 : 1) : undefined);

/** In 'mode' decisions, choose the option whose label contains `text`. */
export const chooseMode =
  (text: string): Hook =>
  (d) => {
    if (d.kind !== 'mode') return undefined;
    const i = d.options.findIndex((o) => o.label.includes(text));
    return i >= 0 ? i : undefined;
  };

/** In gigValue decisions, choose "No change" (adjust by 0). */
export const noChange: Hook = (d) => (d.kind === 'gigValue' ? d.options.findIndex((o) => o.key === 'none') : undefined);
/** In gigValue decisions, choose the given Gig's new value. */
export const setGigTo =
  (gid: number, value: number): Hook =>
  (d) => {
    if (d.kind !== 'gigValue') return undefined;
    const i = d.options.findIndex((o) => o.gig === gid && o.n === value);
    return i >= 0 ? i : undefined;
  };

// ---------------------------------------------------------------- pending order (10.12)

/**
 * The labels offered in each 'order' decision a player was asked: an 'order' decision is asked only when 2+ of that
 * player's pending effects would each do something now, so being asked is the engine letting them choose.
 */
export const orderOffers = (agent: Scripted) => agent.log.filter((d) => d.kind === 'order').map((d) => d.options.map((o) => o.label));

/** An order hook that resolves first the effect whose label contains `text` (when it is offered). */
export const resolveFirst =
  (text: string): Hook =>
  (d) => {
    if (d.kind !== 'order') return undefined;
    const i = d.options.findIndex((o) => o.label.includes(text));
    return i >= 0 ? i : undefined;
  };

// ---------------------------------------------------------------- abilities

/** Abilities player p could activate now (as a reaction or in their main phase), as "<host>: <label>". */
export const abilities = (g: Game, p: PlayerId, asReaction = false) => g.listAbilities(p, asReaction).map((a) => `${g.name(a.host)}: ${a.a.label}`);
/** Can p activate ability `index` of `self` (on `host`, default itself) now? */
export const canActivate = (g: Game, p: PlayerId, self: CardInst, index = 0, asReaction = false, host: CardInst = self) =>
  g.listAbilities(p, asReaction).some((a) => a.self.uid === self.uid && a.host.uid === host.uid && a.index === index);

/** Activate ability `index` of `self` (on `host`) in p's main phase and resolve everything it makes pending. */
export async function activate(g: Game, p: PlayerId, self: CardInst, index = 0, host: CardInst = self) {
  await g.doAction(p, { type: 'activate', uid: self.uid, host: host.uid, index });
  await g.resolvePending();
}
