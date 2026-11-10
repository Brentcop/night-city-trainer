import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Game } from '../../engine/engine';
import type { Agent, Decision, DeckList, GameState, PlayerId } from '../../engine/types';
import { ConfirmPrompt, useCardDrag, type PendingConfirm } from '../components/board/drag';
import { gameDeck } from '../../lib/tournament';
import { loadReplays, saveReplay, type PracticeReplay } from '../../lib/practiceReplays';
import { ReviewPanel } from '../components/ReviewPanel';
import type { ReviewRequest } from '../../sim/review.worker';
import { HeuristicAgent } from '../../ai/heuristic';
import { makeTierBot, TIERS, tierLabel, type Tier } from '../../ai/tiers';
import { HumanAgent } from '../HumanAgent';
import { advise, boardWarnings, gradeMove, matchupTips, type Advice, type MoveGrade } from '../../ai/coach';
import { Markdown } from '../components/Markdown';
import { Verdict, Wr } from '../components/Num';
import analysis from '../../data/analysis.json';
import type { DeckReport } from '../../analysis/analyze';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { DeckTile } from '../components/DeckIdentity';
import { allDecks } from '../../lib/browserLibrary';
import { clearPractice, loadPractice, recordPractice } from '../../lib/practiceLog';
import { classify, BEST_PROFILES, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';
import { buildInteraction, coachMark } from '../components/board/interaction';
import type { BoardCtx, Targeting } from '../components/board/BoardCard';
import { MyHand, PlayerSide } from '../components/board/Zones';
import { ActionMenu, GameOverOverlay, MulliganScreen, TrashModal, type MenuState } from '../components/board/Overlays';
import { AllOptions, PromptPanel, headline } from '../components/board/PromptPanel';
import { useNarrow } from '../components/board/useNarrow';
import '../board.css';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Wraps a bot so its moves are visible to the human. */
class PacedAgent implements Agent {
  name: string;
  constructor(public inner: HeuristicAgent, public ms: () => number) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision) {
    const r = await this.inner.decide(g, d);
    if (d.kind === 'action' || d.kind === 'reaction') await delay(this.ms());
    return r;
  }
}

interface Snapshot {
  state: GameState;
  bot: HeuristicAgent;
  choices: number;
}
interface Running {
  id: number;
  g: Game;
  human: HumanAgent;
  bot: HeuristicAgent;
  replay: PracticeReplay;
  /** one snapshot before each of your main-phase decisions (for Undo) */
  snaps: Snapshot[];
}

/** A copy of a bot including its private random state, so a restored game plays on exactly as before. */
function cloneBot(b: HeuristicAgent): HeuristicAgent {
  return Object.assign(Object.create(Object.getPrototypeOf(b)), structuredClone({ ...b })) as HeuristicAgent;
}

/** Records every answer the human gives (for reviews) and snapshots the game before each main-phase choice (for Undo). */
class RecordingAgent implements Agent {
  name: string;
  constructor(
    public inner: Agent,
    public choices: number[][],
    private onAction?: (g: Game) => void,
  ) {
    this.name = inner.name;
  }
  async decide(g: Game, d: Decision) {
    if (d.kind === 'action') this.onAction?.(g);
    const r = await this.inner.decide(g, d);
    this.choices.push([...r]);
    return r;
  }
}

export function PlayPage({ initialDeck, initialOpp }: { initialDeck?: string; initialOpp?: string }) {
  const decks = allDecks();
  const [mine, setMine] = useState(findDeck(initialDeck)?.file ?? decks[0]?.file);
  const [opp, setOpp] = useState(findDeck(initialOpp)?.file ?? decks[1]?.file);
  const [seat, setSeat] = useState<'random' | 'first' | 'second'>('random');
  const [coach, setCoach] = useState(true);
  const [level, setLevel] = useState<Tier>('hard');
  const [speed, setSpeed] = useState(500);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const [game, setGame] = useState<Running | null>(null);
  const [, setTick] = useState(0);

  const bump = () => setTick((t) => t + 1);
  /** Wire up and run a game: a fresh one (run) or one restored from a snapshot (resume). */
  const launch = (make: (agents: [Agent, Agent]) => Game, human: HumanAgent, bot: HeuristicAgent, replay: PracticeReplay, snaps: Snapshot[], resumed: boolean) => {
    const recorder = new RecordingAgent(human, replay.choices, (g) => snaps.push({ state: g.clone([human, human]).s, bot: cloneBot(bot), choices: replay.choices.length }));
    const g = make([recorder, new PacedAgent(bot, () => speedRef.current)]);
    g.onUpdate = bump;
    human.onChange = bump;
    const id = Date.now();
    setGame({ id, g, human, bot, replay, snaps });
    (resumed ? g.resume() : g.run()).then((st) => {
      replay.result = st.winner === 0 ? 'win' : st.winner === 1 ? 'loss' : 'draw';
      saveReplay(replay);
      recordPractice({
        date: new Date().toISOString(),
        deck: replay.decks[0].name,
        opp: replay.decks[1].name,
        level: replay.botLevel,
        result: replay.result,
        first: st.first === 0,
        turns: st.turn,
        reason: st.winReason,
      });
      bump();
    });
  };

  const start = () => {
    const A = findDeck(mine)?.deck;
    const B = findDeck(opp)?.deck;
    if (!A || !B) return;
    const botSeed = Date.now() % 100000;
    const first: PlayerId | undefined = seat === 'first' ? 0 : seat === 'second' ? 1 : undefined;
    const seed = Math.floor(Math.random() * 2 ** 31);
    const decks: [DeckList, DeckList] = [gameDeck(A), gameDeck(B)];
    const replay: PracticeReplay = { id: `p${Date.now().toString(36)}`, date: new Date().toISOString(), decks, seed, first, botLevel: level, botSeed, choices: [], result: 'draw' };
    launch((agents) => Game.create(decks, agents, { first, seed }), new HumanAgent(), makeTierBot(level, botSeed, 'Bot'), replay, [], false);
  };

  /** Undo: go back to just before your previous main-phase decision (or the one you're in the middle of). */
  const undo = () => {
    if (!game) return;
    const snaps = game.snaps;
    const pendKind = game.human.pending?.d.kind;
    const k = pendKind === 'action' ? snaps.length - 2 : snaps.length - 1;
    if (k < 0) return;
    const target = snaps[k];
    snaps.length = k; // the restored decision takes a fresh snapshot when it is asked again
    game.replay.choices.length = target.choices;
    game.replay.undos = (game.replay.undos ?? 0) + 1;
    const state = structuredClone(target.state);
    launch((agents) => new Game(state, agents), new HumanAgent(), cloneBot(target.bot), game.replay, snaps, true);
  };

  if (!game) {
    const dA = findDeck(mine);
    const dB = findDeck(opp);
    return (
      <div className="grid" style={{ maxWidth: 860 }}>
        <h1>Play vs Bot</h1>
        {dA && dB && (
          <div className="pb-versus">
            <div className="pb-versus-deck">
              <div className="pb-label">You</div>
              <DeckTile d={dA} />
            </div>
            <div className="pb-versus-vs">VS</div>
            <div className="pb-versus-deck">
              <div className="pb-label">Bot</div>
              <DeckTile d={dB} />
            </div>
          </div>
        )}
        <div className="panel grid">
          <DeckPicker label="Your deck" value={mine} onChange={setMine} />
          <DeckPicker label="Bot deck" value={opp} onChange={setOpp} />
          <label className="row">
            <span className="muted small">Seat</span>
            <select value={seat} onChange={(e) => setSeat(e.target.value as any)}>
              <option value="random">Random (d20 roll-off)</option>
              <option value="first">I go first</option>
              <option value="second">I go second</option>
            </select>
          </label>
          <div>
            <span className="muted small">Bot difficulty</span>
            <div className="tier-pick">
              {(Object.keys(TIERS) as Tier[]).map((t) => (
                <button key={t} className={`tier-btn tier-${t} ${level === t ? 'on' : ''}`} onClick={() => setLevel(t)} aria-pressed={level === t}>
                  <b>{TIERS[t].label}</b>
                  <span>{TIERS[t].blurb}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="row">
            <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} />
            <span>Coach mode — the deep advisor suggests a move, explains why, and flags threats</span>
          </label>
          <div className="row">
            <button className="primary" onClick={start} disabled={!mine || !opp}>
              Start game
            </button>
            <a href="#/guides">Read the matchup guide first →</a>
          </div>
        </div>
        <MatchupRead mine={mine} opp={opp} />
        <RecentReviews />
        <PracticeStats />
        <p className="muted small">
          Rules follow the official Comprehensive Rules (Oct 29, 2026): 3 Legends, 40–50 card decks, sell one card per turn for an Eddie,
          one Legend Call per turn (also during your rival's attack), Units enter with Lag, attack spent Units or the Gig area, 7 Gigs at the
          start of your turn wins, overtime after both players run out of dice.
        </p>
      </div>
    );
  }
  const canUndo = (game.human.pending?.d.kind === 'action' ? game.snaps.length >= 2 : game.snaps.length >= 1) && (!!game.human.pending || game.g.s.winner !== null);
  return <Board key={game.id} game={game} coach={coach} speed={speed} setSpeed={setSpeed} onQuit={() => setGame(null)} onRematch={start} onUndo={canUndo ? undo : undefined} />;
}

function Board({
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
  onRematch,
  onUndo,
}: {
  game: Running;
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
  onRematch: () => void;
  onUndo?: () => void;
}) {
  const { g, human, bot } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  const narrow = useNarrow();
  const [hint, setHint] = useState<{ d: Decision; i: number; why: string; alts: Advice['alternatives'] } | null>(null);
  const grades = useRef<MoveGrade[]>([]);
  const [reviewReq, setReviewReq] = useState<ReviewRequest | null>(null);
  const [toast, setToast] = useState<MoveGrade | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const tips = useMemo(() => (coach ? matchupTips(g, 0) : []), [g, coach]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [trashOf, setTrashOf] = useState<PlayerId | null>(null);
  const [hideOver, setHideOver] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // coach: ask the advisor bot what it would do in this spot
  useEffect(() => {
    if (!pend || !coach) return;
    let alive = true;
    advise(g, pend)
      .then((a) => {
        if (alive) setHint({ d: pend, i: a.index, why: a.why, alts: a.alternatives });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pend, coach, g]);

  // a new decision closes any open menu / target mode
  useEffect(() => {
    setMenu(null);
    setTargeting(null);
  }, [pend]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [s.log.length]);

  // Escape cancels menus and target mode (the menu itself follows its card when the page scrolls)
  useEffect(() => {
    if (!menu && !targeting) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setTargeting(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [menu, targeting]);

  const ix = useMemo(() => buildInteraction(g, pend), [g, pend]);
  const [confirm, setConfirm] = useState<PendingConfirm | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  useEffect(() => {
    if (!refusal) return;
    const t = setTimeout(() => setRefusal(null), 2600);
    return () => clearTimeout(t);
  }, [refusal]);
  useEffect(() => setConfirm(null), [pend]);
  const [sortMode, setSortModeRaw] = useState<HandSort>(loadHandSort);
  const setSortMode = (m: HandSort) => {
    setSortModeRaw(m);
    saveHandSort(m);
  };
  const [manual, setManual] = useState<number[]>([]);
  const handOrder = sortHand(g, g.P(0).hand, sortMode, manual);
  const drag = useCardDrag(g, ix, {
    onConfirm: setConfirm,
    onRefuse: setRefusal,
    onReorder: (uid, before) => {
      const order = handOrder.filter((u) => u !== uid);
      order.splice(Math.max(0, order.indexOf(before)), 0, uid);
      setManual(order);
      setSortMode('manual');
    },
  });
  const activeHint = hint && hint.d === pend ? hint : null;
  const mark = useMemo(() => coachMark(pend, activeHint?.i), [pend, activeHint]);

  const answer = useCallback(
    (i: number) => {
      setMenu(null);
      setTargeting(null);
      // grade the move against the coach (only when the advice for this exact spot is ready)
      if (coach && activeHint && pend && pend.options.length > 1) {
        const gr = gradeMove(pend, i, { index: activeHint.i, why: activeHint.why, alternatives: activeHint.alts }, g.s.turn);
        grades.current.push(gr);
        setToast(gr);
      }
      human.answer(i);
    },
    [human, coach, activeHint, pend, g],
  );

  const ctx: BoardCtx = {
    g,
    pend,
    ix,
    coach: coach ? mark : null,
    targeting,
    narrow,
    menuUid: menu?.uid ?? null,
    answer,
    openMenu: (uid, el) => setMenu({ uid, el }),
    startTargeting: (attacker) => {
      setMenu(null);
      const targets = ix.attacks.get(attacker) ?? [];
      if (targets.length === 1) answer(targets[0].i);
      else if (targets.length) setTargeting({ attacker, targets });
    },
    cancelTargeting: () => setTargeting(null),
    openTrash: (p) => setTrashOf(p),
    drag,
    handOrder,
  };

  const over = s.winner !== null;
  const mulligan = !!pend && pend.kind === 'yesno' && pend.tag === 'mulligan';
  const head = headline(ctx);
  const dock = narrow && !over && !mulligan && !!pend && (pend.kind !== 'action' || !!targeting);

  let handAction: React.ReactNode = null;
  if (targeting) {
    handAction = (
      <button className="pb-endturn ghost" onClick={() => setTargeting(null)}>
        Cancel attack
      </button>
    );
  } else if (pend?.kind === 'action') {
    handAction =
      ix.passIndex !== null ? (
        <button className={`pb-endturn primary ${ctx.coach?.i === ix.passIndex ? 'pb-coach-btn' : ''}`} onClick={() => answer(ix.passIndex!)}>
          End turn
        </button>
      ) : (
        <span className="small" style={{ color: 'var(--red)' }}>
          Must attack
        </span>
      );
  } else if (pend?.kind === 'reaction' && ix.passIndex !== null) {
    handAction = (
      <button className={`pb-endturn primary ${ctx.coach?.i === ix.passIndex ? 'pb-coach-btn' : ''}`} onClick={() => answer(ix.passIndex!)}>
        No reaction
      </button>
    );
  }

  return (
    <div className={`pb ${menu ? 'pb-menu-open' : ''} ${targeting ? 'pb-targeting' : ''} ${dock ? 'pb-has-dock' : ''}`}>
      <div className="pb-topbar">
        <div className="pb-turn">
          <span className="pb-turn-no">TURN {s.turn}</span>
          <span className={`pb-turn-who ${s.active === 0 ? 'me' : 'rival'}`}>{over ? 'GAME OVER' : s.active === 0 ? 'YOUR TURN' : "RIVAL'S TURN"}</span>
          {s.overtime && <span className="pb-overtime">OVERTIME</span>}
        </div>
        <div className="row">
          <label className="row small muted">
            Bot speed
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)}>
              <option value={0}>instant</option>
              <option value={250}>fast</option>
              <option value={500}>normal</option>
              <option value={1200}>slow</option>
            </select>
          </label>
          <button onClick={onUndo} disabled={!onUndo} title="Go back to before your last action (also undoes the bot's moves since)">
            ↶ Undo
          </button>
          {over && hideOver && <button onClick={() => setHideOver(false)}>Result</button>}
          <button onClick={onQuit}>{over ? 'New game' : 'Quit'}</button>
        </div>
      </div>
      <div className="pb-layout">
        <div className="pb-mat">
          <PlayerSide p={1} ctx={ctx} />
          <div className={`pb-midline pb-tone-${head.tone}`}>
            <span>{head.text}</span>
            {toast && <MoveToast key={grades.current.length} gr={toast} />}
          </div>
          <PlayerSide p={0} ctx={ctx} />
          <div className="pb-handbar">
            <MyHand ctx={ctx} />
            <div className="pb-handbar-actions">
              <button className="ghost pb-sort" onClick={() => setSortMode(nextSort(sortMode))} title="Sort your hand (or drag a card onto another to reorder)">
                ⇅ {SORT_LABEL[sortMode]}
              </button>
              {handAction}
            </div>
          </div>
        </div>
        <aside className="pb-sidebar">
          <div className={dock ? 'pb-dock' : undefined}>
            <PromptPanel ctx={ctx} why={activeHint?.why} />
          </div>
          {coach && <CoachPanel g={g} alts={activeHint?.alts ?? []} tips={tips} />}
          <AllOptions ctx={ctx} />
          <div className="pb-label">Game log</div>
          <div className="log pb-log" ref={logRef}>
            {s.log.slice(-250).map((l, i) => (
              <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
                {l.text}
              </div>
            ))}
          </div>
          {bot.lastThought && <div className="small muted">Bot's last move: {bot.lastThought.replace(/ \((?:eval|projected)[^)]*\)$/, '')}</div>}
        </aside>
      </div>
      {/* overlays live at the top of the page so no animated or transformed container can move them off screen */}
      {createPortal(
        <>
          {menu && <ActionMenu ctx={ctx} menu={menu} onClose={() => setMenu(null)} />}
          {drag.ghost}
          {confirm && (
            <ConfirmPrompt
              p={confirm}
              onPick={(i) => {
                setConfirm(null);
                answer(i);
              }}
              onCancel={() => setConfirm(null)}
            />
          )}
          {refusal && (
            <div className="pb-refusal" role="status">
              {refusal}
            </div>
          )}
        </>,
        document.body,
      )}
      {trashOf !== null && <TrashModal g={g} p={trashOf} onClose={() => setTrashOf(null)} />}
      {mulligan && !over && <MulliganScreen ctx={ctx} why={activeHint?.why} />}
      {over && !hideOver && (
        <GameOverOverlay
          g={g}
          onRematch={onRematch}
          onNew={onQuit}
          onHide={() => setHideOver(true)}
          review={
            <>
              {coach && <Scorecard grades={grades.current} />}
              <button className="ghost" style={{ marginTop: 10 }} onClick={() => (setHideOver(true), setReviewReq(practiceRequest(game.replay)))}>
                🔍 Full match review
              </button>
            </>
          }
        />
      )}
      {reviewReq && (
        <div className="modal-backdrop" onClick={() => setReviewReq(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="ghost modal-close" onClick={() => setReviewReq(null)}>
              ✕
            </button>
            <ReviewPanel req={reviewReq} title="Match review" mySeat={0} expect={game.replay.result === 'win' ? 0 : game.replay.result === 'loss' ? 1 : 'tie'} />
          </div>
        </div>
      )}
    </div>
  );
}

type HandSort = 'drawn' | 'cost' | 'color' | 'manual';
const SORT_LABEL: Record<HandSort, string> = { drawn: 'As drawn', cost: 'By cost', color: 'By color', manual: 'Custom' };
const nextSort = (m: HandSort): HandSort => (m === 'drawn' ? 'cost' : m === 'cost' ? 'color' : 'drawn');
const COLOR_ORDER = ['Red', 'Blue', 'Green', 'Yellow'];
function loadHandSort(): HandSort {
  try {
    const v = localStorage.getItem('nct.handSort');
    return v === 'cost' || v === 'color' ? v : 'drawn';
  } catch {
    return 'drawn';
  }
}
function saveHandSort(m: HandSort) {
  try {
    if (m !== 'manual') localStorage.setItem('nct.handSort', m);
  } catch {
    /* storage blocked */
  }
}
/** Display order of the hand: as drawn, by cost (then colour), by colour (then cost), or your own drag order. */
function sortHand(g: Game, hand: number[], mode: HandSort, manual: number[]): number[] {
  if (mode === 'manual') return [...manual.filter((u) => hand.includes(u)), ...hand.filter((u) => !manual.includes(u))];
  if (mode === 'drawn') return hand;
  const key = (u: number) => {
    const d = g.def(u);
    return { cost: d.cost ?? 0, color: COLOR_ORDER.indexOf(d.color), name: d.displayName };
  };
  return [...hand].sort((a, b) => {
    const x = key(a);
    const y = key(b);
    const byCost = x.cost - y.cost || x.color - y.color;
    const byColor = x.color - y.color || x.cost - y.cost;
    return (mode === 'cost' ? byCost : byColor) || x.name.localeCompare(y.name);
  });
}

/** Review request for a recorded practice game (your decisions only, with the coach's view of each). */
export function practiceRequest(r: PracticeReplay): ReviewRequest {
  return { kind: 'practice', decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, rollouts: 8, withCoach: true };
}

/** A quick verdict on the move just made, compared with the coach. */
function MoveToast({ gr }: { gr: MoveGrade }) {
  const text =
    gr.verdict === 'agree'
      ? 'Coach agrees'
      : gr.verdict === 'close'
        ? `Fine: the coach slightly preferred ${gr.coach}`
        : gr.gap !== null
          ? `Coach preferred ${gr.coach} (−${gr.gap.toFixed(1)} Gigs)`
          : `Coach preferred ${gr.coach}`;
  return (
    <span className={`move-toast ${gr.verdict}`} role="status">
      <i>{gr.verdict === 'agree' ? '✓' : gr.verdict === 'close' ? '≈' : '!'}</i>
      {text}
    </span>
  );
}

/** End-of-game review: how often you matched the coach, and the costliest differences. */
function Scorecard({ grades }: { grades: MoveGrade[] }) {
  if (!grades.length) return null;
  const agree = grades.filter((x) => x.verdict !== 'miss').length;
  const pctAgree = Math.round((100 * agree) / grades.length);
  const misses = grades
    .filter((x) => x.verdict === 'miss')
    .sort((a, b) => (b.gap ?? 0.5) - (a.gap ?? 0.5))
    .slice(0, 3);
  const grade = pctAgree >= 85 ? 'A' : pctAgree >= 70 ? 'B' : pctAgree >= 55 ? 'C' : 'D';
  return (
    <div className="scorecard">
      <div className={`scorecard-grade g-${grade}`}>{grade}</div>
      <div>
        <b>
          {agree} of {grades.length} decisions matched the coach ({pctAgree}%)
        </b>
        {misses.length > 0 ? (
          <ul>
            {misses.map((m, k) => (
              <li key={k}>
                <span className="muted">T{m.turn}</span> {m.chose} <span className="muted">→ coach: </span>
                <b>{m.coach}</b>
                {m.gap !== null && <span className="neg"> −{m.gap.toFixed(1)} Gigs</span>}
              </li>
            ))}
          </ul>
        ) : (
          <div className="small muted">No costly differences. Clean game.</div>
        )}
      </div>
    </div>
  );
}

/** Recorded practice games, each reviewable by the match reviewer. */
function RecentReviews() {
  const [list] = useState(() => loadReplays().slice(-6).reverse());
  const [req, setReq] = useState<{ r: PracticeReplay; q: ReviewRequest } | null>(null);
  if (!list.length) return null;
  return (
    <div className="panel">
      <h3 style={{ marginTop: 0 }}>Review a recent game</h3>
      <div className="round-list">
        {list.map((r) => (
          <button key={r.id} className="match-row" onClick={() => setReq({ r, q: practiceRequest(r) })}>
            <span className={r.result === 'win' ? 'win' : ''}>{r.decks[0].name}</span>
            <b>{r.result === 'win' ? 'W' : r.result === 'loss' ? 'L' : 'D'}</b>
            <span>
              {r.decks[1].name} <span className="muted small">({tierLabel(r.botLevel)})</span>
            </span>
          </button>
        ))}
      </div>
      {req && (
        <div className="modal-backdrop" onClick={() => setReq(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="ghost modal-close" onClick={() => setReq(null)}>
              ✕
            </button>
            <ReviewPanel req={req.q} title={`${req.r.decks[0].name} vs ${req.r.decks[1].name} — ${new Date(req.r.date).toLocaleString()}`} mySeat={0} expect={req.r.result === 'win' ? 0 : req.r.result === 'loss' ? 1 : 'tie'} />
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeStats() {
  const [games, setGames] = useState(loadPractice());
  if (!games.length) return <p className="small muted">Your practice games are recorded here (in this browser) once you finish one.</p>;
  const rows = new Map<string, { w: number; l: number; d: number }>();
  for (const g of games) {
    const k = `${g.deck} vs ${g.opp}`;
    const r = rows.get(k) ?? { w: 0, l: 0, d: 0 };
    if (g.result === 'win') r.w++;
    else if (g.result === 'loss') r.l++;
    else r.d++;
    rows.set(k, r);
  }
  const w = games.filter((g) => g.result === 'win').length;
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Practice log — {w}-{games.length - w} ({Math.round((100 * w) / games.length)}%)
        </h3>
        <button
          className="ghost"
          onClick={() => {
            clearPractice();
            setGames([]);
          }}
        >
          Clear
        </button>
      </div>
      <table className="small">
        <tbody>
          {[...rows.entries()].map(([k, r]) => (
            <tr key={k}>
              <td>{k}</td>
              <td>
                {r.w}-{r.l}
                {r.d ? `-${r.d}` : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchupRead({ mine, opp }: { mine?: string; opp?: string }) {
  const A = findDeck(mine);
  const B = findDeck(opp);
  if (!A || !B) return null;
  const a = classify(A.deck.main).arch;
  const b = classify(B.deck.main).arch;
  const mu = (analysis as unknown as { decks: DeckReport[] }).decks.find((r) => r.deck === A.deck.name)?.matchups.find((m) => m.opp === B.deck.name);
  return (
    <div className="panel small">
      {mu && mu.games >= 10 && (
        <div className="mu-verdict">
          <Verdict v={mu.wr} n={mu.games} /> <Wr v={mu.wr} n={mu.games} strong /> in {mu.games} bot games{' '}
          <span className="muted">
            (on the play <Wr v={mu.wrFirst} />, on the draw <Wr v={mu.wrSecond} />)
          </span>
        </div>
      )}
      <b>Matchup read:</b> you are <b>{a}</b>, the bot is <b>{b}</b>. {PLAN_TEXT[`${a}>${b}` as ProfileKey]}{' '}
      <a href={`#/insights?d=${encodeURIComponent(A.deck.name)}`}>Your deck's stats →</a>
    </div>
  );
}

/** Coach sidebar: other options it weighed, live board warnings, and the matchup plan for your deck. */
function CoachPanel({ g, alts, tips }: { g: Game; alts: Advice['alternatives']; tips: string[] }) {
  const warnings = boardWarnings(g, 0);
  return (
    <div className="coach-panel">
      {alts.length > 0 && (
        <div>
          <div className="pb-label">Coach also considered</div>
          {alts.map((a) => (
            <div key={a.label} className="coach-alt">
              <span>{a.label}</span>
              <b>{a.gap}</b>
            </div>
          ))}
        </div>
      )}
      {warnings.length > 0 && (
        <div className="coach-warn">
          {warnings.map((w) => (
            <div key={w}>⚠ {w}</div>
          ))}
        </div>
      )}
      {tips.length > 0 && (
        <details>
          <summary className="small">Matchup plan &amp; deck tips</summary>
          <Markdown text={tips.map((t) => `- ${t}`).join(String.fromCharCode(10))} />
        </details>
      )}
    </div>
  );
}
