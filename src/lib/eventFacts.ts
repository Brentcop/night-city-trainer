// Competitive facts by code (docs/RAG_PLAN.md rule M3, step 2.1): one documented function per number a person asks about a
// recorded tournament, a round, a deck's results, the ratings table or a matchup, each returning plain data with what it
// was computed from (sim version, bot, recorded date). Pure, Node and browser: every source is passed in, nothing is
// read, no clock.
//
// The definitions, and the word each uses where the project has more than one (docs/RAG_PLAN.md §9):
//   - Standings after round k are rebuilt from the stored matches by the recorder's own rules: 3 match points per match
//     won, a Swiss bye is a match win with no games, ranking by `computeStandings` (src/lib/tournament.ts). After the
//     last Swiss round they equal the stored standings in every ranking field (tests/event-facts.test.ts). The stored
//     final rows' `games`, `turns` and seat counts also hold the top-cut games (the recorder tallies every game and
//     ranks once more at the end); here they count the Swiss rounds up to k only.
//   - `gamesPlayed` is a count of games (ties included); a `gameRecord` such as "17-7" is games won and lost (ties out);
//     a `matchRecord` such as "8-1" is matches won and lost.
//   - "Top 8" has two meanings (decision D6): `topCutAppearances` counts events where the deck made the event's real
//     top cut (4 in a 7-deck field); `swissTopEight` is the ratings file's count of Swiss finishes in the first eight
//     places, whatever the cut. Nothing here returns a bare "top 8".
//   - Titles and finishes come from standard events only (a custom event's games count for ratings, never for titles).
//   - A rate always comes with its sample: wins with the games they are out of.
// Not here yet: upsets judged against earlier ratings, per-game Gig counts, findings, decision and synergy cells.
import { eventFinishes, type EventLite } from './deckRecord';
import { h2hFileLookup, type H2HModelBlock } from './h2hModel';
import { simTier, simTierText, type SimTier } from './simTier';
import { computeStandings, type MatchRec, type StandingRow } from './tournament';

// ---------------------------------------------------------------- inputs (the parts of the recorded files read here)

/** A recorded event (public/tournaments/event-<id>.json): the parts these facts read. TourneyEvent fits it. */
export interface RecordedEvent {
  id: number | string;
  name?: string;
  /** recorded date, ISO, as stored */
  date: string;
  bot: string;
  /** the format label, e.g. "Swiss 9 rounds (Bo3) + top 8" */
  format: string;
  config?: { rounds: number; top: number; bestOf: number };
  decks: Record<string, { file?: string }>;
  rounds: { round: number; matches: MatchRec[] }[];
  bracket: { name: string; matches: MatchRec[] }[];
  standings: StandingRow[];
  seeds?: string[];
  champion: string | null;
  simVersion?: number;
  custom?: boolean;
  setup?: { format?: string; bestOf?: number };
}

/** The event index (src/data/tournaments.json). */
export interface EventIndex {
  events: (EventLite & { bot?: string; format?: string; entrants?: number; games?: number })[];
}

/** A row of src/data/ratings.json. */
export interface RatingsRowInput {
  name: string;
  file: string;
  rating: number;
  se?: number;
  /** every pooled game the deck played (Swiss, top cut, custom events) */
  games: number;
  wrField: number;
  wrFieldLo: number;
  wrFieldHi: number;
  wrMeta: number | null;
  events: number;
  titles: number;
  /** Swiss finishes in the first eight places (D6: not the real top cut) */
  top8: number;
  avgFinish: number | null;
  /** Swiss matches won-lost in standard events */
  matches: string;
  /** Swiss games won-lost in standard events */
  gamesRecord?: string;
}

/** src/data/ratings.json. */
export interface RatingsInput {
  events?: number;
  games?: number;
  intervals?: string;
  decks: RatingsRowInput[];
  manifest?: { simVersion?: number; bot?: { level?: string }; createdAt?: string };
}

/** public/data/h2h.json. */
export interface H2HInput {
  events?: number;
  games?: number;
  decks: string[];
  pairs: [number, number, number, number][];
  model?: H2HModelBlock;
  shrunk?: number[];
  manifest?: { simVersion?: number; bot?: { level?: string }; createdAt?: string };
}

/** What a fact was computed from. */
export interface Basis {
  simVersion: number | null;
  bot: string | null;
  /** the recorded date the data carries (ISO, as stored), never the clock */
  asOf: string | null;
}

// ---------------------------------------------------------------- shared tallies

/** Games won by the player who went first, out of the games that had a winner. */
export interface FirstPlayerSplit {
  won: number;
  decided: number;
  ties: number;
}
/** Total turns over games, and the mean (null with no games). */
export interface TurnTally {
  total: number;
  games: number;
  mean: number | null;
}
/** How many games ended for each reason, most first (ties by reason, code-unit order). */
export interface ReasonCount {
  reason: string;
  games: number;
}

const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

function gamesOf(matches: readonly MatchRec[]) {
  return matches.flatMap((m) => (m.b ? m.games : []));
}

export function firstPlayerSplit(matches: readonly MatchRec[]): FirstPlayerSplit {
  const out = { won: 0, decided: 0, ties: 0 };
  for (const g of gamesOf(matches)) {
    if (g.winner === 'tie') out.ties++;
    else {
      out.decided++;
      if (g.winner === g.first) out.won++;
    }
  }
  return out;
}

export function turnTally(matches: readonly MatchRec[]): TurnTally {
  const gs = gamesOf(matches);
  const total = gs.reduce((a, g) => a + g.turns, 0);
  return { total, games: gs.length, mean: gs.length ? total / gs.length : null };
}

export function endReasons(matches: readonly MatchRec[]): ReasonCount[] {
  const n = new Map<string, number>();
  for (const g of gamesOf(matches)) n.set(g.reason, (n.get(g.reason) ?? 0) + 1);
  return [...n].map(([reason, games]) => ({ reason, games })).sort((a, b) => b.games - a.games || byStr(a.reason, b.reason));
}

/** The best-of of an event: its setup, else its config, else the "(BoN)" in its format label, else 1. */
export function eventBestOf(ev: Pick<RecordedEvent, 'setup' | 'config' | 'format'>): number {
  const m = /\(Bo(\d+)/.exec(ev.format);
  return ev.setup?.bestOf ?? ev.config?.bestOf ?? (m?.[1] ? Number(m[1]) : 1);
}

/** The stage the event's numbered rounds belong to: Swiss (byes are wins) or planned rounds (round robin, match list). */
export const roundStage = (ev: Pick<RecordedEvent, 'setup'>): 'swiss' | 'rounds' => (!ev.setup?.format || ev.setup.format === 'swiss' ? 'swiss' : 'rounds');

const eventBasis = (ev: RecordedEvent): Basis => ({ simVersion: typeof ev.simVersion === 'number' ? ev.simVersion : null, bot: ev.bot ?? null, asOf: ev.date ?? null });

// ---------------------------------------------------------------- one event

export interface EventSummary extends Basis {
  id: number | string;
  name: string;
  /** another format or hand-arranged: its games count for ratings, never for titles or finishes */
  custom: boolean;
  format: { label: string; stage: 'swiss' | 'rounds'; rounds: number; topCut: number; bestOf: number };
  entrants: number;
  champion: string | null;
  /** the two decks of the final, winner first (empty without a bracket) */
  finalists: string[];
  final: { a: string; b: string; score: [number, number]; winner: string } | null;
  games: { total: number; rounds: number; topCut: number };
  matches: { played: number; byes: number };
  endReasons: ReasonCount[];
  firstPlayer: FirstPlayerSplit;
  turns: TurnTally;
}

/** Name, recorded date, format, entrants, champion and finalists, games, end reasons, first-player split, mean turns. */
export function eventSummary(ev: RecordedEvent): EventSummary {
  const roundMatches = ev.rounds.flatMap((r) => r.matches);
  const cutMatches = ev.bracket.flatMap((r) => r.matches);
  const all = [...roundMatches, ...cutMatches];
  const fin = ev.bracket.length ? ev.bracket[ev.bracket.length - 1]?.matches[0] : undefined;
  const final = fin && fin.b ? { a: fin.a, b: fin.b, score: [fin.score[0], fin.score[1]] as [number, number], winner: fin.winner } : null;
  const first = ev.bracket[0];
  return {
    id: ev.id,
    name: ev.name ?? `Event #${ev.id}`,
    ...eventBasis(ev),
    custom: !!ev.custom,
    format: { label: ev.format, stage: roundStage(ev), rounds: ev.rounds.length, topCut: first ? first.matches.length * 2 : 0, bestOf: eventBestOf(ev) },
    entrants: Object.keys(ev.decks).length,
    champion: ev.champion,
    finalists: final ? [final.winner, final.winner === final.a ? final.b : final.a] : [],
    final,
    games: { total: gamesOf(all).length, rounds: gamesOf(roundMatches).length, topCut: gamesOf(cutMatches).length },
    matches: { played: all.filter((m) => m.b).length, byes: all.filter((m) => !m.b).length },
    endReasons: endReasons(all),
    firstPlayer: firstPlayerSplit(all),
    turns: turnTally(all),
  };
}

// ---------------------------------------------------------------- standings

export interface StandingLine extends StandingRow {
  place: number;
  /** matches won-lost, e.g. "8-1" */
  matchRecord: string;
  /** games won-lost (ties out), e.g. "17-7" */
  gameRecord: string;
}

export interface StandingsAfter extends Basis {
  event: number | string;
  stage: 'swiss' | 'rounds';
  /** rounds counted (1-based) and rounds the event played */
  round: number;
  of: number;
  rows: StandingLine[];
}

const emptyRow = (deck: string): StandingRow => ({ deck, mp: 0, mw: 0, ml: 0, gw: 0, gl: 0, opps: [], omw: 0, gwp: 0, turns: 0, games: 0, playW: 0, playG: 0, drawW: 0, drawG: 0 });

/**
 * Standings after round k of the numbered rounds, by the recorder's rules (runTournament in src/lib/tournament.ts): each
 * game is tallied for the seat counts and turns, then each finished match gives 3 match points to its winner; a Swiss
 * bye is a match win with no games (a planned round's bye counts for nothing). Ranked by `computeStandings`: match
 * points, then opponents' match-win share, then game-win share (each floored at a third), then the deck name. Throws a
 * RangeError for a round the event did not play.
 */
export function standingsAfter(ev: RecordedEvent, round: number = ev.rounds.length): StandingsAfter {
  if (!Number.isInteger(round) || round < 1 || round > ev.rounds.length) throw new RangeError(`event ${ev.id} has rounds 1 to ${ev.rounds.length}, not ${round}`);
  const stage = roundStage(ev);
  const st = new Map<string, StandingRow>(Object.keys(ev.decks).map((d) => [d, emptyRow(d)]));
  const row = (d: string) => {
    const r = st.get(d) ?? emptyRow(d);
    st.set(d, r);
    return r;
  };
  for (const r of ev.rounds.slice(0, round)) {
    for (const m of r.matches) {
      if (!m.b) continue;
      for (const g of m.games) {
        for (const [deck, seat] of [[m.a, 0], [m.b, 1]] as const) {
          const s = row(deck);
          s.games++;
          s.turns += g.turns;
          const won = g.winner === seat;
          if (g.first === seat) (s.playG++, won && s.playW++);
          else (s.drawG++, won && s.drawW++);
        }
      }
    }
    for (const m of r.matches) {
      const A = row(m.a);
      if (!m.b) {
        if (stage !== 'swiss') continue;
        A.mp += 3;
        A.mw++;
        A.opps.push('BYE');
        continue;
      }
      const B = row(m.b);
      A.opps.push(m.b);
      B.opps.push(m.a);
      A.gw += m.score[0];
      A.gl += m.score[1];
      B.gw += m.score[1];
      B.gl += m.score[0];
      if (m.winner === m.a) (A.mp += 3, A.mw++, B.ml++);
      else (B.mp += 3, B.mw++, A.ml++);
    }
  }
  const rows = computeStandings(st).map((s, i) => ({ ...s, place: i + 1, matchRecord: `${s.mw}-${s.ml}`, gameRecord: `${s.gw}-${s.gl}` }));
  return { event: ev.id, ...eventBasis(ev), stage, round, of: ev.rounds.length, rows };
}

// ---------------------------------------------------------------- one round

export interface RoundMatch {
  a: string;
  /** null: a bye */
  b: string | null;
  score: [number, number];
  winner: string;
  games: number;
  bestOf: number;
}

export interface RoundSummary extends Basis {
  event: number | string;
  eventName: string;
  stage: 'swiss' | 'rounds' | 'bracket';
  /** 1-based within its stage */
  round: number;
  of: number;
  /** "Round 5", "Quarterfinals", "Final" */
  name: string;
  /** the id key: "5", "quarterfinals" */
  key: string;
  bestOf: number;
  matches: RoundMatch[];
  /** matches played (not byes) and byes */
  played: number;
  byes: number;
  games: number;
  /** played matches of best-of 2 or more that the loser left without a game won */
  sweeps: number;
  /** played matches of best-of 2 or more that went to their last possible game */
  deciders: number;
  endReasons: ReasonCount[];
  firstPlayer: FirstPlayerSplit;
  turns: TurnTally;
  /** numbered rounds: the decks on the top match-point total after this round (at most LEADERS_SHOWN), as records */
  leaders: { deck: string; matchRecord: string; mp: number }[];
  /** how many decks share that total */
  atTop: number;
  /** bracket rounds: the decks that won their match */
  advancing: string[];
}

export const LEADERS_SHOWN = 8;

/** A bracket round's name as an id key: "Round of 16" → "round-of-16". */
export const roundKey = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * One round: a numbered round by its number (Swiss, or a planned round), or a bracket round by its name or key
 * ("Final", "semifinals", "round-of-16"). Throws a RangeError for a round the event did not play.
 */
export function roundSummary(ev: RecordedEvent, round: number | string): RoundSummary {
  const bo = eventBestOf(ev);
  const asNumber = typeof round === 'number' ? round : /^\d+$/.test(round.trim()) ? Number(round) : null;
  let stage: RoundSummary['stage'];
  let matches: MatchRec[];
  let index: number;
  let name: string;
  let key: string;
  let of: number;
  if (asNumber !== null) {
    const r = ev.rounds[asNumber - 1];
    if (!r || !Number.isInteger(asNumber)) throw new RangeError(`event ${ev.id} has rounds 1 to ${ev.rounds.length}, not ${round}`);
    stage = roundStage(ev);
    matches = r.matches;
    index = asNumber;
    name = `Round ${asNumber}`;
    key = String(asNumber);
    of = ev.rounds.length;
  } else {
    const want = roundKey(String(round));
    const i = ev.bracket.findIndex((b) => roundKey(b.name) === want);
    const b = ev.bracket[i];
    if (!b) throw new RangeError(`event ${ev.id} has no bracket round "${round}"${ev.bracket.length ? ` (it has ${ev.bracket.map((x) => x.name).join(', ')})` : ''}`);
    stage = 'bracket';
    matches = b.matches;
    index = i + 1;
    name = b.name;
    key = roundKey(b.name);
    of = ev.bracket.length;
  }
  const lines: RoundMatch[] = matches.map((m) => ({ a: m.a, b: m.b, score: [m.score[0], m.score[1]], winner: m.winner, games: m.games.length, bestOf: m.bestOf ?? bo }));
  const played = lines.filter((m) => m.b);
  let leaders: RoundSummary['leaders'] = [];
  let atTop = 0;
  if (stage !== 'bracket') {
    const rows = standingsAfter(ev, index).rows;
    const top = rows[0]?.mp;
    const tied = rows.filter((r) => r.mp === top);
    atTop = tied.length;
    leaders = tied.slice(0, LEADERS_SHOWN).map((r) => ({ deck: r.deck, matchRecord: r.matchRecord, mp: r.mp }));
  }
  return {
    event: ev.id,
    eventName: ev.name ?? `Event #${ev.id}`,
    ...eventBasis(ev),
    stage,
    round: index,
    of,
    name,
    key,
    bestOf: bo,
    matches: lines,
    played: played.length,
    byes: lines.length - played.length,
    games: played.reduce((a, m) => a + m.games, 0),
    sweeps: played.filter((m) => m.bestOf > 1 && Math.min(m.score[0], m.score[1]) === 0 && m.games === Math.max(m.score[0], m.score[1])).length,
    deciders: played.filter((m) => m.bestOf > 1 && m.games === m.bestOf).length,
    endReasons: endReasons(matches),
    firstPlayer: firstPlayerSplit(matches),
    turns: turnTally(matches),
    leaders,
    atTop,
    advancing: stage === 'bracket' ? matches.map((m) => m.winner) : [],
  };
}

// ---------------------------------------------------------------- one deck

export interface DeckFinish {
  event: number;
  recorded: string;
  simVersion: number | null;
  place: number;
  of: number;
  matchRecord: string;
  gameRecord: string;
  /** made the event's real top cut (the cut's size, not eight) */
  madeTopCut: boolean;
  champion: boolean;
}

export interface DeckCompetitive extends Basis {
  deck: string;
  file: string | null;
  /** the ratings row (null: the deck has no row) */
  rating: null | {
    value: number;
    se: number | null;
    /** place in the ratings file's order (by rating) and the rows in it */
    position: number;
    of: number;
    /** every pooled game: Swiss and top cut, standard and custom events */
    ratedGames: number;
    /** expected win rate against the whole field and its 90% range */
    wrField: number;
    lo: number;
    hi: number;
    /** expected win rate against the meta archetypes (no range recorded) */
    wrMeta: number | null;
    /** mean finish (1 = first, 0 = last) over standard events */
    avgFinish: number | null;
  };
  tier: SimTier;
  /** the site's wording of the tier (simTierText) */
  tierText: string;
  /** Swiss results in standard events (ratings row): matches and games won-lost */
  swiss: null | { matchRecord: string; gameRecord: string | null; matchesWon: number; matchesLost: number; gamesWon: number | null; gamesLost: number | null };
  /** standard events entered (ratings row) */
  events: number;
  /** standard events in the ratings' pool that the deck won */
  titles: number;
  /** standard events in the pool where the deck made the real top cut */
  topCutAppearances: number;
  /** the ratings file's count of Swiss finishes in the first eight places (D6: not the real cut) */
  swissTopEight: number;
  /** every standard event the deck entered, newest first */
  finishes: DeckFinish[];
}

const wl = (s: string | undefined | null): [number, number] | null => {
  const m = /^(\d+)-(\d+)$/.exec(s ?? '');
  return m?.[1] !== undefined && m[2] !== undefined ? [Number(m[1]), Number(m[2])] : null;
};

/** The pool of a ratings or h2h file: its manifest's sim version, bot and recorded date. */
export const fileBasis = (f: { manifest?: { simVersion?: number; bot?: { level?: string }; createdAt?: string } }): Basis => ({
  simVersion: typeof f.manifest?.simVersion === 'number' ? f.manifest.simVersion : null,
  bot: f.manifest?.bot?.level ?? null,
  asOf: f.manifest?.createdAt ?? null,
});

/**
 * A deck's competitive facts: its ratings row, Sim tier with its range, Swiss record, titles and both "top 8" counts
 * under their own names, and its finishes (eventFinishes in src/lib/deckRecord.ts). Titles and top-cut appearances
 * count the standard events of the ratings' pool (same sim version and bot), so they never mix versions.
 */
export function deckCompetitive(deck: string, src: { ratings: RatingsInput; index: EventIndex; h2h?: H2HInput | null }): DeckCompetitive {
  const rows = src.ratings.decks;
  const ri = rows.findIndex((r) => r.name === deck);
  const row = ri >= 0 ? rows[ri] : undefined;
  const basis = fileBasis(src.ratings);
  const inPool = (e: { simVersion?: number; bot?: string }) => (basis.simVersion === null || e.simVersion === basis.simVersion) && (basis.bot === null || e.bot === undefined || e.bot === basis.bot);
  const byId = new Map(src.index.events.map((e) => [e.id, e]));
  const finishes: DeckFinish[] = eventFinishes(deck, src.index.events).map((f) => {
    const e = byId.get(f.id);
    return { event: f.id, recorded: f.date, simVersion: typeof e?.simVersion === 'number' ? e.simVersion : null, place: f.place, of: f.of, matchRecord: f.record, gameRecord: f.games, madeTopCut: f.top8, champion: f.champion };
  });
  const pooled = finishes.filter((f) => {
    const e = byId.get(f.event);
    return !!e && inPool(e);
  });
  const m = wl(row?.matches);
  const g = wl(row?.gamesRecord);
  const tier = simTier(row);
  return {
    deck,
    file: row?.file ?? null,
    ...basis,
    rating: row
      ? { value: row.rating, se: typeof row.se === 'number' ? row.se : null, position: ri + 1, of: rows.length, ratedGames: row.games, wrField: row.wrField, lo: row.wrFieldLo, hi: row.wrFieldHi, wrMeta: row.wrMeta, avgFinish: row.avgFinish }
      : null,
    tier,
    tierText: simTierText(tier),
    swiss: row && m ? { matchRecord: row.matches, gameRecord: row.gamesRecord || null, matchesWon: m[0], matchesLost: m[1], gamesWon: g ? g[0] : null, gamesLost: g ? g[1] : null } : null,
    events: row?.events ?? finishes.length,
    titles: pooled.filter((f) => f.champion).length,
    topCutAppearances: pooled.filter((f) => f.madeTopCut).length,
    swissTopEight: row?.top8 ?? 0,
    finishes,
  };
}

// ---------------------------------------------------------------- the ratings table

export interface RatingsTableRow {
  /** place in the ratings file's order (by rating) */
  position: number;
  deck: string;
  file: string;
  rating: number;
  /** expected win rate against the whole field and its 90% range */
  wrField: number;
  lo: number;
  hi: number;
  /** every pooled game the deck played (Swiss and top cut, standard and custom events) */
  ratedGames: number;
  tier: SimTier;
}

export interface RatingsTable extends Basis {
  /** rated decks in the file */
  of: number;
  /** recorded events the ratings were fitted over (null when the file does not say) */
  events: number | null;
  /** the first `top` rows (every row without `top`), in the file's order */
  rows: RatingsTableRow[];
  /** positions (among the rows shown, the first excluded) whose 90% range overlaps the first row's range */
  overlapFirst: number[];
  /** neighbouring rows shown whose 90% ranges do not overlap: [upper position, lower position] */
  separated: [number, number][];
}

/** Two 90% ranges overlap when neither lies wholly above the other. */
export const rangesOverlap = (a: { lo: number; hi: number }, b: { lo: number; hi: number }): boolean => a.lo <= b.hi && b.lo <= a.hi;

/**
 * The ratings table: the first `top` rows of the ratings file in its own order (by rating), each with its expected win
 * rate against the whole field, the 90% range, the rated games and the Sim tier now; and which of the shown ranges
 * overlap (the first row's range with the others, and neighbour with neighbour).
 */
export function ratingsTable(ratings: RatingsInput, o: { top?: number } = {}): RatingsTable {
  const shown = o.top === undefined ? ratings.decks : ratings.decks.slice(0, Math.max(0, o.top));
  const rows: RatingsTableRow[] = shown.map((r, i) => ({ position: i + 1, deck: r.name, file: r.file, rating: r.rating, wrField: r.wrField, lo: r.wrFieldLo, hi: r.wrFieldHi, ratedGames: r.games, tier: simTier(r) }));
  const first = rows[0];
  const separated: [number, number][] = [];
  for (let i = 1; i < rows.length; i++) {
    const [u, d] = [rows[i - 1]!, rows[i]!];
    if (!rangesOverlap(u, d)) separated.push([u.position, d.position]);
  }
  return {
    ...fileBasis(ratings),
    of: ratings.decks.length,
    events: typeof ratings.events === 'number' ? ratings.events : null,
    rows,
    overlapFirst: first ? rows.slice(1).filter((r) => rangesOverlap(first, r)).map((r) => r.position) : [],
    separated,
  };
}

// ---------------------------------------------------------------- one matchup

export interface MatchupFact extends Basis {
  a: string;
  b: string;
  /** both decks are in the head-to-head file */
  known: boolean;
  /** games between them, and a's wins (ties count half) */
  games: number;
  winsA: number;
  /** a's raw win share (null with no games) */
  rawRate: number | null;
  /** a's estimated win probability, shrunk toward the power ratings' prediction (null without a model) */
  estimate: number | null;
  /** the prior's weight in games (how far a pairing's own record moves the prediction) */
  priorGames: number | null;
  /** events pooled in the file */
  events: number | null;
}

/** The head-to-head of a against b (h2hFileLookup in src/lib/h2hModel.ts): shrunk estimate, raw record and games. */
export function matchupFact(a: string, b: string, h2h: H2HInput): MatchupFact {
  const rec = h2hFileLookup(h2h)(a, b);
  return {
    a,
    b,
    ...fileBasis(h2h),
    known: h2h.decks.includes(a) && h2h.decks.includes(b) && a !== b,
    games: rec.g,
    winsA: rec.w,
    rawRate: rec.g ? rec.w / rec.g : null,
    estimate: rec.p ?? null,
    priorGames: h2h.model?.priorGames ?? null,
    events: typeof h2h.events === 'number' ? h2h.events : null,
  };
}
