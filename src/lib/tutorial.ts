// The tutorial's lessons, without React: a lesson is a prepared position, a scripted rival and a list of steps (the
// lessons themselves are data in src/content/tutorial/). LessonRun plays one on the real engine: your seat parks each
// decision until the board (or a test) answers it, refuses a move the current step doesn't expect (with the step's
// hint), and moves on when the step's check holds on the game's state. Nothing here is a real game: no record, replay,
// save, coach grade or review is ever written (the only storage the tutorial uses is its progress key,
// src/lib/tutorialProgress.ts).
import { Game } from '../engine/engine';
import type { Action, Agent, CardInst, Decision, DeckList, PlayerId, Reaction, Zone } from '../engine/types';
import { makeTierBot } from '../ai/tiers';

// ---------------------------------------------------------------- positions

/** A Legend in the Legends area, left to right. Face-down unless `faceUp`. */
export interface LegendSpec {
  id: string;
  faceUp?: boolean;
  spent?: boolean;
}
/** A card on the field (a Unit, or a Legend that went solo). */
export interface UnitSpec {
  id: string;
  spent?: boolean;
  lag?: boolean;
  goSolo?: boolean;
  gear?: string[];
}
/** One player's side of a prepared position. Everything left out is empty; the deck is filler under `deck`. */
export interface SideSpec {
  legends: LegendSpec[];
  hand?: string[];
  field?: UnitSpec[];
  /** ready Eddies */
  eddies?: number;
  /** spent Eddies */
  spentEddies?: number;
  /** dice in the Gig area as [sides, value]; the rest stay in the fixer area */
  gigs?: [number, number][];
  /** the top of the deck, top first (filler cards follow) */
  deck?: string[];
  trash?: string[];
}
export interface Position {
  /** the game's random seed (dice rolled later, the Easy bot's choices) */
  seed: number;
  turn: number;
  /** whose main phase the lesson starts in */
  active: PlayerId;
  you: SideSpec;
  rival: SideSpec;
}

/** The card every deck is padded with (a Blue Unit with no text). */
export const TUTORIAL_FILLER = 'psycho_squad';
const DECK_SIZE = 40;

/** Put a new card straight into a zone (plain data, as the engine's own cards are). */
function put(g: Game, p: PlayerId, defId: string, zone: Zone, opts: Partial<CardInst> = {}): CardInst {
  const uid = g.s.nextUid++;
  const c: CardInst = {
    uid,
    defId,
    owner: p,
    controller: p,
    zone,
    spent: false,
    faceUp: zone !== 'hand' && zone !== 'deck' && zone !== 'eddies',
    lag: false,
    gear: [],
    host: null,
    enteredTurn: Math.max(0, g.s.turn - 1),
    goSolo: false,
    ...opts,
  };
  g.s.cards[uid] = c;
  const list = g.zoneList(p, zone)!;
  if (zone === 'deck') list.unshift(uid);
  else list.push(uid);
  return c;
}

/**
 * Build a prepared position: a game created the ordinary way (both decks, Legends, dice), then laid out as the spec
 * says. The game waits in the main phase of `active`; LessonRun continues it with Game.resume().
 */
export function buildPosition(pos: Position, agents: [Agent, Agent]): Game {
  const deckOf = (s: SideSpec, name: string): DeckList => ({ name, legends: s.legends.map((l) => l.id), main: Array(DECK_SIZE).fill(TUTORIAL_FILLER), sideboard: [] });
  const g = Game.create([deckOf(pos.you, 'Your deck'), deckOf(pos.rival, 'Rival deck')], agents, { seed: pos.seed, first: 0, log: true });
  g.s.turn = pos.turn;
  g.s.phase = 'main';
  g.s.active = pos.active;
  for (const p of [0, 1] as PlayerId[]) {
    const spec = p === 0 ? pos.you : pos.rival;
    const ps = g.P(p);
    for (const u of [...ps.hand]) g.move(u, 'deck');
    // the Legends in the spec's order (Game.create shuffled them), face-down unless said otherwise
    const byId = new Map(ps.legends.map((u) => [g.c(u).defId, u]));
    ps.legends = spec.legends.map((l) => byId.get(l.id)!);
    spec.legends.forEach((l, k) => {
      const c = g.c(ps.legends[k]!);
      c.faceUp = !!l.faceUp;
      c.spent = !!l.spent;
    });
    for (const id of [...(spec.deck ?? [])].reverse()) put(g, p, id, 'deck');
    for (const id of spec.hand ?? []) put(g, p, id, 'hand');
    for (const u of spec.field ?? []) {
      const c = put(g, p, u.id, 'field', { spent: !!u.spent, lag: !!u.lag, goSolo: !!u.goSolo, enteredTurn: u.lag ? pos.turn : Math.max(0, pos.turn - 1) });
      for (const gid of u.gear ?? []) {
        const gear = put(g, p, gid, 'hand');
        g.equip(gear.uid, c.uid);
      }
    }
    for (let i = 0; i < (spec.eddies ?? 0); i++) put(g, p, TUTORIAL_FILLER, 'eddies');
    for (let i = 0; i < (spec.spentEddies ?? 0); i++) put(g, p, TUTORIAL_FILLER, 'eddies', { spent: true });
    for (const id of spec.trash ?? []) put(g, p, id, 'trash');
    for (const [sides, value] of spec.gigs ?? []) {
      const id = ps.fixer.find((x) => g.gig(x).sides === sides);
      if (id === undefined) throw new Error(`no d${sides} left in the fixer area`);
      ps.fixer = ps.fixer.filter((x) => x !== id);
      const gig = g.gig(id);
      gig.value = value;
      gig.controller = p;
      ps.gigs.push(id);
    }
  }
  g.s.log = [];
  return g;
}

// ---------------------------------------------------------------- lessons

/** Text for the tutor panel: fixed, or read from the game when it is shown (a die just rolled, a Legend just called). */
export type LessonText = string | ((g: Game) => string);

/**
 * One step of a lesson. A step with `do` answers one decision of yours: `expect` names the options that count as the
 * move (an empty list: this decision isn't the step's), and the step is done once `check` holds on the game's state
 * (checked after every engine update; it must hold by your next decision). A step without `do` only explains: Next
 * finishes it.
 */
export interface Step {
  /** explanation pages shown before the instruction, one at a time (Next) */
  read?: LessonText[];
  /** what to do now */
  do?: LessonText;
  /** the options of the decision that count as this step's move */
  expect?: (d: Decision, g: Game) => number[];
  /** the one to mark on the board when several count (default: the only one, else none) */
  mark?: (d: Decision, g: Game) => number | undefined;
  /** the move happened (the game's state); absent: answering is enough */
  check?: (g: Game) => boolean;
  /** shown once the step is done */
  after?: LessonText;
  /** shown when another move is tried */
  hint?: string;
}

/** The rival's answer to a decision, or undefined to let the Easy bot decide. */
export type RivalScript = (d: Decision, g: Game) => number | undefined;

export interface Lesson {
  id: string;
  title: string;
  /** what it teaches, in a line */
  teaches: string;
  /** the goal, as the lesson list and the panel say it */
  goal: string;
  /** about how long it takes */
  minutes: string;
  position: Position;
  rival: RivalScript;
  steps: Step[];
  /** the lesson's goal, read from the game's state when the steps are done (at your next decision, or game over) */
  goalMet: (g: Game) => boolean;
  /** shown when the lesson is complete */
  done: LessonText;
  /** shown when the steps are done but the goal was missed (only a lesson whose rival is the Easy bot can) */
  missed?: string;
  /** answers for decisions of yours no step is about (the roll-in of a turn the lesson doesn't teach) */
  auto?: (d: Decision, g: Game) => number | undefined;
}

export const textOf = (t: LessonText | undefined, g: Game): string => (t === undefined ? '' : typeof t === 'string' ? t : t(g));

// ---------------------------------------------------------------- helpers lessons use to name options

type AnyAction = Action | Reaction;
const actionOf = (d: Decision, i: number): AnyAction | undefined => d.options[i]?.action;
const idOf = (g: Game, uid: number | null | undefined) => (uid === null || uid === undefined ? null : g.s.cards[uid]?.defId ?? null);

/** Indices of the options whose action passes `pred`. */
export function actionsWhere(d: Decision, pred: (a: AnyAction) => boolean): number[] {
  if (d.kind !== 'action' && d.kind !== 'reaction') return [];
  const out: number[] = [];
  d.options.forEach((_o, i) => {
    const a = actionOf(d, i);
    if (a && pred(a)) out.push(i);
  });
  return out;
}

/** End turn (a main-phase decision's pass). */
export const endTurn = (d: Decision): number[] => (d.kind === 'action' ? actionsWhere(d, (a) => a.type === 'pass') : []);
/** No reaction (a reaction decision's end). */
export const noReaction = (d: Decision): number[] => (d.kind === 'reaction' ? actionsWhere(d, (a) => a.type === 'endReact') : []);
/** Sell, play, Call or Go Solo a card with this id (any copy). */
export const cardAction =
  (type: 'sell' | 'play' | 'call' | 'goSolo', defId?: string) =>
  (d: Decision, g: Game): number[] =>
    actionsWhere(d, (a) => a.type === type && 'uid' in a && (!defId || idOf(g, a.uid) === defId));
/** Attack with a Unit of this id: a rival Unit of that id, or the rival Gig area (`'gigs'`). */
export const attack =
  (attacker: string, target: string | 'gigs') =>
  (d: Decision, g: Game): number[] =>
    actionsWhere(d, (a) => a.type === 'attack' && idOf(g, a.uid) === attacker && (target === 'gigs' ? a.targetGigs !== null : idOf(g, a.targetUnit) === target));
/** Block with a Unit of this id. */
export const block =
  (defId: string) =>
  (d: Decision, g: Game): number[] =>
    actionsWhere(d, (a) => a.type === 'block' && idOf(g, a.uid) === defId);
/** Choose a Unit (a 'unit' decision) of this id. */
export const chooseUnit =
  (defId: string) =>
  (d: Decision, g: Game): number[] =>
    d.kind === 'unit' ? d.options.flatMap((o, i) => (o.uid !== undefined && idOf(g, o.uid) === defId ? [i] : [])) : [];
/** Any option of a decision of this kind (and tag), but not its "None" / "No change". */
export const anyOf =
  (kind: Decision['kind'], tag?: string) =>
  (d: Decision): number[] =>
    d.kind === kind && (tag === undefined || d.tag === tag) ? d.options.flatMap((o, i) => (o.key === 'none' ? [] : [i])) : [];

/** A passive rival: ends its turn, never reacts, keeps its hand, rolls in its smallest die. Anything else: Easy bot. */
export function passiveRival(d: Decision): number | undefined {
  if (d.kind === 'action') return endTurn(d)[0];
  if (d.kind === 'reaction') return noReaction(d)[0];
  if (d.kind === 'yesno' && d.tag === 'mulligan') return d.options.findIndex((o) => o.key === 'no');
  if (d.kind === 'gig' && d.tag === 'rollIn') return 0;
  return undefined;
}

/** A rival that makes these attacks in order (each once, when it can), and is otherwise passive. */
export function rivalAttacks(...moves: [attacker: string, target: string | 'gigs'][]): RivalScript {
  return (d, g) => {
    if (d.kind === 'action') {
      for (const [a, t] of moves) {
        const i = attack(a, t)(d, g)[0];
        if (i !== undefined) return i;
      }
    }
    return passiveRival(d);
  };
}

// ---------------------------------------------------------------- running a lesson

/** Thrown in a lesson's agents once it is over or left, so the game loop unwinds quietly. */
class LessonStopped extends Error {
  constructor() {
    super('lesson stopped');
  }
}

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The rival's seat: the lesson's script, else the Easy bot; paced so you can watch (`pace` 0 in tests). */
class RivalSeat implements Agent {
  name = 'Rival';
  private bot: ReturnType<typeof makeTierBot> | null = null;
  constructor(
    private run: LessonRun,
    private script: RivalScript,
    private seed: number,
    private pace: () => number,
  ) {}
  async decide(g: Game, d: Decision): Promise<number[]> {
    if (this.run.stopped) throw new LessonStopped();
    const i = this.script(d, g);
    let r: number[];
    if (i !== undefined && i >= 0) r = [i];
    else r = await (this.bot ??= makeTierBot('easy', this.seed, 'Rival')).decide(g, d);
    const ms = this.pace();
    if (ms > 0 && (d.kind === 'action' || d.kind === 'reaction')) await delay(ms);
    if (this.run.stopped) throw new LessonStopped();
    return r;
  }
}

export type LessonStatus = 'running' | 'complete' | 'missed' | 'error';

/** What the tutor panel shows now. */
export interface TutorView {
  status: LessonStatus;
  /** 1-based step number, and how many steps */
  step: number;
  steps: number;
  /** the text shown (an explanation page, or the instruction) */
  text: string;
  /** an explanation page: Next moves on */
  canNext: boolean;
  /** the last step's result, shown above the text */
  feedback: string | null;
  /** a refused move: what to do instead */
  hint: string | null;
  /** waiting for the rival (no decision of yours) */
  waiting: boolean;
  /** the end: the lesson's closing words, or why it stopped */
  end: string | null;
}

/**
 * One lesson being played. It is the board's tick source (subscribe / version) and gives the board your seat
 * (`seat.pending` / `seat.answer`). Every decision of yours goes through the current step: the expected move is
 * accepted, anything else is refused with the step's hint. `offPlan` counts decisions no step was about (answered
 * freely); the lesson tests require none.
 */
export class LessonRun {
  readonly g: Game;
  readonly seat: { pending: { d: Decision } | null; answer: (d: Decision | null, i: number) => boolean };
  stopped = false;
  status: LessonStatus = 'running';
  /** index of the current step */
  stepIndex = 0;
  /** explanation page within the current step */
  page = 0;
  /** the current step's move was given; waiting for its check */
  answered = false;
  hint: string | null = null;
  /** how many moves were refused (the board opens a hidden lesson panel again on each) */
  refusals = 0;
  feedback: string | null = null;
  error: string | null = null;
  offPlan = 0;
  /** the decision being answered off the plan (any option goes) */
  private free: Decision | null = null;
  version = 0;
  private listeners = new Set<() => void>();
  private pend: { d: Decision; resolve: (r: number[]) => void; reject: (e: Error) => void } | null = null;
  /** settles when the game loop has stopped (lesson over, left, or the game ended) */
  done: Promise<void> = Promise.resolve();

  constructor(
    readonly lesson: Lesson,
    opts: { pace?: () => number } = {},
  ) {
    const self = this;
    const you: Agent = {
      name: 'You',
      // the engine pays costs (Eddies first) and orders your effects; your turn ends only with End turn
      confirmsEndTurn: true,
      decide: (g, d) => self.decide(g, d),
    };
    const rival = new RivalSeat(this, lesson.rival, lesson.position.seed + 7777, opts.pace ?? (() => 0));
    this.g = buildPosition(lesson.position, [you, rival]);
    this.g.onUpdate = () => this.onUpdate();
    this.seat = {
      get pending() {
        return self.pend ? { d: self.pend.d } : null;
      },
      answer: (d, i) => self.answer(d, i),
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => void this.listeners.delete(fn);
  };
  private bump() {
    this.version++;
    for (const fn of [...this.listeners]) fn();
  }

  /** Start the game from the prepared position. */
  start(): Promise<void> {
    this.done = this.g
      .resume()
      .then(
        () => this.finish(),
        (e: unknown) => {
          if (e instanceof LessonStopped || this.stopped) return;
          this.status = 'error';
          this.error = (e as Error)?.message ?? String(e);
          this.stopped = true;
        },
      )
      .finally(() => this.bump());
    return this.done;
  }

  /** Leave the lesson: the game stops, nothing is kept. */
  stop() {
    this.stopped = true;
    const p = this.pend;
    this.pend = null;
    p?.reject(new LessonStopped());
    this.bump();
  }

  get step(): Step | undefined {
    return this.lesson.steps[this.stepIndex];
  }

  /** The current step's pages, then its instruction. */
  private pages(s: Step | undefined): LessonText[] {
    if (!s) return [];
    return [...(s.read ?? []), ...(s.do !== undefined ? [s.do] : [])];
  }

  /** On an explanation page (Next moves on) rather than the instruction. */
  get canNext(): boolean {
    const s = this.step;
    if (!s || this.status !== 'running') return false;
    const n = this.pages(s).length;
    return s.do === undefined ? this.page < Math.max(1, n) : this.page < n - 1;
  }

  /** Next: the next explanation page, or (an explanation-only step) the next step. */
  next() {
    if (!this.canNext) return;
    const s = this.step!;
    this.page++;
    this.hint = null;
    if (s.do === undefined && this.page >= this.pages(s).length) this.completeStep(false);
    this.settle(!!this.pend);
    this.bump();
  }

  /** The options the current step accepts for the decision waiting now (empty: none, or any). */
  expected(): number[] {
    const d = this.pend?.d;
    if (!d || this.status !== 'running' || this.free === d) return [];
    return this.actionableStep(d)?.expect(d, this.g) ?? [];
  }

  /** The option to mark on the board now: the step's pick among those it accepts, or the only one. */
  marked(): number | null {
    const d = this.pend?.d;
    const ok = this.expected();
    if (!d || !ok.length) return null;
    const m = this.actionableStep(d)?.step.mark?.(d, this.g);
    if (m !== undefined && ok.includes(m)) return m;
    return ok.length === 1 ? (ok[0] ?? null) : null;
  }

  /** The step that takes decision `d`: the current one, or the next one after explanation-only steps. */
  private actionableStep(d: Decision): { k: number; step: Step; expect: NonNullable<Step['expect']> } | null {
    for (let k = this.stepIndex; k < this.lesson.steps.length; k++) {
      const step = this.lesson.steps[k];
      if (!step || step.do === undefined) continue;
      if (k === this.stepIndex && this.answered) return null;
      const expect = step.expect;
      return expect && expect(d, this.g).length ? { k, step, expect } : null;
    }
    return null;
  }

  private answer(d: Decision | null, i: number): boolean {
    const p = this.pend;
    if (!p || !d || p.d !== d || this.status !== 'running') return false;
    if (!Number.isInteger(i) || i < 0 || i >= d.options.length) return false;
    const at = this.free === d ? null : this.actionableStep(d);
    if (at === null) return this.resolve(i);
    const ok = at.expect(d, this.g).includes(i);
    if (!ok) {
      this.hint = at.step.hint ?? 'That is not this step’s move: follow the instruction above.';
      this.refusals++;
      this.bump();
      return false;
    }
    // explanation-only steps before it are skipped by acting
    while (this.stepIndex < at.k) this.completeStep(false);
    this.answered = true;
    this.hint = null;
    return this.resolve(i);
  }

  private resolve(i: number): boolean {
    const p = this.pend!;
    this.pend = null;
    this.free = null;
    p.resolve([i]);
    this.settle(false);
    this.bump();
    return true;
  }

  private decide(_g: Game, d: Decision): Promise<number[]> {
    if (this.stopped) return Promise.reject(new LessonStopped());
    this.settle(true);
    if (this.status !== 'running') {
      this.stopped = true;
      this.bump();
      return Promise.reject(new LessonStopped());
    }
    const planned = this.actionableStep(d) !== null;
    const auto = planned ? undefined : this.lesson.auto?.(d, this.g);
    if (auto !== undefined && auto >= 0 && auto < d.options.length) return Promise.resolve([auto]);
    return new Promise((resolve, reject) => {
      this.pend = { d, resolve, reject };
      if (!planned) {
        // no step is about this decision: any answer goes (a lesson bug; the lesson tests require none)
        this.free = d;
        this.offPlan++;
      }
      this.bump();
    });
  }

  private onUpdate() {
    this.settle(false);
    this.bump();
  }

  private completeStep(withAfter: boolean) {
    const s = this.step;
    this.feedback = withAfter && s?.after !== undefined ? textOf(s.after, this.g) : null;
    this.stepIndex++;
    this.page = 0;
    this.answered = false;
  }

  /**
   * Move on past steps whose move was given and whose check holds. `atDecision`: you are being asked something (or the
   * game is over), so a step still waiting for its check went wrong, and with every step done the goal is judged.
   */
  private settle(atDecision: boolean) {
    if (this.status !== 'running') return;
    while (this.step && this.answered) {
      const s = this.step;
      if (s.check && !s.check(this.g)) {
        if (atDecision) {
          this.status = 'error';
          this.error = `Step ${this.stepIndex + 1} did not do what the lesson expected.`;
        }
        return;
      }
      this.completeStep(true);
    }
    if (!this.step && atDecision) this.judge();
  }

  private judge() {
    this.status = this.lesson.goalMet(this.g) ? 'complete' : 'missed';
  }

  /** The game ended (a win, a loss): judge what is left. */
  private finish() {
    if (this.status !== 'running') return;
    this.settle(true);
    if (this.status === 'running') {
      // the game ended before every step was done (only possible against the Easy bot)
      this.status = this.lesson.goalMet(this.g) ? 'complete' : 'missed';
    }
    this.stopped = true;
  }

  /** What the tutor panel shows. */
  view(): TutorView {
    const s = this.step;
    const pages = this.pages(s);
    const end =
      this.status === 'complete'
        ? textOf(this.lesson.done, this.g)
        : this.status === 'missed'
          ? (this.lesson.missed ?? 'The goal was not reached this time.')
          : this.status === 'error'
            ? `The lesson stopped: ${this.error ?? 'something unexpected happened'}. Start it again from the lesson list.`
            : null;
    let text = s ? textOf(pages[Math.min(this.page, pages.length - 1)], this.g) : '';
    if (s && this.free && this.pend?.d === this.free) text = 'Your choice: pick any option.';
    return {
      status: this.status,
      step: Math.min(this.stepIndex + 1, this.lesson.steps.length),
      steps: this.lesson.steps.length,
      text,
      canNext: this.canNext,
      feedback: this.feedback,
      hint: this.hint,
      waiting: !this.pend && this.status === 'running',
      end,
    };
  }
}
