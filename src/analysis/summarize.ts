// Turn a traced game into a compact per-player summary (what analysis aggregates).
import type { GameState, PlayerId } from '../engine/types';

export interface PlayerSummary {
  deck: string;
  opp: string;
  first: boolean;
  result: 1 | 0 | 0.5; // win / loss / tie
  mulligan: boolean;
  opening: string[]; // final opening hand (after mulligan)
  seen: string[]; // unique card ids in the kept opening hand or drawn later (a mulliganed-away hand doesn't count)
  played: Record<string, number>; // id -> first turn played (own-turn index: 1,2,3...)
  playCount: Record<string, number>;
  sold: Record<string, number>;
  calls: { id: string; turn: number; how: string }[];
  solos: string[];
  attacksGigs: number;
  attacksUnits: number;
  firstAttackTurn: number | null; // own-turn index
  steals: Record<string, number>; // attacker id -> gigs stolen
  lost: Record<string, number>; // own units defeated
  gigsAfterOwnTurn: number[]; // my gig count at end of each of my turns
  diffAfterOwnTurn: number[]; // my gigs - rival gigs at end of each of my turns
  turns: number;
  overtime: boolean;
  reason: string;
}

export function summarize(s: GameState): [PlayerSummary, PlayerSummary] {
  const tr = s.trace ?? [];
  const out = ([0, 1] as PlayerId[]).map((p) => {
    const me: PlayerSummary = {
      deck: s.players[p].name,
      opp: s.players[1 - p].name,
      first: s.first === p,
      result: s.winner === 'tie' || s.winner === null ? 0.5 : s.winner === p ? 1 : 0,
      mulligan: false,
      opening: [],
      seen: [],
      played: {},
      playCount: {},
      sold: {},
      calls: [],
      solos: [],
      attacksGigs: 0,
      attacksUnits: 0,
      firstAttackTurn: null,
      steals: {},
      lost: {},
      gigsAfterOwnTurn: [],
      diffAfterOwnTurn: [],
      turns: s.turn,
      overtime: s.overtime,
      reason: s.winReason,
    };
    return me;
  }) as [PlayerSummary, PlayerSummary];
  const seen: [Set<string>, Set<string>] = [new Set(), new Set()];
  // own-turn index: global turn t for player p -> 1-based count of p's turns
  const ownIdx = (t: number, p: PlayerId) => (p === s.first ? Math.ceil(t / 2) : Math.floor(t / 2));
  for (const e of tr) {
    const m = out[e.p];
    switch (e.k) {
      case 'mulligan':
        // the engine logs the first hand as 'open', then 'mulligan' and the new hand as 'open' (before any draw or play):
        // the shuffled-back cards were never kept, so they don't count as seen
        m.mulligan = true;
        m.opening = [];
        seen[e.p].clear();
        break;
      case 'open':
        m.opening.push(e.id!);
        seen[e.p].add(e.id!);
        break;
      case 'draw':
        seen[e.p].add(e.id!);
        break;
      case 'play': {
        const i = ownIdx(e.t, e.p);
        if (m.played[e.id!] === undefined) m.played[e.id!] = i;
        m.playCount[e.id!] = (m.playCount[e.id!] ?? 0) + 1;
        if (e.x === 'hand') seen[e.p].add(e.id!);
        break;
      }
      case 'sell':
        m.sold[e.id!] = (m.sold[e.id!] ?? 0) + 1;
        break;
      case 'call':
        m.calls.push({ id: e.id!, turn: e.t, how: String(e.x) });
        break;
      case 'solo':
        m.solos.push(e.id!);
        break;
      case 'attack':
        if (e.x === 'gigs') m.attacksGigs++;
        else m.attacksUnits++;
        if (m.firstAttackTurn === null) m.firstAttackTurn = ownIdx(e.t, e.p);
        break;
      case 'steal':
        if (e.id) m.steals[e.id] = (m.steals[e.id] ?? 0) + 1;
        break;
      case 'defeated':
        m.lost[e.id!] = (m.lost[e.id!] ?? 0) + 1;
        break;
      case 'turnEnd': {
        const [a, b] = String(e.x).split('-').map(Number);
        const mine = e.p === 0 ? a : b;
        const theirs = e.p === 0 ? b : a;
        m.gigsAfterOwnTurn.push(mine);
        m.diffAfterOwnTurn.push(mine - theirs);
        break;
      }
    }
  }
  out[0].seen = [...seen[0]];
  out[1].seen = [...seen[1]];
  return out;
}
