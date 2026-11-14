// Compare a full-information record with the coach and the bots (docs/GAME_RECORD.md "Compare"): the record is replayed
// (./replay.ts) and, at every decision of the seats asked for, the game is stopped and asked, on copies of the position,
//  - the coach, exactly as the Play page asks it: a snapshot of the position (coachRequest), advice for it
//    (adviseRequest), the move graded against the advice (gradeMove), and a move the coach did not value scored in the
//    worlds of its advice (scoreMoveRequest) before it is graded again; decisions the coach does not advise on
//    (coachWorthAsking: one option, a payment, an effect order) are skipped and counted, as the board skips them;
//  - each bot asked for (makeBot), a new one for each decision with a fixed seed, on its own copy of the position.
// Nothing here changes the replay: the copies are made from the state while the replay's hooks are off, and the answer
// given is always the record's. Everything is fixed (the replay seed, the coach's own seed, each bot's seed), so the same
// record gives the same report. Words and caps come from src/lib/coachWords.ts (nothing above 3 Gigs).
// The coach's grades carry noise that the replay seed draws (its play-outs re-deal unseen cards from the replay's random
// state and deck order), so a record is compared under several replay seeds (compareSeeds) and the runs are lined up
// decision by decision (aggregateSeeds): a move is a settled Mistake only under four fifths of the seeds (settledCount).
import { adviseRequest, COACH_WORLDS, coachAdvises, coachRequest, coachWorthAsking, gradeMove, scorable, scoreMoveRequest, type Advice, type CoachRequest, type MoveGrade } from '../../ai/coach';
import type { SeatLift } from '../../ai/packageLift';
import { Game } from '../../engine/engine';
import type { Agent, Decision, PlayerId } from '../../engine/types';
import { behindText, GIG_NOTE, isWideClose, optionName, verdictName, verdictRating } from '../coachWords';
import { fixedTerms } from '../gameReview';
import { coachSummary } from '../practiceLog';
import { makeBot, SIM_VERSION } from '../tournament';
import { isRollIn, seatName } from './describe';
import { reasonCode } from './exporter';
import { eventText, hasUnknown, type GameRecord } from './notation';
import { replayRecord, type ReplayOptions, type ReplayResult, type ReplayStop } from './replay';

/** The bot tiers a comparison can ask (makeBot names). */
export const COMPARE_BOTS = ['easy', 'medium', 'hard'] as const;
export type CompareBot = (typeof COMPARE_BOTS)[number];
/** Asked when no list of bots is given (chosen by time per game: docs/GAME_RECORD.md "Compare"). */
export const DEFAULT_COMPARE_BOTS: readonly CompareBot[] = ['medium', 'hard'];

export interface CompareOptions {
  /** the replay's seed (any seed replays the same game; the coach's 1-ply screen reads the game's random state, so the advice can differ by seed) */
  seed: number;
  resolveDeck: ReplayOptions['resolveDeck'];
  /** the seats whose decisions are compared */
  seats: readonly PlayerId[];
  bots: readonly CompareBot[];
  /** the bots' seeds are derived from this and the decision's place in the game */
  botSeed: number;
  /** the deciding seat's package lift, as the Play page passes it (only the coach's package notes read it) */
  lift?(g: Game, seat: PlayerId): SeatLift | undefined;
  /** called after each compared or skipped decision (progress, timing); never changes the report */
  onStep?(x: { n: number; compared: boolean; ms: { coach: number; bots: Record<string, number> } }): void;
}

export interface BotPick {
  bot: CompareBot;
  /** the option index the bot chose, null when it could not choose here (error says why) */
  index: number | null;
  /** its name as the board shows it */
  pick: string | null;
  /** the same move as the record's player made (same option, or another copy of the same card) */
  agrees: boolean;
  error?: string;
}

export interface ComparedDecision {
  /** the decision's place among all decisions of the game (1-based, both seats, the rule-decided ones included) */
  n: number;
  line: number | null;
  time?: string;
  turn: number;
  seat: PlayerId;
  /** main, reaction, mulligan, roll-in or choice */
  kind: string;
  /** the record's line as written in canonical form */
  recorded: string | null;
  /** the move made, as the board names it */
  played: string;
  playedIndex: number;
  coach: {
    index: number;
    pick: string;
    why: string;
    /** gradeMove's verdict, gap and SE, after scoreMoveRequest when the move made was not among the coach's scored options */
    grade: MoveGrade;
    /** the rating's name (Best, Close call, Slip, Mistake, Blunder), null when not measured */
    rating: string | null;
    /** the grade in the coach's words */
    words: string;
    agrees: boolean;
  };
  bots: BotPick[];
}

export type SkipReason = 'forced' | 'not-advised' | 'declined';
export const SKIP_WORDS: Record<SkipReason, string> = {
  forced: 'one option (forced)',
  'not-advised': 'a payment or an effect order (the coach does not advise on these)',
  declined: 'the coach declined the position (effects still pending; the Play page shows no advice there either)',
};

export interface SkippedDecision {
  n: number;
  line: number | null;
  turn: number;
  seat: PlayerId;
  reason: SkipReason;
  detail?: string;
}

export interface CompareReport {
  ok: boolean;
  /** a record compare refuses before replaying (a hidden card on a compared seat), in one sentence */
  refused?: string;
  /** where the replay stopped, when it did not reach the end */
  stop?: ReplayStop;
  seats: PlayerId[];
  bots: CompareBot[];
  seed: number;
  botSeed: number;
  simVersion: number;
  players: [string, string];
  decks: [string, string];
  /** every decision of the game, both seats */
  decisions: number;
  compared: ComparedDecision[];
  skipped: SkippedDecision[];
  /** decisions of seats not compared */
  otherSeats: number;
  /** how the replayed game ended (null when it stopped) */
  result: { winner: PlayerId | 'tie' | null; turn: number; reason: string } | null;
}

/** The kind of decision in one word. */
export function decisionKind(d: Decision): string {
  if (d.kind === 'action') return 'main';
  if (d.kind === 'reaction') return 'reaction';
  if (d.kind === 'yesno' && d.tag === 'mulligan') return 'mulligan';
  if (isRollIn(d)) return 'roll-in';
  return 'choice';
}

/** The same move: the same option, or another with the same label (another copy of the same card), as gradeMove counts it. */
const sameMove = (d: Decision, a: number, b: number) => a === b || (d.options[a] !== undefined && d.options[a].label === d.options[b]?.label);

/**
 * A grade in the coach's words, as the board's verdict toast reads it (src/ui/components/board/CoachPanel.tsx
 * verdictText, shortened for one line): the rating's name, the gap past a close call, and "not measured" where the coach
 * decided by rule. Every figure goes through behindText (never above 3 Gigs). `byRule`: a decision the coach decides by
 * rule and can't value (not scorable: a target, a mode, a Gig, the mulligan, the die to roll in).
 */
export function gradeWords(gr: MoveGrade, byRule: boolean): string {
  const name = verdictName(gr.verdict, gr.gap) ?? '';
  switch (gr.verdict) {
    case 'agree':
      return name;
    case 'best':
      return `${name} (as strong as the coach's pick)`;
    case 'close':
      if (!isWideClose(gr.gap)) return `${name} (the coach slightly preferred its pick)`;
      if (fixedTerms(gr.se)) return `${name} (not measured: ${behindText(gr.gap ?? 0)}, only by fixed terms of the evaluation)`;
      return `${name} (too noisy to call: ${behindText(gr.gap ?? 0, gr.se)})`;
    case 'inaccuracy':
    case 'mistake':
      return `${name}, ${behindText(gr.gap ?? 0, gr.se)}`;
    case 'pending':
      return 'not scored';
    case 'unscored':
      return byRule ? 'not measured (the coach decides this by rule)' : 'not measured (the move could not be scored)';
  }
}

const noAgent: Agent = {
  name: 'none',
  decide: () => Promise.reject(new Error('a compared position has no agents')),
};

/** A game of its own for a bot to decide in: the coach's snapshot, rebuilt as the coach rebuilds it (coach.ts rebuild). */
function positionCopy(q: CoachRequest): Game {
  const g = new Game(structuredClone(q.state), [noAgent, noAgent]);
  g.pending = q.pending.map((x) => ({ ...x, run: async () => undefined }));
  return g;
}

/** A bot's seed for the n-th decision of the game: fixed by the base seed and the decision's place, nothing else. */
export const botSeedFor = (base: number, n: number, bot: CompareBot) => (base + Math.imul(n, 2654435761) + COMPARE_BOTS.indexOf(bot) * 7919) >>> 0;

/**
 * The record's hidden cards or values that compare refuses: any `?` on a compared seat's side (a hand, a draw, a Legend,
 * a die), an unknown deck of a compared seat, or an unknown first player. One sentence, or null.
 */
export function hiddenRefusal(rec: GameRecord, seats: readonly PlayerId[]): string | null {
  const who = seats.map(seatName).join(' and ');
  const need = `compare needs a full-information record for the seat${seats.length > 1 ? 's' : ''} it compares (every card in hand, every draw, every Legend and every die), and records with hidden cards can't be compared yet`;
  for (const p of seats) if (rec.header.decks[p].kind === 'unknown') return `The header does not say ${seatName(p)}'s deck (“${seatName(p)} deck: ?”), and ${seatName(p)} is compared: ${need}.`;
  if (rec.header.first === null) return `The header does not say who went first (“first: ?”): ${need}.`;
  for (const l of rec.lines) {
    const ev = l.ev;
    if (!hasUnknown(ev)) continue;
    const p = 'p' in ev && ev.p !== null ? ev.p : undefined;
    if (p === undefined || seats.includes(p)) return `Line ${l.line} says “${eventText(ev)}”, which hides a card or value of ${p === undefined ? who : seatName(p)}, the seat${seats.length > 1 && p === undefined ? 's' : ''} being compared: ${need}.`;
  }
  return null;
}

/** Replay the record and compare every decision of `o.seats` with the coach and the bots. */
export async function compareRecord(rec: GameRecord, o: CompareOptions): Promise<CompareReport & { replay: ReplayResult | null }> {
  const seats = [...o.seats].sort() as PlayerId[];
  const bots = COMPARE_BOTS.filter((b) => o.bots.includes(b));
  const base: CompareReport = {
    ok: false,
    seats,
    bots,
    seed: o.seed,
    botSeed: o.botSeed,
    simVersion: SIM_VERSION,
    players: [rec.header.players[0] ?? 'p1', rec.header.players[1] ?? 'p2'],
    decks: ['', ''],
    decisions: 0,
    compared: [],
    skipped: [],
    otherSeats: 0,
    result: null,
  };
  const refused = hiddenRefusal(rec, seats);
  if (refused) return { ...base, refused, replay: null };

  let n = 0;
  const onDecision: ReplayOptions['onDecision'] = async ({ game: g, decision: d, line, answer }) => {
    n++;
    const turn = g.s.turn;
    if (!seats.includes(d.player)) {
      base.otherSeats++;
      return;
    }
    const skip = (reason: SkipReason, detail?: string) => {
      base.skipped.push({ n, line: line?.line ?? null, turn, seat: d.player, reason, ...(detail ? { detail } : {}) });
      o.onStep?.({ n, compared: false, ms: { coach: 0, bots: {} } });
    };
    if (!coachWorthAsking(d)) return skip(coachAdvises(d) ? 'forced' : 'not-advised');
    // the coach, as the Play page asks it (src/ui/useCoach.ts, src/ui/pages/Play.tsx commit)
    const t0 = Date.now();
    const req = coachRequest(g, d, o.lift?.(g, d.player));
    let advice: Advice;
    try {
      advice = await adviseRequest(req);
    } catch (e) {
      return skip('declined', (e as Error).message);
    }
    let grade = gradeMove(d, answer, advice, turn);
    if (grade.verdict === 'pending') {
      const extra = await scoreMoveRequest({ req, chosen: answer, coach: advice.index, ...(advice.grade ? { grade: advice.grade } : {}) }).catch(() => []);
      grade = gradeMove(d, answer, advice, turn, extra);
    }
    const coachMs = Date.now() - t0;
    // each bot on its own copy of the position
    const picks: BotPick[] = [];
    const botMs: Record<string, number> = {};
    for (const b of bots) {
      const t1 = Date.now();
      try {
        const [i] = await makeBot(b, botSeedFor(o.botSeed, n, b)).decide(positionCopy(req), structuredClone(req.decision));
        if (i === undefined || !d.options[i]) throw new Error(`no option ${i}`);
        picks.push({ bot: b, index: i, pick: optionName(d, i), agrees: sameMove(d, i, answer) });
      } catch (e) {
        picks.push({ bot: b, index: null, pick: null, agrees: false, error: (e as Error).message });
      }
      botMs[b] = Date.now() - t1;
    }
    base.compared.push({
      n,
      line: line?.line ?? null,
      ...(line?.time ? { time: line.time } : {}),
      turn,
      seat: d.player,
      kind: decisionKind(d),
      recorded: line ? eventText(line.ev) : null,
      played: optionName(d, answer),
      playedIndex: answer,
      coach: { index: advice.index, pick: optionName(d, advice.index), why: advice.why, grade, rating: verdictName(grade.verdict, grade.gap), words: gradeWords(grade, !scorable(d)), agrees: sameMove(d, answer, advice.index) },
      bots: picks,
    });
    o.onStep?.({ n, compared: true, ms: { coach: coachMs, bots: botMs } });
  };
  const r = await replayRecord(rec, { seed: o.seed, resolveDeck: o.resolveDeck, onDecision });
  base.decisions = n;
  if (r.state) base.decks = [r.state.players[0].name, r.state.players[1].name];
  if (!r.ok) return { ...base, ...(r.stop ? { stop: r.stop } : {}), replay: r };
  const s = r.state!;
  return { ...base, ok: true, result: { winner: s.winner, turn: s.turn, reason: reasonCode(s.winReason) ?? s.winReason }, replay: r };
}

// ------------------------------------------------------------------ the report as text

const BOT_NAME: Record<CompareBot, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : '—');
const of = (a: number, b: number) => `${a} of ${b} (${pct(a, b)})`;
const at = (x: { line: number | null; time?: string }) => `${x.line === null ? 'line —' : `line ${x.line}`}${x.time ? ` [${x.time}]` : ''}`;
const seatsWords = (seats: readonly PlayerId[]) => seats.map(seatName).join(' and ');

/** What every figure in the report is, and what the report depends on. */
export function reportNotes(r: Pick<CompareReport, 'seed' | 'botSeed' | 'bots' | 'simVersion'>, seeds: readonly number[] = [r.seed]): string[] {
  const many = seeds.length > 1;
  return [
    "Every grade and Gig figure is the coach's estimate, from play-outs about a turn ahead of what the deciding player could see (the rival's hand, both decks and face-down Legends are re-dealt in each play-out); it is not the truth about the game. " +
      GIG_NOTE,
    `Why a grade can differ from one replay seed to another: the coach judges each move from a handful of play-outs (${COACH_WORLDS}) with the cards the deciding player can't see re-dealt, and a different replay seed re-deals them differently, so its pick and its grade carry noise. A move the coach grades a Mistake under every seed is a far safer reading than the grades of one run.${many ? '' : ' This report uses one replay seed; --seeds 5 replays the record under five and says how often each grade comes up.'}`,
    `The same record gives the same report. It depends on the record; the replay seed${many ? `s (${seeds.join(', ')})` : ` (${seeds[0]})`}, which set${many ? '' : 's'} the game's random state and the order of the unseen cards in each deck that the replay starts from (any seed replays the same game, but the coach's re-deals, and those of the bots that look ahead, start from that state and that order); the coach and bots of this build (SIM_VERSION ${r.simVersion}; the coach's own fixed seed); ${r.bots.length ? `the bot seed (${r.botSeed}; each bot is made new for each decision, seeded from it and the decision's place in the game)` : 'no bots'}; and, for the wording of the coach's package notes only, public/data/lift.json.`,
  ];
}

/** The comparison as plain text: one line per compared decision, then the summary. */
export function compareText(r: CompareReport, file = 'record'): string {
  const out: string[] = [];
  if (r.refused) return `${r.refused}\n`;
  out.push(`Compare ${file}: ${r.players[0]} (p1, ${r.decks[0]}) vs ${r.players[1]} (p2, ${r.decks[1]})`);
  out.push(`Seats compared: ${seatsWords(r.seats)}. Bots: ${r.bots.length ? r.bots.map((b) => BOT_NAME[b]).join(', ') : 'none'}. Replay seed ${r.seed}${r.bots.length ? `, bot seed ${r.botSeed}` : ''}.`);
  out.push('');
  out.push(`line ${'[time]'.padEnd(9)} turn seat kind      played  →  coach (grade)${r.bots.map((b) => `  ·  ${BOT_NAME[b]}`).join('')}`);
  for (const c of r.compared) {
    const ln = (c.line === null ? '—' : String(c.line)).padStart(4);
    const tm = (c.time ? `[${c.time}]` : '').padEnd(9);
    const coach = `${c.coach.agrees ? 'same' : c.coach.pick}, ${c.coach.words}`;
    const bots = c.bots.map((b) => `  ·  ${BOT_NAME[b.bot]}: ${b.pick === null ? `could not choose (${b.error})` : b.agrees ? 'same' : b.pick}`).join('');
    out.push(`${ln} ${tm} T${String(c.turn).padEnd(3)} ${seatName(c.seat)}   ${c.kind.padEnd(9)} ${c.played}  →  coach: ${coach}${bots}`);
  }
  out.push('');
  out.push('Summary');
  if (!r.ok) out.push(`  The replay stopped${r.stop?.line ? ` at line ${r.stop.line}` : ''}: ${r.stop?.message ?? 'unknown reason'} The figures below cover the decisions before it.`);
  else if (r.result) out.push(`  The game replays to the end as recorded: ${r.result.winner === null || r.result.winner === 'tie' ? 'a draw' : `${seatName(r.result.winner)} wins`} at turn ${r.result.turn} (${r.result.reason}).`);
  const mine = r.compared.length + r.skipped.length;
  out.push(`  Decisions: ${r.decisions} in the game; ${mine} of ${seatsWords(r.seats)}${r.otherSeats ? ` (${r.otherSeats} of the other seat not compared)` : ''}: ${r.compared.length} compared, ${r.skipped.length} skipped.`);
  for (const k of Object.keys(SKIP_WORDS) as SkipReason[]) {
    const x = r.skipped.filter((s) => s.reason === k);
    if (x.length) out.push(`    skipped, ${SKIP_WORDS[k]}: ${x.length}`);
  }
  out.push("  Scorecard, as the Play page counts it (moves the coach measured against its pick: main-phase moves and reactions; choices it decides by rule are not measured):");
  for (const p of r.seats) {
    const grades = r.compared.filter((c) => c.seat === p).map((c) => c.coach.grade);
    const sum = coachSummary(grades);
    const unmeasured = grades.filter((g) => verdictRating(g.verdict, g.gap) === null).length;
    const close = grades.filter((g) => g.verdict === 'close').length;
    if (!sum || !sum.measured) out.push(`    ${seatName(p)} (${r.players[p]}): no moves measured${unmeasured ? `; ${unmeasured} not measured` : ''}.`);
    else out.push(`    ${seatName(p)} (${r.players[p]}): grade ${sum.grade}, ${sum.fine} of ${sum.measured} measured moves Best or a Close call (${sum.pct}%)${close ? `; ${close} close call${close === 1 ? '' : 's'} counted as fine` : ''}${unmeasured ? `; ${unmeasured} not measured` : ''}.`);
  }
  const c = r.compared;
  const measured = c.filter((x) => verdictRating(x.coach.grade.verdict, x.coach.grade.gap) !== null);
  out.push(`  Agreement with the record's moves (the same option, or another copy of the same card):`);
  out.push(`    the coach: ${of(c.filter((x) => x.coach.agrees).length, c.length)} of the compared decisions; ${of(measured.filter((x) => x.coach.agrees).length, measured.length)} of the measured ones`);
  for (const b of r.bots) {
    const picks = c.map((x) => x.bots.find((y) => y.bot === b)!);
    const failed = picks.filter((y) => y.index === null).length;
    out.push(`    ${BOT_NAME[b]}: ${of(picks.filter((y) => y.agrees).length, c.length)}${failed ? ` (${failed} where it could not choose)` : ''}`);
  }
  for (const b of r.bots) {
    const both = c.filter((x) => {
      const y = x.bots.find((z) => z.bot === b)!;
      return y.index !== null && (y.index === x.coach.index || y.pick === x.coach.pick);
    }).length;
    out.push(`    ${BOT_NAME[b]} with the coach's pick: ${of(both, c.length)}`);
  }
  const costly = (v: string) =>
    c
      .filter((x) => x.coach.grade.verdict === v)
      .sort((a, b) => (b.coach.grade.gap ?? 0) - (a.coach.grade.gap ?? 0) || (a.line ?? 0) - (b.line ?? 0));
  const listMoves = (title: string, xs: ComparedDecision[]) => {
    if (!xs.length) {
      out.push(`  ${title}: none.`);
      return;
    }
    out.push(`  ${title}:`);
    for (const x of xs) out.push(`    ${at(x)}, turn ${x.turn}, ${seatName(x.seat)}: ${x.played}  →  coach: ${x.coach.pick}; ${x.coach.words}`);
  };
  listMoves("Costliest moves, the coach's Mistakes (and Blunders), largest first", costly('mistake'));
  listMoves('Slips (behind the coach by more than the noise, less than a Mistake), largest first', costly('inaccuracy'));
  out.push('');
  for (const note of reportNotes(r)) out.push(note);
  return `${out.join('\n')}\n`;
}

/** The report as JSON-ready data (no game state). */
export function compareJson(r: CompareReport & { replay?: unknown }): CompareReport & { notes: string[] } {
  const { replay: _replay, ...plain } = r;
  return { ...plain, notes: reportNotes(r) };
}

// ------------------------------------------------------------------ several replay seeds

/**
 * Replay seeds a comparison runs under by default (`--seeds`). Each seed costs one more comparison (the coach is nearly
 * all of it: about 5 to 10 s a game), and five let one seed disagree while a move still counts as settled (4 of 5).
 */
export const DEFAULT_COMPARE_SEEDS = 5;
export const MAX_COMPARE_SEEDS = 9;
/** The replay seeds of a run: `seed`, `seed` + 1, … (`n` of them). */
export const replaySeeds = (seed: number, n: number): number[] => Array.from({ length: n }, (_, k) => seed + k);
/** Seeds out of `n` that must grade a move a Mistake or worse for it to count as settled: four fifths, rounded up. */
export const settledCount = (n: number) => Math.ceil((4 * n) / 5);

/** How often each value came up, most common first (ties in the order they first came up). */
export interface Tally {
  value: string;
  count: number;
}
export function tally(xs: readonly string[]): Tally[] {
  const out: Tally[] = [];
  for (const x of xs) {
    const t = out.find((y) => y.value === x);
    if (t) t.count++;
    else out.push({ value: x, count: 1 });
  }
  return out.sort((a, b) => b.count - a.count);
}
/** "Mistake in 5 of 5", "Best in 3 of 5, Mistake in 2". */
export function tallyText(t: readonly Tally[], n: number): string {
  return t.map((x, k) => `${x.value} in ${x.count}${k === 0 ? ` of ${n}` : ''}`).join(', ');
}

/** One decision over every replay seed. */
export interface SeedDecision {
  n: number;
  line: number | null;
  time?: string;
  turn: number;
  seat: PlayerId;
  kind: string;
  recorded: string | null;
  played: string;
  /** seeds under which the decision was compared */
  seeds: number;
  /** the coach's pick (as the board names it) and the rating's name ("not measured" when none), over the seeds */
  picks: Tally[];
  ratings: Tally[];
  /** seeds under which the coach agreed with the move made / graded it a Mistake or worse / a Slip */
  agrees: number;
  mistakes: number;
  slips: number;
  /** the median of the gaps the coach measured (Gigs), null when none */
  medianGap: number | null;
  bots: { bot: CompareBot; picks: Tally[]; agrees: number }[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/** Every compared decision of the per-seed reports (one report per replay seed), lined up by its place in the game. Pure. */
export function aggregateSeeds(reports: readonly CompareReport[]): SeedDecision[] {
  const byN = new Map<number, ComparedDecision[]>();
  for (const r of reports) for (const c of r.compared) byN.set(c.n, [...(byN.get(c.n) ?? []), c]);
  return [...byN.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, cs]) => {
      const c = cs[0]!;
      const gaps = cs.flatMap((x) => (x.coach.grade.gap !== null && verdictRating(x.coach.grade.verdict, x.coach.grade.gap) !== null ? [x.coach.grade.gap] : []));
      const bots = c.bots.map((b) => {
        const ps = cs.flatMap((x) => x.bots.filter((y) => y.bot === b.bot));
        return { bot: b.bot, picks: tally(ps.map((p) => p.pick ?? 'could not choose')), agrees: ps.filter((p) => p.agrees).length };
      });
      return {
        n: c.n,
        line: c.line,
        ...(c.time ? { time: c.time } : {}),
        turn: c.turn,
        seat: c.seat,
        kind: c.kind,
        recorded: c.recorded,
        played: c.played,
        seeds: cs.length,
        picks: tally(cs.map((x) => x.coach.pick)),
        ratings: tally(cs.map((x) => x.coach.rating ?? 'not measured')),
        agrees: cs.filter((x) => x.coach.agrees).length,
        mistakes: cs.filter((x) => x.coach.grade.verdict === 'mistake').length,
        slips: cs.filter((x) => x.coach.grade.verdict === 'inaccuracy').length,
        medianGap: median(gaps),
        bots,
      };
    });
}

/** The costly moves over `seeds` seeds: settled (a Mistake or worse under at least four fifths) and sometimes (at least one, fewer). */
export function costlyMoves(ds: readonly SeedDecision[], seeds: number): { settled: SeedDecision[]; sometimes: SeedDecision[] } {
  const need = settledCount(seeds);
  const order = (a: SeedDecision, b: SeedDecision) => (b.medianGap ?? 0) - (a.medianGap ?? 0) || (a.line ?? 0) - (b.line ?? 0);
  return {
    settled: ds.filter((d) => d.mistakes >= need).sort(order),
    sometimes: ds.filter((d) => d.mistakes > 0 && d.mistakes < need).sort(order),
  };
}

/** compareRecord under each replay seed (`seeds`, in order), with the same options otherwise. */
export async function compareSeeds(rec: GameRecord, o: Omit<CompareOptions, 'seed'>, seeds: readonly number[]): Promise<(CompareReport & { replay: ReplayResult | null })[]> {
  const out: (CompareReport & { replay: ReplayResult | null })[] = [];
  for (const seed of seeds) {
    const r = await compareRecord(rec, { ...o, seed });
    out.push(r);
    if (r.refused) break;
  }
  return out;
}

const range = (xs: readonly number[], f: (x: number) => string = String) => {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? f(lo) : `${f(lo)}–${f(hi)}`;
};
const pctOf = (a: number, b: number) => (b ? Math.round((100 * a) / b) : 0);
/** "12 of 20 (60%)" over the seeds, each part a range when the seeds differ. */
const ofRange = (pairs: readonly [number, number][]) => `${range(pairs.map((p) => p[0]))} of ${range(pairs.map((p) => p[1]))} (${range(pairs.map((p) => pctOf(p[0], p[1])), (x) => `${x}%`)})`;
const GRADE_ORDER = ['A', 'B', 'C', 'D', 'F'];

/**
 * The comparison under several replay seeds as plain text. One report gives exactly compareText; with more, each
 * decision gives the coach's pick and grade as how often each came up, and the summary gives ranges over the seeds and
 * the costly moves split into settled and sometimes.
 */
export function seedsText(reports: readonly CompareReport[], file = 'record'): string {
  const first = reports[0];
  if (!first) return '';
  if (reports.length === 1 || first.refused) return compareText(first, file);
  const N = reports.length;
  const seeds = reports.map((r) => r.seed);
  const out: string[] = [];
  out.push(`Compare ${file}: ${first.players[0]} (p1, ${first.decks[0]}) vs ${first.players[1]} (p2, ${first.decks[1]})`);
  out.push(`Seats compared: ${seatsWords(first.seats)}. Bots: ${first.bots.length ? first.bots.map((b) => BOT_NAME[b]).join(', ') : 'none'}. Replay seeds ${seeds.join(', ')}${first.bots.length ? `, bot seed ${first.botSeed}` : ''}.`);
  out.push(`Each grade is how often it came up over the ${N} replay seeds ("Mistake in 5 of 5", "Best in 3 of 5, Mistake in 2"); a pick likewise when it changes.`);
  out.push('');
  out.push(`line ${'[time]'.padEnd(9)} turn seat kind      played  →  coach: pick; grade${first.bots.map((b) => `  ·  ${BOT_NAME[b]}`).join('')}`);
  const ds = aggregateSeeds(reports);
  const pickText = (d: SeedDecision, t: readonly Tally[]) => {
    const named = t.map((x) => ({ ...x, value: x.value === d.played ? 'same' : x.value }));
    return named.length === 1 ? named[0]!.value : tallyText(named, d.seeds);
  };
  for (const d of ds) {
    const ln = (d.line === null ? '—' : String(d.line)).padStart(4);
    const tm = (d.time ? `[${d.time}]` : '').padEnd(9);
    const gap = d.mistakes + d.slips > 0 && d.medianGap !== null ? ` (median ${behindText(d.medianGap)})` : '';
    const bots = d.bots.map((b) => `  ·  ${BOT_NAME[b.bot]}: ${pickText(d, b.picks)}`).join('');
    out.push(`${ln} ${tm} T${String(d.turn).padEnd(3)} ${seatName(d.seat)}   ${d.kind.padEnd(9)} ${d.played}  →  coach: ${pickText(d, d.picks)}; ${tallyText(d.ratings, d.seeds)}${gap}${bots}`);
  }
  out.push('');
  out.push('Summary');
  const stopped = reports.find((r) => !r.ok);
  if (stopped) out.push(`  The replay stopped${stopped.stop?.line ? ` at line ${stopped.stop.line}` : ''}: ${stopped.stop?.message ?? 'unknown reason'} The figures below cover the decisions before it.`);
  else if (first.result) out.push(`  The game replays to the end as recorded under every seed: ${first.result.winner === null || first.result.winner === 'tie' ? 'a draw' : `${seatName(first.result.winner)} wins`} at turn ${first.result.turn} (${first.result.reason}).`);
  const mine = first.compared.length + first.skipped.length;
  out.push(`  Decisions: ${first.decisions} in the game; ${mine} of ${seatsWords(first.seats)}${first.otherSeats ? ` (${first.otherSeats} of the other seat not compared)` : ''}: ${range(reports.map((r) => r.compared.length))} compared, ${range(reports.map((r) => r.skipped.length))} skipped.`);
  for (const k of Object.keys(SKIP_WORDS) as SkipReason[]) {
    const xs = reports.map((r) => r.skipped.filter((s) => s.reason === k).length);
    if (xs.some((x) => x > 0)) out.push(`    skipped, ${SKIP_WORDS[k]}: ${range(xs)}`);
  }
  out.push(`  Scorecard, as the Play page counts it, the range over the ${N} seeds (moves the coach measured against its pick: main-phase moves and reactions; choices it decides by rule are not measured):`);
  for (const p of first.seats) {
    const per = reports.map((r) => r.compared.filter((c) => c.seat === p).map((c) => c.coach.grade));
    const sums = per.map((gs) => coachSummary(gs));
    if (sums.every((s) => !s || !s.measured)) {
      out.push(`    ${seatName(p)} (${first.players[p]}): no moves measured.`);
      continue;
    }
    const grades = [...new Set(sums.map((s) => s?.grade ?? '—'))].sort((a, b) => GRADE_ORDER.indexOf(a) - GRADE_ORDER.indexOf(b));
    const close = per.map((gs) => gs.filter((g) => g.verdict === 'close').length);
    const unmeasured = per.map((gs) => gs.filter((g) => verdictRating(g.verdict, g.gap) === null).length);
    out.push(
      `    ${seatName(p)} (${first.players[p]}): grade ${grades.length === 1 ? grades[0] : `${grades[0]} to ${grades[grades.length - 1]}`}, ${ofRange(sums.map((s) => [s?.fine ?? 0, s?.measured ?? 0]))} measured moves Best or a Close call${close.some((x) => x > 0) ? `; ${range(close)} close calls counted as fine` : ''}${unmeasured.some((x) => x > 0) ? `; ${range(unmeasured)} not measured` : ''}.`,
    );
  }
  out.push(`  Agreement with the record's moves (the same option, or another copy of the same card), the range over the ${N} seeds:`);
  const measuredOf = (r: CompareReport) => r.compared.filter((x) => verdictRating(x.coach.grade.verdict, x.coach.grade.gap) !== null);
  out.push(
    `    the coach: ${ofRange(reports.map((r) => [r.compared.filter((x) => x.coach.agrees).length, r.compared.length]))} of the compared decisions; ${ofRange(reports.map((r) => [measuredOf(r).filter((x) => x.coach.agrees).length, measuredOf(r).length]))} of the measured ones`,
  );
  for (const b of first.bots) out.push(`    ${BOT_NAME[b]}: ${ofRange(reports.map((r) => [r.compared.filter((x) => x.bots.some((y) => y.bot === b && y.agrees)).length, r.compared.length]))}`);
  for (const b of first.bots) {
    const withCoach = (x: ComparedDecision) => x.bots.some((y) => y.bot === b && y.index !== null && (y.index === x.coach.index || y.pick === x.coach.pick));
    out.push(`    ${BOT_NAME[b]} with the coach's pick: ${ofRange(reports.map((r) => [r.compared.filter(withCoach).length, r.compared.length]))}`);
  }
  const need = settledCount(N);
  const { settled, sometimes } = costlyMoves(ds, N);
  const listMoves = (title: string, xs: SeedDecision[]) => {
    if (!xs.length) {
      out.push(`  ${title}: none.`);
      return;
    }
    out.push(`  ${title}:`);
    for (const d of xs) out.push(`    ${at(d)}, turn ${d.turn}, ${seatName(d.seat)}: ${d.played}  →  coach: ${pickText(d, d.picks)}; ${tallyText(d.ratings, d.seeds)}${d.medianGap !== null ? `; median ${behindText(d.medianGap)}` : ''}`);
  };
  listMoves(`Costliest moves, settled (a Mistake or worse under at least ${need} of the ${N} seeds), largest median gap first`, settled);
  listMoves(`Sometimes a Mistake, NOT settled (a Mistake or worse under at least one seed but fewer than ${need}; read these as uncertain), largest median gap first`, sometimes);
  const slipsOnly = ds.filter((d) => d.slips > 0 && d.mistakes === 0).length;
  if (slipsOnly) out.push(`  ${slipsOnly} other move${slipsOnly === 1 ? ' was' : 's were'} a Slip under at least one seed (behind by more than the noise, less than a Mistake).`);
  out.push('');
  for (const note of reportNotes(first, seeds)) out.push(note);
  return `${out.join('\n')}\n`;
}

/** Several seeds as JSON-ready data: each decision over the seeds, the settled and sometimes lists, and each seed's report. */
export function seedsJson(reports: readonly (CompareReport & { replay?: unknown })[]) {
  const first = reports[0]!;
  if (reports.length === 1 || first.refused) return compareJson(first);
  const seeds = reports.map((r) => r.seed);
  const ds = aggregateSeeds(reports);
  const { settled, sometimes } = costlyMoves(ds, reports.length);
  return {
    seeds,
    settledAt: settledCount(reports.length),
    decisions: ds,
    settled: settled.map((d) => d.n),
    sometimes: sometimes.map((d) => d.n),
    reports: reports.map((r) => {
      const { notes: _notes, ...rest } = compareJson(r);
      return rest;
    }),
    notes: reportNotes(first, seeds),
  };
}
