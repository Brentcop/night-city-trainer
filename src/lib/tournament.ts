// Tournament engine shared by the CLI (scripts/tournament.ts) and the in-browser runner (Tournaments → Run).
// Swiss rounds (3 match points per win, no rematches, bye to the lowest-ranked deck without one), then an optional
// single-elimination top cut seeded 1vN, 2v(N-1)… Matches are best-of-1 or best-of-3; after each game the loser goes first.
// Every game keeps its seed and seat, so any game can be replayed exactly with makeBot().
import { makeTierBot, type BotChoice } from '../ai/tiers';
import type { DeckList } from '../engine/types';

/** easy | medium | hard | mixed (older events use fast | lookahead | deep). */
export type BotLevel = BotChoice | 'fast' | 'lookahead' | 'deep';

/** The bots used for tournament games. Seat A uses `seed`, seat B `seed + 7777`, same as the CLI worker. */
export function makeBot(level: string, seed: number) {
  return makeTierBot(level, seed);
}

/** Decks as they enter a game: sideboards play no part, so they are dropped (keeps replays identical everywhere). */
export const gameDeck = (d: Pick<DeckList, 'name' | 'legends' | 'main'>): DeckList => ({ name: d.name, legends: [...d.legends], main: [...d.main], sideboard: [] });

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
  decks: Record<string, { file?: string; legends: string[]; main: string[] }>;
  rounds: { round: number; matches: MatchRec[] }[];
  standings: StandingRow[];
  bracket: { name: string; matches: MatchRec[] }[];
  seeds?: string[]; // top-cut seeds in rank order
  champion: string | null;
  phase?: 'swiss' | 'top' | 'done' | 'stopped';
  progress?: { games: number; estimate: number };
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
export const roundName = (alive: number) => (alive === 2 ? 'Final' : alive === 4 ? 'Semifinals' : alive === 8 ? 'Quarterfinals' : `Round of ${alive}`);

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
const floor3 = (x: number) => Math.max(1 / 3, x);

export function computeStandings(st: Map<string, StandingRow>): StandingRow[] {
  const mwp = (s: StandingRow) => floor3(s.mw / Math.max(1, s.mw + s.ml));
  return [...st.values()]
    .map((s) => {
      const real = s.opps.filter((o) => o !== 'BYE');
      return { ...s, opps: [...s.opps], omw: real.length ? real.reduce((a, o) => a + mwp(st.get(o)!), 0) / real.length : 0, gwp: floor3(s.gw / Math.max(1, s.gw + s.gl)) };
    })
    .sort((a, b) => b.mp - a.mp || b.omw - a.omw || b.gwp - a.gwp || a.deck.localeCompare(b.deck));
}

function swissPairings(st: Map<string, StandingRow>, r: () => number) {
  const order = [...st.values()].map((s) => ({ s, k: r() })).sort((x, y) => y.s.mp - x.s.mp || x.k - y.k).map((x) => x.s.deck);
  const pairs: [string, string][] = [];
  const used = new Set<string>();
  let bye: string | null = null;
  if (order.length % 2) {
    for (let i = order.length - 1; i >= 0; i--)
      if (!st.get(order[i])!.opps.includes('BYE')) {
        bye = order[i];
        break;
      }
    bye ??= order[order.length - 1];
    used.add(bye);
  }
  for (const d of order) {
    if (used.has(d)) continue;
    const partner = order.find((o) => !used.has(o) && o !== d && !st.get(d)!.opps.includes(o)) ?? order.find((o) => !used.has(o) && o !== d);
    if (!partner) break;
    used.add(d);
    used.add(partner);
    pairs.push([d, partner]);
  }
  return { pairs, bye };
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
  const ev: TourneyEvent = {
    id: opts.id ?? cfg.seed,
    name: cfg.name,
    date: new Date().toISOString(),
    bot: cfg.bot,
    format: `Swiss ${cfg.rounds} round${cfg.rounds > 1 ? 's' : ''} (Bo${cfg.bestOf})${cut ? ` + top ${cut}` : ''}`,
    config: cfg,
    decks: Object.fromEntries(decks.map((d) => [d.name, { file: d.file, legends: [...d.legends], main: [...d.main] }])),
    rounds: [],
    standings: computeStandings(st),
    bracket: [],
    champion: null,
    phase: 'swiss',
    progress: { games: 0, estimate },
  };
  const emit = () => opts.onUpdate?.({ ...ev, standings: ev.standings, rounds: [...ev.rounds], bracket: [...ev.bracket] });
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
      const first: 0 | 1 = !prev ? ((Math.imul(seedBase, 2654435761) >>> 16) & 1 ? 1 : 0) : prev.winner === 'tie' ? ((1 - prev.first) as 0 | 1) : ((1 - prev.winner) as 0 | 1);
      const g = await play({ a: byName.get(m.a)!, b: byName.get(m.b!)!, seed: seedBase + gi, first, bot: cfg.bot });
      m.games.push(g);
      if (g.winner === 0) m.score[0]++;
      else if (g.winner === 1) m.score[1]++;
      tally(m.a, g.first === 0, g.winner === 0, g.turns);
      tally(m.b!, g.first === 1, g.winner === 1, g.turns);
      ev.progress!.games++;
      emit();
    }
    m.live = false;
    m.winner = m.score[0] > m.score[1] ? m.a : m.score[1] > m.score[0] ? m.b! : (m.games[0]?.seed ?? 0) % 2 ? m.a : m.b!;
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
