// Tournament engine shared by the CLI (scripts/tournament.ts) and the in-browser runner (Tournaments → Run).
// The standard event: Swiss rounds (3 match points per win, no avoidable rematches, bye to the lowest-ranked deck
// without one), then an optional single-elimination top cut seeded 1vN, 2v(N-1)… Matches are best-of-1 or best-of-3;
// game 1's seat is a coin flip from the match seed and after each game the loser goes first.
// Other formats and hand-arranged events (pairings set by hand, manual top-cut seeds, a fixed bracket, round robin,
// a match list, Bo5, first-player rules) take an EventSetup: src/lib/eventFormats.ts, re-exported here, holds those
// rules and the seed scheme. Every game keeps its seed and seat, so any game can be replayed exactly with makeBot() on
// the same code (see SIM_VERSION): same code + same seed + same setup = same event.
import { makeTierBot, type BotChoice } from '../ai/tiers';
import { deckFingerprint } from '../engine/deck';
import type { DeckList } from '../engine/types';
import { createRunManifest, type RunManifest } from './runManifest';
import { RULES_VERSIONS } from './rulesVersions';
import {
  avgGames,
  bracketBo,
  bracketOrder,
  bracketPlan,
  bracketRounds,
  cutSize,
  estimateGames,
  eventShape,
  expandMatchList,
  fieldMode,
  firstPlayer,
  forcedPairProblems,
  formatLabel,
  groupName,
  groupSeeds,
  groupSplit,
  hashBit,
  isPlainSetup,
  isStandardSetup,
  matchSeedBase,
  pairingRng,
  rankByBracket,
  roundName,
  roundRobinSchedule,
  seededSlots,
  setupProblems,
  swissPairings,
  winsNeeded,
  type BestOf,
  type EventSetup,
  type ForcedPair,
} from './eventFormats';

export * from './eventFormats';

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
 * 3: Legends to the field (backlog ENG-14): a face-up Legend with a cost can also be played by paying its cost without
 *    Go Solo (4.5: keeps its orientation, enters with Lag), and a Legend may help pay for its own Go Solo (spent first,
 *    still enters ready). Bots consider both. (Ordering your own pending effects, ENG-3, is opt-in for human seats and
 *    changes no bot game.)
 * 4: findings from the first decision-telemetry run: the lookahead bot values a reaction (block, Call, Quick Program or
 *    ability) by playing the attack out in a clone instead of projecting its result statically, so fight and steal
 *    triggers it arms (Safety Override) count; this is what changes fixed-seed games. Also: an attack on a Unit ends if
 *    the target is readied without a permission to attack ready Units (9.21.3, ENG-7; no current card does it).
 * 5: the official Rules FAQ conformance pass (backlog ENG-16, tests/faq/): card scripts and two engine details brought in
 *    line with the FAQ rulings. Scripts: All is Lost must add a trashed Unit; Appetite for Destruction and Safety Override
 *    choose their friendly Unit on resolution; Dexter DeShawn (Off the Grid), Wakako Okada and Padre always offer both
 *    Call modes; El Sombrerón chooses which max Gig; Kerry Eurodyne (Last Rockerboy), Judy Álvarez (Nothing to Doubt),
 *    Padre's and Wakako's {Spend}, River Ward and Overwatch (discard now part of the effect) can be activated when they
 *    would do nothing; Dum Dum may pick a Unit with no Gear; Gilded Matón and Placide offer their optional cost with no
 *    target; Alt Cunningham's reductions stack and are fixed on resolution; Corporate Surveillance and Memory Relapse may
 *    pick a spent Unit; Goro Takemura (Losing His Way) needs a face-up Legend; Yorinobu (Steel Dragon) counts its own
 *    defeat; Rogue Amendiares (Queen) reads the turn's steal history; Misty may name Legend; Zetatech Faceplate resolves
 *    after being moved. Engine: "must attack if it can" lasts its whole duration (a readied Unit must attack again), and
 *    the steal history records the Gig value and the stealer's power. The golden replays did not move.
 *    2026-11-11 fresh baseline: every recorded event was wiped and re-recorded on version 5. The Hard bot (and the
 *    coach) also read src/data/impact.json, which that baseline's `sim analyze` regenerated, so Hard games moved with
 *    no code change; no event recorded with the old table remains. Regenerating impact.json after events are recorded
 *    changes their Hard games too: bump this version then.
 * Events without `simVersion` predate all of these and no longer replay identically.
 */
export const SIM_VERSION = 5;

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
  /** paired by hand ("set by you"); absent on algorithm pairings */
  set?: true;
  /** best-of of this match when it differs from the event's (a Bo5 final, a Bo5 line of a match list) */
  bestOf?: number;
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
  /** Swiss rounds (other formats: the rounds they play before any bracket) */
  rounds: number;
  top: number; // 0 = no top cut (other formats: decks in the bracket)
  bestOf: BestOf;
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
  decks: Record<string, { id?: string; file?: string; legends: string[]; main: string[]; sideboard?: string[] }>;
  rounds: { round: number; matches: MatchRec[] }[];
  standings: StandingRow[];
  bracket: { name: string; matches: MatchRec[] }[];
  seeds?: string[]; // top-cut seeds in rank order
  champion: string | null;
  phase?: 'swiss' | 'rounds' | 'top' | 'done' | 'stopped';
  progress?: { games: number; estimate: number };
  /** SIM_VERSION the event was recorded with; absent on events from the earlier engine and bots. */
  simVersion?: number;
  manifest?: RunManifest;
  /**
   * How the event was arranged (src/lib/eventFormats.ts EventSetup): format, entrants, pairings set by hand, top-cut
   * seeds, bracket, match list, best-of per round, first-player rules. Absent on a plain Swiss event.
   */
  setup?: EventSetup;
  /**
   * Not a standard event (Swiss paired by the algorithm, top cut seeded by the standings): another format, or pairings
   * or seeds set by hand. Its games still count for ratings and head-to-heads; titles, top-8s, finishes and Swiss
   * records skip it.
   */
  custom?: true;
  /** round-robin groups (format round-robin with groups) */
  groups?: { name: string; decks: string[] }[];
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

/** A point where a run can pause (round by round) and take input: before each round, and before the top cut is seeded. */
export interface RoundStep {
  /** swiss: a Swiss round; rounds: a round-robin or match-list round; cut: seeding the top cut; bracket: a bracket round */
  stage: 'swiss' | 'rounds' | 'cut' | 'bracket';
  /** 1-based round within the stage (0 for 'cut') */
  round: number;
  /** rounds in the stage */
  of: number;
  /** a snapshot of the event so far */
  event: TourneyEvent;
  /** 'cut': the seeds the standings give, best first */
  seeds?: string[];
}
/** What a pause can hand back: pairings set by hand for the coming Swiss round, or the top-cut seeds in order. */
export interface RoundInput {
  pairs?: ForcedPair[];
  seeds?: string[];
}

export interface RunOptions {
  onUpdate?: (ev: TourneyEvent) => void;
  shouldStop?: () => boolean;
  id?: number | string;
  /** how the event is arranged; absent = a plain Swiss event from the config */
  setup?: EventSetup;
  /** called before every round and before the top cut is seeded (round-by-round runs wait here for the owner) */
  beforeRound?: (step: RoundStep) => Promise<RoundInput | void> | RoundInput | void;
}

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

/**
 * Run a whole event. `decks` must have unique names (an explicit duplicate is named "X #2"). With no `opts.setup` (or a
 * plain one) this is the Swiss event every recorded event is: same pairings, seeds, seats and output. See
 * src/lib/eventFormats.ts for the other formats and the seed scheme.
 */
export async function runTournament(decks: (DeckList & { file?: string })[], cfg: TourneyConfig, play: PlayGame, opts: RunOptions = {}): Promise<TourneyEvent> {
  // the working setup: the given one (cloned: hand-set pairings may be added during the run) or a plain Swiss event
  const setup: EventSetup = opts.setup
    ? clone(opts.setup)
    : { format: 'swiss', entrants: decks.map((d) => ({ name: d.name, ...(d.file ? { file: d.file } : {}) })), bestOf: cfg.bestOf, rounds: cfg.rounds, top: cfg.top };
  const names = decks.map((d) => d.name);
  if (opts.setup) {
    const want = setup.entrants.map((e) => e.name).sort();
    if (want.join('\u0000') !== [...names].sort().join('\u0000')) throw new Error('the setup names different entrants from the decks given');
  }
  const problems = setupProblems({ ...setup, entrants: names.map((n) => setup.entrants.find((e) => e.name === n) ?? { name: n }) });
  if (problems.length) throw new Error(`this event can't run: ${problems.join('; ')}`);
  const plain = isPlainSetup(setup);
  const fmt = setup.format;
  const r = pairingRng(cfg.seed);
  const byName = new Map(decks.map((d) => [d.name, gameDeck(d)]));
  const st = new Map<string, StandingRow>(
    decks.map((d) => [d.name, { deck: d.name, mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [], omw: 0, gwp: 0, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 }]),
  );
  const swissRounds = fmt === 'swiss' ? (setup.rounds ?? cfg.rounds) : 0;
  const cut = fmt === 'swiss' ? (setup.cutSeeds?.length || cutSize(setup.top ?? cfg.top, decks.length)) : 0;
  const bestOf = setup.bestOf;
  const need = winsNeeded(bestOf);
  const avg = avgGames(bestOf);
  // a plain event keeps the numbers events have always recorded
  const estimate = plain ? Math.round(swissRounds * Math.floor(decks.length / 2) * avg + Math.max(0, cut - 1) * avg) : estimateGames(setup, decks.length).estimate;
  const maxGames = plain ? swissRounds * Math.floor(decks.length / 2) * bestOf + Math.max(0, cut - 1) * bestOf : estimateGames(setup, decks.length).max;
  const date = new Date().toISOString();
  const manifestDecks = decks.map((d) => ({ id: deckFingerprint(d), name: d.name, file: d.file }));
  const config: TourneyConfig = plain
    ? cfg
    : { ...cfg, rounds: fmt === 'swiss' ? swissRounds : eventShape(setup, decks.length).rounds, top: fmt === 'swiss' ? cut : bracketPlan(setup, decks.length).decks, bestOf };
  const ev: TourneyEvent = {
    id: opts.id ?? cfg.seed,
    name: cfg.name,
    date,
    bot: cfg.bot,
    format: plain ? `Swiss ${swissRounds} round${swissRounds > 1 ? 's' : ''} (Bo${bestOf})${cut ? ` + top ${cut}` : ''}` : formatLabel(setup, decks.length),
    config,
    // the sideboard is kept (when there is one) so the stored list reproduces the deck id; games never use it
    decks: Object.fromEntries(
      decks.map((d) => [d.name, { id: deckFingerprint(d), file: d.file, legends: [...d.legends], main: [...d.main], ...(d.sideboard?.length ? { sideboard: [...d.sideboard] } : {}) }]),
    ),
    rounds: [],
    standings: computeStandings(st),
    bracket: [],
    champion: null,
    phase: fmt === 'swiss' ? 'swiss' : fmt === 'single-elim' ? 'top' : 'rounds',
    progress: { games: 0, estimate },
    simVersion: SIM_VERSION,
    manifest: createRunManifest({
      runId: `tournament:${opts.id ?? cfg.seed}:${date}`,
      createdAt: date,
      purpose: 'tournament',
      simVersion: SIM_VERSION,
      ...RULES_VERSIONS,
      bot: { level: cfg.bot },
      decks: manifestDecks,
      field: { mode: fieldMode(plain ? null : setup), deckIds: manifestDecks.map((d) => d.id) },
      sample: { plannedGames: maxGames, completedGames: 0, gamesPerPair: null },
      seedBase: cfg.seed,
      seatPolicy: (setup.next ?? 'loser') === 'alternate' ? 'alternate' : 'loser-starts',
      trace: false,
    }),
  };
  /** Record the setup on the event (anything but a plain event) and keep its labels in step with what was arranged. */
  const arrange = () => {
    if (isPlainSetup(setup)) return;
    ev.setup = setup;
    if (!isStandardSetup(setup)) ev.custom = true;
    else delete ev.custom;
    ev.format = formatLabel(setup, decks.length);
    ev.manifest!.field.mode = fieldMode(setup);
  };
  arrange();
  const snapshot = (): TourneyEvent => ({
    ...ev,
    standings: ev.standings,
    rounds: [...ev.rounds],
    bracket: [...ev.bracket],
    manifest: { ...ev.manifest!, sample: { ...ev.manifest!.sample } },
  });
  const emit = () => opts.onUpdate?.(snapshot());
  const stopped = () => opts.shouldStop?.() ?? false;
  const pause = async (step: Omit<RoundStep, 'event'>): Promise<RoundInput | void> => (opts.beforeRound ? opts.beforeRound({ ...step, event: snapshot() }) : undefined);

  const tally = (name: string, onPlay: boolean, won: boolean, turns: number) => {
    const s = st.get(name)!;
    s.games++;
    s.turns += turns;
    if (onPlay) (s.playG++, won && s.playW++);
    else (s.drawG++, won && s.drawW++);
  };

  /** Play a series. `alt` is the table index plus repeat number (the 'alternate' game-1 rule). */
  const playMatch = async (m: MatchRec, seedBase: number, bo: number = bestOf, alt = 0) => {
    const win = bo === bestOf ? need : winsNeeded(bo);
    if (bo !== bestOf) m.bestOf = bo;
    m.live = true;
    for (let gi = 0; gi < bo && m.score[0] < win && m.score[1] < win; gi++) {
      if (stopped()) break;
      const prev = m.games[m.games.length - 1];
      // game 1: coin flip derived from the match seed (not the shared RNG, so parallel finishing order can't change the event)
      const first = firstPlayer({ gi, prev, seedBase, game1: setup.game1, next: setup.next, alt });
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
  /** Match points, records and opponents from finished matches; a bye is a win only in Swiss. */
  const record = (matches: MatchRec[], byeWins: boolean) => {
    for (const m of matches) {
      const A = st.get(m.a)!;
      if (!m.b) {
        if (!byeWins) continue;
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
  };
  const keyed = (key: string) => matchSeedBase(cfg.seed, key);

  /**
   * A single-elimination bracket from first-round slots (null = bye). `table`: the original top-cut seed scheme;
   * otherwise each match's seeds come from its key `<prefix>:<round>:<A>|<B>`. `results`: count match wins in the standings.
   */
  const runBracket = async (slots: (string | null)[], o: { table: boolean; prefix: string; results: boolean; pauseFirst: boolean }): Promise<string | null> => {
    let alive = slots;
    let ri = 0;
    const of = bracketRounds(slots.length);
    while (alive.length > 1 && !stopped()) {
      if (ri > 0 || o.pauseFirst) {
        await pause({ stage: 'bracket', round: ri + 1, of });
        if (stopped()) break;
      }
      const matches: MatchRec[] = [];
      for (let i = 0; i < alive.length; i += 2) {
        const a = alive[i];
        const b = alive[i + 1];
        if (a === undefined || b === undefined) throw new Error(`top cut round with an odd number of decks (${alive.length})`);
        if (a === null && b === null) throw new Error('a bracket match with two byes');
        if (a === null || b === null) {
          const d = (a ?? b) as string;
          matches.push({ a: d, b: null, games: [], winner: d, score: [0, 0] });
        } else matches.push({ a, b, games: [], winner: '', score: [0, 0] });
      }
      ev.bracket.push({ name: roundName(alive.length), matches });
      emit();
      const bo = bracketBo(setup, ri);
      const base = cfg.seed * 1_000_000 + 900_000 + ri * 10_000;
      const round = ri;
      await Promise.all(matches.map((m, k) => (m.b ? playMatch(m, o.table ? base + k * 10 : keyed(`${o.prefix}:${round}:${m.a}|${m.b}`), bo, k) : Promise.resolve())));
      if (o.results && !stopped()) {
        record(matches, false);
        ev.standings = rankByBracket(computeStandings(st), ev.bracket, null);
      }
      alive = matches.map((m) => m.winner);
      ri++;
    }
    return stopped() ? null : (alive[0] ?? null);
  };

  /** Rounds known in advance (round robin, match list): shown in full before play, then played round by round. */
  const runPlanned = async (plan: { round: number; matches: { rec: MatchRec; key: string; bo: number; alt: number }[] }[]) => {
    ev.rounds = plan.map((p) => ({ round: p.round, matches: p.matches.map((x) => x.rec) }));
    emit();
    for (const [i, p] of plan.entries()) {
      if (stopped()) break;
      await pause({ stage: 'rounds', round: i + 1, of: plan.length });
      if (stopped()) break;
      await Promise.all(p.matches.map((x) => playMatch(x.rec, keyed(x.key), x.bo, x.alt)));
      if (stopped()) break;
      record(
        p.matches.map((x) => x.rec),
        false,
      );
      ev.standings = computeStandings(st);
      emit();
    }
  };
  const fresh = (a: string, b: string): MatchRec => ({ a, b, games: [], winner: '', score: [0, 0] });

  if (fmt === 'swiss') {
    for (let round = 1; round <= swissRounds && !stopped(); round++) {
      const input = opts.beforeRound ? await pause({ stage: 'swiss', round, of: swissRounds }) : undefined;
      if (stopped()) break;
      const forced = input?.pairs ?? setup.pairings?.[round] ?? [];
      if (forced.length) {
        const bad = forcedPairProblems(names, forced, (a, b) => st.get(a)!.opps.includes(b));
        if (bad.length) throw new Error(`round ${round} pairings: ${bad.join('; ')}`);
        setup.pairings = { ...setup.pairings, [round]: forced.map((p) => ({ a: p.a, b: p.b, ...(p.rematch ? { rematch: true } : {}) })) };
        arrange();
      }
      const { pairs, bye } = swissPairings(st, r, forced);
      const matches: MatchRec[] = [...forced.map((p) => ({ ...fresh(p.a, p.b), set: true as const })), ...pairs.map(([a, b]) => fresh(a, b))];
      if (bye) matches.push({ a: bye, b: null, games: [], winner: bye, score: [2, 0] });
      ev.rounds.push({ round, matches });
      emit();
      // a round with hand-set pairings seeds every match by its key (table order means nothing there); others by table
      const base = cfg.seed * 1_000_000 + round * 10_000;
      await Promise.all(matches.map((m, k) => (m.b ? playMatch(m, forced.length ? keyed(`swiss:${round}:${m.a}|${m.b}`) : base + k * 10, bestOf, k) : Promise.resolve())));
      if (stopped()) break;
      record(matches, true);
      ev.standings = computeStandings(st);
      emit();
    }

    if (!stopped() && cut) {
      ev.phase = 'top';
      const bySt = ev.standings.slice(0, cut).map((s) => s.deck);
      let seeds = setup.cutSeeds?.length ? [...setup.cutSeeds] : bySt;
      if (opts.beforeRound) {
        const input = await pause({ stage: 'cut', round: 0, of: bracketRounds(cut), seeds: [...seeds] });
        if (input?.seeds?.length) seeds = [...input.seeds];
      }
      const manual = seeds.join('\u0000') !== ev.standings.slice(0, seeds.length).map((s) => s.deck).join('\u0000');
      if (manual) {
        setup.cutSeeds = seeds;
        const bad = setupProblems({ ...setup, pairings: {} });
        if (bad.length) throw new Error(`top cut: ${bad.join('; ')}`);
      } else delete setup.cutSeeds;
      arrange();
      if (!stopped()) {
        ev.seeds = seeds;
        // cut is a power of two no larger than the field (cutSize), so every bracket slot has a seed
        const champ = await runBracket(
          bracketOrder(seeds.length).flatMap((i) => seeds[i] ?? []),
          { table: !manual, prefix: 'top', results: false, pauseFirst: false },
        );
        if (!stopped()) ev.champion = champ;
      }
    } else if (!stopped()) ev.champion = ev.standings[0]?.deck ?? null;
  } else if (fmt === 'single-elim') {
    const slots = setup.bracket ? [...setup.bracket] : seededSlots(names);
    if (!setup.bracket) ev.seeds = [...names];
    const champ = await runBracket(slots, { table: false, prefix: 'ko', results: true, pauseFirst: true });
    if (!stopped()) ev.champion = champ;
  } else if (fmt === 'round-robin') {
    const groups = groupSplit(names, setup.groups ?? 1);
    if (groups.length > 1) ev.groups = groups.map((g, i) => ({ name: groupName(i), decks: g }));
    const scheds = groups.map((g) => roundRobinSchedule(g, setup.times ?? 1, setup.mirror ?? false));
    const n = Math.max(0, ...scheds.map((s) => s.length));
    const plan = Array.from({ length: n }, (_, ri) => ({
      round: ri + 1,
      matches: scheds.flatMap((s) => s[ri] ?? []).map((x, k) => ({ rec: fresh(x.a, x.b), key: `rr:${x.a}|${x.b}#${x.rep}`, bo: bestOf, alt: k + x.rep })),
    }));
    await runPlanned(plan);
    const advance = setup.advance ?? 0;
    if (!stopped() && groups.length > 1 && advance > 0) {
      ev.phase = 'top';
      const seeds = groupSeeds(
        groups.map((g) => ev.standings.filter((s) => g.includes(s.deck)).map((s) => s.deck)),
        advance,
      );
      if (seeds.length >= 2) {
        ev.seeds = seeds;
        const champ = await runBracket(seededSlots(seeds), { table: false, prefix: 'ko', results: false, pauseFirst: true });
        if (!stopped()) ev.champion = champ;
      }
    } else if (!stopped() && groups.length === 1) ev.champion = ev.standings[0]?.deck ?? null;
  } else {
    const plan = expandMatchList(setup.matches ?? [], bestOf).map((r) => ({
      round: r.round,
      matches: r.matches.map((x, k) => ({ rec: fresh(x.a, x.b), key: `m:${r.round}:${x.a}|${x.b}#${x.occ}`, bo: x.bestOf, alt: k + x.rep })),
    }));
    await runPlanned(plan);
  }
  ev.standings = computeStandings(st);
  // a bracket event ranks by how far each deck got
  if (fmt === 'single-elim') ev.standings = rankByBracket(ev.standings, ev.bracket, ev.champion);
  ev.phase = stopped() ? 'stopped' : 'done';
  emit();
  return ev;
}

/**
 * Resume a stopped event: a PlayGame that hands back the games the saved run already played (matched by decks, seed and
 * seat) and plays the rest. Re-running the same setup with it rebuilds the event exactly and carries on from there.
 */
export function resumePlay(play: PlayGame, saved: Pick<TourneyEvent, 'rounds' | 'bracket'> | null | undefined): PlayGame & { reused: () => number } {
  const done = new Map<string, GameRec>();
  const key = (a: string, b: string, seed: number, first: number) => `${a}\u0000${b}\u0000${seed}\u0000${first}`;
  for (const part of [...(saved?.rounds ?? []), ...(saved?.bracket ?? [])]) for (const m of part.matches) if (m.b) for (const g of m.games) done.set(key(m.a, m.b, g.seed, g.first), g);
  let reused = 0;
  const fn = ((job: GameJob) => {
    const g = done.get(key(job.a.name, job.b.name, job.seed, job.first));
    if (g) {
      reused++;
      return Promise.resolve({ ...g });
    }
    return play(job);
  }) as PlayGame & { reused: () => number };
  fn.reused = () => reused;
  return fn;
}

/** A standard event (counts for titles, top 8s, finishes and Swiss records): not flagged custom. */
export const isStandardEvent = (ev: { custom?: boolean }) => !ev.custom;
