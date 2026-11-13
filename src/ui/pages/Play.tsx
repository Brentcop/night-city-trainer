import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Game } from '../../engine/engine';
import type { Decision, DeckList, PlayerId } from '../../engine/types';
import type { CoachedGrade } from '../../lib/coachedReplay';
import type { PracticeReplay } from '../../lib/practiceReplays';
import { ConfirmPrompt, useCardDrag, type PendingConfirm } from '../components/board/drag';
import { gameDeck } from '../../lib/tournament';
import { annotatePractice, coachSummary } from '../../lib/practiceLog';
import { buildCoachedReplay, coachedGrade, coachedReplayFileName } from '../../lib/coachedReplay';
import { download } from '../../lib/download';
import { GIG_SWING } from '../../ai/eval';
import { canConcede, canUndo, type Running } from '../../lib/practiceSession';
import { GameReviewModal, type GameReviewSource } from '../components/GameReview';
import { coachRatingsFrom } from '../../lib/gameReview';
import { saveCoachRatings } from '../../lib/gameReviewStore';
import type { Tier } from '../../ai/tiers';
import { useCoach } from '../useCoach';
import { useSynergyReport } from '../synergyReport';
import { seatLift } from '../../ai/packageLift';
import { boardWarnings, coachWorthAsking, gradeMove, scorable, matchupTips, type Advice, type GradedOption, type MoveGrade } from '../../ai/coach';
import { useFocusTrap } from '../components/Modal';
import { findDeck, firstVisibleDeck } from '../components/DeckPicker';
import { boardMarks, buildInteraction, coachMark, onlyEndTurn, type Targeting } from '../components/board/interaction';
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
import { saveOfRun, useGameTick, usePracticeGame, type TickSource } from '../usePracticeGame';
import {
  addSlot,
  clearAutosave,
  defaultSaveName,
  deleteSlot,
  loadAutosave,
  loadSlots,
  newSlotId,
  parseSavedGame,
  renameSlot,
  saveFileName,
  saveFileText,
  storageWorks,
  type SavedGame,
} from '../../lib/savedGames';
import { ConfirmDialog, SaveGameDialog, saveSummary, UnresumableDialog, type SavesProps } from '../components/SavedGames';
import { CoachPanel, MoveToast, NO_ALTS, Scorecard, type CoachNote } from '../components/board/CoachPanel';
import { shownLabel } from '../../lib/coachWords';
import { PlaySetup, type Seat } from '../components/PlaySetup';
import { OngoingGames } from '../components/OngoingGames';
import { useSiteConfig } from '../useSiteConfig';
import { recordPractice } from '../../lib/practiceLog';
import { saveReplay } from '../../lib/practiceReplays';
import {
  botItem,
  capProblem,
  clampDays,
  corrItem,
  loadBotGames,
  ongoingFileName,
  ongoingFileText,
  parseOngoingFile,
  removeBotGame,
  sortOngoing,
  spanText,
  timedOutRecords,
  writeBotGame,
  type BotMultiDay,
  type OngoingItem,
} from '../../lib/multiDay';
import { deleteCorrGame, listCorrGames } from '../../net/corr';
import { tierLabel } from '../../ai/tiers';
import '../board.css';

// online play (src/net/) loads only when it is opened, so the ordinary Play page doesn't carry it
const PlayOnline = lazy(() => import('./PlayOnline').then((m) => ({ default: m.PlayOnline })));
// multi-day games against a person (turn packets) load the same way
const PlayCorr = lazy(() => import('./PlayCorr').then((m) => ({ default: m.PlayCorr })));

/** `sub`: "online" opens online play's lobby, "join/<code>" opens it on an invite (when multiplayer is on). */
export function PlayPage({ initialDeck, initialOpp, sub = '', mode = null }: { initialDeck?: string; initialOpp?: string; sub?: string; mode?: string | null }) {
  const site = useSiteConfig();
  if (site.features.multiDayGames && (sub === 'corr' || sub.startsWith('corr/') || sub.startsWith('turn/'))) {
    return (
      <Suspense fallback={<p className="muted" aria-live="polite">Loading…</p>}>
        <PlayCorr sub={sub} initialDeck={initialDeck} />
      </Suspense>
    );
  }
  if (site.features.multiplayer && (sub === 'online' || sub.startsWith('join/'))) {
    return (
      <Suspense fallback={<p className="muted" aria-live="polite">Loading…</p>}>
        <PlayOnline invite={sub.startsWith('join/') ? sub.slice(5) : null} mode={mode === 'join' ? 'join' : 'host'} initialDeck={initialDeck} />
      </Suspense>
    );
  }
  return <PracticePlay initialDeck={initialDeck} initialOpp={initialOpp} online={site.features.multiplayer} />;
}

function PracticePlay({ initialDeck, initialOpp, online }: { initialDeck?: string; initialOpp?: string; online: boolean }) {
  // defaults skip decks hidden in this browser; a link to a deleted deck finds nothing and falls back to them
  const [mine, setMine] = useState(() => findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file ?? '');
  const [opp, setOpp] = useState(() => findDeck(initialOpp)?.file ?? firstVisibleDeck(findDeck(initialDeck)?.file ?? firstVisibleDeck()?.file)?.file ?? '');
  const [seat, setSeat] = useState<Seat>('random');
  // the site config sets the default bot tier and can turn the coach, saved games and game review off
  const site = useSiteConfig();
  const coachOn = site.features.coach;
  const [coachPick, setCoach] = useState(true);
  const coach = coachPick && coachOn;
  const [levelPick, setLevel] = useState<Tier>(site.play.defaultTier);
  const level: Tier = site.play.tiers.includes(levelPick) ? levelPick : site.play.defaultTier;
  // the bot's pace is remembered in this browser (an old stored "fast" of 250 ms maps to today's fast)
  const [speed, setSpeedRaw] = useState(loadBotSpeed);
  const setSpeed = useCallback((ms: number) => {
    const v = normalizeBotSpeed(ms);
    setSpeedRaw(v);
    saveBotSpeed(v);
  }, []);
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const coachRef = useRef(coach);
  coachRef.current = coach;
  const { session, game, start: startMatch, startMultiDay, resume, resumeMultiDay, undo, quit, concede, multiDay } = usePracticeGame(
    () => speedRef.current,
    () => coachRef.current,
  );
  const [settings, updateSettings, resetSettings] = useBoardSettings();
  const [showSettings, setShowSettings] = useState(false);
  const dA = useMemo(() => findDeck(mine), [mine]);
  const dB = useMemo(() => findDeck(opp), [opp]);

  // multi-day games (src/lib/multiDay.ts; features.multiDayGames): kept in their own list, never in the autosave
  const mdOn = site.features.multiDayGames;
  const [mdPick, setMdPick] = useState(false);
  const [mdDaysPick, setMdDays] = useState(site.multiDay.defaultDays);
  const mdDays = clampDays(mdDaysPick, site.multiDay);
  const [mdNow, setMdNow] = useState(Date.now);
  const [botGames, setBotGames] = useState(loadBotGames);
  const [corrGames, setCorrGames] = useState(() => listCorrGames());
  const reloadOngoing = useCallback(() => {
    setBotGames(loadBotGames());
    setCorrGames(listCorrGames());
    setMdNow(Date.now());
  }, []);
  useEffect(() => {
    if (game || !mdOn) return;
    reloadOngoing();
    const t = setInterval(() => setMdNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [game, mdOn, reloadOngoing]);
  const ongoingOpen = { bot: botGames.length, pvp: corrGames.filter((g) => g.stage !== 'over' && g.stage !== 'refused').length };
  const cap = site.multiDay.maxOngoing;
  const mdBlocked = capProblem(ongoingOpen, cap);
  const [storageWorksHere] = useState(storageWorks);
  const mdWanted = mdOn && mdPick && storageWorksHere;

  const begin = () => {
    const A = dA?.deck;
    const B = dB?.deck;
    if (!A || !B) return;
    const first: PlayerId | undefined = seat === 'first' ? 0 : seat === 'second' ? 1 : undefined;
    const decks: [DeckList, DeckList] = [gameDeck(A), gameDeck(B)];
    // the End turn setting is fixed for the game when it starts (a change applies to the next game)
    const m = { decks, seed: Math.floor(Math.random() * 2 ** 31), first, level, botSeed: Date.now() % 100000, ...(settings.endTurn === 'click' ? { endTurnClick: true } : {}) };
    if (mdWanted) {
      if (!mdBlocked) startMultiDay(m, mdDays);
    } else startMatch(m);
  };

  // saved games (src/lib/savedGames.ts): the autosave of the unfinished game and the named saves, read again whenever
  // the setup screen shows; with storage blocked the feature is hidden and the setup screen says why
  const storageOk = storageWorksHere && site.features.savedGames;
  const [autosave, setAutosave] = useState(loadAutosave);
  const [slots, setSlots] = useState(loadSlots);
  const [restoring, setRestoring] = useState(false);
  const [problem, setProblem] = useState<{ save: SavedGame; why: string } | null>(null);
  const [askNew, setAskNew] = useState(false);
  useEffect(() => {
    if (game) return;
    setAutosave(loadAutosave());
    setSlots(loadSlots());
  }, [game]);
  // a new game from the setup screen while an unfinished one is saved asks first (a rematch after a game doesn't; a
  // multi-day game never replaces the autosave, so it doesn't ask)
  const start = () => {
    if (!game && storageOk && loadAutosave() && !mdWanted) setAskNew(true);
    else begin();
  };
  const [mdBusy, setMdBusy] = useState(false);
  const resumeBot = (e: BotMultiDay, late: boolean) => {
    setMdBusy(true);
    void resumeMultiDay(e, late).then((r) => {
      setMdBusy(false);
      if (r.ok) setCoach(e.save.coach);
      else if (r.mismatch) setProblem({ save: e.save, why: r.why });
    });
  };
  const botOf = (it: OngoingItem) => botGames.find((x) => x.id === it.id);
  const corrOf = (it: OngoingItem) => corrGames.find((x) => x.id === it.id && x.role === it.role);
  const ongoingItems = sortOngoing([...botGames.map((e) => botItem(e, mdNow, tierLabel)), ...corrGames.map((g) => corrItem(g, mdNow))]);
  const ongoingPanel = (
    <OngoingGames
      items={ongoingItems}
      now={mdNow}
      storage={storageWorksHere}
      cap={cap}
      busy={mdBusy || restoring}
      onOpen={(it) => {
        const e = botOf(it);
        if (e) resumeBot(e, false);
        else if (corrOf(it)) location.hash = `#/play/corr/${it.id}/${it.role}`;
      }}
      onFinishLate={(it) => {
        const e = botOf(it);
        if (e) resumeBot(e, true);
      }}
      onCloseTimedOut={(it) => {
        const e = botOf(it);
        if (!e) return;
        const r = timedOutRecords(e, Date.now());
        saveReplay(r.replay);
        recordPractice(r.entry);
        removeBotGame(e.id);
        reloadOngoing();
      }}
      onExport={(it) => {
        const e = botOf(it);
        const c = corrOf(it);
        const when = new Date().toISOString();
        const g = e ? ({ type: 'bot', game: e } as const) : c ? ({ type: 'pvp', game: c } as const) : null;
        if (g) download(ongoingFileName(g, when), ongoingFileText(g, when), 'application/json');
      }}
      onDelete={(it) => {
        if (it.type === 'bot') removeBotGame(it.id);
        else if (it.role) deleteCorrGame(it.id, it.role);
        reloadOngoing();
      }}
      onImport={async (text) => {
        // a game against a person is checked with the game code (loaded now, as when one is opened)
        const corr = text.includes('"nct-corr-game"') ? await import('../../net/corrStore') : null;
        const r = parseOngoingFile(text, corr?.parseCorrGame);
        if (!r.ok) return r.why;
        const v = r.value;
        const known = v.type === 'bot' ? botGames.some((x) => x.id === v.game.id) : corrGames.some((x) => x.id === v.game.id && x.role === v.game.role);
        if (!known && mdBlocked) return mdBlocked;
        const why = v.type === 'bot' ? writeBotGame(v.game) : (corr?.browserCorrStore().save(v.game) ?? 'This game could not be stored.');
        reloadOngoing();
        return why ?? (known ? 'Imported: it replaced the copy of this game already in this browser.' : null);
      }}
    />
  );
  const resumeSave = (s: SavedGame) => {
    setRestoring(true);
    void resume(s).then((r) => {
      setRestoring(false);
      if (r.ok) setCoach(s.coach);
      else if (r.mismatch) setProblem({ save: s, why: r.why });
    });
  };
  const saves: SavesProps = {
    storage: storageOk,
    autosave,
    slots,
    restoring,
    onResume: resumeSave,
    onRename: (id, name) => setSlots(renameSlot(id, name)),
    onDelete: (id) => setSlots(deleteSlot(id)),
    onExport: (s) => download(saveFileName(s), saveFileText(s), 'application/json'),
    onImport: (text) => {
      const p = parseSavedGame(text);
      if (!p.ok) return p.why;
      const r = addSlot({ ...p.value, id: newSlotId() });
      if (!r.ok) return r.why;
      setSlots(r.list);
      return null;
    },
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
          setCoach={coachOn ? setCoach : undefined}
          level={level}
          setLevel={setLevel}
          tiers={site.play.tiers}
          reviews={site.features.gameReview}
          dA={dA}
          dB={dB}
          onStart={start}
          onSettings={() => setShowSettings(true)}
          saves={site.features.savedGames ? saves : undefined}
          online={online}
          multiDay={
            mdOn
              ? {
                  on: mdWanted,
                  setOn: setMdPick,
                  days: mdDays,
                  setDays: setMdDays,
                  min: site.multiDay.minDays,
                  max: site.multiDay.maxDays,
                  blocked: mdBlocked,
                  panel: ongoingPanel,
                }
              : undefined
          }
        />
        {askNew && autosave && (
          <ConfirmDialog
            title="Start a new game?"
            text={<p>Your unfinished game ({saveSummary(autosave)}) is saved. Starting a new game replaces that autosave. Use Resume game to go on with it instead.</p>}
            confirm="Start a new game"
            onConfirm={() => {
              setAskNew(false);
              begin();
            }}
            extra={{
              label: 'Resume it',
              onClick: () => {
                setAskNew(false);
                resumeSave(autosave);
              },
            }}
            onCancel={() => setAskNew(false)}
          />
        )}
        {problem && (
          <UnresumableDialog
            save={problem.save}
            why={problem.why}
            onDelete={() => {
              if (problem.save.id === 'auto') {
                clearAutosave();
                setAutosave(null);
              } else setSlots(deleteSlot(problem.save.id));
              setProblem(null);
            }}
            onClose={() => setProblem(null)}
          />
        )}
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
  const md = multiDay(game);
  return (
    <Board
      key={game.match}
      session={session}
      game={game}
      coach={coach}
      speed={speed}
      setSpeed={setSpeed}
      onQuit={quit}
      onConcede={concede}
      onRematch={start}
      onUndo={undo}
      canSave={storageOk}
      canReview={site.features.gameReview}
      banner={md ? <MultiDayBanner days={md.days} deadline={md.deadline} late={md.late} /> : undefined}
      exitNote={md ? 'You leave the game for now. It stays in Ongoing games on the Play screen until you finish it; nothing is recorded yet.' : undefined}
    />
  );
}

/** Under the turn strip of a multi-day game against the bot: its length and the time left, ticking. */
function MultiDayBanner({ days, deadline, late }: { days: number; deadline: number; late: boolean }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = deadline - now;
  return (
    <div className={`online-status ${left <= 0 ? 'is-lost' : ''}`} role="status">
      <span>Multi-day game ({days} days)</span>
      <span className="online-timer">{left > 0 ? `${spanText(left)} left` : late ? 'Time is up: finishing late' : 'Time is up: finishing it is recorded as late'}</span>
      <span>Exit keeps it in Ongoing games</span>
    </div>
  );
}

/** The seat the board answers through: the practice HumanAgent, or an online seat (src/net/session.ts SeatControl). */
export interface BoardSeat {
  pending: { d: Decision } | null;
  answer(d: Decision | null, i: number): boolean;
}

/** What the board reads of a game: a practice game (Running), or an online game's view. */
export interface BoardRun {
  match: number;
  g: Game;
  human: BoardSeat;
  bot?: { lastThought?: string | null };
  grades: CoachedGrade[];
  replay: PracticeReplay;
  error: string | null;
  cancelled: boolean;
  conceded: boolean;
  stable: Running['stable'];
}

/** An online game's parts of the board (src/ui/pages/PlayOnline.tsx); absent for a game against the bot. */
export interface OnlineBoard {
  rivalName: string;
  canConcede: boolean;
  /** under the turn strip: the connection, whose turn, the timer */
  status: React.ReactNode;
  /** the chat for the side panel's Chat tab (absent when chat is off) */
  chat?: { node: React.ReactNode; unread: number; onSeen: (open: boolean) => void };
  /** the game-over dialog's rematch button and what it says */
  rematchLabel: string;
  rematchDisabled: boolean;
  /** under the result: what happens next (rematch offers, the record) */
  overNote?: React.ReactNode;
  /** the Game review of the finished game, once the record is known */
  review: () => GameReviewSource | null;
  exportGame: () => void;
  /** what Exit does, when it is not "the game ends as abandoned" (a multi-day game is kept) */
  exitNote?: string;
  /** your costs are paid the automatic way (a multi-day game's guest: the host's device answers them) */
  autoPay?: boolean;
}

export function Board({
  session,
  game,
  coach,
  speed,
  setSpeed,
  onQuit,
  onConcede,
  onRematch,
  onUndo,
  canSave,
  canReview,
  online,
  banner,
  exitNote,
}: {
  session: TickSource;
  game: BoardRun;
  coach: boolean;
  speed: number;
  setSpeed: (n: number) => void;
  onQuit: () => void;
  onConcede: () => void;
  onRematch: () => void;
  onUndo: () => void;
  /** this browser can store saves (and saved games are on) */
  canSave: boolean;
  /** game review is on (site config) */
  canReview: boolean;
  online?: OnlineBoard;
  /** under the turn strip (a multi-day game's countdown) */
  banner?: React.ReactNode;
  /** what Exit does, when it is not the usual (a multi-day game is kept) */
  exitNote?: string;
}) {
  // bumps on every engine update (and on a concede): memoised panels re-render on it, not on drag/menu/hover changes
  const version = useGameTick(session);
  const { g, human, bot, grades } = game;
  const s = g.s;
  const pend = human.pending?.d ?? null;
  // a practice game is a Running; an online game has no Undo and its own concede rule
  const undoable = online ? false : canUndo(game as Running);
  const concedable = online ? online.canConcede : canConcede(game as Running);
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
  const [review, setReview] = useState<GameReviewSource | null>(null);
  const [toast, setToast] = useState<MoveGrade | null>(null);
  // the decision whose advice failed (the coach declined: no 'thinking…' for it), and a bump when a late score lands
  const [adviceFailed, setAdviceFailed] = useState<Decision | null>(null);
  const [gradeTick, setGradeTick] = useState(0);
  // games where you were told once that a move made before the advice arrived is not graded (COACH-8)
  const earlyNoted = useRef(new Set<string>());
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
  // Save game: the named saves while the dialog is open, and a short note once saved
  const [saving, setSaving] = useState<SavedGame[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 2600);
    return () => clearTimeout(t);
  }, [notice]);
  // board settings (src/lib/boardSettings.ts): paying costs, the side panel, colours and backgrounds
  const [settings, updateSettings, resetSettings] = useBoardSettings();
  const [showSettings, setShowSettings] = useState(false);
  const payMode = online?.autoPay ? 'auto' : settings.payMode;
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
    setReview(null);
    setTrashOf(null);
    setPaySel(EMPTY_SELECTION);
    setPayAsk(null);
    payPlan.current = null;
  }, [g]);

  // coach: ask the advisor bot what it would do in this spot
  useEffect(() => {
    // nothing to advise for a one-option decision (ending the turn when nothing else is left: forced, not graded either)
    if (!pend || !coach || !coachWorthAsking(pend) || onlyEndTurn(pend)) return;
    let alive = true;
    // in a worker: a result for a decision that has since changed is dropped (alive, and activeHint checks hint.d)
    advise(g, pend, lift0)
      .then((a) => {
        if (alive) setHint({ d: pend, i: a.index, why: a.why, alts: a.alternatives, advice: a });
      })
      .catch(() => {
        // the coach declined (or its worker failed): stop saying it is thinking; a superseded request is not alive
        if (alive) setAdviceFailed(pend);
      });
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
  // what the coach box shows besides the pick: the reason, the best other option, or 'thinking…' while advice is on its way
  const coachNote = useMemo<CoachNote | undefined>(() => {
    if (!coach || !pend || !coachWorthAsking(pend) || onlyEndTurn(pend)) return undefined;
    if (activeHint) return { why: activeHint.why, ...(activeHint.alts[0] ? { next: activeHint.alts[0] } : {}) };
    return { thinking: adviceFailed !== pend };
  }, [coach, pend, activeHint, adviceFailed]);
  const mark = useMemo(() => coachMark(pend, activeHint?.i), [pend, activeHint]);

  /** Answer decision `d` (the one shown when the control was drawn); stale or invalid answers are ignored. */
  const commit = useCallback(
    (d: Decision | null, i: number): boolean => {
      setMenu(null);
      setTargeting(null);
      if (!d || !human.answer(d, i)) return false;
      // a move made before the advice arrived can't be graded: say so once a game, plainly, instead of nothing
      if (coach && coachWorthAsking(d) && scorable(d) && !(activeHint && activeHint.d === d) && adviceFailed !== d && !earlyNoted.current.has(game.replay.id)) {
        earlyNoted.current.add(game.replay.id);
        setNotice('That move was made before the coach had finished thinking, so it is not graded. A move is graded once the coach’s pick shows.');
      }
      // grade the move against the coach by value (only when the advice for this exact spot is ready)
      if (coach && activeHint && activeHint.d === d && coachWorthAsking(d)) {
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
            // the game-over effect (practice log, stored coach grades) and the scorecard must see the finished grade
            setGradeTick((x) => x + 1);
          };
          coachApi.score(d, i, advice).then(settle, () => settle([]));
        }
      }
      return true;
    },
    [human, coach, activeHint, adviceFailed, g, grades, coachApi, game.replay],
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
    rivalName: online?.rivalName,
    eddiePick: beforeSel && beforeSources ? { selected: beforeSel.eddies, add: () => setPaySel(addEddie(beforeSel, readyEddies(beforeSources))) } : undefined,
  };

  const over = s.winner !== null;
  const failed = game.error;
  // the scorecard goes into the practice log with the game (the profile's coach averages read it)
  useEffect(() => {
    if (!over || !coach) return;
    const sum = coachSummary(grades);
    if (sum && sum.measured > 0) annotatePractice(game.replay.id, sum);
    // the coach's grades go with the game, so a Game review run later (from the Profile) keeps them
    saveCoachRatings(game.replay.id, coachRatingsFrom(grades.map((x) => x.record), game.replay.choices.length, GIG_SWING), game.replay.choices);
  }, [over, coach, grades, grades.length, gradeTick, game.replay.id, game.replay.choices]);
  const onlineReview = online && over ? online.review() : null;
  const openReview = () => {
    setHideOver(true);
    if (online) {
      if (onlineReview) setReview(onlineReview);
      return;
    }
    setReview({ replay: game.replay, coach: coachRatingsFrom(grades.map((x) => x.record), game.replay.choices.length, GIG_SWING), persist: true, turns: g.s.turn });
  };
  // a game can be saved once you have been asked something, until it ends
  const savable = !online && canSave && !over && !failed && !game.cancelled && !!game.stable;
  const openSave = () => {
    setMenu(null);
    setTargeting(null);
    setGameMenu(false);
    setSaving(loadSlots());
  };
  // INFO-9: the finished game as a file, with the coach's advice, grade and scores per decision (src/lib/coachedReplay.ts)
  const exportGame = () => {
    if (online) return online.exportGame();
    const c =buildCoachedReplay(game.replay, grades, new Date().toISOString(), GIG_SWING);
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
        <button className={`pb-endturn primary ${onlyEndTurn(pend) ? 'pb-endturn-now' : ''} ${ctx.coach?.i === ix.passIndex ? 'pb-coach-btn' : ''}`} onClick={() => answer(ix.passIndex!)}>
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
  const lastMove = bot?.lastThought ? <div className="small muted pb-lastmove">Bot's last move: {shownLabel(bot.lastThought.replace(/ \((?:eval|projected)[^)]*\)$/, ''))}</div> : null;
  const closeLog = useCallback(() => setLogOpen(false), [setLogOpen]);
  // online: the chat shares the side panel; its unread count shows on the panel's toggle while it is closed
  const chat = online?.chat;
  const unread = chat?.unread ?? 0;
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
            <span className={`pb-turn-who ${s.active === 0 && !over ? 'me' : 'rival'}`}>{conceded ? 'CONCEDED' : over ? 'OVER' : s.active === 0 ? 'YOU' : online ? 'THEM' : 'RIVAL'}</span>
            {s.overtime && <span className="pb-overtime">OT</span>}
          </div>
          <div className="pb-strip-tools">
            {!panelHidden && (
              <button
                type="button"
                className={`ghost pb-icon ${logOpen ? 'on' : ''}`}
                aria-expanded={logOpen}
                aria-controls={DRAWER_ID}
                aria-label={`${chat ? 'Game log and chat' : 'Game log'}${warnings.length ? `, ${warnings.length} coach warnings` : ''}${unread ? `, ${unread} unread messages` : ''}`}
                title={chat ? 'Game log and chat' : 'Game log'}
                onClick={() => setLogOpen(!logOpen)}
              >
                ≡{warnings.length > 0 && <span className="pb-icon-badge">{warnings.length}</span>}
                {unread > 0 && <span className="pb-unread-dot" aria-hidden="true" />}
              </button>
            )}
            {!online && (
              <button type="button" className="pb-icon" onClick={onUndo} disabled={!undoable} aria-label="Undo" title="Undo: back to before your last action">
                ↶
              </button>
            )}
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
          <span className={`pb-turn-who ${s.active === 0 && !over ? 'me' : 'rival'}`}>{conceded ? 'CONCEDED' : over ? 'GAME OVER' : s.active === 0 ? 'YOUR TURN' : online ? `${online.rivalName.toUpperCase()}'S TURN` : "RIVAL'S TURN"}</span>
          {s.overtime && <span className="pb-overtime">OVERTIME</span>}
        </div>
        <div className="pb-strip-tools">
          {narrow ? (
            <button type="button" className={`ghost pb-logbtn ${logOpen ? 'on' : ''}`} aria-expanded={logOpen} aria-controls={DRAWER_ID} onClick={() => setLogOpen(!logOpen)}>
              Log{warnings.length > 0 ? ` ⚠${warnings.length}` : ''}
            </button>
          ) : (
            !panelHidden && <LogTab log={s.log} open={logOpen} onToggle={setLogOpen} warnings={warnings.length} side={panelSet.position} unread={unread} chat={!!chat} />
          )}
          {!online && (
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
          )}
          <button type="button" className="ghost pb-settings-btn" onClick={() => setShowSettings(true)} aria-label="Settings" title="Settings: paying costs, the log panel, colours and backgrounds">
            ⚙
          </button>
          {canSave && (
            <button onClick={openSave} disabled={!savable} title={savable ? 'Save this game to come back to it later' : 'Nothing to save yet, or the game is over'}>
              Save
            </button>
          )}
          {!online && (
            <button onClick={onUndo} disabled={!undoable} title="Go back to before your last action (also undoes the bot's moves since)">
              ↶ Undo
            </button>
          )}
          {over && hideOver && <button onClick={() => setHideOver(false)}>Result</button>}
          {!over && (
            <button className="pb-concede" onClick={() => openLeave('concede')} disabled={!concedable} title="End the game now as a recorded loss">
              ⚑ Concede
            </button>
          )}
          <button className="pb-exit" onClick={over ? onQuit : () => openLeave('exit')} title={over ? 'Back to the game setup' : online ? 'Leave this game: it ends as abandoned (a draw)' : 'Leave this game without recording a result'}>
            {over ? 'New game' : 'Exit game'}
          </button>
        </div>
      </div>
      )}
      {online?.status}
      {banner}
      <div className="pb-stage">
        {failed && (
          <div className="panel pb-error" role="alert">
            <b style={{ color: 'var(--red)' }}>The game stopped because of an error.</b> <span className="small muted">{failed.slice(0, 300)}</span>
            <div className="row" style={{ marginTop: 8 }}>
              {!online && (
                <button className="primary" onClick={onUndo} disabled={!undoable}>
                  ↶ Undo to before your last decision
                </button>
              )}
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
                <PromptPanel ctx={ctx} note={coachNote} hidePass />
              </section>
            )}
          </div>
        </div>
        {narrow && (
          <PhonePanel
            ctx={ctx}
            state={panel}
            note={coachNote}
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
        <LogDrawer log={s.log} n={s.log.length} open={logOpen} sheet={narrow} onClose={closeLog} coach={coachPanel} footer={lastMove} panel={panelSet} chat={chat?.node} unread={unread} onChatShown={chat?.onSeen} />
      </div>
      {navOpen && (
        <div className="pb-nav-backdrop" onClick={() => setNavOpen(false)}>
          <p className="pb-nav-note">
            {over ? 'Opening another page ends this game.' : 'Opening another page leaves this game without recording it; it stays saved, and Resume game on the Play page brings it back.'} Click here or press Escape to go back to it.
          </p>
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
              setSpeed={online ? undefined : setSpeed}
              sortLabel={SORT_LABEL[sortMode]}
              onSort={() => setSortMode(nextSort(sortMode))}
              onSite={() => setNavOpen(true)}
              onExit={over ? onQuit : () => openLeave('exit')}
              exitLabel={over ? 'New game' : 'Exit game'}
              onExport={over ? exportGame : undefined}
              onSave={savable ? openSave : undefined}
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
              setSpeed={online ? undefined : setSpeed}
              panels={{ logOpen, setLogOpen, allOpen, setAllOpen }}
              onClose={() => setShowSettings(false)}
            />
          )}
          {refusal && (
            <div className="pb-refusal" role="status">
              {refusal}
            </div>
          )}
          {saving && (
            <SaveGameDialog
              defaultName={defaultSaveName({ decks: game.replay.decks, turn: s.turn })}
              slots={saving}
              onSave={(name) => {
                const save = saveOfRun(game as Running, coach, newSlotId(), name);
                if (!save) return 'There is nothing to save yet: wait for your next decision.';
                const r = addSlot(save);
                if (!r.ok) return r.why;
                setSaving(null);
                setNotice(`Saved: ${save.name}`);
                return null;
              }}
              onDelete={(id) => setSaving(deleteSlot(id))}
              onClose={() => setSaving(null)}
            />
          )}
          {notice && (
            <div className="pb-refusal pb-notice" role="status">
              {notice}
            </div>
          )}
        </>,
        document.body,
      )}
      {leave && (
        <LeaveDialog
          online={!!online}
          note={exitNote ?? online?.exitNote}
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
      {mulligan && !over && !failed && <MulliganScreen ctx={ctx} note={coachNote} />}
      {over && !hideOver && (
        <GameOverOverlay
          g={g}
          conceded={conceded}
          onRematch={onRematch}
          rematchLabel={online?.rematchLabel}
          rematchDisabled={online?.rematchDisabled}
          newLabel={online ? 'Leave' : undefined}
          onNew={onQuit}
          onHide={() => setHideOver(true)}
          onUndo={undoable ? onUndo : undefined}
          review={
            <>
              {coach && <Scorecard grades={grades} />}
              {online?.overNote}
              <div className="row" style={{ marginTop: 10, justifyContent: 'center' }}>
                {canReview && (!online || onlineReview) && (
                  <button className="ghost" onClick={openReview} title="A rating for every move of both sides, the turning point, and the board at each move">
                    🔍 Game review
                  </button>
                )}
                <button
                  className="ghost"
                  onClick={exportGame}
                  disabled={!!online && !onlineReview}
                  title={online ? 'Save this game as a file: the full record and the chat' : "Save this game as a file: seeds, your moves and the coach's advice on each"}
                >
                  ⤓ Export game
                </button>
              </div>
            </>
          }
        />
      )}
      {review && <GameReviewModal src={review} title="Game review" onClose={() => setReview(null)} backdropClassName="pb-review-backdrop" />}
    </div>
  );
}

const NO_WARNINGS: string[] = [];
