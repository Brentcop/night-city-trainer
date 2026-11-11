import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../engine/engine';
import type { Decision, DeckList, PlayerId } from '../../engine/types';
import { ConfirmPrompt, useCardDrag, type PendingConfirm } from '../components/board/drag';
import { gameDeck } from '../../lib/tournament';
import { loadReplays, type PracticeReplay } from '../../lib/practiceReplays';
import { canConcede, canUndo, type PracticeSession, type Running } from '../../lib/practiceSession';
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
import { boardMarks, buildInteraction, coachMark, type Targeting } from '../components/board/interaction';
import type { BoardCtx } from '../components/board/BoardCard';
import { MyHand, PlayerSide } from '../components/board/Zones';
import { ActionMenu, GameOverOverlay, LeaveDialog, MulliganScreen, TrashModal, type MenuState } from '../components/board/Overlays';
import { AllActions, PromptPanel, headline } from '../components/board/PromptPanel';
import { DRAWER_ID, LogDrawer, LogTab } from '../components/board/LogDrawer';
import { ALL_ACTIONS_KEY, BOT_SPEEDS, LOG_OPEN_KEY, loadBotSpeed, normalizeBotSpeed, saveBotSpeed, useSessionFlag } from '../components/board/prefs';
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
  // the bot's pace is remembered in this browser (an old stored "fast" of 250 ms maps to today's fast)
  const [speed, setSpeedRaw] = useState(loadBotSpeed);
  const setSpeed = useCallback((ms: number) => {
    const v = normalizeBotSpeed(ms);
    setSpeedRaw(v);
    saveBotSpeed(v);
  }, []);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const { session, game, start: startMatch, undo, quit, concede } = usePracticeGame(() => speedRef.current);
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
  return <Board key={game.match} session={session} game={game} coach={coach} speed={speed} setSpeed={setSpeed} onQuit={quit} onConcede={concede} onRematch={start} onUndo={undo} />;
}

function Board({
  session,
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
  onConcede,
  onRematch,
  onUndo,
}: {
  session: PracticeSession;
  game: Running;
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
  onConcede: () => void;
  onRematch: () => void;
  onUndo: () => void;
}) {
  // bumps on every engine update (and on a concede): memoised panels re-render on it, not on drag/menu/hover changes
  const version = useGameTick(session);
  const { g, human, bot, grades } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  const undoable = canUndo(game);
  const concedable = canConcede(game);
  const conceded = game.conceded;
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the game state changes in place; `version` says when
  const warnings = useMemo(() => (coach && s.winner === null ? boardWarnings(g, 0) : NO_WARNINGS), [g, coach, version, s.winner]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [trashOf, setTrashOf] = useState<PlayerId | null>(null);
  const [hideOver, setHideOver] = useState(false);
  // panels the player opens stay open for the session (across decisions, turns, Undo and new games)
  const [allOpen, setAllOpen] = useSessionFlag(ALL_ACTIONS_KEY, false);
  const [logOpen, setLogOpen] = useSessionFlag(LOG_OPEN_KEY, false);
  const [navOpen, setNavOpen] = useState(false);
  const [leave, setLeave] = useState<'concede' | 'exit' | null>(null);
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

  // Escape cancels menus, target mode and the site menu (the action menu itself follows its card when the page scrolls)
  useEffect(() => {
    if (!menu && !targeting && !navOpen) return;
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setMenu(null);
      setTargeting(null);
      setNavOpen(false);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [menu, targeting, navOpen]);

  const ix = useMemo(() => buildInteraction(g, pend), [g, pend]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- hands and fields change in place; `version` says when
  const marks = useMemo(() => boardMarks(g, pend, ix, targeting), [g, pend, ix, targeting, version]);
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
    marks,
  };

  const over = s.winner !== null;
  const failed = game.error;
  const mulligan = !!pend && pend.kind === 'yesno' && pend.tag === 'mulligan';
  const head = failed ? { text: 'The game stopped because of an error', tone: 'rival' } : headline(ctx);
  const dock = narrow && !over && !mulligan && !!pend && (pend.kind !== 'action' || !!targeting);

  // a concede that the game ended before (or an exit after it ended) has nothing left to confirm
  useEffect(() => {
    if (over) setLeave((l) => (l === 'concede' ? null : l));
  }, [over]);
  const openLeave = (kind: 'concede' | 'exit') => {
    setMenu(null);
    setTargeting(null);
    setConfirm(null);
    setNavOpen(false);
    setLeave(kind);
  };

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
  const sortButton = (
    <button className="ghost pb-sort" onClick={() => setSortMode(nextSort(sortMode))} title="Sort your hand (or drag a card onto another to reorder)">
      ⇅ {SORT_LABEL[sortMode]}
    </button>
  );
  const allActions = <AllActions pend={pend} coachI={ctx.coach?.i ?? null} answer={answer} open={allOpen} onToggle={setAllOpen} />;
  const coachPanel = coach ? <CoachPanel g={g} v={version} alts={activeHint?.alts ?? NO_ALTS} tips={tips} warnings={warnings} /> : null;
  const lastMove = bot.lastThought ? <div className="small muted pb-lastmove">Bot's last move: {bot.lastThought.replace(/ \((?:eval|projected)[^)]*\)$/, '')}</div> : null;
  const closeLog = useCallback(() => setLogOpen(false), [setLogOpen]);

  const rootCls = [
    'pb',
    'pb-game',
    narrow ? 'pb-compact' : 'pb-full',
    menu ? 'pb-menu-open' : '',
    targeting ? 'pb-targeting' : '',
    marks.choosing ? 'pb-choosing' : '',
    dock ? 'pb-has-dock' : '',
    navOpen ? 'pb-nav-open' : '',
  ].join(' ');

  return (
    <div className={rootCls}>
      <div className="pb-topbar">
        <button
          type="button"
          className="ghost pb-navbtn"
          aria-expanded={navOpen}
          aria-label="Site menu"
          title="Site menu: the other pages, theme and card art"
          onClick={() => setNavOpen(!navOpen)}
        >
          ☰
        </button>
        <div className="pb-turn">
          <span className="pb-turn-no">TURN {s.turn}</span>
          <span className={`pb-turn-who ${s.active === 0 && !over ? 'me' : 'rival'}`}>{conceded ? 'CONCEDED' : over ? 'GAME OVER' : s.active === 0 ? 'YOUR TURN' : "RIVAL'S TURN"}</span>
          {s.overtime && <span className="pb-overtime">OVERTIME</span>}
        </div>
        <div className="pb-strip-tools">
          {narrow ? (
            <button type="button" className={`ghost pb-logbtn ${logOpen ? 'on' : ''}`} aria-expanded={logOpen} aria-controls={DRAWER_ID} onClick={() => setLogOpen(!logOpen)}>
              Log{warnings.length > 0 ? ` ⚠${warnings.length}` : ''}
            </button>
          ) : (
            <LogTab log={s.log} open={logOpen} onToggle={setLogOpen} warnings={warnings.length} />
          )}
          <label className="pb-speed small muted">
            <span className="pb-speed-cap">Bot speed</span>
            <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Bot speed">
              {BOT_SPEEDS.map((x) => (
                <option key={x.ms} value={x.ms}>
                  {x.label}
                </option>
              ))}
            </select>
          </label>
          <button onClick={onUndo} disabled={!undoable} title="Go back to before your last action (also undoes the bot's moves since)">
            ↶ Undo
          </button>
          {over && hideOver && <button onClick={() => setHideOver(false)}>Result</button>}
          {!over && (
            <button className="pb-concede" onClick={() => openLeave('concede')} disabled={!concedable} title="End the game now as a recorded loss">
              ⚑ Concede
            </button>
          )}
          <button className="pb-exit" onClick={over ? onQuit : () => openLeave('exit')} title={over ? 'Back to the game setup' : 'Leave this game without recording a result'}>
            {over ? 'New game' : 'Exit game'}
          </button>
        </div>
      </div>
      <div className="pb-stage">
        {failed && (
          <div className="panel pb-error" role="alert">
            <b style={{ color: 'var(--red)' }}>The game stopped because of an error.</b> <span className="small muted">{failed.slice(0, 300)}</span>
            <div className="row" style={{ marginTop: 8 }}>
              <button className="primary" onClick={onUndo} disabled={!undoable}>
                ↶ Undo to before your last decision
              </button>
              <button onClick={onQuit}>Exit game</button>
            </div>
          </div>
        )}
        <div className="pb-mat">
          <PlayerSide p={1} ctx={ctx} />
          <div className={`pb-midline pb-tone-${head.tone}`}>
            <span>{head.text}</span>
            {toast && <MoveToast key={grades.length} gr={toast} />}
          </div>
          <PlayerSide p={0} ctx={ctx} />
          <div className="pb-handbar">
            <MyHand ctx={ctx} />
            {narrow ? (
              <div className="pb-handbar-actions">
                {sortButton}
                {handAction}
              </div>
            ) : (
              // the action dock: where you act on the hand — the turn button, every option, and the prompt
              <section className="pb-actions" aria-label="Your actions">
                <div className="pb-actions-main">
                  {handAction}
                  {sortButton}
                </div>
                {allActions}
                <PromptPanel ctx={ctx} why={activeHint?.why} hidePass />
              </section>
            )}
          </div>
        </div>
        {narrow && (
          <div className="pb-below">
            <div className={dock ? 'pb-dock' : undefined}>
              <PromptPanel ctx={ctx} why={activeHint?.why} />
              {allActions}
            </div>
            {coachPanel}
          </div>
        )}
        <LogDrawer log={s.log} n={s.log.length} open={logOpen} sheet={narrow} onClose={closeLog} coach={narrow ? undefined : coachPanel} footer={lastMove} />
      </div>
      {navOpen && (
        <div className="pb-nav-backdrop" onClick={() => setNavOpen(false)}>
          <p className="pb-nav-note">Opening another page ends this game{over ? '' : ' without recording it'}. Click here or press Escape to go back to it.</p>
        </div>
      )}
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
      {leave && (
        <LeaveDialog
          kind={leave}
          onCancel={() => setLeave(null)}
          onConfirm={() => {
            setLeave(null);
            if (leave === 'concede') onConcede();
            else onQuit();
          }}
        />
      )}
      {trashOf !== null && <TrashModal g={g} p={trashOf} onClose={() => setTrashOf(null)} />}
      {mulligan && !over && !failed && <MulliganScreen ctx={ctx} why={activeHint?.why} />}
      {over && !hideOver && (
        <GameOverOverlay
          g={g}
          conceded={conceded}
          onRematch={onRematch}
          onNew={onQuit}
          onHide={() => setHideOver(true)}
          onUndo={undoable ? onUndo : undefined}
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
        <div className="modal-backdrop pb-review-backdrop" onClick={() => setReviewReq(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <button className="ghost modal-close" onClick={() => setReviewReq(null)}>
              ✕
            </button>
            <ReviewPanel req={reviewReq} title="Match review" mySeat={0} expect={reviewExpect(game.replay)} />
          </div>
        </div>
      )}
    </div>
  );
}

/** The result a review's re-simulation should reproduce (a conceded game's re-simulation ends at the concession). */
const reviewExpect = (r: PracticeReplay): 0 | 1 | 'tie' => (r.result === 'win' ? 0 : r.result === 'loss' ? 1 : 'tie');

/** Review request for a recorded practice game (your decisions only, with the coach's view of each; a conceded game ends where you conceded). */
export function practiceRequest(r: PracticeReplay): ReviewRequest {
  return { kind: 'practice', decks: r.decks, seed: r.seed, first: r.first, botLevel: r.botLevel, botSeed: r.botSeed, choices: r.choices, payChoice: !!r.payChoice, orderChoice: !!r.orderChoice, conceded: !!r.conceded, rollouts: 8, withCoach: true };
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
            <b title={r.conceded ? 'You conceded' : undefined}>{r.result === 'win' ? 'W' : r.result === 'loss' ? (r.conceded ? 'L · conceded' : 'L') : 'D'}</b>
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
            <ReviewPanel req={req.q} title={`${req.r.decks[0].name} vs ${req.r.decks[1].name} — ${new Date(req.r.date).toLocaleString()}`} mySeat={0} expect={reviewExpect(req.r)} />
          </div>
        </div>
      )}
    </div>
  );
}

function PracticeStats() {
  const [games, setGames] = useState(loadPractice);
  if (!games.length) return <p className="small muted">Your practice games are recorded here (in this browser) once you finish one.</p>;
  const rows = new Map<string, { w: number; l: number; d: number; c: number }>();
  for (const g of games) {
    const k = `${g.deck} vs ${g.opp}`;
    const r = rows.get(k) ?? { w: 0, l: 0, d: 0, c: 0 };
    if (g.result === 'win') r.w++;
    else if (g.result === 'loss') r.l++;
    else r.d++;
    if (g.conceded) r.c++;
    rows.set(k, r);
  }
  const w = games.filter((g) => g.result === 'win').length;
  const conceded = games.filter((g) => g.conceded).length;
  return (
    <div className="panel">
      <div className="spread">
        <h3 style={{ margin: 0 }}>
          Practice log — {w}-{games.length - w} ({Math.round((100 * w) / games.length)}%)
          {conceded > 0 && <span className="muted small"> · {conceded} conceded</span>}
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
                {r.c ? <span className="muted"> ({r.c} conceded)</span> : null}
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
const NO_WARNINGS: string[] = [];

/**
 * Coach notes (in the log drawer on the full board, under the prompt on phones): other options it weighed, live board
 * warnings, and the matchup plan for your deck. The game state changes in place, so `v` (the game's update counter)
 * tells the memo when to re-render.
 */
const CoachPanel = memo(function CoachPanel({ alts, tips, warnings }: { g: Game; v: number; alts: Advice['alternatives']; tips: string[]; warnings: string[] }) {
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
