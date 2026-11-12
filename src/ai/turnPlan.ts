// BOT-5: planning across the actions of a turn (HeuristicOptions.turnPlan, docs/BOT_TOOLKIT.md §5). The main-phase
// screen scores each action right after it resolves, so a line whose first step looks bad alone (a fight trick before the
// attack it arms, paying to ready before attacking, the order of attacks into blockers) is never found. The planner
// searches sequences of the deciding player's own actions for the rest of this turn in one hidden-information world
// (the same world the 1-ply screen uses), and gives each first action the value of the best sequence that starts with it.
//
// Search: every first action is played (depth 1, the 1-ply screen's own value); every depth-1 position is expanded
// (depth 2); deeper levels expand a beam of the best positions by evaluation. States reached by different orders are
// merged (a canonical key of the state's relevant parts), so the search is over a DAG and a position's value is the best
// evaluation reachable from it (stopping is always allowed). A node budget bounds the work: one node = one clone plus
// one action played, merged states included. Deterministic: no clock, no randomness of its own.
import { GameOverSignal, type Game } from '../engine/engine';
import type { Action, PlayerId } from '../engine/types';

export interface TurnPlanOptions {
  /** longest sequence searched (actions); 1 = the 1-ply screen */
  depth: number;
  /** most nodes (clone + action) per decision */
  nodes: number;
  /** positions expanded per level from depth 3 on */
  beam: number;
}

/** Hooks into the deciding bot: how it clones, scores and filters, so the planner sees exactly what the screen sees. */
export interface TurnPlanHooks {
  /** a copy of the real game, hidden information re-dealt for the decider (the screen's world) */
  root(): Game;
  /** a copy of a search position with the play-out agents (no re-deal) */
  child(cg: Game): Game;
  /** the evaluation of a position for the decider */
  value(cg: Game): number;
  /** the actions to search from a position below the root (never pass) */
  expand(cg: Game): Action[];
}

export interface TurnPlanResult {
  /** per root candidate (in the order passed), the best value of a sequence starting with it */
  values: number[];
  /** per root candidate, the position right after it (the 1-ply value) */
  own: number[];
  /** the best sequence found (first action first) and its value; null without candidates */
  best: { line: Action[]; v: number } | null;
  /** nodes used (clone + action), merged positions counted */
  nodes: number;
  /** nodes that reached a position already found by another order */
  merged: number;
  /** deepest level reached */
  depth: number;
  /** the best candidate by plan value (ties broken by the 1-ply value) is not the best by its own 1-ply value */
  changed: boolean;
}

interface Node {
  v: number;
  /** the position, while it may still be expanded */
  cg: Game | null;
  children: Edge[];
  bestV?: number;
  bestEdge?: Edge | null;
}
interface Edge {
  action: Action;
  node: Node;
}

/** A canonical key of the parts of a position the rest of the turn depends on (ids of mods and the turn's history left out). */
export function positionKey(g: Game): string {
  const s = g.s;
  const sorted = (xs: readonly number[]) => [...xs].sort((a, b) => a - b);
  const players = s.players.map((P) => [sorted(P.hand), sorted(P.field), P.legends, sorted(P.eddies), sorted(P.trash), sorted(P.removed), P.deck.length, P.fixer, sorted(P.gigs)]);
  const cards: unknown[] = [];
  for (const P of s.players)
    for (const u of [...sorted(P.field), ...P.legends, ...sorted(P.eddies)]) {
      const c = s.cards[u];
      cards.push([u, c.defId, c.controller, +c.spent, +c.faceUp, +c.lag, c.gear, c.host, +c.goSolo, +!!c.known]);
    }
  const gigs = Object.values(s.gigs).map((x) => [x.id, x.value, x.controller]);
  const mods = s.mods.map((m) => JSON.stringify({ ...m, id: 0 })).sort();
  return JSON.stringify([s.active, s.phase, s.winner, s.overtime, players, cards, gigs, mods, Object.keys(s.once).sort(), s.counters, s.attack]);
}

/** Search the rest of p's turn; `cands` are the root actions to value. Values come back in the order of `cands`. */
export async function planTurn(p: PlayerId, cands: readonly Action[], hooks: TurnPlanHooks, o: TurnPlanOptions): Promise<TurnPlanResult> {
  const seen = new Map<string, Node>();
  let nodes = 0;
  let merged = 0;
  const open = (cg: Game) => cg.s.winner === null && cg.s.phase === 'main' && cg.s.active === p && !cg.s.attack;
  /** play `a` in a copy of `from`; a position already found returns its node */
  const visit = async (from: Game, a: Action): Promise<{ node: Node; fresh: boolean }> => {
    nodes++;
    const cg = hooks.child(from);
    try {
      await cg.doAction(p, a);
      await cg.resolvePending();
      cg.checkState();
    } catch (e) {
      if (!(e instanceof GameOverSignal)) throw e;
    }
    const key = positionKey(cg);
    const old = seen.get(key);
    if (old) {
      merged++;
      return { node: old, fresh: false };
    }
    const node: Node = { v: hooks.value(cg), cg: open(cg) ? cg : null, children: [] };
    seen.set(key, node);
    return { node, fresh: true };
  };
  const root = hooks.root();
  // depth 1: every root candidate, valued as the 1-ply screen values it (same world, same play-out agents)
  const first: Edge[] = [];
  let level: Node[] = [];
  for (const action of cands) {
    const { node, fresh } = await visit(root, action);
    first.push({ action, node });
    if (fresh && node.cg) level.push(node);
  }
  let depth = 1;
  for (let d = 2; d <= o.depth && level.length && nodes < o.nodes; d++) {
    // depth 2 expands every depth-1 position (the point: a first step that looks weak alone); deeper levels a beam
    const expand = [...level].sort((x, y) => y.v - x.v).slice(0, d === 2 ? level.length : o.beam);
    const next: Node[] = [];
    for (const n of expand) {
      if (nodes >= o.nodes) break;
      depth = d;
      for (const action of hooks.expand(n.cg!)) {
        if (nodes >= o.nodes) break;
        const { node, fresh } = await visit(n.cg!, action);
        n.children.push({ action, node });
        if (fresh && node.cg) next.push(node);
      }
    }
    for (const n of level) n.cg = null; // expanded or cut: no longer needed
    level = next;
  }
  const best = (n: Node): number => {
    if (n.bestV !== undefined) return n.bestV;
    n.bestV = n.v;
    n.bestEdge = null;
    for (const e of n.children) {
      const v = best(e.node);
      if (v > n.bestV) {
        n.bestV = v;
        n.bestEdge = e;
      }
    }
    return n.bestV;
  };
  const values = first.map((e) => best(e.node));
  let top: { line: Action[]; v: number } | null = null;
  first.forEach((e, i) => {
    if (top && values[i] <= top.v) return;
    const line: Action[] = [e.action];
    for (let x = e.node.bestEdge; x; x = x.node.bestEdge ?? null) line.push(x.action);
    top = { line, v: values[i] };
  });
  const argmax = (xs: number[]) => xs.reduce((b, x, i) => (x > xs[b] ? i : b), 0);
  const own = first.map((e) => e.node.v);
  // as the bot ranks them (heuristic.ts planValues): the plan's value, ties broken by the 1-ply value
  const changed = first.length > 0 && argmax(values.map((v, i) => 0.95 * v + 0.05 * own[i])) !== argmax(own);
  return { values, own, best: top, nodes, merged, depth, changed };
}
