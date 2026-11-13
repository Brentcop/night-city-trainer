// Decisions: every question to an agent goes through ask(), where telemetry observes it.
import type { Game } from '../engine';
import type { Action, CardInst, Decision, Intent, Opt, PlayerId } from '../types';

export async function ask(game: Game, d: Decision): Promise<number[]> {
  if (d.options.length === 0) return [];
  game.update();
  const rec = game.telemetry?.open(game, d);
  const r = await game.agents[d.player].decide(game, d);
  if (!Array.isArray(r) || r.some((i) => i < 0 || i >= d.options.length)) {
    throw new Error(`Agent ${game.agents[d.player].name} returned invalid choice ${JSON.stringify(r)} for ${d.prompt}`);
  }
  if (rec) game.telemetry!.close(game, d, rec, r);
  return r;
}

export async function yesNo(game: Game, p: PlayerId, prompt: string, tag?: string, source?: number): Promise<boolean> {
  const [i] = await game.ask({
    player: p,
    kind: 'yesno',
    prompt,
    options: [
      { label: 'Yes', key: 'yes' },
      { label: 'No', key: 'no' },
    ],
    min: 1,
    max: 1,
    tag,
    source,
  });
  return i === 0;
}

export async function chooseUnit(game: Game, p: PlayerId, cands: CardInst[], prompt: string, opts: { optional?: boolean; intent?: Intent; tag?: string; source?: number } = {},): Promise<CardInst | null> {
  if (!cands.length) return null;
  const options: Opt[] = cands.map((c) => ({
    label:
      c.zone === 'legends' && !c.faceUp && !c.known
        ? `Face-down Legend (slot ${game.P(c.controller).legends.indexOf(c.uid) + 1})`
        : `${c.controller === p ? '' : 'Rival '}${game.name(c)} (${game.power(c)})${c.spent ? ' [spent]' : ''}`,
    uid: c.uid,
  }));
  if (opts.optional) options.push({ label: 'None', key: 'none' });
  const [i] = await game.ask({ player: p, kind: 'unit', prompt, options, min: 1, max: 1, intent: opts.intent, tag: opts.tag, source: opts.source });
  return options[i].key === 'none' ? null : game.s.cards[options[i].uid!];
}

export async function chooseCard(game: Game, p: PlayerId, uids: number[], prompt: string, optional = false, tag?: string, intent?: Intent): Promise<number | null> {
  if (!uids.length) return null;
  const options: Opt[] = uids.map((u) => ({ label: game.name(u), uid: u }));
  if (optional) options.push({ label: 'None', key: 'none' });
  const [i] = await game.ask({ player: p, kind: 'card', prompt, options, min: 1, max: 1, tag, intent });
  return options[i].key === 'none' ? null : options[i].uid!;
}

export async function chooseMode(game: Game, p: PlayerId, prompt: string, modes: string[], source?: number, tag?: string): Promise<number> {
  const [i] = await game.ask({
    player: p,
    kind: 'mode',
    prompt,
    options: modes.map((m, k) => ({ label: m, key: String(k) })),
    min: 1,
    max: 1,
    source,
    tag,
  });
  return i;
}

/**
 * The main-phase action. A single legal action is taken without asking, except ending the turn ("pass" alone) for an
 * agent with `confirmsEndTurn`: that agent is asked the ordinary 'action' decision with the one option.
 */
export async function chooseAction(game: Game, p: PlayerId, actions: Action[]): Promise<Action> {
  if (actions.length === 1 && !(actions[0].type === 'pass' && game.agents[p]?.confirmsEndTurn)) return actions[0];
  const [i] = await game.ask({
    player: p,
    kind: 'action',
    prompt: 'Choose an action',
    options: actions.map((a) => ({ label: game.describeAction(a), action: a })),
    min: 1,
    max: 1,
  });
  return actions[i];
}
