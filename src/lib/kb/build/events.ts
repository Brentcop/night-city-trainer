// Knowledge pack builders: measured competitive records (docs/RAG_PLAN.md step 2.2, rules M3 to M5). One `event` record per
// recorded tournament, one `round` record per Swiss round and per bracket round, one `rating` record per rated deck, one
// `rating:table` record listing the first RATINGS_TABLE_TOP rated decks (step 1.6), and one `matchup` record per pairing
// with at least MATCHUP_MIN_GAMES games. Every number comes from src/lib/eventFacts.ts and
// every sentence from a template here: the first says what the record is and names the bot and the sim version, a rate
// shows its sample, a rating its 90% range, a matchup its shrunk estimate beside the raw record. Facts only: no ranking
// words, no advice, no cause. Stamps carry the sim version, the bot and the recorded date the data holds (never the
// clock); a record from an older sim version than the current one says so and is flagged `stale`. A Swiss round record
// also says who moved into or out of the top-cut places and the biggest climb and drop (after the last Swiss round, who
// made the cut and who missed it on tiebreakers: `roundMovement`); round and event records say which matches were upsets
// by the ratings fitted on earlier events only (src/lib/eventUpsets.ts), naming that yardstick and what was not judged.
import {
  deckCompetitive,
  eventSummary,
  matchupFact,
  ratingsTable,
  roundSummary,
  standingsAfter,
  type Basis,
  type DeckCompetitive,
  type EventIndex,
  type FirstPlayerSplit,
  type H2HInput,
  type RatingsInput,
  type RatingsTable,
  type RatingsTableRow,
  type ReasonCount,
  type PlaceChange,
  type RecordedEvent,
  type RoundMovement,
  type RoundSummary,
  type TiebreakStep,
  type TurnTally,
} from '../../eventFacts';
import { eventUpsets, judgeMatches, upsetYardstick, type JudgedMatch, type UpsetsFact } from '../../eventUpsets';
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

function eventRecord(file: string, ev: RecordedEvent, deckLink: (name: string | null | undefined) => KbLink[], upsets: UpsetsFact): KbRecord {
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
  lines.push(...upsetLines(upsets, 'event'));
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
      ...upsetFields(upsets),
    },
    links: deckLink(s.champion),
    source: { file },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(s),
  });
}

// ---------------------------------------------------------------- movement and upsets (wording)

const change = (c: PlaceChange) => `${c.deck} (place ${c.before} to ${c.place})`;
const STEP_WORDS: Record<TiebreakStep, string> = { omw: "opponents' match-win share", gwp: 'game-win share', name: 'deck name order' };

/** The movement sentences of a Swiss round (empty for a bracket round). */
export function movementLines(m: RoundMovement | null): string[] {
  if (!m) return [];
  if (m.notApplicable) return [`Movement around the top-cut places: not applicable (${m.notApplicable}).`];
  const top = `the top-cut places (the first ${m.cut})`;
  const lines: string[] = [];
  if (!m.hasBefore) lines.push(`Movement around ${top}: none counted, as round 1 has no standings before it.`);
  else {
    lines.push(
      m.movedIn.length || m.droppedOut.length
        ? `Into ${top} in round ${m.round}: ${m.movedIn.map(change).join('; ') || 'none'}. Out of them: ${m.droppedOut.map(change).join('; ') || 'none'}.`
        : `No deck moved into or out of ${top} in round ${m.round}.`,
    );
    const most = (what: string, x: RoundMovement['climb']) => (x ? `${what}: ${plural(x.places, 'place')}, ${x.decks.map(change).join('; ')}` : `${what}: none`);
    lines.push(`${most('Biggest climb', m.climb)}. ${most('Biggest drop', m.drop)}.`);
  }
  const c = m.cutLine;
  if (c) {
    lines.push(`Made the top cut of ${m.cut}: ${c.made.map((r) => `${r.place} ${r.deck} ${r.matchRecord}`).join('; ')}.`);
    lines.push(
      c.missedOnTiebreak.length
        ? `Missed the cut on tiebreakers, on the same ${c.last.mp} match points as ${c.last.deck} (place ${c.last.place}, ${c.last.matchRecord}): ${c.missedOnTiebreak.map((r) => `${r.deck} (place ${r.place}, behind on ${STEP_WORDS[r.separatedBy]})`).join('; ')}.`
        : `None missed the cut on tiebreakers: no deck below place ${c.last.place} had the ${c.last.mp} match points of ${c.last.deck} (${c.last.matchRecord}).`,
    );
    if (c.seedsAgree === false) lines.push('The recorded top-cut seeds differ from these places (seeded by hand).');
  }
  return lines;
}

/** "event 1", "events 1 to 5", "events 1, 3 and 4". */
export function eventList(ids: readonly (number | string)[]): string {
  if (ids.length === 1) return `event ${ids[0]}`;
  const nums = ids.every((x) => typeof x === 'number') ? (ids as number[]) : null;
  if (nums && nums.length > 2 && nums.every((x, i) => i === 0 || x === nums[i - 1]! + 1)) return `events ${nums[0]} to ${nums[nums.length - 1]}`;
  return `events ${ids.slice(0, -1).join(', ')} and ${ids[ids.length - 1]}`;
}

/** "the ratings fitted on events 1 to 5 (1234 games)". */
export const yardstickPhrase = (u: UpsetsFact): string => `the ratings fitted on ${eventList(u.yardstick.events)} (${plural(u.yardstick.games, 'game')})`;

const noYardstick = (u: UpsetsFact) => `no earlier recorded event on sim version ${u.simVersion ?? 'none'} with the ${u.bot} bot`;

/** One upset: who beat whom, the score, the winner's chance per game and each deck's earlier games. */
export const upsetLine = (m: JudgedMatch, o: { round?: boolean } = {}): string =>
  `${o.round ? `${m.roundName}: ` : ''}${m.winner} beat ${m.loser} ${m.score[0]}-${m.score[1]}, with a chance per game of ${pc1(m.winnerChance!)}; earlier games: winner ${m.earlierGames.winner}, loser ${m.earlierGames.loser}`;

const notJudgedWhy = (u: UpsetsFact) => {
  const copies = u.matches.filter((m) => !m.judged && m.reason?.startsWith('a deck against its own copy')).length;
  const few = u.notJudged - copies;
  return [few ? `${few} with a deck under ${u.yardstick.minEarlierGames} earlier games` : null, copies ? `${copies} a deck against its own copy` : null].filter(Boolean).join(', ');
};

/** The upset sentences of a round or event record (`scope` names what the counts cover). */
export function upsetLines(u: UpsetsFact, scope: 'round' | 'event'): string[] {
  if (!u.yardstick.events.length) return [`Upsets: not judged, ${noYardstick(u)} to fit ratings on.`];
  if (!u.played) return [];
  const rule = `the winner's chance per game ${pc1(u.yardstick.upsetMaxChance)} or less`;
  const notJ = u.notJudged ? `; ${u.notJudged} of ${u.played} played matches not judged (${notJudgedWhy(u)})` : '';
  const head = u.judged
    ? `Upsets by ${yardstickPhrase(u)}, ${rule}: ${u.upsets.length} of ${u.judged} judged matches${notJ}.`
    : `Upsets by ${yardstickPhrase(u)}: none judged; ${u.notJudged} of ${u.played} played matches not judged (${notJudgedWhy(u)}).`;
  if (!u.upsets.length) return [head];
  if (scope === 'round') return [head, ...u.upsets.map((m) => `Upset: ${upsetLine(m)}.`)];
  return [head, `Largest upset: ${upsetLine(u.upsets[0]!, { round: true })}.`];
}

/** The `kb fact upsets` sentences: the definition, the counts, every upset, and the decks below the minimum. */
export function upsetsText(u: UpsetsFact): string {
  const what = `${u.eventName}${u.round ? `, ${u.round}` : ''} upsets`;
  if (!u.yardstick.events.length) return `${what}: not judged, ${noYardstick(u)} to fit ratings on (played by ${playedBy(u)}, recorded ${day(u.asOf)}).`;
  const lines = [
    `${what}: judged by ${yardstickPhrase(u)}, never by ratings that include this event; played by ${playedBy(u)}, recorded ${day(u.asOf)}.`,
    `An upset is a judged match won by the deck whose chance per game was ${pc1(u.yardstick.upsetMaxChance)} or less (the fit's prediction averaged over going first and second). A match is judged when both decks had ${u.yardstick.minEarlierGames} or more earlier games. An upset is about the prediction, not about a deck's worth.`,
    `Played matches: ${u.played} (byes left out); judged: ${u.judged}; not judged: ${u.notJudged}${u.notJudged ? ` (${notJudgedWhy(u)})` : ''}.`,
    `Upsets: ${u.upsets.length} of ${u.judged} judged matches${u.upsets.length ? ':' : '.'}`,
    ...u.upsets.map((m) => `  ${upsetLine(m, { round: true })}`),
  ];
  if (u.belowMinimum.length) lines.push(`Decks under ${u.yardstick.minEarlierGames} earlier games (earlier games): ${u.belowMinimum.map((d) => `${d.deck} ${d.earlierGames}`).join('; ')}.`);
  return lines.join('\n');
}

/** The upsets of every round of an event and of the whole event, from one yardstick fit. */
export function eventUpsetFacts(events: readonly RecordedEvent[], ev: RecordedEvent): { event: UpsetsFact; round: (round: number | string) => UpsetsFact } {
  const yardstick = upsetYardstick(events, ev);
  const judged = judgeMatches(ev, yardstick);
  return { event: eventUpsets(events, ev, { yardstick, judged }), round: (round) => eventUpsets(events, ev, { round, yardstick, judged }) };
}

/** The round sentences (the record's text and `kb fact round`). */
export function roundText(r: RoundSummary, upsets?: UpsetsFact): string {
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
    ...movementLines(r.movement),
    ...(upsets ? upsetLines(upsets, 'round') : []),
  ];
  return lines.filter(Boolean).join('\n');
}

const upsetFields = (u: UpsetsFact) => ({
  upsets: u.yardstick.events.length ? u.upsets.length : null,
  judgedMatches: u.judged,
  notJudgedMatches: u.notJudged,
  upsetYardstick: u.yardstick.events.length ? eventList(u.yardstick.events) : null,
  upsetYardstickGames: u.yardstick.games,
});

function roundRecord(file: string, ev: RecordedEvent, round: number | string, upsets: UpsetsFact): KbRecord {
  const r = roundSummary(ev, round);
  const mv = r.movement && !r.movement.notApplicable ? r.movement : null;
  const tag = r.stage === 'bracket' ? r.name.toLowerCase() : `round ${r.round}`;
  return finishRecord({
    id: roundId(ev.id, r.key),
    kind: 'round',
    title: `${r.eventName}, ${r.name}`,
    aliases: [`event ${ev.id} ${tag}`, `event #${ev.id} ${tag}`, `tournament ${ev.id} ${tag}`, `${tag} of event ${ev.id}`, `${tag} in event ${ev.id}`],
    text: roundText(r, upsets),
    fields: {
      ...upsetFields(upsets),
      movedIntoCut: mv?.hasBefore ? mv.movedIn.length : undefined,
      droppedOutOfCut: mv?.hasBefore ? mv.droppedOut.length : undefined,
      biggestClimb: mv?.hasBefore ? (mv.climb?.places ?? 0) : undefined,
      biggestDrop: mv?.hasBefore ? (mv.drop?.places ?? 0) : undefined,
      missedCutOnTiebreak: mv?.cutLine ? mv.cutLine.missedOnTiebreak.length : undefined,
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

// ---------------------------------------------------------------- the ratings table

/** How many rows the `rating:table` record lists (`kb fact ratings` lists any number). */
export const RATINGS_TABLE_TOP = 10;
/** The table's id: no library deck file is called "table.txt". */
export const RATINGS_TABLE_ID = 'rating:table';

/** "2–5, 7": positions, runs of consecutive ones joined. */
export function positionList(ps: readonly number[]): string {
  const out: string[] = [];
  for (let i = 0; i < ps.length; ) {
    let j = i;
    while (j + 1 < ps.length && ps[j + 1] === ps[j]! + 1) j++;
    out.push(j > i ? `${ps[i]}–${ps[j]}` : String(ps[i]));
    i = j + 1;
  }
  return out.join(', ');
}

const tierNow = (t: RatingsTableRow['tier']) => (t.letter ? `${t.letter}${t.straddle ? '±' : ''}` : 'unrated');

/** The table sentences (the record's text and `kb fact ratings`): what it is, one line per deck, which ranges overlap. */
export function ratingsTableText(t: RatingsTable): string {
  const n = t.rows.length;
  const lines: string[] = [
    `Power ratings table: the rated library decks in the order of their power rating, fitted over ${t.events === null ? 'the recorded events' : plural(t.events, 'recorded event')} played by ${playedBy(t)}, as of ${day(t.asOf)}. ${n < t.of ? `The first ${n} of ${t.of} rated decks now:` : `All ${t.of} rated decks now:`}`,
    ...t.rows.map((r) => `${r.position}. ${r.deck}: expected win rate against the whole field ${pc1(r.wrField)} (90% range ${pc1(r.lo)}–${pc1(r.hi)}) over ${plural(r.ratedGames, 'rated game')}; Sim tier now ${tierNow(r.tier)}.`),
  ];
  const first = t.rows[0];
  if (first && n > 1) {
    lines.push(
      t.overlapFirst.length === n - 1
        ? `The 90% range of ${first.deck} overlaps the ranges of every other deck listed here: these games do not settle the order among them.`
        : t.overlapFirst.length
          ? `The 90% range of ${first.deck} overlaps the ranges of positions ${positionList(t.overlapFirst)}: these games do not settle the order among them.`
          : `The 90% range of ${first.deck} overlaps no other range listed here.`,
      t.separated.length ? `Neighbouring ranges that do not overlap: ${t.separated.map(([a, b]) => `${a} and ${b}`).join('; ')}; every other neighbouring pair overlaps.` : 'Every neighbouring pair of ranges in this list overlaps.',
    );
  }
  return lines.join('\n');
}

function ratingsTableRecord(file: string, ratings: RatingsInput): KbRecord {
  const t = ratingsTable(ratings, { top: RATINGS_TABLE_TOP });
  return finishRecord({
    id: RATINGS_TABLE_ID,
    kind: 'rating',
    title: 'Power ratings table',
    aliases: ['ratings table', 'rating table', 'power ratings', 'deck ratings', 'strongest decks'],
    text: ratingsTableText(t),
    fields: { of: t.of, shown: t.rows.length, events: t.events, first: t.rows[0]?.deck ?? null, overlapFirst: t.overlapFirst.length, separatedPairs: t.separated.length, stale: isStale(t) },
    links: [],
    source: { file, at: '/decks' },
    origin: 'measured',
    scope: 'public',
    stamps: stamps(t),
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
  const all = src.events.map((e) => e.event);
  for (const { file, event } of src.events) {
    const up = eventUpsetFacts(all, event);
    out.push(eventRecord(file, event, deckLink, up.event));
    for (let k = 1; k <= event.rounds.length; k++) out.push(roundRecord(file, event, k, up.round(k)));
    for (const b of event.bracket) out.push(roundRecord(file, event, b.name, up.round(b.name)));
  }
  if (src.ratings) {
    const events = typeof src.ratings.data.events === 'number' ? src.ratings.data.events : null;
    for (const row of src.ratings.data.decks) {
      const d = deckCompetitive(row.name, { ratings: src.ratings.data, index: src.index.data, h2h: src.h2h?.data });
      out.push(ratingRecord(src.ratings.file, d, { events, deckLink: deckLink(row.name) }));
    }
    if (src.ratings.data.decks.length) out.push(ratingsTableRecord(src.ratings.file, src.ratings.data));
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
