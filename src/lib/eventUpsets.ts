// Upsets in a recorded tournament (docs/RAG_PLAN.md step 2.1), judged against what was known before the event, never
// against ratings that include the event itself. Pure, Node and browser: every source is passed in, nothing is read, no
// clock.
//
// The yardstick for event E is one power-rating fit (src/lib/ratingModel.ts `fitRatings`, prior sd 1) on the games of the
// earlier recorded events only: the events before E in recorded order (by id) with E's sim version and bot, their games
// taken exactly as the ratings take them (src/lib/ratingGames.ts, shared with scripts/event-pool.ts; a fit on every pooled
// event reproduces src/data/ratings.json, tests/event-upsets.test.ts). Event 1 has no earlier event: nothing is judged.
//
// A match (Swiss or bracket; a bye is no match) is judged only when both decks have at least MIN_EARLIER_GAMES earlier
// games. The winner's chance per game is the fit's own prediction averaged over both seats, `predictPair`:
// (σ(d + h) + σ(d − h)) / 2 with d the rating difference and h the going-first term, because game 1's seat is a coin flip
// and the loser of each game goes first in the next (src/lib/tournament.ts), so a deck plays both seats. An upset is a
// match won by the deck whose chance per game was at most UPSET_MAX_CHANCE. An upset is a statement about a prediction,
// not about a deck's worth.
//
// How the two constants were chosen (2026-11-14, sim version 8, hard bot, events 2 to 7; regenerate with
// `upsetCalibration`):
//   - MIN_EARLIER_GAMES = 18: the smallest count at which a deck's own rating sd (√ of its diagonal entry in the fit's
//     covariance) is under 0.5, half the prior's sd of 1, so its games hold at least three quarters of the information
//     and the prior's "average" at most a quarter. In the earlier fits the mean sd is 0.68 at 8 games, 0.62 at 12, 0.58
//     at 16 and 0.55 at 17 (the decks of the two seven-deck four-round events), then 0.48 at 19 and 0.46 at 20 (no deck
//     has 18); in sdRating terms the 90% range on the expected win rate against the field is 32 to 43 points wide at 8
//     to 17 games and 24 to 33 at 19 to 20.
//   - UPSET_MAX_CHANCE = 0.30. Over the 641 judged matches the favourite won 128 of 256 (50.0%) with a chance per game
//     of 50 to 60%, 112 of 205 (54.6%) at 60 to 70%, and 150 of 180 (83.3%) at 70% or more: below 70% the earlier
//     ratings barely beat a coin at naming the match winner, above it they clearly do. The mean sd of the rating
//     difference in those matches is 0.44, and a 70% chance is a difference of about 0.85 (σ⁻¹(0.7)), about two of its
//     own standard errors. So an underdog's win counts as an upset only when its chance per game was 30% or less.
import { fitRatings, predictPair, type RatingFit } from './ratingModel';
import { eventRatedGames, type GamesEvent } from './ratingGames';
import { entrantBase } from './eventFormats';

/** A deck needs at least this many games in the earlier events for a match it plays to be judged. */
export const MIN_EARLIER_GAMES = 18;
/** A judged match is an upset when the winner's chance per game, by the earlier ratings, was at most this. */
export const UPSET_MAX_CHANCE = 0.3;
/** The bands of the favourite's chance per game that `upsetCalibration` reports by default. */
export const CALIBRATION_BANDS: readonly (readonly [number, number])[] = [
  [0.5, 0.55],
  [0.55, 0.6],
  [0.6, 0.7],
  [0.7, 1],
];

/** The parts of a recorded event the upsets read (RecordedEvent from src/lib/eventFacts.ts fits it). */
export interface UpsetEvent extends GamesEvent {
  id: number | string;
  name?: string;
  date: string;
  bot: string;
  simVersion?: number;
  rounds: { round: number; matches: { a: string; b: string | null; winner: string; score: [number, number]; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
  bracket: { name: string; matches: { a: string; b: string | null; winner: string; score: [number, number]; games: { first: 0 | 1; winner: 0 | 1 | 'tie' }[] }[] }[];
}

/** The ratings an event's matches are judged against. */
export interface Yardstick {
  simVersion: number | null;
  bot: string;
  /** the earlier events fitted, in recorded order (empty: nothing can be judged) */
  events: (number | string)[];
  /** games in the fit */
  games: number;
  /** the fit (null without earlier games); not for printing */
  fit: RatingFit | null;
}

/** One match of the event, judged or not. */
export interface JudgedMatch {
  stage: 'rounds' | 'bracket';
  /** "Round 5", "Quarterfinals" */
  roundName: string;
  /** the round's key: "5", "quarterfinals" */
  key: string;
  winner: string;
  loser: string;
  /** games won by the winner and by the loser */
  score: [number, number];
  /** both decks had MIN_EARLIER_GAMES earlier games */
  judged: boolean;
  /** null when judged; else why not */
  reason: string | null;
  /** each deck's games in the earlier events (the yardstick's fit) */
  earlierGames: { winner: number; loser: number };
  /** the winner's chance per game by the earlier ratings (null when not judged) */
  winnerChance: number | null;
  upset: boolean;
}

export interface UpsetsFact {
  event: number | string;
  eventName: string;
  simVersion: number | null;
  bot: string;
  /** the event's recorded date, as stored */
  asOf: string;
  /** null: the whole event; else the round asked for ("Round 5", "Final") */
  round: string | null;
  yardstick: { events: (number | string)[]; games: number; minEarlierGames: number; upsetMaxChance: number };
  /** played matches (byes left out), judged and not */
  played: number;
  judged: number;
  notJudged: number;
  /** the upsets, the lowest winner's chance first */
  upsets: JudgedMatch[];
  /** every played match in order: rounds, then the bracket */
  matches: JudgedMatch[];
  /** decks below the minimum in the matches shown, with their earlier games, fewest first (ties by name) */
  belowMinimum: { deck: string; earlierGames: number }[];
}

const byStr = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const versionOf = (e: { simVersion?: number }) => (typeof e.simVersion === 'number' ? e.simVersion : null);
/** Recorded order: numeric ids by number, others by code units (no locale). */
const recordedOrder = (a: { id: number | string }, b: { id: number | string }) => (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : byStr(String(a.id), String(b.id)));

/** The events before `ev` in recorded order with its sim version and bot. */
export function earlierEvents<E extends UpsetEvent>(events: readonly E[], ev: UpsetEvent): E[] {
  return [...events].sort(recordedOrder).filter((e) => recordedOrder(e, ev) < 0 && versionOf(e) === versionOf(ev) && e.bot === ev.bot);
}

/** The ratings fitted on the earlier events' games (the same games the ratings take). */
export function upsetYardstick(events: readonly UpsetEvent[], ev: UpsetEvent): Yardstick {
  const earlier = earlierEvents(events, ev);
  const games = earlier.flatMap(eventRatedGames);
  return { simVersion: versionOf(ev), bot: ev.bot, events: earlier.map((e) => e.id), games: games.length, fit: games.length ? fitRatings(games) : null };
}

const roundKeyOf = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Every played match of the event, judged against the yardstick. */
export function judgeMatches(ev: UpsetEvent, y: Yardstick): JudgedMatch[] {
  const fit = y.fit;
  const idx = new Map((fit?.names ?? []).map((n, i) => [n, i]));
  const earlier = (deck: string) => {
    const i = idx.get(deck);
    return i === undefined ? 0 : fit!.played[i]!;
  };
  const base = (name: string) => entrantBase(ev.setup?.entrants ? { entrants: ev.setup.entrants } : null, name);
  const noEarlier = `no earlier recorded event on sim version ${y.simVersion ?? 'none'} with the ${y.bot} bot`;
  const out: JudgedMatch[] = [];
  const parts = [...ev.rounds.map((r) => ({ stage: 'rounds' as const, name: `Round ${r.round}`, key: String(r.round), matches: r.matches })), ...ev.bracket.map((b) => ({ stage: 'bracket' as const, name: b.name, key: roundKeyOf(b.name), matches: b.matches }))];
  for (const p of parts)
    for (const m of p.matches) {
      if (!m.b) continue;
      const aWon = m.winner === m.a;
      const [winner, loser] = aWon ? [m.a, m.b] : [m.b, m.a];
      const score: [number, number] = aWon ? [m.score[0], m.score[1]] : [m.score[1], m.score[0]];
      const [w, l] = [base(winner), base(loser)];
      const earlierGames = { winner: earlier(w), loser: earlier(l) };
      const few = [[winner, earlierGames.winner], [loser, earlierGames.loser]].filter(([, g]) => (g as number) < MIN_EARLIER_GAMES);
      const reason = !fit
        ? noEarlier
        : w === l
          ? 'a deck against its own copy (not in the ratings)'
          : few.length
            ? `${few.map(([d, g]) => `${d} had ${g} earlier ${g === 1 ? 'game' : 'games'}`).join(' and ')} (fewer than ${MIN_EARLIER_GAMES})`
            : null;
      const winnerChance = reason === null ? predictPair(fit!, idx.get(w)!, idx.get(l)!) : null;
      out.push({ stage: p.stage, roundName: p.name, key: p.key, winner, loser, score, judged: reason === null, reason, earlierGames, winnerChance, upset: winnerChance !== null && winnerChance <= UPSET_MAX_CHANCE });
    }
  return out;
}

/**
 * The upsets of one event, or of one of its rounds (a round number, or a bracket round's name or key). Throws a
 * RangeError for a round the event did not play.
 */
export function eventUpsets(events: readonly UpsetEvent[], ev: UpsetEvent, o: { round?: number | string; yardstick?: Yardstick; judged?: JudgedMatch[] } = {}): UpsetsFact {
  const y = o.yardstick ?? upsetYardstick(events, ev);
  const all = o.judged ?? judgeMatches(ev, y);
  let round: string | null = null;
  let matches = all;
  if (o.round !== undefined) {
    const typed = String(o.round).trim();
    const numbered = /^\d+$/.test(typed);
    const r = numbered ? ev.rounds.find((x) => x.round === Number(typed)) : undefined;
    const b = numbered ? undefined : ev.bracket.find((x) => roundKeyOf(x.name) === roundKeyOf(typed));
    if (!r && !b) throw new RangeError(numbered ? `event ${ev.id} has rounds 1 to ${ev.rounds.length}, not ${typed}` : `event ${ev.id} has no bracket round "${typed}"${ev.bracket.length ? ` (it has ${ev.bracket.map((x) => x.name).join(', ')})` : ''}`);
    round = r ? `Round ${r.round}` : b!.name;
    const key = r ? String(r.round) : roundKeyOf(b!.name);
    matches = all.filter((m) => m.key === key && m.stage === (r ? 'rounds' : 'bracket'));
  }
  const judged = matches.filter((m) => m.judged);
  const below = new Map<string, number>();
  if (y.fit)
    for (const m of matches) {
      if (m.earlierGames.winner < MIN_EARLIER_GAMES) below.set(m.winner, m.earlierGames.winner);
      if (m.earlierGames.loser < MIN_EARLIER_GAMES) below.set(m.loser, m.earlierGames.loser);
    }
  return {
    event: ev.id,
    eventName: ev.name ?? `Event #${ev.id}`,
    simVersion: versionOf(ev),
    bot: ev.bot,
    asOf: ev.date,
    round,
    yardstick: { events: y.events, games: y.games, minEarlierGames: MIN_EARLIER_GAMES, upsetMaxChance: UPSET_MAX_CHANCE },
    played: matches.length,
    judged: judged.length,
    notJudged: matches.length - judged.length,
    upsets: judged.filter((m) => m.upset).sort((a, b) => a.winnerChance! - b.winnerChance! || byStr(a.winner, b.winner)),
    matches,
    belowMinimum: [...below].map(([deck, earlierGames]) => ({ deck, earlierGames })).sort((a, b) => a.earlierGames - b.earlierGames || byStr(a.deck, b.deck)),
  };
}

/** One band of the calibration: judged matches whose favourite's chance per game was in [lo, hi), and how many it won. */
export interface CalibrationBand {
  lo: number;
  hi: number;
  matches: number;
  favouriteWon: number;
}

/**
 * How often the favourite (the deck with the higher chance per game by the earlier ratings) won the match, by band of
 * that chance, over every judged match of every event that has earlier events. The last band includes its top. The
 * evidence for UPSET_MAX_CHANCE: if the bands were flat the ratings would not name match winners better than a coin.
 */
export function upsetCalibration(events: readonly UpsetEvent[], bands: readonly (readonly [number, number])[] = CALIBRATION_BANDS): { events: (number | string)[]; judged: number; bands: CalibrationBand[] } {
  const rows: CalibrationBand[] = bands.map(([lo, hi]) => ({ lo, hi, matches: 0, favouriteWon: 0 }));
  const used: (number | string)[] = [];
  let judged = 0;
  for (const ev of [...events].sort(recordedOrder)) {
    const y = upsetYardstick(events, ev);
    if (!y.fit) continue;
    used.push(ev.id);
    for (const m of judgeMatches(ev, y)) {
      if (m.winnerChance === null) continue;
      judged++;
      const fav = Math.max(m.winnerChance, 1 - m.winnerChance);
      const row = rows.find((r, i) => fav >= r.lo && (fav < r.hi || (i === rows.length - 1 && fav <= r.hi)));
      if (!row) continue;
      row.matches++;
      if (m.winnerChance >= 0.5) row.favouriteWon++;
    }
  }
  return { events: used, judged, bands: rows };
}
