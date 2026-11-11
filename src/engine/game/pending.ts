// Pending effects and events: triggers become pending effects, which resolve in rule order (10.12-10.14); delayed
// triggers are 'delayed' mods. effectMatters probes an effect on a throwaway copy to tell whether its order matters.
import { other } from './common';
import type { Game } from '../engine';
import { CARD_BY_ID } from '../cards';
import { SCRIPTS } from '../scripts';
import { modDuration } from './mods';
import type { CardInst, EventMap, EventName, ModOf, ModUntil, Opt, PlayerId } from '../types';

/** An effect waiting to resolve (10.12). */
export interface Pending {
  player: PlayerId;
  /** names the effect and its source card (shown when its controller orders their effects) */
  label: string;
  run: () => Promise<void>;
  /** uid of the card whose text this is */
  source?: number;
  /**
   * Runs the same effect against a throwaway copy of the game, to tell whether resolving it now would do anything
   * (see effectMatters). Absent: assume it would.
   */
  probe?: (g: Game) => Promise<void>;
}

/** Event wording for pending-effect labels ("Netwatch Netdriver (on V): when spent"). */
const EVENT_TEXT: Record<EventName, string> = {
  spent: 'when spent',
  attack: 'when a Unit attacks',
  steal: 'when a Gig is stolen',
  fight: 'after a fight',
  unitDefeated: 'when a Unit is defeated',
  cardPlayed: 'when a card is played',
  blockerUsed: 'when a Blocker is used',
  gigRolled: 'when a Gig is rolled in',
  gigChanged: 'when a Gig changes',
  legendCalled: 'when a Legend is Called',
  turnEnd: 'at the end of the turn',
  turnStart: 'at the start of the turn',
};

export function enqueue(game: Game, player: PlayerId, label: string, run: () => Promise<void>, extra: { source?: number; probe?: (g: Game) => Promise<void> } = {}) {
  game.pending.push({ player, label, run, ...extra });
}

/**
 * Register a delayed trigger owned by `self` (e.g. a Program that says "the next time ... this turn").
 * The card's script must define delayed[event]. data is stored on mod.value.data.
 */
export function addDelayed(game: Game, self: CardInst, event: EventName, data: any = {}, until: ModUntil = 'endOfTurn', untilPlayer?: PlayerId): ModOf<'delayed'> {
  return game.addMod({ kind: 'delayed', player: self.controller, source: self.uid, value: { defId: self.defId, event, data }, ...modDuration(until, untilPlayer) });
}

export function emit<K extends EventName>(game: Game, name: K, ev: EventMap[K]) {
  for (const m of game.s.mods) {
    if (m.kind !== 'delayed' || m.value?.event !== name) continue;
    const fn = (SCRIPTS[m.value.defId]?.delayed as any)?.[name];
    if (!fn) continue;
    const modId = m.id;
    const resolve = async (g: Game, e: EventMap[K]) => {
      const live = g.s.mods.find((x) => x.id === modId);
      if (!live) return;
      const consumed = await fn(g, live, e);
      if (consumed) g.removeMod(modId);
    };
    const from = m.source !== undefined && game.s.cards[m.source] ? game.name(m.source) : (CARD_BY_ID[m.value.defId]?.displayName ?? m.value.defId);
    game.enqueue(m.player ?? game.s.active, `${from} (delayed): ${EVENT_TEXT[name]}`, () => resolve(game, ev), {
      source: m.source,
      probe: (cg) => resolve(cg, structuredClone(ev)),
    });
  }
  for (const src of game.sources()) {
    const fn = game.script(src.self).on?.[name] as any;
    if (fn) {
      const { self, host, controller } = src;
      const label = `${game.name(self)}${self.uid !== host.uid ? ` (on ${game.name(host)})` : ''}: ${EVENT_TEXT[name]}`;
      game.enqueue(
        controller,
        label,
        async () => {
          await fn(game, self, host, ev);
        },
        { source: self.uid, probe: async (cg) => void (await fn(cg, cg.c(self.uid), cg.c(host.uid), structuredClone(ev))) },
      );
    }
  }
}

/**
 * Resolve pending effects. The turn player resolves theirs first (10.13); once a player has started, they keep
 * resolving their own effects, including ones that become pending meanwhile, until none remain, and only then does
 * the other player resolve theirs (10.14.1). The resolving player chooses the order of their own effects (10.12):
 * an agent with `choosesOrder` is asked (see chooseNextPending); every other agent resolves them first in, first out.
 */
export async function resolvePending(game: Game) {
  const outer = game.resolving === null;
  let guard = 0;
  try {
    while (game.pending.length) {
      if (++guard > 500) {
        const labels = game.pending.slice(0, 5).map((x) => x.label).join(', ');
        game.pending = [];
        throw new Error(`resolvePending: more than 500 effects resolved in one pass (loop?): ${labels}`);
      }
      let cur = game.resolving;
      if (cur === null || !game.pending.some((x) => x.player === cur)) {
        cur = game.pending.some((x) => x.player === game.s.active) ? game.s.active : other(game.s.active);
        game.resolving = cur;
      }
      let idx = game.pending.findIndex((x) => x.player === cur);
      if (game.agents[cur]?.choosesOrder) idx = await chooseNextPending(game, cur, idx);
      const [pe] = game.pending.splice(idx, 1);
      await pe.run();
      game.checkState();
    }
  } finally {
    if (outer) game.resolving = null;
  }
}

/**
 * Rule 10.12 for an agent that opts in: which of p's pending effects resolves next. `first` is the oldest one (what
 * first-in-first-out would resolve). Asked only when the order could matter: the oldest effect would do something
 * now, and so would at least one other (effects that would do nothing are left in queue order), and they are not
 * all copies of the same effect. Option 0 is always the oldest, so answering 0 every time plays exactly like FIFO.
 */
export async function chooseNextPending(game: Game, p: PlayerId, first: number): Promise<number> {
  const mine: number[] = [];
  game.pending.forEach((x, i) => x.player === p && mine.push(i));
  if (mine.length < 2) return first;
  if (!(await effectMatters(game, game.pending[first]))) return first;
  const live = [first];
  for (const i of mine) if (i !== first && (await effectMatters(game, game.pending[i]))) live.push(i);
  if (live.length < 2 || new Set(live.map((i) => game.pending[i].label)).size < 2) return first;
  const options: Opt[] = live.map((i) => {
    const pe = game.pending[i];
    return { label: pe.label, key: 'effect', uid: pe.source };
  });
  const [k] = await game.ask({ player: p, kind: 'order', prompt: 'Your effects resolve one at a time (10.12). Resolve which first?', options, min: 1, max: 1, tag: 'order' });
  if (k !== 0) game.log(p, `resolves ${game.pending[live[k]].label} first`);
  return live[k];
}

/**
 * Would resolving this pending effect now do anything? Runs its probe on a throwaway copy of the game (no log, no
 * trace, agents that refuse to answer): it matters if it changes the state, makes anything pending, asks a question
 * or fails. Never touches this game (its RNG included).
 */
export async function effectMatters(game: Game, pe: Pending): Promise<boolean> {
  if (!pe.probe) return true;
  const cg = game.probeCopy();
  const before = JSON.stringify(cg.s);
  try {
    await pe.probe(cg);
  } catch {
    return true;
  }
  return cg.pending.length > 0 || JSON.stringify(cg.s) !== before;
}
