// INFO-9: a played practice game exported with the coach's advice attached, so a session can be reviewed or shared
// later. Plain JSON, versioned (`kind`, `schema: 1`): the replay record (seeds, decks and every answer you gave, the
// same record the browser keeps in localStorage, src/lib/practiceReplays.ts) plus, for each decision the coach advised
// on, what it advised, why, the options it weighed, how your move was graded and the values behind the grade.
// `scripts/review.ts --from file --file <export>.json` reads it and re-runs the full match review on it.
// Pure: the Play page builds the per-decision records as you move (coachedGrade) and the file when you export.
import type { Advice, GradedOption, MoveGrade, MoveVerdict } from '../ai/coach';
import type { Decision, DecisionKind } from '../engine/types';
import { asReplay, type PracticeReplay } from './practiceReplays';
import type { PracticeReviewSpec } from '../sim/practiceReview';

export const COACHED_REPLAY_KIND = 'nct-coached-replay';
export const COACHED_REPLAY_SCHEMA = 1;

/** One decision the coach advised on, with your move and its grade. */
export interface CoachedDecision {
  /** index of your answer among `replay.choices` */
  at: number;
  turn: number;
  kind: DecisionKind;
  tag?: string;
  prompt: string;
  /** every option's label, in the decision's order (indices below refer to these) */
  options: string[];
  /** the option you chose, and the coach's pick */
  chose: number;
  coach: number;
  /** the coach's reason, as shown on the board */
  why: string;
  /** the other options it weighed, best first: gap in Gigs (≥ 0), whether within the noise, paired standard error */
  alternatives: Advice['alternatives'];
  /** the grade of your move (src/ai/coach.ts gradeMove): gap in Gigs (null when not measured) and its standard error */
  verdict: MoveVerdict;
  gap: number | null;
  se?: number;
  /** what the coach scored: main-phase actions, its sell comparison, or reactions (absent when a rule decided) */
  scoreKind?: 'main' | 'sell' | 'reaction';
  /**
   * The coach's values per option it scored, in evaluation points (`gigSwing` points = 1 Gig): `v` the value, `w` the
   * value in each shared world when there were several. Includes a move scored after you made it.
   */
  scores: GradedOption[];
}

export interface CoachedReplay {
  kind: typeof COACHED_REPLAY_KIND;
  schema: typeof COACHED_REPLAY_SCHEMA;
  /** when the file was made (ISO) */
  exported: string;
  /** evaluation points per Gig, the scale of `scores` */
  gigSwing: number;
  replay: PracticeReplay;
  decisions: CoachedDecision[];
}

/** A coach grade as the practice session keeps it: the grade plus the record the export needs (Undo truncates both together). */
export interface CoachedGrade extends MoveGrade {
  record?: CoachedDecision;
}

const scoresOf = (a: Advice, extra: readonly GradedOption[] | undefined): GradedOption[] => {
  const out = new Map<number, GradedOption>();
  for (const o of a.grade?.opts ?? []) out.set(o.i, { i: o.i, v: o.v, ...(o.w ? { w: [...o.w] } : {}) });
  for (const o of extra ?? []) if (!out.has(o.i)) out.set(o.i, { i: o.i, v: o.v, ...(o.w ? { w: [...o.w] } : {}) });
  return [...out.values()];
};

/**
 * The grade of your move at decision `d` with the record the export needs. `at`: how many answers were recorded before
 * this one; `extra`: options scored after the move (scoreMoveRequest), when there were any.
 */
export function coachedGrade(d: Decision, chosen: number, advice: Advice, grade: MoveGrade, at: number, extra?: readonly GradedOption[]): CoachedGrade {
  const record: CoachedDecision = {
    at,
    turn: grade.turn,
    kind: d.kind,
    ...(d.tag !== undefined ? { tag: d.tag } : {}),
    prompt: d.prompt,
    options: d.options.map((o) => o.label),
    chose: chosen,
    coach: advice.index,
    why: advice.why,
    alternatives: advice.alternatives.map((x) => ({ ...x })),
    verdict: grade.verdict,
    gap: grade.gap,
    ...(grade.se !== undefined ? { se: grade.se } : {}),
    ...(advice.grade ? { scoreKind: advice.grade.kind } : {}),
    scores: scoresOf(advice, extra),
  };
  return { ...grade, record };
}

/** The export file of a game: its replay record and the coach's record of every graded decision, in the order made. */
export function buildCoachedReplay(replay: PracticeReplay, grades: readonly CoachedGrade[], exported: string, gigSwing: number): CoachedReplay {
  const decisions = grades.flatMap((g) => (g.record ? [g.record] : [])).filter((r) => r.at < replay.choices.length);
  return {
    kind: COACHED_REPLAY_KIND,
    schema: COACHED_REPLAY_SCHEMA,
    exported,
    gigSwing,
    replay: JSON.parse(JSON.stringify(replay)) as PracticeReplay,
    decisions: JSON.parse(JSON.stringify(decisions)) as CoachedDecision[],
  };
}

const VERDICTS: readonly MoveVerdict[] = ['agree', 'best', 'close', 'inaccuracy', 'mistake', 'pending', 'unscored'];
const isNum = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x);
const isScore = (x: unknown) => {
  const o = x as GradedOption | null;
  return !!o && isNum(o.i) && isNum(o.v) && (o.w === undefined || (Array.isArray(o.w) && o.w.every(isNum)));
};
function isDecision(x: unknown): x is CoachedDecision {
  const r = x as CoachedDecision | null;
  return (
    !!r &&
    typeof r === 'object' &&
    isNum(r.at) &&
    isNum(r.turn) &&
    typeof r.kind === 'string' &&
    typeof r.prompt === 'string' &&
    Array.isArray(r.options) &&
    r.options.every((o) => typeof o === 'string') &&
    isNum(r.chose) &&
    isNum(r.coach) &&
    typeof r.why === 'string' &&
    Array.isArray(r.alternatives) &&
    VERDICTS.includes(r.verdict) &&
    (r.gap === null || isNum(r.gap)) &&
    Array.isArray(r.scores) &&
    r.scores.every(isScore)
  );
}

/** A file read back: the export, or the reason it is not one (wrong kind, a newer schema, or incomplete). Never throws. */
export function parseCoachedReplay(text: string): { ok: true; value: CoachedReplay } | { ok: false; why: string } {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { ok: false, why: 'not JSON' };
  }
  const c = v as Partial<CoachedReplay> | null;
  if (!c || typeof c !== 'object' || c.kind !== COACHED_REPLAY_KIND) return { ok: false, why: `not a coached replay (kind "${COACHED_REPLAY_KIND}")` };
  if (c.schema !== COACHED_REPLAY_SCHEMA) return { ok: false, why: `schema ${String(c.schema)} is not readable here (this version reads schema ${COACHED_REPLAY_SCHEMA})` };
  const replay = asReplay(c.replay);
  if (!replay) return { ok: false, why: 'the replay record is incomplete' };
  if (typeof c.exported !== 'string' || !isNum(c.gigSwing) || !Array.isArray(c.decisions) || !c.decisions.every(isDecision)) return { ok: false, why: 'the coach records are incomplete' };
  return { ok: true, value: { kind: COACHED_REPLAY_KIND, schema: COACHED_REPLAY_SCHEMA, exported: c.exported, gigSwing: c.gigSwing, replay, decisions: c.decisions } };
}

/** What the match reviewer needs to re-simulate the exported game (your seat replays your answers). */
export function coachedReviewSpec(c: CoachedReplay): PracticeReviewSpec {
  const r = c.replay;
  return { decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, payChoice: !!r.payChoice, orderChoice: !!r.orderChoice, ...(r.endTurnClick ? { endTurnClick: true } : {}), conceded: !!r.conceded };
}

/** A file name for the export: deck vs deck and the date. */
export function coachedReplayFileName(c: CoachedReplay): string {
  const slug = (s: string) => s.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40);
  return `nct-game-${slug(c.replay.decks[0].name)}-vs-${slug(c.replay.decks[1].name)}-${c.replay.date.slice(0, 10)}.json`;
}
