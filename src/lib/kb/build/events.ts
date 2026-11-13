// Knowledge pack builders: measured competitive records (docs/RAG_PLAN.md step 2.2, rules M3 to M5). One `event` record per
// recorded tournament, one `round` record per Swiss round and per bracket round, one `rating` record per rated deck and one
// `matchup` record per pairing with at least MATCHUP_MIN_GAMES games. Every number comes from src/lib/eventFacts.ts and
// every sentence from a template here: the first says what the record is and names the bot and the sim version, a rate
// shows its sample, a rating its 90% range, a matchup its shrunk estimate beside the raw record. Facts only: no ranking
// words, no advice, no cause. Stamps carry the sim version, the bot and the recorded date the data holds (never the
// clock); a record from an older sim version than the current one says so and is flagged `stale`.
import {
  deckCompetitive,
  eventSummary,
  matchupFact,
  roundSummary,
  standingsAfter,
  type Basis,
  type DeckCompetitive,
  type EventIndex,
  type FirstPlayerSplit,
  type H2HInput,
  type RatingsInput,
  type ReasonCount,
  type RecordedEvent,
  type RoundSummary,
  type TurnTally,
} from '../../eventFacts';
import { CURRENT_SIM_VERSION } from '../../playedRecord';
import { byString, type KbFieldValue, type KbLink, type KbRecord } from '../types';
import { deckStem } from './decks';
import { finishRecord } from './record';

/** Matchup records only for pairings with at least this many games; thinner ones are answered by `kb fact matchup`. */
export const MATCHUP_MIN_GAMES = 6;

export interface CompetitiveSources {
  /** every recorded event file, with its path from the repository root */
  events: readonly { file: string; event: RecordedEvent }[];
  index: { file: string; data: EventIndex };
  ratings: { file: string; data: RatingsInput } | null;
  h2h: { file: string; data: H2HInput } | null;
}

// ---------------------------------------------------------------- wording helpers (no locale, no clock)

export const pc1 = (x: number): string => `${(x * 100).toFixed(1)}%`;
/** "12 of 40 (30.0%)": a rate with its sample. */
export const share = (w: number, n: number): string => (n > 0 ? `${w} of ${n} (${pc1(w / n)})` : `${w} of 0`);
/** The date part of a stored ISO date, as stored. */
export const day = (iso: string | null): string => (iso ? iso.slice(0, 10) : 'an unrecorded date');
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "the hard bot on sim version 8" (and "(stale: …)" when older than the current version). */
export function playedBy(b: Basis): string {
  const bot = b.bot ? `the ${b.bot} bot` : 'an unnamed bot';
  if (b.simVersion === null) return `${bot} on an unversioned simulator (stale: the current sim version is ${CURRENT_SIM_VERSION})`;
  return `${bot} on sim version ${b.simVersion}${b.simVersion < CURRENT_SIM_VERSION ? ` (stale: the current sim version is ${CURRENT_SIM_VERSION})` : ''}`;
}

export const isStale = (b: Basis): boolean => b.simVersion === null || b.simVersion < CURRENT_SIM_VERSION;

const firstLine = (f: FirstPlayerSplit) => `The player going first won ${share(f.won, f.decided)} games with a winner${f.ties ? `; ${plural(f.ties, 'tie')}` : ''}.`;
const turnsLine = (t: TurnTally) => (t.mean === null ? 'No games played.' : `Mean game length: ${t.mean.toFixed(2)} turns over ${plural(t.games, 'game')}.`);
const reasonsLine = (rs: readonly ReasonCount[], games: number) => (rs.length ? `How games ended: ${rs.map((r) => `${r.reason}, ${share(r.games, games)}`).join('; ')}.` : null);
const reasonFields = (rs: readonly ReasonCount[]) => Object.fromEntries(rs.map((r) => [`end: ${r.reason}`, r.games]));
const score = (m: { a: string; b: string | null; score: [number, number] }) => (m.b ? `${m.a} ${m.score[0]}-${m.score[1]} ${m.b}` : `${m.a} bye`);

const eventId = (id: number | string) => `event:${id}`;
const roundId = (ev: number | string, key: string) => `round:${ev}/${key}`;
export const ratingId = (file: string) => `rating:${deckStem(file)}`;
/** matchup:<deck a>~<deck b>, the two deck keys in code-unit order. */
export const matchupId = (fileA: string, fileB: string) => `matchup:${[deckStem(fileA), deckStem(fileB)].sort(byString).join('~')}`;

const stamps = (b: Basis) => ({ simVersion: b.simVersion ?? undefined, bot: b.bot ?? undefined, asOf: b.asOf ?? undefined });

// ---------------------------------------------------------------- events and rounds

function eventRecord(file: string, ev: RecordedEvent, deckLink: (name: string | null | undefined) => KbLink[]): KbRecord {
  const s = eventSummary(ev);
  const cut = s.format.topCut;
  const shape = `${plural(s.entrants, 'entrant')}; ${plural(s.format.rounds, s.format.stage === 'swiss' ? 'Swiss round' : 'round')}${cut ? `, then a top cut of ${cut}` : ''}; best of ${s.format.bestOf}.`;
  const champ = !s.champion
    ? 'No champion recorded.'
    : s.final
      ? `Champion: ${s.champion}, winner of the final ${s.final.winner === s.final.a ? `${s.final.score[0]}-${s.final.score[1]}` : `${s.final.score[1]}-${s.final.score[0]}`} against ${s.finalists[1]}.`
      : `Champion: ${s.champion}, first in the standings.`;
  const lines: (string | null)[] = [
    `${s.name}: a recorded ${s.custom ? 'custom event (another format or arranged by hand: its games count for ratings, not for titles or finishes)' : 'tournament'} (${s.format.label}), played by ${playedBy(s)}, recorded ${day(s.asOf)}.`,
    champ,
    shape,
    `Games: ${s.games.total} (rounds ${s.games.rounds}, top cut ${s.games.topCut}).`,
    firstLine(s.firstPlayer),
    turnsLine(s.turns),
    reasonsLine(s.endReasons, s.games.total),
  ];
  if (ev.rounds.length) {
    const st = standingsAfter(ev);
    const shown = st.rows.slice(0, cut || Math.min(8, st.rows.length));
    lines.push(
      `${cut ? `Top-cut seeds (the first ${cut} of the standings after round ${st.round})` : `First ${shown.length} places after round ${st.round}`}: ${shown.map((r) => `${r.place} ${r.deck} ${r.matchRecord}`).join('; ')}.`,
    );
  }
  for (const b of ev.bracket) lines.push(`${b.name}: ${b.matches.map(score).join('; ')}.`);
  return finishRecord({
    id: eventId(ev.id),
    kind: 'event',
    title: s.name,
    aliases: [`event ${ev.id}`, `event #${ev.id}`, `tournament ${ev.id}`, `tournament #${ev.id}`],
    text: lines.filter(Boolean).join('\n'),
    fields: {
      event: typeof ev.id === 'number' ? ev.id : String(ev.id),
      name: s.name,
      recorded: s.asOf,
      format: s.format.label,
      custom: s.custom,
      rounds: s.format.rounds,
      topCut: s.format.topCut,
      bestOf: s.format.bestOf,
      entrants: s.entrants,
      champion: s.champion,
      runnerUp: s.finalists[1] ?? null,
      games: s.games.total,
      roundGames: s.games.rounds,
      topCutGames: s.games.topCut,
      matches: s.matches.played,
      byes: s.matches.byes,
      firstPlayerWins: s.firstPlayer.won,
      gamesWithWinner: s.firstPlayer.decided,
      ties: s.firstPlayer.ties,
      turns: s.turns.total,
      meanTurns: s.turns.mean,
      stale: isStale(s),
      ...reasonFields(s.endReasons),
    },
    links: deckLink(s.champion),
    source: { file },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(s),
  });
}

/** The round sentences (the record's text and `kb fact round`). */
export function roundText(r: RoundSummary): string {
  const what = r.stage === 'bracket' ? `a top-cut round (${r.round} of ${r.of})` : `${r.stage === 'swiss' ? 'a Swiss round' : 'a round'} (${r.round} of ${r.of})`;
  const multi = r.bestOf > 1;
  const lines: (string | null)[] = [
    `${r.eventName}, ${r.name}: ${what} of a recorded tournament, played by ${playedBy(r)}, recorded ${day(r.asOf)}.`,
    `${plural(r.played, 'match', 'matches')}${r.byes ? ` and ${plural(r.byes, 'bye')}` : ''} (best of ${r.bestOf}), ${plural(r.games, 'game')}.`,
    multi ? `Sweeps (the loser won no game): ${share(r.sweeps, r.played)} matches; went to a deciding game ${r.bestOf}: ${share(r.deciders, r.played)}.` : null,
    firstLine(r.firstPlayer),
    turnsLine(r.turns),
    reasonsLine(r.endReasons, r.games),
    r.stage !== 'bracket' && r.leaders.length
      ? `Leaders after ${r.name.toLowerCase()}: ${r.leaders.map((l) => `${l.deck} ${l.matchRecord}`).join('; ')}${r.atTop > r.leaders.length ? `; and ${r.atTop - r.leaders.length} more` : ''} (${plural(r.atTop, 'deck')} on ${r.leaders[0]!.mp} match points).`
      : null,
    `Results: ${r.matches.map(score).join('; ')}.`,
    r.stage === 'bracket' ? (r.round === r.of ? `Champion: ${r.advancing[0] ?? 'none'}.` : `Advancing: ${r.advancing.join('; ')}.`) : null,
  ];
  return lines.filter(Boolean).join('\n');
}

function roundRecord(file: string, ev: RecordedEvent, round: number | string): KbRecord {
  const r = roundSummary(ev, round);
  const tag = r.stage === 'bracket' ? r.name.toLowerCase() : `round ${r.round}`;
  return finishRecord({
    id: roundId(ev.id, r.key),
    kind: 'round',
    title: `${r.eventName}, ${r.name}`,
    aliases: [`event ${ev.id} ${tag}`, `event #${ev.id} ${tag}`, `tournament ${ev.id} ${tag}`, `${tag} of event ${ev.id}`, `${tag} in event ${ev.id}`],
    text: roundText(r),
    fields: {
      event: typeof ev.id === 'number' ? ev.id : String(ev.id),
      stage: r.stage,
      round: r.round,
      of: r.of,
      name: r.name,
      bestOf: r.bestOf,
      matches: r.played,
      byes: r.byes,
      games: r.games,
      sweeps: r.sweeps,
      deciders: r.deciders,
      firstPlayerWins: r.firstPlayer.won,
      gamesWithWinner: r.firstPlayer.decided,
      ties: r.firstPlayer.ties,
      turns: r.turns.total,
      meanTurns: r.turns.mean,
      leadersMatchPoints: r.stage === 'bracket' ? undefined : (r.leaders[0]?.mp ?? null),
      decksOnTop: r.stage === 'bracket' ? undefined : r.atTop,
      stale: isStale(r),
      ...reasonFields(r.endReasons),
    },
    links: [{ rel: 'parent', to: eventId(ev.id) }],
    source: { file, at: r.stage === 'bracket' ? `/bracket/${r.round - 1}` : `/rounds/${r.round - 1}` },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(r),
  });
}

// ---------------------------------------------------------------- ratings

/** The rating sentences: what it is, the expected win rate with its range and games, the tier now, the results. */
export function ratingText(d: DeckCompetitive, o: { events: number | null }): string {
  const r = d.rating;
  const lines: (string | null)[] = [
    `${d.deck} rating: the power rating of a library deck, fitted over ${o.events === null ? 'the recorded events' : `${plural(o.events, 'recorded event')}`} played by ${playedBy(d)}, as of ${day(d.asOf)}.`,
  ];
  if (r) {
    lines.push(
      `Expected win rate against the whole field: ${pc1(r.wrField)} (90% range ${pc1(r.lo)}–${pc1(r.hi)}) over ${plural(r.ratedGames, 'rated game')} (Swiss and top cut).`,
      `Rating ${r.value.toFixed(3)}${r.se === null ? '' : ` (standard error ${r.se.toFixed(3)})`}, position ${r.position} of ${r.of} in the ratings table.`,
      r.wrMeta === null ? null : `Expected win rate against the meta archetypes: ${pc1(r.wrMeta)} (no range recorded).`,
    );
  }
  lines.push(`Sim tier now: ${d.tier.letter ? `${d.tier.letter}${d.tier.straddle ? '±' : ''}` : 'unrated'}. ${d.tierText}`);
  if (d.swiss) {
    const gp = d.swiss.gamesWon !== null && d.swiss.gamesLost !== null ? `; games ${d.swiss.gameRecord}, ${share(d.swiss.gamesWon, d.swiss.gamesWon + d.swiss.gamesLost)} won, ties left out` : '';
    lines.push(`Swiss record in standard events: matches ${d.swiss.matchRecord}, ${share(d.swiss.matchesWon, d.swiss.matchesWon + d.swiss.matchesLost)} won${gp}.`);
  }
  lines.push(
    `Standard events entered: ${d.events}; titles: ${d.titles}; made the real top cut: ${d.topCutAppearances}; Swiss finishes in the first eight places (the ratings file's "top 8" count, whatever the cut): ${d.swissTopEight}.`,
  );
  if (d.finishes.length)
    lines.push(`Finishes: ${d.finishes.map((f) => `Event #${f.event} ${f.place} of ${f.of}, Swiss ${f.matchRecord}${f.champion ? ', champion' : f.madeTopCut ? ', made the top cut' : ''}`).join('; ')}.`);
  return lines.filter(Boolean).join('\n');
}

function ratingRecord(file: string, d: DeckCompetitive, o: { events: number | null; deckLink: KbLink[] }): KbRecord {
  const r = d.rating!;
  return finishRecord({
    id: ratingId(d.file!),
    kind: 'rating',
    title: `${d.deck} rating`,
    aliases: [`${d.deck} power rating`, `${d.deck} sim tier`, `${deckStem(d.file!)} rating`],
    text: ratingText(d, o),
    fields: {
      deck: d.deck,
      file: d.file,
      rating: r.value,
      se: r.se,
      position: r.position,
      of: r.of,
      ratedGames: r.ratedGames,
      wrField: r.wrField,
      wrFieldLo: r.lo,
      wrFieldHi: r.hi,
      wrMeta: r.wrMeta,
      avgFinish: r.avgFinish,
      simTier: d.tier.letter,
      simTierUncertain: d.tier.straddle,
      swissMatches: d.swiss?.matchRecord ?? null,
      swissGames: d.swiss?.gameRecord ?? null,
      events: d.events,
      titles: d.titles,
      topCutAppearances: d.topCutAppearances,
      swissTopEight: d.swissTopEight,
      stale: isStale(d),
    },
    links: o.deckLink,
    source: { file, at: `/decks/${r.position - 1}` },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(d),
  });
}

// ---------------------------------------------------------------- matchups

function matchupRecord(file: string, h2h: H2HInput, a: string, b: string, o: { fileA: string; fileB: string; links: KbLink[]; pair: number }): KbRecord {
  const m = matchupFact(a, b, h2h);
  const est = m.estimate === null ? 'No shrunk estimate in the file.' : `Shrunk estimate: ${pc1(m.estimate)} for ${a} (${pc1(1 - m.estimate)} for ${b}): the power ratings' prediction moved toward this pairing's own record${m.priorGames === null ? '' : ` (prior weight ${m.priorGames} games)`}.`;
  const fields: Record<string, KbFieldValue> = {
    deckA: a,
    deckB: b,
    games: m.games,
    winsA: m.winsA,
    winsB: m.games - m.winsA,
    rawRateA: m.rawRate,
    estimateA: m.estimate,
    priorGames: m.priorGames,
    events: m.events,
    stale: isStale(m),
  };
  return finishRecord({
    id: matchupId(o.fileA, o.fileB),
    kind: 'matchup',
    title: `${a} vs ${b}`,
    aliases: [`${b} vs ${a}`, `${a} against ${b}`, `${b} against ${a}`],
    text: [
      `${a} vs ${b}: a tournament head-to-head pooled from ${m.events === null ? 'the recorded events' : plural(m.events, 'recorded event')}, played by ${playedBy(m)}, as of ${day(m.asOf)}.`,
      `Raw record: ${a} won ${share(m.winsA, m.games)} games (ties count half); ${b} won ${m.games - m.winsA}.`,
      est,
    ].join('\n'),
    fields,
    links: o.links,
    source: { file, at: `/pairs/${o.pair}` },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(m),
  });
}

// ---------------------------------------------------------------- all of them

/**
 * Event, round, rating and matchup records. `deckId(file)` gives the pack id of a library deck (undefined when the deck
 * is not in the library: the link is left out and counted in `skipped`).
 */
export function buildCompetitive(src: CompetitiveSources, o: { deckId: (file: string) => string | undefined; skipped: Record<string, number> }): KbRecord[] {
  const skip = (why: string) => (o.skipped[why] = (o.skipped[why] ?? 0) + 1);
  // deck name → file: the ratings rows, then each event's own list
  const fileOf = new Map<string, string>();
  for (const r of src.ratings?.data.decks ?? []) fileOf.set(r.name, r.file);
  for (const { event } of src.events) for (const [name, d] of Object.entries(event.decks)) if (d.file && !fileOf.has(name)) fileOf.set(name, d.file);
  const deckLink = (name: string | null | undefined): KbLink[] => {
    const f = name ? fileOf.get(name) : undefined;
    const id = f ? o.deckId(f) : undefined;
    if (name && !id) skip('competitive: deck not in the library');
    return id ? [{ rel: 'deck', to: id }] : [];
  };
  const out: KbRecord[] = [];
  for (const { file, event } of src.events) {
    out.push(eventRecord(file, event, deckLink));
    for (let k = 1; k <= event.rounds.length; k++) out.push(roundRecord(file, event, k));
    for (const b of event.bracket) out.push(roundRecord(file, event, b.name));
  }
  if (src.ratings) {
    const events = typeof src.ratings.data.events === 'number' ? src.ratings.data.events : null;
    for (const row of src.ratings.data.decks) {
      const d = deckCompetitive(row.name, { ratings: src.ratings.data, index: src.index.data, h2h: src.h2h?.data });
      out.push(ratingRecord(src.ratings.file, d, { events, deckLink: deckLink(row.name) }));
    }
  }
  if (src.h2h) {
    const h = src.h2h.data;
    h.pairs.forEach(([i, j, , g], q) => {
      if (g < MATCHUP_MIN_GAMES) return;
      const na = h.decks[i];
      const nb = h.decks[j];
      const fa = na === undefined ? undefined : fileOf.get(na);
      const fb = nb === undefined ? undefined : fileOf.get(nb);
      if (na === undefined || nb === undefined || !fa || !fb) {
        skip('matchup: deck file unknown');
        return;
      }
      // written from the side of the deck whose key sorts first, as the id is
      const [a, b, fileA, fileB] = byString(deckStem(fa), deckStem(fb)) <= 0 ? [na, nb, fa, fb] : [nb, na, fb, fa];
      out.push(matchupRecord(src.h2h!.file, h, a, b, { fileA, fileB, links: [...deckLink(a), ...deckLink(b)], pair: q }));
    });
  }
  return out;
}
