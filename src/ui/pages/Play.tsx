import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Decision, DeckList, PlayerId } from '../../engine/types';
import { ConfirmPrompt, useCardDrag, type PendingConfirm } from '../components/board/drag';
import { gameDeck } from '../../lib/tournament';
import { practiceRequest, reviewExpect } from '../../lib/practiceReplays';
import { buildCoachedReplay, coachedGrade, coachedReplayFileName } from '../../lib/coachedReplay';
import { download } from '../../lib/download';
import { GIG_SWING } from '../../ai/eval';
import { canConcede, canUndo, type PracticeSession, type Running } from '../../lib/practiceSession';
import { ReviewPanel } from '../components/ReviewPanel';
import type { ReviewRequest } from '../../sim/review.worker';
import type { Tier } from '../../ai/tiers';
import { useCoach } from '../useCoach';
import { useSynergyReport } from '../synergyReport';
import { seatLift } from '../../ai/packageLift';
import { boardWarnings, coachAdvises, gradeMove, matchupTips, type Advice, type GradedOption, type MoveGrade } from '../../ai/coach';
import { Modal, useFocusTrap } from '../components/Modal';
import { findDeck, firstVisibleDeck } from '../components/DeckPicker';
import { boardMarks, buildInteraction, coachMark, type Targeting } from '../components/board/interaction';
import type { BoardCtx } from '../components/board/BoardCard';
import { MyHand, PlayerSide } from '../components/board/Zones';
import { ActionMenu, GameOverOverlay, LeaveDialog, MulliganScreen, TrashModal, type MenuState } from '../components/board/Overlays';
import { AllActions, PromptPanel, headline } from '../components/board/PromptPanel';
import { DRAWER_ID, LogDrawer, LogTab } from '../components/board/LogDrawer';
import { ALL_ACTIONS_KEY, BOT_SPEEDS, DEFAULT_BOT_SPEED, LOG_OPEN_KEY, loadBotSpeed, normalizeBotSpeed, saveBotSpeed, useSessionFlag } from '../components/board/prefs';
import { SettingsDialog } from '../components/board/SettingsDialog';
import { PayPrompt, PaySelector } from '../components/board/PayParts';
import { useBoardSettings } from '../useBoardSettings';
import {
  addEddie,
  automaticSelection,
  clampSelection,
  costOfAnswer,
  EMPTY_SELECTION,
  paySources,
  payStatus,
  planAnswer,
  readyEddies,
  type PayCost,
  type PaySelection,
} from '../../lib/eddiePayment';
import { useViewport } from '../components/board/useNarrow';
import { phoneLayout, phoneVars } from '../components/board/layout';
import { CardPeek, GameMenu, PhonePanel, phonePanelState } from '../components/board/PhoneParts';
import { loadHandSort, nextSort, reorderHand, saveHandSort, sortHand, SORT_LABEL, type HandSort } from '../components/board/handSort';
import { useGameTick, usePracticeGame } from '../usePracticeGame';
import { CoachPanel, MoveToast, NO_ALTS, Scorecard } from '../components/board/CoachPanel';
import { PlaySetup, type Seat } from '../components/PlaySetup';
import '../board.css';

export function PlayPage({ initialDeck, initialOpp }: { initialDeck?: string; initialOpp?: string }) {
  // defaults skip decks hidden in this browser; a link to a deleted deck finds nothing and falls back to them
  const [mine, setMine] = useState(() => findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file ?? '');
  const [opp, setOpp] = useState(() => findDeck(initialOpp)?.file ?? firstVisibleDeck(findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file)?.file ?? '');
  const [seat, setSeat] = useState<Seat>('random');
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
  const [settings, updateSettings, resetSettings] = useBoardSettings();
  const [showSettings, setShowSettings] = useState(false);
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
      <>
        <PlaySetup
          mine={mine}
          setMine={setMine}
          opp={opp}
          setOpp={setOpp}
          seat={seat}
          setSeat={setSeat}
          coach={coach}
          setCoach={setCoach}
          level={level}
          setLevel={setLevel}
          dA={dA}
          dB={dB}
          onStart={start}
          onSettings={() => setShowSettings(true)}
        />
        {showSettings &&
          createPortal(
            <SettingsDialog
              settings={settings}
              onChange={updateSettings}
              onReset={() => {
                resetSettings();
                setSpeed(DEFAULT_BOT_SPEED);
              }}
              speed={speed}
              setSpeed={setSpeed}
              onClose={() => setShowSettings(false)}
            />,
            document.body,
          )}
      </>
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
  // the single layout switch: the full board, or the phone board (portrait or landscape) sized from the viewport
  const vp = useViewport();
  const narrow = vp.mode !== 'full';
  const phone = useMemo(() => (narrow ? phoneLayout(vp.w, vp.h) : null), [narrow, vp.w, vp.h]);
  // the menus, confirms and readers render at <body>: give them the same size variables as the board
  useLayoutEffect(() => {
    if (!phone) return;
    const vars = phoneVars(phone);
    const st = document.body.style;
    for (const [k, v] of Object.entries(vars)) st.setProperty(k, v);
    return () => {
      for (const k of Object.keys(vars)) st.removeProperty(k);
    };
  }, [phone]);
  const [hint, setHint] = useState<{ d: Decision; i: number; why: string; alts: Advice['alternatives']; advice: Advice } | null>(null);
  const [reviewReq, setReviewReq] = useState<ReviewRequest | null>(null);
  const [toast, setToast] = useState<MoveGrade | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const tips = useMemo(() => (coach ? matchupTips(g, 0) : []), [g, coach]);
  // INFO-8: the coach names a package only when the synergy report measured a lift above 0 for it (unmeasured wording
  // while the report is loading or missing)
  const synergy = useSynergyReport();
  const lift0 = useMemo(() => (synergy.state === 'ready' ? seatLift(synergy.report, g.P(0).listId, synergy.current) : null), [synergy, g]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- the game state changes in place; `version` says when
  const warnings = useMemo(() => (coach && s.winner === null ? boardWarnings(g, 0, lift0) : NO_WARNINGS), [g, coach, version, s.winner, lift0]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [targeting, setTargeting] = useState<Targeting | null>(null);
  const [trashOf, setTrashOf] = useState<PlayerId | null>(null);
  const [hideOver, setHideOver] = useState(false);
  // panels the player opens stay open for the session (across decisions, turns, Undo and new games)
  const [allOpen, setAllOpen] = useSessionFlag(ALL_ACTIONS_KEY, false);
  const [logOpen, setLogOpen] = useSessionFlag(LOG_OPEN_KEY, false);
  const [navOpen, setNavOpen] = useState(false);
  // phones: the ☰ game menu, the card reader, and the prompt panel collapsed (to a tab) for the decision it was shown for
  const [gameMenu, setGameMenu] = useState(false);
  const [peek, setPeek] = useState<{ uid: number; choose?: number; d: Decision | null } | null>(null);
  const [collapsedFor, setCollapsedFor] = useState<Decision | null>(null);
  const [leave, setLeave] = useState<'concede' | 'exit' | null>(null);
  // board settings (src/lib/boardSettings.ts): paying costs, the side panel, colours and backgrounds
  const [settings, updateSettings, resetSettings] = useBoardSettings();
  const [showSettings, setShowSettings] = useState(false);
  const payMode = settings.payMode;
  const panelSet = settings.panel;
  const panelHidden = panelSet.position === 'hidden';
  // paying a cost by choice: the sources selected before playing ("Choose before"), the prompt for one cost (both
  // modes), and the confirmed sources the engine's 'pay' decisions are answered from (planAnswer)
  const [paySel, setPaySel] = useState<PaySelection>(EMPTY_SELECTION);
  const [payAsk, setPayAsk] = useState<{ d: Decision; i: number; cost: PayCost; sel: PaySelection; finish: boolean } | null>(null);
  const payPlan = useRef<PaySelection | null>(null);
  const coachApi = useCoach();
  const advise = coachApi.advise;

  // Undo swaps in a restored game (same match, so the board stays mounted): close what belonged to the old one
  useEffect(() => {
    setHideOver(false);
    setReviewReq(null);
    setTrashOf(null);
    setPaySel(EMPTY_SELECTION);
    setPayAsk(null);
    payPlan.current = null;
  }, [g]);

  // coach: ask the advisor bot what it would do in this spot
  useEffect(() => {
    if (!pend || !coach || !coachAdvises(pend)) return;
    let alive = true;
    // in a worker: a result for a decision that has since changed is dropped (alive, and activeHint checks hint.d)
    advise(g, pend, lift0)
      .then((a) => {
        if (alive) setHint({ d: pend, i: a.index, why: a.why, alts: a.alternatives, advice: a });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [pend, coach, g, advise, lift0]);

  // a new decision closes any open menu / target mode
  useEffect(() => {
    setMenu(null);
    setTargeting(null);
  }, [pend]);

  // Escape cancels target mode (menus, dialogs and the site menu close themselves on Escape: useFocusTrap)
  useEffect(() => {
    if (!targeting) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) setTargeting(null);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [targeting]);
  // the site menu (☰ on the full board) shows the site header over the board: focus goes to its first link, Tab stays
  // in the header, and Escape or the backdrop closes it, returning focus to ☰
  const siteHeader = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    siteHeader.current = document.querySelector<HTMLElement>('header.topbar');
  }, []);
  useFocusTrap(siteHeader, () => setNavOpen(false), { active: navOpen, initial: 'first' });

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
  useEffect(() => {
    setConfirm(null);
    setPayAsk(null);
  }, [pend]);
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
  const commit = useCallback(
    (d: Decision | null, i: number): boolean => {
      setMenu(null);
      setTargeting(null);
      if (!d || !human.answer(d, i)) return false;
      // grade the move against the coach by value (only when the advice for this exact spot is ready)
      if (coach && activeHint && activeHint.d === d && d.options.length > 1) {
        const advice = activeHint.advice;
        // this answer's place among the recorded choices (the recorder adds it once the answer settles)
        const at = game.replay.choices.length;
        const gr = coachedGrade(d, i, advice, gradeMove(d, i, advice, g.s.turn), at);
        grades.push(gr);
        setToast(gr);
        if (gr.verdict === 'pending') {
          // a move the coach did not value: scored in its worlds off the board's thread; play goes on meanwhile. Undo
          // truncates `grades`, so a score that arrives for an undone move finds its placeholder gone and is dropped.
          const settle = (extra: GradedOption[]) => {
            const k = grades.indexOf(gr);
            if (k < 0) return;
            const done = coachedGrade(d, i, advice, gradeMove(d, i, advice, gr.turn, extra), at, extra);
            grades[k] = done;
            setToast((t) => (t === gr ? done : t));
          };
          coachApi.score(d, i, advice).then(settle, () => settle([]));
        }
      }
      return true;
    },
    [human, coach, activeHint, g, grades, coachApi, game.replay],
  );
  /** Answer with these sources paying its cost: the engine's 'pay' decisions that follow are answered from them. */
  const payAndCommit = useCallback(
    (d: Decision, i: number, sel: PaySelection) => {
      payPlan.current = sel;
      setPaySel(EMPTY_SELECTION);
      if (!commit(d, i)) payPlan.current = null;
    },
    [commit],
  );
  /**
   * Every answer from the board goes through here. With Automatic payment (the default) it is just commit. Otherwise an
   * option with a cost is held back until the sources are picked: "Choose before" plays at once when the selection pays
   * the cost exactly and asks you to finish selecting when it doesn't; "Choose after" asks every time (Cancel: no play).
   */
  const answerFor = useCallback(
    (d: Decision | null, i: number) => {
      const cost = payMode !== 'auto' && d && human.pending?.d === d ? costOfAnswer(g, d, i) : null;
      if (!d || !cost) {
        commit(d, i);
        return;
      }
      setMenu(null);
      setTargeting(null);
      const sources = paySources(g, d.player, cost);
      if (payMode === 'before') {
        const sel = clampSelection(paySel, sources);
        if (payStatus(sel, cost.amount).exact) payAndCommit(d, i, sel);
        else setPayAsk({ d, i, cost, sel, finish: true });
        return;
      }
      setPayAsk({ d, i, cost, sel: automaticSelection(sources, cost.amount), finish: false });
    },
    [payMode, human, g, commit, paySel, payAndCommit],
  );
  // a confirmed selection answers the 'pay' decisions of its cost; anything else (or nothing left to give) ends it
  useEffect(() => {
    const plan = payPlan.current;
    if (!plan || !pend) return;
    const r = pend.kind === 'pay' ? planAnswer(pend, plan) : null;
    if (!r) {
      payPlan.current = null;
      return;
    }
    payPlan.current = r.rest;
    human.answer(pend, r.i);
  }, [pend, human]);
  const answer = useCallback((i: number) => answerFor(pend, i), [answerFor, pend]);

  // "Choose before": your selection, kept to what can still pay, while you can act (main phase or a reaction)
  const selecting = payMode === 'before' && !!pend && (pend.kind === 'action' || pend.kind === 'reaction') && !targeting && s.winner === null;
  const beforeSources = selecting ? paySources(g, 0) : null;
  const beforeSel = beforeSources ? clampSelection(paySel, beforeSources) : null;
  const paySelect = beforeSources && beforeSel ? <PaySelector sources={beforeSources} sel={beforeSel} onChange={setPaySel} /> : null;

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
    inspect: narrow ? (uid) => setPeek({ uid, d: null }) : undefined,
    eddiePick: beforeSel && beforeSources ? { selected: beforeSel.eddies, add: () => setPaySel(addEddie(beforeSel, readyEddies(beforeSources))) } : undefined,
  };

  const over = s.winner !== null;
  const failed = game.error;
  // INFO-9: the finished game as a file, with the coach's advice, grade and scores per decision (src/lib/coachedReplay.ts)
  const exportGame = () => {
    const c = buildCoachedReplay(game.replay, grades, new Date().toISOString(), GIG_SWING);
    download(coachedReplayFileName(c), JSON.stringify(c, null, 1), 'application/json');
  };
  const mulligan = !!pend && pend.kind === 'yesno' && pend.tag === 'mulligan';
  const head = failed ? { text: 'The game stopped because of an error', tone: 'rival' } : headline(ctx);
  const panel = narrow ? phonePanelState({ pend, targeting, over, allOpen, collapsed: !!pend && collapsedFor === pend }) : 'none';

  // a concede that the game ended before (or an exit after it ended) has nothing left to confirm
  useEffect(() => {
    if (over) setLeave((l) => (l === 'concede' ? null : l));
  }, [over]);
  const openLeave = (kind: 'concede' | 'exit') => {
    setMenu(null);
    setTargeting(null);
    setConfirm(null);
    setNavOpen(false);
    setGameMenu(false);
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
  // side panel setting: open it when the rival's turn starts
  const rivalTurn = s.active === 1 && s.winner === null ? s.turn : null;
  const autoOpen = panelSet.autoOpenRivalTurn && !panelHidden;
  useEffect(() => {
    if (autoOpen && rivalTurn !== null) setLogOpen(true);
  }, [autoOpen, rivalTurn, setLogOpen]);

  const rootCls = [
    'pb',
    'pb-game',
    narrow ? (vp.mode === 'phone-land' ? 'pb-compact pb-phone pb-phone-land' : 'pb-compact pb-phone') : 'pb-full',
    menu ? 'pb-menu-open' : '',
    targeting ? 'pb-targeting' : '',
    marks.choosing ? 'pb-choosing' : '',
    navOpen ? 'pb-nav-open' : '',
  ].join(' ');

  return (
    <div className={rootCls} style={phone ? (phoneVars(phone) as React.CSSProperties) : undefined} data-board-bg={settings.boardBg} data-gig-bg={settings.gigBg}>
      {narrow ? (
        // phones: one row — the game menu, the turn, the log, Undo and Concede (speed, hand order, pages and Exit are in ☰)
        <div className="pb-topbar pb-strip-phone">
          <button type="button" className="ghost pb-icon" aria-expanded={gameMenu} aria-label="Game menu" title="Game menu" onClick={() => setGameMenu(!gameMenu)}>
            ☰
          </button>
          <div className="pb-turn">
            <span className="pb-turn-no">T{s.turn}</span>
            <span className={`pb-turn-who ${s.active === 0 && !over ? 'me' : 'rival'}`}>{conceded ? 'CONCEDED' : over ? 'OVER' : s.active === 0 ? 'YOU' : 'RIVAL'}</span>
            {s.overtime && <span className="pb-overtime">OT</span>}
          </div>
          <div className="pb-strip-tools">
            {!panelHidden && (
              <button
                type="button"
                className={`ghost pb-icon ${logOpen ? 'on' : ''}`}
                aria-expanded={logOpen}
                aria-controls={DRAWER_ID}
                aria-label={warnings.length ? `Game log, ${warnings.length} coach warnings` : 'Game log'}
                title="Game log"
                onClick={() => setLogOpen(!logOpen)}
              >
                ≡{warnings.length > 0 && <span className="pb-icon-badge">{warnings.length}</span>}
              </button>
            )}
            <button type="button" className="pb-icon" onClick={onUndo} disabled={!undoable} aria-label="Undo" title="Undo: back to before your last action">
              ↶
            </button>
            {over ? (
              <button type="button" className="pb-icon" onClick={() => setHideOver(false)} disabled={!hideOver} aria-label="Show the result" title="Show the result">
                ⚐
              </button>
            ) : (
              <button type="button" className="pb-icon pb-concede" onClick={() => openLeave('concede')} disabled={!concedable} aria-label="Concede" title="Concede: end the game now as a recorded loss">
                ⚑
              </button>
            )}
          </div>
        </div>
      ) : (
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
            !panelHidden && <LogTab log={s.log} open={logOpen} onToggle={setLogOpen} warnings={warnings.length} side={panelSet.position} />
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
          <button type="button" className="ghost pb-settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings: paying costs, the log panel, colours and backgrounds">
            ⚙
          </button>
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
      )}
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
            <span className="pb-midline-text">{head.text}</span>
            {toast && <MoveToast key={grades.length} gr={toast} />}
            {/* phones: the turn button sits in the banner, in the middle of the screen */}
            {narrow && handAction && <span className="pb-midline-action">{handAction}</span>}
          </div>
          <PlayerSide p={0} ctx={ctx} />
          <div className="pb-handbar">
            <MyHand ctx={ctx} />
            {narrow ? null : (
              // the action dock: where you act on the hand — the turn button, every option, and the prompt
              <section className="pb-actions" aria-label="Your actions">
                <div className="pb-actions-main">
                  {handAction}
                  {sortButton}
                </div>
                {paySelect}
                {allActions}
                <PromptPanel ctx={ctx} why={activeHint?.why} hidePass />
              </section>
            )}
          </div>
        </div>
        {narrow && (
          <PhonePanel
            ctx={ctx}
            state={panel}
            why={activeHint?.why}
            allActions={allActions}
            paySelect={paySelect}
            onPeek={(uid, choose) => setPeek({ uid, choose, d: pend })}
            onCollapse={() => (pend?.kind === 'action' && !targeting ? setAllOpen(false) : setCollapsedFor(pend))}
            onExpand={() => {
              setCollapsedFor(null);
              if (pend?.kind === 'action' && !targeting) setAllOpen(true);
            }}
          />
        )}
        <LogDrawer log={s.log} n={s.log.length} open={logOpen} sheet={narrow} onClose={closeLog} coach={coachPanel} footer={lastMove} panel={panelSet} />
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
              side={narrow}
            />
          )}
          {gameMenu && (
            <GameMenu
              speed={speed}
              setSpeed={setSpeed}
              sortLabel={SORT_LABEL[sortMode]}
              onSort={() => setSortMode(nextSort(sortMode))}
              onSite={() => setNavOpen(true)}
              onExit={over ? onQuit : () => openLeave('exit')}
              exitLabel={over ? 'New game' : 'Exit game'}
              onExport={over ? exportGame : undefined}
              onSettings={() => setShowSettings(true)}
              onClose={() => setGameMenu(false)}
            />
          )}
          {payAsk && (
            <PayPrompt
              title={`${payAsk.finish ? 'Finish selecting: pay' : 'Pay'} ${payAsk.cost.amount} €$ for ${payAsk.cost.what}`}
              amount={payAsk.cost.amount}
              sources={paySources(g, payAsk.d.player, payAsk.cost)}
              sel={payAsk.sel}
              onChange={(sel) => setPayAsk((a) => (a ? { ...a, sel } : a))}
              onConfirm={() => {
                setPayAsk(null);
                payAndCommit(payAsk.d, payAsk.i, payAsk.sel);
              }}
              onCancel={() => {
                // nothing was played; in "Choose before" the selection made in the prompt stays for the next try
                if (payAsk.finish) setPaySel(payAsk.sel);
                setPayAsk(null);
              }}
              side={narrow}
            />
          )}
          {showSettings && (
            <SettingsDialog
              settings={settings}
              onChange={updateSettings}
              onReset={() => {
                resetSettings();
                setSpeed(DEFAULT_BOT_SPEED);
              }}
              speed={speed}
              setSpeed={setSpeed}
              panels={{ logOpen, setLogOpen, allOpen, setAllOpen }}
              onClose={() => setShowSettings(false)}
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
      {peek && (
        <CardPeek
          g={g}
          uid={peek.uid}
          onClose={() => setPeek(null)}
          onChoose={
            peek.choose !== undefined && peek.d === pend
              ? () => {
                  setPeek(null);
                  answerFor(peek.d, peek.choose!);
                }
              : undefined
          }
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
              <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
                <button className="ghost" onClick={() => (setHideOver(true), setReviewReq(practiceRequest(game.replay)))}>
                  🔍 Full match review
                </button>
                <button className="ghost" onClick={exportGame} title="Save this game as a file: seeds, your moves and the coach's advice on each">
                  ⤓ Export game
                </button>
              </div>
            </>
          }
        />
      )}
      {reviewReq && (
        <Modal label="Match review" onClose={() => setReviewReq(null)} backdropClassName="pb-review-backdrop">
          <ReviewPanel req={reviewReq} title="Match review" mySeat={0} expect={reviewExpect(game.replay)} />
        </Modal>
      )}
    </div>
  );
}

const NO_WARNINGS: string[] = [];
