// Tournament engine shared by the CLI (scripts/tournament.ts) and the in-browser runner (Tournaments → Run).
// Swiss rounds (3 match points per win, no avoidable rematches, bye to the lowest-ranked deck without one), then an optional
// single-elimination top cut seeded 1vN, 2v(N-1)… Matches are best-of-1 or best-of-3; after each game the loser goes first.
// Every game keeps its seed and seat, so any game can be replayed exactly with makeBot() on the same code (see SIM_VERSION).
import { makeTierBot, type BotChoice } from '../ai/tiers';
import { deckFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { createRunManifest, type RunManifest } from './runManifest';

/** easy | medium | hard | mixed (older events use fast | lookahead | deep). */
export type BotLevel = BotChoice | 'fast' | 'lookahead' | 'deep';

/** The bots used for tournament games. Seat A uses `seed`, seat B `seed + 7777`, same as the CLI worker. */
export function makeBot(level: string, seed: number) {
  return makeTierBot(level, seed);
}

/** Decks as they enter a game: sideboards play no part, so they are dropped (keeps replays identical everywhere). */
export const gameDeck = (d: Pick<DeckList, 'name' | 'legends' | 'main'>): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] });

/**
 * Version of the engine, bots and event rules that recorded an event. Bump when results for a seed change.
 * 2: the 2026-11 review fixes, which landed together: engine rules and card scripts, bot choices and fair hidden
 *    information, backtracking Swiss pairing and the hash-based tie-break.
 * Events without `simVersion` predate all of these and no longer replay identically.
 */
export const SIM_VERSION = 2;

/** Deterministic integer hash bit (also used for the game-1 coin flip). */
const hashBit = (x: number, shift = 16) => (Math.imul(x, 2654435761) >>> shift) & 1;

export interface GameRec {
  seed: number;
  first: 0 | 1; // 0 = deck A on the play
  winner: 0 | 1 | 'tie';
  turns: number;
  reason: string;
  /** telemetry for deck A (only when the job asked for it) */
  summary?: import('../analysis/summarize').PlayerSummary;
}
export interface MatchRec {
  a: string;
  b: string | null; // null = bye
  games: GameRec[];
  winner: string; // '' while in progress
  score: [number, number];
  live?: boolean;
}
export interface StandingRow {
  deck: string;
  mp: number;
  mw: number;
  ml: number;
  gw: number;
  gl: number;
  opps: string[];
  omw: number;
  gwp: number;
  /** extra stats for the end-of-event table */
  turns: number;
  games: number;
  playW: number;
  playG: number;
  drawW: number;
  drawG: number;
}
export interface TourneyConfig {
  name: string;
  rounds: number;
  top: number; // 0 = no top cut
  bestOf: 1 | 3;
  bot: BotLevel;
  seed: number;
}
export interface TourneyEvent {
  id: number | string;
  name?: string;
  date: string;
  bot: string;
  format: string;
  config?: TourneyConfig;
  decks: Record<string, { id?: string; file?: string; legends: string[]; main: string[] }>;
  rounds: { round: number; matches: MatchRec[] }[];
  standings: StandingRow[];
  bracket: { name: string; matches: MatchRec[] }[];
  seeds?: string[]; // top-cut seeds in rank order
  champion: string | null;
  phase?: 'swiss' | 'top' | 'done' | 'stopped';
  progress?: { games: number; estimate: number };
  /** SIM_VERSION the event was recorded with; absent on events from the earlier engine and bots. */
  simVersion?: number;
  manifest?: RunManifest;
}
export interface GameJob {
  a: DeckList;
  b: DeckList;
  seed: number;
  first: 0 | 1;
  bot: string;
  /** record telemetry and return deck A's summary */
  trace?: boolean;
}
/** Play one game (in a worker pool, a thread, or inline) and report the result. */
export type PlayGame = (job: GameJob) => Promise<GameRec>;

export function autoRounds(n: number) {
  return Math.max(1, Math.ceil(Math.log2(Math.max(2, n))) + (n > 16 ? 3 : 1));
}
/** Largest power of two ≤ requested top cut and ≤ field size. */
export function cutSize(top: number, n: number) {
  let s = 1;
  while (s * 2 <= Math.min(top, n)) s *= 2;
  return s >= 2 ? s : 0;
}
/** Standard bracket order: 1v8, 4v5, 2v7, 3v6 for 8 (indices into the seed list). */
export function bracketOrder(size: number) {
  let o = [0, 1];
  while (o.length < size) o = o.flatMap((x) => [x, o.length * 2 - 1 - x]);
  return o.slice(0, size);
}
const roundName = (alive: number) => (alive === 2 ? 'Final' : alive === 4 ? 'Semifinals' : alive === 8 ? 'Quarterfinals' : `Round of ${alive}`);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const floor3 = (x: number) => Math.max(1 / 3, x);

function computeStandings(st: Map<string, StandingRow>): StandingRow[] {
  const mwp = (s: StandingRow) => floor3(s.mw / Math.max(1, s.mw + s.ml));
  return [...st.values()]
    .map((s) => {
      const real = s.opps.filter((o) => o !== 'BYE');
      return { ...s, opps: [...s.opps], omw: real.length ? real.reduce((a, o) => a + mwp(st.get(o)!), 0) / real.length : 0, gwp: floor3(s.gw / Math.max(1, s.gw + s.gl)) };
    })
    .sort((a, b) => b.mp - a.mp || b.omw - a.omw || b.gwp - a.gwp || a.deck.localeCompare(b.deck));
}

/** Cap on search steps per pairing pass, so a pathological late round can't stall the event (deterministic). */
const SEARCH_LIMIT = 200_000;

/**
 * Swiss pairings for one round. Decks are ordered by match points (random order within a point group). A backtracking
 * search pairs the top unpaired deck with the first legal partner below it, recursing and backtracking on failure, so a
 * rematch happens only when no rematch-free matching exists. With an odd field the bye goes to the lowest-ranked deck
 * without one that still leaves a rematch-free matching; only if none does are rematches allowed (as few as possible).
 */
function swissPairings(st: Map<string, StandingRow>, r: () => number) {
  const order = [...st.values()].map((s) => ({ s, k: r() })).sort((x, y) => y.s.mp - x.s.mp || x.k - y.k).map((x) => x.s.deck);
  const met = new Map(order.map((d) => [d, new Set(st.get(d)!.opps)]));
  const hadBye = (d: string) => met.get(d)!.has('BYE');
  const rematch = (a: string, b: string) => met.get(a)!.has(b);
  // bye candidates: lowest-ranked first, decks that already had a bye only if everyone has had one
  const byeCands: (string | null)[] = order.length % 2 ? [...order].reverse().filter((d) => !hadBye(d)) : [null];
  if (!byeCands.length) byeCands.push(order[order.length - 1]);

  let steps = 0;
  /** Rematch-free perfect matching of `rest` (score order kept), or null. */
  const strict = (rest: string[]): [string, string][] | null => {
    if (!rest.length) return [];
    if (++steps > SEARCH_LIMIT) return null;
    // prune: every remaining deck must still have a legal partner
    for (const d of rest) if (!rest.some((o) => o !== d && !rematch(d, o))) return null;
    const [d, ...tail] = rest;
    for (let i = 0; i < tail.length; i++) {
      if (rematch(d, tail[i])) continue;
      const sub = strict([...tail.slice(0, i), ...tail.slice(i + 1)]);
      if (sub) return [[d, tail[i]], ...sub];
    }
    return null;
  };
  for (const bye of byeCands) {
    steps = 0;
    const pairs = strict(order.filter((d) => d !== bye));
    if (pairs) return { pairs, bye };
  }

  // No rematch-free matching: branch and bound for the fewest rematches (fresh partners tried first).
  let best: { pairs: [string, string][]; bye: string | null; cost: number } | null = null;
  const min = (rest: string[], acc: [string, string][], cost: number, bye: string | null) => {
    if (best && cost >= best.cost) return;
    if (!rest.length) {
      best = { pairs: [...acc], bye, cost };
      return;
    }
    if (++steps > SEARCH_LIMIT && best) return;
    const [d, ...tail] = rest;
    const idx = tail.map((_, i) => i);
    for (const i of [...idx.filter((i) => !rematch(d, tail[i])), ...idx.filter((i) => rematch(d, tail[i]))]) {
      acc.push([d, tail[i]]);
      min([...tail.slice(0, i), ...tail.slice(i + 1)], acc, cost + (rematch(d, tail[i]) ? 1 : 0), bye);
      acc.pop();
    }
  };
  steps = 0;
  for (const bye of byeCands) min(order.filter((d) => d !== bye), [], 0, bye);
  const b = best as unknown as { pairs: [string, string][]; bye: string | null };
  return { pairs: b.pairs, bye: b.bye };
}

export interface RunOptions {
  onUpdate?: (ev: TourneyEvent) => void;
  shouldStop?: () => boolean;
  id?: number | string;
}

/** Run a whole event. `decks` must have unique names. */
export async function runTournament(decks: (DeckList & { file?: string })[], cfg: TourneyConfig, play: PlayGame, opts: RunOptions = {}): Promise<TourneyEvent> {
  const r = rng(cfg.seed * 7919 + 13);
  const byName = new Map(decks.map((d) => [d.name, gameDeck(d)]));
  const st = new Map<string, StandingRow>(
    decks.map((d) => [d.name, { deck: d.name, mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [], omw: 0, gwp: 0, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 }]),
  );
  const cut = cutSize(cfg.top, decks.length);
  const need = cfg.bestOf === 1 ? 1 : 2;
  const avgGames = cfg.bestOf === 1 ? 1 : 2.5;
  const estimate = Math.round(cfg.rounds * Math.floor(decks.length / 2) * avgGames + Math.max(0, cut - 1) * avgGames);
  const maxGames = cfg.rounds * Math.floor(decks.length / 2) * cfg.bestOf + Math.max(0, cut - 1) * cfg.bestOf;
  const date = new Date().toISOString();
  const manifestDecks = decks.map((d) => ({ id: deckFingerprint(d), name: d.name, file: d.file }));
  const ev: TourneyEvent = {
    id: opts.id ?? cfg.seed,
    name: cfg.name,
    date,
    bot: cfg.bot,
    format: `Swiss ${cfg.rounds} round${cfg.rounds > 1 ? 's' : ''} (Bo${cfg.bestOf})${cut ? ` + top ${cut}` : ''}`,
    config: cfg,
    decks: Object.fromEntries(decks.map((d, i) => [d.name, { id: manifestDecks[i].id, file: d.file, legends: [...d.legends], main: [...d.main] }])),
    rounds: [],
    standings: computeStandings(st),
    bracket: [],
    champion: null,
    phase: 'swiss',
    progress: { games: 0, estimate },
    simVersion: SIM_VERSION,
    manifest: createRunManifest({
      runId: `tournament:${opts.id ?? cfg.seed}:${date}`,
      createdAt: date,
      purpose: 'tournament',
      simVersion: SIM_VERSION,
      rulesVersion: null,
      faqVersion: null,
      bot: { level: cfg.bot },
      decks: manifestDecks,
      field: { mode: 'swiss', deckIds: manifestDecks.map((d) => d.id) },
      sample: { plannedGames: maxGames, completedGames: 0, gamesPerPair: null },
      seedBase: cfg.seed,
      seatPolicy: 'loser-starts',
      trace: false,
    }),
  };
  const emit = () =>
    opts.onUpdate?.({
      ...ev,
      standings: ev.standings,
      rounds: [...ev.rounds],
      bracket: [...ev.bracket],
      manifest: { ...ev.manifest!, sample: { ...ev.manifest!.sample } },
    });
  const stopped = () => opts.shouldStop?.() ?? false;

  const tally = (name: string, onPlay: boolean, won: boolean, turns: number) => {
    const s = st.get(name)!;
    s.games++;
    s.turns += turns;
    if (onPlay) (s.playG++, won && s.playW++);
    else (s.drawG++, won && s.drawW++);
  };

  const playMatch = async (m: MatchRec, seedBase: number) => {
    m.live = true;
    for (let gi = 0; gi < cfg.bestOf && m.score[0] < need && m.score[1] < need; gi++) {
      if (stopped()) break;
      const prev = m.games[m.games.length - 1];
      // game 1: coin flip derived from the match seed (not the shared RNG, so parallel finishing order can't change the event)
      const first: 0 | 1 = !prev ? (hashBit(seedBase) ? 1 : 0) : prev.winner === 'tie' ? ((1 - prev.first) as 0 | 1) : ((1 - prev.winner) as 0 | 1);
      const g = await play({ a: byName.get(m.a)!, b: byName.get(m.b!)!, seed: seedBase + gi, first, bot: cfg.bot });
      m.games.push(g);
      ev.manifest!.sample.completedGames++;
      if (g.winner === 0) m.score[0]++;
      else if (g.winner === 1) m.score[1]++;
      tally(m.a, g.first === 0, g.winner === 0, g.turns);
      tally(m.b!, g.first === 1, g.winner === 1, g.turns);
      ev.progress!.games++;
      emit();
    }
    m.live = false;
    // a tied match (every game tied, or level after a tie) goes to a side picked by a hash of the match seed: game-1 seeds
    // are always even, so the old `seed % 2` always picked B. A different hash bit from the coin flip keeps it independent.
    m.winner = m.score[0] > m.score[1] ? m.a : m.score[1] > m.score[0] ? m.b! : hashBit(seedBase, 17) ? m.a : m.b!;
  };

  for (let round = 1; round <= cfg.rounds && !stopped(); round++) {
    const { pairs, bye } = swissPairings(st, r);
    const matches: MatchRec[] = pairs.map(([a, b]) => ({ a, b, games: [], winner: '', score: [0, 0] }));
    if (bye) matches.push({ a: bye, b: null, games: [], winner: bye, score: [2, 0] });
    ev.rounds.push({ round, matches });
    emit();
    const base = cfg.seed * 1_000_000 + round * 10_000;
    await Promise.all(matches.map((m, k) => (m.b ? playMatch(m, base + k * 10) : Promise.resolve())));
    if (stopped()) break;
    for (const m of matches) {
      const A = st.get(m.a)!;
      if (!m.b) {
        A.mp += 3;
        A.mw++;
        A.opps.push('BYE');
        continue;
      }
      const B = st.get(m.b)!;
      A.opps.push(m.b);
      B.opps.push(m.a);
      A.gw += m.score[0];
      A.gl += m.score[1];
      B.gw += m.score[1];
      B.gl += m.score[0];
      if (m.winner === m.a) (A.mp += 3), A.mw++, B.ml++;
      else (B.mp += 3), B.mw++, A.ml++;
    }
    ev.standings = computeStandings(st);
    emit();
  }

  if (!stopped() && cut) {
    ev.phase = 'top';
    const seeds = ev.standings.slice(0, cut).map((s) => s.deck);
    ev.seeds = seeds;
    let alive = bracketOrder(cut).map((i) => seeds[i]);
    let ri = 0;
    while (alive.length > 1 && !stopped()) {
      const matches: MatchRec[] = [];
      for (let i = 0; i < alive.length; i += 2) matches.push({ a: alive[i], b: alive[i + 1], games: [], winner: '', score: [0, 0] });
      ev.bracket.push({ name: roundName(alive.length), matches });
      emit();
      const base = cfg.seed * 1_000_000 + 900_000 + ri * 10_000;
      await Promise.all(matches.map((m, k) => playMatch(m, base + k * 10)));
      alive = matches.map((m) => m.winner);
      ri++;
    }
    if (!stopped()) ev.champion = alive[0];
  } else if (!stopped()) ev.champion = ev.standings[0]?.deck ?? null;
  ev.standings = computeStandings(st);
  ev.phase = stopped() ? 'stopped' : 'done';
  emit();
  return ev;
}
