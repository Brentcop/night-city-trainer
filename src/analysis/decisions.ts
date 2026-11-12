// Decision telemetry → per-card and per-decision-type breakdowns (ROADMAP §5 Method step 4, first cut).
// docs/DECISION_TELEMETRY.md describes the records (src/engine/telemetry.ts) and how to read this report.
//
// Everything here is DESCRIPTIVE ASSOCIATION: "the deck won X% of the games in which it used this card this way". It is
// not the value of the card or of the choice — a card that is used when a game is already going well looks good here
// for that reason alone. Estimating what a choice was worth needs paired counterfactual rollouts (§5 step 3), which this
// does not do. Keep it separate from the IWD numbers in analysis.json / impact.json; nothing in the bots reads it.
//
// Pipeline: aggregateGame(records of one game) → mergeAggregates(...) over all games → decisionReport(aggregate).
// The aggregate is plain counts, so workers aggregate each game where it was played and only counts travel.
import { CARD_BY_ID, cardLabel } from '../engine/cards';
import { DECISION_TELEMETRY_SCHEMA, parseOption, type AttackOutcome, type DecisionRecord } from '../engine/telemetry';
import type { PlayerId } from '../engine/types';
import type { RunManifest } from '../lib/runManifest';
import { GIG_SWING } from '../ai/eval';

/**
 * Game stage, by round: round = ceil(global turn / 2), so both players' Nth turns share a round. Early is rounds 1–2
 * (turns 1–4), middle rounds 3–4 (turns 5–8), late round 5 on (turn 9+). Bot games last about 13 turns (src/data/analysis.json
 * averages 12.5–13.2 per deck), so the three stages cover roughly equal stretches of a typical game. The mulligan
 * (turn 0) counts as early.
 */
const STAGE_ROUNDS = { earlyMax: 2, middleMax: 4 } as const;
export type Stage = 'early' | 'middle' | 'late';
export const STAGES: readonly Stage[] = ['early', 'middle', 'late'];
export function stageOf(turn: number): Stage {
  const round = Math.ceil(Math.max(turn, 1) / 2);
  return round <= STAGE_ROUNDS.earlyMax ? 'early' : round <= STAGE_ROUNDS.middleMax ? 'middle' : 'late';
}
const STAGE_TEXT: Record<Stage, string> = { early: 'turns 1–4', middle: 'turns 5–8', late: 'turn 9+' };

/** Gig standing of the acting player when the decision was made. */
export type Standing = 'ahead' | 'even' | 'behind';
export const STANDINGS: readonly Standing[] = ['ahead', 'even', 'behind'];
const standingOf = (lead: number): Standing => (lead > 0 ? 'ahead' : lead < 0 ? 'behind' : 'even');

/**
 * A slice backed by fewer games than this gets no win rate in the report: it is flagged `thin` and shows only its counts.
 * The same threshold as the site's other small-sample marks (SMALL_SAMPLE in src/lib/playedRecord.ts).
 */
export const MIN_SLICE_GAMES = 20;

/**
 * How a card was used:
 *   play     played from hand in the main phase        sell    sold for an Eddie
 *   call     a face-down Legend called (main phase)    solo    a Legend gone solo
 *   legend   a Legend played to the field by paying its cost, without Go Solo (rule 4.5)
 *   ability  an activated ability (main phase)         attack  declared an attack
 *   react    used in the defender's reaction window: a Call, a Block, a Quick Program or a quick ability
 */
export type UseMode = 'play' | 'sell' | 'call' | 'solo' | 'legend' | 'ability' | 'attack' | 'react';
const USE_MODES: readonly UseMode[] = ['play', 'sell', 'call', 'solo', 'legend', 'ability', 'attack', 'react'];
const MAIN_MODE: Record<string, UseMode> = { play: 'play', sell: 'sell', call: 'call', solo: 'solo', legend: 'legend', ability: 'ability', attack: 'attack' };

/** Option-count buckets for the per-decision-type distribution. */
const OPTION_BUCKETS = ['1', '2', '3-5', '6-10', '11-20', '21+'] as const;
export type OptionBucket = (typeof OPTION_BUCKETS)[number];
export const optionBucket = (n: number): OptionBucket => (n <= 1 ? '1' : n === 2 ? '2' : n <= 5 ? '3-5' : n <= 10 ? '6-10' : n <= 20 ? '11-20' : '21+');

/** How an attack that met a reaction window ended (from the attacker's side). */
const OUTCOMES = ['fizzled', 'stole', 'stoleNothing', 'attackerGone', 'targetGone', 'bothGone', 'noneGone'] as const;
export type OutcomeKey = (typeof OUTCOMES)[number];
function outcomeKey(o: AttackOutcome): OutcomeKey {
  if (o.end === 'fizzled') return 'fizzled';
  if (o.end === 'steal') return o.stolen > 0 ? 'stole' : 'stoleNothing';
  return o.attackerGone && o.targetGone ? 'bothGone' : o.attackerGone ? 'attackerGone' : o.targetGone ? 'targetGone' : 'noneGone';
}

// ------------------------------------------------------------------ aggregate (plain counts, mergeable)

/** Games counted once per slice: `games` games had at least one such use, `wins` of them were won (a tie counts half). */
export interface Cell {
  uses: number;
  games: number;
  wins: number;
}
/** Counts for one card used one way. Slices with no use are left out (sparse), and so is a zero `selfPaid`. */
export interface ModeAgg {
  all: Cell;
  stage: Partial<Record<Stage, Cell>>;
  standing: Partial<Record<Standing, Cell>>;
  /** decisions in which this use was a legal option, and in which it was chosen */
  offered: number;
  chosen: number;
  /** turns (main) or attacks (react) in which it was offered, and of those, the ones in which it was used */
  windows: number;
  windowsUsed: number;
  /** solo / legend: uses in which the Legend helped pay for itself */
  selfPaid?: number;
  /** attack: how those attacks ended */
  outcomes?: Partial<Record<OutcomeKey, number>>;
  /** attack: Gigs stolen in total */
  stolen?: number;
}
export interface KindAgg {
  decisions: number;
  /** the first-listed option was chosen (pass, no more reactions, Yes, the automatic payment source, queue order, ...) */
  firstChosen: number;
  options: Partial<Record<OptionBucket, number>>;
}
export interface ReactionAgg {
  /** attacks in which this deck was asked to react at least once */
  windows: number;
  /** attacks it reacted to at least once, and attacks it let resolve */
  reacted: Cell;
  letResolve: Cell;
  outcomes: { reacted: Partial<Record<OutcomeKey, number>>; letResolve: Partial<Record<OutcomeKey, number>> };
  /** every reaction choice by kind: endReact, call, block, play (a Quick Program), ability */
  choices: Record<string, number>;
}
export interface DeckAgg {
  listId: string;
  name: string;
  games: number;
  wins: number;
  decisions: number;
  cards: Record<string, Partial<Record<UseMode, ModeAgg>>>;
  kinds: Record<string, KindAgg>;
  reactions: ReactionAgg;
}
/**
 * Decisions counted one by one, for the calibration of the bot's own scores: `n` decisions in `games` games, `won` of
 * them made by the side that won the game (ties half). The rate is over decisions; its interval uses the game count
 * (decisions in one game are not independent).
 */
export interface DecCell {
  n: number;
  won: number;
  games: number;
}
/**
 * The bands of the margin the deciding bot claimed for its choice (its chosen option's value minus the best other
 * option's, in Gigs: one Gig swing = GIG_SWING evaluation points). '<0': it chose below its top value (a reaction kept
 * under its 0.5 bar, a near-tie, noise).
 */
export const MARGIN_BANDS = ['<0', '0–0.05', '0.05–0.15', '0.15–0.5', '0.5–1', '1+'] as const;
export type MarginBand = (typeof MARGIN_BANDS)[number];
export function marginBand(points: number): MarginBand {
  const x = points / GIG_SWING;
  return x < 0 ? '<0' : x < 0.05 ? '0–0.05' : x < 0.15 ? '0.05–0.15' : x < 0.5 ? '0.15–0.5' : x < 1 ? '0.5–1' : '1+';
}
/** One bot label and decision type: outcome by claimed margin, and (deep main phase) whether the rollouts overturned the 1-ply pick. */
export interface CalibrationAgg {
  /** decisions with scores */
  scored: number;
  bands: Partial<Record<MarginBand, DecCell>>;
  /** deep main phase: the rollouts kept the 1-ply screen's top pick */
  kept?: DecCell;
  /** deep main phase: the rollouts chose another move than the 1-ply screen's top */
  overturned?: DecCell;
}

export interface DecisionAggregate {
  telemetrySchema: number;
  games: number;
  records: number;
  /** by deck list fingerprint (PlayerState.listId) */
  decks: Record<string, DeckAgg>;
  /** recorder option `scores`: by bot label (ScoreSource.configLabel), then score type ('main deep', 'sell deep', 'react 1ply', ...) */
  calibration?: Record<string, Record<string, CalibrationAgg>>;
}

export interface GamePlayer {
  /** PlayerState.listId; a state built without one is keyed by name */
  listId?: string;
  name: string;
}
export interface GameDecisions {
  records: readonly DecisionRecord[];
  players: readonly [GamePlayer, GamePlayer];
  winner: PlayerId | 'tie' | null;
  /** each seat's bot label (DecisionRecorder.bots), for the calibration section; unlabelled when absent */
  bots?: readonly [string | null, string | null];
}

const cell = (): Cell => ({ uses: 0, games: 0, wins: 0 });
const modeAgg = (): ModeAgg => ({ all: cell(), stage: {}, standing: {}, offered: 0, chosen: 0, windows: 0, windowsUsed: 0 });
const reactionAgg = (): ReactionAgg => ({ windows: 0, reacted: cell(), letResolve: cell(), outcomes: { reacted: {}, letResolve: {} }, choices: {} });
const deckKey = (p: GamePlayer) => p.listId ?? `name:${p.name}`;
export const emptyAggregate = (): DecisionAggregate => ({ telemetrySchema: DECISION_TELEMETRY_SCHEMA, games: 0, records: 0, decks: {} });

/** Decision-type key: the window, or for choices inside effects the kind and tag ('yesno/kerry', 'unit/equip'). */
function decisionType(r: Pick<DecisionRecord, 'w' | 'kind' | 'tag'>): string {
  return r.w === 'effect' ? (r.tag ? `${r.kind}/${r.tag}` : r.kind) : r.w;
}

/** The card a used option is about (null for pass / endReact / a hidden card nothing revealed). */
function cardUseOf(r: DecisionRecord, code: string): { mode: UseMode; id: string } | null {
  const o = parseOption(code);
  if (r.w === 'main') {
    const mode = MAIN_MODE[o.kind];
    if (!mode) return null;
    let id = o.id;
    if (o.kind === 'call' && id === '?') id = r.res?.revealed;
    return id && id !== '?' ? { mode, id } : null;
  }
  if (r.w === 'react') {
    if (o.kind === 'endReact') return null;
    let id = o.id;
    if (o.kind === 'call' && id === '?') id = r.res?.revealed;
    return id && id !== '?' ? { mode: 'react', id } : null;
  }
  return null;
}
/** Every card/mode a decision offered (hidden cards left out), once each. */
function offersOf(r: DecisionRecord): { mode: UseMode; id: string }[] {
  const seen = new Set<string>();
  const out: { mode: UseMode; id: string }[] = [];
  for (const code of r.o) {
    const u = cardUseOf({ ...r, res: undefined }, code);
    if (!u) continue;
    const k = `${u.mode}|${u.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(u);
  }
  return out;
}

/**
 * Aggregate the decision records of one finished game. Pure: the same records give the same counts. Each player's
 * records count toward that player's deck list; a slice counts the game once however many uses it had.
 */
export function aggregateGame(game: GameDecisions): DecisionAggregate {
  const agg = emptyAggregate();
  agg.games = 1;
  agg.records = game.records.length;
  for (const p of [0, 1] as PlayerId[]) {
    const pl = game.players[p];
    const result = game.winner === 'tie' || game.winner === null ? 0.5 : game.winner === p ? 1 : 0;
    const deck: DeckAgg = { listId: deckKey(pl), name: pl.name, games: 1, wins: result, decisions: 0, cards: {}, kinds: {}, reactions: reactionAgg() };
    const mode = (id: string, m: UseMode) => ((deck.cards[id] ??= {})[m] ??= modeAgg());
    // slices this game touched, and windows (turn or attack) offered / used per card+mode
    const touched = new Set<Cell>();
    const offeredWin = new Map<ModeAgg, Set<string>>();
    const usedWin = new Map<ModeAgg, Set<string>>();
    const addWin = (m: Map<ModeAgg, Set<string>>, a: ModeAgg, w: string) => {
      let s = m.get(a);
      if (!s) m.set(a, (s = new Set()));
      s.add(w);
    };
    const attacks = new Map<number, DecisionRecord[]>();
    for (const r of game.records) {
      if (r.p !== p) continue;
      deck.decisions++;
      const kind = (deck.kinds[decisionType(r)] ??= { decisions: 0, firstChosen: 0, options: {} });
      kind.decisions++;
      if (r.c[0] === 0) kind.firstChosen++;
      const b = optionBucket(r.n);
      kind.options[b] = (kind.options[b] ?? 0) + 1;
      if (r.w !== 'main' && r.w !== 'react') continue;
      const win = r.w === 'react' && r.atk ? `a${r.atk.n}` : `t${r.t}`;
      for (const u of offersOf(r)) {
        const a = mode(u.id, u.mode);
        a.offered++;
        addWin(offeredWin, a, win);
      }
      if (r.w === 'react') {
        const kindOf = parseOption(r.ch[0] ?? 'endReact').kind;
        deck.reactions.choices[kindOf] = (deck.reactions.choices[kindOf] ?? 0) + 1;
        if (r.atk) {
          const list = attacks.get(r.atk.n) ?? [];
          list.push(r);
          attacks.set(r.atk.n, list);
        }
      }
      for (const code of r.ch) {
        const u = cardUseOf(r, code);
        if (!u) continue;
        const a = mode(u.id, u.mode);
        a.chosen++;
        addWin(usedWin, a, win);
        // a revealed Call wasn't counted as an offer of this card (it was hidden when offered): count it now
        if ((u.mode === 'call' || u.mode === 'react') && parseOption(code).id === '?') {
          a.offered++;
          addWin(offeredWin, a, win);
        }
        for (const c of [a.all, (a.stage[stageOf(r.t)] ??= cell()), (a.standing[standingOf(r.f.lead)] ??= cell())]) {
          c.uses++;
          touched.add(c);
        }
        if ((u.mode === 'solo' || u.mode === 'legend') && r.pay?.legends.includes(u.id)) a.selfPaid = (a.selfPaid ?? 0) + 1;
        if (u.mode === 'attack' && r.res?.attack) {
          const k = outcomeKey(r.res.attack);
          a.outcomes ??= {};
          a.outcomes[k] = (a.outcomes[k] ?? 0) + 1;
          a.stolen = (a.stolen ?? 0) + r.res.attack.stolen;
        }
      }
    }
    for (const [a, s] of offeredWin) a.windows += s.size;
    for (const [a, s] of usedWin) a.windowsUsed += s.size;
    // reactions: one window per attack this player was asked to react to
    for (const recs of attacks.values()) {
      const rx = deck.reactions;
      rx.windows++;
      const reacted = recs.some((r) => r.ch[0] !== 'endReact');
      const c = reacted ? rx.reacted : rx.letResolve;
      c.uses++;
      touched.add(c);
      const out = recs.find((r) => r.res?.attack)?.res?.attack;
      if (out) {
        const bucket = reacted ? rx.outcomes.reacted : rx.outcomes.letResolve;
        const k = outcomeKey(out);
        bucket[k] = (bucket[k] ?? 0) + 1;
      }
    }
    for (const c of touched) {
      c.games = 1;
      c.wins = result;
    }
    const key = deck.listId;
    agg.decks[key] = agg.decks[key] ? mergeDeck(agg.decks[key], deck) : deck;
    // the bot's own scores (recorder option `scores`): outcome by claimed margin, and 1-ply against deep
    const scored = game.records.filter((r) => r.p === p && r.sc);
    if (scored.length) {
      const bot = game.bots?.[p] ?? 'unlabelled';
      const byType = ((agg.calibration ??= {})[bot] ??= {});
      const inGame = new Set<DecCell>();
      const add = (c: DecCell) => {
        c.n++;
        c.won += result;
        inGame.add(c);
      };
      for (const r of scored) {
        const sc = r.sc!;
        const cal = (byType[scoreType(r)] ??= { scored: 0, bands: {} });
        cal.scored++;
        add((cal.bands[marginBand(sc.m)] ??= decCell()));
        if (sc.r1 !== undefined) add(sc.r1 === 0 ? (cal.kept ??= decCell()) : (cal.overturned ??= decCell()));
      }
      // games are player-games: both seats of one game can add to the same cell
      for (const c of inGame) c.games++;
    }
  }
  return agg;
}

const decCell = (): DecCell => ({ n: 0, won: 0, games: 0 });
const addDec = (a: DecCell, b: DecCell): DecCell => ({ n: a.n + b.n, won: a.won + b.won, games: a.games + b.games });
/** The calibration key of a scored decision: the sell comparison or the decision type, and the scale ('main deep'). */
const scoreType = (r: DecisionRecord) => `${r.sc!.sell ? 'sell' : decisionType(r)} ${r.sc!.by}`;

function mergeCalibration(a: DecisionAggregate['calibration'], b: DecisionAggregate['calibration']): DecisionAggregate['calibration'] {
  if (!a) return b;
  if (!b) return a;
  const out: NonNullable<DecisionAggregate['calibration']> = { ...a };
  for (const [bot, types] of Object.entries(b)) {
    const into = { ...(out[bot] ?? {}) };
    for (const [t, x] of Object.entries(types)) {
      const y = into[t];
      if (!y) {
        into[t] = x;
        continue;
      }
      const bands: CalibrationAgg['bands'] = { ...y.bands };
      for (const [k, c] of Object.entries(x.bands) as [MarginBand, DecCell][]) bands[k] = bands[k] ? addDec(bands[k]!, c) : c;
      const m: CalibrationAgg = { scored: y.scored + x.scored, bands };
      const kept = y.kept && x.kept ? addDec(y.kept, x.kept) : (y.kept ?? x.kept);
      const over = y.overturned && x.overturned ? addDec(y.overturned, x.overturned) : (y.overturned ?? x.overturned);
      if (kept) m.kept = kept;
      if (over) m.overturned = over;
      into[t] = m;
    }
    out[bot] = into;
  }
  return out;
}

const addCell = (a: Cell, b: Cell): Cell => ({ uses: a.uses + b.uses, games: a.games + b.games, wins: a.wins + b.wins });
function addCells<K extends string>(a: Partial<Record<K, Cell>>, b: Partial<Record<K, Cell>>): Partial<Record<K, Cell>> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [K, Cell][]) out[k] = out[k] ? addCell(out[k]!, v) : v;
  return out;
}
function addCounts<K extends string>(a: Partial<Record<K, number>>, b: Partial<Record<K, number>>): Partial<Record<K, number>> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b) as [K, number][]) out[k] = (out[k] ?? 0) + v;
  return out;
}
function mergeMode(a: ModeAgg, b: ModeAgg): ModeAgg {
  const out: ModeAgg = {
    all: addCell(a.all, b.all),
    stage: addCells(a.stage, b.stage),
    standing: addCells(a.standing, b.standing),
    offered: a.offered + b.offered,
    chosen: a.chosen + b.chosen,
    windows: a.windows + b.windows,
    windowsUsed: a.windowsUsed + b.windowsUsed,
  };
  if (a.selfPaid || b.selfPaid) out.selfPaid = (a.selfPaid ?? 0) + (b.selfPaid ?? 0);
  if (a.outcomes || b.outcomes) out.outcomes = addCounts(a.outcomes ?? {}, b.outcomes ?? {});
  if (a.stolen !== undefined || b.stolen !== undefined) out.stolen = (a.stolen ?? 0) + (b.stolen ?? 0);
  return out;
}
function mergeDeck(a: DeckAgg, b: DeckAgg): DeckAgg {
  const cards: DeckAgg['cards'] = { ...a.cards };
  for (const [id, modes] of Object.entries(b.cards)) {
    const into = { ...(cards[id] ?? {}) };
    for (const [m, v] of Object.entries(modes) as [UseMode, ModeAgg][]) into[m] = into[m] ? mergeMode(into[m]!, v) : v;
    cards[id] = into;
  }
  const kinds: DeckAgg['kinds'] = { ...a.kinds };
  for (const [k, v] of Object.entries(b.kinds)) {
    const x = kinds[k];
    kinds[k] = x ? { decisions: x.decisions + v.decisions, firstChosen: x.firstChosen + v.firstChosen, options: addCounts(x.options, v.options) } : v;
  }
  const ra = a.reactions;
  const rb = b.reactions;
  return {
    listId: a.listId,
    name: a.name,
    games: a.games + b.games,
    wins: a.wins + b.wins,
    decisions: a.decisions + b.decisions,
    cards,
    kinds,
    reactions: {
      windows: ra.windows + rb.windows,
      reacted: addCell(ra.reacted, rb.reacted),
      letResolve: addCell(ra.letResolve, rb.letResolve),
      outcomes: { reacted: addCounts(ra.outcomes.reacted, rb.outcomes.reacted), letResolve: addCounts(ra.outcomes.letResolve, rb.outcomes.letResolve) },
      choices: addCounts(ra.choices, rb.choices) as Record<string, number>,
    },
  };
}

/** Sum aggregates (per-game aggregates from workers, or partial runs). Pure; inputs are not changed. */
export function mergeAggregates(...aggs: DecisionAggregate[]): DecisionAggregate {
  const out = emptyAggregate();
  for (const a of aggs) {
    if (a.telemetrySchema !== DECISION_TELEMETRY_SCHEMA) throw new Error(`decision aggregate has telemetry schema ${a.telemetrySchema}; this code reads ${DECISION_TELEMETRY_SCHEMA}`);
    out.games += a.games;
    out.records += a.records;
    for (const [k, d] of Object.entries(a.decks)) out.decks[k] = out.decks[k] ? mergeDeck(out.decks[k], d) : d;
    const cal = mergeCalibration(out.calibration, a.calibration);
    if (cal) out.calibration = cal;
  }
  return out;
}

/** Records of several finished games → one aggregate. */
export const aggregateDecisions = (games: readonly GameDecisions[]): DecisionAggregate => mergeAggregates(...games.map(aggregateGame));

// ------------------------------------------------------------------ report (rates with intervals)

/**
 * Wilson score interval for one proportion (95% by default): `score` successes (ties may count half) out of n. Unlike
 * the normal approximation it stays inside [0, 1] and behaves at small n and at rates near 0 or 1.
 */
export function wilson(score: number, n: number, z = 1.96): { low: number; high: number } {
  if (n <= 0) return { low: 0, high: 1 };
  const p = score / n;
  const z2 = z * z;
  const den = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / den;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** A slice in the report. Below MIN_SLICE_GAMES games it is `thin` and carries counts only (no rate). */
export interface Slice {
  uses: number;
  games: number;
  /** win rate in the games with at least one such use (ties half): an association, not what the use was worth */
  winRate: number | null;
  low95: number | null;
  high95: number | null;
  thin: boolean;
}
export function slice(c: Cell, minGames = MIN_SLICE_GAMES): Slice {
  if (c.games < minGames || c.games === 0) return { uses: c.uses, games: c.games, winRate: null, low95: null, high95: null, thin: true };
  const { low, high } = wilson(c.wins, c.games);
  return { uses: c.uses, games: c.games, winRate: c.wins / c.games, low95: low, high95: high, thin: false };
}

export interface ModeReport {
  mode: UseMode;
  all: Slice;
  stage: Record<Stage, Slice>;
  standing: Record<Standing, Slice>;
  offered: number;
  chosen: number;
  windows: number;
  windowsUsed: number;
  /** of the turns (attacks, for react) in which this use was legal, the share in which it was not taken; null if never offered */
  notChosenRate: number | null;
  selfPaid: number;
  outcomes?: Partial<Record<OutcomeKey, number>>;
  stolen?: number;
}
export interface CardReport {
  id: string;
  name: string;
  modes: ModeReport[];
}
export interface DecisionTypeReport {
  type: string;
  decisions: number;
  firstChosen: number;
  firstChosenRate: number;
  options: Partial<Record<OptionBucket, number>>;
}
export interface ReactionReport {
  windows: number;
  reacted: Slice;
  letResolve: Slice;
  outcomes: ReactionAgg['outcomes'];
  choices: Record<string, number>;
}
export interface DeckDecisionReport {
  listId: string;
  name: string;
  games: number;
  winRate: number;
  decisions: number;
  cards: CardReport[];
  decisionTypes: DecisionTypeReport[];
  reactions: ReactionReport;
}
export interface DecisionReport {
  kind: 'decision-telemetry';
  /** this report's own format */
  reportSchema: 1;
  telemetrySchema: number;
  /** what the numbers are, in one line (shown with them) */
  note: string;
  minSliceGames: number;
  stages: Record<Stage, string>;
  games: number;
  records: number;
  manifest?: RunManifest;
  /** record counts and sizes measured on the run that made the report */
  measurements?: Record<string, number>;
  decks: DeckDecisionReport[];
  /** the same, every list pooled per card (more games per slice, but different decks mixed together) */
  pooled: CardReport[];
  /** the bot's own scores against outcomes (recorder option `scores`), every deck pooled; absent when none were recorded */
  calibration?: CalibrationReport[];
}

/** A rate over decisions (DecCell), with the interval from its game count; `thin` under MIN_SLICE_GAMES games. */
export interface DecSlice {
  decisions: number;
  games: number;
  winRate: number | null;
  low95: number | null;
  high95: number | null;
  thin: boolean;
}
export function decSlice(c: DecCell | undefined, minGames = MIN_SLICE_GAMES): DecSlice {
  const x = c ?? decCell();
  if (x.games < minGames || x.n === 0) return { decisions: x.n, games: x.games, winRate: null, low95: null, high95: null, thin: true };
  const rate = x.won / x.n;
  const { low, high } = wilson(rate * x.games, x.games);
  return { decisions: x.n, games: x.games, winRate: rate, low95: low, high95: high, thin: false };
}
export interface CalibrationReport {
  bot: string;
  /** 'main deep', 'main 1ply', 'sell deep', 'react deep', ... */
  type: string;
  scored: number;
  /** the deciding side's win rate by the margin it claimed for its choice (Gigs) */
  bands: Record<MarginBand, DecSlice>;
  /** deep main phase: decisions where the rollouts kept the 1-ply top pick, and where they overturned it */
  kept?: DecSlice;
  overturned?: DecSlice;
  /** overturned / (kept + overturned) */
  overturnRate?: number;
}

function calibrationReports(cal: NonNullable<DecisionAggregate['calibration']>, minGames: number): CalibrationReport[] {
  const out: CalibrationReport[] = [];
  for (const [bot, types] of Object.entries(cal).sort(([a], [b]) => a.localeCompare(b)))
    for (const [type, c] of Object.entries(types).sort(([, a], [, b]) => b.scored - a.scored)) {
      const r: CalibrationReport = { bot, type, scored: c.scored, bands: Object.fromEntries(MARGIN_BANDS.map((k) => [k, decSlice(c.bands[k], minGames)])) as Record<MarginBand, DecSlice> };
      if (c.kept || c.overturned) {
        r.kept = decSlice(c.kept, minGames);
        r.overturned = decSlice(c.overturned, minGames);
        const k = c.kept?.n ?? 0;
        const o = c.overturned?.n ?? 0;
        r.overturnRate = k + o ? o / (k + o) : 0;
      }
      out.push(r);
    }
  return out;
}

const REPORT_NOTE =
  'Descriptive association only: win rates in games where a card was used a given way, with 95% Wilson intervals. They are not the value of the card or of the choice (no counterfactual comparison yet; ROADMAP §5 steps 3 and 5).';

const nameOf = (id: string) => (CARD_BY_ID[id] ? cardLabel(CARD_BY_ID[id]) : id);

function modeReport(m: UseMode, a: ModeAgg, minGames: number): ModeReport {
  const out: ModeReport = {
    mode: m,
    all: slice(a.all, minGames),
    stage: { early: slice(a.stage.early ?? cell(), minGames), middle: slice(a.stage.middle ?? cell(), minGames), late: slice(a.stage.late ?? cell(), minGames) },
    standing: { ahead: slice(a.standing.ahead ?? cell(), minGames), even: slice(a.standing.even ?? cell(), minGames), behind: slice(a.standing.behind ?? cell(), minGames) },
    offered: a.offered,
    chosen: a.chosen,
    windows: a.windows,
    windowsUsed: a.windowsUsed,
    notChosenRate: a.windows ? 1 - a.windowsUsed / a.windows : null,
    selfPaid: a.selfPaid ?? 0,
  };
  if (a.outcomes) out.outcomes = a.outcomes;
  if (a.stolen !== undefined) out.stolen = a.stolen;
  return out;
}
function cardReports(cards: DeckAgg['cards'], minGames: number): CardReport[] {
  return Object.entries(cards)
    .map(([id, modes]) => ({
      id,
      name: nameOf(id),
      modes: USE_MODES.filter((m) => modes[m]).map((m) => modeReport(m, modes[m]!, minGames)),
    }))
    .filter((c) => c.modes.length)
    .sort((a, b) => b.modes.reduce((s, m) => s + m.all.uses, 0) - a.modes.reduce((s, m) => s + m.all.uses, 0) || a.name.localeCompare(b.name));
}

/** Turn an aggregate into the report: rates with intervals, thin slices flagged, decks by games then name. */
export function decisionReport(agg: DecisionAggregate, o: { manifest?: RunManifest; measurements?: Record<string, number>; minGames?: number } = {}): DecisionReport {
  const minGames = o.minGames ?? MIN_SLICE_GAMES;
  const decks = Object.values(agg.decks)
    .map(
      (d): DeckDecisionReport => ({
        listId: d.listId,
        name: d.name,
        games: d.games,
        winRate: d.games ? d.wins / d.games : 0,
        decisions: d.decisions,
        cards: cardReports(d.cards, minGames),
        decisionTypes: Object.entries(d.kinds)
          .map(([type, k]) => ({ type, decisions: k.decisions, firstChosen: k.firstChosen, firstChosenRate: k.decisions ? k.firstChosen / k.decisions : 0, options: k.options }))
          .sort((a, b) => b.decisions - a.decisions || a.type.localeCompare(b.type)),
        reactions: { windows: d.reactions.windows, reacted: slice(d.reactions.reacted, minGames), letResolve: slice(d.reactions.letResolve, minGames), outcomes: d.reactions.outcomes, choices: d.reactions.choices },
      }),
    )
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));
  // pooled: every list's cards summed per card id (games here are player-games)
  const pooledCards: DeckAgg['cards'] = {};
  for (const d of Object.values(agg.decks))
    for (const [id, modes] of Object.entries(d.cards)) {
      const into = (pooledCards[id] ??= {});
      for (const [m, v] of Object.entries(modes) as [UseMode, ModeAgg][]) into[m] = into[m] ? mergeMode(into[m]!, v) : v;
    }
  const out: DecisionReport = {
    kind: 'decision-telemetry',
    reportSchema: 1,
    telemetrySchema: agg.telemetrySchema,
    note: REPORT_NOTE,
    minSliceGames: minGames,
    stages: STAGE_TEXT,
    games: agg.games,
    records: agg.records,
    decks,
    pooled: cardReports(pooledCards, minGames),
  };
  if (agg.calibration) out.calibration = calibrationReports(agg.calibration, minGames);
  if (o.manifest) out.manifest = o.manifest;
  if (o.measurements) out.measurements = o.measurements;
  return out;
}

// ------------------------------------------------------------------ markdown summary

const MODE_TEXT: Record<UseMode, string> = { play: 'played', sell: 'sold', call: 'called', solo: 'Go Solo', legend: 'Legend play', ability: 'ability', attack: 'attacked', react: 'reaction' };
export const modeText = (m: UseMode) => MODE_TEXT[m];
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);
/** "54% (41–66) n=63", or "n=12 (thin)" */
function sliceText(s: Slice): string {
  if (s.games === 0) return '—';
  if (s.thin) return `n=${s.games} (thin)`;
  return `${pct(s.winRate)} (${Math.round(s.low95! * 100)}–${Math.round(s.high95! * 100)}) n=${s.games}`;
}

/** A readable summary: per deck, the most-used cards by mode, the decision types and the reaction window. */
export function decisionMarkdown(r: DecisionReport, o: { cardsPerDeck?: number } = {}): string {
  const limit = o.cardsPerDeck ?? 15;
  const L: string[] = [
    '# Decision telemetry',
    '',
    `${r.games} game${r.games === 1 ? '' : 's'}, ${r.records} decisions (telemetry schema ${r.telemetrySchema}).${r.manifest ? ` Sim v${r.manifest.simVersion}, ${r.manifest.bot.level} bot, seed ${r.manifest.seedBase}.` : ''}`,
    '',
    `> ${r.note} A slice from fewer than ${r.minSliceGames} games shows only its count ("thin").`,
    '',
    `Stages: early ${r.stages.early}, middle ${r.stages.middle}, late ${r.stages.late}. Ahead / even / behind: the acting player's Gig count against the rival's when the decision was made. "Not chosen": share of the turns (attacks, for reactions) in which the use was legal but not taken.`,
    '',
  ];
  if (r.measurements) L.push(`Measured: ${Object.entries(r.measurements).map(([k, v]) => `${k} ${Number.isInteger(v) ? v : v.toFixed(1)}`).join(', ')}.`, '');
  for (const d of r.decks) {
    L.push(`## ${d.name} — ${d.games} games, ${pct(d.winRate)} won, ${d.decisions} decisions`, '');
    L.push('| Card | Use | Uses | Win rate in games used (95%) | Legal turns → used | Not chosen | Early / mid / late uses | Ahead | Even | Behind |', '|---|---|---|---|---|---|---|---|---|---|');
    const rows = d.cards.flatMap((c) => c.modes.map((m) => ({ c, m }))).sort((a, b) => b.m.all.uses - a.m.all.uses);
    for (const { c, m } of rows.slice(0, limit)) {
      L.push(
        `| ${c.name} | ${MODE_TEXT[m.mode]}${m.selfPaid ? ` (self-paid ${m.selfPaid})` : ''} | ${m.all.uses} | ${sliceText(m.all)} | ${m.windows} → ${m.windowsUsed} | ${pct(m.notChosenRate)} | ${STAGES.map((s) => m.stage[s].uses).join(' / ')} | ${sliceText(m.standing.ahead)} | ${sliceText(m.standing.even)} | ${sliceText(m.standing.behind)} |`,
      );
    }
    if (rows.length > limit) L.push('', `(${rows.length - limit} more card uses in the JSON report.)`);
    const unused = d.cards.flatMap((c) => c.modes.filter((m) => m.windows >= 5 && m.windowsUsed === 0).map((m) => `${c.name} (${MODE_TEXT[m.mode]}, legal in ${m.windows} turns)`));
    if (unused.length) L.push('', `Legal but never taken: ${unused.slice(0, 8).join(', ')}${unused.length > 8 ? ', …' : ''}.`);
    L.push('', '| Decision type | Decisions | First-listed option taken | Options offered (1 / 2 / 3–5 / 6–10 / 11–20 / 21+) |', '|---|---|---|---|');
    for (const t of d.decisionTypes) L.push(`| ${t.type} | ${t.decisions} | ${pct(t.firstChosenRate)} | ${OPTION_BUCKETS.map((b) => t.options[b] ?? 0).join(' / ')} |`);
    const rx = d.reactions;
    if (rx.windows) {
      const oc = (x: Partial<Record<OutcomeKey, number>>) => OUTCOMES.filter((k) => x[k]).map((k) => `${k} ${x[k]}`).join(', ') || '—';
      L.push(
        '',
        `Reaction windows: ${rx.windows} attacks. Reacted to ${rx.reacted.uses} (deck won ${sliceText(rx.reacted)}): ${oc(rx.outcomes.reacted)}. Let ${rx.letResolve.uses} resolve (${sliceText(rx.letResolve)}): ${oc(rx.outcomes.letResolve)}. Choices: ${Object.entries(rx.choices).map(([k, v]) => `${k} ${v}`).join(', ')}.`,
      );
    }
    L.push('');
  }
  if (r.calibration?.length) L.push(...calibrationMarkdown(r.calibration, r.minSliceGames));
  return L.join('\n');
}

/** "54% (41–66) 310 in 63 games", or "12 in 9 games (thin)" */
function decSliceText(s: DecSlice): string {
  if (s.decisions === 0) return '—';
  if (s.thin) return `${s.decisions} in ${s.games} games (thin)`;
  return `${pct(s.winRate)} (${Math.round(s.low95! * 100)}–${Math.round(s.high95! * 100)}) ${s.decisions} in ${s.games} games`;
}

/** The calibration section: the bot's claimed margins against outcomes, and how often the rollouts overturned the 1-ply pick. */
export function calibrationMarkdown(cal: readonly CalibrationReport[], minGames: number): string[] {
  const L: string[] = [
    '## The bot’s own scores against outcomes (calibration check)',
    '',
    `> Association only, like the rest of this report: the deciding side's win rate over its decisions, by the margin the bot claimed for its choice (its value minus the best other option's, in Gigs), and by whether the deep rollouts kept the 1-ply screen's top pick. A big claimed margin often comes in positions that are already won or lost, so a rising win rate is not proof the margins are right; a flat one says they carry little. Intervals use the game count (decisions in one game are not independent); under ${minGames} games a cell shows only its counts.`,
    '',
    `| Bot | Scores | Scored | ${MARGIN_BANDS.map((b) => `${b} Gigs`).join(' | ')} |`,
    `|---|---|---|${MARGIN_BANDS.map(() => '---').join('|')}|`,
  ];
  for (const c of cal) L.push(`| ${c.bot} | ${c.type} | ${c.scored} | ${MARGIN_BANDS.map((b) => decSliceText(c.bands[b])).join(' | ')} |`);
  const deep = cal.filter((c) => c.kept && c.overturned);
  if (deep.length) {
    L.push('', '| Bot | Scores | Deep decisions | Rollouts kept the 1-ply pick | Rollouts overturned it | Overturned |', '|---|---|---|---|---|---|');
    for (const c of deep) L.push(`| ${c.bot} | ${c.type} | ${c.kept!.decisions + c.overturned!.decisions} | ${decSliceText(c.kept!)} | ${decSliceText(c.overturned!)} | ${pct(c.overturnRate ?? null)} |`);
  }
  L.push('');
  return L;
}
