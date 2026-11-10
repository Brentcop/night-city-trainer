import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../engine/engine';
import type { Decision, DeckList, PlayerId } from '../../engine/types';
import { ConfirmPrompt, useCardDrag, type PendingConfirm } from '../components/board/drag';
import { gameDeck } from '../../lib/tournament';
import { loadReplays, type PracticeReplay } from '../../lib/practiceReplays';
import { canUndo, type PracticeSession, type Running } from '../../lib/practiceSession';
import { ReviewPanel } from '../components/ReviewPanel';
import type { ReviewRequest } from '../../sim/review.worker';
import { TIERS, tierLabel, type Tier } from '../../ai/tiers';
import { useCoach } from '../useCoach';
import { boardWarnings, coachAdvises, gradeMove, matchupTips, type Advice, type MoveGrade } from '../../ai/coach';
import { Markdown } from '../components/Markdown';
import { Verdict, Wr } from '../components/Num';
import analysis from '../../data/analysis.json';
import type { DeckReport } from '../../analysis/analyze';
import { DeckPicker, findDeck } from '../components/DeckPicker';
import { DeckTile } from '../components/DeckIdentity';
import type { LibraryDeck } from '../../lib/library';
import { allDecks } from '../../lib/browserLibrary';
import { clearPractice, loadPractice } from '../../lib/practiceLog';
import { classify, BEST_PROFILES, PLAN_TEXT, type ProfileKey } from '../../ai/archetype';
import { buildInteraction, coachMark } from '../components/board/interaction';
import type { BoardCtx, Targeting } from '../components/board/BoardCard';
import { MyHand, PlayerSide } from '../components/board/Zones';
import { ActionMenu, GameOverOverlay, MulliganScreen, TrashModal, type MenuState } from '../components/board/Overlays';
import { AllOptions, PromptPanel, headline } from '../components/board/PromptPanel';
import { useNarrow } from '../components/board/useNarrow';
import { loadHandSort, nextSort, reorderHand, saveHandSort, sortHand, SORT_LABEL, type HandSort } from '../components/board/handSort';
import { useGameTick, usePracticeGame } from '../usePracticeGame';
import '../board.css';

export function PlayPage({ initialDeck, initialOpp }: { initialDeck?: string; initialOpp?: string }) {
  const [mine, setMine] = useState(() => findDeck(initialDeck)?.file ?? allDecks()[0]?.file);
  const [opp, setOpp] = useState(() => findDeck(initialOpp)?.file ?? allDecks()[1]?.file);
  const [seat, setSeat] = useState<'random' | 'first' | 'second'>('random');
  const [coach, setCoach] = useState(true);
  const [level, setLevel] = useState<Tier>('hard');
  const [speed, setSpeed] = useState(500);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const { session, game, start: startMatch, undo, quit } = usePracticeGame(() => speedRef.current);
  const dA = useMemo(() => findDeck(mine), [mine]);
  const dB = useMemo(() => findDeck(opp), [opp]);

  const start = () => {
    const A = dA?.deck;
    const B = dB?.deck;
    if (!A || !B) return;
    const first: PlayerId | undefined = seat === 'first' ? 0 : seat === 'second' ? 1 : undefined;
    const decks: [DeckList, DeckList] = [gameDeck(A), gameDeck(B)];
    startMatch({ decks, seed: Math.floor(Math.random() * 2 ** 31), first, level, botSeed: Date.now() % 100000 });
  };

  if (!game) {
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
        <MatchupRead A={dA} B={dB} />
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
  return <Board key={game.match} session={session} game={game} coach={coach} speed={speed} setSpeed={setSpeed} onQuit={quit} onRematch={start} onUndo={undo} />;
}

function Board({
  session,
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
  onRematch,
  onUndo,
}: {
  session: PracticeSession;
  game: Running;
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
  onRematch: () => void;
  onUndo: () => void;
}) {
  // bumps on every engine update: memoised sidebar pieces re-render on it, not on drag/menu/hover changes
  const version = useGameTick(session);
  const { g, human, bot, grades } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  const undoable = canUndo(game);
  const narrow = useNarrow();
  const [hint, setHint] = useState<{ d: Decision; i: number; why: string; alts: Advice['alternatives'] } | null>(null);
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
  const advise = useCoach();

  // Undo swaps in a restored game (same match, so the board stays mounted): close what belonged to the old one
  useEffect(() => {
    setHideOver(false);
    setReviewReq(null);
    setTrashOf(null);
  }, [g]);

  // coach: ask the advisor bot what it would do in this spot
  useEffect(() => {
    if (!pend || !coach || !coachAdvises(pend)) return;
    let alive = true;
    // in a worker: a result for a decision that has since changed is dropped (alive, and activeHint checks hint.d)
    advise(g, pend)
      .then((a) => {
        if (alive) setHint({ d: pend, i: a.index, why: a.why, alts: a.alternatives });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pend, coach, g, advise]);

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
  // a drag confirm remembers the decision it was made for, so it can't answer a later one
  const [confirm, setConfirm] = useState<{ p: PendingConfirm; d: Decision | null } | null>(null);
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
    onConfirm: (p) => setConfirm({ p, d: pend }),
    onRefuse: setRefusal,
    onReorder: (uid, onto) => {
      setManual(reorderHand(handOrder, uid, onto));
      setSortMode('manual');
    },
  });
  const activeHint = hint && hint.d === pend ? hint : null;
  const mark = useMemo(() => coachMark(pend, activeHint?.i), [pend, activeHint]);

  /** Answer decision `d` (the one shown when the control was drawn); stale or invalid answers are ignored. */
  const answerFor = useCallback(
    (d: Decision | null, i: number) => {
      setMenu(null);
      setTargeting(null);
      if (!d || !human.answer(d, i)) return;
      // grade the move against the coach (only when the advice for this exact spot is ready)
      if (coach && activeHint && activeHint.d === d && d.options.length > 1) {
        const gr = gradeMove(d, i, { index: activeHint.i, why: activeHint.why, alternatives: activeHint.alts }, g.s.turn);
        grades.push(gr);
        setToast(gr);
      }
    },
    [human, coach, activeHint, g, grades],
  );
  const answer = useCallback((i: number) => answerFor(pend, i), [answerFor, pend]);

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
  const failed = game.error;
  const mulligan = !!pend && pend.kind === 'yesno' && pend.tag === 'mulligan';
  const head = failed ? { text: 'The game stopped because of an error', tone: 'rival' } : headline(ctx);
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
          <button onClick={onUndo} disabled={!undoable} title="Go back to before your last action (also undoes the bot's moves since)">
            ↶ Undo
          </button>
          {over && hideOver && <button onClick={() => setHideOver(false)}>Result</button>}
          <button onClick={onQuit}>{over ? 'New game' : 'Quit'}</button>
        </div>
      </div>
      {failed && (
        <div className="panel" role="alert" style={{ borderColor: 'var(--red)', margin: '8px 0' }}>
          <b style={{ color: 'var(--red)' }}>The game stopped because of an error.</b>{' '}
          <span className="small muted">{failed.slice(0, 300)}</span>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="primary" onClick={onUndo} disabled={!undoable}>
              ↶ Undo to before your last decision
            </button>
            <button onClick={onQuit}>Quit</button>
          </div>
        </div>
      )}
      <div className="pb-layout">
        <div className="pb-mat">
          <PlayerSide p={1} ctx={ctx} />
          <div className={`pb-midline pb-tone-${head.tone}`}>
            <span>{head.text}</span>
            {toast && <MoveToast key={grades.length} gr={toast} />}
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
          {coach && <CoachPanel g={g} v={version} alts={activeHint?.alts ?? NO_ALTS} tips={tips} />}
          <AllOptions pend={pend} coachI={ctx.coach?.i ?? null} answer={answer} />
          <div className="pb-label">Game log</div>
          <div className="log pb-log" ref={logRef}>
            <GameLog log={s.log} n={s.log.length} />
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
              p={confirm.p}
              onPick={(i) => {
                setConfirm(null);
                answerFor(confirm.d, i);
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
      {mulligan && !over && !failed && <MulliganScreen ctx={ctx} why={activeHint?.why} />}
      {over && !hideOver && (
        <GameOverOverlay
          g={g}
          onRematch={onRematch}
          onNew={onQuit}
          onHide={() => setHideOver(true)}
          review={
            <>
              {coach && <Scorecard grades={grades} />}
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

/** Review request for a recorded practice game (your decisions only, with the coach's view of each). */
export function practiceRequest(r: PracticeReplay): ReviewRequest {
  return { kind: 'practice', decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, payChoice: !!r.payChoice, rollouts: 8, withCoach: true };
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
  const [games, setGames] = useState(loadPractice);
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

function MatchupRead({ A, B }: { A?: LibraryDeck; B?: LibraryDeck }) {
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

const NO_ALTS: Advice['alternatives'] = [];

/** The last 250 log lines. The engine appends to `log` in place, so `n` (its length) is what changes. */
const GameLog = memo(function GameLog({ log }: { log: Game['s']['log']; n: number }) {
  return (
    <>
      {log.slice(-250).map((l, i) => (
        <div key={i} className={l.player === null ? 'sys' : l.player === 0 ? 'p0' : 'p1'}>
          {/* who acted, in words as well as colour (turn headers already name the deck) */}
          {l.player !== null && !l.text.startsWith('---') && <b>{l.player === 0 ? 'You: ' : 'Rival: '}</b>}
          {l.text}
        </div>
      ))}
    </>
  );
});

/**
 * Coach sidebar: other options it weighed, live board warnings, and the matchup plan for your deck. The game state
 * changes in place, so `v` (the game's update counter) tells the memo when to re-render.
 */
const CoachPanel = memo(function CoachPanel({ g, alts, tips }: { g: Game; v: number; alts: Advice['alternatives']; tips: string[] }) {
  const warnings = boardWarnings(g, 0);
  return (
    <div className="coach-panel">
      {alts.length > 0 && (
        <div>
          <div className="pb-label">Coach also considered</div>
          {alts.map((a, i) => (
            // two copies of a card give two alternatives with the same label, so the label alone is not a unique key
            <div key={`${i}:${a.label}`} className="coach-alt">
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
});
