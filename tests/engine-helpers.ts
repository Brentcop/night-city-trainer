// Shared scenario helpers for engine and card tests (not a test file itself).
import { Game } from '../src/engine/engine';
import type { Agent, CardInst, Decision, DeckList, PlayerId, Zone } from '../src/engine/types';

export type Hook = (d: Decision, g: Game) => number | number[] | undefined;

/**
 * Answers with the first option unless the hook says otherwise. Reactions default to "no more reactions" and the
 * mulligan question to "no". Every decision is recorded in `log`.
 */
export class Scripted implements Agent {
  name = 'Scripted';
  log: Decision[] = [];
  constructor(public hook: Hook | null = null) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    this.log.push(d);
    const r = this.hook?.(d, g);
    if (r !== undefined) return Array.isArray(r) ? r : [r];
    if (d.kind === 'reaction') return [d.options.findIndex((o) => (o.action as any)?.type === 'endReact')];
    if (d.kind === 'yesno' && d.tag === 'mulligan') return [1];
    return [0];
  }
}

export const FILLER = 'psycho_squad'; // Blue Unit, cost 4, power 6, no text

export function fillerDeck(name: string, legends = ['dexter_deshawn_off_the_grid', 'v_streetkid', 'royce_psycho_on_the_edge']): DeckList {
  return { name, legends, main: Array(40).fill(FILLER), sideboard: [] };
}

/** A game in player 0's main phase on turn 3: empty hands (cards back in the decks), all starting Legends spent. */
export function setup(hooks: [Hook | null, Hook | null] = [null, null], seed = 1) {
  const agents: [Scripted, Scripted] = [new Scripted(hooks[0]), new Scripted(hooks[1])];
  const g = Game.create([fillerDeck('A'), fillerDeck('B')], agents, { seed, first: 0, log: true });
  g.s.turn = 3;
  g.s.phase = 'main';
  g.s.active = 0;
  for (const p of [0, 1] as PlayerId[]) {
    for (const u of [...g.P(p).hand]) g.move(u, 'deck');
    for (const u of g.P(p).legends) g.c(u).spent = true;
  }
  return { g, agents };
}

/** Put a new card straight into a zone (deck: on top). Legends in the Legends area are face-up unless faceUp:false. */
export function spawn(g: Game, p: PlayerId, defId: string, zone: Zone, opts: Partial<CardInst> = {}): CardInst {
  const uid = g.s.nextUid++;
  const c: CardInst = {
    uid,
    defId,
    owner: p,
    controller: p,
    zone,
    spent: false,
    faceUp: zone !== 'hand' && zone !== 'deck' && zone !== 'eddies',
    lag: false,
    gear: [],
    host: null,
    enteredTurn: 0,
    goSolo: false,
    ...opts,
  };
  g.s.cards[uid] = c;
  const list = g.zoneList(p, zone)!;
  if (zone === 'deck') list.unshift(uid);
  else list.push(uid);
  return c;
}

export function eddies(g: Game, p: PlayerId, n: number) {
  for (let i = 0; i < n; i++) spawn(g, p, FILLER, 'eddies');
}

export function equip(g: Game, p: PlayerId, defId: string, host: CardInst): CardInst {
  const c = spawn(g, p, defId, 'hand');
  g.equip(c.uid, host.uid);
  return c;
}

/** Move a Gig of the given size from p's fixer area to p's Gig area with a value. Returns the gig id. */
export function gig(g: Game, p: PlayerId, sides: number, value: number): number {
  const ps = g.P(p);
  const id = ps.fixer.find((x) => g.gig(x).sides === sides)!;
  ps.fixer = ps.fixer.filter((x) => x !== id);
  const gg = g.gig(id);
  gg.value = value;
  gg.controller = p;
  ps.gigs.push(id);
  return id;
}

export async function play(g: Game, p: PlayerId, c: CardInst) {
  await g.playFromHand(p, c.uid);
  await g.resolvePending();
}

export const pickTag = (tag: string, i: number | ((d: Decision) => number)): Hook => (d) => (d.tag === tag ? (typeof i === 'number' ? i : i(d)) : undefined);
export const optionIndex = (d: Decision, pred: (label: string) => boolean) => d.options.findIndex((o) => pred(o.label));
