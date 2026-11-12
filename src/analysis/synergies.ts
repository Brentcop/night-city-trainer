// Synergy measurement (docs/SYNERGIES.md, docs/ROADMAP2.md §1 step 2): for each seat and each package of the catalogue
// (src/content/synergies) that its list contains, how many pieces were drawn, the first round the package's `online`
// condition held, how many turns it held, and the result; aggregated per list into assembled rates (beside the draw
// odds), median round online, and win rates when online versus never online, plus each member card's use split by
// "partner present" and "partner absent".
//
// Everything here is DESCRIPTIVE ASSOCIATION, like the decisions report (./decisions.ts): a package that comes online
// mostly in games that were already going well looks good for that reason alone. It is not the causal value of the
// package or of a card. Nothing in the bots, the tuner or the breeder reads it.
//
// Pipeline (same shape as the decisions report): observeSynergies(one game's records, board snapshots and sightings)
// → aggregateSynergyGame → mergeSynergyAggregates over all games → synergyReport. Workers aggregate where the game was
// played, so only counts travel.
import { CARD_BY_ID, cardLabel } from '../engine/cards';
import { listFingerprint } from '../engine/deck';
import { parseOption, type BoardSnapshot, type CardSighting, type DecisionRecord } from '../engine/telemetry';
import type { PlayerId } from '../engine/types';
import type { RunManifest } from '../lib/runManifest';
import {
  CATALOGUE_VERSION,
  conditionHolds,
  covers,
  ODDS_ROUNDS,
  roleMap,
  roleMatches,
  SYNERGIES,
  SYNERGY_BY_ID,
  synergiesIn,
  type RoleCounts,
  type SynergyBond,
  type SynergyFamily,
  type SynergyRole,
  type SynergyView,
} from '../content/synergies';
import { MIN_SLICE_GAMES, slice, wilson, type Cell, type Slice } from './decisions';

/** Bump when a field of the aggregate changes meaning or is removed. */
export const SYNERGY_AGG_SCHEMA = 1;

const roundOf = (t: number) => Math.ceil(Math.max(t, 1) / 2);

// ------------------------------------------------------------------ one game

export interface SynergyGamePlayer {
  /** PlayerState.listId (falls back to the list's fingerprint) */
  listId?: string;
  name: string;
  legends: readonly string[];
  main: readonly string[];
}
export interface SynergyGame {
  records: readonly DecisionRecord[];
  boards: readonly BoardSnapshot[];
  sightings: readonly CardSighting[];
  players: readonly [SynergyGamePlayer, SynergyGamePlayer];
  winner: PlayerId | 'tie' | null;
  /** the player who took turn 1 */
  first: PlayerId;
  /** the final global turn */
  turns: number;
}

/** One seat's view of one package in one game. */
export interface SynergyObservation {
  id: string;
  /** member copies drawn (or otherwise put in hand or play) by the end, per role; Legends count from the start */
  drawn: RoleCounts;
  /** first round by which the needed pieces were all held, or null */
  assembledRound: number | null;
  /** first round in which the online condition held, or null */
  onlineRound: number | null;
  /** global turns (yours and the rival's) in which it held at some point */
  onlineTurns: number;
  /** own turns played */
  rounds: number;
  /** 1 won, 0.5 tie, 0 lost */
  result: number;
  /** every use of a member card: its id, the turn, and whether a partner piece was present */
  uses: { id: string; t: number; partner: boolean }[];
}

/** Card uses (not sells) of player `p` by global turn, from their decision records: play, Call, Go Solo, Legend play, ability, attack, reactions. */
function usesByTurn(records: readonly DecisionRecord[], p: PlayerId): Map<number, string[]> {
  const out = new Map<number, string[]>();
  for (const r of records) {
    if (r.p !== p || (r.w !== 'main' && r.w !== 'react')) continue;
    for (const code of r.ch) {
      const o = parseOption(code);
      if (!['play', 'call', 'solo', 'legend', 'ability', 'attack', 'block'].includes(o.kind)) continue;
      const id = o.kind === 'call' && o.id === '?' ? r.res?.revealed : o.id;
      if (!id || id === '?') continue;
      const list = out.get(r.t) ?? [];
      list.push(id);
      out.set(r.t, list);
    }
  }
  return out;
}

const viewOf = (b: BoardSnapshot, used: readonly string[]): SynergyView => ({
  inPlay: [...b.units, ...b.gear, ...b.legends],
  used,
  gigs: b.gigs,
  cred: b.cred,
  opCred: b.opCred,
  gigCount: b.gigs.length,
  opGigCount: b.opGigs,
  equipped: b.equipped,
  legendsUp: b.legendsUp,
  trash: b.trash,
  handCosts: b.handCosts,
  trashCards: b.trashCards,
});

/** Own turns player p played by global turn T. */
const roundsPlayed = (p: PlayerId, first: PlayerId, T: number) => (p === first ? Math.ceil(T / 2) : Math.floor(T / 2));

/** Each seat's observations, one per package its list contains. Pure. */
export function observeSynergies(game: SynergyGame): [SynergyObservation[], SynergyObservation[]] {
  const result = (p: PlayerId) => (game.winner === 'tie' || game.winner === null ? 0.5 : game.winner === p ? 1 : 0);
  const seat = (p: PlayerId): SynergyObservation[] => {
    const deck = game.players[p];
    const used = usesByTurn(game.records, p);
    const boards = game.boards.filter((b) => b.p === p);
    const boardsAt = new Map<number, BoardSnapshot[]>();
    for (const b of boards) {
      const list = boardsAt.get(b.t) ?? [];
      list.push(b);
      boardsAt.set(b.t, list);
    }
    const sightings = game.sightings.filter((s) => s.p === p);
    // the turn each own Legend was first face-up (Legends area or field)
    const legendUp = new Map<string, number>();
    for (const b of boards) for (const id of [...b.legends, ...b.units]) if (deck.legends.includes(id) && !legendUp.has(id)) legendUp.set(id, b.t);
    const out: SynergyObservation[] = [];
    for (const ls of synergiesIn({ legends: [...deck.legends], main: [...deck.main] })) {
      const s = ls.synergy;
      const roles = roleMap(s);
      // pieces held by turn: Legends from the start, main-deck members when first seen
      const timeline = sightings.filter((x) => roles.has(x.id)).sort((a, b) => a.t - b.t);
      const drawn: RoleCounts = { ...ls.legends };
      let assembledRound: number | null = covers(drawn, s.needs) ? 1 : null;
      for (const x of timeline) {
        drawn[roles.get(x.id)!]++;
        if (assembledRound === null && covers(drawn, s.needs)) assembledRound = roundOf(x.t);
      }
      // online by turn
      let onlineRound: number | null = null;
      let onlineTurns = 0;
      for (let t = 1; t <= game.turns; t++) {
        const u = used.get(t) ?? [];
        const held = (boardsAt.get(t) ?? []).some((b) => conditionHolds(s.online, viewOf(b, u), roles));
        if (!held) continue;
        onlineTurns++;
        onlineRound ??= roundOf(t);
      }
      // member uses, with or without a partner piece present at that turn
      const partnerAt = (id: string, t: number): boolean => {
        const role = roles.get(id)!;
        const isPartner = (r: SynergyRole) =>
          role === 'enabler' ? roleMatches(r, ['payoff']) : role === 'payoff' ? roleMatches(r, ['enabler']) : true;
        let n = 0;
        for (const x of timeline) if (x.t <= t && isPartner(roles.get(x.id)!)) n++;
        for (const lid of deck.legends) {
          const r = roles.get(lid);
          const up = legendUp.get(lid);
          if (r && isPartner(r) && up !== undefined && up <= t) n++;
        }
        // a `both` or `piece` card is itself one of the pieces counted: it needs another
        return role === 'both' || role === 'piece' ? n >= 2 : n >= 1;
      };
      const uses: SynergyObservation['uses'] = [];
      for (const [t, ids] of used) for (const id of ids) if (roles.has(id)) uses.push({ id, t, partner: partnerAt(id, t) });
      out.push({ id: s.id, drawn, assembledRound, onlineRound, onlineTurns, rounds: roundsPlayed(p, game.first, game.turns), result: result(p), uses });
    }
    return out;
  };
  return [seat(0), seat(1)];
}

// ------------------------------------------------------------------ aggregate (plain counts, mergeable)

export interface RoundCounts {
  /** games in which the player reached this round (played their Nth turn) */
  reached: number;
  /** of those, games with the needed pieces held by then */
  assembled: number;
  /** of those, games in which it had been online by then */
  online: number;
}
export interface SynergyAgg {
  games: number;
  wins: number;
  /** games with the needed pieces held at some point; `uses` is unused (0) */
  assembled: Cell;
  /** games in which the online condition held at least once, and games in which it never did */
  online: Cell;
  never: Cell;
  /** first round online → games */
  firstOnline: Record<string, number>;
  /** turns online, summed over the online games */
  heldTurns: number;
  byRound: Record<string, RoundCounts>;
  /** member copies drawn, summed per role */
  drawn: RoleCounts;
  /** per member card: uses (games once per slice) with a partner present and absent */
  cards: Record<string, { present: Cell; absent: Cell }>;
}
export interface SynergyDeckAgg {
  listId: string;
  name: string;
  games: number;
  wins: number;
  /** what the list holds of each package (from the catalogue; the same for every game of the list) */
  lists: Record<string, { copies: RoleCounts; builtAround: boolean; odds: Record<string, number> }>;
  synergies: Record<string, SynergyAgg>;
}
export interface SynergyAggregate {
  schema: number;
  /** CATALOGUE_VERSION of the catalogue the games were observed with */
  catalogue: string;
  games: number;
  decks: Record<string, SynergyDeckAgg>;
}

const cell = (): Cell => ({ uses: 0, games: 0, wins: 0 });
export const emptySynergyAggregate = (): SynergyAggregate => ({ schema: SYNERGY_AGG_SCHEMA, catalogue: CATALOGUE_VERSION, games: 0, decks: {} });
const emptyRounds = (): Record<string, RoundCounts> => Object.fromEntries(ODDS_ROUNDS.map((r) => [String(r), { reached: 0, assembled: 0, online: 0 }]));

/** Aggregate one finished game. Pure: the same inputs give the same counts. */
export function aggregateSynergyGame(game: SynergyGame): SynergyAggregate {
  const agg = emptySynergyAggregate();
  agg.games = 1;
  const obs = observeSynergies(game);
  for (const p of [0, 1] as PlayerId[]) {
    const pl = game.players[p];
    const listId = pl.listId ?? listFingerprint({ legends: [...pl.legends], main: [...pl.main] });
    const deck: SynergyDeckAgg = { listId, name: pl.name, games: 1, wins: game.winner === 'tie' || game.winner === null ? 0.5 : game.winner === p ? 1 : 0, lists: {}, synergies: {} };
    for (const ls of synergiesIn({ legends: [...pl.legends], main: [...pl.main] }))
      deck.lists[ls.synergy.id] = { copies: ls.copies, builtAround: ls.builtAround, odds: Object.fromEntries(ls.odds.map((o) => [String(o.round), o.p])) };
    for (const o of obs[p]) {
      const won = (c: Cell) => ({ uses: c.uses, games: 1, wins: o.result });
      const a: SynergyAgg = {
        games: 1,
        wins: o.result,
        assembled: o.assembledRound !== null ? won(cell()) : cell(),
        online: o.onlineRound !== null ? won(cell()) : cell(),
        never: o.onlineRound === null ? won(cell()) : cell(),
        firstOnline: o.onlineRound !== null ? { [String(o.onlineRound)]: 1 } : {},
        heldTurns: o.onlineTurns,
        byRound: emptyRounds(),
        drawn: { ...o.drawn },
        cards: {},
      };
      for (const r of ODDS_ROUNDS) {
        const rc = a.byRound[String(r)];
        if (!rc || o.rounds < r) continue;
        rc.reached = 1;
        if (o.assembledRound !== null && o.assembledRound <= r) rc.assembled = 1;
        if (o.onlineRound !== null && o.onlineRound <= r) rc.online = 1;
      }
      for (const u of o.uses) {
        const c = (a.cards[u.id] ??= { present: cell(), absent: cell() });
        const x = u.partner ? c.present : c.absent;
        x.uses++;
        x.games = 1;
        x.wins = o.result;
      }
      deck.synergies[o.id] = a;
    }
    agg.decks[listId] = agg.decks[listId] ? mergeDeck(agg.decks[listId]!, deck) : deck;
  }
  return agg;
}

const addCell = (a: Cell, b: Cell): Cell => ({ uses: a.uses + b.uses, games: a.games + b.games, wins: a.wins + b.wins });
const addRoles = (a: RoleCounts, b: RoleCounts): RoleCounts => ({ enabler: a.enabler + b.enabler, payoff: a.payoff + b.payoff, both: a.both + b.both, piece: a.piece + b.piece });
function addCounts(a: Record<string, number>, b: Record<string, number>): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}
function mergeSyn(a: SynergyAgg, b: SynergyAgg): SynergyAgg {
  const byRound: Record<string, RoundCounts> = {};
  for (const k of new Set([...Object.keys(a.byRound), ...Object.keys(b.byRound)])) {
    const x = a.byRound[k] ?? { reached: 0, assembled: 0, online: 0 };
    const y = b.byRound[k] ?? { reached: 0, assembled: 0, online: 0 };
    byRound[k] = { reached: x.reached + y.reached, assembled: x.assembled + y.assembled, online: x.online + y.online };
  }
  const cards: SynergyAgg['cards'] = { ...a.cards };
  for (const [id, c] of Object.entries(b.cards)) {
    const x = cards[id];
    cards[id] = x ? { present: addCell(x.present, c.present), absent: addCell(x.absent, c.absent) } : c;
  }
  return {
    games: a.games + b.games,
    wins: a.wins + b.wins,
    assembled: addCell(a.assembled, b.assembled),
    online: addCell(a.online, b.online),
    never: addCell(a.never, b.never),
    firstOnline: addCounts(a.firstOnline, b.firstOnline),
    heldTurns: a.heldTurns + b.heldTurns,
    byRound,
    drawn: addRoles(a.drawn, b.drawn),
    cards,
  };
}
function mergeDeck(a: SynergyDeckAgg, b: SynergyDeckAgg): SynergyDeckAgg {
  const synergies: SynergyDeckAgg['synergies'] = { ...a.synergies };
  for (const [id, s] of Object.entries(b.synergies)) {
    const x = synergies[id];
    synergies[id] = x ? mergeSyn(x, s) : s;
  }
  return { listId: a.listId, name: a.name, games: a.games + b.games, wins: a.wins + b.wins, lists: { ...b.lists, ...a.lists }, synergies };
}

/** Sum aggregates (per-game ones from workers, or partial runs). Pure; inputs are not changed. */
export function mergeSynergyAggregates(...aggs: SynergyAggregate[]): SynergyAggregate {
  const out = emptySynergyAggregate();
  for (const a of aggs) {
    if (a.schema !== SYNERGY_AGG_SCHEMA) throw new Error(`synergy aggregate has schema ${a.schema}; this code reads ${SYNERGY_AGG_SCHEMA}`);
    if (a.catalogue !== out.catalogue) throw new Error(`synergy aggregate was made with catalogue ${a.catalogue}; this code has ${out.catalogue}`);
    out.games += a.games;
    for (const [k, d] of Object.entries(a.decks)) out.decks[k] = out.decks[k] ? mergeDeck(out.decks[k]!, d) : d;
  }
  return out;
}

// ------------------------------------------------------------------ report

export interface RateWithInterval {
  rate: number | null;
  low95: number | null;
  high95: number | null;
  /** numerator / denominator */
  n: number;
  of: number;
}
function rate(n: number, of: number): RateWithInterval {
  if (of <= 0) return { rate: null, low95: null, high95: null, n, of };
  const w = wilson(n, of);
  return { rate: n / of, low95: w.low, high95: w.high, n, of };
}

export interface SynergyCardRow {
  id: string;
  name: string;
  role: SynergyRole;
  /** win rate in games where the card was used with a partner piece present / with none (games once per slice) */
  present: Slice;
  absent: Slice;
}
export interface SynergyRow {
  id: string;
  name: string;
  family: SynergyFamily;
  bond: SynergyBond;
  /** copies per role in the list (absent for the pooled rows) */
  copies?: RoleCounts;
  builtAround?: boolean;
  games: number;
  /** share of games with the needed pieces held at some point, and the win rate in those games */
  assembledRate: RateWithInterval;
  assembled: Slice;
  /** by own turn N: games that reached it, observed share assembled (and online) by then, and the draw odds */
  byRound: { round: number; reached: number; assembled: RateWithInterval; online: RateWithInterval; expected: number | null }[];
  /** share of games online at least once */
  onlineRate: RateWithInterval;
  /** win rate in games online at least once, and in games never online */
  online: Slice;
  never: Slice;
  /** online minus never, in win-rate points, when neither slice is thin */
  gap: number | null;
  medianRound: number | null;
  /** turns online per online game (yours and the rival's) */
  meanTurnsOnline: number | null;
  /** member copies drawn per game, by role */
  meanDrawn: Record<SynergyRole, number>;
  cards: SynergyCardRow[];
}
export interface SynergyDeckReport {
  listId: string;
  name: string;
  games: number;
  winRate: number;
  synergies: SynergyRow[];
}
export interface SynergyReport {
  kind: 'synergy-report';
  reportSchema: 1;
  aggregateSchema: number;
  catalogueVersion: string;
  note: string;
  minSliceGames: number;
  rounds: readonly number[];
  games: number;
  manifest?: RunManifest;
  measurements?: Record<string, number>;
  decks: SynergyDeckReport[];
  /** every list pooled per package (more games per slice, different decks mixed; no draw odds). Dormant packages are left out */
  pooled: SynergyRow[];
  /** the catalogue's dormant packages, kept out of the tables above: why, and the player-games that held one anyway */
  dormant?: { id: string; name: string; reason: string; games: number }[];
}

const REPORT_NOTE =
  'Association, not causal value: rates in games where a package was assembled or came online, with 95% Wilson intervals. A package that comes online mostly in games already going well looks good for that reason alone. Draw odds count the opening 6 plus one card per turn, with Legends held from the start; observed rates also include extra draws and searches.';

function median(hist: Record<string, number>): number | null {
  const entries = Object.entries(hist)
    .map(([k, v]) => [Number(k), v] as const)
    .sort((a, b) => a[0] - b[0]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  if (!total) return null;
  let seen = 0;
  for (const [k, v] of entries) {
    seen += v;
    if (seen * 2 >= total) return k;
  }
  return null;
}

function row(id: string, a: SynergyAgg, minGames: number, list?: SynergyDeckAgg['lists'][string]): SynergyRow {
  const s = SYNERGY_BY_ID[id];
  const roles = s ? roleMap(s) : new Map<string, SynergyRole>();
  const online = slice(a.online, minGames);
  const never = slice(a.never, minGames);
  const g = Math.max(1, a.games);
  const out: SynergyRow = {
    id,
    name: s?.name ?? id,
    family: s?.family ?? 'tempo',
    bond: s?.bond ?? 'helps',
    games: a.games,
    assembledRate: rate(a.assembled.games, a.games),
    assembled: slice(a.assembled, minGames),
    byRound: ODDS_ROUNDS.map((r) => {
      const rc = a.byRound[String(r)] ?? { reached: 0, assembled: 0, online: 0 };
      return { round: r, reached: rc.reached, assembled: rate(rc.assembled, rc.reached), online: rate(rc.online, rc.reached), expected: list?.odds[String(r)] ?? null };
    }),
    onlineRate: rate(a.online.games, a.games),
    online,
    never,
    gap: online.winRate !== null && never.winRate !== null ? online.winRate - never.winRate : null,
    medianRound: median(a.firstOnline),
    meanTurnsOnline: a.online.games ? a.heldTurns / a.online.games : null,
    meanDrawn: { enabler: a.drawn.enabler / g, payoff: a.drawn.payoff / g, both: a.drawn.both / g, piece: a.drawn.piece / g },
    cards: Object.entries(a.cards)
      .map(([cid, c]) => ({ id: cid, name: CARD_BY_ID[cid] ? cardLabel(CARD_BY_ID[cid]!) : cid, role: roles.get(cid) ?? 'piece', present: slice(c.present, minGames), absent: slice(c.absent, minGames) }))
      .sort((x, y) => y.present.games + y.absent.games - (x.present.games + x.absent.games) || x.name.localeCompare(y.name)),
  };
  if (list) {
    out.copies = list.copies;
    out.builtAround = list.builtAround;
  }
  return out;
}

/** Turn an aggregate into the report: rates with intervals, thin slices flagged; decks by games then name. */
export function synergyReport(agg: SynergyAggregate, o: { manifest?: RunManifest; measurements?: Record<string, number>; minGames?: number } = {}): SynergyReport {
  const minGames = o.minGames ?? MIN_SLICE_GAMES;
  const decks = Object.values(agg.decks)
    .map(
      (d): SynergyDeckReport => ({
        listId: d.listId,
        name: d.name,
        games: d.games,
        winRate: d.games ? d.wins / d.games : 0,
        synergies: Object.entries(d.synergies)
          .filter(([id]) => !SYNERGY_BY_ID[id]?.dormant)
          .map(([id, a]) => row(id, a, minGames, d.lists[id]))
          .sort((x, y) => Number(!!y.builtAround) - Number(!!x.builtAround) || y.games - x.games || x.name.localeCompare(y.name)),
      }),
    )
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  const pooled: Record<string, SynergyAgg> = {};
  for (const d of Object.values(agg.decks)) for (const [id, a] of Object.entries(d.synergies)) pooled[id] = pooled[id] ? mergeSyn(pooled[id]!, a) : a;
  const out: SynergyReport = {
    kind: 'synergy-report',
    reportSchema: 1,
    aggregateSchema: agg.schema,
    catalogueVersion: agg.catalogue,
    note: REPORT_NOTE,
    minSliceGames: minGames,
    rounds: ODDS_ROUNDS,
    games: agg.games,
    decks,
    pooled: Object.entries(pooled)
      .filter(([id]) => !SYNERGY_BY_ID[id]?.dormant)
      .map(([id, a]) => row(id, a, minGames))
      .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name)),
    dormant: SYNERGIES.filter((s) => s.dormant).map((s) => ({ id: s.id, name: s.name, reason: s.dormant!.reason, games: pooled[s.id]?.games ?? 0 })),
  };
  if (o.manifest) out.manifest = o.manifest;
  if (o.measurements) out.measurements = o.measurements;
  return out;
}

// ------------------------------------------------------------------ markdown summary

const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
function sliceText(s: Slice): string {
  if (s.games === 0) return '—';
  if (s.thin) return `n=${s.games} (thin)`;
  return `${pct(s.winRate)} (${Math.round(s.low95! * 100)}–${Math.round(s.high95! * 100)}) n=${s.games}`;
}
const rateText = (r: RateWithInterval) => (r.rate === null ? '—' : `${pct(r.rate)} (${r.n}/${r.of})`);
const roleText = (c: RoleCounts) =>
  (['enabler', 'payoff', 'both', 'piece'] as const)
    .filter((k) => c[k])
    .map((k) => `${c[k]} ${k}`)
    .join(', ');

/** A readable summary: the packages pooled, then per list. */
export function synergyMarkdown(r: SynergyReport): string {
  const L: string[] = [
    '# Synergy packages',
    '',
    `${r.games} game${r.games === 1 ? '' : 's'}.${r.manifest ? ` Sim v${r.manifest.simVersion}, ${r.manifest.bot.level} bot, seed ${r.manifest.seedBase}.` : ''} Catalogue ${r.catalogueVersion}.`,
    '',
    `> ${r.note} A slice from fewer than ${r.minSliceGames} games shows only its count ("thin"): not rated.`,
    '',
    '"Assembled": the needed pieces were held (drawn, or a Legend in the list) at some point. "Online": the package’s board condition held at some point (src/content/synergies). Rounds are your own turns.',
    '',
  ];
  if (r.measurements) L.push(`Measured: ${Object.entries(r.measurements).map(([k, v]) => `${k} ${Number.isInteger(v) ? v : v.toFixed(1)}`).join(', ')}.`, '');
  const head = `| Package | Games | Assembled | ${r.rounds.map((n) => `By round ${n}: held (odds) / online`).join(' | ')} | Online at all | Median round | Won when online | Won when never online | Gap |`;
  const sep = `|---|---|---|${r.rounds.map(() => '---').join('|')}|---|---|---|---|---|`;
  const line = (x: SynergyRow) =>
    `| ${x.name}${x.builtAround ? ' **(built around)**' : ''}${x.copies ? ` [${roleText(x.copies)}]` : ''} | ${x.games} | ${rateText(x.assembledRate)} | ${x.byRound
      .map((b) => `${pct(b.assembled.rate)}${b.expected !== null ? ` (${pct(b.expected)})` : ''} / ${pct(b.online.rate)} n=${b.reached}`)
      .join(' | ')} | ${rateText(x.onlineRate)} | ${x.medianRound ?? '—'} | ${sliceText(x.online)} | ${sliceText(x.never)} | ${x.gap === null ? '—' : `${x.gap >= 0 ? '+' : ''}${Math.round(x.gap * 100)}`} |`;
  L.push('## Every list pooled', '', 'Player-games of every list that holds the package, mixed together.', '', head, sep, ...r.pooled.map(line), '');
  if (r.dormant?.length)
    L.push(
      '## Dormant packages (not in any library deck)',
      '',
      'Kept in the catalogue but left out of the tables, the builders and the bots’ scoring.',
      '',
      ...r.dormant.map((d) => `- ${d.name} (\`${d.id}\`): ${d.reason}${d.games ? ` Held in ${d.games} player-games.` : ''}`),
      '',
    );
  for (const d of r.decks) {
    L.push(`## ${d.name} — ${d.games} games, ${pct(d.winRate)} won`, '', head, sep, ...d.synergies.map(line), '');
    const cards = d.synergies.flatMap((s) => s.cards.filter((c) => c.present.games + c.absent.games > 0).map((c) => ({ s, c })));
    if (cards.length) {
      L.push('| Package | Card | Role | Won when used with a partner present | Won when used with no partner |', '|---|---|---|---|---|');
      for (const { s, c } of cards) L.push(`| ${s.name} | ${c.name} | ${c.role} | ${sliceText(c.present)} | ${sliceText(c.absent)} |`);
      L.push('');
    }
  }
  return L.join('\n');
}
